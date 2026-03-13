#!/usr/bin/env node

/**
 * QQ Bot 消息监听测试脚本
 *
 * 用法: node tests/listen-message.js
 *
 * 功能:
 * 1. 连接到 QQ Gateway
 * 2. 监听私聊消息
 * 3. 获取发送者的 OpenID
 * 4. 测试回复消息
 */

import WebSocket from 'ws';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 加载环境变量
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

const APP_ID = process.env.QQBOT_APP_ID;
const CLIENT_SECRET = process.env.QQBOT_CLIENT_SECRET;

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getAccessToken() {
  const response = await fetch('https://bots.qq.com/app/getAppAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: APP_ID,
      clientSecret: CLIENT_SECRET,
    }),
  });

  const data = await response.json();
  return data.access_token;
}

async function getGatewayUrl(token) {
  const response = await fetch('https://api.sgroup.qq.com/gateway', {
    headers: {
      Authorization: `QQBot ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  return data.url;
}

async function sendC2CMessage(token, openid, content, msgId = null) {
  const body = {
    content,
    msg_type: 0,
    msg_id: msgId || undefined,
    msg_seq: Math.floor(Math.random() * 1000000),
  };

  const response = await fetch(`https://api.sgroup.qq.com/v2/users/${openid}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `QQBot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return response.json();
}

let accessToken = null;
let ws = null;
let heartbeatInterval = null;
let session = null;

async function connect() {
  log('cyan', '\n🚀 正在连接 QQ Gateway...\n');

  // 获取 Access Token
  accessToken = await getAccessToken();
  log('green', '✅ Access Token 获取成功');

  // 获取 Gateway URL
  const gatewayUrl = await getGatewayUrl(accessToken);
  log('green', `✅ Gateway URL: ${gatewayUrl.slice(0, 50)}...`);

  // 连接 WebSocket
  ws = new WebSocket(gatewayUrl);

  ws.on('open', () => {
    log('green', '✅ WebSocket 连接已建立');
  });

  ws.on('message', async (data) => {
    const payload = JSON.parse(data.toString());

    switch (payload.op) {
      case 10: // Hello - 收到心跳配置
        log('cyan', '📦 收到 Hello 消息，开始心跳...');
        heartbeatInterval = payload.d.heartbeat_interval;
        startHeartbeat();
        // 发送 Identify
        sendIdentify();
        break;

      case 11: // Heartbeat ACK
        process.stdout.write('.');
        break;

      case 0: // Dispatch - 事件消息
        handleEvent(payload);
        break;

      case 2: // Resume
        log('yellow', '⚠️ 需要重连...');
        break;
    }
  });

  ws.on('close', () => {
    log('red', '\n❌ WebSocket 连接已关闭');
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });

  ws.on('error', (error) => {
    log('red', `❌ WebSocket 错误: ${error.message}`);
  });
}

function startHeartbeat() {
  const sendHeartbeat = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        op: 1,
        d: session ? session.seq : null,
      }));
    }
  };

  // 立即发送一次
  sendHeartbeat();

  // 定期发送
  setInterval(sendHeartbeat, heartbeatInterval);
}

function sendIdentify() {
  const identify = {
    op: 2,
    d: {
      token: `QQBot ${accessToken}`,
      intents: (1 << 25) | (1 << 30) | (1 << 12), // GROUP_AND_C2C + PUBLIC_GUILD_MESSAGES + DIRECT_MESSAGE
      shard: [0, 1],
      properties: {
        $os: process.platform,
        $browser: 'qqbot-test',
        $device: 'cli',
      },
    },
  };

  ws.send(JSON.stringify(identify));
  log('green', '✅ Identify 消息已发送');
}

async function handleEvent(payload) {
  const { t: eventType, d: data, s: seq } = payload;

  // 保存 session
  session = { seq };

  // 处理 READY 事件
  if (eventType === 'READY') {
    log('green', '\n🎉 连接就绪！机器人已上线');
    log('cyan', `   机器人名称: ${data.user?.username || '未知'}`);
    log('cyan', `   机器人 ID: ${data.user?.id || '未知'}`);
    log('bold', '\n📱 请在 QQ 上给机器人发送一条私聊消息...');
    log('yellow', '   等待中...\n');
    return;
  }

  // 处理 C2C 私聊消息
  if (eventType === 'C2C_MESSAGE_CREATE') {
    log('green', '\n📬 收到私聊消息！');
    log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('green', `   发送者 OpenID: ${data.author?.id}`);
    log('cyan', `   消息内容: ${data.content}`);
    log('cyan', `   消息 ID: ${data.id}`);
    log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 保存 OpenID 到文件
    const userInfo = {
      openid: data.author?.id,
      messageId: data.id,
      content: data.content,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(__dirname, '..', '.qqbot-test-user.json'),
      JSON.stringify(userInfo, null, 2)
    );
    log('green', '\n✅ 用户信息已保存到 .qqbot-test-user.json');

    // 尝试回复
    try {
      const replyResult = await sendC2CMessage(
        accessToken,
        data.author?.id,
        `👋 收到您的消息！\n\n您的 OpenID 是: ${data.author?.id}\n\n这条消息来自 Claude Code MCP 测试脚本。`,
        data.id
      );

      if (replyResult.id) {
        log('green', '✅ 回复消息发送成功！');
      } else {
        log('red', `❌ 回复失败: ${JSON.stringify(replyResult)}`);
      }
    } catch (error) {
      log('red', `❌ 回复出错: ${error.message}`);
    }

    log('yellow', '\n继续监听中... (按 Ctrl+C 退出)\n');
  }

  // 处理群聊消息
  if (eventType === 'GROUP_AT_MESSAGE_CREATE') {
    log('green', '\n📬 收到群聊 @ 消息！');
    log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('green', `   群号: ${data.group_openid}`);
    log('cyan', `   发送者 OpenID: ${data.author?.member_openid}`);
    log('cyan', `   消息内容: ${data.content}`);
    log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

// 启动
log('cyan', '╔══════════════════════════════════════════════════════════╗');
log('cyan', '║       🎧 QQ Bot 消息监听测试                             ║');
log('cyan', '╚══════════════════════════════════════════════════════════╝');

if (!APP_ID || !CLIENT_SECRET) {
  log('red', '❌ 请先配置 .env 文件中的 QQBOT_APP_ID 和 QQBOT_CLIENT_SECRET');
  process.exit(1);
}

connect().catch((error) => {
  log('red', `❌ 连接失败: ${error.message}`);
  process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => {
  log('yellow', '\n\n👋 正在退出...');
  if (ws) ws.close();
  process.exit(0);
});
