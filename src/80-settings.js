/* ═══════════════════════════════════════════════════════════════════════════
 * 8. 设置页（settings.section）
 *
 * 全部控件都是手写的原生元素，不 require 任何 Harness Client 包：
 *   开关   <button role="switch" aria-checked>
 *   分段   <button aria-pressed> 一组
 *   滑杆   <input type="range"> + accent-color（原生键盘与无障碍行为全保留）
 * 布局与配色只用 --dsw-* 令牌，所以浅色档下同样成立。
 *
 * 收敛后这里只剩「会变的东西」：开关、强度、界面不透明度、立绘浓淡、
 * 动效与氛围六项、控制条形态、彩蛋。模式（霜）、底纹（斜切网格）、
 * 立绘位置（左）与素材（使用者提供的那张图）都已固定，不再出现在界面上。
 *
 * 命名约定：本段用 UI_ 前缀（组件）与 SET_ 前缀（设置页装配）。
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 由 apply() 注入的翻译函数（locale 服务的 bind 结果）。 */
let UI_translate = function (key) {
  return key
}

/**
 * 取当前语言的文案。故意做成稳定函数 + 间接调用：
 * 语言变化时只替换 UI_translate，界面靠 localeRev 重新渲染，
 * 不需要重新注册槽位。
 */
function UI_t(key) {
  return UI_translate(key)
}

/**
 * 一行设置。
 * @param props { title, desc, children, wide }。
 */
function UI_Row(props) {
  return h(
    'div',
    { className: 'miyabi-row' },
    h(
      'div',
      { className: 'miyabi-row-text' },
      h('div', { className: 'miyabi-row-title' }, props.title),
      props.desc ? h('div', { className: 'miyabi-row-desc' }, props.desc) : null,
    ),
    h(
      'div',
      { className: 'miyabi-row-control' + (props.wide ? ' is-wide' : '') },
      props.children,
    ),
  )
}

/**
 * 开关。
 * @param props { checked, onChange, label }。
 */
function UI_Switch(props) {
  return h(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': props.checked ? 'true' : 'false',
      'aria-label': props.label,
      className: 'miyabi-switch',
      onClick: function () {
        props.onChange(!props.checked)
      },
    },
    h('span', { className: 'miyabi-switch-thumb' }),
  )
}

/**
 * 分段控件。
 * @param props { value, options: [{ value, label }], onChange, label }。
 */
function UI_Seg(props) {
  return h(
    'div',
    { className: 'miyabi-seg', role: 'group', 'aria-label': props.label },
    props.options.map(function (option) {
      const on = option.value === props.value
      return h(
        'button',
        {
          key: option.value,
          type: 'button',
          'aria-pressed': on ? 'true' : 'false',
          className: 'miyabi-seg-btn',
          onClick: function () {
            props.onChange(option.value)
          },
        },
        option.label,
      )
    }),
  )
}

/**
 * 滑杆 + 数值。
 * @param props { value, min, max, step, suffix, onChange, label }。
 */
function UI_Slider(props) {
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%' } },
    h('input', {
      type: 'range',
      className: 'miyabi-slider',
      min: props.min,
      max: props.max,
      step: props.step || 1,
      value: props.value,
      'aria-label': props.label,
      onChange: function (event) {
        props.onChange(Number(event.target.value))
      },
    }),
    h('span', { className: 'miyabi-value' }, String(props.value) + (props.suffix || '')),
  )
}

/**
 * 一张设置卡片。
 * @param props { group, children }。
 */
function UI_Card(props) {
  return h(
    'section',
    { className: 'miyabi-settings-card' },
    props.group ? h('h3', { className: 'miyabi-settings-group' }, props.group) : null,
    props.children,
  )
}

/** 枚举转成 Seg 需要的 options。 */
function UI_options(prefix, values) {
  return values.map(function (value) {
    return { value: value, label: UI_t(prefix + '.' + value) }
  })
}

/**
 * 设置页主体。
 * @param props { close }（settings.section 的 owner prop，这里用不到）。
 */
function SET_Page(props) {
  void props
  const cfg = React.useSyncExternalStore(CFG_subscribe, CFG_snapshot, CFG_snapshot)
  // 订阅运行时快照：语言切换时靠 localeRev 触发重渲染
  React.useSyncExternalStore(RT_subscribe, RT_snapshot, RT_snapshot)
  const set = CFG_set
  const meta = ART_metaOf(META_ART_KEY)

  return h(
    'div',
    { className: 'miyabi-settings' },
    h(
      'div',
      { className: 'miyabi-settings-head' },
      h('div', { className: 'miyabi-settings-title' }, UI_t('meta.title')),
      h('div', { className: 'miyabi-settings-sub' }, UI_t('meta.subtitle')),
    ),

    /* —— 主题与配色 —— */
    h(
      UI_Card,
      { group: UI_t('group.theme') },
      h(
        UI_Row,
        { title: UI_t('field.enabled'), desc: UI_t('field.enabled.hint') },
        h(UI_Switch, {
          checked: cfg.enabled,
          label: UI_t('field.enabled'),
          onChange: function (next) {
            set({ enabled: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.intensity'), desc: UI_t('field.intensity.hint'), wide: true },
        h(UI_Slider, {
          value: cfg.intensity,
          min: 0,
          max: 100,
          suffix: '%',
          label: UI_t('field.intensity'),
          onChange: function (next) {
            set({ intensity: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.panelOpacity'), desc: UI_t('field.panelOpacity.hint'), wide: true },
        h(UI_Slider, {
          value: cfg.panelOpacity,
          min: 40,
          max: 100,
          suffix: '%',
          label: UI_t('field.panelOpacity'),
          onChange: function (next) {
            set({ panelOpacity: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.follow'), desc: UI_t('field.follow.hint') },
        h(UI_Switch, {
          checked: cfg.followHostAppearance,
          label: UI_t('field.follow'),
          onChange: function (next) {
            set({ followHostAppearance: next })
          },
        }),
      ),
    ),

    /* —— 壁纸与立绘 —— */
    h(
      UI_Card,
      { group: UI_t('group.scene') },
      h(
        UI_Row,
        { title: UI_t('field.art'), desc: UI_t('field.art.hint') },
        h(UI_Seg, {
          value: cfg.art,
          options: UI_options('art', META_ENUM.art),
          label: UI_t('field.art'),
          onChange: function (next) {
            set({ art: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.artOpacity'), desc: UI_t('field.artOpacity.hint'), wide: true },
        h(UI_Slider, {
          value: cfg.artOpacity,
          min: 4,
          max: 100,
          suffix: '%',
          label: UI_t('field.artOpacity'),
          onChange: function (next) {
            set({ artOpacity: next })
          },
        }),
      ),
      h(
        'p',
        { className: 'miyabi-settings-note' },
        meta && meta.title ? meta.title + ' · ' + meta.source : UI_t('art.note'),
      ),
    ),

    /* —— 动效与氛围 —— */
    h(
      UI_Card,
      { group: UI_t('group.fx') },
      h(
        UI_Row,
        { title: UI_t('field.motion'), desc: UI_t('field.motion.hint') },
        h(UI_Seg, {
          value: cfg.motion,
          options: UI_options('motion', META_ENUM.motion),
          label: UI_t('field.motion'),
          onChange: function (next) {
            set({ motion: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.particles') },
        h(UI_Seg, {
          value: cfg.particles,
          options: UI_options('particles', META_ENUM.particles),
          label: UI_t('field.particles'),
          onChange: function (next) {
            set({ particles: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.scanlines') },
        h(UI_Switch, {
          checked: cfg.scanlines,
          label: UI_t('field.scanlines'),
          onChange: function (next) {
            set({ scanlines: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.grain') },
        h(UI_Switch, {
          checked: cfg.grain,
          label: UI_t('field.grain'),
          onChange: function (next) {
            set({ grain: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.vignette') },
        h(UI_Switch, {
          checked: cfg.vignette,
          label: UI_t('field.vignette'),
          onChange: function (next) {
            set({ vignette: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.glitch') },
        h(UI_Switch, {
          checked: cfg.glitch,
          label: UI_t('field.glitch'),
          onChange: function (next) {
            set({ glitch: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.hud') },
        h(UI_Switch, {
          checked: cfg.hud,
          label: UI_t('field.hud'),
          onChange: function (next) {
            set({ hud: next })
          },
        }),
      ),
    ),

    /* —— 行为 —— */
    h(
      UI_Card,
      { group: UI_t('group.behavior') },
      h(
        UI_Row,
        { title: UI_t('field.console'), desc: UI_t('field.console.hint') },
        h(UI_Seg, {
          value: cfg.console,
          options: UI_options('console', META_ENUM.console),
          label: UI_t('field.console'),
          onChange: function (next) {
            set({ console: next })
          },
        }),
      ),
      h(
        UI_Row,
        { title: UI_t('field.egg'), desc: UI_t('field.egg.hint') },
        h(UI_Switch, {
          checked: cfg.easterEgg,
          label: UI_t('field.egg'),
          onChange: function (next) {
            set({ easterEgg: next })
          },
        }),
      ),
      h(
        'div',
        { className: 'miyabi-actions', style: { marginTop: '10px' } },
        h(
          'button',
          {
            type: 'button',
            className: 'miyabi-btn',
            onClick: function () {
              CFG_reset()
            },
          },
          UI_t('action.reset'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'miyabi-btn is-primary',
            onClick: function () {
              set({ enabled: !cfg.enabled })
            },
          },
          cfg.enabled ? UI_t('action.off') : UI_t('action.on'),
        ),
      ),
    ),
  )
}
