/**
 * QQ Bot MCP Server - Claude Code MCP 协议入口
 *
 * 此模块实现 MCP (Model Context Protocol) 协议，
 * 允许 Claude Code 通过标准化接口与 QQ 机器人交互。
 *
 * 支持两种运行模式:
 * 1. Channel 模式 (v2.1.80+): 实时推送 + 权限中继
 * 2. MCP Tools 模式: 轮询方式，功能完整
 *
 * 使用方式:
 * 1. 作为 MCP Server 运行: node dist/mcp/index.js
 * 2. 配置到 Claude Code: 在 claude_desktop_config.json 中添加
 *
 * 支持的工具:
 * - get_active_bots: 获取可用机器人列表
 * - send_qq_message: 发送文本消息
 * - upload_qq_media: 上传并发送媒体文件
 * - fetch_unread_tasks: 获取未读任务 (MCP Tools 模式)
 * - get_qq_context: 获取消息上下文
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { toolDefinitions, handleToolCall } from './tools.js';
import { loadFromEnv, setBot, getAllBots, loadGlobalConfig } from './config.js';
import { getClient, cleanupAllClients } from './qq-client.js';
import {
  startChannelPusher,
  stopChannelPusher,
  registerChannel,
  unregisterChannel,
  isGatewayRegistered,
} from './channel-pusher.js';
import { initPermissionRelay, handlePermissionRequest } from './permission-relay.js';
import { z } from 'zod';

// ============ Permission Request Schema ============

/** Claude Code 权限请求通知 Schema */
const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string(),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string().optional(),
  }),
});

// ============ 版本检测与模式切换 ============

/** Channel 模式所需的最低 Claude Code 版本 (用于原生 Channel + 权限中继) */
const MIN_CHANNEL_VERSION = '2.1.80';

/** Gateway API 地址 */
const GATEWAY_API_URL = process.env.QQBOT_GATEWAY_URL || 'http://127.0.0.1:3310';

/** 运行模式类型 */
type OperationMode = 'channel' | 'tools';

/** Channel 子模式类型 */
type ChannelSubMode = 'gateway-bridge' | 'native';

/** 模式检测结果 */
interface ModeDetectionResult {
  mode: OperationMode;
  channelSubMode?: ChannelSubMode;
  gatewayAvailable?: boolean;
  nativeSupported?: boolean;
  reason: string;
}

/**
 * 解析版本字符串为数字数组
 */
function parseVersion(versionStr: string | undefined): [number, number, number] | null {
  if (!versionStr) return null;
  const match = versionStr.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * 比较两个版本号
 */
function compareVersions(
  v1: [number, number, number],
  v2: [number, number, number]
): number {
  for (let i = 0; i < 3; i++) {
    if (v1[i] > v2[i]) return 1;
    if (v1[i] < v2[i]) return -1;
  }
  return 0;
}

/**
 * 检测 Claude Code 版本是否支持原生 Channel 模式
 * 原生 Channel 用于权限中继等高级功能
 */
function supportsNativeChannel(version: string | undefined): boolean {
  const current = parseVersion(version);
  const required = parseVersion(MIN_CHANNEL_VERSION);
  if (!current || !required) return false;
  return compareVersions(current, required) >= 0;
}

/**
 * 检测 Gateway API 是否可用
 * Gateway 桥接模式不依赖 Claude Code 版本
 */
async function checkGatewayAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时

    const response = await fetch(`${GATEWAY_API_URL}/api/status`, {
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
 * 同步检测 Gateway 是否可用 (基于环境变量判断)
 * 用于初始化时的同步检测
 */
function isGatewayConfigured(): boolean {
  // 如果显式配置了 Gateway URL，认为 Gateway 模式可用
  if (process.env.QQBOT_GATEWAY_URL) {
    return true;
  }
  // 默认情况下假设 Gateway 在本地运行
  return true;
}

/**
 * 获取运行模式
 *
 * 模式优先级:
 * 1. 环境变量 QQBOT_CHANNEL_MODE=tools -> 强制 Tools 模式
 * 2. 环境变量 QQBOT_CHANNEL_MODE=channel -> 强制 Channel 模式 (检测 Gateway)
 * 3. 自动检测: Gateway 可用 -> Channel (Gateway 桥接)
 * 4. 自动检测: Claude Code 原生 Channel -> Channel (原生)
 * 5. 降级到 Tools 模式
 *
 * Channel 模式分为两种:
 * - gateway-bridge: 通过 Gateway 轮询获取消息 (不依赖 Claude Code 版本)
 * - native: 使用 Claude Code 原生 Channel capability (需要 v2.1.80+)
 */
function getOperationModeSync(): ModeDetectionResult {
  // 1. 优先读取全局配置文件
  const globalConfig = loadGlobalConfig();
  const envMode = process.env.QQBOT_CHANNEL_MODE?.toLowerCase();
  const nativeSupported = supportsNativeChannel(process.env.CLAUDE_CODE_VERSION);

  // 2. 环境变量强制模式（最高优先级）
  if (envMode === 'tools') {
    return {
      mode: 'tools',
      reason: 'forced by QQBOT_CHANNEL_MODE=tools',
    };
  }

  if (envMode === 'channel') {
    // 优先使用 Gateway 桥接
    if (isGatewayConfigured()) {
      return {
        mode: 'channel',
        channelSubMode: 'gateway-bridge',
        gatewayAvailable: true,
        nativeSupported,
        reason: 'forced by QQBOT_CHANNEL_MODE=channel, using gateway-bridge',
      };
    }
    if (nativeSupported) {
      return {
        mode: 'channel',
        channelSubMode: 'native',
        gatewayAvailable: false,
        nativeSupported: true,
        reason: 'forced by QQBOT_CHANNEL_MODE=channel, using native',
      };
    }
    console.warn('[qqbot-mcp] Channel mode forced but no backend available, falling back to Tools');
    return {
      mode: 'tools',
      reason: 'forced channel but no backend available',
    };
  }

  // 3. 配置文件指定 headless 模式
  if (globalConfig.workmode === 'headless') {
    return {
      mode: 'tools',
      reason: 'configured as headless mode in qqbot-config.json',
    };
  }

  // 4. 配置文件指定 channel 模式（默认）
  // 优先级: Gateway 桥接 > 原生 Channel > 降级

  if (isGatewayConfigured()) {
    return {
      mode: 'channel',
      channelSubMode: 'gateway-bridge',
      gatewayAvailable: true,
      nativeSupported,
      reason: 'auto-detected gateway-bridge mode',
    };
  }

  if (nativeSupported) {
    return {
      mode: 'channel',
      channelSubMode: 'native',
      gatewayAvailable: false,
      nativeSupported: true,
      reason: 'auto-detected native channel mode',
    };
  }

  // 5. 检查是否允许降级
  if (globalConfig.allowDegradation) {
    console.warn('[qqbot-mcp] Channel backend unavailable, degrading to tools mode (allowDegradation=true)');
    return {
      mode: 'tools',
      reason: 'degraded from channel to tools (allowDegradation=true)',
    };
  }

  // 6. 不允许降级，保持 channel 模式等待 Gateway
  return {
    mode: 'channel',
    channelSubMode: 'gateway-bridge',
    gatewayAvailable: false,
    nativeSupported: false,
    reason: 'waiting for gateway (allowDegradation=false)',
  };
}

// 保持向后兼容的函数
function getOperationMode(): OperationMode {
  const result = getOperationModeSync();
  return result.mode;
}

/** 当前运行模式 */
const operationMode = getOperationMode();

// Channel 模式的 instructions
const CHANNEL_INSTRUCTIONS = `
QQ Bot Channel - Real-time messaging from QQ to Claude Code

Messages arrive as channel notifications with this format:
- source: "qqbot"
- chat_id: Target ID for replies (user openid or group id)
- sender: Sender's nickname or openid
- type: "user" or "group"

To reply to messages:
1. Use the send_qq_message tool
2. Pass the chat_id from the channel notification as target_id
3. Provide your message content

For permission prompts (if enabled):
- Reply "yes <request_id>" to approve
- Reply "no <request_id>" to deny

Examples:
- Channel notification: { chat_id: "abc123", sender: "Alice", type: "user", content: "Hello" }
- Reply: send_qq_message(target_id: "abc123", content: "Hi Alice!")
`;

// MCP Tools 模式的 instructions
const TOOLS_INSTRUCTIONS = `
QQ Bot MCP Tools - Polling-based messaging from QQ to Claude Code

Use fetch_unread_tasks to check for new messages periodically.
Messages include sender info and context for replies.

To reply:
1. Use send_qq_message with target_id from the fetched task
2. Provide your message content
`;

// 创建 MCP Server 实例
const server = new Server(
  {
    name: 'qqbot-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      // Channel 模式添加 experimental capabilities
      ...(operationMode === 'channel' && {
        experimental: {
          'claude/channel': {},
          'claude/channel/permission': {},
        },
      }),
      tools: {},
    },
    // 添加 instructions
    instructions: operationMode === 'channel' ? CHANNEL_INSTRUCTIONS : TOOLS_INSTRUCTIONS,
  }
);

// 注册工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolDefinitions,
  };
});

// 注册工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  console.error(`[qqbot-mcp] Tool called: ${name}`);
  console.error(`[qqbot-mcp] Arguments:`, JSON.stringify(args, null, 2));

  const result = await handleToolCall(name, args || {});

  console.error(`[qqbot-mcp] Result:`, result.isError ? 'ERROR' : 'SUCCESS');

  // 返回符合 MCP 协议的响应格式
  return {
    content: result.content.map(c => {
      if (c.type === 'text') {
        return { type: 'text' as const, text: c.text || '' };
      }
      return { type: 'image' as const, data: c.data || '', mimeType: c.mimeType || 'image/png' };
    }),
    isError: result.isError,
  };
});

/**
 * 初始化机器人客户端
 */
function initializeBots(): void {
  // 先尝试从配置文件加载
  const bots = getAllBots();

  // 如果没有配置，尝试从环境变量加载
  if (Object.keys(bots).length === 0) {
    const envBot = loadFromEnv();
    if (envBot) {
      setBot(envBot);
      console.error(`[qqbot-mcp] Loaded bot from environment: ${envBot.name}`);
    }
  }

  // 初始化所有已配置的客户端
  Object.values(getAllBots()).forEach(bot => {
    if (bot.enabled) {
      const client = getClient(bot);
      client.startTokenRefresh();
      console.error(`[qqbot-mcp] Bot initialized: ${bot.name}`);
    }
  });
}

/**
 * 启动 MCP Server
 */
async function run(): Promise<void> {
  console.error('[qqbot-mcp] Starting QQ Bot MCP Server...');
  console.error(`[qqbot-mcp] Operation mode: ${operationMode}`);

  // 初始化机器人
  initializeBots();

  // Channel 模式：检测 Gateway 可用性
  if (operationMode === 'channel') {
    const gatewayAvailable = await checkGatewayAvailable();

    if (!gatewayAvailable) {
      console.error('[qqbot-mcp] ⚠️ Gateway 不可用');
      console.error('[qqbot-mcp] 请先启动 QQ Bot Gateway:');
      console.error('[qqbot-mcp]   node scripts/qqbot-service.js start --mode auto --channel');
      console.error('[qqbot-mcp] 或使用 skill:');
      console.error('[qqbot-mcp]   /qqbot-service start --mode auto --channel');
      console.error('[qqbot-mcp] MCP Server 将继续运行，但消息推送功能不可用');
      console.error('[qqbot-mcp] Gateway 启动后会自动重连');
    } else {
      console.error('[qqbot-mcp] ✅ Gateway 可用');
    }
  }

  // 创建 Stdio 传输层
  const transport = new StdioServerTransport();

  // 连接服务器
  await server.connect(transport);

  console.error('[qqbot-mcp] Server started successfully');

  // Channel 模式：启动推送器并注册到 Gateway
  if (operationMode === 'channel') {
    // 初始化权限中继模块
    initPermissionRelay(server);

    // 注册权限请求通知处理器
    // Claude Code 发送 notifications/claude/channel/permission_request 时触发
    server.setNotificationHandler(PermissionRequestSchema, async (notification) => {
      console.error(`[qqbot-mcp] 🔐 Received permission request: ${notification.params.request_id}`);
      console.error(`[qqbot-mcp]    Tool: ${notification.params.tool_name}`);
      await handlePermissionRequest({
        request_id: notification.params.request_id,
        tool_name: notification.params.tool_name,
        description: notification.params.description,
        input_preview: notification.params.input_preview,
      });
    });
    console.error('[qqbot-mcp] ✅ Permission request handler registered');

    // 启动 Channel 推送器
    startChannelPusher(server, {
      registerToGateway: true,
      interval: 1000,
      mergeMessages: true,
    });

    // 注册到 Gateway
    const sessionId = process.env.CLAUDE_SESSION_ID || generateSessionId();
    const projectPath = process.env.CLAUDE_PROJECT_PATH || process.cwd();
    const projectName = process.env.CLAUDE_PROJECT_NAME || projectPath.split('/').pop() || 'unknown';

    try {
      const registered = await registerChannel(sessionId, projectPath, projectName);
      if (registered) {
        console.error(`[qqbot-mcp] ✅ Registered to Gateway: ${sessionId}`);
        console.error(`[qqbot-mcp]    Project: ${projectName}`);
      } else {
        console.error(`[qqbot-mcp] ⚠️ Failed to register to Gateway, will use local queue only`);
      }
    } catch (error) {
      console.error(`[qqbot-mcp] ⚠️ Gateway registration error: ${error}`);
    }
  }

  console.error('[qqbot-mcp] Waiting for Claude Code requests...');
}

/**
 * 生成唯一会话 ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `session-${timestamp}-${random}`;
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('[qqbot-mcp] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[qqbot-mcp] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.error('[qqbot-mcp] Received SIGINT, shutting down...');

  // Channel 模式：停止推送器并注销
  if (operationMode === 'channel') {
    stopChannelPusher();
    if (isGatewayRegistered()) {
      await unregisterChannel();
    }
  }

  cleanupAllClients();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[qqbot-mcp] Received SIGTERM, shutting down...');

  // Channel 模式：停止推送器并注销
  if (operationMode === 'channel') {
    stopChannelPusher();
    if (isGatewayRegistered()) {
      await unregisterChannel();
    }
  }

  cleanupAllClients();
  process.exit(0);
});

// 启动服务
run().catch((error) => {
  console.error('[qqbot-mcp] Failed to start server:', error);
  process.exit(1);
});
