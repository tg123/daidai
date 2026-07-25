extends Node3D
class_name DaiDaiBeanSpawner

signal bean_landed(cell: Vector2i)

const MAX_SPAWN_ATTEMPTS := 100
const DROP_PHASE_RATE := 2.1
const DROP_BOUNCE_RATE := 3.6

var beans: Array[Dictionary] = []
var cols := 40
var rows := 30
var target_count := DaiDaiRules.BEAN_COUNT
var occupied_check: Callable
var rng := RandomNumberGenerator.new()


func _ready() -> void:
	rng.randomize()


func reset(new_cols: int, new_rows: int, is_occupied: Callable) -> void:
	cols = new_cols
	rows = new_rows
	target_count = clampi(int(round(cols * rows / 60.0)), DaiDaiRules.BEAN_COUNT, 40)
	occupied_check = is_occupied
	for bean in beans:
		var node := bean.get("node") as Node
		if node != null:
			node.free()
	beans.clear()
	for _i in range(target_count):
		spawn_bean()


func spawn_bean() -> bool:
	for _attempt in range(MAX_SPAWN_ATTEMPTS):
		var cell := Vector2i(rng.randi_range(0, cols - 1), rng.randi_range(0, rows - 1))
		if occupied_check.is_valid() and occupied_check.call(cell):
			continue
		add_bean(cell, rng.randi_range(0, DaiDaiRules.COLORS.size() - 1), true)
		return true
	return false


func add_bean(cell: Vector2i, color_index: int, drop_in: bool = true) -> void:
	var node := _create_bean(color_index)
	node.position = Vector3(cell.x, 22.4 if drop_in else 0.4, cell.y)
	add_child(node)
	beans.append(
		{
			"x": cell.x,
			"y": cell.y,
			"color": color_index,
			"node": node,
			"drop_phase": 1.0 if drop_in else 0.0,
			"drop_bounce": 0.0,
		},
	)


func consume_at(cell: Vector2i) -> Dictionary:
	for i in range(beans.size()):
		var bean := beans[i]
		if int(bean["x"]) == cell.x and int(bean["y"]) == cell.y:
			beans.remove_at(i)
			var node := bean["node"] as Node
			node.queue_free()
			return bean
	return {}


func remove_at(index: int) -> Dictionary:
	if index < 0 or index >= beans.size():
		return {}
	var bean := beans[index]
	beans.remove_at(index)
	var node := bean["node"] as Node
	node.queue_free()
	return bean


func index_at(cell: Vector2i) -> int:
	for i in range(beans.size()):
		if int(beans[i]["x"]) == cell.x and int(beans[i]["y"]) == cell.y:
			return i
	return -1


func has_cell(cell: Vector2i) -> bool:
	return index_at(cell) >= 0


func _process(delta: float) -> void:
	var now := Time.get_ticks_msec()
	for bean in beans:
		var node := bean["node"] as MeshInstance3D
		var drop_phase := float(bean["drop_phase"])
		var drop_bounce := float(bean["drop_bounce"])
		if drop_phase > 0.0:
			drop_phase = maxf(0.0, drop_phase - DROP_PHASE_RATE * delta)
			bean["drop_phase"] = drop_phase
			if drop_phase == 0.0:
				drop_bounce = 1.0
				bean["drop_bounce"] = drop_bounce
				bean_landed.emit(Vector2i(int(bean["x"]), int(bean["y"])))
		elif drop_bounce > 0.0:
			drop_bounce = maxf(0.0, drop_bounce - DROP_BOUNCE_RATE * delta)
			bean["drop_bounce"] = drop_bounce
		var rest_y := 0.4 + sin(now * 0.004 + int(bean["x"]) + int(bean["y"])) * 0.15
		node.position.y = rest_y + drop_phase * drop_phase * 22.0
		node.scale = Vector3(1.0 + drop_bounce * 0.4, 1.0 - drop_bounce * 0.5, 1.0 + drop_bounce * 0.4)
		node.rotation.y = now * 0.002
		var material := node.material_override as StandardMaterial3D
		material.emission_energy_multiplier = 0.55 + sin(now * 0.005) * 0.2


func _create_bean(color_index: int) -> MeshInstance3D:
	var bean := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.35
	mesh.height = 0.7
	mesh.radial_segments = 16
	mesh.rings = 10
	bean.mesh = mesh
	var material := StandardMaterial3D.new()
	material.albedo_color = DaiDaiRules.COLORS[color_index]
	material.emission_enabled = true
	material.emission = DaiDaiRules.COLORS[color_index]
	material.emission_energy_multiplier = 0.55
	material.metallic = 0.05
	material.roughness = 0.15
	bean.material_override = material
	bean.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var halo := Sprite3D.new()
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
	gradient.colors = PackedColorArray([
		Color(1.0, 1.0, 1.0, 0.9),
		Color(DaiDaiRules.COLORS[color_index], 0.3),
		Color(DaiDaiRules.COLORS[color_index], 0.0),
	])
	var halo_texture := GradientTexture2D.new()
	halo_texture.width = 64
	halo_texture.height = 64
	halo_texture.gradient = gradient
	halo_texture.fill = GradientTexture2D.FILL_RADIAL
	halo_texture.fill_from = Vector2(0.5, 0.5)
	halo_texture.fill_to = Vector2(1.0, 0.5)
	halo.texture = halo_texture
	halo.pixel_size = 0.025
	halo.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	halo.shaded = false
	bean.add_child(halo)
	return bean
