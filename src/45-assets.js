/* ═══════════════════════════════════════════════════════════════════════════
 * 5. 打包内嵌的立绘（构建时注入）
 *
 * 为什么必须内嵌成 data URI：客户端模块表的 require 只解析基座里的名字
 * （react / cordis / 几个静态 UI 库），**不能 require 资源模块**；而插件目录
 * 在桌面外壳下也没有稳定的可引用 URL。data URI 是 Web 与桌面两端都成立的
 * 唯一方式，同时天然没有跨域问题。
 *
 * 注入点由 tools/build.mjs 替换：它读 assets/*.jpg|png|webp，按文件名
 * （小写、去扩展名）作为键写进下面的对象字面量：
 *   assets/miyabi-wallpaper.jpg → ART_PACK['miyabi-wallpaper']
 * 使用者提供的那张图是**逐字节复制**进来的，构建只做 base64 编码，
 * 不裁切、不缩放、不重新压缩。
 *
 * 命名约定：本段用 ART_PACK / RT_ 前缀。
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 构建时注入：{ '<文件名键>': 'data:image/jpeg;base64,…' }。 */
const ART_PACK = /* @sym-assets */ {}

/** 构建时注入：{ '<文件名键>': { title, source, license } }。 */
const ART_PACK_META = /* @sym-asset-meta */ {}

/**
 * 构建时注入的徽记轮廓（由 tools/trace-emblem.mjs 从位图矢量化而来）：
 * `{ viewBox, fillRule, path, meta }`。**路径本身不含颜色**，
 * 颜色一律由调用方在渲染时给，所以「只改形状、颜色不动」是结构上成立的。
 * 为空时 ART_flake() 会退回内置的手绘花瓣。
 */
const ART_EMBLEM = /* @sym-emblem */ {}

/**
 * 解析当前该用的立绘图。
 * @returns CSS url(...)；素材包里没有那张图时返回空字符串（整层不显示）。
 */
function ART_image() {
  const picked = ART_PACK[META_ART_KEY]
  return picked ? 'url("' + picked + '")' : ''
}

/**
 * 内置素材的来源说明。
 * @param key 素材键。
 */
function ART_metaOf(key) {
  return ART_PACK_META[key] || null
}

/* ── 运行时状态 ────────────────────────────────────────────────────────────
 * 配置之外的、由环境决定的状态：当前生效的浅/深档与语言版本号。
 * 单独一份不可变快照，供设置页与控制条用 useSyncExternalStore 订阅。 */
let RT_state = { scheme: 'dark', localeRev: 0, revision: 0 }
const RT_subscribers = new Set()

/** 读取运行时快照。 */
function RT_snapshot() {
  return RT_state
}

/**
 * 订阅运行时状态。
 * @param listener 变更回调。
 */
function RT_subscribe(listener) {
  RT_subscribers.add(listener)
  return function () {
    RT_subscribers.delete(listener)
  }
}

/**
 * 合并运行时状态；值没变就不通知。
 * @param patch 局部更新。
 */
function RT_set(patch) {
  const next = Object.assign({}, RT_state, patch)
  let changed = false
  for (const key of Object.keys(patch)) {
    if (next[key] !== RT_state[key]) changed = true
  }
  if (!changed) return
  next.revision = RT_state.revision + 1
  RT_state = next
  for (const listener of Array.from(RT_subscribers)) {
    try {
      listener()
    } catch (err) {
      console.error('[ui-skin-miyabi] runtime listener failed', err)
    }
  }
}
