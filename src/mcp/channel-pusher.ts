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
import { fetchAllUnreadTasks, clearReadMessages } from './message-queue.js';
import type { PendingTask } from './types.js';

/** Gateway API 地址 */
const GATEWAY_API_URL = process.env.QQBOT_GATEWAY_URL || 'http://127.0.0.1:3310';

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
 * 发送单个 Channel notification
 */
async function sendChannelNotification(
  server: Server,
  params: ChannelNotificationParams
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
    console.error('[channel-pusher] Failed to send notification:', error);
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
 * 检查并推送新消息
 */
async function checkAndPush(): Promise<void> {
  if (!mcpServer || !isRunning) return;

  try {
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

  // 如果配置了注册到 Gateway 且有 sessionId，则注册
  if (config.registerToGateway && sessionId) {
    registerChannel(sessionId, projectPath ?? process.cwd(), projectName ?? undefined).then(success => {
      if (success) {
        console.error('[channel-pusher] ✅ Registered to Gateway successfully');
      } else {
        console.error('[channel-pusher] ⚠️ Failed to register to Gateway');
      }
    }).catch(err => {
      console.error(`[channel-pusher] ❌ Gateway registration error: ${err}`);
    });
  }
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
    const response = await fetch(`${GATEWAY_API_URL}/api/channels/register`, {
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
    const response = await fetch(
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
    const response = await fetch(url);

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
    await fetch(url, { method: 'DELETE' });
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

