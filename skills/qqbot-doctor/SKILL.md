# /qqbot-doctor

诊断和修复 QQ Bot MCP 环境问题。

## 实现方式

此技能通过执行 `scripts/doctor.js` 脚本来实现诊断功能。

## 用法

```bash
/qqbot-doctor [--fix]
```

## 选项

- `--fix` - 自动修复发现的问题

## 执行

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js [--fix]
```

## 功能说明

运行完整的环境诊断，检查：

1. **环境检查** - Node.js 版本 (需要 >= v18.0.0)
2. **构建检查** - dist 目录、MCP 入口文件、send-message.js
3. **依赖检查** - 打包模式下依赖已内置
4. **配置检查** - 配置目录、机器人凭证 (AppID/Secret)
5. **环境变量** - QQBOT_APP_ID, QQBOT_CLIENT_SECRET
6. **网络检查** - QQ API 域名解析
7. **插件配置** - plugin.json 完整性
8. **Channel 检查** - Channel 模块、Gateway 桥接模式

## 自动修复

如果诊断发现问题，运行：

```bash
/qqbot-doctor --fix
```

自动修复功能包括：
- 创建配置目录和默认配置文件
- 安装缺失的依赖包
- 执行项目构建
- 检查关键文件是否存在

## 输出示例

```
🔍 QQ Bot MCP 诊断工具

📦 环境检查
  ✅ Node.js 版本

🔨 构建检查
  ✅ dist 目录存在
  ✅ MCP 入口文件存在

⚙️  配置检查
  ✅ 配置目录存在
  ✅ 机器人配置

📡 Claude Code Channel 检查
  ✅ Channel 推送模块
  ✅ Gateway 桥接模式: 可用

══════════════════════════════════════════════════════════
📊 诊断摘要
  ✅ 通过: 14 项
  ⚠️  警告: 2 项
  ❌ 错误: 0 项
```

## 使用场景

- 安装插件后首次运行，确认环境正常
- 遇到错误时，诊断问题根源
- 更新插件后，检查是否需要重新构建
