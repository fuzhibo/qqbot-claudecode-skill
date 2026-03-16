# /qqbot-setup

交互式配置 QQ 机器人凭证。

## 用法

```
/qqbot-setup <botName>
```

## 参数

- `botName` - 机器人名称（必填）

## 示例

```
/qqbot-setup my-bot
```

## 执行

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/qqbot-mcp-cli.js setup ${botName}
```

## 说明

此命令会引导你输入：
1. AppID - QQ 机器人的应用 ID
2. Client Secret - 应用密钥
3. 默认目标 ID（可选）- 默认发送消息的群/用户
4. 图床服务器地址（可选）- 用于发送图片

凭证会加密存储在 `~/.claude/qqbot-mcp/config.json`

## 环境变量

也可以通过环境变量配置：

```bash
export QQBOT_APP_ID="your-app-id"
export QQBOT_CLIENT_SECRET="your-secret"
export QQBOT_IMAGE_SERVER_BASE_URL="http://your-server:18765"
```
