# DaiDai — Godot 4 port (experiment)

> ⚠️ **This is an experimental branch.** The canonical, shipping version of daidai lives on `main` and is built with TypeScript + Three.js. That version is what currently runs on https://tg123.github.io/daidai/, on itch.io, and in the Microsoft Store (`9MV7XJPTM52D`).
>
> This branch exists to evaluate whether a Godot 4 rewrite could give us a **native Xbox build** (something the Three.js + WebView2 stack can't, because Xbox Edge ships a broken/limited WebGL2 implementation that white-screens our Three.js renderer).

## Why Godot?

Both Babylon.js and PlayCanvas still carry WebGL1 fallback paths in 2025, but the actual root cause of the Xbox white-screen is in the Edge-on-Xbox stack itself, not in our choice of WebGL library — so swapping to another web engine wouldn't reliably solve it. The only path that bypasses Xbox Edge entirely is a **native UWP / MSIX build**, and the cheapest open-source way to produce one for Xbox is Godot 4's UWP export.

Trade-offs we accept by going this route:

| Aspect | Three.js (main) | Godot 4 (this branch) |
|---|---|---|
| Web bundle | ~500 KB | 30–50 MB (WASM + assets) |
| Web first-paint | 1–2 s | 10–30 s |
| GitHub Pages compatibility | ✅ works as-is | ⚠️ needs COOP/COEP headers (gh-pages doesn't allow); would have to migrate web hosting to Cloudflare Pages |
| Inspectable / Ctrl-F searchable | ✅ DOM-based UI | ❌ everything in a canvas |
| Xbox native | ❌ (Edge WebGL2 broken) | ✅ (UWP export) |
| Mobile native | ⚠️ PWA only | ✅ true Android / iOS export |
| Desktop native | ✅ via Tauri | ✅ native (no WebView dep) |

The web experience would degrade noticeably. This branch is only worth merging if Xbox + native mobile become higher priorities than the lightweight web experience.

## What's here right now

This is a minimal scaffold — not a port. Enough to open in the Godot editor, hit Play, and see a snake moving on a green plane. The TypeScript codebase in the parent directory is the source of truth for game logic and is referenced from the GDScript files.

```
godot/
├── project.godot          # Godot 4 project file
├── icon.svg               # Placeholder icon
├── scenes/
│   └── Main.tscn          # Main scene: camera, sun, pond, snake, beans
├── scripts/
│   ├── snake.gd           # Grid-tick snake movement + body rendering
│   ├── pond.gd            # Pond floor placeholder
│   └── bean_spawner.gd    # Static bean placeholder
└── assets/                # (empty; to be populated when porting visuals)
```

## How to open

1. Install **Godot 4.3+** (standard / GDScript version, not the .NET one): https://godotengine.org/download
2. In Godot's project manager, click **Import** and pick `godot/project.godot`
3. Press **F5** to run

## What's NOT ported yet (rough TODO order)

- [ ] Real worm visuals (banded body with the bean color queue from `src/snake/body.ts`)
- [ ] Bean spawn/eat loop with audio
- [ ] Pond water shader + lily pads
- [ ] Splash / menu UI (port from `src/ui/*` and `src/i18n/*`)
- [ ] Gamepad-friendly menu navigation
- [ ] Audio (original game samples are in `public/audio/` and `public/sfx/` on main)
- [ ] Cheats / easter eggs (gated behind `__INCLUDE_CHEATS__` on main)
- [ ] Tauri-equivalent desktop wrapper (Godot exports natively, no wrapper needed)
- [ ] PWA fallback web export (Cloudflare Pages, not gh-pages)
- [ ] UWP / MSIX export for Microsoft Store + Xbox (the whole point of this branch)

## Decision pending

This branch will either:
- Get fleshed out into a full second implementation if the Xbox / native mobile story turns out to matter, **or**
- Get deleted after we confirm the cost/benefit doesn't justify maintaining two codebases.

Discussion / decision tracked in branch description, not yet promoted to an issue or PR.
