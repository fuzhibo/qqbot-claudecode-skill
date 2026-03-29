/**
 * MCP QQ Bot 配置管理
 */
import type { BotConfig } from './types.js';
/**
 * 配置文件结构
 */
interface ConfigFile {
    version: string;
    bots: Record<string, BotConfig>;
    lastUpdated: number;
}
/**
 * 读取配置文件
 */
export declare function readConfig(): ConfigFile;
/**
 * 写入配置文件
 */
export declare function writeConfig(config: ConfigFile): void;
/**
 * 获取所有机器人配置
 */
export declare function getAllBots(): Record<string, BotConfig>;
/**
 * 获取单个机器人配置
 */
export declare function getBot(name: string): BotConfig | undefined;
/**
 * 添加或更新机器人配置
 */
export declare function setBot(config: BotConfig): void;
/**
 * 删除机器人配置
 */
export declare function removeBot(name: string): boolean;
/**
 * 检查机器人是否存在
 */
export declare function botExists(name: string): boolean;
/**
 * 获取配置文件路径（用于调试）
 */
export declare function getConfigPath(): string;
/**
 * 从环境变量读取配置（兼容原有方式）
 */
export declare function loadFromEnv(): BotConfig | null;
/**
 * 全局配置类型
 */
export interface GlobalConfig {
    /** 配置版本 */
    version: string;
    /** 工作模式: channel (默认) 或 headless */
    workmode: 'channel' | 'headless';
    /** 是否允许降级 (channel 失败时降级到 tools) */
    allowDegradation: boolean;
    /** SessionStart 时是否自动启动 Gateway */
    autoStartGateway: boolean;
    /** SessionEnd 时是否发送离线通知 */
    autoNotifyOffline: boolean;
    /** 接收离线通知的 QQ 目标 ID */
    notifyTargetId?: string;
    /** 最后更新时间 */
    lastUpdated?: number;
}
/**
 * 加载全局配置
 */
export declare function loadGlobalConfig(): GlobalConfig;
/**
 * 保存全局配置
 */
export declare function saveGlobalConfig(config: GlobalConfig): void;
/**
 * 获取全局配置文件路径
 */
export declare function getGlobalConfigPath(): string;
export {};
