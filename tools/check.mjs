#!/usr/bin/env node
/**
 * 零依赖自检：node tools/check.mjs
 *
 * 检查的是"改配置会不会把界面改坏"，而不是"代码看起来对不对"：
 *   1  清单：package.json / exports / dsh.client / cordis.patch.yml / icon / locale
 *   2  产物：client.js 里的模块 id、require 白名单、__ModuleLoader__ 形态
 *   3  求值：src 片段能拼起来求值，exports 形态正确
 *   4  令牌：所有键都在宿主真实存在的 --dsw-* 名单里，且浅深两档都有值
 *   5  对比度：把半透明面板合成到背景两端色上，逐对算 WCAG
 *   6  壁纸：面板 alpha 必须给壁纸留出可见度（曾把壁纸压没的那个缺陷的守卫）
 *   7  作用域：身份层每条选择器都必须落在 html[data-miyabi-skin] 或 .miyabi- 下
 *   8  收敛：已删除的模块不得复活（声音、多模式、多底纹、多立绘来源）
 *   9  用语 / 配置 / 图形
 *
 * 退出码：0 全部通过；1 有失败项。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (rel) => readFileSync(join(root, rel), 'utf8')
const has = (rel) => existsSync(join(root, rel))

const results = []
const pass = (group, msg) => results.push({ ok: true, group, msg })
const fail = (group, msg, detail) =>
  results.push({ ok: false, group, msg: detail ? `${msg} —— ${detail}` : msg })

/** 断言。 */
function ok(group, cond, msg, detail) {
  if (cond) pass(group, msg)
  else fail(group, msg, detail)
  return Boolean(cond)
}

/* ═══ 1. 清单 ═════════════════════════════════════════════════════════════ */
const pkg = JSON.parse(read('package.json'))
ok('清单', pkg.name === 'dsh-theme-miyabi', 'package.json name')
ok('清单', pkg.type === 'module', 'type: module')
ok('清单', Boolean(pkg.exports && pkg.exports['./client']), 'exports["./client"] 已声明')
ok(
  '清单',
  Boolean(pkg.exports && pkg.exports['./client'] && has(pkg.exports['./client'].replace(/^\.\//, ''))),
  'exports["./client"] 指向的文件存在',
)
ok('清单', Boolean(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch), 'dsh.bundle.patch 已声明')
ok(
  '清单',
  Boolean(pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === 'web'),
  'dsh.client.platform === web',
)
ok('清单', Boolean(pkg.dsh && pkg.dsh.client && pkg.dsh.client.immediately === true), 'dsh.client.immediately')
ok(
  '清单',
  Array.isArray(pkg.dsh && pkg.dsh.client && pkg.dsh.client.inject) &&
    pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-theme'),
  'dsh.client.inject 含 ui-theme',
)
ok('清单', Boolean(pkg.dsh && pkg.dsh.bundle && has(pkg.dsh.bundle.patch.replace(/^\.\//, ''))), 'patch 文件存在')
if (pkg.icon) {
  const iconPath = pkg.icon.replace(/^\.\//, '')
  const size = has(iconPath) ? statSync(join(root, iconPath)).size : -1
  ok('清单', size > 0 && size <= 256 * 1024, 'icon.svg 存在且 ≤ 256 KiB', `${size} B`)
}
for (const locale of ['zh', 'en']) {
  const rel = `locale/${locale}.json`
  if (!ok('清单', has(rel), `${rel} 存在`)) continue
  const doc = JSON.parse(read(rel))
  ok(
    '清单',
    Boolean(doc.meta && doc.meta.title && doc.meta.description),
    `${rel} 含 meta.title / meta.description`,
  )
}
const patch = read(pkg.dsh.bundle.patch.replace(/^\.\//, ''))
const rowId = (patch.match(/^\s*-\s*id:\s*(\S+)/m) || [])[1]
ok('清单', rowId === 'dsh-theme-miyabi', 'patch 行 id 正确', String(rowId))
ok('清单', patch.includes(`'${pkg.name}'`) || patch.includes(`"${pkg.name}"`), 'patch 行 name 指向本包')
/* 发布前必须把 owner 占位符换掉：README 的徽章/克隆链接与 package.json 的
   repository / homepage / bugs / author 都写着 __OWNER__。留着就不许提交。 */
const ownerGaps = ['package.json', 'README.md'].filter(
  (rel) => has(rel) && read(rel).indexOf('__OWNER__') >= 0,
)
ok('清单', ownerGaps.length === 0, '仓库 owner 已填入（__OWNER__ 占位符已替换）', ownerGaps.join(', '))
ok('清单', /^[a-z0-9][a-z0-9-]*$/.test(String(pkg.name).split('/').pop()), '包名可作目录名')
ok('清单', !pkg.private, '未标 private（便于从 git 源安装）')

/* ═══ 2. 产物 ═════════════════════════════════════════════════════════════ */
const clientRel = pkg.exports['./client'].replace(/^\.\//, '')
const clientSrc = has(clientRel) ? read(clientRel) : ''
ok('产物', clientSrc.length > 0, 'client.js 存在（先跑 node tools/build.mjs）')
if (clientSrc) {
  ok('产物', clientSrc.indexOf('window.__ModuleLoader__.load(') >= 0, '使用 __ModuleLoader__.load 注册')
  ok('产物', clientSrc.indexOf(`id: ${JSON.stringify(pkg.name)}`) >= 0, '模块 id 与包名一致')
  const requires = [...clientSrc.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])
  const bad = requires.filter((name) => name !== 'react')
  ok('产物', bad.length === 0, '只 require react（不引入任何 Harness Client 包）', bad.join(', '))
  ok('产物', /exports\.isPlugin\s*=\s*true/.test(clientSrc), '导出 isPlugin')
  ok('产物', /exports\.inject\s*=\s*\[/.test(clientSrc), '导出 inject')
  ok('产物', /exports\.apply\s*=\s*apply/.test(clientSrc), '导出 apply')
  ok('产物', clientSrc.indexOf('/* @sym-assets */ {}') < 0, '构建已注入素材（占位符已替换）')
  ok('产物', clientSrc.indexOf('data:image/jpeg;base64,') >= 0, '立绘已内嵌为 data URI')
}

/* ═══ 3. 求值 ═════════════════════════════════════════════════════════════ */
const srcFiles = readdirSync(join(root, 'src'))
  .filter((n) => n.endsWith('.js'))
  .sort()
const body = srcFiles.map((n) => read(join('src', n))).join('\n\n')
const exposed = [
  'PAL_pair',
  'PAL_vars',
  'PAL_flat',
  'PAL_ACCENT',
  'ART_background',
  'ART_artwork',
  'ART_image',
  'ART_flake',
  'ART_flakeArm',
  'ART_FLAKE_ARMS',
  'ART_noise',
  'ART_tape',
  'CSS_identity',
  'ART_EMBLEM',
  'CFG_DEFAULTS',
  'CFG_normalize',
  'META_ENUM',
  'META_CFG_REV',
  'META_CFG_REBASE',
  'META_ART_KEY',
  'META_LS_KEY',
  'TXT_ZH',
  'TXT_EN',
  'U_rgb',
  'MOON_phase',
  'MOON_litPath',
  'FX_particleSpecs',
]
const fakeWindow = {
  innerWidth: 1440,
  innerHeight: 900,
  localStorage: { getItem: () => null, setItem: () => {} },
  matchMedia: () => ({ matches: false }),
}
let M = null
try {
  // 与构建产物一样，片段共享一个作用域并拿到 exports（90-apply.js 会写它）
  const exportsObj = {}
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'window',
    'document',
    'console',
    'URL',
    'exports',
    body + `\n;return { ${exposed.join(', ')} };`,
  )
  M = factory(
    fakeWindow,
    { createElement: () => null },
    console,
    { createObjectURL: () => '', revokeObjectURL: () => {} },
    exportsObj,
  )
  pass('求值', `src 片段可求值（${srcFiles.length} 段）`)
  ok('求值', exportsObj.isPlugin === true && typeof exportsObj.apply === 'function', 'exports 形态正确')
  ok(
    '求值',
    Array.isArray(exportsObj.inject) &&
      exportsObj.inject.includes('theme') &&
      exportsObj.inject.includes('slots'),
    'inject 含 theme 与 slots',
  )
} catch (err) {
  fail('求值', 'src 片段求值失败', err.message)
}

if (M) {
  /* ═══ 4. 令牌 ═══════════════════════════════════════════════════════════ */
  /* 名单来自本机 dsh-client-ui-theme 的真实样式表（见 README「兼容性」）。
     写错一个字母不会报错，只会静默不生效，所以这里逐个核对。 */
  const KNOWN = new Set(
    `
--dsw-alias-bg-base --dsw-alias-bg-document-preview --dsw-alias-bg-document-selection
--dsw-alias-bg-layer-1 --dsw-alias-bg-layer-2 --dsw-alias-bg-layer-3 --dsw-alias-bg-mask-1
--dsw-alias-bg-mask-2 --dsw-alias-bg-mask-3 --dsw-alias-bg-mask-drop --dsw-alias-bg-mask-photo
--dsw-alias-bg-module-platform --dsw-alias-bg-multi-select --dsw-alias-bg-overlay --dsw-alias-bg-skeleton
--dsw-alias-border-inverted --dsw-alias-border-inverted2 --dsw-alias-border-l1 --dsw-alias-border-l2
--dsw-alias-border-l2-darkmode-thin --dsw-alias-border-l3 --dsw-alias-border-l4 --dsw-alias-brand-primary
--dsw-alias-brand-primary-invert --dsw-alias-brand-primary-new-colorprimary-new-color --dsw-alias-brand-text
--dsw-alias-button-contrast-fill --dsw-alias-button-elevated-fill --dsw-alias-button-floating-fill
--dsw-alias-button-floating-hover --dsw-alias-button-ghost-active-border --dsw-alias-button-ghost-active-fill
--dsw-alias-button-ghost-active-hover --dsw-alias-button-info-fill --dsw-alias-button-info-hover
--dsw-alias-button-primary-dimmed --dsw-alias-button-primary-fill --dsw-alias-button-primary-hover
--dsw-alias-button-tool-bar-fill --dsw-alias-button-tool-bar-fill-invisible --dsw-alias-button-tool-bar-hover
--dsw-alias-code-diff-added --dsw-alias-code-diff-deleted --dsw-alias-file-diff-added-bg
--dsw-alias-file-diff-added-gutter --dsw-alias-file-diff-added-marker --dsw-alias-file-diff-deleted-bg
--dsw-alias-file-diff-deleted-gutter --dsw-alias-file-diff-deleted-marker --dsw-alias-interactive-bg-active
--dsw-alias-interactive-bg-hover --dsw-alias-interactive-bg-hover-accent --dsw-alias-interactive-bg-hover-danger
--dsw-alias-interactive-bg-hover-solid --dsw-alias-label-caption --dsw-alias-label-deep-diving
--dsw-alias-label-deep-diving-shimmer --dsw-alias-label-dimmed --dsw-alias-label-document-preview
--dsw-alias-label-primary --dsw-alias-label-primary-bluish --dsw-alias-label-primary-dimmed
--dsw-alias-label-primary-foreground --dsw-alias-label-primary-inverted --dsw-alias-label-secondary
--dsw-alias-label-shimmer --dsw-alias-label-tertiary --dsw-alias-link --dsw-alias-markdown-citation
--dsw-alias-markdown-code-block --dsw-alias-markdown-code-block-banner --dsw-alias-markdown-code-segment-selected
--dsw-alias-markdown-code-segment-unselected --dsw-alias-markdown-inline-code --dsw-alias-markdown-placeholder
--dsw-alias-markdown-tag --dsw-alias-menu-group-header-fill --dsw-alias-menu-icon --dsw-alias-scrollbar-bg-l1
--dsw-alias-scrollbar-bg-l2 --dsw-alias-scrollbar-hover-l1 --dsw-alias-scrollbar-hover-l2
--dsw-alias-settings-card-fill --dsw-alias-settings-card-stroke --dsw-alias-state-business-primary
--dsw-alias-state-business-tertiary --dsw-alias-state-error-primary --dsw-alias-state-error-secondary
--dsw-alias-state-idle-primary --dsw-alias-state-success-primary --dsw-alias-state-success-secondary
--dsw-alias-state-success-tertiary --dsw-alias-state-warn-label --dsw-alias-state-warn-primary
--dsw-alias-state-warn-secondary --dsw-alias-state-warn-tertiary --dsw-alias-switch-thumb --dsw-alias-toast-bg
--dsw-alias-toast-label --dsw-alias-tooltip-bg --dsw-alias-tooltip-key-bg --dsw-alias-turn-trigger-bg
--dsw-alias-turn-trigger-bg-hover --dsw-specific-bubble --dsw-specific-bubble-highlight
--dsw-specific-input-major --dsw-specific-login-input --dsw-specific-menu --dsw-specific-selector
--dsw-specific-sidebar-fill --dsw-specific-sidebar-nav-item-active
--dsw-specific-sidebar-nav-item-active-accent --dsw-specific-sidebar-nav-item-hover --dsw-specific-tip
--dsw-menu-surface-fill --shiki-foreground --shiki-background --shiki-token-constant --shiki-token-string
--shiki-token-comment --shiki-token-keyword --shiki-token-parameter --shiki-token-function
--shiki-token-string-expression --shiki-token-punctuation --shiki-token-link
`
      .split(/\s+/)
      .filter(Boolean),
  )
  const pair = M.PAL_pair(1, 1)
  const unknown = Object.keys(pair).filter((name) => !KNOWN.has(name))
  ok('令牌', unknown.length === 0, `全部 ${Object.keys(pair).length} 个令牌名都在宿主名单里`, unknown.join(', '))
  const missingPairs = Object.keys(pair).filter((name) => {
    const value = pair[name]
    return !value || typeof value.light !== 'string' || typeof value.dark !== 'string' || !value.light || !value.dark
  })
  ok('令牌', missingPairs.length === 0, '每个令牌都同时给了 light / dark', missingPairs.join(', '))

  /* ═══ 5. 对比度 ═════════════════════════════════════════════════════════ */
  /** 解析 #rgb / #rrggbb / rgba()。 */
  function parse(value) {
    const s = String(value).trim()
    if (s[0] === '#') {
      if (s.length === 4) {
        return { r: parseInt(s[1] + s[1], 16), g: parseInt(s[2] + s[2], 16), b: parseInt(s[3] + s[3], 16), a: 1 }
      }
      return {
        r: parseInt(s.slice(1, 3), 16),
        g: parseInt(s.slice(3, 5), 16),
        b: parseInt(s.slice(5, 7), 16),
        a: 1,
      }
    }
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const parts = m[1].split(/[,/]/).map((v) => Number(v.trim()))
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
  }
  /** 把半透明前景合成到不透明背景上。 */
  function over(fg, bg) {
    const a = fg.a
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1,
    }
  }
  /** 相对亮度。 */
  function lum(c) {
    const f = (v) => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  /** WCAG 对比度。 */
  function ratio(fgValue, bgValue, backdrop) {
    const fgRaw = parse(fgValue)
    const bgRaw = parse(bgValue)
    if (!fgRaw || !bgRaw) return null
    const base = backdrop ? parse(backdrop) : { r: 0, g: 0, b: 0, a: 1 }
    const bg = bgRaw.a < 1 ? over(bgRaw, base) : bgRaw
    const fg = fgRaw.a < 1 ? over(fgRaw, bg) : fgRaw
    const l1 = lum(fg)
    const l2 = lum(bg)
    const hi = Math.max(l1, l2)
    const lo = Math.min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)
  }

  /** 每个档位两个极端背景色：亮端与暗端都要成立。 */
  const BACKDROP = { dark: ['#05050b', '#0a0a14'], light: ['#e9eff8', '#f5f8fd'] }
  const SURFACES = [
    '--dsw-alias-bg-base',
    '--dsw-alias-bg-layer-1',
    '--dsw-alias-bg-layer-2',
    '--dsw-alias-bg-layer-3',
    '--dsw-alias-bg-overlay',
    '--dsw-specific-sidebar-fill',
    '--dsw-specific-bubble',
    '--dsw-specific-input-major',
    '--dsw-specific-selector',
    '--dsw-specific-menu',
    '--dsw-alias-markdown-code-block',
    '--dsw-alias-bg-module-platform',
  ]
  const TEXT_STRICT = ['--dsw-alias-label-primary', '--dsw-alias-label-primary-dimmed', '--dsw-alias-link']
  const TEXT_LOOSE = [
    '--dsw-alias-label-secondary',
    '--dsw-alias-label-tertiary',
    '--dsw-alias-label-caption',
    '--dsw-alias-state-error-primary',
    '--dsw-alias-state-success-primary',
    '--dsw-alias-state-warn-primary',
    '--dsw-alias-brand-text',
  ]

  let worstStrict = { r: 99, at: '' }
  let worstLoose = { r: 99, at: '' }
  for (const scheme of ['dark', 'light']) {
    const p = M.PAL_pair(1, 1)
    for (const backdrop of BACKDROP[scheme]) {
      for (const surface of SURFACES) {
        const bgValue = p[surface][scheme]
        for (const token of TEXT_STRICT) {
          const r = ratio(p[token][scheme], bgValue, backdrop)
          if (r !== null && r < worstStrict.r) worstStrict = { r, at: `${scheme} ${token} on ${surface}` }
        }
        for (const token of TEXT_LOOSE) {
          const r = ratio(p[token][scheme], bgValue, backdrop)
          if (r !== null && r < worstLoose.r) worstLoose = { r, at: `${scheme} ${token} on ${surface}` }
        }
      }
    }
  }
  ok(
    '对比度',
    worstStrict.r >= 4.5,
    `正文/强调文字最差对比度 ≥ 4.5:1（实测 ${worstStrict.r.toFixed(2)}）`,
    worstStrict.at,
  )
  ok(
    '对比度',
    worstLoose.r >= 3,
    `次级文字与语义色最差对比度 ≥ 3:1（实测 ${worstLoose.r.toFixed(2)}）`,
    worstLoose.at,
  )

  /* 填色按钮上的字 */
  for (const scheme of ['dark', 'light']) {
    const p = M.PAL_pair(1, 1)
    const ink = p['--dsw-alias-label-primary-foreground'][scheme]
    for (const fill of [
      '--dsw-alias-button-primary-fill',
      '--dsw-alias-button-contrast-fill',
      '--dsw-alias-button-info-fill',
    ]) {
      const r = ratio(ink, p[fill][scheme], BACKDROP[scheme][0])
      ok(
        '对比度',
        r !== null && r >= 4.5,
        `${scheme} 填色按钮文字 ${fill.replace('--dsw-alias-', '')} ${r === null ? '?' : r.toFixed(2)}:1`,
      )
    }
  }
  /* toast 与代码块 */
  for (const scheme of ['dark', 'light']) {
    const p = M.PAL_pair(1, 1)
    ok(
      '对比度',
      ratio(p['--dsw-alias-toast-label'][scheme], p['--dsw-alias-toast-bg'][scheme], BACKDROP[scheme][0]) >= 4.5,
      `${scheme} toast 文字`,
    )
    let worst = 99
    let at = ''
    for (const key of Object.keys(p).filter((k) => k.startsWith('--shiki-token-'))) {
      const r = ratio(p[key][scheme], p['--dsw-alias-markdown-code-block'][scheme], BACKDROP[scheme][0])
      if (r !== null && r < worst) {
        worst = r
        at = key
      }
    }
    ok('对比度', worst >= 4.5, `${scheme} 代码高亮最差对比度 ≥ 4.5:1（实测 ${worst.toFixed(2)}）`, at)
  }

  /* ═══ 6. 壁纸透出率 ═════════════════════════════════════════════════════
   * 这一组是为一个真实缺陷加的回归守卫：壁纸与立绘画在所有面板之下，
   * 面板 alpha 一旦偏高，壁纸就被压成「看不见」。 */
  const dcfg = M.CFG_DEFAULTS
  const dfx = dcfg.intensity / 100
  const dui = dcfg.panelOpacity / 100
  for (const scheme of ['dark', 'light']) {
    const p = M.PAL_pair(dfx, dui)
    /** 某个表面令牌的实际 alpha。 */
    const alphaOf = (name) => {
      const c = parse(p[name][scheme])
      return c ? c.a : 1
    }
    const canvas = 1 - alphaOf('--dsw-alias-bg-base')
    const sidebar = 1 - alphaOf('--dsw-specific-sidebar-fill')
    const overlay = 1 - alphaOf('--dsw-alias-bg-overlay')
    const code = 1 - alphaOf('--dsw-alias-markdown-code-block')
    ok('壁纸', canvas >= 0.5, `${scheme} 画布层壁纸透出率 ≥ 50%（实测 ${(canvas * 100).toFixed(1)}%）`)
    ok('壁纸', sidebar >= 0.5, `${scheme} 侧栏壁纸透出率 ≥ 50%（实测 ${(sidebar * 100).toFixed(1)}%）`)
    // 弹层与代码块是「必须压住壁纸」的一类，反过来要求它们够实
    ok('壁纸', overlay <= 0.1, `${scheme} 弹层几乎不透（实测 ${(overlay * 100).toFixed(1)}%）`)
    ok('壁纸', code <= 0.35, `${scheme} 代码块足够实（实测 ${(code * 100).toFixed(1)}%）`)

    // 立绘：画布透出率 × 立绘不透明度 = 用户实际看到的强度。
    // 夜档是主场景（要求更亮），昼档是照片压在浅底上，刻意更含蓄。
    const art = M.ART_artwork(dcfg, scheme, 'url("data:image/jpeg;base64,AAAA")')
    const seen = canvas * art.alpha
    const floor = scheme === 'dark' ? 0.18 : 0.1
    ok(
      '壁纸',
      seen >= floor,
      `${scheme} 立绘实际可见度 ≥ ${(floor * 100).toFixed(0)}%（实测 ${(seen * 100).toFixed(1)}%）`,
    )
    /* 立绘不透明度的档位规则：夜档按设置原样生效（默认 100% → 1.0），
       昼档内部再乘 0.5 天花板（浅底压不住照片时，深色字会掉对比度）。
       默认值调到 100% 之后，原来那条「默认不超过 60%」的断言就不再成立了 ——
       它描述的是旧默认，不是一条设计不变量；换成这条描述真正的规则。 */
    const artCeiling = scheme === 'dark' ? 1 : 0.5
    const artExpect = Math.min(1, (dcfg.artOpacity / 100) * artCeiling)
    ok(
      '壁纸',
      Math.abs(art.alpha - artExpect) < 1e-6 && art.alpha <= 1,
      `${scheme} 立绘不透明度按档位生效（实测 ${(art.alpha * 100).toFixed(0)}%，应为 ${(artExpect * 100).toFixed(0)}%）`,
    )
  }
  // 强度 0 = 只换配色：面板必须完全不透明（壁纸彻底退场）
  const solid = M.PAL_pair(0, dui)
  ok(
    '壁纸',
    parse(solid['--dsw-alias-bg-base'].dark).a === 1 &&
      parse(solid['--dsw-specific-sidebar-fill'].dark).a === 1,
    '强度 0 时面板完全不透明（纯换色模式）',
  )
  // 界面不透明度：调低必须真的更透
  ok(
    '壁纸',
    parse(M.PAL_pair(dfx, 0.4)['--dsw-alias-bg-base'].dark).a <
      parse(M.PAL_pair(dfx, 1)['--dsw-alias-bg-base'].dark).a,
    '界面不透明度调低后画布更透',
  )
  /* 下限的作用：界面不透明度调到下限（40%）**并且**强度拉满（100%）这个
     最狠的组合下，弹层与代码块仍然压得住壁纸。没有这个下限，40% 会把
     overlay 乘到 0.38、code 乘到 0.29，下拉菜单和代码块就会透出壁纸。 */
  for (const scheme of ['dark', 'light']) {
    const hard = M.PAL_pair(1, 0.4)
    const ao = parse(hard['--dsw-alias-bg-overlay'][scheme]).a
    const ac = parse(hard['--dsw-alias-markdown-code-block'][scheme]).a
    ok('壁纸', 1 - ao <= 0.1, `${scheme} 最狠组合下弹层仍几乎不透（实测 ${((1 - ao) * 100).toFixed(1)}%）`)
    ok('壁纸', 1 - ac <= 0.35, `${scheme} 最狠组合下代码块仍足够实（实测 ${((1 - ac) * 100).toFixed(1)}%）`)
  }
  /* 出厂默认值本身是被点名要求过的，钉住它，防止以后被「顺手调回去」 */
  ok('配置', M.CFG_DEFAULTS.panelOpacity === 40, '界面不透明度默认 40%', String(M.CFG_DEFAULTS.panelOpacity))
  ok('配置', M.CFG_DEFAULTS.artOpacity === 100, '立绘不透明度默认 100%', String(M.CFG_DEFAULTS.artOpacity))
  ok(
    '配置',
    M.META_CFG_REBASE.indexOf('panelOpacity') >= 0 && M.META_CFG_REBASE.indexOf('artOpacity') >= 0,
    '两个不透明度都是设计基线字段（升版会拉回新默认）',
  )

  /* ═══ 7. 作用域 ═════════════════════════════════════════════════════════ */
  const css = M.CSS_identity()
  const badSelectors = []
  for (const line of css.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.endsWith('{')) continue
    const selector = trimmed.slice(0, -1).trim()
    if (!selector) continue
    if (selector.startsWith('@')) continue
    if (/^(from|to|\d+%)/.test(selector)) continue // keyframes 步进
    for (const one of selector.split(',')) {
      const s = one.trim()
      if (!s) continue
      if (/^html\[data-miyabi-skin\]/.test(s)) continue
      if (/^\.miyabi-/.test(s)) continue
      if (/^html\[data-miyabi-motion=/.test(s)) continue
      badSelectors.push(s)
    }
  }
  ok(
    '作用域',
    badSelectors.length === 0,
    '身份层所有选择器都限定在 html[data-miyabi-skin] / .miyabi- 内',
    badSelectors.slice(0, 6).join(' | '),
  )
  ok('作用域', (css.match(/!important/g) || []).length <= 8, '未滥用 !important')
  ok('作用域', /prefers-reduced-motion/.test(css), '包含 prefers-reduced-motion 兜底')
  ok('作用域', /\[data-miyabi-motion='off'\]/.test(css), '包含动效总开关')

  /* ═══ 8. 收敛：已删除的东西不得复活 ═════════════════════════════════════ */
  const forbidden = [
    ['AudioContext', '声音模块'],
    ['webkitAudioContext', '声音模块'],
    ['SND_', '声音模块'],
    ['createGain', '声音模块'],
    ['ART_crest', '自制月徽'],
    ['ART_petal', '樱瓣素材'],
    ['ART_torii', '鸟居素材'],
    ['ART_patternHalftone', '半调底纹'],
    ['ART_patternCity', '夜行都市底纹'],
    ['ART_patternSakura', '樱月底纹'],
    ['ART_load', '自备立绘读取'],
    ['indexedDB', '自备立绘存储'],
    ['customUrl', '自备立绘 URL'],
    [`'artSource'`, '立绘来源选择'],
    ["'blade'", '「刃」模式'],
    ["'night'", '「夜行」模式'],
    ["'halftone'", '半调底纹枚举'],
    ["'sakura'", '樱月底纹枚举'],
    ["'torii'", '鸟居底纹枚举'],
  ]
  const revived = []
  for (const [needle, label] of forbidden) {
    if (clientSrc && clientSrc.indexOf(needle) >= 0) revived.push(`${label}(${needle})`)
  }
  ok('收敛', revived.length === 0, '已删除的模块没有复活', revived.join(', '))

  ok('收敛', Object.keys(M.PAL_ACCENT).sort().join(',') === 'dark,light', '强调色只剩浅深两档（无模式维度）')
  ok(
    '收敛',
    Object.keys(M.META_ENUM).sort().join(',') === 'art,console,motion,particles',
    '配置枚举只剩 art / console / motion / particles',
    Object.keys(M.META_ENUM).join(','),
  )
  ok('收敛', !('pattern' in M.CFG_DEFAULTS) && !('mode' in M.CFG_DEFAULTS), '配置里不再有 pattern / mode')
  ok('收敛', !('sound' in M.CFG_DEFAULTS) && !('volume' in M.CFG_DEFAULTS), '配置里不再有 sound / volume')

  /* 底纹只剩斜切网格：必须出现网格特征、且不含其他纹样特征 */
  const bg = M.ART_background(dcfg, 'dark')
  ok('收敛', /repeating-linear-gradient\(115deg/.test(bg), '底纹含斜切网格（115°）')
  ok('收敛', !/radial-gradient\([^)]*1\.1px/.test(bg), '底纹不含半调网点')

  /* 立绘：位置四选一（默认贴左），始终只用使用者那张图，不拉伸 */
  ok('收敛', M.CFG_DEFAULTS.art === 'left', '立绘默认位置是贴左', String(M.CFG_DEFAULTS.art))
  const artOf = (pos) => M.ART_artwork(Object.assign({}, dcfg, { art: pos }), 'dark', 'url("data:image/jpeg;base64,AAAA")')
  ok('收敛', artOf('left').bg.indexOf('left -1% bottom / auto 92% no-repeat') > 0, '贴左：左下锚点 + 按高度贴合')
  ok('收敛', artOf('right').bg.indexOf('right -1% bottom / auto 92% no-repeat') > 0, '贴右：右下锚点 + 按高度贴合')
  ok('收敛', artOf('watermark').bg.indexOf('right 2% center / auto 94% no-repeat') > 0, '水印：右侧竖直居中')
  ok('收敛', artOf('none').alpha === 0 && artOf('none').bg === 'none', '选「无」时立绘层整体不显示')
  const distinctPos = new Set(['left', 'right', 'watermark'].map((pos) => artOf(pos).bg))
  ok('收敛', distinctPos.size === 3, '三个可见位置各自生成不同的定位', String(distinctPos.size))
  ok('收敛', M.ART_artwork(dcfg, 'dark', '').alpha === 0, '没有图时立绘层不显示（alpha=0）')
  // 沙箱里 ART_PACK 是未注入的空对象，所以这里只能证明「没有图时优雅退化」；
  // 「图确实打进包里了」由下面对构建产物的断言负责。
  ok('收敛', M.ART_image() === '', '素材包为空时 ART_image() 返回空串（优雅退化）')
  ok(
    '收敛',
    clientSrc.indexOf('"miyabi-wallpaper":"data:image/jpeg;base64,') > 0,
    '构建产物里内嵌了键名为 miyabi-wallpaper 的 JPEG data URI',
  )

  /* ═══ 9. 用语 / 配置 / 图形 ═════════════════════════════════════════════ */
  const zhKeys = Object.keys(M.TXT_ZH).sort()
  const enKeys = Object.keys(M.TXT_EN).sort()
  ok('用语', zhKeys.length === enKeys.length, 'zh / en 键数一致', `${zhKeys.length} vs ${enKeys.length}`)
  const missingEn = zhKeys.filter((k) => !M.TXT_EN[k])
  ok('用语', missingEn.length === 0, 'en 缺少的键', missingEn.join(', '))
  const missingZh = enKeys.filter((k) => !M.TXT_ZH[k])
  ok('用语', missingZh.length === 0, 'zh 缺少的键', missingZh.join(', '))
  for (const key of Object.keys(M.META_ENUM)) {
    for (const value of M.META_ENUM[key]) {
      ok('用语', Boolean(M.TXT_ZH[`${key}.${value}`]), `文案键 ${key}.${value}`)
    }
  }
  // 已删掉的界面用语不得留在表里
  const deadKeys = zhKeys.filter((k) => /^(mode|pattern|artSource|sound|volume)\./.test(k))
  ok('用语', deadKeys.length === 0, '没有残留的已删模块文案键', deadKeys.join(', '))

  const normalized = M.CFG_normalize({
    intensity: 999,
    panelOpacity: 5,
    artOpacity: -5,
    motion: null,
    particles: 7,
    consolePos: { x: 'x', y: 2 },
    scanlines: 'maybe',
    // 上一版遗留的键必须被无视
    mode: 'blade',
    pattern: 'sakura',
    art: 'right',
    artSource: 'custom',
    sound: 'both',
    volume: 90,
  })
  ok('配置', normalized.intensity === 100, '强度夹到 0..100')
  ok('配置', normalized.panelOpacity === 40, '界面不透明度夹到 40..100')
  ok('配置', normalized.artOpacity === 4, '立绘不透明度夹到 4..100')
  ok('配置', normalized.motion === M.CFG_DEFAULTS.motion, '坏枚举退回默认')
  ok('配置', normalized.particles === M.CFG_DEFAULTS.particles, '坏粒子档退回默认')
  ok('配置', normalized.consolePos === null, '坏坐标丢弃')
  ok('配置', normalized.scanlines === M.CFG_DEFAULTS.scanlines, '坏布尔退回默认')
  ok('配置', !('mode' in normalized) && !('pattern' in normalized) && !('sound' in normalized), '遗留键不进配置')
  ok('配置', normalized.cfgRev === M.CFG_DEFAULTS.cfgRev, '配置带基线版本号')
  ok(
    '配置',
    Array.isArray(M.META_CFG_REBASE) && M.META_CFG_REBASE.indexOf('artOpacity') >= 0,
    '升版会重置的艺术基线字段已登记',
  )

  let cssOk = true
  let cssBad = ''
  for (const scheme of ['dark', 'light']) {
    const out = M.ART_background(dcfg, scheme)
    if (/undefined|NaN|\[object/.test(out)) {
      cssOk = false
      cssBad = scheme
    }
  }
  ok('图形', cssOk, '浅深两档都能生成合法背景值', cssBad)
  /* 强度语义：0 = 只换配色，网格必须真的消失；100 = 设计浓度 */
  const bgZero = M.ART_background(Object.assign({}, dcfg, { intensity: 0 }), 'dark')
  const bgFull = M.ART_background(Object.assign({}, dcfg, { intensity: 100 }), 'dark')
  ok('图形', bgZero !== bgFull, '强度会改变底纹浓度')
  ok('图形', bgZero.indexOf('rgba(143, 217, 255, 0)') >= 0, '强度 0 时强调色网格被完全抹掉', bgZero.slice(0, 90))
  ok(
    '图形',
    /rgba\(143, 217, 255, 0\.0[0-9]+\)/.test(bgFull),
    '强度 100 时网格有实际浓度',
    (bgFull.match(/rgba\(143, 217, 255, [\d.]+\)/g) || []).slice(0, 3).join(' '),
  )
  const flake = M.ART_flake('#ffffff')
  ok('图形', flake.startsWith('url("data:image/svg+xml,'), '霜星是 data URI（无跨域请求）')
  const flakePayload = flake.slice(flake.indexOf(',') + 1, flake.lastIndexOf('")'))
  ok(
    '图形',
    !/[<>#"\\\s]/.test(flakePayload),
    'data URI 载荷里没有未转义的 < > # " 与空白',
    flakePayload.slice(0, 60),
  )
  ok('图形', flakePayload.indexOf('%23ffffff') > 0, '霜星沿用调用方给的颜色（白）')

  /* 沙箱里 ART_EMBLEM 是未注入的空对象，所以上面这段验的是**退回手绘花瓣**；
     真正的矢量化轮廓由下面的「徽记」一组来验。 */
  const arms = (flakePayload.match(/%3Cpath/g) || []).length
  ok('图形', Object.keys(M.ART_EMBLEM).length === 0, '沙箱里徽记未注入（走的就是退回分支）')
  ok('图形', arms === 8, `无徽记时退回手绘八向花瓣（实测 ${arms} 片）`)
  ok('图形', new Set(M.ART_FLAKE_ARMS.map((a) => a.angle)).size === 8, '八个朝向互不重复')

  /* ── 矢量化徽记（由 tools/trace-emblem.mjs 从位图产出） ─────────────── */
  if (ok('徽记', has('assets/emblem.json'), 'assets/emblem.json 存在')) {
    const em = JSON.parse(read('assets/emblem.json'))
    ok('徽记', em.viewBox === '0 0 64 64', 'viewBox 是 64×64', String(em.viewBox))
    ok('徽记', /^M/.test(em.path) && /Z$/.test(em.path), '路径以 M 开头、以 Z 闭合')
    const subpaths = em.path.split('Z').filter(Boolean).length
    ok('徽记', subpaths === em.meta.contours && subpaths >= 2, `子路径数与轮廓数一致（${subpaths} 环，含孔洞）`)
    ok('徽记', !/fill|stroke|rgb|#/i.test(em.path), '路径里没有任何颜色（形状与颜色彻底分离）')
    ok('徽记', em.fillRule === 'evenodd', '填色规则是 evenodd（孔洞才挖得出来）')
    ok('徽记', em.meta.iou >= 0.97, `矢量化自证 IoU ≥ 0.97（实测 ${em.meta.iou}）`)
    ok('徽记', em.meta.sourceSize === '2048x2048', '来源是 2048×2048 的位图', em.meta.sourceSize)
    const nums = (em.path.match(/-?[0-9.]+/g) || []).map(Number)
    const bad = nums.filter((n) => !Number.isFinite(n) || n < 0 || n > 64)
    ok('徽记', nums.length > 100 && bad.length === 0, `全部 ${nums.length} 个坐标落在 0..64 内`, String(bad.length))
    ok(
      '徽记',
      clientSrc.indexOf('"viewBox":"0 0 64 64"') > 0 && clientSrc.indexOf(em.path.slice(0, 24)) > 0,
      '构建产物里内嵌了这枚徽记轮廓',
    )
    ok('徽记', has('assets/ref/emblem-source.png'), '源位图留档在 assets/ref/（不进 bundle）')
  }
  const arm = M.ART_flakeArm(30)
  ok('图形', /^M-?[\d.]+,-?[\d.]+ .*Z$/.test(arm), '单枚花瓣是闭合路径', arm.slice(0, 40))
  ok('图形', arm.indexOf('0,0') > 0, '花瓣内缘收进中心点')
  ok('图形', new Set(M.ART_FLAKE_ARMS.map((a) => a.angle)).size === 8, '八个朝向互不重复')
  const noise = M.ART_noise()
  ok('图形', noise.indexOf('%3C') >= 0 && noise.indexOf('#') < 0, '噪点 data URI 里没有裸 #')
  ok('图形', M.ART_tape('#8fd9ff', 10).indexOf('repeating-linear-gradient') === 0, '警示条是纯 CSS 渐变')

  let moonOk = true
  for (let i = 0; i < 8; i += 1) {
    const d = M.MOON_litPath(i / 8, 12)
    if (!/^M0,-12 A12,12 0 0 [01] 0,12 A[\d.]+,[\d.]+ 0 0 [01] 0,-12 Z$/.test(d)) moonOk = false
  }
  ok('图形', moonOk, '月相 8 档都能生成合法路径')
  const specs = M.FX_particleSpecs(64)
  ok('图形', specs.length === 64 && specs.every((s) => s.left >= 0 && s.left <= 100), '粒子参数在范围内')
}

/* ═══ 报告 ════════════════════════════════════════════════════════════════ */
let group = ''
let failed = 0
for (const row of results) {
  if (row.group !== group) {
    group = row.group
    console.log(`\n── ${group} ──`)
  }
  if (row.ok) {
    console.log(`  ✓ ${row.msg}`)
  } else {
    failed += 1
    console.log(`  ✗ ${row.msg}`)
  }
}
console.log(`\n${failed === 0 ? '全部通过' : failed + ' 项失败'}：${results.length - failed} 通过 / ${results.length} 合计`)
process.exit(failed === 0 ? 0 : 1)
