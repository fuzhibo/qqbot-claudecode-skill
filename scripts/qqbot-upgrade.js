#!/usr/bin/env node
/**
 * QQ Bot Gateway 升级清理脚本
 * 处理版本升级时的状态迁移和清理
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GATEWAY_DIR = path.join(process.env.HOME, '.claude', 'qqbot-gateway');
const PROJECTS_FILE = path.join(GATEWAY_DIR, 'projects.json');
const SESSIONS_DIR = path.join(GATEWAY_DIR, 'sessions');
const HOOKS_FILE = path.join(GATEWAY_DIR, 'hooks.json');
const LOG_FILE = path.join(GATEWAY_DIR, 'gateway.log');
const PID_FILE = path.join(GATEWAY_DIR, 'gateway.pid');
const VERSION_FILE = path.join(GATEWAY_DIR, 'version.json');

// 获取当前插件版本
function getCurrentVersion() {
  try {
    const packageJson = require('../package.json');
    return packageJson.version;
  } catch {
    return 'unknown';
  }
}

// 获取已安装版本
function getInstalledVersion() {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      const versionInfo = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
      return versionInfo.version;
    }
  } catch {
    // ignore
  }
  return null;
}

// 保存当前版本
function saveCurrentVersion() {
  const version = getCurrentVersion();
  fs.writeFileSync(VERSION_FILE, JSON.stringify({
    version,
    upgradedAt: new Date().toISOString()
  }, null, 2));
}

// 检查服务是否运行
function isServiceRunning() {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
      // 检查进程是否存在
      process.kill(pid, 0);
      return true;
    }
  } catch {
    // 进程不存在或无法访问
  }
  return false;
}

// 停止服务
function stopService() {
  if (isServiceRunning()) {
    console.log('正在停止后台服务...');
    try {
      execSync('node scripts/qqbot-gateway.js stop', { stdio: 'inherit' });
      console.log('✅ 后台服务已停止');
    } catch (error) {
      console.warn('⚠️ 停止服务失败，可能需要手动处理');
    }
  }
}

// 备份配置
function backupConfig() {
  const backupDir = path.join(GATEWAY_DIR, 'backups');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.mkdirSync(backupPath, { recursive: true });

  // 备份关键配置文件
  const filesToBackup = [PROJECTS_FILE, HOOKS_FILE];
  filesToBackup.forEach(file => {
    if (fs.existsSync(file)) {
      const fileName = path.basename(file);
      fs.copyFileSync(file, path.join(backupPath, fileName));
    }
  });

  // 备份会话目录
  if (fs.existsSync(SESSIONS_DIR)) {
    const sessionsBackup = path.join(backupPath, 'sessions');
    fs.mkdirSync(sessionsBackup, { recursive: true });
    const sessions = fs.readdirSync(SESSIONS_DIR);
    sessions.forEach(session => {
      fs.copyFileSync(
        path.join(SESSIONS_DIR, session),
        path.join(sessionsBackup, session)
      );
    });
  }

  console.log(`✅ 配置已备份到: ${backupPath}`);
  return backupPath;
}

// 清理过期会话
function cleanupExpiredSessions(maxAgeDays = 7) {
  if (!fs.existsSync(SESSIONS_DIR)) return;

  const now = Date.now();
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  let cleaned = 0;

  const sessions = fs.readdirSync(SESSIONS_DIR);
  sessions.forEach(sessionFile => {
    const filePath = path.join(SESSIONS_DIR, sessionFile);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch {
      // ignore
    }
  });

  if (cleaned > 0) {
    console.log(`✅ 清理了 ${cleaned} 个过期会话`);
  }
}

// 清理日志
function cleanupLogs(maxSizeMB = 10) {
  if (!fs.existsSync(LOG_FILE)) return;

  try {
    const stat = fs.statSync(LOG_FILE);
    const sizeMB = stat.size / (1024 * 1024);

    if (sizeMB > maxSizeMB) {
      // 保留最后 1000 行
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      const lines = content.split('\n');
      const lastLines = lines.slice(-1000).join('\n');
      fs.writeFileSync(LOG_FILE, lastLines);
      console.log(`✅ 日志已清理 (${sizeMB.toFixed(2)}MB -> ${(lastLines.length / 1024 / 1024).toFixed(2)}MB)`);
    }
  } catch {
    // ignore
  }
}

// 迁移配置（处理版本间配置格式变化）
function migrateConfig(fromVersion, toVersion) {
  console.log(`迁移配置: ${fromVersion} -> ${toVersion}`);

  // 示例：如果从 1.0.x 升级到 1.1.x
  if (fromVersion && fromVersion.startsWith('1.0')) {
    // 添加新字段
    if (fs.existsSync(PROJECTS_FILE)) {
      try {
        const config = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
        if (!config.version) {
          config.version = toVersion;
          fs.writeFileSync(PROJECTS_FILE, JSON.stringify(config, null, 2));
          console.log('✅ 配置格式已迁移');
        }
      } catch {
        // ignore
      }
    }
  }
}

// 主升级流程
async function upgrade() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 QQ Bot Gateway 升级处理');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const currentVersion = getCurrentVersion();
  const installedVersion = getInstalledVersion();

  console.log(`当前版本: ${currentVersion}`);
  console.log(`已安装版本: ${installedVersion || '首次安装'}\n`);

  // 1. 停止运行中的服务
  stopService();

  // 2. 备份配置
  let backupPath = null;
  if (installedVersion) {
    backupPath = backupConfig();
  }

  // 3. 清理过期数据
  cleanupExpiredSessions();
  cleanupLogs();

  // 4. 迁移配置
  if (installedVersion && installedVersion !== currentVersion) {
    migrateConfig(installedVersion, currentVersion);
  }

  // 5. 保存新版本信息
  saveCurrentVersion();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 升级处理完成');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (backupPath) {
    console.log(`\n💡 提示: 配置已备份，如需回滚可从 ${backupPath} 恢复`);
  }
  console.log('\n运行以下命令启动服务:');
  console.log('  npm run gateway:start        # 通知模式');
  console.log('  npm run gateway:start -- --auto  # 自动回复模式\n');
}

// 回滚操作
function rollback(backupName) {
  const backupDir = path.join(GATEWAY_DIR, 'backups');
  const backupPath = path.join(backupDir, backupName);

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ 备份不存在: ${backupName}`);
    process.exit(1);
  }

  console.log('正在回滚...');

  // 恢复配置文件
  const filesToRestore = [
    { src: path.join(backupPath, 'projects.json'), dest: PROJECTS_FILE },
    { src: path.join(backupPath, 'hooks.json'), dest: HOOKS_FILE }
  ];

  filesToRestore.forEach(({ src, dest }) => {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✅ 已恢复: ${path.basename(dest)}`);
    }
  });

  // 恢复会话
  const sessionsBackup = path.join(backupPath, 'sessions');
  if (fs.existsSync(sessionsBackup)) {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    const sessions = fs.readdirSync(sessionsBackup);
    sessions.forEach(session => {
      fs.copyFileSync(
        path.join(sessionsBackup, session),
        path.join(SESSIONS_DIR, session)
      );
    });
    console.log(`✅ 已恢复 ${sessions.length} 个会话`);
  }

  console.log('\n✅ 回滚完成');
}

// 列出备份
function listBackups() {
  const backupDir = path.join(GATEWAY_DIR, 'backups');

  if (!fs.existsSync(backupDir)) {
    console.log('暂无备份');
    return;
  }

  const backups = fs.readdirSync(backupDir).filter(name => name.startsWith('backup-'));

  if (backups.length === 0) {
    console.log('暂无备份');
    return;
  }

  console.log('可用备份:');
  backups.sort().reverse().forEach((backup, index) => {
    const stat = fs.statSync(path.join(backupDir, backup));
    console.log(`  ${index + 1}. ${backup} (${stat.mtime.toLocaleString()})`);
  });
}

// CLI 入口
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'rollback':
    if (!args[1]) {
      console.error('用法: node qqbot-upgrade.js rollback <backup-name>');
      listBackups();
      process.exit(1);
    }
    rollback(args[1]);
    break;

  case 'list-backups':
    listBackups();
    break;

  case 'pre-upgrade':
  default:
    upgrade();
    break;
}
