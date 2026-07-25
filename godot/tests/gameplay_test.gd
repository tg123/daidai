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
	var main := packed_scene.instantiate()
	root.add_child(main)
	await process_frame

	var game := main as DaiDaiGame
	game.set_process(false)
	(game.audio as DaiDaiAudio).set_muted(true)
	var snake := game.snake
	var spawner := game.bean_spawner

	_check(game.paused, "game starts paused")
	_check(not game.has_started, "initial run has not started")
	game._toggle_pause_from_gamepad()
	_check(not game.paused and game.has_started, "gamepad primary action starts the initial run")
	game.reset_game(false)
	var resize_generation_before_reset := game.resize_generation
	game.reset_game(false)
	_check(
		game.resize_generation == resize_generation_before_reset + 1,
		"manual reset invalidates pending resize callbacks",
	)
	_check(snake.cells.size() == DaiDaiRules.START_LENGTH, "snake starts at length five")
	_check(spawner.beans.size() == spawner.target_count, "adaptive bean density is populated")
	for bean in spawner.beans:
		_check(
			not snake.has_cell(Vector2i(int(bean["x"]), int(bean["y"]))),
			"beans do not spawn on the snake",
		)

	var interpolation_start := snake.cells[0]
	snake.begin_step()
	snake.cells[0] += Vector2i.RIGHT
	snake.sync_visuals()
	snake.interpolate_visuals(0.5)
	_check(
		is_equal_approx(snake.head_node.position.x, interpolation_start.x + 0.5),
		"worm motion interpolates smoothly between grid ticks",
	)
	snake.reset(game.cols, game.rows)

	snake.previous_cells = snake.cells.duplicate()
	snake.previous_cells[0] = Vector2i(0, 0)
	snake.cells[0] = Vector2i(game.cols - 1, 0)
	snake.sync_visuals()
	snake.interpolate_visuals(0.5)
	_check(
		is_equal_approx(snake.head_node.position.x, game.cols - 0.5),
		"worm interpolation follows the shortest wrapped step",
	)
	snake.interpolate_visuals(1.0)
	_check(
		is_equal_approx(snake.head_node.position.x, game.cols - 1.0),
		"wrapped interpolation reaches the target cell",
	)
	snake.reset(game.cols, game.rows)

	var target := DaiDaiRules.wrap_position(snake.cells[0] + snake.direction, game.cols, game.rows)
	while spawner.has_cell(target):
		spawner.remove_at(spawner.index_at(target))
	var count_before := spawner.beans.size()
	spawner.add_bean(target, 0, false)
	game._game_update()
	_check(game.score == 5, "regular beans score five points")
	_check(snake.cells.size() == DaiDaiRules.START_LENGTH + 1, "bean pickup grows by one")
	_check(snake.eaten_colors == [0], "eaten color appears directly behind the head")
	_check(spawner.beans.size() == count_before + 1, "eaten bean is replaced")

	for _i in range(4):
		game._eat_bean({"x": 0, "y": 0, "color": 0})
	_check(game.boost_active, "five equal colors trigger magic")
	_check(game.boost_multiplier == 2, "first red combo doubles score")
	_check(game.speed_ms == 100.0, "red combo accelerates the game")
	var boosted_score := game.score
	game._eat_bean({"x": 0, "y": 0, "color": 1})
	_check(game.score - boosted_score == 10, "boost doubles bean score")
	game.trigger_magic(0)
	_check(game.boost_multiplier == 4, "retriggering red magic stacks the multiplier")
	game.game_clock_ms = game.boost_deadline_ms
	game._game_update()
	_check(not game.boost_active, "boost expires on the game clock")

	game.reset_game(false)
	game.set_process(false)
	game.is_raining = true
	game._eat_bean({"x": 0, "y": 0, "color": 1})
	_check(game.score == 15, "rain adds ten points before multipliers")

	game.reset_game(false)
	game.set_process(false)
	snake.cells.clear()
	for x in range(24):
		snake.cells.append(Vector2i(x, 2))
	snake.eaten_colors.clear()
	game._eat_bean({"x": 0, "y": 0, "color": 2})
	_check(snake.cells.size() == DaiDaiRules.START_LENGTH, "length 25 sheds back to five")
	_check(game.shed_skin.size() == 19, "shed segments become collision cells")
	_check(game.growth_pending == 1, "shed preserves the current tick's tail")

	game.reset_game(false)
	game.set_process(false)
	game.shed_skin = [
		{"x": 1, "y": 1, "life": 100},
		{"x": 2, "y": 1, "life": 100},
		{"x": 3, "y": 1, "life": 100},
	]
	game.trigger_magic(2)
	_check(game.shed_skin.is_empty(), "green magic recovers available skin")
	_check(game.effects.falling_beans.size() == 3, "green magic returns skin as falling beans")

	game.reset_game(false)
	game.set_process(false)
	game.shed_skin = [
		{"x": 0, "y": 0, "life": 1},
		{"x": 0, "y": 1, "life": 1},
		{"x": 0, "y": 2, "life": 1},
	]
	for _i in range(10):
		game._game_update()
	_check(game.shed_skin.size() == 3, "shed skin persists across game ticks")
	_check(
		game.shed_skin.all(func(skin: Dictionary) -> bool: return int(skin["life"]) == 1),
		"permanent shed skin is not decremented",
	)

	game.reset_game(false)
	game.set_process(false)
	snake.cells = [
		Vector2i(5, 5),
		Vector2i(6, 5),
		Vector2i(6, 6),
		Vector2i(5, 6),
		Vector2i(4, 6),
	]
	snake.direction = Vector2i(1, 0)
	snake.next_direction = snake.direction
	game._game_update()
	_check(game.game_over, "moving into the body ends the game")

	game.reset_game(false)
	game.set_process(false)
	game.god_mode = true
	snake.cells = [
		Vector2i(5, 5),
		Vector2i(6, 5),
		Vector2i(6, 6),
		Vector2i(5, 6),
		Vector2i(4, 6),
	]
	snake.direction = Vector2i(1, 0)
	snake.next_direction = snake.direction
	game._game_update()
	_check(not game.game_over, "god mode bypasses self collision")

	game.reset_game(false)
	game.set_process(false)
	var skin_target := DaiDaiRules.wrap_position(
		snake.cells[0] + snake.direction,
		game.cols,
		game.rows,
	)
	game.shed_skin = [{"x": skin_target.x, "y": skin_target.y, "life": 100}]
	game._game_update()
	_check(game.game_over, "moving into shed skin ends the game")

	game.reset_game(false)
	game.set_process(false)
	var gold_target := DaiDaiRules.wrap_position(
		snake.cells[0] + snake.direction,
		game.cols,
		game.rows,
	)
	while spawner.has_cell(gold_target):
		spawner.remove_at(spawner.index_at(gold_target))
	game.gold_beans = [{"x": gold_target.x, "y": gold_target.y, "life": 300}]
	var length_before_gold := snake.cells.size()
	game._game_update()
	_check(game.score == 30, "gold beans score thirty points")
	_check(snake.cells.size() == length_before_gold, "gold beans do not grow the snake")

	game.reset_game(false)
	game.set_process(false)
	var projectile_target := DaiDaiRules.wrap_position(
		snake.cells[0] + snake.direction,
		game.cols,
		game.rows,
	)
	while spawner.has_cell(projectile_target):
		spawner.remove_at(spawner.index_at(projectile_target))
	spawner.add_bean(projectile_target, 3, false)
	game.trigger_magic(3)
	var paused_projectile_x := float(game.golden_projectiles[0]["x"])
	game._process(0.1)
	_check(
		is_equal_approx(float(game.golden_projectiles[0]["x"]), paused_projectile_x),
		"orange projectiles do not advance while paused",
	)
	game.set_paused(false)
	game._update_projectiles()
	_check(game.gold_beans.size() == 1, "orange projectile converts a bean to gold")

	snake.cells.resize(10)
	game.trigger_magic(4)
	_check(snake.cells.size() == 5, "purple magic halves the current length")
	snake.cells.resize(4)
	game.trigger_magic(4)
	_check(snake.cells.size() == 3, "purple magic never shrinks below three")

	game.reset_game(false)
	game.set_process(false)
	if OS.is_debug_build():
		_check(game._try_debug_cheat(KEY_1), "debug key 1 is accepted")
		_check(game.boost_active, "debug key 1 triggers red magic")
		game.reset_game(false)
		_check(game._try_debug_cheat(KEY_6), "debug key 6 is accepted")
		_check(game.growth_pending == 1, "debug key 6 queues one growth unit")
		_check(not game._try_debug_cheat(KEY_0), "unmapped debug keys pass through")
		game.reset_game(false)
		_check(game._try_debug_cheat(KEY_3), "debug key 3 is accepted")
		_check(
			game.effects.falling_beans.size() == 5,
			"debug key 3 seeds visible skin conversion when no skin exists",
		)

	main.free()
	packed_scene = null
	await process_frame
	if failures.is_empty():
		print("Godot gameplay parity test passed")
		quit()
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
