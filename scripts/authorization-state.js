/**
 * QQ Bot 授权状态管理模块
 *
 * 管理用户授权状态和 headless 模式参数持久化
 * - MCP 工具授权
 * - 文件访问授权
 * - 网络访问授权
 * - Headless 模式配置
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 状态文件路径
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const AUTHORIZATION_STATE_FILE = path.join(GATEWAY_DIR, 'authorization-state.json');

/**
 * 用户授权信息
 * @typedef {Object} UserAuthorization
 * @property {string} openid - 用户 openid
 * @property {number} authorizedAt - 首次授权时间
 * @property {number} lastAuthorizedAt - 最后授权时间
 * @property {Object} authorizations - 授权详情
 * @property {string[]} authorizations.mcpTools - 已授权的 MCP 工具列表
 * @property {string[]} authorizations.filePaths - 已授权的文件路径
 * @property {string[]} authorizations.networkDomains - 已授权的网络域名
 * @property {Object} headlessConfig - Headless 模式配置
 */

/**
 * 授权状态
 * @typedef {Object} AuthorizationState
 * @property {Object.<string, UserAuthorization>} users - 用户授权信息（按 openid 索引）
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
 * @returns {AuthorizationState}
 */
export function loadAuthorizationState() {
  if (stateCache !== null) {
    return stateCache;
  }

  try {
    if (fs.existsSync(AUTHORIZATION_STATE_FILE)) {
      const data = fs.readFileSync(AUTHORIZATION_STATE_FILE, 'utf-8');
      stateCache = JSON.parse(data);
      return stateCache;
    }
  } catch (err) {
    console.error(`[authorization-state] Failed to load state: ${err.message}`);
  }

  // 返回默认状态
  stateCache = {
    users: {},
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
 * 检查用户是否已授权某项操作
 * @param {string} openid - 用户 openid
 * @param {'mcpTools' | 'filePaths' | 'networkDomains'} authType - 授权类型
 * @param {string} resource - 资源标识符（工具名/路径/域名）
 * @returns {boolean}
 */
export function isAuthorized(openid, authType, resource) {
  const userAuth = getUserAuthorization(openid);
  if (!userAuth || !userAuth.authorizations) {
    return false;
  }

  const authorizedList = userAuth.authorizations[authType] || [];

  // 检查通配符授权
  if (authorizedList.includes('*')) {
    return true;
  }

  // 检查前缀匹配（如 "mcp:*" 匹配所有 MCP 工具）
  for (const pattern of authorizedList) {
    if (pattern.endsWith(':*') || pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1);
      if (resource.startsWith(prefix)) {
        return true;
      }
    }
    if (pattern === resource) {
      return true;
    }
  }

  return false;
}

/**
 * 授权用户某项操作
 * @param {Object} options
 * @param {string} options.openid - 用户 openid
 * @param {'mcpTools' | 'filePaths' | 'networkDomains'} options.authType - 授权类型
 * @param {string} options.resource - 资源标识符
 * @param {string} [options.nickname] - 用户昵称
 * @returns {UserAuthorization} 更新后的授权信息
 */
export function authorizeUser({ openid, authType, resource, nickname }) {
  const state = loadAuthorizationState();
  const now = Date.now();

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
      headlessConfig: {
        model: 'claude-sonnet-4-6',
        maxTokens: 4096,
        systemPrompt: null,
        allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
      },
    };
    state.users[openid] = userAuth;
  }

  // 更新昵称
  if (nickname && !userAuth.nickname) {
    userAuth.nickname = nickname;
  }

  // 添加授权（去重）
  const authList = userAuth.authorizations[authType] || [];
  if (!authList.includes(resource)) {
    authList.push(resource);
    userAuth.authorizations[authType] = authList;
  }

  userAuth.lastAuthorizedAt = now;
  saveAuthorizationState(state);

  console.log(`[authorization-state] User ${openid} authorized: ${authType}/${resource}`);
  return userAuth;
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
  const index = authList.indexOf(resource);

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
      headlessConfig: {
        model: 'claude-sonnet-4-6',
        maxTokens: 4096,
        systemPrompt: null,
        allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
      },
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
  const defaultConfig = {
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    systemPrompt: null,
    allowedTools: ['Read', 'Grep', 'Glob', 'Bash'],
  };

  return getOrSetHeadlessConfig(openid, defaultConfig);
}

/**
 * 获取授权统计
 * @returns {Object}
 */
export function getAuthorizationStats() {
  const state = loadAuthorizationState();
  const users = Object.values(state.users);

  let totalMcpAuthorizations = 0;
  let totalFileAuthorizations = 0;
  let totalNetworkAuthorizations = 0;

  for (const user of users) {
    totalMcpAuthorizations += (user.authorizations?.mcpTools || []).length;
    totalFileAuthorizations += (user.authorizations?.filePaths || []).length;
    totalNetworkAuthorizations += (user.authorizations?.networkDomains || []).length;
  }

  return {
    totalUsers: users.length,
    totalMcpAuthorizations,
    totalFileAuthorizations,
    totalNetworkAuthorizations,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}

/**
 * 清理过期授权（可选，根据业务需求）
 * @param {number} [expiryDays=30] - 过期天数
 * @returns {number} 清理数量
 */
export function cleanupExpiredAuthorizations(expiryDays = 30) {
  const state = loadAuthorizationState();
  const now = Date.now();
  const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
  let cleaned = 0;

  for (const [openid, userAuth] of Object.entries(state.users)) {
    if (now - userAuth.lastAuthorizedAt > expiryMs) {
      delete state.users[openid];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    saveAuthorizationState(state);
    console.log(`[authorization-state] Cleaned up ${cleaned} expired authorizations`);
  }

  return cleaned;
}

// 导出常量
export const AUTH_CONSTANTS = {
  AUTHORIZATION_STATE_FILE,
};
