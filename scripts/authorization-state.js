/**
 * QQ Bot 授权状态管理模块
 *
 * 管理用户授权状态和 headless 模式参数持久化
 * - MCP 工具授权
 * - 文件访问授权
 * - 网络访问授权
 * - Headless 模式配置
 * - 授权超时与过期提醒
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 状态文件路径
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const AUTHORIZATION_STATE_FILE = path.join(GATEWAY_DIR, 'authorization-state.json');

// 默认授权超时时间（小时）
const DEFAULT_AUTH_TIMEOUT_HOURS = 24;

// 默认过期提醒时间（小时，即过期前多少小时提醒）
const DEFAULT_REMINDER_HOURS = 1;

// 永不过过期的标记
const NEVER_EXPIRE = 0;

/**
 * 授权详情（带过期时间）
 * @typedef {Object} AuthorizationEntry
 * @property {string} resource - 资源标识符
 * @property {number} authorizedAt - 授权时间
 * @property {number} expiresAt - 过期时间（0 表示永不过期）
 */

/**
 * 用户授权信息
 * @typedef {Object} UserAuthorization
 * @property {string} openid - 用户 openid
 * @property {number} authorizedAt - 首次授权时间
 * @property {number} lastAuthorizedAt - 最后授权时间
 * @property {string} [nickname] - 用户昵称
 * @property {Object} authorizations - 授权详情
 * @property {Array<string|AuthorizationEntry>} authorizations.mcpTools - 已授权的 MCP 工具
 * @property {Array<string|AuthorizationEntry>} authorizations.filePaths - 已授权的文件路径
 * @property {Array<string|AuthorizationEntry>} authorizations.networkDomains - 已授权的网络域名
 * @property {Object} headlessConfig - Headless 模式配置
 * @property {Object} [timeoutSettings] - 用户级超时设置
 * @property {number} [timeoutSettings.authTimeoutHours] - 授权超时时间（小时）
 * @property {number} [timeoutSettings.reminderHours] - 过期提醒时间（小时）
 */

/**
 * 全局配置
 * @typedef {Object} GlobalConfig
 * @property {number} defaultAuthTimeoutHours - 默认授权超时时间（小时）
 * @property {number} defaultReminderHours - 默认过期提醒时间（小时）
 * @property {boolean} enableExpiryReminder - 是否启用过期提醒
 */

/**
 * 授权状态
 * @typedef {Object} AuthorizationState
 * @property {Object.<string, UserAuthorization>} users - 用户授权信息（按 openid 索引）
 * @property {GlobalConfig} globalConfig - 全局配置
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
 * 获取默认全局配置
 * @returns {GlobalConfig}
 */
function getDefaultGlobalConfig() {
  return {
    defaultAuthTimeoutHours: DEFAULT_AUTH_TIMEOUT_HOURS,
    defaultReminderHours: DEFAULT_REMINDER_HOURS,
    enableExpiryReminder: true,
  };
}

/**
 * 从文件加载状态
 * @returns {AuthorizationState}
 */
export function loadAuthorizationState() {
  if (stateCache !== null) {
    return stateCache;
  }

  try {
    if (fs.existsSync(AUTHORIZATION_STATE_FILE)) {
      const data = fs.readFileSync(AUTHORIZATION_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(data);

      // 兼容旧格式：添加 globalConfig 如果不存在
      if (!parsed.globalConfig) {
        parsed.globalConfig = getDefaultGlobalConfig();
      }

      stateCache = parsed;
      return stateCache;
    }
  } catch (err) {
    console.error(`[authorization-state] Failed to load state: ${err.message}`);
  }

  // 返回默认状态
  stateCache = {
    users: {},
    globalConfig: getDefaultGlobalConfig(),
    lastUpdatedAt: Date.now(),
  };
  return stateCache;
}

/**
 * 保存状态到文件
 * @param {AuthorizationState} state
 */
export function saveAuthorizationState(state) {
  ensureDir();
  state.lastUpdatedAt = Date.now();
  stateCache = state;

  try {
    fs.writeFileSync(AUTHORIZATION_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error(`[authorization-state] Failed to save state: ${err.message}`);
  }
}

/**
 * 获取用户授权信息
 * @param {string} openid - 用户 openid
 * @returns {UserAuthorization | undefined}
 */
export function getUserAuthorization(openid) {
  const state = loadAuthorizationState();
  return state.users[openid];
}

/**
 * 获取用户的有效超时设置（合并用户级和全局配置）
 * @param {string} openid - 用户 openid
 * @returns {{ authTimeoutHours: number, reminderHours: number }}
 */
export function getUserTimeoutSettings(openid) {
  const state = loadAuthorizationState();
  const userAuth = state.users[openid];

  return {
    authTimeoutHours: userAuth?.timeoutSettings?.authTimeoutHours ?? state.globalConfig.defaultAuthTimeoutHours,
    reminderHours: userAuth?.timeoutSettings?.reminderHours ?? state.globalConfig.defaultReminderHours,
  };
}

/**
 * 设置用户级超时配置
 * @param {string} openid - 用户 openid
 * @param {{ authTimeoutHours?: number, reminderHours?: number }} settings - 超时设置
 * @returns {Object} 更新后的超时设置
 */
export function setUserTimeoutSettings(openid, settings) {
  const state = loadAuthorizationState();

  let userAuth = state.users[openid];
  if (!userAuth) {
    userAuth = {
      openid,
      authorizedAt: Date.now(),
      lastAuthorizedAt: Date.now(),
      authorizations: {
        mcpTools: [],
        filePaths: [],
        networkDomains: [],
      },
      headlessConfig: getDefaultHeadlessConfig(),
    };
    state.users[openid] = userAuth;
  }

  userAuth.timeoutSettings = {
    ...userAuth.timeoutSettings,
    ...settings,
  };

  saveAuthorizationState(state);
  console.log(`[authorization-state] User ${openid} timeout settings updated:`, userAuth.timeoutSettings);

  return getUserTimeoutSettings(openid);
}

/**
 * 设置全局超时配置
 * @param {{ defaultAuthTimeoutHours?: number, defaultReminderHours?: number, enableExpiryReminder?: boolean }} config - 全局配置
 * @returns {GlobalConfig} 更新后的全局配置
 */
export function setGlobalTimeoutConfig(config) {
  const state = loadAuthorizationState();

  state.globalConfig = {
    ...state.globalConfig,
    ...config,
  };

  saveAuthorizationState(state);
  console.log(`[authorization-state] Global timeout config updated:`, state.globalConfig);

  return state.globalConfig;
}

/**
 * 获取全局超时配置
 * @returns {GlobalConfig}
 */
export function getGlobalTimeoutConfig() {
  const state = loadAuthorizationState();
  return state.globalConfig;
}

/**
 * 将旧格式的授权项转换为新格式（带过期时间）
 * @param {Array<string|AuthorizationEntry>} authList - 授权列表
 * @param {number} timeoutHours - 超时小时数
 * @returns {AuthorizationEntry[]}
 */
function normalizeAuthEntries(authList, timeoutHours) {
  const now = Date.now();
  const expiresAt = timeoutHours > 0 ? now + timeoutHours * 60 * 60 * 1000 : NEVER_EXPIRE;

  return authList.map(item => {
    // 已经是新格式
    if (typeof item === 'object' && item.resource !== undefined) {
      return item;
    }
    // 旧格式：字符串
    return {
      resource: item,
      authorizedAt: now,
      expiresAt,
    };
  });
}

/**
 * 检查授权条目是否有效（未过期）
 * @param {AuthorizationEntry} entry - 授权条目
 * @returns {boolean}
 */
function isEntryValid(entry) {
  if (!entry || typeof entry !== 'object') {
    return true; // 旧格式字符串，视为有效
  }
  if (entry.expiresAt === NEVER_EXPIRE) {
    return true;
  }
  return Date.now() < entry.expiresAt;
}

/**
 * 检查用户是否已授权某项操作
 * @param {string} openid - 用户 openid
 * @param {'mcpTools' | 'filePaths' | 'networkDomains'} authType - 授权类型
 * @param {string} resource - 资源标识符（工具名/路径/域名）
 * @returns {{ authorized: boolean, expired: boolean, expiresAt?: number, reason?: string }}
 */
export function isAuthorized(openid, authType, resource) {
  const userAuth = getUserAuthorization(openid);
  if (!userAuth || !userAuth.authorizations) {
    return { authorized: false, expired: false, reason: 'no_user_auth' };
  }

  const authList = userAuth.authorizations[authType] || [];
  const now = Date.now();

  // 遍历授权列表
  for (const item of authList) {
    // 兼容旧格式（字符串）
    if (typeof item === 'string') {
      if (item === '*' || item === resource) {
        return { authorized: true, expired: false };
      }
      // 前缀匹配
      if (item.endsWith(':*') || item.endsWith('/*')) {
        const prefix = item.slice(0, -1);
        if (resource.startsWith(prefix)) {
          return { authorized: true, expired: false };
        }
      }
      continue;
    }

    // 新格式（对象）
    if (typeof item === 'object' && item.resource) {
      // 检查是否过期
      const isExpired = item.expiresAt !== NEVER_EXPIRE && now >= item.expiresAt;

      // 匹配检查
      let matches = false;
      if (item.resource === '*' || item.resource === resource) {
        matches = true;
      } else if (item.resource.endsWith(':*') || item.resource.endsWith('/*')) {
        const prefix = item.resource.slice(0, -1);
        if (resource.startsWith(prefix)) {
          matches = true;
        }
      }

      if (matches) {
        if (isExpired) {
          return {
            authorized: false,
            expired: true,
            expiresAt: item.expiresAt,
            reason: 'authorization_expired'
          };
        }
        return {
          authorized: true,
          expired: false,
          expiresAt: item.expiresAt
        };
      }
    }
  }

  return { authorized: false, expired: false, reason: 'not_authorized' };
}

/**
 * 授权用户某项操作
 * @param {Object} options
 * @param {string} options.openid - 用户 openid
 * @param {'mcpTools' | 'filePaths' | 'networkDomains'} options.authType - 授权类型
 * @param {string} options.resource - 资源标识符
 * @param {string} [options.nickname] - 用户昵称
 * @param {number} [options.timeoutHours] - 超时时间（小时），0 表示永不过期
 * @returns {{ userAuth: UserAuthorization, expiresAt: number, timeoutHours: number }}
 */
export function authorizeUser({ openid, authType, resource, nickname, timeoutHours }) {
  const state = loadAuthorizationState();
  const now = Date.now();

  // 获取超时设置
  const effectiveTimeout = timeoutHours ?? getUserTimeoutSettings(openid).authTimeoutHours;
  const expiresAt = effectiveTimeout > 0 ? now + effectiveTimeout * 60 * 60 * 1000 : NEVER_EXPIRE;

  // 获取或创建用户授权信息
  let userAuth = state.users[openid];
  if (!userAuth) {
    userAuth = {
      openid,
      authorizedAt: now,
      lastAuthorizedAt: now,
      nickname,
      authorizations: {
        mcpTools: [],
        filePaths: [],
        networkDomains: [],
      },
      headlessConfig: getDefaultHeadlessConfig(),
    };
    state.users[openid] = userAuth;
  }

  // 更新昵称
  if (nickname && !userAuth.nickname) {
    userAuth.nickname = nickname;
  }

  // 获取授权列表
  const authList = userAuth.authorizations[authType] || [];

  // 检查是否已存在该资源的授权
  const existingIndex = authList.findIndex(item => {
    const res = typeof item === 'string' ? item : item.resource;
    return res === resource;
  });

  // 创建新的授权条目
  const newEntry = {
    resource,
    authorizedAt: now,
    expiresAt,
  };

  if (existingIndex !== -1) {
    // 更新现有授权
    authList[existingIndex] = newEntry;
  } else {
    // 添加新授权
    authList.push(newEntry);
  }

  userAuth.authorizations[authType] = authList;
  userAuth.lastAuthorizedAt = now;
  saveAuthorizationState(state);

  console.log(`[authorization-state] User ${openid} authorized: ${authType}/${resource}, expiresAt: ${expiresAt === NEVER_EXPIRE ? 'never' : new Date(expiresAt).toLocaleString('zh-CN')}`);

  return {
    userAuth,
    expiresAt,
    timeoutHours: effectiveTimeout
  };
}

/**
 * 撤销用户某项授权
 * @param {string} openid - 用户 openid
 * @param {'mcpTools' | 'filePaths' | 'networkDomains'} authType - 授权类型
 * @param {string} resource - 资源标识符
 * @returns {boolean} 是否成功撤销
 */
export function revokeAuthorization(openid, authType, resource) {
  const state = loadAuthorizationState();
  const userAuth = state.users[openid];

  if (!userAuth || !userAuth.authorizations) {
    return false;
  }

  const authList = userAuth.authorizations[authType] || [];
  const index = authList.findIndex(item => {
    const res = typeof item === 'string' ? item : item.resource;
    return res === resource;
  });

  if (index !== -1) {
    authList.splice(index, 1);
    userAuth.authorizations[authType] = authList;
    saveAuthorizationState(state);
    console.log(`[authorization-state] User ${openid} revoked: ${authType}/${resource}`);
    return true;
  }

  return false;
}

/**
 * 获取默认 headless 配置
 * @returns {Object}
 */
function getDefaultHeadlessConfig() {
  return {
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    systemPrompt: null,
    allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
  };
}

/**
 * 获取或设置用户的 headless 配置
 * @param {string} openid - 用户 openid
 * @param {Object} [config] - 新配置（可选）
 * @returns {Object} headless 配置
 */
export function getOrSetHeadlessConfig(openid, config) {
  const state = loadAuthorizationState();
  const now = Date.now();

  let userAuth = state.users[openid];
  if (!userAuth) {
    userAuth = {
      openid,
      authorizedAt: now,
      lastAuthorizedAt: now,
      authorizations: {
        mcpTools: [],
        filePaths: [],
        networkDomains: [],
      },
      headlessConfig: getDefaultHeadlessConfig(),
    };
    state.users[openid] = userAuth;
    saveAuthorizationState(state);
    return userAuth.headlessConfig;
  }

  // 如果提供了新配置，更新配置
  if (config) {
    userAuth.headlessConfig = {
      ...userAuth.headlessConfig,
      ...config,
    };
    saveAuthorizationState(state);
    console.log(`[authorization-state] User ${openid} headless config updated`);
  }

  return userAuth.headlessConfig;
}

/**
 * 重置用户的 headless 配置为默认值
 * @param {string} openid - 用户 openid
 */
export function resetHeadlessConfig(openid) {
  return getOrSetHeadlessConfig(openid, getDefaultHeadlessConfig());
}

/**
 * 获取授权统计
 * @returns {Object}
 */
export function getAuthorizationStats() {
  const state = loadAuthorizationState();
  const users = Object.values(state.users);
  const now = Date.now();

  let totalMcpAuthorizations = 0;
  let totalFileAuthorizations = 0;
  let totalNetworkAuthorizations = 0;
  let expiredAuthorizations = 0;
  let expiringSoonAuthorizations = 0;

  for (const user of users) {
    for (const authType of ['mcpTools', 'filePaths', 'networkDomains']) {
      const authList = user.authorizations?.[authType] || [];
      for (const item of authList) {
        if (typeof item === 'object' && item.expiresAt !== undefined) {
          if (item.expiresAt !== NEVER_EXPIRE) {
            if (now >= item.expiresAt) {
              expiredAuthorizations++;
            } else {
              // 检查是否即将过期（1小时内）
              const hoursUntilExpiry = (item.expiresAt - now) / (60 * 60 * 1000);
              if (hoursUntilExpiry <= 1) {
                expiringSoonAuthorizations++;
              }
            }
          }
        }

        // 兼容旧格式计数
        if (authType === 'mcpTools') totalMcpAuthorizations++;
        else if (authType === 'filePaths') totalFileAuthorizations++;
        else if (authType === 'networkDomains') totalNetworkAuthorizations++;
      }
    }
  }

  return {
    totalUsers: users.length,
    totalMcpAuthorizations,
    totalFileAuthorizations,
    totalNetworkAuthorizations,
    expiredAuthorizations,
    expiringSoonAuthorizations,
    lastUpdatedAt: state.lastUpdatedAt,
    globalConfig: state.globalConfig,
  };
}

/**
 * 获取即将过期或已过期的授权列表
 * @param {number} [withinHours=1] - 检查未来多少小时内过期的授权
 * @returns {Array<{ openid: string, nickname?: string, authType: string, resource: string, expiresAt: number, status: 'expired' | 'expiring_soon' }>}
 */
export function getExpiringAuthorizations(withinHours = 1) {
  const state = loadAuthorizationState();
  const now = Date.now();
  const checkUntil = now + withinHours * 60 * 60 * 1000;
  const results = [];

  for (const [openid, userAuth] of Object.entries(state.users)) {
    if (!userAuth.authorizations) continue;

    for (const authType of ['mcpTools', 'filePaths', 'networkDomains']) {
      const authList = userAuth.authorizations[authType] || [];

      for (const item of authList) {
        if (typeof item !== 'object' || item.expiresAt === undefined || item.expiresAt === NEVER_EXPIRE) {
          continue;
        }

        if (item.expiresAt <= checkUntil) {
          results.push({
            openid,
            nickname: userAuth.nickname,
            authType,
            resource: item.resource,
            expiresAt: item.expiresAt,
            status: now >= item.expiresAt ? 'expired' : 'expiring_soon',
          });
        }
      }
    }
  }

  return results;
}

/**
 * 清理过期授权
 * @returns {number} 清理数量
 */
export function cleanupExpiredAuthorizations() {
  const state = loadAuthorizationState();
  const now = Date.now();
  let cleaned = 0;

  for (const [openid, userAuth] of Object.entries(state.users)) {
    if (!userAuth.authorizations) continue;

    for (const authType of ['mcpTools', 'filePaths', 'networkDomains']) {
      const authList = userAuth.authorizations[authType] || [];
      const validEntries = authList.filter(item => {
        // 保留旧格式字符串
        if (typeof item === 'string') return true;
        // 保留永不过期的
        if (item.expiresAt === NEVER_EXPIRE) return true;
        // 保留未过期的
        return now < item.expiresAt;
      });

      const removedCount = authList.length - validEntries.length;
      if (removedCount > 0) {
        userAuth.authorizations[authType] = validEntries;
        cleaned += removedCount;
      }
    }
  }

  if (cleaned > 0) {
    saveAuthorizationState(state);
    console.log(`[authorization-state] Cleaned up ${cleaned} expired authorizations`);
  }

  return cleaned;
}

/**
 * 刷新授权（延长过期时间）
 * @param {string} openid - 用户 openid
 * @param {'mcpTools' | 'filePaths' | 'networkDomains'} authType - 授权类型
 * @param {string} resource - 资源标识符
 * @param {number} [timeoutHours] - 新的超时时间（小时），不传则使用用户默认设置
 * @returns {boolean} 是否成功刷新
 */
export function refreshAuthorization(openid, authType, resource, timeoutHours) {
  const state = loadAuthorizationState();
  const userAuth = state.users[openid];

  if (!userAuth || !userAuth.authorizations) {
    return false;
  }

  const authList = userAuth.authorizations[authType] || [];
  const index = authList.findIndex(item => {
    const res = typeof item === 'string' ? item : item.resource;
    return res === resource;
  });

  if (index === -1) {
    return false;
  }

  const now = Date.now();
  const effectiveTimeout = timeoutHours ?? getUserTimeoutSettings(openid).authTimeoutHours;
  const expiresAt = effectiveTimeout > 0 ? now + effectiveTimeout * 60 * 60 * 1000 : NEVER_EXPIRE;

  // 更新授权条目
  const existingItem = authList[index];
  if (typeof existingItem === 'string') {
    authList[index] = {
      resource: existingItem,
      authorizedAt: now,
      expiresAt,
    };
  } else {
    authList[index] = {
      ...existingItem,
      expiresAt,
    };
  }

  userAuth.lastAuthorizedAt = now;
  saveAuthorizationState(state);

  console.log(`[authorization-state] User ${openid} refreshed: ${authType}/${resource}, new expiresAt: ${expiresAt === NEVER_EXPIRE ? 'never' : new Date(expiresAt).toLocaleString('zh-CN')}`);
  return true;
}

// 导出常量
export const AUTH_CONSTANTS = {
  AUTHORIZATION_STATE_FILE,
  DEFAULT_AUTH_TIMEOUT_HOURS,
  DEFAULT_REMINDER_HOURS,
  NEVER_EXPIRE,
};
