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

import { spawn, execFile } from 'child_process';
import WebSocket, { WebSocketServer } from 'ws';
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
  getUsersNeedingReminder,
  markReminderSent,
  resetReminderState,
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
  saveMessageHistory,
  getReferencedMessage,
  buildContextWithReference,
  CONSTANTS,
} from './activation-state.js';

import {
  loadAuthorizationState,
  getUserAuthorization,
  isAuthorized,
  authorizeUser,
  revokeAuthorization,
  getOrSetHeadlessConfig,
  resetHeadlessConfig,
  getAuthorizationStats,
  getUserTimeoutSettings,
  setUserTimeoutSettings,
  getGlobalTimeoutConfig,
  setGlobalTimeoutConfig,
  getExpiringAuthorizations,
  refreshAuthorization,
  cleanupExpiredAuthorizations,
  AUTH_CONSTANTS,
} from './authorization-state.js';

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
const GATEWAY_STATE_FILE = path.join(GATEWAY_DIR, 'gateway-state.json');
const HOOK_BATCH_CONFIG_FILE = path.join(GATEWAY_DIR, 'hook-batch-config.json');

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

// ============ 网关状态管理 ============
/**
 * 默认网关状态
 */
const DEFAULT_GATEWAY_STATE = {
  version: '2.0.0',
  runtime: {
    mode: null,
    pid: null,
    startedAt: null
  },
  channel: {
    enabled: false,
    mode: null
  },
  hookNotify: {
    enabled: true,  // 默认开启 Hook 推送
    updatedAt: null
  }
};

/**
 * 加载网关状态
 * @returns {Object} 网关状态对象
 */
function loadGatewayState() {
  try {
    if (fs.existsSync(GATEWAY_STATE_FILE)) {
      const content = fs.readFileSync(GATEWAY_STATE_FILE, 'utf-8');
      const state = JSON.parse(content);
      // 合并默认值，确保新字段存在
      return {
        ...DEFAULT_GATEWAY_STATE,
        ...state,
        hookNotify: {
          ...DEFAULT_GATEWAY_STATE.hookNotify,
          ...(state.hookNotify || {})
        }
      };
    }
  } catch (err) {
    log('yellow', `   ⚠️ 加载网关状态失败: ${err.message}`);
  }
  return { ...DEFAULT_GATEWAY_STATE };
}

/**
 * 保存网关状态
 * @param {Object} state - 网关状态对象
 */
function saveGatewayState(state) {
  try {
    fs.writeFileSync(GATEWAY_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    log('red', `   ❌ 保存网关状态失败: ${err.message}`);
  }
}

/**
 * 获取 Hook 推送开关状态
 * @returns {boolean} 是否启用 Hook 推送
 */
function getHookNotifyEnabled() {
  const state = loadGatewayState();
  return state.hookNotify.enabled !== false; // 默认 true
}

/**
 * 设置 Hook 推送开关状态
 * @param {boolean} enabled - 是否启用
 */
/**
 * 设置 Hook 推送开关状态
 * @param {boolean} enabled - 是否启用
 */
function setHookNotifyEnabled(enabled) {
  const state = loadGatewayState();
  state.hookNotify.enabled = enabled;
  state.hookNotify.updatedAt = Date.now();
  saveGatewayState(state);
  log('cyan', `   📬 Hook 推送已${enabled ? '开启' : '关闭'}`);
}

/**
 * 分类 Headless 锰误类型
 * @param {number} code - 退出码
 * @param {string} stderr - 锽tderr 辤 * @param {string} stdout - stdout 辀 * @returns {{ type: string, reason: string, userMessage: string }}
 */
function classifyHeadlessError(code, stderr, stdout) {
  // 超时
  if (code === null || code === 137) {
    return { type: 'timeout', reason: '处理超时 (5分钟)',
      userMessage: '⏳ 处理超时，请尝试简化您的请求后重试' };
  }

  // API 限流
  if (stderr.includes('rate limit') || stderr.includes('429') || stderr.includes('Erate limit') || stderr.includes('Too many requests')) {
    return { type: 'rate_limit', reason: 'API 请求过于频繁',
      userMessage: '⏳ 请求过于频繁，请等待片刻后重试' };
  }
  // 稡型过载
  if (stderr.includes('overloaded') || stderr.includes('capacity') || stderr.includes('model not available')) {
    return { type: 'overloaded', reason: '模型繁忙或资源不足',
      userMessage: '🤖 模型繁忙或资源不足，请稍后再试' };
  }
  // 网络错误
  if (stderr.includes('ETIMEDOUT') || stderr.includes('ECONNREFUSED') || stderr.includes('network') || stderr.includes('ENotfound')) {
    return { type: 'network', reason: '网络连接问题',
      userMessage: '🌐 网络连接不稳定，正在重试...' };
  }
  // 权限错误
  if (stderr.includes('permission') || stderr.includes('not authorized') || stderr.includes('forbidden')) {
    return { type: 'permission', reason: '权限不足',
      userMessage: '🔐 权限不足，请检查授权状态' };
  }
  // 默认错误
  return { type: 'unknown', reason: '未知错误',
    userMessage: '❌ 处理失败，请稍后再试' };
}

// ============ Claude Code 版本检测 (sessionId 格式兼容) ============
const CLAUDE_CODE_READABLE_SESSION_CUTOFF_VERSION = '1.0.0'; // 1.0.0 之后使用可读格式

/** 缓存 Claude Code 版本 */
let cachedClaudeCodeVersion = null;

/**
 * 获取 Claude Code 版本号
 * @returns {Promise<string|null>} - 版本号 (如 "1.0.30") 或 null
 */
async function getClaudeCodeVersion() {
  if (cachedClaudeCodeVersion !== null) {
    return cachedClaudeCodeVersion;
  }

  return new Promise((resolve) => {
    execFile('claude', ['--version'], (error, stdout, stderr) => {
      if (error) {
        cachedClaudeCodeVersion = null;
        resolve(null);
        return;
      }
      const match = (stdout || stderr).match(/(\d+\.\d+\.\d+)/);
      cachedClaudeCodeVersion = match ? match[1] : null;
      resolve(cachedClaudeCodeVersion);
    });
  });
}

/**
 * 比较版本号
 * @param {string} v1 - 版本1
 * @param {string} v2 - 版本2
 * @returns {number} - 1: v1>v2, -1: v1<v2, 0: 相等
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((parts1[i] || 0) > (parts2[i] || 0)) return 1;
    if ((parts1[i] || 0) < (parts2[i] || 0)) return -1;
  }
  return 0;
}

/**
 * 生成 sessionId (根据 Claude Code 版本选择格式)
 * @param {string} openid - 用户 openid
 * @returns {Promise<string>} - sessionId
 */
async function generateSessionId(openid) {
  const version = await getClaudeCodeVersion();

  if (version && compareVersions(version, CLAUDE_CODE_READABLE_SESSION_CUTOFF_VERSION) >= 0) {
    // 新版本: 可读短标题格式 (如 "qqbot-abc123-xyz789")
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `qqbot-${openid.slice(0, 6)}-${randomPart}`;
  } else {
    // 旧版本或未知: 标准 UUID 格式
    const crypto = await import('crypto');
    return crypto.randomUUID();
  }
}

// ============ 会话持久化管理 (Headless 模式 --resume 支持) ============
const HEADLESS_SESSIONS_DIR = path.join(GATEWAY_DIR, 'headless-sessions');

/**
 * 获取或创建用户的会话信息 (用于 --resume)
 * @param {string} openid - 用户 openid
 * @returns {Promise<{sessionId: string|null, isNew: boolean}>} - 会话信息
 *   - sessionId: 已建立的会话 ID (新会话返回 null)
 *   - isNew: 是否是新会话 (需要首次对话建立)
 */
async function getOrCreateHeadlessSessionId(openid) {
  const sessionFile = path.join(HEADLESS_SESSIONS_DIR, `${openid}.json`);

  // 确保目录存在
  if (!fs.existsSync(HEADLESS_SESSIONS_DIR)) {
    fs.mkdirSync(HEADLESS_SESSIONS_DIR, { recursive: true });
  }

  // 检查是否已有已建立的会话 (有 sessionId 且不是本地生成的临时 ID)
  if (fs.existsSync(sessionFile)) {
    try {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      // 只有当 sessionId 存在且已被 Claude 确认过 (有 confirmedAt 字段) 才使用 --resume
      if (sessionData.sessionId && sessionData.confirmedAt) {
        // 更新最后活跃时间
        sessionData.lastActive = Date.now();
        fs.writeFileSync(sessionFile, JSON.stringify(sessionData));
        return { sessionId: sessionData.sessionId, isNew: false };
      }
    } catch (e) {
      // 忽略错误，继续创建新会话
    }
  }

  // 新会话：不预先生成 sessionId，让 Claude 创建
  // 保存会话信息标记为待建立
  const sessionData = {
    sessionId: null, // 首次对话后由 Claude 返回
    openid,
    createdAt: Date.now(),
    lastActive: Date.now(),
    confirmedAt: null, // Claude 确认后设置
  };
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData));

  // 定期清理过期会话 (24小时未活跃)
  cleanExpiredHeadlessSessions();

  return { sessionId: null, isNew: true };
}

/**
 * 更新用户的会话 ID (首次对话成功后调用)
 * @param {string} openid - 用户 openid
 * @param {string} sessionId - Claude 返回的真实会话 ID
 */
function updateHeadlessSessionId(openid, sessionId) {
  const sessionFile = path.join(HEADLESS_SESSIONS_DIR, `${openid}.json`);

  if (!fs.existsSync(sessionFile)) {
    return;
  }

  try {
    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    sessionData.sessionId = sessionId;
    sessionData.confirmedAt = Date.now();
    sessionData.lastActive = Date.now();
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData));
    log('cyan', `   📝 会话 ID 已保存: ${sessionId.slice(0, 12)}...`);
  } catch (e) {
    log('yellow', `   ⚠️ 保存会话 ID 失败: ${e.message}`);
  }
}

/**
 * 清理过期的 Headless 会会话
 */
function cleanExpiredHeadlessSessions() {
  const maxAge = 24 * 60 * 60 * 1000; // 24小时
  const now = Date.now();

  try {
    if (!fs.existsSync(HEADLESS_SESSIONS_DIR)) {
      return;
    }

    const files = fs.readdirSync(HEADLESS_SESSIONS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(HEADLESS_SESSIONS_DIR, file);
      try {
        const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (now - sessionData.lastActive > maxAge) {
          fs.unlinkSync(filePath);
          log('cyan', `   🧹 清理过期会话: ${file}`);
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  } catch (e) {
    // 忽略错误
  }
}

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
  // ============ Claude Code 任务队列配置 ============
  claudeQueue: {
    maxConcurrent: 1,          // 最大并发执行数（同时只运行一个 Claude Code）
    mergeWindowMs: 5000,     // 消息合并窗口 5 秒
    taskTimeoutMs: 300000,   // 单任务超时 5 分钟
  },
};

// ============ Hook 消息缓存系统 ============
/**
 * Hook 消息缓存结构
 * @type {Map<string, {messages: Array, firstMessageTime: number, timer: NodeJS.Timeout|null}>}
 */
let hookCache = new Map();

/**
 * Hook 消息配置 - 5秒超时合并 + 300字节阈值压缩
 */
const HOOK_MESSAGE_CONFIG = {
  batchTimeoutMs: 5000,      // 批量等待超时：5 秒（有新消息重置）
  maxBatchWaitMs: 30000,     // 最大等待时间：30 秒（强制发送，防止无限延迟）
  compressThreshold: 300,    // 压缩阈值：300 字节
  compressedMaxSize: 150,    // 压缩后最大：150 字节
  compressTimeoutMs: 60000,  // 压缩超时：60 秒（Claude headless）
  pendingMaxSize: 2000,      // 待发送消息最大：2000 字节（防止积压过大）
};

// ============ Channel 注册表系统 ============
/**
 * Channel 注册表
 * @type {Map<string, {sessionId: string, projectPath: string, projectName: string, registeredAt: number, lastActive: number, isDefault: boolean}>}
 */
const channelRegistry = new Map();

/**
 * Channel 消息队列
 * @type {Map<string, Array<{id: string, sessionId: string, sourceType: string, sourceId: string, authorId: string, content: string, timestamp: number, delivered: boolean}>>}
 */
const channelQueues = new Map();

/**
 * 当前默认 Channel 的 sessionId
 * @type {string|null}
 */
let defaultChannelId = null;

/**
 * 当前运行模式：'channel' | 'headless' | 'notify'
 * @type {string}
 */
let activeMode = 'notify'; // 默认通知模式

// ============ Channel 过期检测 ============
/**
 * Channel 过期检测配置
 */
const CHANNEL_EXPIRY_CONFIG = {
  checkInterval: 60000,     // 每 60 秒检查一次
  inactiveThreshold: 90000, // 90 秒无活跃视为过期
  wsGracePeriod: 30000,     // WebSocket 断开后 30 秒宽限期
};

/**
 * Channel 过期检测定时器
 * @type {NodeJS.Timeout|null}
 */
let channelExpiryTimer = null;

/**
 * 启动 Channel 过期检测器
 */
function startChannelExpiryChecker() {
  if (channelExpiryTimer) return;

  channelExpiryTimer = setInterval(() => {
    const now = Date.now();
    for (const [sessionId, info] of channelRegistry.entries()) {
      const inactiveTime = now - info.lastActive;
      const hasWs = channelWsClients.has(sessionId);

      // 无 WebSocket 连接且超时，或 WebSocket 断开超过宽限期
      if ((!hasWs && inactiveTime > CHANNEL_EXPIRY_CONFIG.inactiveThreshold) ||
          (hasWs === false && inactiveTime > CHANNEL_EXPIRY_CONFIG.wsGracePeriod)) {
        log('yellow', `🧹 清理过期 Channel: ${sessionId.slice(0, 12)}... (inactive: ${Math.round(inactiveTime/1000)}s)`);
        unregisterChannel(sessionId);
      }
    }
  }, CHANNEL_EXPIRY_CONFIG.checkInterval);

  log('green', `✅ Channel 过期检测器已启动 (检查间隔: ${CHANNEL_EXPIRY_CONFIG.checkInterval/1000}s, 过期阈值: ${CHANNEL_EXPIRY_CONFIG.inactiveThreshold/1000}s)`);
}

/**
 * 停止 Channel 过期检测器
 */
function stopChannelExpiryChecker() {
  if (channelExpiryTimer) {
    clearInterval(channelExpiryTimer);
    channelExpiryTimer = null;
  }
}

/**
 * 按项目路径注销 Channel
 * @param {string} projectPath - 项目路径
 * @returns {{status: string, cleaned: number}}
 */
function unregisterChannelsByPath(projectPath) {
  let cleaned = 0;
  for (const [sessionId, info] of channelRegistry.entries()) {
    if (info.projectPath === projectPath) {
      unregisterChannel(sessionId);
      cleaned++;
    }
  }
  return { status: 'ok', cleaned };
}

// ============ Channel WebSocket 实时推送 ============
const CHANNEL_WEBSOCKET_PORT = 3311;
let channelWss = null;

/**
 * Channel WebSocket 连接管理
 * @type {Map<string, { ws: WebSocket, registeredAt: number, lastActive: number }>}
 */
const channelWsClients = new Map();

// ============ Channel 管理函数 ============

/**
 * 生成唯一 ID
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 注册 Channel
 * @param {string} sessionId - 会话 ID
 * @param {string} projectPath - 项目路径
 * @param {string} projectName - 项目名称（可选，从路径提取）
 * @returns {{success: boolean, channelId?: string, error?: string}}
 */
function registerChannel(sessionId, projectPath, projectName = null, displayName = null) {
  if (!sessionId || !projectPath) {
    return { success: false, error: '缺少 sessionId 或 projectPath' };
  }

  // 如果项目名未提供，从路径提取
  if (!projectName) {
    projectName = path.basename(projectPath);
  }

  // 显示名称默认使用项目名
  const channelDisplayName = displayName || projectName;

  // 检查是否已存在同名 session
  if (channelRegistry.has(sessionId)) {
    // 更新已有注册
    const existing = channelRegistry.get(sessionId);
    existing.projectPath = projectPath;
    existing.projectName = projectName;
    existing.displayName = channelDisplayName;
    existing.lastActive = Date.now();
    log('cyan', `   🔄 Channel 已更新: ${sessionId} (${channelDisplayName})`);
    return { success: true, channelId: sessionId };
  }

  // 是否为第一个注册的 Channel（自动成为默认）
  const isDefault = channelRegistry.size === 0;

  // 创建注册信息
  const channelInfo = {
    sessionId,
    projectPath,
    projectName,
    displayName: channelDisplayName,
    registeredAt: Date.now(),
    lastActive: Date.now(),
    isDefault,
  };

  channelRegistry.set(sessionId, channelInfo);

  // 初始化消息队列
  if (!channelQueues.has(sessionId)) {
    channelQueues.set(sessionId, []);
  }

  // 设置为默认 Channel
  if (isDefault) {
    defaultChannelId = sessionId;
    activeMode = 'channel'; // 切换到 Channel 模式
  }

  log('green', `   ✅ Channel 已注册: ${sessionId} (${channelDisplayName})${isDefault ? ' [默认]' : ''}`);
  return { success: true, channelId: sessionId };
}

/**
 * 注销 Channel
 * @param {string} sessionId - 会话 ID
 * @returns {{success: boolean, error?: string}}
 */
function unregisterChannel(sessionId) {
  if (!channelRegistry.has(sessionId)) {
    return { success: false, error: 'Channel 不存在' };
  }

  const channelInfo = channelRegistry.get(sessionId);
  const wasDefault = channelInfo.isDefault;

  channelRegistry.delete(sessionId);

  // 清理消息队列
  if (channelQueues.has(sessionId)) {
    channelQueues.delete(sessionId);
  }

  // 如果注销的是默认 Channel，需要重新选择默认
  if (wasDefault) {
    if (channelRegistry.size > 0) {
      // 选择第一个作为新的默认
      const [newDefaultId, newDefaultInfo] = channelRegistry.entries().next().value;
      newDefaultInfo.isDefault = true;
      defaultChannelId = newDefaultId;
      log('cyan', `   🔄 默认 Channel 已切换: ${newDefaultId}`);
    } else {
      // 没有注册的 Channel 了
      defaultChannelId = null;
      activeMode = 'notify'; // 回退到通知模式
      log('yellow', `   ⚠️ 所有 Channel 已注销，回退到通知模式`);
    }
  }

  log('green', `   ✅ Channel 已注销: ${sessionId}`);
  return { success: true };
}

/**
 * 获取所有 Channel 信息
 * @returns {Array<Object>}
 */
function getAllChannels() {
  return Array.from(channelRegistry.values()).map(info => ({
    sessionId: info.sessionId,
    projectName: info.projectName,
    projectPath: info.projectPath,
    registeredAt: info.registeredAt,
    lastActive: info.lastActive,
    isDefault: info.isDefault,
    pendingMessages: channelQueues.has(info.sessionId) ? channelQueues.get(info.sessionId).length : 0,
  }));
}

/**
 * 解析消息前缀，确定目标 Channel
 * @param {string} content - 消息内容
 * @returns {{targetSessionId: string|null, cleanContent: string}}
 */
function resolveChannel(content) {
  // 检查是否有 [session-id] 或 [project-name] 前缀
  const prefixMatch = content.match(/^\[([^\]]+)\]\s*(.*)$/s);

  if (prefixMatch) {
    const [, prefix, cleanContent] = prefixMatch;

    // 1. 首先尝试精确匹配 sessionId
    if (channelRegistry.has(prefix)) {
      return { targetSessionId: prefix, cleanContent };
    }

    // 2. 兼容：尝试匹配 projectName（向后兼容）
    for (const [sessionId, info] of channelRegistry) {
      if (info.projectName === prefix || info.projectPath.includes(prefix)) {
        return { targetSessionId: sessionId, cleanContent };
      }
    }

    // 没有匹配的前缀，使用默认 Channel
    return { targetSessionId: defaultChannelId, cleanContent };
  }

  // 无前缀，使用默认 Channel
  return { targetSessionId: defaultChannelId, cleanContent: content };
}

// ============ Channel 消息持久化 ============
const CHANNEL_MESSAGES_DIR = path.join(GATEWAY_DIR, 'channel-messages');

/**
 * 持久化消息到磁盘
 * @param {string} sessionId - Channel ID
 * @param {Object} message - 消息对象
 */
async function persistChannelMessage(sessionId, message) {
  const channelDir = path.join(CHANNEL_MESSAGES_DIR, sessionId);
  if (!fs.existsSync(channelDir)) {
    fs.mkdirSync(channelDir, { recursive: true });
  }
  const messageFile = path.join(channelDir, `${message.id}.json`);
  await fs.promises.writeFile(messageFile, JSON.stringify(message));
}

/**
 * 删除已处理的消息文件
 * @param {string} sessionId - Channel ID
 * @param {string} messageId - 消息 ID
 */
async function removePersistedMessage(sessionId, messageId) {
  const messageFile = path.join(CHANNEL_MESSAGES_DIR, sessionId, `${messageId}.json`);
  if (fs.existsSync(messageFile)) {
    await fs.promises.unlink(messageFile);
  }
}

/**
 * 加载 Channel 的持久化消息
 * @param {string} sessionId - Channel ID
 * @returns {Array<Object>} - 消息列表
 */
function loadPersistedMessages(sessionId) {
  const channelDir = path.join(CHANNEL_MESSAGES_DIR, sessionId);
  if (!fs.existsSync(channelDir)) {
    return [];
  }
  const messages = [];
  const files = fs.readdirSync(channelDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(channelDir, file), 'utf8'));
      messages.push(data);
    } catch (e) {
      // 忽略损坏的文件
    }
  }
  // 按时间排序
  return messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

/**
 * 加载所有持久化消息到队列 (启动时调用)
 */
function loadAllPersistedMessages() {
  if (!fs.existsSync(CHANNEL_MESSAGES_DIR)) {
    return;
  }
  const channels = fs.readdirSync(CHANNEL_MESSAGES_DIR);
  for (const sessionId of channels) {
    const messages = loadPersistedMessages(sessionId);
    if (messages.length > 0) {
      if (!channelQueues.has(sessionId)) {
        channelQueues.set(sessionId, []);
      }
      const queue = channelQueues.get(sessionId);
      // 合并未处理的消息
      for (const msg of messages) {
        if (!msg.delivered && !queue.find(m => m.id === msg.id)) {
          queue.push(msg);
        }
      }
      log('cyan', `   📂 加载持久化消息: ${sessionId} (${messages.length} 条)`);
    }
  }
}

/**
 * 添加消息到 Channel 队列
 * @param {string} sessionId - 目标 Channel
 * @param {Object} message - 消息对象
 */
function addMessageToChannelQueue(sessionId, message) {
  if (!channelQueues.has(sessionId)) {
    channelQueues.set(sessionId, []);
  }

  const queue = channelQueues.get(sessionId);

  // 队列限制配置
  const QUEUE_LIMITS = {
    maxMessages: 2000,
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
  };

  // 检查数量限制
  if (queue.length >= QUEUE_LIMITS.maxMessages) {
    const removed = queue.shift();
    log('yellow', `   ⚠️ Channel 队列已满 (${sessionId}), 丢弃最旧消息: ${removed?.id}`);
  }

  // 检查大小限制
  const newMessage = {
    id: generateId(),
    sessionId,
    ...message,
    timestamp: Date.now(),
    delivered: false,
  };
  const newSize = queue.reduce((sum, m) => sum + JSON.stringify(m).length, 0) + JSON.stringify(newMessage).length;
  if (newSize > QUEUE_LIMITS.maxSizeBytes) {
    log('yellow', `   ⚠️ Channel 队列超过大小限制 (${sessionId}), 丢弃最旧消息`);
    while (queue.length > 0 && newSize > QUEUE_LIMITS.maxSizeBytes) {
      queue.shift();
    }
  }

  queue.push(newMessage);

  // 持久化消息到磁盘 (异步, 不阻塞)
  persistChannelMessage(sessionId, newMessage).catch(err => {
    log('yellow', `   ⚠️ 消息持久化失败: ${err.message}`);
  });

  // 更新 Channel 活跃时间
  if (channelRegistry.has(sessionId)) {
    channelRegistry.get(sessionId).lastActive = Date.now();
  }

  // 尝试通过 WebSocket 实时推送（替代 HTTP 轮询）
  const pushed = pushToChannelWebSocket(sessionId, newMessage);
  if (pushed) {
    // WebSocket 推送成功，标记为已投递
    newMessage.delivered = true;
    log('cyan', `   ⚡ WebSocket 实时推送成功: ${sessionId.slice(0, 12)}...`);
  }
}

/**
 * 获取 Channel 的未读消息
 * @param {string} sessionId - Channel ID
 * @param {number} limit - 最大数量
 * @returns {Array<Object>}
 */
function getChannelMessages(sessionId, limit = 10) {
  if (!channelQueues.has(sessionId)) {
    return [];
  }

  const queue = channelQueues.get(sessionId);
  return queue.filter(m => !m.delivered).slice(0, limit);
}

/**
 * 标记 Channel 消息为已读
 * @param {string} sessionId - Channel ID
 * @param {Array<string>} messageIds - 消息 ID 列表
 */
function markChannelMessagesDelivered(sessionId, messageIds) {
  if (!channelQueues.has(sessionId)) {
    return;
  }

  const queue = channelQueues.get(sessionId);
  for (const msg of queue) {
    if (messageIds.includes(msg.id)) {
      msg.delivered = true;
    }
  }

  // 清理已读消息
  channelQueues.set(sessionId, queue.filter(m => !m.delivered));
}

/**
 * 检查是否有活跃的 Channel
 * @returns {boolean}
 */
function hasActiveChannels() {
  return channelRegistry.size > 0;
}

/**
 * 获取当前运行模式
 * @returns {string}
 */
function getActiveMode() {
  return activeMode;
}

/**
 * 设置运行模式
 * @param {string} newMode - 'channel' | 'headless' | 'notify'
 */
function setActiveMode(newMode) {
  activeMode = newMode;
}

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

// ============ Hook 消息缓存管理函数 ============

/**
 * 加载 Hook 批处理配置
 * @returns {Object} 配置对象
 */
function loadHookBatchConfig() {
  try {
    if (fs.existsSync(HOOK_BATCH_CONFIG_FILE)) {
      const data = fs.readFileSync(HOOK_BATCH_CONFIG_FILE, 'utf-8');
      const config = JSON.parse(data);
      return { ...DEFAULT_HOOK_BATCH_CONFIG, ...config };
    }
  } catch (err) {
    log('yellow', `   ⚠️ 加载 Hook 批处理配置失败: ${err.message}`);
  }
  return { ...DEFAULT_HOOK_BATCH_CONFIG };
}

/**
 * 保存 Hook 批处理配置
 * @param {Object} config - 配置对象
 */
function saveHookBatchConfig(config) {
  try {
    fs.writeFileSync(HOOK_BATCH_CONFIG_FILE, JSON.stringify(config, null, 2));
    log('green', `   ✅ Hook 批处理配置已保存`);
  } catch (err) {
    log('red', `   ❌ 保存 Hook 批处理配置失败: ${err.message}`);
  }
}

/**
 * 添加 Hook 消息到缓存（5 秒超时机制）
 * @param {string} openid - 用户 openid
 * @param {string} message - 消息内容
 * @param {string} project - 项目名称
 */
function addHookToCache(openid, message, project) {
  // 检查 Hook 推送全局开关
  if (!getHookNotifyEnabled()) {
    log('yellow', `   🔕 Hook 推送已关闭，跳过缓存`);
    return;
  }


  if (!hookCache.has(openid)) {
    hookCache.set(openid, {
      messages: [],
      firstMessageTime: Date.now(),
      timer: null, // 5 秒超时定时器
    });
  }

  const entry = hookCache.get(openid);
  entry.messages.push({
    message,
    project,
    timestamp: Date.now(),
  });

  log('cyan', `   📬 Hook 消息已缓存 (用户: ${openid.slice(0, 8)}..., 缓存数: ${entry.messages.length})`);

  // 检查是否超过最大等待时间（防止高频消息无限延迟）
  const elapsed = Date.now() - entry.firstMessageTime;
  if (elapsed >= HOOK_MESSAGE_CONFIG.maxBatchWaitMs) {
    log('yellow', `   ⏰ 已达最大等待时间 ${Math.round(elapsed / 1000)}s，强制触发处理`);
    // 立即触发处理，不重置定时器
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    processHookBatchWithTimeout(openid).catch(err => {
      log('red', `   ❌ 批次处理失败: ${err.message}`);
    });
    return;
  }

  // 重置 5 秒超时定时器（有新消息就重置）
  if (entry.timer) {
    clearTimeout(entry.timer);
  }
  entry.timer = setTimeout(() => {
    processHookBatchWithTimeout(openid).catch(err => {
      log('red', `   ❌ 批次处理失败: ${err.message}`);
    });
  }, HOOK_MESSAGE_CONFIG.batchTimeoutMs);
}

/**
 * 处理超时触发的 Hook 消息批次（5 秒超时 + 300 字节阈值压缩）
 * @param {string} openid - 用户 openid
 */
async function processHookBatchWithTimeout(openid) {
  const entry = hookCache.get(openid);
  if (!entry || entry.messages.length === 0) {
    return;
  }

  const messages = entry.messages;
  const waitTime = Math.round((Date.now() - entry.firstMessageTime) / 1000);

  // 清理缓存和定时器
  if (entry.timer) {
    clearTimeout(entry.timer);
  }
  hookCache.delete(openid);

  log('cyan', `   🗜️ 5秒超时触发 Hook 批次: ${messages.length} 条消息 (等待 ${waitTime} 秒)`);

  try {
    // 合并消息
    const mergedContent = mergeHookMessages(messages);
    const mergedBytes = getByteLength(mergedContent);

    let finalContent;

    // 检查是否需要压缩（超过 300 字节阈值）
    if (mergedBytes > HOOK_MESSAGE_CONFIG.compressThreshold) {
      log('cyan', `   📊 合并后 ${mergedBytes} 字节 > 阈值 ${HOOK_MESSAGE_CONFIG.compressThreshold}，启动内部 Headless 压缩...`);
      const summary = await compressHookMessagesToSize(messages, HOOK_MESSAGE_CONFIG.compressedMaxSize);
      finalContent = `📋 Hook 摘要 (${messages.length} 条, 原始 ${mergedBytes} 字节)\n\n${summary}`;
    } else {
      log('cyan', `   📊 合并后 ${mergedBytes} 字节 <= 阈值 ${HOOK_MESSAGE_CONFIG.compressThreshold}，直接发送`);
      finalContent = `📋 Hook 消息 (${messages.length} 条)\n\n${mergedContent}`;
    }

    // 获取用户激活状态
    const userStatus = getUserActivationStatus(openid);

    if (userStatus === 'expired' || !userStatus) {
      // 用户未激活，缓存消息
      addPendingMessage({
        targetOpenid: openid,
        content: finalContent,
        source: 'hook_batch',
        priority: 5,
      });
      log('cyan', `   📬 Hook 批次已缓存 (目标未激活)`);
      return;
    }

    // 用户已激活，发送消息
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(openid);
    const result = await sendMessageSmart(token, openid, finalContent, usageInfo);

    if (result.success) {
      const methodText = result.method === 'passive' ? `被动回复 (剩余 ${result.remaining} 次)` : '主动消息';
      log('green', `   ✅ Hook 批次已发送 [${methodText}]`);
    } else {
      // 发送失败，缓存消息
      addPendingMessage({
        targetOpenid: openid,
        content: finalContent,
        source: 'hook_batch',
        priority: 5,
      });
      log('yellow', `   ⚠️ Hook 批次发送失败，已缓存: ${result.error}`);
    }
  } catch (err) {
    log('red', `   ❌ Hook 批次处理失败: ${err.message}`);
    // 处理失败，将消息重新放回待发送队列
    for (const msg of messages) {
      addPendingMessage({
        targetOpenid: openid,
        content: `[${msg.project || 'Hook'}] ${msg.message}`,
        source: 'hook_notification',
        priority: 5,
      });
    }
  }
}

/**
 * 使用 Claude headless 压缩 Hook 消息到指定大小
 * @param {Array} messages - 消息数组
 * @param {number} maxSize - 最大字节数
 * @returns {Promise<string>} 压缩后的摘要
 */
async function compressHookMessagesToSize(messages, maxSize) {
  const messagesText = messages
    .map((m, i) => `[${i + 1}] ${new Date(m.timestamp).toLocaleTimeString('zh-CN')} | ${m.project || 'Hook'}\n${m.message}`)
    .join('\n\n');

  const compressPrompt = `请将以下 ${messages.length} 条 Hook 消息压缩成简洁摘要。

严格要求:
1. 使用中文
2. 总长度不超过 ${maxSize} 字节（约 ${Math.floor(maxSize / 3)} 个汉字）
3. 保留最重要的信息
4. 格式: 每条一行，"时间 | 简要内容"

待压缩内容:
${messagesText}`;

  try {
    const claudePath = process.env.CLAUDE_CODE_PATH || 'claude';
    const compressResult = await new Promise((resolve, reject) => {
      const child = spawn(claudePath, [
        '--print',
        '--allowedTools', 'none',
        compressPrompt
      ], {
        timeout: HOOK_MESSAGE_CONFIG.compressTimeoutMs, // 使用配置的压缩超时（默认 60 秒）
        maxBuffer: 1024 * 1024,
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

    // 确保压缩后不超过目标大小
    let result = compressResult || '（压缩失败）';
    if (getByteLength(result) > maxSize) {
      // 再次截断
      result = result.slice(0, Math.floor(maxSize / 3)) + '...';
    }

    return result;
  } catch (err) {
    log('red', `   ❌ Hook 消息压缩失败: ${err.message}`);
    // 压缩失败时返回简化版本
    return messages
      .slice(0, 3)
      .map((m, i) => `[${i + 1}] ${m.message.slice(0, 50)}...`)
      .join('\n');
  }
}

/**
 * 使用 Claude headless 压缩 Hook 消息批次
 * @param {Array} messages - 消息数组
 * @returns {Promise<string>} 压缩后的摘要
 */
async function compressHookMessages(messages) {
  const messagesText = messages
    .map((m, i) => `[${i + 1}] ${new Date(m.timestamp).toLocaleTimeString('zh-CN')} | ${m.project || 'Hook'}\n${m.message}`)
    .join('\n\n');

  const compressPrompt = `请将以下 ${messages.length} 条 Hook 消息压缩成简洁摘要。

格式要求:
1. 使用中文
2. 按时间顺序，格式: "[时间] 摘要内容"
3. 保留重要信息，删除冗余
4. 总长度不超过 500 字

待压缩内容:
${messagesText}`;

  try {
    const claudePath = process.env.CLAUDE_CODE_PATH || 'claude';
    const compressResult = await new Promise((resolve, reject) => {
      const child = spawn(claudePath, [
        '--print',
        '--allowedTools', 'none',
        compressPrompt
      ], {
        timeout: 60000, // 1 分钟超时
        maxBuffer: 1024 * 1024,
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

    return compressResult || '（压缩失败，请查看原始消息）';
  } catch (err) {
    log('red', `   ❌ Hook 消息压缩失败: ${err.message}`);
    // 压缩失败时返回简化版本
    return messages
      .map((m, i) => `[${i + 1}] ${m.message.slice(0, 100)}...`)
      .join('\n');
  }
}

/**
 * 计算字符串的字节长度（UTF-8）
 * @param {string} str - 字符串
 * @returns {number} 字节长度
 */
function getByteLength(str) {
  return Buffer.byteLength(str, 'utf-8');
}

/**
 * 简单合并 Hook 消息（不压缩）
 * @param {Array} messages - 消息数组
 * @returns {string} 合并后的消息
 */
function mergeHookMessages(messages) {
  return messages
    .map((m, i) => `[${i + 1}] ${new Date(m.timestamp).toLocaleTimeString('zh-CN')} | ${m.project || 'Hook'}\n${m.message}`)
    .join('\n\n');
}

/**
 * 启动 Hook 消息处理（5 秒超时合并机制）
 * 注意：实际定时器在 addHookToCache 中按用户创建，这里只是打印日志
 */
function startHookBatchTimer() {
  log('cyan', `   📤 Hook 消息模式: 5秒超时合并发送 (阈值 ${HOOK_MESSAGE_CONFIG.compressThreshold} 字节)`);
}

/**
 * 停止 Hook 消息处理（清理所有用户定时器）
 */
function stopHookBatchTimer() {
  // 清理所有用户的 5 秒定时器
  for (const [openid, entry] of hookCache) {
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
  }
  hookCache.clear();
}

/**
 * 获取 Hook 缓存状态
 * @returns {Object} 缓存状态
 */
function getHookCacheStatus() {
  const cacheInfo = [];
  const now = Date.now();

  for (const [openid, entry] of hookCache) {
    const waitSeconds = Math.round((now - entry.firstMessageTime) / 1000);
    cacheInfo.push({
      openid: openid.slice(0, 8) + '...',
      messageCount: entry.messages.length,
      firstMessageTime: new Date(entry.firstMessageTime).toLocaleString('zh-CN'),
      waitSeconds,
      timeoutSeconds: HOOK_MESSAGE_CONFIG.batchTimeoutMs / 1000,
    });
  }

  return {
    mode: '5秒超时合并',
    config: {
      batchTimeoutMs: HOOK_MESSAGE_CONFIG.batchTimeoutMs,
      compressThreshold: HOOK_MESSAGE_CONFIG.compressThreshold,
      compressedMaxSize: HOOK_MESSAGE_CONFIG.compressedMaxSize,
    },
    totalCachedMessages: cacheInfo.reduce((sum, c) => sum + c.messageCount, 0),
    cachedUsers: cacheInfo.length,
    cacheDetails: cacheInfo,
  };
}

// ============ Claude Code 任务队列系统 ============
/**
 * 任务队列项
 * @typedef {Object} QueueTask
 * @property {string} id - 任务唯一 ID
 * @property {string} projectName - 项目名称
 * @property {string} cwd - 工作目录
 * @property {string} authorId - 发送者 ID
 * @property {string} msgId - 消息 ID（用于被动回复）
 * @property {string} content - 原始消息内容
 * @property {Object} parsed - 解析后的消息对象
 * @property {number} createdAt - 创建时间戳
 * @property {number} [mergedAt] - 合并时间戳
 */

/**
 * 队列状态
 */
const claudeQueue = {
  tasks: [],              // 待处理任务队列
  running: null,          // 当前正在执行的任务
  runningProcess: null,    // 当前执行的子进程
  isProcessing: false,    // 是否正在处理中
  stats: {
    totalProcessed: 0,    // 总处理数
    totalMerged: 0,       // 总合并数
    avgProcessTimeMs: 0,  // 平均处理时间
  },
};

/**
 * 生成唯一任务 ID
 */
function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 添加任务到队列
 * @param {Object} taskData - 任务数据
 * @returns {Object} 添加的任务或合并的任务
 */
function enqueueTask(taskData) {
  const { projectName, cwd, authorId, msgId, content, parsed } = taskData;
  const config = SELF_HEALING_CONFIG.claudeQueue;

  // 检查是否有相同项目的待处理任务可以合并
  const now = Date.now();
  const pendingTask = claudeQueue.tasks.find(t =>
    t.projectName === projectName &&
    t.authorId === authorId &&
    (now - t.createdAt) < config.mergeWindowMs
  );

  if (pendingTask) {
    // 合并到现有任务
    pendingTask.content += `\n---\n${content}`;
    pendingTask.mergedCount = (pendingTask.mergedCount || 1) + 1;
    pendingTask.mergedAt = now;
    log('cyan', `   📦 消息已合并到队列任务 (项目: ${projectName}, 队列: ${claudeQueue.tasks.length})`);
    return pendingTask;
  }

  // 创建新任务
  const newTask = {
    id: generateTaskId(),
    projectName,
    cwd,
    authorId,
    msgId,
    content,
    parsed,
    createdAt: now,
    mergedCount: 1,
  };

  claudeQueue.tasks.push(newTask);
  log('cyan', `   📥 任务已加入队列 (项目: ${projectName}, 队列位置: ${claudeQueue.tasks.length})`);
  return newTask;
}

/**
 * 启动队列处理（如果当前没有在处理）
 */
async function startQueueProcessing() {
  if (claudeQueue.isProcessing) {
    log('cyan', `   ⏳ 队列处理中，新任务将排队等待...`);
    return;
  }
  processQueue();
}

/**
 * 处理队列中的任务
 */
async function processQueue() {
  if (claudeQueue.isProcessing || claudeQueue.tasks.length === 0) {
    return;
  }
  claudeQueue.isProcessing = true;
  const config = SELF_HEALING_CONFIG.claudeQueue;
  while (claudeQueue.tasks.length > 0) {
    const task = claudeQueue.tasks.shift();
    claudeQueue.running = task;
    const startTime = Date.now();
    log('yellow', `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log('green', `🔄 开始处理队列任务`);
    log('yellow', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log('cyan', `   📁 项目: ${task.projectName}`);
    log('cyan', `   📋 队列剩余: ${claudeQueue.tasks.length}`);
    if (task.mergedCount > 1) {
      log('cyan', `   📊 合并消息数: ${task.mergedCount}`);
    }
    try {
      await processWithClaude(task.parsed, task.authorId, task.msgId, task.content);
      const processTime = Date.now() - startTime;
      claudeQueue.stats.totalProcessed++;
      claudeQueue.stats.totalMerged += task.mergedCount;
      claudeQueue.stats.avgProcessTimeMs =
        (claudeQueue.stats.avgProcessTimeMs * (claudeQueue.stats.totalProcessed - 1) + processTime) /
        claudeQueue.stats.totalProcessed;
      log('green', `   ✅ 任务完成 (耗时: ${(processTime / 1000).toFixed(1)}秒)`);
    } catch (error) {
      log('red', `   ❌ 任务执行失败: ${error.message}`);
    } finally {
      claudeQueue.running = null;
      claudeQueue.runningProcess = null;
    }
  }
  claudeQueue.isProcessing = false;
  // 显示队列统计
  if (claudeQueue.stats.totalProcessed > 0) {
    log('cyan', `\n📊 队列统计:`);
    log('cyan', `   总处理: ${claudeQueue.stats.totalProcessed}, 总合并: ${claudeQueue.stats.totalMerged}`);
    log('cyan', `   平均耗时: ${(claudeQueue.stats.avgProcessTimeMs / 1000).toFixed(1)}秒`);
  }
}

/**
 * 获取队列状态
 */
function getQueueStatus() {
  return {
    isProcessing: claudeQueue.isProcessing,
    queueLength: claudeQueue.tasks.length,
    currentTask: claudeQueue.running ? {
      projectName: claudeQueue.running.projectName,
      mergedCount: claudeQueue.running.mergedCount,
    } : null,
    stats: claudeQueue.stats,
  };
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

  // 被动回复不可用或失败，尝试主动消息（带重试）
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 指数退避等待
      if (attempt > 1) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        log('cyan', `   🔄 主动消息重试 ${attempt}/${maxRetries}，等待 ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      await sendProactiveMessage(token, openid, content);
      return { success: true, method: 'proactive' };
    } catch (err) {
      if (attempt === maxRetries) {
        log('red', `   ❌ 主动消息发送失败 (已重试 ${maxRetries} 次): ${err.message}`);
        return { success: false, method: 'proactive', error: err.message };
      }
      log('yellow', `   ⚠️ 主动消息发送失败: ${err.message}，准备重试...`);
    }
  }

  return { success: false, method: 'proactive', error: 'Max retries exceeded' };
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

  // 被动回复不可用或失败，尝试主动消息发送富媒体
  // 注意：主动消息也支持富媒体（msgId 可选）
  try {
    const result = await sendRichMessage(token, openid, text, null, projectName);
    if (result && result.id) {
      return { success: true, method: 'proactive', id: result.id };
    }
  } catch (err) {
    log('yellow', `   ⚠️ 主动富媒体发送失败: ${err.message}，尝试纯文本...`);
  }

  // 富媒体发送失败，降级为纯文本
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

  // 检查是否为 Channel 模式，用于决定是否添加项目名前缀
  const state = loadGatewayState();
  const isChannelMode = state?.channel?.enabled === true;

  // 匹配富媒体标签
  const mediaTagRegex = /<(qqimg|qqvoice|qqvideo|qqfile)>([^<>]+)<\/(?:qqimg|qqvoice|qqvideo|qqfile|img)>/gi;
  const matches = text.match(mediaTagRegex);

  if (!matches || matches.length === 0) {
    // 没有富媒体标签，发送纯文本
    const finalText = isChannelMode && projectName ? `[${projectName}] ${text}` : text;
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

  // 按顺序发送 - Channel 模式下每条消息都添加前缀
  let lastResult = null;
  let isFirstMessage = true;

  for (const item of sendQueue) {
    try {
      if (item.type === 'text') {
        // Channel 模式下每条消息都添加前缀
        const content = isChannelMode && projectName ? `[${projectName}] ${item.content}` : item.content;
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
          const imageData = await loadImageAsDataUrl(imagePath);
          imageUrl = imageData.dataUrl;  // <-- 正确获取 dataUrl 属性
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

          // 统一使用 5 秒超时合并机制
          // 所有 Hook 消息都会被缓存，5 秒内无新消息则批量发送
          // 超过 300 字节自动调用 Claude 压缩
          addHookToCache(target, message, project);
          res.writeHead(200);
          res.end(JSON.stringify({
            status: 'batched',
            message: '消息已缓存，将在 5 秒后批量发送'
          }));
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

    // API: GET /api/hook-batch-config - 获取 Hook 消息配置
    if (req.method === 'GET' && req.url === '/api/hook-batch-config') {
      const status = getHookCacheStatus();
      res.writeHead(200);
      res.end(JSON.stringify(status));
      return;
    }

    // API: POST /api/hook-batch-config - 更新 Hook 消息配置（仅压缩阈值）
    if (req.method === 'POST' && req.url === '/api/hook-batch-config') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);

          // 只更新压缩阈值（其他参数固定为 5 秒超时）
          if (typeof data.compressThreshold === 'number' && data.compressThreshold > 0) {
            HOOK_MESSAGE_CONFIG.compressThreshold = data.compressThreshold;
          }
          if (typeof data.compressedMaxSize === 'number' && data.compressedMaxSize > 0) {
            HOOK_MESSAGE_CONFIG.compressedMaxSize = data.compressedMaxSize;
          }

          res.writeHead(200);
          res.end(JSON.stringify({
            status: 'ok',
            config: HOOK_MESSAGE_CONFIG,
            message: `Hook 消息配置已更新: 5秒超时, 压缩阈值 ${HOOK_MESSAGE_CONFIG.compressThreshold} 字节`
          }));
        } catch (parseErr) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '无效的 JSON 格式' }));
        }
      });
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

    // ============ Channel API 端点 ============

    // API: POST /api/channels/register - 注册 Channel
    if (req.method === 'POST' && req.url === '/api/channels/register') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { sessionId, projectPath, projectName, displayName } = data;

          if (!sessionId || !projectPath) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: '缺少 sessionId 或 projectPath' }));
            return;
          }

          const result = registerChannel(sessionId, projectPath, projectName, displayName);
          if (result.success) {
            const channelInfo = channelRegistry.get(result.channelId);
            res.writeHead(200);
            res.end(JSON.stringify({
              status: 'registered',
              channelId: result.channelId,
              displayName: channelInfo?.displayName || projectName,
              isDefault: channelInfo?.isDefault || false,
              activeMode: getActiveMode(),
            }));
          } else {
            res.writeHead(400);
            res.end(JSON.stringify({ error: result.error }));
          }
        } catch (parseErr) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '无效的 JSON 格式' }));
        }
      });
      return;
    }

    // API: DELETE /api/channels/:sessionId - 注销 Channel
    if (req.method === 'DELETE' && req.url.startsWith('/api/channels/')) {
      const sessionId = decodeURIComponent(req.url.replace('/api/channels/', ''));
      const result = unregisterChannel(sessionId);

      if (result.success) {
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'unregistered',
          sessionId,
          activeMode: getActiveMode(),
          remainingChannels: channelRegistry.size,
        }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: result.error }));
      }
      return;
    }

    // API: GET /api/channels - 列出所有 Channel
    if (req.method === 'GET' && req.url === '/api/channels') {
      const channels = getAllChannels();
      res.writeHead(200);
      res.end(JSON.stringify({
        activeMode: getActiveMode(),
        totalChannels: channels.length,
        defaultChannelId,
        channels,
      }));
      return;
    }

    // API: POST /api/channels/:sessionId/heartbeat - 更新 Channel 心跳
    if (req.method === 'POST' && req.url.match(/^\/api\/channels\/[^/]+\/heartbeat$/)) {
      const sessionId = decodeURIComponent(req.url.replace('/api/channels/', '').replace('/heartbeat', ''));
      const info = channelRegistry.get(sessionId);

      if (!info) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Channel not found' }));
        return;
      }

      info.lastActive = Date.now();
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', lastActive: info.lastActive }));
      return;
    }

    // API: DELETE /api/channels/by-path - 按项目路径注销 Channel
    if (req.method === 'DELETE' && req.url.startsWith('/api/channels/by-path?')) {
      const urlObj = new URL(req.url, `http://127.0.0.1:${INTERNAL_API_PORT}`);
      const projectPath = urlObj.searchParams.get('path');

      if (!projectPath) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing path parameter' }));
        return;
      }

      const result = unregisterChannelsByPath(projectPath);
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        cleaned: result.cleaned,
        projectPath,
      }));
      return;
    }

    // API: GET /api/messages - 获取指定 Channel 的消息
    if (req.method === 'GET' && req.url.startsWith('/api/messages?')) {
      const urlObj = new URL(req.url, `http://127.0.0.1:${INTERNAL_API_PORT}`);
      const sessionId = urlObj.searchParams.get('channel');
      const limit = parseInt(urlObj.searchParams.get('limit') || '10', 10);

      if (!sessionId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: '缺少 channel 参数' }));
        return;
      }

      const messages = getChannelMessages(sessionId, limit);
      res.writeHead(200);
      res.end(JSON.stringify({
        sessionId,
        count: messages.length,
        messages,
      }));
      return;
    }

    // API: DELETE /api/messages - 清理已读消息
    if (req.method === 'DELETE' && req.url.startsWith('/api/messages?')) {
      const urlObj = new URL(req.url, `http://127.0.0.1:${INTERNAL_API_PORT}`);
      const sessionId = urlObj.searchParams.get('channel');
      const messageIds = urlObj.searchParams.get('ids')?.split(',') || [];

      if (!sessionId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: '缺少 channel 参数' }));
        return;
      }

      markChannelMessagesDelivered(sessionId, messageIds);
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'cleared',
        sessionId,
        clearedCount: messageIds.length,
      }));
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

/**
 * 启动 Channel WebSocket Server
 * 用于实时推送消息到 MCP Server（替代 HTTP 轮询）
 */
function startChannelWebSocketServer() {
  if (channelWss) {
    log('yellow', '⚠️ Channel WebSocket Server 已在运行');
    return;
  }

  channelWss = new WebSocketServer({ port: CHANNEL_WEBSOCKET_PORT });

  channelWss.on('connection', (ws, req) => {
    let clientSessionId = null;

    log('cyan', `   🔌 新的 WebSocket 连接: ${req.socket.remoteAddress}`);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // 处理注册消息
        if (msg.type === 'register' && msg.sessionId) {
          clientSessionId = msg.sessionId;
          channelWsClients.set(clientSessionId, {
            ws,
            registeredAt: Date.now(),
            lastActive: Date.now()
          });
          log('green', `   ✅ Channel WS 已注册: ${clientSessionId.slice(0, 12)}...`);

          // 发送确认
          ws.send(JSON.stringify({
            type: 'registered',
            sessionId: clientSessionId,
            timestamp: Date.now()
          }));
        }

        // 处理心跳消息
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          if (clientSessionId && channelWsClients.has(clientSessionId)) {
            channelWsClients.get(clientSessionId).lastActive = Date.now();
          }
        }
      } catch (e) {
        log('yellow', `   ⚠️ 无效的 WebSocket 消息: ${e.message}`);
      }
    });

    ws.on('close', () => {
      if (clientSessionId) {
        channelWsClients.delete(clientSessionId);
        log('yellow', `   ⚠️ Channel WS 已断开: ${clientSessionId.slice(0, 12)}...`);
      }
    });

    ws.on('error', (err) => {
      log('red', `   ❌ WebSocket 错误: ${err.message}`);
    });
  });

  channelWss.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log('yellow', `⚠️ Channel WebSocket 端口 ${CHANNEL_WEBSOCKET_PORT} 已被占用`);
    } else {
      log('red', `❌ Channel WebSocket 错误: ${err.message}`);
    }
  });

  log('green', `✅ Channel WebSocket 已启动: ws://127.0.0.1:${CHANNEL_WEBSOCKET_PORT}`);
}

/**
 * 向 Channel WebSocket 客户端实时推送消息
 * @param {string} sessionId - 目标 Channel sessionId
 * @param {Object} message - 消息对象
 */
function pushToChannelWebSocket(sessionId, message) {
  const client = channelWsClients.get(sessionId);
  if (!client || !client.ws) {
    return false;
  }

  if (client.ws.readyState !== WebSocket.OPEN) {
    channelWsClients.delete(sessionId);
    return false;
  }

  try {
    client.ws.send(JSON.stringify({
      type: 'channel_message',
      data: message,
      timestamp: Date.now()
    }));
    client.lastActive = Date.now();
    return true;
  } catch (e) {
    log('yellow', `   ⚠️ WebSocket 推送失败: ${e.message}`);
    return false;
  }
}

async function startGateway(gatewayMode = 'notify', channelConfig = null) {
  mode = gatewayMode;
  running = true;
  startupAttempts++;

  log('cyan', '🚀 启动 QQ Bot 全局网关...');
  log('cyan', `   模式: ${mode === 'auto' ? '自动回复' : '通知'}`);
  if (channelConfig) {
    log('cyan', `   Channel: ${channelConfig}`);
  }
  if (startupAttempts > 1) {
    log('cyan', `   启动尝试: ${startupAttempts}/${SELF_HEALING_CONFIG.startupRetry.maxAttempts}`);
  }

  // 写入 PID
  fs.writeFileSync(PID_FILE, process.pid.toString());

  // 加载持久化的 Channel 消息
  loadAllPersistedMessages();

  // 持久化网关状态（模式等）- 保留现有配置如 hookNotify
  const existingState = loadGatewayState();
  const gatewayState = {
    ...existingState,
    mode,
    channel: {
      enabled: !!channelConfig,
      mode: channelConfig || 'none'
    },
    pid: process.pid,
    startedAt: Date.now(),
    startupAttempts
  };
  saveGatewayState(gatewayState);

  // 初始化激活状态（仅首次启动时）
  if (startupAttempts === 1) {
    initActivationState();
    // 启动过期检查定时器
    startExpirationChecker();
    // 启动内部 HTTP API (供 hook 调用)
    startInternalApi();
    // 启动 Channel WebSocket Server (实时推送)
    startChannelWebSocketServer();
    // 启动健康检查
    startHealthCheck();
    // 启动 Hook 批处理定时器
    startHookBatchTimer();
    // 启动 Channel 过期检测器
    startChannelExpiryChecker();
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

  // 健康状态追踪
  let consecutiveWsFailures = 0;
  let consecutiveApiFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3;

  healthCheckTimer = setInterval(async () => {
    if (!running) return;

    const now = Date.now();
    const idleTime = now - lastWsActivity;

    // 1. 检查 WebSocket 连接状态
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      consecutiveWsFailures = 0; // 重置失败计数

      // 检查 WebSocket 是否空闲过久
      if (idleTime > SELF_HEALING_CONFIG.healthCheck.wsIdleTimeoutMs) {
        log('yellow', `⚠️ WebSocket 空闲超过 ${Math.round(idleTime / 60000)} 分钟，主动重连...`);
        consecutiveWsFailures++;
        ws.close();
      }
    } else if (ws && ws.readyState === 3) { // WebSocket.CLOSED
      consecutiveWsFailures++;
      log('yellow', `⚠️ 检测到 WebSocket 已关闭 (连续失败: ${consecutiveWsFailures}/${MAX_CONSECUTIVE_FAILURES})`);

      if (consecutiveWsFailures >= MAX_CONSECUTIVE_FAILURES) {
        log('red', '❌ WebSocket 连续失败次数过多，执行完全重启...');
        consecutiveWsFailures = 0;
        // 完全重启网关
        if (running) {
          try {
            await startGateway(mode);
            log('green', '✅ 网关重启成功');
          } catch (err) {
            log('red', `❌ 网关重启失败: ${err.message}`);
          }
        }
      } else if (running) {
        startGateway(mode);
      }
    }

    // 2. 检查 API 可用性（每 5 分钟检查一次）
    if (now % (5 * 60 * 1000) < SELF_HEALING_CONFIG.healthCheck.intervalMs) {
      try {
        const token = await getAccessToken();
        if (token) {
          consecutiveApiFailures = 0;
          // log('green', '✅ API 健康检查通过');
        } else {
          throw new Error('Token 为空');
        }
      } catch (err) {
        consecutiveApiFailures++;
        log('yellow', `⚠️ API 健康检查失败 (连续失败: ${consecutiveApiFailures}/${MAX_CONSECUTIVE_FAILURES}): ${err.message}`);

        if (consecutiveApiFailures >= MAX_CONSECUTIVE_FAILURES) {
          log('red', '❌ API 连续失败次数过多，可能凭证过期或网络问题');
          consecutiveApiFailures = 0;
        }
      }
    }

    // 3. 检查内存使用情况
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const memUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    if (memUsagePercent > 90) {
      log('yellow', `⚠️ 内存使用率过高: ${heapUsedMB}MB / ${heapTotalMB}MB (${memUsagePercent}%)`);

      // 触发垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
        log('cyan', '🗑️ 已触发垃圾回收');
      }

      // 清理过期缓存
      cleanupExpiredUsers();
      cleanupExpiredFiles();
      clearExpiredMessages();
    }

    // 4. 检查队列状态
    if (claudeQueue.tasks.length > 10) {
      log('yellow', `⚠️ 任务队列积压: ${claudeQueue.tasks.length} 个任务等待处理`);
    }

  }, SELF_HEALING_CONFIG.healthCheck.intervalMs);

  log('cyan', `✅ 健康检查已启动 (间隔: ${SELF_HEALING_CONFIG.healthCheck.intervalMs / 1000} 秒, 包含: WebSocket/API/内存/队列)`);
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

  // 解析引用消息（如果存在）
  const messageReference = data.message_reference;
  let finalContent = content;

  if (messageReference?.message_id) {
    const referencedMsg = getReferencedMessage(messageReference.message_id);
    if (referencedMsg) {
      log('cyan', `   📎 检测到引用消息 (ID: ${messageReference.message_id})`);
      finalContent = buildContextWithReference(content, messageReference.message_id);
      log('cyan', `   📝 已合并引用上下文`);
    } else {
      log('yellow', `   ⚠️ 引用消息未找到或已过期 (ID: ${messageReference.message_id})`);
    }
  }

  // 保存当前消息到历史缓存（用于后续引用）
  saveMessageHistory({
    msgId: msgId,
    openid: authorId,
    content: content,
    role: 'user',
  });

  log('green', `\n📬 收到${type === 'private' ? '私聊' : '群聊'}消息！`);
  log('cyan', `   发送者: ${authorId} (${authorNickname || '未知昵称'})`);
  log('cyan', `   内容: ${content}`);
  if (messageReference?.message_id) {
    log('cyan', `   引用: 是`);
  }

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

  // ============ Hook 缓存命令处理 ============
  const trimmedContent = content.trim();

  // 设置 Hook 压缩阈值
  const setThresholdMatch = trimmedContent.match(/^设置hook压缩阈值\s+(\d+)$/);
  if (setThresholdMatch) {
    const threshold = parseInt(setThresholdMatch[1], 10);
    HOOK_MESSAGE_CONFIG.compressThreshold = threshold;

    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);
    const replyMsg = `✅ Hook 压缩阈值已设置为 ${threshold} 字节\n\n合并后超过此阈值的消息将调用 Claude 压缩。`;

    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ Hook 压缩阈值已设置为 ${threshold} 字节`);
    return;
  }

  // ============ Hook 推送开关命令处理 ============
  if (trimmedContent === 'hook on' || trimmedContent === 'hook off' || trimmedContent === 'hook status') {
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);
    let replyMsg = '';

    if (trimmedContent === 'hook on') {
      setHookNotifyEnabled(true);
      replyMsg = `✅ Hook 消息推送已开启\n\n所有 Hook 消息将正常推送到 QQ。`;
      log('green', `   ✅ Hook 消息推送已开启`);
    } else if (trimmedContent === 'hook off') {
      setHookNotifyEnabled(false);
      replyMsg = `🔕 Hook 消息推送已关闭\n\nHook 消息将不再推送到 QQ，但会继续在后台处理。\n\n💡 使用 "hook on" 可重新开启。`;
      log('yellow', `   🔕 Hook 消息推送已关闭`);
    } else if (trimmedContent === 'hook status') {
      const enabled = getHookNotifyEnabled();
      const status = getHookCacheStatus();
      replyMsg = `📋 Hook 推送状态\n`;
      replyMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      replyMsg += `全局开关: ${enabled ? '✅ 已开启' : '🔕 已关闭'}\n`;
      replyMsg += `当前缓存: ${status.totalCachedMessages} 条 (${status.cachedUsers} 个用户)\n`;
      replyMsg += `\n💡 命令:\n`;
      replyMsg += `• "hook on" - 开启推送\n`;
      replyMsg += `• "hook off" - 关闭推送`;
      log('cyan', `   📋 Hook 推送状态: ${enabled ? '已开启' : '已关闭'}`);
    }

    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    return;
  }

  // 查看 Hook 缓存状态
  if (trimmedContent === '查看hook缓存') {
    const status = getHookCacheStatus();
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);

    let replyMsg = `📋 Hook 消息状态\n`;
    replyMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
    replyMsg += `模式: ${status.mode}\n`;
    replyMsg += `超时: ${status.config.batchTimeoutMs / 1000} 秒\n`;
    replyMsg += `压缩阈值: ${status.config.compressThreshold} 字节\n`;
    replyMsg += `压缩后大小: ${status.config.compressedMaxSize} 字节\n`;
    replyMsg += `当前缓存: ${status.totalCachedMessages} 条 (${status.cachedUsers} 个用户)\n`;

    if (status.cacheDetails.length > 0) {
      replyMsg += `\n缓存详情:\n`;
      for (const detail of status.cacheDetails) {
        replyMsg += `  • ${detail.openid}: ${detail.messageCount} 条 (等待 ${detail.waitSeconds}s)\n`;
      }
    }

    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已返回 Hook 缓存状态`);
    return;
  }

  // ============ 授权管理命令处理 ============

  // 快捷授权关键词 - 一键授权全部权限
  const quickAuthKeywords = {
    '授权全部': { type: 'mcpTools', resource: '*', label: '全部 MCP 工具' },
    '全部授权': { type: 'mcpTools', resource: '*', label: '全部 MCP 工具' },
    '授权mcp': { type: 'mcpTools', resource: '*', label: '全部 MCP 工具' },
    '授权工具': { type: 'mcpTools', resource: '*', label: '全部 MCP 工具' },
    '允许全部': { type: 'mcpTools', resource: '*', label: '全部 MCP 工具' },
    '允许mcp': { type: 'mcpTools', resource: '*', label: '全部 MCP 工具' },
    'mcp授权': { type: 'mcpTools', resource: '*', label: '全部 MCP 工具' },
  };

  if (quickAuthKeywords[trimmedContent]) {
    const auth = quickAuthKeywords[trimmedContent];
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);

    const result = authorizeUser({
      openid: authorId,
      authType: auth.type,
      resource: auth.resource,
      nickname: authorNickname,
    });

    // 构建授权成功消息，    let replyMsg = `✅ 授权成功\n\n`;
    replyMsg += `已授权: ${auth.label}\n\n`;

    // 显示过期时间
    const timeoutSettings = getUserTimeoutSettings(authorId);
    if (result.expiresAt === 0) {
      replyMsg += `⏰ 有效期: 永久有效\n`;
    } else {
      const expiresDate = new Date(result.expiresAt);
      replyMsg += `⏰ 有效期至: ${expiresDate.toLocaleString('zh-CN')}\n`;
      const hoursLeft = Math.round((result.expiresAt - Date.now()) / (60 * 60 * 1000));
      if (hoursLeft > 0) {
        replyMsg += `   (剩余 ${hoursLeft} 小时)\n`;
      }
    }
    replyMsg += `\n💡 设置超时: 发送 "设置授权超时 48" (小时)\n`;
    replyMsg += `现在可以使用所有功能了！`;

    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 快捷授权: ${auth.label}, 超时: ${result.timeoutHours}h`);
    return;
  }

  // 查看授权状态
  if (trimmedContent === '查看授权' || trimmedContent === '我的授权' || trimmedContent === '授权状态') {
    const userAuth = getUserAuthorization(authorId);
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);
    const timeoutSettings = getUserTimeoutSettings(authorId);

    let replyMsg = `📋 授权状态\n`;
    replyMsg += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (!userAuth) {
      replyMsg += `状态: ❌ 未授权\n`;
      replyMsg += `\n⚡ 快捷授权 (推荐):\n`;
      replyMsg += `• 发送 "授权全部" 或 "授权mcp"\n`;
      replyMsg += `\n📝 详细说明: 发送 "help auth"`;
    } else {
      replyMsg += `授权时间: ${new Date(userAuth.authorizedAt).toLocaleString('zh-CN')}\n`;
      replyMsg += `最后更新: ${new Date(userAuth.lastAuthorizedAt).toLocaleString('zh-CN')}\n`;
      replyMsg += `超时设置: ${timeoutSettings.authTimeoutHours} 小时\n\n`;

      const mcpTools = userAuth.authorizations?.mcpTools || [];
      const filePaths = userAuth.authorizations?.filePaths || [];
      const networkDomains = userAuth.authorizations?.networkDomains || [];
      const now = Date.now();

      // 显示 MCP 工具授权及过期状态
      replyMsg += `MCP 工具 (${mcpTools.length}):\n`;
      if (mcpTools.length === 0) {
        replyMsg += `  无\n`;
      } else {
        for (const item of mcpTools.slice(0, 5)) {
          const tool = typeof item === 'string' ? item : item.resource;
          const expiresAt = typeof item === 'object' ? item.expiresAt : null;
          let statusIcon = '✅';
          let expireInfo = '';

          if (expiresAt !== null && expiresAt !== 0) {
            if (now >= expiresAt) {
              statusIcon = '❌';
              expireInfo = ' (已过期)';
            } else {
              const hoursLeft = Math.round((expiresAt - now) / (60 * 60 * 1000));
              if (hoursLeft <= 1) {
                statusIcon = '⚠️';
                expireInfo = ` (剩余 ${Math.round((expiresAt - now) / (60 * 1000))} 分钟)`;
              }
            }
          }

          replyMsg += `  ${statusIcon} ${tool}${expireInfo}\n`;
        }
        if (mcpTools.length > 5) {
          replyMsg += `  ... 还有 ${mcpTools.length - 5} 个\n`;
        }
      }

      replyMsg += `\n文件路径 (${filePaths.length}):\n`;
      if (filePaths.length === 0) {
        replyMsg += `  无\n`;
      } else {
        for (const path of filePaths.slice(0, 3)) {
          replyMsg += `  • ${path}\n`;
        }
        if (filePaths.length > 3) {
          replyMsg += `  ... 还有 ${filePaths.length - 3} 个\n`;
        }
      }

      replyMsg += `\n💡 设置超时: 发送 "设置授权超时 小时数"\n`;
      replyMsg += `   当前设置: ${timeoutSettings.authTimeoutHours} 小时\n`;
    }

    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已返回授权状态`);
    return;
  }

  // 设置授权超时
  const setTimeoutMatch = trimmedContent.match(/^设置授权超时\s*(\d+)(?:\s*小时)?$/);
  if (setTimeoutMatch) {
    const hours = parseInt(setTimeoutMatch[1]);
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);

    if (isNaN(hours) || hours < 0) {
      const replyMsg = `❌ 无效的超时时间\n\n请输入正整数，例如: 设置授权超时 48`;
      await sendMessageSmart(token, authorId, replyMsg, usageInfo);
      return;
    }

    setUserTimeoutSettings(authorId, { authTimeoutHours: hours });
    const timeoutSettings = getUserTimeoutSettings(authorId);

    let replyMsg = `✅ 授权超时设置已更新\n\n`;
    replyMsg += `新授权有效期: ${hours} 小时\n`;
    if (hours === 0) {
      replyMsg += `(永不过期)\n`;
    } else {
      replyMsg += `(约 ${hours / 24} 天)\n`;
    }
    replyMsg += `\n💡 此设置将应用于后续的新授权\n`;
    replyMsg += `如需刷新现有授权，请重新发送授权命令`;

    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已设置授权超时: ${hours} 小时`);
    return;
  }

  // 授权工具
  const authToolMatch = trimmedContent.match(/^授权工具[:：]\s*(.+)$/);
  if (authToolMatch) {
    const resource = authToolMatch[1].trim();
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);

    authorizeUser({
      openid: authorId,
      authType: 'mcpTools',
      resource: resource,
      nickname: authorNickname,
    });

    const replyMsg = `✅ 工具授权成功\n\n已授权: ${resource}\n\n现在可以使用该工具进行操作。`;
    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已授权工具: ${resource}`);
    return;
  }

  // 授权文件路径
  const authPathMatch = trimmedContent.match(/^授权路径[:：]\s*(.+)$/);
  if (authPathMatch) {
    const resource = authPathMatch[1].trim();
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);

    authorizeUser({
      openid: authorId,
      authType: 'filePaths',
      resource: resource,
      nickname: authorNickname,
    });

    const replyMsg = `✅ 路径授权成功\n\n已授权: ${resource}\n\n现在可以访问该路径下的文件。`;
    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已授权路径: ${resource}`);
    return;
  }

  // 设置 headless 配置
  const setConfigMatch = trimmedContent.match(/^设置配置[:：]\s*(\w+)[=：]\s*(.+)$/);
  if (setConfigMatch) {
    const key = setConfigMatch[1].trim();
    const value = setConfigMatch[2].trim();
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);

    // 解析值
    let parsedValue = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(value) && value !== '') parsedValue = Number(value);
    else if (value.startsWith('[') && value.endsWith(']')) {
      try {
        parsedValue = JSON.parse(value);
      } catch (e) {
        // 保持原值
      }
    }

    const newConfig = { [key]: parsedValue };
    getOrSetHeadlessConfig(authorId, newConfig);

    const replyMsg = `✅ 配置已更新\n\n${key} = ${JSON.stringify(parsedValue)}`;
    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已更新配置: ${key} = ${JSON.stringify(parsedValue)}`);
    return;
  }

  // 重置配置
  if (trimmedContent === '重置配置') {
    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);

    resetHeadlessConfig(authorId);

    const replyMsg = `✅ 配置已重置为默认值\n\n模型: claude-sonnet-4-6\n工具: Read, Grep, Glob, Bash`;
    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已重置配置`);
    return;
  }

  // ============ 扩展 status 命令 ============
  if (trimmedContent === 'status' || trimmedContent === '状态') {
    const gatewayState = loadGatewayState();
    const hookConfig = HOOK_MESSAGE_CONFIG;
    const hookCacheStatus = getHookCacheStatus();
    const authStats = getAuthorizationStats();

    let replyMsg = `📋 籋关配置状态\n`;
    replyMsg += `━━━━━━━━━━━━━━━━━━━━\n`;

    // 1. 运行时配置
    replyMsg += `🔧 运行时:\n`;
    replyMsg += `  模式: ${gatewayState.mode}\n`;
    replyMsg += `  PID: ${gatewayState.pid || process.pid}\n`;
    if (gatewayState.startedAt) {
      replyMsg += `  运行时间: ${formatUptime(Date.now() - gatewayState.startedAt)}\n`;
    }

    // 2. Hook 推送配置
    replyMsg += `\n📬 Hook 推送:\n`;
    const hookEnabled = getHookNotifyEnabled();
    replyMsg += `  全局开关: ${hookEnabled ? '✅ 开启' : '🔕 关闭'}\n`;
    replyMsg += `  批量超时: ${hookConfig.batchTimeoutMs}ms\n`;
    replyMsg += `  最大等待: ${hookConfig.maxBatchWaitMs}ms\n`;
    replyMsg += `  压缩阈值: ${hookConfig.compressThreshold}字节\n`;
    replyMsg += `  压缩超时: ${hookConfig.compressTimeoutMs}ms\n`;

    // 3. 消息缓存状态
    replyMsg += `\n📦 消息缓存:\n`;
    replyMsg += `  缓存消息: ${hookCacheStatus.totalCachedMessages} 条\n`;
    replyMsg += `  缓存用户: ${hookCacheStatus.cachedUsers} 个\n`;
    replyMsg += `  压缩后上限: ${hookCacheStatus.config.compressedMaxSize}字节\n`;

    // 4. Channel 模式配置
    replyMsg += `\n📡 Channel 模式:\n`;
    replyMsg += `  启用: ${gatewayState.channel?.enabled ? '✅' : '❌'}\n`;
    replyMsg += `  模式: ${gatewayState.channel?.mode || '无'}\n`;
    replyMsg += `  已注册: ${channelRegistry.size} 个\n`;

    // 5. 授权管理概览
    replyMsg += `\n🔐 授权管理:\n`;
    replyMsg += `  已授权用户: ${authStats.totalUsers} 人\n`;
    replyMsg += `  MCP 工具授权: ${authStats.mcpToolUsers} 人\n`;
    replyMsg += `  文件路径授权: ${authStats.filePathUsers} 人\n`;
    replyMsg += `  白名单: ${gatewayState.authorization?.whitelist?.length || 0} 人\n`;

    // 提示
    replyMsg += `\n💡 发送 "help <配置项>" 查看详细说明`;
    replyMsg += `\n   可用: help hook, help cache, help channel, help auth`;

    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);
    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已返回扩展状态`);
    return;
  }

  // ============ help 命令 ============
  const helpMatch = trimmedContent.match(/^help\s*(.*)$/i);
  if (helpMatch) {
    const topic = helpMatch[1].toLowerCase().trim();
    let replyMsg = '';

    if (!topic || topic === 'all') {
      // 总览
      replyMsg = `📖 QQ Bot 网关帮助\n`;
      replyMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      replyMsg += `⚡ 快捷授权:\n`;
      replyMsg += `  授权全部  授权mcp  允许全部\n\n`;
      replyMsg += `📋 命令列表:\n`;
      replyMsg += `  status - 查看状态和配置\n`;
      replyMsg += `  hook on/off/status - Hook 开关控制\n`;
      replyMsg += `  查看hook缓存 - 查看缓存详情\n`;
      replyMsg += `  查看授权 - 查看授权状态\n`;
      replyMsg += `  查看channel - 查看活跃会话\n`;
      replyMsg += `\n📚 配置说明:\n`;
      replyMsg += `  help hook - Hook 推送配置\n`;
      replyMsg += `  help channel - Channel 模式\n`;
      replyMsg += `  help cache - 消息缓存\n`;
      replyMsg += `  help auth - 授权管理\n`;
      replyMsg += `  help compress - 消息压缩\n`;

    } else if (topic === 'hook') {
      replyMsg = `📖 Hook 推送配置\n`;
      replyMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      replyMsg += `Hook 消息是 Claude Code 触发事件时推送到 QQ 的通知。\n\n`;
      replyMsg += `🔧 配置项:\n`;
      replyMsg += `  • 全局开关: hook on/off\n`;
      replyMsg += `  • 批量超时: 多少毫秒后合并发送\n`;
      replyMsg += `  • 压缩阈值: 超过多少字节启动压缩\n`;
      replyMsg += `  • 压缩超时: 压缩操作最长等待时间\n\n`;
      replyMsg += `💡 示例:\n`;
      replyMsg += `  hook off - 临时关闭推送\n`;
      replyMsg += `  hook status - 查看当前状态`;

    } else if (topic === 'channel') {
      replyMsg = `📖 Channel 模式\n`;
      replyMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      replyMsg += `Channel 模式允许多个 Claude Code 会话同时接收 QQ 消息。\n\n`;
      replyMsg += `📡 工作原理:\n`;
      replyMsg += `  1. MCP Server 启动时注册到 Gateway\n`;
      replyMsg += `  2. Gateway 路由消息到对应 Channel\n`;
      replyMsg += `  3. 每个 Channel 独立处理消息\n\n`;
      replyMsg += `💬 消息前缀:\n`;
      replyMsg += `  发送 [项目名] 消息 可指定目标 Channel\n`;
      replyMsg += `  回复消息自动添加 [sessionId] 前缀\n\n`;
      replyMsg += `💡 启动方式:\n`;
      replyMsg += `  /qqbot-service start --mode auto --channel gateway-bridge`;

    } else if (topic === 'cache' || topic === 'compress') {
      replyMsg = `📖 消息缓存与压缩\n`;
      replyMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      replyMsg += `Hook 消息支持自动缓存和压缩，避免发送过长内容。\n\n`;
      replyMsg += `📦 缓存机制:\n`;
      replyMsg += `  • 多条消息自动合并\n`;
      replyMsg += `  • 超过批量超时后发送\n`;
      replyMsg += `  • 最大等待时间限制\n\n`;
      replyMsg += `🗜️ 压缩流程:\n`;
      replyMsg += `  1. 超过阈值启动 Claude headless 压缩\n`;
      replyMsg += `  2. 压缩失败时发送简化版本\n`;
      replyMsg += `  3. 压缩超时自动降级\n\n`;
      replyMsg += `⚙️ 配置:\n`;
      replyMsg += `  默认压缩阈值: 300 字节\n`;
      replyMsg += `  默认压缩超时: 30000ms`;

    } else if (topic === 'auth' || topic === 'authorization') {
      replyMsg = `📖 授权管理 - 完整指南\n`;
      replyMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      replyMsg += `授权允许 Claude 在你的项目中执行操作。\n\n`;
      replyMsg += `⚡ 快捷授权 (推荐):\n`;
      replyMsg += `┌─────────────────────────────┐\n`;
      replyMsg += `│  发送以下任一关键词即可授权  │\n`;
      replyMsg += `├─────────────────────────────┤\n`;
      replyMsg += `│  授权全部  授权mcp  允许全部 │\n`;
      replyMsg += `│  全部授权  允许mcp  授权工具 │\n`;
      replyMsg += `└─────────────────────────────┘\n\n`;
      replyMsg += `🔐 授权范围说明:\n`;
      replyMsg += `┌─────────────────────────────────────┐\n`;
      replyMsg += `│ MCP 工具 (*)                        │\n`;
      replyMsg += `│  • 读取文件 (Read)                  │\n`;
      replyMsg += `│  • 搜索代码 (Grep/Glob)             │\n`;
      replyMsg += `│  • 执行命令 (Bash)                  │\n`;
      replyMsg += `│  • 编辑文件 (Edit/Write)            │\n`;
      replyMsg += `│  • 所有 MCP 扩展工具                │\n`;
      replyMsg += `├─────────────────────────────────────┤\n`;
      replyMsg += `│ 文件路径 (/path/*)                  │\n`;
      replyMsg += `│  • 允许访问指定目录下的文件         │\n`;
      replyMsg += `│  • 使用通配符 * 匹配所有子目录      │\n`;
      replyMsg += `└─────────────────────────────────────┘\n\n`;
      replyMsg += `📝 详细命令:\n`;
      replyMsg += `  授权工具: *           - 全部工具\n`;
      replyMsg += `  授权工具: mcp:*       - 全部 MCP 工具\n`;
      replyMsg += `  授权路径: /home/user  - 指定目录\n`;
      replyMsg += `  授权路径: /*          - 全部目录\n\n`;
      replyMsg += `🔍 查询命令:\n`;
      replyMsg += `  查看授权  我的授权  授权状态\n\n`;
      replyMsg += `💡 首次使用建议直接发送 "授权全部"`;

    } else {
      replyMsg = `❌ 未找到 "${topic}" 的帮助\n\n`;
      replyMsg += `💡 可用主题: hook, channel, cache, auth, compress`;
    }

    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);
    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已返回帮助信息: ${topic || 'all'}`);
    return;
  }

  // ============ 查看channel 命令 ============
  if (content === '查看channel' || content === '查看session' || content === 'channel列表') {
    let replyMsg = `📡 已注册的 Channel:\n`;
    replyMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (channelRegistry.size === 0) {
      replyMsg += `暂无活跃的 Channel\n\n`;
      replyMsg += `💡 请在 Claude Code 中启动 MCP Server 以注册 Channel`;
    } else {
      for (const [sessionId, info] of channelRegistry) {
        const displayName = info.displayName || info.projectName || sessionId;
        replyMsg += `🔹 ${displayName}\n`;
        replyMsg += `   sessionId: ${sessionId}\n`;
        replyMsg += `   项目: ${info.projectName || '未知'}\n`;
        replyMsg += `   路径: ${info.projectPath || '未知'}\n`;
        replyMsg += `   ${info.isDefault ? '✅ 默认' : ''}\n`;
        replyMsg += `   鲜活: ${Date.now() - info.lastActive < 60000 ? '✅' : '⚠️ 超时未活跃'}\n\n`;
      }
      replyMsg += `\n💬 使用方式:\n`;
      replyMsg += `  发送 [sessionId] 消息内容 可指定目标 Channel\n`;
      if (defaultChannelId) {
        replyMsg += `  无前缀消息将发送到默认 Channel\n`;
      }
    }

    const token = await getAccessToken();
    const usageInfo = incrementMsgIdUsage(authorId);
    await sendMessageSmart(token, authorId, replyMsg, usageInfo);
    log('green', `   ✅ 已返回 Channel 刁表信息`);
    return;
  }

  // 解析消息
  const parsed = parseMessage(content);
  log('cyan', `   解析结果: 项目=${parsed.projectName || '默认'}, cwd=${parsed.cwd || '无'}`);

  // ============ Channel 模式优先（互斥原则） ============
  // 检查是否有注册的 Channel，如果有则路由到 Channel，否则使用 Headless/Notify 模式
  if (hasActiveChannels()) {
    // Channel 模式：路由消息到对应的 Channel 队列
    const { targetSessionId, cleanContent } = resolveChannel(finalContent);

    if (targetSessionId) {
      addMessageToChannelQueue(targetSessionId, {
        sourceType: type,
        sourceId: type === 'group' ? groupId : authorId,
        authorId,
        authorNickname,
        content: cleanContent,
        msgId,
        messageReference,
      });

      const channelInfo = channelRegistry.get(targetSessionId);
      log('green', `   📨 消息已路由到 Channel: ${targetSessionId} (${channelInfo?.projectName || '未知项目'})`);
      log('cyan', `   📊 Channel 队列: ${channelQueues.get(targetSessionId)?.length || 0} 条待处理`);

      // 只有多 Channel 时才发送确认消息（避免噪音）
      if (channelRegistry.size > 1) {
        const token = await getAccessToken();
        const usageInfo = incrementMsgIdUsage(authorId);
        const channelDisplayName = channelInfo?.displayName || channelInfo?.projectName || targetSessionId;
        await sendMessageSmart(token, authorId, `✅ 消息已推送到 Channel: ${channelDisplayName}`, usageInfo);
      }

      return; // Channel 模式处理完成，不再走 Headless 流程
    } else {
      // 无可用 Channel
      // 检查是否配置了 Channel 模式（通过 gateway-state.json）
      const gatewayState = loadGatewayState();
      const channelConfigured = gatewayState?.channel?.enabled;

      if (channelConfigured) {
        // Channel 模式已配置，不回退到 Headless，发送提示
        log('yellow', `   ⚠️ Channel 模式已启用但无活跃会话`);
        const token = await getAccessToken();
        const usageInfo = incrementMsgIdUsage(authorId);
        await sendMessageSmart(token, authorId,
          `⚠️ 当前没有活跃的 Channel 会话\n\n请在 Claude Code 中启动 MCP Server 以接收消息。`,
          usageInfo);
        return; // 不回退到 Headless
      }

      log('yellow', `   ⚠️ 无可用 Channel，回退到 Headless 模式`);
      // 继续执行下面的 Headless/Notify 逻辑
    }
  }

  // ============ Headless/Notify 模式（无活跃 Channel 时） ============
  if (mode === 'notify') {
    // 通知模式：只发送桌面通知
    log('yellow', '   📢 通知模式：发送桌面通知');
    await sendDesktopNotification(
      `QQ Bot ${type === 'private' ? '私聊' : '群聊'}`,
      `[${parsed.projectName || '默认'}] ${content.slice(0, 50)}`
    );
  } else if (mode === 'auto') {
    // 自动回复模式 - 使用队列系统
    const taskData = {
      projectName: parsed.projectName || '默认',
      cwd: parsed.cwd,
      authorId,
      msgId,
      content: finalContent,  // 使用合并后的内容（包含引用上下文）
      parsed,
    };
    enqueueTask(taskData);
    await startQueueProcessing();
  }
}

async function processWithClaude(parsed, authorId, msgId, originalContent) {
  const projectName = parsed.projectName;
  const cwd = parsed.cwd;

  if (!cwd) {
    log('yellow', '   ⚠️ 无法找到项目目录，跳过处理');
    return;
  }

  // 获取或创建用户的会话信息
  // isNew=true 表示首次对话，不使用 --resume
  const { sessionId, isNew } = await getOrCreateHeadlessSessionId(authorId);
  const sessionInfo = isNew ? '新会话' : `resume: ${sessionId.slice(0, 12)}...`;
  log('cyan', `   🤖 调用 Claude Code Headless (cwd: ${cwd}, ${sessionInfo})`);

  // 使用 parser 模块构建参数
  // 新会话不传 sessionId，让 Claude 创建；已建立会话使用 --resume
  const args = buildClaudeArgs(parsed, isNew ? null : sessionId);

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

        // 尝试从 stream-json 中提取内容和 session_id
        let extractedSessionId = null;
        try {
          const lines = stdout.split('\n').filter(l => l.trim());
          const contents = [];
          for (const line of lines) {
            const json = JSON.parse(line);

            // 提取 session_id (首次对话需要保存)
            if (json.session_id && !extractedSessionId) {
              extractedSessionId = json.session_id;
            }

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
          // 保存 session_id (如果是新会话且成功获取到)
          if (isNew && extractedSessionId) {
            updateHeadlessSessionId(authorId, extractedSessionId);
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
          const permissionGuide = `⚠️ 需要授权

${replyContent}

⚡ 快捷授权: 发送 "授权全部" 或 "授权mcp"`;


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

          // 保存机器人回复到历史缓存（用于后续引用）
          if (result.id) {
            saveMessageHistory({
              msgId: result.id,
              openid: authorId,
              content: replyContent,
              role: 'bot',
            });
          }
        } else {
          log('yellow', `   ⚠️ 回复发送失败: ${result?.error || JSON.stringify(result)}`);
        }
      } else {
        // 分类错误类型并提供针对性提示
        const errorInfo = classifyHeadlessError(code, stderr, stdout);

        // 详细记录失败原因
        log('yellow', `   ⚠️ 处理失败 (${errorInfo.type}): ${errorInfo.reason}`);
        if (stdout.trim()) {
          log('yellow', `   stdout: ${stdout.slice(0, 500)}`);
        } else {
          log('yellow', `   stdout: (空)`);
        }
        if (stderr.trim()) {
          log('yellow', `   stderr: ${stderr.slice(0, 500)}`);
        }

        // 使用智能发送错误回复（根据错误类型提供不同提示)
        const errorUsageInfo = incrementMsgIdUsage(authorId);
        const token = await getAccessToken();
        const errorResult = await sendMessageSmart(token, authorId, `[${projectName}] ${errorInfo.userMessage}`, errorUsageInfo);
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

  // 清除 Hook 批处理定时器
  stopHookBatchTimer();

  if (ws) {
    ws.close();
    ws = null;
  }

  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }

  // 重置网关激活状态
  setGatewayStatus('pending_activation');

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
 * 启动过期检查定时器（每 30 秒检查一次）
 */
function startExpirationChecker() {
  const CHECK_INTERVAL_MS = 30 * 1000; // 30 秒检查一次（更精准地捕捉提醒时间点）

  expirationCheckTimer = setInterval(async () => {
    if (!running) return;

    try {
      // 使用精准提醒逻辑
      const usersNeedingReminder = getUsersNeedingReminder();

      for (const { user, reminderPoint } of usersNeedingReminder) {
        log('yellow', `   ⏰ 用户 ${user.nickname || user.openid} 会话即将过期 (${reminderPoint} 分钟)`);

        // 使用智能发送发送过期提醒
        try {
          const reminder = `⚠️ 会话即将过期\n\n您的会话将在 ${reminderPoint} 分钟后过期，届时将无法接收通知消息。\n\n请发送任意消息保持激活状态。`;
          const token = await getAccessToken();
          const usageInfo = incrementMsgIdUsage(user.openid);
          const result = await sendMessageSmart(token, user.openid, reminder, usageInfo);

          if (result.success) {
            // 标记该时间点的提醒已发送
            markReminderSent(user.openid, reminderPoint);
            const methodText = result.method === 'passive' ? '被动回复' : '主动消息';
            log('green', `   ✅ 过期提醒已发送给 ${user.nickname || user.openid} [${methodText}] (${reminderPoint} 分钟)`);
          } else {
            log('yellow', `   ⚠️ 发送过期提醒失败: ${result.error}`);
          }
        } catch (err) {
          log('yellow', `   ⚠️ 发送过期提醒异常: ${err.message}`);
        }
      }

      // 清理过期用户
      cleanupExpiredUsers();

      // 检查并压缩过期消息
      await checkAndCompressExpiredMessages();

      // ===== 新增：授权过期检查与提醒 =====
      const globalConfig = getGlobalTimeoutConfig();
      if (globalConfig.enableExpiryReminder) {
        // 获取即将在 1 小时内过期的授权
        const expiringAuths = getExpiringAuthorizations(1);

        for (const auth of expiringAuths) {
          if (auth.status === 'expired') {
            // 已过期的授权
            log('yellow', `   ⚠️ 用户 ${auth.nickname || auth.openid} 的授权已过期: ${auth.authType}/${auth.resource}`);
          } else {
            // 即将过期的授权 - 发送提醒
            const minutesLeft = Math.round((auth.expiresAt - Date.now()) / (60 * 1000));
            log('yellow', `   ⏰ 用户 ${auth.nickname || auth.openid} 授权即将过期 (${minutesLeft} 分钟): ${auth.authType}/${auth.resource}`);

            try {
              const token = await getAccessToken();
              const usageInfo = incrementMsgIdUsage(auth.openid);
              const reminderMsg = `⚠️ 授权即将过期\n\n` +
                `您授权的「${auth.resource}」将在 ${minutesLeft} 分钟后过期。\n\n` +
                `过期后需要重新授权才能使用相关功能。\n\n` +
                `如需延长有效期，请发送:\n` +
                `• "授权全部" - 重新授权所有功能`;

              const result = await sendMessageSmart(token, auth.openid, reminderMsg, usageInfo);
              if (result.success) {
                log('green', `   ✅ 授权过期提醒已发送给 ${auth.nickname || auth.openid}`);
              }
            } catch (err) {
              log('yellow', `   ⚠️ 发送授权过期提醒异常: ${err.message}`);
            }
          }
        }

        // 清理已过期的授权
        const cleanedCount = cleanupExpiredAuthorizations();
        if (cleanedCount > 0) {
          log('cyan', `   🧹 已清理 ${cleanedCount} 个过期授权`);
        }
      }
    } catch (err) {
      log('red', `   ❌ 过期检查出错: ${err.message}`);
    }
  }, CHECK_INTERVAL_MS);

  log('cyan', `   ⏰ 过期检查定时器已启动 (间隔: ${CHECK_INTERVAL_MS / 1000} 秒, 提醒时间点: 5/3/1 分钟)`);
  log('cyan', `   🔐 授权过期提醒: ${getGlobalTimeoutConfig().enableExpiryReminder ? '已启用' : '已禁用'}`);
}

/**
 * 合并待发送消息（格式化）
 * @param {Array} messages - 待发送消息数组
 * @returns {string} 合并后的消息内容
 */
function mergePendingMessages(messages) {
  return messages
    .map((msg, i) => {
      const time = new Date(msg.createdAt).toLocaleTimeString('zh-CN');
      const source = msg.source === 'hook_notification' ? 'Hook' :
                     msg.source === 'startup_notification' ? '启动' :
                     msg.source === 'system_alert' ? '系统' : '消息';
      return `[${i + 1}] ${time} | ${source}\n${msg.content}`;
    })
    .join('\n\n');
}

/**
 * 处理待发送消息队列（合并压缩后发送）
 * @param {string} openid - 用户 openid
 * @param {string} msgId - 用于被动回复的 msg_id
 */
async function processPendingMessages(openid, msgId) {
  const pendingMessages = getPendingMessages(openid);

  if (pendingMessages.length === 0) {
    return;
  }

  const messageCount = pendingMessages.length;
  log('cyan', `   📤 开始处理 ${messageCount} 条待发送消息（合并压缩模式）...`);

  try {
    // 1. 合并所有消息
    const mergedContent = mergePendingMessages(pendingMessages);
    const mergedBytes = getByteLength(mergedContent);

    let finalContent;

    // 2. 判断是否需要压缩（复用 Hook 消息的压缩阈值）
    if (mergedBytes > HOOK_MESSAGE_CONFIG.compressThreshold) {
      log('cyan', `   📊 合并后 ${mergedBytes} 字节 > 阈值 ${HOOK_MESSAGE_CONFIG.compressThreshold}，调用 Claude 压缩...`);

      // 构建压缩提示词
      const compressPrompt = `请将以下 ${messageCount} 条待发送消息压缩成简洁摘要。

格式要求:
1. 使用中文
2. 按时间顺序，格式: "[时间] 摘要内容"
3. 保留重要信息（错误、警告、关键状态变更）
4. 删除冗余和重复信息
5. 总长度不超过 800 字

待压缩内容:
${mergedContent}`;

      try {
        const claudePath = process.env.CLAUDE_CODE_PATH || 'claude';
        const compressResult = await new Promise((resolve, reject) => {
          const child = spawn(claudePath, [
            '--print',
            '--allowedTools', 'none',
            compressPrompt
          ], {
            timeout: 60000,
            maxBuffer: 1024 * 1024,
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

        finalContent = `📋 积压消息摘要 (${messageCount} 条)\n\n${compressResult || '（压缩失败）'}`;
        log('green', `   ✅ 消息压缩完成`);
      } catch (compressErr) {
        log('yellow', `   ⚠️ 消息压缩失败: ${compressErr.message}，使用截断内容`);
        // 压缩失败时使用截断而非完整内容
        finalContent = `📋 积压消息摘要 (${messageCount} 条, 截断)\n\n${mergedContent.slice(0, HOOK_MESSAGE_CONFIG.pendingMaxSize)}...`;
      }
    } else {
      log('cyan', `   📊 合并后 ${mergedBytes} 字节 <= 阈值 ${HOOK_MESSAGE_CONFIG.compressThreshold}，无需压缩`);
      finalContent = `📋 积压消息合并 (${messageCount} 条)\n\n${mergedContent}`;
    }

    // 4. 强制截断：确保消息不超过最大限制
    const finalBytes = getByteLength(finalContent);
    if (finalBytes > HOOK_MESSAGE_CONFIG.pendingMaxSize) {
      log('yellow', `   ✂️ 消息过大 (${finalBytes} 字节)，截断至 ${HOOK_MESSAGE_CONFIG.pendingMaxSize} 字节`);
      finalContent = finalContent.slice(0, HOOK_MESSAGE_CONFIG.pendingMaxSize) + '\n\n... (内容已截断)';
    }

    // 3. 一次性发送合并后的消息
    const token = await getAccessToken();
    const usageInfo = msgId ? { canUse: true, msgId: msgId, remaining: null } : { canUse: false };
    const result = await sendMessageSmart(token, openid, finalContent, usageInfo);

    if (result.success) {
      // 发送成功，清空该用户的所有待发送消息
      for (const msg of pendingMessages) {
        removePendingMessage(msg.id);
      }

      const methodText = result.method === 'passive' ? '被动回复' : '主动消息';
      log('green', `   ✅ 积压消息已发送 [${methodText}]，共 ${messageCount} 条`);
    } else {
      log('red', `   ❌ 积压消息发送失败: ${result.error}，消息保留在队列中`);
    }
  } catch (err) {
    log('red', `   ❌ 处理待发送消息异常: ${err.message}`);
  }
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

    // 解析 --channel 参数
    const channelIndex = args.indexOf('--channel');
    const channelMode = channelIndex !== -1 ? args[channelIndex + 1] : null;

    startGateway(startMode, channelMode).catch(err => {
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
        // 清理状态文件
        if (fs.existsSync(GATEWAY_STATE_FILE)) {
          fs.unlinkSync(GATEWAY_STATE_FILE);
        }
        log('green', '✅ 网关已停止');
      } catch (e) {
        log('yellow', '⚠️ 进程不存在或已停止');
        fs.unlinkSync(PID_FILE);
        if (fs.existsSync(GATEWAY_STATE_FILE)) {
          fs.unlinkSync(GATEWAY_STATE_FILE);
        }
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
