extends Node3D
class_name DaiDaiSnake

const DEFAULT_BODY_COLOR := Color(0.85, 0.85, 0.78)
const HEAD_COLOR := Color(0.93, 0.93, 0.88)
const BODY_RADIUS := 0.35
const HEAD_RADIUS := 0.53

var cells: Array[Vector2i] = []
var previous_cells: Array[Vector2i] = []
var eaten_colors: Array[int] = []
var direction := Vector2i(1, 0)
var next_direction := Vector2i(1, 0)
var cols := 40
var rows := 30
var boost_active := false
var god_mode := false
var dead := false

var body_node: Node3D
var head_node: Node3D
var head_material: StandardMaterial3D
var eye_nodes: Array[Node3D] = []
var pupil_nodes: Array[Node3D] = []
var dead_eye_nodes: Array[Node3D] = []
var hand_nodes: Array[Node3D] = []
var toss_bean: MeshInstance3D
var smile_node: MeshInstance3D
var open_mouth_node: MeshInstance3D
var tongue_node: MeshInstance3D
var blink_time := 2.5
var blink_phase := 0.0
var eat_time := 0.0
var chew_time := 0.0
var throw_side := 1


func _ready() -> void:
	body_node = Node3D.new()
	body_node.name = "Body"
	add_child(body_node)
	head_node = _build_head()
	head_node.name = "Head"
	add_child(head_node)


func reset(new_cols: int, new_rows: int) -> void:
	cols = new_cols
	rows = new_rows
	cells.clear()
	eaten_colors.clear()
	direction = Vector2i(1, 0)
	next_direction = direction
	boost_active = false
	god_mode = false
	dead = false
	eat_time = 0.0
	chew_time = 0.0
	for child in body_node.get_children():
		child.free()

	var start := Vector2i(cols / 2, rows / 2)
	for i in range(DaiDaiRules.START_LENGTH):
		cells.append(start - Vector2i(i, 0))
	previous_cells = cells.duplicate()
	sync_visuals()
	interpolate_visuals(1.0)
	_set_dead_eyes(false)


func sync_visuals() -> void:
	if cells.is_empty():
		return
	while body_node.get_child_count() < cells.size() - 1:
		_create_body_segment()
	while body_node.get_child_count() > cells.size() - 1:
		body_node.get_child(body_node.get_child_count() - 1).free()

	_orient_head()
	_update_materials()


func begin_step() -> void:
	previous_cells = cells.duplicate()


func interpolate_visuals(alpha: float) -> void:
	if cells.is_empty():
		return
	var clamped_alpha := clampf(alpha, 0.0, 1.0)
	for i in range(cells.size()):
		var target := cells[i]
		var previous := previous_cells[i] if i < previous_cells.size() else target
		var delta_x := target.x - previous.x
		var delta_z := target.y - previous.y
		if delta_x > cols / 2:
			delta_x -= cols
		elif delta_x < -cols / 2:
			delta_x += cols
		if delta_z > rows / 2:
			delta_z -= rows
		elif delta_z < -rows / 2:
			delta_z += rows
		var position := Vector3(
			fposmod(previous.x + delta_x * clamped_alpha, float(cols)),
			0.4,
			fposmod(previous.y + delta_z * clamped_alpha, float(rows)),
		)
		if i == 0:
			head_node.position.x = position.x
			head_node.position.z = position.z
		else:
			var segment := body_node.get_child(i - 1) as Node3D
			segment.position.x = position.x
			segment.position.z = position.z


func _update_materials() -> void:
	var now := Time.get_ticks_msec()
	for i in range(body_node.get_child_count()):
		var segment := body_node.get_child(i) as MeshInstance3D
		var material := segment.material_override as StandardMaterial3D
		if god_mode:
			material.albedo_color = Color.from_hsv(
				fmod(now * 0.0008 + (i + 1) * 0.08, 1.0),
				1.0,
				0.55,
			)
		elif boost_active:
			var flicker := 0.7 + sin(now * 0.02 + i + 1) * 0.3
			material.albedo_color = Color(flicker, 0.3, 0.1)
		elif i < eaten_colors.size():
			material.albedo_color = DaiDaiRules.COLORS[eaten_colors[i]]
		else:
			material.albedo_color = DEFAULT_BODY_COLOR
	head_material.albedo_color = Color(1.0, 0.4, 0.1) if boost_active else HEAD_COLOR


func set_visual_state(is_boosted: bool, is_god: bool, is_dead: bool) -> void:
	var material_state_changed := boost_active != is_boosted or god_mode != is_god
	boost_active = is_boosted
	god_mode = is_god
	if dead != is_dead:
		dead = is_dead
		_set_dead_eyes(dead)
	if material_state_changed:
		_update_materials()


func play_eat(color_index: int) -> void:
	eat_time = 0.8
	chew_time = 0.0
	throw_side *= -1
	var material := toss_bean.material_override as StandardMaterial3D
	material.albedo_color = DaiDaiRules.COLORS[color_index]
	material.emission = DaiDaiRules.COLORS[color_index]
	toss_bean.visible = true


func look_at_cell(cell: Vector2i) -> void:
	if head_node == null or pupil_nodes.is_empty():
		return
	var world_direction := cell_to_world(cell) - head_node.position
	world_direction.y = 0.0
	if world_direction.length_squared() == 0.0:
		return
	var local_direction := head_node.basis.inverse() * world_direction.normalized()
	for pupil in pupil_nodes:
		pupil.position = Vector3(local_direction.x * 0.14, 0.15, local_direction.z * 0.14)


func cell_to_world(cell: Vector2i) -> Vector3:
	return Vector3(cell.x * DaiDaiRules.CELL, 0.4, cell.y * DaiDaiRules.CELL)


func has_cell(cell: Vector2i) -> bool:
	return cells.has(cell)


func trim_colors(max_count: int) -> void:
	eaten_colors.resize(mini(eaten_colors.size(), maxi(0, max_count)))


func _process(delta: float) -> void:
	if head_node == null:
		return
	var now := Time.get_ticks_msec()
	head_node.position.y = 0.4 + sin(now * 0.003) * 0.05
	for i in range(body_node.get_child_count()):
		var segment := body_node.get_child(i) as Node3D
		segment.position.y = 0.4 + sin(now * 0.003 + (i + 1) * 0.5) * 0.05

	blink_time -= delta
	if blink_time <= 0.0:
		blink_phase = minf(1.0, blink_phase + delta * 8.0)
		if blink_phase >= 1.0:
			blink_phase = -1.0
			blink_time = randf_range(2.5, 5.0)
	elif blink_phase < 0.0:
		blink_phase = minf(0.0, blink_phase + delta * 8.0)
	var eye_scale := 1.0 - sin(absf(blink_phase) * PI) * 0.92 if blink_phase != 0.0 else 1.0
	for eye in eye_nodes:
		eye.scale.y = eye_scale
	if not dead:
		for pupil in pupil_nodes:
			pupil.visible = eye_scale > 0.4

	var swim_phase := now * 0.005
	for i in range(hand_nodes.size()):
		var hand := hand_nodes[i]
		var side := -1 if i == 0 else 1
		hand.rotation.x = -0.2 - sin(swim_phase + (PI if side < 0 else 0.0)) * 0.45
		hand.rotation.z = side * 1.15 + cos(swim_phase) * 0.12

	if eat_time > 0.0:
		eat_time = maxf(0.0, eat_time - delta)
		var progress := 1.0 - eat_time / 0.8
		var active_hand := hand_nodes[0] if throw_side < 0 else hand_nodes[1]
		active_hand.rotation.x -= sin(progress * PI) * 1.9
		toss_bean.position = Vector3(
			throw_side * lerpf(0.5, 0.0, progress),
			lerpf(-0.05, 0.4, progress) + sin(progress * PI) * 1.3,
			lerpf(0.1, 0.55, progress),
		)
		toss_bean.rotation += Vector3(delta * 13.0, delta * 17.0, 0.0)
		if eat_time <= 0.0:
			toss_bean.visible = false
			chew_time = 0.7
	if eat_time > 0.0 or chew_time > 0.0:
		smile_node.visible = false
		open_mouth_node.visible = true
		tongue_node.visible = true
		var mouth_scale := 1.0
		if chew_time > 0.0:
			chew_time = maxf(0.0, chew_time - delta)
			var chew_progress := 1.0 - chew_time / 0.7
			mouth_scale = 0.5 + absf(sin(chew_progress * PI * 4.0)) * 0.7
			var bob := absf(sin(chew_progress * PI * 4.0)) * 0.12
			head_node.position.y += bob
			head_node.scale = Vector3(1.0 + bob * 0.4, 1.0 - bob * 0.5, 1.0 + bob * 0.4)
		open_mouth_node.scale = Vector3.ONE * mouth_scale
		tongue_node.scale = Vector3.ONE * mouth_scale
	else:
		smile_node.visible = true
		open_mouth_node.visible = false
		tongue_node.visible = false
		head_node.scale = Vector3.ONE

	if god_mode or boost_active:
		_update_materials()


func _build_head() -> Node3D:
	var head := Node3D.new()
	var head_mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = HEAD_RADIUS
	sphere.height = HEAD_RADIUS * 1.9
	sphere.radial_segments = 24
	sphere.rings = 20
	head_mesh.mesh = sphere
	head_material = _material(HEAD_COLOR, 0.3)
	head_mesh.material_override = head_material
	head_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	head.add_child(head_mesh)

	var eye_material := _material(Color.WHITE, 0.2)
	var pupil_material := _material(Color(0.067, 0.067, 0.067), 0.5)
	var dead_material := _material(Color(0.82, 0.08, 0.08), 0.5)
	for side in [-1, 1]:
		var eye_root := Node3D.new()
		eye_root.position = Vector3(side * 0.28, 0.44, 0.11)
		var eye := _sphere_mesh(0.285, eye_material)
		eye_root.add_child(eye)
		var pupil := _sphere_mesh(0.105, pupil_material)
		pupil.position = Vector3(0.0, 0.15, 0.16)
		eye_root.add_child(pupil)
		var dead_x := Node3D.new()
		for angle in [-PI / 4.0, PI / 4.0]:
			var bar := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = Vector3(0.42, 0.055, 0.055)
			bar.mesh = box
			bar.material_override = dead_material
			bar.rotation.z = angle
			dead_x.add_child(bar)
		dead_x.position = Vector3(0.0, 0.16, 0.24)
		dead_x.visible = false
		eye_root.add_child(dead_x)
		head.add_child(eye_root)
		eye_nodes.append(eye_root)
		pupil_nodes.append(pupil)
		dead_eye_nodes.append(dead_x)

	smile_node = MeshInstance3D.new()
	var smile_mesh := BoxMesh.new()
	smile_mesh.size = Vector3(0.24, 0.035, 0.035)
	smile_node.mesh = smile_mesh
	smile_node.material_override = _material(Color(0.23, 0.1, 0.06), 0.6)
	smile_node.position = Vector3(0.0, 0.33, 0.54)
	head.add_child(smile_node)

	open_mouth_node = MeshInstance3D.new()
	var mouth_mesh := CylinderMesh.new()
	mouth_mesh.top_radius = 0.12
	mouth_mesh.bottom_radius = 0.12
	mouth_mesh.height = 0.025
	mouth_mesh.radial_segments = 20
	open_mouth_node.mesh = mouth_mesh
	open_mouth_node.material_override = _material(Color(0.23, 0.1, 0.06), 0.6)
	open_mouth_node.rotation.x = PI / 2.0
	open_mouth_node.position = Vector3(0.0, 0.4, 0.55)
	open_mouth_node.visible = false
	head.add_child(open_mouth_node)

	tongue_node = MeshInstance3D.new()
	var tongue_mesh := CylinderMesh.new()
	tongue_mesh.top_radius = 0.07
	tongue_mesh.bottom_radius = 0.07
	tongue_mesh.height = 0.03
	tongue_mesh.radial_segments = 16
	tongue_node.mesh = tongue_mesh
	tongue_node.material_override = _material(Color(0.8, 0.2, 0.27), 0.55)
	tongue_node.rotation.x = PI / 2.0
	tongue_node.position = Vector3(0.0, 0.34, 0.57)
	tongue_node.visible = false
	head.add_child(tongue_node)

	for side in [-1, 1]:
		var hand_root := Node3D.new()
		hand_root.position = Vector3(side * 0.44, 0.4, 0.1)
		var arm := MeshInstance3D.new()
		var cylinder := CylinderMesh.new()
		cylinder.top_radius = 0.035
		cylinder.bottom_radius = 0.035
		cylinder.height = 0.4
		arm.mesh = cylinder
		arm.material_override = _material(Color(0.067, 0.067, 0.067), 0.7)
		arm.position.y = -0.2
		hand_root.add_child(arm)
		var palm := _sphere_mesh(0.09, arm.material_override)
		palm.position.y = -0.45
		hand_root.add_child(palm)
		head.add_child(hand_root)
		hand_nodes.append(hand_root)

	toss_bean = _sphere_mesh(0.16, _material(Color.WHITE, 0.4))
	var toss_material := toss_bean.material_override as StandardMaterial3D
	toss_material.emission_enabled = true
	toss_material.emission_energy_multiplier = 0.4
	toss_bean.visible = false
	head.add_child(toss_bean)
	return head


func _create_body_segment() -> void:
	var segment := _sphere_mesh(BODY_RADIUS, _material(DEFAULT_BODY_COLOR, 0.3))
	var mesh := segment.mesh as SphereMesh
	mesh.radial_segments = 12
	mesh.rings = 12
	segment.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	body_node.add_child(segment)


func _sphere_mesh(radius: float, material: Material) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2.0
	sphere.radial_segments = 16
	sphere.rings = 12
	instance.mesh = sphere
	instance.material_override = material
	return instance


func _material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.metallic = 0.05
	return material


func _orient_head() -> void:
	head_node.rotation.y = atan2(direction.x, direction.y)


func _set_dead_eyes(value: bool) -> void:
	for pupil in pupil_nodes:
		pupil.visible = not value
	for dead_eye in dead_eye_nodes:
		dead_eye.visible = value
