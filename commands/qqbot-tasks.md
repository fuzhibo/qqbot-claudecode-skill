# /qqbot-tasks

获取 QQ 上的未读任务和消息。

## 用法

```
/qqbot-tasks [botName]
```

## 参数

- `botName` - 机器人名称（可选，不指定则返回所有机器人的任务）

## 示例

```
/qqbot-tasks
/qqbot-tasks my-bot
```

## 说明

此命令会返回：
- @ 机器人的消息
- 私聊消息
- 群聊任务请求

返回的任务会自动标记为已读。

## 工作流示例

1. 用户在 QQ 群发送: "@机器人 帮我分析这个报错"
2. 你在终端执行: `/qqbot-tasks`
3. Claude 获取任务并处理
4. 使用 `/qqbot-send` 返回结果
