#!/usr/bin/env node

/**
 * QQ Bot MCP Server - Claude Code MCP 协议入口
 *
 * 此模块实现 MCP (Model Context Protocol) 协议，
 * 允许 Claude Code 通过标准化接口与 QQ 机器人交互。
 *
 * 使用方式:
 * 1. 作为 MCP Server 运行: node dist/mcp/index.js
 * 2. 配置到 Claude Code: 在 claude_desktop_config.json 中添加
 *
 * 支持的工具:
 * - get_active_bots: 获取可用机器人列表
 * - send_qq_message: 发送文本消息
 * - upload_qq_media: 上传并发送媒体文件
 * - fetch_unread_tasks: 获取未读任务
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
import { getClient } from './qq-client.js';

// 创建 MCP Server 实例
const server = new Server(
  {
    name: 'qqbot-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
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
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[qqbot-mcp] Received SIGTERM, shutting down...');
  process.exit(0);
});

// 启动服务
run().catch((error) => {
  console.error('[qqbot-mcp] Failed to start server:', error);
  process.exit(1);
});
