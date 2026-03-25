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
/**
 * 启动 Channel 推送器
 */
export declare function startChannelPusher(server: Server, customConfig?: ChannelPusherConfig): void;
/**
 * 停止 Channel 推送器
 */
export declare function stopChannelPusher(): Promise<void>;
/**
 * 检查推送器是否运行中
 */
export declare function isPusherRunning(): boolean;
/**
 * 获取推送器状态
 */
export declare function getPusherStatus(): {
    running: boolean;
    interval: number;
    mergeEnabled: boolean;
};
/**
 * 手动触发一次推送（用于测试）
 */
export declare function triggerPush(): Promise<number>;
/**
 * 向 Gateway 注册 Channel
 * @param sid - 会话 ID
 * @param pPath - 项目路径
 * @param pName - 项目名称（可选）
 */
export declare function registerChannel(sid: string, pPath: string, pName?: string): Promise<boolean>;
/**
 * 从 Gateway 注销 Channel
 */
export declare function unregisterChannel(): Promise<boolean>;
/**
 * 从 Gateway 获取本 Channel 的消息
 * @param limit - 最大获取数量
 */
export declare function fetchChannelMessages(limit?: number): Promise<ChannelNotificationParams[]>;
/**
 * 检查是否已注册到 Gateway
 */
export declare function isGatewayRegistered(): boolean;
/**
 * 获取当前 Channel 信息
 */
export declare function getChannelInfo(): {
    sessionId: string | null;
    projectPath: string | null;
    projectName: string | null;
    isRegistered: boolean;
};
export {};
