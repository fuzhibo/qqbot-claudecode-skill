/**
 * Channel 模式封装类
 *
 * 将 Channel 模式的行为封装为统一的 Channel 类，
 * 管理 Gateway 注册/注销、消息推送、权限中继等完整生命周期。
 *
 * 使用方式:
 *   const channel = new Channel(server, { sessionId, projectPath, projectName });
 *   await channel.start();
 *   // ... 运行中 ...
 *   await channel.stop();
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
/** Channel 配置选项 */
export interface ChannelOptions {
    /** 会话 ID */
    sessionId: string;
    /** 项目路径 */
    projectPath: string;
    /** 项目名称 */
    projectName?: string;
    /** Gateway API 地址 (默认从环境变量或 http://127.0.0.1:3310) */
    gatewayApiUrl?: string;
    /** 推送间隔 (毫秒，默认 1000) */
    pushInterval?: number;
    /** 是否合并消息 (默认 true) */
    mergeMessages?: boolean;
    /** 是否注册到 Gateway (默认 true) */
    registerToGateway?: boolean;
    /** 管理员 openid 列表 (用于权限中继) */
    adminOpenids?: string[];
}
/** Channel 运行状态 */
export interface ChannelStatus {
    /** 是否已启动 */
    running: boolean;
    /** 是否已注册到 Gateway */
    gatewayRegistered: boolean;
    /** 会话 ID */
    sessionId: string | null;
    /** 项目路径 */
    projectPath: string | null;
    /** 项目名称 */
    projectName: string | null;
}
/**
 * Channel 类 - 封装 Channel 模式的完整生命周期
 *
 * 职责:
 * 1. 启动/停止消息推送器
 * 2. 管理 Gateway 注册/注销
 * 3. 初始化权限中继
 * 4. 注册权限请求通知处理器
 * 5. 提供统一的运行状态查询
 */
export declare class Channel {
    private readonly server;
    private readonly options;
    private started;
    constructor(server: Server, options: ChannelOptions);
    /**
     * 启动 Channel
     *
     * 执行以下步骤:
     * 1. 校验运行模式
     * 2. 写入会话信息到 ModeRegistry
     * 3. 初始化权限中继
     * 4. 注册权限请求通知处理器
     * 5. 启动消息推送器
     * 6. 注册到 Gateway
     */
    start(): Promise<void>;
    /**
     * 停止 Channel
     *
     * 执行以下步骤:
     * 1. 停止消息推送器
     * 2. 从 Gateway 注销
     */
    stop(): Promise<void>;
    /**
     * 获取当前运行状态
     */
    getStatus(): ChannelStatus;
    /**
     * 检查消息是否为权限回复
     *
     * 委托给 permission-relay 模块
     */
    checkPermissionReply(content: string): boolean;
    /**
     * 处理权限回复
     *
     * 委托给 permission-relay 模块
     */
    handlePermissionReply(content: string, senderOpenid: string): Promise<{
        handled: boolean;
        request_id?: string;
        approved?: boolean;
    }>;
    /**
     * 清理同路径的旧注册
     */
    private cleanupOldRegistrations;
}
