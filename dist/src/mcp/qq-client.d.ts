/**
 * QQ 客户端封装 - 提供统一的 QQ API 调用接口
 */
import type { BotConfig, TargetType } from './types.js';
import { MediaFileType } from '../api.js';
/**
 * 解析目标 ID（支持 G_/U_/C_ 前缀）
 */
export declare function parseTargetId(targetId: string): {
    type: TargetType;
    id: string;
};
/**
 * 添加目标前缀
 */
export declare function addTargetPrefix(id: string, type: TargetType): string;
/**
 * QQ 客户端类
 */
export declare class QQClient {
    private config;
    private accessToken;
    constructor(config: BotConfig);
    /**
     * 获取机器人名称
     */
    get name(): string;
    /**
     * 获取访问令牌
     */
    getAccessToken(): Promise<string>;
    /**
     * 启动后台 Token 刷新
     */
    startTokenRefresh(): void;
    /**
     * 停止后台 Token 刷新
     */
    stopTokenRefresh(): void;
    /**
     * 发送文本消息
     */
    sendMessage(targetId: string, content: string, msgId?: string): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * 发送主动消息（无需回复）
     */
    sendProactiveMessage(targetId: string, content: string): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * 上传媒体文件
     */
    uploadMedia(targetId: string, filePath: string, fileType: MediaFileType, description?: string): Promise<{
        success: boolean;
        fileInfo?: string;
        error?: string;
    }>;
    /**
     * 发送图片消息
     */
    sendImage(targetId: string, imageUrl: string, content?: string, msgId?: string): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * 发送文件消息
     */
    sendFile(targetId: string, filePath: string, msgId?: string): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * 发送视频消息
     */
    sendVideo(targetId: string, videoUrl: string, content?: string, msgId?: string): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    /**
     * 接收消息（供 WebSocket 回调使用）
     */
    receiveMessage(sourceType: TargetType, sourceId: string, content: string, authorId: string, attachments?: Array<{
        contentType: string;
        url: string;
        filename?: string;
    }>): void;
}
/**
 * 获取或创建客户端实例
 */
export declare function getClient(config: BotConfig): QQClient;
/**
 * 获取所有活跃的客户端
 */
export declare function getActiveClients(): Map<string, QQClient>;
/**
 * 移除客户端
 */
export declare function removeClient(name: string): boolean;
/**
 * 清理所有客户端 - 用于服务关闭时
 */
export declare function cleanupAllClients(): void;
