// 发布前的一次性检查：README 完整性 + 仓库待提交清单概览。
import { readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const t = readFileSync('README.md', 'utf8')
const lines = t.split('\n')
const fences = (t.match(/^```/gm) || []).length
console.log('README 行数     :', lines.length)
console.log('README 字符数   :', t.length)
console.log('二级/三级标题   :', (t.match(/^#{2,3} /gm) || []).length)
console.log('代码围栏        :', fences, fences % 2 === 0 ? '(成对)' : '(不成对！)')
console.log('__OWNER__ 占位  :', (t.match(/__OWNER__/g) || []).length, '处（推送前替换）')
console.log('乱码检测        :', /锛|鈥|锟|閿|锟斤拷/.test(t) ? '发现乱码！' : '无')
console.log('外链            :', (t.match(/https?:\/\/[^\s)]+/g) || []).length, '个')

const files = ['package.json', 'LICENSE', 'CHANGELOG.md', '.gitignore', '.gitattributes',
  '.github/workflows/check.yml', 'assets/README.md', 'assets/emblem.json',
  'assets/miyabi-wallpaper.jpg', 'assets/ref/emblem-source.png', 'client.js',
  'tools/build.mjs', 'tools/check.mjs', 'tools/trace-emblem.mjs']
console.log('\n交付文件：')
for (const f of files) {
  try {
    const kb = (statSync(f).size / 1024).toFixed(1)
    console.log('  ' + f.padEnd(34) + kb.padStart(9) + ' KB')
  } catch {
    console.log('  ' + f.padEnd(34) + '   *** 缺失 ***')
  }
}

const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
console.log('\ngit 待提交条目：', status.length)
for (const line of status) console.log('  ' + line)
