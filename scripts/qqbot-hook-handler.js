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
 * 替换模板变量
 */
function renderTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
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
 * 主函数
 */
async function main() {
  // 获取 hook 输入 (从环境变量或命令行参数)
  const eventType = process.env.CLAUDE_HOOK_EVENT || process.argv[2];
  const toolName = process.env.CLAUDE_HOOK_TOOL_NAME || process.argv[3];
  const cwd = process.env.CLAUDE_HOOK_CWD || process.cwd();

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

  // 准备模板变量
  const vars = {
    project: path.basename(cwd),
    event: eventType,
    tool: toolName || '',
    timestamp: new Date().toLocaleString('zh-CN'),
    user: os.userInfo().username,
    cwd: cwd,
  };

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
