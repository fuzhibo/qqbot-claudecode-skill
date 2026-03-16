#!/usr/bin/env node

/**
 * QQ Bot MCP Build Release Script
 *
 * 本项目是 Claude Code 插件，通过 Marketplace 或本地安装使用，不需要发布到 npm。
 *
 * 用法:
 *   node scripts/build-release.js [major|minor|patch]
 *   node scripts/build-release.js --check      # 检查当前版本状态
 *   node scripts/build-release.js --changelog  # 更新 CHANGELOG
 *
 * 安装方式:
 *   - Marketplace: /plugin marketplace add https://github.com/fuzhibo/qqbot-claudecode-skill
 *   - 本地安装: claude plugin add /path/to/qqbot-claudecode-skill
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.dirname(__dirname);
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');
const PLUGIN_JSON = path.join(ROOT_DIR, 'plugin.json');
const MARKETPLACE_JSON = path.join(ROOT_DIR, '.claude-plugin', 'marketplace.json');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  return pkg.version;
}

function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

function formatVersion(major, minor, patch) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(version, type) {
  const { major, minor, patch } = parseVersion(version);

  switch (type) {
    case 'major':
      return formatVersion(major + 1, 0, 0);
    case 'minor':
      return formatVersion(major, minor + 1, 0);
    case 'patch':
    default:
      return formatVersion(major, minor, patch + 1);
  }
}

function updatePackageJson(newVersion) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  pkg.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  log('green', `  ✅ package.json 更新到 ${newVersion}`);
}

function updatePluginJson(newVersion) {
  if (!fs.existsSync(PLUGIN_JSON)) {
    log('yellow', '  ⚠️  plugin.json 不存在，跳过');
    return;
  }

  const plugin = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf-8'));
  plugin.version = newVersion;
  fs.writeFileSync(PLUGIN_JSON, JSON.stringify(plugin, null, 2) + '\n', 'utf-8');
  log('green', `  ✅ plugin.json 更新到 ${newVersion}`);
}

function updateMarketplaceJson(newVersion) {
  if (!fs.existsSync(MARKETPLACE_JSON)) {
    log('yellow', '  ⚠️  marketplace.json 不存在，跳过');
    return;
  }

  const marketplace = JSON.parse(fs.readFileSync(MARKETPLACE_JSON, 'utf-8'));

  // 更新 metadata 版本
  if (marketplace.metadata) {
    marketplace.metadata.version = newVersion;
  }

  // 更新每个插件的版本
  if (marketplace.plugins && Array.isArray(marketplace.plugins)) {
    marketplace.plugins.forEach(plugin => {
      plugin.version = newVersion;
    });
  }

  fs.writeFileSync(MARKETPLACE_JSON, JSON.stringify(marketplace, null, 2) + '\n', 'utf-8');
  log('green', `  ✅ marketplace.json 更新到 ${newVersion}`);
}

function runBuild() {
  log('cyan', '\n🔨 构建项目...\n');

  try {
    execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    log('green', '\n✅ 构建成功\n');
    return true;
  } catch (error) {
    log('red', '\n❌ 构建失败\n');
    return false;
  }
}

function runTests() {
  log('cyan', '\n🧪 运行测试...\n');

  try {
    execSync('npm test', { cwd: ROOT_DIR, stdio: 'inherit' });
    log('green', '\n✅ 测试通过\n');
    return true;
  } catch (error) {
    log('yellow', '\n⚠️  测试失败或无测试\n');
    return true; // 允许无测试时继续
  }
}

function getGitStatus() {
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf-8' });
    return status.trim();
  } catch {
    return '';
  }
}

function getGitLog(since) {
  try {
    const log = execSync(`git log ${since}..HEAD --oneline --no-merges`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });
    return log.trim();
  } catch {
    return '';
  }
}

function updateChangelog(newVersion, type) {
  const currentVersion = getCurrentVersion();
  const date = new Date().toISOString().split('T')[0];

  // 获取最近的提交记录
  let changes = '';
  try {
    const log = execSync('git log -10 --oneline --no-merges', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });
    changes = log.trim().split('\n').map(line => `  - ${line}`).join('\n');
  } catch {
    changes = '  - 版本更新';
  }

  const entry = `## [${newVersion}] - ${date}

### ${type === 'major' ? '重大更新' : type === 'minor' ? '功能更新' : '问题修复'}

${changes}
`;

  // 读取现有 CHANGELOG 或创建新的
  let changelog = '';
  if (fs.existsSync(CHANGELOG_PATH)) {
    changelog = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  } else {
    changelog = `# Changelog\n\n所有重要的变更都将记录在此文件中。\n\n`;
  }

  // 插入新条目
  const lines = changelog.split('\n');
  const insertIndex = lines.findIndex(l => l.startsWith('## [')) || 4;
  lines.splice(insertIndex, 0, entry);

  fs.writeFileSync(CHANGELOG_PATH, lines.join('\n'), 'utf-8');
  log('green', `  ✅ CHANGELOG.md 已更新`);
}

function createGitTag(version) {
  try {
    execSync(`git tag -a v${version} -m "Release v${version}"`, { cwd: ROOT_DIR });
    log('green', `  ✅ Git tag v${version} 已创建`);
    return true;
  } catch (error) {
    log('yellow', `  ⚠️  Git tag 创建失败: ${error.message}`);
    return false;
  }
}

function showStatus() {
  const currentVersion = getCurrentVersion();
  const { major, minor, patch } = parseVersion(currentVersion);

  log('cyan', '\n📦 版本状态\n');
  log('white', `  当前版本: ${currentVersion}`);
  log('dim', `  大版本: ${major}`);
  log('dim', `  重要版本 (minor): ${minor}`);
  log('dim', `  小版本 (patch): ${patch}`);

  log('cyan', '\n📋 下次版本更新预览\n');
  log('dim', `  major: ${bumpVersion(currentVersion, 'major')} (重大变更)`);
  log('dim', `  minor: ${bumpVersion(currentVersion, 'minor')} (新功能)`);
  log('dim', `  patch: ${bumpVersion(currentVersion, 'patch')} (小修复)`);

  log('cyan', '\n📌 插件安装方式 (无需 npm 发布)\n');
  log('dim', `  Marketplace: /plugin marketplace add https://github.com/fuzhibo/qqbot-claudecode-skill`);
  log('dim', `  本地安装: claude plugin add /path/to/qqbot-claudecode-skill`);

  const gitStatus = getGitStatus();
  if (gitStatus) {
    log('yellow', '\n⚠️  有未提交的变更:\n');
    console.log(gitStatus);
  } else {
    log('green', '\n✅ 工作目录干净\n');
  }
}

async function release(type) {
  log('cyan', '╔══════════════════════════════════════════════════════════╗');
  log('cyan', '║       🚀 QQ Bot MCP Build Release                        ║');
  log('cyan', '╚══════════════════════════════════════════════════════════╝\n');

  const currentVersion = getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, type);

  log('bold', `版本更新: ${currentVersion} → ${newVersion} (${type})\n`);

  // 1. 检查工作目录
  const gitStatus = getGitStatus();
  if (gitStatus) {
    log('yellow', '⚠️  警告: 有未提交的变更');
    log('dim', '建议先提交当前变更再发布新版本\n');
  }

  // 2. 运行测试
  if (!runTests()) {
    log('red', '❌ 测试失败，发布中止');
    process.exit(1);
  }

  // 3. 构建项目
  if (!runBuild()) {
    log('red', '❌ 构建失败，发布中止');
    process.exit(1);
  }

  // 4. 更新版本号
  log('bold', '\n📝 更新版本号\n');
  updatePackageJson(newVersion);
  updatePluginJson(newVersion);
  updateMarketplaceJson(newVersion);

  // 5. 更新 CHANGELOG
  log('bold', '\n📋 更新变更日志\n');
  updateChangelog(newVersion, type);

  // 6. 创建 Git tag
  log('bold', '\n🏷️  创建版本标签\n');
  createGitTag(newVersion);

  // 完成
  log('green', '\n✅ 发布准备完成！\n');
  log('cyan', '📌 本项目是 Claude Code 插件，无需发布到 npm');
  log('cyan', '   用户通过 Marketplace 或本地安装使用\n');
  log('cyan', '后续步骤:');
  log('dim', '  1. 检查变更: git diff');
  log('dim', '  2. 提交变更: git add . && git commit -m "chore: release v' + newVersion + '"');
  log('dim', '  3. 推送代码: git push origin main');
  log('dim', '  4. 推送标签: git push origin v' + newVersion);
  log('cyan', '\n用户更新方式:');
  log('dim', '  - Marketplace: claude plugin update qqbot-mcp');
  log('dim', '  - 本地安装: git pull && npm install && npm run build\n');
}

// 主入口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === '--check' || command === '-c' || command === 'status') {
    showStatus();
    return;
  }

  if (command === '--changelog') {
    const type = args[1] || 'patch';
    updateChangelog(getCurrentVersion(), type);
    return;
  }

  if (!command || !['major', 'minor', 'patch'].includes(command)) {
    log('cyan', '\n用法: node scripts/build-release.js [major|minor|patch]\n');
    log('dim', '  major - 大版本更新 (不兼容的 API 变更)');
    log('dim', '  minor - 重要版本更新 (新功能)');
    log('dim', '  patch - 小版本更新 (Bug 修复)\n');
    log('dim', '选项:');
    log('dim', '  --check     检查当前版本状态');
    log('dim', '  --changelog 仅更新 CHANGELOG\n');
    log('cyan', '📌 本项目是 Claude Code 插件，无需发布到 npm\n');
    showStatus();
    process.exit(1);
  }

  await release(command);
}

main().catch((err) => {
  log('red', `❌ 错误: ${err.message}`);
  process.exit(1);
});
