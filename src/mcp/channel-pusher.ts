/**
 * Claude Code Channel 消息推送模块
 *
 * 实现事件驱动的消息推送机制，将 QQ 消息实时推送到 Claude Code
 * 通过 MCP notification 机制实现
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { fetchAllUnreadTasks, clearReadMessages } from './message-queue.js';
import type { PendingTask } from './types.js';

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
}

/** 默认配置 */
const DEFAULT_CONFIG: Required<ChannelPusherConfig> = {
  interval: 1000,
  mergeMessages: true,
  maxMergeCount: 5,
};

/** 推送器状态 */
let pusherInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let mcpServer: Server | null = null;
let config = DEFAULT_CONFIG;

/**
 * 将队列消息转换为 Channel 消息格式
 */
function toChannelMessage(task: PendingTask): ChannelNotificationParams {
  // 判断消息类型
  const isGroup = task.sourceType === 'group' || task.sourceType === 'channel';
  const type: 'user' | 'group' = isGroup ? 'group' : 'user';

  // 构建 chat_id (添加前缀)
  let chatId = task.sourceId;
  if (!chatId.match(/^[GUC]_/)) {
    // 根据类型添加前缀
    if (task.sourceType === 'group') {
      chatId = `G_${chatId}`;
    } else if (task.sourceType === 'c2c') {
      chatId = `U_${chatId}`;
    } else if (task.sourceType === 'channel') {
      chatId = `C_${chatId}`;
    }
  }

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
    // 从消息队列获取未读任务
    const tasks = fetchAllUnreadTasks();

    if (tasks.length === 0) return;

    console.error(`[channel-pusher] Processing ${tasks.length} messages`);

    // 批量发送
    const sentCount = await sendBatchNotifications(mcpServer, tasks);

    // 清除已推送的消息
    if (sentCount > 0) {
      clearReadMessages();
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
}

/**
 * 停止 Channel 推送器
 */
export function stopChannelPusher(): void {
  if (!isRunning) {
    return;
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
