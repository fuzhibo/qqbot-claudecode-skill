# QQ Bot for Claude Code

> 在 Claude Code 中通过 QQ 远程控制和接收通知

[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## 📋 使用场景导航

根据你的需求选择合适的使用方式：

| 场景 | 需要后台服务 | 能否接收消息 | 指令复杂度 |
|------|-------------|-------------|-----------|
| [场景1: 只发送通知](#场景1只发送通知最简单) | ❌ 否 | ❌ 否 | ⭐ 简单 |
| [场景2: 接收消息+手动处理](#场景2接收消息--手动处理) | ✅ 是 | ✅ 是 | ⭐⭐ 中等 |
| [场景3: QQ用户作为协作者](#场景3qq用户作为协作者全自动) | ✅ 是 | ✅ 自动 | ⭐⭐⭐ 完整 |

---

### 场景1：只发送通知（最简单）

**适用场景**
- 只需要从 Claude Code 发送消息到 QQ
- 不需要接收 QQ 用户的回复
- 构建完成、部署成功等通知

**使用流程**
```bash
# 1. 首次配置（只需一次）
/qqbot-setup my-bot

# 2. 直接发送消息（无需后台服务）
/qqbot-send G_123456 "部署成功！"
/qqbot-send U_abc123 "代码审查完成"
```

**特点**
- ✅ 无需启动后台服务
- ✅ 响应速度快
- ❌ 无法接收消息
- ❌ 无法知道消息是否被阅读

---

### 场景2：接收消息 + 手动处理

**适用场景**
- 需要接收 QQ 用户的任务请求
- 希望手动控制处理时机
- 不想 AI 自动回复（安全考虑）

**使用流程**
```bash
# 1. 配置机器人
/qqbot-setup my-bot

# 2. 启动后台服务（notify 模式）
/qqbot-service start --mode notify

# 3. 检查接收能力
/qqbot-check --receive

# 4. 获取未读任务
/qqbot-tasks

# 5. 手动回复结果
/qqbot-send G_123456 "分析完成，结果是..."
```

**工作流程**
```
QQ 用户发消息 → WebSocket → 后台服务入队 → 等待获取
                                              ↓
Claude: /qqbot-tasks 获取 ←─────────────────────┘
Claude: 处理任务
Claude: /qqbot-send 回复
```

**特点**
- ✅ 可控的消息处理
- ✅ 可以审核后再回复
- ⚠️ 需要定期检查任务
- ⚠️ 延迟取决于检查频率

---

### 场景3：QQ 用户作为协作者（全自动）

**适用场景**
- 让 QQ 用户像协作者一样参与项目
- 远程控制 Claude Code
- 自动响应 QQ 消息

**使用流程**
```bash
# 1. 配置机器人
/qqbot-setup my-bot

# 2. 启动自动回复模式
/qqbot-service start --mode auto --init-prompt "你是一个代码审查助手"

# 3. 检查状态
/qqbot-check

# 4. QQ 用户直接对话，AI 自动回复
# 5. 查看协作者状态
/qqbot-service status

# 6. 暂停自动回复（临时切换）
/qqbot-service stop
```

**工作流程**
```
QQ 用户发消息 → WebSocket → 后台服务 → Claude Code Headless → AI 回复 → QQ
                                      ↓
                                自动处理消息
```

**特点**
- ✅ 全自动响应
- ✅ 保持会话上下文
- ✅ 支持复杂任务
- ⚠️ 消耗 API 配额
- ⚠️ 需要监控状态

---

## 🎯 快速决策树

不知道选哪种模式？按以下步骤决策：

```
你需要接收 QQ 消息吗？
├── 否 → 使用 [场景1: 只发送通知]
│       └── /qqbot-setup + /qqbot-send
│
└── 是 → 你需要 AI 自动回复吗？
        ├── 否 → 使用 [场景2: 手动处理]
        │       └── /qqbot-service start --mode notify
        │       └── 定期运行 /qqbot-tasks
        │
        └── 是 → 使用 [场景3: 自动协作]
                └── /qqbot-service start --mode auto
                └── QQ 用户直接对话
```

---

## ⚡ 异常处理速查表

| 现象 | 快速诊断 | 解决方案 |
|------|---------|---------|
| **无法发送消息** | `/qqbot-check --send` | 按提示修复凭证或网络 |
| **收不到消息** | `/qqbot-check --receive` | 检查后台服务是否运行 |
| **自动回复停止** | `/qqbot-service status` | `/qqbot-service restart` |
| **发送失败** | `/qqbot-doctor` | 运行诊断工具获取修复建议 |
| **权限被拒绝** | `/qqbot-check` | 检查 AppID/Client Secret |
| **连接超时** | `/qqbot-check` | 检查网络连接 |

### 详细故障排除

#### 服务启动失败
1. 检查凭证：`/qqbot-list`
2. 环境诊断：`/qqbot-doctor`
3. 查看日志：`~/.claude/qqbot-gateway/gateway.log`

#### 收不到消息
1. 确认服务运行：`/qqbot-service status`
2. 检查接收能力：`/qqbot-check --receive`
3. 确认 QQ Bot 已上线（QQ 开放平台查看状态）
4. 确认用户在 24 小时内与机器人有过互动

#### 自动回复异常
1. 查看服务状态：`/qqbot-service status`
2. 检查日志：`tail -f ~/.claude/qqbot-gateway/gateway.log`
3. 重启服务：`/qqbot-service restart`

---

## 🚀 快速开始

### 1. 安装插件

在 Claude Code 中运行：

```
/plugin marketplace add https://github.com/fuzhibo/qqbot-claudecode-skill
```

### 2. 配置 QQ Bot 凭证

**方式一：从 .env 文件读取（推荐，最安全）**

1. 在项目目录创建 `.env` 文件：

```bash
QQBOT_APP_ID=your-app-id
QQBOT_CLIENT_SECRET=your-client-secret
```

2. 运行 setup 命令：

```
/qqbot-setup my-bot --from-env
```

> ✅ **优势**：AI 完全不接触凭证，避免敏感数据泄露到对话历史

**方式二：交互式配置**

```
/qqbot-setup my-bot
```

按提示输入 AppID 和 Client Secret。

> 适用于用户在本地终端直接运行

**方式三：环境变量（自动检测）**

如果设置了环境变量 `QQBOT_APP_ID` 和 `QQBOT_CLIENT_SECRET`，setup 会自动检测并提供使用选项。

> 凭证获取：[QQ 开放平台](https://q.qq.com/) → 创建机器人 → 获取 AppID 和 ClientSecret

### 3. 选择使用场景

根据上方的 [使用场景导航](#-使用场景导航) 选择适合你的模式：

- **只发通知** → 跳过启动服务，直接使用 `/qqbot-send`
- **接收消息** → 运行 `/qqbot-service start`
- **自动协作** → 运行 `/qqbot-service start --mode auto`

完成！现在你可以：
- 从 QQ 发消息给 Claude Code，获得 AI 回复
- Claude Code 的事件会推送到 QQ

---

## 指令详解

### 状态检查

#### /qqbot-check - 统一状态检查（推荐）

**用法**
```
/qqbot-check [--receive] [--send]
```

**选项**
- `--receive` - 检查消息接收能力
- `--send` - 检查消息发送能力
- 无选项 - 执行完整检查

**输出示例**
```
🤖 QQ Bot 状态检查工具
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 环境检查
  ✅ Node.js 版本: v20.11.0
  ✅ 依赖: ws: 已安装

📋 凭证配置
  ✅ 机器人配置: 1 个机器人 (my-bot)
  ✅ AppID: 12345678...

📤 发送能力
  ✅ 可以发送消息

📥 接收能力
  ✅ 后台服务: 运行中 (PID: 12345)
  ✅ 可以接收消息

💡 修复建议
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. /qqbot-setup my-bot
```

**使用场景**
- 使用前的快速检查
- 排查接收/发送问题
- 自动化脚本中使用

**与其他指令的关系**
| 指令 | 用途 | 推荐度 |
|------|------|--------|
| `/qqbot-check` | 统一状态检查 | ⭐⭐⭐ 推荐 |
| `/qqbot-service status` | 仅服务状态 | ⭐⭐ 子集 |
| `/qqbot-doctor` | 环境诊断 | ⭐⭐ 故障排查 |

---

### 配置管理

#### /qqbot-setup - 配置机器人凭证

**用法**
```
/qqbot-setup <botName> [--from-env] [--appId <id>] [--secret <secret>]
```

**参数**
- `botName` - 机器人名称（自定义，用于区分多个机器人）
- `--from-env` - 从 .env 文件读取配置（推荐，最安全）
- `--appId <id>` - 直接指定 AppID（不推荐）
- `--secret <secret>` - 直接指定 Client Secret（不推荐，有泄露风险）

**配置方式对比**

| 方式 | 命令 | 适用场景 | 安全性 |
|-----|------|---------|-------|
| **从 .env 读取（推荐）** | `/qqbot-setup <name> --from-env` | Claude Code / 自动化脚本 | ⭐⭐⭐ 最高，AI不接触凭证 |
| **交互式配置** | `/qqbot-setup <name>` | 用户在终端手动输入 | ⭐⭐ 凭证不经过网络 |
| **命令行参数** | `/qqbot-setup <name> --appId <id> --secret <s>` | CI/CD 自动化 | ⭐ 可能记录在 shell 历史 |

**推荐配置流程（--from-env）**

1. **创建 .env 文件**（在项目根目录）：
   ```bash
   QQBOT_APP_ID=your-app-id
   QQBOT_CLIENT_SECRET=your-client-secret
   QQBOT_TEST_TARGET_ID=U_your-target-id
   ```

2. **运行 setup 命令**：
   ```
   /qqbot-setup my-bot --from-env
   ```

3. **完成** - 凭证由脚本直接读取，AI 完全不接触敏感数据

**交互流程（手动模式）**
1. 输入 AppID
2. 输入 Client Secret（隐藏输入）
3. 设置默认目标 ID（可选）
4. 设置图床服务器地址（可选）

**使用场景**
- 首次使用时配置机器人
- 添加新的机器人（支持多机器人）
- 通过 .env 文件安全地管理凭证

**示例**
```
# 推荐：从 .env 读取（AI 不接触凭证）
/qqbot-setup my-bot --from-env

# 交互式配置
/qqbot-setup my-bot

# 命令行参数（不推荐用于手动输入）
/qqbot-setup work-bot --appId 123456 --secret abcdef
```

**安全建议**
- ✅ **优先使用 `--from-env`**：凭证由脚本直接读取，AI 模型完全不接触敏感数据
- ⚠️ **避免在命令行中使用 `--secret`**：凭证可能被记录在 shell 历史文件中
- ✅ **将 `.env` 添加到 `.gitignore`**：确保凭证不会被意外提交到代码仓库
- ✅ **定期轮换凭证**：在 QQ 开放平台定期重置 AppSecret

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

**status 输出示例（增强版）**
```
🤖 QQ Bot 网关状态
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

服务状态
  ✅ 运行中 (PID: 12345)
  运行时间: 2小时 30分钟

日志状态
  文件大小: 0.15 MB
  最后更新: 2024/1/15 10:30:00

已注册项目 (2)

  my-project (★ 默认, ▶ 当前)
    路径: /home/user/my-project
    会话: sess_abc123
    消息序号: 42
    最后连接: 2024/1/15 10:25:00

  other-project
    路径: /home/user/other-project
    会话: 无

当前目录状态
  ✅ 已注册为 "my-project"

快速操作
  • 查看任务: /qqbot-tasks
  • 发送消息: /qqbot-send <targetId> <message>
  • 停止服务: /qqbot-service stop
  • 诊断问题: /qqbot-doctor
  • 检查状态: /qqbot-check
```

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

### Hook 消息缓存

Hook 消息默认缓存并每 3 分钟批量压缩后发送，减少消息打扰。

**配置命令**（通过 QQ 发送）:

| 命令 | 说明 |
|------|------|
| `设置hook缓存间隔 <分钟>` | 设置检查间隔（0 = 立即发送） |
| `查看hook缓存` | 查看当前配置和缓存状态 |

**示例**
```
设置hook缓存间隔 5    # 每5分钟处理一次
设置hook缓存间隔 0    # 关闭缓存，立即发送
查看hook缓存          # 查看当前状态
```

**工作原理**

1. Hook 消息先缓存到内存中
2. 到达检查间隔时，使用 Claude 压缩成摘要
3. 发送压缩后的摘要消息

**示例摘要**
```
📋 Hook 消息摘要 (5 条)

[10:30] PostToolUse: 修改了 src/api.ts
[10:32] SessionStart: 项目 my-project 开始处理
[10:35] PermissionRequest: 请求执行 Bash 命令
...
```

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

## 更多信息

- [完整文档](README.old.md)
- [变更日志](CHANGELOG.md)
- [问题反馈](https://github.com/fuzhibo/qqbot-claudecode-skill/issues)

## License

MIT
