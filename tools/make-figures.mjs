#!/usr/bin/env node
/**
 * 生成 README 用的**设计图示**（示意图，不是界面截图）。
 *
 *   node tools/make-figures.mjs [输出目录]        # 默认 docs/figures
 *
 * 两个要点：
 *   1  所有颜色与几何都**从 src/ 求值取得**，不手抄。做法与 tools/check.mjs 相同：
 *      把 10 个片段拼进同一个作用域求值，拿到 PAL_SURFACE / PAL_TEXT / PAL_ACCENT /
 *      MOON_litPath / ART_background… 所以图不可能与代码脱节。
 *   2  底纹类图直接把 `ART_background()` 返回的 **CSS background 简写**贴进页面，
 *      由浏览器渲染 —— 图里那层斜切网格就是构建产物里的那一串，不是重画的近似品。
 *
 * 输出 PNG：无头 Edge 渲染，deviceScaleFactor=2。
 */
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUTDIR = process.argv[2] || join(ROOT, 'docs', 'figures')
const EDGE =
  process.env.MIYABI_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9250
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/* ── 1. 与 check.mjs 相同的沙箱求值 ─────────────────────────────────────── */
const srcFiles = readdirSync(join(ROOT, 'src'))
  .filter((n) => n.endsWith('.js'))
  .sort()
const body = srcFiles.map((n) => read(join('src', n))).join('\n\n')
const exposed = [
  'PAL_SURFACE',
  'PAL_TEXT',
  'PAL_ACCENT',
  'MOON_litPath',
  'ART_background',
  'ART_tape',
  'ART_noise',
  'ART_flakeArm',
  'ART_FLAKE_ARMS',
  'CFG_DEFAULTS',
]
const factory = new Function(
  'window',
  'document',
  'console',
  'URL',
  'exports',
  body + `\n;return { ${exposed.join(', ')} };`,
)
const M = factory(
  { innerWidth: 1440, innerHeight: 900, localStorage: { getItem: () => null }, matchMedia: () => ({ matches: false }) },
  { createElement: () => null },
  console,
  { createObjectURL: () => '', revokeObjectURL: () => {} },
  {},
)
const EMBLEM = JSON.parse(read('assets/emblem.json'))
const D = M.CFG_DEFAULTS
console.log(
  `已求值取得真实取值（${srcFiles.length} 段）；烈霜轮廓 ${EMBLEM.meta.contours} 环 / ${EMBLEM.meta.points} 顶点 / IoU ${EMBLEM.meta.iou}`,
)

/* ── 2. 取色与画布 ─────────────────────────────────────────────────────── */
const A = M.PAL_ACCENT.dark
const TXT = M.PAL_TEXT.dark
const SURF = M.PAL_SURFACE.dark
/** 令牌层里那个「应用底」的实际观感：直接把深紫黑当画布底。 */
const CANVAS = `rgb(${SURF.base[0].join(',')})`

/** 表面元组是 [rgb, alpha] 或 [rgb, alpha, 下限]，两种都要当成颜色处理。 */
const isSurfaceTuple = (v) => Array.isArray(v) && Array.isArray(v[0]) && typeof v[1] === 'number'
const css = (v) => {
  if (typeof v === 'string') return v
  if (isSurfaceTuple(v)) return `rgba(${v[0].join(',')},${v[1]})`
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number')) {
    return `rgb(${v.join(',')})`
  }
  // alpha 阶梯之类的非颜色数组：用斜纹表示「不是色块」
  return 'repeating-linear-gradient(45deg,rgba(255,255,255,.14) 0 5px,rgba(255,255,255,.03) 5px 10px)'
}
const label = (v) => {
  if (typeof v === 'string') return v
  if (isSurfaceTuple(v)) {
    return `rgba(${v[0].join(',')}, ${v[1]})` + (v[2] === undefined ? '' : ` ↓${v[2]}`)
  }
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number')) return `rgb(${v.join(',')})`
  return JSON.stringify(v)
}

const SHELL = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  /* 平底色：大面积平滑渐变会让 PNG 体积暴涨（一张配色板能到 1.3MB），
     换成单一底色后同样的内容只要几分之一。 */
  body{
    width:var(--w);font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif;
    color:${TXT.txt};padding:32px 36px 46px;position:relative;background:#08080f;
  }
  h1{font-size:21px;font-weight:600;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
  h1 span{font-size:12px;font-weight:400;color:${TXT.txt3};letter-spacing:.08em}
  h2{font-size:11.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${A.a1};
     margin:26px 0 12px;display:flex;align-items:center;gap:10px}
  h2::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(143,217,255,.34),transparent)}
  .note{font-size:11.5px;line-height:1.75;color:${TXT.txt3};margin-top:8px;max-width:96%}
  .note b{color:${TXT.txt2}}
  .mono{font-family:Consolas,"Cascadia Mono",monospace}
  .rule{height:3px;margin:16px 0 0;background:repeating-linear-gradient(45deg,
        rgba(230,196,121,.85) 0 7px, rgba(10,10,20,.9) 7px 14px)}
  .foot{margin-top:34px;display:flex;justify-content:space-between;
        font-size:10px;letter-spacing:.16em;color:${TXT.cap};text-transform:uppercase}
</style></head><body>`

const FOOT = `<div class="foot"><span>dsh-theme-miyabi · docs/figures</span><span>tools/make-figures.mjs 生成</span></div></body></html>`

/* ── 3. 图一：配色板 ───────────────────────────────────────────────────── */
function figPalette() {
  const groups = (scheme) => [
    ['表面 · 面板底（带设计 alpha；棋盘格用来显通透度）', Object.entries(M.PAL_SURFACE[scheme]), true],
    ['文字与线条', Object.entries(M.PAL_TEXT[scheme]), false],
    ['强调色（霜蓝为主 · 冷紫为次 · 金作细线 · 猩红只给危险态）', Object.entries(M.PAL_ACCENT[scheme]), false],
  ]
  /* 浅色棋盘格垫在下面：深色低 alpha 的表面在深底上会看不出通透度，
     垫一层亮格才看得出「它其实是半透明的」。 */
  const chip = (name, value, surface) =>
    `<figure class="chip"><div class="sw${surface ? ' check' : ''}"><i style="background:${css(value)}"></i></div>
      <figcaption><b>${name}</b><em class="mono">${label(value)}</em></figcaption></figure>`
  const schemeBlock = (scheme, title, sub) =>
    `<h1 style="margin-top:34px">${title}<span>${sub}</span></h1>` +
    groups(scheme)
      .map(
        ([gname, entries, surface]) =>
          `<h2>${gname}</h2><div class="chips">${entries.map(([k, v]) => chip(k, v, surface)).join('')}</div>`,
      )
      .join('')
  return `${SHELL}
  <h1>霜月雅刃 · 配色板<span>设计基线（强度 100 ／ 界面不透明度 100）</span></h1>
  <p class="note">下表是 <span class="mono">src/30-palette.js</span> 的原始设计值，由本工具在沙箱里<b>求值取得</b>，不是抄写。
  上线时这几十个设计色会展开成 <b>116 个 <span class="mono">--dsw-*</span> 令牌</b>，再按「强度」与「界面不透明度」两个系数
  换算成最终 rgba；每个令牌都同时给浅深两档，所以宿主切浅色不会串成不可读的配色。
  斜纹块表示那一条不是色值（例如描边透明度阶梯 <span class="mono">lineA</span>）。</p>
  <div class="rule"></div>
  ${schemeBlock('dark', '夜档', '夜色 · 霜月')}
  ${schemeBlock('light', '昼档', '浅色 · 白霜')}
  ${FOOT}`
}

/* ── 4. 图二：层叠结构 ─────────────────────────────────────────────────── */
function figLayers() {
  const bands = [
    ['z 3', '挂件层', A.a1, [
      ['shell.overlay', '氛围浮层（烈霜粒子）+ 可拖动的快速控制条'],
      ['settings.section', '「霜月雅刃」控制页 · order 30'],
      ['settings.general.item', '通用设置里的速切行 · order 12'],
    ]],
    ['z 2', '身份层', A.a2, [
      ['自有元素', 'CRT 扫描线 · 录像带噪点 · 暗角与色散 · 信号故障'],
      ['HUD', '四角括号 · 顶部警示条 · 虚狩 ／ 霜月雅刃 ／ 第6課 · H.S.O.S.6'],
      ['作用域', '整张样式表没有一条规则不以 html[data-miyabi-skin] 或 .miyabi- 开头'],
    ]],
    ['z 1', '令牌层', A.gold, [
      ['注册与切换', 'ctx.theme.register() → setTheme() → overrideTokens()'],
      ['116 个令牌', '--dsw-alias-bg-base ／ -layer-1..3 ／ specific-sidebar-fill ／ markdown-* …'],
      ['扩展点约定', '宿主元素只吃设计令牌 —— 不给它挂任何伪元素'],
    ]],
    ['z 0.5', '立绘层', A.ok, [
      ['html::after', '使用者提供的图，位置四选一：无 ／ 贴左 ／ 贴右 ／ 右水印'],
      ['羽化', '以落点为中心做径向羽化，让图化进背景而不是切一条硬边'],
    ]],
    ['z 0', '壁纸层', TXT.txt3, [
      ['html::before', '斜切网格（115° ／ 25°）+ 两团强调色辉光 + 纵向深紫黑底 + 一道金线'],
      ['来源', '程序生成的 CSS 渐变与手写 SVG，不含位图、随 MIT 分发'],
    ]],
  ]
  const band = ([z, title, color, rows]) => `<section class="band">
      <div class="ztag mono" style="color:${color};border-color:${color}">${z}</div>
      <div class="bmain"><h3 style="color:${color}">${title}</h3>
        ${rows.map(([k, v]) => `<p><b>${k}</b><span>${v}</span></p>`).join('')}
      </div></section>`
  return `${SHELL}
  <h1>霜月雅刃 · 层叠结构<span>谁画在哪一层，以及归谁管</span></h1>
  <p class="note">所有装饰都长在<b>插件自己的元素</b>上；宿主元素只吃设计令牌（令牌是宿主承诺的扩展点）。
  壁纸层与身份层都是 <span class="mono">pointer-events: none</span>，不挡任何点击。</p>
  <div class="rule"></div>
  <div class="stack">${bands.map(band).join('')}</div>
  <p class="note">卸载时按逆序还原：解除订阅 → 清定时器 → <b>把外观偏好还给宿主原档</b> → 卸覆写层 →
  注销主题 → 删样式表 → 摘属性 → 清掉自己写的 <span class="mono">--sym-*</span> 变量。</p>
  ${FOOT}`
}

/* ── 5. 图三：烈霜轮廓与八档月相 ───────────────────────────────────────── */
function figGlyphs() {
  const flake = (size, color) =>
    `<svg width="${size}" height="${size}" viewBox="${EMBLEM.viewBox}"><path d="${EMBLEM.path}" fill="${color}" fill-rule="${EMBLEM.fillRule}"/></svg>`
  const moons = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]
    .map((p) => {
      const d = M.MOON_litPath(p, 22)
      return `<figure class="moon"><svg width="86" height="86" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="22" fill="rgba(143,217,255,.12)" stroke="rgba(143,217,255,.38)" stroke-width="1"/>
        <g transform="translate(32 32)"><path d="${d}" fill="${A.a1s}"/></g></svg>
        <figcaption class="mono">${p.toFixed(3)}</figcaption></figure>`
    })
    .join('')
  const arms = M.ART_FLAKE_ARMS.map(
    (a) => `<path d="${M.ART_flakeArm(a.h)}" transform="translate(32 32) rotate(${a.angle})"/>`,
  ).join('')
  return `${SHELL}
  <h1>霜月雅刃 · 图形元素<span>烈霜轮廓 · 真实月相</span></h1>
  <h2>烈霜（雪花图样）</h2>
  <p class="note">形状由 <span class="mono">tools/trace-emblem.mjs</span> 从使用者提供的位图<b>矢量化</b>而来：
  ${EMBLEM.meta.contours} 条闭合环（含孔洞）／ ${EMBLEM.meta.points} 顶点 ／ 回栅格 IoU <b>${EMBLEM.meta.iou}</b>。
  路径里<b>没有任何颜色</b> —— 颜色在渲染时给：粒子是白，控制条按钮走 <span class="mono">currentColor</span>。
  下面用同一份路径画四个尺寸，最小的 14px 就是控制条上那一枚。</p>
  <div class="sizes">
    ${[[188, '#ffffff'], [92, '#ffffff'], [34, A.a1], [14, A.a1s]]
      .map(([s, c]) => `<figure class="sz">${flake(s, c)}<figcaption class="mono">${s}px</figcaption></figure>`)
      .join('')}
    <figure class="sz" style="margin-left:auto">
      <svg width="46" height="46" viewBox="0 0 64 64"><g fill="${TXT.txt3}">${arms}</g></svg>
      <figcaption>徽记缺失时的兜底</figcaption>
    </figure>
  </div>
  <h2>月相（八档）</h2>
  <p class="note">按平均朔望月从 2000-01-06 18:14 UTC 那次朔推算；受光形状用半短轴为
  <span class="mono">|cos 2πp| · R</span> 的椭圆画出来，所以朔与望都退化成正确的形状。
  下面八张是 <span class="mono">MOON_litPath(相位, 半径)</span> 的真实输出。</p>
  <div class="moons">${moons}</div>
  ${FOOT}`
}

/* ── 6. 图四：底纹与身份层元素（直接用生产代码的 CSS 输出） ─────────────── */
function figPattern() {
  const backdrop = (intensity) => M.ART_background({ ...D, intensity }, 'dark')
  const notes = { 0: '只换配色，网格消失', 50: '', 78: '出厂默认', 100: '完整氛围' }
  const tiles = [0, 50, 78, 100]
    .map(
      (i) => `<figure class="bg"><div style="background:${backdrop(i)}"></div>
        <figcaption><b>强度 ${i}</b><em>${notes[i]}</em></figcaption></figure>`,
    )
    .join('')
  return `${SHELL}
  <h1>霜月雅刃 · 底纹与身份层元素<span>图里就是构建产物里的那串 CSS</span></h1>
  <p class="note">下面这些不是重画的近似品：底纹用 <span class="mono">ART_background()</span>、
  颗粒用 <span class="mono">ART_noise()</span>、警示条用 <span class="mono">ART_tape()</span>
  的真实返回值渲染。改一个系数，这张图跟着变。</p>
  <h2>壁纸层底纹（斜切网格 + 强调色辉光 + 金线）与强度档位</h2>
  <div class="bgs">${tiles}</div>
  <h2>身份层零件</h2>
  <div class="parts">
    <figure class="part"><div class="scan"></div>
      <figcaption><b>CRT 扫描线</b><em>3px 周期一根暗线，慢扫亮带 9.5s 一次</em></figcaption></figure>
    <figure class="part"><div class="noise"><i style="background-image:${M.ART_noise()}"></i></div>
      <figcaption><b>录像带噪点</b><em>feTurbulence 生成，steps(4) 位移闪烁</em></figcaption></figure>
    <figure class="part"><div style="background:${M.ART_tape(A.a1, 10)}"></div>
      <figcaption><b>警示条</b><em>45° 斜条，HUD 顶部 3px</em></figcaption></figure>
    <figure class="part"><div class="corner"><i></i></div>
      <figcaption><b>HUD 角括号</b><em>1px 强调色，四角各一，作用于角落 34×34</em></figcaption></figure>
    <figure class="part"><div class="tape2"></div>
      <figcaption><b>故障层</b><em>7.3s 周期内错位几毫秒，只在动效=完整时生效</em></figcaption></figure>
  </div>
  ${FOOT}`
}

const EXTRA = `<style>
  .chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:10px}
  .chip{background:rgba(12,12,24,.62);border:1px solid rgba(150,190,255,.16);border-radius:3px;padding:9px}
  .chip .sw{height:38px;border-radius:2px;border:1px solid rgba(255,255,255,.10);position:relative;overflow:hidden}
  .chip .sw i{position:absolute;inset:0;display:block}
  .chip .sw.check{background:repeating-conic-gradient(#c9d2e2 0% 25%, #8e98ac 0% 50%) 50%/13px 13px}
  .chip figcaption{margin-top:7px;display:flex;flex-direction:column;gap:2px}
  .chip b{font-size:11.5px;font-weight:600}
  .chip em{font-size:9.5px;font-style:normal;color:${TXT.txt3};word-break:normal;overflow-wrap:break-word}
  .stack{display:flex;flex-direction:column;gap:9px}
  .band{display:flex;gap:14px;background:rgba(12,12,24,.55);border:1px solid rgba(150,190,255,.14);
        border-radius:3px;padding:12px 15px}
  .ztag{flex:0 0 48px;display:grid;place-items:center;font-size:10.5px;border:1px solid;border-radius:2px}
  .bmain{flex:1}
  .bmain h3{font-size:14px;font-weight:600;margin-bottom:6px}
  .bmain p{display:flex;gap:10px;font-size:11.5px;line-height:1.65;color:${TXT.txt3}}
  .bmain p b{flex:0 0 166px;color:${TXT.txt2};font-weight:500}
  .sizes{display:flex;align-items:flex-end;gap:40px;padding:14px 4px 2px}
  .sz{display:flex;flex-direction:column;align-items:center;gap:9px}
  .sz figcaption{font-size:10px;color:${TXT.txt3}}
  .moons{display:flex;gap:14px;flex-wrap:wrap;padding:6px 0 2px}
  .moon{display:flex;flex-direction:column;align-items:center;gap:6px}
  .moon figcaption{font-size:10px;color:${TXT.txt3}}
  .bgs{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .bg>div{height:118px;border:1px solid rgba(150,190,255,.18);border-radius:3px}
  .bg figcaption{margin-top:7px;display:flex;flex-direction:column;gap:2px}
  .bg b{font-size:11.5px}
  .bg em{font-size:10px;font-style:normal;color:${TXT.txt3};min-height:14px}
  .parts{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
  .part>div{height:118px;border:1px solid rgba(150,190,255,.18);border-radius:3px;overflow:hidden}
  .part figcaption{margin-top:7px;display:flex;flex-direction:column;gap:2px}
  .part b{font-size:11.5px}
  .part em{font-size:10px;font-style:normal;color:${TXT.txt3};line-height:1.5}
  .scan{background:repeating-linear-gradient(180deg,rgba(0,0,0,.55) 0 1px,transparent 1px 3px),rgb(${SURF.l2[0].join(',')})}
  .corner{position:relative;background:rgba(10,10,22,.75)}
  .corner i{position:absolute;left:10px;bottom:10px;width:34px;height:34px;
            border-left:1px solid ${A.a1};border-bottom:1px solid ${A.a1}}
  .tape2{background:linear-gradient(90deg,transparent 0 34%,rgba(143,217,255,.55) 34% 35%,transparent 35% 100%),
         linear-gradient(90deg,transparent 0 61%,rgba(255,95,112,.5) 61% 62%,transparent 62% 100%),
         rgb(${SURF.code[0].join(',')})}
  /* 噪点本身是低对比的灰噪声，垫一层中间调才看得出来 */
  .noise{position:relative;background:#39415a}
  .noise i{position:absolute;inset:0;background-size:180px 180px;opacity:.9;mix-blend-mode:screen}
</style>`

/* ── 7. 渲染 ───────────────────────────────────────────────────────────── */
if (!existsSync(EDGE)) {
  console.error('找不到 Edge：' + EDGE + '\n可用 MIYABI_EDGE 指定。')
  process.exit(2)
}
rmSync(OUTDIR, { recursive: true, force: true })
mkdirSync(OUTDIR, { recursive: true })
const WORK = join(tmpdir(), 'dsh-miyabi-figures')
rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })

const child = spawn(
  EDGE,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
   '--no-default-browser-check', '--disable-extensions', '--force-device-scale-factor=1',
   '--remote-debugging-port=' + PORT, '--user-data-dir=' + join(WORK, 'profile'),
   '--window-size=1400,900', 'about:blank'],
  { detached: true, stdio: 'ignore' },
)
child.unref()

async function pageSocket() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (p) return p.webSocketDebuggerUrl
    } catch {
      /* 等 */
    }
    await sleep(400)
  }
  throw new Error('CDP 端口没就绪')
}
const ws = new WebSocket(await pageSocket())
const pending = new Map()
let id = 1
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id)
    pending.delete(m.id)
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = id++
    pending.set(n, { resolve, reject })
    ws.send(JSON.stringify({ id: n, method, params }))
    setTimeout(() => {
      if (pending.has(n)) {
        pending.delete(n)
        reject(new Error(method + ' 超时'))
      }
    }, 30_000)
  })
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true })
  ws.addEventListener('error', () => rej(new Error('调试端口连不上')), { once: true })
})
await send('Page.enable')
await send('Runtime.enable')

async function render(name, html, width) {
  const file = join(WORK, name + '.html')
  writeFileSync(file, html.replace('var(--w)', width + 'px').replace('</head>', EXTRA + '</head>'))
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 2, mobile: false })
  await send('Page.navigate', { url: 'file:///' + file.split('\\').join('/') })
  await sleep(1000)
  /* 用 body 的 border-box 高度当真内容高度：scrollHeight 至少等于视口高，
     会把 900px 的视口当成内容，图底部就留一大片空白。 */
  const measured = await send('Runtime.evaluate', {
    expression: 'Math.ceil(document.body.getBoundingClientRect().height) + 2',
    returnByValue: true,
  })
  const height = Math.max(260, Math.min(5000, Number(measured.result.value) || 900))
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false })
  await sleep(400)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const buf = Buffer.from(shot.data, 'base64')
  writeFileSync(join(OUTDIR, name + '.png'), buf)
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  console.log(
    `  ✔ ${name}.png  ${w}×${h} 设备像素（${(w / 2) | 0}×${(h / 2) | 0} CSS px，${(buf.length / 1024) | 0} KB）`,
  )
}

console.log('渲染图示：')
await render('fig-palette', figPalette(), 1180)
await render('fig-layers', figLayers(), 1040)
await render('fig-glyphs', figGlyphs(), 1040)
await render('fig-pattern', figPattern(), 1180)

try {
  await send('Browser.close')
} catch {
  /* 兜底 */
}
await sleep(600)
try {
  spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
} catch {
  /* 已退出 */
}
try {
  rmSync(WORK, { recursive: true, force: true })
} catch {
  /* 临时目录，删不掉无妨 */
}
console.log('\n已写入 ' + OUTDIR)
process.exit(0)
