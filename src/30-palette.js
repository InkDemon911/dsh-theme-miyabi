/* ═══════════════════════════════════════════════════════════════════════════
 * 3. 调色板与令牌层
 *
 * 设计依据：《绝区零》星见雅的取色关键词 —— 霜（冷蓝）、虚狩（近黑紫）、
 * 刀（冷白硬边）、符纸／眼瞳（少量猩红）、月（金线），以及新艾利都街头的
 * 高对比色块语言。任务书要求「霜蓝、冷紫、黑、白、少量红与金」，所以：
 *   强调色 = 霜蓝（主）／冷紫（次）；红只出现在危险态与眼瞳；
 *   金只用在细线与小面积标记；白是硬边色块；黑紫是底。
 *
 * 输出两张表：
 *   PAL_pair(mode, fx)      → { '--dsw-alias-x': { light, dark } }  给 overrideTokens()
 *   PAL_flat(pair, scheme)  → { '--dsw-alias-x': '值' }             给 register()
 * 每个令牌都同时给 light / dark 两个取值，所以宿主切浅深色都不会串成不可读的
 * 配色：浅色档是「白霜」昼档（冷白纸底 + 深强调色），深色档是「夜行」夜档。
 *
 * 命名约定：本段用 PAL_ 前缀。
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 表面色：写成 [r,g,b] + 设计不透明度，便于强度统一换算。
 *
 * ⚠️ 这一组 alpha 是**壁纸可见度**的总闸门：这些面都画在壁纸层之上，
 * 只要 bg-base 有 70% 不透明，壁纸就只剩 30% 透出来，立绘更会被压到看不见
 * （1.x 的真实教训）。所以底层面板刻意压得很低（夜档 bg-base 0.28 / 侧栏 0.32），
 * 而弹层与正文块（overlay 0.94 / code 0.72 / sel 0.86）保持高不透明，
 * 保证下拉菜单、代码块、选区内始终有稳定的可读底色。
 * 使用者嫌太透或太实，用设置页的「界面不透明度」在 40%~100% 之间调；
 * tools/check.mjs 里有一组「壁纸透出率」断言守着这条底线。
 */
const PAL_SURFACE = {
  dark: {
    base: [[8, 8, 17], 0.28], // 应用底：最透，壁纸主要从这里透出
    l1: [[13, 13, 27], 0.46],
    l2: [[18, 18, 37], 0.66],
    l3: [[24, 24, 46], 0.78],
    overlay: [[16, 16, 32], 0.94],
    fill: [[28, 28, 52], 0.62], // 抬升按钮
    side: [[10, 10, 22], 0.32], // 侧栏
    bubble: [[30, 42, 72], 0.55], // 用户气泡：霜蓝暗块
    bubbleHi: [[48, 68, 112], 0.68],
    input: [[14, 14, 30], 0.66],
    menu: [[19, 21, 41], 0.6], // 菜单半透明，配宿主自带的 backdrop blur
    sel: [[27, 31, 56], 0.86],
    code: [[10, 12, 24], 0.72],
    codeHi: [[20, 24, 44], 0.86],
    ghost: [[34, 34, 64], 0.8],
  },
  light: {
    // 昼档比夜档略实一档：浅色底压不住深色照片时，深色字会掉对比度。
    base: [[240, 244, 251], 0.34],
    l1: [[248, 251, 255], 0.52],
    l2: [[255, 255, 255], 0.72],
    l3: [[232, 239, 249], 0.84],
    overlay: [[255, 255, 255], 0.96],
    fill: [[255, 255, 255], 0.72],
    side: [[232, 238, 248], 0.34],
    bubble: [[214, 232, 250], 0.62],
    bubbleHi: [[196, 220, 246], 0.74],
    input: [[255, 255, 255], 0.72],
    menu: [[248, 251, 255], 0.66],
    sel: [[236, 242, 250], 0.9],
    code: [[239, 243, 250], 0.78],
    codeHi: [[226, 234, 246], 0.9],
    ghost: [[232, 239, 249], 0.86],
  },
}

/** 文字与线条。 */
const PAL_TEXT = {
  dark: {
    txt: '#e9f1ff',
    txt2: '#a9b8d4',
    txt3: '#8393b0',
    cap: '#7b8aa8',
    dim: '#5d6b87',
    txtDim: '#dbe7fb',
    ink: '#070a12', // 浅色填色上的字
    inv: '#141428',
    line: [150, 190, 255],
    lineA: [0.1, 0.17, 0.26, 0.38],
    masked: [2, 3, 8],
    maskedA: [0.62, 0.34, 0.72],
  },
  light: {
    txt: '#101a2e',
    txt2: '#46536b',
    txt3: '#5f6d86',
    cap: '#6b7893',
    dim: '#8c98ae',
    txtDim: '#1b2740',
    ink: '#ffffff',
    inv: '#ffffff',
    line: [23, 42, 84],
    lineA: [0.1, 0.16, 0.24, 0.36],
    masked: [10, 16, 32],
    maskedA: [0.34, 0.18, 0.48],
  },
}

/**
 * 强调色。收敛后只保留「霜」一档：霜蓝为主、冷紫为次、金作细线，
 * 猩红只留给危险态与眼瞳。
 *   a1 强调墨色（当字／当小面积底）  a1s 强调填色（当底，配 label-primary-foreground）
 *   a1d 强调暗调（描边／弱化）      a2 次强调
 *   gold 金线   red 危险与眼瞳   ok 成功态
 */
const PAL_ACCENT = {
  dark: { a1: '#8fd9ff', a1s: '#c9ecff', a1d: '#4a86bd', a2: '#a98cff', gold: '#e6c479', red: '#ff5f70', ok: '#4fd6b0' },
  light: { a1: '#0d5c9e', a1s: '#123a63', a1d: '#7fa8cc', a2: '#5b3fd4', gold: '#8a6a13', red: '#c22a3a', ok: '#0f8a6a' },
}

/**
 * 代码高亮（--shiki-*）。这些值会随令牌层写到 body 行内样式上，
 * 所以浅深两档各给一套，宿主的代码块在两档下都可读。
 */
const PAL_SYNTAX = {
  dark: {
    constant: '#9db8ff', string: '#7fdcb4', comment: '#828fac', keyword: '#c9a6ff',
    parameter: '#ffb27a', function: '#7fd4ff', 'string-expression': '#a5e8c9',
    punctuation: '#93a2bf', link: '#8fd9ff',
  },
  light: {
    constant: '#1f4fa8', string: '#136b4a', comment: '#5b6880', keyword: '#7a2f9e',
    parameter: '#a4531a', function: '#0d5c9e', 'string-expression': '#135f43',
    punctuation: '#45516a', link: '#0d5c9e',
  },
}

/**
 * 表面定义 → rgba()。
 * @param def [r,g,b] + 设计不透明度。
 * @param fx 0..1 强度系数（强度越低面板越实）。
 * @param ui 0..1 界面不透明度系数（使用者可调，1 = 设计值）。
 */
function PAL_surface(def, fx, ui) {
  const scale = ui === undefined ? 1 : U_clamp(ui, 0, 1)
  return PAL_rgba(def[0], U_alpha(U_clamp(def[1] * scale, 0, 1), fx))
}

/**
 * [r,g,b] + 固定 alpha → rgba()。
 * @param rgb 三元组。
 * @param alpha 0..1。
 */
function PAL_rgba(rgb, alpha) {
  return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + Number(alpha.toFixed(3)) + ')'
}

/**
 * 生成整套令牌对。
 * @param fx 0..1 强度系数，只影响面板透明度。
 * @param ui 0..1 界面不透明度系数（可选；1 = 设计值，越小面板越透、壁纸越明显）。
 * @returns { '--dsw-…': { light: '值', dark: '值' } }。
 */
function PAL_pair(fx, ui) {
  const acc = PAL_ACCENT
  const out = {}
  /** 本层表面：同时吃强度与界面不透明度两个系数。 */
  const surf = function (def) {
    return PAL_surface(def, fx, ui)
  }
  /** 登记当前档位的一个令牌取值。 */
  const set = function (name, value) {
    if (!out[name]) out[name] = {}
    out[name][scheme] = value
  }
  let scheme = 'dark'

  for (const each of ['light', 'dark']) {
    scheme = each
    const s = PAL_SURFACE[each]
    const t = PAL_TEXT[each]
    const a = acc[each]
    const isDark = each === 'dark'
    const line = U_hex(t.line)
    /** 描边四档。 */
    const ln = function (i) {
      return U_a(line, t.lineA[i])
    }
    /** 强调色透明变体。 */
    const acc1 = function (alpha) {
      return U_a(a.a1, alpha)
    }
    const acc2 = function (alpha) {
      return U_a(a.a2, alpha)
    }
    const red = function (alpha) {
      return U_a(a.red, alpha)
    }
    const ok = function (alpha) {
      return U_a(a.ok, alpha)
    }
    const gold = function (alpha) {
      return U_a(a.gold, alpha)
    }
    const masked = function (i) {
      return PAL_rgba(t.masked, t.maskedA[i])
    }
    /** 主按钮填色：夜档霜白配深墨字，昼档深强调色配白字。 */
    const primaryFill = isDark ? U_mix('#eaf4ff', a.a1s, 0.35) : a.a1s
    const primaryHover = isDark ? '#ffffff' : U_mix(a.a1s, '#000000', 0.22)

    /* —— 背景 —— */
    set('--dsw-alias-bg-base', surf(s.base))
    set('--dsw-alias-bg-layer-1', surf(s.l1))
    set('--dsw-alias-bg-layer-2', surf(s.l2))
    set('--dsw-alias-bg-layer-3', surf(s.l3))
    set('--dsw-alias-bg-overlay', surf(s.overlay))
    set('--dsw-alias-bg-module-platform', surf(s.l2))
    set('--dsw-alias-bg-multi-select', surf(s.l1))
    set('--dsw-alias-bg-document-preview', surf(s.l2))
    set('--dsw-alias-bg-skeleton', isDark ? acc1(0.06) : PAL_rgba(t.line, 0.05))
    set('--dsw-alias-bg-document-selection', acc1(0.32))
    set('--dsw-alias-bg-mask-1', masked(0))
    set('--dsw-alias-bg-mask-2', masked(1))
    set('--dsw-alias-bg-mask-3', masked(2))
    set('--dsw-alias-bg-mask-photo', PAL_rgba(t.masked, isDark ? 0.88 : 0.86))
    set('--dsw-alias-bg-mask-drop', isDark ? surf(s.l1) : PAL_rgba([255, 255, 255], 0.72))

    /* —— 文字 —— */
    set('--dsw-alias-label-primary', t.txt)
    set('--dsw-alias-label-secondary', t.txt2)
    set('--dsw-alias-label-tertiary', t.txt3)
    set('--dsw-alias-label-caption', t.cap)
    set('--dsw-alias-label-dimmed', t.dim)
    set('--dsw-alias-label-primary-dimmed', t.txtDim)
    set('--dsw-alias-label-primary-bluish', isDark ? t.txtDim : U_mix(a.a1, '#000000', 0.25))
    set('--dsw-alias-label-primary-foreground', t.ink)
    set('--dsw-alias-label-primary-inverted', t.inv)
    set('--dsw-alias-label-document-preview', t.txt2)
    set('--dsw-alias-label-shimmer', isDark ? U_a('#ffffff', 0.45) : U_a('#000000', 0.3))
    set('--dsw-alias-label-deep-diving', a.a1)
    set('--dsw-alias-label-deep-diving-shimmer', isDark ? U_mix(a.a1s, a.a1, 0.35) : U_mix(a.a1, '#ffffff', 0.35))

    /* —— 描边 —— */
    // 比宿主默认略明显一点：硬边描边是 ZZZ 的语言，但仍停在「很淡的一根线」上。
    set('--dsw-alias-border-l1', ln(0))
    set('--dsw-alias-border-l2', ln(1))
    set('--dsw-alias-border-l2-darkmode-thin', ln(0))
    set('--dsw-alias-border-l3', ln(2))
    set('--dsw-alias-border-l4', ln(3))
    set('--dsw-alias-border-inverted', isDark ? U_a('#ffffff', 0.06) : 'rgba(0, 0, 0, 0)')
    set('--dsw-alias-border-inverted2', isDark ? U_a('#ffffff', 0.08) : 'rgba(0, 0, 0, 0)')

    /* —— 品牌与按钮 —— */
    set('--dsw-alias-brand-primary', primaryFill)
    set('--dsw-alias-brand-primary-invert', primaryFill)
    set('--dsw-alias-brand-text', a.a1)
    set('--dsw-alias-brand-primary-new-colorprimary-new-color', a.a1)
    set('--dsw-alias-button-primary-fill', primaryFill)
    set('--dsw-alias-button-primary-hover', primaryHover)
    set('--dsw-alias-button-primary-dimmed', isDark ? acc1(0.16) : U_a(a.a1s, 0.12))
    set('--dsw-alias-button-contrast-fill', isDark ? '#f2f8ff' : U_mix('#39445c', a.a1s, 0.25))
    set('--dsw-alias-button-elevated-fill', surf(s.fill))
    set('--dsw-alias-button-floating-fill', surf(s.l1))
    set('--dsw-alias-button-floating-hover', surf(s.l2))
    set('--dsw-alias-button-ghost-active-fill', acc1(isDark ? 0.16 : 0.12))
    set('--dsw-alias-button-ghost-active-hover', acc1(isDark ? 0.24 : 0.18))
    set('--dsw-alias-button-ghost-active-border', acc1(isDark ? 0.55 : 0.45))
    set('--dsw-alias-button-info-fill', a.a1)
    set('--dsw-alias-button-info-hover', isDark ? a.a1s : U_mix(a.a1, '#000000', 0.16))
    set('--dsw-alias-button-tool-bar-fill', acc1(isDark ? 0.1 : 0.09))
    set('--dsw-alias-button-tool-bar-hover', acc1(isDark ? 0.18 : 0.16))
    set('--dsw-alias-button-tool-bar-fill-invisible', isDark ? U_a('#06080f', 0.42) : PAL_rgba(t.line, 0.28))

    /* —— 交互态 —— */
    set('--dsw-alias-interactive-bg-hover', acc1(isDark ? 0.08 : 0.07))
    set('--dsw-alias-interactive-bg-active', acc1(isDark ? 0.15 : 0.13))
    set('--dsw-alias-interactive-bg-hover-accent', acc2(isDark ? 0.2 : 0.12))
    set('--dsw-alias-interactive-bg-hover-danger', red(isDark ? 0.16 : 0.1))
    set('--dsw-alias-interactive-bg-hover-solid', surf(s.ghost))

    /* —— 语义态 —— */
    set('--dsw-alias-state-business-primary', a.a1)
    set('--dsw-alias-state-business-tertiary', acc1(isDark ? 0.22 : 0.12))
    set('--dsw-alias-state-error-primary', a.red)
    set('--dsw-alias-state-error-secondary', U_mix(a.red, '#ffffff', isDark ? 0.3 : 0.15))
    set('--dsw-alias-state-idle-primary', isDark ? '#4a5570' : '#c3ccdb')
    set('--dsw-alias-state-success-primary', a.ok)
    set('--dsw-alias-state-success-secondary', U_mix(a.ok, '#ffffff', 0.25))
    set('--dsw-alias-state-success-tertiary', ok(isDark ? 0.16 : 0.12))
    set('--dsw-alias-state-warn-primary', a.gold)
    set('--dsw-alias-state-warn-secondary', U_mix(a.gold, '#ffffff', 0.28))
    set('--dsw-alias-state-warn-tertiary', gold(isDark ? 0.14 : 0.12))
    set('--dsw-alias-state-warn-label', isDark ? a.gold : U_mix(a.gold, '#000000', 0.2))

    /* —— 其他别名 —— */
    set('--dsw-alias-link', a.a1)
    set('--dsw-alias-menu-icon', isDark ? t.txtDim : U_a(a.a1, 0.85))
    set('--dsw-alias-markdown-code-block', surf(s.code))
    set('--dsw-alias-markdown-code-block-banner', surf(s.codeHi))
    set('--dsw-alias-markdown-code-segment-selected', surf(s.l3))
    set('--dsw-alias-markdown-code-segment-unselected', surf(s.code))
    set('--dsw-alias-markdown-inline-code', acc1(isDark ? 0.11 : 0.09))
    set('--dsw-alias-markdown-tag', surf(s.sel))
    set('--dsw-alias-markdown-placeholder', surf(s.l2))
    set('--dsw-alias-markdown-citation', surf(s.l3))
    set('--dsw-alias-scrollbar-bg-l1', isDark ? acc1(0.14) : PAL_rgba(t.line, 0.16))
    set('--dsw-alias-scrollbar-bg-l2', isDark ? acc1(0.22) : PAL_rgba(t.line, 0.22))
    set('--dsw-alias-scrollbar-hover-l1', acc1(isDark ? 0.3 : 0.34))
    set('--dsw-alias-scrollbar-hover-l2', acc1(isDark ? 0.42 : 0.44))
    set('--dsw-alias-switch-thumb', isDark ? '#dfeaff' : '#ffffff')
    set('--dsw-alias-toast-bg', isDark ? PAL_rgba(s.l3[0], 0.97) : PAL_rgba([24, 32, 52], 0.97))
    set('--dsw-alias-toast-label', '#f4f8ff')
    set('--dsw-alias-tooltip-bg', isDark ? PAL_rgba(s.sel[0], 0.98) : PAL_rgba([24, 32, 52], 0.98))
    set('--dsw-alias-tooltip-key-bg', isDark ? PAL_rgba([58, 64, 98], 0.95) : PAL_rgba([62, 72, 100], 0.95))
    set('--dsw-alias-turn-trigger-bg', acc1(isDark ? 0.07 : 0.06))
    set('--dsw-alias-turn-trigger-bg-hover', acc1(isDark ? 0.13 : 0.11))
    set('--dsw-alias-code-diff-added', ok(isDark ? 0.12 : 0.1))
    set('--dsw-alias-code-diff-deleted', red(isDark ? 0.12 : 0.1))
    set('--dsw-alias-file-diff-added-bg', isDark ? '#152e26' : '#e6f4ee')
    set('--dsw-alias-file-diff-added-gutter', isDark ? '#102620' : '#eef8f3')
    set('--dsw-alias-file-diff-added-marker', a.ok)
    set('--dsw-alias-file-diff-deleted-bg', isDark ? '#331821' : '#fbe9ec')
    set('--dsw-alias-file-diff-deleted-gutter', isDark ? '#28121a' : '#fdf0f2')
    set('--dsw-alias-file-diff-deleted-marker', isDark ? a.red : U_mix(a.red, '#000000', 0.1))
    set('--dsw-alias-settings-card-fill', surf(s.l2))
    set('--dsw-alias-settings-card-stroke', ln(1))

    /* —— 具名区域 —— */
    set('--dsw-specific-bubble', surf(s.bubble))
    set('--dsw-specific-bubble-highlight', surf(s.bubbleHi))
    set('--dsw-specific-input-major', surf(s.input))
    set('--dsw-specific-login-input', surf(s.code))
    set('--dsw-specific-menu', surf(s.menu))
    set('--dsw-specific-selector', surf(s.sel))
    set('--dsw-specific-tip', surf(s.sel))
    set('--dsw-specific-sidebar-fill', surf(s.side))
    set('--dsw-specific-sidebar-nav-item-hover', acc1(isDark ? 0.08 : 0.07))
    set('--dsw-specific-sidebar-nav-item-active', acc1(isDark ? 0.14 : 0.12))
    set('--dsw-specific-sidebar-nav-item-active-accent', acc1(isDark ? 0.22 : 0.18))

    /* —— 非 alias 前缀的 --dsw-*（菜单面板） —— */
    set('--dsw-menu-surface-fill', surf(s.menu))
    set('--dsw-alias-menu-group-header-fill', isDark ? PAL_rgba(s.l2[0], 0.94) : PAL_rgba([238, 244, 252], 0.96))

    /* —— 代码高亮 —— */
    const syn = PAL_SYNTAX[each]
    set('--shiki-foreground', t.txt)
    set('--shiki-background', surf(s.code))
    for (const key of Object.keys(syn)) set('--shiki-token-' + key, syn[key])
  }

  return out
}

/**
 * 取出某一档的扁平令牌表，供 ctx.theme.register() 使用。
 * @param pair PAL_pair() 的结果。
 * @param scheme 'dark' | 'light'。
 */
function PAL_flat(pair, scheme) {
  const out = {}
  for (const name of Object.keys(pair)) out[name] = pair[name][scheme]
  return out
}

/**
 * 身份层要用的 CSS 变量（挂在 documentElement 上，不属于宿主令牌体系）。
 * 强调色、各效果层的不透明度都在这里算好；改配置只需要重写这些变量，
 * 不必重建样式表。
 * @param cfg 配置快照。
 * @param scheme 当前生效档位。
 * @returns { '--sym-…': '值' }。
 */
function PAL_vars(cfg, scheme) {
  const a = PAL_ACCENT[scheme]
  const fx = U_clamp(cfg.intensity / 100, 0, 1)
  const motion = ENV_motion(cfg)
  /** 效果层不透明度：开关关掉即 0，否则按强度线性缩放。 */
  const layer = function (on, base) {
    return on ? Number((base * fx).toFixed(4)) : 0
  }
  return {
    '--sym-fx': fx.toFixed(3),
    '--sym-accent': a.a1,
    '--sym-accent-soft': a.a1s,
    '--sym-accent-deep': a.a1d,
    '--sym-accent-2': a.a2,
    '--sym-gold': a.gold,
    '--sym-red': a.red,
    '--sym-ok': a.ok,
    '--sym-ink': scheme === 'dark' ? '#070a12' : '#ffffff',
    '--sym-accent-rgb': U_rgb(a.a1).join(' '),
    // 各效果层：强度 0 时全部为 0，只剩令牌换色。
    // 明暗两档给不同基数 —— 浅色底上扫描线要更淡，否则整屏发灰。
    '--sym-scan-a': layer(cfg.scanlines, scheme === 'dark' ? 0.085 : 0.05),
    '--sym-grain-a': layer(cfg.grain, scheme === 'dark' ? 0.06 : 0.05),
    '--sym-vig-a': layer(cfg.vignette, scheme === 'dark' ? 0.55 : 0.3),
    '--sym-hud-a': layer(cfg.hud, scheme === 'dark' ? 1 : 0.85),
    '--sym-glitch-a': layer(cfg.glitch && motion === 'full', scheme === 'dark' ? 0.5 : 0.35),
    // 动效开关：CSS 侧据此停掉所有动画
    '--sym-run': motion === 'off' ? 'paused' : 'running',
  }
}
