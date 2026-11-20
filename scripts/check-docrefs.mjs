/**
 * README 行号引用对账（一次性人工维护扛不住的东西）：
 * 各目录的 README.md 里到处写着 `useEditor.ts:109` 这种锚点，而共享层每插一行 import
 * 就会让后面所有引用整体偏移 —— 偏移不报错，只会让下一个读文档的 agent 对着空行怀疑人生。
 *
 * 判据分两层：
 * 1. 越界 / 文件不存在 / 重名歧义 —— 硬错误；
 * 2. 引用行（或区间）里没有该 md 行上反引号点名的符号 —— 疑似漂移，
 *    此时在目标文件里找这个符号的真实行号，能给就给「建议行号」。
 *
 * 用法：npm run check:docrefs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const ONLY = process.argv.slice(2)
const relPath = (p) => (p.startsWith(`${ROOT}/`) ? p.slice(ROOT.length + 1) : p)

const sources = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|vue)$/.test(name)) sources.push(relPath(p))
  }
}
for (const top of ['src', 'cloudfunctions']) walk(join(ROOT, top))

const byRel = new Set(sources)
const byBase = new Map()
for (const f of sources) {
  const b = f.split('/').pop()
  if (!byBase.has(b)) byBase.set(b, [])
  byBase.get(b).push(f)
}

const docs = []
const walkDocs = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walkDocs(p)
    else if (name === 'README.md') docs.push(relPath(p))
  }
}
walkDocs(join(ROOT, 'src'))

const linesCache = new Map()
const linesOf = (f) => {
  if (!linesCache.has(f)) linesCache.set(f, readFileSync(f, 'utf8').split('\n'))
  return linesCache.get(f)
}

const CITE = /((?:[\w./-]+\/)?[\w-]+\.(?:vue|ts)):(\d+)(?:-(\d+))?/g
const SYMBOL = /`([A-Za-z_$][\w$]{2,})(?:\([^)]*\))?`/g

function resolve(cited, mdDir) {
  const direct = byRel.has(cited) ? cited : byRel.has(`src/${cited}`) ? `src/${cited}` : null
  if (direct) return { file: direct }
  // 带目录的引用（OptionsSection/types.ts、EditorBlockList/index.vue）按**后缀**唯一匹配；
  // 不做这一步就会把 OptionsSection/types.ts 解析到 README 自己目录里的 types.ts 上
  if (cited.includes('/')) {
    const tail = cited.split('/').slice(-2).join('/')
    const suff = sources.filter((f) => f.endsWith(`/${tail}`) || f === tail)
    if (suff.length === 1) return { file: suff[0] }
    if (suff.length > 1) return { error: `后缀歧义：${suff.join(' | ')}` }
  }
  const base = cited.split('/').pop()
  const cands = byBase.get(base) ?? []
  if (cands.length === 0) return { error: '文件不存在' }
  if (cands.length === 1) return { file: cands[0] }
  const sameDir = cands.filter((c) => c.split('/').slice(0, -1).join('/') === mdDir)
  if (sameDir.length === 1) return { file: sameDir[0] }
  const local = cands.find((c) => c.startsWith(mdDir))
  if (local) return { file: local }
  return { error: `重名歧义：${cands.join(' | ')}` }
}

/** 在文件里找一个符号的声明行；唯一命中才返回，避免把引用改到另一个同名变量上 */
function findDecl(file, sym) {
  const lines = linesOf(file)
  const hits = []
  lines.forEach((text, i) => {
    if (!new RegExp(`\\b${sym.replace(/\$/g, '\\$')}\\b`).test(text)) return
    if (
      /\b(function|const|let|export|interface|type)\b/.test(text) ||
      /^[A-Za-z_$][\w$]*\s*[:(=]/.test(text.trim())
    )
      hits.push(i + 1)
  })
  return hits.length === 1 ? hits[0] : hits.length === 0 ? -1 : -hits.length
}

let hard = 0
let suspect = 0
let checked = 0

for (const md of docs) {
  const mdDir = md.split('/').slice(0, -1).join('/')
  readFileSync(md, 'utf8')
    .split('\n')
    .forEach((line, idx) => {
      let m
      CITE.lastIndex = 0
      while ((m = CITE.exec(line)) !== null) {
        const r = resolve(m[1], mdDir)
        checked += 1
        if (r.error) {
          console.log(`✗ ${md}:${idx + 1} 引用 ${m[0]} —— ${r.error}`)
          hard += 1
          continue
        }
        const file = r.file
        // 带参数时只审计这些文件（用于「今天改了共享层，只看指向它们的引用」），其余照常计数不打印
        if (ONLY.length > 0 && !ONLY.some((s) => file === s || file.endsWith(`/${s}`))) continue
        const src = linesOf(file)
        const from = Number(m[2])
        const to = Number(m[3] ?? m[2])
        if (from < 1 || to > src.length - 1 || from > to) {
          console.log(`✗ ${md}:${idx + 1} 引用 ${m[0]} —— ${file} 只有 ${src.length - 1} 行`)
          hard += 1
          continue
        }
        // 严格取引用区间：多取一行就会把「整体偏移一行」这种真漂移全遮掉（踩过）
        const body = src.slice(from - 1, to).join('\n')
        const syms = [...line.matchAll(SYMBOL)]
          .map((s) => s[1])
          .filter((s) => !/^(vue|ts|json|md)$/.test(s))
        if (syms.length === 0) continue
        if (syms.some((s) => body.includes(s))) continue
        suspect += 1
        const named = syms.find((s) => src.some((t) => t.includes(s)))
        const at = named ? findDecl(file, named) : -1
        const hint =
          at > 0
            ? `，建议 ${file.split('/').pop()}:${at}`
            : at < -1
              ? `（${named} 出现 ${-at} 次，无法自动定位）`
              : ''
        console.log(
          `⚠ ${md}:${idx + 1} 引用 ${m[0]} 里没有 ${named ? `\`${named}\`` : '该行点名的符号'}${hint}`
        )
        console.log(`   src: ${src[from - 1].trim().slice(0, 96) || '(空行)'}`)
        console.log(`   md : ${line.trim().slice(0, 120)}`)
      }
    })
}

console.log(
  `\n对账 ${checked} 条引用：${hard} 条硬错误，${suspect} 条疑似漂移（符号不在引用范围内，需人工确认）。`
)
process.exit(hard > 0 ? 1 : 0)
