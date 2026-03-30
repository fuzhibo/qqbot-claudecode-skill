/**
 * Claude Code Channel 消息推送模块
 *
 * 实现事件驱动的消息推送机制，将 QQ 消息实时推送到 Claude Code
 * 通过 MCP notification 机制实现
 *
 * 支持 Gateway 注册模式：
 * - 向 Gateway 注册 Channel
 * - 轮询 Gateway 获取本 Channel 的消息
 * - 关闭时注销 Channel
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import WebSocket from 'ws';
import { fetchAllUnreadTasks, clearReadMessages } from './message-queue.js';
import { handlePermissionReply, isPermissionReply } from './permission-relay.js';
import type { PendingTask } from './types.js';

/** Gateway API 地址 */
const GATEWAY_API_URL = process.env.QQBOT_GATEWAY_URL || 'http://127.0.0.1:3310';

/** Gateway WebSocket 地址 */
const GATEWAY_WS_URL = process.env.QQBOT_GATEWAY_WS_URL || 'ws://127.0.0.1:3311';

/** Channel 消息元数据 */
interface ChannelMeta {
  /** 聊天 ID (用于回复) */
  chat_id: string;
  /** 发送者名称或 openid */
  sender: string;
  /** 消息类型: user (私聊) 或 group (群聊) */
  type: 'user' | 'group';
  /** 消息 ID (可选，用于引用回复) */
  message_id?: string;
  /** 时间戳 */
  timestamp?: number;
}

/** Channel notification 参数 */
interface ChannelNotificationParams {
  /** 消息内容 */
  content: string;
  /** 元数据 */
  meta: ChannelMeta;
}

/** 推送配置 */
interface ChannelPusherConfig {
  /** 检查间隔 (毫秒)，默认 1000ms */
  interval?: number;
  /** 批量推送时是否合并消息 */
  mergeMessages?: boolean;
  /** 合并消息的最大条数 */
  maxMergeCount?: number;
  /** 是否注册到 Gateway */
  registerToGateway?: boolean;
}

/** 默认配置 */
const DEFAULT_CONFIG: Required<ChannelPusherConfig> = {
  interval: 200,  // 降低到 200ms 以减少延迟
  mergeMessages: true,
  maxMergeCount: 5,
  registerToGateway: true,
};

/** Gateway API 超时配置 */
const FETCH_TIMEOUT = 10000; // 10 秒超时

/** 消息投递重试配置 */
const RETRY_CONFIG = {
  maxRetries: 3,
  retryIntervalMs: 5000, // 5 秒间隔
};

/**
 * 带超时保护的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 推送器状态 */
let pusherInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let mcpServer: Server | null = null;
let config = DEFAULT_CONFIG;

/** Gateway 注册状态 */
let sessionId: string | null = null;
let projectPath: string | null = null;
let projectName: string | null = null;
let isRegisteredWithGateway = false;

/** WebSocket 客户端状态 */
let wsClient: WebSocket | null = null;
let wsConnected = false;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

/** HTTP 心跳计数器 */
let heartbeatCounter = 0;

/**
 * 连接到 Gateway WebSocket
 */
async function connectToGatewayWebSocket(): Promise<void> {
  if (wsClient && wsConnected) {
    return; // 已连接
  }

  return new Promise((resolve, reject) => {
    try {
      console.error(`[channel-pusher] Connecting to Gateway WebSocket: ${GATEWAY_WS_URL}`);
      wsClient = new WebSocket(GATEWAY_WS_URL);

      wsClient.on('open', () => {
        console.error('[channel-pusher] ✅ WebSocket connected');
        wsConnected = true;

        // 发送注册消息
        if (sessionId) {
          wsClient!.send(JSON.stringify({
            type: 'register',
            sessionId
          }));
        }

        // 启动心跳
        startHeartbeat();

        resolve();
      });

      wsClient.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'registered') {
            console.error(`[channel-pusher] ✅ Registered to Gateway WS: ${msg.sessionId?.slice(0, 12)}...`);
          } else if (msg.type === 'channel_message') {
            // 收到实时消息，直接推送
            handleRealtimeMessage(msg.data);
          } else if (msg.type === 'pong') {
            // 心跳响应
          }
        } catch (e) {
          console.error('[channel-pusher] Invalid WS message:', e);
        }
      });

      wsClient.on('close', () => {
        console.error('[channel-pusher] ⚠️ WebSocket disconnected');
        wsConnected = false;
        wsClient = null;
        stopHeartbeat();
        scheduleReconnect();
      });

      wsClient.on('error', (err) => {
        console.error('[channel-pusher] ❌ WebSocket error:', err.message);
        wsConnected = false;
        reject(err);
      });
    } catch (e) {
      reject(e);
    }
  });
}

/** 心跳定时器 */
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    if (wsClient && wsConnected) {
      wsClient.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000); // 30 秒心跳
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleReconnect(): void {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    if (isRunning && sessionId) {
      console.error('[channel-pusher] 🔄 Attempting WebSocket reconnect...');
      connectToGatewayWebSocket().catch(e => {
        console.error('[channel-pusher] Reconnect failed:', e.message);
      });
    }
  }, 3000); // 3 秒后重连
}

/**
 * 处理实时消息（WebSocket 推送）
 */
async function handleRealtimeMessage(msg: any): Promise<void> {
  if (!mcpServer || !isRunning) return;

  try {
    const content = msg.content || msg.message || '';
    const sender = msg.sender || msg.authorId || 'Unknown';

    // 检测是否是权限回复
    if (isPermissionReply(content)) {
      const result = await handlePermissionReply(content, sender);
      if (result.handled) {
        console.error(`[channel-pusher] 🔐 Permission reply handled: ${result.request_id} -> ${result.approved ? 'approved' : 'denied'}`);
        return; // 权限回复已处理，不再作为普通消息推送
      }
    }

    // 转换为 Channel notification 格式
    const notification: ChannelNotificationParams = {
      content,
      meta: {
        chat_id: msg.chatId || msg.sourceId || '',
        sender,
        type: msg.type || 'user',
        message_id: msg.message_id || msg.id,
        timestamp: msg.timestamp || Date.now()
      }
    };

    await sendChannelNotification(mcpServer, notification);
    console.error(`[channel-pusher] ⚡ Real-time push: ${content.slice(0, 30)}...`);
  } catch (e) {
    console.error('[channel-pusher] Real-time push error:', e);
  }
}

/**
 * 添加 chat_id 前缀（内部函数，用户无需关心）
 * @param sourceId - 原始 ID
 * @param sourceType - 来源类型 (group/c2c/channel/private)
 * @returns 带前缀的 chat_id
 */
function addChatIdPrefix(sourceId: string, sourceType: string): string {
  // 已有前缀，直接返回
  if (sourceId.match(/^[GUC]_/)) {
    return sourceId;
  }

  // 根据类型添加前缀
  if (sourceType === 'group') {
    return `G_${sourceId}`;
  } else if (sourceType === 'c2c' || sourceType === 'private') {
    return `U_${sourceId}`;
  } else if (sourceType === 'channel') {
    return `C_${sourceId}`;
  }

  return sourceId;
}

/**
 * 将队列消息转换为 Channel 消息格式
 */
function toChannelMessage(task: PendingTask): ChannelNotificationParams {
  // 判断消息类型
  const isGroup = task.sourceType === 'group' || task.sourceType === 'channel';
  const type: 'user' | 'group' = isGroup ? 'group' : 'user';

  // 构建 chat_id (添加前缀) - 使用复用函数
  const chatId = addChatIdPrefix(task.sourceId, task.sourceType);

  return {
    content: task.content,
    meta: {
      chat_id: chatId,
      sender: task.authorId || 'Unknown',
      type,
      message_id: task.id,
      timestamp: task.timestamp,
    },
  };
}

/**
 * 发送单个 Channel notification (带重试)
 */
async function sendChannelNotification(
  server: Server,
  params: ChannelNotificationParams,
  retries: number = 0
): Promise<void> {
  try {
    await server.notification({
      method: 'notifications/claude/channel',
      params: {
        content: params.content,
        meta: params.meta,
      },
    });

    console.error(`[channel-pusher] Sent to ${params.meta.chat_id} from ${params.meta.sender}`);
  } catch (error) {
    if (retries < RETRY_CONFIG.maxRetries) {
      console.error(`[channel-pusher] 发送失败，${RETRY_CONFIG.retryIntervalMs / 1000}秒后重试 (${retries + 1}/${RETRY_CONFIG.maxRetries})`);
      await sleep(RETRY_CONFIG.retryIntervalMs);
      return sendChannelNotification(server, params, retries + 1);
    }
    console.error('[channel-pusher] Failed to send notification after retries:', error);
    throw error;
  }
}

/**
 * 发送批量 Channel notifications
 */
async function sendBatchNotifications(
  server: Server,
  tasks: PendingTask[]
): Promise<number> {
  if (tasks.length === 0) return 0;

  // 如果配置了合并且消息来自同一聊天，尝试合并
  if (config.mergeMessages && tasks.length > 1) {
    const grouped = groupMessagesByChat(tasks);

    for (const [chatId, msgs] of grouped.entries()) {
      if (msgs.length === 1) {
        // 单条消息直接发送
        await sendChannelNotification(server, toChannelMessage(msgs[0]));
      } else {
        // 多条消息合并发送
        const merged = mergeMessages(msgs);
        await sendChannelNotification(server, merged);
      }
    }

    return tasks.length;
  }

  // 不合并，逐条发送
  for (const task of tasks) {
    await sendChannelNotification(server, toChannelMessage(task));
  }

  return tasks.length;
}

/**
 * 按聊天 ID 分组消息
 */
function groupMessagesByChat(tasks: PendingTask[]): Map<string, PendingTask[]> {
  const grouped = new Map<string, PendingTask[]>();

  for (const task of tasks) {
    const chatId = task.sourceId;
    if (!grouped.has(chatId)) {
      grouped.set(chatId, []);
    }
    grouped.get(chatId)!.push(task);
  }

  return grouped;
}

/**
 * 合并同一聊天的多条消息
 */
function mergeMessages(tasks: PendingTask[]): ChannelNotificationParams {
  if (tasks.length === 0) {
    throw new Error('Cannot merge empty messages');
  }

  const first = tasks[0];
  const isGroup = first.sourceType === 'group' || first.sourceType === 'channel';

  // 合并内容
  const mergedContent = tasks
    .map((task) => {
      const sender = task.authorId || 'User';
      // 如果来自不同发送者，添加发送者标识
      if (tasks.length > 1 && tasks.some(t => t.authorId !== first.authorId)) {
        return `[${sender}] ${task.content}`;
      }
      return task.content;
    })
    .join('\n---\n');

  // 构建 chat_id
  let chatId = first.sourceId;
  if (!chatId.match(/^[GUC]_/)) {
    if (first.sourceType === 'group') {
      chatId = `G_${chatId}`;
    } else if (first.sourceType === 'c2c') {
      chatId = `U_${chatId}`;
    } else if (first.sourceType === 'channel') {
      chatId = `C_${chatId}`;
    }
  }

  return {
    content: `📬 收到 ${tasks.length} 条消息:\n\n${mergedContent}`,
    meta: {
      chat_id: chatId,
      sender: first.authorId || 'Multiple',
      type: isGroup ? 'group' : 'user',
      timestamp: Date.now(),
    },
  };
}

/**
 * 发送 HTTP 心跳到 Gateway（作为 WebSocket 心跳的备份）
 */
async function sendHeartbeat(): Promise<boolean> {
  if (!isRegisteredWithGateway || !sessionId) {
    return false;
  }

  try {
    const response = await fetchWithTimeout(
      `${GATEWAY_API_URL}/api/channels/${encodeURIComponent(sessionId)}/heartbeat`,
      { method: 'POST' }
    );

    if (!response.ok) {
      // Channel 可能已被清理，尝试重新注册
      if (response.status === 404) {
        console.error('[channel-pusher] Channel not found at Gateway, marking for re-registration...');
        isRegisteredWithGateway = false;
        return false;
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('[channel-pusher] HTTP heartbeat failed:', error);
    return false;
  }
}

/**
 * 检查并推送新消息
 */
async function checkAndPush(): Promise<void> {
  if (!mcpServer || !isRunning) return;

  try {
    // 0. 发送 HTTP 心跳 (每 10 次轮询发送一次)
    if (heartbeatCounter % 10 === 0) {
      await sendHeartbeat();
    }
    heartbeatCounter++;

    let totalSent = 0;

    // 1. 从本地消息队列获取未读任务
    const localTasks = fetchAllUnreadTasks();
    if (localTasks.length > 0) {
      console.error(`[channel-pusher] Processing ${localTasks.length} local messages`);
      const sentCount = await sendBatchNotifications(mcpServer, localTasks);
      if (sentCount > 0) {
        clearReadMessages();
        totalSent += sentCount;
      }
    }

    // 2. 如果已注册到 Gateway，也从 Gateway 获取消息
    if (config.registerToGateway && isRegisteredWithGateway) {
      const gatewayMessages = await fetchChannelMessages(10);
      if (gatewayMessages.length > 0) {
        console.error(`[channel-pusher] Processing ${gatewayMessages.length} Gateway messages`);
        // Gateway 消息已经是 ChannelNotificationParams 格式，直接发送
        for (const msg of gatewayMessages) {
          await sendChannelNotification(mcpServer, msg);
          totalSent++;
        }
      }
    }

    if (totalSent > 0) {
      console.error(`[channel-pusher] Total sent: ${totalSent} messages`);
    }
  } catch (error) {
    console.error('[channel-pusher] Error in checkAndPush:', error);
  }
}

/**
 * 启动 Channel 推送器
 */
export function startChannelPusher(
  server: Server,
  customConfig?: ChannelPusherConfig
): void {
  if (isRunning) {
    console.warn('[channel-pusher] Already running');
    return;
  }

  // 应用配置
  if (customConfig) {
    config = { ...DEFAULT_CONFIG, ...customConfig };
  }

  mcpServer = server;
  isRunning = true;

  // 启动定时检查
  pusherInterval = setInterval(checkAndPush, config.interval);

  console.error(`[channel-pusher] Started (interval: ${config.interval}ms)`);

  // 设置进程退出时的优雅关闭
  setupGracefulShutdown();

  // 如果配置了注册到 Gateway 且有 sessionId，则注册
  if (config.registerToGateway && sessionId) {
    registerChannel(sessionId, projectPath ?? process.cwd(), projectName ?? undefined).then(success => {
      if (success) {
        console.error('[channel-pusher] ✅ Registered to Gateway successfully');

        // 尝试建立 WebSocket 实时连接
        connectToGatewayWebSocket().then(() => {
          console.error('[channel-pusher] ✅ WebSocket real-time connection established');
        }).catch(err => {
          console.error(`[channel-pusher] ⚠️ WebSocket connection failed, falling back to polling: ${err.message}`);
        });
      } else {
        console.error('[channel-pusher] ⚠️ Failed to register to Gateway');
      }
    }).catch(err => {
      console.error(`[channel-pusher] ❌ Gateway registration error: ${err}`);
    });
  }
}

/** 优雅关闭标志，避免重复处理 */
let shutdownHandled = false;

/**
 * 设置进程退出时的优雅关闭
 */
function setupGracefulShutdown(): void {
  const handleShutdown = async (signal: string) => {
    if (shutdownHandled) return;
    shutdownHandled = true;

    console.error(`[channel-pusher] Received ${signal}, shutting down gracefully...`);

    try {
      await stopChannelPusher();
      console.error('[channel-pusher] ✅ Graceful shutdown complete');
    } catch (err) {
      console.error('[channel-pusher] ❌ Error during shutdown:', err);
    }

    // 给一点时间让日志输出完成
    setTimeout(() => process.exit(0), 100);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGHUP', () => handleShutdown('SIGHUP'));
}

/**
 * 停止 Channel 推送器
 */
export async function stopChannelPusher(): Promise<void> {
  if (!isRunning) {
    return;
  }

  // 先从 Gateway 注销
  if (isRegisteredWithGateway) {
    await unregisterChannel();
  }

  if (pusherInterval) {
    clearInterval(pusherInterval);
    pusherInterval = null;
  }

  isRunning = false;
  mcpServer = null;

  console.error('[channel-pusher] Stopped');
}

/**
 * 检查推送器是否运行中
 */
export function isPusherRunning(): boolean {
  return isRunning;
}

/**
 * 获取推送器状态
 */
export function getPusherStatus(): {
  running: boolean;
  interval: number;
  mergeEnabled: boolean;
} {
  return {
    running: isRunning,
    interval: config.interval,
    mergeEnabled: config.mergeMessages,
  };
}

/**
 * 手动触发一次推送（用于测试）
 */
export async function triggerPush(): Promise<number> {
  if (!mcpServer) {
    throw new Error('Pusher not initialized');
  }

  const tasks = fetchAllUnreadTasks();
  if (tasks.length === 0) return 0;

  return sendBatchNotifications(mcpServer, tasks);
}

// ============ Gateway 注册相关函数 ============

/**
 * 向 Gateway 注册 Channel
 * @param sid - 会话 ID
 * @param pPath - 项目路径
 * @param pName - 项目名称（可选）
 */
export async function registerChannel(
  sid: string,
  pPath: string,
  pName?: string
): Promise<boolean> {
  sessionId = sid;
  projectPath = pPath;
  projectName = pName || pPath.split('/').pop() || 'unknown';

  if (!config.registerToGateway) {
    console.error('[channel-pusher] Gateway registration disabled by config');
    return false;
  }

  try {
    const response = await fetchWithTimeout(`${GATEWAY_API_URL}/api/channels/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        projectPath,
        projectName,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.status === 'registered') {
      isRegisteredWithGateway = true;
      console.error(`[channel-pusher] ✅ Channel 已注册到 Gateway: ${sessionId}`);
      console.error(`[channel-pusher]    项目: ${projectName}`);
      console.error(`[channel-pusher]    默认: ${result.isDefault ? '是' : '否'}`);

      // 显示 Channel 模式提醒
      console.error('');
      console.error('[channel-pusher] ⚠️ Channel 模式已激活，QQ 消息将推送到当前会话');
      console.error('[channel-pusher] 如有多人会话请注意消息管理，或使用 unidirectional 模式');

      return true;
    }

    console.error(`[channel-pusher] ❌ 注册失败: ${result.error}`);
    return false;
  } catch (error) {
    console.error(`[channel-pusher] ❌ 注册请求失败: ${error}`);
    return false;
  }
}

/**
 * 从 Gateway 注销 Channel
 */
export async function unregisterChannel(): Promise<boolean> {
  if (!isRegisteredWithGateway || !sessionId) {
    return true; // 未注册，无需注销
  }

  try {
    const response = await fetchWithTimeout(
      `${GATEWAY_API_URL}/api/channels/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.status === 'unregistered') {
      console.error(`[channel-pusher] ✅ Channel 已从 Gateway 注销: ${sessionId}`);
      isRegisteredWithGateway = false;
      sessionId = null;
      projectPath = null;
      projectName = null;
      return true;
    }

    console.error(`[channel-pusher] ❌ 注销失败: ${result.error}`);
    return false;
  } catch (error) {
    console.error(`[channel-pusher] ❌ 注销请求失败: ${error}`);
    return false;
  }
}

/**
 * 从 Gateway 获取本 Channel 的消息
 * @param limit - 最大获取数量
 */
export async function fetchChannelMessages(
  limit: number = 10
): Promise<ChannelNotificationParams[]> {
  if (!isRegisteredWithGateway || !sessionId) {
    return [];
  }

  try {
    const url = `${GATEWAY_API_URL}/api/messages?channel=${encodeURIComponent(sessionId)}&limit=${limit}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.messages && result.messages.length > 0) {
      // 标记消息为已读
      const messageIds = result.messages.map((m: any) => m.id);
      await markMessagesDelivered(messageIds);

      // 转换为 ChannelNotificationParams 格式
      return result.messages.map((msg: any) => ({
        content: msg.content,
        meta: {
          chat_id: addChatIdPrefix(msg.sourceId, msg.sourceType),  // 使用复用函数添加前缀
          sender: msg.authorNickname || msg.authorId,
          type: msg.sourceType === 'group' ? 'group' : 'user',
          message_id: msg.msgId,
          timestamp: msg.timestamp,
        },
      }));
    }

    return [];
  } catch (error) {
    console.error(`[channel-pusher] ❌ 获取消息失败: ${error}`);
    return [];
  }
}

/**
 * 标记消息为已读
 */
async function markMessagesDelivered(messageIds: string[]): Promise<void> {
  if (!sessionId || messageIds.length === 0) return;

  try {
    const url = `${GATEWAY_API_URL}/api/messages?channel=${encodeURIComponent(sessionId)}&ids=${messageIds.join(',')}`;
    await fetchWithTimeout(url, { method: 'DELETE' });
  } catch (error) {
    console.error(`[channel-pusher] ⚠️ 标记消息已读失败: ${error}`);
  }
}

/**
 * 检查是否已注册到 Gateway
 */
export function isGatewayRegistered(): boolean {
  return isRegisteredWithGateway;
}

/**
 * 获取当前 Channel 信息
 */
export function getChannelInfo(): {
  sessionId: string | null;
  projectPath: string | null;
  projectName: string | null;
  isRegistered: boolean;
} {
  return {
    sessionId,
    projectPath,
    projectName,
    isRegistered: isRegisteredWithGateway,
  };
}

