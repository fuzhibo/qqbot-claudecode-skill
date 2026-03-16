---
name: qqbot-service
description: QQ Bot 后台服务管理技能 - 管理全局 QQ Bot 网关守护进程。支持 start/stop/restart/status 命令。当用户需要管理 QQ Bot 服务时使用此技能。
version: 1.0.0
---

# /qqbot-service

QQ Bot 后台服务管理技能 - 管理全局 QQ Bot 网关守护进程。

## 用法

```bash
/qqbot-service <command> [options]
```

## 命令

### start - 启动后台服务

```bash
/qqbot-service start [--mode <mode>] [--init-prompt <prompt>]
```

**选项：**
- `--mode <mode>` - 工作模式：`notify`（通知模式）或 `auto`（自动回复模式），默认 `notify`
- `--init-prompt <prompt>` - 初始化提示词，用于配置会话上下文（仅 auto 模式）

**行为：**
1. 启动全局 QQ Bot 网关守护进程
2. 将当前项目注册到网关
3. 获取 session_id 建立持续会话
4. 发送 QQ 通知："激活项目 <项目名称> 的自动回复模式"
5. 返回开启结果

### stop - 停止后台服务

```bash
/qqbot-service stop
```

**行为：**
1. 清理当前项目的自动回复模式配置
2. 发送 QQ 通知："关闭项目 <项目名称> 的自动回复模式"
3. 如果没有其他项目注册，关闭整个网关进程
4. 返回关闭结果

### restart - 重启后台服务

```bash
/qqbot-service restart [--mode <mode>] [--init-prompt <prompt>]
```

等价于 `stop` 后 `start`。

### status - 查看服务状态

```bash
/qqbot-service status
```

**输出：**
- 网关进程状态（运行中/已停止）
- 当前工作模式
- 已注册项目列表
- 默认项目（最后注册的项目）
- 各项目的会话信息

### list - 查看项目列表

```bash
/qqbot-service list
```

显示所有已注册到网关的项目。

### switch - 切换默认项目

```bash
/qqbot-service switch <project-name>
```

将指定项目设为默认项目（用于未指定项目的消息处理）。

## 工作模式

### 通知模式 (notify)

- 收到 QQ 消息时发送桌面通知
- 用户手动处理消息
- 适合偶尔使用

### 自动回复模式 (auto)

- 自动调用 Claude Code Headless 处理消息
- 支持会话上下文保持
- 适合远程任务下达

## 智能消息解析

后台服务支持从消息中提取以下参数：

### 项目名称匹配

消息中包含项目名称时，自动设置 `--cwd` 参数：
```
[qqbot-service] 处理 my-project 的任务
```

### 工具权限匹配

消息中包含 `allowedTools` 或 `disallowedTools` 时，自动构建参数：

**文件操作：** Read, Write, Edit, NotebookEdit
**网络工具：** WebFetch, WebSearch
**执行工具：** Bash, Glob, Grep, BashOutput, KillShell
**任务管理：** Task, TodoWrite
**其他：** SlashCommand, Skill, ExitPlanMode

示例：
```
[qqbot-service] allowedTools: Read, Write, Bash
```

### 权限模式匹配

消息中包含 `permission-mode` 时，自动匹配：

- `default` - 需手动确认未授权操作
- `acceptEdits` - 自动批准文件编辑
- `bypassPermissions` - 完全跳过权限检查
- `plan` - 仅规划不执行

示例：
```
[qqbot-service] permission-mode: acceptEdits
```

## 消息关联

所有消息/文件/图片都与项目关联：

- 发送时添加项目名称前缀：`[项目名称] 消息内容`
- 未指定项目时使用默认项目
- 回复时自动添加关联前缀

## 配置存储

- 全局配置：`~/.claude/qqbot-gateway/`
- 项目注册表：`~/.claude/qqbot-gateway/projects.json`
- 会话信息：`~/.claude/qqbot-gateway/sessions/{projectName}.json`

## 示例

### 启动自动回复模式

```bash
/qqbot-service start --mode auto --init-prompt "你是一个代码审查助手，专注于帮助用户审查和改进代码质量。"
```

### 查看状态

```bash
/qqbot-service status
```

输出：
```
🤖 QQ Bot 网关状态
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
状态: 运行中
模式: auto
PID: 12345

已注册项目:
  1. qqbot-claudecode-skill (默认) ✓
     路径: /home/user/projects/qqbot-claudecode-skill
     会话: sess_abc123

  2. my-other-project
     路径: /home/user/projects/my-other-project
     会话: sess_def456
```

### 切换默认项目

```bash
/qqbot-service switch my-other-project
```

## 注意事项

1. 网关是全局的，支持多项目同时注册
2. 每个项目有独立的会话上下文
3. 自动回复模式会消耗 API 配额
4. 建议在稳定网络环境下使用
