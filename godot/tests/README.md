# Godot test coverage

The retired browser suite defined 40 test bodies (52 runs after expanding the 13 locale cases). Its test intent is retained as follows:

| Previous suite | Migrated coverage |
| --- | --- |
| `gameplay.spec.ts` | `gameplay_test.gd` and `regression_test.gd`: scoring, growth, collisions, torus wrapping, all five magics, projectiles, shedding, rain bonus, and pause blocking |
| `i18n.spec.ts` | `regression_test.gd` and `web_e2e.py`: actual window/browser-title updates for all 13 locales plus exported-browser propagation |
| `pause.spec.ts` | `integration_test.gd` and `regression_test.gd`: keyboard pause, touch pause visibility, game-over input guard, and localized messages |
| `timer.spec.ts` | `regression_test.gd` and `integration_test.gd`: idle/active/paused clocks plus focus-loss pause |
| `mobile-touch.spec.ts` | `regression_test.gd`, `integration_test.gd`, and `web_e2e.py`: initial tap start, mid-game tap guard, DPR3 canvas sizing, responsive HUD, and touch-only pause controls |
| `gamepad.spec.ts` | `gameplay_test.gd` and `integration_test.gd`: gamepad start/actions, prompt selection, badges, and no-gamepad UI |
| `tribute.spec.ts` | `regression_test.gd`: full/partial sequence and once-per-process behavior |
| `smoke.spec.ts` | `integration_test.gd`, `regression_test.gd`, `web_e2e.py`, and the `dist` workflow: real WASM startup, scene/HUD assets, Web shell, loading progress, icons, preview files, and the production PWA artifact |

The old game-specific DOM selectors and mutable `window.__test` bridge are not retained. `Web Preview + ?e2e=1` exposes a read-only state snapshot for exported-browser assertions; production exports expose nothing.
