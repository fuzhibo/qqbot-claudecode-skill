/**
 * QQ Bot 网关激活状态管理模块
 *
 * 管理用户激活状态，支持被动回复机制
 * - 用户发消息后获取 msg_id，进入激活状态
 * - msg_id 有效期 1 小时，最多使用 4 次
 * - 过期前 10 分钟进入 EXPIRING_SOON 状态
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 状态文件路径
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const ACTIVATION_STATE_FILE = path.join(GATEWAY_DIR, 'activation-state.json');
const FILE_CACHE_DIR = path.join(GATEWAY_DIR, 'file-cache');

// 常量配置
const MSG_ID_TTL_MS = 60 * 60 * 1000; // 1 小时
const MSG_ID_EXPIRING_THRESHOLD_MS = 10 * 60 * 1000; // 10 分钟
const MSG_ID_MAX_USAGE = 4; // 最多使用 4 次
const FILE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 文件缓存 24 小时过期

/**
 * 用户激活状态
 * @typedef {'active' | 'expiring_soon' | 'expired'} UserActivationStatus
 */

/**
 * 网关状态
 * @typedef {'pending_activation' | 'activated' | 'degraded'} GatewayStatus
 */

/**
 * 用户激活信息
 * @typedef {Object} UserActivation
 * @property {string} openid - 用户 openid
 * @property {'c2c' | 'group'} type - 消息类型
 * @property {UserActivationStatus} status - 激活状态
 * @property {string} lastMsgId - 用于被动回复的 msg_id
 * @property {number} lastMsgIdAt - msg_id 获取时间戳
 * @property {number} msgIdExpiresAt - msg_id 过期时间戳
 * @property {number} msgIdUsageCount - msg_id 使用次数
 * @property {string} [nickname] - 用户昵称
 * @property {number} activatedAt - 首次激活时间
 * @property {number} lastInteractionAt - 最后交互时间
 */

/**
 * 待发送消息
 * @typedef {Object} PendingMessage
 * @property {string} id - 消息 ID
 * @property {string} targetOpenid - 目标用户 openid
 * @property {string} content - 消息内容
 * @property {'startup_notification' | 'system_alert' | 'user_message' | 'hook_notification'} source - 消息来源
 * @property {number} createdAt - 创建时间
 * @property {number} priority - 优先级（数字越小优先级越高）
 * @property {number} [expiresAt] - 过期时间戳
 * @property {CachedFileAttachment} [attachment] - 附件信息（图片/文件等）
 */

/**
 * 缓存文件附件
 * @typedef {Object} CachedFileAttachment
 * @property {string} fileId - 文件 ID（用于索引）
 * @property {'image' | 'file' | 'audio' | 'video'} type - 文件类型
 * @property {string} filename - 原始文件名
 * @property {number} size - 文件大小（字节）
 * @property {string} [mimeType] - MIME 类型
 */

/**
 * 缓存文件索引条目
 * @typedef {Object} CachedFileIndex
 * @property {string} fileId - 文件 ID
 * @property {string} filepath - 文件路径（相对于缓存目录）
 * @property {'image' | 'file' | 'audio' | 'video'} type - 文件类型
 * @property {string} filename - 原始文件名
 * @property {number} size - 文件大小（字节）
 * @property {string} [mimeType] - MIME 类型
 * @property {number} createdAt - 创建时间
 * @property {number} expiresAt - 过期时间
 * @property {string} [openid] - 关联的用户 openid
 * @property {string} [messageId] - 关联的消息 ID
 */

/**
 * 激活状态
 * @typedef {Object} ActivationState
 * @property {GatewayStatus} gatewayStatus - 网关状态
 * @property {Object.<string, UserActivation>} users - 用户激活信息（按 openid 索引）
 * @property {PendingMessage[]} pendingMessages - 待发送消息队列
 * @property {Object.<string, CachedFileIndex>} cachedFiles - 缓存文件索引（按 fileId 索引）
 * @property {number} lastUpdatedAt - 最后更新时间
 */

// 内存缓存
let stateCache = null;

/**
 * 确保目录存在
 */
function ensureDir() {
  if (!fs.existsSync(GATEWAY_DIR)) {
    fs.mkdirSync(GATEWAY_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE_CACHE_DIR)) {
    fs.mkdirSync(FILE_CACHE_DIR, { recursive: true });
  }
}

/**
 * 从文件加载状态
 * @returns {ActivationState}
 */
export function loadActivationState() {
  if (stateCache !== null) {
    return stateCache;
  }

  try {
    if (fs.existsSync(ACTIVATION_STATE_FILE)) {
      const data = fs.readFileSync(ACTIVATION_STATE_FILE, 'utf-8');
      stateCache = JSON.parse(data);
      // 确保新字段存在
      if (!stateCache.cachedFiles) {
        stateCache.cachedFiles = {};
      }
      return stateCache;
    }
  } catch (err) {
    console.error(`[activation-state] Failed to load state: ${err.message}`);
  }

  // 返回默认状态
  stateCache = {
    gatewayStatus: 'pending_activation',
    users: {},
    pendingMessages: [],
    cachedFiles: {},
    lastUpdatedAt: Date.now(),
  };
  return stateCache;
}

/**
 * 保存状态到文件
 * @param {ActivationState} state
 */
export function saveActivationState(state) {
  ensureDir();
  state.lastUpdatedAt = Date.now();
  stateCache = state;

  try {
    fs.writeFileSync(ACTIVATION_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error(`[activation-state] Failed to save state: ${err.message}`);
  }
}

/**
 * 获取网关状态
 * @returns {GatewayStatus}
 */
export function getGatewayStatus() {
  const state = loadActivationState();
  return state.gatewayStatus;
}

/**
 * 设置网关状态
 * @param {GatewayStatus} status
 */
export function setGatewayStatus(status) {
  const state = loadActivationState();
  state.gatewayStatus = status;
  saveActivationState(state);
}

/**
 * 获取用户激活信息
 * @param {string} openid - 用户 openid
 * @returns {UserActivation | undefined}
 */
export function getUserActivation(openid) {
  const state = loadActivationState();
  return state.users[openid];
}

/**
 * 检查用户激活状态（考虑过期）
 * @param {string} openid - 用户 openid
 * @returns {UserActivationStatus}
 */
export function getUserActivationStatus(openid) {
  const user = getUserActivation(openid);
  if (!user) {
    return 'expired';
  }

  const now = Date.now();
  const timeUntilExpiry = user.msgIdExpiresAt - now;

  if (timeUntilExpiry <= 0) {
    return 'expired';
  } else if (timeUntilExpiry <= MSG_ID_EXPIRING_THRESHOLD_MS) {
    return 'expiring_soon';
  } else {
    return 'active';
  }
}

/**
 * 更新用户激活状态（收到用户消息时调用）
 * @param {Object} options
 * @param {string} options.openid - 用户 openid
 * @param {string} options.msgId - 消息 ID
 * @param {'c2c' | 'group'} [options.type='c2c'] - 消息类型
 * @param {string} [options.nickname] - 用户昵称
 * @returns {UserActivation} 更新后的用户激活信息
 */
export function updateUserActivation({ openid, msgId, type = 'c2c', nickname }) {
  const state = loadActivationState();
  const now = Date.now();

  const existingUser = state.users[openid];
  const user = {
    openid,
    type,
    status: 'active',
    lastMsgId: msgId,
    lastMsgIdAt: now,
    msgIdExpiresAt: now + MSG_ID_TTL_MS,
    msgIdUsageCount: 0, // 新的 msg_id，重置计数
    nickname: nickname || existingUser?.nickname,
    activatedAt: existingUser?.activatedAt || now,
    lastInteractionAt: now,
  };

  state.users[openid] = user;

  // 更新网关状态
  if (state.gatewayStatus === 'pending_activation') {
    state.gatewayStatus = 'activated';
  }

  saveActivationState(state);
  return user;
}

/**
 * 增加用户 msg_id 使用次数
 * @param {string} openid - 用户 openid
 * @returns {Object} { canUse: boolean, remaining: number, shouldFallback: boolean }
 */
export function incrementMsgIdUsage(openid) {
  const state = loadActivationState();
  const user = state.users[openid];

  if (!user) {
    return { canUse: false, remaining: 0, shouldFallback: true };
  }

  // 检查是否过期
  const now = Date.now();
  if (now >= user.msgIdExpiresAt) {
    user.status = 'expired';
    saveActivationState(state);
    return { canUse: false, remaining: 0, shouldFallback: true, reason: 'expired' };
  }

  // 检查使用次数
  if (user.msgIdUsageCount >= MSG_ID_MAX_USAGE) {
    return { canUse: false, remaining: 0, shouldFallback: true, reason: 'limit_exceeded' };
  }

  // 增加使用次数
  user.msgIdUsageCount++;
  user.lastInteractionAt = now;

  // 更新状态
  const timeUntilExpiry = user.msgIdExpiresAt - now;
  if (timeUntilExpiry <= MSG_ID_EXPIRING_THRESHOLD_MS) {
    user.status = 'expiring_soon';
  }

  saveActivationState(state);

  return {
    canUse: true,
    remaining: MSG_ID_MAX_USAGE - user.msgIdUsageCount,
    shouldFallback: false,
    msgId: user.lastMsgId,
  };
}

/**
 * 检查是否有有效激活用户
 * @returns {boolean}
 */
export function hasActiveUsers() {
  const state = loadActivationState();
  const now = Date.now();

  for (const user of Object.values(state.users)) {
    if (now < user.msgIdExpiresAt) {
      return true;
    }
  }

  return false;
}

/**
 * 获取所有激活用户
 * @returns {UserActivation[]}
 */
export function getActiveUsers() {
  const state = loadActivationState();
  const now = Date.now();
  const users = [];

  for (const user of Object.values(state.users)) {
    if (now < user.msgIdExpiresAt) {
      users.push(user);
    }
  }

  return users;
}

/**
 * 获取即将过期的用户
 * @returns {UserActivation[]}
 */
export function getExpiringUsers() {
  const state = loadActivationState();
  const now = Date.now();
  const users = [];

  for (const user of Object.values(state.users)) {
    const timeUntilExpiry = user.msgIdExpiresAt - now;
    if (timeUntilExpiry > 0 && timeUntilExpiry <= MSG_ID_EXPIRING_THRESHOLD_MS) {
      users.push(user);
    }
  }

  return users;
}

// ============ 嶈息超时和压缩 ============
// 消息过期时间 (默认 24 小时)
const MESSAGE_EXPIRY_MS = 24 * 60 * 60 * 1000;
// 消息压缩后保留时间 (默认 7 天)
const COMPRESSED_RETAIN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 添加待发送消息 (支持超时)
 * @param {Object} options
 * @param {string} options.targetOpenid - 目标用户 openid
 * @param {string} options.content - 消息内容
 * @param {'startup_notification' | 'system_alert' | 'user_message' | 'hook_notification'} [options.source='user_message'] - 消息来源
 * @param {number} [options.priority=10] - 优先级
 * @param {number} [options.expiresAt] - 过期时间戳 (可选)
 * @returns {PendingMessage} 添加的消息
 */
export function addPendingMessage({ targetOpenid, content, source = 'user_message', priority = 10, expiresAt }) {
  const state = loadActivationState();

  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    targetOpenid,
    content,
    source,
    createdAt: Date.now(),
    priority,
    expiresAt: expiresAt || Date.now() + MESSAGE_EXPIRY_MS, // 默认 24 小时
  };

  state.pendingMessages.push(message);
  saveActivationState(state);

  console.log(`[activation-state] Pending message added: ${message.id} -> ${targetOpenid}`);
  return message;
}

/**
 * 获取过期消息
 * @param {string} [openid] - 可选，指定用户
 * @returns {PendingMessage[]}
 */
export function getExpiredMessages(openid) {
  const state = loadActivationState();
  const now = Date.now();
  return state.pendingMessages.filter(msg => {
    const isExpired = msg.expiresAt ? now >= msg.expiresAt : now - msg.createdAt >= MESSAGE_EXPIRY_MS;
    const matchesUser = openid ? msg.targetOpenid === openid : true;
    return isExpired && matchesUser;
  });
}

/**
 * 获取需要压缩的消息 (过期但未超过保留时间)
 * @param {string} [openid] - 可选，指定用户
 * @returns {PendingMessage[]}
 */
export function getCompressibleMessages(openid) {
  const state = loadActivationState();
  const now = Date.now();
  return state.pendingMessages.filter(msg => {
    const isExpired = msg.expiresAt ? now >= msg.expiresAt : now - msg.createdAt >= MESSAGE_EXPIRY_MS;
    const withinRetainPeriod = now - msg.createdAt < COMPRESSED_RETAIN_MS;
    const matchesUser = openid ? msg.targetOpenid === openid : true;
    return isExpired && withinRetainPeriod && matchesUser;
  });
}

/**
 * 替换用户的缓存消息
 * @param {string} openid - 用户 openid
 * @param {PendingMessage[]} newMessages - 新消息列表
 */
export function replacePendingMessages(openid, newMessages) {
  const state = loadActivationState();
  const before = state.pendingMessages.filter(msg => msg.targetOpenid === openid).length;
  state.pendingMessages = state.pendingMessages.filter(msg => msg.targetOpenid !== openid);
  for (const msg of newMessages) {
    state.pendingMessages.push(msg);
  }
  const after = state.pendingMessages.filter(msg => msg.targetOpenid === openid).length;
  saveActivationState(state);
  console.log(`[activation-state] Replaced ${before} -> ${after} messages for ${openid}`);
}

/**
 * 清除过期消息 (不保留)
 * @param {string} [openid] - 可选，指定用户
 * @returns {number} 清除数量
 */
export function clearExpiredMessages(openid) {
  const state = loadActivationState();
  const now = Date.now();
  const before = state.pendingMessages.length;
  state.pendingMessages = state.pendingMessages.filter(msg => {
    const isExpired = msg.expiresAt ? now >= msg.expiresAt : now - msg.createdAt >= MESSAGE_EXPIRY_MS;
    return !isExpired;
  });
  const after = state.pendingMessages.length;
  if (before !== after) {
    saveActivationState(state);
    console.log(`[activation-state] Cleared ${before - after} expired messages for ${openid || 'all users'}`);
  }
  return before - after;
}

/**
 * 获取用户的待发送消息
 * @param {string} openid - 用户 openid
 * @returns {PendingMessage[]}
 */
export function getPendingMessages(openid) {
  const state = loadActivationState();
  return state.pendingMessages
    .filter(msg => msg.targetOpenid === openid)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * 获取所有待发送消息
 * @returns {PendingMessage[]}
 */
export function getAllPendingMessages() {
  const state = loadActivationState();
  return [...state.pendingMessages].sort((a, b) => a.priority - b.priority);
}

/**
 * 移除待发送消息
 * @param {string} messageId - 消息 ID
 */
export function removePendingMessage(messageId) {
  const state = loadActivationState();
  const index = state.pendingMessages.findIndex(msg => msg.id === messageId);

  if (index !== -1) {
    state.pendingMessages.splice(index, 1);
    saveActivationState(state);
    console.log(`[activation-state] Pending message removed: ${messageId}`);
  }
}

/**
 * 清空用户的待发送消息
 * @param {string} openid - 用户 openid
 */
export function clearPendingMessages(openid) {
  const state = loadActivationState();
  const before = state.pendingMessages.length;
  state.pendingMessages = state.pendingMessages.filter(msg => msg.targetOpenid !== openid);
  const after = state.pendingMessages.length;

  if (before !== after) {
    saveActivationState(state);
    console.log(`[activation-state] Cleared ${before - after} pending messages for ${openid}`);
  }
}

/**
 * 获取待发送消息数量
 * @param {string} [openid] - 可选，指定用户
 * @returns {number}
 */
export function getPendingMessageCount(openid) {
  const state = loadActivationState();
  if (openid) {
    return state.pendingMessages.filter(msg => msg.targetOpenid === openid).length;
  }
  return state.pendingMessages.length;
}

// ============ 工具函数 ============

/**
 * 清除过期用户
 */
export function cleanupExpiredUsers() {
  const state = loadActivationState();
  const now = Date.now();
  let cleaned = 0;

  for (const [openid, user] of Object.entries(state.users)) {
    if (now >= user.msgIdExpiresAt) {
      delete state.users[openid];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    saveActivationState(state);
    console.log(`[activation-state] Cleaned up ${cleaned} expired users`);
  }

  return cleaned;
}

/**
 * 重置激活状态（用于测试或调试）
 */
export function resetActivationState() {
  stateCache = {
    gatewayStatus: 'pending_activation',
    users: {},
    pendingMessages: [],
    lastUpdatedAt: Date.now(),
  };
  saveActivationState(stateCache);
  console.log(`[activation-state] State reset`);
}

/**
 * 获取状态统计
 */
export function getActivationStats() {
  const state = loadActivationState();
  const now = Date.now();

  let activeCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;

  for (const user of Object.values(state.users)) {
    const timeUntilExpiry = user.msgIdExpiresAt - now;
    if (timeUntilExpiry <= 0) {
      expiredCount++;
    } else if (timeUntilExpiry <= MSG_ID_EXPIRING_THRESHOLD_MS) {
      expiringCount++;
    } else {
      activeCount++;
    }
  }

  return {
    gatewayStatus: state.gatewayStatus,
    totalUsers: Object.keys(state.users).length,
    activeUsers: activeCount,
    expiringUsers: expiringCount,
    expiredUsers: expiredCount,
    pendingMessages: state.pendingMessages.length,
    cachedFiles: Object.keys(state.cachedFiles || {}).length,
  };
}

// ============ 文件缓存管理 ============

/**
 * 保存文件到缓存
 * @param {Object} options
 * @param {Buffer} options.data - 文件数据
 * @param {string} options.filename - 原始文件名
 * @param {'image' | 'file' | 'audio' | 'video'} options.type - 文件类型
 * @param {number} options.size - 文件大小
 * @param {string} [options.mimeType] - MIME 类型
 * @param {string} [options.openid] - 关联的用户 openid
 * @param {string} [options.messageId] - 关联的消息 ID
 * @returns {CachedFileIndex} 缓存文件索引
 */
export function saveCachedFile({ data, filename, type, size, mimeType, openid, messageId }) {
  ensureDir();
  const state = loadActivationState();

  const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ext = path.extname(filename) || '';
  const storedFilename = `${fileId}${ext}`;
  const filepath = storedFilename;
  const fullPath = path.join(FILE_CACHE_DIR, storedFilename);

  // 写入文件
  fs.writeFileSync(fullPath, data);

  const now = Date.now();
  const fileIndex = {
    fileId,
    filepath,
    type,
    filename,
    size,
    mimeType,
    createdAt: now,
    expiresAt: now + FILE_EXPIRY_MS,
    openid,
    messageId,
  };

  state.cachedFiles[fileId] = fileIndex;
  saveActivationState(state);

  console.log(`[activation-state] File cached: ${fileId} (${type}, ${size} bytes)`);
  return fileIndex;
}

/**
 * 获取缓存文件信息
 * @param {string} fileId - 文件 ID
 * @returns {CachedFileIndex | undefined}
 */
export function getCachedFileInfo(fileId) {
  const state = loadActivationState();
  return state.cachedFiles[fileId];
}

/**
 * 获取缓存文件的完整路径
 * @param {string} fileId - 文件 ID
 * @returns {string | null} 文件完整路径，不存在则返回 null
 */
export function getCachedFilePath(fileId) {
  const state = loadActivationState();
  const fileInfo = state.cachedFiles[fileId];
  if (!fileInfo) {
    return null;
  }
  const fullPath = path.join(FILE_CACHE_DIR, fileInfo.filepath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fullPath;
}

/**
 * 读取缓存文件数据
 * @param {string} fileId - 文件 ID
 * @returns {Buffer | null} 文件数据，不存在则返回 null
 */
export function readCachedFile(fileId) {
  const filePath = getCachedFilePath(fileId);
  if (!filePath) {
    return null;
  }
  return fs.readFileSync(filePath);
}

/**
 * 移除缓存文件
 * @param {string} fileId - 文件 ID
 * @returns {boolean} 是否成功移除
 */
export function removeCachedFile(fileId) {
  const state = loadActivationState();
  const fileInfo = state.cachedFiles[fileId];

  if (!fileInfo) {
    return false;
  }

  // 删除物理文件
  const fullPath = path.join(FILE_CACHE_DIR, fileInfo.filepath);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`[activation-state] Failed to delete file ${fileId}: ${err.message}`);
  }

  // 从索引中移除
  delete state.cachedFiles[fileId];
  saveActivationState(state);

  console.log(`[activation-state] File removed: ${fileId}`);
  return true;
}

/**
 * 获取过期文件列表
 * @param {string} [openid] - 可选，指定用户
 * @returns {CachedFileIndex[]}
 */
export function getExpiredFiles(openid) {
  const state = loadActivationState();
  const now = Date.now();
  const files = [];

  for (const file of Object.values(state.cachedFiles)) {
    const isExpired = now >= file.expiresAt;
    const matchesUser = openid ? file.openid === openid : true;
    if (isExpired && matchesUser) {
      files.push(file);
    }
  }

  return files;
}

/**
 * 清理过期文件
 * @param {string} [openid] - 可选，指定用户
 * @returns {number} 清理数量
 */
export function cleanupExpiredFiles(openid) {
  const expiredFiles = getExpiredFiles(openid);
  let cleaned = 0;

  for (const file of expiredFiles) {
    if (removeCachedFile(file.fileId)) {
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[activation-state] Cleaned up ${cleaned} expired files`);
  }

  return cleaned;
}

/**
 * 获取用户的缓存文件列表
 * @param {string} openid - 用户 openid
 * @returns {CachedFileIndex[]}
 */
export function getUserCachedFiles(openid) {
  const state = loadActivationState();
  return Object.values(state.cachedFiles).filter(file => file.openid === openid);
}

/**
 * 获取缓存文件统计
 * @returns {Object}
 */
export function getCachedFilesStats() {
  const state = loadActivationState();
  const files = Object.values(state.cachedFiles);
  const now = Date.now();

  let totalSize = 0;
  let expiredCount = 0;
  let activeCount = 0;

  for (const file of files) {
    totalSize += file.size || 0;
    if (now >= file.expiresAt) {
      expiredCount++;
    } else {
      activeCount++;
    }
  }

  return {
    totalFiles: files.length,
    activeFiles: activeCount,
    expiredFiles: expiredCount,
    totalSize,
    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
  };
}

// 导出常量
export const CONSTANTS = {
  MSG_ID_TTL_MS,
  MSG_ID_EXPIRING_THRESHOLD_MS,
  MSG_ID_MAX_USAGE,
  FILE_EXPIRY_MS,
  FILE_CACHE_DIR,
};
