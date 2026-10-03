/* ═══════════════════════════════════════════════════════════════════════════
 * 5. 身份层样式表
 *
 * 三条自我约束（对应任务书「样式需模块化，避免污染原有 UI」）：
 *   1. 每一条规则都以 html[data-miyabi-skin] 开头。关掉主题 = 摘掉这个属性，
 *      整张表立刻失效，不留任何残留。
 *   2. 宿主元素只靠设计令牌换色（令牌层负责），**不给宿主的元素挂伪元素**：
 *      宿主 DOM 一变就会打架，而令牌不会。
 *   3. 所有颜色、透明度都走 --sym-* 变量，改配置只重写变量，不重建样式表。
 *
 * 动画只动 transform / opacity；动效开关（含系统 prefers-reduced-motion）
 * 命中时用 [data-miyabi-motion='off'] 一次性停掉。
 *
 * 命名约定：本段用 CSS_ 前缀；类名统一 miyabi- 前缀。
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成整张身份层样式表。
 * @returns CSS 文本。
 */
function CSS_identity() {
  return `
/* ── 0. 变量别名与基础 ─────────────────────────────────────────────────── */
html[data-miyabi-skin] {
  /* 焦点环走强调色（宿主读 var(--dsw-focus-ring-color, …)）。 */
  --dsw-focus-ring-color: var(--sym-accent);
  /* 本主题自己的几何常量。 */
  --sym-hud-gap: 14px;
  /* 字体栈：正文本体一律不动（可读性优先），只有本主题自己的装饰文字换字体。
     不下载任何 webfont —— 只用系统里已有的窄体／等宽体，避免网络与授权问题。 */
  --sym-font-ui: var(--dsw-font-family, system-ui), -apple-system, "Segoe UI",
    "Microsoft YaHei", "PingFang SC", sans-serif;
  --sym-font-deco: Impact, Haettenschweiler, "Arial Narrow", "Noto Sans JP",
    "Yu Gothic", "Microsoft YaHei", system-ui, sans-serif;
  --sym-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace;
}
/* 画布：宿主 bootstrap 给 body 铺了不透明底色，这里交还给背景层。 */
html[data-miyabi-skin],
html[data-miyabi-skin] body {
  background-color: transparent;
}
html[data-miyabi-skin] {
  background-color: transparent;
}

/* ── 1. 背景层（基础渐变 + 纹样） ───────────────────────────────────────── */
html[data-miyabi-skin]::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--sym-bg);
}

/* ── 2. 立绘 / 水印层 ──────────────────────────────────────────────────── */
html[data-miyabi-skin]::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--sym-art-bg);
  opacity: var(--sym-art-a);
  /* 羽化边缘：照片是矩形的，硬边会在浅色档上露出一块深色方块。
     不支持 mask 的引擎只是没有羽化，不影响可用性。 */
  -webkit-mask-image: var(--sym-art-mask);
  mask-image: var(--sym-art-mask);
  transition: opacity 240ms ease;
}
/* 立绘用 left + contain，窄屏时整张图自动缩小、仍贴左侧，
   不需要额外的断点规则去救它（1.x 那套「窄屏挪到右下」是因为当时按高度裁切）。 */

/* ── 3. 选区与焦点 ─────────────────────────────────────────────────────── */
html[data-miyabi-skin] ::selection {
  background-color: rgb(var(--sym-accent-rgb) / 32%);
}
html[data-miyabi-skin] :focus-visible {
  outline-color: var(--sym-accent);
}

/* ── 4. 代码块与引用：硬边 + 硬投影（ZZZ 的实心描边语言） ───────────────── */
html[data-miyabi-skin] pre {
  border-left: 2px solid var(--sym-accent);
  box-shadow: 4px 4px 0 0 rgb(var(--sym-accent-rgb) / 14%);
}
html[data-miyabi-skin] blockquote {
  border-left-color: var(--sym-gold);
}

/* ── 5. 帧级浮层：CRT 与 HUD ──────────────────────────────────────────────
 * 全部 pointer-events: none，只做视觉；控制条单独在 .miyabi-dock 上恢复指针。 */
.miyabi-fx {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
/* 扫描线：3px 周期的一根暗线，透明度由强度决定 */
.miyabi-fx-scan {
  background: repeating-linear-gradient(
    0deg,
    rgba(4, 6, 14, 0.85) 0 1px,
    rgba(0, 0, 0, 0) 1px 3px
  );
  opacity: var(--sym-scan-a);
}
/* 滚动亮带：老录像带的那道慢扫光 */
.miyabi-fx-roll {
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 0%,
    rgb(var(--sym-accent-rgb) / 6%) 45%,
    rgba(255, 255, 255, 7%) 50%,
    rgba(0, 0, 0, 0) 100%
  );
  height: 34vh;
  top: -34vh;
  bottom: auto;
  opacity: calc(var(--sym-fx) * 0.9);
  animation: miyabi-roll 9.5s linear infinite;
  animation-play-state: var(--sym-run);
}
@keyframes miyabi-roll {
  0% { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(0, 168vh, 0); }
}
/* 噪点：feTurbulence 生成的 SVG，位移做闪烁 */
.miyabi-fx-grain {
  background-image: var(--sym-noise);
  background-size: 180px 180px;
  opacity: var(--sym-grain-a);
  animation: miyabi-grain 1.1s steps(4) infinite;
  animation-play-state: var(--sym-run);
  mix-blend-mode: overlay;
}
@keyframes miyabi-grain {
  0% { background-position: 0 0; }
  25% { background-position: -42px 26px; }
  50% { background-position: 33px -18px; }
  75% { background-position: -18px -37px; }
  100% { background-position: 26px 42px; }
}
/* 暗角 + 色散边：CRT 的球面感 */
.miyabi-fx-vig {
  opacity: var(--sym-vig-a);
  background:
    radial-gradient(120% 100% at 50% 50%, rgba(0, 0, 0, 0) 52%, rgba(3, 4, 10, 0.72) 100%),
    linear-gradient(90deg, rgb(255 90 120 / 5%), rgba(0, 0, 0, 0) 6% 94%, rgb(120 200 255 / 5%));
}
/* 故障：偶尔整帧轻微错位闪一下 */
.miyabi-fx-glitch {
  opacity: var(--sym-glitch-a);
  background: repeating-linear-gradient(
    0deg,
    rgb(120 200 255 / 8%) 0 2px,
    rgba(0, 0, 0, 0) 2px 7px,
    rgb(255 90 120 / 7%) 7px 9px,
    rgba(0, 0, 0, 0) 9px 23px
  );
  animation: miyabi-glitch 7.3s steps(1, end) infinite;
  animation-play-state: var(--sym-run);
}
@keyframes miyabi-glitch {
  0%, 92%, 100% { transform: translate3d(0, 0, 0); opacity: 0; }
  93% { transform: translate3d(-3px, 1px, 0); opacity: calc(var(--sym-glitch-a) * 0.9); }
  94% { transform: translate3d(4px, -2px, 0); opacity: 0; }
  95% { transform: translate3d(-2px, 0, 0); opacity: calc(var(--sym-glitch-a) * 0.6); }
  96% { transform: translate3d(0, 0, 0); opacity: 0; }
}

/* ── 6. HUD：角标、警示条、竖排标签 ────────────────────────────────────── */
.miyabi-hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: var(--sym-hud-a);
  font-family: var(--sym-font-deco);
  color: var(--sym-accent);
}
.miyabi-hud-tape {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--dsh-frame-chrome-top, 0px);
  height: 3px;
  background-image: var(--sym-tape);
  opacity: 0.5;
}
.miyabi-hud-corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 1px solid rgb(var(--sym-accent-rgb) / 55%);
}
.miyabi-hud-corner.is-tl {
  left: var(--sym-hud-gap);
  top: calc(var(--sym-hud-gap) + var(--dsh-frame-chrome-top, 0px));
  border-right: 0;
  border-bottom: 0;
}
.miyabi-hud-corner.is-tr {
  right: var(--sym-hud-gap);
  top: calc(var(--sym-hud-gap) + var(--dsh-frame-chrome-top, 0px));
  border-left: 0;
  border-bottom: 0;
}
.miyabi-hud-corner.is-bl {
  left: var(--sym-hud-gap);
  bottom: var(--sym-hud-gap);
  border-right: 0;
  border-top: 0;
}
.miyabi-hud-corner.is-br {
  right: var(--sym-hud-gap);
  bottom: var(--sym-hud-gap);
  border-left: 0;
  border-top: 0;
}
.miyabi-hud-label {
  position: absolute;
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: rgb(var(--sym-accent-rgb) / 72%);
  text-shadow: 0 0 6px rgb(var(--sym-accent-rgb) / 45%);
  white-space: nowrap;
}
.miyabi-hud-label.is-tl {
  left: calc(var(--sym-hud-gap) + 34px);
  top: calc(var(--sym-hud-gap) + 4px + var(--dsh-frame-chrome-top, 0px));
}
/* 左下标签走竖排、贴着左缘往上长：横排会撞到宿主自己的左下角按钮
   （「设置」的图标与文字正好占着那一段，实测 3× 放大可见字被压在按钮下沿）。
   竖排后它只占左缘约 10px 宽的空隙，与右上竖排标签形成对角呼应。 */
.miyabi-hud-label.is-bl {
  left: calc(var(--sym-hud-gap) - 7px);
  bottom: calc(var(--sym-hud-gap) + 46px);
  writing-mode: vertical-rl;
  letter-spacing: 0.42em;
  color: rgb(var(--sym-gold-rgb) / 65%);
}
.miyabi-hud-label.is-tr {
  right: calc(var(--sym-hud-gap) + 34px);
  top: calc(var(--sym-hud-gap) + 4px + var(--dsh-frame-chrome-top, 0px));
  writing-mode: vertical-rl;
  letter-spacing: 0.5em;
}
.miyabi-hud-gold {
  color: rgb(var(--sym-gold-rgb) / 70%);
}

/* ── 7. 粒子 ───────────────────────────────────────────────────────────── */
.miyabi-particles {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.miyabi-particle {
  position: absolute;
  top: -8vh;
  display: block;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  will-change: transform, opacity;
  animation-name: miyabi-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-play-state: var(--sym-run);
}
@keyframes miyabi-fall {
  0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  8% { opacity: var(--sym-particle-a); }
  50% { transform: translate3d(var(--sym-drift), 58vh, 0) rotate(180deg); }
  92% { opacity: var(--sym-particle-a); }
  100% { transform: translate3d(0, 118vh, 0) rotate(360deg); opacity: 0; }
}
/* 轻微档：保留粒子但不动（仍能看到霜点，不烧 GPU） */
html[data-miyabi-motion='lite'] .miyabi-particle {
  animation: none;
  opacity: var(--sym-particle-a);
}

/* ── 8. 斩击（发送消息 / 彩蛋） ─────────────────────────────────────────── */
.miyabi-slash {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 4;
}
.miyabi-slash-blade {
  position: absolute;
  left: -30%;
  top: 42%;
  width: 160%;
  height: 3px;
  transform-origin: 50% 50%;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0%,
    rgb(var(--sym-accent-rgb) / 70%) 35%,
    #ffffff 50%,
    rgb(var(--sym-accent-rgb) / 70%) 65%,
    rgba(0, 0, 0, 0) 100%
  );
  box-shadow: 0 0 18px 2px rgb(var(--sym-accent-rgb) / 55%);
  animation: miyabi-slash 260ms cubic-bezier(0.16, 0.9, 0.3, 1) forwards;
}
.miyabi-slash-crack {
  position: absolute;
  left: -30%;
  top: 42%;
  width: 160%;
  height: 1px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0), #ffffff, rgba(0, 0, 0, 0));
  animation: miyabi-crack 520ms ease-out forwards;
}
@keyframes miyabi-slash {
  0% { transform: translate3d(-52%, 0, 0) rotate(-16deg) scaleY(0.4); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate3d(52%, 0, 0) rotate(-16deg) scaleY(1.6); opacity: 0; }
}
@keyframes miyabi-crack {
  0% { transform: translate3d(-52%, 0, 0) rotate(-16deg); opacity: 0.9; }
  100% { transform: translate3d(52%, 0, 0) rotate(-16deg); opacity: 0; }
}
/* 暗号命中时的一行浮字 */
.miyabi-flash {
  position: fixed;
  left: 50%;
  top: 22%;
  transform: translate3d(-50%, 0, 0);
  pointer-events: none;
  z-index: 5;
  font-family: var(--sym-font-deco);
  font-size: 13px;
  letter-spacing: 0.5em;
  color: var(--sym-accent);
  text-shadow: 0 0 14px rgb(var(--sym-accent-rgb) / 70%);
  animation: miyabi-flash 1100ms ease-out forwards;
}
@keyframes miyabi-flash {
  0% { opacity: 0; transform: translate3d(-50%, 8px, 0) scale(0.94); }
  18% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translate3d(-50%, -10px, 0) scale(1.02); }
}

/* ── 9. 快速控制条 ─────────────────────────────────────────────────────── */
.miyabi-dock {
  position: fixed;
  z-index: 6;
  pointer-events: auto;
  font-family: var(--sym-font-ui);
  color: var(--dsw-alias-label-primary);
}
.miyabi-dock-tab {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid rgb(var(--sym-accent-rgb) / 55%);
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-button-elevated-fill);
  box-shadow: 3px 3px 0 0 rgb(var(--sym-accent-rgb) / 22%);
  cursor: pointer;
  color: var(--sym-accent);
  font-size: 15px;
  line-height: 1;
  padding: 0;
}
.miyabi-dock-tab:hover {
  border-color: var(--sym-accent);
}
.miyabi-dock-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px 4px 8px;
  border: 1px solid rgb(var(--sym-accent-rgb) / 45%);
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-overlay);
  box-shadow:
    4px 4px 0 0 rgb(var(--sym-accent-rgb) / 18%),
    var(--dsw-elevation-panel, 0 2px 10px rgba(0, 0, 0, 0.25));
  backdrop-filter: blur(10px);
  cursor: grab;
  user-select: none;
}
.miyabi-dock-bar.is-dragging {
  cursor: grabbing;
}
/* 斜切角：裁掉右上角，是 ZZZ 贴纸与面板的统一记号 */
.miyabi-dock-bar::before,
.miyabi-settings-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0) 49%, rgb(var(--sym-accent-rgb) / 26%) 50%);
  pointer-events: none;
}
.miyabi-dock-bar::before {
  border-top-right-radius: var(--dsw-radius-md, 10px);
}
.miyabi-dock-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
}
.miyabi-dock-group + .miyabi-dock-group {
  border-left: 1px solid var(--dsw-alias-border-l2);
  margin-left: 4px;
}
.miyabi-dock-btn {
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  display: inline-grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.miyabi-dock-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.miyabi-dock-btn.is-on {
  color: var(--sym-accent);
  border-color: rgb(var(--sym-accent-rgb) / 45%);
  background: rgb(var(--sym-accent-rgb) / 12%);
}
.miyabi-dock-btn[aria-expanded='true'] {
  background: var(--dsw-alias-interactive-bg-active);
  color: var(--dsw-alias-label-primary);
}
.miyabi-dock-moon {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}
.miyabi-dock-moon:hover {
  border-color: rgb(var(--sym-accent-rgb) / 45%);
}
.miyabi-dock-sep {
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
}

/* 快速设置弹层 */
.miyabi-pop {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  width: 268px;
  padding: 10px 12px 12px;
  border: 1px solid rgb(var(--sym-accent-rgb) / 40%);
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-overlay);
  box-shadow:
    4px 4px 0 0 rgb(var(--sym-accent-rgb) / 16%),
    var(--dsw-elevation-prominent, 0 6px 20px rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(14px);
  cursor: default;
}
/* 每行竖排：标签在上、控件在下。横排会把六档分段控件挤爆。 */
.miyabi-pop-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}
.miyabi-pop-row + .miyabi-pop-row {
  margin-top: 8px;
}
.miyabi-pop-label {
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  letter-spacing: 0.04em;
}
.miyabi-pop .miyabi-seg {
  flex-wrap: wrap;
}
.miyabi-pop .miyabi-seg-btn {
  flex: 1 0 auto;
  padding: 4px 6px;
  font-size: 11px;
}

/* ── 10. 设置页 ────────────────────────────────────────────────────────── */
.miyabi-settings {
  font-family: var(--sym-font-ui);
  color: var(--dsw-alias-label-primary);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 28px;
}
.miyabi-settings-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.miyabi-settings-title {
  font-family: var(--sym-font-deco);
  font-size: 20px;
  letter-spacing: 0.16em;
  color: var(--dsw-alias-label-primary);
}
.miyabi-settings-sub {
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--sym-accent);
}
.miyabi-settings-note {
  font-size: 12px;
  line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
  margin: 0;
}
.miyabi-settings-card {
  position: relative;
  overflow: hidden;
  padding: 14px 16px 16px;
  border: 1px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2));
}
.miyabi-settings-card::before {
  border-top-right-radius: var(--dsw-radius-lg, 12px);
}
.miyabi-settings-group {
  font-family: var(--sym-font-deco);
  font-size: 11px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--sym-accent);
  margin: 0 0 10px;
}
.miyabi-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 0;
}
.miyabi-row + .miyabi-row {
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.miyabi-row-text {
  min-width: 0;
}
.miyabi-row-title {
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}
.miyabi-row-desc {
  margin-top: 3px;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--dsw-alias-label-secondary);
}
.miyabi-row-control {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.miyabi-row-control.is-wide {
  flex: 1 1 210px;
  max-width: 260px;
}

/* 开关：role="switch" + aria-checked，键盘可操作 */
.miyabi-switch {
  position: relative;
  width: 40px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover-solid, var(--dsw-alias-bg-layer-3));
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
}
.miyabi-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-switch-thumb);
  transition: transform 140ms ease;
}
.miyabi-switch[aria-checked='true'] {
  background: rgb(var(--sym-accent-rgb) / 85%);
  border-color: var(--sym-accent);
}
.miyabi-switch[aria-checked='true'] .miyabi-switch-thumb {
  transform: translate3d(18px, 0, 0);
  background: var(--sym-ink);
}

/* 分段控件 */
.miyabi-seg {
  display: inline-flex;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-sm, 8px);
  overflow: hidden;
}
.miyabi-seg-btn {
  padding: 5px 10px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
}
.miyabi-seg-btn + .miyabi-seg-btn {
  border-left: 1px solid var(--dsw-alias-border-l2);
}
.miyabi-seg-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.miyabi-seg-btn[aria-pressed='true'] {
  background: rgb(var(--sym-accent-rgb) / 18%);
  color: var(--dsw-alias-label-primary);
  box-shadow: inset 0 -2px 0 0 var(--sym-accent);
}

/* 模式卡片 */
.miyabi-modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
  gap: 10px;
}
.miyabi-mode {
  position: relative;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-layer-1);
  cursor: pointer;
  color: inherit;
}
.miyabi-mode:hover {
  border-color: var(--dsw-alias-border-l4);
}
.miyabi-mode[aria-pressed='true'] {
  border-color: currentColor;
  box-shadow: 3px 3px 0 0 currentColor;
}
.miyabi-mode-swatch {
  display: flex;
  gap: 3px;
  margin-bottom: 7px;
}
.miyabi-mode-swatch i {
  width: 16px;
  height: 16px;
  display: block;
  border: 1px solid var(--dsw-alias-border-l2);
}
.miyabi-mode-name {
  font-family: var(--sym-font-deco);
  font-size: 13px;
  letter-spacing: 0.18em;
}
.miyabi-mode-desc {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
}

/* 滑杆：直接吃原生控件 + accent-color，键盘与无障碍行为全保留 */
.miyabi-slider {
  width: 100%;
  accent-color: var(--sym-accent);
  cursor: pointer;
}
.miyabi-value {
  min-width: 42px;
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}

/* 按钮 */
.miyabi-btn {
  padding: 6px 12px;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-button-elevated-fill);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  cursor: pointer;
}
.miyabi-btn:hover {
  border-color: var(--sym-accent);
}
.miyabi-btn.is-primary {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  border-color: transparent;
}
.miyabi-btn.is-danger {
  color: var(--dsw-alias-state-error-primary);
  border-color: var(--dsw-alias-state-error-primary);
}
.miyabi-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.miyabi-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* ── 11. 动效开关 ──────────────────────────────────────────────────────── */
html[data-miyabi-motion='off'] .miyabi-anim,
html[data-miyabi-motion='off'] .miyabi-fx-roll,
html[data-miyabi-motion='off'] .miyabi-fx-grain,
html[data-miyabi-motion='off'] .miyabi-fx-glitch {
  animation: none;
}
html[data-miyabi-motion='off'] .miyabi-fx-roll,
html[data-miyabi-motion='off'] .miyabi-fx-glitch {
  display: none;
}
html[data-miyabi-motion='off'] .miyabi-slash {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  html[data-miyabi-skin] .miyabi-anim,
  html[data-miyabi-skin] .miyabi-fx-roll,
  html[data-miyabi-skin] .miyabi-fx-grain,
  html[data-miyabi-skin] .miyabi-fx-glitch,
  html[data-miyabi-skin] .miyabi-particle,
  html[data-miyabi-skin] .miyabi-slash-blade,
  html[data-miyabi-skin] .miyabi-slash-crack {
    animation: none !important;
  }
  html[data-miyabi-skin] .miyabi-fx-roll,
  html[data-miyabi-skin] .miyabi-fx-glitch,
  html[data-miyabi-skin] .miyabi-slash {
    display: none !important;
  }
}

/* ── 12. 窄屏收敛 ──────────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .miyabi-hud-label.is-tr,
  .miyabi-hud-label.is-bl {
    display: none;
  }
  .miyabi-pop {
    width: min(76vw, 244px);
  }
  .miyabi-settings-card {
    padding: 12px 12px 14px;
  }
  .miyabi-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .miyabi-row-control,
  .miyabi-row-control.is-wide {
    max-width: none;
    justify-content: flex-start;
  }
}
`
}
