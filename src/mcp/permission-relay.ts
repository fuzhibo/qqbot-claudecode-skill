/**
 * Claude Code Channel 权限中继模块
 *
 * 实现权限请求从 Claude Code 推送到 QQ，以及用户回复处理
 *
 * 工作流程:
 * 1. Claude Code 需要权限批准时发送 permission_request
 * 2. Channel 推送权限请求到 QQ 管理员
 * 3. 管理员在 QQ 中回复 "yes <request_id>" 或 "no <request_id>"
 * 4. Channel 发送 permission verdict 给 Claude Code
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getActiveClients } from './qq-client.js';
import { getAllBots } from './config.js';
import type { BotConfig } from './types.js';

/** 权限请求 ID 格式: 5 个字母 (a-k, m-z) */
const PERMISSION_ID_PATTERN = /^[a-km-z]{5}$/;

/** 权限回复正则: yes/no + request_id */
const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i;

/** 待处理的权限请求 */
interface PendingPermissionRequest {
  /** 请求 ID */
  id: string;
  /** 工具名称 */
  toolName: string;
  /** 描述 */
  description: string;
  /** 输入预览 */
  inputPreview: string;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 (5 分钟) */
  expiresAt: number;
  /** 管理员 openid */
  adminOpenid?: string;
}

/** 权限请求存储 */
const pendingRequests = new Map<string, PendingPermissionRequest>();

/** 权限请求过期时间 (5 分钟) */
const REQUEST_EXPIRY_MS = 5 * 60 * 1000;

/** 管理员 openid 列表 (从配置读取) */
let adminOpenids: string[] = [];

/** MCP Server 实例 */
let mcpServer: Server | null = null;

/**
 * 初始化权限中继模块
 */
export function initPermissionRelay(
  server: Server,
  config?: { adminOpenids?: string[] }
): void {
  mcpServer = server;
  if (config?.adminOpenids) {
    adminOpenids = config.adminOpenids;
  }
  console.error('[permission-relay] Initialized');
}

/**
 * 生成权限请求 ID (5 个字母)
 */
function generateRequestId(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyz'; // 排除 l
  let id = '';
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * 清理过期的权限请求
 */
function cleanupExpiredRequests(): void {
  const now = Date.now();
  for (const [id, request] of pendingRequests.entries()) {
    if (request.expiresAt < now) {
      pendingRequests.delete(id);
      console.error(`[permission-relay] Expired request: ${id}`);
    }
  }
}

/**
 * 处理权限请求
 * 从 Claude Code 收到 permission_request 时调用
 */
export async function handlePermissionRequest(params: {
  request_id?: string;
  tool_name: string;
  description?: string;
  input_preview?: string;
}): Promise<{ success: boolean; request_id: string }> {
  cleanupExpiredRequests();

  // 生成或使用现有的请求 ID
  const requestId = params.request_id || generateRequestId();

  // 验证请求 ID 格式
  if (!PERMISSION_ID_PATTERN.test(requestId)) {
    // 如果格式不对，生成新的
    const newId = generateRequestId();
    console.warn(`[permission-relay] Invalid request_id ${requestId}, generated ${newId}`);
  }

  // 创建请求记录
  const request: PendingPermissionRequest = {
    id: requestId,
    toolName: params.tool_name,
    description: params.description || '',
    inputPreview: params.input_preview || '',
    createdAt: Date.now(),
    expiresAt: Date.now() + REQUEST_EXPIRY_MS,
  };

  pendingRequests.set(requestId, request);

  // 构建权限请求消息
  const message = `🔒 权限请求

工具: ${params.tool_name}
${params.description ? `描述: ${params.description}` : ''}
${params.input_preview ? `输入预览: ${params.input_preview.slice(0, 200)}${params.input_preview.length > 200 ? '...' : ''}` : ''}

请回复 "yes ${requestId}" 或 "no ${requestId}"`;

  // 发送到 QQ 管理员
  try {
    const clientsMap = getActiveClients();
    if (clientsMap.size === 0) {
      console.error('[permission-relay] No active clients to send permission request');
      return { success: false, request_id: requestId };
    }

    // 发送给所有管理员（或默认使用第一个可用客户端）
    for (const [botName, client] of clientsMap) {
      // 尝试获取默认目标
      const bots = getAllBots();
      const botConfig = bots[botName] as BotConfig | undefined;
      const targetId = botConfig?.defaultTargetId;

      if (targetId && adminOpenids.includes(targetId)) {
        await client.sendMessage(targetId, message);
        request.adminOpenid = targetId;
        console.error(`[permission-relay] Sent to admin ${targetId}`);
        break;
      }
    }

    // 如果没有特定管理员，发送到默认目标
    if (!request.adminOpenid && clientsMap.size > 0) {
      const firstEntry = clientsMap.entries().next().value;
      if (firstEntry) {
        const [botName, client] = firstEntry;
        const bots = getAllBots();
        const botConfig = bots[botName] as BotConfig | undefined;
        if (botConfig?.defaultTargetId) {
          await client.sendMessage(botConfig.defaultTargetId, message);
          request.adminOpenid = botConfig.defaultTargetId;
          console.error(`[permission-relay] Sent to default target ${botConfig.defaultTargetId}`);
        }
      }
    }

    return { success: true, request_id: requestId };
  } catch (error) {
    console.error('[permission-relay] Failed to send permission request:', error);
    return { success: false, request_id: requestId };
  }
}

/**
 * 处理 QQ 消息中的权限回复
 * 检测 "yes/no <request_id>" 格式的回复
 */
export async function handlePermissionReply(
  content: string,
  senderOpenid: string
): Promise<{ handled: boolean; request_id?: string; approved?: boolean }> {
  const match = content.match(PERMISSION_REPLY_RE);
  if (!match) {
    return { handled: false };
  }

  const [, answer, requestId] = match;
  const approved = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';

  // 查找请求
  const request = pendingRequests.get(requestId);
  if (!request) {
    console.warn(`[permission-relay] Unknown request ID: ${requestId}`);
    return { handled: false };
  }

  // 检查是否过期
  if (request.expiresAt < Date.now()) {
    pendingRequests.delete(requestId);
    console.warn(`[permission-relay] Request ${requestId} already expired`);
    return { handled: false };
  }

  // 验证发送者（可选：只有管理员才能回复）
  // if (request.adminOpenid && request.adminOpenid !== senderOpenid) {
  //   console.warn(`[permission-relay] Sender ${senderOpenid} not authorized for request ${requestId}`);
  //   return { handled: false };
  // }

  // 发送权限裁决到 Claude Code
  // 官方格式: { request_id, behavior: 'allow' | 'deny' }
  if (mcpServer) {
    try {
      await mcpServer.notification({
        method: 'notifications/claude/channel/permission',
        params: {
          request_id: requestId,
          behavior: approved ? 'allow' : 'deny',
        },
      });

      console.error(`[permission-relay] Sent verdict: ${approved ? 'allow' : 'deny'} for ${requestId}`);
    } catch (error) {
      console.error('[permission-relay] Failed to send verdict:', error);
    }
  }

  // 清理请求
  pendingRequests.delete(requestId);

  return { handled: true, request_id: requestId, approved };
}

/**
 * 检查消息是否是权限回复
 */
export function isPermissionReply(content: string): boolean {
  return PERMISSION_REPLY_RE.test(content.trim());
}

/**
 * 获取待处理的权限请求数量
 */
export function getPendingRequestCount(): number {
  cleanupExpiredRequests();
  return pendingRequests.size;
}

/**
 * 获取所有待处理的权限请求
 */
export function getPendingRequests(): PendingPermissionRequest[] {
  cleanupExpiredRequests();
  return Array.from(pendingRequests.values());
}

/**
 * 设置管理员列表
 */
export function setAdminOpenids(openids: string[]): void {
  adminOpenids = openids;
  console.error(`[permission-relay] Admin list updated: ${openids.length} users`);
}

/**
 * 获取管理员列表
 */
export function getAdminOpenids(): string[] {
  return [...adminOpenids];
}
