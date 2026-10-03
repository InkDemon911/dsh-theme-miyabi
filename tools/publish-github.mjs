#!/usr/bin/env node
/**
 * 一键发布到 GitHub —— 只有 `gh` 已登录时才会真正动手。
 *
 *   node tools/publish-github.mjs --dry-run     # 只打印将要做什么（默认）
 *   node tools/publish-github.mjs --apply       # 真的做
 *
 * 做四件事：
 *   1  从 `gh api user` 取你的 GitHub 登录名，把仓库里所有 __OWNER__ 占位符换成它
 *      （README 的徽章与克隆链接、package.json 的 author/homepage/repository/bugs），
 *      并把 LICENSE 的版权行改成你的名字
 *   2  把仓库局部的 git 署名设成 <login> <login@users.noreply.github.com>
 *   3  重新构建 + 跑自检，**任何一项不过就中止**（不会把红灯推上去）
 *   4  `git commit --amend --reset-author` 收成一次干净的首次提交，
 *      然后 `gh repo create <repo> --public --source=. --push`
 *
 * 幂等：已经填过 owner、远端已存在，都不会重复制造东西。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const REPO = 'dsh-theme-miyabi'
const APPLY = process.argv.includes('--apply')
const REL = (p) => join(root, p)

/** 跑一条命令并拿到 stdout；失败就抛出带 stderr 的错误。 */
function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts }).trim()
}

/** 只在 APPLY 时执行；否则打印。 */
function act(what, fn) {
  if (!APPLY) {
    console.log('  [dry-run] ' + what)
    return null
  }
  console.log('  ' + what)
  return fn()
}

console.log('== 发布前检查 ==')
if (!existsSync(REL('.git'))) throw new Error('当前目录不是 git 仓库')
let ghVersion = ''
try {
  ghVersion = run('gh', ['--version'])
} catch {
  console.error('找不到 gh（GitHub CLI）。先装再登录：')
  console.error('  winget install --id GitHub.cli')
  console.error('  gh auth login')
  process.exit(2)
}
console.log('  gh:', ghVersion.split('\n')[0])
try {
  run('gh', ['auth', 'status'])
} catch (err) {
  console.error('gh 还没登录。先执行 `gh auth login`，再回来跑本脚本。')
  console.error(String(err.stderr || err.message).split('\n')[0])
  process.exit(2)
}

const login = run('gh', ['api', 'user', '--jq', '.login'])
const displayName = (() => {
  try {
    return run('gh', ['api', 'user', '--jq', '.name']) || login
  } catch {
    return login
  }
})()
if (!login) throw new Error('取不到 GitHub 登录名')
console.log('  账号:', login, displayName && displayName !== login ? `(${displayName})` : '')

/* ── 1. 填 owner ────────────────────────────────────────────────────────── */
console.log('== 替换 __OWNER__ 占位符 ==')
const targets = ['README.md', 'package.json']
let touched = 0
for (const rel of targets) {
  const full = REL(rel)
  if (!existsSync(full)) continue
  const before = readFileSync(full, 'utf8')
  if (before.indexOf('__OWNER__') < 0) {
    console.log('  ' + rel + '：没有占位符，跳过')
    continue
  }
  const after = before.split('__OWNER__').join(login)
  touched += 1
  act(`${rel}：__OWNER__ → ${login}`, () => writeFileSync(full, after))
}

const licensePath = REL('LICENSE')
if (existsSync(licensePath)) {
  const before = readFileSync(licensePath, 'utf8')
  if (/Copyright \(c\) \d{4} .+/m.test(before)) {
    const after = before.replace(/Copyright \(c\) \d{4} .+/m, `Copyright (c) ${new Date().getFullYear()} ${login}`)
    if (after !== before) act(`LICENSE：版权行 → ${login}`, () => writeFileSync(licensePath, after))
  }
}

/* ── 2. git 署名 ───────────────────────────────────────────────────────── */
console.log('== git 署名 ==')
act(`user.name  = ${login}`, () => run('git', ['config', 'user.name', login]))
act(`user.email = ${login}@users.noreply.github.com`, () =>
  run('git', ['config', 'user.email', `${login}@users.noreply.github.com`]),
)

/* ── 3. 构建 + 自检（不过就中止） ───────────────────────────────────────── */
console.log('== 构建与自检 ==')
if (APPLY) {
  console.log(run('node', ['tools/build.mjs']).split('\n')[0])
  try {
    const out = run('node', ['tools/check.mjs'])
    console.log('  ' + out.split('\n').filter(Boolean).pop())
  } catch (err) {
    console.error('自检未通过，已中止（不会推送红灯）：')
    console.error(String(err.stdout || '') + String(err.stderr || ''))
    process.exit(1)
  }
} else {
  console.log('  [dry-run] 跳过 build 与 check')
}

/* ── 4. 收成一次提交并推送 ─────────────────────────────────────────────── */
console.log('== 提交与推送 ==')
const dirty = run('git', ['status', '--porcelain'])
if (dirty) {
  act('git add -A', () => run('git', ['add', '-A']))
  act('git commit --amend --reset-author --no-edit（收进首次提交）', () =>
    run('git', ['commit', '--amend', '--reset-author', '--no-edit']),
  )
} else {
  console.log('  工作区干净，无需改动')
}

let hasOrigin = false
try {
  // stderr 丢掉：没有 origin 时 git 会打印一行 fatal，那属于正常探测
  hasOrigin =
    run('git', ['remote', 'get-url', 'origin'], { stdio: ['ignore', 'pipe', 'ignore'] }).length > 0
} catch {
  hasOrigin = false
}
if (hasOrigin) {
  act('git push -u origin main', () => run('git', ['push', '-u', 'origin', 'main']))
} else {
  act(`gh repo create ${REPO} --public --source=. --remote=origin --push`, () =>
    run('gh', [
      'repo',
      'create',
      REPO,
      '--public',
      '--source=.',
      '--remote=origin',
      '--push',
      '--description',
      '《绝区零》星见雅主题的 DeepSeek Harness Web UI 皮肤：霜蓝冷调令牌层 + 新艾利都 CRT 身份层',
    ]),
  )
}

console.log('')
if (APPLY) {
  console.log('完成。仓库地址： https://github.com/' + login + '/' + REPO)
  console.log('CI 会在首次推送后自动跑一遍 135 项自检。')
} else {
  console.log('以上是 dry-run。确认无误后加 --apply 真正执行。')
}
void touched
