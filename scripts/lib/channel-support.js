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
};
