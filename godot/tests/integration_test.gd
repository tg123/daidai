extends SceneTree

var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)


func _run() -> void:
	OS.set_environment("DAIDAI_TEST", "1")
	var i18n := DaiDaiI18n.new()
	i18n.initialize()
	var original_locale := i18n.get_locale()
	_check(i18n.get_locales().size() == 13, "all 13 locales are loaded")
	_check(i18n.pick_lang("zh-Hant-HK") == "zh-tw", "Traditional Chinese tags resolve")
	_check(i18n.pick_lang("zh_Hant_TW") == "zh-tw", "Godot underscore locales resolve")
	_check(i18n.pick_lang("en-GB") == "en-us", "language prefixes resolve")
	i18n.set_locale("en-us")
	_check(i18n.t("ui.score") == "SCORE", "English translations load")
	_check(i18n.t("fx.boost", {"mult": 4}).contains("4"), "translation parameters interpolate")
	_check(i18n.t("missing.test.key") == "missing.test.key", "missing translations fall back to key")
	i18n.set_locale(original_locale)

	var ui_font := load("res://assets/fonts/ui_font.tres") as Font
	_check(ui_font != null, "bundled UI font loads")
	var emoji_font := load("res://assets/fonts/NotoColorEmoji.ttf") as FontFile
	_check(emoji_font != null, "bundled color emoji font loads")
	if emoji_font != null:
		_check(
			not emoji_font.disable_embedded_bitmaps,
			"color emoji keeps its embedded bitmap glyphs",
		)
	if ui_font != null:
		for glyph in [
			"A", "é", "中", "繁", "あ", "한", "Я", "ไ", "←", "⏱", "↔", "●",
			"↑", "♪", "文", "␣", "★", "✦", "☂", "✿", "♥", "∞", "🌐", "🔴",
			"📏", "🔥", "🧪", "🏆", "🇨",
		]:
			_check(ui_font.has_char(glyph.unicode_at(0)), "UI font covers %s" % glyph)

	var audio_names := [
		"eat", "die", "drop", "freeze", "laser", "warp", "thunder1", "thunder2",
		"rainloop", "speedup", "speedown", "beat", "fade", "loop", "popo", "start",
		"select", "music",
	]
	for audio_name in audio_names:
		var path := "res://assets/audio/%s.ogg" % audio_name
		_check(ResourceLoader.exists(path), "%s is importable" % path)
		_check(load(path) is AudioStreamOggVorbis, "%s is Vorbis audio" % path)

	var packed_scene := load("res://scenes/Main.tscn") as PackedScene
	var main := packed_scene.instantiate()
	root.add_child(main)
	var game := main as DaiDaiGame
	game.set_process(false)
	game.bean_spawner.set_process(false)
	var audio := game.audio as DaiDaiAudio
	audio.set_muted(true)
	await process_frame
	_check(
		ProjectSettings.get_setting("display/window/stretch/mode") == "disabled",
		"board and HUD use real window dimensions",
	)
	_check(game.hud.hi_label != null, "HUD creates high-score label")
	_check(game.hud.score_label != null, "HUD creates score label")
	_check(game.hud.language_list.get_child_count() == 13, "HUD lists every locale")
	_check(audio.is_muted(), "tests mute audio through its public API")
	audio.set_application_active(false)
	_check(
		AudioServer.is_bus_mute(AudioServer.get_bus_index("Master")),
		"focus loss mutes every active sound",
	)
	audio.set_application_active(true)
	_check(
		not AudioServer.is_bus_mute(AudioServer.get_bus_index("Master")),
		"focus return restores the audio bus",
	)
	_check(
		game.hud.instructions.autowrap_mode == TextServer.AUTOWRAP_WORD_SMART,
		"paused combo hints wrap instead of clipping",
	)
	if OS.is_debug_build():
		_check(game.hud.instructions.text.contains("1–5"), "paused hints expose debug effect keys")
	_check(
		game.hud.pause_button.focus_mode == Control.FOCUS_NONE,
		"pause button cannot retain keyboard focus",
	)
	_check(
		game.hud.mute_button.focus_mode == Control.FOCUS_NONE,
		"mute button cannot retain keyboard focus",
	)
	_check(
		game.hud.language_button.focus_mode == Control.FOCUS_NONE,
		"language button cannot retain keyboard focus",
	)
	_check(game.hud.github_button != null, "HUD keeps the GitHub repository link")
	var desktop_playing_controls := game.hud._utility_visibility(false, false, false)
	_check(
		not desktop_playing_controls["pause"]
		and not desktop_playing_controls["mute"]
		and not desktop_playing_controls["language"],
		"desktop play hides all utility controls",
	)
	var touch_playing_controls := game.hud._utility_visibility(false, false, true)
	_check(
		touch_playing_controls["pause"]
		and not touch_playing_controls["mute"]
		and not touch_playing_controls["language"],
		"touch play shows only pause",
	)
	var desktop_paused_controls := game.hud._utility_visibility(true, false, false)
	_check(
		not desktop_paused_controls["pause"]
		and desktop_paused_controls["mute"]
		and desktop_paused_controls["language"],
		"desktop pause exposes mute and language",
	)
	_check(
		game.hud.restart_button.focus_mode == Control.FOCUS_NONE,
		"restart button cannot retain keyboard focus",
	)
	var pause_hover := game.hud.pause_button.get_theme_stylebox("hover") as StyleBoxFlat
	_check(pause_hover != null, "pause button defines an explicit hover style")
	_check(
		pause_hover.corner_radius_top_left == 22
		and pause_hover.corner_radius_bottom_right == 22,
		"utility hover style remains circular",
	)
	_check(
		game.hud.pause_button.get_node_or_null("GamepadBadge") is Label,
		"gamepad hint uses a layout-independent badge",
	)
	_check(
		game.hud.pause_button.text.is_empty() and game.hud.pause_button.icon != null,
		"gamepad hint does not stretch utility button text",
	)
	var space_press := InputEventKey.new()
	space_press.keycode = KEY_SPACE
	space_press.pressed = true
	Input.parse_input_event(space_press)
	await process_frame
	_check(not game.paused, "Space unpauses exactly through game input")
	var space_release := InputEventKey.new()
	space_release.keycode = KEY_SPACE
	space_release.pressed = false
	Input.parse_input_event(space_release)
	await process_frame
	Input.parse_input_event(space_press)
	await process_frame
	_check(game.paused, "Space pauses exactly once after a prior UI click")
	_check(game.effects.floor_mesh != null, "pond floor is generated")
	_check(game.effects.water_mesh != null, "water surface is generated")
	_check(
		(game.get_node("Camera3D") as Camera3D).projection == Camera3D.PROJECTION_ORTHOGONAL,
		"pond uses an orthographic oblique camera without perspective distortion",
	)
	_check(
		game.effects.grass_node.multimesh.mesh is ArrayMesh,
		"pond grass uses curved ribbon geometry instead of cones",
	)
	_check(
		game.effects.floating_plant_node.multimesh.instance_count
		== DaiDaiEffects.FLOATING_LEAF_COUNT,
		"floating aquatic leaves are generated",
	)
	_check(
		game.effects.lily_pad_node.multimesh.instance_count == DaiDaiEffects.LILY_PAD_COUNT,
		"notched floating pond leaves are generated",
	)
	_check(
		game.effects.pond_flower_node.multimesh.instance_count
		== DaiDaiEffects.POND_FLOWER_COUNT,
		"pond flowers are generated",
	)
	_check(
		game.effects.bubbles.size() == DaiDaiEffects.BUBBLE_COUNT,
		"underwater bubbles are generated",
	)
	var bean_a := game.bean_spawner._create_bean(0)
	var bean_b := game.bean_spawner._create_bean(0)
	_check(bean_a.mesh == bean_b.mesh, "beans reuse their mesh")
	_check(
		bean_a.material_override == bean_b.material_override,
		"same-color beans reuse their material",
	)
	_check(
		(bean_a.get_child(0) as Sprite3D).texture == (bean_b.get_child(0) as Sprite3D).texture,
		"same-color beans reuse their halo texture",
	)
	bean_a.free()
	bean_b.free()
	var projectile_a := game.effects.create_projectile(Vector3.ZERO)
	var projectile_b := game.effects.create_projectile(Vector3.ONE)
	var projectile_mesh_a := projectile_a.get_child(0) as MeshInstance3D
	var projectile_mesh_b := projectile_b.get_child(0) as MeshInstance3D
	_check(
		projectile_mesh_a.mesh == projectile_mesh_b.mesh,
		"gold projectiles reuse their mesh",
	)
	_check(
		projectile_mesh_a.material_override == projectile_mesh_b.material_override,
		"gold projectiles reuse their material",
	)
	var projectile_material := projectile_mesh_a.material_override as StandardMaterial3D
	_check(
		projectile_material.emission_enabled
		and projectile_material.emission_energy_multiplier > 0.8,
		"gold projectile material stays brightly emissive",
	)
	projectile_a.free()
	projectile_b.free()
	var animated_bean := game.bean_spawner.beans[0]
	animated_bean["drop_phase"] = 1.0
	animated_bean["drop_bounce"] = 0.0
	game.bean_spawner._process(0.1)
	_check(
		is_equal_approx(float(animated_bean["drop_phase"]), 0.79),
		"bean drop animation advances using elapsed time",
	)
	main.free()
	packed_scene = null
	await process_frame

	if failures.is_empty():
		print("Godot integration test passed")
		quit()
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
