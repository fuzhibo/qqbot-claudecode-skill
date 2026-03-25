/**
 * Claude Code Channel 权限中继模块
 *
 * 实现权限请求从 Claude Code 推送到 QQ，以及用户回复处理
 *
 * 工作流程:
 * 1. Claude Code 需要权限批准时发送 permission_request
 * 2. Channel 推送权限请求到 QQ 管理员
 * 3. 管理员在 QQ 中回复 "yes <request_id>" 或 "no <request_id>"
 * 4. Channel 发送 permission verdict 给 Claude Code
 */
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
/** 待处理的权限请求 */
interface PendingPermissionRequest {
    /** 请求 ID */
    id: string;
    /** 工具名称 */
    toolName: string;
    /** 描述 */
    description: string;
    /** 输入预览 */
    inputPreview: string;
    /** 创建时间 */
    createdAt: number;
    /** 过期时间 (5 分钟) */
    expiresAt: number;
    /** 管理员 openid */
    adminOpenid?: string;
}
/**
 * 初始化权限中继模块
 */
export declare function initPermissionRelay(server: Server, config?: {
    adminOpenids?: string[];
}): void;
/**
 * 处理权限请求
 * 从 Claude Code 收到 permission_request 时调用
 */
export declare function handlePermissionRequest(params: {
    request_id?: string;
    tool_name: string;
    description?: string;
    input_preview?: string;
}): Promise<{
    success: boolean;
    request_id: string;
}>;
/**
 * 处理 QQ 消息中的权限回复
 * 检测 "yes/no <request_id>" 格式的回复
 */
export declare function handlePermissionReply(content: string, senderOpenid: string): Promise<{
    handled: boolean;
    request_id?: string;
    approved?: boolean;
}>;
/**
 * 检查消息是否是权限回复
 */
export declare function isPermissionReply(content: string): boolean;
/**
 * 获取待处理的权限请求数量
 */
export declare function getPendingRequestCount(): number;
/**
 * 获取所有待处理的权限请求
 */
export declare function getPendingRequests(): PendingPermissionRequest[];
/**
 * 设置管理员列表
 */
export declare function setAdminOpenids(openids: string[]): void;
/**
 * 获取管理员列表
 */
export declare function getAdminOpenids(): string[];
export {};
