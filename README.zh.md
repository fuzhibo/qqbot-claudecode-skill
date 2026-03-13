# QQ Bot MCP for Claude Code

> **原版文档**: [README.old.zh.md](README.old.zh.md) | **[English](README.md)**

一个通过模型上下文协议 (MCP) 实现 Claude Code 与 QQ 双向通信的插件。

[![npm version](https://img.shields.io/npm/v/@sliverp/qqbot-mcp?color=blue&label=npm)](https://www.npmjs.com/package/@sliverp/qqbot-mcp)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js->=18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

**简体中文 | [English](README.md)**

---

## 功能特性

- **MCP 集成** - 完整的 MCP 服务器，包含 5 个核心工具
- **后台网关** - WebSocket 守护进程，实时处理 QQ 消息
- **多项目支持** - 注册多个项目，独立会话管理
- **智能消息解析** - 自动识别项目名称、工具权限、权限模式
- **Hook 系统** - 配置项目级 Hook，推送 QQ 通知
- **自动回复模式** - 自动调用 Claude Code 无头模式

---

## 架构设计

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   QQ 客户端      │────▶│  QQ Bot 网关     │────▶│  Claude Code    │
│   (用户)         │     │  (WebSocket)     │     │  (无头模式)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  消息解析器       │
                        │  - 项目名称      │
                        │  - 工具权限      │
                        │  - 权限模式      │
                        └──────────────────┘
```

### 核心组件

| 组件 | 文件 | 描述 |
|------|------|------|
| MCP 服务器 | `src/mcp/` | MCP 协议实现，5 个工具 |
| 网关守护进程 | `scripts/qqbot-gateway.js` | QQ Bot WebSocket 守护进程 |
| 消息解析器 | `scripts/qqbot-parser.js` | 智能消息解析 |
| Hook 管理器 | `scripts/qqbot-hooks.js` | 项目级 Hook 配置 |
| 诊断工具 | `scripts/doctor.js` | 系统诊断 |
| 配置向导 | `scripts/setup-wizard.js` | 交互式配置 |

---

## 快速开始

### 1. 安装为 Claude Code 插件

```bash
# 添加到 Claude Code 插件
claude plugin add /path/to/qqbot-claudecode-skill
```

### 2. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑填入 QQ 机器人凭证
# 从 https://q.qq.com/ 获取凭证
```

### 3. 启动网关

```bash
# 通知模式（仅桌面通知）
npm run gateway:start

# 自动回复模式（AI 自动响应）
npm run gateway:start -- --auto
```

### 4. 查看状态

```bash
npm run gateway:status
```

---

## 可用命令

### 服务管理

| 命令 | 描述 |
|------|------|
| `npm run gateway:start` | 启动网关（通知模式） |
| `npm run gateway:start -- --auto` | 启动网关（自动回复模式） |
| `npm run gateway:stop` | 停止网关 |
| `npm run gateway:status` | 查看网关状态 |
| `npm run doctor` | 运行诊断 |
| `npm run hooks` | 管理 Hook 配置 |

### CLI 命令

```bash
# 注册项目
node scripts/qqbot-gateway.js register /path/to/project --name my-project

# 切换默认项目
node scripts/qqbot-gateway.js switch my-project

# 初始化会话
node scripts/qqbot-gateway.js init-session my-project

# 配置 Hook
node scripts/qqbot-hooks.js add
node scripts/qqbot-hooks.js list
```

---

## MCP 工具列表

| 工具 | 描述 |
|------|------|
| `get_active_bots` | 获取已配置的机器人列表 |
| `send_qq_message` | 发送文本消息到 QQ |
| `upload_qq_media` | 上传文件/图片/视频 |
| `fetch_unread_tasks` | 获取未读消息 |
| `get_qq_context` | 获取消息历史 |

---

## QQ 消息通信指南

### 消息格式

向 QQ 发送消息时，网关会智能解析您的输入：

#### 1. 项目选择

```
[项目名称] 你的消息内容
```
或
```
project:项目名称 你的消息内容
```

如果未指定项目，则使用默认项目。

#### 2. 工具权限

```
allowedTools: Read, Write, Bash
disallowedTools: WebFetch
```

**可用工具：**
- **文件操作**: `Read`, `Write`, `Edit`, `NotebookEdit`
- **网络工具**: `WebFetch`, `WebSearch`
- **执行工具**: `Bash`, `Glob`, `Grep`, `BashOutput`, `KillShell`
- **任务管理**: `Task`, `TodoWrite`
- **其他**: `SlashCommand`, `Skill`, `ExitPlanMode`

#### 3. 权限模式

```
permission-mode: acceptEdits
```

| 模式 | 描述 |
|------|------|
| `default` | 未授权操作需手动确认 |
| `acceptEdits` | 自动批准文件编辑 |
| `bypassPermissions` | 跳过所有权限检查（谨慎使用） |
| `plan` | 仅规划模式，不执行 |

### QQ 消息示例

```
# 简单消息（使用默认项目）
你好，能帮我修复一个 bug 吗？

# 指定项目
[my-app] 检查认证模块

# 带工具权限
allowedTools: Read, Grep
搜索代码库中所有的 TODO 注释

# 带权限模式
permission-mode: acceptEdits
[my-app] 重构 API 处理器

# 组合使用
[backend] allowedTools: Read, Write, Bash
更新配置文件中的设置
```

### 响应格式

所有响应都会包含项目前缀：

```
[项目名称] AI 响应内容...
```

---

## Hook 配置

配置 Hook 以在 Claude Code 事件发生时接收 QQ 通知。

### 可用 Hook

| Hook | 触发时机 |
|------|----------|
| `SessionStart` | 会话开始时 |
| `SessionEnd` | 会话结束时 |
| `PreToolUse` | 工具调用前 |
| `PostToolUse` | 工具调用后 |
| `UserPromptSubmit` | 用户提交提示时 |
| `PreCompact` | 上下文压缩前 |
| `PermissionRequest` | 权限请求时 |

### 模板变量

| 变量 | 描述 |
|------|------|
| `{{project}}` | 项目名称 |
| `{{event}}` | 事件名称 |
| `{{tool}}` | 工具名称 |
| `{{timestamp}}` | 时间戳 |
| `{{cwd}}` | 工作目录 |

### 配置 Hook

```bash
node scripts/qqbot-hooks.js add
```

---

## 配置文件

| 文件 | 位置 | 用途 |
|------|------|------|
| 项目配置 | `~/.claude/qqbot-gateway/projects.json` | 已注册项目 |
| 会话数据 | `~/.claude/qqbot-gateway/sessions/` | 会话信息 |
| Hook 配置 | `~/.claude/qqbot-gateway/hooks.json` | Hook 配置 |
| 日志 | `~/.claude/qqbot-gateway/gateway.log` | 网关日志 |

---

## 环境变量

| 变量 | 必需 | 描述 |
|------|------|------|
| `QQBOT_APP_ID` | 是 | QQ 机器人 AppID |
| `QQBOT_CLIENT_SECRET` | 是 | QQ 机器人 Client Secret |
| `QQBOT_IMAGE_SERVER_BASE_URL` | 否 | 图床服务器 URL |
| `QQBOT_TEST_TARGET_ID` | 否 | 测试目标 ID |

---

## 故障排除

### 运行诊断

```bash
npm run doctor
```

### 常见问题

1. **网关无法启动**
   - 检查 `.env` 中的凭证
   - 验证网络连接
   - 运行 `npm run doctor`

2. **收不到消息**
   - 确认网关正在运行: `npm run gateway:status`
   - 检查日志: `~/.claude/qqbot-gateway/gateway.log`

3. **自动回复不工作**
   - 验证项目已注册
   - 检查 `--cwd` 路径是否正确
   - 确保 Claude Code 可用

---

## 版本升级

### 自动升级处理

插件在 SessionStart 时会自动检查版本变化并执行升级清理：

```bash
# 手动触发升级检查
npm run upgrade
```

### 升级时会自动处理

| 操作 | 描述 |
|------|------|
| 停止服务 | 自动停止运行中的网关 |
| 备份配置 | 备份 projects.json, hooks.json, sessions/ |
| 清理过期会话 | 删除超过 7 天的旧会话 |
| 清理日志 | 日志超过 10MB 时自动裁剪 |
| 迁移配置 | 处理版本间配置格式变化 |

### 回滚操作

```bash
# 查看可用备份
npm run upgrade:backups

# 回滚到指定备份
npm run upgrade:rollback -- backup-2026-03-13T10-30-00-000Z
```

### 升级异常场景处理

| 场景 | 处理方案 |
|------|---------|
| 服务无法停止 | 检查 PID 文件，手动 kill 进程 |
| 配置迁移失败 | 从备份目录恢复配置 |
| 会话数据丢失 | 从 backup-*/sessions/ 恢复 |
| 权限问题 | 检查 ~/.claude/qqbot-gateway/ 目录权限 |

---

## 技能清单

### /qqbot-service - 后台服务管理

| 命令 | 描述 |
|------|------|
| `start [--mode auto/notify]` | 启动后台服务 |
| `stop` | 停止后台服务 |
| `restart` | 重启后台服务 |
| `status` | 查看服务状态 |
| `list` | 查看项目列表 |
| `switch <name>` | 切换默认项目 |

### /qqbot-set-hook - Hook 配置

| 命令 | 描述 |
|------|------|
| (无参数) | 交互式配置 Hook |
| `--list` | 查看已配置的 Hook |
| `--remove <id>` | 删除指定 Hook |
| `--clear` | 清除所有 Hook |
| `--test <id>` | 测试发送 Hook 消息 |

---

## 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## 原始项目

本项目 fork 自 [sliverp/qqbot](https://github.com/sliverp/qqbot)。原版文档请参阅 [README.old.zh.md](README.old.zh.md)。
