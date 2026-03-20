#!/usr/bin/env node

/**
 * QQ Bot 发送消息 CLI
 *
 * 统一通过网关内部 API 发送消息，复用网关的:
 * - Token 管理
 * - 消息队列系统
 * - 富媒体发送能力
 *
 * 用法:
 *   node send-message.js <targetId> <message> [options]
 *
 * 参数:
 *   targetId  - 目标 ID (用户OpenID/群号)
 *   message   - 消息内容
 *
 * 选项:
 *   --project <name>  - 项目名称 (默认: 默认项目)
 *   --gateway <url>   - 网关 API 地址 (默认: http://127.0.0.1:3310)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 网关配置
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const PROJECTS_FILE = path.join(GATEWAY_DIR, 'projects.json');
const DEFAULT_GATEWAY_API = 'http://127.0.0.1:3310';

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

// 读取项目配置，获取默认项目
function getDefaultProject() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
    return data.defaultProject || null;
  } catch {
    return null;
  }
}

// 通过网关内部 API 发送消息
async function sendViaGateway(gatewayApi, target, message, project) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${gatewayApi}/api/notify`);

    const body = JSON.stringify({
      target: target,
      message: message,
      project: project,
    });

    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject(new Error(result.error || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`连接网关失败: ${e.message}`));
    });

    req.write(body);
    req.end();
  });
}

// 检查网关状态 - 通过尝试连接来判断
async function checkGatewayStatus(gatewayApi) {
  return new Promise((resolve) => {
    const url = new URL(`${gatewayApi}/`);

    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'GET',
      timeout: 3000,
    }, (res) => {
      // 只要能连接上就算成功（即使是 404 也说明服务在运行）
      resolve(true);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// 显示帮助信息
function showHelp() {
  console.log(`
${colors.cyan}QQ Bot 发送消息 CLI${colors.reset}
${colors.dim}通过网关内部 API 统一发送消息${colors.reset}

用法:
  node send-message.js <targetId> <message> [options]

参数:
  ${colors.green}targetId${colors.reset}  目标 ID (用户OpenID/群号)
  ${colors.green}message${colors.reset}   消息内容

选项:
  ${colors.green}--project <name>${colors.reset}   项目名称 (默认: 默认项目)
  ${colors.green}--gateway <url>${colors.reset}    网关 API 地址 (默认: http://127.0.0.1:3310)

示例:
  node send-message.js 9C420731A85BB53B6B9D7D45BDCD20F2 "你好"
  node send-message.js G_123456 "群消息" --project my-project
  node send-message.js U_abc123 "私聊" --gateway http://192.168.1.100:3310

注意:
  - 消息会通过网关的队列系统发送
  - 支持 <qqimg>, <qqfile> 等富媒体标签
  - 网关必须在运行中 (使用 qqbot-service status 检查)
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
  let project = null;
  let gatewayApi = DEFAULT_GATEWAY_API;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--project') {
      project = args[++i];
    } else if (arg === '--gateway') {
      gatewayApi = args[++i];
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
    log('dim', '用法: node send-message.js <targetId> <message> [--project <name>]');
    process.exit(1);
  }

  // 获取默认项目
  if (!project) {
    project = getDefaultProject();
    if (!project) {
      log('red', '❌ 未找到默认项目');
      log('dim', '请指定项目: --project <name>');
      log('dim', '或先注册项目: qqbot-service register');
      process.exit(1);
    }
  }

  log('cyan', '\n📤 发送消息\n');
  log('dim', `  目标: ${targetId}`);
  log('dim', `  项目: ${project}`);
  log('dim', `  网关: ${gatewayApi}`);
  log('dim', `  内容: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`);

  try {
    // 检查网关状态
    log('dim', '\n  检查网关状态...');
    const gatewayRunning = await checkGatewayStatus(gatewayApi);
    if (!gatewayRunning) {
      log('red', '  ❌ 网关未运行');
      log('dim', '  请先启动网关: node qqbot-service.js start --mode auto');
      process.exit(1);
    }
    log('green', '  ✅ 网关运行中');

    // 通过网关发送消息
    log('dim', '  发送消息...');
    const result = await sendViaGateway(gatewayApi, targetId, message, project);

    log('green', '\n✅ 发送成功！');
    log('dim', `  状态: ${result.status || 'sent'}`);
    log('dim', `  方式: ${result.method || 'proactive'}`);
  } catch (error) {
    log('red', `\n❌ 发送失败: ${error.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  log('red', `❌ 错误: ${err.message}`);
  process.exit(1);
});
