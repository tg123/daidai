# DaiDai Worm & Beanie Pond

> A childhood favorite of mine (author: **Fan Yipeng**, developed in 1999, released in 2004).
>
> Baidu Baike: <https://baike.baidu.com/item/%E5%91%86%E5%91%86%E8%99%AB%E4%B9%8B%E8%B1%86%E8%B1%86%E6%BD%AD/265011>
>
> A tribute to the old-school programmers 🙏 — you wrote our childhood joy line by line in C++/DirectX.
>
> I've long wanted to recreate it but never had the skill. Thanks to AI, this long-held wish finally came true.

A nostalgic 3D remake of *DaiDai Worm & Beanie Pond*, built with Three.js and runs in your browser.

🎮 **Play online:** <https://tg123.github.io/daidai/>

📖 [中文说明](Readme.md)

## How to Play

- Arrow keys / WASD — Move the worm (hold two direction keys at once to move diagonally)
- Space — Pause
- Enter — Restart
- Mobile: swipe on screen to steer (diagonal swipes move diagonally); ⏸ / ⟳ / 🔊 buttons in the top-right
- Gamepad: left stick / D-pad to steer (full 8-way diagonal support); A pause/start; B restart

Each bean eaten grows you by one segment and gives 5 points; every 20 beans you molt.
Eating 5 beans of the same color in a row triggers a magic effect:

| Color | Magic | Effect |
| --- | --- | --- |
| 🔴 Red | Speed | Run blazing fast; +5 per bean |
| 🟠 Orange | Holy Light | Turn objects into gold beans; +30 each |
| 🟢 Green | Vitality | Shed skins turn back into beans |
| 🔵 Blue | Rain | Sudden downpour; +10 per bean |
| 🟣 Purple | Shrink | Length halved |

## Differences from the Original

The remake keeps the core 1999 gameplay intact, with some extensions and modern touches:

- **3D rendering** — The original was 2D pixel art; this version is rewritten in Three.js as a top-down 3D world (reflective metallic gold beans, pond ripples, weather effects, etc.).
- **🔴 Red speed boost, enhanced** — Original: speed up + 5 bonus per bean. This version: 15-second speed boost, and re-triggering during the boost doubles the multiplier (×2 → ×4 → ×8 …), rewarding combos.
- **🟠 Orange holy light** — Original used an "aura" that radiated outward to convert nearby objects into gold beans. This version uses a directed laser fired from the worm's head along the current direction; only beans hit by the beam convert (the +30 gold-bean reward itself matches the original).
- **🟢 Green vitality** — Old shed skins turn back into edible beans (with a new random color), so old skins don't just clutter the field.
- **🔵 Blue rain** — Screen enters a heavy-rain mode; all beans grant +10 bonus during it.
- **🟣 Purple shrink** — Length is halved (rounded up); use it to save yourself.
- **🌧️ Rain of beans** — Replaces the original "delete a random bean every 60s" rule. Starting 60–120s in, 0–3 beans drop from the sky at random times (at most once every 60s), complete with splash ripples.
- **🐍 Molting** — Every 20 beans you molt (same as original); but here the shed skin stays on the map and kills you on contact (eat it, dodge it, or convert it with green magic).
- **🎵 Audio / music** — Fully rebuilt with WebAudio, Opus-compressed; mobile has special handling to bypass the iOS silent switch.
- **🎮 Multi-input** — Keyboard / touch swipe / Xbox & PlayStation gamepads all supported, with automatic detection and matching on-screen prompts.

## Credits

- Original game (C++/DirectX): Fan Yipeng
- Original source archive: <https://github.com/StellaJiangChina/daidaiworm>
- Preserved in this repo under [`legacy/`](legacy/) as a tribute.

## Local Development

Any static file server will do:

```sh
python -m http.server 8000
# open http://localhost:8000/
```
