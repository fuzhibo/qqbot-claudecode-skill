#!/usr/bin/env node

/**
 * QQ Bot MCP 集成测试脚本
 *
 * 用法:
 *   node tests/mcp-integration-test.js
 *
 * 环境变量 (.env 文件):
 *   QQBOT_APP_ID=your-app-id
 *   QQBOT_CLIENT_SECRET=your-secret
 *   QQBOT_TEST_TARGET_ID=G_xxx (可选，用于发送测试消息)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// 加载 .env 文件
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log('📋 已加载 .env 文件\n');
} else {
  console.log('⚠️  .env 文件不存在，使用系统环境变量\n');
}

// 测试配置
const TEST_CONFIG = {
  appId: process.env.QQBOT_APP_ID,
  clientSecret: process.env.QQBOT_CLIENT_SECRET,
  testTargetId: process.env.QQBOT_TEST_TARGET_ID || null,
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 测试结果
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
};

function recordTest(name, status, message, duration = 0) {
  testResults.tests.push({ name, status, message, duration });
  if (status === 'pass') {
    testResults.passed++;
    log('green', `  ✅ ${name} (${duration}ms)`);
  } else if (status === 'fail') {
    testResults.failed++;
    log('red', `  ❌ ${name}: ${message}`);
  } else {
    testResults.skipped++;
    log('yellow', `  ⏭️  ${name}: ${message}`);
  }
}

// ============ 测试用例 ============

async function testEnvironmentVariables() {
  log('bold', '\n📋 测试 1: 环境变量检查');

  const startTime = Date.now();

  if (!TEST_CONFIG.appId) {
    recordTest('QQBOT_APP_ID', 'fail', '未设置', Date.now() - startTime);
    return false;
  }
  recordTest('QQBOT_APP_ID', 'pass', `${TEST_CONFIG.appId.slice(0, 8)}...`, Date.now() - startTime);

  const startTime2 = Date.now();
  if (!TEST_CONFIG.clientSecret) {
    recordTest('QQBOT_CLIENT_SECRET', 'fail', '未设置', Date.now() - startTime2);
    return false;
  }
  recordTest('QQBOT_CLIENT_SECRET', 'pass', '******', Date.now() - startTime2);

  return true;
}

async function testConfigModule() {
  log('bold', '\n📦 测试 2: 配置模块');

  const startTime = Date.now();

  try {
    const configModule = await import('../dist/src/mcp/config.js');

    // 测试 readConfig
    const config = configModule.readConfig();
    recordTest('readConfig()', 'pass', `返回 ${Object.keys(config.bots || {}).length} 个机器人`, Date.now() - startTime);

    // 测试 getConfigPath
    const configPath = configModule.getConfigPath();
    recordTest('getConfigPath()', 'pass', configPath, Date.now() - startTime);

    return true;
  } catch (error) {
    recordTest('配置模块导入', 'fail', error.message, Date.now() - startTime);
    return false;
  }
}

async function testMessageQueue() {
  log('bold', '\n📬 测试 3: 消息队列模块');

  const startTime = Date.now();

  try {
    const queueModule = await import('../dist/src/mcp/message-queue.js');

    // 测试 enqueueMessage
    const enqueued = queueModule.enqueueMessage(
      'test-bot',
      'group',
      'test-source',
      'test message',
      'test-author'
    );
    recordTest('enqueueMessage()', enqueued ? 'pass' : 'fail', enqueued ? '消息已入队' : '入队失败', Date.now() - startTime);

    // 测试 fetchUnreadTasks
    const startTime2 = Date.now();
    const tasks = queueModule.fetchUnreadTasks('test-bot');
    recordTest('fetchUnreadTasks()', tasks.length > 0 ? 'pass' : 'fail', `返回 ${tasks.length} 条任务`, Date.now() - startTime2);

    // 测试 getQueueStatus
    const startTime3 = Date.now();
    const status = queueModule.getQueueStatus();
    recordTest('getQueueStatus()', 'pass', JSON.stringify(status), Date.now() - startTime3);

    return true;
  } catch (error) {
    recordTest('消息队列模块导入', 'fail', error.message, Date.now() - startTime);
    return false;
  }
}

async function testQQClient() {
  log('bold', '\n🤖 测试 4: QQ 客户端模块');

  const startTime = Date.now();

  try {
    const clientModule = await import('../dist/src/mcp/qq-client.js');

    // 测试 parseTargetId
    const groupResult = clientModule.parseTargetId('G_123456');
    recordTest('parseTargetId(G_)', groupResult.type === 'group' ? 'pass' : 'fail', `type: ${groupResult.type}`, Date.now() - startTime);

    const startTime2 = Date.now();
    const userResult = clientModule.parseTargetId('U_abc123');
    recordTest('parseTargetId(U_)', userResult.type === 'user' ? 'pass' : 'fail', `type: ${userResult.type}`, Date.now() - startTime2);

    const startTime3 = Date.now();
    const channelResult = clientModule.parseTargetId('C_789');
    recordTest('parseTargetId(C_)', channelResult.type === 'channel' ? 'pass' : 'fail', `type: ${channelResult.type}`, Date.now() - startTime3);

    return true;
  } catch (error) {
    recordTest('QQ客户端模块导入', 'fail', error.message, Date.now() - startTime);
    return false;
  }
}

async function testToolsModule() {
  log('bold', '\n🔧 测试 5: MCP 工具模块');

  const startTime = Date.now();

  try {
    const toolsModule = await import('../dist/src/mcp/tools.js');

    // 测试 toolDefinitions
    const definitions = toolsModule.toolDefinitions;
    recordTest('toolDefinitions', definitions.length > 0 ? 'pass' : 'fail', `${definitions.length} 个工具定义`, Date.now() - startTime);

    // 验证工具名称
    const expectedTools = ['get_active_bots', 'send_qq_message', 'upload_qq_media', 'fetch_unread_tasks', 'get_qq_context'];
    const actualTools = definitions.map(t => t.name);
    const missingTools = expectedTools.filter(t => !actualTools.includes(t));

    const startTime2 = Date.now();
    recordTest('工具完整性', missingTools.length === 0 ? 'pass' : 'fail', missingTools.length === 0 ? '所有工具已定义' : `缺少: ${missingTools.join(', ')}`, Date.now() - startTime2);

    return true;
  } catch (error) {
    recordTest('MCP工具模块导入', 'fail', error.message, Date.now() - startTime);
    return false;
  }
}

async function testQQAPIConnection() {
  log('bold', '\n🌐 测试 6: QQ API 连接');

  if (!TEST_CONFIG.appId || !TEST_CONFIG.clientSecret) {
    recordTest('API 连接', 'skip', '缺少凭证');
    return false;
  }

  const startTime = Date.now();

  try {
    const apiModule = await import('../dist/src/api.js');

    // 测试获取 Access Token
    const token = await apiModule.getAccessToken(TEST_CONFIG.appId, TEST_CONFIG.clientSecret);
    recordTest('getAccessToken()', token ? 'pass' : 'fail', token ? 'Token 获取成功' : 'Token 获取失败', Date.now() - startTime);

    if (token) {
      // 测试 Token 状态
      const startTime2 = Date.now();
      const status = apiModule.getTokenStatus(TEST_CONFIG.appId);
      recordTest('getTokenStatus()', status.status === 'valid' ? 'pass' : 'fail', `status: ${status.status}`, Date.now() - startTime2);
    }

    return true;
  } catch (error) {
    recordTest('QQ API 连接', 'fail', error.message, Date.now() - startTime);
    return false;
  }
}

async function testSendMessage() {
  log('bold', '\n📨 测试 7: 发送消息（可选）');

  if (!TEST_CONFIG.testTargetId) {
    recordTest('发送测试消息', 'skip', '未设置 QQBOT_TEST_TARGET_ID');
    return false;
  }

  if (!TEST_CONFIG.appId || !TEST_CONFIG.clientSecret) {
    recordTest('发送测试消息', 'skip', '缺少凭证');
    return false;
  }

  const startTime = Date.now();

  try {
    const clientModule = await import('../dist/src/mcp/qq-client.js');
    const configModule = await import('../dist/src/mcp/config.js');

    // 创建测试配置
    const testBot = {
      name: 'test-bot',
      appId: TEST_CONFIG.appId,
      clientSecret: TEST_CONFIG.clientSecret,
      enabled: true,
      markdownSupport: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const client = clientModule.getClient(testBot);

    // 发送测试消息
    const result = await client.sendMessage(
      TEST_CONFIG.testTargetId,
      `[MCP 测试] Claude Code 集成测试 - ${new Date().toISOString()}`
    );

    recordTest('send_qq_message', result.success ? 'pass' : 'fail', result.success ? '消息发送成功' : result.error, Date.now() - startTime);

    return result.success;
  } catch (error) {
    recordTest('发送测试消息', 'fail', error.message, Date.now() - startTime);
    return false;
  }
}

// ============ 主函数 ============

async function main() {
  log('cyan', '╔══════════════════════════════════════════════════════════╗');
  log('cyan', '║       🧪 QQ Bot MCP 集成测试                             ║');
  log('cyan', '╚══════════════════════════════════════════════════════════╝');

  // 运行所有测试
  await testEnvironmentVariables();
  await testConfigModule();
  await testMessageQueue();
  await testQQClient();
  await testToolsModule();
  await testQQAPIConnection();
  await testSendMessage();

  // 输出摘要
  log('\n' + '═'.repeat(50));
  log('bold', '\n📊 测试摘要\n');

  log('green', `  ✅ 通过: ${testResults.passed}`);
  log('red', `  ❌ 失败: ${testResults.failed}`);
  log('yellow', `  ⏭️  跳过: ${testResults.skipped}`);
  log('dim', `  📝 总计: ${testResults.tests.length}`);

  // 详细结果
  if (testResults.failed > 0) {
    log('\n' + colors.bold + '❌ 失败的测试:' + colors.reset);
    testResults.tests
      .filter(t => t.status === 'fail')
      .forEach(t => log('red', `  - ${t.name}: ${t.message}`));
  }

  // 退出码
  const exitCode = testResults.failed > 0 ? 1 : 0;
  log(exitCode === 0 ? '\n✅ 所有测试通过！\n' : '\n❌ 部分测试失败\n');

  process.exit(exitCode);
}

main().catch((err) => {
  log('red', `❌ 测试执行错误: ${err.message}`);
  process.exit(1);
});
