# Changelog

所有重要的变更都将记录在此文件中。

## [1.18.0] - 2026-03-27

### 稳定性增强

- **sessionId 版本对齐**: sessionId 格式自动适配 Claude Code 版本
  - 自动检测 Claude Code 版本
  - 新版本使用可读短标题格式 (如 `qqbot-abc123`)
  - 旧版本使用标准 UUID 格式
  - 确保 `--resume` 参数兼容性

- **Gateway API 超时保护**: 所有 HTTP 请求增加 10 秒超时保护
  - `registerChannel()` 超时保护
  - `unregisterChannel()` 超时保护
  - `fetchChannelMessages()` 超时保护
  - `markMessagesDelivered()` 超时保护

- **消息持久化**: Channel 消息持久化到磁盘，重启不丢失
  - 消息入队时异步持久化
  - Gateway 启动时自动加载未处理消息
  - 处理成功后删除持久化文件

- **消息投递重试**: 投递失败自动重试
  - 最多重试 3 次
  - 每次间隔 5 秒
  - 超过重试次数后记录错误

- **消息队列管理**: 防止队列无界增长
  - 最大 2000 条消息
  - 最大 100MB 总大小
  - 超出限制时丢弃最旧消息并记录告警

## [1.17.0] - 2026-03-27

### 新功能

- **授权超时与持久化**: 授权状态现在支持过期时间和持久化配置
  - 每个授权项可设置过期时间（默认 24 小时）
  - 用户可自定义授权有效期：`设置授权超时 48`（小时）
  - 授权过期前自动提醒（默认过期前 1 小时）
  - 授权状态和超时设置持久化到配置文件

- **授权过期提醒**: 自动检测即将过期的授权并发送提醒
  - 过期前 1 小时内发送提醒通知
  - 提示用户重新授权以延长有效期
  - 自动清理已过期的授权项

### 改进

- **授权状态显示增强**: `查看授权` 命令现在显示每个授权的过期状态
  - 显示授权有效期至具体时间
  - 显示剩余小时数
  - 过期授权标记为 ❌

- **快捷授权显示过期时间**: 授权成功时显示有效期信息
  - 显示授权到期时间
  - 提示如何设置自定义超时

## [1.16.2] - 2026-03-26

### 性能优化

- **Channel 轮询延迟优化**: 降低 HTTP 轮询间隔，提升消息响应速度
  - 轮询间隔从 1000ms 降低到 200ms
  - 平均延迟从 ~592ms 降至 ~100ms

### 问题修复

- **session-id 前缀路由支持**: 支持 `[session-id]` 格式精确路由消息
  - 优先精确匹配 session-id
  - 向后兼容 project-name 格式

- **chat_id 前缀内部修复**: Gateway 消息的 chat_id 现在自动添加正确前缀
  - 确保私聊消息正确路由到用户而非群聊
  - 内部处理，用户无需关心

## [1.16.1] - 2026-03-26

### 功能优化

- **授权快捷关键词**: 新增一键授权关键词，简化授权流程
  - 支持: `授权全部`、`全部授权`、`授权mcp`、`授权工具`、`允许全部`、`允许mcp`
  - 无需记忆复杂命令，直接发送即可完成授权

- **help auth 文档增强**: 提供清晰的授权使用指南
  - 快捷授权表格说明
  - 授权范围详细解释（MCP 工具/文件路径）
  - 详细命令示例
  - 首次使用建议

### 问题修复

- **Hook 配置持久化**: 修复 `hook off` 后重启网关配置丢失的问题
  - `startGateway` 现在会保留现有的 `hookNotify` 配置
  - 状态文件正确合并而非覆盖

- **积压消息大小限制**: 防止首次对话时发送超大消息
  - 新增 `pendingMaxSize: 2000` 配置
  - 压缩失败时使用截断而非发送完整内容
  - 强制截断保护确保消息不超过限制

## [1.16.0] - 2026-03-26

### 功能更新

  - a300d75 feat: Hook消息推送开关与 Channel 模式 sessionId 前缀
  - daa46f1 feat: v1.15.0 - Hook消息处理重构与Channel增强
  - 8bc8fee chore: release v1.14.5
  - ca809f4 chore: release v1.14.4 - 添加 qqbot-doctor skill 文件
  - b99279e chore: release v1.14.3
  - 1983fb3 chore: release v1.14.2
  - acb7e8f chore: release v1.14.1 - 修复网关启动失败问题
  - 82ecd19 fix: 添加 API 模块打包以支持 qqbot-gateway.js
  - 4307cc9 chore: release v1.14.0 - esbuild 打包构建
  - 6194061 feat: 使用 esbuild 打包构建，用户无需 npm install

## [1.15.0] - 2026-03-26

### 新功能

- **统一 Hook 消息处理机制**: 移除旧的定时批处理，统一使用 5 秒超时合并机制
  - 5 秒内无新消息则批量发送
  - 300 字节阈值压缩（压缩后 150 字节）
  - 新命令：`设置hook压缩阈值 <字节数>` 和 `查看hook缓存`

- **Channel 配置持久化**: `--channel` 参数现在会保存到 `gateway-state.json`
  - status 命令准确显示当前运行的 channel 模式
  - 支持配置: `gateway-bridge`、`bidirectional`、`unidirectional`

- **Channel 消息前缀自定义**: 支持自定义 Channel 显示名称
  - 注册 Channel 时可指定 `displayName` 参数
  - 消息确认使用自定义名称而非项目名

- **Channel 模式完全禁用 Headless**: 当 Channel 模式启用但无活跃会话时
  - 不再回退到 Headless 模式
  - 发送提示信息引导用户启动 MCP Server

### 问题修复

- 修复 Hook 消息合并机制未生效的问题（入口逻辑绕过了缓存）
- 修复 status 命令无法显示实际 channel 配置的问题

## [1.14.5] - 2026-03-26

### 问题修复

  - ca809f4 chore: release v1.14.4 - 添加 qqbot-doctor skill 文件
  - b99279e chore: release v1.14.3
  - 1983fb3 chore: release v1.14.2
  - acb7e8f chore: release v1.14.1 - 修复网关启动失败问题
  - 82ecd19 fix: 添加 API 模块打包以支持 qqbot-gateway.js
  - 4307cc9 chore: release v1.14.0 - esbuild 打包构建
  - 6194061 feat: 使用 esbuild 打包构建，用户无需 npm install
  - f838002 fix: Channel 模式检测逻辑修复 - 支持 Gateway 桥接模式
  - 04f2b51 feat: Gateway → MCP Server 多会话消息桥接架构
  - 78dd6db feat: Channel 模式选项支持

## [1.14.4] - 2026-03-26

### 问题修复

- 添加缺失的 qqbot-doctor skill 文件，修复 `/qqbot-doctor` 命令无法识别的问题

## [1.14.3] - 2026-03-26

### 问题修复

  - 1983fb3 chore: release v1.14.2
  - acb7e8f chore: release v1.14.1 - 修复网关启动失败问题
  - 82ecd19 fix: 添加 API 模块打包以支持 qqbot-gateway.js
  - 4307cc9 chore: release v1.14.0 - esbuild 打包构建
  - 6194061 feat: 使用 esbuild 打包构建，用户无需 npm install
  - f838002 fix: Channel 模式检测逻辑修复 - 支持 Gateway 桥接模式
  - 04f2b51 feat: Gateway → MCP Server 多会话消息桥接架构
  - 78dd6db feat: Channel 模式选项支持
  - 6641823 feat: 通信模式能力展示和检测优化
  - 53f7f61 chore: release v1.13.2 - Channel 检测优化

## [1.14.2] - 2026-03-26

### 问题修复

  - acb7e8f chore: release v1.14.1 - 修复网关启动失败问题
  - 82ecd19 fix: 添加 API 模块打包以支持 qqbot-gateway.js
  - 4307cc9 chore: release v1.14.0 - esbuild 打包构建
  - 6194061 feat: 使用 esbuild 打包构建，用户无需 npm install
  - f838002 fix: Channel 模式检测逻辑修复 - 支持 Gateway 桥接模式
  - 04f2b51 feat: Gateway → MCP Server 多会话消息桥接架构
  - 78dd6db feat: Channel 模式选项支持
  - 6641823 feat: 通信模式能力展示和检测优化
  - 53f7f61 chore: release v1.13.2 - Channel 检测优化
  - b0ed975 chore: release v1.13.1

## [1.14.1] - 2026-03-25

### Bug 修复

- **修复网关启动失败问题**
  - 添加 `src/api.ts` 到 esbuild 打包配置
  - 使用 ESM 格式正确导出 `MediaFileType` enum
  - 修复网关启动时找不到 `dist/src/api.js` 的错误

## [1.14.0] - 2026-03-25

### 重大更新

- **esbuild 打包构建 - 用户无需 npm install**
  - 引入 esbuild 将所有依赖打包进 dist
  - 用户通过 Marketplace 安装后直接可用，无需构建步骤
  - dist 目录提交到 Git，降低使用门槛
  - doctor 智能检测打包模式，跳过依赖检查

### 技术细节

- 新增 `scripts/build-bundle.js` 打包脚本
- 使用 CJS 格式输出，兼容性更好
- 打包后 MCP Server 约 752 KB（包含所有依赖）
- 更新 `.gitignore` 允许提交 dist 目录
- 更新 doctor.js 支持打包模式检测

### 用户体验改进

| 之前 | 现在 |
|------|------|
| 安装 → npm install → npm run build → 可用 | 安装 → 直接可用 ✅ |

## [1.13.6] - 2026-03-25

### 问题修复

- **Channel 模式检测逻辑修复**
  - 修复 MCP Server 模式检测只检查 `CLAUDE_CODE_VERSION` 的问题
  - 新增 Gateway 桥接模式检测 (`gateway-bridge`)，不依赖 Claude Code 版本
  - 区分 `gateway-bridge` 和 `native` 两种 Channel 子模式
  - 模式优先级：Gateway 桥接 > 原生 Channel > Tools 轮询

- **doctor 诊断脚本更新**
  - 新增 Gateway API 可用性检测
  - 正确识别 Gateway 桥接模式
  - 更新通信能力分析输出

### 架构说明

Channel 模式现在分为两种：
- `gateway-bridge`: MCP Server 注册到 Gateway，轮询获取消息（推荐，不依赖 Claude Code 版本）
- `native`: 使用 Claude Code 原生 Channel capability（需要 v2.1.80+，用于权限中继）

## [1.13.5] - 2026-03-25

### 新增功能

- **Gateway → MCP Server 多会话消息桥接架构**
  - Channel 注册 API: `POST /api/channels/register`, `DELETE /api/channels/:id`, `GET /api/channels`
  - 多 Channel 注册和消息路由支持
  - MCP Server 启动时自动注册到 Gateway，关闭时自动注销
  - 模式互斥：Channel 模式和 Headless 模式只能切换，不能同时运行

- **Hook 消息智能合并与压缩**
  - 5 秒超时机制：有新消息时重置定时器
  - 300 字节压缩阈值：超过阈值触发内部 Headless 压缩
  - 压缩后消息限制在 150 字节内

- **用户提醒机制**
  - `qqbot-service start`: 启动时显示 Channel 模式注意事项
  - `qqbot-doctor`: 诊断时显示 Channel 模式提醒
  - `channel-pusher`: 首次注册时输出提醒日志

### 改进

- **消息队列按 Channel 分组**
  - 每个 Channel 有独立的消息队列
  - 支持前缀路由和无前缀默认路由

## [1.13.4] - 2026-03-24

### 新增功能

- **Channel 模式选项**
  - `--channel` 或 `--channel=auto`: 自动检测，优先双向，降级单向
  - `--channel=bidirectional`: 强制双向 Channel 模式，不可用则报错
  - `--channel=unidirectional`: 强制单向 Gateway 模式
  - 支持 `--key=value` 格式的参数解析

### 改进

- **启动输出优化**
  - 人类可读模式 (`--human`) 显示更清晰的通信模式信息
  - 自动降级时显示降级原因和建议
  - 区分强制模式和自动模式的输出

## [1.13.3] - 2026-03-24

### 改进

- **通信模式能力展示**
  - `qqbot-doctor`: 新增 📶 通信能力分析，显示当前通信模式和能力
  - `qqbot-service start`: 启动时显示通信模式和降级链
  - 区分三种模式：Channel 双向、Gateway 单向、Tools 轮询
  - JSON 输出增加 `communicationMode` 字段

- **Channel 检测优化**
  - 独立进程模式显示为信息提示而非警告
  - 清晰说明 Channel 仅在 Claude Code 内的 MCP Server 中可用

## [1.13.2] - 2026-03-24

### 改进

- **Channel 检测优化** - 区分 MCP 环境和独立进程模式
  - `qqbot-doctor`: 独立进程模式下显示信息提示而非警告
  - `qqbot-service`: 新增 `standalone_mode` 检测结果
  - 改善用户体验，避免在 Gateway/CLI 模式下显示不必要的警告

## [1.13.1] - 2026-03-24

### 新增功能

- **qqbot-service 增强**
  - `status` 命令显示 Channel 检测结果
  - `start --channel` 参数尝试开启 Channel 模式
  - 自动判断 Channel 支持状态

- **qqbot-doctor Channel 检查**
  - Channel 模块文件检查 (channel-pusher.js, permission-relay.js)
  - 版本检测脚本检查 (check-channel-support.js)
  - Claude Code 版本检测 (CLAUDE_CODE_VERSION)
  - QQBOT_CHANNEL_MODE 配置检查
  - 自动修复缺失的 Channel 模块

## [1.13.0] - 2026-03-23

### 新增功能

- **Claude Code Channel 集成** - 支持 Claude Code v2.1.80+ 的 Channel 功能
  - 实时消息推送：通过 `notifications/claude/channel` 推送 QQ 消息到 Claude Code
  - 权限中继：支持远程批准/拒绝工具调用权限
  - 自动模式切换：根据 Claude Code 版本自动选择 Channel 或 MCP Tools 模式

- **版本检测系统**
  - 安装时检测：`scripts/check-channel-support.js` 检测 Claude Code 版本
  - 运行时检测：MCP Server 启动时自动选择最佳运行模式
  - 环境变量控制：`QQBOT_CHANNEL_MODE` 支持 `auto`/`channel`/`tools`

### 新增文件

- `scripts/check-channel-support.js` - Channel 版本检测模块
- `src/mcp/channel-pusher.ts` - Channel 消息推送模块
- `src/mcp/permission-relay.ts` - 权限中继模块

### 更新内容

- `src/mcp/index.ts` - 添加 Channel capability 声明和版本检测
- `src/mcp/tools.ts` - 优化 send_qq_message 工具描述
- `plugin.json` - 添加 SessionStart 版本检测 hook
- `scripts/setup-wizard.js` - 集成版本检测

### 兼容性

| Claude Code 版本 | 推荐模式 |
|-----------------|---------|
| < v2.1.80 | MCP Tools (轮询) |
| >= v2.1.80 | Channel (实时推送) |

## [1.12.1] - 2026-03-21

### 问题修复

- 修复 build-release 版本同步问题
- 版本文件统一更新验证

## [1.12.0] - 2026-03-21

### 功能更新

- **缓存消息合并压缩** - 激活后待发送消息先合并压缩再一次性发送，避免刷屏
- **超时提醒优化** - 只在 5/3/1 分钟时精准提醒，不再频繁发送
- **引用消息关联处理** - 支持 QQ 消息引用，将引用上下文合并后发送给 Claude Code
- **服务稳定性增强** - WebSocket/API 双重健康检查、内存监控、队列状态监控
- **授权管理持久化** - 新增 authorization-state.js，支持 MCP 工具/文件路径/网络授权
- **Headless 参数持久化** - 支持保存和恢复 headless 模式配置

### 新增命令

- `查看授权` / `我的授权` - 查看当前授权状态和配置
- `授权工具: <工具名>` - 授权 MCP 工具（如 `授权工具: mcp`）
- `授权路径: <路径>` - 授权文件访问路径
- `设置配置: key=value` - 设置 headless 配置
- `重置配置` - 重置为默认配置

## [1.11.0] - 2026-03-20

### 功能更新

  - 5b392a3 chore: release v1.10.1
  - a05a056 chore(build-release): 自动提交 release 变更，不自动推送
  - 32684ef chore: release v1.10.0
  - 3810857 feat(gateway): Hook 消息缓存与批量发送功能
  - c7cb681 release v1.9.0: 消息队列系统 + 图片发送修复
  - 2924916 fix(service): 僵尸 PID 文件检测与自动清理
  - 1da7450 release v1.8.2
  - 06921ef fix(service): 修复网关模式探测功能
  - 38795a3 feat(gateway): 智能消息发送 - 自动降级到主动消息
  - d18b6ec feat(hook): 增强 hook 上报模式，增加工具调用详情

## [1.10.1] - 2026-03-20

### 问题修复

  - a05a056 chore(build-release): 自动提交 release 变更，不自动推送
  - 32684ef chore: release v1.10.0
  - 3810857 feat(gateway): Hook 消息缓存与批量发送功能
  - c7cb681 release v1.9.0: 消息队列系统 + 图片发送修复
  - 2924916 fix(service): 僵尸 PID 文件检测与自动清理
  - 1da7450 release v1.8.2
  - 06921ef fix(service): 修复网关模式探测功能
  - 38795a3 feat(gateway): 智能消息发送 - 自动降级到主动消息
  - d18b6ec feat(hook): 增强 hook 上报模式，增加工具调用详情
  - 982c9b7 feat(gateway): 添加网关自愈机制

## [1.10.0] - 2026-03-20

### 功能更新

  - 3810857 feat(gateway): Hook 消息缓存与批量发送功能
  - c7cb681 release v1.9.0: 消息队列系统 + 图片发送修复
  - 2924916 fix(service): 僵尸 PID 文件检测与自动清理
  - 1da7450 release v1.8.2
  - 06921ef fix(service): 修复网关模式探测功能
  - 38795a3 feat(gateway): 智能消息发送 - 自动降级到主动消息
  - d18b6ec feat(hook): 增强 hook 上报模式，增加工具调用详情
  - 982c9b7 feat(gateway): 添加网关自愈机制
  - b3fff0a feat(scripts): 添加 qqbot-service.js 服务管理脚本
  - 48cf034 chore: release v1.4.0

## [1.9.0] - 2026-03-20

### 新功能

- **消息队列系统** - 新增 Claude Code 任务队列，避免并发执行导致资源耗尽
  - `maxConcurrent: 1` - 同时只运行一个 Claude Code 实例
  - `mergeWindowMs: 5000` - 相同项目+用户的消息在5秒内自动合并
  - 队列统计：总处理数、总合并数、平均耗时
  - 顺序处理任务，防止系统资源过度消耗

### Bug 修复

- **图片发送修复** - 修复 `loadImageAsDataUrl` 返回对象导致 `imageUrl.startsWith is not a function` 错误
  - 正确提取 `dataUrl` 属性：`imageUrl = imageData.dataUrl`
  - 本地图片现在可以正常发送

- **主动消息富媒体支持** - 主动消息现在也尝试发送富媒体（图片、文件等）
  - 不再直接替换为 `[媒体文件]` 占位符
  - 只有富媒体发送失败时才降级为纯文本

## [1.8.3] - 2026-03-19

### Bug 修复

- **僵尸 PID 文件检测** - 修复网关进程已退出但 PID 文件残留导致 status 误报"运行中"的问题
  - `getGatewayPid()` 现在返回 `{ pid, stale, stalePid }` 对象
  - status 命令正确识别僵尸状态并显示警告
  - start/stop 命令自动清理残留的 PID 文件
  - 人类可读格式显示 `⚠️ 异常 - PID 文件残留` 和修复建议

## [1.8.2] - 2026-03-19

### Bug 修复

- **待发送消息匹配修复** - 修复 openid 格式不一致导致待发送消息无法正确匹配的问题
  - `getPendingMessages` 和 `getPendingMessageCount` 现在使用 `normalizeOpenid` 函数
  - 无论 openid 是否带 `U_` 前缀都能正确匹配待发送消息
  - 解决了积压消息无法发送的问题

### 功能更新

- **消息去重** - 添加待发送消息去重逻辑，避免重复消息积压
  - `addPendingMessage` 在添加消息前检查是否已存在相同内容的消息
  - 重复消息会被跳过并返回 `{ isDuplicate: true }`
  - 控制台显示 `Duplicate message skipped` 日志

## [1.8.1] - 2026-03-19

### Bug 修复

- **网关模式探测** - 修复 `qqbot-service status` 无法正确显示运行模式的问题
  - 新增 `gateway-state.json` 状态文件持久化网关启动模式
  - `startGateway()` 启动时写入 mode、pid、startedAt 等信息
  - `stop` 命令时清理状态文件
  - status 命令优先从状态文件读取模式，回退到进程命令行推断

## [1.8.0] - 2026-03-19

### 功能更新

- **智能消息发送** - 当被动回复额度用完时，自动切换到主动消息发送，解决消息积压问题
  - 新增 `sendMessageSmart` 函数：优先被动回复，自动降级到主动消息
  - 新增 `sendRichMessageSmart` 函数：富媒体消息的智能发送
  - 更新所有消息发送点：Hook 通知、自动回复、错误回复、待发送队列、启动通知、过期提醒
  - 用户体验改进：消息实时推送，无需用户发送新消息触发

## [1.7.0] - 2026-03-19

### 功能更新

  - 982c9b7 feat(gateway): 添加网关自愈机制
  - b3fff0a feat(scripts): 添加 qqbot-service.js 服务管理脚本
  - 48cf034 chore: release v1.4.0
  - f879817 feat(gateway): 添加文件/图片缓存支持
  - 964439e feat(gateway): 添加消息超时和智能压缩机制
  - 462f17a chore: release v1.3.8
  - ecabff2 chore: release v1.3.7
  - 5c85fc8 feat(gateway): 实现被动回复激活系统，解决 C2C 主动发送不可靠问题
  - 54a1941 chore: release v1.3.5
  - 782e843 feat(gateway): 添加启动完成通知功能和 --mode auto 参数支持

## [1.6.0] - 2026-03-19

### 功能更新

  - b3fff0a feat(scripts): 添加 qqbot-service.js 服务管理脚本
  - 48cf034 chore: release v1.4.0
  - f879817 feat(gateway): 添加文件/图片缓存支持
  - 964439e feat(gateway): 添加消息超时和智能压缩机制
  - 462f17a chore: release v1.3.8
  - ecabff2 chore: release v1.3.7
  - 5c85fc8 feat(gateway): 实现被动回复激活系统，解决 C2C 主动发送不可靠问题
  - 54a1941 chore: release v1.3.5
  - 782e843 feat(gateway): 添加启动完成通知功能和 --mode auto 参数支持
  - c78eb78 fix: 复用 src/api.ts 完善实现，修复文件发送超时问题

## [1.5.0] - 2026-03-19

### 功能更新

  - 48cf034 chore: release v1.4.0
  - f879817 feat(gateway): 添加文件/图片缓存支持
  - 964439e feat(gateway): 添加消息超时和智能压缩机制
  - 462f17a chore: release v1.3.8
  - ecabff2 chore: release v1.3.7
  - 5c85fc8 feat(gateway): 实现被动回复激活系统，解决 C2C 主动发送不可靠问题
  - 54a1941 chore: release v1.3.5
  - 782e843 feat(gateway): 添加启动完成通知功能和 --mode auto 参数支持
  - c78eb78 fix: 复用 src/api.ts 完善实现，修复文件发送超时问题
  - d3fe153 docs: 修复 build-release 技能遗漏 marketplace.json 版本号更新问题

## [1.4.0] - 2026-03-19

### 功能更新

- feat(gateway): 添加消息超时和智能压缩机制
- feat(gateway): 添加文件/图片缓存支持，支持附件消息
- 消息默认 24 小时过期，压缩后保留 7 天
- 文件缓存存储在专用目录 (`~/.claude/qqbot-gateway/file-cache/`)
- 使用 Claude headless 模式自动压缩过期消息
- 附件消息压缩时保留文件类型和名称信息
- 过期文件自动清理，压缩摘要中标注已清理文件
- 新增内部 API 端点 `/api/compress` 用于手动触发压缩
- 定时检查器每 5 分钟自动检查并压缩过期消息

## [1.3.9] - 2026-03-19

### 功能更新

- feat(gateway): 添加消息超时和智能压缩机制
- feat(gateway): 添加文件/图片缓存支持，支持附件消息
- 消息默认 24 小时过期，压缩后保留 7 天
- 文件缓存存储在专用目录，支持内部索引
- 使用 Claude headless 模式自动压缩过期消息
- 附件消息压缩时保留文件类型和名称信息
- 过期文件自动清理，压缩摘要中标注已清理文件
- 新增内部 API 端点 `/api/compress` 用于手动触发压缩
- 定时检查器每 5 分钟自动检查并压缩过期消息

## [1.3.8] - 2026-03-19

### 功能更新

- fix(hook): 修复 Hook 系统与 Gateway 内部 API 集成
- docs: 更新 Hook 配置文档和示例

## [1.3.7] - 2026-03-19

### 功能更新

- feat(gateway): 添加内部 HTTP API (端口 3310) 供 Hook 调用
- feat(gateway): 实现心跳机制，处理超时从 2 分钟增加到 5 分钟
- feat(hook): 新增 `qqbot-hook-handler.js` 通过内部 API 发送通知
- feat(hook): 支持项目级 Hook 配置 (`qqbot-notify.yaml`)
- fix(api): 使用 `AbortSignal.timeout()` 解决网络超时问题
- refactor: Hook 不再直接调用 QQ API，统一通过 Gateway 缓存和发送

## [1.3.6] - 2026-03-18

### 功能更新

- feat(gateway): 实现基于被动回复的激活系统，解决 C2C 主动发送消息不可靠问题
- 新增 `activation-state.js` 模块管理用户激活状态
- 网关启动时进入"待激活"状态，提示用户发送激活消息
- 收到用户消息后获取 msg_id，进入"已激活"状态
- 所有发送都基于被动回复机制，避免 11244 错误
- 无有效 msg_id 时缓存消息，等待用户触发后发送
- 过期检查定时器（每 5 分钟），即将过期时发送提醒
- msg_id 有效期 1 小时，最多使用 4 次

## [1.3.5] - 2026-03-18

### 功能更新

- 5b43773 feat(gateway): 添加启动完成通知功能和 --mode auto 参数支持
- 网关启动成功后自动发送通知到 QQ 用户（带指数退避重试机制）
- 支持 `--mode auto` 和 `--auto` 两种参数形式
- 修复 API 模块导入路径问题（开发环境兼容）

## [1.3.2] - 2026-03-17

### 问题修复

  - ee7e04f docs: update README with --from-env setup instructions and security best practices
  - f2a2e03 chore: release v1.3.1
  - 0b4fe32 fix: resolve setRawMode error in non-TTY environments and add CLI args support
  - 833aa8f feat: add unified check command and enhance service status
  - b4e29f6 fix: update send-message.js to use correct QQ Bot API endpoints
  - cfb49be chore: release v1.2.12
  - 60976ef fix: add --help support to send command
  - dde9c8d chore: release v1.2.11
  - f399171 fix: correct import paths in send-proactive.ts
  - e0d0fdb chore: release v1.2.10

## [1.3.1] - 2026-03-17

### 问题修复

  - 0b4fe32 fix: resolve setRawMode error in non-TTY environments and add CLI args support
  - 833aa8f feat: add unified check command and enhance service status
  - b4e29f6 fix: update send-message.js to use correct QQ Bot API endpoints
  - cfb49be chore: release v1.2.12
  - 60976ef fix: add --help support to send command
  - dde9c8d chore: release v1.2.11
  - f399171 fix: correct import paths in send-proactive.ts
  - e0d0fdb chore: release v1.2.10
  - 33ba982 fix: add send command to CLI and create send-message.js
  - fc3f44f chore: release v1.2.9

## [1.3.0] - 2026-03-17

### 功能更新

  - b4e29f6 fix: update send-message.js to use correct QQ Bot API endpoints
  - cfb49be chore: release v1.2.12
  - 60976ef fix: add --help support to send command
  - dde9c8d chore: release v1.2.11
  - f399171 fix: correct import paths in send-proactive.ts
  - e0d0fdb chore: release v1.2.10
  - 33ba982 fix: add send command to CLI and create send-message.js
  - fc3f44f chore: release v1.2.9
  - 83b9a64 chore: release v1.2.8
  - e17be93 fix: build-release 现在自动更新 marketplace.json 版本号

## [1.2.13] - 2026-03-16

### 问题修复

  - cfb49be chore: release v1.2.12
  - 60976ef fix: add --help support to send command
  - dde9c8d chore: release v1.2.11
  - f399171 fix: correct import paths in send-proactive.ts
  - e0d0fdb chore: release v1.2.10
  - 33ba982 fix: add send command to CLI and create send-message.js
  - fc3f44f chore: release v1.2.9
  - 83b9a64 chore: release v1.2.8
  - e17be93 fix: build-release 现在自动更新 marketplace.json 版本号
  - 7a86fec chore: release v1.2.7

## [1.2.12] - 2026-03-16

### 问题修复

  - 60976ef fix: add --help support to send command
  - dde9c8d chore: release v1.2.11
  - f399171 fix: correct import paths in send-proactive.ts
  - e0d0fdb chore: release v1.2.10
  - 33ba982 fix: add send command to CLI and create send-message.js
  - fc3f44f chore: release v1.2.9
  - 83b9a64 chore: release v1.2.8
  - e17be93 fix: build-release 现在自动更新 marketplace.json 版本号
  - 7a86fec chore: release v1.2.7
  - 575acc5 feat: 添加 /qqbot-doctor 技能命令

## [1.2.11] - 2026-03-16

### 问题修复

  - f399171 fix: correct import paths in send-proactive.ts
  - e0d0fdb chore: release v1.2.10
  - 33ba982 fix: add send command to CLI and create send-message.js
  - fc3f44f chore: release v1.2.9
  - 83b9a64 chore: release v1.2.8
  - e17be93 fix: build-release 现在自动更新 marketplace.json 版本号
  - 7a86fec chore: release v1.2.7
  - 575acc5 feat: 添加 /qqbot-doctor 技能命令
  - 2cc192e chore: release v1.2.6
  - abba8bf feat(doctor): 增强 doctor 自动修复功能

## [1.2.10] - 2026-03-16

### 问题修复

  - 33ba982 fix: add send command to CLI and create send-message.js
  - fc3f44f chore: release v1.2.9
  - 83b9a64 chore: release v1.2.8
  - e17be93 fix: build-release 现在自动更新 marketplace.json 版本号
  - 7a86fec chore: release v1.2.7
  - 575acc5 feat: 添加 /qqbot-doctor 技能命令
  - 2cc192e chore: release v1.2.6
  - abba8bf feat(doctor): 增强 doctor 自动修复功能
  - 9b7dcaf chore: release v1.2.5
  - f2c757f feat: 增强 setup-wizard 环境检查功能

## [1.2.9] - 2026-03-16

### 问题修复

  - 83b9a64 chore: release v1.2.8
  - e17be93 fix: build-release 现在自动更新 marketplace.json 版本号
  - 7a86fec chore: release v1.2.7
  - 575acc5 feat: 添加 /qqbot-doctor 技能命令
  - 2cc192e chore: release v1.2.6
  - abba8bf feat(doctor): 增强 doctor 自动修复功能
  - 9b7dcaf chore: release v1.2.5
  - f2c757f feat: 增强 setup-wizard 环境检查功能
  - 6a72670 chore: release v1.2.4
  - 00f1708 fix: 修复命令执行路径

## [1.2.8] - 2026-03-16

### 问题修复

  - e17be93 fix: build-release 现在自动更新 marketplace.json 版本号
  - 7a86fec chore: release v1.2.7
  - 575acc5 feat: 添加 /qqbot-doctor 技能命令
  - 2cc192e chore: release v1.2.6
  - abba8bf feat(doctor): 增强 doctor 自动修复功能
  - 9b7dcaf chore: release v1.2.5
  - f2c757f feat: 增强 setup-wizard 环境检查功能
  - 6a72670 chore: release v1.2.4
  - 00f1708 fix: 修复命令执行路径
  - fb8f961 chore: release v1.2.3

## [1.2.7] - 2026-03-16

### 问题修复

  - 575acc5 feat: 添加 /qqbot-doctor 技能命令
  - 2cc192e chore: release v1.2.6
  - abba8bf feat(doctor): 增强 doctor 自动修复功能
  - 9b7dcaf chore: release v1.2.5
  - f2c757f feat: 增强 setup-wizard 环境检查功能
  - 6a72670 chore: release v1.2.4
  - 00f1708 fix: 修复命令执行路径
  - fb8f961 chore: release v1.2.3
  - 1af3a64 fix: 添加 dotenv 依赖并增强 doctor 依赖检查
  - e488fad chore: release v1.2.2

## [1.2.6] - 2026-03-16

### 问题修复

  - abba8bf feat(doctor): 增强 doctor 自动修复功能
  - 9b7dcaf chore: release v1.2.5
  - f2c757f feat: 增强 setup-wizard 环境检查功能
  - 6a72670 chore: release v1.2.4
  - 00f1708 fix: 修复命令执行路径
  - fb8f961 chore: release v1.2.3
  - 1af3a64 fix: 添加 dotenv 依赖并增强 doctor 依赖检查
  - e488fad chore: release v1.2.2
  - 60df79b docs: 完善README指令详解和使用场景
  - e617029 docs: 简化 README，专注于 Claude Code 使用方式

## [1.2.5] - 2026-03-16

### 问题修复

  - f2c757f feat: 增强 setup-wizard 环境检查功能
  - 6a72670 chore: release v1.2.4
  - 00f1708 fix: 修复命令执行路径
  - fb8f961 chore: release v1.2.3
  - 1af3a64 fix: 添加 dotenv 依赖并增强 doctor 依赖检查
  - e488fad chore: release v1.2.2
  - 60df79b docs: 完善README指令详解和使用场景
  - e617029 docs: 简化 README，专注于 Claude Code 使用方式
  - 3a9d6d9 chore: release v1.2.1
  - dbf2451 fix: 修复 plugin.json manifest 验证错误

## [1.2.4] - 2026-03-16

### 问题修复

  - 00f1708 fix: 修复命令执行路径
  - fb8f961 chore: release v1.2.3
  - 1af3a64 fix: 添加 dotenv 依赖并增强 doctor 依赖检查
  - e488fad chore: release v1.2.2
  - 60df79b docs: 完善README指令详解和使用场景
  - e617029 docs: 简化 README，专注于 Claude Code 使用方式
  - 3a9d6d9 chore: release v1.2.1
  - dbf2451 fix: 修复 plugin.json manifest 验证错误
  - 250f4fe chore: release v1.2.0
  - d710024 docs(build-release): 强调插件安装方式，移除 npm 发布提示

## [1.2.3] - 2026-03-16

### 问题修复

  - 1af3a64 fix: 添加 dotenv 依赖并增强 doctor 依赖检查
  - e488fad chore: release v1.2.2
  - 60df79b docs: 完善README指令详解和使用场景
  - e617029 docs: 简化 README，专注于 Claude Code 使用方式
  - 3a9d6d9 chore: release v1.2.1
  - dbf2451 fix: 修复 plugin.json manifest 验证错误
  - 250f4fe chore: release v1.2.0
  - d710024 docs(build-release): 强调插件安装方式，移除 npm 发布提示
  - 92576b5 docs: 完善 README 快速实践指南，更新项目级配置说明
  - dad72cb fix: 移除 plugin.json 中不支持的 category 字段

## [1.2.2] - 2026-03-16

### 问题修复

  - 60df79b docs: 完善README指令详解和使用场景
  - e617029 docs: 简化 README，专注于 Claude Code 使用方式
  - 3a9d6d9 chore: release v1.2.1
  - dbf2451 fix: 修复 plugin.json manifest 验证错误
  - 250f4fe chore: release v1.2.0
  - d710024 docs(build-release): 强调插件安装方式，移除 npm 发布提示
  - 92576b5 docs: 完善 README 快速实践指南，更新项目级配置说明
  - dad72cb fix: 移除 plugin.json 中不支持的 category 字段
  - d5821fb chore: 更新 plugin.json author 为 fuzhibo
  - cede48b chore: 更新 marketplace owner 为 fuzhibo

## [1.2.1] - 2026-03-16

### 问题修复

  - dbf2451 fix: 修复 plugin.json manifest 验证错误
  - 250f4fe chore: release v1.2.0
  - d710024 docs(build-release): 强调插件安装方式，移除 npm 发布提示
  - 92576b5 docs: 完善 README 快速实践指南，更新项目级配置说明
  - dad72cb fix: 移除 plugin.json 中不支持的 category 字段
  - d5821fb chore: 更新 plugin.json author 为 fuzhibo
  - cede48b chore: 更新 marketplace owner 为 fuzhibo
  - 35c3da5 refactor: 移除全局 .env，简化配置架构
  - 305fe6a feat: 项目级配置独立存储，不覆盖全局配置
  - c09c074 feat: 项目级配置自动同步到全局

## [1.2.0] - 2026-03-16

### 功能更新

  - d710024 docs(build-release): 强调插件安装方式，移除 npm 发布提示
  - 92576b5 docs: 完善 README 快速实践指南，更新项目级配置说明
  - dad72cb fix: 移除 plugin.json 中不支持的 category 字段
  - d5821fb chore: 更新 plugin.json author 为 fuzhibo
  - cede48b chore: 更新 marketplace owner 为 fuzhibo
  - 35c3da5 refactor: 移除全局 .env，简化配置架构
  - 305fe6a feat: 项目级配置独立存储，不覆盖全局配置
  - c09c074 feat: 项目级配置自动同步到全局
  - af094a4 fix: 环境变量优先从全局配置加载
  - dbdb3dc feat: 网关启动时检查是否已有实例运行

## [1.1.0] - 2026-03-13

### 功能更新

  - a506f63 feat: 添加 QQ Bot MCP 插件完整功能
  - c24ebd1 ci(e2e): 添加 E2E 测试工作流与脚本
  - a431061 111
  - 78e38e1 Update README.md
  - 1a37086 chore: 添加 MIT 许可证
  - 5fd5119 docs: 添加机器人注册图文教程
  - cfac070 Update README.md
  - 2f8a1d1 docs: 添加 1.5.4 版本更新日志
  - a5ba39c docs: 添加多账户配置文档
  - ddf8d5d chore(qqbot): 添加调试日志

