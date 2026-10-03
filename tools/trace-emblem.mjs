#!/usr/bin/env node
/**
 * 从位图徽记里把**轮廓**矢量化，产出一枚不含颜色的 SVG 路径。
 *
 *   node tools/trace-emblem.mjs [源PNG] [输出JSON]
 *
 * 为什么要这么绕：使用者提供的徽记是带青→蓝渐变色的位图，而需求是
 * 「只改形状、颜色沿用原样」。若直接把位图内嵌，颜色就一起被带进来了；
 * 所以这里只提取轮廓 —— 生成的路径**没有任何 fill 属性**，
 * 颜色一律由调用方（粒子=白、按钮=currentColor）在渲染时给。
 *
 * 流程（全部零依赖，只用 node:zlib）：
 *   1  解 PNG（IHDR/IDAT，8 位 RGB(A)，无交错）→ 逐像素「着墨度」
 *   2  面积平均降采样到 N×N（先平均再二值化 = 抗锯齿感知的边缘定位）
 *   3  沿「着墨像素 / 背景像素」的格线走边界，墨始终在行进方向右侧
 *      → 得到全部闭合环（外轮廓 + 内部孔洞）
 *   4  Douglas–Peucker 简化，去掉楼梯状的锯齿
 *   5  按着墨包围盒等比缩放、居中到 64×64 viewBox
 *   6  **自证**：把简化后的多边形按 even-odd 规则重新栅格化，
 *      与源掩膜算 IoU —— 低于阈值就报错退出，不产出不可信的路径
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const srcPath = process.argv[2] || join(root, 'assets', 'ref', 'emblem-source.png')
const outPath = process.argv[3] || join(root, 'assets', 'emblem.json')

/** 降采样后的格点数（最终路径坐标按 64/viewBox 缩放）。 */
const GRID = 256
/** 目标 viewBox 边长。 */
const BOX = 64
/** 二值化阈值：面积平均后的着墨覆盖率。 */
const INK_THRESHOLD = 0.5
/** Douglas–Peucker 容差（格点单位）。楼梯台阶高约 0.5，去掉它又不削掉真实弧度。 */
const DP_EPS = 0.7
/** IoU 下限：低于此值说明矢量化不可信。 */
const IOU_MIN = 0.97

/* ── 1. 解 PNG ─────────────────────────────────────────────────────────── */
/**
 * 解析 PNG（仅支持 bitDepth 8、非交错）。
 * @param buf PNG 字节。
 * @returns { w, h, channels, data } —— data 为逐行 RGB(A) 字节。
 */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG')
  let off = 8
  let w = 0
  let h = 0
  let depth = 0
  let colorType = 0
  let interlace = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.slice(off + 4, off + 8).toString('ascii')
    const body = buf.slice(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      w = body.readUInt32BE(0)
      h = body.readUInt32BE(4)
      depth = body[8]
      colorType = body[9]
      interlace = body[12]
    } else if (type === 'IDAT') {
      idat.push(body)
    } else if (type === 'IEND') {
      break
    }
    off += 12 + len
  }
  if (depth !== 8) throw new Error('只支持 8 位深度，实际 ' + depth)
  if (interlace !== 0) throw new Error('不支持交错 PNG')
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0
  if (!channels) throw new Error('不支持的 colorType ' + colorType)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * channels
  const out = Buffer.alloc(h * stride)
  let pos = 0
  for (let y = 0; y < h; y += 1) {
    const filter = raw[pos]
    pos += 1
    const line = raw.subarray(pos, pos + stride)
    pos += stride
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0
      const b = prev ? prev[i] : 0
      const c = prev && i >= channels ? prev[i - channels] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (filter !== 0) throw new Error('未知过滤器 ' + filter)
      cur[i] = v & 0xff
    }
  }
  return { w, h, channels, data: out }
}

/* ── 2. 着墨度 + 降采样 ────────────────────────────────────────────────── */
/**
 * 逐像素算「着墨度」，再按面积平均降到 GRID×GRID。
 * 着墨度取 1 - min(r,g,b)/255：白底得 0，青蓝墨色得 0.77~0.87，抗锯齿边缘落在中间。
 * @param img decodePng 的结果。
 * @returns Float64Array(GRID*GRID)，值域 0..1。
 */
function coverage(img) {
  const { w, h, channels, data } = img
  if (w % GRID !== 0 || h % GRID !== 0) {
    throw new Error(`源图 ${w}×${h} 不能被 ${GRID} 整除，无法整齐降采样`)
  }
  const bx = w / GRID
  const by = h / GRID
  const out = new Float64Array(GRID * GRID)
  for (let gy = 0; gy < GRID; gy += 1) {
    for (let gx = 0; gx < GRID; gx += 1) {
      let sum = 0
      let n = 0
      for (let y = gy * by; y < (gy + 1) * by; y += 1) {
        for (let x = gx * bx; x < (gx + 1) * bx; x += 1) {
          const i = (y * w + x) * channels
          const min = channels === 1 ? data[i] : Math.min(data[i], data[i + 1], data[i + 2])
          sum += 1 - min / 255
          n += 1
        }
      }
      out[gy * GRID + gx] = sum / n
    }
  }
  return out
}

/* ── 3. 走边界 ─────────────────────────────────────────────────────────── */
/**
 * 沿格线取出全部闭合轮廓。四条边的朝向统一为「墨在行进方向右侧」，
 * 于是每个顶点最多只有一条后继，直接串成环即可；外轮廓与孔洞都会被抓到。
 * @param mask Uint8Array(GRID*GRID)，1 = 着墨。
 * @returns 环数组，每个环是 [[x,y], …]（格点整数坐标，末尾不重复起点）。
 */
function traceContours(mask) {
  const at = (x, y) => (x < 0 || y < 0 || x >= GRID || y >= GRID ? 0 : mask[y * GRID + x])
  const key = (x, y) => y * (GRID + 1) + x
  /** 顶点 → 后继顶点列表。 */
  const next = new Map()
  const push = (ax, ay, bx, by) => {
    const k = key(ax, ay)
    if (!next.has(k)) next.set(k, [])
    next.get(k).push([bx, by])
  }
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (!at(x, y)) continue
      if (!at(x, y - 1)) push(x, y, x + 1, y) // 上边：+x
      if (!at(x + 1, y)) push(x + 1, y, x + 1, y + 1) // 右边：+y
      if (!at(x, y + 1)) push(x + 1, y + 1, x, y + 1) // 下边：-x
      if (!at(x - 1, y)) push(x, y + 1, x, y) // 左边：-y
    }
  }
  const loops = []
  const used = new Set()
  for (const startKey of Array.from(next.keys())) {
    if (used.has(startKey)) continue
    let [cx, cy] = [startKey % (GRID + 1), Math.floor(startKey / (GRID + 1))]
    const loop = []
    let guard = 0
    while (guard < (GRID + 1) * (GRID + 1) * 4) {
      guard += 1
      const k = key(cx, cy)
      const outs = next.get(k)
      if (!outs || !outs.length) break
      const edgeId = k + ':' + outs[0][0] + ',' + outs[0][1]
      if (used.has(edgeId) && loop.length) break
      used.add(edgeId)
      const [nx, ny] = outs.shift()
      loop.push([cx, cy])
      cx = nx
      cy = ny
      if (cx === loop[0][0] && cy === loop[0][1]) break
    }
    if (loop.length >= 4) loops.push(loop)
  }
  return loops
}

/** 闭合环上的 Douglas–Peucker 简化（把环当作首尾相同的折线）。 */
function simplify(loop, eps) {
  if (loop.length < 4) return loop
  const keep = new Uint8Array(loop.length)
  keep[0] = 1
  keep[loop.length - 1] = 1
  const stack = [[0, loop.length - 1]]
  const distToSeg = (p, a, b) => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    if (!len2) return Math.hypot(p[0] - a[0], p[1] - a[1])
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
  }
  while (stack.length) {
    const [i0, i1] = stack.pop()
    let worst = -1
    let at = -1
    for (let i = i0 + 1; i < i1; i += 1) {
      const d = distToSeg(loop[i], loop[i0], loop[i1])
      if (d > worst) {
        worst = d
        at = i
      }
    }
    if (worst > eps && at > 0) {
      keep[at] = 1
      stack.push([i0, at], [at, i1])
    }
  }
  const out = []
  for (let i = 0; i < loop.length; i += 1) if (keep[i]) out.push(loop[i])
  // 环首尾相接，去掉与起点重合的收尾点
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop()
  return out
}

/* ── 6. 自证：重新栅格化算 IoU ──────────────────────────────────────────── */
/**
 * even-odd 扫描线填充，判断每个像素中心是否落在多边形内。
 * @param loops 多边形数组（格点坐标）。
 * @param n 栅格边长。
 * @returns Uint8Array(n*n)。
 */
function rasterize(loops, n) {
  const out = new Uint8Array(n * n)
  for (let y = 0; y < n; y += 1) {
    const py = y + 0.5
    for (let x = 0; x < n; x += 1) {
      const px = x + 0.5
      let cross = 0
      for (const loop of loops) {
        for (let i = 0; i < loop.length; i += 1) {
          const [ax, ay] = loop[i]
          const [bx, by] = loop[(i + 1) % loop.length]
          if (ay > py !== by > py) {
            const t = (py - ay) / (by - ay)
            if (ax + t * (bx - ax) > px) cross += 1
          }
        }
      }
      out[y * n + x] = cross % 2 ? 1 : 0
    }
  }
  return out
}

/* ── 主流程 ─────────────────────────────────────────────────────────────── */
if (!existsSync(srcPath)) throw new Error('找不到源图：' + srcPath)
const img = decodePng(readFileSync(srcPath))
const cov = coverage(img)

let ink = 0
const mask = new Uint8Array(GRID * GRID)
for (let i = 0; i < cov.length; i += 1) {
  if (cov[i] > INK_THRESHOLD) {
    mask[i] = 1
    ink += 1
  }
}

const rawLoops = traceContours(mask)
if (!rawLoops.length) throw new Error('没找到任何轮廓（阈值或源图不对）')
/** 丢掉噪点级别的碎环。 */
const bigLoops = rawLoops.filter((l) => Math.abs(area(l)) >= 16)
const loops = bigLoops.map((l) => simplify(l, DP_EPS))
const rawPoints = bigLoops.reduce((s, l) => s + l.length, 0)
const points = loops.reduce((s, l) => s + l.length, 0)

/** 环的带符号面积（格点单位）。 */
function area(loop) {
  let s = 0
  for (let i = 0; i < loop.length; i += 1) {
    const [ax, ay] = loop[i]
    const [bx, by] = loop[(i + 1) % loop.length]
    s += ax * by - bx * ay
  }
  return s / 2
}

/* 包围盒 → 等比缩放并居中到 BOX×BOX */
let minX = Infinity
let minY = Infinity
let maxX = -Infinity
let maxY = -Infinity
for (const loop of loops) {
  for (const [x, y] of loop) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
}
const spanX = maxX - minX
const spanY = maxY - minY
const scale = (BOX - 2) / Math.max(spanX, spanY) // 留 1 单位边距
const offX = (BOX - spanX * scale) / 2 - minX * scale
const offY = (BOX - spanY * scale) / 2 - minY * scale
const fx = (v) => Number((v * scale + offX).toFixed(2))
const fy = (v) => Number((v * scale + offY).toFixed(2))

const subpaths = loops.map((loop) => {
  let d = 'M' + fx(loop[0][0]) + ' ' + fy(loop[0][1])
  for (let i = 1; i < loop.length; i += 1) d += 'L' + fx(loop[i][0]) + ' ' + fy(loop[i][1])
  return d + 'Z'
})
const path = subpaths.join('')

/* 自证：把简化后的多边形栅格化，与掩膜比 IoU */
const raster = rasterize(loops, GRID)
let inter = 0
let union = 0
for (let i = 0; i < mask.length; i += 1) {
  const a = mask[i]
  const b = raster[i]
  if (a || b) union += 1
  if (a && b) inter += 1
}
const iou = union ? inter / union : 0

const report = {
  viewBox: `0 0 ${BOX} ${BOX}`,
  fillRule: 'evenodd',
  path,
  meta: {
    source: srcPath.split(/[\\/]/).pop(),
    sourceSize: `${img.w}x${img.h}`,
    sourceChannels: img.channels,
    grid: GRID,
    gridEps: DP_EPS,
    inkRatio: Number((ink / (GRID * GRID)).toFixed(4)),
    contours: loops.length,
    rawPoints,
    points,
    iou: Number(iou.toFixed(4)),
    note: '轮廓取自使用者提供的徽记位图；路径不含任何颜色，颜色由调用方在渲染时给。',
  },
}

console.log('源图        :', report.meta.source, report.meta.sourceSize, 'channels=' + img.channels)
console.log('着墨占比    :', (report.meta.inkRatio * 100).toFixed(1) + '%')
console.log('闭合环      :', loops.length, '（含孔洞）')
console.log('顶点        :', rawPoints, '→ 简化后', points)
console.log('回栅格 IoU  :', report.meta.iou)
console.log('路径长度    :', path.length, '字符')
if (iou < IOU_MIN) {
  throw new Error(`IoU ${iou.toFixed(4)} 低于下限 ${IOU_MIN}，矢量化不可信，不产出路径`)
}
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n')
console.log('已写出      :', outPath)
