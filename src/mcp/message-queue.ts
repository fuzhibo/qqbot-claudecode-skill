/**
 * 消息队列管理 - 用于接收 QQ -> Claude 的消息
 *
 * 由于 MCP 是通过 Stdio 通信的，无法主动推送消息
 * 采用轮询模式：QQ 消息暂存在内存队列，Claude 通过 fetch_unread_tasks 获取
 */

import * as crypto from 'crypto';
import type { PendingTask, MessageContext, TargetType } from './types.js';

// 全局消息队列（按机器人名称分组）
const messageQueues = new Map<string, PendingTask[]>();

// 已处理消息 ID 集合（幂等性保证）
const processedMessageIds = new Set<string>();

// 最大队列长度
const MAX_QUEUE_SIZE = 1000;

// 已处理消息 ID 最大保留数量
const MAX_PROCESSED_IDS = 10000;

/**
 * 生成消息唯一 ID
 */
function generateMessageId(botName: string, sourceId: string, timestamp: number, content: string): string {
  const hash = crypto.createHash('md5');
  hash.update(`${botName}:${sourceId}:${timestamp}:${content}`);
  return hash.digest('hex');
}

/**
 * 确保队列存在
 */
function ensureQueue(botName: string): PendingTask[] {
  if (!messageQueues.has(botName)) {
    messageQueues.set(botName, []);
  }
  return messageQueues.get(botName)!;
}

/**
 * 添加消息到队列
 * @returns 是否成功添加（幂等性检查）
 */
export function enqueueMessage(
  botName: string,
  sourceType: TargetType,
  sourceId: string,
  content: string,
  authorId: string,
  attachments?: Array<{ contentType: string; url: string; filename?: string }>
): boolean {
  const queue = ensureQueue(botName);
  const timestamp = Date.now();
  const id = generateMessageId(botName, sourceId, timestamp, content);

  // 幂等性检查
  if (processedMessageIds.has(id)) {
    console.log(`[qqbot-mcp] Duplicate message ignored: ${id.slice(0, 8)}...`);
    return false;
  }

  // 队列长度限制
  if (queue.length >= MAX_QUEUE_SIZE) {
    console.warn(`[qqbot-mcp] Queue full for ${botName}, dropping oldest message`);
    const removed = queue.shift();
    if (removed) {
      processedMessageIds.delete(removed.id);
    }
  }

  const task: PendingTask = {
    id,
    botName,
    sourceType: sourceType === 'user' ? 'c2c' : sourceType === 'group' ? 'group' : 'channel',
    sourceId,
    content,
    authorId,
    timestamp,
    read: false,
    attachments,
  };

  queue.push(task);
  processedMessageIds.add(id);

  // 限制已处理 ID 集合大小
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    // 简单策略：清空一半（实际生产环境可用 LRU）
    const ids = Array.from(processedMessageIds).slice(0, MAX_PROCESSED_IDS / 2);
    ids.forEach(id => processedMessageIds.delete(id));
  }

  console.log(`[qqbot-mcp] Message enqueued for ${botName}: ${content.slice(0, 50)}...`);
  return true;
}

/**
 * 获取未读任务（并标记为已读）
 */
export function fetchUnreadTasks(botName: string): PendingTask[] {
  const queue = messageQueues.get(botName);
  if (!queue) {
    return [];
  }

  const unreadTasks = queue.filter(task => !task.read);
  unreadTasks.forEach(task => {
    task.read = true;
  });

  return unreadTasks;
}

/**
 * 获取所有未读任务（所有机器人）
 */
export function fetchAllUnreadTasks(): PendingTask[] {
  const allTasks: PendingTask[] = [];

  messageQueues.forEach((queue, botName) => {
    const unreadTasks = queue.filter(task => !task.read);
    unreadTasks.forEach(task => {
      task.read = true;
    });
    allTasks.push(...unreadTasks);
  });

  return allTasks;
}

/**
 * 获取消息上下文（最近 N 条消息）
 */
export function getMessageContext(
  botName: string,
  sourceId: string,
  limit: number = 10
): MessageContext[] {
  const queue = messageQueues.get(botName);
  if (!queue) {
    return [];
  }

  const relevantMessages = queue
    .filter(task => task.sourceId === sourceId)
    .slice(-limit)
    .map(task => ({
      id: task.id,
      content: task.content,
      authorId: task.authorId,
      timestamp: task.timestamp,
      sourceType: task.sourceType === 'c2c' ? 'user' : task.sourceType as TargetType,
      attachments: task.attachments,
    }));

  return relevantMessages;
}

/**
 * 清理已读消息
 */
export function clearReadMessages(botName?: string): number {
  let cleared = 0;

  if (botName) {
    const queue = messageQueues.get(botName);
    if (queue) {
      const before = queue.length;
      const remaining = queue.filter(task => !task.read);
      messageQueues.set(botName, remaining);
      cleared = before - remaining.length;
    }
  } else {
    messageQueues.forEach((queue, name) => {
      const before = queue.length;
      const remaining = queue.filter(task => !task.read);
      messageQueues.set(name, remaining);
      cleared += before - remaining.length;
    });
  }

  return cleared;
}

/**
 * 获取队列状态
 */
export function getQueueStatus(): Record<string, { total: number; unread: number }> {
  const status: Record<string, { total: number; unread: number }> = {};

  messageQueues.forEach((queue, botName) => {
    status[botName] = {
      total: queue.length,
      unread: queue.filter(t => !t.read).length,
    };
  });

  return status;
}
