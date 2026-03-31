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
 * 检查网关健康状态（不仅仅是进程存在）
 * 通过调用内部 API 获取真实状态，检测僵尸状态
 */
async function checkGatewayHealth() {
  const INTERNAL_API_URL = 'http://127.0.0.1:3310';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${INTERNAL_API_URL}/api/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { healthy: false, reason: 'api_error', error: `HTTP ${response.status}` };
    }

    const status = await response.json();

    // 场景 1: running = false（已放弃重试，僵尸状态）
    if (status.running === false) {
      return { healthy: false, reason: 'running_false', status };
    }

    // 场景 2: WebSocket 已关闭 (readyState = 3)
    if (status.wsReadyState === 3) {
      return { healthy: false, reason: 'ws_closed', status };
    }

    // 场景 3: WebSocket 超过 5 分钟无活动（可能卡死）
    if (status.lastWsActivity && Date.now() - status.lastWsActivity > 5 * 60 * 1000) {
      return { healthy: false, reason: 'ws_idle_timeout', status };
    }

    return { healthy: true, status };
  } catch (error) {
    // API 不可达，可能进程卡死或端口被占用
    return {
      healthy: false,
      reason: error.name === 'AbortError' ? 'api_timeout' : 'api_error',
      error: error.message
    };
  }
}

/**
 * 重启网关（先停止再启动）
 */
async function restartGateway() {
  const scriptPath = path.join(__dirname, 'qqbot-service.js');

  if (!fs.existsSync(scriptPath)) {
    console.error('[session-start] ⚠️ qqbot-service.js not found');
    return false;
  }

  console.error('[session-start] 🔄 Restarting zombie Gateway...');

  return new Promise((resolve) => {
    // 先停止
    const stopChild = spawn('node', [scriptPath, 'stop'], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    stopChild.on('close', () => {
      // 等待 2 秒后启动
      setTimeout(() => {
        const startChild = spawn('node', [scriptPath, 'start', '--mode', 'auto', '--channel'], {
          detached: true,
          stdio: 'ignore',
          cwd: __dirname,
        });
        startChild.unref();

        // 等待 3 秒后检查是否启动成功
        setTimeout(() => {
          if (isGatewayRunning()) {
            console.error('[session-start] ✅ Gateway restarted successfully');
            resolve(true);
          } else {
            console.error('[session-start] ❌ Gateway restart failed');
            resolve(false);
          }
        }, 3000);
      }, 2000);
    });

    stopChild.on('error', (error) => {
      console.error(`[session-start] ❌ Failed to stop Gateway: ${error.message}`);
      resolve(false);
    });
  });
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
    console.error('[session-start] 🔍 Gateway 进程存在，检查健康状态...');

    // 检查健康状态，检测僵尸状态
    const health = await checkGatewayHealth();

    if (!health.healthy) {
      console.error(`[session-start] ⚠️ 网关僵尸状态: ${health.reason}，自动重启...`);
      recordHookExecution('session-start-handler', 'zombie_detected', `Zombie detected: ${health.reason}`, Date.now() - startTime, 0, { projectName, health });

      const restarted = await restartGateway();

      if (restarted) {
        registerProject();
        recordHookExecution('session-start-handler', 'success', 'Gateway restarted from zombie state', Date.now() - startTime, 0, { projectName, autoRestarted: true, health });
      } else {
        recordHookExecution('session-start-handler', 'failed', 'Gateway restart failed', Date.now() - startTime, 1, { projectName, health });
      }
      return;
    }

    console.error('[session-start] ✅ Gateway 健康');
    registerProject();
    recordHookExecution('session-start-handler', 'success', 'Gateway healthy', Date.now() - startTime, 0, { projectName, gatewayAlreadyRunning: true });
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
