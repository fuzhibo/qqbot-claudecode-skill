# Changelog

所有重要的变更都将记录在此文件中。

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

