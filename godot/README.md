# DaiDai — Godot 4

> Godot 4 is the sole implementation for browser and native releases.

## Implemented parity

- Dynamic 22-cell-short-side pond layout, responsive orthographic oblique camera, 8-way movement, torus wrapping, self/skin collision, pause, restart, game over, timer, and persisted high score
- Area-scaled free-cell bean density, canonical five-color palette, scoring, growth, body color queue, length-25 shedding, permanent shed-skin collision, and heartbeat
- Five-bean combo magic: red boost/stacked multiplier, blue rain/bonus beans, green skin recovery, orange gold projectile, and purple length halving
- Gold beans, falling beans, random sky drops, particles, ripples, rain, boost expiry, god mode, `daidai` meteor shower, Konami code, and heart-sequence tribute
- Distinct animated head/body visuals with eyes, blinking, bean gaze, hands, toss/chew animation, death eyes, boost tint, and rainbow god mode
- Advanced native 3D pond with smooth terrain, animated caustics, refraction, depth fog, curved ribbon-grass clusters, floating long leaves, notched pond leaves, flower buds, pebbles, bubbles, and underwater color grading
- Keyboard, swipe/tap, Xbox/PlayStation gamepad controls and glyphs, responsive HUD, pause/restart/mute/language controls
- All 13 web locales with the same fallback and placeholder rules
- Original music and sound effects, with persisted mute state

The same Godot scenes and scripts power WebAssembly and every native export.

## Project layout

```text
godot/
├── project.godot
├── export_presets.cfg
├── web_shell.html
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
│   ├── fonts/*              # Noto UI fonts, multilingual fallbacks, and color emoji
│   └── audio/*.ogg
└── tests/
	├── rules_test.gd
	├── gameplay_test.gd
	├── integration_test.gd
	├── regression_test.gd
	└── performance_test.gd
```

## Run

1. Install Godot 4.6 or newer.
2. Import `godot/project.godot` in the project manager.
3. Press **F5**.

Controls are consistent across targets:

- Keyboard: arrows/WASD steer, including diagonals; Space pauses; Enter restarts
- Touch: tap or swipe starts; swipes steer; on-screen buttons pause, mute, and change language
- Gamepad: D-pad/left stick steer; A/Cross or Start pauses; B/Circle or Back restarts; X/Square mutes; Y/Triangle opens languages

Debug builds also expose direct effect testing: `1`–`5` trigger the five color powers and `6` adds one growth unit. Release exports disable these shortcuts.

## Browser export

The `Web` preset produces a single-threaded WebAssembly build that works on GitHub Pages and itch.io without cross-origin-isolation headers:

```sh
mkdir -p dist
godot --headless --path godot --export-release Web "$PWD/dist/index.html"
```

The preset uses the Compatibility renderer on the web, resizes the canvas to the browser viewport, supports desktop and mobile texture formats, and emits an installable offline PWA. `.github/workflows/deploy.yml` publishes this build to GitHub Pages, PR previews, and itch.io.

Web quality is selected automatically from pointer type, WebGL renderer, device memory, CPU count, and texture limits. Append `?quality=high` or `?quality=low` to override detection while testing.

## Native release artifacts

Publishing a GitHub Release builds and uploads:

- `DaiDai-windows-x64.exe`
- `DaiDai-windows-arm64.exe`
- `DaiDai-macos-arm64.zip` — Apple Silicon only
- `DaiDai-android-arm64.apk`
- `DaiDai-android-arm64.aab` — Google Play upload

The workflow thins Godot's universal template to ARM64 and then ad-hoc signs the app. It is not Apple-notarized.

Signed Android releases require these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_ALIAS`
- `ANDROID_KEYSTORE_PASSWORD`

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
godot --headless --path godot --script res://tests/regression_test.gd
godot --headless --path godot --script res://tests/performance_test.gd
godot --headless --path godot --quit-after 120
```

Translations are maintained directly in `assets/i18n.json`. Audio assets use Ogg Vorbis so the same files work in native and Web exports.

The bundled Noto fonts are licensed under the SIL Open Font License 1.1. Their source license notices are retained in `assets/fonts/*-OFL.txt`.

## Remaining distribution work

- [ ] Sign the Windows executables and notarize macOS
- [ ] Evaluate the licensed console export path and produce an Xbox package
