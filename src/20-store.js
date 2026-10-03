/* ═══════════════════════════════════════════════════════════════════════════
 * 2. 配置存储、月相计算、环境感知
 *
 * 配置为什么放 localStorage 而不是宿主设置文档：第三方令牌层没有写入宿主
 * settings 的通道（ctx.theme.setTheme 只持久化内建偏好 light/dark/system），
 * 所以皮肤自己持有状态。这也是生态里其它主题插件的做法。
 * 命名约定：本段用 CFG_ / MOON_ / ENV_ 前缀。
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 出厂默认值。任何一项都能在设置页里改，改完立即持久化。 */
const CFG_DEFAULTS = Object.freeze({
  // 设计基线版本：跟着 META_CFG_REV 走，用来判断盘里的值是哪一版基线。
  cfgRev: META_CFG_REV,
  enabled: true,
  // 强度：0 = 只换配色（面板不透明、无氛围），100 = 完整氛围 + 通透面板。
  intensity: 78,
  // 界面不透明度：100% = 设计值（壁纸能明显透出来），越小面板越透、壁纸越清楚。
  // 下限 40% 是为了不给出一个「字都压不住」的可用状态。
  panelOpacity: 100,
  // 立绘：按高度贴合，位置可选（默认贴左），这里只调浓淡。
  art: 'left',
  artOpacity: 42,
  motion: 'full',
  particles: 'mid',
  scanlines: true,
  grain: true,
  vignette: true,
  glitch: true,
  hud: true,
  console: 'tab',
  consolePos: null,
  followHostAppearance: false,
  easterEgg: true,
})

/** 从原始对象里取一个合法枚举值，坏值退回 fallback。 */
function CFG_pickEnum(raw, key, fallback) {
  const value = raw[key]
  return META_ENUM[key].indexOf(value) >= 0 ? value : fallback
}

/** 取一个布尔标记（兼容旧数据里可能出现的 'on'/'true'）。 */
function CFG_pickBool(raw, key, fallback) {
  const value = raw[key]
  if (typeof value === 'boolean') return value
  if (value === 'on' || value === 'true') return true
  if (value === 'off' || value === 'false') return false
  return fallback
}

/** 取一个范围内的整数。 */
function CFG_pickInt(raw, key, lo, hi, fallback) {
  const value = Number(raw[key])
  if (!Number.isFinite(value)) return fallback
  return Math.round(U_clamp(value, lo, hi))
}

/**
 * 把任意来源的对象归一化成一份完整、合法的配置。
 * 存储坏了、字段缺了、枚举值过期了，都只会退到默认值，不会把坏值带进样式层。
 * 上一版删掉的键（mode / pattern / art / artSource / sound / volume …）在这里
 * 自然被忽略 —— 归一化的输出只包含下面列出的字段。
 * @param raw 原始对象（来自 localStorage 或调用方）。
 * @returns 归一化后的新对象。
 */
function CFG_normalize(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const pos = src.consolePos
  const hasPos =
    pos && typeof pos === 'object' && Number.isFinite(Number(pos.x)) && Number.isFinite(Number(pos.y))
  return {
    cfgRev: META_CFG_REV,
    enabled: CFG_pickBool(src, 'enabled', CFG_DEFAULTS.enabled),
    intensity: CFG_pickInt(src, 'intensity', 0, 100, CFG_DEFAULTS.intensity),
    panelOpacity: CFG_pickInt(src, 'panelOpacity', 40, 100, CFG_DEFAULTS.panelOpacity),
    art: CFG_pickEnum(src, 'art', CFG_DEFAULTS.art),
    artOpacity: CFG_pickInt(src, 'artOpacity', 4, 100, CFG_DEFAULTS.artOpacity),
    motion: CFG_pickEnum(src, 'motion', CFG_DEFAULTS.motion),
    particles: CFG_pickEnum(src, 'particles', CFG_DEFAULTS.particles),
    scanlines: CFG_pickBool(src, 'scanlines', CFG_DEFAULTS.scanlines),
    grain: CFG_pickBool(src, 'grain', CFG_DEFAULTS.grain),
    vignette: CFG_pickBool(src, 'vignette', CFG_DEFAULTS.vignette),
    glitch: CFG_pickBool(src, 'glitch', CFG_DEFAULTS.glitch),
    hud: CFG_pickBool(src, 'hud', CFG_DEFAULTS.hud),
    console: CFG_pickEnum(src, 'console', CFG_DEFAULTS.console),
    consolePos: hasPos ? { x: Math.round(Number(pos.x)), y: Math.round(Number(pos.y)) } : null,
    followHostAppearance: CFG_pickBool(
      src,
      'followHostAppearance',
      CFG_DEFAULTS.followHostAppearance,
    ),
    easterEgg: CFG_pickBool(src, 'easterEgg', CFG_DEFAULTS.easterEgg),
  }
}

/** 读 localStorage；任何异常都当作"没有存过"。 */
function CFG_read() {
  try {
    const raw = window.localStorage.getItem(META_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    // 设计基线升版：丢掉盘里的基线字段，让它们回到新默认（用户偏好不动）
    if (Number(parsed.cfgRev) !== META_CFG_REV) {
      for (const key of META_CFG_REBASE) delete parsed[key]
      parsed.cfgRev = META_CFG_REV
    }
    return parsed
  } catch (err) {
    return null
  }
}

/** 写 localStorage；隐私模式下写入失败不影响运行（只是不持久化）。 */
function CFG_persist(state) {
  try {
    window.localStorage.setItem(META_LS_KEY, JSON.stringify(state))
  } catch (err) {
    /* 忽略：配置仍然在当前会话内生效 */
  }
}

/** 当前配置（不可变引用；变更时整体替换，配合 useSyncExternalStore）。 */
let CFG_state = CFG_normalize(CFG_read())
/** 订阅者集合：设置页、控制条、画面层都从这里取快照。 */
const CFG_subscribers = new Set()

/** 读取快照（同一份引用直到下一次变更）。 */
function CFG_snapshot() {
  return CFG_state
}

/**
 * 订阅配置变化。
 * @param listener 变更回调。
 * @returns 取消订阅。
 */
function CFG_subscribe(listener) {
  CFG_subscribers.add(listener)
  return function () {
    CFG_subscribers.delete(listener)
  }
}

/** 通知所有订阅者（同步；调用方负责后续的视觉同步）。 */
function CFG_emit() {
  for (const listener of Array.from(CFG_subscribers)) {
    try {
      listener()
    } catch (err) {
      console.error('[dsh-theme-miyabi] config listener failed', err)
    }
  }
}

/**
 * 合并并写入配置。值先归一化再比较：归一化后没有变化就不通知、不写盘，
 * 于是设置页里重复点同一个按钮不会产生任何副作用。
 * @param patch 局部更新。
 * @returns 是否真的发生了变化。
 */
function CFG_set(patch) {
  const next = CFG_normalize(Object.assign({}, CFG_state, patch))
  let changed = false
  for (const key of Object.keys(CFG_DEFAULTS)) {
    const a = CFG_state[key]
    const b = next[key]
    const same =
      a && b && typeof a === 'object' && typeof b === 'object'
        ? JSON.stringify(a) === JSON.stringify(b)
        : a === b
    if (!same) {
      changed = true
      break
    }
  }
  if (!changed) return false
  CFG_state = next
  CFG_persist(next)
  CFG_emit()
  return true
}

/** 恢复出厂默认。 */
function CFG_reset() {
  CFG_state = CFG_normalize(CFG_DEFAULTS)
  CFG_persist(CFG_state)
  CFG_emit()
}

/* ── 月相 ──────────────────────────────────────────────────────────────────
 * 用平均朔望月长度从一次已知朔（2000-01-06 18:14 UTC）推算相位，
 * 精度对一枚 HUD 图标完全够用，且不含任何外部数据。 */
const MOON_SYNODIC = 29.530588853
const MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14) / 86400000

/**
 * 相位分数。
 * @param date 需要计算的时间，默认现在。
 * @returns 0 = 朔，0.5 = 望。
 */
function MOON_phase(date) {
  const days = (date ? date.getTime() : Date.now()) / 86400000
  const raw = ((days - MOON_EPOCH) / MOON_SYNODIC) % 1
  return raw < 0 ? raw + 1 : raw
}

/**
 * 受光部分相对半径 R 的 SVG 路径（圆心在 0,0）。
 * 明暗界线是半短轴 rx=R·|cos(2πp)| 的椭圆：朔望两端退化成整圆／直线，
 * 上下弦退化成半圆，几何上就是真实的月相形状。
 * @param phase MOON_phase 的结果。
 * @param radius 半径（px）。
 */
function MOON_litPath(phase, radius) {
  const R = radius
  const c = Math.cos(2 * Math.PI * phase)
  const rx = Math.abs(c) * R
  const right = phase < 0.5
  const bulge = c > 0
  const half = right ? 1 : 0
  const term = right === bulge ? 0 : 1
  return (
    'M0,' + -R + ' A' + R + ',' + R + ' 0 0 ' + half + ' 0,' + R +
    ' A' + rx.toFixed(2) + ',' + R + ' 0 0 ' + term + ' 0,' + -R + ' Z'
  )
}

/* ── 环境感知 ────────────────────────────────────────────────────────────── */
/** 系统是否要求减少动态效果。 */
function ENV_reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch (err) {
    return false
  }
}

/**
 * 实际生效的动效档位：系统要求减少动效时一律降到 off，
 * 无论用户在设置页里选了什么。
 * @param cfg 配置快照。
 */
function ENV_motion(cfg) {
  return ENV_reducedMotion() ? 'off' : cfg.motion
}

/** 粒子数量档位换算成实际片数。 */
const PARTICLE_COUNT = { off: 0, low: 14, mid: 34, high: 64 }

/**
 * 按当前屏幕面积缩放粒子数量：窄屏少放，避免在手机上白烧 GPU。
 * @param level 档位名。
 */
function ENV_particleCount(level) {
  const base = PARTICLE_COUNT[level] || 0
  if (!base) return 0
  const w = window.innerWidth || 1280
  const h = window.innerHeight || 800
  const scale = U_clamp((w * h) / (1440 * 900), 0.45, 1)
  return Math.max(1, Math.round(base * scale))
}
