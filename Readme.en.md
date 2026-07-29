# "DAIDAI" Worm

> A childhood favorite of mine (author: **Fan Yipeng**, developed in 1999, released in 2004).
>
> Baidu Baike: <https://baike.baidu.com/item/%E5%91%86%E5%91%86%E8%99%AB%E4%B9%8B%E8%B1%86%E8%B1%86%E6%BD%AD/265011>
>
> A tribute to the old-school programmers 🙏 — you wrote our childhood joy line by line in C++/DirectX.
>
> I've long wanted to recreate it but never had the skill. Thanks to AI, this long-held wish finally came true.

A nostalgic 3D remake of _"DAIDAI" Worm_, built with Godot 4 for browsers and native platforms.

🎮 **Play online:** <https://tg123.github.io/daidai/> · <https://farmer1992.itch.io/daidai>

<a href="https://apps.microsoft.com/detail/9MV7XJPTM52D"><img src="https://get.microsoft.com/images/en-us%20dark.svg" alt="Get it from Microsoft" width="190" height="52"></a>
<a href="https://farmer1992.itch.io/daidai"><img src="https://static.itch.io/images/badge-color.svg" alt="Play on itch.io" width="169" height="52"></a>

📖 [中文说明](README.md)

## How to Play

- Arrow keys / WASD — Move the worm (hold two direction keys at once to move diagonally)
- Space — Pause
- Enter — Restart
- Mobile: swipe on screen to steer (diagonal swipes move diagonally); ⏸ / ⟳ / 🔊 buttons in the top-right
- Gamepad: left stick / D-pad to steer (full 8-way diagonal support); A pause/start; B restart

Each bean eaten grows you by one segment and gives 5 points; every 20 beans you molt.
Eating 5 beans of the same color in a row triggers a magic effect:

| Color     | Magic      | Effect                                 |
| --------- | ---------- | -------------------------------------- |
| 🔴 Red    | Speed      | Run blazing fast; +5 per bean          |
| 🟠 Orange | Holy Light | Turn objects into gold beans; +30 each |
| 🟢 Green  | Vitality   | Shed skins turn back into beans        |
| 🔵 Blue   | Rain       | Sudden downpour; +10 per bean          |
| 🟣 Purple | Shrink     | Length halved                          |

## Differences from the Original

The remake keeps the core 1999 gameplay intact, with some extensions and modern touches:

- **3D rendering** — The original was 2D pixel art; this version is rewritten in Godot 4 as a top-down 3D world (reflective metallic gold beans, pond ripples, weather effects, etc.).
- **🔴 Red speed boost, enhanced** — Original: speed up + 5 bonus per bean. This version: 15-second speed boost, and re-triggering during the boost doubles the multiplier (×2 → ×4 → ×8 …), rewarding combos.
- **🟠 Orange holy light** — Original used an "aura" that radiated outward to convert nearby objects into gold beans. This version uses a directed laser fired from the worm's head along the current direction; both beans and shed skin segments hit by the beam convert into gold beans (matches the original where any nearby object — including sloughed-off skin — could be transmuted; the +30 gold-bean reward is preserved).
- **🟢 Green vitality** — Old shed skins turn back into edible beans (with a new random color), so old skins don't just clutter the field.
- **🔵 Blue rain** — Screen enters a heavy-rain mode; all beans grant +10 bonus during it.
- **🟣 Purple shrink** — Length is halved (rounded up); use it to save yourself.
- **🌧️ Rain of beans** — Replaces the original "delete a random bean every 60s" rule. Starting 60–120s in, 0–3 beans drop from the sky at random times (at most once every 60s), complete with splash ripples.
- **🐍 Molting** — Every 20 beans you molt; shed skin stays on the map permanently and kills you on contact (same as the original). The orange holy light/laser can convert shed into gold beans, and the green vitality magic can convert up to 5 random shed segments back into normal beans (both match the original).
- **🎵 Audio / music** — Fully rebuilt with Godot's audio system and played through the Web Audio API in browsers.
- **🎮 Multi-input** — Keyboard / touch swipe / Xbox & PlayStation gamepads all supported, with automatic detection and matching on-screen prompts.

## Credits

- Original game (C++/DirectX): Fan Yipeng
- Original source archive: <https://github.com/StellaJiangChina/daidaiworm>
- Preserved in this repo under [`legacy/`](legacy/) as a tribute.

## Local Development

The canonical implementation requires Godot 4.6 or newer. Import `godot/project.godot` and press **F5** to run it.

Export the browser build:

```sh
mkdir -p dist
godot --headless --path godot --export-release Web "$PWD/dist/index.html"
```

Web builds must be served over HTTP. The existing Vite preview command can serve `dist/`:

```sh
npm install
npm run serve:dist
```

## Build & Test

```sh
godot --headless --path godot --script res://tests/rules_test.gd
godot --headless --path godot --script res://tests/gameplay_test.gd
godot --headless --path godot --script res://tests/integration_test.gd
```

The previous TypeScript + Three.js implementation remains in `src/`; its unit and E2E tests continue to run through the npm scripts. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes the Godot WebAssembly build to GitHub Pages, PR previews, and itch.io.
