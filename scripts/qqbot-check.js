#!/usr/bin/env node

/**
 * QQ Bot 状态检查工具
 *
 * 功能：
 * 1. 统一检查 QQ Bot 可用状态
 * 2. 检测凭证、服务、连接状态
 * 3. 提供自动修复建议
 *
 * 用法：
 *   node scripts/qqbot-check.js [--receive] [--send] [--fix]
 *
 * 选项：
 *   --receive  检查消息接收能力
 *   --send     检查消息发送能力
 *   --fix      尝试自动修复发现的问题
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(os.homedir(), '.claude', 'qqbot-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const PID_FILE = path.join(GATEWAY_DIR, 'gateway.pid');
const PROJECTS_FILE = path.join(GATEWAY_DIR, 'projects.json');

// QQ Bot API 配置
const TOKEN_API_HOST = 'bots.qq.com';
const MSG_API_HOST = 'api.sgroup.qq.com';

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

function log(color, message, indent = 0) {
  const prefix = '  '.repeat(indent);
  console.log(`${colors[color]}${prefix}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bold}${title}${colors.reset}`);
}

function logDivider() {
  console.log(`${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
}

// ============ 配置读取 ============
function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function loadProjects() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return { projects: {}, defaultProject: null };
  }
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
  } catch {
    return { projects: {}, defaultProject: null };
  }
}

// ============ 检查函数 ============

/**
 * 检查凭证配置
 */
async function checkCredentials() {
  const checks = [];
  const config = readConfig();

  // 检查配置文件存在
  if (!config) {
    checks.push({
      name: '配置文件',
      status: 'error',
      message: '未找到配置文件，请运行 /qqbot-setup 进行配置',
      fixable: true,
      fixCommand: '/qqbot-setup my-bot'
    });
    return checks;
  }

  checks.push({
    name: '配置文件',
    status: 'ok',
    message: '存在'
  });

  // 检查机器人配置
  const botNames = Object.keys(config.bots || {});
  if (botNames.length === 0) {
    checks.push({
      name: '机器人配置',
      status: 'error',
      message: '未配置任何机器人',
      fixable: true,
      fixCommand: '/qqbot-setup my-bot'
    });
  } else {
    const bot = config.bots[botNames[0]];
    checks.push({
      name: '机器人配置',
      status: 'ok',
      message: `${botNames.length} 个机器人 (${botNames[0]})`
    });

    // 检查必要字段
    if (!bot.appId) {
      checks.push({
        name: 'AppID',
        status: 'error',
        message: '未配置 AppID',
        fixable: true,
        fixCommand: '/qqbot-setup ' + botNames[0]
      });
    } else {
      checks.push({
        name: 'AppID',
        status: 'ok',
        message: `${bot.appId.slice(0, 8)}...`
      });
    }

    if (!bot.clientSecret) {
      checks.push({
        name: 'Client Secret',
        status: 'error',
        message: '未配置 Client Secret',
        fixable: true,
        fixCommand: '/qqbot-setup ' + botNames[0]
      });
    } else {
      checks.push({
        name: 'Client Secret',
        status: 'ok',
        message: '已配置'
      });
    }

    // 检查默认目标
    if (bot.defaultTarget) {
      checks.push({
        name: '默认目标',
        status: 'ok',
        message: bot.defaultTarget
      });
    } else {
      checks.push({
        name: '默认目标',
        status: 'warning',
        message: '未设置（可选）',
        fixable: false
      });
    }
  }

  return checks;
}

/**
 * 检查环境变量
 */
async function checkEnvironment() {
  const checks = [];

  // 检查 Node.js 版本
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion >= 18) {
    checks.push({
      name: 'Node.js 版本',
      status: 'ok',
      message: `${nodeVersion} (>= 18.0.0)`
    });
  } else {
    checks.push({
      name: 'Node.js 版本',
      status: 'error',
      message: `${nodeVersion} (需要 >= 18.0.0)`,
      fixable: false
    });
  }

  // 检查关键依赖
  const pluginDir = path.join(__dirname, '..');
  const nodeModulesPath = path.join(pluginDir, 'node_modules');

  const requiredDeps = ['ws', 'dotenv'];
  for (const dep of requiredDeps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      checks.push({
        name: `依赖: ${dep}`,
        status: 'ok',
        message: '已安装'
      });
    } else {
      checks.push({
        name: `依赖: ${dep}`,
        status: 'error',
        message: '未安装',
        fixable: true,
        fixCommand: 'cd ' + pluginDir + ' && npm install'
      });
    }
  }

  // 检查构建产物
  const distPath = path.join(pluginDir, 'dist');
  if (fs.existsSync(distPath)) {
    checks.push({
      name: '构建产物',
      status: 'ok',
      message: 'dist 目录存在'
    });

    const mcpEntry = path.join(distPath, 'src', 'mcp', 'index.js');
    if (fs.existsSync(mcpEntry)) {
      checks.push({
        name: 'MCP 入口',
        status: 'ok',
        message: '存在'
      });
    } else {
      checks.push({
        name: 'MCP 入口',
        status: 'error',
        message: '不存在',
        fixable: true,
        fixCommand: 'cd ' + pluginDir + ' && npm run build'
      });
    }
  } else {
    checks.push({
      name: '构建产物',
      status: 'error',
      message: 'dist 目录不存在',
      fixable: true,
      fixCommand: 'cd ' + pluginDir + ' && npm run build'
    });
  }

  return checks;
}

/**
 * 检查后台服务状态
 */
async function checkService() {
  const checks = [];

  // 检查 PID 文件
  if (!fs.existsSync(PID_FILE)) {
    checks.push({
      name: '后台服务',
      status: 'warning',
      message: '未运行（PID 文件不存在）',
      fixable: true,
      fixCommand: '/qqbot-service start'
    });
    return checks;
  }

  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());

  // 检查进程是否存在
  try {
    process.kill(pid, 0);
    checks.push({
      name: '后台服务',
      status: 'ok',
      message: `运行中 (PID: ${pid})`
    });
  } catch {
    checks.push({
      name: '后台服务',
      status: 'error',
      message: 'PID 文件存在但进程不存在（僵尸进程）',
      fixable: true,
      fixCommand: 'rm ' + PID_FILE + ' && /qqbot-service start'
    });
    return checks;
  }

  // 检查项目注册状态
  const projects = loadProjects();
  const cwd = process.cwd();
  const currentProject = Object.entries(projects.projects || {}).find(
    ([_, p]) => p.path === cwd
  );

  if (currentProject) {
    checks.push({
      name: '项目注册',
      status: 'ok',
      message: `已注册 (${currentProject[0]})`
    });

    // 检查是否为默认项目
    if (projects.defaultProject === currentProject[0]) {
      checks.push({
        name: '默认项目',
        status: 'ok',
        message: '是'
      });
    } else {
      checks.push({
        name: '默认项目',
        status: 'warning',
        message: `否 (当前默认: ${projects.defaultProject || '无'})`,
        fixable: true,
        fixCommand: '/qqbot-service switch ' + currentProject[0]
      });
    }
  } else {
    checks.push({
      name: '项目注册',
      status: 'warning',
      message: '当前项目未注册',
      fixable: true,
      fixCommand: '/qqbot-service start'
    });
  }

  return checks;
}

/**
 * 检查网络连通性
 */
async function checkNetwork() {
  const checks = [];

  // 检查 QQ Bot Token API
  try {
    const tokenApiResult = await pingHost(TOKEN_API_HOST);
    if (tokenApiResult.success) {
      checks.push({
        name: 'Token API',
        status: 'ok',
        message: `连通 (延迟: ${tokenApiResult.latency}ms)`
      });
    } else {
      checks.push({
        name: 'Token API',
        status: 'error',
        message: `无法连接: ${tokenApiResult.error}`,
        fixable: false
      });
    }
  } catch (error) {
    checks.push({
      name: 'Token API',
      status: 'error',
      message: `检查失败: ${error.message}`,
      fixable: false
    });
  }

  // 检查 QQ Bot Message API
  try {
    const msgApiResult = await pingHost(MSG_API_HOST);
    if (msgApiResult.success) {
      checks.push({
        name: 'Message API',
        status: 'ok',
        message: `连通 (延迟: ${msgApiResult.latency}ms)`
      });
    } else {
      checks.push({
        name: 'Message API',
        status: 'error',
        message: `无法连接: ${msgApiResult.error}`,
        fixable: false
      });
    }
  } catch (error) {
    checks.push({
      name: 'Message API',
      status: 'error',
      message: `检查失败: ${error.message}`,
      fixable: false
    });
  }

  return checks;
}

/**
 * Ping 主机检测连通性
 */
function pingHost(hostname) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.request({
      hostname,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 5000
    }, () => {
      resolve({
        success: true,
        latency: Date.now() - start
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: '连接超时'
      });
    });

    req.end();
  });
}

/**
 * 检查发送能力
 */
async function checkSendAbility() {
  const checks = [];

  // 发送能力主要依赖凭证和网络
  const config = readConfig();
  if (!config || Object.keys(config.bots || {}).length === 0) {
    checks.push({
      name: '发送能力',
      status: 'error',
      message: '未配置机器人',
      fixable: true,
      fixCommand: '/qqbot-setup my-bot'
    });
    return checks;
  }

  // 检查 API 连通性
  const networkChecks = await checkNetwork();
  const tokenApiOk = networkChecks.find(c => c.name === 'Token API')?.status === 'ok';
  const msgApiOk = networkChecks.find(c => c.name === 'Message API')?.status === 'ok';

  if (tokenApiOk && msgApiOk) {
    checks.push({
      name: '发送能力',
      status: 'ok',
      message: '可以发送消息'
    });
  } else {
    checks.push({
      name: '发送能力',
      status: 'warning',
      message: 'API 连接异常，可能无法发送',
      fixable: false
    });
  }

  return checks;
}

/**
 * 检查接收能力
 */
async function checkReceiveAbility() {
  const checks = [];

  // 检查后台服务
  const serviceChecks = await checkService();
  const serviceOk = serviceChecks.find(c => c.name === '后台服务')?.status === 'ok';

  if (!serviceOk) {
    checks.push({
      name: '接收能力',
      status: 'error',
      message: '后台服务未运行，无法接收消息',
      fixable: true,
      fixCommand: '/qqbot-service start'
    });
    return checks;
  }

  // 检查项目注册
  const projectRegistered = serviceChecks.find(c => c.name === '项目注册')?.status === 'ok';
  if (!projectRegistered) {
    checks.push({
      name: '接收能力',
      status: 'warning',
      message: '项目未注册，消息将发送到默认项目',
      fixable: true,
      fixCommand: '/qqbot-service start'
    });
  } else {
    checks.push({
      name: '接收能力',
      status: 'ok',
      message: '可以接收消息'
    });
  }

  return checks;
}

// ============ 主程序 ============
async function main() {
  const args = process.argv.slice(2);
  const checkReceive = args.includes('--receive');
  const checkSend = args.includes('--send');
  const autoFix = args.includes('--fix');
  const checkAll = !checkReceive && !checkSend;

  console.log('\n🤖 QQ Bot 状态检查工具');
  logDivider();

  const allChecks = [];
  const fixSuggestions = [];

  // 环境检查
  logSection('📦 环境检查');
  const envChecks = await checkEnvironment();
  envChecks.forEach(check => {
    const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️ ' : '❌';
    const color = check.status === 'ok' ? 'green' : check.status === 'warning' ? 'yellow' : 'red';
    log(color, `${icon} ${check.name}: ${check.message}`, 0);
    allChecks.push(check);
    if (check.fixable && check.status !== 'ok') {
      fixSuggestions.push(check.fixCommand);
    }
  });

  // 凭证检查
  logSection('📋 凭证配置');
  const credChecks = await checkCredentials();
  credChecks.forEach(check => {
    const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️ ' : '❌';
    const color = check.status === 'ok' ? 'green' : check.status === 'warning' ? 'yellow' : 'red';
    log(color, `${icon} ${check.name}: ${check.message}`, 0);
    allChecks.push(check);
    if (check.fixable && check.status !== 'ok') {
      fixSuggestions.push(check.fixCommand);
    }
  });

  // 发送能力检查
  if (checkAll || checkSend) {
    logSection('📤 发送能力');
    const sendChecks = await checkSendAbility();
    sendChecks.forEach(check => {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️ ' : '❌';
      const color = check.status === 'ok' ? 'green' : check.status === 'warning' ? 'yellow' : 'red';
      log(color, `${icon} ${check.name}: ${check.message}`, 0);
      allChecks.push(check);
      if (check.fixable && check.status !== 'ok') {
        fixSuggestions.push(check.fixCommand);
      }
    });
  }

  // 接收能力检查
  if (checkAll || checkReceive) {
    logSection('📥 接收能力');
    const recvChecks = await checkReceiveAbility();
    recvChecks.forEach(check => {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️ ' : '❌';
      const color = check.status === 'ok' ? 'green' : check.status === 'warning' ? 'yellow' : 'red';
      log(color, `${icon} ${check.name}: ${check.message}`, 0);
      allChecks.push(check);
      if (check.fixable && check.status !== 'ok') {
        fixSuggestions.push(check.fixCommand);
      }
    });
  }

  // 网络检查（仅在完整检查或发送检查时）
  if (checkAll || checkSend) {
    logSection('🌐 网络连通');
    const netChecks = await checkNetwork();
    netChecks.forEach(check => {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️ ' : '❌';
      const color = check.status === 'ok' ? 'green' : check.status === 'warning' ? 'yellow' : 'red';
      log(color, `${icon} ${check.name}: ${check.message}`, 0);
      allChecks.push(check);
    });
  }

  // 汇总
  logDivider();
  logSection('📊 检查汇总');

  const okCount = allChecks.filter(c => c.status === 'ok').length;
  const warningCount = allChecks.filter(c => c.status === 'warning').length;
  const errorCount = allChecks.filter(c => c.status === 'error').length;

  log('green', `✅ 通过: ${okCount} 项`);
  if (warningCount > 0) {
    log('yellow', `⚠️  警告: ${warningCount} 项`);
  }
  if (errorCount > 0) {
    log('red', `❌ 错误: ${errorCount} 项`);
  }

  // 修复建议
  if (fixSuggestions.length > 0) {
    console.log('\n💡 修复建议');
    logDivider();
    const uniqueFixes = [...new Set(fixSuggestions)];
    uniqueFixes.forEach((cmd, index) => {
      log('cyan', `${index + 1}. ${cmd}`, 0);
    });

    if (autoFix) {
      console.log('\n🔧 自动修复模式已启用，但未实现自动修复功能。');
      console.log('   请手动执行上述建议命令。');
    }
  }

  // 下一步提示
  console.log('\n👉 下一步');
  logDivider();

  if (errorCount > 0) {
    log('yellow', '请先修复上述错误，然后重新运行检查。', 0);
  } else if (warningCount > 0) {
    log('cyan', '您可以继续使用，但建议处理警告项。', 0);
    if (checkReceive || checkAll) {
      log('cyan', '运行 /qqbot-tasks 获取未读消息', 0);
    }
  } else {
    log('green', '✨ 所有检查通过！', 0);
    if (checkReceive || checkAll) {
      log('cyan', '运行 /qqbot-tasks 获取未读消息', 0);
    }
    if (checkSend || checkAll) {
      log('cyan', '运行 /qqbot-send <targetId> <message> 发送消息', 0);
    }
  }

  console.log('');

  // 返回退出码
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('检查失败:', error);
  process.exit(1);
});
