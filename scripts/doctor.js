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
import {
  parseVersion,
  compareVersions,
  MIN_VERSION,
  getAllHookStates,
  getModeRegistry,
  loadEnvUnified,
} from './lib/channel-support.js';

const CONFIG_DIR = path.join(os.homedir(), '.claude', 'qqbot-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 全局配置路径（工作模式、降级等）
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const GLOBAL_CONFIG_FILE = path.join(GATEWAY_DIR, 'qqbot-config.json');
const MODE_REGISTRY_FILE = path.join(GATEWAY_DIR, 'mode-registry.json');

// 默认全局配置（与 src/mcp/config.ts 保持一致）
const DEFAULT_GLOBAL_CONFIG = {
  version: '1.0.0',
  workmode: 'channel',           // channel | headless
  allowDegradation: true,        // channel 失败时降级到 tools
  autoStartGateway: true,        // SessionStart 自动启动 Gateway
  autoNotifyOffline: true,       // SessionEnd 发送离线通知
  envFile: null,                 // .env 文件路径（可选）
  notifyTargetId: null,          // 接收离线通知的 QQ 目标 ID（可选）
};

/**
 * 升级全局配置文件
 * 检查并添加缺失的配置字段
 */
function upgradeGlobalConfig() {
  // 确保 Gateway 目录存在
  if (!fs.existsSync(GATEWAY_DIR)) {
    fs.mkdirSync(GATEWAY_DIR, { recursive: true });
    log('green', '  ✅ 创建 Gateway 配置目录');
  }

  let config = { ...DEFAULT_GLOBAL_CONFIG };
  let needsUpgrade = false;

  // 读取现有配置
  if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
      const existing = JSON.parse(content);
      config = { ...config, ...existing };

      // 检查是否有缺失的字段
      for (const [key, defaultValue] of Object.entries(DEFAULT_GLOBAL_CONFIG)) {
        if (!(key in existing)) {
          needsUpgrade = true;
          log('yellow', `  ⚠️  配置缺少字段: ${key} (将使用默认值: ${JSON.stringify(defaultValue)})`);
        }
      }
    } catch (e) {
      log('yellow', `  ⚠️  配置文件解析失败，将重新创建: ${e.message}`);
      needsUpgrade = true;
    }
  } else {
    log('yellow', '  ⚠️  全局配置文件不存在，将创建默认配置');
    needsUpgrade = true;
  }

  // 如果需要升级，保存配置
  if (needsUpgrade) {
    config.lastUpdated = Date.now();
    fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    log('green', '  ✅ 全局配置已更新');
    return true;
  }

  log('green', '  ✅ 全局配置已是最新');
  return false;
}

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

// ============ 诊断结果 ============
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

  // 2. 先检查构建模式（决定后续是否需要检查依赖）
  log('');
  log('bold', '🔨 构建检查');
  let isBundledMode = false;
  try {
    const pluginRoot = (() => { let r = path.dirname(path.dirname(new URL(import.meta.url).pathname)); if (r.endsWith("/dist") || r.endsWith("\\dist")) r = path.dirname(r); return r; })();
    // 新路径：打包后的 dist/mcp/index.js
    const distMcpPath = path.join(pluginRoot, 'dist', 'mcp');
    // 旧路径：tsc 编译的 dist/src/mcp/（向后兼容）
    const distSrcMcpPath = path.join(pluginRoot, 'dist', 'src', 'mcp');

    const hasBundledDist = fs.existsSync(distMcpPath) && fs.existsSync(path.join(distMcpPath, 'index.js'));
    const hasTscDist = fs.existsSync(distSrcMcpPath) && fs.existsSync(path.join(distSrcMcpPath, 'index.js'));

    check(
      hasBundledDist || hasTscDist,
      'dist 目录存在',
      '项目未构建',
      '运行 npm run build'
    );

    if (hasBundledDist) {
      log('green', `  ✅ MCP 入口文件存在 (打包模式 - 无需 npm install)`);
      results.passed.push({ name: 'MCP 入口文件存在', message: '打包模式' });
      isBundledMode = true;
      results.isBundled = true;
    } else if (hasTscDist) {
      log('green', `  ✅ MCP 入口文件存在 (tsc 模式)`);
      results.passed.push({ name: 'MCP 入口文件存在', message: 'tsc 模式' });
      results.isBundled = false;
    }

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

  // 3. 依赖检查（仅 tsc 模式需要）
  log('');
  log('bold', '📚 依赖检查');
  if (isBundledMode) {
    log('dim', '  ℹ️  打包模式: 依赖已内置，无需检查 node_modules');
    results.passed.push({ name: '依赖检查', message: '打包模式，跳过' });
  } else {
    try {
      const pluginRoot = (() => { let r = path.dirname(path.dirname(new URL(import.meta.url).pathname)); if (r.endsWith("/dist") || r.endsWith("\\dist")) r = path.dirname(r); return r; })();
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
    const pluginRoot = (() => { let r = path.dirname(path.dirname(new URL(import.meta.url).pathname)); if (r.endsWith("/dist") || r.endsWith("\\dist")) r = path.dirname(r); return r; })();
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

  // 8. Hook 配置检查
  log('');
  log('bold', '🪝 Hook 配置检查');

  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    const pluginRoot = (() => { let r = path.dirname(path.dirname(new URL(import.meta.url).pathname)); if (r.endsWith("/dist") || r.endsWith("\\dist")) r = path.dirname(r); return r; })();

    // 检查 settings.json 是否存在
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      const hooks = settings.hooks || {};

      // 检查 SessionStart hook
      const hasSessionStart = hooks.SessionStart && hooks.SessionStart.length > 0;
      if (hasSessionStart) {
        log('green', '  ✅ SessionStart hook: 已配置');
        results.passed.push({ name: 'SessionStart hook', message: '已配置' });

        // 检查是否包含 qqbot-mcp 的 SessionStart hook
        const sessionStartHooks = hooks.SessionStart.flatMap(h => h.hooks || []);
        const hasQqbotSessionStart = sessionStartHooks.some(h =>
          h.command && (h.command.includes('qqbot') || h.command.includes('session-start-handler'))
        );

        if (hasQqbotSessionStart) {
          log('green', '  ✅ QQ Bot SessionStart hook: 已配置');
          results.passed.push({ name: 'QQ Bot SessionStart hook', message: '已配置' });
          results.sessionStartHookConfigured = true;
        } else {
          log('yellow', '  ⚠️  QQ Bot SessionStart hook: 未配置');
          log('dim', '      plugin.json 中定义的 SessionStart hook 未被应用到 settings.json');
          log('dim', '      这意味着 Gateway 不会在会话启动时自动启动');
          results.warnings.push({ name: 'QQ Bot SessionStart hook', message: '未配置' });
          results.sessionStartHookConfigured = false;
        }
      } else {
        log('yellow', '  ⚠️  SessionStart hook: 未配置');
        log('dim', '      Claude Code 可能未正确加载插件的 SessionStart hook');
        results.warnings.push({ name: 'SessionStart hook', message: '未配置' });
        results.sessionStartHookConfigured = false;
      }

      // 检查其他必要的 hooks
      const hasPostToolUse = hooks.PostToolUse && hooks.PostToolUse.length > 0;
      const hasUserPromptSubmit = hooks.UserPromptSubmit && hooks.UserPromptSubmit.length > 0;
      const hasSessionEnd = hooks.SessionEnd && hooks.SessionEnd.length > 0;

      if (hasPostToolUse) {
        log('green', '  ✅ PostToolUse hook: 已配置');
      } else {
        log('dim', '  ℹ️  PostToolUse hook: 未配置 (可选)');
      }

      if (hasUserPromptSubmit) {
        log('green', '  ✅ UserPromptSubmit hook: 已配置');
      } else {
        log('dim', '  ℹ️  UserPromptSubmit hook: 未配置 (可选)');
      }

      if (hasSessionEnd) {
        log('green', '  ✅ SessionEnd hook: 已配置');
      } else {
        log('dim', '  ℹ️  SessionEnd hook: 未配置 (可选)');
      }

    } else {
      log('yellow', '  ⚠️  settings.json 不存在');
      results.warnings.push({ name: 'settings.json', message: '不存在' });
      results.sessionStartHookConfigured = false;
    }

    // 检查 Hook 执行状态文件
    log('dim', '  ℹ️  检查 Hook 执行状态...');
    try {
      const hookStates = getAllHookStates();
      if (hookStates.hooks && Object.keys(hookStates.hooks).length > 0) {
        log('green', '  ✅ Hook 执行状态: 有记录');
        for (const [hookName, state] of Object.entries(hookStates.hooks)) {
          const timeAgo = Math.round((Date.now() - state.timestamp) / 1000 / 60);
          const timeStr = timeAgo < 1 ? '刚刚' : timeAgo < 60 ? `${timeAgo}分钟前` : `${Math.round(timeAgo / 60)}小时前`;
          const statusIcon = state.status === 'success' ? '✅' : state.status === 'failed' ? '❌' : '⚠️';
          log('dim', `      ${statusIcon} ${hookName}: ${state.status} (${timeStr})`);
        }
        results.hookStates = hookStates;
      } else {
        log('dim', '  ℹ️  Hook 执行状态: 暂无记录 (首次运行正常)');
      }
    } catch (e) {
      log('dim', `  ℹ️  Hook 执行状态: 无法读取 (${e.message})`);
    }

  } catch (e) {
    results.errors.push({ name: 'Hook 配置检查', message: e.message });
  }

  // 9. Claude Code Channel 支持检查
  log('');
  log('bold', '📡 Claude Code Channel 检查');

  try {
    const pluginRoot = (() => { let r = path.dirname(path.dirname(new URL(import.meta.url).pathname)); if (r.endsWith("/dist") || r.endsWith("\\dist")) r = path.dirname(r); return r; })();

    // 检查版本检测脚本
    const checkChannelScript = path.join(pluginRoot, 'scripts', 'check-channel-support.js');
    check(
      fs.existsSync(checkChannelScript),
      'Channel 版本检测脚本',
      'scripts/check-channel-support.js 不存在',
      '请更新插件到最新版本'
    );

    // 检查 Channel 推送模块
    const channelPusher = path.join(pluginRoot, 'dist', 'mcp', 'channel-pusher.js');
    check(
      fs.existsSync(channelPusher),
      'Channel 推送模块',
      'dist/mcp/channel-pusher.js 不存在',
      '运行 npm run build 重新构建'
    );

    // 检查权限中继模块
    const permissionRelay = path.join(pluginRoot, 'dist', 'mcp', 'permission-relay.js');
    check(
      fs.existsSync(permissionRelay),
      '权限中继模块',
      'dist/mcp/permission-relay.js 不存在',
      '运行 npm run build 重新构建'
    );

    // 检测 Claude Code 版本
    // 优先使用环境变量，其次使用 CLI 命令
    let claudeVersion = process.env.CLAUDE_CODE_VERSION;
    let versionSource = 'env';
    const minChannelVersion = '2.1.80';

    // 如果环境变量未设置，尝试通过 claude --version 获取
    if (!claudeVersion) {
      try {
        const output = execSync('claude --version 2>/dev/null', {
          encoding: 'utf-8',
          timeout: 5000,
        }).trim();
        const match = output.match(/(\d+\.\d+\.\d+)/);
        if (match) {
          claudeVersion = match[1];
          versionSource = 'cli';
        }
      } catch {
        // CLI 命令不可用
      }
    }

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

    // 显示 ModeRegistry 状态
    log('');
    log('bold', '  📋 ModeRegistry 状态');

    try {
      // 先加载环境变量
      loadEnvUnified();

      // 读取 ModeRegistry
      const modeRegistry = getModeRegistry();
      const modeIcon = modeRegistry.mode === 'channel' ? '✅' : '📨';
      const sourceIcon = { cli: '⌨️', env: '🔧', config: '⚙️', auto: '🤖', default: '📌' }[modeRegistry.source] || '❓';

      log('green', `    ${modeIcon} 运行模式: ${modeRegistry.mode}`);
      log('dim', `      来源: ${sourceIcon} ${modeRegistry.source}`);
      if (modeRegistry.channelSubMode) {
        log('dim', `      子模式: ${modeRegistry.channelSubMode}`);
      }
      if (modeRegistry.reason) {
        log('dim', `      原因: ${modeRegistry.reason}`);
      }
      log('dim', `      Gateway 可用: ${modeRegistry.gatewayAvailable ? '是' : '否'}`);
      log('dim', `      原生支持: ${modeRegistry.nativeSupported ? '是' : '否'}`);
      if (modeRegistry.sessionId) {
        log('dim', `      会话 ID: ${modeRegistry.sessionId.slice(0, 8)}...`);
      }
      if (modeRegistry.lastUpdated) {
        const timeAgo = Math.round((Date.now() - modeRegistry.lastUpdated) / 1000 / 60);
        const timeStr = timeAgo < 1 ? '刚刚' : timeAgo < 60 ? `${timeAgo}分钟前` : `${Math.round(timeAgo / 60)}小时前`;
        log('dim', `      更新时间: ${timeStr}`);
      }

      results.modeRegistry = modeRegistry;
    } catch (e) {
      log('yellow', `    ⚠️  无法读取 ModeRegistry: ${e.message}`);
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

  // 用户指导
  log('');
  log('bold', '💡 使用指导');

  // SessionStart hook 未配置的指导
  if (results.sessionStartHookConfigured === false) {
    log('yellow', '  ⚠️  SessionStart Hook 未配置');
    log('dim', '      这意味着 Gateway 不会在 Claude Code 会话启动时自动启动。');
    log('dim', '      ');
    log('dim', '      解决方法:');
    log('dim', '      1. 手动启动 Gateway: /qqbot-service start');
    log('dim', '      2. 或在 settings.json 中添加 SessionStart hook:');
    log('dim', '         "hooks": {');
    log('dim', '           "SessionStart": [{');
    log('dim', '             "hooks": [{');
    log('dim', '               "type": "command",');
    log('dim', `               "command": "node ${path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'qqbot-mcp', 'scripts', 'session-start-handler.js')}"`);
    log('dim', '             }]');
    log('dim', '           }]');
    log('dim', '         }');
    log('');
  }

  // Gateway 未运行的指导
  if (!results.gatewayAvailable && results.communicationMode !== 'native-channel') {
    log('cyan', '  📌 启动 Gateway 以启用 Channel 模式:');
    log('dim', '      /qqbot-service start    # 启动 Gateway 服务');
    log('dim', '      /qqbot-service status   # 检查 Gateway 状态');
    log('');
  }

  // 通信模式说明
  if (results.communicationMode === 'gateway-bridge') {
    log('green', '  ✅ 当前配置: Gateway 桥接模式 (推荐)');
    log('dim', '      • QQ 消息会实时推送到 Claude Code');
    log('dim', '      • Claude Code 可直接回复消息');
  } else if (results.communicationMode === 'tools-polling') {
    log('yellow', '  ℹ️  当前配置: MCP Tools 模式');
    log('dim', '      • 需要手动调用工具发送/接收消息');
    log('dim', '      • 建议启动 Gateway 以启用自动推送');
  }

  return results.errors.length === 0;
}

// 自动修复
async function autoFix() {
  log('cyan', '\n🔧 自动修复模式\n');

  const pluginRoot = (() => { let r = path.dirname(path.dirname(new URL(import.meta.url).pathname)); if (r.endsWith("/dist") || r.endsWith("\\dist")) r = path.dirname(r); return r; })();
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

  // 2.5 升级全局配置文件（添加新字段）
  log('');
  log('bold', '🔧 全局配置升级');
  if (upgradeGlobalConfig()) {
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

  const channelPusherJs = path.join(pluginRoot, 'dist', 'mcp', 'channel-pusher.js');
  const permissionRelayJs = path.join(pluginRoot, 'dist', 'mcp', 'permission-relay.js');
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

  // 7. 检查并修复 SessionStart hook
  log('');
  log('bold', '🪝 SessionStart Hook 配置');

  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsContent);

      if (!settings.hooks) settings.hooks = {};

      // 检查是否已配置 SessionStart hook 且包含 session-start-handler.js
      const hasSessionStartHandler = settings.hooks.SessionStart &&
        settings.hooks.SessionStart.some(h =>
          h.hooks?.some(sub => sub.command?.includes('session-start-handler.js'))
        );

      if (!hasSessionStartHandler) {
        log('yellow', '  ⚠️  SessionStart hook 未配置，正在添加...');

        const sessionStartHandler = path.join(pluginRoot, 'scripts', 'session-start-handler.js');
        if (fs.existsSync(sessionStartHandler)) {
          settings.hooks.SessionStart = [
            {
              matcher: ".*",
              hooks: [
                {
                  type: "command",
                  command: `node ${sessionStartHandler} 2>/dev/null || true`
                }
              ]
            }
          ];

          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
          log('green', '  ✅ 已添加 SessionStart hook 配置');
          log('dim', `     路径: ${sessionStartHandler}`);
          fixed++;
        } else {
          log('red', '  ❌ session-start-handler.js 不存在');
          log('dim', `     期望路径: ${sessionStartHandler}`);
          failed++;
        }
      } else {
        log('green', '  ✅ SessionStart hook 已配置');
      }
    } catch (e) {
      log('red', `  ❌ 解析 settings.json 失败: ${e.message}`);
      failed++;
    }
  } else {
    log('yellow', '  ⚠️  settings.json 不存在，跳过 SessionStart hook 配置');
    log('dim', '     这通常意味着 Claude Code 尚未初始化');
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
