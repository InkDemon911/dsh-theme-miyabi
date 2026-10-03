/* ═══════════════════════════════════════════════════════════════════════════
 * 7. 动效：霜点粒子、斩击、暗号
 *
 * 一条硬性规则：所有动画只改 transform / opacity。
 * 另一条：动效档位为 off（或系统 prefers-reduced-motion 命中）时，
 * 这些元素**根本不渲染** —— 不是靠 CSS 藏，而是不产生 DOM。
 *
 * 本版已移除声音模块：斩击只有刀光，没有音效，代码里也不存在任何音频上下文。
 *
 * 命名约定：本段用 FX_ 前缀。
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 瞬时特效总线：一次性事件（斩击、浮字）不放进配置快照，走这里。 */
const FX_bus = { listeners: new Set(), seq: 0 }

/**
 * 订阅瞬时特效。
 * @param listener 收到 { kind, id, text }。
 * @returns 取消订阅。
 */
function FX_subscribe(listener) {
  FX_bus.listeners.add(listener)
  return function () {
    FX_bus.listeners.delete(listener)
  }
}

/**
 * 触发一个瞬时特效。
 * @param kind 'slash' | 'flash'。
 * @param text flash 用的文字。
 */
function FX_fire(kind, text) {
  FX_bus.seq += 1
  const event = { kind: kind, id: FX_bus.seq, text: text || '' }
  for (const listener of Array.from(FX_bus.listeners)) {
    try {
      listener(event)
    } catch (err) {
      console.error('[dsh-theme-miyabi] fx listener failed', err)
    }
  }
}

/** 线性同余伪随机（可复现，粒子位置在重渲染之间稳定）。 */
function FX_rand(seed) {
  let s = seed >>> 0
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * 生成一批粒子的静态参数。
 * @param count 片数。
 * @returns 参数数组。
 */
function FX_particleSpecs(count) {
  const rand = FX_rand(0x5eed + count * 977)
  const out = []
  for (let i = 0; i < count; i += 1) {
    out.push({
      left: rand() * 100,
      size: 7 + rand() * 13,
      // 时长拉长且有差异，避免整屏同频闪动
      dur: 13 + rand() * 17,
      delay: -rand() * 26,
      drift: (rand() * 2 - 1) * 16,
      alpha: 0.22 + rand() * 0.5,
    })
  }
  return out
}

/**
 * 粒子层组件：霜晶（唯一形态，与「霜」这一档一致）。
 * @param props { level, motion }。
 */
function FX_Particles(props) {
  const count = props.motion === 'off' ? 0 : ENV_particleCount(props.level)
  const specs = React.useMemo(
    function () {
      return FX_particleSpecs(count)
    },
    [count],
  )
  if (!count) return null
  const image = ART_flake('#ffffff')
  return h(
    'div',
    { className: 'miyabi-particles', 'aria-hidden': 'true' },
    specs.map(function (spec, i) {
      return h('i', {
        key: i,
        className: 'miyabi-particle',
        style: {
          left: spec.left + '%',
          width: spec.size + 'px',
          height: spec.size + 'px',
          backgroundImage: image,
          animationDuration: spec.dur + 's',
          animationDelay: spec.delay + 's',
          '--sym-drift': spec.drift + 'vw',
          '--sym-particle-a': spec.alpha,
        },
      })
    }),
  )
}

/**
 * 斩击层：一次触发播放一遍，靠 key 重挂载重放动画。
 * @param props { id } —— id 变化即重播。
 */
function FX_Slash(props) {
  void props
  return h(
    'div',
    { className: 'miyabi-slash', 'aria-hidden': 'true' },
    h('i', { className: 'miyabi-slash-blade' }),
    h('i', { className: 'miyabi-slash-crack' }),
  )
}

/**
 * 挂上"发送即斩击 + 暗号"的监听。
 * 只读事件目标与它的值，不检索其它插件的 DOM。
 * @param getCfg 返回当前配置。
 * @returns 卸载函数。
 */
function FX_attachKeys(getCfg) {
  /** 暗号：命中时给一行浮字，平时发送只走刀光。 */
  const PASS = /^(miyabi|shimotsuki|霜月|虚狩|星见雅)$/i
  const onKeyDown = function (event) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    const target = event.target
    if (!target) return
    const editable = target.tagName === 'TEXTAREA' || target.isContentEditable === true
    if (!editable) return
    const cfg = getCfg()
    if (!cfg.enabled || !cfg.easterEgg) return
    const value = String(
      target.tagName === 'TEXTAREA' ? target.value : target.textContent || '',
    ).trim()
    if (PASS.test(value)) {
      FX_fire('flash', '虚狩 · 出雲')
      FX_fire('slash')
      return
    }
    FX_fire('slash')
  }
  document.addEventListener('keydown', onKeyDown, true)
  return function () {
    document.removeEventListener('keydown', onKeyDown, true)
  }
}
