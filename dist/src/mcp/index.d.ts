/**
 * QQ Bot MCP Server - Claude Code MCP 协议入口
 *
 * 此模块实现 MCP (Model Context Protocol) 协议，
 * 允许 Claude Code 通过标准化接口与 QQ 机器人交互。
 *
 * 支持两种运行模式:
 * 1. Channel 模式 (v2.1.80+): 实时推送 + 权限中继
 * 2. MCP Tools 模式: 轮询方式，功能完整
 *
 * 使用方式:
 * 1. 作为 MCP Server 运行: node dist/mcp/index.js
 * 2. 配置到 Claude Code: 在 claude_desktop_config.json 中添加
 *
 * 支持的工具:
 * - get_active_bots: 获取可用机器人列表
 * - send_qq_message: 发送文本消息
 * - upload_qq_media: 上传并发送媒体文件
 * - fetch_unread_tasks: 获取未读任务 (MCP Tools 模式)
 * - get_qq_context: 获取消息上下文
 */
export {};
