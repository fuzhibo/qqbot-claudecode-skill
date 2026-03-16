# QQ Bot for Claude Code

> 在 Claude Code 中通过 QQ 远程控制和接收通知

[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## 快速开始

### 1. 安装插件

在 Claude Code 中运行：

```
/plugin marketplace add https://github.com/fuzhibo/qqbot-claudecode-skill
```

### 2. 配置 QQ Bot 凭证

**方式一：交互式配置（推荐）**

```
/qqbot-setup my-bot
```

按提示输入 AppID 和 Client Secret。

**方式二：环境变量**

在项目目录创建 `.env` 文件：

```bash
QQBOT_APP_ID=你的AppID
QQBOT_CLIENT_SECRET=你的ClientSecret
```

> 凭证获取：[QQ 开放平台](https://q.qq.com/) → 创建机器人 → 获取 AppID 和 ClientSecret

### 3. 启动服务

```
/qqbot-service start
```

完成！现在你可以：
- 从 QQ 发消息给 Claude Code，获得 AI 回复
- Claude Code 的事件会推送到 QQ

---

## 指令详解

### 配置管理

#### /qqbot-setup - 配置机器人凭证

**用法**
```
/qqbot-setup <botName>
```

**参数**
- `botName` - 机器人名称（自定义，用于区分多个机器人）

**交互流程**
1. 输入 AppID
2. 输入 Client Secret
3. 设置默认目标 ID（可选）
4. 设置图床服务器地址（可选）

**使用场景**
- 首次使用时配置机器人
- 添加新的机器人（支持多机器人）

**示例**
```
/qqbot-setup my-bot
/qqbot-setup work-bot
```

---

#### /qqbot-list - 查看已配置的机器人

**用法**
```
/qqbot-list
```

**输出示例**
```
📋 已配置的机器人列表

1. my-bot
   状态: ✅ 启用
   AppID: 12345678...
   默认目标: G_123456789

2. dev-bot
   状态: ✅ 启用
   AppID: 87654321...
   默认目标: 未设置
```

**使用场景**
- 查看当前配置了哪些机器人
- 确认机器人状态是否正常

---

### 服务管理

#### /qqbot-service - 后台服务管理

**用法**
```
/qqbot-service <command> [options]
```

**命令**

| 命令 | 说明 | 示例 |
|------|------|------|
| `start` | 启动服务 | `/qqbot-service start` |
| `stop` | 停止服务 | `/qqbot-service stop` |
| `restart` | 重启服务 | `/qqbot-service restart` |
| `status` | 查看状态 | `/qqbot-service status` |
| `list` | 查看项目列表 | `/qqbot-service list` |
| `switch <name>` | 切换默认项目 | `/qqbot-service switch my-project` |

**启动选项**

| 选项 | 说明 |
|------|------|
| `--mode auto` | 自动回复模式（默认）- QQ 消息自动触发 AI 回复 |
| `--mode notify` | 通知模式 - 仅推送通知，不自动回复 |
| `--init-prompt <text>` | 设置 AI 初始提示词 |

**使用场景**

| 场景 | 命令 |
|------|------|
| 日常使用 | `/qqbot-service start` |
| 只收通知，不自动回复 | `/qqbot-service start --mode notify` |
| 配置 AI 角色 | `/qqbot-service start --init-prompt "你是一个代码审查助手"` |
| 查看服务是否运行 | `/qqbot-service status` |
| 切换工作项目 | `/qqbot-service switch project-a` |

---

### 消息操作

#### /qqbot-send - 发送消息到 QQ

**用法**
```
/qqbot-send <targetId> <message>
```

**Target ID 格式**

| 前缀 | 类型 | 示例 |
|------|------|------|
| `G_` | 群聊 | `G_123456789` |
| `U_` | 私聊 | `U_abc123def` |
| `C_` | 频道 | `C_987654321` |

**使用场景**

| 场景 | 命令 |
|------|------|
| 通知群组任务完成 | `/qqbot-send G_123456 代码审查完成` |
| 私聊发送结果 | `/qqbot-send U_abc123 部署成功` |
| 发送多行消息 | `/qqbot-send G_123456 "第一行\n第二行"` |

---

#### /qqbot-upload - 发送文件/图片

**用法**
```
/qqbot-upload <targetId> <filePath> [description]
```

**支持的文件类型**
- 图片: .jpg, .jpeg, .png, .gif, .webp
- 视频: .mp4, .mov, .avi
- 文件: 任意类型（最大 20MB）

**使用场景**

| 场景 | 命令 |
|------|------|
| 发送截图 | `/qqbot-upload G_123456 ./screenshot.png` |
| 发送日志文件 | `/qqbot-upload G_123456 ./logs/error.log 错误日志` |
| 发送报告 | `/qqbot-upload U_abc123 ./report.pdf 本周报告` |

---

#### /qqbot-tasks - 获取未读任务

**用法**
```
/qqbot-tasks [botName]
```

**返回内容**
- @ 机器人的群消息
- 私聊消息
- 任务请求

**使用场景**

手动模式下获取 QQ 消息：

```
1. 用户在 QQ: "@机器人 帮我分析报错"
2. 你执行: /qqbot-tasks
3. Claude 处理任务
4. 你执行: /qqbot-send G_123456 分析结果...
```

---

### Hook 配置

#### /qqbot-set-hook - 配置事件通知

**用法**
```
/qqbot-set-hook [command]
```

**命令**

| 命令 | 说明 |
|------|------|
| （无参数） | 交互式配置 |
| `--list` | 查看已配置的 Hook |
| `--remove <id>` | 删除指定 Hook |
| `--clear` | 清除所有 Hook |
| `--test <id>` | 测试发送 Hook 消息 |

**可用的 Hook 事件**

| 事件 | 触发时机 | 使用场景 |
|------|----------|----------|
| `SessionStart` | 会话开始 | 通知开始工作 |
| `SessionEnd` | 会话结束 | 通知任务完成 |
| `PostToolUse` | 工具调用后 | 监控重要操作 |
| `UserPromptSubmit` | 用户提交提示 | 记录用户请求 |
| `PermissionRequest` | 权限请求 | 远程审批 |

**消息模板变量**

| 变量 | 说明 |
|------|------|
| `{{project}}` | 项目名称 |
| `{{event}}` | 事件名称 |
| `{{tool}}` | 工具名称 |
| `{{timestamp}}` | 时间戳 |

**使用场景**

| 场景 | 配置方式 |
|------|----------|
| 会话开始时通知群组 | 配置 `SessionStart` → 发送到群 |
| 文件修改时通知 | 配置 `PostToolUse` + matcher `Write\|Edit` |
| 需要审批时推送 | 配置 `PermissionRequest` |

---

## QQ 消息格式

从 QQ 发送消息时，可以使用以下格式：

### 基本消息
```
帮我检查一下代码有没有问题
```

### 指定项目
```
[项目名] 帮我修复这个 bug
```

### 设置权限模式
```
permission-mode: acceptEdits
帮我重构这个函数
```

| 模式 | 说明 |
|------|------|
| `default` | 需要手动确认（默认） |
| `acceptEdits` | 自动批准文件编辑 |
| `bypassPermissions` | 跳过所有权限检查 |

### 限制可用工具
```
allowedTools: Read, Grep
搜索所有 TODO 注释
```

**可用工具**
- 文件操作: `Read`, `Write`, `Edit`
- 网络工具: `WebFetch`, `WebSearch`
- 执行工具: `Bash`, `Glob`, `Grep`
- 其他: `Task`, `Skill`

---

## 富媒体消息

### 发送图片
```
<qqimg>/绝对路径/图片.jpg</qqimg>
```

### 发送文件
```
<qqfile>/绝对路径/文件.pdf</qqfile>
```

### 发送语音
```
<qqvoice>/绝对路径/语音.mp3</qqvoice>
```

---

## 定时提醒

用户在 QQ 中说："5分钟后提醒我喝水"

Claude 会自动创建定时提醒，到时间后发送 QQ 消息。

**支持的时间格式**
- "5分钟后提醒我..."
- "每天早上9点提醒我..."
- "明天下午3点提醒我..."

---

## 工作模式对比

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `auto` | 自动回复 | 远程控制、日常使用 |
| `notify` | 仅通知 | 监控、不想被打扰时 |

**auto 模式流程**
```
QQ 消息 → Gateway → Claude Code Headless → AI 回复 → QQ
```

**notify 模式流程**
```
Claude Code 事件 → Hook → QQ 通知
```

---

## 多项目管理

插件支持注册多个项目，每个项目可以有独立的 QQ Bot 凭证。

**注册项目**
```
/qqbot-service register /path/to/project --name project-a
```

**切换项目**
```
/qqbot-service switch project-a
```

**查看项目列表**
```
/qqbot-service list
```

---

## 常见问题

### 服务启动失败
1. 检查凭证是否正确：`/qqbot-list`
2. 确保网络可以访问 QQ API
3. 检查日志：`~/.claude/qqbot-gateway/gateway.log`

### 收不到消息
1. 确认服务正在运行：`/qqbot-service status`
2. 检查 QQ Bot 是否已上线
3. 确认用户在 24 小时内与机器人有过互动

### 推送消息失败
1. 确认机器人有主动消息权限
2. 在 [QQ 开放平台](https://q.qq.com/) 申请主动消息权限

### Hook 不生效
1. 确认服务已启动
2. 检查 Hook 配置：`/qqbot-set-hook --list`
3. 测试 Hook：`/qqbot-set-hook --test <id>`

---

## 更多信息

- [完整文档](README.old.md)
- [变更日志](CHANGELOG.md)
- [问题反馈](https://github.com/fuzhibo/qqbot-claudecode-skill/issues)

## License

MIT
