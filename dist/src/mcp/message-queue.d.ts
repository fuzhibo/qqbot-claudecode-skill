/**
 * 消息队列管理 - 用于接收 QQ -> Claude 的消息
 *
 * 由于 MCP 是通过 Stdio 通信的，无法主动推送消息
 * 采用轮询模式：QQ 消息暂存在内存队列，Claude 通过 fetch_unread_tasks 获取
 */
import type { PendingTask, MessageContext, TargetType } from './types.js';
/**
 * 添加消息到队列
 * @returns 是否成功添加（幂等性检查）
 */
export declare function enqueueMessage(botName: string, sourceType: TargetType, sourceId: string, content: string, authorId: string, attachments?: Array<{
    contentType: string;
    url: string;
    filename?: string;
}>): boolean;
/**
 * 获取未读任务（并标记为已读）
 */
export declare function fetchUnreadTasks(botName: string): PendingTask[];
/**
 * 获取所有未读任务（所有机器人）
 */
export declare function fetchAllUnreadTasks(): PendingTask[];
/**
 * 获取消息上下文（最近 N 条消息）
 */
export declare function getMessageContext(botName: string, sourceId: string, limit?: number): MessageContext[];
/**
 * 清理已读消息
 */
export declare function clearReadMessages(botName?: string): number;
/**
 * 获取队列状态
 */
export declare function getQueueStatus(): Record<string, {
    total: number;
    unread: number;
}>;
