#!/usr/bin/env node

/**
 * QQ Bot MCP Bundle Build Script
 *
 * 使用 esbuild 将所有依赖打包进 dist，用户无需 npm install 即可使用。
 *
 * 打包策略：
 * - MCP Server 入口: dist/mcp/index.js (独立可执行)
 * - Gateway 脚本: 独立打包
 * - 其他脚本: 保持原样或按需打包
 *
 * 排除的依赖（Node.js 内置）：
 * - fs, path, os, crypto, http, https, ws 等 Node.js 标准库
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.dirname(__dirname);

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 外部依赖配置（不打包进 bundle 的依赖）
// Node.js 内置模块会自动被 esbuild 识别为 external
const externalNodeModules = [
  // Node.js 内置模块
  'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util', 'stream',
  'events', 'buffer', 'child_process', 'net', 'tls', 'zlib', 'querystring',
  // 可选外部依赖（运行时可能需要）
  'dotenv',
];

// 打包配置
const buildConfigs = [
  // MCP Server 主入口 - 使用 ESM 格式以兼容 package.json 的 "type": "module"
  {
    entry: 'src/mcp/index.ts',
    outfile: 'dist/mcp/index.js',
    external: ['dotenv'],
    format: 'esm',
  },
  // Channel Pusher 模块
  {
    entry: 'src/mcp/channel-pusher.ts',
    outfile: 'dist/mcp/channel-pusher.js',
    external: ['dotenv'],
  },
  // Permission Relay 模块
  {
    entry: 'src/mcp/permission-relay.ts',
    outfile: 'dist/mcp/permission-relay.js',
    external: ['dotenv'],
  },
  // API 模块 (供 qqbot-gateway.js 使用) - 使用 ESM 格式以正确导出 enum
  {
    entry: 'src/api.ts',
    outfile: 'dist/src/api.js',
    external: ['dotenv'],
    format: 'esm',
  },
];

async function buildBundle(config) {
  const entryPath = path.join(ROOT_DIR, config.entry);
  const outPath = path.join(ROOT_DIR, config.outfile);

  // 确保输出目录存在
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    const result = await esbuild.build({
      entryPoints: [entryPath],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: outPath,
      external: config.external || [],
      minify: false, // 保持可读性
      sourcemap: false, // 不生成 sourcemap
      format: config.format || 'cjs', // 默认 CommonJS，支持 ESM 覆盖
      packages: 'bundle', // 打包所有依赖
      mainFields: ['module', 'main'],
      conditions: config.format === 'esm' ? ['import', 'node', 'default'] : ['require', 'node', 'default'],
      logLevel: 'warning',
      // ESM 模块需要 createRequire shim 以支持 CommonJS 依赖
      banner: config.format === 'esm' ? {
        js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`
      } : { js: '#!/usr/bin/env node' },
    });

    const stats = fs.statSync(outPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    log('green', `  ✅ ${config.outfile} (${sizeKB} KB)`);

    return { success: true, size: stats.size };
  } catch (error) {
    log('red', `  ❌ ${config.outfile}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function copyNonTsFiles() {
  // 复制 scripts 目录中的 JS 文件（非 TypeScript 编译的）
  const scriptsDir = path.join(ROOT_DIR, 'scripts');
  const distScriptsDir = path.join(ROOT_DIR, 'dist', 'scripts');

  if (!fs.existsSync(distScriptsDir)) {
    fs.mkdirSync(distScriptsDir, { recursive: true });
  }

  // 需要直接复制的脚本（不需要打包的）
  const scriptsToCopy = [
    'doctor.js',
    'qqbot-service.js',
    'qqbot-doctor.js',
    'qqbot-upgrade.js',
  ];

  for (const script of scriptsToCopy) {
    const srcPath = path.join(scriptsDir, script);
    const destPath = path.join(distScriptsDir, script);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      log('dim', `  📄 复制 scripts/${script}`);
    }
  }

  // 复制 bin 目录
  const binDir = path.join(ROOT_DIR, 'bin');
  const distBinDir = path.join(ROOT_DIR, 'dist', 'bin');
  if (fs.existsSync(binDir)) {
    if (!fs.existsSync(distBinDir)) {
      fs.mkdirSync(distBinDir, { recursive: true });
    }
    const binFiles = fs.readdirSync(binDir);
    for (const file of binFiles) {
      fs.copyFileSync(
        path.join(binDir, file),
        path.join(distBinDir, file)
      );
      log('dim', `  📄 复制 bin/${file}`);
    }
  }

  // 复制 scripts/lib 目录
  const libDir = path.join(scriptsDir, 'lib');
  const distLibDir = path.join(distScriptsDir, 'lib');
  if (fs.existsSync(libDir)) {
    if (!fs.existsSync(distLibDir)) {
      fs.mkdirSync(distLibDir, { recursive: true });
    }
    const libFiles = fs.readdirSync(libDir);
    for (const file of libFiles) {
      if (file.endsWith('.js')) {
        fs.copyFileSync(
          path.join(libDir, file),
          path.join(distLibDir, file)
        );
        log('dim', `  📄 复制 scripts/lib/${file}`);
      }
    }
  }
}

async function buildTypeScript() {
  // 先运行 tsc 生成类型声明文件
  const { execSync } = await import('child_process');
  try {
    log('cyan', '\n📝 生成类型声明文件...\n');
    execSync('npx tsc --emitDeclarationOnly --declaration', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    log('green', '  ✅ 类型声明文件生成完成\n');
  } catch (error) {
    log('yellow', '  ⚠️  类型声明文件生成失败（继续打包）\n');
  }
}

async function main() {
  log('cyan', '╔══════════════════════════════════════════════════════════╗');
  log('cyan', '║       📦 QQ Bot MCP Bundle Build                         ║');
  log('cyan', '╚══════════════════════════════════════════════════════════╝\n');

  // 1. 生成类型声明文件
  await buildTypeScript();

  // 2. 打包主要模块
  log('cyan', '🔨 打包模块...\n');

  let totalSize = 0;
  let successCount = 0;

  for (const config of buildConfigs) {
    const result = await buildBundle(config);
    if (result.success) {
      successCount++;
      totalSize += result.size || 0;
    }
  }

  // 3. 复制非 TypeScript 文件
  log('cyan', '\n📄 复制辅助文件...\n');
  await copyNonTsFiles();

  // 4. 输出摘要
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
  log('green', `\n✅ 打包完成！\n`);
  log('dim', `  成功: ${successCount}/${buildConfigs.length} 个模块`);
  log('dim', `  总大小: ${totalSizeMB} MB`);
  log('cyan', '\n📌 用户无需运行 npm install 即可使用 MCP Server\n');
}

main().catch((err) => {
  log('red', `❌ 打包失败: ${err.message}`);
  process.exit(1);
});
