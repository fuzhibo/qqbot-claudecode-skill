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

// 查找 .env 文件
function findEnvFile() {
  const candidates = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(os.homedir(), '.claude', 'qqbot-mcp', '.env'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

// 解析 .env 文件
function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // 去除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }

  return env;
}

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
    if (hidden && process.stdin.isTTY) {
      // 隐藏输入（用于密码）- 仅在 TTY 模式下使用
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
    } else if (hidden && !process.stdin.isTTY) {
      // 非 TTY 模式：直接使用 readline（无法隐藏输入）
      rl.question(question, resolve);
    } else {
      rl.question(question, resolve);
    }
  });
}

async function setupBot(botName, options = {}) {
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

    let appId, clientSecret, defaultTargetId, imageServerBaseUrl;

    // 模式1: 命令行参数直接指定（非交互式）
    if (options.appId && options.secret) {
      appId = options.appId;
      clientSecret = options.secret;
      defaultTargetId = options.defaultTarget || '';
      imageServerBaseUrl = options.imageServer || '';
    }
    // 模式2: 从 .env 文件读取
    else if (options.fromEnv) {
      const envPath = findEnvFile();
      if (!envPath) {
        log('red', '❌ 未找到 .env 文件');
        log('dim', '请在项目根目录创建 .env 文件，包含 QQBOT_APP_ID 和 QQBOT_CLIENT_SECRET');
        return;
      }

      log('cyan', `📄 从 ${envPath} 读取配置...`);
      const env = parseEnvFile(envPath);

      appId = env.QQBOT_APP_ID;
      clientSecret = env.QQBOT_CLIENT_SECRET;
      defaultTargetId = env.QQBOT_TEST_TARGET_ID || env.QQBOT_DEFAULT_TARGET_ID || '';
      imageServerBaseUrl = env.QQBOT_IMAGE_SERVER_BASE_URL || '';

      if (!appId || !clientSecret) {
        log('red', '❌ .env 文件中缺少 QQBOT_APP_ID 或 QQBOT_CLIENT_SECRET');
        return;
      }

      log('green', '✅ 从 .env 文件读取配置成功');
      log('dim', `   AppID: ${appId.slice(0, 8)}...`);
      log('dim', `   Secret: ****`);
      if (defaultTargetId) log('dim', `   默认目标: ${defaultTargetId}`);
    }
    // 模式3: TTY 交互式配置（推荐用于手动配置）
    else if (process.stdin.isTTY && process.stdout.isTTY) {
      // 检测是否存在 .env 文件
      const envPath = findEnvFile();

      if (envPath) {
        log('cyan', `\n📄 检测到 ${envPath} 文件`);
        const useEnv = await prompt(rl, '是否从 .env 文件读取配置？(Y/n): ');

        if (useEnv.trim().toLowerCase() !== 'n') {
          log('cyan', `📄 从 ${envPath} 读取配置...`);
          const env = parseEnvFile(envPath);

          appId = env.QQBOT_APP_ID;
          clientSecret = env.QQBOT_CLIENT_SECRET;
          defaultTargetId = env.QQBOT_TEST_TARGET_ID || env.QQBOT_DEFAULT_TARGET_ID || '';
          imageServerBaseUrl = env.QQBOT_IMAGE_SERVER_BASE_URL || '';

          if (!appId || !clientSecret) {
            log('red', '❌ .env 文件中缺少 QQBOT_APP_ID 或 QQBOT_CLIENT_SECRET');
            log('yellow', '⚠️  将切换到手动输入模式');
            appId = null; // 重置，进入手动模式
          } else {
            log('green', '✅ 从 .env 文件读取配置成功');
          }
        }
      }

      // 手动输入模式（未从 .env 读取或读取失败）
      if (!appId) {
        log('cyan', '\n📝 手动输入配置（凭证不会显示在对话中）');
        log('dim', '提示：为安全起见，建议在 .env 文件中配置凭证\n');

        appId = await prompt(rl, '请输入 AppID: ');
        if (!appId.trim()) {
          log('red', '❌ AppID 不能为空');
          return;
        }

        clientSecret = await prompt(rl, '请输入 Client Secret: ', true);
        if (!clientSecret.trim()) {
          log('red', '❌ Client Secret 不能为空');
          return;
        }

        defaultTargetId = await prompt(rl, '默认目标 ID（可选，按回车跳过）: ');
        imageServerBaseUrl = await prompt(rl, '图床服务器地址（可选，按回车跳过）: ');
      }
    }
    // 模式4: 非 TTY 且无参数 - 报错
    else {
      log('red', '❌ 非交互式环境需要使用 --from-env 参数或提供 --appId 和 --secret');
      log('dim', '用法:');
      log('dim', '  qqbot-mcp-cli setup <botName> --from-env');
      log('dim', '  qqbot-mcp-cli setup <botName> --appId <id> --secret <secret>');
      return;
    }

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
    --from-env             从 .env 文件读取配置（推荐）
    --appId <id>           直接指定 AppID（跳过交互）
    --secret <secret>      直接指定 Secret（不推荐，有泄露风险）
    --default-target <id>  设置默认目标 ID

示例:
  # 方式1: 从 .env 文件读取（推荐，AI不接触凭证）
  qqbot-mcp-cli setup my-bot --from-env

  # 方式2: 交互式配置（手动输入）
  qqbot-mcp-cli setup my-bot

  # 方式3: 命令行参数（不推荐，凭证可能记录在 shell 历史）
  qqbot-mcp-cli setup my-bot --appId <id> --secret <secret>

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

安全配置建议:
  1. 将凭证写入 .env 文件（不会被提交到 Git）
  2. 使用 --from-env 参数让脚本直接读取
  3. 避免在命令行中直接输入 --secret（会记录在 shell 历史）

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
        log('dim', '用法:');
        log('dim', '  qqbot-mcp-cli setup <botName> --from-env          # 推荐：从 .env 读取');
        log('dim', '  qqbot-mcp-cli setup <botName>                     # 交互式配置');
        log('dim', '  qqbot-mcp-cli setup <botName> --appId <id> --secret <secret>');
        process.exit(1);
      }

      // 解析 setup 命令的参数
      const setupOptions = {};
      for (let i = 2; i < args.length; i++) {
        switch (args[i]) {
          case '--from-env':
          case '--fromEnv':
            setupOptions.fromEnv = true;
            break;
          case '--appId':
          case '--app-id':
            setupOptions.appId = args[++i];
            break;
          case '--secret':
            setupOptions.secret = args[++i];
            break;
          case '--default-target':
          case '--defaultTarget':
            setupOptions.defaultTarget = args[++i];
            break;
          case '--image-server':
          case '--imageServer':
            setupOptions.imageServer = args[++i];
            break;
        }
      }

      await setupBot(args[1], setupOptions);
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
