#!/usr/bin/env node
/**
 * 零依赖构建：src/*.js + assets/* → client.js
 *
 *   node tools/build.mjs
 *
 * 做四件事：
 *   1. 按文件名顺序读 src/*.js —— 它们共享同一个工厂作用域，所以只允许
 *      const / function 声明，出现 import / export 直接报错。
 *   2. 把 assets/ 里的图片转成 data URI，替换 src/45-assets.js 里的两个注入点。
 *      （客户端模块表不能 require 资源模块，data URI 是唯一两端都成立的形态。）
 *   3. 用 __ModuleLoader__.load 包成 DSH 浏览器 bundle，产物是 client.js。
 *   4. 用 new Function 做纯编译级语法检查，并打印体积明细。
 *
 * 不写临时文件、不启子进程、不依赖任何 npm 包；产物直接可安装。
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const srcDir = join(root, 'src')
const assetsDir = join(root, 'assets')
const outFile = join(root, 'client.js')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** 图片后缀 → MIME。 */
const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}
/** 素材键名里允许的字符，避免注入出来的 JS 属性名出问题。 */
const KEY_OK = /^[a-z0-9][a-z0-9._-]*$/

const kb = (n) => (n / 1024).toFixed(1) + ' KB'

/* ── 1. 读源片段 ─────────────────────────────────────────────────────────── */
if (!existsSync(srcDir)) throw new Error('缺少 src/ 目录')
const files = readdirSync(srcDir)
  .filter((name) => name.endsWith('.js'))
  .sort()
if (!files.length) throw new Error('src/ 里没有 .js 片段')

const parts = []
for (const name of files) {
  const text = readFileSync(join(srcDir, name), 'utf8')
  const bad = text.match(/^[ \t]*(import|export)\b/m)
  if (bad) {
    throw new Error(
      `${name}: src 片段不允许 ${bad[1]} —— 所有片段共享同一个工厂作用域，` +
        '请用 const / function 声明，导出统一写在 90-apply.js',
    )
  }
  parts.push({ name, text: text.replace(/\s+$/, '') })
}

/* ── 2. 内嵌素材 ─────────────────────────────────────────────────────────── */
const assets = {}
const assetRows = []
if (existsSync(assetsDir)) {
  for (const name of readdirSync(assetsDir).sort()) {
    const dot = name.lastIndexOf('.')
    if (dot <= 0) continue
    const ext = name.slice(dot + 1).toLowerCase()
    const mime = MIME[ext]
    if (!mime) continue
    const key = name.slice(0, dot).toLowerCase()
    if (!KEY_OK.test(key)) {
      throw new Error(`assets/${name}: 键名 ${key} 只能用小写字母、数字、点、下划线和连字符`)
    }
    const bytes = readFileSync(join(assetsDir, name))
    const dataUri = `data:${mime};base64,${bytes.toString('base64')}`
    assets[key] = dataUri
    assetRows.push({ key, file: name, bytes: bytes.length, encoded: dataUri.length })
  }
}
const metaPath = join(assetsDir, 'art.json')
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {}
/* 徽记轮廓：由 tools/trace-emblem.mjs 从位图矢量化而来，路径不含颜色。 */
const emblemPath = join(assetsDir, 'emblem.json')
const emblem = existsSync(emblemPath) ? JSON.parse(readFileSync(emblemPath, 'utf8')) : {}

/* ── 3. 组装 bundle ──────────────────────────────────────────────────────── */
let body = parts.map((p) => p.text).join('\n\n')

/** 替换注入点；找不到注入点说明源文件被改坏了，直接报错而不是静默产出坏包。 */
function inject(marker, literal, what) {
  const token = `/* ${marker} */ {}`
  if (body.indexOf(token) < 0) throw new Error(`注入点 ${token} 不存在（src/45-assets.js 被改动过？）`)
  body = body.replace(token, `/* ${marker} */ ${literal}`)
  void what
}
inject('@sym-assets', JSON.stringify(assets))
inject('@sym-asset-meta', JSON.stringify(meta))
inject('@sym-emblem', JSON.stringify(emblem))

const banner = [
  '/*!',
  ` * ${pkg.name} ${pkg.version} —— ${pkg.description || ''}`,
  ' *',
  ' * 自动生成，请勿直接编辑：源码在 src/*.js，改完跑 node tools/build.mjs。',
  ` * 源片段：${parts.map((p) => p.name).join(' → ')}`,
  assetRows.length
    ? ` * 内嵌素材：${assetRows.map((a) => `${a.file}(${kb(a.bytes)})`).join('、')}`
    : ' * 内嵌素材：无（仅使用程序生成的自制 SVG 与 CSS 渐变）',
  emblem.path
    ? ` * 徽记轮廓：${emblem.meta.contours} 条闭合环 / ${emblem.meta.points} 顶点 / IoU ${emblem.meta.iou}（矢量化自 ${emblem.meta.source}，路径不含颜色）`
    : ' * 徽记轮廓：无（霜星退回内置手绘花瓣）',
  ' */',
].join('\n')

const output =
  banner +
  '\n' +
  'window.__ModuleLoader__.load({\n' +
  `  id: ${JSON.stringify(pkg.name)},\n` +
  '  factory(require) {\n' +
  '    // 模块表按 CJS 语义包装工厂：exports 必须先声明，否则运行时会报\n' +
  "    // \"exports is not defined\" 并让整行激活失败。\n" +
  '    const module = { exports: {} }\n' +
  '    const exports = module.exports\n' +
  '    const React = require("react")\n' +
  '    const h = React.createElement\n\n' +
  body
    .split('\n')
    .map((line) => (line.length ? '    ' + line : line))
    .join('\n') +
  '\n\n    return module.exports\n' +
  '  },\n' +
  '})\n'

/* ── 4. 语法检查（只编译，不执行） ───────────────────────────────────────── */
try {
  // eslint-disable-next-line no-new-func
  new Function(output)
} catch (err) {
  throw new Error(`生成物语法错误：${err.message}`)
}

writeFileSync(outFile, output)

/* ── 5. 报告 ─────────────────────────────────────────────────────────────── */
const total = statSync(outFile).size
console.log(`dsh-theme-miyabi 构建完成 → client.js  ${kb(total)}`)
for (const part of parts) {
  console.log(`  · src/${part.name.padEnd(20)} ${kb(Buffer.byteLength(part.text)).padStart(9)}`)
}
for (const asset of assetRows) {
  console.log(`  · assets/${asset.file.padEnd(17)} ${kb(asset.bytes).padStart(9)} → 内嵌 ${kb(asset.encoded)}`)
}
if (!assetRows.length) console.log('  · 无内嵌素材：立绘退回自制 SVG 月徽')
const biggest = 512 * 1024
if (total > 2 * 1024 * 1024) {
  console.log(`  ! 产物超过 2 MB，建议压缩 assets/ 里的图片`)
} else if (total > biggest) {
  console.log(`  · 提示：产物 ${kb(total)}，主要是内嵌图片；如不需要可清空 assets/ 重新构建`)
}
