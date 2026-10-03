/* ═══════════════════════════════════════════════════════════════════════════
 * 4. 底纹与立绘层
 *
 * 收敛后只剩两样东西：
 *   底纹：斜切网格 + 硬边色块（纯 CSS 渐变，随强度缩放浓度）
 *   立绘：使用者提供的那张图，固定贴左侧、整张完整显示，只调浓淡
 *
 * 其余自制图形（狐面月徽、鸟居、樱瓣、半调、夜行都市）连同官方立绘裁切
 * 都已删除。仍然保留的两枚自制 SVG 只服务于氛围层，不属于立绘素材：
 *   霜晶（粒子）与噪点（录像带颗粒）、警示条（HUD 顶部斜条）
 *
 * 关于写法：所有背景都以 **background 简写** 的「层」为单位返回 ——
 * 斜切块与网格需要各自的 position / size，而 background-image 单属性放不下。
 *
 * 命名约定：本段用 ART_ 前缀。
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 把一段 SVG 源码包成可写进 CSS 的 url()。
 * encodeURIComponent 会把 `#` 转义成 %23（data URI 的终止符），
 * 所以 SVG 内部可以放心用 url(#id) 这类引用；外层用双引号，内部一律单引号。
 * @param svg SVG 源码。
 */
function ART_url(svg) {
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'
}

/**
 * 八向霜星的一枚花瓣：外端开 V 形缺口，两侧内凹收进中心。
 *
 * 形状对齐使用者给的徽记（八向、花瓣带凹缘、尖端分齿、中心留出四角星），
 * 但**不带颜色** —— 颜色一律由调用方给，这样「只改形状」才成立。
 *
 * @param h 花瓣长度（尖端到中心的距离）。
 * @returns 以 (0,0) 为中心、朝上的 path 数据。
 */
function ART_flakeArm(h) {
  const notch = h * 0.2 // 尖端 V 形缺口的深度
  const w = h * 0.34 // 花瓣最宽处（离轴距离）
  const bw = h * 0.13 // 尖端两个小齿的半宽
  const f = function (v) {
    return Number(v.toFixed(2))
  }
  return [
    'M' + f(-bw) + ',' + f(-h), // 左齿尖
    'L0,' + f(-h + notch), // V 形缺口底
    'L' + f(bw) + ',' + f(-h), // 右齿尖
    // 右缘：先外扩，再内凹收进中心
    'C' + f(w * 0.72) + ',' + f(-h * 0.62) + ' ' + f(w) + ',' + f(-h * 0.3) + ' ' + f(w * 0.3) + ',' + f(-h * 0.04),
    'C' + f(w * 0.16) + ',' + f(h * 0.03) + ' ' + f(w * 0.06) + ',' + f(h * 0.02) + ' 0,0',
    // 左缘：镜像回程
    'C' + f(-w * 0.06) + ',' + f(h * 0.02) + ' ' + f(-w * 0.16) + ',' + f(h * 0.03) + ' ' + f(-w * 0.3) + ',' + f(-h * 0.04),
    'C' + f(-w) + ',' + f(-h * 0.3) + ' ' + f(-w * 0.72) + ',' + f(-h * 0.62) + ' ' + f(-bw) + ',' + f(-h),
    'Z',
  ].join(' ')
}

/** 霜星的八个朝向：四个正方向略短，四个斜方向为长瓣（与徽记一致）。 */
const ART_FLAKE_ARMS = [
  { angle: 0, h: 25 },
  { angle: 90, h: 25 },
  { angle: 180, h: 25 },
  { angle: 270, h: 25 },
  { angle: 45, h: 30 },
  { angle: 135, h: 30 },
  { angle: 225, h: 30 },
  { angle: 315, h: 30 },
]

/**
 * 霜星（雪花图样）。
 *
 * 形状来自使用者提供的徽记位图 —— 由 `tools/trace-emblem.mjs` 矢量化成轮廓，
 * 存在 `assets/emblem.json`，构建时注入 `ART_EMBLEM`。
 * **颜色沿用原样**：路径里没有 fill，颜色由这里的参数给
 * （粒子传白，控制条按钮走 currentColor）。
 *
 * `assets/emblem.json` 缺失时退回内置的手绘八向花瓣，功能不受影响。
 *
 * @param color 花色。
 */
function ART_flake(color) {
  if (ART_EMBLEM && ART_EMBLEM.path) {
    return ART_url(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='" + ART_EMBLEM.viewBox + "' width='64' height='64'>" +
        "<path d='" + ART_EMBLEM.path + "' fill='" + color + "' fill-rule='" +
        (ART_EMBLEM.fillRule || 'evenodd') + "'/></svg>",
    )
  }
  const petals = ART_FLAKE_ARMS.map(function (arm) {
    return (
      "<path d='" + ART_flakeArm(arm.h) + "' transform='translate(32 32) rotate(" + arm.angle + ")'/>"
    )
  }).join('')
  return ART_url(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='64' height='64'>" +
      "<g fill='" + color + "'>" + petals + '</g></svg>',
  )
}

/**
 * 噪点颗粒：feTurbulence 生成的分形噪声，去饱和后当录像带颗粒用。
 * 这是「噪点」的全部实现，不含任何位图。
 */
function ART_noise() {
  return ART_url(
    "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>" +
      "<filter id='n'>" +
      "<feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/>" +
      "<feColorMatrix type='saturate' values='0'/>" +
      '</filter>' +
      "<rect width='180' height='180' filter='url(#n)'/>" +
      '</svg>',
  )
}

/**
 * 警示条纹：45° 斜条，HUD 顶部那条。用当前强调色 + 底色，避免固定黄黑。
 * @param a 强调色。
 * @param width 单条宽度。
 */
function ART_tape(a, width) {
  const w = width || 10
  return (
    'repeating-linear-gradient(45deg, ' +
    U_a(a, 0.75) + ' 0 ' + w + 'px, rgba(0,0,0,0) ' + w + 'px ' + w * 2 + 'px)'
  )
}

/**
 * 斜切网格 + 硬边色块（现在唯一的底纹）。
 * @param scheme 当前档位。
 * @param a1 强调色。
 * @param a2 次强调色。
 * @param gold 金。
 * @param amp 强度振幅（0 时纹样完全消失）。
 * @returns background 简写的层数组（第一层在最上）。
 */
function ART_patternGrid(scheme, a1, a2, gold, amp) {
  const k = (scheme === 'dark' ? 1 : 0.85) * amp
  return [
    // 两向斜网
    'repeating-linear-gradient(115deg, ' + U_a(a1, 0.075 * k) + ' 0 1px, rgba(0,0,0,0) 1px 48px)',
    'repeating-linear-gradient(25deg, ' + U_a(a1, 0.06 * k) + ' 0 1px, rgba(0,0,0,0) 1px 48px)',
    // 斜切色块：三块硬边分区
    'linear-gradient(115deg, ' + U_a(a1, 0.15 * k) + ' 0 16%, rgba(0,0,0,0) 16.3% 52%, ' +
      U_a(a2, 0.15 * k) + ' 52.3% 68%, rgba(0,0,0,0) 68.3%)',
    // 一道金线
    'linear-gradient(115deg, rgba(0,0,0,0) 0 79.6%, ' + U_a(gold, 0.38 * k) + ' 79.8% 80%, rgba(0,0,0,0) 80.2%)',
  ]
}

/**
 * 组装 html 背景层的 background 简写值：基础渐变在最下，斜切网格叠在上面。
 * 网格浓度跟着主题强度走：强度 0 时完全消失，只剩基础渐变与令牌换色。
 * @param cfg 配置快照。
 * @param scheme 当前档位。
 */
function ART_background(cfg, scheme) {
  const a = PAL_ACCENT[scheme]
  const dark = scheme === 'dark'
  const amp = U_clamp(cfg.intensity / 100, 0, 1)
  const base = dark
    ? [
        'radial-gradient(120% 88% at 76% -8%, ' + U_a(a.a1, 0.16) + ', rgba(0,0,0,0) 58%)',
        'radial-gradient(96% 72% at 4% 106%, ' + U_a(a.a2, 0.13) + ', rgba(0,0,0,0) 60%)',
        'linear-gradient(178deg, #08080f 0%, #05050b 62%, #07060d 100%)',
      ]
    : [
        'radial-gradient(120% 88% at 76% -8%, ' + U_a(a.a1, 0.12) + ', rgba(0,0,0,0) 58%)',
        'radial-gradient(96% 72% at 4% 106%, ' + U_a(a.a2, 0.1) + ', rgba(0,0,0,0) 60%)',
        'linear-gradient(178deg, #f5f8fd 0%, #e9eff8 62%, #f2f6fb 100%)',
      ]
  return ART_patternGrid(scheme, a.a1, a.a2, a.gold, amp).concat(base).join(', ')
}

/**
 * 立绘层的 background 简写值、不透明度与羽化遮罩。
 *
 * 位置四选一（`cfg.art`）：无 / 贴左 / 贴右 / 右侧水印。
 * 贴左与贴右按**高度**贴合（`auto 92%`）并坐在底边，水印则是右侧竖直居中；
 * 横向超出的部分由窗口自然裁掉 —— 这是 2.0.x 以来一直用的做法，
 * 对 16:9 这种横幅图来说，位置差异主要体现在横向锚点上。
 * 遮罩只做羽化：让图从锚点一侧浮出来，到正文栏之前化掉，
 * 否则矩形图会在正文中间切出一条硬边。
 *
 * @param cfg 配置快照。
 * @param scheme 当前档位。
 * @param image 已解析好的 CSS url(...)；为空则整层不显示。
 * @returns { bg, alpha, mask }。
 */
function ART_artwork(cfg, scheme, image) {
  // 昼档压一档：照片压不住时，浅底上的深色字会掉对比度（自检里有一条专门守它）。
  const ceiling = scheme === 'dark' ? 1 : 0.5
  const alpha = image ? U_clamp((cfg.artOpacity / 100) * ceiling, 0.04, 1) : 0
  if (!image || cfg.art === 'none') return { bg: 'none', alpha: 0, mask: 'none' }
  /** 羽化：以立绘落点为中心向外化开。 */
  const fade = function (cx, cy) {
    return 'radial-gradient(58% 60% at ' + cx + ' ' + cy + ', #000 42%, rgba(0,0,0,0) 100%)'
  }
  if (cfg.art === 'left') {
    return { bg: image + ' left -1% bottom / auto 92% no-repeat', alpha: alpha, mask: fade('18%', '64%') }
  }
  if (cfg.art === 'right') {
    return { bg: image + ' right -1% bottom / auto 92% no-repeat', alpha: alpha, mask: fade('82%', '64%') }
  }
  // 水印：贴着右侧空白区，竖直居中
  return { bg: image + ' right 2% center / auto 94% no-repeat', alpha: alpha, mask: fade('85%', '48%') }
}
