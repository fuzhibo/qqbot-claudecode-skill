# QQ Bot MCP Skill - Claude Code 集成指南

## 概述

QQ Bot MCP Skill 允许 Claude Code 通过 MCP (Model Context Protocol) 协议与 QQ 机器人进行双向通信。

**核心功能:**
- 📤 **发送消息**: 从 Claude Code 向 QQ 群/频道/私聊发送文本消息
- 📎 **上传媒体**: 发送图片、视频、文件到 QQ
- 📥 **接收任务**: 获取 QQ 上的未读消息和任务请求
- 📜 **上下文获取**: 拉取历史消息了解对话背景
- 🤖 **多机器人管理**: 支持配置和管理多个 QQ 机器人

## 🚀 快速开始（首次安装指南）

### 步骤 1: 安装插件

```bash
# NPM 全局安装
npm install -g @sliverp/qqbot-mcp
```

### 步骤 2: 运行诊断工具

安装后首次运行，建议执行诊断工具检查环境:

```bash
/qqbot-doctor
```

诊断工具会检查:
- Node.js 版本 (>= 18.0.0)
- 依赖安装状态
- 构建输出文件
- 配置文件完整性
- 网络连接状态
- Channel 支持检测

- Hook 配置状态

### 步骤 3: 配置机器人凭证

#### 方式 A: 使用环境变量（快速测试）

```bash
export QQBOT_APP_ID="你的AppID"
export QQBOT_CLIENT_SECRET="你的Secret"
```

#### 方式 B: 使用交互式配置（推荐）

```bash
/qqbot-setup my-bot
```

按提示输入:
1. 机器人名称
2. AppID（从 QQ 开放平台获取）
3. Client Secret
4. 默认目标 ID（可选）
5. 图床服务器地址（可选）

### 步骤 4: 验证配置

```bash
/qqbot-check
```

### 步骤 5: 启动 Gateway 服务（Channel 模式）

```bash
/qqbot-service start --channel
```

## 安装方式

### 方式一: NPM 全局安装（推荐）

```bash
npm install -g @sliverp/qqbot-mcp
```

安装后插件会自动:
- 注册 MCP Server 到 Claude Code
- 配置 SessionStart Hook 用于自动初始化

### 方式二: 本地开发

```bash
git clone https://github.com/fuzhibo/qqbot-claudecode-skill
cd qqbot-claudecode-skill
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
        "QQBOT_CLIENT_SECRET": "你的机器人Secret",
        "QQBOT_CHANNEL_MODE": "auto"
      }
    }
  }
}
```

### 2. 配置机器人凭证

#### 方式 A: 使用环境变量（推荐用于测试）

```bash
export QQBOT_APP_ID="你的AppID"
export QQBOT_CLIENT_SECRET="你的Secret"
```

#### 方式 B: 使用 CLI 配置（推荐用于生产）

```bash
# 交互式配置
qqbot setup my-bot

# 查看已配置的机器人
qqbot list

# 删除机器人配置
qqbot remove <botName>
```

### 3. 配置运行模式

通过 `QQBOT_CHANNEL_MODE` 环境变量配置:
- `auto` - 自动检测（推荐）
- `channel` - 强制 Channel 模式
- `tools` - 强制 MCP Tools 模式

## 可用命令

### /qqbot-setup [botName]
交互式配置机器人凭证。

**执行:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/qqbot-mcp-cli.js setup ${botName}
```

**流程:**
1. 输入机器人名称
2. 输入 AppID（从 QQ 开放平台获取）
3. 输入 Client Secret
4. 可选配置默认目标 ID
5. 可选配置图床服务器

### /qqbot-doctor [--fix]
诊断和修复环境问题。

**执行:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/qqbot-mcp-cli.js doctor [--fix]
```

**检查项目:**
1. ✅ Node.js 版本 (>= v18.0.0)
2. ✅ 依赖安装状态
3. ✅ 构建输出文件
4. ✅ 配置文件完整性
5. ✅ 环境变量配置
6. ✅ 网络连接状态
7. ✅ plugin.json 配置
8. ✅ Channel 支持检测
9. ✅ Hook 配置状态

**自动修复:**
- 创建配置目录
- 安装缺失依赖
- 执行项目构建
- 修复 Channel 模块
- 配置 SessionStart Hook

### /qqbot-service <command>
管理 Gateway 服务。

**执行:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/qqbot-service.js <command>
```

**命令:**
- `start` - 启动 Gateway 服务
- `stop` - 停止 Gateway 服务
- `restart` - 重启 Gateway 服务
- `status` - 检查服务状态

**选项:**
- `--mode <auto/channel/tools>` - 设置运行模式
- `--channel` - 启用 Channel 模式
- `--detach` - 后台运行

### /qqbot-send <target> <message>
发送消息到 QQ。

**执行:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/send-message.js <target> <message>
```

**参数:**
- `target` - 目标 ID (群: G_xxx, 用户: U_xxx, 频道: C_xxx)
- `message` - 消息内容

### /qqbot-tasks
获取未读任务。

**执行:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/qqbot-parser.js
```

### /qqbot-upload <target> <file>
上传文件到 QQ。

**执行:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/send-message.js <target> --file <file>
```

### /qqbot-list
列出已配置的机器人。

**执行:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/qqbot-mcp-cli.js list
```

### /qqbot-check
检查配置状态。

**执行:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/qqbot-mcp-cli.js doctor --status
```

### /qqbot-set-hook
配置消息推送 Hook。

**执行:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/qqbot-hooks.js setup
```

## 运行模式

### Channel 模式（推荐）
- **要求**: Gateway 服务运行
- **特点**:
  - 实时消息推送
  - 权限中继支持
  - 多会话管理
- **启动**: `/qqbot-service start --channel`

### MCP Tools 模式
- **特点**:
  - 轮询方式获取消息
  - 功能完整
  - 无需额外服务
- **适用**: 不需要实时推送的场景

## 配置文件

### 配置目录
```
~/.claude/qqbot-mcp/
├── config.json          # 机器人凭证配置
~/.claude/qqbot-gateway/
├── qqbot-config.json    # 全局配置（工作模式、降级等）
├── projects.json        # 项目注册信息
```

### 配置示例

**机器人配置 (~/.claude/qqbot-mcp/config.json):**
```json
{
  "version": "1.0.0",
  "bots": {
    "my-bot": {
      "name": "my-bot",
      "appId": "your-app-id",
      "clientSecret": "your-secret",
      "enabled": true,
      "defaultTargetId": "G_xxxxx",
      "markdownSupport": true
    }
  },
  "lastUpdated": 1234567890000
}
```

**全局配置 (~/.claude/qqbot-gateway/qqbot-config.json):**
```json
{
  "version": "1.0.0",
  "workmode": "channel",
  "allowDegradation": true,
  "autoStartGateway": true,
  "autoNotifyOffline": true,
  "envFile": null,
  "notifyTargetId": null
}
```

## 安全规范
1. **凭证存储**: 机器人凭证存储在 `~/.claude/qqbot-mcp/config.json` (权限 0600)
2. **路径校验**: 文件上传仅允许访问工作目录和临时目录
3. **幂等性**: 消息处理具有幂等性保证，同一条消息不会被重复处理
4. **Token 管理**: 访问令牌自动刷新，无需手动管理

## 故障排查

### MCP Server 无法启动
1. 检查 Node.js 版本（需要 18+）
2. 运行 `/qqbot-doctor --fix` 自动修复
3. 检查配置文件路径是否正确

### 消息发送失败
1. 确认机器人凭证正确
2. 检查目标 ID 格式（需要 G_/U_/C_ 前缀）
3. 确认机器人有权限访问目标群/频道

### 收不到 QQ 消息
1. 磀认 Gateway 服务正在运行: `/qqbot-service status`
2. 检查 WebSocket 连接状态
3. 确认 Channel 模式已启用

### Gateway 启动失败
1. 检查端口 3310 是否被占用
2. 查看日志: `~/.claude/qqbot-gateway/gateway.log`
3. 尝试重启: `/qqbot-service restart`

## 版本历史
- **1.22.0** - Gateway 按需健康检测与自动恢复
- **1.21.0** - Doctor 自动修复 SessionStart Hook
- **1.20.0** - Channel 注册状态一致性修复
- **1.20.0** - MCP 协议兼容性修复
- **1.11.0** - Hook 消息超时合并与压缩
- **1.10.0** - Gateway 状态检测修复
- **1.0.0** - 初始版本
