---
triggers:
  - qqbot
  - qq
  - 发送图片
  - 发送文件
  - 图片
  - 本地文件
  - 本地图片
priority: 80
---

# QQBot 媒体发送指南

## 📸 发送本地图片

当需要发送本地图片时，**必须使用 Markdown 图片语法**：

```
![](本地绝对路径)
```

### ✅ 正确方式

```
这是你要的图片：
![](/Users/xxx/images/photo.jpg)
```

或者带描述：

```
这是截图：
![截图](/tmp/screenshot.png)
```

### ❌ 错误方式（不会发送图片）

直接放路径**不会**发送图片：

```
这是图片：
/Users/xxx/images/photo.jpg
```

> **原理**：系统只识别 `![](路径)` 格式的本地图片。裸露的路径会被当作普通文本处理。

### 🔤 告知路径信息（不发送图片）

如果你需要**告知用户图片的保存路径**（而不是发送图片），直接写路径即可：

```
图片已保存在：/Users/xxx/images/photo.jpg
```

或用反引号强调：

```
图片已保存在：`/Users/xxx/images/photo.jpg`
```

### ⚠️ 注意事项

1. **使用绝对路径**：路径必须以 `/` 开头（macOS/Linux）或盘符开头（Windows，如 `C:\`）
2. **支持的格式**：jpg, jpeg, png, gif, webp, bmp
3. **无需调用其他工具**：不需要用 `read_file` 读取文件内容，直接输出 `![](路径)` 即可
4. **文件必须存在**：确保路径指向的文件确实存在

### 📌 示例场景

**用户说**："发送 /tmp/screenshot.png 给我"

**正确回复**：
```
好的，这是截图：
![](/tmp/screenshot.png)
```

**用户说**："图片保存在哪？"

**正确回复**：
```
图片保存在：/Users/xxx/downloads/image.jpg
```

## 🖼️ 发送网络图片

发送网络图片时，也使用 Markdown 图片语法：

```
这是图片：
![](https://example.com/image.png)
```

或直接放 URL 也可以（系统会自动识别图片 URL）：

```
这是图片：
https://example.com/image.png
```

## 🎵 其他说明

- 当前仅支持图片格式，音频/视频等格式暂不支持
- 群消息和私聊消息的图片发送方式相同
- 图片大小建议不超过 10MB
- 参考文档：https://bot.q.qq.com/wiki/develop/api-v2/server-inter/message/send-receive/rich-media.html
