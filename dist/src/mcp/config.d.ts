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
export {};
