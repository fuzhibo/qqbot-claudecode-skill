#!/usr/bin/env node

/**
 * QQ Bot MCP Doctor - 诊断和修复工具
 *
 * 用法:
 *   qqbot-mcp-cli doctor          - 运行完整诊断
 *   qqbot-mcp-cli doctor --fix    - 尝试自动修复问题
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const CONFIG_DIR = path.join(os.homedir(), '.claude', 'qqbot-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

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
  // 支持只传一个参数作为纯文本输出
  if (message === undefined) {
    console.log(color || '');
    return;
  }
  console.log(`${colors[color] || ''}${message}${colors.reset}`);
}

// ============ 版本比较函数 ============

/**
 * 解析版本字符串为数字数组
 */
function parseVersion(versionStr) {
  if (!versionStr) return null;
  const match = versionStr.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * 比较两个版本号
 * @returns {number} 1 (v1 > v2), -1 (v1 < v2), 0 (相等)
 */
function compareVersions(v1, v2) {
  for (let i = 0; i < 3; i++) {
    if (v1[i] > v2[i]) return 1;
    if (v1[i] < v2[i]) return -1;
  }
  return 0;
}

// 诊断结果
const results = {
  passed: [],
  warnings: [],
  errors: [],
  fixes: [],
};

function check(condition, name, message, fix = null) {
  if (condition) {
    results.passed.push({ name, message });
    log('green', `  ✅ ${name}`);
  } else {
    results.errors.push({ name, message, fix });
    log('red', `  ❌ ${name}: ${message}`);
    if (fix) {
      results.fixes.push({ name, fix });
    }
  }
}

function warn(condition, name, message) {
  if (!condition) {
    results.warnings.push({ name, message });
    log('yellow', `  ⚠️  ${name}: ${message}`);
  } else {
    log('green', `  ✅ ${name}`);
  }
}

// 脚本所需的依赖列表
const REQUIRED_DEPENDENCIES = [
  { name: 'dotenv', import: 'dotenv', scripts: ['qqbot-hooks.js', 'qqbot-gateway.js', 'qqbot-parser.js'] },
  { name: 'ws', import: 'ws', scripts: ['qqbot-gateway.js'] },
  { name: '@modelcontextprotocol/sdk', import: '@modelcontextprotocol/sdk', scripts: ['MCP Server'] },
];

// 诊断检查
async function runDiagnostics() {
  log('cyan', '\n🔍 QQ Bot MCP 诊断工具\n');
  log('dim', '正在检查系统状态...\n');

  // 1. Node.js 版本检查
  log('bold', '📦 环境检查');
  const nodeVersion = process.version;
  const minNodeVersion = 'v18.0.0';
  check(
    nodeVersion >= minNodeVersion,
    'Node.js 版本',
    `当前: ${nodeVersion}, 需要: >= ${minNodeVersion}`,
    '请升级 Node.js 到 18 或更高版本'
  );

  // 2. 依赖检查
  log('');
  log('bold', '📚 依赖检查');
  try {
    const pluginRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
    const nodeModulesPath = path.join(pluginRoot, 'node_modules');

    check(
      fs.existsSync(nodeModulesPath),
      'node_modules 存在',
      '依赖未安装',
      '运行 npm install 安装依赖'
    );

    // 检查所有必需依赖
    let missingDeps = [];
    for (const dep of REQUIRED_DEPENDENCIES) {
      const depPath = path.join(nodeModulesPath, dep.name.replace('@', '').replace('/', path.sep));
      const exists = fs.existsSync(depPath) || fs.existsSync(path.join(nodeModulesPath, dep.name));

      if (!exists) {
        missingDeps.push(dep.name);
        results.errors.push({
          name: `${dep.name} 依赖`,
          message: `未安装，影响: ${dep.scripts.join(', ')}`,
          fix: `运行 npm install ${dep.name}`
        });
        log('red', `  ❌ ${dep.name}: 未安装 (影响: ${dep.scripts.join(', ')})`);
      } else {
        results.passed.push({ name: `${dep.name} 依赖`, message: '已安装' });
        log('green', `  ✅ ${dep.name}: 已安装`);
      }
    }

    // 存储缺失依赖供自动修复使用
    if (missingDeps.length > 0) {
      results.missingDependencies = missingDeps;
    }
  } catch (e) {
    results.errors.push({ name: '依赖检查', message: e.message });
  }

  // 3. 编译输出检查
  log('');
  log('bold', '🔨 构建检查');
  try {
    const pluginRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
    const distPath = path.join(pluginRoot, 'dist', 'src', 'mcp');

    check(
      fs.existsSync(distPath),
      'dist 目录存在',
      '项目未构建',
      '运行 npm run build'
    );

    check(
      fs.existsSync(path.join(distPath, 'index.js')),
      'MCP 入口文件存在',
      'dist/src/mcp/index.js 不存在',
      '运行 npm run build'
    );

    // 检查 send-message.js
    check(
      fs.existsSync(path.join(pluginRoot, 'scripts', 'send-message.js')),
      'send-message.js 存在',
      'scripts/send-message.js 不存在，无法使用 /qqbot-send',
      '请更新插件到最新版本'
    );
  } catch (e) {
    results.errors.push({ name: '构建检查', message: e.message });
  }

  // 4. 配置检查
  log('');
  log('bold', '⚙️  配置检查');

  check(
    fs.existsSync(CONFIG_DIR),
    '配置目录存在',
    `目录不存在: ${CONFIG_DIR}`,
    '将自动创建配置目录'
  );

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      const botCount = Object.keys(config.bots || {}).length;

      warn(
        botCount > 0,
        '机器人配置',
        botCount === 0 ? '没有配置任何机器人' : `已配置 ${botCount} 个机器人`
      );

      // 检查每个机器人配置
      Object.entries(config.bots || {}).forEach(([name, bot]) => {
        warn(
          bot.appId && bot.appId.length > 0,
          `  ${name} - AppID`,
          bot.appId ? '已配置' : '未配置'
        );
        warn(
          bot.clientSecret && bot.clientSecret.length > 0,
          `  ${name} - Secret`,
          bot.clientSecret ? '已配置' : '未配置'
        );
      });
    } catch (e) {
      results.errors.push({ name: '配置文件解析', message: e.message });
    }
  } else {
    warn(false, '配置文件', '配置文件不存在，将使用环境变量或需要初始化');
  }

  // 5. 环境变量检查
  log('');
  log('bold', '🔐 环境变量检查');

  warn(
    !!process.env.QQBOT_APP_ID,
    'QQBOT_APP_ID',
    process.env.QQBOT_APP_ID ? '已设置' : '未设置'
  );
  warn(
    !!process.env.QQBOT_CLIENT_SECRET,
    'QQBOT_CLIENT_SECRET',
    process.env.QQBOT_CLIENT_SECRET ? '已设置' : '未设置'
  );

  // 6. 网络连接检查
  log('');
  log('bold', '🌐 网络检查');

  try {
    // 尝试解析 QQ API 域名
    const dns = await import('dns').then(m => m.promises);
    await dns.resolve('api.sgroup.qq.com');
    log('green', '  ✅ QQ API 域名解析正常');
    results.passed.push({ name: 'QQ API 域名解析', message: '正常' });
  } catch (e) {
    log('yellow', `  ⚠️  QQ API 域名解析失败: ${e.message}`);
    results.warnings.push({ name: 'QQ API 域名解析', message: e.message });
  }

  // 7. plugin.json 检查
  log('');
  log('bold', '📋 插件配置检查');
  try {
    const pluginRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
    const pluginJsonPath = path.join(pluginRoot, 'plugin.json');

    check(
      fs.existsSync(pluginJsonPath),
      'plugin.json 存在',
      'plugin.json 不存在',
      '确保 plugin.json 文件存在'
    );

    if (fs.existsSync(pluginJsonPath)) {
      const plugin = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));

      check(
        plugin.name && plugin.version,
        '插件元数据',
        'name 或 version 缺失',
        '在 plugin.json 中添加 name 和 version'
      );

      check(
        plugin.mcpServers && plugin.mcpServers.qqbot,
        'MCP Server 配置',
        'mcpServers.qqbot 不存在',
        '在 plugin.json 中添加 mcpServers 配置'
      );
    }
  } catch (e) {
    results.errors.push({ name: 'plugin.json 解析', message: e.message });
  }

  // 8. Claude Code Channel 支持检查
  log('');
  log('bold', '📡 Claude Code Channel 检查');

  try {
    const pluginRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));

    // 检查版本检测脚本
    const checkChannelScript = path.join(pluginRoot, 'scripts', 'check-channel-support.js');
    check(
      fs.existsSync(checkChannelScript),
      'Channel 版本检测脚本',
      'scripts/check-channel-support.js 不存在',
      '请更新插件到最新版本'
    );

    // 检查 Channel 推送模块
    const channelPusher = path.join(pluginRoot, 'dist', 'src', 'mcp', 'channel-pusher.js');
    check(
      fs.existsSync(channelPusher),
      'Channel 推送模块',
      'dist/src/mcp/channel-pusher.js 不存在',
      '运行 npm run build 重新构建'
    );

    // 检查权限中继模块
    const permissionRelay = path.join(pluginRoot, 'dist', 'src', 'mcp', 'permission-relay.js');
    check(
      fs.existsSync(permissionRelay),
      '权限中继模块',
      'dist/src/mcp/permission-relay.js 不存在',
      '运行 npm run build 重新构建'
    );

    // 检测 Claude Code 版本
    // 注意：CLAUDE_CODE_VERSION 仅在 MCP Server 由 Claude Code 启动时设置
    // 独立进程（如 Gateway、CLI）不会有此变量，这是正常行为
    const claudeVersion = process.env.CLAUDE_CODE_VERSION;
    const minChannelVersion = '2.1.80';

    // 检测是否在 Claude Code MCP 环境中运行
    const isMcpContext = !!(
      process.env.CLAUDE_CODE_VERSION ||
      process.env.MCP_SERVER_NAME ||
      process.env.CLAUDE_SESSION_ID
    );

    // 检测 Gateway 是否可用
    const gatewayUrl = process.env.QQBOT_GATEWAY_URL || 'http://127.0.0.1:3310';
    let gatewayAvailable = false;
    try {
      const response = await fetch(`${gatewayUrl}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      gatewayAvailable = response.ok;
    } catch {
      gatewayAvailable = false;
    }

    // 检测 Claude Code 原生 Channel 支持 (用于权限中继等高级功能)
    let nativeChannelSupported = false;
    if (claudeVersion) {
      const current = parseVersion(claudeVersion);
      const required = parseVersion(minChannelVersion);
      nativeChannelSupported = current && required && compareVersions(current, required) >= 0;
    }

    // Gateway 桥接模式检测 (推荐)
    if (gatewayAvailable) {
      log('green', `  ✅ Gateway 桥接模式: 可用`);
      log('dim', `      Gateway URL: ${gatewayUrl}`);
      results.passed.push({ name: 'Gateway 桥接模式', message: '可用' });
      results.gatewayAvailable = true;
    } else {
      log('dim', `  ℹ️  Gateway 桥接模式: 不可用 (Gateway 未运行)`);
      log('dim', `      运行 /qqbot-service start 启动 Gateway`);
      results.gatewayAvailable = false;
    }

    // 原生 Channel 模式检测 (可选，用于权限中继)
    if (claudeVersion) {
      if (nativeChannelSupported) {
        log('green', `  ✅ Claude Code 原生 Channel: v${claudeVersion} (支持权限中继)`);
        results.passed.push({ name: 'Claude Code 原生 Channel', message: `v${claudeVersion}` });
        results.nativeChannelSupported = true;
      } else {
        log('yellow', `  ⚠️  Claude Code 版本: v${claudeVersion} (需要 >= v${minChannelVersion} 支持权限中继)`);
        results.warnings.push({ name: 'Claude Code 原生 Channel', message: `版本过低` });
        results.nativeChannelSupported = false;
      }
    } else if (isMcpContext) {
      log('yellow', `  ⚠️  Claude Code 版本: 未知 (在 MCP 环境中但 CLAUDE_CODE_VERSION 未设置)`);
      results.warnings.push({ name: 'Claude Code 版本', message: '未知' });
      results.nativeChannelSupported = false;
    } else {
      log('dim', `  ℹ️  Claude Code 原生 Channel: 不适用 (当前为独立进程模式)`);
      results.nativeChannelSupported = false;
      results.standaloneMode = true;
    }

    // 综合判断 Channel 模式是否可用
    // Gateway 桥接模式 或 原生 Channel 模式 任一可用即可
    results.channelSupported = gatewayAvailable || nativeChannelSupported;

    // 检查 QQBOT_CHANNEL_MODE 配置
    const channelMode = process.env.QQBOT_CHANNEL_MODE;
    if (channelMode) {
      const validModes = ['auto', 'channel', 'tools'];
      if (validModes.includes(channelMode.toLowerCase())) {
        log('green', `  ✅ QQBOT_CHANNEL_MODE: ${channelMode}`);
        results.passed.push({ name: 'QQBOT_CHANNEL_MODE', message: channelMode });
      } else {
        log('yellow', `  ⚠️  QQBOT_CHANNEL_MODE: ${channelMode} (无效值，应为 auto/channel/tools)`);
        results.warnings.push({ name: 'QQBOT_CHANNEL_MODE', message: '无效值' });
      }
    } else {
      log('dim', `  ℹ️  QQBOT_CHANNEL_MODE: 未设置 (默认 auto)`);
    }

    // 检查 plugin.json 中的 QQBOT_CHANNEL_MODE 配置
    const pluginJsonPath = path.join(pluginRoot, 'plugin.json');
    if (fs.existsSync(pluginJsonPath)) {
      const plugin = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
      const envConfig = plugin.mcpServers?.qqbot?.env || {};
      if (envConfig.QQBOT_CHANNEL_MODE) {
        log('green', `  ✅ plugin.json Channel 配置: 已配置`);
      } else {
        log('dim', `  ℹ️  plugin.json Channel 配置: 未配置 (将使用默认值)`);
      }
    }

    // 通信能力总结
    log('');
    log('bold', '  📶 通信能力分析');

    // 优先级: Gateway 桥接 > 原生 Channel > Tools 轮询
    if (results.gatewayAvailable) {
      // Gateway 桥接模式 (推荐)
      log('green', `  ✅ 通信模式: Gateway 桥接 (Channel)`);
      log('dim', `      • MCP Server 注册到 Gateway 获取消息`);
      log('dim', `      • 消息通过 Channel notification 推送`);
      log('dim', `      • Claude Code 可直接回复`);
      if (results.nativeChannelSupported) {
        log('dim', `      • 支持权限中继 (Claude Code 原生 Channel)`);
      }
      results.communicationMode = 'gateway-bridge';

      // Channel 模式使用提醒
      log('');
      log('yellow', `  ⚠️  Channel 模式注意事项：`);
      log('dim', `      • QQ 消息会直接推送到当前 Claude Code 会话`);
      log('dim', `      • 如有多人会话，消息可能混合显示`);
      log('dim', `      • 建议合理安排消息收发，避免混淆`);
      log('dim', `      • 如有影响，可设置 QQBOT_CHANNEL_MODE=tools 关闭 Channel`);
    } else if (results.nativeChannelSupported) {
      // 原生 Channel 模式 (无 Gateway)
      log('green', `  ✅ 通信模式: Claude Code 原生 Channel`);
      log('dim', `      • 使用 Claude Code 内置 Channel capability`);
      log('dim', `      • 消息实时推送到 Claude Code`);
      log('dim', `      • 支持权限中继`);
      results.communicationMode = 'native-channel';

      log('');
      log('yellow', `  ⚠️  建议：启动 Gateway 以启用桥接模式`);
      log('dim', `      • 运行 /qqbot-service start 启动 Gateway`);
      log('dim', `      • Gateway 桥接模式更稳定，推荐使用`);
    } else if (results.standaloneMode) {
      // 独立进程模式 (Gateway 未运行)
      log('cyan', `  📨 通信模式: Gateway 单向通信 + MCP Tools`);
      log('dim', `      • Gateway 独立接收 QQ 消息`);
      log('dim', `      • 通过 MCP Tools (send_qq_message) 发送消息`);
      log('dim', `      • 需要手动调用或 Claude Code Headless 处理`);
      results.communicationMode = 'gateway-unidirectional';
    } else {
      // 降级模式
      log('yellow', `  ⚠️  通信模式: MCP Tools 轮询模式`);
      log('dim', `      • 通过 fetch_unread_tasks 轮询消息`);
      log('dim', `      • 通过 send_qq_message 发送消息`);
      log('dim', `      • 建议启动 Gateway 以启用 Channel 模式`);
      results.communicationMode = 'tools-polling';
    }

  } catch (e) {
    results.errors.push({ name: 'Channel 检查', message: e.message });
  }

  // 输出摘要
  log('\n' + '═'.repeat(50));
  log('bold', '\n📊 诊断摘要\n');

  log('green', `  ✅ 通过: ${results.passed.length} 项`);
  log('yellow', `  ⚠️  警告: ${results.warnings.length} 项`);
  log('red', `  ❌ 错误: ${results.errors.length} 项`);

  if (results.errors.length > 0) {
    log('\n' + colors.bold + '🔧 建议修复:' + colors.reset);
    results.fixes.forEach((f, i) => {
      log('dim', `  ${i + 1}. ${f.name}: ${f.fix}`);
    });
  }

  return results.errors.length === 0;
}

// 自动修复
async function autoFix() {
  log('cyan', '\n🔧 自动修复模式\n');

  const pluginRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
  let fixed = 0;
  let failed = 0;

  // 1. 创建配置目录
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    log('green', '  ✅ 创建配置目录');
    fixed++;
  }

  // 2. 创建默认配置文件
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      version: '1.0.0',
      bots: {},
      lastUpdated: Date.now(),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    log('green', '  ✅ 创建默认配置文件');
    fixed++;
  }

  // 3. 检查并安装依赖
  const nodeModulesPath = path.join(pluginRoot, 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    log('yellow', '  ⚠️  node_modules 不存在，正在安装所有依赖...');
    try {
      execSync('npm install', { cwd: pluginRoot, stdio: 'inherit' });
      log('green', '  ✅ 依赖安装完成');
      fixed++;
    } catch (e) {
      log('red', '  ❌ 安装失败，请手动运行: npm install');
      failed++;
    }
  } else {
    // 检查缺失的依赖并逐个安装
    for (const dep of REQUIRED_DEPENDENCIES) {
      const depPath = path.join(nodeModulesPath, dep.name.replace('@', '').replace('/', path.sep));
      const exists = fs.existsSync(depPath) || fs.existsSync(path.join(nodeModulesPath, dep.name));

      if (!exists) {
        log('yellow', `  ⚠️  ${dep.name} 未安装，正在安装...`);
        try {
          execSync(`npm install ${dep.name}`, { cwd: pluginRoot, stdio: 'inherit' });
          log('green', `  ✅ ${dep.name} 安装完成`);
          fixed++;
        } catch (e) {
          log('red', `  ❌ ${dep.name} 安装失败，请手动运行: npm install ${dep.name}`);
          failed++;
        }
      }
    }
  }

  // 4. 检查并执行构建
  const distPath = path.join(pluginRoot, 'dist', 'src', 'mcp');
  const needsBuild = !fs.existsSync(distPath) ||
    !fs.existsSync(path.join(distPath, 'index.js'));

  if (needsBuild) {
    log('yellow', '  ⚠️  需要构建项目...');
    try {
      log('dim', '  正在构建...');
      execSync('npm run build', { cwd: pluginRoot, stdio: 'inherit' });
      log('green', '  ✅ 构建完成');
      fixed++;
    } catch (e) {
      log('red', '  ❌ 构建失败，请手动运行: npm run build');
      failed++;
    }
  }

  // 5. 检查 proactive.js 是否存在（send-proactive.ts 需要）
  const proactiveJs = path.join(pluginRoot, 'dist', 'src', 'proactive.js');
  if (!fs.existsSync(proactiveJs)) {
    log('yellow', '  ⚠️  proactive.js 不存在，尝试重新构建...');
    try {
      execSync('npm run build', { cwd: pluginRoot, stdio: 'inherit' });
      log('green', '  ✅ 重新构建完成');
      fixed++;
    } catch (e) {
      log('red', '  ❌ 构建失败');
      failed++;
    }
  }

  // 6. 检查 Channel 相关模块
  log('');
  log('bold', '📡 Channel 模块检查');

  const channelPusherJs = path.join(pluginRoot, 'dist', 'src', 'mcp', 'channel-pusher.js');
  const permissionRelayJs = path.join(pluginRoot, 'dist', 'src', 'mcp', 'permission-relay.js');
  const checkChannelJs = path.join(pluginRoot, 'scripts', 'check-channel-support.js');

  let needsRebuild = false;

  if (!fs.existsSync(channelPusherJs)) {
    log('yellow', '  ⚠️  channel-pusher.js 不存在');
    needsRebuild = true;
  } else {
    log('green', '  ✅ channel-pusher.js 存在');
  }

  if (!fs.existsSync(permissionRelayJs)) {
    log('yellow', '  ⚠️  permission-relay.js 不存在');
    needsRebuild = true;
  } else {
    log('green', '  ✅ permission-relay.js 存在');
  }

  if (!fs.existsSync(checkChannelJs)) {
    log('red', '  ❌ check-channel-support.js 不存在，请更新插件');
    failed++;
  } else {
    log('green', '  ✅ check-channel-support.js 存在');
  }

  if (needsRebuild) {
    log('yellow', '  ⚠️  Channel 模块缺失，正在重新构建...');
    try {
      execSync('npm run build', { cwd: pluginRoot, stdio: 'inherit' });
      log('green', '  ✅ 构建完成');
      fixed++;
    } catch (e) {
      log('red', '  ❌ 构建失败');
      failed++;
    }
  }

  // 输出摘要
  log('\n' + '═'.repeat(50));
  log('bold', '\n📊 修复摘要\n');

  if (fixed > 0) {
    log('green', `  ✅ 已修复: ${fixed} 项`);
  }
  if (failed > 0) {
    log('red', `  ❌ 失败: ${failed} 项`);
  }
  if (fixed === 0 && failed === 0) {
    log('green', '  ✅ 所有检查通过，无需修复');
  }

  if (failed > 0) {
    log('\n' + colors.yellow + '手动修复命令:' + colors.reset);
    log('dim', `  cd ${pluginRoot}`);
    log('dim', '  npm install');
    log('dim', '  npm run build');
  }

  log('\n' + colors.dim + '请运行 doctor 再次检查状态\n' + colors.reset);

  return failed === 0;
}

// 主入口
async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix') || args.includes('-f');

  if (shouldFix) {
    await autoFix();
  } else {
    const success = await runDiagnostics();
    process.exit(success ? 0 : 1);
  }
}

main().catch((err) => {
  log('red', `❌ 错误: ${err.message}`);
  process.exit(1);
});
