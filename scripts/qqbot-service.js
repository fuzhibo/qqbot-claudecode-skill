#!/usr/bin/env node

/**
 * QQ Bot 服务管理脚本
 *
 * 功能：
 * 1. 管理全局 QQ Bot 网关守护进程
 * 2. 默认输出 AI 友好的 JSON 格式
 * 3. 支持 --human 参数输出人类可读格式
 *
 * 用法：
 *   node scripts/qqbot-service.js status [--human]
 *   node scripts/qqbot-service.js start [--mode <notify|auto>] [--init-prompt <prompt>]
 *   node scripts/qqbot-service.js stop
 *   node scripts/qqbot-service.js restart [--mode <notify|auto>]
 *   node scripts/qqbot-service.js list [--human]
 *   node scripts/qqbot-service.js switch <project-name>
 */

import { spawn, execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 常量
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const PROJECTS_FILE = path.join(GATEWAY_DIR, 'projects.json');
const ACTIVATION_STATE_FILE = path.join(GATEWAY_DIR, 'activation-state.json');
const PID_FILE = path.join(GATEWAY_DIR, 'gateway.pid');
const LOG_FILE = path.join(GATEWAY_DIR, 'gateway.log');
const SESSIONS_DIR = path.join(GATEWAY_DIR, 'sessions');
const GATEWAY_STATE_FILE = path.join(GATEWAY_DIR, 'gateway-state.json');
const GATEWAY_SCRIPT = path.join(__dirname, 'qqbot-gateway.js');

// 确保目录存在
[GATEWAY_DIR, SESSIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============ 工具函数 ============

function parseArgs(args) {
  const result = {
    command: args[0] || 'status',
    options: {},
    positional: []
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        result.options[key] = nextArg;
        i++;
      } else {
        result.options[key] = true;
      }
    } else if (!arg.startsWith('-')) {
      result.positional.push(arg);
    }
  }

  return result;
}

function readJsonFile(filePath, defaultValue = null) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    // 忽略解析错误
  }
  return defaultValue;
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

async function getGatewayPid() {
  let stalePidFile = false;
  let stalePid = null;

  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    if (isProcessRunning(pid)) {
      return { pid, stale: false };
    } else {
      // PID 文件存在但进程已死 - 僵尸状态
      stalePidFile = true;
      stalePid = pid;
    }
  }

  // 尝试通过 pgrep 查找真正运行的进程
  try {
    const { stdout } = await execAsync('pgrep -f "qqbot-gateway.js"');
    const pids = stdout.trim().split('\n').filter(Boolean);
    if (pids.length > 0) {
      return { pid: parseInt(pids[0], 10), stale: false };
    }
  } catch (e) {
    // pgrep 未找到
  }

  // 没有运行中的进程，但可能有僵尸 PID 文件
  if (stalePidFile) {
    return { pid: null, stale: true, stalePid };
  }

  return { pid: null, stale: false };
}

function getRecentLogs(lines = 20) {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const logLines = content.split('\n').filter(Boolean);
      return logLines.slice(-lines);
    }
  } catch (e) {
    // 忽略
  }
  return [];
}

// ============ 命令实现 ============

/**
 * 获取完整的服务状态信息
 */
async function getStatusData() {
  const pidResult = await getGatewayPid();
  const pid = pidResult.pid;
  const stalePidFile = pidResult.stale;
  const stalePid = pidResult.stalePid;

  const projects = readJsonFile(PROJECTS_FILE, { projects: {}, defaultProject: null });
  const activationState = readJsonFile(ACTIVATION_STATE_FILE, {
    gatewayStatus: 'pending_activation',
    users: {},
    pendingMessages: []
  });

  // 获取各项目会话信息
  const sessions = {};
  if (projects.projects) {
    for (const [name, project] of Object.entries(projects.projects)) {
      const sessionFile = path.join(SESSIONS_DIR, `${name}.json`);
      if (fs.existsSync(sessionFile)) {
        sessions[name] = readJsonFile(sessionFile);
      }
    }
  }

  // 计算活跃用户数
  const activeUsers = Object.values(activationState.users || {})
    .filter(u => u.status === 'active');

  // 获取进程详细信息
  let processInfo = null;
  if (pid) {
    try {
      const { stdout } = await execAsync(`ps -p ${pid} -o pid,ppid,%cpu,%mem,etime,cmd --no-headers 2>/dev/null || true`);
      if (stdout.trim()) {
        const parts = stdout.trim().split(/\s+/);
        processInfo = {
          pid: parseInt(parts[0], 10),
          ppid: parseInt(parts[1], 10),
          cpu: parts[2],
          mem: parts[3],
          uptime: parts[4],
          cmd: parts.slice(5).join(' ')
        };
      }
    } catch (e) {
      // 忽略
    }
  }

  // 从状态文件读取模式（优先）或从进程命令行推断
  const gatewayState = readJsonFile(GATEWAY_STATE_FILE, null);
  let mode = 'unknown';
  if (gatewayState && gatewayState.mode) {
    mode = gatewayState.mode;
  } else if (pid && processInfo) {
    // 回退：从命令行推断
    if (processInfo.cmd.includes('--mode auto') || processInfo.cmd.includes('auto')) {
      mode = 'auto';
    } else {
      mode = 'notify';
    }
  }

  return {
    running: pid !== null,
    pid,
    mode,
    gatewayStatus: activationState.gatewayStatus,
    processInfo,
    // 僵尸状态检测
    stalePidFile,
    stalePid,
    projects: {
      list: Object.keys(projects.projects || {}),
      default: projects.defaultProject,
      details: projects.projects
    },
    sessions,
    activation: {
      status: activationState.gatewayStatus,
      activeUserCount: activeUsers.length,
      users: activationState.users,
      pendingMessageCount: (activationState.pendingMessages || []).length
    },
    recentLogs: getRecentLogs(10),
    paths: {
      gatewayDir: GATEWAY_DIR,
      projectsFile: PROJECTS_FILE,
      activationStateFile: ACTIVATION_STATE_FILE,
      pidFile: PID_FILE,
      logFile: LOG_FILE
    }
  };
}

/**
 * 格式化状态为人类可读格式
 */
function formatStatusHuman(data) {
  const lines = [];

  lines.push('🤖 QQ Bot 网关状态');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 检测僵尸状态
  if (data.stalePidFile) {
    lines.push(`状态: ⚠️ 异常 - PID 文件残留`);
    lines.push(`残留 PID: ${data.stalePid} (进程已不存在)`);
    lines.push('');
    lines.push('💡 建议: 运行 restart 命令修复此问题');
  } else if (data.running) {
    lines.push(`状态: 🟢 运行中`);
    lines.push(`PID: ${data.pid}`);
    lines.push(`模式: ${data.mode === 'auto' ? '🟢 自动回复' : '🔵 通知'}`);

    if (data.processInfo) {
      lines.push(`运行时间: ${data.processInfo.uptime}`);
      lines.push(`CPU: ${data.processInfo.cpu}%  内存: ${data.processInfo.mem}%`);
    }
  } else {
    lines.push(`状态: 🔴 已停止`);
  }

  lines.push('');

  // 项目列表
  const projectList = data.projects.list;
  if (projectList.length > 0) {
    lines.push('已注册项目:');
    projectList.forEach((name, idx) => {
      const isDefault = name === data.projects.default;
      const details = data.projects.details[name];
      const marker = isDefault ? '✓ (默认)' : '';
      lines.push(`  ${idx + 1}. ${name} ${marker}`);
      if (details) {
        lines.push(`     路径: ${details.path}`);
      }
    });
  } else {
    lines.push('已注册项目: 无');
  }

  lines.push('');

  // 激活状态
  lines.push(`激活状态: ${data.activation.status}`);
  lines.push(`活跃用户: ${data.activation.activeUserCount} 人`);
  lines.push(`待发送消息: ${data.activation.pendingMessageCount} 条`);

  // 活跃用户详情
  const users = Object.entries(data.activation.users || {});
  if (users.length > 0) {
    lines.push('');
    lines.push('用户详情:');
    users.forEach(([openid, info]) => {
      const statusIcon = info.status === 'active' ? '🟢' :
                         info.status === 'expiring_soon' ? '🟡' : '🔴';
      const expiresAt = new Date(info.msgIdExpiresAt);
      const maxUsage = 4; // MSG_ID_MAX_USAGE
      const remaining = maxUsage - (info.msgIdUsageCount || 0);
      lines.push(`  ${statusIcon} ${openid.slice(0, 12)}...`);
      lines.push(`     状态: ${info.status}`);
      lines.push(`     msg_id 过期: ${expiresAt.toLocaleString()}`);
      lines.push(`     剩余次数: ${remaining}`);
    });
  }

  return lines.join('\n');
}

/**
 * status 命令
 */
async function cmdStatus(options) {
  const data = await getStatusData();

  if (options.human) {
    console.log(formatStatusHuman(data));
  } else {
    // AI 友好的 JSON 格式
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * start 命令
 */
async function cmdStart(options) {
  const mode = options.mode || 'notify';
  const initPrompt = options['init-prompt'] || '';

  const result = {
    success: false,
    action: 'start',
    mode,
    message: '',
    pid: null
  };

  // 检查是否已运行
  const pidResult = await getGatewayPid();
  if (pidResult.pid) {
    result.message = `网关已在运行中 (PID: ${pidResult.pid})`;
    result.pid = pidResult.pid;
    result.success = true;

    if (options.human) {
      console.log(`⚠️ 网关已在运行中 (PID: ${pidResult.pid})`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  // 如果有僵尸 PID 文件，先清理
  if (pidResult.stale) {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  }

  // 启动网关
  try {
    const args = [GATEWAY_SCRIPT, 'start'];
    if (mode === 'auto') {
      args.push('--mode', 'auto');
    }

    const child = spawn('node', args, {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    });

    child.unref();

    // 等待启动
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newPidResult = await getGatewayPid();
    if (newPidResult.pid) {
      result.success = true;
      result.pid = newPidResult.pid;
      result.message = `网关启动成功`;

      if (options.human) {
        console.log(`✅ QQ Bot 网关已启动`);
        console.log(`   PID: ${newPidResult.pid}`);
        console.log(`   模式: ${mode === 'auto' ? '自动回复' : '通知'}`);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      result.message = '网关启动失败，请检查日志';

      if (options.human) {
        console.log(`❌ 网关启动失败，请检查日志: ${LOG_FILE}`);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    }
  } catch (e) {
    result.message = `启动失败: ${e.message}`;

    if (options.human) {
      console.log(`❌ 启动失败: ${e.message}`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
}

/**
 * stop 命令
 */
async function cmdStop(options) {
  const result = {
    success: false,
    action: 'stop',
    message: ''
  };

  const pidResult = await getGatewayPid();
  const pid = pidResult.pid;

  if (!pid) {
    // 清理僵尸 PID 文件
    if (pidResult.stale && fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
      result.message = '已清理残留 PID 文件';
      if (options.human) {
        console.log('🧹 已清理残留 PID 文件');
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      return;
    }

    result.message = '网关未在运行';

    if (options.human) {
      console.log('⚠️ 网关未在运行');
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');

    // 等待进程退出
    let attempts = 0;
    while (attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!isProcessRunning(pid)) {
        break;
      }
      attempts++;
    }

    // 如果还在运行，强制杀死
    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 清理 PID 文件
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }

    result.success = true;
    result.message = '网关已停止';

    if (options.human) {
      console.log('✅ QQ Bot 网关已停止');
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    result.message = `停止失败: ${e.message}`;

    if (options.human) {
      console.log(`❌ 停止失败: ${e.message}`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
}

/**
 * restart 命令
 */
async function cmdRestart(options) {
  const result = {
    success: false,
    action: 'restart',
    message: ''
  };

  if (options.human) {
    console.log('🔄 重启 QQ Bot 网关...');
  }

  // 停止
  await cmdStop({ human: false });

  // 等待
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 启动
  await cmdStart(options);
}

/**
 * list 命令
 */
async function cmdList(options) {
  const projects = readJsonFile(PROJECTS_FILE, { projects: {}, defaultProject: null });

  const result = {
    projects: Object.keys(projects.projects || {}),
    default: projects.defaultProject,
    details: projects.projects
  };

  if (options.human) {
    console.log('📋 已注册项目列表');
    console.log('━━━━━━━━━━━━━━━━━━━━');

    const list = result.projects;
    if (list.length === 0) {
      console.log('无已注册项目');
    } else {
      list.forEach((name, idx) => {
        const isDefault = name === result.default;
        const details = result.details[name];
        const marker = isDefault ? ' ✓ (默认)' : '';
        console.log(`${idx + 1}. ${name}${marker}`);
        if (details) {
          console.log(`   路径: ${details.path}`);
          console.log(`   注册时间: ${new Date(details.registeredAt).toLocaleString()}`);
        }
      });
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * switch 命令
 */
async function cmdSwitch(projectName, options) {
  const result = {
    success: false,
    action: 'switch',
    project: projectName,
    message: ''
  };

  const projects = readJsonFile(PROJECTS_FILE, { projects: {}, defaultProject: null });

  if (!projects.projects[projectName]) {
    result.message = `项目 "${projectName}" 不存在`;

    if (options.human) {
      console.log(`❌ 项目 "${projectName}" 不存在`);
      console.log(`可用项目: ${Object.keys(projects.projects).join(', ') || '无'}`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  projects.defaultProject = projectName;
  writeJsonFile(PROJECTS_FILE, projects);

  result.success = true;
  result.message = `已切换到项目 "${projectName}"`;

  if (options.human) {
    console.log(`✅ 已切换默认项目: ${projectName}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * 帮助信息
 */
function showHelp(options) {
  const helpText = `
QQ Bot 服务管理脚本

用法:
  node scripts/qqbot-service.js <command> [options]

命令:
  status              查看服务状态 (默认命令)
  start               启动后台服务
  stop                停止后台服务
  restart             重启后台服务
  list                查看项目列表
  switch <name>       切换默认项目

选项:
  --human             输出人类可读格式 (默认 JSON)
  --mode <mode>       工作模式: notify (通知) 或 auto (自动回复)
  --init-prompt <p>   初始化提示词 (auto 模式)

示例:
  # 查看状态 (JSON 格式)
  node scripts/qqbot-service.js status

  # 查看状态 (人类可读)
  node scripts/qqbot-service.js status --human

  # 启动自动回复模式
  node scripts/qqbot-service.js start --mode auto

  # 切换默认项目
  node scripts/qqbot-service.js switch my-project
`;

  if (options && options.human) {
    console.log(helpText);
  } else {
    console.log(JSON.stringify({
      usage: 'node scripts/qqbot-service.js <command> [options]',
      commands: {
        status: '查看服务状态',
        start: '启动后台服务',
        stop: '停止后台服务',
        restart: '重启后台服务',
        list: '查看项目列表',
        switch: '切换默认项目'
      },
      options: {
        '--human': '输出人类可读格式 (默认 JSON)',
        '--mode': '工作模式: notify 或 auto',
        '--init-prompt': '初始化提示词 (auto 模式)'
      }
    }, null, 2));
  }
}

// ============ 主入口 ============

async function main() {
  const args = process.argv.slice(2);
  const { command, options, positional } = parseArgs(args);

  switch (command) {
    case 'status':
      await cmdStatus(options);
      break;
    case 'start':
      await cmdStart(options);
      break;
    case 'stop':
      await cmdStop(options);
      break;
    case 'restart':
      await cmdRestart(options);
      break;
    case 'list':
      await cmdList(options);
      break;
    case 'switch':
      if (positional.length === 0) {
        console.log(JSON.stringify({ error: '缺少项目名称', usage: 'qqbot-service switch <project-name>' }, null, 2));
        process.exit(1);
      }
      await cmdSwitch(positional[0], options);
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp(options);
      break;
    default:
      console.log(JSON.stringify({ error: `未知命令: ${command}`, commands: ['status', 'start', 'stop', 'restart', 'list', 'switch'] }, null, 2));
      process.exit(1);
  }
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }, null, 2));
  process.exit(1);
});
