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
		game.hud.pause_button.text == "▶",
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
