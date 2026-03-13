#!/usr/bin/env node

/**
 * QQ Bot 轮询守护脚本
 *
 * 功能：
 * 1. 定期轮询 QQ 消息
 * 2. 收到新消息时发送桌面通知
 * 3. 可选：自动调用 Claude Code 处理
 *
 * 用法：
 *   node scripts/qqbot-poll-daemon.js [--auto]
 *
 * 选项：
 *   --auto    自动调用 Claude Code 处理消息（需要 claude CLI）
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载环境变量
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

const APP_ID = process.env.QQBOT_APP_ID;
const CLIENT_SECRET = process.env.QQBOT_CLIENT_SECRET;
const AUTO_MODE = process.argv.includes('--auto');

// 配置
const POLL_INTERVAL = 5000; // 5秒轮询一次
const NOTIFY_SOUND = true;

// 颜色
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, msg) {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// 已处理的消息 ID（防止重复）
const processedMsgIds = new Set();

// 获取 Access Token
async function getAccessToken() {
  try {
    const resp = await fetch('https://bots.qq.com/app/getAppAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: APP_ID, clientSecret: CLIENT_SECRET }),
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    }

    const data = await resp.json();
    if (!data.access_token) {
      throw new Error('No access_token in response');
    }
    return data.access_token;
  } catch (error) {
    log('yellow', `❌ 获取 Access Token 失败: ${error.message}`);
    throw error;
  }
}

// 发送私聊消息
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

// 发送桌面通知
async function sendDesktopNotification(title, message) {
  const platform = process.platform;

  if (platform === 'linux') {
    // Linux: notify-send
    try {
      await execAsync(`notify-send "${title}" "${message}"`);
    } catch (e) {
      // 忽略通知失败
    }
  } else if (platform === 'darwin') {
    // macOS: osascript
    try {
      await execAsync(`osascript -e 'display notification "${message}" with title "${title}"'`);
    } catch (e) {
      // 忽略
    }
  } else if (platform === 'win32') {
    // Windows: PowerShell
    try {
      await execAsync(`powershell -command "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null"`);
    } catch (e) {
      // 忽略
    }
  }
}

// 调用 Claude Code Headless 模式处理消息
async function callClaudeCode(message, eventType) {
  // 构建上下文
  const context = {
    type: eventType,
    author: message.author?.id || message.author?.member_openid || '未知',
    content: message.content,
    groupId: message.group_openid || null,
    messageId: message.id,
    timestamp: new Date().toISOString(),
  };

  // 构建回复目标 ID
  const targetId = eventType === 'C2C_MESSAGE_CREATE'
    ? `U_${context.author}`
    : `G_${context.groupId}`;

  // 构建 headless 提示词
  const prompt = `你是 QQ 机器人的智能助手。你刚刚收到一条 QQ 消息：

消息类型: ${eventType === 'C2C_MESSAGE_CREATE' ? '私聊' : '群聊@'}
发送者 OpenID: ${context.author}
消息内容: ${context.content}
消息 ID: ${context.messageId}
${context.groupId ? `群号: ${context.groupId}` : ''}

请根据消息内容生成一个简短、友好的回复。回复要求：
1. 简洁明了，不超过 200 字
2. 如果是问题，给出有用的回答
3. 如果是闲聊，友好回应
4. 如果需要执行任务，说明你能做什么

直接输出回复内容，不需要任何解释。`;

  try {
    log('cyan', `\n🤖 正在调用 Claude Code Headless 处理...`);
    log('cyan', `   消息: "${context.content.slice(0, 50)}..."`);

    // 使用 spawn 来正确传递 stdin
    const { spawn } = await import('child_process');

    const child = spawn('claude', ['-p'], {
      cwd: process.cwd(),
      env: { ...process.env, CLAUDECODE: undefined },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // 写入 prompt 到 stdin
    child.stdin.write(prompt);
    child.stdin.end();

    // 收集输出
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // 等待进程完成
    const replyContent = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Timeout (60s)'));
      }, 60000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Exit code ${code}: ${stderr.slice(0, 200)}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    if (replyContent) {
      log('green', `   生成回复: "${replyContent.slice(0, 80)}..."`);

      // 发送回复
      const token = await getAccessToken();
      const result = await sendC2CMessage(token, context.author, replyContent, context.messageId);

      if (result.id) {
        log('green', `✅ 回复已发送！消息 ID: ${result.id.slice(0, 30)}...`);
      } else {
        log('yellow', `⚠️ 回复发送失败: ${JSON.stringify(result)}`);
      }
    } else {
      log('yellow', '⚠️ Claude 未生成回复内容');
    }
  } catch (error) {
    log('yellow', `⚠️ Claude Code 调用失败: ${error.message}`);

    // 失败时发送默认回复
    if (AUTO_MODE) {
      const fallbackReply = '抱歉，我暂时无法处理您的消息，请稍后再试～';
      const token = await getAccessToken();
      await sendC2CMessage(token, context.author, fallbackReply, context.messageId);
      log('yellow', '   已发送默认回复');
    }
  }
}

// WebSocket 连接（实时模式）
let ws = null;
let accessToken = null;
let heartbeatInterval = null;

async function startRealtimeMode() {
  log('cyan', '\n🚀 启动实时监听模式...\n');

  accessToken = await getAccessToken();
  log('green', '✅ Access Token 获取成功');

  // 获取 Gateway URL
  try {
    const gwResp = await fetch('https://api.sgroup.qq.com/gateway', {
      headers: {
        Authorization: `QQBot ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!gwResp.ok) {
      throw new Error(`Gateway API HTTP ${gwResp.status}`);
    }

    const gwData = await gwResp.json();
    const gatewayUrl = gwData.url;

    if (!gatewayUrl) {
      throw new Error('No gateway URL in response');
    }

    log('green', `✅ Gateway URL: ${gatewayUrl}`);

  // 连接 WebSocket
  const WebSocket = (await import('ws')).default;
  ws = new WebSocket(gatewayUrl);

  ws.on('open', () => {
    log('green', '✅ WebSocket 连接已建立');
  });

  ws.on('message', async (data) => {
    const payload = JSON.parse(data.toString());

    switch (payload.op) {
      case 10: // Hello
        heartbeatInterval = payload.d.heartbeat_interval;
        startHeartbeat();
        sendIdentify();
        break;

      case 11: // Heartbeat ACK
        process.stdout.write('.');
        break;

      case 0: // Dispatch
        await handleEvent(payload);
        break;
    }
  });

  ws.on('close', () => {
    log('yellow', '\n⚠️ WebSocket 连接已关闭，5秒后重连...');
    setTimeout(startRealtimeMode, 5000);
  });

  ws.on('error', (err) => {
      log('yellow', `⚠️ WebSocket 错误: ${err.message}`);
    });
  } catch (error) {
    log('yellow', `❌ 获取 Gateway URL 失败: ${error.message}`);
    throw error;
  }
}

function startHeartbeat() {
  const send = () => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ op: 1, d: null }));
    }
  };
  send();
  setInterval(send, heartbeatInterval);
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
        $browser: 'qqbot-daemon',
        $device: 'cli',
      },
    },
  }));
  log('green', '✅ Identify 消息已发送');
}

async function handleEvent(payload) {
  const { t: eventType, d: data } = payload;

  if (eventType === 'READY') {
    log('green', '\n🎉 连接就绪！开始监听 QQ 消息...');
    log('cyan', `   机器人: ${data.user?.username || '未知'}`);
    log('yellow', '\n📱 等待新消息... (Ctrl+C 退出)\n');
    return;
  }

  // 私聊消息
  if (eventType === 'C2C_MESSAGE_CREATE') {
    const msgId = data.id;

    // 防止重复处理
    if (processedMsgIds.has(msgId)) return;
    processedMsgIds.add(msgId);

    // 限制 Set 大小
    if (processedMsgIds.size > 1000) {
      const arr = [...processedMsgIds].slice(-500);
      processedMsgIds.clear();
      arr.forEach(id => processedMsgIds.add(id));
    }

    log('green', '\n📬 收到私聊消息！');
    log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('cyan', `   发送者: ${data.author?.id}`);
    log('cyan', `   内容: ${data.content}`);
    log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 发送桌面通知
    await sendDesktopNotification(
      'QQ Bot 新消息',
      `私聊: ${data.content.slice(0, 50)}`
    );

    // 自动模式：调用 Claude Code
    if (AUTO_MODE) {
      await callClaudeCode(data, 'C2C_MESSAGE_CREATE');
    } else {
      log('yellow', '\n💡 提示: 在 Claude Code 中运行 /qqbot-tasks 来处理这条消息');
      log('yellow', '   或使用 --auto 参数启用自动处理模式\n');
    }
  }

  // 群聊 @ 消息
  if (eventType === 'GROUP_AT_MESSAGE_CREATE') {
    const msgId = data.id;

    if (processedMsgIds.has(msgId)) return;
    processedMsgIds.add(msgId);

    log('green', '\n📬 收到群聊 @ 消息！');
    log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('cyan', `   群号: ${data.group_openid}`);
    log('cyan', `   发送者: ${data.author?.member_openid}`);
    log('cyan', `   内容: ${data.content}`);
    log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await sendDesktopNotification(
      'QQ Bot 群消息',
      `群聊: ${data.content.slice(0, 50)}`
    );

    if (AUTO_MODE) {
      await callClaudeCode(data, 'GROUP_AT_MESSAGE_CREATE');
    }
  }
}

// 主入口
log('cyan', '╔══════════════════════════════════════════════════════════╗');
log('cyan', '║       🎧 QQ Bot 消息监听守护进程                         ║');
log('cyan', '╚══════════════════════════════════════════════════════════╝');

if (!APP_ID || !CLIENT_SECRET) {
  log('yellow', '❌ 请先配置 .env 文件');
  process.exit(1);
}

if (AUTO_MODE) {
  log('yellow', '🤖 自动模式已启用 - 将自动调用 Claude Code 处理消息');
}

startRealtimeMode().catch(err => {
  log('yellow', `❌ 启动失败: ${err.message}`);
  process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => {
  log('yellow', '\n\n👋 正在退出...');
  if (ws) ws.close();
  process.exit(0);
});
