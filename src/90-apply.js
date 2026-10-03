/* ═══════════════════════════════════════════════════════════════════════════
 * 10. apply()：把三层装起来，并负责卸载还原
 *
 * 令牌层（宿主认得的正规扩展点）
 *   ctx.theme.register({ id, colorScheme:'dark', tokens })  ← 注册主题
 *   ctx.theme.setTheme(id)                                  ← 切到它
 *   ctx.theme.overrideTokens(id, { light, dark })           ← 每次改配置刷新这张层
 *   为什么两层都要：register 决定 colorScheme（顺带让 data-ds-dark-theme 生效，
 *   原生控件与滚动条跟着走），overrideTokens 负责"实时改配置"与"浅色档也有值"。
 *
 * 一个必须处理的坑：setTheme() 只把 light/dark/system 写进宿主设置文档，
 * 第三方 id 不持久化；而 settings scope 一推送，ThemeRuntime.adopt() 就会把
 * 偏好改成宿主里存着的那个（本 profile 是 light）。所以订阅 theme/change，
 * 发现偏好被改回去就再抢回来 —— 除非用户开了「跟随宿主浅深色偏好」，
 * 那种情况下我们本来就该让位。
 *
 * 身份层：注入一张作用域限定在 html[data-miyabi-skin] 的样式表 +
 * 一组挂在 documentElement 上的 --sym-* 变量。关掉主题 = 摘属性 + 撤样式表。
 *
 * 挂件层：settings.section / settings.general.item / shell.overlay 三个纯新增槽位。
 *
 * 命名约定：本段用 RUN_ 前缀。
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 重新抢回主题的最小间隔，避免与设置推送互相拉扯。 */
const RUN_REASSERT_MS = 1500

/** 覆盖层组件：氛围 + 控制条。 */
function RUN_Overlay() {
  const cfg = React.useSyncExternalStore(CFG_subscribe, CFG_snapshot, CFG_snapshot)
  const rt = React.useSyncExternalStore(RT_subscribe, RT_snapshot, RT_snapshot)
  const [slash, setSlash] = React.useState(null)
  const [flash, setFlash] = React.useState(null)

  React.useEffect(function () {
    let slashTimer = 0
    let flashTimer = 0
    const off = FX_subscribe(function (event) {
      if (event.kind === 'slash') {
        setSlash(event.id)
        window.clearTimeout(slashTimer)
        slashTimer = window.setTimeout(function () {
          setSlash(null)
        }, 700)
      } else if (event.kind === 'flash') {
        setFlash({ id: event.id, text: event.text })
        window.clearTimeout(flashTimer)
        flashTimer = window.setTimeout(function () {
          setFlash(null)
        }, 1200)
      }
    })
    return function () {
      off()
      window.clearTimeout(slashTimer)
      window.clearTimeout(flashTimer)
    }
  }, [])

  return h(
    'div',
    null,
    h(UI_Atmosphere, { cfg: cfg, scheme: rt.scheme, slash: slash, flash: flash }),
    cfg.enabled && cfg.console !== 'off' ? h(UI_Dock, { cfg: cfg }) : null,
  )
}

/** 常规设置里的一行速切（「外观」行旁边）。 */
function RUN_GeneralRow() {
  const cfg = React.useSyncExternalStore(CFG_subscribe, CFG_snapshot, CFG_snapshot)
  const t = UI_t
  return h(
    'div',
    { className: 'miyabi-row' },
    h(
      'div',
      { className: 'miyabi-row-text' },
      h('div', { className: 'miyabi-row-title' }, t('row.title')),
      h('div', { className: 'miyabi-row-desc' }, t('row.desc')),
    ),
    h(
      'div',
      { className: 'miyabi-row-control' },
      h(UI_Switch, {
        checked: cfg.enabled,
        label: t('field.enabled'),
        onChange: function (next) {
          CFG_set({ enabled: next })
        },
      }),
    ),
  )
}

/**
 * 客户端插件主体。
 * @param ctx 客户端 cordis 上下文（inject: theme / slots / locale）。
 */
function apply(ctx) {
  ctx.effect(
    function () {
      const disposers = []
      const root = document.documentElement
      /** 令牌覆写层的最新 disposer（同源重复调用会替换整层，旧的是 no-op）。 */
      let releaseOverride = null
      /** 主题注册的 disposer。 */
      let releaseRegister = null
      /** 进 apply 前的宿主外观偏好，退出时还回去。 */
      let previousPreference = null
      let reassertTimer = 0
      let lastReassert = 0

      /* ── 1. 用语：注册 zh / en 两份字典 ─────────────────────────────── */
      try {
        for (const locale of ['zh', 'en']) {
          const dict = locale === 'zh' ? TXT_ZH : TXT_EN
          try {
            const off = ctx.locale.register(META_NS, locale, dict)
            disposers.push(off)
          } catch (err) {
            console.error('[dsh-theme-miyabi] locale register failed', locale, err)
          }
        }
        UI_translate = ctx.locale.bind(META_NS)
      } catch (err) {
        // locale 服务不可用也不影响主题本身：退回键名
        console.error('[dsh-theme-miyabi] locale unavailable', err)
      }

      /* ── 2. 身份层样式表 ───────────────────────────────────────────── */
      const style = document.createElement('style')
      style.setAttribute('data-miyabi-skin', META_THEME)
      style.textContent = CSS_identity()
      document.head.appendChild(style)

      /* ── 3. 令牌层 ─────────────────────────────────────────────────── */
      /** 强度系数：0..1，越低面板越实、氛围越淡。 */
      const fxNow = function () {
        return U_clamp(CFG_snapshot().intensity / 100, 0, 1)
      }
      /** 界面不透明度系数：1 = 设计值，越小面板越透（壁纸越明显）。 */
      const uiNow = function () {
        return U_clamp(CFG_snapshot().panelOpacity / 100, 0, 1)
      }
      try {
        previousPreference = ctx.theme.getTheme().preference
      } catch (err) {
        previousPreference = 'system'
      }
      try {
        releaseRegister = ctx.theme.register({
          id: META_THEME,
          colorScheme: 'dark',
          tokens: PAL_flat(PAL_pair(fxNow(), uiNow()), 'dark'),
        })
      } catch (err) {
        console.error('[dsh-theme-miyabi] theme register failed', err)
      }

      /**
       * 把外观偏好还给宿主原来那一档。
       * 关掉主题、切成「跟随宿主」、以及插件卸载时都要走这一步：
       * ctx.theme.register() 注册的令牌会一直跟着这个主题 id，
       * 只要偏好还指着它，宿主自己的调色板就回不来。
       */
      const handBack = function () {
        const restore =
          previousPreference === 'light' || previousPreference === 'dark' || previousPreference === 'system'
            ? previousPreference
            : 'system'
        try {
          if (ctx.theme.getTheme().preference === META_THEME) ctx.theme.setTheme(restore)
        } catch (err) {
          /* 主题已被注销等边缘情况：忽略 */
        }
      }

      /**
       * 把当前配置写进 DOM：属性 + --sym-* 变量 + 令牌覆写层。
       * 关掉主题时走另一条路：完整摘下这一层，并把偏好还给宿主。
       */
      const sync = function () {
        const cfg = CFG_snapshot()
        const rt = RT_snapshot()
        const scheme = rt.scheme === 'light' ? 'light' : 'dark'

        if (!cfg.enabled) {
          root.removeAttribute(META_ROOT_ATTR)
          root.removeAttribute('data-miyabi-motion')
          root.removeAttribute('data-miyabi-scheme')
          if (releaseOverride) {
            releaseOverride()
            releaseOverride = null
          }
          handBack()
          return
        }

        // 跟随宿主时不该由我们掌权，同样把偏好还回去
        if (cfg.followHostAppearance) handBack()

        // 模式只剩「霜」一档，属性值保留成常量，身份层样式仍按它做作用域标记
        root.setAttribute(META_ROOT_ATTR, 'frost')
        root.setAttribute('data-miyabi-scheme', scheme)
        root.setAttribute('data-miyabi-motion', ENV_motion(cfg))

        const accent = PAL_ACCENT[scheme]
        const artwork = ART_artwork(cfg, scheme, ART_image())
        const vars = PAL_vars(cfg, scheme)
        vars['--sym-bg'] = ART_background(cfg, scheme)
        vars['--sym-noise'] = ART_noise()
        vars['--sym-tape'] = ART_tape(accent.a1, 10)
        vars['--sym-art-bg'] = artwork.bg
        vars['--sym-art-a'] = cfg.art === 'none' ? '0' : String(artwork.alpha)
        vars['--sym-art-mask'] = artwork.mask
        vars['--sym-gold-rgb'] = U_rgb(accent.gold).join(' ')
        for (const name of Object.keys(vars)) {
          root.style.setProperty(name, String(vars[name]))
        }

        // 令牌覆写层：同一个 source 再调一次 = 整层替换，所以这里放心每次重建
        try {
          releaseOverride = ctx.theme.overrideTokens(
            META_THEME,
            PAL_pair(fxNow(), cfg.panelOpacity / 100),
          )
        } catch (err) {
          console.error('[dsh-theme-miyabi] overrideTokens failed', err)
        }
      }

      /**
       * 决定当前该由谁掌权：自己（夜档）还是宿主偏好。
       * @param force 忽略节流（初次进入时用）。
       */
      const assertPreference = function (force) {
        const cfg = CFG_snapshot()
        if (!cfg.enabled) return
        if (cfg.followHostAppearance) return
        const now = Date.now()
        if (!force && now - lastReassert < RUN_REASSERT_MS) return
        lastReassert = now
        try {
          if (ctx.theme.getTheme().preference !== META_THEME) ctx.theme.setTheme(META_THEME)
        } catch (err) {
          /* 主题已被注销等边缘情况：忽略，下一轮再试 */
        }
      }

      /** 延迟一拍再抢，避免在 theme/change 的同步广播里改状态。 */
      const scheduleAssert = function () {
        if (reassertTimer) return
        reassertTimer = window.setTimeout(function () {
          reassertTimer = 0
          assertPreference(false)
        }, 0)
      }

      /* ── 4. 订阅：配置、运行时状态、宿主主题 ───────────────────────── */
      disposers.push(CFG_subscribe(sync))
      disposers.push(
        RT_subscribe(function () {
          sync()
        }),
      )
      disposers.push(
        ctx.on('theme/change', function (snapshot) {
          const scheme = snapshot.active && snapshot.active.colorScheme === 'light' ? 'light' : 'dark'
          RT_set({ scheme: scheme, localeRev: RT_snapshot().localeRev })
          const cfg = CFG_snapshot()
          if (!cfg.enabled || cfg.followHostAppearance) return
          if (snapshot.preference !== META_THEME) scheduleAssert()
        }),
      )
      // 语言切换：bump 一下运行时快照，让设置页与控制条重渲染
      disposers.push(
        ctx.on('locale/change', function () {
          RT_set({ localeRev: RT_snapshot().localeRev + 1 })
        }),
      )

      /* ── 6. 挂件层：三个纯新增槽位 ─────────────────────────────────── */
      disposers.push(
        ctx.slots.inject('shell.overlay', function () {
          return ctx.slots.register(
            { name: 'shell.overlay', id: 'miyabi-atmosphere', order: -10 },
            RUN_Overlay,
          )
        }),
      )
      disposers.push(
        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register(
            {
              name: 'settings.section',
              id: 'miyabi',
              order: 30,
              label: function () {
                return UI_t('nav')
              },
            },
            SET_Page,
          )
        }),
      )
      disposers.push(
        ctx.slots.inject('settings.general.item', function () {
          return ctx.slots.register(
            { name: 'settings.general.item', id: 'miyabi-skin', order: 12 },
            RUN_GeneralRow,
          )
        }),
      )

      /* ── 7. 声音与暗号 ─────────────────────────────────────────────── */
      disposers.push(FX_attachKeys(CFG_snapshot))
      disposers.push(UI_attachResizeFix())

      /* ── 8. 首次生效 ───────────────────────────────────────────────── */
      sync()
      assertPreference(true)

      /* ── 9. 卸载：完整还原 ─────────────────────────────────────────── */
      return function () {
        for (let i = disposers.length - 1; i >= 0; i -= 1) {
          try {
            disposers[i]()
          } catch (err) {
            console.error('[dsh-theme-miyabi] dispose failed', err)
          }
        }
        if (reassertTimer) window.clearTimeout(reassertTimer)
        handBack()
        if (releaseOverride) releaseOverride()
        if (releaseRegister) releaseRegister()
        style.remove()
        root.removeAttribute(META_ROOT_ATTR)
        root.removeAttribute('data-miyabi-motion')
        root.removeAttribute('data-miyabi-scheme')
        // 自己写上去的变量一并清掉，避免留着影响别的主题
        for (const name of Object.keys(PAL_vars(CFG_DEFAULTS, 'dark'))) {
          root.style.removeProperty(name)
        }
        for (const name of [
          '--sym-bg',
          '--sym-noise',
          '--sym-tape',
          '--sym-art-bg',
          '--sym-art-a',
          '--sym-art-mask',
          '--sym-gold-rgb',
        ]) {
          root.style.removeProperty(name)
        }
      }
    },
    'dsh-theme-miyabi: token layer, identity layer and overlay widgets',
  )
}

/**
 * 客户端插件的导出形态（cordis）：isPlugin 标记 + inject 声明 + apply。
 * theme / slots 是硬依赖（没有它们这个主题没有意义）；locale 也是硬依赖，
 * 客户端组合里它总是在场。
 */
exports.isPlugin = true
exports.inject = ['theme', 'slots', 'locale']
exports.apply = apply
