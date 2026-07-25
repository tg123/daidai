extends SceneTree

const WARMUP_FRAMES := 120
const SAMPLE_FRAMES := 600


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	OS.set_environment("DAIDAI_TEST", "1")
	var packed_scene := load("res://scenes/Main.tscn") as PackedScene
	var main := packed_scene.instantiate()
	root.add_child(main)
	var game := main as DaiDaiGame
	if OS.get_environment("DAIDAI_KEEP_PAUSED") == "1":
		game.set_process(false)
		game.set_process_input(false)
		game.set_process_unhandled_input(false)
	else:
		game.set_paused(false)
	if OS.get_environment("DAIDAI_HIDE_GRASS") == "1":
		game.effects.grass_node.visible = false
	if OS.get_environment("DAIDAI_HIDE_WATER") == "1":
		game.effects.water_mesh.visible = false
	if OS.get_environment("DAIDAI_HIDE_FLOOR") == "1":
		game.effects.floor_mesh.visible = false
	if OS.get_environment("DAIDAI_HOVER_PAUSE") == "1":
		await process_frame
		Input.warp_mouse(
			game.hud.pause_button.global_position + game.hud.pause_button.size / 2.0,
		)

	for _i in range(WARMUP_FRAMES):
		await process_frame
	var started_at := Time.get_ticks_usec()
	for _i in range(SAMPLE_FRAMES):
		await process_frame
	var elapsed_seconds := (Time.get_ticks_usec() - started_at) / 1000000.0
	var result := {
		"frames": SAMPLE_FRAMES,
		"seconds": elapsed_seconds,
		"fps": SAMPLE_FRAMES / elapsed_seconds,
		"objects": Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
		"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"primitives": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
		"viewport_size": [
			root.get_visible_rect().size.x,
			root.get_visible_rect().size.y,
		],
		"window_size": [
			DisplayServer.window_get_size().x,
			DisplayServer.window_get_size().y,
		],
		"grid": [game.cols, game.rows],
		"camera_size": (game.get_node("Camera3D") as Camera3D).size,
		"paused": game.paused,
		"keep_paused_env": OS.get_environment("DAIDAI_KEEP_PAUSED"),
		"paused_hint": {
			"visible": game.hud.instructions.visible,
			"text": game.hud.instructions.text,
			"position": [
				game.hud.instructions.position.x,
				game.hud.instructions.position.y,
			],
			"global_position": [
				game.hud.instructions.global_position.x,
				game.hud.instructions.global_position.y,
			],
			"size": [
				game.hud.instructions.size.x,
				game.hud.instructions.size.y,
			],
			"visible_in_tree": game.hud.instructions.is_visible_in_tree(),
			"modulate": [
				game.hud.instructions.modulate.r,
				game.hud.instructions.modulate.g,
				game.hud.instructions.modulate.b,
				game.hud.instructions.modulate.a,
			],
		},
	}
	var output_path := OS.get_environment("DAIDAI_BENCHMARK_OUT")
	if not output_path.is_empty():
		var output := FileAccess.open(output_path, FileAccess.WRITE)
		if output == null:
			push_error(
				"Cannot open benchmark output '%s' (error %d)."
				% [output_path, FileAccess.get_open_error()],
			)
			main.free()
			packed_scene = null
			await process_frame
			quit(1)
			return
		output.store_string(JSON.stringify(result, "  "))
		output.close()
	var screenshot_path := OS.get_environment("DAIDAI_SCREENSHOT_OUT")
	if not screenshot_path.is_empty():
		root.get_texture().get_image().save_png(screenshot_path)
	print("Godot render benchmark: %s" % JSON.stringify(result))

	main.free()
	packed_scene = null
	await process_frame
	quit()
