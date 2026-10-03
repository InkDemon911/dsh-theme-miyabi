/* ═══════════════════════════════════════════════════════════════════════════
 * 1. 元信息、用语表、颜色工具
 *
 * 本文件是构建产物 client.js 的第 1 段。tools/build.mjs 会把 src/*.js 按文件名
 * 顺序拼进同一个工厂作用域，所以各段共享顶层 const，但**不得重名**。
 * 命名约定：本段用 META_ / TXT_ / U_ 前缀。
 *
 * 收敛后的形态：单一模式（霜）、单一底纹（斜切网格）、单一立绘（使用者提供的
 * 那张图，位置固定左侧）、无声音模块。
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 包名：同时是客户端模块表的条目名（module table key）。 */
const META_PKG = '@local/ui-skin-miyabi'
/** 注册进 ctx.theme 的主题 id（等于包名，便于 inspection 时一眼对上）。 */
const META_THEME = 'ui-skin-miyabi'
/** 本地偏好存储键。v2：与旧的青绿版皮肤不共用键，避免读到形状不同的旧数据。 */
const META_LS_KEY = 'ui-skin-miyabi:cfg:v2'
/**
 * 配置里的设计基线版本。
 *
 * 为什么需要它：`artOpacity` 这类值是**设计基线**而不是用户偏好 —— 它定的是
 * 「立绘该有多明显」。基线一旦调整（本版就是：立绘换成了一整张壁纸图），
 * 老用户盘里存着的旧值会把新默认顶掉，于是「明明改了却看不出变化」。
 * 升这个号 = 丢弃盘里那个基线字段、拉回新默认；真正的用户偏好
 * （开关、动效、粒子、控制条…）原样保留。
 */
const META_CFG_REV = 3
/** 升版时拉回新默认的字段（只放设计基线，不放用户偏好）。 */
const META_CFG_REBASE = ['artOpacity']
/** 打包内嵌的那张立绘在素材包里的键名（由 assets/ 文件名转小写得到）。 */
const META_ART_KEY = 'miyabi-wallpaper'
/** 客户端语言命名空间（挂在 ctx.locale 上）。 */
const META_NS = 'ui-skin-miyabi'
/** 身份层所有选择器的根作用域属性：关掉主题即摘下该属性，样式自然全部失效。 */
const META_ROOT_ATTR = 'data-miyabi-skin'

/** 枚举取值。写进配置前一律经过 META_ENUM 归一化，坏值不会流进样式层。 */
const META_ENUM = {
  // 立绘位置：无 / 贴左（默认）/ 贴右 / 右侧水印
  art: ['none', 'left', 'right', 'watermark'],
  motion: ['full', 'lite', 'off'],
  particles: ['off', 'low', 'mid', 'high'],
  console: ['off', 'tab', 'bar'],
}

/* ── 用语表 ────────────────────────────────────────────────────────────────
 * 全部可见文案都经 ctx.locale，zh / en 两份同时注册；语言链缺失时由 locale
 * 服务回退到 en。键名短、扁平，便于 diff。 */
const TXT_ZH = {
  'meta.title': '霜月雅刃',
  'meta.subtitle': '星见雅 · 虚狩',
  'nav': '霜月雅刃',
  'row.title': '霜月雅刃 · 星见雅主题',
  'row.desc': '霜蓝冷调令牌、斜切网格底纹、CRT 扫描线与噪点，立绘固定左侧。',
  'group.theme': '主题与配色',
  'group.scene': '壁纸与立绘',
  'group.fx': '动效与氛围',
  'group.behavior': '行为',
  'field.enabled': '启用主题',
  'field.enabled.hint': '关闭后完整还原宿主外观：撤掉令牌层、身份层与所有挂件。',
  'field.intensity': '主题强度',
  'field.intensity.hint': '0 = 只换配色（面板不透明、无氛围）；100 = 完整氛围与通透面板。',
  'field.panelOpacity': '界面不透明度',
  'field.panelOpacity.hint': '100% = 设计值（壁纸明显透出）；调低则面板更透、壁纸与立绘更清楚。',
  'field.art': '立绘位置',
  'field.art.hint': '无 / 贴左（默认）/ 贴右 / 右侧水印。按高度贴合，横向超出的部分由窗口裁掉。',
  'art.none': '无',
  'art.left': '贴左',
  'art.right': '贴右',
  'art.watermark': '右水印',
  'field.artOpacity': '立绘不透明度',
  'field.artOpacity.hint': '立绘按高度贴合、横向超出由窗口裁掉（不拉伸、不压缩），这里只调浓淡。',
  'field.motion': '动效档位',
  'field.motion.hint': '系统开启「减少动态效果」时一律按关闭处理。',
  'field.particles': '霜点密度',
  'field.scanlines': 'CRT 扫描线',
  'field.grain': '噪点颗粒',
  'field.vignette': '暗角',
  'field.glitch': '信号故障',
  'field.hud': 'HUD 边框与警示条',
  'field.console': '快速控制条',
  'field.console.hint': '右下角浮层，可拖动；「图标」只留一枚小按钮。',
  'field.follow': '跟随宿主浅深色偏好',
  'field.follow.hint': '开启后不夺取外观偏好：宿主切浅色即用昼档「白霜」，切深色即用夜档。',
  'field.egg': '彩蛋',
  'field.egg.hint': '发送消息时的斩击、暗号触发、可点击的月相。',
  'motion.full': '完整',
  'motion.lite': '轻微',
  'motion.off': '关闭',
  'particles.off': '关',
  'particles.low': '少',
  'particles.mid': '中',
  'particles.high': '多',
  'console.off': '关闭',
  'console.tab': '图标',
  'console.bar': '长条',
  'action.reset': '恢复默认',
  'action.off': '关闭并还原宿主外观',
  'action.on': '启用主题',
  'art.note': '立绘为使用者提供的原图（2560×1440），逐字节内嵌，未做任何裁切、缩放或重新压缩。版权归原作者所有，请勿再分发。',
  'hud.void': '虚狩',
  'hud.section': '第6課',
  'hud.phase': '月相',
  'console.toolbar': '霜月雅刃 快速控制条',
  'console.toggle': '开关主题',
  'console.intensity': '主题强度',
  'console.panel': '快速设置',
  'console.collapse': '收起为图标',
  'console.expand': '展开控制条',
  'console.drag': '拖动可移动',
  'panel.particles': '霜点',
  'panel.motion': '动效',
  'panel.open': '打开完整设置',
  'a11y.switchOn': '已开启',
  'a11y.switchOff': '已关闭',
}

const TXT_EN = {
  'meta.title': 'Shimotsuki Miyabi',
  'meta.subtitle': 'Hoshimi Miyabi · Void Hunter',
  'nav': 'Shimotsuki Miyabi',
  'row.title': 'Shimotsuki Miyabi theme',
  'row.desc': 'Frost-blue tokens, a slanted-grid backdrop, CRT scanlines and grain, with the artwork pinned to the left.',
  'group.theme': 'Theme and palette',
  'group.scene': 'Wallpaper and artwork',
  'group.fx': 'Motion and atmosphere',
  'group.behavior': 'Behaviour',
  'field.enabled': 'Enable theme',
  'field.enabled.hint': 'Turning this off restores the host look completely: tokens, identity layer and every widget are removed.',
  'field.intensity': 'Theme intensity',
  'field.intensity.hint': '0 recolours only (opaque panels, no atmosphere); 100 is the full atmosphere with translucent panels.',
  'field.panelOpacity': 'Panel opacity',
  'field.panelOpacity.hint': '100% is the designed value (wallpaper clearly visible); lower makes panels more transparent so the wallpaper and artwork read stronger.',
  'field.art': 'Artwork position',
  'field.art.hint': 'None / left (default) / right / right watermark. Sized by height, so the window crops whatever overflows sideways.',
  'art.none': 'None',
  'art.left': 'Left',
  'art.right': 'Right',
  'art.watermark': 'Watermark',
  'field.artOpacity': 'Artwork opacity',
  'field.artOpacity.hint': 'The artwork is sized by height and cropped sideways by the window (never stretched or squashed); this only sets its strength.',
  'field.motion': 'Motion',
  'field.motion.hint': 'Always treated as off when the system asks for reduced motion.',
  'field.particles': 'Frost dots',
  'field.scanlines': 'CRT scanlines',
  'field.grain': 'Film grain',
  'field.vignette': 'Vignette',
  'field.glitch': 'Signal glitch',
  'field.hud': 'HUD frame and warning tape',
  'field.console': 'Quick console',
  'field.console.hint': 'A draggable floating layer at the bottom right; "tab" keeps a single small button.',
  'field.follow': 'Follow host light/dark preference',
  'field.follow.hint': 'When on, the skin does not take the preference: the host light scheme gets the "white frost" day palette, dark gets the night palette.',
  'field.egg': 'Easter eggs',
  'field.egg.hint': 'A slash on send, a passphrase, and a clickable moon phase.',
  'motion.full': 'Full',
  'motion.lite': 'Subtle',
  'motion.off': 'Off',
  'particles.off': 'Off',
  'particles.low': 'Low',
  'particles.mid': 'Medium',
  'particles.high': 'High',
  'console.off': 'Off',
  'console.tab': 'Tab',
  'console.bar': 'Bar',
  'action.reset': 'Reset to defaults',
  'action.off': 'Disable and restore the host look',
  'action.on': 'Enable theme',
  'art.note': 'The artwork is the original 2560x1440 image supplied by the user, embedded byte-for-byte with no cropping, scaling or re-compression. Rights remain with its author; please do not redistribute it.',
  'hud.void': 'VOID HUNTER',
  'hud.section': 'SECTION 6',
  'hud.phase': 'MOON',
  'console.toolbar': 'Shimotsuki Miyabi quick console',
  'console.toggle': 'Toggle theme',
  'console.intensity': 'Theme intensity',
  'console.panel': 'Quick settings',
  'console.collapse': 'Collapse to tab',
  'console.expand': 'Expand console',
  'console.drag': 'Drag to move',
  'panel.particles': 'Frost dots',
  'panel.motion': 'Motion',
  'panel.open': 'Open full settings',
  'a11y.switchOn': 'on',
  'a11y.switchOff': 'off',
}

/* ── 颜色工具 ──────────────────────────────────────────────────────────────
 * 只在运行时算一次，结果写进 CSS 变量与令牌；不做逐帧计算。 */
/** 解析 #rgb / #rrggbb 为 [r,g,b]；解析不了返回 [0,0,0]。 */
function U_rgb(hex) {
  const s = String(hex).trim()
  if (s.charCodeAt(0) === 35) {
    if (s.length === 4) {
      return [
        parseInt(s[1] + s[1], 16),
        parseInt(s[2] + s[2], 16),
        parseInt(s[3] + s[3], 16),
      ]
    }
    if (s.length === 7) {
      return [
        parseInt(s.slice(1, 3), 16),
        parseInt(s.slice(3, 5), 16),
        parseInt(s.slice(5, 7), 16),
      ]
    }
  }
  return [0, 0, 0]
}

/** [r,g,b] → '#rrggbb'（分量按 0..255 取整并夹紧）。 */
function U_hex(rgb) {
  let out = '#'
  for (const v of rgb) {
    const n = Math.max(0, Math.min(255, Math.round(v)))
    out += (n < 16 ? '0' : '') + n.toString(16)
  }
  return out
}

/** 带透明度的颜色字符串。 */
function U_a(hex, alpha) {
  const [r, g, b] = U_rgb(hex)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`
}

/** 线性混合两色，t=0 取 a，t=1 取 b（sRGB 直混，够用且可预测）。 */
function U_mix(a, b, t) {
  const A = U_rgb(a)
  const B = U_rgb(b)
  const k = Math.max(0, Math.min(1, t))
  return U_hex([0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * k))
}

/**
 * 按主题强度换算实际不透明度：强度越低面板越实，高到 1 时取设计值。
 * 强度 0 时任何面板都完全不透明 —— 那种状态下本来也没有背景氛围要透出来。
 * @param baseAlpha 设计不透明度。
 * @param fx 0..1 的强度系数。
 */
function U_alpha(baseAlpha, fx) {
  return Math.max(0, Math.min(1, baseAlpha + (1 - baseAlpha) * (1 - fx)))
}

/** 数字夹紧。 */
function U_clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}
