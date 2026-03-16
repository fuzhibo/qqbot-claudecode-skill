#!/usr/bin/env node

/**
 * QQ Bot MCP CLI - 命令行管理工具
 *
 * 用法:
 *   qqbot-mcp-cli setup <botName>    - 交互式配置机器人
 *   qqbot-mcp-cli list               - 列出所有已配置的机器人
 *   qqbot-mcp-cli remove <botName>   - 删除机器人配置
 *   qqbot-mcp-cli help               - 显示帮助信息
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 配置目录和文件路径
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

function prompt(rl, question, hidden = false) {
  return new Promise((resolve) => {
    if (hidden) {
      // 隐藏输入（用于密码）
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      let password = '';
      const onData = (char) => {
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            resolve(password);
            break;
          case '\u0003': // Ctrl+C
            process.exit();
            break;
          case '\u007F': // Backspace
            password = password.slice(0, -1);
            break;
          default:
            password += char;
            break;
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(question, resolve);
    }
  });
}

async function setupBot(botName) {
  log('cyan', `\n🔧 配置机器人: ${botName}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // 检查是否已存在
    const config = readConfig();
    if (config.bots[botName]) {
      log('yellow', `⚠️  机器人 "${botName}" 已存在，将更新配置`);
    }

    // 获取 AppID
    const appId = await prompt(rl, '请输入 AppID: ');
    if (!appId.trim()) {
      log('red', '❌ AppID 不能为空');
      return;
    }

    // 获取 Secret（隐藏输入）
    const clientSecret = await prompt(rl, '请输入 Client Secret: ', true);
    if (!clientSecret.trim()) {
      log('red', '❌ Client Secret 不能为空');
      return;
    }

    // 可选：默认目标 ID
    const defaultTargetId = await prompt(rl, '默认目标 ID（可选，按回车跳过）: ');

    // 可选：图床服务器地址
    const imageServerBaseUrl = await prompt(rl, '图床服务器地址（可选，按回车跳过）: ');

    // 保存配置
    const botConfig = {
      name: botName,
      appId: appId.trim(),
      clientSecret: clientSecret.trim(),
      enabled: true,
      defaultTargetId: defaultTargetId.trim() || undefined,
      imageServerBaseUrl: imageServerBaseUrl.trim() || undefined,
      markdownSupport: true,
      createdAt: config.bots[botName]?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    config.bots[botName] = botConfig;
    writeConfig(config);

    log('green', `\n✅ 机器人 "${botName}" 配置成功！`);
    log('dim', `配置文件位置: ${CONFIG_FILE}`);
  } finally {
    rl.close();
  }
}

function listBots() {
  const config = readConfig();
  const bots = Object.values(config.bots);

  log('cyan', '\n📋 已配置的机器人列表\n');

  if (bots.length === 0) {
    log('yellow', '暂无已配置的机器人');
    log('dim', '使用 "qqbot-mcp-cli setup <botName>" 添加机器人');
    return;
  }

  bots.forEach((bot, index) => {
    const status = bot.enabled ? `${colors.green}✅ 启用${colors.reset}` : `${colors.red}❌ 禁用${colors.reset}`;
    console.log(`${index + 1}. ${bot.name}`);
    console.log(`   状态: ${status}`);
    console.log(`   AppID: ${bot.appId.slice(0, 8)}...`);
    console.log(`   默认目标: ${bot.defaultTargetId || '未设置'}`);
    console.log(`   更新时间: ${new Date(bot.updatedAt).toLocaleString()}`);
    console.log('');
  });

  log('dim', `配置文件: ${CONFIG_FILE}`);
}

function removeBot(botName) {
  const config = readConfig();

  if (!config.bots[botName]) {
    log('red', `❌ 机器人 "${botName}" 不存在`);
    return;
  }

  delete config.bots[botName];
  writeConfig(config);

  log('green', `✅ 机器人 "${botName}" 已删除`);
}

function showHelp() {
  console.log(`
${colors.cyan}QQ Bot MCP CLI - 命令行管理工具${colors.reset}

用法:
  qqbot-mcp-cli <command> [options]

命令:
  ${colors.green}setup <botName>${colors.reset}    交互式配置机器人凭证
  ${colors.green}list${colors.reset}               列出所有已配置的机器人
  ${colors.green}remove <botName>${colors.reset}   删除机器人配置
  ${colors.green}status${colors.reset}             检查配置状态
  ${colors.green}doctor${colors.reset}             诊断和修复插件问题
  ${colors.green}send <target> <msg>${colors.reset} 发送消息到 QQ
  ${colors.green}help${colors.reset}               显示此帮助信息

选项:
  setup 命令:
    --appId <id>           直接指定 AppID（跳过交互）
    --secret <secret>      直接指定 Secret（不推荐）
    --default-target <id>  设置默认目标 ID

示例:
  # 交互式配置
  qqbot-mcp-cli setup my-bot

  # 列出所有机器人
  qqbot-mcp-cli list

  # 检查配置状态
  qqbot-mcp-cli status

  # 发送消息
  qqbot-mcp-cli send G_123456789 "你好，这是测试消息"
  qqbot-mcp-cli send U_abc123 "私聊消息"

  # 诊断问题
  qqbot-mcp-cli doctor

  # 自动修复问题
  qqbot-mcp-cli doctor --fix

  # 删除机器人
  qqbot-mcp-cli remove old-bot

环境变量:
  QQBOT_APP_ID            默认机器人的 AppID
  QQBOT_CLIENT_SECRET     默认机器人的 Secret
  QQBOT_IMAGE_SERVER_BASE_URL  图床服务器地址

配置文件位置:
  ${CONFIG_FILE}

更多信息请访问: https://github.com/sliverp/qqbot
`);
}

async function runDoctor() {
  const { execSync } = await import('child_process');
  const { pathToFileURL } = await import('url');
  const __dirname = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
  const scriptPath = path.join(__dirname, '..', 'scripts', 'doctor.js');

  try {
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
  } catch (error) {
    process.exit(error.status || 1);
  }
}

async function runDoctorFix() {
  const { execSync } = await import('child_process');
  const __dirname = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
  const scriptPath = path.join(__dirname, '..', 'scripts', 'doctor.js');

  try {
    execSync(`node "${scriptPath}" --fix`, { stdio: 'inherit' });
  } catch (error) {
    process.exit(error.status || 1);
  }
}

async function sendMessage(args) {
  const { execSync } = await import('child_process');
  const __dirname = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
  const scriptPath = path.join(__dirname, '..', 'scripts', 'send-message.js');

  // 处理帮助请求
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
${colors.cyan}发送消息到 QQ${colors.reset}

用法:
  qqbot-mcp-cli send <targetId> <message> [options]

参数:
  ${colors.green}targetId${colors.reset}  目标 ID (G_群号/U_用户ID/C_频道ID)
  ${colors.green}message${colors.reset}   消息内容

选项:
  ${colors.green}--bot <name>${colors.reset}   使用指定的机器人配置
  ${colors.green}--type <type>${colors.reset}  消息类型: c2c, group, channel

示例:
  qqbot-mcp-cli send G_123456789 "你好，群消息"
  qqbot-mcp-cli send U_abc123 "私聊消息" --bot my-bot
  qqbot-mcp-cli send C_channel123 "频道消息"
`);
    process.exit(0);
  }

  if (args.length < 2) {
    log('red', '❌ 参数不完整');
    log('dim', '用法: qqbot-mcp-cli send <targetId> <message> [--bot <name>]');
    process.exit(1);
  }

  try {
    execSync(`node "${scriptPath}" ${args.join(' ')}`, { stdio: 'inherit' });
  } catch (error) {
    process.exit(error.status || 1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'setup':
      if (!args[1]) {
        log('red', '❌ 请指定机器人名称');
        log('dim', '用法: qqbot-mcp-cli setup <botName>');
        process.exit(1);
      }
      await setupBot(args[1]);
      break;

    case 'list':
      listBots();
      break;

    case 'remove':
      if (!args[1]) {
        log('red', '❌ 请指定机器人名称');
        log('dim', '用法: qqbot-mcp-cli remove <botName>');
        process.exit(1);
      }
      removeBot(args[1]);
      break;

    case 'doctor':
      const shouldFix = args.includes('--fix') || args.includes('-f');
      if (shouldFix) {
        await runDoctorFix();
      } else {
        await runDoctor();
      }
      break;

    case 'send':
      await sendMessage(args.slice(1));
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      if (command) {
        log('red', `❌ 未知命令: ${command}`);
      }
      showHelp();
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  log('red', `❌ 错误: ${err.message}`);
  process.exit(1);
});
