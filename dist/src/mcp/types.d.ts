/**
 * MCP QQ Bot 类型定义
 */
/** 运行模式类型 */
export type OperationMode = 'channel' | 'tools';
/** Channel 子模式类型 */
export type ChannelSubMode = 'gateway-bridge' | 'native';
/** 模式来源 */
export type ModeSource = 'cli' | 'env' | 'config' | 'auto' | 'default';
/** 模式配置 */
export interface ModeConfig {
    /** 配置版本 */
    version: string;
    /** 当前运行模式 */
    mode: OperationMode;
    /** Channel 子模式 (仅 mode=channel 时有效) */
    channelSubMode?: ChannelSubMode;
    /** 配置来源 */
    source: ModeSource;
    /** Gateway 是否可用 */
    gatewayAvailable: boolean;
    /** 原生 Channel 是否支持 */
    nativeSupported: boolean;
    /** 最后更新时间 */
    lastUpdated: number;
    /** 关联的会话 ID (Channel 模式下用于消息前缀) */
    sessionId?: string;
    /** 关联的项目路径 */
    projectPath?: string;
    /** 关联的项目名称 */
    projectName?: string;
    /** 配置来源描述 */
    reason?: string;
}
/**
 * QQ 消息目标类型前缀
 */
export type TargetPrefix = 'G_' | 'U_' | 'C_';
/**
 * 目标类型
 */
export type TargetType = 'group' | 'user' | 'channel';
/**
 * 消息队列中的待处理任务
 */
export interface PendingTask {
    /** 唯一标识 */
    id: string;
    /** 机器人名称 */
    botName: string;
    /** 来源类型 */
    sourceType: 'group' | 'c2c' | 'channel';
    /** 来源 ID */
    sourceId: string;
    /** 消息内容 */
    content: string;
    /** 发送者 ID */
    authorId: string;
    /** 时间戳 */
    timestamp: number;
    /** 是否已读 */
    read: boolean;
    /** 附件列表 */
    attachments?: Array<{
        contentType: string;
        url: string;
        filename?: string;
    }>;
}
/**
 * 机器人配置
 */
export interface BotConfig {
    /** 机器人名称（唯一标识） */
    name: string;
    /** AppID */
    appId: string;
    /** Client Secret */
    clientSecret: string;
    /** 是否启用 */
    enabled: boolean;
    /** 默认目标 ID */
    defaultTargetId?: string;
    /** 图床服务器地址 */
    imageServerBaseUrl?: string;
    /** 是否支持 Markdown */
    markdownSupport?: boolean;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
}
/**
 * MCP 工具响应
 */
export interface McpToolResponse {
    content: Array<{
        type: 'text' | 'image';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}
/**
 * 消息上下文
 */
export interface MessageContext {
    /** 消息 ID */
    id: string;
    /** 消息内容 */
    content: string;
    /** 作者 ID */
    authorId: string;
    /** 时间戳 */
    timestamp: number;
    /** 来源类型 */
    sourceType: TargetType;
    /** 附件 */
    attachments?: Array<{
        contentType: string;
        url: string;
        filename?: string;
    }>;
}
