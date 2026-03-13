/**
 * MCP 工具定义
 */

import type { McpToolResponse } from './types.js';
import { getAllBots, getBot, setBot, removeBot, botExists, loadFromEnv } from './config.js';
import { getClient, getActiveClients, parseTargetId } from './qq-client.js';
import { fetchUnreadTasks, fetchAllUnreadTasks, getMessageContext, getQueueStatus } from './message-queue.js';
import { MediaFileType } from '../api.js';
import * as path from 'path';

/**
 * 工具定义列表
 */
export const toolDefinitions = [
  {
    name: 'get_active_bots',
    description: `感知能力：返回当前已配置且可用的机器人名称列表。
当用户没有指定 botName 时，必须先调用此接口进行"身份确认"。
返回每个机器人的名称、连接状态及默认 targetId。`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'send_qq_message',
    description: `向指定的 QQ 群或频道发送文本消息。
当用户要求将当前代码分析、报错日志或项目进度通知给 QQ 群友时使用此工具。
targetId 格式说明：
- G_xxx: 群聊（Group）
- U_xxx: 私聊（User/C2C）
- C_xxx: 频道（Channel）`,
    inputSchema: {
      type: 'object',
      properties: {
        botName: {
          type: 'string',
          description: '机器人名称。如未指定，请先调用 get_active_bots 获取可用机器人',
        },
        targetId: {
          type: 'string',
          description: '目标 ID（群号或用户 ID），支持 G_/U_/C_ 前缀标识类型',
        },
        content: {
          type: 'string',
          description: '要发送的消息文本内容',
        },
        msgId: {
          type: 'string',
          description: '可选：回复的消息 ID（被动回复时使用）',
        },
      },
      required: ['targetId', 'content'],
    },
  },
  {
    name: 'upload_qq_media',
    description: `上传并发送媒体文件（图片、视频、文件）到 QQ。
支持本地文件路径，自动判断文件后缀并选择合适的发送方式。
安全说明：仅允许访问当前工作目录及其子目录的文件。`,
    inputSchema: {
      type: 'object',
      properties: {
        botName: {
          type: 'string',
          description: '机器人名称',
        },
        targetId: {
          type: 'string',
          description: '目标 ID（群号或用户 ID），支持 G_/U_/C_ 前缀',
        },
        filePath: {
          type: 'string',
          description: '本地文件的绝对路径',
        },
        desc: {
          type: 'string',
          description: '可选：文件描述或附加文本',
        },
      },
      required: ['targetId', 'filePath'],
    },
  },
  {
    name: 'fetch_unread_tasks',
    description: `获取自上次调用以来，机器人收到的所有 @ 消息、私聊或群聊任务。
这是实现"QQ -> Claude"通信的核心接口。
Claude 轮询此接口获取用户在 QQ 上发送的任务请求。
返回的任务会自动标记为已读。`,
    inputSchema: {
      type: 'object',
      properties: {
        botName: {
          type: 'string',
          description: '可选：机器人名称。不指定则返回所有机器人的未读任务',
        },
      },
    },
  },
  {
    name: 'get_qq_context',
    description: `拉取指定目标的最近 N 条历史消息，帮助 Claude 理解当前的对话背景。
用于在处理任务前了解上下文，提供更精准的回复。`,
    inputSchema: {
      type: 'object',
      properties: {
        botName: {
          type: 'string',
          description: '机器人名称',
        },
        targetId: {
          type: 'string',
          description: '目标 ID（群号或用户 ID）',
        },
        limit: {
          type: 'number',
          description: '可选：返回的消息数量上限，默认 10',
        },
      },
      required: ['targetId'],
    },
  },
];

/**
 * 验证文件路径安全性
 */
function validateFilePath(filePath: string): { valid: boolean; error?: string } {
  const resolved = path.resolve(filePath);
  const cwd = process.cwd();

  // 检查是否在工作目录内（安全限制）
  if (!resolved.startsWith(cwd)) {
    // 允许访问 /tmp 目录（临时文件）
    if (!resolved.startsWith('/tmp') && !resolved.startsWith('/var/tmp')) {
      return { valid: false, error: `安全限制：仅允许访问工作目录 (${cwd}) 或临时目录` };
    }
  }

  return { valid: true };
}

/**
 * 获取默认机器人名称
 */
function getDefaultBotName(): string | null {
  // 优先从配置文件获取
  const bots = getAllBots();
  const botNames = Object.keys(bots);
  if (botNames.length > 0) {
    return botNames[0];
  }

  // 尝试从环境变量加载
  const envBot = loadFromEnv();
  if (envBot) {
    setBot(envBot);
    return envBot.name;
  }

  return null;
}

/**
 * 确保机器人存在
 */
function ensureBot(botName: string | undefined): { name: string; error?: string } {
  if (botName) {
    if (!botExists(botName)) {
      return { name: botName, error: `机器人 "${botName}" 不存在。请先使用 setup 指令配置。` };
    }
    return { name: botName };
  }

  const defaultName = getDefaultBotName();
  if (!defaultName) {
    return { name: '', error: '未配置任何机器人。请先使用 setup 指令配置，或设置 QQBOT_APP_ID 和 QQBOT_CLIENT_SECRET 环境变量。' };
  }
  return { name: defaultName };
}

/**
 * 处理工具调用
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<McpToolResponse> {
  try {
    switch (name) {
      case 'get_active_bots':
        return handleGetActiveBots();

      case 'send_qq_message':
        return handleSendMessage(args);

      case 'upload_qq_media':
        return handleUploadMedia(args);

      case 'fetch_unread_tasks':
        return handleFetchUnreadTasks(args);

      case 'get_qq_context':
        return handleGetContext(args);

      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `未知工具: ${name}` }],
        };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: 'text', text: `工具执行错误: ${errMsg}` }],
    };
  }
}

/**
 * 获取活跃机器人列表
 */
async function handleGetActiveBots(): Promise<McpToolResponse> {
  const bots = getAllBots();
  const queueStatus = getQueueStatus();

  if (Object.keys(bots).length === 0) {
    // 尝试从环境变量加载
    const envBot = loadFromEnv();
    if (envBot) {
      setBot(envBot);
      bots[envBot.name] = envBot;
    }
  }

  const botList = Object.values(bots).map(bot => ({
    name: bot.name,
    enabled: bot.enabled,
    defaultTargetId: bot.defaultTargetId || '未设置',
    queueStatus: queueStatus[bot.name] || { total: 0, unread: 0 },
  }));

  if (botList.length === 0) {
    return {
      content: [{
        type: 'text',
        text: '暂无已配置的机器人。\n\n请使用以下方式之一配置：\n1. 设置环境变量 QQBOT_APP_ID 和 QQBOT_CLIENT_SECRET\n2. 使用 CLI 指令: qqbot setup <botName>',
      }],
    };
  }

  const text = botList.map(bot =>
    `• ${bot.name}\n  状态: ${bot.enabled ? '✅ 启用' : '❌ 禁用'}\n  默认目标: ${bot.defaultTargetId}\n  消息队列: ${bot.queueStatus.unread} 未读 / ${bot.queueStatus.total} 总计`
  ).join('\n\n');

  return {
    content: [{ type: 'text', text: `已配置的机器人列表:\n\n${text}` }],
  };
}

/**
 * 发送消息
 */
async function handleSendMessage(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { name: botName, error: botError } = ensureBot(args.botName as string | undefined);
  if (botError) {
    return { isError: true, content: [{ type: 'text', text: botError }] };
  }

  const bot = getBot(botName);
  if (!bot) {
    return { isError: true, content: [{ type: 'text', text: `机器人 "${botName}" 配置丢失` }] };
  }

  const targetId = args.targetId as string;
  const content = args.content as string;
  const msgId = args.msgId as string | undefined;

  const client = getClient(bot);
  const result = await client.sendMessage(targetId, content, msgId);

  if (result.success) {
    const { type, id } = parseTargetId(targetId);
    const typeDesc = type === 'group' ? '群聊' : type === 'user' ? '私聊' : '频道';
    return {
      content: [{
        type: 'text',
        text: `✅ 消息已成功发送到 QQ ${typeDesc} (目标: ${id})\n消息 ID: ${result.messageId}`,
      }],
    };
  } else {
    return {
      isError: true,
      content: [{ type: 'text', text: `❌ 发送失败: ${result.error}` }],
    };
  }
}

/**
 * 上传媒体文件
 */
async function handleUploadMedia(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { name: botName, error: botError } = ensureBot(args.botName as string | undefined);
  if (botError) {
    return { isError: true, content: [{ type: 'text', text: botError }] };
  }

  const bot = getBot(botName);
  if (!bot) {
    return { isError: true, content: [{ type: 'text', text: `机器人 "${botName}" 配置丢失` }] };
  }

  const targetId = args.targetId as string;
  const filePath = args.filePath as string;
  const desc = args.desc as string | undefined;

  // 安全验证
  const validation = validateFilePath(filePath);
  if (!validation.valid) {
    return { isError: true, content: [{ type: 'text', text: `❌ ${validation.error}` }] };
  }

  // 根据文件扩展名判断类型
  const ext = path.extname(filePath).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

  const client = getClient(bot);
  let result;

  if (imageExts.includes(ext)) {
    // 图片：如果是本地路径，读取并转 base64
    const resolved = path.resolve(filePath);
    const fs = await import('fs');
    const fileBase64 = fs.readFileSync(resolved).toString('base64');
    const dataUrl = `data:image/${ext.slice(1)};base64,${fileBase64}`;
    result = await client.sendImage(targetId, dataUrl, desc);
  } else if (videoExts.includes(ext)) {
    // 视频：需要先上传再发送
    result = await client.sendVideo(targetId, filePath, desc);
  } else {
    // 其他文件
    result = await client.sendFile(targetId, filePath);
  }

  if (result.success) {
    return {
      content: [{
        type: 'text',
        text: `✅ 文件已成功发送到 QQ (目标: ${targetId})\n文件: ${path.basename(filePath)}\n消息 ID: ${result.messageId}`,
      }],
    };
  } else {
    return {
      isError: true,
      content: [{ type: 'text', text: `❌ 发送失败: ${result.error}` }],
    };
  }
}

/**
 * 获取未读任务
 */
async function handleFetchUnreadTasks(args: Record<string, unknown>): Promise<McpToolResponse> {
  const botName = args.botName as string | undefined;
  const tasks = botName ? fetchUnreadTasks(botName) : fetchAllUnreadTasks();

  if (tasks.length === 0) {
    return {
      content: [{ type: 'text', text: '📭 当前没有未读任务' }],
    };
  }

  const taskText = tasks.map(task => {
    const sourceType = task.sourceType === 'c2c' ? '私聊' : task.sourceType === 'group' ? '群聊' : '频道';
    let text = `【${sourceType}】${task.sourceId}\n`;
    text += `发送者: ${task.authorId}\n`;
    text += `时间: ${new Date(task.timestamp).toLocaleString()}\n`;
    text += `内容: ${task.content}`;

    if (task.attachments && task.attachments.length > 0) {
      text += `\n附件: ${task.attachments.map(a => a.filename || a.contentType).join(', ')}`;
    }

    return text;
  }).join('\n\n---\n\n');

  return {
    content: [{
      type: 'text',
      text: `📬 未读任务 (${tasks.length} 条):\n\n${taskText}`,
    }],
  };
}

/**
 * 获取消息上下文
 */
async function handleGetContext(args: Record<string, unknown>): Promise<McpToolResponse> {
  const { name: botName, error: botError } = ensureBot(args.botName as string | undefined);
  if (botError) {
    return { isError: true, content: [{ type: 'text', text: botError }] };
  }

  const targetId = args.targetId as string;
  const limit = (args.limit as number) || 10;

  const contexts = getMessageContext(botName, targetId, limit);

  if (contexts.length === 0) {
    return {
      content: [{ type: 'text', text: '📭 暂无历史消息记录' }],
    };
  }

  const contextText = contexts.map(ctx => {
    const time = new Date(ctx.timestamp).toLocaleTimeString();
    return `[${time}] ${ctx.authorId}: ${ctx.content}`;
  }).join('\n');

  return {
    content: [{
      type: 'text',
      text: `📜 最近 ${contexts.length} 条消息:\n\n${contextText}`,
    }],
  };
}
