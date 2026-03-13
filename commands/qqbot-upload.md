# /qqbot-upload

上传文件到 QQ 群或用户。

## 用法

```
/qqbot-upload <targetId> <filePath> [description]
```

## 参数

- `targetId` - 目标 ID（G_群号/U_用户ID/C_频道ID）
- `filePath` - 本地文件路径
- `description` - 文件描述（可选）

## 示例

```
/qqbot-upload G_123456789 ./logs/error.log 错误日志文件
```

## 支持的文件类型

- 图片: .jpg, .jpeg, .png, .gif, .webp
- 视频: .mp4, .mov, .avi
- 文件: 任意类型（最大 20MB）

## 安全限制

仅允许访问当前工作目录及其子目录的文件。

## Target ID 格式

| 前缀 | 类型 | 示例 |
|------|------|------|
| G_ | 群聊 | G_123456789 |
| U_ | 私聊 | U_abc123def |
| C_ | 频道 | C_987654321 |
