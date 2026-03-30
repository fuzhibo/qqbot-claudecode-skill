#!/usr/bin/env node

/**
 * Claude Code Channel 支持检测脚本
 *
 * 检测当前 Claude Code 版本是否支持 Channel 功能 (需要 v2.1.80+)
 *
 * 使用方式:
 *   node check-channel-support.js
 *   node check-channel-support.js --json  # JSON 输出
 *
 * 退出码:
 *   0 - 支持 Channel 模式
 *   1 - 不支持 Channel 模式
 */

import { checkChannelSupport, MIN_VERSION } from './lib/channel-support.js';

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

// 导出函数供其他模块使用 (从共享模块 re-export)
export { checkChannelSupport, MIN_VERSION } from './lib/channel-support.js';

// 直接运行时执行 main
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// CommonJS 兼容
main();
