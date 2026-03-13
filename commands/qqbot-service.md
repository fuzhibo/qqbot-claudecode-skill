# /qqbot-service

管理 QQ Bot 后台服务 - 启动/停止/重启/查看状态。

## 用法

```bash
/qqbot-service <command> [options]
```

## 命令

### start - 启动后台服务

```bash
/qqbot-service start [--mode <mode>] [--init-prompt <prompt>]
```

- `--mode <mode>` - 工作模式：`notify`（通知模式）或 `auto`（自动回复模式）
- `--init-prompt <prompt>` - 初始化提示词

### stop - 停止后台服务

```bash
/qqbot-service stop
```

### restart - 重启后台服务

```bash
/qqbot-service restart [--mode <mode>]
```

### status - 查看服务状态

```bash
/qqbot-service status
```

### list - 查看项目列表

```bash
/qqbot-service list
```

### switch - 切换默认项目

```bash
/qqbot-service switch <project-name>
```

## 执行

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/qqbot-gateway.js ${command} ${args}
```

## 示例

- `/qqbot-service start --mode auto` - 启动自动回复模式
- `/qqbot-service status` - 查看当前状态
- `/qqbot-service switch my-project` - 切换到指定项目
