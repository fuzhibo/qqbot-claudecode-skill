#!/usr/bin/env node

/**
 * QQ Bot MCP Setup Wizard
 * 首次安装后自动运行的配置向导
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.claude', 'qqbot-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return { version: '1.0.0', bots: {}, lastUpdated: Date.now() };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return { version: '1.0.0', bots: {}, lastUpdated: Date.now() };
  }
}

function writeConfig(config) {
  ensureConfigDir();
  config.lastUpdated = Date.now();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function isConfigured() {
  const config = readConfig();
  return Object.keys(config.bots).length > 0 ||
    (process.env.QQBOT_APP_ID && process.env.QQBOT_CLIENT_SECRET);
}

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function runSetupWizard() {
  log('cyan', '\n╔══════════════════════════════════════════════════════════╗');
  log('cyan', '║       🤖 QQ Bot MCP - 首次配置向导                       ║');
  log('cyan', '╚══════════════════════════════════════════════════════════╝\n');

  log('dim', '此向导将帮助你配置 QQ 机器人，使其能与 Claude Code 通信。');
  log('dim', '你需要准备：QQ 开放平台的 AppID 和 Client Secret\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // 检查环境变量
    if (process.env.QQBOT_APP_ID && process.env.QQBOT_CLIENT_SECRET) {
      log('green', '✅ 检测到环境变量配置');
      log('dim', `   QQBOT_APP_ID: ${process.env.QQBOT_APP_ID.slice(0, 8)}...`);
      log('dim', '   QQBOT_CLIENT_SECRET: ******\n');

      const useEnv = await prompt(rl, '是否使用环境变量配置？(Y/n): ');
      if (useEnv.toLowerCase() !== 'n') {
        log('green', '\n✅ 将使用环境变量配置');
        rl.close();
        return;
      }
    }

    // 交互式配置
    const botName = await prompt(rl, '请输入机器人名称 (默认: default): ');
    const name = botName.trim() || 'default';

    const appId = await prompt(rl, '请输入 AppID: ');
    if (!appId.trim()) {
      log('red', '❌ AppID 不能为空');
      rl.close();
      return;
    }

    // 隐藏输入 Secret
    process.stdout.write('请输入 Client Secret: ');
    process.stdin.setRawMode(true);
    let clientSecret = '';
    await new Promise((resolve) => {
      process.stdin.on('data', (char) => {
        if (char === '\n' || char === '\r') {
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          resolve();
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007F') {
          clientSecret = clientSecret.slice(0, -1);
        } else {
          clientSecret += char;
        }
      });
    });

    if (!clientSecret.trim()) {
      log('red', '❌ Client Secret 不能为空');
      rl.close();
      return;
    }

    const defaultTarget = await prompt(rl, '默认目标 ID (可选，按回车跳过): ');
    const imageServer = await prompt(rl, '图床服务器地址 (可选，按回车跳过): ');

    // 保存配置
    const config = readConfig();
    config.bots[name] = {
      name,
      appId: appId.trim(),
      clientSecret: clientSecret.trim(),
      enabled: true,
      defaultTargetId: defaultTarget.trim() || undefined,
      imageServerBaseUrl: imageServer.trim() || undefined,
      markdownSupport: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    writeConfig(config);

    log('green', '\n✅ 配置完成！');
    log('dim', `配置文件: ${CONFIG_FILE}\n`);

    log('cyan', '可用命令:');
    log('dim', '  /qqbot-send <target> <message>  - 发送消息到 QQ');
    log('dim', '  /qqbot-tasks                    - 获取未读任务');
    log('dim', '  /qqbot-list                     - 列出已配置机器人');
    log('dim', '  /qqbot-upload <target> <file>   - 上传文件到 QQ\n');

  } finally {
    rl.close();
  }
}

// 主入口
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    // 检查模式：只检查是否已配置
    if (isConfigured()) {
      log('green', '✅ QQ Bot MCP 已配置');
      process.exit(0);
    } else {
      log('yellow', '⚠️  QQ Bot MCP 尚未配置');
      log('dim', '运行 "qqbot-mcp-cli setup" 或设置环境变量进行配置');
      process.exit(1);
    }
  }

  if (args.includes('--status')) {
    // 状态模式：显示当前配置
    const config = readConfig();
    if (Object.keys(config.bots).length === 0) {
      log('yellow', '暂无已配置的机器人');
      log('dim', '使用环境变量或运行 setup 向导进行配置');
    } else {
      log('cyan', '\n已配置的机器人:\n');
      Object.values(config.bots).forEach((bot) => {
        log('white', `  • ${bot.name}`);
        log('dim', `    AppID: ${bot.appId.slice(0, 8)}...`);
        log('dim', `    默认目标: ${bot.defaultTargetId || '未设置'}`);
      });
    }
    process.exit(0);
  }

  // 运行配置向导
  await runSetupWizard();
}

main().catch((err) => {
  log('red', `❌ 错误: ${err.message}`);
  process.exit(1);
});
