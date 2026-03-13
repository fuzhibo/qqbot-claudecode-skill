# /qqbot-set-hook

配置项目级 Hook - 在 Claude Code 触发 hook 事件时自动推送消息到 QQ。

## 用法

```bash
/qqbot-set-hook [command] [options]
```

## 命令

### 交互式配置（默认）

```bash
/qqbot-set-hook
```

启动交互式配置流程，选择 Hook 事件、配置 Matcher 和消息模板。

### --list - 查看已配置的 Hook

```bash
/qqbot-set-hook --list
```

### --remove <id> - 删除指定 Hook

```bash
/qqbot-set-hook --remove <hook-id>
```

### --clear - 清除所有 Hook

```bash
/qqbot-set-hook --clear
```

### --test <id> - 测试发送 Hook 消息

```bash
/qqbot-set-hook --test <hook-id>
```

## 可用 Hook 事件

| Hook 事件 | 触发时机 |
|-----------|----------|
| SessionStart | 会话开始时 |
| SessionEnd | 会话结束时 |
| PreToolUse | 工具调用前 |
| PostToolUse | 工具调用后 |
| UserPromptSubmit | 用户提交提示时 |
| PreCompact | 上下文压缩前 |
| PermissionRequest | 权限请求时 |

## 消息模板变量

| 变量 | 说明 |
|------|------|
| `{{project}}` | 项目名称 |
| `{{event}}` | 事件名称 |
| `{{tool}}` | 工具名称 |
| `{{timestamp}}` | 时间戳 |
| `{{cwd}}` | 工作目录 |

## 执行

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/qqbot-hooks.js ${command} ${args}
```

## 示例

- `/qqbot-set-hook` - 启动交互式配置
- `/qqbot-set-hook --list` - 查看已配置的 Hook
- `/qqbot-set-hook --test hook_123` - 测试指定 Hook
