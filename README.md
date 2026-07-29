# 呆呆虫之豆豆潭

📖 [English](Readme.en.md)

> 这是我小时候非常喜欢玩的一款游戏（作者：**樊一鹏**，1999 年开发，2004 年发布）。
>
> 百度百科：<https://baike.baidu.com/item/%E5%91%86%E5%91%86%E8%99%AB%E4%B9%8B%E8%B1%86%E8%B1%86%E6%BD%AD/265011>
>
> 致敬老一代程序员 🙏 —— 你们用一行行 C++/DirectX 写出了我们童年的快乐。
>
> 一直想把它复刻一下，无奈能力有限。感谢 AI 的出现，让这个心愿终于实现。

一个用 Godot 4 复刻、可在浏览器和原生平台运行的 3D 怀旧版《呆呆虫之豆豆潭》。

🎮 **在线试玩：** <https://tg123.github.io/daidai/> · <https://farmer1992.itch.io/daidai>

<a href="https://apps.microsoft.com/detail/9MV7XJPTM52D?hl=zh-cn&gl=cn"><img src="https://get.microsoft.com/images/zh-cn%20dark.svg" alt="从 Microsoft 获取" width="190" height="52"></a>
<a href="https://farmer1992.itch.io/daidai"><img src="https://static.itch.io/images/badge-color.svg" alt="Play on itch.io" width="169" height="52"></a>

## 玩法

- 方向键 / WASD — 控制呆呆虫移动（同时按两个方向键可斜着走）
- 空格 — 暂停
- 回车 — 重开
- 移动端：屏幕滑动控制方向（斜向滑动可斜走）；右上角暂停，暂停后可静音或切换语言
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

- **3D 化** — 原版是 2D 像素图形，本版用 Godot 4 重写成俯视 3D（金属反光金豆、池塘水波、天气特效等）。
- **🔴 红豆变速增强** — 原版是加速 + 每豆 +5 分；本版加速 15 秒，期间每再触发一次倍率翻倍（×2 → ×4 → ×8 …），鼓励连击堆分。
- **🟠 橙豆圣光** — 原版是"光环照射"周围物体把它们变金豆；本版改成"激光发射"：从蛇头沿当前方向射出金色光束，命中的豆子和蜕下的皮都会变成金豆（与原版一致：所有物体都能被转化，金豆 +30 分）。
- **🟢 绿豆生机** — 蜕下的旧皮会重新变回可吃豆子（颜色重新随机），减少老皮挡路的尴尬。
- **🔵 蓝豆降雨** — 屏幕进入暴雨模式，期间所有豆子额外 +10 分。
- **🟣 紫豆寸缩** — 长度直接减半（向上取整），用来救命。
- **🌧️ 天降豆子** — 取代原版"60s 随机删一颗豆"的设定。开局 60–120 秒后随机时点（最多每 60s 一次）从天而降 0–3 颗豆子，带溅水波纹。
- **🐍 蜕皮机制** — 每 20 颗蜕一次皮，蜕下的皮永久留在地图上、蛇撞到会死（与原版一致）。橙豆圣光/激光可把皮转成金豆（与原版一致）；绿豆生机可随机将最多 5 段皮转回豆子（与原版一致）。
- **🎵 音效 / 音乐** — 使用 Godot 音频系统重做，浏览器通过 Web Audio API 播放。
- **🎮 多端输入** — 键盘 / 触屏滑动 / Xbox & PlayStation 手柄全支持，并自动检测显示对应按键提示。

## 致谢

- 原作（C++/DirectX）：樊一鹏
- 原始源码归档：<https://github.com/StellaJiangChina/daidaiworm>
- 保留在本仓库 [`legacy/`](legacy/) 目录下作为纪念。

## 本地开发

主实现需要 Godot 4.6 或更高版本。用 Godot 导入 `godot/project.godot` 后按 **F5** 即可运行。

导出浏览器版本：

```sh
mkdir -p dist
godot --headless --path godot --export-release Web "$PWD/dist/index.html"
```

浏览器构建必须通过 HTTP 服务预览，例如使用 Python：

```sh
python -m http.server 8080 --directory dist
```

## 构建与测试

```sh
godot --headless --path godot --script res://tests/rules_test.gd
godot --headless --path godot --script res://tests/gameplay_test.gd
godot --headless --path godot --script res://tests/integration_test.gd
godot --headless --path godot --script res://tests/regression_test.gd
godot --headless --path godot --script res://tests/performance_test.gd
godot --headless --path godot --quit-after 120
```

仓库仅保留 Godot 运行实现；`legacy/` 保存 1999 原版源码档案。GitHub Pages、PR Preview 和 itch.io 由 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 自动发布 Godot WebAssembly 构建。
