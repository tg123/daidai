# "DAIDAI" Worm

> A childhood favorite of mine (author: **Fan Yipeng**, developed in 1999, released in 2004).
>
> Baidu Baike: <https://baike.baidu.com/item/%E5%91%86%E5%91%86%E8%99%AB%E4%B9%8B%E8%B1%86%E8%B1%86%E6%BD%AD/265011>
>
> A tribute to the old-school programmers 🙏 — you wrote our childhood joy line by line in C++/DirectX.
>
> I've long wanted to recreate it but never had the skill. Thanks to AI, this long-held wish finally came true.

A nostalgic 3D remake of _"DAIDAI" Worm_, built with Three.js and runs in your browser.

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

- **3D rendering** — The original was 2D pixel art; this version is rewritten in Three.js as a top-down 3D world (reflective metallic gold beans, pond ripples, weather effects, etc.).
- **🔴 Red speed boost, enhanced** — Original: speed up + 5 bonus per bean. This version: 15-second speed boost, and re-triggering during the boost doubles the multiplier (×2 → ×4 → ×8 …), rewarding combos.
- **🟠 Orange holy light** — Original used an "aura" that radiated outward to convert nearby objects into gold beans. This version uses a directed laser fired from the worm's head along the current direction; both beans and shed skin segments hit by the beam convert into gold beans (matches the original where any nearby object — including sloughed-off skin — could be transmuted; the +30 gold-bean reward is preserved).
- **🟢 Green vitality** — Old shed skins turn back into edible beans (with a new random color), so old skins don't just clutter the field.
- **🔵 Blue rain** — Screen enters a heavy-rain mode; all beans grant +10 bonus during it.
- **🟣 Purple shrink** — Length is halved (rounded up); use it to save yourself.
- **🌧️ Rain of beans** — Replaces the original "delete a random bean every 60s" rule. Starting 60–120s in, 0–3 beans drop from the sky at random times (at most once every 60s), complete with splash ripples.
- **🐍 Molting** — Every 20 beans you molt; shed skin stays on the map permanently and kills you on contact (same as the original). The orange laser converting shed into gold beans is also original behavior. The main remake difference: the original game periodically auto-converted random shed segments back into beans; this version binds that conversion explicitly to the green bean (player-controlled instead of timer-driven), and the orange beam is rendered as a directed laser rather than a radial aura.
- **🎵 Audio / music** — Fully rebuilt with WebAudio, Opus-compressed; mobile has special handling to bypass the iOS silent switch.
- **🎮 Multi-input** — Keyboard / touch swipe / Xbox & PlayStation gamepads all supported, with automatic detection and matching on-screen prompts.

## Credits

- Original game (C++/DirectX): Fan Yipeng
- Original source archive: <https://github.com/StellaJiangChina/daidaiworm>
- Preserved in this repo under [`legacy/`](legacy/) as a tribute.

## Local Development

The source uses TypeScript / ES Modules, so it needs Vite to transpile:

```sh
npm install
npm run dev                  # start the Vite dev server (default http://localhost:5173/)
```

If you only want to preview a pre-built bundle, point any static file server at `dist/`:

```sh
npm run build
npm run serve:dist           # equivalent to: vite preview --outDir dist
```

## Build & Test

Requires Node `^20.19.0 || ^22.13.0 || >=24` (matches the `engines` field in `package.json`):

```sh
npm install                  # install deps
npm run test:install         # install Playwright browsers (one-time)

npm test                     # run E2E tests against source
npm run build                # bundle + minify into dist/ (HTML+JS+CSS, ~ -48%)
npm run test:dist            # run E2E tests against the dist build
```

Build output is written to `dist/` (minified `index.html` plus runtime assets:
`audio/`, favicon, `apple-touch-icon.png`, …). GitHub Pages auto-deploys
`dist/` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
