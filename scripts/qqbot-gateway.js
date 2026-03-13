#!/usr/bin/env node

/**
 * QQ Bot 全局网关守护进程
 *
 * 功能：
 * 1. 作为全局 QQ Bot 消息网关
 * 2. 支持多项目注册和管理
 * 3. 智能消息解析和路由
 * 4. 会话管理和上下文保持
 * 5. 项目级 Hook 集成
 *
 * 用法：
 *   node scripts/qqbot-gateway.js start
 *   node scripts/qqbot-gateway.js stop
 *   node scripts/qqbot-gateway.js status
 *   node scripts/qqbot-gateway.js register <projectPath> [--name <name>]
 *   node scripts/qqbot-gateway.js unregister <projectName>
 *   node scripts/qqbot-gateway.js switch <projectName>
 */

import { spawn } from 'child_process';
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { parseMessage as parseMessageFromParser, buildClaudeArgs } from './qqbot-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const PROJECTS_FILE = path.join(GATEWAY_DIR, 'projects.json');
const SESSIONS_DIR = path.join(GATEWAY_DIR, 'sessions');
const PID_FILE = path.join(GATEWAY_DIR, 'gateway.pid');
const LOG_FILE = path.join(GATEWAY_DIR, 'gateway.log');

// 确保目录存在
[GATEWAY_DIR, SESSIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 加载环境变量 - 优先使用全局配置
const globalEnvPath = path.join(os.homedir(), '.claude', 'qqbot-gateway', '.env');
const localEnvPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(globalEnvPath)) {
  config({ path: globalEnvPath });
} else if (fs.existsSync(localEnvPath)) {
  config({ path: localEnvPath });
}

const APP_ID = process.env.QQBOT_APP_ID;
const CLIENT_SECRET = process.env.QQBOT_CLIENT_SECRET;

// ============ 颜色输出 ============
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, msg) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const line = `[${timestamp}] ${msg}`;
  console.log(`${colors[color]}${line}${colors.reset}`);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ============ 项目注册表管理 ============
function loadProjects() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return { projects: {}, defaultProject: null };
  }
  return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
}

function saveProjects(data) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
}

/**
 * 同步项目级 .env 配置到项目注册表（不覆盖全局配置）
 * @param {string} projectPath - 项目路径
 * @returns {object|null} - 项目配置对象，如果没有配置返回 null
 */
function syncProjectConfig(projectPath) {
  const projectEnvPath = path.join(projectPath, '.env');

  if (!fs.existsSync(projectEnvPath)) {
    return null;
  }

  // 读取项目配置
  const projectEnv = fs.readFileSync(projectEnvPath, 'utf-8');
  const config = {};
  projectEnv.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      config[match[1].trim()] = match[2].trim();
    }
  });

  // 检查是否有 QQ Bot 相关配置
  const qqbotKeys = ['QQBOT_APP_ID', 'QQBOT_CLIENT_SECRET', 'QQBOT_TEST_TARGET_ID', 'QQBOT_IMAGE_SERVER_BASE_URL'];
  const hasQQBotConfig = qqbotKeys.some(key => config[key]);

  if (!hasQQBotConfig) {
    return null;
  }

  // 返回项目配置（用于存储到 projects.json）
  return {
    appId: config.QQBOT_APP_ID,
    clientSecret: config.QQBOT_CLIENT_SECRET,
    testTargetId: config.QQBOT_TEST_TARGET_ID,
    imageServerBaseUrl: config.QQBOT_IMAGE_SERVER_BASE_URL,
  };
}

/**
 * 获取项目的机器人配置
 * @param {string} projectName - 项目名称
 * @returns {object|null} - 机器人配置
 */
function getProjectBotConfig(projectName) {
  const data = loadProjects();
  const project = data.projects[projectName];

  if (!project || !project.botConfig) {
    // 回退到全局环境变量
    return {
      appId: process.env.QQBOT_APP_ID,
      clientSecret: process.env.QQBOT_CLIENT_SECRET,
      testTargetId: process.env.QQBOT_TEST_TARGET_ID,
      imageServerBaseUrl: process.env.QQBOT_IMAGE_SERVER_BASE_URL,
    };
  }

  return project.botConfig;
}

function registerProject(projectPath, name = null, botConfig = null) {
  const data = loadProjects();
  const projectName = name || path.basename(projectPath);

  data.projects[projectName] = {
    path: projectPath,
    name: projectName,
    registeredAt: Date.now(),
    lastActive: Date.now(),
    session: null,
    botConfig: botConfig, // 存储项目级机器人配置
  };

  data.defaultProject = projectName;
  saveProjects(data);

  log('green', `✅ 项目已注册: ${projectName} (${projectPath})`);
  return projectName;
}

function unregisterProject(projectName) {
  const data = loadProjects();

  if (!data.projects[projectName]) {
    log('yellow', `⚠️ 项目不存在: ${projectName}`);
    return false;
  }

  // 清理会话
  const sessionFile = path.join(SESSIONS_DIR, `${projectName}.json`);
  if (fs.existsSync(sessionFile)) {
    fs.unlinkSync(sessionFile);
  }

  delete data.projects[projectName];

  // 更新默认项目
  if (data.defaultProject === projectName) {
    const remaining = Object.keys(data.projects);
    data.defaultProject = remaining.length > 0 ? remaining[remaining.length - 1] : null;
  }

  saveProjects(data);
  log('green', `✅ 项目已注销: ${projectName}`);
  return true;
}

function switchDefaultProject(projectName) {
  const data = loadProjects();

  if (!data.projects[projectName]) {
    log('yellow', `⚠️ 项目不存在: ${projectName}`);
    return false;
  }

  data.defaultProject = projectName;
  data.projects[projectName].lastActive = Date.now();
  saveProjects(data);

  log('green', `✅ 默认项目已切换: ${projectName}`);
  return true;
}

// ============ 会话管理 ============
function getSessionFile(projectName) {
  return path.join(SESSIONS_DIR, `${projectName}.json`);
}

function loadSession(projectName) {
  const file = getSessionFile(projectName);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveSession(projectName, session) {
  const file = getSessionFile(projectName);
  fs.writeFileSync(file, JSON.stringify(session, null, 2));
}

async function initializeSession(projectName, initPrompt = null) {
  const data = loadProjects();
  const project = data.projects[projectName];

  if (!project) {
    throw new Error(`项目不存在: ${projectName}`);
  }

  // 使用 claude -p --output-format json 获取 session_id
  const prompt = initPrompt || `你是 ${projectName} 项目的智能助手。请确认已准备好协助处理来自 QQ 的任务请求。`;

  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'json'], {
      cwd: project.path,
      env: { ...process.env, CLAUDECODE: undefined },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.stdin.write(prompt);
    child.stdin.end();

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Session 初始化超时'));
    }, 60000);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          const session = {
            sessionId: result.session_id || `sess_${Date.now()}`,
            projectName,
            projectPath: project.path,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            mode: 'auto',
          };

          saveSession(projectName, session);
          data.projects[projectName].session = session.sessionId;
          data.projects[projectName].lastActive = Date.now();
          saveProjects(data);

          resolve(session);
        } catch (e) {
          reject(new Error(`解析 session 失败: ${e.message}`));
        }
      } else {
        reject(new Error(`Session 初始化失败: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ============ 智能消息解析 (使用 qqbot-parser.js) ============
/**
 * 解析消息 - 包装器，加载项目配置后调用 parser 模块
 */
function parseMessage(message) {
  const data = loadProjects();
  return parseMessageFromParser(message, data.projects, data.defaultProject);
}

// ============ QQ API ============
async function getAccessToken() {
  const resp = await fetch('https://bots.qq.com/app/getAppAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: APP_ID, clientSecret: CLIENT_SECRET }),
  });
  const data = await resp.json();
  return data.access_token;
}

async function sendC2CMessage(token, openid, content, msgId = null) {
  const body = {
    content,
    msg_type: 0,
    msg_seq: Math.floor(Math.random() * 1000000),
    ...(msgId ? { msg_id: msgId } : {}),
  };

  const resp = await fetch(`https://api.sgroup.qq.com/v2/users/${openid}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `QQBot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return resp.json();
}

// ============ 网关核心 ============
let ws = null;
let accessToken = null;
let heartbeatIntervalMs = null;  // 服务器返回的心跳间隔
let heartbeatTimer = null;       // setInterval 返回的 handle
let running = false;
let mode = 'notify'; // notify | auto

async function startGateway(gatewayMode = 'notify') {
  mode = gatewayMode;
  running = true;

  log('cyan', '🚀 启动 QQ Bot 全局网关...');
  log('cyan', `   模式: ${mode === 'auto' ? '自动回复' : '通知'}`);

  // 写入 PID
  fs.writeFileSync(PID_FILE, process.pid.toString());

  accessToken = await getAccessToken();
  log('green', '✅ Access Token 获取成功');

  // 获取 Gateway URL
  const gwResp = await fetch('https://api.sgroup.qq.com/gateway', {
    headers: {
      Authorization: `QQBot ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const gwData = await gwResp.json();
  const gatewayUrl = gwData.url;
  log('green', `✅ Gateway URL: ${gatewayUrl}`);

  // 连接 WebSocket
  ws = new WebSocket(gatewayUrl);

  ws.on('open', () => {
    log('green', '✅ WebSocket 连接已建立');
  });

  ws.on('message', async (data) => {
    const payload = JSON.parse(data.toString());

    switch (payload.op) {
      case 10: // Hello
        heartbeatIntervalMs = payload.d.heartbeat_interval;
        startHeartbeat();
        sendIdentify();
        break;

      case 11: // Heartbeat ACK
        break;

      case 0: // Dispatch
        await handleEvent(payload);
        break;
    }
  });

  ws.on('close', () => {
    log('yellow', '⚠️ WebSocket 连接已关闭');
    if (running) {
      setTimeout(() => startGateway(mode), 5000);
    }
  });

  ws.on('error', (err) => {
    log('red', `❌ WebSocket 错误: ${err.message}`);
  });
}

function startHeartbeat() {
  const send = () => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ op: 1, d: null }));
    }
  };
  send();
  // 存储 interval handle 以便在停止时清除
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  heartbeatTimer = setInterval(send, heartbeatIntervalMs);
}

function sendIdentify() {
  ws.send(JSON.stringify({
    op: 2,
    d: {
      token: `QQBot ${accessToken}`,
      intents: (1 << 25) | (1 << 30) | (1 << 12),
      shard: [0, 1],
      properties: {
        $os: process.platform,
        $browser: 'qqbot-gateway',
        $device: 'server',
      },
    },
  }));
  log('green', '✅ Identify 消息已发送');
}

async function handleEvent(payload) {
  const { t: eventType, d: data } = payload;

  if (eventType === 'READY') {
    log('green', `\n🎉 网关就绪！`);
    log('cyan', `   机器人: ${data.user?.username || '未知'}`);
    log('cyan', `   模式: ${mode === 'auto' ? '自动回复' : '通知'}`);
    log('cyan', `   PID: ${process.pid}`);
    log('yellow', '\n📱 等待 QQ 消息...\n');
    return;
  }

  // 私聊消息
  if (eventType === 'C2C_MESSAGE_CREATE') {
    await handleMessage('private', data);
  }

  // 群聊 @ 消息
  if (eventType === 'GROUP_AT_MESSAGE_CREATE') {
    await handleMessage('group', data);
  }
}

async function handleMessage(type, data) {
  const msgId = data.id;
  const content = data.content;
  const authorId = type === 'private' ? data.author?.id : data.author?.member_openid;
  const groupId = type === 'group' ? data.group_openid : null;

  log('green', `\n📬 收到${type === 'private' ? '私聊' : '群聊'}消息！`);
  log('cyan', `   发送者: ${authorId}`);
  log('cyan', `   内容: ${content}`);

  // 解析消息
  const parsed = parseMessage(content);
  log('cyan', `   解析结果: 项目=${parsed.projectName || '默认'}, cwd=${parsed.cwd || '无'}`);

  if (mode === 'notify') {
    // 通知模式：只发送桌面通知
    log('yellow', '   📢 通知模式：发送桌面通知');
    await sendDesktopNotification(
      `QQ Bot ${type === 'private' ? '私聊' : '群聊'}`,
      `[${parsed.projectName || '默认'}] ${content.slice(0, 50)}`
    );
  } else if (mode === 'auto') {
    // 自动回复模式
    await processWithClaude(parsed, authorId, msgId, content);
  }
}

async function processWithClaude(parsed, authorId, msgId, originalContent) {
  const projectName = parsed.projectName;
  const cwd = parsed.cwd;

  if (!cwd) {
    log('yellow', '   ⚠️ 无法找到项目目录，跳过处理');
    return;
  }

  log('cyan', `   🤖 调用 Claude Code Headless (cwd: ${cwd})`);

  // 使用 parser 模块构建参数
  const args = buildClaudeArgs(parsed);

  // 构建提示词
  const prompt = `[QQ 消息 - 项目: ${projectName}]
${originalContent}

请处理这条消息，并给出简洁的回复。`;

  try {
    const child = spawn('claude', args, {
      cwd,
      env: { ...process.env, CLAUDECODE: undefined },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.stdin.write(prompt);
    child.stdin.end();

    const timeout = setTimeout(() => {
      child.kill();
    }, 120000);

    child.on('close', async (code) => {
      clearTimeout(timeout);

      if (code === 0 && stdout.trim()) {
        // 提取回复内容
        let replyContent = stdout.trim();

        // 尝试从 stream-json 中提取内容
        try {
          const lines = stdout.split('\n').filter(l => l.trim());
          const contents = [];
          for (const line of lines) {
            const json = JSON.parse(line);
            if (json.type === 'content' && json.content) {
              contents.push(json.content);
            }
          }
          if (contents.length > 0) {
            replyContent = contents.join('');
          }
        } catch (e) {
          // 使用原始输出
        }

        // 添加项目前缀
        const finalReply = `[${projectName}] ${replyContent}`;

        log('green', `   生成回复: "${finalReply.slice(0, 80)}..."`);

        // 发送回复
        const token = await getAccessToken();
        const result = await sendC2CMessage(token, authorId, finalReply, msgId);

        if (result.id) {
          log('green', `   ✅ 回复已发送`);
        } else {
          log('yellow', `   ⚠️ 回复发送失败: ${JSON.stringify(result)}`);
        }
      } else {
        log('yellow', `   ⚠️ 处理失败: ${stderr.slice(0, 200)}`);

        // 发送默认回复
        const token = await getAccessToken();
        await sendC2CMessage(token, authorId, `[${projectName}] 抱歉，处理您的消息时遇到问题，请稍后再试～`, msgId);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      log('red', `   ❌ 进程错误: ${err.message}`);
    });
  } catch (error) {
    log('red', `   ❌ 处理错误: ${error.message}`);
  }
}

async function sendDesktopNotification(title, message) {
  const platform = process.platform;

  if (platform === 'linux') {
    try {
      await spawn('notify-send', [title, message]);
    } catch (e) {}
  } else if (platform === 'darwin') {
    try {
      await spawn('osascript', ['-e', `display notification "${message}" with title "${title}"`]);
    } catch (e) {}
  }
}

function stopGateway() {
  running = false;

  // 清除心跳定时器
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }

  log('yellow', '👋 网关已停止');
}

// ============ 命令处理 ============
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'start': {
    // 获取项目路径（当前目录或通过 --cwd 指定）
    const cwdIndex = args.indexOf('--cwd');
    const startProjectPath = cwdIndex !== -1 ? args[cwdIndex + 1] : process.cwd();
    const projectName = path.basename(startProjectPath);

    // 读取项目配置（不覆盖全局配置）
    const projectBotConfig = syncProjectConfig(startProjectPath);

    // 注册项目并存储配置
    if (projectBotConfig) {
      registerProject(startProjectPath, projectName, projectBotConfig);
      log('green', `✅ 项目 "${projectName}" 已注册，机器人配置已保存`);
      log('cyan', `   APP_ID: ${projectBotConfig.appId}`);
    } else {
      // 没有项目级配置，检查是否已注册
      const data = loadProjects();
      if (!data.projects[projectName]) {
        registerProject(startProjectPath, projectName, null);
        log('yellow', `⚠️ 项目 "${projectName}" 未检测到 .env 配置，将使用全局环境变量`);
      }
    }

    // 检查是否已有网关运行
    if (fs.existsSync(PID_FILE)) {
      const existingPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'));
      try {
        process.kill(existingPid, 0);
        log('yellow', '⚠️ 网关已在运行中');
        log('cyan', `   PID: ${existingPid}`);
        log('cyan', '   项目已注册，处理消息时将使用项目专属配置');
        log('cyan', '   使用 "node qqbot-gateway.js status" 查看详情');
        process.exit(0);
      } catch (e) {
        // 进程不存在，清理 PID 文件
        fs.unlinkSync(PID_FILE);
      }
    }

    const startMode = args.includes('--auto') ? 'auto' : 'notify';
    startGateway(startMode).catch(err => {
      log('red', `❌ 启动失败: ${err.message}`);
      process.exit(1);
    });
    break;
  }

  case 'stop':
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'));
      try {
        process.kill(pid, 'SIGTERM');
        fs.unlinkSync(PID_FILE);
        log('green', '✅ 网关已停止');
      } catch (e) {
        log('yellow', '⚠️ 进程不存在或已停止');
        fs.unlinkSync(PID_FILE);
      }
    } else {
      log('yellow', '⚠️ 网关未运行');
    }
    break;

  case 'status':
    console.log('\n🤖 QQ Bot 网关状态');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'));
      try {
        process.kill(pid, 0);
        console.log(`状态: ✅ 运行中 (PID: ${pid})`);
      } catch (e) {
        console.log('状态: ❌ 已停止 (PID 文件存在但进程不存在)');
      }
    } else {
      console.log('状态: ❌ 已停止');
    }

    const data = loadProjects();
    console.log(`\n已注册项目 (${Object.keys(data.projects).length}):`);

    for (const [name, project] of Object.entries(data.projects)) {
      const isDefault = data.defaultProject === name;
      const session = loadSession(name);
      console.log(`  ${isDefault ? '★' : ' '} ${name}`);
      console.log(`    路径: ${project.path}`);
      console.log(`    会话: ${session ? session.sessionId : '无'}`);
    }

    if (data.defaultProject) {
      console.log(`\n默认项目: ${data.defaultProject}`);
    }
    console.log('');
    break;

  case 'register':
    const projectPath = args[0];
    if (!projectPath) {
      console.log('用法: qqbot-gateway register <projectPath> [--name <name>]');
      process.exit(1);
    }
    const nameIndex = args.indexOf('--name');
    const projectName = nameIndex !== -1 ? args[nameIndex + 1] : null;
    registerProject(path.resolve(projectPath), projectName);
    break;

  case 'unregister':
    if (!args[0]) {
      console.log('用法: qqbot-gateway unregister <projectName>');
      process.exit(1);
    }
    unregisterProject(args[0]);
    break;

  case 'switch':
    if (!args[0]) {
      console.log('用法: qqbot-gateway switch <projectName>');
      process.exit(1);
    }
    switchDefaultProject(args[0]);
    break;

  case 'init-session':
    const sessionProject = args[0];
    if (!sessionProject) {
      console.log('用法: qqbot-gateway init-session <projectName> [--prompt <prompt>]');
      process.exit(1);
    }
    const promptIndex = args.indexOf('--prompt');
    const initPrompt = promptIndex !== -1 ? args[promptIndex + 1] : null;
    initializeSession(sessionProject, initPrompt)
      .then(session => {
        console.log(`✅ 会话已初始化: ${session.sessionId}`);
      })
      .catch(err => {
        console.log(`❌ 初始化失败: ${err.message}`);
        process.exit(1);
      });
    break;

  default:
    console.log(`
QQ Bot 全局网关

用法:
  qqbot-gateway start [--auto]     启动网关 (--auto: 自动回复模式)
  qqbot-gateway stop               停止网关
  qqbot-gateway status             查看状态
  qqbot-gateway register <path> [--name <name>]   注册项目
  qqbot-gateway unregister <name>  注销项目
  qqbot-gateway switch <name>      切换默认项目
  qqbot-gateway init-session <name> [--prompt <prompt>]  初始化会话
`);
}

// 优雅退出
process.on('SIGINT', () => {
  stopGateway();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopGateway();
  process.exit(0);
});
