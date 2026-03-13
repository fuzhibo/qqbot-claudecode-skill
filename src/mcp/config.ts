/**
 * MCP QQ Bot 配置管理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { BotConfig } from './types.js';

// 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.claude', 'qqbot-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

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
export function readConfig(): ConfigFile {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    return {
      version: '1.0.0',
      bots: {},
      lastUpdated: Date.now(),
    };
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as ConfigFile;
  } catch (error) {
    console.error('[qqbot-mcp] Failed to read config:', error);
    return {
      version: '1.0.0',
      bots: {},
      lastUpdated: Date.now(),
    };
  }
}

/**
 * 写入配置文件
 */
export function writeConfig(config: ConfigFile): void {
  ensureConfigDir();
  config.lastUpdated = Date.now();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 获取所有机器人配置
 */
export function getAllBots(): Record<string, BotConfig> {
  return readConfig().bots;
}

/**
 * 获取单个机器人配置
 */
export function getBot(name: string): BotConfig | undefined {
  return readConfig().bots[name];
}

/**
 * 添加或更新机器人配置
 */
export function setBot(config: BotConfig): void {
  const cfg = readConfig();
  cfg.bots[config.name] = {
    ...config,
    updatedAt: Date.now(),
  };
  writeConfig(cfg);
}

/**
 * 删除机器人配置
 */
export function removeBot(name: string): boolean {
  const cfg = readConfig();
  if (cfg.bots[name]) {
    delete cfg.bots[name];
    writeConfig(cfg);
    return true;
  }
  return false;
}

/**
 * 检查机器人是否存在
 */
export function botExists(name: string): boolean {
  return name in readConfig().bots;
}

/**
 * 获取配置文件路径（用于调试）
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * 从环境变量读取配置（兼容原有方式）
 */
export function loadFromEnv(): BotConfig | null {
  const appId = process.env.QQBOT_APP_ID;
  const clientSecret = process.env.QQBOT_CLIENT_SECRET;

  if (!appId || !clientSecret) {
    return null;
  }

  return {
    name: 'default',
    appId,
    clientSecret,
    enabled: true,
    imageServerBaseUrl: process.env.QQBOT_IMAGE_SERVER_BASE_URL,
    markdownSupport: process.env.QQBOT_MARKDOWN_SUPPORT !== 'false',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
