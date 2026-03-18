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

// 常量配置
const MSG_ID_TTL_MS = 60 * 60 * 1000; // 1 小时
const MSG_ID_EXPIRING_THRESHOLD_MS = 10 * 60 * 1000; // 10 分钟
const MSG_ID_MAX_USAGE = 4; // 最多使用 4 次

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
 * @property {'startup_notification' | 'system_alert' | 'user_message'} source - 消息来源
 * @property {number} createdAt - 创建时间
 * @property {number} priority - 优先级（数字越小优先级越高）
 */

/**
 * 激活状态
 * @typedef {Object} ActivationState
 * @property {GatewayStatus} gatewayStatus - 网关状态
 * @property {Object.<string, UserActivation>} users - 用户激活信息（按 openid 索引）
 * @property {PendingMessage[]} pendingMessages - 待发送消息队列
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

// ============ 待发送消息队列 ============

/**
 * 添加待发送消息
 * @param {Object} options
 * @param {string} options.targetOpenid - 目标用户 openid
 * @param {string} options.content - 消息内容
 * @param {'startup_notification' | 'system_alert' | 'user_message'} [options.source='user_message'] - 消息来源
 * @param {number} [options.priority=10] - 优先级
 * @returns {PendingMessage} 添加的消息
 */
export function addPendingMessage({ targetOpenid, content, source = 'user_message', priority = 10 }) {
  const state = loadActivationState();

  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    targetOpenid,
    content,
    source,
    createdAt: Date.now(),
    priority,
  };

  state.pendingMessages.push(message);
  saveActivationState(state);

  console.log(`[activation-state] Pending message added: ${message.id} -> ${targetOpenid}`);
  return message;
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
  };
}

// 导出常量
export const CONSTANTS = {
  MSG_ID_TTL_MS,
  MSG_ID_EXPIRING_THRESHOLD_MS,
  MSG_ID_MAX_USAGE,
};
