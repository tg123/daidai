# Legacy

This folder contains the original C++ / DirectX source code and
distribution assets of **呆呆虫之豆豆潭**
(*"DAIDAI" Worm — Dou Dou Tan*), preserved here for reference.

Source: https://github.com/StellaJiangChina/daidaiworm

## Contents

- `Main.cpp`, `Std*.h`, `Refresh.h`, `Keydef.h`, `SpecialE.h`, `resource.h`
  — original game source.
- `GAMEVISION.DSP`, `GAMEVISION.DSW` — Visual C++ 6 project / workspace files.
- `ICON.rc`, `id.ico` — original icon resource.
- `DAT/` — original binary game data assets.
- `BIGTITLE.GIF`, `DaiDai.JPG` — original title / cover artwork.
- `DaiDai.txt` — original game description (re-encoded as UTF-8).
- `README.HTM` (merged into this file), `FORUM.HTM` — original HTML pages
  that shipped with the game.

The original `DaiDai.exe` binary is intentionally **not** mirrored here.

The current web (Three.js) port lives in the project root (`index.html`).

---

The remainder of this document is a Markdown conversion of the original
`README.HTM` that shipped with the game (originally GB2312-encoded HTML).

# 呆呆虫之家 — "DAIDAI" WORM'S HOME

![bigtitle](BIGTITLE.GIF)

> 『呆呆虫』游戏体验版发布后，得到了大家的热情支持，在此表示万分感谢！现根据大家提出的意见和建议，将在体验版的基础上重新制作，请期待更酷更爽更完善的『呆呆虫』正式版！

- [呆呆虫的故事](#呆呆虫的故事)
- [呆呆虫操作说明](#呆呆虫操作说明)
- [问题解答](#问题解答)
- [作者联系方法](#作者联系方法)
- [呆呆虫论坛](FORUM.HTM)
- [下载呆呆虫](http://gamevision.yeah.net)

## 呆呆虫的故事

　　传说在盛产魔豆的豆豆潭里，居住着一条快乐的小虫，成天呆呆地在水里游啊、游啊……人们都管它叫“呆呆虫”。根据传闻，呆呆虫的唯一乐趣和目标就是吃掉这些看上去很香喷喷的豆子。

　　按我们人类的眼光看来，呆呆虫的生活内容实在是有些单调。不过，豆豆潭确实是个非常神奇的地方，只要呆呆虫每吃下二十颗豆子，就会成长一岁。而如果呆呆虫一不注意，连续吃下了五颗相同颜色的豆子，凭借着这些豆子的魔力，也许整个世界都会为之改变的吧……

## 呆呆虫操作说明

　　开始时按上下键和回车键选择开始 (START)。

　　进入游戏后，按四个方向键控制呆呆虫的移动方向。在呆呆虫移动时注意不要咬到自己。呆呆虫每吃下一个豆子就会长一点（同时得到 5 分），长到一定时候就会蜕化，注意不要撞上蜕化后留下的部分。

　　连续吃下了五颗相同颜色的豆子，会产生某种奇特变化：

**<span style="color:#e04020">红色为变速魔法：</span>**

　　如果你是速度的追求者，快去连吃五颗红豆吧！呆呆虫马上就会奔行如飞（在飞速前进的过程中，每吃一颗豆子可以额外加 5 分），此时如果再吃下一颗红豆就可以恢复正常速度。

**<span style="color:#e08020">橙色为圣光魔法：</span>**

　　如果你是渴望神圣的人，那就去连吃五颗橙豆吧！这样能让呆呆虫发出一道圣光，而被圣光照中的物体会变成金豆，吃下可以加 30 分！

**<span style="color:#00d000">绿色为生机魔法：</span>**

　　你是否很讨厌蜕化后留下的部分会挡住你的去路？那就连吃五颗绿豆吧，这样就能让蜕化后留下的部分重新变回香喷喷的豆子。

**<span style="color:#2050e0">蓝色为降雨魔法：</span>**

　　不知你是否喜欢雨中漫步？在神奇的豆豆潭里，连吃五颗蓝豆就会导致天降暴雨，虽然雨水会模糊你的视野，但每吃一颗豆子可以额外加 10 分确实是一种挡不住的诱惑啊！

**<span style="color:#e050e0">紫色为寸缩魔法：</span>**

　　如果你觉得呆呆虫长得太长了需要变短一半的话，那么连吃五颗紫豆就是最明智的选择。

**特殊功能键：**

- `ESC` — 退出游戏
- `F10` — 切换游戏显示模式
- `F11` — 切换模糊处理模式
- `F12` — 切换状态信息显示
- 此外，在游戏过程中按下空格键可以暂停游戏

## 问题解答

　　如果在使用呆呆虫的过程中发现有什么问题，请首先确认你使用的是最新的 1.0.04 终极体验版，用户反映的绝大部分 BUG 已经在这一版中得到了改正。

**出现 [需要MMX] 错误怎么办？**

　　这个只有请大家多多包涵了，因为呆呆虫游戏很讲究光影效果，虽然我已经尽力去优化代码了，但如果没有 MMX™ 技术的话，游戏就会慢到根本无法运行……如果可能升级的话，就尽量换块支持 MMX™ 技术的 CPU 吧。

**出现 [bg.avi] 错误怎么办？**

　　通常，出现这种错误的原因是由于没安装视频解压驱动程序造成的。在 Windows 95/98 中按照：控制面板 - 添加删除程序 - windows安装程序 - 多媒体 - 视频压缩的顺序选取它，应该就可以了。

**其他错误处理**

　　如果发现呆呆虫游戏有什么 BUG 或者有任何意见和建议，请同作者『樊一鹏 (FreeMind)』<wildfire@188.net> 联系，或者去[『呆呆虫论坛』](FORUM.HTM)参与讨论，好让我继续改进它。

## 作者联系方法

- **EMAIL:** <wildfire@188.net>
- **HOMEPAGE:** http://gamevision.yeah.net

　　再次感谢大家对呆呆虫游戏的支持，愿国产游戏能做得更好！

---

*All rights reserved by Fan Yipeng.*
