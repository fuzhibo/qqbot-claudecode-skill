# /qqbot-send

发送消息到 QQ 群或用户。

## 用法

```
/qqbot-send <targetId> <message>
```

## 参数

- `targetId` - 目标 ID（G_群号/U_用户ID/C_频道ID）
- `message` - 消息内容

## 示例

```
/qqbot-send G_123456789 代码审查完成，可以合并了
```

## Target ID 格式

| 前缀 | 类型 | 示例 |
|------|------|------|
| G_ | 群聊 | G_123456789 |
| U_ | 私聊 | U_abc123def |
| C_ | 频道 | C_987654321 |
