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
import {
  startChannelPusher,
  stopChannelPusher,
  registerChannel,
  unregisterChannel,
  isGatewayRegistered,
  getChannelInfo,
} from './channel-pusher.js';
import {
  initPermissionRelay,
  handlePermissionReply,
  isPermissionReply,
} from './permission-relay.js';
import { getOperationMode, setSessionInfo, type OperationMode } from './mode-registry.js';
import { z } from 'zod';

// ============ 类型定义 ============

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

/** Claude Code 权限请求通知 Schema */
export const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string(),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string().optional(),
  }),
});

// ============ Channel 类 ============

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
export class Channel {
  private readonly server: Server;
  private readonly options: Required<Pick<ChannelOptions, 'pushInterval' | 'mergeMessages' | 'registerToGateway'>> & Omit<ChannelOptions, 'pushInterval' | 'mergeMessages' | 'registerToGateway'>;
  private started = false;

  constructor(server: Server, options: ChannelOptions) {
    this.server = server;
    this.options = {
      sessionId: options.sessionId,
      projectPath: options.projectPath,
      projectName: options.projectName,
      gatewayApiUrl: options.gatewayApiUrl ?? process.env.QQBOT_GATEWAY_URL ?? 'http://127.0.0.1:3310',
      pushInterval: options.pushInterval ?? 1000,
      mergeMessages: options.mergeMessages ?? true,
      registerToGateway: options.registerToGateway ?? true,
      adminOpenids: options.adminOpenids ?? [],
    };
  }

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
  async start(): Promise<void> {
    if (this.started) {
      console.warn('[channel] Already started');
      return;
    }

    // 1. 校验运行模式
    const mode: OperationMode = getOperationMode();
    if (mode !== 'channel') {
      console.warn(`[channel] Current mode is "${mode}", not "channel". Channel will not start.`);
      return;
    }

    // 2. 写入会话信息
    setSessionInfo(
      this.options.sessionId,
      this.options.projectPath,
      this.options.projectName,
    );
    console.error(`[channel] Session: ${this.options.sessionId.slice(0, 8)}...`);

    // 3. 初始化权限中继
    initPermissionRelay(this.server, {
      adminOpenids: this.options.adminOpenids,
    });

    // 4. 注册权限请求通知处理器
    this.server.setNotificationHandler(PermissionRequestSchema, async (notification) => {
      console.error(`[channel] Received permission request: ${notification.params.request_id}`);
      console.error(`[channel]    Tool: ${notification.params.tool_name}`);
      await handlePermissionRequest(notification.params);
    });
    console.error('[channel] Permission request handler registered');

    // 5. 启动消息推送器
    startChannelPusher(this.server, {
      registerToGateway: this.options.registerToGateway,
      interval: this.options.pushInterval,
      mergeMessages: this.options.mergeMessages,
    });

    // 6. 注册到 Gateway
    if (this.options.registerToGateway) {
      // 清理同路径的旧注册（避免僵尸 Channel）
      await this.cleanupOldRegistrations();

      try {
        const registered = await registerChannel(
          this.options.sessionId,
          this.options.projectPath,
          this.options.projectName,
        );
        if (registered) {
          console.error(`[channel] Registered to Gateway: ${this.options.sessionId}`);
          console.error(`[channel]    Project: ${this.options.projectName ?? this.options.projectPath.split('/').pop() ?? 'unknown'}`);
        } else {
          console.error('[channel] Failed to register to Gateway, will use local queue only');
        }
      } catch (error) {
        console.error(`[channel] Gateway registration error: ${error}`);
      }
    }

    this.started = true;
    console.error('[channel] Started successfully');
  }

  /**
   * 停止 Channel
   *
   * 执行以下步骤:
   * 1. 停止消息推送器
   * 2. 从 Gateway 注销
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // 停止推送器 (内部也会处理 Gateway 注销)
    await stopChannelPusher();

    this.started = false;
    console.error('[channel] Stopped');
  }

  /**
   * 获取当前运行状态
   */
  getStatus(): ChannelStatus {
    const info = getChannelInfo();
    return {
      running: this.started,
      gatewayRegistered: isGatewayRegistered(),
      sessionId: info.sessionId,
      projectPath: info.projectPath,
      projectName: info.projectName,
    };
  }

  /**
   * 检查消息是否为权限回复
   *
   * 委托给 permission-relay 模块
   */
  checkPermissionReply(content: string): boolean {
    return isPermissionReply(content);
  }

  /**
   * 处理权限回复
   *
   * 委托给 permission-relay 模块
   */
  async handlePermissionReply(
    content: string,
    senderOpenid: string,
  ): Promise<{ handled: boolean; request_id?: string; approved?: boolean }> {
    return handlePermissionReply(content, senderOpenid);
  }

  /**
   * 清理同路径的旧注册
   */
  private async cleanupOldRegistrations(): Promise<void> {
    try {
      const cleanupUrl = `${this.options.gatewayApiUrl}/api/channels/by-path?path=${encodeURIComponent(this.options.projectPath)}`;
      const cleanupResponse = await fetch(cleanupUrl, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000),
      });
      if (cleanupResponse.ok) {
        const result = (await cleanupResponse.json()) as { cleaned?: number };
        if (result.cleaned && result.cleaned > 0) {
          console.error(`[channel] Cleaned up ${result.cleaned} old registration(s) for project path`);
        }
      }
    } catch (error) {
      console.error('[channel] Failed to cleanup old registrations:', error);
      // 不阻塞启动
    }
  }
}

/**
 * 处理权限请求的内部转发函数
 *
 * 将参数转发给 permission-relay 模块
 */
async function handlePermissionRequest(params: {
  request_id?: string;
  tool_name: string;
  description?: string;
  input_preview?: string;
}): Promise<{ success: boolean; request_id: string }> {
  // 动态导入避免循环依赖，实际上 permission-relay 已在顶部导入
  const { handlePermissionRequest: relay } = await import('./permission-relay.js');
  return relay(params);
}
