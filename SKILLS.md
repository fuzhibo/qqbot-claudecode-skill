# QQ Bot MCP Skill - Claude Code 集成指南

## 概述

QQ Bot MCP Skill 允许 Claude Code 通过 MCP (Model Context Protocol) 协议与 QQ 机器人进行双向通信。

**核心功能:**
- 📤 **发送消息**: 从 Claude Code 向 QQ 群/频道/私聊发送文本消息
- 📎 **上传媒体**: 发送图片、视频、文件到 QQ
- 📥 **接收任务**: 获取 QQ 上的未读消息和任务请求
- 📜 **上下文获取**: 拉取历史消息了解对话背景
- 🤖 **多机器人管理**: 支持配置和管理多个 QQ 机器人

## 安装

### 方式一：NPM 全局安装

```bash
npm install -g @sliverp/qqbot-mcp
```

### 方式二：本地开发

```bash
git clone https://github.com/sliverp/qqbot
cd qqbot
npm install
npm run build
```

## 配置

### 1. 配置 Claude Code

在 Claude Code 的配置文件中添加 MCP Server:

**macOS/Linux:** `~/.claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "qqbot": {
      "command": "qqbot-mcp",
      "env": {
        "QQBOT_APP_ID": "你的机器人AppID",
        "QQBOT_CLIENT_SECRET": "你的机器人Secret"
      }
    }
  }
}
```

### 2. 配置机器人凭证

#### 方式 A：使用环境变量（推荐用于测试）

```bash
export QQBOT_APP_ID="你的AppID"
export QQBOT_CLIENT_SECRET="你的Secret"
```

#### 方式 B：使用 CLI 配置（推荐用于生产）

```bash
# 交互式配置
qqbot setup my-bot

# 查看已配置的机器人
qqbot list

# 删除机器人配置
qqbot remove my-bot
```

## 可用工具

Claude Code 可以通过以下 MCP 工具与 QQ 交互：

### 1. get_active_bots

获取当前已配置且可用的机器人列表。

**何时使用:** 当用户没有指定机器人名称时，必须先调用此工具进行身份确认。

**参数:** 无

**示例:**
```
用户: "帮我看看有哪些 QQ 机器人可用"
Claude: 调用 get_active_bots 获取列表
```

---

### 2. send_qq_message

向指定的 QQ 群、频道或用户发送文本消息。

**何时使用:** 当用户要求将代码分析、报错日志、项目进度或其他信息通知给 QQ 群友时。

**参数:**
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| botName | string | 否 | 机器人名称（不指定则使用默认） |
| targetId | string | 是 | 目标 ID，格式见下表 |
| content | string | 是 | 消息文本内容 |
| msgId | string | 否 | 回复的消息 ID（被动回复时使用） |

**targetId 格式:**
| 前缀 | 类型 | 示例 |
|------|------|------|
| G_ | 群聊 | G_123456789 |
| U_ | 私聊 | U_abc123def |
| C_ | 频道 | C_987654321 |

**示例:**
```
用户: "把这个报错信息发到开发群里"
Claude: 调用 send_qq_message({ targetId: "G_123456", content: "报错信息..." })
```

---

### 3. upload_qq_media

上传并发送媒体文件（图片、视频、文件）到 QQ。

**何时使用:** 当用户需要发送本地文件、截图或生成的图片到 QQ 时。

**参数:**
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| botName | string | 否 | 机器人名称 |
| targetId | string | 是 | 目标 ID |
| filePath | string | 是 | 本地文件的绝对路径 |
| desc | string | 否 | 文件描述或附加文本 |

**安全限制:** 仅允许访问当前工作目录及其子目录的文件。

**示例:**
```
用户: "把这个日志文件发到群里"
Claude: 调用 upload_qq_media({ targetId: "G_123456", filePath: "/path/to/logs.txt" })
```

---

### 4. fetch_unread_tasks

获取自上次调用以来，机器人收到的所有 @ 消息、私聊或群聊任务。

**何时使用:** 这是实现"QQ -> Claude"通信的核心接口。当用户要求检查 QQ 上的新消息或任务时调用。

**参数:**
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| botName | string | 否 | 机器人名称（不指定则返回所有机器人的任务） |

**返回:** 包含来源类型、发送者、内容、时间戳等信息的任务列表。

**示例:**
```
用户: "帮我看看 QQ 上有什么新消息"
Claude: 调用 fetch_unread_tasks() 获取未读任务
```

---

### 5. get_qq_context

拉取指定目标的最近 N 条历史消息。

**何时使用:** 在处理复杂任务前，需要了解当前对话背景时调用。

**参数:**
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| botName | string | 否 | 机器人名称 |
| targetId | string | 是 | 目标 ID |
| limit | number | 否 | 返回消息数量上限，默认 10 |

**示例:**
```
用户: "看看群里最近聊了什么"
Claude: 调用 get_qq_context({ targetId: "G_123456", limit: 20 })
```

## 使用场景

### 场景 1：代码审查通知

```
用户: "代码审查完成了，把结果发到开发群"

Claude 执行流程:
1. 调用 get_active_bots 确认可用机器人
2. 调用 send_qq_message 发送审查结果摘要
```

### 场景 2：远程任务处理

```
用户（在 QQ 群）: "@机器人 帮我分析这个报错日志"

Claude 执行流程:
1. 用户在终端输入: "检查 QQ 上的新任务"
2. 调用 fetch_unread_tasks 获取任务
3. 分析日志内容
4. 调用 send_qq_message 返回分析结果
```

### 场景 3：文件分享

```
用户: "把生成的报告 PDF 发到群里"

Claude 执行流程:
1. 生成 PDF 文件
2. 调用 upload_qq_media 发送文件
```

## CLI 命令

### setup - 配置机器人

```bash
qqbot setup <botName>
```

交互式引导配置机器人凭证。

**选项:**
- `--appId` - 直接指定 AppID
- `--secret` - 直接指定 Secret（不推荐，建议交互输入）
- `--default-target` - 设置默认目标 ID

### list - 查看机器人列表

```bash
qqbot list
```

显示所有已配置机器人的名称、状态和消息队列情况。

### remove - 删除机器人配置

```bash
qqbot remove <botName>
```

从本地配置中彻底删除指定机器人的所有信息。

### help - 显示帮助

```bash
qqbot help
```

显示 CLI 命令使用说明。

## 安全规范

1. **凭证存储**: 机器人凭证加密存储在 `~/.claude/qqbot-mcp/config.json`
2. **路径校验**: 文件上传仅允许访问工作目录和临时目录
3. **幂等性**: 消息处理具有幂等性保证，同一条消息不会被重复处理
4. **Token 管理**: 访问令牌自动刷新，无需手动管理

## 故障排查

### MCP Server 无法启动

1. 检查 Node.js 版本（需要 18+）
2. 确认已正确安装依赖: `npm install`
3. 检查配置文件路径是否正确

### 消息发送失败

1. 确认机器人凭证正确
2. 检查目标 ID 格式（需要 G_/U_/C_ 前缀）
3. 确认机器人有权限访问目标群/频道

### 收不到 QQ 消息

1. 确认 MCP Server 正在运行
2. 检查 WebSocket 连接状态
3. 调用 `fetch_unread_tasks` 主动获取

## 版本历史

- **1.0.0** - 初始版本
  - 实现核心 MCP 工具接口
  - 支持多机器人管理
  - 消息队列和幂等性处理

## 许可证

MIT License
