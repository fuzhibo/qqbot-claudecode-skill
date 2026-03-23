#!/usr/bin/env node

/**
 * Claude Code Channel 支持检测模块
 *
 * 检测当前 Claude Code 版本是否支持 Channel 功能 (需要 v2.1.80+)
 *
 * 使用方式:
 *   node check-channel-support.js
 *
 * 退出码:
 *   0 - 支持 Channel 模式
 *   1 - 不支持 Channel 模式
 *
 * 输出:
 *   JSON 格式的检测结果
 */

// Channel 模式所需的最低版本
const MIN_VERSION = '2.1.80';

/**
 * 解析版本字符串为数字数组
 * @param {string} versionStr - 版本字符串 (如 "2.1.80")
 * @returns {number[] | null} - [major, minor, patch] 或 null
 */
function parseVersion(versionStr) {
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
function compareVersions(v1, v2) {
  for (let i = 0; i < 3; i++) {
    if (v1[i] > v2[i]) return 1;
    if (v1[i] < v2[i]) return -1;
  }
  return 0;
}

/**
 * 检测 Claude Code 是否支持 Channel 功能
 * @returns {{ supported: boolean, reason?: string, version?: string, required?: string, message?: string }}
 */
function checkChannelSupport() {
  const version = process.env.CLAUDE_CODE_VERSION;

  // 情况1: 环境变量未设置
  if (!version) {
    return {
      supported: false,
      reason: 'version_unknown',
      message: '无法检测 Claude Code 版本 (CLAUDE_CODE_VERSION 环境变量未设置)',
    };
  }

  const current = parseVersion(version);
  const required = parseVersion(MIN_VERSION);

  // 情况2: 版本号解析失败
  if (!current) {
    return {
      supported: false,
      reason: 'parse_failed',
      version,
      message: `无法解析版本号: ${version}`,
    };
  }

  // 情况3: 版本过低
  if (compareVersions(current, required) < 0) {
    return {
      supported: false,
      reason: 'version_too_low',
      version,
      required: MIN_VERSION,
      message: `Claude Code 版本过低: ${version}，Channel 模式需要 >= v${MIN_VERSION}`,
    };
  }

  // 情况4: 版本满足要求
  return {
    supported: true,
    version,
    required: MIN_VERSION,
    message: `Claude Code v${version} 支持 Channel 模式`,
  };
}

/**
 * 格式化输出结果
 * @param {object} result - 检测结果
 */
function formatOutput(result) {
  const icon = result.supported ? '✅' : '⚠️';
  console.log(`${icon} ${result.message}`);

  if (!result.supported) {
    console.log('   将使用 MCP Tools 兼容模式 (轮询方式)');
    if (result.required) {
      console.log(`   如需 Channel 模式，请升级 Claude Code 到 v${result.required}+`);
    }
  } else {
    console.log('   已启用实时推送和权限中继功能');
  }
}

// 主入口
function main() {
  const args = process.argv.slice(2);
  const result = checkChannelSupport();

  // 静默模式：只输出 JSON
  if (args.includes('--json')) {
    console.log(JSON.stringify(result));
    process.exit(result.supported ? 0 : 1);
  }

  // 详细模式：输出人类可读信息
  formatOutput(result);

  // 同时输出 JSON 供程序解析 (最后一行)
  console.log('\n---JSON---');
  console.log(JSON.stringify(result));

  process.exit(result.supported ? 0 : 1);
}

// 导出函数供其他模块使用
export { checkChannelSupport, parseVersion, compareVersions, MIN_VERSION };

// 直接运行时执行 main
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// CommonJS 兼容
main();
