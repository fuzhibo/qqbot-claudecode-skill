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

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============ 常量定义 ============

/** Gateway 配置目录 */
export const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');

/** 模式注册文件路径 */
export const MODE_REGISTRY_FILE = path.join(GATEWAY_DIR, 'mode-registry.json');

/** 全局配置文件路径 */
export const GLOBAL_CONFIG_FILE = path.join(GATEWAY_DIR, 'qqbot-config.json');

/** Channel 模式所需最低版本 */
export const MIN_CHANNEL_VERSION = '2.1.80';

// ============ 类型定义 ============

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

/** 默认模式配置 */
const DEFAULT_MODE_CONFIG: ModeConfig = {
  version: '1.0.0',
  mode: 'channel',
  channelSubMode: 'gateway-bridge',
  source: 'default',
  gatewayAvailable: false,
  nativeSupported: false,
  lastUpdated: Date.now(),
  reason: 'default configuration',
};

// ============ 工具函数 ============

/**
 * 确保配置目录存在
 */
function ensureGatewayDir(): void {
  if (!fs.existsSync(GATEWAY_DIR)) {
    fs.mkdirSync(GATEWAY_DIR, { recursive: true });
  }
}

/**
 * 解析版本字符串为数字数组
 */
export function parseVersion(versionStr: string | undefined): [number, number, number] | null {
  if (!versionStr) return null;
  const match = versionStr.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * 比较两个版本号
 */
export function compareVersions(
  v1: [number, number, number],
  v2: [number, number, number]
): number {
  for (let i = 0; i < 3; i++) {
    if (v1[i] > v2[i]) return 1;
    if (v1[i] < v2[i]) return -1;
  }
  return 0;
}

/**
 * 检测 Claude Code 版本是否支持原生 Channel 模式
 */
export function supportsNativeChannel(version: string | undefined): boolean {
  const current = parseVersion(version);
  const required = parseVersion(MIN_CHANNEL_VERSION);
  if (!current || !required) return false;
  return compareVersions(current, required) >= 0;
}

/**
 * 解析 .env 文件内容
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!filePath || !fs.existsSync(filePath)) {
    return result;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        result[key] = value;
      }
    }
  } catch (error) {
    console.error(`[mode-registry] Failed to parse env file ${filePath}:`, error);
  }

  return result;
}

/**
 * 从 qqbot-config.json 加载 envFile 路径并加载环境变量
 * 统一的环境变量加载逻辑，供所有组件使用
 */
export function loadEnvUnified(): { loaded: number; envFile: string | null } {
  let envFile: string | null = null;
  let loaded = 0;

  try {
    // 1. 读取全局配置获取 envFile 路径
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      const configContent = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configContent);

      if (config.envFile) {
        envFile = config.envFile.replace('~', os.homedir());

        // 2. 加载 .env 文件
        const envVars = parseEnvFile(envFile!);

        // 3. 设置环境变量（不覆盖已有值）
        for (const [key, value] of Object.entries(envVars)) {
          if (process.env[key] === undefined) {
            process.env[key] = value;
            loaded++;
          }
        }

        if (loaded > 0) {
          console.error(`[mode-registry] Loaded ${loaded} env vars from: ${envFile}`);
        }
      }
    }
  } catch (error) {
    console.error('[mode-registry] Failed to load env file:', error);
  }

  return { loaded, envFile };
}

// ============ ModeRegistry 类 ============

/**
 * 模式注册中心 (单例模式)
 */
class ModeRegistryImpl {
  private static instance: ModeRegistryImpl;
  private config: ModeConfig;
  private initialized: boolean = false;

  private constructor() {
    this.config = { ...DEFAULT_MODE_CONFIG };
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ModeRegistryImpl {
    if (!ModeRegistryImpl.instance) {
      ModeRegistryImpl.instance = new ModeRegistryImpl();
    }
    return ModeRegistryImpl.instance;
  }

  /**
   * 从文件加载配置 (启动时调用)
   */
  public load(): ModeConfig {
    ensureGatewayDir();

    try {
      if (fs.existsSync(MODE_REGISTRY_FILE)) {
        const content = fs.readFileSync(MODE_REGISTRY_FILE, 'utf-8');
        const saved = JSON.parse(content) as Partial<ModeConfig>;
        this.config = { ...DEFAULT_MODE_CONFIG, ...saved };
        this.initialized = true;
        console.error(`[mode-registry] Loaded mode: ${this.config.mode} (source: ${this.config.source})`);
      }
    } catch (error) {
      console.error('[mode-registry] Failed to load config:', error);
      this.config = { ...DEFAULT_MODE_CONFIG };
    }

    return this.config;
  }

  /**
   * 获取当前模式配置
   */
  public getConfig(): ModeConfig {
    if (!this.initialized) {
      this.load();
    }
    return { ...this.config };
  }

  /**
   * 获取当前运行模式
   */
  public getMode(): OperationMode {
    return this.getConfig().mode;
  }

  /**
   * 设置模式配置
   */
  public setMode(
    mode: OperationMode,
    options: {
      source?: ModeSource;
      channelSubMode?: ChannelSubMode;
      gatewayAvailable?: boolean;
      nativeSupported?: boolean;
      sessionId?: string;
      projectPath?: string;
      projectName?: string;
      reason?: string;
    } = {}
  ): void {
    this.config = {
      ...this.config,
      mode,
      source: options.source || 'config',
      channelSubMode: options.channelSubMode,
      gatewayAvailable: options.gatewayAvailable ?? this.config.gatewayAvailable,
      nativeSupported: options.nativeSupported ?? this.config.nativeSupported,
      sessionId: options.sessionId ?? this.config.sessionId,
      projectPath: options.projectPath ?? this.config.projectPath,
      projectName: options.projectName ?? this.config.projectName,
      reason: options.reason,
      lastUpdated: Date.now(),
    };

    this.persist();
    console.error(`[mode-registry] Mode set to: ${mode} (source: ${this.config.source})`);
  }

  /**
   * 更新 Gateway 可用状态
   */
  public setGatewayAvailable(available: boolean): void {
    this.config.gatewayAvailable = available;
    this.config.lastUpdated = Date.now();

    // 如果 Gateway 从可用变为不可用，且当前是 channel 模式，考虑降级
    if (!available && this.config.mode === 'channel' && this.config.source === 'auto') {
      // 检查是否允许降级
      const globalConfig = this.loadGlobalConfig();
      if (globalConfig.allowDegradation) {
        this.config.mode = 'tools';
        this.config.reason = 'degraded: gateway unavailable';
        console.error('[mode-registry] Degraded to tools mode (gateway unavailable)');
      }
    }

    this.persist();
  }

  /**
   * 更新会话信息
   */
  public setSessionInfo(sessionId: string, projectPath?: string, projectName?: string): void {
    this.config.sessionId = sessionId;
    this.config.projectPath = projectPath;
    this.config.projectName = projectName;
    this.config.lastUpdated = Date.now();
    this.persist();
  }

  /**
   * 持久化到文件
   */
  public persist(): void {
    ensureGatewayDir();

    try {
      fs.writeFileSync(MODE_REGISTRY_FILE, JSON.stringify(this.config, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
      });
    } catch (error) {
      console.error('[mode-registry] Failed to persist config:', error);
    }
  }

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
  public detectAndSetMode(
    gatewayAvailable: boolean = false,
    nativeSupported: boolean = false
  ): ModeConfig {
    // 先加载环境变量
    loadEnvUnified();

    const envMode = process.env.QQBOT_CHANNEL_MODE?.toLowerCase();
    const globalConfig = this.loadGlobalConfig();
    const claudeVersion = process.env.CLAUDE_CODE_VERSION;
    const isNativeSupported = nativeSupported || supportsNativeChannel(claudeVersion);

    // 1. 环境变量强制模式（最高优先级）
    if (envMode === 'tools') {
      this.setMode('tools', {
        source: 'env',
        gatewayAvailable,
        nativeSupported: isNativeSupported,
        reason: 'forced by QQBOT_CHANNEL_MODE=tools',
      });
      return this.config;
    }

    if (envMode === 'channel') {
      const subMode = gatewayAvailable ? 'gateway-bridge' : (isNativeSupported ? 'native' : undefined);
      this.setMode('channel', {
        source: 'env',
        channelSubMode: subMode,
        gatewayAvailable,
        nativeSupported: isNativeSupported,
        reason: `forced by QQBOT_CHANNEL_MODE=channel, using ${subMode || 'unknown'}`,
      });
      return this.config;
    }

    // 2. 配置文件指定 headless 模式
    if (globalConfig.workmode === 'headless') {
      this.setMode('tools', {
        source: 'config',
        gatewayAvailable,
        nativeSupported: isNativeSupported,
        reason: 'configured as headless mode in qqbot-config.json',
      });
      return this.config;
    }

    // 3. 自动检测
    if (gatewayAvailable) {
      this.setMode('channel', {
        source: 'auto',
        channelSubMode: 'gateway-bridge',
        gatewayAvailable: true,
        nativeSupported: isNativeSupported,
        reason: 'auto-detected gateway-bridge mode',
      });
      return this.config;
    }

    if (isNativeSupported) {
      this.setMode('channel', {
        source: 'auto',
        channelSubMode: 'native',
        gatewayAvailable: false,
        nativeSupported: true,
        reason: 'auto-detected native channel mode',
      });
      return this.config;
    }

    // 4. 降级到 Tools 模式
    if (globalConfig.allowDegradation) {
      this.setMode('tools', {
        source: 'auto',
        gatewayAvailable: false,
        nativeSupported: false,
        reason: 'degraded from channel to tools (allowDegradation=true)',
      });
      return this.config;
    }

    // 5. 不允许降级，保持 channel 模式等待 Gateway
    this.setMode('channel', {
      source: 'auto',
      channelSubMode: 'gateway-bridge',
      gatewayAvailable: false,
      nativeSupported: false,
      reason: 'waiting for gateway (allowDegradation=false)',
    });

    return this.config;
  }

  /**
   * 加载全局配置
   */
  private loadGlobalConfig(): {
    workmode: 'channel' | 'headless';
    allowDegradation: boolean;
    envFile?: string;
  } {
    const defaultConfig = {
      workmode: 'channel' as const,
      allowDegradation: true,
    };

    try {
      if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
        const content = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
        const config = JSON.parse(content);
        return { ...defaultConfig, ...config };
      }
    } catch (error) {
      console.error('[mode-registry] Failed to load global config:', error);
    }

    return defaultConfig;
  }

  /**
   * 重置为默认配置
   */
  public reset(): void {
    this.config = { ...DEFAULT_MODE_CONFIG };
    this.persist();
    console.error('[mode-registry] Reset to default configuration');
  }
}

// ============ 导出单例访问函数 ============

/**
 * 获取 ModeRegistry 实例
 */
export function getModeRegistry(): ModeRegistryImpl {
  return ModeRegistryImpl.getInstance();
}

/**
 * 获取当前运行模式
 */
export function getOperationMode(): OperationMode {
  return getModeRegistry().getMode();
}

/**
 * 获取完整模式配置
 */
export function getModeConfig(): ModeConfig {
  return getModeRegistry().getConfig();
}

/**
 * 设置模式
 */
export function setMode(
  mode: OperationMode,
  options?: Parameters<ModeRegistryImpl['setMode']>[1]
): void {
  getModeRegistry().setMode(mode, options);
}

/**
 * 检测并自动设置模式
 */
export function detectAndSetMode(
  gatewayAvailable?: boolean,
  nativeSupported?: boolean
): ModeConfig {
  return getModeRegistry().detectAndSetMode(gatewayAvailable, nativeSupported);
}

/**
 * 设置 Gateway 可用状态
 */
export function setGatewayAvailable(available: boolean): void {
  getModeRegistry().setGatewayAvailable(available);
}

/**
 * 设置会话信息
 */
export function setSessionInfo(sessionId: string, projectPath?: string, projectName?: string): void {
  getModeRegistry().setSessionInfo(sessionId, projectPath, projectName);
}

/**
 * 获取会话 ID 前缀 (用于消息标识)
 * 返回会话 ID 的前 8 位，用于消息前缀
 */
export function getSessionPrefix(): string | null {
  const config = getModeConfig();
  if (config.mode === 'channel' && config.sessionId) {
    return config.sessionId.slice(0, 8);
  }
  return null;
}

// 启动时自动加载
getModeRegistry().load();
