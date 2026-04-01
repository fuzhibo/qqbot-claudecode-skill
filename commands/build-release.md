# Build Release Skill

版本管理和发布技能 - 用于自动化版本更新、构建和发布流程。

## 触发条件

当用户提到以下场景时使用此技能:
- 版本发布、版本更新
- 创建 release、发布新版本
- bump version、升级版本
- 准备发布、打包发布
- "release", "build release", "发布版本"

## 功能说明

此技能调用 `scripts/build-release.js` 脚本,自动完成以下流程:

1. **构建前验证** - 运行测试确保代码质量
2. **构建项目** - 执行 `npm run build` 生成可部署产物
3. **版本号更新** - 支持 major/minor/patch 三种更新类型
   - `major`: 重大版本更新 (不兼容的 API 变更)
   - `minor`: 功能更新 (新增功能,向后兼容)
   - `patch`: 问题修复 (Bug 修复)
4. **同步版本文件** - 自动更新以下文件中的版本号:
   - `package.json`
   - `plugin.json`
   - `.claude-plugin/marketplace.json` (如存在)
5. **生成 CHANGELOG** - 记录版本变更
6. **创建 Git Tag** - 标记版本 (v{version})
7. **自动提交** - 提交所有变更到 Git

## 使用方式

### 基本用法

```bash
/build-release [major|minor|patch]
```

### 示例

```bash
# 修复 Bug 后发布小版本
/build-release patch

# 新增功能后发布功能版本
/build-release minor

# 重大变更后发布大版本
/build-release major
```

### 其他命令

```bash
# 查看当前版本状态
/build-release --check

# 验证版本一致性
/build-release --verify

# 修复版本不一致
/build-release --fix

# 仅更新 CHANGELOG
/build-release --changelog
```

## 执行流程

当用户请求发布时,按以下步骤执行:

1. **确认版本类型** - 如果用户未指定,询问要发布的版本类型 (major/minor/patch)
2. **执行发布脚本**:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/build-release.js {type}
   ```
3. **等待完成** - 脚本会自动执行所有步骤
4. **提示后续操作** - 提醒用户手动推送:
   ```bash
   git push origin main
   git push origin v{version}
   ```

## 版本号规则

遵循语义化版本规范 (SemVer):

- **MAJOR** (主版本号): 不兼容的 API 变更
- **MINOR** (次版本号): 向后兼容的功能新增
- **PATCH** (修订号): 向后兼容的问题修复

当前项目版本从 `0.0.1` 开始,现已迭代到 `1.22.0`。

## 注意事项

1. **本项目无需发布到 npm** - 这是 Claude Code 插件,通过 Marketplace 或本地安装使用
2. **工作目录应保持干净** - 发布前建议先提交未保存的变更
3. **测试应通过** - 构建前会运行测试,测试失败会中止发布
4. **需要手动推送** - 脚本不会自动推送代码和 tag 到远程仓库

## 安装方式 (面向用户)

```bash
# Marketplace 安装
claude plugin marketplace add https://github.com/fuzhibo/qqbot-claudecode-skill

# 本地安装
claude plugin add /path/to/qqbot-claudecode-skill
```

## 实现细节

- 脚本位置: `scripts/build-release.js`
- npm scripts: `npm run release[:patch|:minor|:major]`
- 版本文件: `package.json`, `plugin.json`, `.claude-plugin/marketplace.json`
- 变更日志: `CHANGELOG.md`
