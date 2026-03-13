#!/usr/bin/env node

/**
 * QQ Bot Hook 配置管理
 *
 * 管理项目级的 Hook 配置，用于在 Claude Code 触发 hook 事件时推送消息到 QQ。
 *
 * 用法：
 *   node scripts/qqbot-hooks.js list
 *   node scripts/qqbot-hooks.js add
 *   node scripts/qqbot-hooks.js remove <id>
 *   node scripts/qqbot-hooks.js test <id>
 *   node scripts/qqbot-hooks.js clear
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const HOOKS_FILE = path.join(GATEWAY_DIR, 'hooks.json');

// 确保目录存在
if (!fs.existsSync(GATEWAY_DIR)) {
  fs.mkdirSync(GATEWAY_DIR, { recursive: true });
}

// 加载环境变量
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

const APP_ID = process.env.QQBOT_APP_ID;
const CLIENT_SECRET = process.env.QQBOT_CLIENT_SECRET;

// ============ 颜色输出 ============
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(color, msg) {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// ============ Hook 定义 ============
const AVAILABLE_HOOKS = {
  // 会话生命周期
  SessionStart: {
    name: 'SessionStart',
    description: '会话开始时',
    category: '会话生命周期',
    variables: ['project', 'timestamp', 'cwd'],
  },
  SessionEnd: {
    name: 'SessionEnd',
    description: '会话结束时',
    category: '会话生命周期',
    variables: ['project', 'timestamp', 'cwd'],
  },

  // 工具调用
  PreToolUse: {
    name: 'PreToolUse',
    description: '工具调用前',
    category: '工具调用',
    variables: ['project', 'tool', 'timestamp', 'cwd'],
  },
  PostToolUse: {
    name: 'PostToolUse',
    description: '工具调用后',
    category: '工具调用',
    variables: ['project', 'tool', 'timestamp', 'cwd'],
  },

  // 用户交互
  UserPromptSubmit: {
    name: 'UserPromptSubmit',
    description: '用户提交提示时',
    category: '用户交互',
    variables: ['project', 'timestamp', 'cwd'],
  },
  PreCompact: {
    name: 'PreCompact',
    description: '上下文压缩前',
    category: '用户交互',
    variables: ['project', 'timestamp', 'cwd'],
  },

  // 权限请求
  PermissionRequest: {
    name: 'PermissionRequest',
    description: '权限请求时',
    category: '权限请求',
    variables: ['project', 'timestamp', 'cwd'],
  },
};

// ============ Hook 管理 ============
function loadHooks() {
  if (!fs.existsSync(HOOKS_FILE)) {
    return { hooks: [] };
  }
  return JSON.parse(fs.readFileSync(HOOKS_FILE, 'utf-8'));
}

function saveHooks(data) {
  fs.writeFileSync(HOOKS_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return `hook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function listHooks() {
  const data = loadHooks();

  log('cyan', '\n🪝 已配置的 Hook');
  log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (data.hooks.length === 0) {
    log('yellow', '\n暂无配置的 Hook');
    log('dim', '使用 `qqbot-hooks add` 添加新配置\n');
    return;
  }

  data.hooks.forEach((hook, index) => {
    const hookDef = AVAILABLE_HOOKS[hook.event];
    console.log(`\n${index + 1}. ${colors.green}${hook.event}${colors.reset} - ${hookDef?.description || '未知'}`);
    console.log(`   ${colors.dim}ID: ${hook.id}${colors.reset}`);
    console.log(`   ${colors.dim}Matcher: ${hook.matcher || '(all)'}${colors.reset}`);
    console.log(`   ${colors.dim}Target: ${hook.target}${colors.reset}`);
    console.log(`   ${colors.dim}状态: ${hook.enabled ? '✅ 已启用' : '❌ 已禁用'}${colors.reset}`);
  });

  console.log('');
}

function showAvailableHooks() {
  log('cyan', '\n🪝 可用的 Hook 事件');
  log('cyan', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const categories = {};
  for (const [name, hook] of Object.entries(AVAILABLE_HOOKS)) {
    if (!categories[hook.category]) {
      categories[hook.category] = [];
    }
    categories[hook.category].push(hook);
  }

  let index = 1;
  for (const [category, hooks] of Object.entries(categories)) {
    console.log(`\n${colors.bold}${category}:${colors.reset}`);
    hooks.forEach(hook => {
      console.log(`  ${colors.green}${index}.${colors.reset} ${hook.name.padEnd(20)} - ${hook.description}`);
      index++;
    });
  }
  console.log('');
}

async function addHook() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  try {
    showAvailableHooks();

    // 选择 Hook 事件
    const hookList = Object.values(AVAILABLE_HOOKS);
    const eventChoice = await question('请选择 Hook 事件 (输入数字): ');
    const eventIndex = parseInt(eventChoice) - 1;

    if (eventIndex < 0 || eventIndex >= hookList.length) {
      log('red', '❌ 无效的选择');
      rl.close();
      return;
    }

    const selectedHook = hookList[eventIndex];
    log('green', `\n已选择: ${selectedHook.name}`);

    // 配置 Matcher
    const matcher = await question('配置 Matcher 模式 (留空匹配所有): ');
    log('cyan', `Matcher: ${matcher || '(匹配所有)'}`);

    // 配置消息模板
    console.log(`\n${colors.cyan}可用变量:${colors.reset}`);
    selectedHook.variables.forEach(v => {
      console.log(`  {{${v}}}`);
    });

    console.log(`\n${colors.cyan}配置消息模板 (输入完成后按 Ctrl+D 结束):${colors.reset}`);
    let template = '';
    rl.pause();

    const templateLines = [];
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    await new Promise(resolve => {
      let lineCount = 0;
      process.stdin.on('data', (chunk) => {
        templateLines.push(chunk);
        lineCount++;
        if (lineCount >= 10) {
          process.stdin.pause();
          resolve();
        }
      });
      process.stdin.on('end', resolve);
    });

    template = templateLines.join('').trim() || `🔧 ${selectedHook.name}\n项目: {{project}}\n时间: {{timestamp}}`;
    log('cyan', `\n模板:\n${template}`);

    // 选择目标类型
    rl.close();
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question2 = (prompt) => new Promise(resolve => rl2.question(prompt, resolve));

    console.log(`\n${colors.cyan}选择目标类型:${colors.reset}`);
    console.log('  1. 私聊 (U_)');
    console.log('  2. 群聊 (G_)');

    const targetType = await question2('请选择: ');
    const isPrivate = targetType === '1';
    const prefix = isPrivate ? 'U_' : 'G_';

    const targetId = await question2(`输入目标 ID (${prefix}): `);
    const target = `${prefix}${targetId}`;

    // 确认保存
    const confirm = await question2('确认保存? (y/n): ');

    if (confirm.toLowerCase() === 'y') {
      const data = loadHooks();
      const newHook = {
        id: generateId(),
        event: selectedHook.name,
        matcher: matcher || null,
        template,
        target,
        enabled: true,
        createdAt: Date.now(),
      };

      data.hooks.push(newHook);
      saveHooks(data);

      log('green', '\n✅ Hook 配置已保存');
      log('dim', `ID: ${newHook.id}`);
    } else {
      log('yellow', '\n⚠️ 已取消');
    }

    rl2.close();
  } catch (error) {
    log('red', `❌ 错误: ${error.message}`);
    rl.close();
  }
}

function removeHook(id) {
  const data = loadHooks();
  const index = data.hooks.findIndex(h => h.id === id || h.id.startsWith(id));

  if (index === -1) {
    log('yellow', `⚠️ 未找到 Hook: ${id}`);
    return;
  }

  const removed = data.hooks.splice(index, 1)[0];
  saveHooks(data);

  log('green', `✅ 已删除 Hook: ${removed.event}`);
}

function toggleHook(id, enabled) {
  const data = loadHooks();
  const hook = data.hooks.find(h => h.id === id || h.id.startsWith(id));

  if (!hook) {
    log('yellow', `⚠️ 未找到 Hook: ${id}`);
    return;
  }

  hook.enabled = enabled;
  saveHooks(data);

  log('green', `✅ Hook ${hook.event} 已${enabled ? '启用' : '禁用'}`);
}

function clearHooks() {
  saveHooks({ hooks: [] });
  log('green', '✅ 所有 Hook 配置已清除');
}

async function testHook(id) {
  const data = loadHooks();
  const hook = data.hooks.find(h => h.id === id || h.id.startsWith(id));

  if (!hook) {
    log('yellow', `⚠️ 未找到 Hook: ${id}`);
    return;
  }

  log('cyan', `\n🧪 测试 Hook: ${hook.event}`);
  log('dim', `Target: ${hook.target}`);

  // 构建测试消息
  let message = hook.template
    .replace(/\{\{project\}\}/g, 'test-project')
    .replace(/\{\{tool\}\}/g, 'Bash')
    .replace(/\{\{timestamp\}\}/g, new Date().toISOString().slice(0, 19).replace('T', ' '))
    .replace(/\{\{cwd\}\}/g, process.cwd())
    .replace(/\{\{user\}\}/g, os.userInfo().username);

  log('cyan', '\n消息内容:');
  console.log(message);

  // 发送测试消息
  try {
    const token = await getAccessToken();
    const targetId = hook.target.replace(/^[UG]_/, '');

    const resp = await fetch(`https://api.sgroup.qq.com/v2/users/${targetId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `QQBot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `[测试] ${message}`,
        msg_type: 0,
        msg_seq: Math.floor(Math.random() * 1000000),
      }),
    });

    const result = await resp.json();

    if (result.id) {
      log('green', '\n✅ 测试消息已发送');
    } else {
      log('yellow', `\n⚠️ 发送失败: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    log('red', `\n❌ 发送错误: ${error.message}`);
  }
}

async function getAccessToken() {
  const resp = await fetch('https://bots.qq.com/app/getAppAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: APP_ID, clientSecret: CLIENT_SECRET }),
  });
  const data = await resp.json();
  return data.access_token;
}

// ============ 命令处理 ============
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'list':
  case '--list':
    listHooks();
    break;

  case 'add':
    addHook();
    break;

  case 'remove':
  case '--remove':
    if (!arg) {
      console.log('用法: qqbot-hooks remove <id>');
      process.exit(1);
    }
    removeHook(arg);
    break;

  case 'enable':
    if (!arg) {
      console.log('用法: qqbot-hooks enable <id>');
      process.exit(1);
    }
    toggleHook(arg, true);
    break;

  case 'disable':
    if (!arg) {
      console.log('用法: qqbot-hooks disable <id>');
      process.exit(1);
    }
    toggleHook(arg, false);
    break;

  case 'test':
  case '--test':
    if (!arg) {
      console.log('用法: qqbot-hooks test <id>');
      process.exit(1);
    }
    testHook(arg);
    break;

  case 'clear':
  case '--clear':
    clearHooks();
    break;

  case 'available':
    showAvailableHooks();
    break;

  default:
    console.log(`
QQ Bot Hook 配置管理

用法:
  qqbot-hooks list               显示已配置的 Hook
  qqbot-hooks add                添加新 Hook (交互式)
  qqbot-hooks remove <id>        删除指定 Hook
  qqbot-hooks enable <id>        启用指定 Hook
  qqbot-hooks disable <id>       禁用指定 Hook
  qqbot-hooks test <id>          测试发送 Hook 消息
  qqbot-hooks clear              清除所有 Hook
  qqbot-hooks available          显示可用的 Hook 事件
`);
}
