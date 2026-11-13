/**
 * 云函数打包脚本（技术方案 §6.6 的落地实现）。
 *
 * 做法：每个业务函数用 esbuild 打成单文件 CJS bundle —— common 公共层以源码形式内联，
 * wx-server-sdk 保持 external（由云端 npm 安装）。产物落进 dist-cloud/<fn>/：
 *   index.js      bundle
 *   config.json   从 cloudfunctions/<fn>/config.json 原样拷贝（timeout / timer trigger 不改）
 *   package.json  只含 wx-server-sdk，不含 file:../common —— 这是部署能跑通的关键
 *
 * 用法：npm run build:cloud
 * 约定：本脚本不执行任何部署命令；类型检查失败即中止（退出码非 0）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CF_DIR = path.join(ROOT, 'cloudfunctions')
const OUT_DIR = path.join(ROOT, 'dist-cloud')
const COMMON_ENTRY = path.join(CF_DIR, 'common', 'src', 'index.ts')
const TSC = path.join(ROOT, 'node_modules', '.bin', 'tsc')
const FNS = ['user', 'plan', 'vote', 'comment', 'scheduler']
/** 类型检查覆盖 common 自身 + 五个业务函数 */
const CHECK_TARGETS = ['common', ...FNS]

function fail(msg) {
  console.error(`\n✗ build:cloud 中止：${msg}`)
  process.exit(1)
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)}kb`
}

// ---------- 0. 前置校验 ----------
if (!fs.existsSync(COMMON_ENTRY)) fail(`找不到 common 源码入口 ${COMMON_ENTRY}`)
if (!fs.existsSync(TSC)) fail(`找不到 tsc：${TSC}（请先在仓库根安装依赖）`)

// ---------- 1. 幂等：清空产物目录 ----------
fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

// ---------- 2. 打包前全量类型检查（--noEmit，任一处失败即中止）----------
console.log('类型检查（tsc --noEmit，paths 直读 common 源码）')
for (const name of CHECK_TARGETS) {
  const project = path.join(CF_DIR, name, 'tsconfig.json')
  const r = spawnSync(TSC, ['--noEmit', '-p', project], { encoding: 'utf8' })
  if (r.status !== 0) {
    process.stdout.write(r.stdout || '')
    process.stderr.write(r.stderr || '')
    fail(`${name} 类型检查未通过（exit ${r.status}）`)
  }
  console.log(`  ${name.padEnd(10)} 0 errors`)
}

// ---------- 3. 逐函数 bundle + 拷贝配置 + 自检 ----------
const rows = []
for (const fn of FNS) {
  const srcDir = path.join(CF_DIR, fn)
  const entry = path.join(srcDir, 'src', 'index.ts')
  const srcPkgPath = path.join(srcDir, 'package.json')
  const srcCfgPath = path.join(srcDir, 'config.json')
  const outDir = path.join(OUT_DIR, fn)
  const outFile = path.join(outDir, 'index.js')
  if (!fs.existsSync(entry)) fail(`${fn} 缺少入口 ${entry}`)
  if (!fs.existsSync(srcCfgPath)) fail(`${fn} 缺少 ${srcCfgPath}，无法拷贝部署配置`)
  fs.mkdirSync(outDir, { recursive: true })

  // 3.1 esbuild：common 源码内联，wx-server-sdk external
  try {
    esbuild.buildSync({
      entryPoints: [entry],
      outfile: outFile,
      bundle: true,
      platform: 'node',
      target: 'node16',
      format: 'cjs',
      external: ['wx-server-sdk'],
      alias: { common: COMMON_ENTRY },
    })
  } catch (err) {
    fail(`${fn} esbuild 打包失败：${err && err.message ? err.message : err}`)
  }

  // 3.2 config.json 原样拷贝（不重新生成内容）
  fs.copyFileSync(srcCfgPath, path.join(outDir, 'config.json'))

  // 3.3 部署用 package.json：main + 仅 wx-server-sdk
  const srcPkg = JSON.parse(fs.readFileSync(srcPkgPath, 'utf8'))
  const sdkVersion = (srcPkg.dependencies || {})['wx-server-sdk']
  if (!sdkVersion) fail(`${fn} 的源 package.json 里没有 wx-server-sdk 依赖，版本无从沿用`)
  const deployPkg = {
    name: fn,
    version: srcPkg.version || '1.0.0',
    private: true,
    main: 'index.js',
    dependencies: { 'wx-server-sdk': sdkVersion },
  }
  fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(deployPkg, null, 2)}\n`)

  // 3.4 自检：require("common") 必须 0 命中；node --check 语法合法
  const code = fs.readFileSync(outFile, 'utf8')
  const commonRequires = code.match(/require\(\s*["']common["']\s*\)/g) || []
  if (commonRequires.length > 0) {
    fail(`${fn} 的 bundle 中仍有 ${commonRequires.length} 处 require("common")，alias 未生效`)
  }
  const check = spawnSync(process.execPath, ['--check', outFile], { encoding: 'utf8' })
  if (check.status !== 0) {
    process.stderr.write(check.stderr || '')
    fail(`${fn} 产物 node --check 失败`)
  }
  rows.push({
    fn,
    bytes: fs.statSync(outFile).size,
    sdk: code.includes('require("wx-server-sdk")') ? 'external' : '未引用',
  })
}

// ---------- 4. 汇总 ----------
console.log('\nbundle 产物（dist-cloud/）')
for (const r of rows) {
  console.log(
    `  ${r.fn.padEnd(10)} ${String(r.bytes).padStart(7)} bytes  ${kb(r.bytes).padStart(9)}  node --check OK  require("common")=0  wx-server-sdk=${r.sdk}`,
  )
}
console.log(`\n✓ 5 个函数已打包到 ${path.relative(ROOT, OUT_DIR)}/，部署目录不含 file:../common`)
