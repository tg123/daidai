# DaiDai — Godot 4 port

> The canonical web release remains the TypeScript + Three.js version in the repository root. This parallel Godot 4 implementation provides the same playable game through a native engine for desktop, mobile, and console export evaluation.

## Implemented parity

- Dynamic 22-cell-short-side pond layout, responsive orthographic oblique camera, 8-way movement, torus wrapping, self/skin collision, pause, restart, game over, timer, and persisted high score
- Area-scaled free-cell bean density, canonical five-color palette, scoring, growth, body color queue, length-25 shedding, shed-skin lifetime/collision, and heartbeat
- Five-bean combo magic: red boost/stacked multiplier, blue rain/bonus beans, green skin recovery, orange gold projectile, and purple length halving
- Gold beans, falling beans, random sky drops, particles, ripples, rain, boost expiry, god mode, `daidai` meteor shower, Konami code, and heart-sequence tribute
- Distinct animated head/body visuals with eyes, blinking, bean gaze, hands, toss/chew animation, death eyes, boost tint, and rainbow god mode
- Advanced native 3D pond with smooth terrain, animated caustics, refraction, depth fog, curved ribbon-grass clusters, floating long leaves, notched pond leaves, flower buds, pebbles, bubbles, and underwater color grading
- Keyboard, swipe/tap, Xbox/PlayStation gamepad controls and glyphs, responsive HUD, pause/restart/mute/language controls
- All 13 web locales with the same fallback and placeholder rules
- Original music and sound effects, with persisted mute state

Gameplay constants and state-transition order match the TypeScript implementation. Visuals intentionally go beyond the web version to create a stronger native 3D underwater atmosphere rather than reproducing its pond pixel-for-pixel.

## Project layout

```text
godot/
├── project.godot
├── scenes/Main.tscn
├── scripts/
│   ├── game.gd              # Canonical game loop and state transitions
│   ├── game_rules.gd        # Pure wrapping, direction, and scoring rules
│   ├── snake.gd             # Worm model and animated rendering
│   ├── bean_spawner.gd      # Bean model, spawning, and rendering
│   ├── effects.gd           # Pond environment and gameplay effects
│   ├── hud.gd               # HUD, controls, locale menu, overlays
│   ├── i18n.gd              # Locale selection and translation
│   └── audio_manager.gd     # Music, SFX, loops, and mute state
├── assets/
│   ├── i18n.json
│   └── audio/*.ogg
└── tests/
	├── rules_test.gd
	├── gameplay_test.gd
	└── integration_test.gd
```

## Run

1. Install Godot 4.6 or newer.
2. Import `godot/project.godot` in the project manager.
3. Press **F5**.

Controls match the web game:

- Keyboard: arrows/WASD steer, including diagonals; Space pauses; Enter restarts
- Touch: tap or swipe starts; swipes steer; on-screen buttons pause, mute, and change language
- Gamepad: D-pad/left stick steer; A/Cross or Start pauses; B/Circle or Back restarts; X/Square mutes; Y/Triangle opens languages

Debug builds also expose direct effect testing: `1`–`5` trigger the five color powers and `6` adds one growth unit. Release exports disable these shortcuts.

## Xbox-first release path

The standard open-source Godot templates cannot create Xbox console packages. Xbox export modules use the NDA-protected Microsoft GDK and must remain private.

1. Apply to [ID@Xbox](https://developer.microsoft.com/en-us/games/publish/id/welcome) and submit DaiDai for concept approval.
2. After approval, obtain GDK and Xbox development-kit access.
3. License [W4 Consoles](https://www.w4games.com/w4consoles) or engage another authorized Godot console-porting provider.
4. Add the private Xbox template to an NDA-compliant self-hosted Windows runner; public GitHub-hosted CI continues to validate Windows native exports.
5. Complete Xbox certification and Partner Center submission.

Windows and Android remain fully native Godot targets and do not use a browser or WebView.

## Tests

From the repository root:

```sh
godot --headless --path godot --script res://tests/rules_test.gd
godot --headless --path godot --script res://tests/gameplay_test.gd
godot --headless --path godot --script res://tests/integration_test.gd
godot --headless --path godot --quit-after 120
```

Regenerate the Godot locale bundle after changing `src/i18n/*.ts`:

```sh
node scripts/export_godot_i18n.mjs
```

The web audio files use Ogg Opus. Godot's native importer requires Ogg Vorbis, so the copies in `godot/assets/audio/` are transcoded to Vorbis while retaining the original sound content and filenames.

## Remaining distribution work

- [ ] Sign the Windows executable and add mobile export presets
- [ ] Evaluate the licensed console export path and produce an Xbox package
- [ ] Add a Godot web export only if a second web implementation is still desired
