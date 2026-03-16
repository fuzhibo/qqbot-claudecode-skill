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

在**你的项目目录**下创建 `.env` 文件：

```bash
# 项目根目录/.env
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

## 可用技能

### /qqbot-service - 服务管理

| 命令 | 说明 |
|------|------|
| `/qqbot-service start` | 启动 QQ Bot 服务（自动回复模式） |
| `/qqbot-service start --mode notify` | 启动服务（仅通知模式） |
| `/qqbot-service stop` | 停止服务 |
| `/qqbot-service status` | 查看状态 |
| `/qqbot-service list` | 查看已注册项目 |

### /qqbot-set-hook - 事件通知

配置 Claude Code 事件推送到 QQ：

```
/qqbot-set-hook
```

按提示选择要监听的事件（如 SessionStart、PostToolUse 等），配置通知目标。

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

用户说："5分钟后提醒我喝水"

Claude 会自动创建定时提醒，到时间后发送 QQ 消息。

---

## 常见问题

### 服务启动失败
1. 检查 `.env` 文件中的凭证是否正确
2. 确保网络可以访问 QQ API

### 收不到消息
1. 确认服务正在运行：`/qqbot-service status`
2. 检查 QQ Bot 是否已上线

### 推送消息失败
1. 确认机器人有主动消息权限
2. 用户需在 24 小时内与机器人有过互动

---

## 更多信息

- [完整文档](README.old.md)
- [变更日志](CHANGELOG.md)
- [问题反馈](https://github.com/fuzhibo/qqbot-claudecode-skill/issues)

## License

MIT
