# DaiDai — Godot 4

> Godot 4 is the sole implementation for browser and native releases.

## Implemented parity

- Dynamic 22-cell-short-side pond layout, responsive orthographic oblique camera, 8-way movement, torus wrapping, self/skin collision, pause, restart, game over, timer, and persisted high score
- Area-scaled free-cell bean density, canonical five-color palette with power-themed bean designs (red spiral shell, blue raindrop, green sprouting seed, orange gold gem, purple split orb), scoring, growth, body segments that wear the eaten bean's design, length-25 shedding, permanent shed-skin collision, and heartbeat
- Five-bean combo magic: red boost/stacked multiplier, blue rain/bonus beans, green skin recovery, orange gold projectile, and purple length halving
- Gold beans, falling beans, random sky drops, particles, ripples, rain, boost expiry, god mode, `daidai` meteor shower, Konami code, and heart-sequence tribute
- Distinct animated head/body visuals with eyes, blinking, bean gaze, hands, toss/chew animation, death eyes, boost tint, and rainbow god mode
- Advanced native 3D pond with smooth terrain, organic animated caustics with drifting sun pools, a sun-glinting wave surface, instanced shaded ripples and rain-splash rings, refraction, depth fog, filmic grading with glow, curved ribbon-grass clusters, floating long leaves, notched pond leaves, flower buds, pebbles, rim-lit wobbling bubbles, bean bubble trails, drifting suspended particles, and underwater color grading
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
│   ├── bean_visuals.gd      # Power-themed bean meshes and shader
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

- `DaiDai-windows-x64.zip` — contains the single native `.exe`
- `DaiDai-windows-arm64.zip` — contains the single native `.exe`
- `DaiDai-macos-arm64.zip` — Apple Silicon only
- `DaiDai-android-arm64.apk`
- `DaiDai-android-arm64.aab` — Google Play upload
- `DaiDai-windows.msixbundle` — Microsoft Store upload (when configured, see below)

The workflow thins Godot's universal template to ARM64 and then ad-hoc signs the app. It is not Apple-notarized.

Signed Android releases require these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_ALIAS`
- `ANDROID_KEYSTORE_PASSWORD`

To also publish the AAB to the Google Play internal testing track, add a `PLAY_SERVICE_ACCOUNT_JSON` secret containing a Google Cloud service account JSON key. The service account must be invited in Play Console with release permissions for `io.github.tg123.daidai`. The upload step is skipped when the secret is not set.

The Android version code is derived from the release tag as `major * 1000000 + minor * 1000 + patch` (for example `v2.0.1` → `2000001`), continuing the scheme of the earlier Tauri build (`0.1.0` → `1000`).

To re-upload an existing release's AAB or push it to another track, run the **Google Play Upload** workflow manually.

## Microsoft Store (Windows)

When the `MSSTORE_PUBLISHER` repository variable (or secret) is set, publishing a release also packages the x64 and ARM64 executables into `DaiDai-windows.msixbundle` (identity `62505tgic.daidaiworm`) and attaches it to the release. Copy the value from Partner Center > Product identity > `Package/Identity/Publisher`; `scripts/package_msix.ps1` rejects any value that does not match the listing's package family name.

With these secrets configured, the bundle is also submitted to product `9MV7XJPTM52D`:

- `PARTNER_CENTER_TENANT_ID`
- `PARTNER_CENTER_SELLER_ID`
- `PARTNER_CENTER_CLIENT_ID`
- `PARTNER_CENTER_CLIENT_SECRET`

The client must be a Microsoft Entra app added in Partner Center > Account settings > User management with the Manager role. Like the Google Play internal track, releases are submitted automatically only to the package flight in the `MSSTORE_FLIGHT_ID` variable. Use the **Microsoft Store Upload** workflow to submit a release as a draft or to production; both replace any pending Partner Center submission, including manual listing or Xbox package edits.

The package uses the `runFullTrust` restricted capability, so the first MSIX submission needs a capability justification in Partner Center. It replaces the listing's previous PWA package for Windows desktop only; the Xbox package still comes from the private GDK pipeline.

Store listing titles come from the package display name in each language, so `scripts/package_msix.ps1` builds a `resources.pri` with the product's reserved names (for example `呆呆虫之豆豆潭` for `zh-cn`). A localized name must be reserved in Partner Center before it is used. Draft and production uploads also limit the submission to the Windows desktop device family; the earlier PWA enabled HoloLens, which the native package does not support.

## Native Xbox release

The Microsoft Store Xbox edition is a native Godot console build, not a PWA or WebView wrapper. Xbox export modules use the NDA-protected Microsoft GDK and remain outside this public repository.

For each Xbox update:

1. Check out the same Git tag used by the public native release.
2. Run `pwsh scripts/set_release_version.ps1 -Version <tag>`.
3. Export and sign with the private GDK/W4 template on the NDA-compliant Windows runner.
4. Upload the package to Partner Center and complete Xbox certification.

Public CI validates the shared Godot gameplay through Windows native exports. Xbox templates, signing material, and packages remain private.

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
