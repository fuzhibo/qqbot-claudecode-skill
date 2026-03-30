#!/usr/bin/env node

/**
 * SessionStart Hook 处理脚本
 *
 * 功能:
 * 1. 读取全局配置
 * 2. 检查 Gateway 是否运行
 * 3. 如果配置允许，自动启动 Gateway
 *
 * 由 Claude Code SessionStart hook 调用
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { recordHookExecution } from './lib/channel-support.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 配置路径
const GATEWAY_DIR = path.join(os.homedir(), '.claude', 'qqbot-gateway');
const CONFIG_FILE = path.join(GATEWAY_DIR, 'qqbot-config.json');
const PID_FILE = path.join(GATEWAY_DIR, 'gateway.pid');
const PROJECTS_FILE = path.join(GATEWAY_DIR, 'projects.json');

// 默认配置
const DEFAULT_CONFIG = {
  workmode: 'channel',
  allowDegradation: true,
  autoStartGateway: true,
  autoNotifyOffline: true,
};

/**
 * 加载配置
 */
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch (error) {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 检查 Gateway 是否运行
 */
function isGatewayRunning() {
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }

  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    if (isNaN(pid) || pid <= 0) {
      return false;
    }

    // 发送信号 0 检查进程是否存在
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // 进程不存在或无权限
    return false;
  }
}

/**
 * 获取当前项目路径
 */
function getCurrentProjectPath() {
  // Claude Code 设置的环境变量
  return process.env.CLAUDE_PROJECT_PATH || process.cwd();
}

/**
 * 获取当前项目名称
 */
function getCurrentProjectName() {
  const projectPath = getCurrentProjectPath();
  return projectPath.split('/').pop() || 'unknown';
}

/**
 * 注册项目到 Gateway
 */
function registerProject() {
  const projectPath = getCurrentProjectPath();
  const projectName = getCurrentProjectName();

  try {
    // 确保 Gateway 目录存在
    if (!fs.existsSync(GATEWAY_DIR)) {
      fs.mkdirSync(GATEWAY_DIR, { recursive: true });
    }

    // 读取现有项目
    let projects = { projects: {}, defaultProject: null };
    if (fs.existsSync(PROJECTS_FILE)) {
      try {
        projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
      } catch (e) {
        // 忽略解析错误
      }
    }

    // 添加或更新项目
    projects.projects[projectName] = {
      path: projectPath,
      name: projectName,
      registeredAt: projects.projects[projectName]?.registeredAt || Date.now(),
      lastActive: Date.now(),
    };

    // 设置为默认项目（如果是第一个）
    if (!projects.defaultProject || Object.keys(projects.projects).length === 1) {
      projects.defaultProject = projectName;
    }

    // 保存
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
    console.error(`[session-start] ✅ Project registered: ${projectName}`);
  } catch (error) {
    console.error(`[session-start] ⚠️ Failed to register project: ${error.message}`);
  }
}

/**
 * 启动 Gateway
 */
async function startGateway() {
  const scriptPath = path.join(__dirname, 'qqbot-service.js');

  if (!fs.existsSync(scriptPath)) {
    console.error('[session-start] ⚠️ qqbot-service.js not found');
    return false;
  }

  console.error('[session-start] 🚀 Auto-starting Gateway...');

  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, 'start', '--mode', 'auto', '--channel'], {
      detached: true,
      stdio: 'ignore',
      cwd: __dirname,
    });

    child.unref();

    child.on('error', (error) => {
      console.error(`[session-start] ❌ Failed to start Gateway: ${error.message}`);
      resolve(false);
    });

    // 给 Gateway 一些启动时间
    setTimeout(() => {
      if (isGatewayRunning()) {
        console.error('[session-start] ✅ Gateway started successfully');
        resolve(true);
      } else {
        console.error('[session-start] ⚠️ Gateway may not have started yet');
        resolve(false);
      }
    }, 2000);
  });
}

/**
 * 主函数
 */
async function main() {
  const startTime = Date.now();
  const projectName = getCurrentProjectName();

  // 记录开始执行
  recordHookExecution('session-start-handler', 'started', 'Hook execution started', 0, 0, { projectName });

  const config = loadConfig();

  // 1. 检查工作模式
  if (config.workmode === 'headless') {
    console.error('[session-start] 📴 Headless mode - skipping Gateway startup');
    recordHookExecution('session-start-handler', 'skipped', 'Headless mode', Date.now() - startTime, 0, { projectName, mode: 'headless' });
    return;
  }

  // 2. 检查 Gateway 是否已运行
  if (isGatewayRunning()) {
    console.error('[session-start] ✅ Gateway already running');
    registerProject();
    recordHookExecution('session-start-handler', 'success', 'Gateway already running', Date.now() - startTime, 0, { projectName, gatewayAlreadyRunning: true });
    return;
  }

  // 3. 如果配置允许，自动启动 Gateway
  if (config.autoStartGateway) {
    const started = await startGateway();
    registerProject();
    recordHookExecution('session-start-handler', started ? 'success' : 'failed',
      started ? 'Gateway started successfully' : 'Gateway start failed',
      Date.now() - startTime, started ? 0 : 1, { projectName, autoStarted: true });
  } else {
    console.error('[session-start] ℹ️ autoStartGateway=false - skipping auto-start');
    recordHookExecution('session-start-handler', 'skipped', 'autoStartGateway=false', Date.now() - startTime, 0, { projectName, autoStartDisabled: true });
  }
}

main().catch((error) => {
  console.error(`[session-start] Error: ${error.message}`);
  recordHookExecution('session-start-handler', 'failed', error.message, 0, 1, { error: error.message });
  process.exit(0); // 不阻塞 Claude Code 启动
});
