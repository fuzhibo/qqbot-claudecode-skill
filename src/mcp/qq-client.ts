/**
 * QQ 客户端封装 - 提供统一的 QQ API 调用接口
 */

import * as path from 'path';
import * as fs from 'fs';
import type { BotConfig, TargetType } from './types.js';
import {
  getAccessToken,
  initApiConfig,
  sendC2CMessage,
  sendGroupMessage,
  sendChannelMessage,
  sendProactiveC2CMessage,
  sendProactiveGroupMessage,
  sendC2CImageMessage,
  sendGroupImageMessage,
  sendC2CFileMessage,
  sendGroupFileMessage,
  sendC2CVideoMessage,
  sendGroupVideoMessage,
  MediaFileType,
  uploadC2CMedia,
  uploadGroupMedia,
  sendC2CMediaMessage,
  sendGroupMediaMessage,
  startBackgroundTokenRefresh,
  stopBackgroundTokenRefresh,
} from '../api.js';
import { enqueueMessage } from './message-queue.js';

/**
 * 解析目标 ID（支持 G_/U_/C_ 前缀）
 */
export function parseTargetId(targetId: string): { type: TargetType; id: string } {
  if (targetId.startsWith('G_')) {
    return { type: 'group', id: targetId.slice(2) };
  }
  if (targetId.startsWith('U_')) {
    return { type: 'user', id: targetId.slice(2) };
  }
  if (targetId.startsWith('C_')) {
    return { type: 'channel', id: targetId.slice(2) };
  }
  // 默认为群聊
  return { type: 'group', id: targetId };
}

/**
 * 添加目标前缀
 */
export function addTargetPrefix(id: string, type: TargetType): string {
  const prefix = type === 'group' ? 'G_' : type === 'user' ? 'U_' : 'C_';
  return `${prefix}${id}`;
}

/**
 * QQ 客户端类
 */
export class QQClient {
  private config: BotConfig;
  private accessToken: string | null = null;

  constructor(config: BotConfig) {
    this.config = config;
    initApiConfig({ markdownSupport: config.markdownSupport ?? true });
  }

  /**
   * 获取机器人名称
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * 获取访问令牌
   */
  async getAccessToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = await getAccessToken(this.config.appId, this.config.clientSecret);
    }
    return this.accessToken;
  }

  /**
   * 启动后台 Token 刷新
   */
  startTokenRefresh(): void {
    startBackgroundTokenRefresh(this.config.appId, this.config.clientSecret, {
      log: {
        // 🔴 重要: MCP Server 中所有日志必须输出到 stderr，不能输出到 stdout
        // stdout 只能用于 JSON-RPC 消息，否则会破坏 MCP 协议
        info: (msg) => console.error(`[qqbot:${this.name}] ${msg}`),
        error: (msg) => console.error(`[qqbot:${this.name}] ${msg}`),
      },
    });
  }

  /**
   * 停止后台 Token 刷新
   */
  stopTokenRefresh(): void {
    stopBackgroundTokenRefresh(this.config.appId);
  }

  /**
   * 发送文本消息
   */
  async sendMessage(
    targetId: string,
    content: string,
    msgId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const token = await this.getAccessToken();
      const { type, id } = parseTargetId(targetId);

      let result;
      switch (type) {
        case 'user':
          result = await sendC2CMessage(token, id, content, msgId);
          break;
        case 'group':
          result = await sendGroupMessage(token, id, content, msgId);
          break;
        case 'channel':
          result = await sendChannelMessage(token, id, content, msgId);
          break;
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[qqbot:${this.name}] Send message failed:`, errMsg);
      return { success: false, error: errMsg };
    }
  }

  /**
   * 发送主动消息（无需回复）
   */
  async sendProactiveMessage(
    targetId: string,
    content: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const token = await this.getAccessToken();
      const { type, id } = parseTargetId(targetId);

      let result;
      if (type === 'user') {
        result = await sendProactiveC2CMessage(token, id, content);
      } else if (type === 'group') {
        result = await sendProactiveGroupMessage(token, id, content);
      } else {
        // 频道不支持主动消息
        return { success: false, error: 'Channel does not support proactive messages' };
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[qqbot:${this.name}] Send proactive message failed:`, errMsg);
      return { success: false, error: errMsg };
    }
  }

  /**
   * 上传媒体文件
   */
  async uploadMedia(
    targetId: string,
    filePath: string,
    fileType: MediaFileType,
    description?: string
  ): Promise<{ success: boolean; fileInfo?: string; error?: string }> {
    try {
      // 安全检查：确保文件路径在允许范围内
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: `File not found: ${resolvedPath}` };
      }

      const token = await this.getAccessToken();
      const { type, id } = parseTargetId(targetId);

      // 读取文件并转换为 base64
      const fileBuffer = fs.readFileSync(resolvedPath);
      const fileBase64 = fileBuffer.toString('base64');
      const fileName = path.basename(resolvedPath);

      let result;
      if (type === 'user') {
        result = await uploadC2CMedia(token, id, fileType, undefined, fileBase64, false, fileName);
      } else {
        result = await uploadGroupMedia(token, id, fileType, undefined, fileBase64, false, fileName);
      }

      return { success: true, fileInfo: result.file_info };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[qqbot:${this.name}] Upload media failed:`, errMsg);
      return { success: false, error: errMsg };
    }
  }

  /**
   * 发送图片消息
   */
  async sendImage(
    targetId: string,
    imageUrl: string,
    content?: string,
    msgId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const token = await this.getAccessToken();
      const { type, id } = parseTargetId(targetId);

      let result;
      if (type === 'user') {
        result = await sendC2CImageMessage(token, id, imageUrl, msgId, content);
      } else {
        result = await sendGroupImageMessage(token, id, imageUrl, msgId, content);
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg };
    }
  }

  /**
   * 发送文件消息
   */
  async sendFile(
    targetId: string,
    filePath: string,
    msgId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: `File not found: ${resolvedPath}` };
      }

      const token = await this.getAccessToken();
      const { type, id } = parseTargetId(targetId);
      const fileName = path.basename(resolvedPath);
      const fileBuffer = fs.readFileSync(resolvedPath);
      const fileBase64 = fileBuffer.toString('base64');

      let result;
      if (type === 'user') {
        result = await sendC2CFileMessage(token, id, fileBase64, undefined, msgId, fileName);
      } else {
        result = await sendGroupFileMessage(token, id, fileBase64, undefined, msgId, fileName);
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg };
    }
  }

  /**
   * 发送视频消息
   */
  async sendVideo(
    targetId: string,
    videoUrl: string,
    content?: string,
    msgId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const token = await this.getAccessToken();
      const { type, id } = parseTargetId(targetId);

      let result;
      if (type === 'user') {
        result = await sendC2CVideoMessage(token, id, videoUrl, undefined, msgId, content);
      } else {
        result = await sendGroupVideoMessage(token, id, videoUrl, undefined, msgId, content);
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg };
    }
  }

  /**
   * 接收消息（供 WebSocket 回调使用）
   */
  receiveMessage(
    sourceType: TargetType,
    sourceId: string,
    content: string,
    authorId: string,
    attachments?: Array<{ contentType: string; url: string; filename?: string }>
  ): void {
    enqueueMessage(this.config.name, sourceType, sourceId, content, authorId, attachments);
  }
}

// 客户端实例管理
const clients = new Map<string, QQClient>();

/**
 * 获取或创建客户端实例
 */
export function getClient(config: BotConfig): QQClient {
  let client = clients.get(config.name);
  if (!client) {
    client = new QQClient(config);
    clients.set(config.name, client);
  }
  return client;
}

/**
 * 获取所有活跃的客户端
 */
export function getActiveClients(): Map<string, QQClient> {
  return clients;
}

/**
 * 移除客户端
 */
export function removeClient(name: string): boolean {
  const client = clients.get(name);
  if (client) {
    client.stopTokenRefresh();
    clients.delete(name);
    return true;
  }
  return false;
}

/**
 * 清理所有客户端 - 用于服务关闭时
 */
export function cleanupAllClients(): void {
  for (const [name, client] of clients) {
    try {
      client.stopTokenRefresh();
      console.error(`[qqbot-mcp] Client stopped: ${name}`);
    } catch (error) {
      console.error(`[qqbot-mcp] Error stopping client ${name}:`, error);
    }
  }
  clients.clear();
  console.error('[qqbot-mcp] All clients cleaned up');
}
