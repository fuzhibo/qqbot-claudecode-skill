/**
 * 智能消息解析器
 *
 * 从 QQ 消息中提取：
 * 1. 项目名称 → --cwd 参数
 * 2. 工具权限 → --allowedTools / --disallowedTools 参数
 * 3. 权限模式 → --permission-mode 参数
 */

// 工具关键词映射
export const TOOL_KEYWORDS = {
  // 文件操作
  Read: ['read', '读取', '查看文件', '读文件'],
  Write: ['write', '写入', '创建文件', '写文件', '新建文件'],
  Edit: ['edit', '编辑', '修改', '更改'],
  NotebookEdit: ['notebook', 'jupyter', '笔记本', 'ipynb'],

  // 网络工具
  WebFetch: ['fetch', '获取网页', 'webfetch', '网页获取', '抓取网页'],
  WebSearch: ['search', '搜索', 'websearch', '网络搜索', '网上搜索'],

  // 执行工具
  Bash: ['bash', 'shell', '命令', '执行', '终端', '命令行'],
  Glob: ['glob', '文件匹配', '查找文件', '文件搜索', 'glob模式'],
  Grep: ['grep', '搜索代码', '查找内容', '内容搜索', '代码搜索'],
  BashOutput: ['output', '输出', 'bashoutput', '命令输出'],
  KillShell: ['kill', '终止', 'killshell', '停止进程'],

  // 任务管理
  Task: ['task', '任务', '子代理', 'agent', '子任务'],
  TodoWrite: ['todo', '待办', '任务清单', 'todowrite', '待办事项'],

  // 其他
  SlashCommand: ['slash', '命令', '斜杠命令', 'slashcommand'],
  Skill: ['skill', '技能', 'skill'],
  ExitPlanMode: ['exitplan', '退出规划', 'exitplanmode'],
};

// 权限模式关键词
export const PERMISSION_MODE_KEYWORDS = {
  default: ['default', '默认模式', 'default mode'],
  acceptEdits: ['acceptEdits', 'accept', '自动编辑', '自动批准', '自动批准编辑'],
  bypassPermissions: ['bypass', 'skip', '跳过权限', 'bypassPermissions', '完全跳过'],
  plan: ['plan', '规划模式', '仅规划', 'plan mode'],
};

/**
 * 解析消息中的项目名称
 * @param {string} message - 消息内容
 * @param {Object} projects - 项目注册表
 * @returns {{projectName: string|null, cwd: string|null}}
 */
export function parseProjectName(message, projects) {
  // 格式1: [项目名称] 消息内容
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    const name = bracketMatch[1];
    if (projects[name]) {
      return { projectName: name, cwd: projects[name].path };
    }
  }

  // 格式2: 项目:项目名称 或 project:项目名称
  const colonMatch = message.match(/(?:项目|project)[:：]\s*([^\s\n]+)/i);
  if (colonMatch) {
    const name = colonMatch[1];
    if (projects[name]) {
      return { projectName: name, cwd: projects[name].path };
    }
  }

  // 格式3: 消息中直接包含已注册的项目名称
  for (const [name, project] of Object.entries(projects)) {
    if (message.includes(name)) {
      return { projectName: name, cwd: project.path };
    }
  }

  return { projectName: null, cwd: null };
}

/**
 * 解析消息中的工具权限
 * @param {string} message - 消息内容
 * @returns {{allowedTools: string[], disallowedTools: string[]}}
 */
export function parseToolPermissions(message) {
  const result = {
    allowedTools: [],
    disallowedTools: [],
  };

  // 解析 allowedTools
  // 格式: allowedTools: Read, Write, Bash 或 允许工具: Read, Write
  const allowedMatch = message.match(/(?:allowedTools|允许工具|allow)[:：]\s*([^\n]+)/i);
  if (allowedMatch) {
    const tools = allowedMatch[1].split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
    for (const tool of tools) {
      const matched = matchToolKeyword(tool);
      if (matched && !result.allowedTools.includes(matched)) {
        result.allowedTools.push(matched);
      }
    }
  }

  // 解析 disallowedTools
  // 格式: disallowedTools: Bash 或 禁用工具: Bash
  const disallowedMatch = message.match(/(?:disallowedTools|禁用工具|disallow|禁止)[:：]\s*([^\n]+)/i);
  if (disallowedMatch) {
    const tools = disallowedMatch[1].split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
    for (const tool of tools) {
      const matched = matchToolKeyword(tool);
      if (matched && !result.disallowedTools.includes(matched)) {
        result.disallowedTools.push(matched);
      }
    }
  }

  // 隐式匹配：如果消息中包含工具关键词但没有明确的 allowedTools 声明
  // 则自动添加相关工具到 allowedTools
  if (result.allowedTools.length === 0 && result.disallowedTools.length === 0) {
    for (const [toolName, keywords] of Object.entries(TOOL_KEYWORDS)) {
      for (const keyword of keywords) {
        if (message.toLowerCase().includes(keyword.toLowerCase())) {
          if (!result.allowedTools.includes(toolName)) {
            result.allowedTools.push(toolName);
          }
          break;
        }
      }
    }
  }

  return result;
}

/**
 * 匹配工具关键词
 * @param {string} input - 用户输入的工具名
 * @returns {string|null} - 匹配到的工具名
 */
function matchToolKeyword(input) {
  const normalized = input.trim().toLowerCase();

  // 直接匹配工具名
  for (const toolName of Object.keys(TOOL_KEYWORDS)) {
    if (normalized === toolName.toLowerCase()) {
      return toolName;
    }
  }

  // 匹配关键词
  for (const [toolName, keywords] of Object.entries(TOOL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized === keyword.toLowerCase()) {
        return toolName;
      }
    }
  }

  return null;
}

/**
 * 解析消息中的权限模式
 * @param {string} message - 消息内容
 * @returns {string|null} - 权限模式
 */
export function parsePermissionMode(message) {
  // 格式: permission-mode: acceptEdits 或 权限模式: 自动编辑
  const modeMatch = message.match(/(?:permission-mode|权限模式|mode)[:：]\s*([^\s\n]+)/i);
  if (modeMatch) {
    const input = modeMatch[1].toLowerCase();
    for (const [mode, keywords] of Object.entries(PERMISSION_MODE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (input === keyword.toLowerCase()) {
          return mode;
        }
      }
    }
  }

  // 隐式匹配
  for (const [mode, keywords] of Object.entries(PERMISSION_MODE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (message.toLowerCase().includes(keyword.toLowerCase())) {
        return mode;
      }
    }
  }

  return null;
}

/**
 * 完整解析消息
 * @param {string} message - 消息内容
 * @param {Object} projects - 项目注册表
 * @param {string} defaultProject - 默认项目名
 * @returns {Object} - 解析结果
 */
export function parseMessage(message, projects = {}, defaultProject = null) {
  const result = {
    originalMessage: message,
    projectName: null,
    cwd: null,
    allowedTools: [],
    disallowedTools: [],
    permissionMode: null,
    cleanMessage: message,
  };

  // 解析项目
  const projectResult = parseProjectName(message, projects);
  if (projectResult.projectName) {
    result.projectName = projectResult.projectName;
    result.cwd = projectResult.cwd;
  } else if (defaultProject && projects[defaultProject]) {
    result.projectName = defaultProject;
    result.cwd = projects[defaultProject].path;
  }

  // 解析工具权限
  const toolResult = parseToolPermissions(message);
  result.allowedTools = toolResult.allowedTools;
  result.disallowedTools = toolResult.disallowedTools;

  // 解析权限模式
  result.permissionMode = parsePermissionMode(message);

  // 清理消息：移除指令部分
  result.cleanMessage = message
    .replace(/\[[^\]]+\]\s*/g, '') // 移除 [项目名]
    .replace(/(?:项目|project)[:：]\s*[^\s\n]+\s*/gi, '') // 移除 项目:xxx
    .replace(/(?:allowedTools|允许工具)[:：]\s*[^\n]+\s*/gi, '') // 移除 allowedTools
    .replace(/(?:disallowedTools|禁用工具)[:：]\s*[^\n]+\s*/gi, '') // 移除 disallowedTools
    .replace(/(?:permission-mode|权限模式)[:：]\s*[^\s\n]+\s*/gi, '') // 移除 permission-mode
    .trim();

  return result;
}

/**
 * 构建 Claude CLI 参数
 * @param {Object} parsed - 解析结果
 * @param {string|null} sessionId - 会话 ID (用于 --resume 恢复上下文)
 * @returns {string[]} - CLI 参数数组
 */
export function buildClaudeArgs(parsed, sessionId = null) {
  const args = ['-p'];

  // 输出格式 (stream-json 需要 --verbose)
  args.push('--output-format', 'stream-json');
  args.push('--verbose');

  // 会话恢复 - 保持上下文连续性
  if (sessionId) {
    args.push('--resume', sessionId);
  }

  // 注意：工作目录 (cwd) 通过 spawn 的 options.cwd 设置
  // 不要添加 --cwd 参数，因为 claude CLI 不支持

  // 允许的工具
  if (parsed.allowedTools.length > 0) {
    args.push('--allowedTools', parsed.allowedTools.join(','));
  }

  // 禁用的工具
  if (parsed.disallowedTools.length > 0) {
    args.push('--disallowedTools', parsed.disallowedTools.join(','));
  }

  // 权限模式
  if (parsed.permissionMode) {
    args.push('--permission-mode', parsed.permissionMode);
  }

  return args;
}

export default {
  parseMessage,
  parseProjectName,
  parseToolPermissions,
  parsePermissionMode,
  buildClaudeArgs,
  TOOL_KEYWORDS,
  PERMISSION_MODE_KEYWORDS,
};
