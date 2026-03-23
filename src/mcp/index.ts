#!/usr/bin/env node

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
import { loadFromEnv, setBot, getAllBots } from './config.js';
import { getClient, cleanupAllClients } from './qq-client.js';

// ============ 版本检测与模式切换 ============

/** Channel 模式所需的最低 Claude Code 版本 */
const MIN_CHANNEL_VERSION = '2.1.80';

/** 运行模式类型 */
type OperationMode = 'channel' | 'tools';

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
 * 检测 Claude Code 版本是否支持 Channel 模式
 */
function supportsChannel(version: string | undefined): boolean {
  const current = parseVersion(version);
  const required = parseVersion(MIN_CHANNEL_VERSION);
  if (!current || !required) return false;
  return compareVersions(current, required) >= 0;
}

/**
 * 获取运行模式
 * 优先级: 环境变量 > 自动检测
 */
function getOperationMode(): OperationMode {
  const envMode = process.env.QQBOT_CHANNEL_MODE?.toLowerCase();

  // 强制指定模式
  if (envMode === 'tools') {
    console.error('[qqbot-mcp] Mode: MCP Tools (forced by env)');
    return 'tools';
  }

  if (envMode === 'channel') {
    // 强制 Channel 模式，但仍需验证版本
    if (supportsChannel(process.env.CLAUDE_CODE_VERSION)) {
      console.error('[qqbot-mcp] Mode: Channel (forced by env)');
      return 'channel';
    }
    console.warn('[qqbot-mcp] Channel mode forced but version not satisfied, falling back to Tools');
    return 'tools';
  }

  // auto 或未设置：自动检测
  if (supportsChannel(process.env.CLAUDE_CODE_VERSION)) {
    console.error('[qqbot-mcp] Mode: Channel (auto-detected)');
    return 'channel';
  }

  console.error('[qqbot-mcp] Mode: MCP Tools (version not supported)');
  return 'tools';
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

  // 初始化机器人
  initializeBots();

  // 创建 Stdio 传输层
  const transport = new StdioServerTransport();

  // 连接服务器
  await server.connect(transport);

  console.error('[qqbot-mcp] Server started successfully');
  console.error('[qqbot-mcp] Waiting for Claude Code requests...');
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
process.on('SIGINT', () => {
  console.error('[qqbot-mcp] Received SIGINT, shutting down...');
  cleanupAllClients();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[qqbot-mcp] Received SIGTERM, shutting down...');
  cleanupAllClients();
  process.exit(0);
});

// 启动服务
run().catch((error) => {
  console.error('[qqbot-mcp] Failed to start server:', error);
  process.exit(1);
});
