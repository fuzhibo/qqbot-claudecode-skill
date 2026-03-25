# Build Release Skill

QQ Bot MCP 项目的版本管理和发布构建技能。

## 触发模式

当用户提到以下关键词时自动激活：
- "构建发布"、"build release"
- "版本更新"、"version bump"
- "发布插件"、"publish plugin"
- "打包发布件"

## 核心功能

### 1. 版本管理

项目版本号遵循语义化版本规范 (SemVer): `MAJOR.MINOR.PATCH`

- **MAJOR (大版本)**: 重大变更、不兼容的 API 修改
- **MINOR (重要版本)**: 新增功能、重大 Bug 修复
- **PATCH (小版本)**: 日常迭代、小修复、文档更新

当前版本从 `0.0.1` 开始。

### 2. 构建发布件

生成可直接在 Claude Code 中安装部署的发布件：
- 使用 **esbuild 打包**，将所有依赖打包进 dist
- 用户无需运行 `npm install` 即可使用
- 验证构建无错误
- 生成变更日志

#### ⚠️ 重要：dist 目录必须提交到 Git

由于使用 esbuild 打包，`dist/` 目录包含完整的发布产物，**必须提交到版本控制**：

```bash
# .gitignore 中 dist 已被注释
# dist    ← 不要忽略，需要提交

# 发布前确认 dist 已生成
npm run build

# 提交时包含 dist
git add dist/
git commit -m "chore: update dist"
```

#### 为什么 dist 需要提交？

1. **用户无需构建**：通过 Marketplace 安装后直接可用
2. **无依赖安装**：esbuild 已将所有依赖打包进 dist
3. **降低使用门槛**：用户不需要 Node.js 构建环境

#### node_modules 不提交

`node_modules/` 仍然被 `.gitignore` 忽略，因为：
- 依赖已打包进 dist，运行时不需要
- 只有开发时需要 `npm install`

### 3. 版本更新工作流

```
1. 检查当前版本
2. 验证构建通过
3. 更新版本号 (major/minor/patch)
4. 更新所有版本文件（见下方列表）
5. 更新 CHANGELOG.md
6. 创建 git commit
7. 创建 git tag
```

## 使用方式

### 方式 A: 使用 Skill 命令

```
/build-release [major|minor|patch]
```

### 方式 B: 自然语言

```
"构建一个新版本"
"更新到下一个 patch 版本"
"发布一个 major 版本更新"
```

## 版本号规则

| 类型 | 当前版本 | 更新后 | 适用场景 |
|------|---------|--------|---------|
| patch | 0.0.1 | 0.0.2 | Bug 修复、小改进 |
| minor | 0.0.1 | 0.1.0 | 新功能、重要修复 |
| major | 0.0.1 | 1.0.0 | 重大变更、正式发布 |

## 发布前检查清单

- [ ] 所有测试通过
- [ ] TypeScript 编译无错误
- [ ] 所有版本文件已更新（见下方）
- [ ] CHANGELOG.md 已更新
- [ ] 文档已同步更新

## ⚠️ 必须更新的版本文件

构建发布时**必须**同时更新以下所有文件中的版本号：

| 文件 | 字段 | 说明 |
|------|------|------|
| `package.json` | `"version"` | npm 包版本 |
| `plugin.json` | `"version"` | Claude Code 插件版本 |
| `.claude-plugin/marketplace.json` | `"metadata.version"` | 市场元数据版本 |
| `.claude-plugin/marketplace.json` | `"plugins[0].version"` | 插件市场版本 |

### 版本号格式

所有文件使用相同的版本号格式：`X.Y.Z`（如 `1.3.3`）

### 更新命令示例

```bash
# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")

# 计算新版本（patch）
NEW_VERSION=$(node -p "require('semver').inc('$CURRENT_VERSION', 'patch')")

# 更新 package.json
npm version $NEW_VERSION --no-git-tag-version

# 更新 plugin.json
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" plugin.json

# 更新 marketplace.json（两处）
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/g" .claude-plugin/marketplace.json
```

## 示例工作流

### 场景：日常 Bug 修复后发布

1. 修复代码
2. 运行测试验证
3. 触发版本更新:
   ```
   /build-release patch
   ```
4. 系统自动：
   - 更新版本号 0.0.1 → 0.0.2
   - **更新所有 4 个版本文件**
   - 构建项目
   - 更新 CHANGELOG
   - 提示提交变更

### 场景：新增功能发布

1. 开发新功能
2. 完成测试
3. 触发版本更新:
   ```
   /build-release minor
   ```
4. 系统自动：
   - 更新版本号 0.0.1 → 0.1.0
   - **更新所有 4 个版本文件**
   - 构建项目
   - 更新 CHANGELOG
   - 提示提交变更

## 注意事项

1. **构建优先**: 版本更新前必须确保构建通过
2. **版本同步**: 所有版本文件必须保持一致的版本号
3. **变更记录**: 重要变更必须记录在 CHANGELOG.md
4. **Git 提交**: 建议每次版本更新后创建 commit
5. **测试验证**: 发布前务必运行完整测试
6. **验证命令**: 发布后运行 `grep -r "version" package.json plugin.json .claude-plugin/marketplace.json` 验证
7. **⚠️ 不自动推送**: **绝对不要自动执行 `git push`**，只创建本地 commit 和 tag，由用户手动推送
