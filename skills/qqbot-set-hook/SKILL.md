---
name: qqbot-set-hook
description: 配置项目级 Hook，在 Claude Code 触发 hook 事件时自动推送消息到 QQ。当用户需要配置消息推送通知时使用此技能。
version: 1.0.0
---

# /qqbot-set-hook

配置项目级 Hook，在 Claude Code 触发 hook 事件时自动推送消息到 QQ。

## 用法

```bash
/qqbot-set-hook [options]
```

## 交互式配置流程

1. **选择 Hook 事件** - 显示可用的 hook 列表供选择
2. **配置触发条件** - 设置 matcher 模式（可选）
3. **配置消息模板** - 定义发送到 QQ 的消息格式
4. **选择目标** - 设置消息发送目标（群/私聊）
5. **确认保存** - 保存配置到项目

## 可用 Hook 事件

### 会话生命周期

| Hook 事件 | 触发时机 |
|-----------|----------|
| `SessionStart` | 会话开始时 |
| `SessionEnd` | 会话结束时 |

### 工具调用

| Hook 事件 | 触发时机 |
|-----------|----------|
| `PreToolUse` | 工具调用前 |
| `PostToolUse` | 工具调用后 |

### 用户交互

| Hook 事件 | 触发时机 |
|-----------|----------|
| `UserPromptSubmit` | 用户提交提示时 |
| `PreCompact` | 上下文压缩前 |

### 权限请求

| Hook 事件 | 触发时机 |
|-----------|----------|
| `PermissionRequest` | 权限请求时 |

## 消息模板变量

在消息模板中可以使用以下变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{project}}` | 项目名称 | qqbot-claudecode-skill |
| `{{event}}` | 事件名称 | PreToolUse |
| `{{tool}}` | 工具名称 | Bash |
| `{{timestamp}}` | 时间戳 | 2026-03-13 10:30:00 |
| `{{user}}` | 用户名 | fuzhibo |
| `{{cwd}}` | 工作目录 | /home/user/project |

## 配置示例

### 示例 1：工具调用通知

```yaml
# .claude/hooks/qqbot-notify.yaml
hooks:
  - event: PostToolUse
    matcher: ".*"  # 匹配所有工具
    template: |
      🔧 工具调用完成

      项目: {{project}}
      工具: {{tool}}
      时间: {{timestamp}}
    target: U_YOUR_OPENID
```

### 示例 2：会话开始通知

```yaml
hooks:
  - event: SessionStart
    template: |
      🚀 新会话开始

      项目: {{project}}
      目录: {{cwd}}
      时间: {{timestamp}}
    target: G_GROUP_ID  # 发送到群
```

### 示例 3：特定工具监控

```yaml
hooks:
  - event: PreToolUse
    matcher: "Bash.*git.*"  # 只匹配 git 相关的 Bash 命令
    template: |
      📝 Git 操作

      项目: {{project}}
      时间: {{timestamp}}
    target: U_YOUR_OPENID
```

## 命令选项

| 选项 | 说明 |
|------|------|
| `--list` | 显示当前配置的所有 hook |
| `--remove <id>` | 删除指定的 hook 配置 |
| `--clear` | 清除所有 hook 配置 |
| `--test` | 测试 hook 配置（发送测试消息） |

## 配置存储

Hook 配置存储在项目的 `.claude/hooks/qqbot-notify.yaml` 文件中。

## 与网关集成

配置完成后，需要启动 qqbot-service 才能生效：

```bash
/qqbot-service start
```

网关会在 hook 触发时自动发送消息到 QQ。

## 示例

### 交互式配置

```bash
/qqbot-set-hook
```

```
🪝 QQ Bot Hook 配置
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

可用的 Hook 事件:

  会话生命周期:
    1. SessionStart   - 会话开始时
    2. SessionEnd     - 会话结束时

  工具调用:
    3. PreToolUse     - 工具调用前
    4. PostToolUse    - 工具调用后

  用户交互:
    5. UserPromptSubmit - 用户提交提示时

请选择 Hook 事件 (输入数字): 4

已选择: PostToolUse

配置 Matcher 模式 (留空匹配所有): Bash.*

配置消息模板:
🔧 工具调用完成
项目: {{project}}
工具: {{tool}}

选择目标类型:
  1. 私聊 (U_)
  2. 群聊 (G_)
请选择: 1

输入目标 ID: YOUR_OPENID_HERE

确认保存? (y/n): y

✅ Hook 配置已保存
```

### 查看配置

```bash
/qqbot-set-hook --list
```

```
🪝 已配置的 Hook
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PostToolUse
   Matcher: Bash.*
   Target: U_YOUR_OPENID
   状态: 已启用

2. SessionStart
   Matcher: (all)
   Target: G_123456789
   状态: 已启用
```
