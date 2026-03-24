# /qqbot-doctor

诊断和修复 QQ Bot MCP 环境问题。

## 用法

```
/qqbot-doctor
```

## 执行

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/qqbot-mcp-cli.js doctor
```

## 功能说明

运行完整的环境诊断，检查：

1. **环境检查** - Node.js 版本 (需要 >= v18.0.0)
2. **依赖检查** - dotenv, ws, @modelcontextprotocol/sdk
3. **构建检查** - dist 目录、MCP 入口文件
4. **配置检查** - 配置目录、机器人凭证
5. **环境变量** - QQBOT_APP_ID, QQBOT_CLIENT_SECRET
6. **网络检查** - QQ API 域名解析
7. **插件配置** - plugin.json 完整性
8. **Channel 检查** - Claude Code 版本、Channel 模块、环境配置

## Channel 检查详情

Channel 检查包括：
- **版本检测脚本** - scripts/check-channel-support.js
- **Channel 推送模块** - dist/src/mcp/channel-pusher.js
- **权限中继模块** - dist/src/mcp/permission-relay.js
- **Claude Code 版本** - 检测 CLAUDE_CODE_VERSION 是否 >= v2.1.80
- **QQBOT_CHANNEL_MODE** - 检查配置是否正确 (auto/channel/tools)
- **plugin.json 配置** - 验证 Channel 环境变量配置

## 自动修复

如果诊断发现问题，运行：

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/qqbot-mcp-cli.js doctor --fix
```

自动修复功能包括：
- 创建配置目录和默认配置文件
- 安装缺失的依赖包
- 执行项目构建
- 检查关键文件是否存在
- 重建缺失的 Channel 模块

## 输出示例

```
🔍 QQ Bot MCP 诊断工具

📦 环境检查
  ✅ Node.js 版本

📚 依赖检查
  ✅ dotenv: 已安装
  ✅ ws: 已安装

🔨 构建检查
  ✅ dist 目录存在
  ✅ MCP 入口文件存在

📡 Claude Code Channel 检查
  ✅ Channel 版本检测脚本
  ✅ Channel 推送模块
  ✅ 权限中继模块
  ⚠️  Claude Code 版本: 未知 (CLAUDE_CODE_VERSION 未设置)
  ℹ️  QQBOT_CHANNEL_MODE: 未设置 (默认 auto)
  ✅ plugin.json Channel 配置: 已配置

══════════════════════════════════════════════════════════
📊 诊断摘要

  ✅ 通过: 16 项
  ⚠️  警告: 3 项
  ❌ 错误: 0 项
```

## 使用场景

- 安装插件后首次运行，确认环境正常
- 遇到错误时，诊断问题根源
- 更新插件后，检查是否需要重新构建
- 升级后验证 Channel 功能是否可用
