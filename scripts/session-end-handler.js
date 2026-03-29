#!/usr/bin/env node
/**
 * SessionEnd Hook 处理脚本
 *
 * 功能:
 * 1. 从 Gateway 注销当前会话
 * 2. 发送会话下线通知到 QQ
 * 3. 清理会话状态
 *
 * 由 Claude Code SessionEnd hook 调用
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 配置路径
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const CONFIG_FILE = path.join(GATEWAY_DIR, 'qqbot-config.json');
const GATEWAY_API_URL = process.env.QQBOT_GATEWAY_URL || 'http://127.0.0.1:3310';

// 默认配置
const DEFAULT_CONFIG = {
  workmode: 'channel',
  allowDegradation: true,
  autoStartGateway: true,
  autoNotifyOffline: true,
  notifyTargetId: null,
};

/**
 * 加载配置
 */
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch (error) {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 获取会话 ID
 */
function getSessionId() {
  // Claude Code 设置的环境变量
  return process.env.CLAUDE_SESSION_ID || process.env.SESSION_ID;
}

/**
 * 获取项目名称
 */
function getProjectName() {
  const projectPath = process.env.CLAUDE_PROJECT_PATH || process.cwd();
  return projectPath.split('/').pop() || 'unknown';
}

/**
 * 从 Gateway 注销
 */
async function unregisterFromGateway(sessionId) {
  if (!sessionId) {
    console.error('[session-end] ⚠️ No session ID, skipping unregister');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${GATEWAY_API_URL}/api/channels/${sessionId}`, {
      method: 'DELETE',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.error(`[session-end] ✅ Unregistered from Gateway: ${sessionId.slice(0, 12)}...`);
      return true;
    } else {
      console.error(`[session-end] ⚠️ Unregister failed: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    // Gateway 可能已停止，不报错
    console.error(`[session-end] ℹ️ Gateway not available for unregister: ${error.message}`);
    return false;
  }
}

/**
 * 发送离线通知到 QQ
 */
async function sendOfflineNotification(sessionId, config) {
  if (!config.autoNotifyOffline) {
    console.error('[session-end] ℹ️ Offline notification disabled');
    return;
  }

  if (!config.notifyTargetId) {
    console.error('[session-end] ℹ️ No notifyTargetId configured, skipping notification');
    return;
  }

  const projectName = getProjectName();
  const timestamp = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const message = `📴 Claude Code 会话已下线

📁 项目: ${projectName}
🆔 会话: ${sessionId ? sessionId.slice(0, 12) + '...' : 'unknown'}
⏰ 时间: ${timestamp}

会话已正常结束，如有需要请重新启动。`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${GATEWAY_API_URL}/api/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_id: config.notifyTargetId,
        message: message,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.error(`[session-end] ✅ Offline notification sent to QQ`);
    } else {
      console.error(`[session-end] ⚠️ Failed to send notification: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`[session-end] ⚠️ Failed to send notification: ${error.message}`);
  }
}

/**
 * 更新项目最后活跃时间
 */
function updateProjectLastActive() {
  const projectName = getProjectName();
  const projectsFile = path.join(GATEWAY_DIR, 'projects.json');

  try {
    if (!fs.existsSync(projectsFile)) return;

    const projects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));

    if (projects.projects[projectName]) {
      projects.projects[projectName].lastActive = Date.now();
      fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
    }
  } catch (error) {
    // 忽略错误
  }
}

/**
 * 主函数
 */
async function main() {
  const config = loadConfig();
  const sessionId = getSessionId();

  console.error('[session-end] 📤 Session ending...');

  // 1. 从 Gateway 注销
  await unregisterFromGateway(sessionId);

  // 2. 发送离线通知
  await sendOfflineNotification(sessionId, config);

  // 3. 更新项目状态
  updateProjectLastActive();

  console.error('[session-end] ✅ Cleanup complete');
}

main().catch((error) => {
  console.error(`[session-end] Error: ${error.message}`);
  process.exit(0); // 不阻塞 Claude Code 退出
});
