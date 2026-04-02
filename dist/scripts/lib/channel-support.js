#!/usr/bin/env node

/**
 * Claude Code Channel 支持检测共享模块
 *
 * 统一的版本检测和 Channel 支持判断逻辑
 * 供 doctor.js, qqbot-service.js, check-channel-support.js 等模块复用
 */

import { execSync } from 'child_process';

// Channel 模式所需的最低版本
export const MIN_VERSION = '2.1.80';

/**
 * 解析版本字符串为数字数组
 * @param {string} versionStr - 版本字符串 (如 "2.1.80")
 * @returns {number[] | null} - [major, minor, patch] 或 null
 */
export function parseVersion(versionStr) {
  if (!versionStr) return null;
  const match = versionStr.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * 比较两个版本号
 * @param {number[]} v1 - 版本1 [major, minor, patch]
 * @param {number[]} v2 - 版本2 [major, minor, patch]
 * @returns {number} - 1 (v1 > v2), -1 (v1 < v2), 0 (相等)
 */
export function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;
  for (let i = 0; i < 3; i++) {
    if (v1[i] > v2[i]) return 1;
    if (v1[i] < v2[i]) return -1;
  }
  return 0;
}

/**
 * 通过 claude --version 命令获取版本号
 * @returns {string | null} - 版本号或 null
 */
export function getVersionFromCli() {
  try {
    const output = execSync('claude --version 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    // 解析输出，格式如: "2.1.85 (Claude Code)" 或 "claude 2.1.85"
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 获取 Claude Code 版本（优先环境变量，其次 CLI 命令）
 * @returns {{ version: string | null, source: string }}
 */
export function getClaudeCodeVersion() {
  let version = process.env.CLAUDE_CODE_VERSION;
  let source = 'env';

  if (!version) {
    version = getVersionFromCli();
    source = version ? 'cli' : 'unknown';
  }

  return { version, source };
}

/**
 * 检测 Claude Code 是否支持 Channel 功能
 * @param {boolean} useCliFallback - 是否使用 CLI 命令作为回退检测
 * @returns {{ supported: boolean, reason?: string, version?: string, required?: string, message?: string, source?: string }}
 */
export function checkChannelSupport(useCliFallback = true) {
  let version = process.env.CLAUDE_CODE_VERSION;
  let source = 'env';

  // 情况1: 环境变量未设置，尝试通过 CLI 命令获取
  if (!version && useCliFallback) {
    version = getVersionFromCli();
    source = version ? 'cli' : 'unknown';
  }

  // 情况2: 仍然无法获取版本
  if (!version) {
    return {
      supported: false,
      reason: 'version_unknown',
      message: '无法检测 Claude Code 版本 (CLAUDE_CODE_VERSION 环境变量未设置，且 claude --version 命令不可用)',
      source,
    };
  }

  const current = parseVersion(version);
  const required = parseVersion(MIN_VERSION);

  // 情况3: 版本号解析失败
  if (!current) {
    return {
      supported: false,
      reason: 'parse_failed',
      version,
      message: `无法解析版本号: ${version}`,
      source,
    };
  }

  // 情况4: 版本过低
  if (compareVersions(current, required) < 0) {
    return {
      supported: false,
      reason: 'version_too_low',
      version,
      required: MIN_VERSION,
      message: `Claude Code 版本过低: ${version}，Channel 模式需要 >= v${MIN_VERSION}`,
      source,
    };
  }

  // 情况5: 版本满足要求
  return {
    supported: true,
    version,
    required: MIN_VERSION,
    message: `Claude Code v${version} 支持 Channel 模式`,
    source,
  };
}

/**
 * 获取 MCP 通信模式配置
 * @returns {{ mode: string, configured: boolean, source: string }}
 */
export function getMcpMode() {
  const envMode = process.env.QQBOT_CHANNEL_MODE;

  if (envMode) {
    const validModes = ['auto', 'channel', 'tools'];
    const mode = validModes.includes(envMode.toLowerCase())
      ? envMode.toLowerCase()
      : 'auto';
    return { mode, configured: true, source: 'env' };
  }

  return { mode: 'auto', configured: false, source: 'default' };
}

/**
 * Hook 执行状态记录
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const HOOK_STATE_FILE = path.join(GATEWAY_DIR, 'hook-execution-state.json');

/**
 * 确保 Gateway 目录存在
 */
function ensureGatewayDir() {
  if (!fs.existsSync(GATEWAY_DIR)) {
    fs.mkdirSync(GATEWAY_DIR, { recursive: true });
  }
}

/**
 * 读取 JSON 文件
 * @param {string} filePath - 文件路径
 * @param {any} defaultValue - 默认值
 * @returns {any}
 */
function readJsonFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    // 忽略解析错误
  }
  return defaultValue;
}

/**
 * 写入 JSON 文件
 * @param {string} filePath - 文件路径
 * @param {any} data - 数据
 */
function writeJsonFile(filePath, data) {
  ensureGatewayDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 记录 Hook 执行状态
 * @param {string} hookName - Hook 名称 (如 'session-start-handler')
 * @param {string} status - 状态: 'started' | 'success' | 'skipped' | 'failed'
 * @param {string} message - 消息
 * @param {number} duration - 执行时长 (毫秒)
 * @param {number} exitCode - 退出码
 * @param {object} metadata - 额外元数据
 */
export function recordHookExecution(hookName, status, message = '', duration = 0, exitCode = 0, metadata = {}) {
  const state = readJsonFile(HOOK_STATE_FILE, { hooks: {} });

  state.lastUpdated = new Date().toISOString();
  state.hooks[hookName] = {
    timestamp: Date.now(),
    status,
    duration,
    exitCode,
    message,
    metadata,
  };

  writeJsonFile(HOOK_STATE_FILE, state);
}

/**
 * 获取 Hook 执行状态
 * @param {string} hookName - Hook 名称
 * @returns {object | null} - Hook 执行状态
 */
export function getHookState(hookName) {
  const state = readJsonFile(HOOK_STATE_FILE, { hooks: {} });
  return state.hooks[hookName] || null;
}

/**
 * 获取所有 Hook 执行状态
 * @returns {object} - 所有 Hook 执行状态
 */
export function getAllHookStates() {
  return readJsonFile(HOOK_STATE_FILE, { hooks: {}, lastUpdated: null });
}

// ============ 统一模式注册中心 (与 src/mcp/mode-registry.ts 同步) ============

const MODE_REGISTRY_FILE = path.join(GATEWAY_DIR, 'mode-registry.json');
const GLOBAL_CONFIG_FILE = path.join(GATEWAY_DIR, 'qqbot-config.json');

/**
 * 解析 .env 文件内容
 * @param {string} filePath - .env 文件路径
 * @returns {Record<string, string>} - 环境变量键值对
 */
export function parseEnvFile(filePath) {
  const result = {};

  if (!filePath || !fs.existsSync(filePath)) {
    return result;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        result[key] = value;
      }
    }
  } catch (error) {
    console.error(`[channel-support] Failed to parse env file ${filePath}:`, error);
  }

  return result;
}

/**
 * 统一的环境变量加载函数
 * 从 qqbot-config.json 读取 envFile 路径并加载环境变量
 * 供所有脚本使用，确保环境变量加载一致性
 *
 * @returns {{ loaded: number, envFile: string | null }} - 加载的环境变量数量和文件路径
 */
export function loadEnvUnified() {
  let envFile = null;
  let loaded = 0;

  try {
    // 1. 读取全局配置获取 envFile 路径
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      const configContent = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configContent);

      if (config.envFile) {
        envFile = config.envFile.replace('~', os.homedir());

        // 2. 加载 .env 文件
        const envVars = parseEnvFile(envFile);

        // 3. 设置环境变量（不覆盖已有值）
        for (const [key, value] of Object.entries(envVars)) {
          if (process.env[key] === undefined) {
            process.env[key] = value;
            loaded++;
          }
        }

        if (loaded > 0) {
          console.error(`[channel-support] Loaded ${loaded} env vars from: ${envFile}`);
        }
      }
    }
  } catch (error) {
    console.error('[channel-support] Failed to load env file:', error);
  }

  return { loaded, envFile };
}

/**
 * 读取模式注册配置
 * @returns {object} - 模式配置
 */
export function getModeRegistry() {
  return readJsonFile(MODE_REGISTRY_FILE, {
    version: '1.0.0',
    mode: 'channel',
    source: 'default',
    gatewayAvailable: false,
    nativeSupported: false,
    lastUpdated: null,
  });
}

/**
 * 写入模式注册配置
 * @param {object} config - 模式配置
 */
export function setModeRegistry(config) {
  ensureGatewayDir();
  config.lastUpdated = Date.now();
  fs.writeFileSync(MODE_REGISTRY_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 设置运行模式 (与 src/mcp/mode-registry.ts 的 setMode 对齐)
 * @param {'channel' | 'tools'} mode - 运行模式
 * @param {object} [options] - 可选参数
 * @param {'cli' | 'env' | 'config' | 'auto' | 'default'} [options.source] - 来源
 * @param {'gateway-bridge' | 'native'} [options.channelSubMode] - Channel 子模式
 * @param {boolean} [options.gatewayAvailable] - Gateway 是否可用
 * @param {boolean} [options.nativeSupported] - 原生 Channel 是否支持
 * @param {string} [options.sessionId] - 会话 ID
 * @param {string} [options.projectPath] - 项目路径
 * @param {string} [options.projectName] - 项目名称
 * @param {string} [options.reason] - 原因描述
 */
export function setMode(mode, options = {}) {
  const current = getModeRegistry();
  const config = {
    ...current,
    mode,
    source: options.source || 'config',
    channelSubMode: options.channelSubMode,
    gatewayAvailable: options.gatewayAvailable ?? current.gatewayAvailable,
    nativeSupported: options.nativeSupported ?? current.nativeSupported,
    sessionId: options.sessionId ?? current.sessionId,
    projectPath: options.projectPath ?? current.projectPath,
    projectName: options.projectName ?? current.projectName,
    reason: options.reason,
    lastUpdated: Date.now(),
  };
  setModeRegistry(config);
  console.error(`[channel-support] Mode set to: ${mode} (source: ${config.source})`);
}

/**
 * 设置 Gateway 可用状态 (与 src/mcp/mode-registry.ts 的 setGatewayAvailable 对齐)
 * 当 Gateway 从可用变为不可用时，如果允许降级则自动切换到 tools 模式
 * @param {boolean} available - Gateway 是否可用
 */
export function setGatewayAvailable(available) {
  const current = getModeRegistry();
  current.gatewayAvailable = available;
  current.lastUpdated = Date.now();

  // 如果 Gateway 从可用变为不可用，且当前是 channel 模式，考虑降级
  if (!available && current.mode === 'channel' && current.source === 'auto') {
    const globalConfig = readJsonFile(GLOBAL_CONFIG_FILE, {
      workmode: 'channel',
      allowDegradation: true,
    });
    if (globalConfig.allowDegradation) {
      current.mode = 'tools';
      current.reason = 'degraded: gateway unavailable';
      console.error('[channel-support] Degraded to tools mode (gateway unavailable)');
    }
  }

  setModeRegistry(current);
}

/**
 * 设置会话信息 (与 src/mcp/mode-registry.ts 的 setSessionInfo 对齐)
 * @param {string} sessionId - 会话 ID
 * @param {string} [projectPath] - 项目路径
 * @param {string} [projectName] - 项目名称
 */
export function setSessionInfo(sessionId, projectPath, projectName) {
  const current = getModeRegistry();
  current.sessionId = sessionId;
  current.projectPath = projectPath;
  current.projectName = projectName;
  current.lastUpdated = Date.now();
  setModeRegistry(current);
}

/**
 * 获取当前运行模式
 * @returns {'channel' | 'tools'} - 运行模式
 */
export function getOperationMode() {
  const registry = getModeRegistry();
  return registry.mode || 'channel';
}

/**
 * 获取完整模式配置
 * @returns {object} - 完整的 ModeConfig
 */
export function getModeConfig() {
  return getModeRegistry();
}

/**
 * 获取会话 ID 前缀 (用于消息标识)
 * 返回会话 ID 的前 8 位，用于 Channel 模式下的消息前缀
 * @returns {string | null} - 会话 ID 前缀或 null
 */
export function getSessionPrefix() {
  const registry = getModeRegistry();
  if (registry.mode === 'channel' && registry.sessionId) {
    return registry.sessionId.slice(0, 8);
  }
  return null;
}

/**
 * 检测 Gateway 是否可用
 * @returns {Promise<boolean>}
 */
export async function checkGatewayAvailable() {
  const gatewayUrl = process.env.QQBOT_GATEWAY_URL || 'http://127.0.0.1:3310';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${gatewayUrl}/api/status`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 检测并自动设置模式 (与 src/mcp/mode-registry.ts 的 detectAndSetMode 对齐)
 * 模式优先级:
 * 1. 环境变量 QQBOT_CHANNEL_MODE=tools -> 强制 Tools 模式
 * 2. 环境变量 QQBOT_CHANNEL_MODE=channel -> 强制 Channel 模式
 * 3. 配置文件指定 headless 模式 -> Tools 模式
 * 4. 自动检测: Gateway 可用 -> Channel (Gateway 桥接)
 * 5. 自动检测: 原生 Channel 支持 -> Channel (原生)
 * 6. 降级到 Tools 模式
 *
 * @param {boolean} [gatewayAvailable=false] - Gateway 是否可用
 * @param {boolean} [nativeSupported=false] - 是否支持原生 Channel
 * @returns {object} - 模式配置
 */
export function detectAndSetMode(gatewayAvailable = false, nativeSupported = false) {
  // 先加载环境变量
  loadEnvUnified();

  const envMode = process.env.QQBOT_CHANNEL_MODE?.toLowerCase();
  const claudeVersion = process.env.CLAUDE_CODE_VERSION;
  const isNativeSupported = nativeSupported || checkChannelSupport(false).supported;

  // 读取全局配置
  const globalConfig = readJsonFile(GLOBAL_CONFIG_FILE, {
    workmode: 'channel',
    allowDegradation: true,
  });

  let mode = 'channel';
  let source = 'auto';
  let channelSubMode = undefined;
  let reason = '';

  // 1. 环境变量强制模式（最高优先级）
  if (envMode === 'tools') {
    mode = 'tools';
    source = 'env';
    reason = 'forced by QQBOT_CHANNEL_MODE=tools';
  } else if (envMode === 'channel') {
    mode = 'channel';
    source = 'env';
    channelSubMode = gatewayAvailable ? 'gateway-bridge' : (isNativeSupported ? 'native' : undefined);
    reason = `forced by QQBOT_CHANNEL_MODE=channel, using ${channelSubMode || 'unknown'}`;
  }
  // 2. 配置文件指定 headless 模式
  else if (globalConfig.workmode === 'headless') {
    mode = 'tools';
    source = 'config';
    reason = 'configured as headless mode in qqbot-config.json';
  }
  // 3. 自动检测: Gateway 可用
  else if (gatewayAvailable) {
    mode = 'channel';
    source = 'auto';
    channelSubMode = 'gateway-bridge';
    reason = 'auto-detected gateway-bridge mode';
  }
  // 4. 自动检测: 原生 Channel 支持
  else if (isNativeSupported) {
    mode = 'channel';
    source = 'auto';
    channelSubMode = 'native';
    reason = 'auto-detected native channel mode';
  }
  // 5. 降级到 Tools 模式
  else if (globalConfig.allowDegradation) {
    mode = 'tools';
    source = 'auto';
    reason = 'degraded from channel to tools (allowDegradation=true)';
  }
  // 6. 不允许降级，保持 channel 模式等待 Gateway
  else {
    mode = 'channel';
    source = 'auto';
    channelSubMode = 'gateway-bridge';
    reason = 'waiting for gateway (allowDegradation=false)';
  }

  const current = getModeRegistry();
  const config = {
    ...current,
    version: '1.0.0',
    mode,
    channelSubMode,
    source,
    gatewayAvailable,
    nativeSupported: isNativeSupported,
    reason,
    lastUpdated: Date.now(),
  };

  setModeRegistry(config);
  console.error(`[channel-support] Mode set to: ${mode} (source: ${source})`);

  return config;
}

// CommonJS 兼容导出
export default {
  MIN_VERSION,
  parseVersion,
  compareVersions,
  getVersionFromCli,
  getClaudeCodeVersion,
  checkChannelSupport,
  getMcpMode,
  recordHookExecution,
  getHookState,
  getAllHookStates,
  // 统一环境变量加载
  parseEnvFile,
  loadEnvUnified,
  // 模式注册中心 (与 src/mcp/mode-registry.ts 对齐)
  getModeRegistry,
  setModeRegistry,
  getOperationMode,
  getModeConfig,
  setMode,
  setGatewayAvailable,
  setSessionInfo,
  getSessionPrefix,
  checkGatewayAvailable,
  detectAndSetMode,
};
