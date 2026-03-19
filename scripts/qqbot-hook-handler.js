#!/usr/bin/env node

/**
 * QQ Bot Hook Handler
 *
 * 由 Claude Code hook 系统调用，通过 Gateway 内部 API 发送通知到 QQ
 *
 * 用法:
 *   node scripts/qqbot-hook-handler.js <event-type> [tool-name]
 *
 * 环境变量 (由 Claude Code 提供):
 *   CLAUDE_HOOK_EVENT - 事件类型
 *   CLAUDE_HOOK_TOOL_NAME - 工具名称 (PostToolUse/PreToolUse)
 *   CLAUDE_HOOK_SESSION_ID - 会话 ID
 *   CLAUDE_HOOK_CWD - 工作目录
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 内部 API 配置
const INTERNAL_API_HOST = '127.0.0.1';
const INTERNAL_API_PORT = 3310;

/**
 * 读取 hook 配置
 */
function loadHookConfig(cwd) {
  const configPath = path.join(cwd, '.claude', 'hooks', 'qqbot-notify.yaml');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const content = fs.readFileSync(configPath, 'utf-8');

  // 简单的 YAML 解析 (支持基本格式)
  const hooks = [];
  let currentHook = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('- event:')) {
      if (currentHook) hooks.push(currentHook);
      currentHook = { event: trimmed.replace('- event:', '').trim() };
    } else if (currentHook) {
      if (trimmed.startsWith('matcher:')) {
        // 移除行内注释 (以 # 开头)
        let matcherValue = trimmed.replace('matcher:', '').trim().replace(/"/g, '');
        const commentIndex = matcherValue.indexOf('#');
        if (commentIndex !== -1) {
          matcherValue = matcherValue.substring(0, commentIndex).trim();
        }
        currentHook.matcher = matcherValue;
      } else if (trimmed.startsWith('target:')) {
        currentHook.target = trimmed.replace('target:', '').trim();
      } else if (trimmed.startsWith('template:')) {
        currentHook.template = '';
        currentHook.inTemplate = true;  // 标记正在解析模板
      } else if (currentHook && currentHook.inTemplate && !trimmed.startsWith('#') && trimmed) {
        // 模板内容 - 允许包含 {{variable}} 格式
        // 遇到下一个 YAML 键时结束模板
        if (trimmed.startsWith('matcher:') || trimmed.startsWith('target:') || trimmed.startsWith('- ')) {
          currentHook.inTemplate = false;
        } else {
          currentHook.template += (currentHook.template ? '\n' : '') + trimmed;
        }
      }
    }
  }

  if (currentHook) hooks.push(currentHook);

  return { hooks };
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 替换模板变量
 */
function renderTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const escapedKey = escapeRegex(key);
    result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), value || '');
  }
  return result;
}

/**
 * 调用 Gateway 内部 API 发送通知
 */
function sendNotification(target, message, project) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      target: target,
      message: message,
      project: project,
    });

    const options = {
      hostname: INTERNAL_API_HOST,
      port: INTERNAL_API_PORT,
      path: '/api/notify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 5000, // 5 秒超时
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch {
          resolve({ status: 'unknown', raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 从 stdin 读取 JSON 数据
 * Claude Code 通过 stdin 传递完整的 hook 上下文
 */
async function readStdinJson() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      if (data.trim()) {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    process.stdin.on('error', () => {
      resolve(null);
    });

    // 如果没有数据，设置超时
    setTimeout(() => {
      if (!data) {
        resolve(null);
      }
    }, 100);
  });
}

/**
 * 格式化工具输入参数为简洁字符串
 */
function formatToolInput(toolName, toolInput) {
  if (!toolInput) return '';

  const input = toolInput;

  // 根据工具类型提取关键信息
  switch (toolName) {
    case 'Bash':
      return input.command ? input.command.slice(0, 100) : '';
    case 'Read':
      return input.file_path || '';
    case 'Write':
      return input.file_path || '';
    case 'Edit': {
      const oldStr = input.old_string || '';
      const truncated = oldStr.length > 30 ? oldStr.slice(0, 30) + '...' : oldStr;
      return `${input.file_path || ''} (${truncated})`;
    }
    case 'Grep':
      return `${input.pattern || ''} in ${input.path || '.'}`;
    case 'Glob':
      return input.pattern || '';
    case 'WebSearch':
      return input.query || '';
    case 'Task':
    case 'Agent':
      return input.description || input.prompt?.slice(0, 50) || '';
    default:
      // 通用处理：提取前几个关键字段
      const keys = Object.keys(input).slice(0, 3);
      return keys.map(k => `${k}=${String(input[k]).slice(0, 30)}`).join(', ');
  }
}

/**
 * 格式化工具响应为简洁字符串
 */
function formatToolResponse(toolName, toolResponse) {
  if (!toolResponse) return '';

  // 如果是字符串，截取前 100 字符
  if (typeof toolResponse === 'string') {
    return toolResponse.slice(0, 100);
  }

  // 如果是对象，提取关键信息
  if (typeof toolResponse === 'object') {
    // 常见成功/失败标志
    if (toolResponse.success !== undefined) {
      return toolResponse.success ? '成功' : '失败';
    }
    if (toolResponse.error) {
      return `错误: ${String(toolResponse.error).slice(0, 50)}`;
    }
    // 返回对象的主要字段
    const keys = Object.keys(toolResponse).slice(0, 2);
    return keys.map(k => `${k}=${String(toolResponse[k]).slice(0, 30)}`).join(', ');
  }

  return String(toolResponse).slice(0, 100);
}

/**
 * 主函数
 */
async function main() {
  // 首先尝试从 stdin 读取 JSON 数据 (Claude Code 官方方式)
  const stdinData = await readStdinJson();

  // 从 stdin JSON 或环境变量/命令行参数获取 hook 输入
  let eventType, toolName, cwd, sessionId, toolInput, toolResponse, toolUseId;

  if (stdinData) {
    // 使用 stdin JSON 数据 (推荐方式)
    eventType = stdinData.hook_event_name || stdinData.event;
    toolName = stdinData.tool_name;
    cwd = stdinData.cwd || process.cwd();
    sessionId = stdinData.session_id;
    toolInput = stdinData.tool_input;
    toolResponse = stdinData.tool_response;
    toolUseId = stdinData.tool_use_id;
  } else {
    // 回退到环境变量 (兼容旧版本)
    eventType = process.env.CLAUDE_HOOK_EVENT || process.argv[2];
    toolName = process.env.CLAUDE_HOOK_TOOL_NAME || process.argv[3];
    cwd = process.env.CLAUDE_HOOK_CWD || process.cwd();
    sessionId = process.env.CLAUDE_HOOK_SESSION_ID;
  }

  if (!eventType) {
    // 静默退出
    process.exit(0);
  }

  // 读取 hook 配置
  const config = loadHookConfig(cwd);
  if (!config || !config.hooks || config.hooks.length === 0) {
    // 没有配置，静默退出
    process.exit(0);
  }

  // 查找匹配的 hook
  const matchingHooks = config.hooks.filter(hook => {
    // 事件匹配
    const eventMatch = hook.event.toLowerCase() === eventType.toLowerCase();

    // 如果有 matcher，检查工具名是否匹配
    if (hook.matcher && toolName) {
      try {
        const regex = new RegExp(hook.matcher);
        return eventMatch && regex.test(toolName);
      } catch {
        return eventMatch;
      }
    }

    return eventMatch;
  });

  if (matchingHooks.length === 0) {
    process.exit(0);
  }

  // 准备模板变量 (增强版)
  const vars = {
    // 基础变量
    project: path.basename(cwd),
    event: eventType,
    tool: toolName || '',
    timestamp: new Date().toLocaleString('zh-CN'),
    user: os.userInfo().username,
    cwd: cwd,

    // 新增: 会话信息
    session_id: sessionId || '',

    // 新增: 工具调用详情
    tool_input: formatToolInput(toolName, toolInput),
    tool_input_raw: toolInput ? JSON.stringify(toolInput).slice(0, 500) : '',
    tool_response: formatToolResponse(toolName, toolResponse),
    tool_response_raw: toolResponse ? JSON.stringify(toolResponse).slice(0, 500) : '',
    tool_use_id: toolUseId || '',

    // 新增: 格式化的工具描述
    tool_description: '',
  };

  // 生成工具描述
  if (toolName) {
    if (vars.tool_input) {
      vars.tool_description = `${toolName}: ${vars.tool_input}`;
    } else {
      vars.tool_description = toolName;
    }
  }

  // 发送每个匹配的 hook 通知
  for (const hook of matchingHooks) {
    if (!hook.target || !hook.template) continue;

    const message = renderTemplate(hook.template, vars);

    // 去掉 target 前缀 (U_ 或 G_)
    const targetId = hook.target.replace(/^[UG]_/, '');

    try {
      const result = await sendNotification(targetId, message, vars.project);
      if (result.status === 'sent') {
        console.log(`[qqbot-hook] ✅ 通知已发送: ${hook.event}`);
      } else if (result.status === 'cached') {
        console.log(`[qqbot-hook] 📬 通知已缓存: ${hook.event}`);
      } else {
        console.log(`[qqbot-hook] ℹ️ 通知状态: ${result.status || result.raw}`);
      }
    } catch (err) {
      // 网络错误或 Gateway 未运行，静默失败
      // 不影响 Claude Code 正常运行
      console.error(`[qqbot-hook] ⚠️ 无法连接 Gateway: ${err.message}`);
    }
  }

  process.exit(0);
}

main();
