#!/usr/bin/env node
/**
 * 模板标签 ↔ 组件 import 对账（补齐 vue-tsc 看不见的那半个洞）。
 *
 * 为什么要有这条：工程没开 `strictTemplates`（开了也白开 —— `@dcloudio/uni-app-types`
 * 这个 vue 插件在本地加载失败，内置标签全会被当成未知元素），于是「模板里用了某个组件但
 * `<script setup>` 忘了 import」既不报编译错也不报类型错，运行时静默变成一个未知标签，
 * 页面看起来就是少一块。这类缺陷只能静态挡。
 *
 * 口径：
 * - 只认 `<script setup>` 里 import 进来的本地/第三方组件名，工程内没有 easycom、没有全局组件注册。
 * - uni-app 内置标签走白名单（含 Skyline 专属组件，即便规范禁用它们，标签本身仍是内置的，不算漏 import）。
 * - 反引号字符串、HTML 注释里的尖括号不参与判定。
 *
 * 用法：node scripts/check-templates.mjs [dir]  （默认 src）
 * 退出码：0 通过；1 有标签找不到对应 import。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const ROOT = resolve(process.argv[2] || 'src')

/** uni-app / 微信内置标签 + Skyline 组件 + Vue 内建保留标签，全部不需要 import */
const BUILTIN = new Set(
  (
    'view text image icon progress button input textarea navigator form label picker picker-view ' +
    'checkbox checkbox-group radio radio-group switch slider swiper swiper-item scroll-view ' +
    'movable-area movable-view rich-text web-view video audio camera live-player live-pusher ' +
    'editor ' +
    'ad ad-custom official-account open-data page-container page-meta fragment block canvas ' +
    'list-view grid-view sticky-view sticky-header sticky-section list-item span ' +
    'share-element draggable-sheet snapshot open-container functional-page-navigator ' +
    // Vue 内建：<template>（含 #slot 用法）、<slot>；<component :is> 是动态的，静态判不了也不该报
    'template slot component'
  )
    .split(' ')
    .filter(Boolean)
)

function vueFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) vueFiles(full, out)
    else if (extname(full) === '.vue') out.push(full)
  }
  return out
}

/** `<script setup>` 里所有会成为模板标签名的绑定：默认导入 + 具名导入 */
function importedNames(script) {
  const names = new Set()
  const re = /import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?from\s+['"][^'"]+['"]/g
  for (const m of script.matchAll(re)) {
    if (m[1]) names.add(m[1])
    if (m[2]) {
      for (const part of m[2].split(',')) {
        const cell = part.trim()
        if (!cell || cell.startsWith('type ')) continue
        const alias = cell.split(/\s+as\s+/)
        names.add((alias[1] || alias[0]).trim())
      }
    }
  }
  // 组合式函数在 setup 里现造的组件引用（少见，但别误报）：const X = defineComponent(...)
  for (const m of script.matchAll(
    /const\s+([\w$]+)\s*=\s*(?:defineAsyncComponent|resolveComponent)/g
  )) {
    names.add(m[1])
  }
  return names
}

function templateOf(source) {
  const start = source.indexOf('<template')
  if (start < 0) return ''
  const end = source.lastIndexOf('</template>')
  return source.slice(start, end < 0 ? source.length : end)
}

/** 去掉 HTML 注释，免得注释里的示例标签被当成真用法 */
function stripComments(tpl) {
  return tpl.replace(/<!--[\s\S]*?-->/g, '')
}

const pascal = (tag) => tag.replace(/(^|[-_])(\w)/g, (_, _sep, ch) => ch.toUpperCase())

const problems = []
for (const file of vueFiles(ROOT)) {
  const source = readFileSync(file, 'utf8')
  const script = source.slice(0, source.indexOf('</script>'))
  const names = importedNames(script)
  const tpl = stripComments(templateOf(source))
  for (const m of tpl.matchAll(/<([a-zA-Z][\w[-]*)(?=[\s/>])/g)) {
    const raw = m[1]
    const lower = raw.toLowerCase()
    if (BUILTIN.has(lower)) continue
    // 内置标签里带大写的不存在；组件用法只有两种写法：<BaseXxx> 与 <base-xxx>
    if (names.has(raw) || names.has(pascal(raw)) || names.has(pascal(raw).toLowerCase())) continue
    problems.push(
      `${relative(process.cwd(), file)}: <${raw}> 在模板里出现，但 <script setup> 没有对应 import`
    )
  }
}

if (problems.length) {
  console.error(`✗ 模板标签对账失败（${problems.length} 处）`)
  for (const line of new Set(problems)) console.error(`  ${line}`)
  process.exit(1)
}
console.log(
  `✓ 模板标签对账通过：${vueFiles(ROOT).length} 个 .vue，全部标签都能对上 import 或内置清单`
)
