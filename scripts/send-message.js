#!/usr/bin/env node

/**
 * QQ Bot 发送消息 CLI
 *
 * 用法:
 *   node send-message.js <targetId> <message> [options]
 *
 * 参数:
 *   targetId  - 目标 ID (G_群号/U_用户ID/C_频道ID)
 *   message   - 消息内容
 *
 * 选项:
 *   --bot <name>  - 使用指定的机器人配置
 *   --type <type> - 消息类型: c2c, group, channel (自动从 targetId 前缀检测)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 配置目录
const CONFIG_DIR = path.join(os.homedir(), '.claude', 'qqbot-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 读取配置
function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { version: '1.0.0', bots: {}, lastUpdated: Date.now() };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return { version: '1.0.0', bots: {}, lastUpdated: Date.now() };
  }
}

// 获取机器人配置
function getBotConfig(botName) {
  const config = readConfig();

  // 优先使用指定的 bot
  if (botName && config.bots[botName]) {
    return config.bots[botName];
  }

  // 使用第一个可用的 bot
  const botNames = Object.keys(config.bots);
  if (botNames.length > 0) {
    return config.bots[botNames[0]];
  }

  // 使用环境变量
  if (process.env.QQBOT_APP_ID && process.env.QQBOT_CLIENT_SECRET) {
    return {
      appId: process.env.QQBOT_APP_ID,
      clientSecret: process.env.QQBOT_CLIENT_SECRET,
    };
  }

  return null;
}

// 解析目标 ID
function parseTargetId(targetId) {
  if (targetId.startsWith('G_')) {
    return { type: 'group', openid: targetId.slice(2) };
  } else if (targetId.startsWith('U_')) {
    return { type: 'c2c', openid: targetId.slice(2) };
  } else if (targetId.startsWith('C_')) {
    return { type: 'channel', openid: targetId.slice(2) };
  }
  // 默认为私聊
  return { type: 'c2c', openid: targetId };
}

// 获取 Access Token
async function getAccessToken(appId, clientSecret) {
  const response = await fetch('https://bots.qq.com/openapi/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: appId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`获取 Access Token 失败: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

// 发送消息
async function sendMessage(accessToken, openid, message, type) {
  const url = type === 'group'
    ? 'https://bots.qq.com/openapi/v2/groups/messages'
    : 'https://bots.qq.com/openapi/v2/users/messages';

  // 构建消息内容
  const content = {
    content: message,
    msg_type: 0, // 文本消息
  };

  const response = await fetch(`${url}?openid=${openid}`, {
    method: 'POST',
    headers: {
      'Authorization': `QQBot ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Union-Appid': process.env.QQBOT_APP_ID || '',
    },
    body: JSON.stringify(content),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`发送消息失败: ${response.status} ${text}`);
  }

  return await response.json();
}

// 显示帮助信息
function showHelp() {
  console.log(`
${colors.cyan}QQ Bot 发送消息 CLI${colors.reset}

用法:
  node send-message.js <targetId> <message> [options]

参数:
  ${colors.green}targetId${colors.reset}  目标 ID (G_群号/U_用户ID/C_频道ID)
  ${colors.green}message${colors.reset}   消息内容

选项:
  ${colors.green}--bot <name>${colors.reset}   使用指定的机器人配置
  ${colors.green}--type <type>${colors.reset}  消息类型: c2c, group, channel

示例:
  node send-message.js G_123456789 "你好，群消息"
  node send-message.js U_abc123 "私聊消息" --bot my-bot
`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  // 处理帮助请求
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  // 解析参数
  let targetId = null;
  let message = null;
  let botName = null;
  let msgType = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--bot') {
      botName = args[++i];
    } else if (arg === '--type') {
      msgType = args[++i];
    } else if (!arg.startsWith('-')) {
      if (!targetId) {
        targetId = arg;
      } else if (!message) {
        message = arg;
      }
    }
  }

  // 检查必需参数
  if (!targetId || !message) {
    log('red', '❌ 参数不完整');
    log('dim', '用法: node send-message.js <targetId> <message> [--bot <name>]');
    process.exit(1);
  }

  // 获取机器人配置
  const botConfig = getBotConfig(botName);
  if (!botConfig) {
    log('red', '❌ 未找到机器人配置');
    log('dim', '请先运行: qqbot-mcp-cli setup <botName>');
    log('dim', '或设置环境变量: QQBOT_APP_ID, QQBOT_CLIENT_SECRET');
    process.exit(1);
  }

  // 解析目标
  const target = parseTargetId(targetId);
  const type = msgType || target.type;

  log('cyan', '\n📤 发送消息\n');
  log('dim', `  目标: ${targetId}`);
  log('dim', `  类型: ${type}`);
  log('dim', `  内容: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`);

  try {
    // 获取 Access Token
    log('dim', '\n  获取 Access Token...');
    const accessToken = await getAccessToken(botConfig.appId, botConfig.clientSecret);
    log('green', '  ✅ Token 获取成功');

    // 发送消息
    log('dim', '  发送消息...');
    const result = await sendMessage(accessToken, target.openid, message, type);

    log('green', '\n✅ 发送成功！');
    log('dim', `  消息 ID: ${result.id || 'N/A'}`);

  } catch (error) {
    log('red', `\n❌ 发送失败: ${error.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  log('red', `❌ 错误: ${err.message}`);
  process.exit(1);
});
