#!/usr/bin/env node

/**
 * QQ Bot MCP Setup Wizard
 * 首次安装后自动运行的配置向导
 *
 * 功能:
 *   - 检查并安装依赖
 *   - 检查并执行构建
 *   - 配置机器人凭证
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { checkChannelSupport } from './check-channel-support.js';

const CONFIG_DIR = path.join(os.homedir(), '.claude', 'qqbot-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 获取插件根目录
const PLUGIN_ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));

// 必需的依赖列表
const REQUIRED_DEPENDENCIES = [
  { name: 'dotenv', package: 'dotenv' },
  { name: 'ws', package: 'ws' },
];

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

// ============ 环境检查函数 ============

/**
 * 检查依赖是否已安装
 */
function checkDependencies() {
  const issues = [];
  const nodeModulesPath = path.join(PLUGIN_ROOT, 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    issues.push({
      type: 'critical',
      message: 'node_modules 不存在',
      fix: 'npm install'
    });
    return issues;
  }

  for (const dep of REQUIRED_DEPENDENCIES) {
    const depPath = path.join(nodeModulesPath, dep.name);
    if (!fs.existsSync(depPath)) {
      issues.push({
        type: 'critical',
        message: `依赖 ${dep.name} 未安装`,
        fix: `npm install ${dep.package}`
      });
    }
  }

  return issues;
}

/**
 * 检查构建输出是否存在
 */
function checkBuild() {
  const issues = [];
  const distPath = path.join(PLUGIN_ROOT, 'dist');

  if (!fs.existsSync(distPath)) {
    issues.push({
      type: 'critical',
      message: 'dist 目录不存在，项目未构建',
      fix: 'npm run build'
    });
    return issues;
  }

  // 检查关键文件
  // 新路径：打包后的 dist/mcp/index.js
  // 旧路径：tsc 编译的 dist/src/mcp/（向后兼容）
  const criticalFiles = [
    'dist/mcp/index.js',
    'dist/src/mcp/index.js',  // 向后兼容
    'dist/src/proactive.js',
    'dist/src/gateway.js',
  ];

  for (const file of criticalFiles) {
    if (!fs.existsSync(path.join(PLUGIN_ROOT, file))) {
      issues.push({
        type: 'warning',
        message: `${file} 不存在`,
        fix: 'npm run build'
      });
    }
  }

  return issues;
}

/**
 * 自动修复环境问题
 */
function autoFixEnvironment() {
  log('cyan', '\n🔧 正在检查并修复环境...\n');

  const nodeModulesPath = path.join(PLUGIN_ROOT, 'node_modules');

  // 1. 安装依赖
  if (!fs.existsSync(nodeModulesPath)) {
    log('yellow', '  📦 安装依赖...');
    try {
      execSync('npm install', { cwd: PLUGIN_ROOT, stdio: 'inherit' });
      log('green', '  ✅ 依赖安装完成');
    } catch (e) {
      log('red', '  ❌ 依赖安装失败，请手动运行: npm install');
      return false;
    }
  } else {
    // 检查是否有缺失的依赖
    for (const dep of REQUIRED_DEPENDENCIES) {
      const depPath = path.join(nodeModulesPath, dep.name);
      if (!fs.existsSync(depPath)) {
        log('yellow', `  📦 安装缺失的依赖: ${dep.name}...`);
        try {
          execSync(`npm install ${dep.package}`, { cwd: PLUGIN_ROOT, stdio: 'inherit' });
          log('green', `  ✅ ${dep.name} 安装完成`);
        } catch (e) {
          log('red', `  ❌ ${dep.name} 安装失败`);
          return false;
        }
      }
    }
  }

  // 2. 构建项目
  const distPath = path.join(PLUGIN_ROOT, 'dist');
  if (!fs.existsSync(distPath)) {
    log('yellow', '  🔨 构建项目...');
    try {
      execSync('npm run build', { cwd: PLUGIN_ROOT, stdio: 'inherit' });
      log('green', '  ✅ 构建完成');
    } catch (e) {
      log('red', '  ❌ 构建失败，请手动运行: npm run build');
      return false;
    }
  }

  log('green', '\n✅ 环境检查完成！\n');
  return true;
}

/**
 * 运行完整的环境检查
 */
function runEnvironmentCheck() {
  log('cyan', '\n🔍 环境检查\n');

  const depIssues = checkDependencies();
  const buildIssues = checkBuild();
  const allIssues = [...depIssues, ...buildIssues];

  if (allIssues.length === 0) {
    log('green', '  ✅ 所有检查通过\n');
    return true;
  }

  log('yellow', `  发现 ${allIssues.length} 个问题:\n`);
  allIssues.forEach((issue, i) => {
    const icon = issue.type === 'critical' ? '❌' : '⚠️';
    log('red', `  ${icon} ${issue.message}`);
    log('dim', `     修复: ${issue.fix}`);
  });

  return false;
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return { version: '1.0.0', bots: {}, lastUpdated: Date.now() };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return { version: '1.0.0', bots: {}, lastUpdated: Date.now() };
  }
}

function writeConfig(config) {
  ensureConfigDir();
  config.lastUpdated = Date.now();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function isConfigured() {
  const config = readConfig();
  return Object.keys(config.bots).length > 0 ||
    (process.env.QQBOT_APP_ID && process.env.QQBOT_CLIENT_SECRET);
}

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function runSetupWizard() {
  log('cyan', '\n╔══════════════════════════════════════════════════════════╗');
  log('cyan', '║       🤖 QQ Bot MCP - 首次配置向导                       ║');
  log('cyan', '╚══════════════════════════════════════════════════════════╝\n');

  log('dim', '此向导将帮助你配置 QQ 机器人，使其能与 Claude Code 通信。');
  log('dim', '你需要准备：QQ 开放平台的 AppID 和 Client Secret\n');

  // 检测 Claude Code 版本是否支持 Channel 模式
  log('cyan', '🔍 检测 Claude Code 版本...');
  const channelSupport = checkChannelSupport();

  if (channelSupport.supported) {
    log('green', `  ✅ ${channelSupport.message}`);
    log('dim', '     将启用 Channel 模式 (实时推送 + 权限中继)\n');
  } else {
    log('yellow', `  ⚠️  ${channelSupport.message}`);
    log('dim', '     将使用 MCP Tools 兼容模式 (轮询方式，功能完整)\n');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // 检查环境变量
    if (process.env.QQBOT_APP_ID && process.env.QQBOT_CLIENT_SECRET) {
      log('green', '✅ 检测到环境变量配置');
      log('dim', `   QQBOT_APP_ID: ${process.env.QQBOT_APP_ID.slice(0, 8)}...`);
      log('dim', '   QQBOT_CLIENT_SECRET: ******\n');

      const useEnv = await prompt(rl, '是否使用环境变量配置？(Y/n): ');
      if (useEnv.toLowerCase() !== 'n') {
        log('green', '\n✅ 将使用环境变量配置');
        rl.close();
        return;
      }
    }

    // 交互式配置
    const botName = await prompt(rl, '请输入机器人名称 (默认: default): ');
    const name = botName.trim() || 'default';

    const appId = await prompt(rl, '请输入 AppID: ');
    if (!appId.trim()) {
      log('red', '❌ AppID 不能为空');
      rl.close();
      return;
    }

    // 隐藏输入 Secret
    let clientSecret = '';
    if (process.stdin.isTTY) {
      // TTY 模式：使用 setRawMode 隐藏输入
      process.stdout.write('请输入 Client Secret: ');
      process.stdin.setRawMode(true);
      await new Promise((resolve) => {
        process.stdin.on('data', (char) => {
          if (char === '\n' || char === '\r') {
            process.stdin.setRawMode(false);
            process.stdout.write('\n');
            resolve();
          } else if (char === '\u0003') {
            process.exit();
          } else if (char === '\u007F') {
            clientSecret = clientSecret.slice(0, -1);
          } else {
            clientSecret += char;
          }
        });
      });
    } else {
      // 非 TTY 模式：使用普通 readline 输入
      clientSecret = await prompt(rl, '请输入 Client Secret: ');
    }

    if (!clientSecret.trim()) {
      log('red', '❌ Client Secret 不能为空');
      rl.close();
      return;
    }

    const defaultTarget = await prompt(rl, '默认目标 ID (可选，按回车跳过): ');
    const imageServer = await prompt(rl, '图床服务器地址 (可选，按回车跳过): ');

    // 保存配置
    const config = readConfig();
    config.bots[name] = {
      name,
      appId: appId.trim(),
      clientSecret: clientSecret.trim(),
      enabled: true,
      defaultTargetId: defaultTarget.trim() || undefined,
      imageServerBaseUrl: imageServer.trim() || undefined,
      markdownSupport: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    writeConfig(config);

    log('green', '\n✅ 配置完成！');
    log('dim', `配置文件: ${CONFIG_FILE}\n`);

    log('cyan', '可用命令:');
    log('dim', '  /qqbot-send <target> <message>  - 发送消息到 QQ');
    log('dim', '  /qqbot-tasks                    - 获取未读任务');
    log('dim', '  /qqbot-list                     - 列出已配置机器人');
    log('dim', '  /qqbot-upload <target> <file>   - 上传文件到 QQ\n');

  } finally {
    rl.close();
  }
}

// 主入口
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    // 检查模式：只检查是否已配置
    if (isConfigured()) {
      log('green', '✅ QQ Bot MCP 已配置');
      process.exit(0);
    } else {
      log('yellow', '⚠️  QQ Bot MCP 尚未配置');
      log('dim', '运行 "qqbot-mcp-cli setup" 或设置环境变量进行配置');
      process.exit(1);
    }
  }

  if (args.includes('--status')) {
    // 状态模式：显示当前配置
    const config = readConfig();
    if (Object.keys(config.bots).length === 0) {
      log('yellow', '暂无已配置的机器人');
      log('dim', '使用环境变量或运行 setup 向导进行配置');
    } else {
      log('cyan', '\n已配置的机器人:\n');
      Object.values(config.bots).forEach((bot) => {
        log('white', `  • ${bot.name}`);
        log('dim', `    AppID: ${bot.appId.slice(0, 8)}...`);
        log('dim', `    默认目标: ${bot.defaultTargetId || '未设置'}`);
      });
    }
    process.exit(0);
  }

  // 环境检查模式
  if (args.includes('--env-check')) {
    const success = runEnvironmentCheck();
    process.exit(success ? 0 : 1);
  }

  // 自动修复模式
  if (args.includes('--fix')) {
    const success = autoFixEnvironment();
    process.exit(success ? 0 : 1);
  }

  // 运行配置向导前先检查环境
  log('cyan', '\n🔍 检查运行环境...\n');

  const envOk = runEnvironmentCheck();
  if (!envOk) {
    log('yellow', '\n⚠️  检测到环境问题，正在尝试自动修复...\n');
    const fixed = autoFixEnvironment();
    if (!fixed) {
      log('red', '\n❌ 自动修复失败，请手动运行以下命令:');
      log('dim', '   cd ' + PLUGIN_ROOT);
      log('dim', '   npm install');
      log('dim', '   npm run build\n');
      process.exit(1);
    }
  }

  // 运行配置向导
  await runSetupWizard();
}

main().catch((err) => {
  log('red', `❌ 错误: ${err.message}`);
  process.exit(1);
});
