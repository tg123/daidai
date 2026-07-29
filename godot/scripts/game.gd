extends Node3D
class_name DaiDaiGame

const BASE_SPEED_MS := 150.0
const MIN_SPEED_MS := 50.0
const SHED_LENGTH := 25
const SHED_VISUAL_LIFE := 600
const GOLD_LIFE := 300
const BOOST_DURATION_MS := 15000.0
const SWIPE_THRESHOLD := 24.0
const CAMERA_VIEW_DIRECTION := Vector3(0.0, 0.72, 1.0)
const CAMERA_DEPTH_PROJECTION := 0.5843
const MOBILE_WIDTH := 720.0
const MOBILE_SHORT_SIDE := 16
const DESKTOP_SHORT_SIDE := 22
const MOBILE_RESERVED_TOP := 38.0
const DESKTOP_RESERVED_TOP := 42.0
const MOBILE_BASE_DPI := 160.0
const MAX_MOBILE_SCALE := 3.0

@onready var snake: DaiDaiSnake = $Snake
@onready var bean_spawner: DaiDaiBeanSpawner = $BeanSpawner
@onready var effects: DaiDaiEffects = $Effects
@onready var audio: DaiDaiAudio = $Audio
@onready var hud: DaiDaiHUD = $HUD

var cols := 40
var rows := 30
var score := 0
var hi_score := 0
var beans_eaten := 0
var paused := true
var game_over := false
var has_started := false
var god_mode := false
var game_accumulator_ms := 0.0
var game_clock_ms := 0.0
var elapsed_seconds := 0
var speed_ms := BASE_SPEED_MS
var base_speed_ms := BASE_SPEED_MS
var growth_pending := 0
var combo_color := -1
var combo_count := 0
var boost_active := false
var boost_multiplier := 1
var boost_deadline_ms := 0.0
var is_raining := false
var rain_generation := 0
var shed_skin: Array[Dictionary] = []
var gold_beans: Array[Dictionary] = []
var golden_projectiles: Array[Dictionary] = []
var touch_start := Vector2.ZERO
var touch_tracking := false
var touch_moved := false
var typed_buffer := ""
var konami_buffer: Array[String] = []
var heart_buffer: Array[String] = []
var tribute_triggered := false
var next_sky_drop_ms := 0.0
var rng := RandomNumberGenerator.new()
var viewport_baseline := Vector2.ZERO
var resize_generation := 0

const KONAMI: Array[String] = [
	"arrowup", "arrowup", "arrowdown", "arrowdown",
	"arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a",
]
const HEART: Array[String] = [
	"ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft",
	"ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft",
	"ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft",
	"ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft",
]


func _enter_tree() -> void:
	if OS.has_feature("mobile"):
		var dpi := maxf(MOBILE_BASE_DPI, DisplayServer.screen_get_dpi())
		get_window().content_scale_factor = clampf(dpi / MOBILE_BASE_DPI, 1.0, MAX_MOBILE_SCALE)


func _ready() -> void:
	rng.randomize()
	viewport_baseline = get_viewport().get_visible_rect().size
	get_viewport().size_changed.connect(_on_viewport_size_changed)
	_compute_grid()
	hi_score = _load_hi_score()
	bean_spawner.bean_landed.connect(_on_bean_landed)
	effects.falling_bean_landed.connect(_on_falling_bean_landed)
	hud.bind_game(self)
	reset_game(false)
	next_sky_drop_ms = Time.get_ticks_msec() + rng.randf_range(60000.0, 120000.0)


func reset_game(run_immediately: bool = false) -> void:
	resize_generation += 1
	_compute_grid()
	score = 0
	hi_score = _load_hi_score()
	beans_eaten = 0
	game_over = false
	paused = not run_immediately
	has_started = run_immediately
	god_mode = false
	game_accumulator_ms = 0.0
	game_clock_ms = 0.0
	elapsed_seconds = 0
	speed_ms = BASE_SPEED_MS
	base_speed_ms = BASE_SPEED_MS
	growth_pending = 0
	combo_color = -1
	combo_count = 0
	boost_active = false
	boost_multiplier = 1
	boost_deadline_ms = 0.0
	is_raining = false
	rain_generation += 1
	shed_skin.clear()
	gold_beans.clear()
	golden_projectiles.clear()
	typed_buffer = ""
	konami_buffer.clear()
	heart_buffer.clear()
	_play_audio("heartbeat_stop")
	snake.reset(cols, rows)
	effects.reset(cols, rows)
	bean_spawner.reset(cols, rows, _is_occupied)
	_fit_camera()
	_show_message("" if run_immediately else _start_prompt())
	if run_immediately:
		_play_audio("start")
	_refresh_ui()


func _process(delta: float) -> void:
	_poll_direction()
	if not paused and not game_over:
		var delta_ms := delta * 1000.0
		game_accumulator_ms += delta_ms
		while game_accumulator_ms >= speed_ms:
			game_accumulator_ms -= speed_ms
			_game_update()
			if game_over:
				break
		game_clock_ms += delta_ms
		var seconds := int(floor(game_clock_ms / 1000.0))
		if seconds != elapsed_seconds:
			elapsed_seconds = seconds
			_refresh_ui()
		_update_sky_drop()
	snake.interpolate_visuals(game_accumulator_ms / speed_ms)
	if not paused and not game_over:
		_update_projectiles()
	_update_gaze()
	snake.set_visual_state(boost_active, god_mode, game_over)


func _game_update() -> void:
	if boost_active and game_clock_ms >= boost_deadline_ms:
		_end_boost()

	snake.begin_step()
	snake.direction = snake.next_direction
	var head := DaiDaiRules.wrap_position(snake.cells[0] + snake.direction, cols, rows)
	if not god_mode and (snake.has_cell(head) or _array_has_cell(shed_skin, head)):
		_finish_game()
		return

	snake.cells.push_front(head)
	effects.spawn_ripple(snake.cell_to_world(head))

	var bean := bean_spawner.consume_at(head)
	if not bean.is_empty():
		snake.eaten_colors.push_front(int(bean["color"]))
		_eat_bean(bean)
		bean_spawner.spawn_bean()

	var gold_index := _find_cell(gold_beans, head)
	if gold_index >= 0:
		gold_beans.remove_at(gold_index)
		score += 30
		_play_audio("gold")
		_spawn_particles(head, Color.GOLD, 12)
		bean_spawner.spawn_bean()

	if growth_pending > 0:
		growth_pending -= 1
	else:
		snake.cells.pop_back()

	for gold in gold_beans:
		gold["life"] = int(gold["life"]) - 1
	for i in range(gold_beans.size() - 1, -1, -1):
		if int(gold_beans[i]["life"]) <= 0:
			gold_beans.remove_at(i)

	snake.sync_visuals()
	_sync_effect_entities()
	_refresh_ui()


func _eat_bean(bean: Dictionary) -> void:
	var color_index := int(bean["color"])
	beans_eaten += 1
	score += DaiDaiRules.eat_score(is_raining, boost_multiplier if boost_active else 1, god_mode)
	growth_pending += 1
	_play_audio("eat")
	snake.play_eat(color_index)
	_spawn_particles(Vector2i(int(bean["x"]), int(bean["y"])), DaiDaiRules.COLORS[color_index], 8)

	if color_index == combo_color:
		combo_count += 1
	else:
		combo_color = color_index
		combo_count = 1
	if combo_count >= DaiDaiRules.COMBO_THRESHOLD:
		combo_color = -1
		combo_count = 0
		trigger_magic(color_index)

	var projected_length := snake.cells.size() + growth_pending
	if projected_length >= 20 and projected_length < SHED_LENGTH:
		_play_audio("heartbeat_start")
		audio.set_loop_volume("beat", 0.25 + (projected_length - 20) / 4.0 * 0.75)
	if projected_length >= SHED_LENGTH:
		_play_audio("heartbeat_stop")
		_play_audio("freeze")
		while snake.cells.size() > DaiDaiRules.START_LENGTH:
			var tail: Vector2i = snake.cells.pop_back()
			shed_skin.append({"x": tail.x, "y": tail.y, "life": SHED_VISUAL_LIFE})
		snake.trim_colors(DaiDaiRules.START_LENGTH - 1)
		growth_pending = 1
		_show_effect(_t("fx.shed"))
		base_speed_ms = maxf(80.0, base_speed_ms - 5.0)
		speed_ms = base_speed_ms


func trigger_magic(color_index: int) -> void:
	_play_audio("combo")
	match color_index:
		0:
			_play_audio("magic_red")
			speed_ms = maxf(MIN_SPEED_MS, base_speed_ms - 50.0)
			boost_active = true
			boost_multiplier *= 2
			boost_deadline_ms = game_clock_ms + BOOST_DURATION_MS
			_spawn_particles(snake.cells[0], Color(1.0, 0.27, 0.27), 15)
			_show_effect(_t("fx.boost", {"mult": boost_multiplier}))
		1:
			_play_audio("magic_blue")
			_start_heavy_rain()
			hud.play_rain_filter()
			_show_effect(_t("fx.rain"))
		2:
			_play_audio("magic_green")
			var count := mini(5, shed_skin.size())
			for _i in range(count):
				var index := rng.randi_range(0, shed_skin.size() - 1)
				var skin := shed_skin[index]
				shed_skin.remove_at(index)
				_spawn_falling_bean(
					Vector2i(int(skin["x"]), int(skin["y"])),
					rng.randi_range(0, DaiDaiRules.COLORS.size() - 1),
				)
			_show_effect(_t("fx.green"))
		3:
			_play_audio("magic_orange")
			_spawn_projectile()
			_show_effect(_t("fx.gold"))
		4:
			_play_audio("magic_purple")
			var half_length := maxi(3, int(floor(snake.cells.size() / 2.0)))
			snake.cells.resize(half_length)
			snake.trim_colors(half_length - 1)
			if half_length + growth_pending < 20:
				_play_audio("heartbeat_stop")
			snake.sync_visuals()
			_show_effect(_t("fx.halve"))
	_sync_effect_entities()
	_refresh_ui()


func activate_god_mode() -> void:
	if god_mode:
		return
	god_mode = true
	_play_audio("magic_orange")
	_show_effect(_t("fx.godmode"))
	for i in range(5):
		_spawn_particles(snake.cells[0], Color.from_hsv(i / 5.0, 1.0, 0.5), 20)


func spawn_meteor_shower() -> void:
	_show_effect(_t("fx.meteor"))
	_play_audio("magic_blue")
	for i in range(30):
		_spawn_delayed_falling_bean(i * 0.06)


func activate_tribute() -> void:
	if tribute_triggered:
		return
	tribute_triggered = true
	_play_audio("magic_orange")
	hud.show_tribute(_t("subtitle"))


func set_paused(value: bool) -> void:
	if game_over:
		return
	if paused and not value:
		has_started = true
	paused = value
	_show_message(_t("paused") if paused else "")
	_refresh_ui()


func toggle_pause() -> void:
	set_paused(not paused)


func toggle_mute() -> void:
	audio.toggle_muted()
	_refresh_ui()


func cycle_language() -> void:
	if not paused or game_over:
		_show_effect(_t("hint.langPauseFirst"))
		return
	hud.toggle_language_menu()


func set_language(locale: String) -> void:
	if not paused or game_over:
		_show_effect(_t("hint.langPauseFirst"))
		return
	hud.set_locale(locale)
	_show_message(_start_prompt() if not has_started else _t("paused"))
	_refresh_ui()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key_event := event as InputEventKey
		var token := _key_token(key_event)
		if not token.is_empty():
			_capture_easter_eggs(token)
		if _try_debug_cheat(key_event.keycode):
			get_viewport().set_input_as_handled()
			return
		if key_event.keycode == KEY_ENTER and (paused or game_over):
			reset_game(true)
			get_viewport().set_input_as_handled()
			return
		if key_event.keycode == KEY_SPACE:
			if not game_over:
				toggle_pause()
			get_viewport().set_input_as_handled()
			return
		if _is_direction_key(key_event.keycode):
			if paused and not game_over and not has_started:
				set_paused(false)
				_play_audio("start")
			get_viewport().set_input_as_handled()
	elif event is InputEventJoypadButton and event.pressed:
		var button := event as InputEventJoypadButton
		match button.button_index:
			JOY_BUTTON_A, JOY_BUTTON_START:
				if game_over:
					reset_game(true)
				else:
					_toggle_pause_from_gamepad()
			JOY_BUTTON_B, JOY_BUTTON_BACK:
				if paused or game_over:
					reset_game(true)
			JOY_BUTTON_X:
				toggle_mute()
			JOY_BUTTON_Y:
				cycle_language()
	elif event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			touch_start = touch.position
			touch_tracking = true
			touch_moved = false
		elif touch_tracking:
			if not touch_moved and paused and not game_over and not has_started:
				set_paused(false)
				_play_audio("start")
			touch_tracking = false
	elif event is InputEventScreenDrag and touch_tracking:
		var drag := event as InputEventScreenDrag
		var delta := drag.position - touch_start
		if delta.length() >= SWIPE_THRESHOLD:
			touch_moved = true
			if paused and not game_over and not has_started:
				set_paused(false)
				_play_audio("start")
			if not paused and not game_over:
				var next := DaiDaiRules.classify_delta(delta)
				if next != Vector2i.ZERO and not DaiDaiRules.is_opposite(snake.direction, next):
					snake.next_direction = next
			touch_start = drag.position


func _toggle_pause_from_gamepad() -> void:
	var starting_initial_run := paused and not has_started
	toggle_pause()
	if starting_initial_run and not paused:
		_play_audio("start")


func _poll_direction() -> void:
	var dx := 0
	var dy := 0
	if Input.is_action_pressed("snake_up"):
		dy = -1
	elif Input.is_action_pressed("snake_down"):
		dy = 1
	if Input.is_action_pressed("snake_left"):
		dx = -1
	elif Input.is_action_pressed("snake_right"):
		dx = 1
	var next := Vector2i(dx, dy)
	if next == Vector2i.ZERO:
		return
	if paused and not game_over and not has_started:
		set_paused(false)
		_play_audio("start")
	if not paused and not game_over and not DaiDaiRules.is_opposite(snake.direction, next):
		snake.next_direction = next


func _capture_easter_eggs(token: String) -> void:
	var lower := token.to_lower()
	konami_buffer.append(lower)
	if konami_buffer.size() > KONAMI.size():
		konami_buffer.pop_front()
	if konami_buffer == KONAMI:
		konami_buffer.clear()
		activate_god_mode()
	if token.begins_with("Arrow"):
		heart_buffer.append(token)
		if heart_buffer.size() > HEART.size():
			heart_buffer.pop_front()
		if heart_buffer == HEART:
			heart_buffer.clear()
			activate_tribute()
	if token.length() == 1 and token.to_lower() >= "a" and token.to_lower() <= "z":
		typed_buffer = (typed_buffer + token.to_lower()).right(6)
		if typed_buffer == "daidai":
			typed_buffer = ""
			spawn_meteor_shower()


func _try_debug_cheat(keycode: Key) -> bool:
	if not OS.is_debug_build() or game_over:
		return false
	match keycode:
		KEY_1:
			trigger_magic(0)
		KEY_2:
			trigger_magic(1)
		KEY_3:
			if shed_skin.is_empty():
				for _i in range(5):
					var cell := _find_free_cell(30)
					if cell.x >= 0:
						shed_skin.append({"x": cell.x, "y": cell.y, "life": SHED_VISUAL_LIFE})
			trigger_magic(2)
		KEY_4:
			trigger_magic(3)
		KEY_5:
			trigger_magic(4)
		KEY_6:
			growth_pending += 1
			_show_effect(_t("fx.lenPlus"))
		_:
			return false
	return true


func _start_heavy_rain() -> void:
	rain_generation += 1
	var generation := rain_generation
	is_raining = true
	effects.start_heavy_rain()
	_rain_bean_waves(generation)


func _rain_bean_waves(generation: int) -> void:
	for _wave in range(5):
		await get_tree().create_timer(0.5).timeout
		if generation != rain_generation:
			return
		for _i in range(3):
			var cell := _find_free_cell(50)
			if cell.x >= 0:
				_spawn_falling_bean(cell, rng.randi_range(0, DaiDaiRules.COLORS.size() - 1))
	await get_tree().create_timer(1.0).timeout
	if generation == rain_generation:
		is_raining = false


func _spawn_projectile() -> void:
	if snake.cells.is_empty():
		return
	var node := effects.create_projectile(snake.cell_to_world(snake.cells[0]))
	golden_projectiles.append(
		{
			"x": float(snake.cells[0].x),
			"z": float(snake.cells[0].y),
			"dx": snake.direction.x * 0.4,
			"dz": snake.direction.y * 0.4,
			"life": 120,
			"node": node,
		},
	)


func _update_projectiles() -> void:
	var entities_changed := false
	for i in range(golden_projectiles.size() - 1, -1, -1):
		var projectile := golden_projectiles[i]
		projectile["x"] = float(projectile["x"]) + float(projectile["dx"])
		projectile["z"] = float(projectile["z"]) + float(projectile["dz"])
		projectile["life"] = int(projectile["life"]) - 1
		var node := projectile["node"] as Node3D
		if node != null:
			node.position = Vector3(float(projectile["x"]), 0.5, float(projectile["z"]))
			node.rotation.y += 0.2
		for j in range(bean_spawner.beans.size() - 1, -1, -1):
			var bean := bean_spawner.beans[j]
			if _projectile_hits(projectile, Vector2i(int(bean["x"]), int(bean["y"]))):
				var hit := bean_spawner.remove_at(j)
				gold_beans.append({"x": hit["x"], "y": hit["y"], "life": GOLD_LIFE})
				entities_changed = true
				bean_spawner.spawn_bean()
				_spawn_particles(Vector2i(int(hit["x"]), int(hit["y"])), Color.GOLD, 8)
				_play_audio("gold")
		for j in range(shed_skin.size() - 1, -1, -1):
			if _projectile_hits(
				projectile,
				Vector2i(int(shed_skin[j]["x"]), int(shed_skin[j]["y"])),
			):
				var hit := shed_skin[j]
				shed_skin.remove_at(j)
				gold_beans.append({"x": hit["x"], "y": hit["y"], "life": GOLD_LIFE})
				entities_changed = true
				_spawn_particles(Vector2i(int(hit["x"]), int(hit["y"])), Color.GOLD, 10)
				_play_audio("gold")
		if (
			int(projectile["life"]) <= 0
			or float(projectile["x"]) < -2.0
			or float(projectile["x"]) > cols + 2.0
			or float(projectile["z"]) < -2.0
			or float(projectile["z"]) > rows + 2.0
		):
			if node != null:
				node.queue_free()
			golden_projectiles.remove_at(i)
	if entities_changed:
		_sync_effect_entities()


func _projectile_hits(projectile: Dictionary, cell: Vector2i) -> bool:
	var dx := float(projectile["x"]) - cell.x
	var dz := float(projectile["z"]) - cell.y
	return dx * dx + dz * dz < 0.64


func _sync_effect_entities() -> void:
	effects.sync_entities(shed_skin, gold_beans)


func _update_gaze() -> void:
	if snake.cells.is_empty() or bean_spawner.beans.is_empty():
		return
	var head := snake.cells[0]
	var nearest := head
	var best_distance := INF
	for bean in bean_spawner.beans:
		var cell := Vector2i(int(bean["x"]), int(bean["y"]))
		var distance := Vector2(cell - head).length_squared()
		if distance < best_distance:
			best_distance = distance
			nearest = cell
	snake.look_at_cell(nearest)


func _end_boost() -> void:
	boost_active = false
	boost_multiplier = 1
	boost_deadline_ms = 0.0
	speed_ms = base_speed_ms
	_play_audio("speed_end")
	_show_effect(_t("fx.boostEnd"))


func _finish_game() -> void:
	game_over = true
	snake.set_visual_state(boost_active, god_mode, true)
	_play_audio("heartbeat_stop")
	_play_audio("die")
	var is_new := score > hi_score
	if is_new:
		hi_score = score
		_save_hi_score()
	_show_message(
		_t("over.new", {"score": score})
		if is_new
		else _t("over.normal", {"score": score, "hi": hi_score})
	)
	_refresh_ui()


func _compute_grid() -> void:
	var size := get_viewport().get_visible_rect().size
	var short_side := MOBILE_SHORT_SIDE if _is_mobile_view(size) else DESKTOP_SHORT_SIDE
	var available_height := maxf(200.0, size.y - _reserved_top(size))
	var aspect := maxf(1.0, size.x) / available_height
	if aspect >= 1.0:
		rows = int(round(short_side / CAMERA_DEPTH_PROJECTION))
		cols = maxi(short_side, int(round(short_side * aspect)))
	else:
		cols = short_side
		rows = maxi(short_side, int(round(short_side / (aspect * CAMERA_DEPTH_PROJECTION))))
	cols = mini(cols, 120)
	rows = mini(rows, 120)


func _fit_camera() -> void:
	var camera := $Camera3D as Camera3D
	var size := get_viewport().get_visible_rect().size
	var aspect := maxf(0.01, size.x / maxf(1.0, size.y - _reserved_top(size)))
	var center := Vector3((cols - 1) / 2.0, 0.35, (rows - 1) / 2.0)
	var view_direction := CAMERA_VIEW_DIRECTION.normalized()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.keep_aspect = Camera3D.KEEP_HEIGHT
	camera.position = center + view_direction * 80.0
	camera.look_at(center, Vector3.UP)

	var inverse_basis := camera.global_transform.basis.inverse()
	var min_view := Vector2(INF, INF)
	var max_view := Vector2(-INF, -INF)
	for world_y in [-0.4, 1.8]:
		for world_x in [-0.75, cols - 0.25]:
			for world_z in [-0.75, rows - 0.25]:
				var local := inverse_basis * (Vector3(world_x, world_y, world_z) - center)
				min_view.x = minf(min_view.x, local.x)
				min_view.y = minf(min_view.y, local.y)
				max_view.x = maxf(max_view.x, local.x)
				max_view.y = maxf(max_view.y, local.y)
	var required_width := max_view.x - min_view.x + 0.6
	var required_height := max_view.y - min_view.y + 0.6
	camera.size = maxf(required_height, required_width / aspect) * 1.01
	effects.configure_environment(cols, rows, camera.size)


func _reserved_top(size: Vector2) -> float:
	return MOBILE_RESERVED_TOP if _is_mobile_view(size) else DESKTOP_RESERVED_TOP


func _is_mobile_view(size: Vector2) -> bool:
	return OS.has_feature("mobile") or DisplayServer.is_touchscreen_available() or size.x <= MOBILE_WIDTH


func _is_occupied(cell: Vector2i) -> bool:
	return (
		snake.has_cell(cell)
		or bean_spawner.has_cell(cell)
		or _array_has_cell(shed_skin, cell)
		or _array_has_cell(gold_beans, cell)
	)


func _array_has_cell(items: Array[Dictionary], cell: Vector2i) -> bool:
	return _find_cell(items, cell) >= 0


func _find_cell(items: Array[Dictionary], cell: Vector2i) -> int:
	for i in range(items.size()):
		if int(items[i]["x"]) == cell.x and int(items[i]["y"]) == cell.y:
			return i
	return -1


func _find_free_cell(max_attempts: int) -> Vector2i:
	for _i in range(max_attempts):
		var cell := Vector2i(rng.randi_range(0, cols - 1), rng.randi_range(0, rows - 1))
		if not _is_occupied(cell):
			return cell
	return Vector2i(-1, -1)


func _spawn_particles(cell: Vector2i, color: Color, count: int) -> void:
	effects.spawn_particles(snake.cell_to_world(cell), color, count)


func _spawn_falling_bean(cell: Vector2i, color_index: int) -> void:
	effects.spawn_falling_bean(cell, color_index)


func _spawn_delayed_falling_bean(delay: float) -> void:
	var generation := resize_generation
	await get_tree().create_timer(delay).timeout
	if generation != resize_generation:
		return
	var cell := Vector2i(rng.randi_range(0, cols - 1), rng.randi_range(0, rows - 1))
	_spawn_falling_bean(cell, rng.randi_range(0, DaiDaiRules.COLORS.size() - 1))


func _on_falling_bean_landed(cell: Vector2i, color_index: int) -> void:
	if _is_occupied(cell):
		bean_spawner.spawn_bean()
	else:
		bean_spawner.add_bean(cell, color_index, false)


func _on_bean_landed(cell: Vector2i) -> void:
	_play_audio("plop")
	effects.spawn_ripple(snake.cell_to_world(cell))


func _update_sky_drop() -> void:
	var now := Time.get_ticks_msec()
	if now < next_sky_drop_ms:
		return
	next_sky_drop_ms = now + rng.randf_range(60000.0, 90000.0)
	for i in range(rng.randi_range(0, 3)):
		var cell := _find_free_cell(30)
		if cell.x >= 0:
			_spawn_delayed_specific_bean(
				cell,
				rng.randi_range(0, DaiDaiRules.COLORS.size() - 1),
				i * 0.18,
			)


func _spawn_delayed_specific_bean(cell: Vector2i, color_index: int, delay: float) -> void:
	var generation := resize_generation
	await get_tree().create_timer(delay).timeout
	if generation != resize_generation:
		return
	_spawn_falling_bean(cell, color_index)


func _key_token(event: InputEventKey) -> String:
	match event.keycode:
		KEY_UP:
			return "ArrowUp"
		KEY_DOWN:
			return "ArrowDown"
		KEY_LEFT:
			return "ArrowLeft"
		KEY_RIGHT:
			return "ArrowRight"
	if event.unicode > 0:
		return char(event.unicode)
	return ""


func _is_direction_key(keycode: Key) -> bool:
	return keycode in [KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_W, KEY_A, KEY_S, KEY_D]


func _start_prompt() -> String:
	if not Input.get_connected_joypads().is_empty():
		return _t("start.gamepad")
	if DisplayServer.is_touchscreen_available():
		return _t("start.touch") if OS.has_feature("mobile") else _t("start.both")
	return _t("start.keyboard")


func _play_audio(name: String) -> void:
	audio.play(name)


func _t(key: String, params: Dictionary = {}) -> String:
	return hud.translate(key, params)


func _show_message(text: String) -> void:
	hud.show_message(text)


func _show_effect(text: String) -> void:
	hud.show_effect(text)


func _refresh_ui() -> void:
	hud.update_state(
		{
			"score": score,
			"hi_score": hi_score,
			"elapsed_seconds": elapsed_seconds,
			"length": snake.cells.size(),
			"combo_color": combo_color,
			"combo_count": combo_count,
			"boost_active": boost_active,
			"boost_multiplier": boost_multiplier,
			"boost_remaining": maxf(0.0, boost_deadline_ms - game_clock_ms) / 1000.0,
			"paused": paused,
			"game_over": game_over,
			"muted": audio.is_muted(),
		},
	)


func _load_hi_score() -> int:
	var config := ConfigFile.new()
	if config.load("user://settings.cfg") != OK:
		return 0
	return maxi(0, int(config.get_value("game", "hi_score", 0)))


func _save_hi_score() -> void:
	var config := ConfigFile.new()
	config.load("user://settings.cfg")
	config.set_value("game", "hi_score", hi_score)
	config.save("user://settings.cfg")


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and not paused and not game_over:
		set_paused(true)


func _on_viewport_size_changed() -> void:
	var current := get_viewport().get_visible_rect().size
	if (
		absf(current.x - viewport_baseline.x) < 80.0
		and absf(current.y - viewport_baseline.y) < 80.0
	):
		_fit_camera()
		return
	viewport_baseline = current
	resize_generation += 1
	_reset_after_resize(resize_generation)


func _reset_after_resize(generation: int) -> void:
	await get_tree().create_timer(0.8).timeout
	if generation == resize_generation:
		reset_game(false)
