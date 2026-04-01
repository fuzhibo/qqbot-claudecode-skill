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
import { loadFromEnv, setBot, getAllBots, loadGlobalConfig, loadEnvFromFile } from './config.js';
import { getClient, cleanupAllClients } from './qq-client.js';
import {
  startChannelPusher,
  stopChannelPusher,
  registerChannel,
  unregisterChannel,
  isGatewayRegistered,
} from './channel-pusher.js';
import { initPermissionRelay, handlePermissionRequest } from './permission-relay.js';
import {
  getModeRegistry,
  getOperationMode,
  getModeConfig,
  setMode,
  detectAndSetMode,
  setGatewayAvailable,
  setSessionInfo,
  getSessionPrefix,
  loadEnvUnified,
  type OperationMode,
  type ModeConfig,
} from './mode-registry.js';
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

// 🔴 关键: 在模块加载时立即从 envFile 加载环境变量
// 这必须在 getOperationMode() 之前执行，以确保模式检测能访问到配置
loadEnvFromFile();

/** Gateway API 地址 */
const GATEWAY_API_URL = process.env.QQBOT_GATEWAY_URL || 'http://127.0.0.1:3310';

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
 * 获取运行模式 (使用统一模式注册中心)
 */
function getOperationModeSync(): ModeConfig {
  return getModeConfig();
}

// getOperationMode 已从 mode-registry.js 导入，无需重复定义

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

  // 初始化机器人
  initializeBots();

  // 检测 Gateway 可用性
  const gatewayAvailable = await checkGatewayAvailable();

  // 使用统一模式注册中心检测并设置模式
  const modeConfig = detectAndSetMode(gatewayAvailable, true);
  console.error(`[qqbot-mcp] Operation mode: ${modeConfig.mode} (source: ${modeConfig.source})`);
  if (modeConfig.reason) {
    console.error(`[qqbot-mcp] Reason: ${modeConfig.reason}`);
  }

  // Channel 模式：检测 Gateway 可用性
  if (operationMode === 'channel') {
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

    // 🔴 关键: 将会话信息写入 ModeRegistry (用于消息前缀)
    setSessionInfo(sessionId, projectPath, projectName);
    console.error(`[qqbot-mcp] Session ID: ${sessionId.slice(0, 8)}...`);

    // 在注册前，先清理同路径的旧注册（避免僵尸 Channel）
    try {
      const cleanupUrl = `${GATEWAY_API_URL}/api/channels/by-path?path=${encodeURIComponent(projectPath)}`;
      const cleanupResponse = await fetch(cleanupUrl, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000)
      });
      if (cleanupResponse.ok) {
        const result = await cleanupResponse.json() as { cleaned?: number };
        if (result.cleaned && result.cleaned > 0) {
          console.error(`[qqbot-mcp] 🧹 Cleaned up ${result.cleaned} old registration(s) for project path`);
        }
      }
    } catch (error) {
      console.error('[qqbot-mcp] Failed to cleanup old registrations:', error);
      // 继续执行，不阻塞启动
    }

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

/**
 * 优雅关闭函数（提取公共逻辑）
 * @param signal - 触发关闭的信号
 * @param exitCode - 退出码
 */
async function gracefulShutdown(signal: string, exitCode: number = 0): Promise<void> {
  console.error(`[qqbot-mcp] Received ${signal}, shutting down...`);

  // Channel 模式：停止推送器并注销
  if (operationMode === 'channel') {
    stopChannelPusher();
    if (isGatewayRegistered()) {
      try {
        await unregisterChannel();
      } catch (error) {
        console.error('[qqbot-mcp] Failed to unregister channel:', error);
      }
    }
  }

  cleanupAllClients();
  process.exit(exitCode);
}

// 错误处理 - 使用优雅关闭
process.on('uncaughtException', async (error) => {
  console.error('[qqbot-mcp] Uncaught exception:', error);
  await gracefulShutdown('uncaughtException', 1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[qqbot-mcp] Unhandled rejection at:', promise, 'reason:', reason);
  await gracefulShutdown('unhandledRejection', 1);
});

// 优雅关闭信号处理
process.on('SIGINT', async () => {
  await gracefulShutdown('SIGINT', 0);
});

process.on('SIGTERM', async () => {
  await gracefulShutdown('SIGTERM', 0);
});

// 事件循环清空时的处理（备用清理）
process.on('beforeExit', async () => {
  if (operationMode === 'channel' && isGatewayRegistered()) {
    console.error('[qqbot-mcp] Event loop empty, performing cleanup...');
    try {
      await unregisterChannel();
    } catch (error) {
      console.error('[qqbot-mcp] Cleanup error:', error);
    }
  }
});

// 启动服务
run().catch((error) => {
  console.error('[qqbot-mcp] Failed to start server:', error);
  process.exit(1);
});
