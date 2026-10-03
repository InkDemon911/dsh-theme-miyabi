/**
 * dsh-theme-miyabi「霜月雅刃」—— 宿主半侧。
 *
 * 这是一套纯客户端主题：令牌层走 ctx.theme，身份层与挂件层都在浏览器里。
 * 宿主半侧只提供一个空的 apply()，作用是让 cordis.patch.yml 插入的 loader
 * 行有一个可挂载的 fiber（没有 fiber 的行会让 boot 扫描失败）。
 */
export function apply() {}
