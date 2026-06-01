# 呆呆虫之豆豆潭

📖 [English](Readme.en.md)

> 这是我小时候非常喜欢玩的一款游戏（作者：**樊一鹏**，1999 年开发，2004 年发布）。
>
> 百度百科：<https://baike.baidu.com/item/%E5%91%86%E5%91%86%E8%99%AB%E4%B9%8B%E8%B1%86%E8%B1%86%E6%BD%AD/265011>
>
> 致敬老一代程序员 🙏 —— 你们用一行行 C++/DirectX 写出了我们童年的快乐。
>
> 一直想把它复刻一下，无奈能力有限。感谢 AI 的出现，让这个心愿终于实现。

一个用 Three.js 在浏览器里 3D 复刻的怀旧版《呆呆虫之豆豆潭》。

🎮 **在线试玩：** <https://tg123.github.io/daidai/> · <https://farmer1992.itch.io/daidai>

<a href="https://apps.microsoft.com/detail/9MV7XJPTM52D?hl=zh-cn&gl=cn"><img src="https://get.microsoft.com/images/zh-cn%20dark.svg" alt="从 Microsoft 获取" width="190" height="52"></a>
<a href="https://farmer1992.itch.io/daidai"><img src="https://static.itch.io/images/badge-color.svg" alt="Play on itch.io" width="169" height="52"></a>

## 玩法

- 方向键 / WASD — 控制呆呆虫移动（同时按两个方向键可斜着走）
- 空格 — 暂停
- 回车 — 重开
- 移动端：屏幕滑动控制方向（斜向滑动可斜走）；右上角 ⏸ / ⟳ / 🔊 按钮
- 手柄：左摇杆 / 方向键控制（均支持 8 方向斜走）；A 暂停 / 开始；B 重开

每吃一颗豆子长一节并得 5 分；每吃 20 颗蜕一次皮。
连续吃下 5 颗相同颜色的豆子会触发魔法：

| 颜色  | 魔法 | 效果                 |
| ----- | ---- | -------------------- |
| 🔴 红 | 变速 | 奔走如飞，每豆 +5    |
| 🟠 橙 | 圣光 | 物体变金豆，吃下 +30 |
| 🟢 绿 | 生机 | 蜕的皮重新变回豆子   |
| 🔵 蓝 | 降雨 | 天降骤雨，每豆 +10   |
| 🟣 紫 | 寸缩 | 长度减半             |

## 与原版的不同

复刻在保留 1999 原版核心玩法的基础上做了一些扩展和现代化调整：

- **3D 化** — 原版是 2D 像素图形，本版用 Three.js 重写成俯视 3D（金属反光金豆、池塘水波、天气特效等）。
- **🔴 红豆变速增强** — 原版是加速 + 每豆 +5 分；本版加速 15 秒，期间每再触发一次倍率翻倍（×2 → ×4 → ×8 …），鼓励连击堆分。
- **🟠 橙豆圣光** — 原版是"光环照射"周围物体把它们变金豆；本版改成"激光发射"：从蛇头沿当前方向射出金色光束，命中的豆子和蜕下的皮都会变成金豆（与原版一致：所有物体都能被转化，金豆 +30 分）。
- **🟢 绿豆生机** — 蜕下的旧皮会重新变回可吃豆子（颜色重新随机），减少老皮挡路的尴尬。
- **🔵 蓝豆降雨** — 屏幕进入暴雨模式，期间所有豆子额外 +10 分。
- **🟣 紫豆寸缩** — 长度直接减半（向上取整），用来救命。
- **🌧️ 天降豆子** — 取代原版"60s 随机删一颗豆"的设定。开局 60–120 秒后随机时点（最多每 60s 一次）从天而降 0–3 颗豆子，带溅水波纹。
- **🐍 蜕皮机制** — 每 20 颗蜕一次皮，蜕下的皮永久留在地图上、蛇撞到会死（与原版一致）；本版额外提供绿魔法把皮转回豆子、激光把皮转成金豆这两条救命途径。
- **🎵 音效 / 音乐** — 全部用 WebAudio 重做，Opus 压缩，移动端单独处理 iOS 静音键 bypass。
- **🎮 多端输入** — 键盘 / 触屏滑动 / Xbox & PlayStation 手柄全支持，并自动检测显示对应按键提示。

## 致谢

- 原作（C++/DirectX）：樊一鹏
- 原始源码归档：<https://github.com/StellaJiangChina/daidaiworm>
- 保留在本仓库 [`legacy/`](legacy/) 目录下作为纪念。

## 本地开发

源码使用 TypeScript / ES Modules，需要 Vite 来转译：

```sh
npm install
npm run dev                  # 启动 Vite 开发服务器（默认 http://localhost:5173/）
```

如果只想本地预览已经构建好的产物，可以用任意静态文件服务器指向 `dist/`：

```sh
npm run build
npm run serve:dist           # 等价于 vite preview --outDir dist
```

## 构建与测试

需要 Node `^20.19.0 || ^22.13.0 || >=24`（与 `package.json` 的 `engines` 字段一致）：

```sh
npm install                  # 装依赖
npm run test:install         # 装 Playwright 浏览器（一次性）

npm test                     # 跑 E2E 测试（源码）
npm run build                # 编译 + 压缩到 dist/（HTML+JS+CSS 一起压，约 -48%）
npm run test:dist            # 跑 E2E 测试（dist 产物，验证压缩没破功能）
```

构建产物会输出到 `dist/`，包含压缩后的 `index.html` 加运行时静态资源（`audio/`、favicon、`apple-touch-icon.png` 等）。GitHub Pages 通过 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 自动构建并发布 `dist/`。
