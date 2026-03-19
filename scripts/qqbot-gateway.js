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
import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { parseMessage as parseMessageFromParser, buildClaudeArgs } from './qqbot-parser.js';
import {
  loadActivationState,
  saveActivationState,
  getGatewayStatus,
  setGatewayStatus,
  getUserActivation,
  getUserActivationStatus,
  updateUserActivation,
  incrementMsgIdUsage,
  hasActiveUsers,
  getActiveUsers,
  getExpiringUsers,
  addPendingMessage,
  getPendingMessages,
  removePendingMessage,
  getPendingMessageCount,
  cleanupExpiredUsers,
  getActivationStats,
  getExpiredMessages,
  getCompressibleMessages,
  replacePendingMessages,
  clearExpiredMessages,
  saveCachedFile,
  getCachedFileInfo,
  getCachedFilePath,
  readCachedFile,
  removeCachedFile,
  getExpiredFiles,
  cleanupExpiredFiles,
  getCachedFilesStats,
  CONSTANTS,
} from './activation-state.js';

// 复用 src/api.ts 的完善实现
// 注意：源码目录是 dist/src/api.js，但插件安装目录是 dist/api.js
// 开发环境使用 dist/src/api.js，插件安装后使用 dist/api.js
import {
  getAccessToken as apiGetAccessToken,
  sendC2CMessage as apiSendC2CMessage,
  sendProactiveC2CMessage as apiSendProactiveC2CMessage,
  uploadC2CMedia,
  sendC2CMediaMessage,
  sendC2CImageMessage as apiSendC2CImageMessage,
  sendC2CFileMessage as apiSendC2CFileMessage,
  getGatewayUrl,
  MediaFileType
} from '../dist/src/api.js';

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

// 加载环境变量 - 从当前项目或插件目录的 .env
const localEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(localEnvPath)) {
  config({ path: localEnvPath });
}

// 注意：APP_ID 和 CLIENT_SECRET 现在从项目配置获取，不再使用全局变量

// ============ 自愈机制配置 ============
const SELF_HEALING_CONFIG = {
  // 启动重试配置
  startupRetry: {
    maxAttempts: 5,           // 最大重试次数
    initialDelayMs: 2000,     // 初始延迟 2 秒
    maxDelayMs: 30000,        // 最大延迟 30 秒
    backoffMultiplier: 2,     // 指数退避倍数
  },
  // 网络请求重试配置
  networkRetry: {
    maxAttempts: 3,           // 最大重试次数
    initialDelayMs: 1000,     // 初始延迟 1 秒
    maxDelayMs: 10000,        // 最大延迟 10 秒
    backoffMultiplier: 2,     // 指数退避倍数
  },
  // 健康检查配置
  healthCheck: {
    intervalMs: 60000,        // 检查间隔 1 分钟
    wsIdleTimeoutMs: 180000,  // WebSocket 空闲超时 3 分钟（QQ 平台约 30 分钟断开）
  },
  // 进程守护配置
  processGuardian: {
    checkIntervalMs: 10000,   // 检查间隔 10 秒
    restartDelayMs: 5000,     // 重启延迟 5 秒
  },
};

/**
 * 指数退避重试工具函数
 * @param {Function} fn - 要执行的异步函数
 * @param {Object} options - 重试配置
 * @param {string} operationName - 操作名称（用于日志）
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, options, operationName = 'operation') {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier } = options;
  let lastError = null;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const isNetworkError = error.message?.includes('fetch failed') ||
                               error.message?.includes('Network error') ||
                               error.message?.includes('ECONNREFUSED') ||
                               error.message?.includes('ETIMEDOUT');

        if (isNetworkError) {
          log('yellow', `   ⚠️ ${operationName} 失败 (尝试 ${attempt}/${maxAttempts}): ${error.message}`);
          log('cyan', `   🔄 ${delay / 1000} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * backoffMultiplier, maxDelayMs);
        } else {
          // 非网络错误，不重试
          throw error;
        }
      }
    }
  }

  throw lastError;
}

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

// ============ QQ API (复用 src/api.ts) ============

/**
 * 获取 Access Token - 包装器，自动从项目配置获取凭证（带重试）
 */
async function getAccessToken() {
  const data = loadProjects();
  const defaultProject = data.defaultProject;
  const botConfig = defaultProject ? getProjectBotConfig(defaultProject) : null;

  const appId = botConfig?.appId || process.env.QQBOT_APP_ID;
  const clientSecret = botConfig?.clientSecret || process.env.QQBOT_CLIENT_SECRET;

  if (!appId || !clientSecret) {
    throw new Error('未找到 QQ Bot 配置。请设置 QQBOT_APP_ID 和 QQBOT_CLIENT_SECRET 环境变量，或在项目 .env 文件中配置。');
  }

  // 使用重试机制获取 Token
  return retryWithBackoff(
    () => apiGetAccessToken(appId, clientSecret),
    SELF_HEALING_CONFIG.networkRetry,
    '获取 Access Token'
  );
}

/**
 * 发送 C2C 消息 - 包装器
 */
async function sendC2CMessage(token, openid, content, msgId = null) {
  return apiSendC2CMessage(token, openid, content, msgId);
}

/**
 * 发送主动消息 - 包装器
 * 当被动回复额度用完时使用
 */
async function sendProactiveMessage(token, openid, content) {
  return apiSendProactiveC2CMessage(token, openid, content);
}

/**
 * 智能发送消息 - 优先使用被动回复，额度用完时自动切换到主动消息
 * @param {string} token - Access Token
 * @param {string} openid - 用户 OpenID
 * @param {string} content - 消息内容
 * @param {object} usageInfo - 被动回复额度信息 (来自 incrementMsgIdUsage)
 * @returns {Promise<{success: boolean, method: string, error?: string, remaining?: number}>}
 */
async function sendMessageSmart(token, openid, content, usageInfo) {
  // 优先尝试被动回复
  if (usageInfo && usageInfo.canUse) {
    try {
      await sendC2CMessage(token, openid, content, usageInfo.msgId);
      return { success: true, method: 'passive', remaining: usageInfo.remaining };
    } catch (err) {
      log('yellow', `   ⚠️ 被动回复发送失败: ${err.message}，尝试主动消息...`);
    }
  }

  // 被动回复不可用或失败，尝试主动消息
  try {
    await sendProactiveMessage(token, openid, content);
    return { success: true, method: 'proactive' };
  } catch (err) {
    log('red', `   ❌ 主动消息发送失败: ${err.message}`);
    return { success: false, method: 'proactive', error: err.message };
  }
}

/**
 * 智能发送富媒体消息 - 优先使用被动回复，自动降级到主动消息
 * @param {string} token - Access Token
 * @param {string} openid - 用户 OpenID
 * @param {string} text - 消息内容（可能包含富媒体标签）
 * @param {object} usageInfo - 被动回复额度信息
 * @param {string} [projectName] - 项目名称
 * @returns {Promise<{success: boolean, method: string, error?: string, remaining?: number, id?: string}>}
 */
async function sendRichMessageSmart(token, openid, text, usageInfo, projectName = '') {
  // 先尝试使用被动回复发送富媒体消息
  if (usageInfo && usageInfo.canUse) {
    try {
      const result = await sendRichMessage(token, openid, text, usageInfo.msgId, projectName);
      if (result && result.id) {
        return { success: true, method: 'passive', remaining: usageInfo.remaining, id: result.id };
      }
    } catch (err) {
      log('yellow', `   ⚠️ 被动回复发送失败: ${err.message}，尝试主动消息...`);
    }
  }

  // 被动回复不可用或失败，尝试主动消息
  // 主动消息不支持富媒体，需要提取纯文本
  const plainText = text.replace(/<(qqimg|qqvoice|qqvideo|qqfile)>[^<>]*<\/(?:qqimg|qqvoice|qqvideo|qqfile|img)>/gi, '[媒体文件]');
  const finalText = projectName ? `[${projectName}] ${plainText}` : plainText;

  try {
    await sendProactiveMessage(token, openid, finalText);
    return { success: true, method: 'proactive' };
  } catch (err) {
    log('red', `   ❌ 主动消息发送失败: ${err.message}`);
    return { success: false, method: 'proactive', error: err.message };
  }
}

// ============ 富媒体消息支持 ============

/**
 * 发送 C2C 图片消息 - 处理本地文件后调用 API
 * @param {string} token - Access Token
 * @param {string} openid - 用户 OpenID
 * @param {string} imageUrl - 图片路径或 URL
 * @param {string} [msgId] - 回复的消息 ID
 * @param {string} [content] - 附加文本内容
 * @param {boolean} [strictValidation=true] - 是否启用严格验证（用户明确指定路径时为 true）
 */
async function sendC2CImageMessage(token, openid, imageUrl, msgId = null, content = null, strictValidation = true) {
  // 如果是本地文件，先进行安全检查并转换为 Data URL
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:')) {
    try {
      const imageData = await loadImageAsDataUrl(imageUrl, strictValidation);
      const sizeKB = Math.round(imageData.size / 1024);
      const sizeDisplay = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB}KB`;

      log('cyan', `   🖼️ 图片信息:`);
      log('cyan', `      名称: ${imageData.fileName}`);
      log('cyan', `      格式: ${imageData.mimeType}`);
      log('cyan', `      大小: ${sizeDisplay}`);

      return apiSendC2CImageMessage(token, openid, imageData.dataUrl, msgId, content);
    } catch (error) {
      log('red', `   ❌ 图片安全检查失败: ${error.message}`);
      throw error;
    }
  }

  // HTTP URL 或 Data URL 直接调用
  return apiSendC2CImageMessage(token, openid, imageUrl, msgId, content);
}

/**
 * 发送 C2C 文件消息 - 处理本地文件后调用 API
 * @param {string} token - Access Token
 * @param {string} openid - 用户 OpenID
 * @param {string} fileUrl - 文件路径或 URL
 * @param {string} [msgId] - 回复的消息 ID
 * @param {string} [content] - 附加文本内容
 * @param {string} [projectPath] - 项目路径（用于模糊搜索）
 */
async function sendC2CFileMessage(token, openid, fileUrl, msgId = null, content = null, projectPath = null) {
  // 如果是本地文件，先读取为 Base64
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    try {
      const fileData = await loadFileAsBase64(fileUrl, projectPath);
      const sizeKB = Math.round(fileData.size / 1024);
      const sizeDisplay = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB}KB`;

      log('cyan', `   📎 文件信息:`);
      log('cyan', `      名称: ${fileData.fileName}`);
      log('cyan', `      类型: ${fileData.typeInfo.description}`);
      log('cyan', `      大小: ${sizeDisplay} (${Math.round(fileData.base64.length / 1024)}KB base64)`);

      return apiSendC2CFileMessage(token, openid, fileData.base64, null, msgId, fileData.fileName);
    } catch (error) {
      // 检查是否是多文件匹配的情况
      if (error.message.startsWith('MULTIPLE_MATCHES:')) {
        const fileList = error.message.replace('MULTIPLE_MATCHES:', '');
        throw new Error(`找到多个匹配的文件，请明确指定文件名：\n${fileList}`);
      }
      throw error;
    }
  } else {
    // HTTP URL 直接调用
    log('cyan', `   📎 文件 URL: ${fileUrl}`);
    return apiSendC2CFileMessage(token, openid, null, fileUrl, msgId);
  }
}

/**
 * 图片安全配置
 */
const IMAGE_SECURITY_CONFIG = {
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
  mimeTypes: {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  },
  // 图片文件头魔数（用于验证真实的图片格式）
  magicNumbers: {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'image/webp': [0x52, 0x49, 0x46, 0x46], // WebP 以 RIFF 开头
    'image/bmp': [0x42, 0x4d],
  },
};

/**
 * 验证图片格式有效性（通过文件头魔数）
 */
function validateImageFormat(buffer, expectedMimeType) {
  const magicNumbers = IMAGE_SECURITY_CONFIG.magicNumbers[expectedMimeType];
  if (!magicNumbers) return true; // 未知类型跳过验证

  for (let i = 0; i < magicNumbers.length; i++) {
    if (buffer[i] !== magicNumbers[i]) {
      return false;
    }
  }
  return true;
}

/**
 * 读取本地图片并转换为 Base64 Data URL
 * @param {string} imagePath - 图片路径
 * @param {boolean} strictValidation - 是否启用严格验证（用户明确指定路径时为 true）
 * @returns {Promise<{dataUrl: string, fileName: string, size: number, mimeType: string}>}
 */
async function loadImageAsDataUrl(imagePath, strictValidation = true) {
  const fs = await import('fs');
  const path = await import('path');

  if (!fs.existsSync(imagePath)) {
    throw new Error(`图片文件不存在: ${imagePath}`);
  }

  const ext = path.extname(imagePath).toLowerCase();
  const fileName = path.basename(imagePath);

  // 安全检查：验证文件扩展名
  if (strictValidation && !IMAGE_SECURITY_CONFIG.allowedExtensions.includes(ext)) {
    throw new Error(`不支持的图片格式: ${ext}。支持的格式: ${IMAGE_SECURITY_CONFIG.allowedExtensions.join(', ')}`);
  }

  // 获取 MIME 类型
  const mimeType = IMAGE_SECURITY_CONFIG.mimeTypes[ext];
  if (!mimeType) {
    throw new Error(`无法识别的图片类型: ${ext}`);
  }

  // 读取文件
  const buffer = fs.readFileSync(imagePath);
  const fileSize = buffer.length;

  // 安全检查：文件大小
  if (fileSize > IMAGE_SECURITY_CONFIG.maxSizeBytes) {
    const sizeMB = (fileSize / 1024 / 1024).toFixed(2);
    const limitMB = (IMAGE_SECURITY_CONFIG.maxSizeBytes / 1024 / 1024).toFixed(0);
    throw new Error(`图片文件过大: ${sizeMB}MB，最大允许: ${limitMB}MB`);
  }

  // 验证图片格式有效性（通过文件头魔数）
  if (!validateImageFormat(buffer, mimeType)) {
    throw new Error(`图片格式无效: 文件扩展名是 ${ext}，但文件内容不是有效的 ${mimeType} 格式`);
  }

  const base64 = buffer.toString('base64');

  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    fileName,
    size: fileSize,
    mimeType,
  };
}

/**
 * 获取文件类型信息
 */
function getFileTypeInfo(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const typeInfo = {
    category: 'file',
    mimeType: 'application/octet-stream',
    description: '文件',
  };

  // 文档类型
  if (['.md', '.txt', '.rst'].includes(ext)) {
    typeInfo.category = 'document';
    typeInfo.mimeType = ext === '.md' ? 'text/markdown' : 'text/plain';
    typeInfo.description = ext === '.md' ? 'Markdown 文档' : '文本文件';
  } else if (['.pdf'].includes(ext)) {
    typeInfo.category = 'document';
    typeInfo.mimeType = 'application/pdf';
    typeInfo.description = 'PDF 文档';
  } else if (['.doc', '.docx'].includes(ext)) {
    typeInfo.category = 'document';
    typeInfo.mimeType = 'application/msword';
    typeInfo.description = 'Word 文档';
  } else if (['.json'].includes(ext)) {
    typeInfo.category = 'code';
    typeInfo.mimeType = 'application/json';
    typeInfo.description = 'JSON 文件';
  } else if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
    typeInfo.category = 'code';
    typeInfo.mimeType = 'text/javascript';
    typeInfo.description = ext.startsWith('.ts') ? 'TypeScript 文件' : 'JavaScript 文件';
  } else if (['.py'].includes(ext)) {
    typeInfo.category = 'code';
    typeInfo.mimeType = 'text/x-python';
    typeInfo.description = 'Python 文件';
  } else if (['.zip', '.tar', '.gz'].includes(ext)) {
    typeInfo.category = 'archive';
    typeInfo.description = '压缩文件';
  }

  return typeInfo;
}

/**
 * 模糊匹配文件 - 当路径不完整时搜索可能的文件
 */
async function findMatchingFiles(basePath, pattern, projectPath) {
  const fs = await import('fs');
  const path = await import('path');

  // 如果是完整路径且文件存在，直接返回
  if (fs.existsSync(basePath)) {
    return [{ path: basePath, exact: true }];
  }

  // 尝试在项目目录下搜索
  const searchDir = projectPath || process.cwd();
  const results = [];

  try {
    const files = fs.readdirSync(searchDir, { recursive: true });
    const patternLower = pattern.toLowerCase();

    for (const file of files) {
      const fullPath = path.join(searchDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const fileName = path.basename(file);
          const fileNameLower = fileName.toLowerCase();

          // 模糊匹配
          if (fileNameLower.includes(patternLower) || patternLower.includes(fileNameLower.replace(/\.[^.]+$/, ''))) {
            results.push({
              path: fullPath,
              fileName,
              size: stat.size,
              exact: false,
            });
          }
        }
      } catch (e) {
        // 忽略无法访问的文件
      }
    }
  } catch (e) {
    // 忽略搜索错误
  }

  return results.slice(0, 10); // 最多返回10个匹配
}

/**
 * 读取本地文件并转换为 Base64
 * @param {string} filePath - 文件路径
 * @param {string} [projectPath] - 项目路径（用于模糊搜索）
 * @returns {Promise<{base64: string, fileName: string, size: number, typeInfo: object}>}
 */
async function loadFileAsBase64(filePath, projectPath = null) {
  const fs = await import('fs');
  const path = await import('path');

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    // 尝试模糊匹配
    const matches = await findMatchingFiles(filePath, path.basename(filePath).replace(/\.[^.]+$/, ''), projectPath);

    if (matches.length === 0) {
      throw new Error(`File not found: ${filePath}`);
    } else if (matches.length === 1 && !matches[0].exact) {
      // 找到一个模糊匹配，使用它
      log('cyan', `   🔍 文件路径模糊匹配: ${path.basename(filePath)} → ${matches[0].fileName}`);
      filePath = matches[0].path;
    } else if (matches.length > 1) {
      // 多个匹配，抛出错误让调用者处理
      const fileList = matches.map((m, i) => `${i + 1}. ${m.fileName} (${Math.round(m.size / 1024)}KB)`).join('\n');
      throw new Error(`MULTIPLE_MATCHES:${fileList}`);
    }
  }

  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  const typeInfo = getFileTypeInfo(fileName);

  return {
    base64,
    fileName,
    size: buffer.length,
    typeInfo,
  };
}

/**
 * 解析并发送富媒体消息
 * @param {string} token - Access Token
 * @param {string} openid - 用户 OpenID
 * @param {string} text - 包含富媒体标签的文本
 * @param {string} [msgId] - 回复的消息 ID
 * @param {string} [projectName] - 项目名称（用于前缀）
 */
async function sendRichMessage(token, openid, text, msgId = null, projectName = null) {
  // 预处理：纠正常见标签格式问题
  text = text.replace(/<qqimg>/gi, '<qqimg>')
             .replace(/<\/img>/gi, '</qqimg>')
             .replace(/<(qqimg)([^>]*?)\/>/gi, '<qqimg>$2</qqimg>');

  // 匹配富媒体标签
  const mediaTagRegex = /<(qqimg|qqvoice|qqvideo|qqfile)>([^<>]+)<\/(?:qqimg|qqvoice|qqvideo|qqfile|img)>/gi;
  const matches = text.match(mediaTagRegex);

  if (!matches || matches.length === 0) {
    // 没有富媒体标签，发送纯文本
    const finalText = projectName ? `[${projectName}] ${text}` : text;
    return sendC2CMessage(token, openid, finalText, msgId);
  }

  log('cyan', `   检测到 ${matches.length} 个富媒体标签，分批发送...`);

  // 构建发送队列
  const sendQueue = [];
  let lastIndex = 0;
  const regexWithIndex = /<(qqimg|qqvoice|qqvideo|qqfile)>([^<>]+)<\/(?:qqimg|qqvoice|qqvideo|qqfile|img)>/gi;
  let match;

  while ((match = regexWithIndex.exec(text)) !== null) {
    // 添加标签前的文本
    const textBefore = text.slice(lastIndex, match.index).replace(/\n{3,}/g, '\n\n').trim();
    if (textBefore) {
      sendQueue.push({ type: 'text', content: textBefore });
    }

    const tagName = match[1].toLowerCase();
    let mediaPath = match[2].trim();

    // 展开路径
    if (mediaPath.startsWith('~')) {
      const os = await import('os');
      mediaPath = os.homedir() + mediaPath.slice(1);
    }

    if (tagName === 'qqimg') {
      sendQueue.push({ type: 'image', content: mediaPath });
    } else if (tagName === 'qqvoice') {
      sendQueue.push({ type: 'voice', content: mediaPath });
    } else if (tagName === 'qqvideo') {
      sendQueue.push({ type: 'video', content: mediaPath });
    } else if (tagName === 'qqfile') {
      sendQueue.push({ type: 'file', content: mediaPath });
    }

    lastIndex = match.index + match[0].length;
  }

  // 添加最后一个标签后的文本
  const textAfter = text.slice(lastIndex).replace(/\n{3,}/g, '\n\n').trim();
  if (textAfter) {
    sendQueue.push({ type: 'text', content: textAfter });
  }

  log('cyan', `   发送队列: ${sendQueue.map(i => i.type).join(' -> ')}`);

  // 按顺序发送
  let lastResult = null;
  let isFirstMessage = true;

  for (const item of sendQueue) {
    try {
      if (item.type === 'text') {
        const content = isFirstMessage && projectName ? `[${projectName}] ${item.content}` : item.content;
        lastResult = await sendC2CMessage(token, openid, content, isFirstMessage ? msgId : null);
        log('green', `   ✅ 文本消息已发送`);
      } else if (item.type === 'image') {
        const imagePath = item.content;
        const isHttpUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://');

        let imageUrl;
        if (isHttpUrl) {
          imageUrl = imagePath;
        } else if (imagePath.startsWith('data:')) {
          imageUrl = imagePath;
        } else {
          // 本地文件
          imageUrl = await loadImageAsDataUrl(imagePath);
          log('cyan', `   已读取本地图片: ${imagePath}`);
        }

        lastResult = await sendC2CImageMessage(token, openid, imageUrl, isFirstMessage ? msgId : null);
        log('green', `   ✅ 图片消息已发送`);
      } else if (item.type === 'file') {
        // 发送文件
        const filePath = item.content;
        const isHttpUrl = filePath.startsWith('http://') || filePath.startsWith('https://');

        let fileUrl;
        if (isHttpUrl) {
          fileUrl = filePath;
        } else {
          // 本地文件 - sendC2CFileMessage 会处理
          fileUrl = filePath;
        }

        lastResult = await sendC2CFileMessage(token, openid, fileUrl, isFirstMessage ? msgId : null);
        log('green', `   ✅ 文件消息已发送`);
      } else if (item.type === 'voice' || item.type === 'video') {
        // 语音和视频暂不支持，发送提示文本
        const tipText = `[${item.type === 'voice' ? '语音' : '视频'}暂不支持]`;
        lastResult = await sendC2CMessage(token, openid, tipText, isFirstMessage ? msgId : null);
        log('yellow', `   ⚠️ ${item.type} 暂不支持，已发送提示`);
      }

      isFirstMessage = false;

      // 发送间隔，避免频率限制
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      log('red', `   ❌ 发送 ${item.type} 失败: ${error.message}`);
    }
  }

  return lastResult;
}

// ============ 网关核心 ============
let ws = null;
let accessToken = null;
let heartbeatIntervalMs = null;  // 服务器返回的心跳间隔
let heartbeatTimer = null;       // setInterval 返回的 handle
let healthCheckTimer = null;     // 健康检查定时器
let lastWsActivity = Date.now(); // 最后 WebSocket 活动时间
let running = false;
let mode = 'notify'; // notify | auto
let startupAttempts = 0;         // 启动尝试次数
let consecutiveFailures = 0;     // 连续失败次数

// ============ 内部 HTTP API (供 Hook 调用) ============
const INTERNAL_API_PORT = 3310;
let internalServer = null;

/**
 * 启动内部 HTTP API 服务器
 * 供 hook handler 调用，避免 hook 直接访问 QQ API
 */
function startInternalApi() {
  internalServer = http.createServer(async (req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API: POST /api/notify - 发送通知消息
    if (req.method === 'POST' && req.url === '/api/notify') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { target, message, project } = data;

          if (!target || !message) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: '缺少 target 或 message 参数' }));
            return;
          }

          // 获取目标用户的激活状态
          const userStatus = getUserActivationStatus(target);

          if (userStatus === 'expired' || !userStatus) {
            // 用户未激活，缓存消息
            addPendingMessage({
              targetOpenid: target,
              content: `[${project || 'Hook'}] ${message}`,
              source: 'hook_notification',
              priority: 5,
            });
            log('cyan', `   📬 Hook 消息已缓存 (目标未激活): ${message.slice(0, 50)}...`);
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'cached', message: '消息已缓存，等待用户激活后发送' }));
            return;
          }

          // 用户已激活，尝试发送（优先被动回复，自动降级到主动消息）
          try {
            const token = await getAccessToken();
            const usageInfo = incrementMsgIdUsage(target);
            const result = await sendMessageSmart(token, target, `[${project || 'Hook'}] ${message}`, usageInfo);

            if (result.success) {
              const methodText = result.method === 'passive' ? `被动回复 (剩余 ${result.remaining} 次)` : '主动消息';
              log('green', `   ✅ Hook 消息已发送 [${methodText}]: ${message.slice(0, 50)}...`);
              res.writeHead(200);
              res.end(JSON.stringify({ status: 'sent', method: result.method, remaining: result.remaining }));
            } else {
              // 两种方式都失败，缓存消息
              addPendingMessage({
                targetOpenid: target,
                content: `[${project || 'Hook'}] ${message}`,
                source: 'hook_notification',
                priority: 5,
              });
              log('yellow', `   ⚠️ Hook 消息发送失败，已缓存: ${result.error}`);
              res.writeHead(200);
              res.end(JSON.stringify({ status: 'cached', message: '发送失败，消息已缓存' }));
            }
          } catch (sendErr) {
            // 发送失败，缓存消息
            addPendingMessage({
              targetOpenid: target,
              content: `[${project || 'Hook'}] ${message}`,
              source: 'hook_notification',
              priority: 5,
            });
            log('yellow', `   ⚠️ Hook 消息发送失败，已缓存: ${sendErr.message}`);
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'cached', message: '发送失败，消息已缓存' }));
          }
        } catch (parseErr) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '无效的 JSON 格式' }));
        }
      });
      return;
    }

    // API: GET /api/status - 获取网关状态
    if (req.method === 'GET' && req.url === '/api/status') {
      const stats = getActivationStats();
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'running',
        mode,
        pid: process.pid,
        ...stats
      }));
      return;
    }

    // API: POST /api/compress - 手动触发消息压缩
    if (req.method === 'POST' && req.url === '/api/compress') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = body ? JSON.parse(body) : {};
          const { openid } = data;

          if (openid) {
            // 压缩指定用户的消息
            const success = await compressExpiredMessages(openid);
            res.writeHead(200);
            res.end(JSON.stringify({
              status: success ? 'compressed' : 'no_messages',
              message: success ? '消息压缩完成' : '没有可压缩的消息'
            }));
          } else {
            // 压缩所有用户的消息
            await checkAndCompressExpiredMessages();
            res.writeHead(200);
            res.end(JSON.stringify({
              status: 'compressed',
              message: '所有过期消息已检查并压缩'
            }));
          }
        } catch (compressErr) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: compressErr.message }));
        }
      });
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  internalServer.listen(INTERNAL_API_PORT, '127.0.0.1', () => {
    log('green', `✅ 内部 API 已启动: http://127.0.0.1:${INTERNAL_API_PORT}`);
  });

  internalServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log('yellow', `⚠️ 内部 API 端口 ${INTERNAL_API_PORT} 已被占用`);
    } else {
      log('red', `❌ 内部 API 错误: ${err.message}`);
    }
  });
}

async function startGateway(gatewayMode = 'notify') {
  mode = gatewayMode;
  running = true;
  startupAttempts++;

  log('cyan', '🚀 启动 QQ Bot 全局网关...');
  log('cyan', `   模式: ${mode === 'auto' ? '自动回复' : '通知'}`);
  if (startupAttempts > 1) {
    log('cyan', `   启动尝试: ${startupAttempts}/${SELF_HEALING_CONFIG.startupRetry.maxAttempts}`);
  }

  // 写入 PID
  fs.writeFileSync(PID_FILE, process.pid.toString());

  // 初始化激活状态（仅首次启动时）
  if (startupAttempts === 1) {
    initActivationState();
    // 启动过期检查定时器
    startExpirationChecker();
    // 启动内部 HTTP API (供 hook 调用)
    startInternalApi();
    // 启动健康检查
    startHealthCheck();
  }

  try {
    // 使用带重试的 Token 获取
    accessToken = await getAccessToken();
    log('green', '✅ Access Token 获取成功');

    // 获取 Gateway URL (使用重试机制)
    const gatewayUrl = await retryWithBackoff(
      () => getGatewayUrl(accessToken),
      SELF_HEALING_CONFIG.networkRetry,
      '获取 Gateway URL'
    );
    log('green', `✅ Gateway URL: ${gatewayUrl}`);

    // 连接 WebSocket
    ws = new WebSocket(gatewayUrl);
    lastWsActivity = Date.now();

    ws.on('open', () => {
      log('green', '✅ WebSocket 连接已建立');
      lastWsActivity = Date.now();
      startupAttempts = 0; // 重置启动尝试计数
      consecutiveFailures = 0; // 重置连续失败计数
    });

    ws.on('message', async (data) => {
      lastWsActivity = Date.now(); // 更新活动时间
      const payload = JSON.parse(data.toString());

      switch (payload.op) {
        case 10: // Hello
          heartbeatIntervalMs = payload.d.heartbeat_interval;
          startHeartbeat();
          sendIdentify();
          break;

        case 11: // Heartbeat ACK
          // 心跳响应，无需处理
          break;

        case 0: // Dispatch
          await handleEvent(payload);
          break;
      }
    });

    ws.on('close', (code, reason) => {
      log('yellow', `⚠️ WebSocket 连接已关闭 (code: ${code}, reason: ${reason || '无'})`);
      if (running) {
        const delay = Math.min(5000 * (consecutiveFailures + 1), 30000);
        log('cyan', `   🔄 ${delay / 1000} 秒后重新连接...`);
        setTimeout(() => startGateway(mode), delay);
      }
    });

    ws.on('error', (err) => {
      log('red', `❌ WebSocket 错误: ${err.message}`);
      consecutiveFailures++;
    });

    ws.on('ping', () => {
      lastWsActivity = Date.now();
    });

  } catch (error) {
    consecutiveFailures++;
    log('red', `❌ 启动失败: ${error.message}`);

    if (startupAttempts < SELF_HEALING_CONFIG.startupRetry.maxAttempts) {
      const delay = Math.min(
        SELF_HEALING_CONFIG.startupRetry.initialDelayMs * Math.pow(SELF_HEALING_CONFIG.startupRetry.backoffMultiplier, startupAttempts - 1),
        SELF_HEALING_CONFIG.startupRetry.maxDelayMs
      );
      log('yellow', `   🔄 ${delay / 1000} 秒后重试启动 (${startupAttempts}/${SELF_HEALING_CONFIG.startupRetry.maxAttempts})...`);
      setTimeout(() => startGateway(mode), delay);
    } else {
      log('red', `   ❌ 达到最大重试次数 (${SELF_HEALING_CONFIG.startupRetry.maxAttempts})，停止重试`);
      log('yellow', `   💡 请检查网络连接和 QQ Bot 配置后手动重启`);
      running = false;
    }
  }
}

/**
 * 健康检查 - 定期检查 WebSocket 连接状态
 */
function startHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }

  healthCheckTimer = setInterval(() => {
    if (!running) return;

    const now = Date.now();
    const idleTime = now - lastWsActivity;

    // 检查 WebSocket 是否空闲过久
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      if (idleTime > SELF_HEALING_CONFIG.healthCheck.wsIdleTimeoutMs) {
        log('yellow', `⚠️ WebSocket 空闲超过 ${Math.round(idleTime / 60000)} 分钟，主动重连...`);
        // 主动关闭并触发重连
        ws.close();
      }
    } else if (ws && ws.readyState === 3) { // WebSocket.CLOSED
      log('yellow', '⚠️ 检测到 WebSocket 已关闭，触发重连...');
      if (running) {
        startGateway(mode);
      }
    }
  }, SELF_HEALING_CONFIG.healthCheck.intervalMs);

  log('cyan', `✅ 健康检查已启动 (间隔: ${SELF_HEALING_CONFIG.healthCheck.intervalMs / 1000} 秒)`);
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
    const botUsername = data.user?.username || '未知';
    log('green', `\n═══════════════════════════════════════════`);
    log('green', `🚀 QQ Bot 网关已启动 (PID: ${process.pid})`);
    log('green', `═══════════════════════════════════════════`);
    log('cyan', `   🤖 机器人: ${botUsername}`);
    log('cyan', `   📁 项目: ${loadProjects().defaultProject || '无'}`);
    log('cyan', `   ⚙️  模式: ${mode === 'auto' ? '自动回复' : '通知'}`);

    // 检查是否有有效激活用户
    const activeUsers = getActiveUsers();
    if (activeUsers.length === 0) {
      // 无激活用户，显示激活引导
      log('yellow', `\n──────────────────────────────────────────`);
      log('yellow', `📱 等待激活`);
      log('yellow', `──────────────────────────────────────────`);
      log('cyan', `\n   请使用 QQ 向机器人发送任意消息以激活网关`);
      log('cyan', `   激活后即可发送通知消息`);
      log('cyan', `\n   💡 提示: 发送 "hello" 或任意文字即可\n`);
      log('green', `═══════════════════════════════════════════\n`);

      // 设置网关状态为待激活
      setGatewayStatus('pending_activation');

      // 缓存启动通知，等待激活后发送
      const projectsData = loadProjects();
      const defaultProject = projectsData.defaultProject;
      if (defaultProject) {
        const botConfig = getProjectBotConfig(defaultProject);
        if (botConfig?.testTargetId) {
          const modeText = mode === 'auto' ? '自动回复' : '通知';
          const notification = `✅ QQ Bot 网关已启动\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🤖 机器人: ${botUsername}\n` +
            `📁 项目: ${defaultProject}\n` +
            `⚙️ 模式: ${modeText}\n` +
            `🔢 PID: ${process.pid}`;
          addPendingMessage({
            targetOpenid: botConfig.testTargetId,
            content: notification,
            source: 'startup_notification',
            priority: 1, // 高优先级
          });
          log('cyan', `   📬 启动通知已缓存，等待激活后发送`);
        }
      }
    } else {
      // 已有激活用户
      log('green', `\n──────────────────────────────────────────`);
      log('green', `✅ 已有 ${activeUsers.length} 个激活用户`);
      log('green', `──────────────────────────────────────────`);
      setGatewayStatus('activated');

      // 尝试发送启动通知（使用被动回复机制）
      sendStartupNotificationWithRetry(data.user?.username).catch(err => {
        log('yellow', `   ⚠️ 启动通知异常: ${err.message}`);
      });
    }

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
  const authorNickname = type === 'private' ? data.author?.username : data.author?.nick;

  log('green', `\n📬 收到${type === 'private' ? '私聊' : '群聊'}消息！`);
  log('cyan', `   发送者: ${authorId} (${authorNickname || '未知昵称'})`);
  log('cyan', `   内容: ${content}`);

  // 更新用户激活状态（关键：获取 msg_id 用于后续被动回复）
  const userActivation = updateUserActivation({
    openid: authorId,
    msgId: msgId,
    type: type === 'private' ? 'c2c' : 'group',
    nickname: authorNickname,
  });

  log('green', `   ✅ 用户激活成功 (msg_id 有效期至 ${new Date(userActivation.msgIdExpiresAt).toLocaleTimeString()})`);

  // 检查网关状态，如果是从待激活变为激活，显示成功提示
  const currentStatus = getGatewayStatus();
  if (currentStatus === 'activated') {
    const pendingCount = getPendingMessageCount(authorId);
    if (pendingCount > 0) {
      log('yellow', `\n──────────────────────────────────────────`);
      log('green', `✅ 用户激活成功`);
      log('yellow', `──────────────────────────────────────────`);
      log('cyan', `   👤 用户: ${authorNickname || authorId}`);
      log('cyan', `   🕐 时间: ${new Date().toLocaleTimeString()}`);
      log('cyan', `   📤 待发送消息: ${pendingCount} 条`);
      log('cyan', `\n   正在发送待发送消息...`);

      // 处理待发送消息队列
      await processPendingMessages(authorId, msgId);
    }
  }

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

  // 获取用户激活状态用于心跳消息
  const userActivation = getUserActivation(authorId);

  // 预先获取 token 用于心跳消息（避免每次心跳都请求新 token）
  let cachedToken = null;
  try {
    cachedToken = await getAccessToken();
  } catch (e) {
    log('yellow', `   ⚠️ 无法获取 token，心跳功能将受限`);
  }

  try {
    const child = spawn('claude', args, {
      cwd,
      env: { ...process.env, CLAUDECODE: undefined },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let heartbeatCount = 0;
    let lastHeartbeatContent = '';
    let heartbeatStopped = false;

    // 心跳机制：每 30 秒发送一次处理中消息
    const heartbeatInterval = setInterval(async () => {
      if (heartbeatStopped) return; // 防止重复发送

      heartbeatCount++;
      const elapsedSeconds = heartbeatCount * 30;
      const heartbeatContent = `⏳ 正在处理中... (${Math.floor(elapsedSeconds / 60)}分${elapsedSeconds % 60}秒)`;

      // 只有内容变化时才发送（避免重复消息）
      if (heartbeatContent !== lastHeartbeatContent && cachedToken) {
        lastHeartbeatContent = heartbeatContent;
        try {
          const usageInfo = getUserActivationStatus(authorId);
          if (usageInfo && usageInfo.msgId) {
            await sendC2CMessage(cachedToken, authorId, heartbeatContent, usageInfo.msgId);
            log('cyan', `   💓 心跳消息已发送 (${elapsedSeconds}秒)`);
          }
        } catch (e) {
          log('yellow', `   ⚠️ 心跳消息发送失败: ${e.message}`);
          // 心跳失败不中断主流程
        }
      }
    }, 30000); // 30 秒间隔

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.stdin.write(prompt);
    child.stdin.end();

    const timeout = setTimeout(() => {
      heartbeatStopped = true; // 停止心跳
      clearInterval(heartbeatInterval); // 清除心跳
      log('yellow', `   ⏰ 处理超时 (5分钟)，终止进程...`);
      child.kill();
    }, 300000);

    child.on('close', async (code) => {
      heartbeatStopped = true; // 停止心跳
      clearTimeout(timeout);
      clearInterval(heartbeatInterval); // 清除心跳

      if (code === 0 && stdout.trim()) {
        // 提取回复内容
        let replyContent = stdout.trim();

        // 尝试从 stream-json 中提取内容
        try {
          const lines = stdout.split('\n').filter(l => l.trim());
          const contents = [];
          for (const line of lines) {
            const json = JSON.parse(line);

            // 处理不同类型的 stream-json 消息
            if (json.type === 'content') {
              // 内容消息，可能有 text 或 content 字段
              if (json.text) {
                contents.push(json.text);
              } else if (json.content) {
                contents.push(json.content);
              }
            } else if (json.type === 'result' && json.result) {
              // 最终结果消息
              contents.push(json.result);
            }
          }
          if (contents.length > 0) {
            replyContent = contents.join('');
          }
        } catch (e) {
          // 解析失败，检查是否是纯文本
          // 如果 stdout 不是有效 JSON，直接使用原始输出
          if (!stdout.startsWith('{')) {
            replyContent = stdout.trim();
          }
        }

        // 清理可能的多余空白
        replyContent = replyContent.trim();

        // 如果回复内容为空或太短，发送默认回复
        if (!replyContent || replyContent.length < 2) {
          replyContent = '消息已收到，处理完成。';
        }

        // 注意：不再截断，因为 sendRichMessage 会分批发送
        // 但如果没有任何富媒体标签且内容超长，仍需截断
        const hasMediaTags = /<(qqimg|qqvoice|qqvideo|qqfile)>/i.test(replyContent);
        if (!hasMediaTags && replyContent.length > 2000) {
          replyContent = replyContent.slice(0, 1997) + '...';
        }

        log('green', `   生成回复: "${replyContent.slice(0, 80)}..."`);

        // 检查用户激活状态，获取被动回复额度
        const usageInfo = incrementMsgIdUsage(authorId);

        // 使用智能发送：优先被动回复，自动降级到主动消息
        // 检测是否是权限问题
        if (replyContent.includes('权限尚未授权') || replyContent.includes('工具权限')) {
          log('yellow', `   ⚠️ 检测到权限问题，发送授权指引...`);

          // 发送权限说明和授权指引
          const permissionGuide = `⚠️ 需要授权工具权限

${replyContent}

📝 如何授权：
1. 发送 "允许工具: mcp" 来授权 MCP 工具
2. 或发送 "权限模式: 跳过权限" 来跳过权限检查
3. 授权后重新发送您的请求

💡 示例：
• "允许工具: mcp" - 授权所有 MCP 工具
• "权限模式: 跳过权限" - 完全跳过权限检查`;

          const token = await getAccessToken();
          const permResult = await sendMessageSmart(token, authorId, permissionGuide, usageInfo);
          if (permResult.success) {
            const methodText = permResult.method === 'passive' ? `被动回复 (剩余 ${permResult.remaining} 次)` : '主动消息';
            log('green', `   ✅ 权限指引已发送 [${methodText}]`);
          } else {
            log('yellow', `   ⚠️ 权限指引发送失败: ${permResult.error}`);
          }
          return;
        }

        // 发送回复（使用智能发送，支持富媒体）
        const token = await getAccessToken();
        const result = await sendRichMessageSmart(token, authorId, replyContent, usageInfo, projectName);

        if (result && result.success) {
          const methodText = result.method === 'passive' ? `被动回复 (剩余 ${result.remaining} 次)` : '主动消息';
          log('green', `   ✅ 回复已发送 [${methodText}]`);
        } else {
          log('yellow', `   ⚠️ 回复发送失败: ${result?.error || JSON.stringify(result)}`);
        }
      } else {
        // 详细记录失败原因
        log('yellow', `   ⚠️ 处理失败 (code=${code}):`);
        if (stdout.trim()) {
          log('yellow', `   stdout: ${stdout.slice(0, 500)}`);
        } else {
          log('yellow', `   stdout: (空)`);
        }
        if (stderr.trim()) {
          log('yellow', `   stderr: ${stderr.slice(0, 500)}`);
        }

        // 使用智能发送错误回复
        const errorUsageInfo = incrementMsgIdUsage(authorId);
        const token = await getAccessToken();
        const errorResult = await sendMessageSmart(token, authorId, `[${projectName}] 抱歉，处理您的消息时遇到问题，请稍后再试～`, errorUsageInfo);
        if (errorResult.success) {
          const methodText = errorResult.method === 'passive' ? `被动回复 (剩余 ${errorResult.remaining} 次)` : '主动消息';
          log('green', `   ✅ 错误回复已发送 [${methodText}]`);
        } else {
          log('yellow', `   ⚠️ 错误回复发送失败: ${errorResult.error}`);
        }
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

  // 清除健康检查定时器
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }

  // 清除过期检查定时器
  if (expirationCheckTimer) {
    clearInterval(expirationCheckTimer);
    expirationCheckTimer = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }

  // 重置启动状态
  startupAttempts = 0;
  consecutiveFailures = 0;

  log('yellow', '👋 网关已停止');
}

// ============ 激活状态管理 ============
let expirationCheckTimer = null;

/**
 * 初始化激活状态
 */
function initActivationState() {
  const state = loadActivationState();
  const activeUsers = getActiveUsers();

  if (activeUsers.length > 0) {
    setGatewayStatus('activated');
    log('cyan', `   📋 激活状态: 已有 ${activeUsers.length} 个激活用户`);
  } else {
    setGatewayStatus('pending_activation');
    log('cyan', `   📋 激活状态: 等待激活`);
  }

  // 清理过期用户
  cleanupExpiredUsers();
}

/**
 * 启动过期检查定时器（每 5 分钟检查一次）
 */
function startExpirationChecker() {
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

  expirationCheckTimer = setInterval(async () => {
    if (!running) return;

    try {
      const now = Date.now();
      const expiringUsers = getExpiringUsers();

      // 对即将过期的用户发送提醒
      for (const user of expiringUsers) {
        const timeUntilExpiry = user.msgIdExpiresAt - now;
        const minutesLeft = Math.round(timeUntilExpiry / 60000);

        if (timeUntilExpiry > 0 && timeUntilExpiry <= CONSTANTS.MSG_ID_EXPIRING_THRESHOLD_MS) {
          log('yellow', `   ⚠️ 用户 ${user.nickname || user.openid} 会话即将过期 (${minutesLeft} 分钟)`);

          // 使用智能发送发送过期提醒
          try {
            const reminder = `⚠️ 会话即将过期\n\n您的会话将在 ${minutesLeft} 分钟后过期，届时将无法接收通知消息。\n\n请发送任意消息保持激活状态。`;
            const token = await getAccessToken();
            const usageInfo = incrementMsgIdUsage(user.openid);
            const result = await sendMessageSmart(token, user.openid, reminder, usageInfo);

            if (result.success) {
              const methodText = result.method === 'passive' ? '被动回复' : '主动消息';
              log('green', `   ✅ 过期提醒已发送给 ${user.nickname || user.openid} [${methodText}]`);
            } else {
              log('yellow', `   ⚠️ 发送过期提醒失败: ${result.error}`);
            }
          } catch (err) {
            log('yellow', `   ⚠️ 发送过期提醒异常: ${err.message}`);
          }
        }
      }

      // 清理过期用户
      cleanupExpiredUsers();

      // 检查并压缩过期消息
      await checkAndCompressExpiredMessages();
    } catch (err) {
      log('red', `   ❌ 过期检查出错: ${err.message}`);
    }
  }, CHECK_INTERVAL_MS);

  log('cyan', `   ⏰ 过期检查定时器已启动 (间隔: ${CHECK_INTERVAL_MS / 60000} 分钟)`);
}

/**
 * 处理待发送消息队列
 * @param {string} openid - 用户 openid
 * @param {string} msgId - 用于被动回复的 msg_id
 */
async function processPendingMessages(openid, msgId) {
  const pendingMessages = getPendingMessages(openid);

  if (pendingMessages.length === 0) {
    return;
  }

  log('cyan', `   📤 开始发送 ${pendingMessages.length} 条待发送消息...`);

  const token = await getAccessToken();
  let sentCount = 0;
  let failedCount = 0;
  let currentMsgId = msgId; // 用于被动回复的 msgId

  for (const msg of pendingMessages) {
    try {
      // 使用智能发送：优先被动回复，自动降级到主动消息
      const usageInfo = currentMsgId ? { canUse: true, msgId: currentMsgId, remaining: null } : { canUse: false };
      const result = await sendMessageSmart(token, openid, msg.content, usageInfo);

      if (result.success) {
        removePendingMessage(msg.id);
        sentCount++;
        const methodText = result.method === 'passive' ? '被动回复' : '主动消息';
        log('green', `   ✅ 消息 ${msg.id} 已发送 [${methodText}]`);

        // 如果使用了被动回复，后续消息需要使用主动消息（被动回复次数有限）
        if (result.method === 'passive') {
          currentMsgId = null; // 后续消息不再使用被动回复
        }
      } else {
        failedCount++;
        log('red', `   ❌ 消息 ${msg.id} 发送失败: ${result.error}`);
      }

      // 发送间隔，避免频率限制
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      failedCount++;
      log('red', `   ❌ 消息 ${msg.id} 发送异常: ${err.message}`);
    }
  }

  if (sentCount > 0) {
    log('green', `   ✅ 待发送消息处理完成`);
  }
  log('cyan', `   📊 发送完成: 成功 ${sentCount} 条, 失败 ${failedCount} 条`);
}

/**
 * 使用 Claude headless 模式压缩过期消息
 * @param {string} openid - 用户 openid
 * @returns {Promise<boolean>} 压缩是否成功
 */
async function compressExpiredMessages(openid) {
  const compressibleMsgs = getCompressibleMessages(openid);
  const expiredFiles = getExpiredFiles(openid);

  if (compressibleMsgs.length === 0 && expiredFiles.length === 0) {
    return false;
  }

  log('cyan', `   🗜️ 开始压缩 ${compressibleMsgs.length} 条过期消息和 ${expiredFiles.length} 个过期文件...`);

  // 分离有附件和没有附件的消息
  const textMessages = compressibleMsgs.filter(msg => !msg.attachment);
  const attachmentMessages = compressibleMsgs.filter(msg => msg.attachment);

  // 构建消息摘要内容
  let messagesText = '';

  if (textMessages.length > 0) {
    messagesText += `文本消息 (${textMessages.length} 条):\n`;
    messagesText += textMessages
      .map((msg, i) => `[${i + 1}] ${new Date(msg.createdAt).toLocaleString('zh-CN')}\n${msg.content}`)
      .join('\n\n---\n\n');
  }

  if (attachmentMessages.length > 0) {
    if (messagesText) messagesText += '\n\n---\n\n';
    messagesText += `附件消息 (${attachmentMessages.length} 条):\n`;
    messagesText += attachmentMessages
      .map((msg, i) => {
        const att = msg.attachment;
        return `[${i + 1}] ${new Date(msg.createdAt).toLocaleString('zh-CN')}\n` +
               `类型: ${att.type}, 文件名: ${att.filename}, 大小: ${Math.round(att.size / 1024)}KB\n` +
               `${msg.content || '(无文字内容)'}`;
      })
      .join('\n\n');
  }

  if (expiredFiles.length > 0) {
    if (messagesText) messagesText += '\n\n---\n\n';
    messagesText += `已过期的缓存文件 (${expiredFiles.length} 个):\n`;
    messagesText += expiredFiles
      .map((file, i) => `[${i + 1}] ${file.filename} (${file.type}, ${Math.round(file.size / 1024)}KB) - 已清理`)
      .join('\n');
  }

  const compressPrompt = `请将以下消息和文件记录压缩成一个简洁的摘要。格式要求：
1. 使用中文
2. 按时间顺序排列，格式："[时间] 摘要内容"
3. 对于附件消息，标注文件类型和名称
4. 对于已清理的文件，说明"文件已过期清理"
5. 保留所有重要信息，删除冗余内容
6. 总长度不超过 500 字

待压缩内容：
${messagesText}`;

  try {
    // 使用 Claude headless 模式压缩
    const claudePath = process.env.CLAUDE_CODE_PATH || 'claude';
    const compressResult = await new Promise((resolve, reject) => {
      const child = spawn(claudePath, [
        '--print',
        '--allowedTools', 'none',
        compressPrompt
      ], {
        timeout: 60000, // 1 分钟超时
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Claude exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', reject);
    });

    if (compressResult) {
      // 清理过期的缓存文件
      const cleanedFiles = cleanupExpiredFiles(openid);

      // 创建压缩后的消息
      const compressedMessage = {
        id: `compressed_${Date.now()}`,
        targetOpenid: openid,
        content: `📋 消息摘要 (${compressibleMsgs.length} 条消息${cleanedFiles > 0 ? `, ${cleanedFiles} 个文件已清理` : ''})\n\n${compressResult}`,
        source: 'system_alert',
        createdAt: Date.now(),
        priority: 20, // 较低优先级
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 天后过期
      };

      // 替换旧消息
      replacePendingMessages(openid, [compressedMessage]);
      log('green', `   ✅ 消息压缩完成: ${compressibleMsgs.length} 条 -> 1 条摘要${cleanedFiles > 0 ? `, 清理 ${cleanedFiles} 个文件` : ''}`);
      return true;
    }
  } catch (err) {
    log('red', `   ❌ 消息压缩失败: ${err.message}`);
    // 压缩失败时清除过期消息和文件
    clearExpiredMessages(openid);
    cleanupExpiredFiles(openid);
  }

  return false;
}

/**
 * 检查并压缩所有用户的过期消息
 */
async function checkAndCompressExpiredMessages() {
  const activeUsers = getActiveUsers();

  for (const user of activeUsers) {
    const expired = getExpiredMessages(user.openid);
    const expiredFiles = getExpiredFiles(user.openid);
    if (expired.length > 0 || expiredFiles.length > 0) {
      log('yellow', `   ⚠️ 用户 ${user.nickname || user.openid} 有 ${expired.length} 条过期消息, ${expiredFiles.length} 个过期文件`);
      await compressExpiredMessages(user.openid);
    }
  }
}

/**
 * 使用被动回复机制发送启动通知（带指数退避重试）
 * @param {string} botUsername - 机器人用户名
 * @param {number} retryCount - 当前重试次数
 */
async function sendStartupNotificationWithRetry(botUsername, retryCount = 0) {
  const maxRetries = 3;
  const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);

  try {
    const projectsData = loadProjects();
    const defaultProject = projectsData.defaultProject;
    if (!defaultProject) {
      return;
    }
    const botConfig = getProjectBotConfig(defaultProject);
    if (!botConfig?.testTargetId) {
      return;
    }

    const modeText = mode === 'auto' ? '自动回复' : '通知';
    const notification = `✅ QQ Bot 网关已启动\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 机器人: ${botUsername || '未知'}\n` +
      `📁 项目: ${defaultProject}\n` +
      `⚙️ 模式: ${modeText}\n` +
      `🔢 PID: ${process.pid}`;

    // 使用智能发送：优先被动回复，自动降级到主动消息
    const usageInfo = incrementMsgIdUsage(botConfig.testTargetId);
    const result = await sendMessageSmart(accessToken, botConfig.testTargetId, notification, usageInfo);

    if (result.success) {
      const methodText = result.method === 'passive' ? `被动回复 (剩余 ${result.remaining} 次)` : '主动消息';
      log('green', `   ✅ 启动通知已发送 [${methodText}]`);
    } else {
      // 两种方式都失败，缓存消息
      addPendingMessage({
        targetOpenid: botConfig.testTargetId,
        content: notification,
        source: 'startup_notification',
        priority: 1,
      });
      log('yellow', `   ⚠️ 启动通知发送失败，已缓存: ${result.error}`);
    }
  } catch (notifyErr) {
    if (retryCount < maxRetries) {
      log('yellow', `   ⚠️ 发送启动通知失败 (尝试 ${retryCount + 1}/${maxRetries}): ${notifyErr.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      await sendStartupNotificationWithRetry(botUsername, retryCount + 1);
    } else {
      log('yellow', `   ⚠️ 发送启动通知最终失败: ${notifyErr.message}`);
    }
  }
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

    // 支持 --auto 或 --mode auto 两种形式
    const modeIndex = args.indexOf('--mode');
    const modeValue = modeIndex !== -1 ? args[modeIndex + 1] : null;
    const startMode = (args.includes('--auto') || modeValue === 'auto') ? 'auto' : 'notify';
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

  case 'status': {
    console.log('\n🤖 QQ Bot 网关状态');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const colors = {
      reset: '\x1b[0m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      cyan: '\x1b[36m',
      dim: '\x1b[2m',
      bold: '\x1b[1m'
    };

    let pid = null;
    let isRunning = false;
    let uptime = null;

    // 服务状态
    if (fs.existsSync(PID_FILE)) {
      pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'));
      try {
        process.kill(pid, 0);
        isRunning = true;
        // 获取 PID 文件创建时间作为启动时间
        const pidStat = fs.statSync(PID_FILE);
        uptime = Date.now() - pidStat.birthtimeMs;
      } catch (e) {
        isRunning = false;
      }
    }

    console.log(`${colors.bold}服务状态${colors.reset}`);
    if (isRunning) {
      console.log(`  ${colors.green}✅ 运行中${colors.reset} (PID: ${pid})`);
      if (uptime) {
        const hours = Math.floor(uptime / 3600000);
        const minutes = Math.floor((uptime % 3600000) / 60000);
        console.log(`  ${colors.dim}运行时间: ${hours}小时 ${minutes}分钟${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.red}❌ 已停止${colors.reset}`);
      if (pid) {
        console.log(`  ${colors.yellow}⚠️  PID 文件存在但进程不存在（僵尸状态）${colors.reset}`);
      }
    }

    // 日志状态
    console.log(`\n${colors.bold}日志状态${colors.reset}`);
    if (fs.existsSync(LOG_FILE)) {
      const logStat = fs.statSync(LOG_FILE);
      const logSizeMB = (logStat.size / 1024 / 1024).toFixed(2);
      const lastModified = new Date(logStat.mtime).toLocaleString();
      console.log(`  文件大小: ${logSizeMB} MB`);
      console.log(`  ${colors.dim}最后更新: ${lastModified}${colors.reset}`);
    } else {
      console.log(`  ${colors.yellow}⚠️  日志文件不存在${colors.reset}`);
    }

    // 项目状态
    const data = loadProjects();
    const currentCwd = process.cwd();
    console.log(`\n${colors.bold}已注册项目 (${Object.keys(data.projects).length})${colors.reset}`);

    if (Object.keys(data.projects).length === 0) {
      console.log(`  ${colors.dim}暂无注册项目${colors.reset}`);
    } else {
      for (const [name, project] of Object.entries(data.projects)) {
        const isDefault = data.defaultProject === name;
        const isCurrent = project.path === currentCwd;
        const session = loadSession(name);

        const markers = [];
        if (isDefault) markers.push('★ 默认');
        if (isCurrent) markers.push('▶ 当前');

        console.log(`\n  ${colors.cyan}${name}${colors.reset} ${markers.length > 0 ? colors.yellow + '(' + markers.join(', ') + ')' + colors.reset : ''}`);
        console.log(`    路径: ${project.path}`);

        if (session) {
          console.log(`    会话: ${session.sessionId || '未建立'}`);
          if (session.lastSeq !== undefined) {
            console.log(`    ${colors.dim}消息序号: ${session.lastSeq}${colors.reset}`);
          }
          if (session.lastConnectedAt) {
            const lastConn = new Date(session.lastConnectedAt).toLocaleString();
            console.log(`    ${colors.dim}最后连接: ${lastConn}${colors.reset}`);
          }
        } else {
          console.log(`    会话: ${colors.dim}无${colors.reset}`);
        }
      }
    }

    // 当前目录项目提示
    const currentProject = Object.entries(data.projects || {}).find(([_, p]) => p.path === currentCwd);
    console.log(`\n${colors.bold}当前目录状态${colors.reset}`);
    if (currentProject) {
      const isDefault = data.defaultProject === currentProject[0];
      console.log(`  ${colors.green}✅ 已注册为 "${currentProject[0]}"${colors.reset}`);
      if (!isDefault) {
        console.log(`  ${colors.yellow}💡 运行 "/qqbot-service switch ${currentProject[0]}" 设为默认${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.yellow}⚠️  当前项目未注册${colors.reset}`);
      if (isRunning) {
        console.log(`  ${colors.dim}💡 运行 "/qqbot-service start" 注册当前项目${colors.reset}`);
      }
    }

    // 快速操作提示
    console.log(`\n${colors.bold}快速操作${colors.reset}`);
    if (!isRunning) {
      console.log(`  • 启动服务: /qqbot-service start`);
    } else {
      console.log(`  • 查看任务: /qqbot-tasks`);
      console.log(`  • 发送消息: /qqbot-send <targetId> <message>`);
      console.log(`  • 停止服务: /qqbot-service stop`);
    }
    console.log(`  • 诊断问题: /qqbot-doctor`);
    console.log(`  • 检查状态: /qqbot-check`);

    console.log('');
    break;
  }

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
