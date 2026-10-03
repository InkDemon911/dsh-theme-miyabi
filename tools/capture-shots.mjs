#!/usr/bin/env node
/**
 * 给 README 抓示例图：无头 Edge + DevTools 协议。
 *
 *   node tools/capture-shots.mjs [输出目录]        # 默认 docs/screenshots
 *
 * 这是**本机开发工具**，不参与 CI：它需要一个正在运行的 Harness（默认
 * http://127.0.0.1:3080）和本机的 Edge。之所以不用 `--screenshot` 那个开关：
 * 新版 Edge/Chrome 的 `--headless=new` 已经不支持它，而且走 CDP 还能顺带
 * 在页面里读回计算值（令牌实际生效值、HUD 节点数、霜点数量），
 * 把「看起来对了」变成「量出来对了」。
 *
 * 两点刻意做法：
 *   · 用独立的 user-data-dir，不碰使用者在用的浏览器；localStorage 干净，
 *     所以抓到的就是**出厂默认**的样子
 *   · 主图裁掉左侧栏（x < 268）—— 那里是使用者的会话列表，不该进公开仓库；
 *     需要完整窗口时自己改 CLIP_MAIN
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUTDIR = process.argv[2] || join(ROOT, 'docs', 'screenshots')
const EDGE =
  process.env.MIYABI_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const APP = process.env.MIYABI_APP || 'http://127.0.0.1:3080/'
const PORT = 9240
const W = 1440
const H = 900
/** 左侧栏宽度：主图从这条线右边开始截，避开会话列表。 */
const CLIP_MAIN = { x: 268, y: 0, width: W - 268, height: H }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
if (!existsSync(EDGE)) {
  console.error('找不到 Edge：' + EDGE + '\n可用 MIYABI_EDGE 环境变量指定。')
  process.exit(2)
}
rmSync(OUTDIR, { recursive: true, force: true })
mkdirSync(OUTDIR, { recursive: true })
/* 浏览器 profile 放系统临时目录：放仓库里会污染工作区，而且 Edge 退出前
   缓存文件还锁着，删不掉会报 EBUSY。 */
const PROFILE = join(tmpdir(), 'dsh-miyabi-shots-profile')
try {
  rmSync(PROFILE, { recursive: true, force: true })
} catch {
  /* 上次残留且被占用，换个目录名继续 */
}
mkdirSync(PROFILE, { recursive: true })

const child = spawn(
  EDGE,
  [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--force-device-scale-factor=1',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
    `--window-size=${W},${H}`, 'about:blank',
  ],
  { detached: true, stdio: 'ignore' },
)
child.unref()

/** 等调试端口就绪。 */
async function pageSocket() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* 还没起来 */
    }
    await sleep(400)
  }
  throw new Error('CDP 端口 30 秒内没就绪')
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

/** 在页面里求值；异常要带回来，别静默成 undefined。 */
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) {
    throw new Error('页面求值异常: ' + JSON.stringify(r.exceptionDetails.exception?.description))
  }
  return r.result.value
}
/** 截图落盘。 */
async function shoot(name, clip) {
  const params = { format: 'jpeg', quality: 90 }
  if (clip) params.clip = { ...clip, scale: clip.scale || 1 }
  const r = await send('Page.captureScreenshot', params)
  writeFileSync(join(OUTDIR, name), Buffer.from(r.data, 'base64'))
  console.log('  ✔ ' + name)
}
/** 真实鼠标点击（合成 .click() 有些宿主控件接不住）。 */
async function mouseClick(x, y) {
  const b = { x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...b })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...b })
  await sleep(60)
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...b })
}
/** 取一个元素的中心坐标。 */
const centerOf = (js) =>
  evaluate(`(() => {
    const el = ${js}
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: APP })
console.log('等界面稳定 …')
await sleep(9500)

console.log('抓图：')
await shoot('01-main.jpg', CLIP_MAIN)
await shoot('02-control-bar.jpg', { x: 1075, y: 826, width: 365, height: 74, scale: 3 })
await shoot('03-crt-detail.jpg', { x: 1075, y: 0, width: 365, height: 300, scale: 3 })

/* 设置页：侧栏左下角的「设置」，再点导轨里的「霜月雅刃」 */
const settingsBtn = await centerOf(`[...document.querySelectorAll('button,[role="button"],a')]
  .filter((e) => e.offsetParent !== null && (e.textContent || '').trim() === '设置')
  .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0]`)
if (settingsBtn) {
  await mouseClick(settingsBtn.x, settingsBtn.y)
  await sleep(3000)
}
if (await evaluate(`document.body.innerText.includes('通用设置')`)) {
  await shoot('04-settings-general.jpg')
  const rail = await centerOf(`[...document.querySelectorAll('button,a,[role="button"],li,div,span')]
    .filter((e) => e.offsetParent !== null && (e.textContent || '').trim() === '霜月雅刃')
    .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0]`)
  if (rail) {
    await mouseClick(rail.x, rail.y)
    await sleep(3500)
  }
  const mine = await evaluate(`(() => {
    const t = document.body.innerText
    return t.includes('界面不透明度') || t.includes('立绘位置')
  })()`)
  if (mine) await shoot('05-settings-miyabi.jpg')
  else console.log('  ! 没进到皮肤设置页（宿主 UI 变了？）')
} else {
  console.log('  ! 没打开设置页（宿主 UI 变了？）')
}

/* 运行时证据：令牌在页面里算出来的实际值 */
console.log('\n== 运行时证据（页面内计算值）==')
console.log(
  JSON.stringify(
    await evaluate(`(() => {
      const de = document.documentElement
      const cs = getComputedStyle(document.body)
      const pick = (n) => cs.getPropertyValue(n).trim()
      return {
        skinAttr: de.getAttribute('data-miyabi-skin'),
        scheme: de.getAttribute('data-miyabi-scheme'),
        motion: de.getAttribute('data-miyabi-motion'),
        styleTags: document.querySelectorAll('style[data-miyabi-skin]').length,
        bgBase: pick('--dsw-alias-bg-base'),
        overlay: pick('--dsw-alias-bg-overlay'),
        codeBlock: pick('--dsw-alias-markdown-code-block'),
        sidebar: pick('--dsw-specific-sidebar-fill'),
        hudLabels: document.querySelectorAll('.miyabi-hud-label').length,
        hudBottomLeft: (document.querySelector('.miyabi-hud-label.is-bl') || {}).textContent,
        particles: document.querySelectorAll('.miyabi-particle').length,
      }
    })()`),
    null,
    2,
  ),
)

try {
  await send('Browser.close')
} catch {
  /* 下面兜底 */
}
await sleep(500)
try {
  spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
} catch {
  /* 已退出 */
}
/* 尽力而为：Edge 刚退出时缓存文件可能还锁着，删不掉不影响结果 */
try {
  rmSync(PROFILE, { recursive: true, force: true })
} catch {
  /* 留着也无妨，在系统临时目录里 */
}
console.log('\n已写入 ' + OUTDIR)
process.exit(0)
