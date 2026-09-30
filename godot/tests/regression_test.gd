extends SceneTree

var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)


func _run() -> void:
	OS.set_environment("DAIDAI_TEST", "1")
	var packed_scene := load("res://scenes/Main.tscn") as PackedScene
	var game := packed_scene.instantiate() as DaiDaiGame
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game.audio.set_muted(true)
	_check(not game.web_e2e_enabled, "native and production runs do not expose Web E2E state")

	_test_locale_titles(game)
	_test_vertical_wrap(game)
	_test_laser_converts_shed(game)
	_test_timer_and_pause(game)
	_test_touch_start_guard(game)
	_test_game_over_pause_guard(game)
	_test_tribute_sequence(game)
	_test_web_distribution_contract()

	game.free()
	packed_scene = null
	await process_frame
	if failures.is_empty():
		print("Godot migrated E2E regression test passed")
		quit()
	else:
		for failure in failures:
			push_error(failure)
		quit(1)


func _test_locale_titles(game: DaiDaiGame) -> void:
	var expected := {
		"zh-cn": "呆呆虫之豆豆潭",
		"zh-tw": "呆呆蟲之豆豆潭",
		"en-us": "\"DAIDAI\" Worm",
		"ja-jp": "豆豆池のダイダイ虫",
		"ko-kr": "콩 연못의 다이다이 벌레",
		"es-es": "Gusano DaiDai del Estanque DouDou",
		"fr-fr": "Ver DaiDai de l’étang DouDou",
		"it-it": "Verme DaiDai dello stagno DouDou",
		"de-de": "„DaiDai“-Wurm vom DouDou-Teich",
		"pt-br": "Verme DaiDai do Lago DouDou",
		"pl-pl": "Robak DaiDai ze Stawu DouDou",
		"ru-ru": "Червяк ДайДай из пруда ДоуДоу",
		"th-th": "หนอนไต่ไต่แห่งบ่อโต้วโต้ว",
	}
	for locale: String in expected:
		game.hud.set_locale(locale)
		_check(
			game.get_window().title == expected[locale],
			"locale %s updates the canonical window and browser title" % locale,
		)


func _test_vertical_wrap(game: DaiDaiGame) -> void:
	game.reset_game(false)
	game.set_process(false)
	var snake := game.snake
	var spawner := game.bean_spawner
	snake.cells = [Vector2i(5, 0), Vector2i(5, 1), Vector2i(5, 2)]
	snake.previous_cells = snake.cells.duplicate()
	snake.direction = Vector2i.UP
	snake.next_direction = Vector2i.UP
	var target := Vector2i(5, game.rows - 1)
	while spawner.has_cell(target):
		spawner.remove_at(spawner.index_at(target))
	game._game_update()
	_check(snake.cells[0] == target, "head wraps from the top edge to the last row")


func _test_laser_converts_shed(game: DaiDaiGame) -> void:
	game.reset_game(false)
	game.set_process(false)
	var snake := game.snake
	var target := snake.cells[0] + Vector2i(2, 0)
	snake.direction = Vector2i.RIGHT
	snake.next_direction = Vector2i.RIGHT
	game.shed_skin = [{"x": target.x, "y": target.y, "life": 1}]
	game.trigger_magic(3)
	for _i in range(8):
		game._update_projectiles()
	_check(game.shed_skin.is_empty(), "orange laser removes shed skin in its path")
	var found_gold := false
	for bean in game.gold_beans:
		if int(bean["x"]) == target.x and int(bean["y"]) == target.y:
			found_gold = true
	_check(found_gold, "orange laser converts shed skin into a gold bean")


func _test_timer_and_pause(game: DaiDaiGame) -> void:
	game.reset_game(false)
	game.set_process(false)
	game.speed_ms = 100000.0
	game.base_speed_ms = game.speed_ms
	game._process(1.1)
	_check(game.elapsed_seconds == 0, "timer does not advance before the initial start")

	game.set_paused(false)
	game._process(1.1)
	_check(game.elapsed_seconds == 1, "timer advances during active play")
	var active_clock := game.game_clock_ms

	game.set_paused(true)
	game.speed_ms = 50.0
	game.base_speed_ms = game.speed_ms
	game.game_accumulator_ms = 0.0
	var paused_head := game.snake.cells[0]
	game._process(1.1)
	_check(game.game_clock_ms == active_clock, "timer does not advance while paused")
	_check(game.snake.cells[0] == paused_head, "paused processing does not advance the worm")


func _test_touch_start_guard(game: DaiDaiGame) -> void:
	game.reset_game(false)
	game.set_process(false)
	var press := InputEventScreenTouch.new()
	press.pressed = true
	press.position = Vector2(100.0, 100.0)
	var release := InputEventScreenTouch.new()
	release.pressed = false
	release.position = press.position
	game._unhandled_input(press)
	game._unhandled_input(release)
	_check(not game.paused, "a quick initial touch starts the game")

	game.set_paused(true)
	_check(game.has_started, "started state survives a mid-game pause")
	game._unhandled_input(press)
	game._unhandled_input(release)
	_check(game.paused, "a quick touch does not resume a mid-game pause")


func _test_game_over_pause_guard(game: DaiDaiGame) -> void:
	game.reset_game(false)
	game.set_process(false)
	game.game_over = true
	game.paused = true
	game.hud.show_message("game-over-sentinel")
	var space := InputEventKey.new()
	space.keycode = KEY_SPACE
	space.pressed = true
	game._unhandled_input(space)
	_check(game.game_over and game.paused, "Space is a no-op after game over")
	_check(
		game.hud.message_label.text == "game-over-sentinel",
		"focus or pause input does not replace the game-over message",
	)


func _test_tribute_sequence(game: DaiDaiGame) -> void:
	game.game_over = false
	game.tribute_triggered = false
	game.heart_buffer.clear()
	var half_sequence := [
		"ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft",
		"ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft",
	]
	for token in half_sequence:
		game._capture_easter_eggs(token)
	_check(not game.tribute_triggered, "half of the heart sequence does not trigger tribute")
	for token in half_sequence:
		game._capture_easter_eggs(token)
	_check(game.tribute_triggered, "the full 16-key heart sequence triggers tribute")
	var children_before := game.hud.ui_root.get_child_count()
	for token in DaiDaiGame.HEART:
		game._capture_easter_eggs(token)
	_check(
		game.hud.ui_root.get_child_count() == children_before,
		"tribute triggers only once per process",
	)


func _test_web_distribution_contract() -> void:
	var shell := FileAccess.get_file_as_string("res://web_shell.html")
	_check(shell.contains("<canvas id=\"canvas\""), "Web shell keeps the Godot canvas")
	_check(shell.contains("loading-worm"), "Web shell keeps the loading indicator")
	_check(shell.contains("onProgress"), "Web shell reports download progress")
	_check(shell.contains("$GODOT_CONFIG"), "Web shell keeps the Godot config placeholder")
	_check(
		shell.contains("__DAIDAI_BUILD_ID__")
		and shell.contains("fetch(versionUrl, { cache: 'no-store' })")
		and shell.contains("window.location.replace(nextUrl)"),
		"Web previews automatically bypass stale GitHub Pages caches",
	)
	_check(
		shell.contains("{ updateViaCache: 'none' }")
		and shell.contains("registration.waiting.postMessage('update')"),
		"installed PWAs activate new service workers without a hard reload",
	)
	var presets := FileAccess.get_file_as_string("res://export_presets.cfg")
	_check(presets.contains("name=\"Web\""), "production Web export preset exists")
	_check(presets.contains("name=\"Web Preview\""), "preview Web export preset exists")
	var project_version := str(
		ProjectSettings.get_setting("application/config/version", "")
	)
	var semver_pattern := RegEx.new()
	semver_pattern.compile("^\\d+\\.\\d+\\.\\d+$")
	_check(
		semver_pattern.search(project_version) != null,
		"native release version uses three-part semantic versioning",
	)
	_check(
		presets.count('application/file_version="%s.0"' % project_version) == 2
		and presets.count('application/product_version="%s.0"' % project_version) == 2
		and presets.contains('application/short_version="%s"' % project_version)
		and presets.contains('application/version="%s"' % project_version)
		and presets.count('version/name="%s"' % project_version) == 2,
		"native export presets match the canonical project version",
	)
	_check(
		presets.contains("progressive_web_app/enabled=true"),
		"production Web export remains installable",
	)
