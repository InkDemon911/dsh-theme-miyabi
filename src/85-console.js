/* ═══════════════════════════════════════════════════════════════════════════
 * 9. 挂件层：氛围浮层（CRT + HUD + 粒子 + 斩击）与快速控制条
 *
 * 这一整块注册进 shell.overlay —— 槽位目录写明它是「帧级浮层、在所有列之上、
 * 点击穿透」，正是横幅级装饰该待的地方：它是**纯新增**的座位，
 * 不会顶掉宿主任何东西。
 *   氛围层：pointer-events: none
 *   控制条：只有它自己恢复指针
 *
 * 命名约定：本段用 UI_ 前缀。
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 月相图标：暗盘 + 受光部分（几何上就是真实月相形状）。
 * @param props { size }。
 */
function UI_Moon(props) {
  const size = props.size || 16
  const phase = MOON_phase(new Date())
  const r = size / 2 - 1
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 ' + size + ' ' + size,
      'aria-hidden': 'true',
      style: { display: 'block' },
    },
    h('circle', { cx: size / 2, cy: size / 2, r: r, fill: 'currentColor', opacity: 0.22 }),
    h('path', {
      d: MOON_litPath(phase, r),
      transform: 'translate(' + size / 2 + ' ' + size / 2 + ')',
      fill: 'currentColor',
    }),
  )
}

/**
 * 烈霜图标：与粒子同一个雪花图样（矢量化自使用者提供的徽记），
 * 颜色走 currentColor —— 沿用各处的原色。
 * @param props { size }。
 */
function UI_Flake(props) {
  const size = props.size || 14
  const emblem = ART_EMBLEM && ART_EMBLEM.path ? ART_EMBLEM : null
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: emblem ? emblem.viewBox : '0 0 64 64',
      'aria-hidden': 'true',
      style: { display: 'block' },
    },
    emblem
      ? h('path', { d: emblem.path, fill: 'currentColor', fillRule: emblem.fillRule || 'evenodd' })
      : ART_FLAKE_ARMS.map(function (arm) {
          return h('path', {
            key: arm.angle + '-' + arm.h,
            d: ART_flakeArm(arm.h),
            fill: 'currentColor',
            transform: 'translate(32 32) rotate(' + arm.angle + ')',
          })
        }),
  )
}

/**
 * 氛围浮层：全部是装饰，aria-hidden，不接收指针。
 * @param props { cfg, scheme, slash, flash }。
 */
function UI_Atmosphere(props) {
  const cfg = props.cfg
  const fxEnabled = cfg.enabled
  return h(
    'div',
    { className: 'miyabi-fx', 'aria-hidden': 'true' },
    fxEnabled && cfg.scanlines ? h('div', { className: 'miyabi-fx miyabi-fx-scan' }) : null,
    fxEnabled && cfg.grain ? h('div', { className: 'miyabi-fx miyabi-fx-grain' }) : null,
    fxEnabled && cfg.vignette ? h('div', { className: 'miyabi-fx miyabi-fx-vig' }) : null,
    fxEnabled && cfg.glitch && ENV_motion(cfg) === 'full'
      ? h('div', { className: 'miyabi-fx miyabi-fx-glitch' })
      : null,
    fxEnabled && ENV_motion(cfg) === 'full' ? h('div', { className: 'miyabi-fx miyabi-fx-roll' }) : null,
    fxEnabled
      ? h(FX_Particles, { level: cfg.particles, motion: ENV_motion(cfg) })
      : null,
    fxEnabled && cfg.hud ? h(UI_Hud, { t: UI_t }) : null,
    props.slash ? h(FX_Slash, { key: props.slash }) : null,
    props.flash
      ? h('div', { key: props.flash.id, className: 'miyabi-flash' }, props.flash.text)
      : null,
  )
}

/**
 * HUD：四角括号、警示条、竖排标签。
 * @param props { t }。
 */
function UI_Hud(props) {
  const t = props.t
  return h(
    'div',
    { className: 'miyabi-hud', 'aria-hidden': 'true' },
    h('div', { className: 'miyabi-hud-tape' }),
    h('div', { className: 'miyabi-hud-corner is-tl' }),
    h('div', { className: 'miyabi-hud-corner is-tr' }),
    h('div', { className: 'miyabi-hud-corner is-bl' }),
    h('div', { className: 'miyabi-hud-corner is-br' }),
    h('div', { className: 'miyabi-hud-label is-tl' }, t('hud.void')),
    h('div', { className: 'miyabi-hud-label is-tr' }, t('meta.title')),
    h(
      'div',
      { className: 'miyabi-hud-label is-bl' },
      h('span', { className: 'miyabi-hud-gold' }, t('hud.section')),
      ' · H.S.O.S.6',
    ),
  )
}

/**
 * 快速控制条。
 * @param props { cfg, rt }。
 */
function UI_Dock(props) {
  const cfg = props.cfg
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState(cfg.consolePos)
  const [dragging, setDragging] = React.useState(false)
  const barRef = React.useRef(null)
  const dragRef = React.useRef(null)
  const t = UI_t

  // 位置写回配置：拖动结束后才落盘，拖动过程只改本地 state。
  React.useEffect(
    function () {
      setPos(cfg.consolePos)
    },
    [cfg.consolePos],
  )

  // ESC 收起快速设置（与宿主其它浮层的习惯一致）
  React.useEffect(
    function () {
      if (!open) return undefined
      const onKey = function (event) {
        if (event.key === 'Escape') setOpen(false)
      }
      document.addEventListener('keydown', onKey)
      return function () {
        document.removeEventListener('keydown', onKey)
      }
    },
    [open],
  )

  const onPointerDown = function (event) {
    if (event.button !== 0) return
    // 点在按钮上不触发拖动，避免按钮点不动
    if (event.target.closest && event.target.closest('button')) return
    const el = barRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, moved: false }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = function (event) {
    const drag = dragRef.current
    if (!drag) return
    drag.moved = true
    const el = barRef.current
    const w = el ? el.offsetWidth : 200
    const hh = el ? el.offsetHeight : 36
    const x = U_clamp(event.clientX - drag.dx, 6, Math.max(6, window.innerWidth - w - 6))
    const y = U_clamp(event.clientY - drag.dy, 6, Math.max(6, window.innerHeight - hh - 6))
    setPos({ x: Math.round(x), y: Math.round(y) })
  }

  const onPointerUp = function (event) {
    const drag = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.releasePointerCapture) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch (err) {
        /* 指针已释放 */
      }
    }
    if (drag && drag.moved) CFG_set({ consolePos: pos })
  }

  const dockStyle = pos
    ? { left: pos.x + 'px', top: pos.y + 'px' }
    : { right: '18px', bottom: '18px' }

  const bumpIntensity = function (step) {
    CFG_set({ intensity: U_clamp(cfg.intensity + step, 0, 100) })
  }
  const cycle = function (key, values) {
    const at = values.indexOf(cfg[key])
    const next = values[(at + 1) % values.length]
    const patch = {}
    patch[key] = next
    CFG_set(patch)
  }

  if (cfg.console === 'off') return null

  // 图标态：只留一枚按钮，点开控制条
  if (cfg.console === 'tab') {
    return h(
      'div',
      { className: 'miyabi-dock', style: dockStyle },
      h(
        'button',
        {
          type: 'button',
          className: 'miyabi-dock-tab',
          title: t('console.expand'),
          'aria-label': t('console.expand'),
          onClick: function () {
            CFG_set({ console: 'bar' })
          },
        },
        h(UI_Moon, { size: 18 }),
      ),
    )
  }

  return h(
    'div',
    { className: 'miyabi-dock', style: dockStyle },
    open
      ? h(
          'div',
          { className: 'miyabi-pop', role: 'group', 'aria-label': t('console.panel') },
          h(
            'div',
            { className: 'miyabi-pop-row' },
            h('span', { className: 'miyabi-pop-label' }, t('panel.particles')),
            h(UI_Seg, {
              value: cfg.particles,
              options: UI_options('particles', META_ENUM.particles),
              label: t('panel.particles'),
              onChange: function (next) {
                CFG_set({ particles: next })
              },
            }),
          ),
          h(
            'div',
            { className: 'miyabi-pop-row' },
            h('span', { className: 'miyabi-pop-label' }, t('panel.motion')),
            h(UI_Seg, {
              value: cfg.motion,
              options: UI_options('motion', META_ENUM.motion),
              label: t('panel.motion'),
              onChange: function (next) {
                CFG_set({ motion: next })
              },
            }),
          ),
        )
      : null,
    h(
      'div',
      {
        className: 'miyabi-dock-bar' + (dragging ? ' is-dragging' : ''),
        ref: barRef,
        role: 'toolbar',
        'aria-label': t('console.toolbar'),
        title: t('console.drag'),
        onPointerDown: onPointerDown,
        onPointerMove: onPointerMove,
        onPointerUp: onPointerUp,
        onPointerCancel: onPointerUp,
      },
      h(
        'div',
        { className: 'miyabi-dock-group' },
        h(
          'button',
          {
            type: 'button',
            className: 'miyabi-dock-btn' + (cfg.enabled ? ' is-on' : ''),
            'aria-pressed': cfg.enabled ? 'true' : 'false',
            title: t('console.toggle'),
            onClick: function () {
              CFG_set({ enabled: !cfg.enabled })
            },
          },
          cfg.enabled ? '霜' : '·',
        ),
      ),
      h(
        'div',
        { className: 'miyabi-dock-group' },
        h(
          'button',
          {
            type: 'button',
            className: 'miyabi-dock-btn',
            title: t('console.intensity'),
            onClick: function () {
              bumpIntensity(-12)
            },
          },
          '−',
        ),
        h('span', { className: 'miyabi-dock-sep' }, cfg.intensity + '%'),
        h(
          'button',
          {
            type: 'button',
            className: 'miyabi-dock-btn',
            title: t('console.intensity'),
            onClick: function () {
              bumpIntensity(12)
            },
          },
          '＋',
        ),
      ),
      h(
        'div',
        { className: 'miyabi-dock-group' },
        h(
          'button',
          {
            type: 'button',
            className: 'miyabi-dock-btn',
            title: t('panel.particles'),
            onClick: function () {
              cycle('particles', META_ENUM.particles)
            },
          },
          h(UI_Flake, { size: 13 }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'miyabi-dock-moon',
            title: t('hud.phase'),
            'aria-label': t('hud.phase'),
            style: { color: 'var(--sym-accent)' },
            onClick: function () {
              FX_fire('slash')
            },
          },
          h(UI_Moon, { size: 16 }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'miyabi-dock-btn',
            'aria-expanded': open ? 'true' : 'false',
            title: t('console.panel'),
            onClick: function () {
              setOpen(!open)
            },
          },
          '☰',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'miyabi-dock-btn',
            title: t('console.collapse'),
            onClick: function () {
              setOpen(false)
              CFG_set({ console: 'tab' })
            },
          },
          '—',
        ),
      ),
    ),
  )
}

/** 控制条的位置修正：窗口变化后把浮层拉回可视区。 */
function UI_clampDockPos(pos) {
  if (!pos) return pos
  const w = window.innerWidth || 1280
  const hgt = window.innerHeight || 800
  return {
    x: U_clamp(pos.x, 6, Math.max(6, w - 240)),
    y: U_clamp(pos.y, 6, Math.max(6, hgt - 48)),
  }
}

/** overflow 修正：窗口尺寸变化时把已保存的位置夹回视口。 */
function UI_attachResizeFix() {
  const onResize = function () {
    const cfg = CFG_snapshot()
    if (!cfg.consolePos) return
    const fixed = UI_clampDockPos(cfg.consolePos)
    if (fixed.x !== cfg.consolePos.x || fixed.y !== cfg.consolePos.y) {
      CFG_set({ consolePos: fixed })
    }
  }
  window.addEventListener('resize', onResize)
  return function () {
    window.removeEventListener('resize', onResize)
  }
}
