# 本目录的素材版权（重要）

`assets/` 里的东西**分两类**，授权完全不同：

## 一、第三方版权素材（不在 MIT 许可范围内）

| 文件 | 内容 | 来源 | 权利 |
|---|---|---|---|
| `miyabi-wallpaper.jpg` | 星见雅「1 月月历壁纸（PC 版）」，2560×1440，965 572 字节<br>sha256 `2017e4e0…b46872` | 仓库作者提供 | **版权归 miHoYo / HoYoverse（米哈游）所有** |
| `ref/emblem-source.png` | 霜星徽记位图（AI 增强版），2048×2048，2 937 832 字节<br>sha256 `5844856D…FF99F` | 仓库作者提供 | 同上（派生自官方素材） |

- 本仓库按作者授权把它们作为**非商业同人界面皮肤**收录，**不是**授权你二次分发。
- `miyabi-wallpaper.jpg` 会被内嵌进构建产物 `client.js`（base64，约 1.26 MB），
  也就是说 `client.js` 里同样带着这份版权素材。
- **如果你是权利人并希望移除，请开 issue，会立刻删掉。**

### 想要一个不含版权素材的版本

```bash
# 在仓库根目录
rm -rf assets/miyabi-wallpaper.jpg assets/ref        # Windows: Remove-Item assets\miyabi-wallpaper.jpg, assets\ref -Recurse
node tools/build.mjs
```

清空后：

- `client.js` 会从约 1.4 MB 掉到约 130 KB
- 立绘层自动隐藏（`ART_image()` 返回空串 → `alpha = 0`，不会报错也不会留白框）
- 霜星仍在：它走的是 `emblem.json` 里的**纯轮廓坐标**，与位图无关

## 二、本仓库原创、随 MIT 分发

| 文件 | 内容 |
|---|---|
| `emblem.json` | 由 `tools/trace-emblem.mjs` 从上面的位图**矢量化**得到的轮廓。**只有形状坐标，不含任何颜色**；颜色在渲染时由代码给（粒子=白、按钮=`currentColor`） |
| `art.json` | 上面两件素材的来源／尺寸／sha256／授权说明，构建时注入，设置页会直接显示 |

## 三、没有位图的部分

底纹（斜切网格与硬边色块）、噪点（`feTurbulence`）、警示条、HUD 线条、月相、刀光、
粒子运动，全部是程序生成的 CSS 渐变与手写 SVG，不含任何位图，随 MIT 分发。
