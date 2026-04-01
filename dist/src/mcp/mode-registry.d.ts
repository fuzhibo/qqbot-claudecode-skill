/**
 * 统一模式注册中心
 *
 * 解决问题:
 * 1. 三套独立的模式检测实现（MCP Server、Service Script、Shared Lib）
 * 2. --channel 参数只保存到 gateway-state.json，不影响 MCP Server
 * 3. envFile 加载不一致，导致 .env 配置在某些上下文不生效
 *
 * 所有组件通过 ModeRegistry 来:
 * 1. 读取模式配置
 * 2. 写入模式配置
 * 3. 同步状态变更
 */
/** Gateway 配置目录 */
export declare const GATEWAY_DIR: string;
/** 模式注册文件路径 */
export declare const MODE_REGISTRY_FILE: string;
/** 全局配置文件路径 */
export declare const GLOBAL_CONFIG_FILE: string;
/** Channel 模式所需最低版本 */
export declare const MIN_CHANNEL_VERSION = "2.1.80";
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
 * 解析版本字符串为数字数组
 */
export declare function parseVersion(versionStr: string | undefined): [number, number, number] | null;
/**
 * 比较两个版本号
 */
export declare function compareVersions(v1: [number, number, number], v2: [number, number, number]): number;
/**
 * 检测 Claude Code 版本是否支持原生 Channel 模式
 */
export declare function supportsNativeChannel(version: string | undefined): boolean;
/**
 * 解析 .env 文件内容
 */
export declare function parseEnvFile(filePath: string): Record<string, string>;
/**
 * 从 qqbot-config.json 加载 envFile 路径并加载环境变量
 * 统一的环境变量加载逻辑，供所有组件使用
 */
export declare function loadEnvUnified(): {
    loaded: number;
    envFile: string | null;
};
/**
 * 模式注册中心 (单例模式)
 */
declare class ModeRegistryImpl {
    private static instance;
    private config;
    private initialized;
    private constructor();
    /**
     * 获取单例实例
     */
    static getInstance(): ModeRegistryImpl;
    /**
     * 从文件加载配置 (启动时调用)
     */
    load(): ModeConfig;
    /**
     * 获取当前模式配置
     */
    getConfig(): ModeConfig;
    /**
     * 获取当前运行模式
     */
    getMode(): OperationMode;
    /**
     * 设置模式配置
     */
    setMode(mode: OperationMode, options?: {
        source?: ModeSource;
        channelSubMode?: ChannelSubMode;
        gatewayAvailable?: boolean;
        nativeSupported?: boolean;
        sessionId?: string;
        projectPath?: string;
        projectName?: string;
        reason?: string;
    }): void;
    /**
     * 更新 Gateway 可用状态
     */
    setGatewayAvailable(available: boolean): void;
    /**
     * 更新会话信息
     */
    setSessionInfo(sessionId: string, projectPath?: string, projectName?: string): void;
    /**
     * 持久化到文件
     */
    persist(): void;
    /**
     * 检测并自动设置模式
     * 模式优先级:
     * 1. 环境变量 QQBOT_CHANNEL_MODE=tools -> 强制 Tools 模式
     * 2. 环境变量 QQBOT_CHANNEL_MODE=channel -> 强制 Channel 模式
     * 3. 配置文件指定 headless 模式 -> Tools 模式
     * 4. 自动检测: Gateway 可用 -> Channel (Gateway 桥接)
     * 5. 自动检测: 原生 Channel -> Channel (原生)
     * 6. 降级到 Tools 模式
     */
    detectAndSetMode(gatewayAvailable?: boolean, nativeSupported?: boolean): ModeConfig;
    /**
     * 加载全局配置
     */
    private loadGlobalConfig;
    /**
     * 重置为默认配置
     */
    reset(): void;
}
/**
 * 获取 ModeRegistry 实例
 */
export declare function getModeRegistry(): ModeRegistryImpl;
/**
 * 获取当前运行模式
 */
export declare function getOperationMode(): OperationMode;
/**
 * 获取完整模式配置
 */
export declare function getModeConfig(): ModeConfig;
/**
 * 设置模式
 */
export declare function setMode(mode: OperationMode, options?: Parameters<ModeRegistryImpl['setMode']>[1]): void;
/**
 * 检测并自动设置模式
 */
export declare function detectAndSetMode(gatewayAvailable?: boolean, nativeSupported?: boolean): ModeConfig;
/**
 * 设置 Gateway 可用状态
 */
export declare function setGatewayAvailable(available: boolean): void;
/**
 * 设置会话信息
 */
export declare function setSessionInfo(sessionId: string, projectPath?: string, projectName?: string): void;
/**
 * 获取会话 ID 前缀 (用于消息标识)
 * 返回会话 ID 的前 8 位，用于消息前缀
 */
export declare function getSessionPrefix(): string | null;
export {};
