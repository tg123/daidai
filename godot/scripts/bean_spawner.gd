extends Node3D
class_name DaiDaiBeanSpawner

signal bean_landed(cell: Vector2i)

const MAX_SPAWN_ATTEMPTS := 100
const DROP_PHASE_RATE := 2.1
const DROP_BOUNCE_RATE := 3.6
const MAX_TRAIL_BEANS := 40
const TRAIL_BUBBLES_PER_BEAN := 1

var beans: Array[Dictionary] = []
var cols := 40
var rows := 30
var target_count := DaiDaiRules.BEAN_COUNT
var occupied_check: Callable
var rng := RandomNumberGenerator.new()
var bean_shader: Shader
var bean_meshes: Array[ArrayMesh] = []
var bean_materials: Array[ShaderMaterial] = []
var halo_textures: Array[GradientTexture2D] = []
var trail_node: MultiMeshInstance3D
var animation_accumulator := 0.0


func _ready() -> void:
	rng.randomize()
	_prepare_shared_resources()
	_build_bubble_trails()


func _prepare_shared_resources() -> void:
	var reduced_quality := DaiDaiWebQuality.use_reduced_quality()
	bean_shader = DaiDaiBeanVisuals.create_shader()
	for color_index in range(DaiDaiRules.COLORS.size()):
		var color: Color = DaiDaiRules.COLORS[color_index]
		bean_meshes.append(DaiDaiBeanVisuals.create_mesh(color_index, reduced_quality))
		bean_materials.append(DaiDaiBeanVisuals.create_material(color_index, bean_shader))

		var gradient := Gradient.new()
		gradient.offsets = PackedFloat32Array([0.0, 0.4, 1.0])
		gradient.colors = PackedColorArray([
			Color(color.lightened(0.3), 0.26),
			Color(color, 0.1),
			Color(color, 0.0),
		])
		var halo_texture := GradientTexture2D.new()
		halo_texture.width = 64
		halo_texture.height = 64
		halo_texture.gradient = gradient
		halo_texture.fill = GradientTexture2D.FILL_RADIAL
		halo_texture.fill_from = Vector2(0.5, 0.5)
		halo_texture.fill_to = Vector2(1.0, 0.5)
		halo_textures.append(halo_texture)


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
	if OS.has_feature("web"):
		animation_accumulator += delta
		if animation_accumulator < 1.0 / 30.0:
			return
		delta = animation_accumulator
		animation_accumulator = 0.0
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
		var phase := int(bean["x"]) * 0.73 + int(bean["y"]) * 1.37
		var rest_y := 0.4 + sin(now * 0.0024 + phase) * 0.12
		node.position.y = rest_y + drop_phase * drop_phase * 22.0
		node.position.x = int(bean["x"]) + sin(now * 0.0011 + phase * 1.3) * 0.05
		node.position.z = int(bean["y"]) + cos(now * 0.0009 + phase) * 0.05
		node.scale = Vector3(1.0 + drop_bounce * 0.4, 1.0 - drop_bounce * 0.5, 1.0 + drop_bounce * 0.4) * DaiDaiBeanVisuals.VISUAL_SCALE
		node.rotation = Vector3(
			sin(now * 0.0017 + phase) * 0.14,
			now * 0.0006 + phase,
			cos(now * 0.0013 + phase) * 0.14,
		)
	_update_bubble_trails(now)


func _build_bubble_trails() -> void:
	trail_node = MultiMeshInstance3D.new()
	trail_node.name = "BeanBubbleTrails"
	var mesh := SphereMesh.new()
	mesh.radius = 0.045
	mesh.height = 0.09
	mesh.radial_segments = 8
	mesh.rings = 4
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled;
void fragment() {
	float facing = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float rim = pow(1.0 - facing, 2.0);
	float highlight = pow(clamp(dot(NORMAL, normalize(vec3(-0.45, 0.6, 0.65))), 0.0, 1.0), 24.0);
	ALBEDO = mix(vec3(0.7, 0.95, 0.95), vec3(1.0), highlight);
	ALPHA = clamp(0.05 + rim * 0.5 + highlight * 0.7, 0.0, 1.0);
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	mesh.material = material
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = mesh
	multimesh.instance_count = MAX_TRAIL_BEANS * TRAIL_BUBBLES_PER_BEAN
	multimesh.visible_instance_count = 0
	trail_node.multimesh = multimesh
	trail_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	trail_node.custom_aabb = AABB(Vector3(-1.0e4, -10.0, -1.0e4), Vector3(2.0e4, 40.0, 2.0e4))
	add_child(trail_node)


func _update_bubble_trails(now: int) -> void:
	var multimesh := trail_node.multimesh
	var count := mini(beans.size(), MAX_TRAIL_BEANS)
	var seconds := now * 0.001
	for i in range(count):
		var bean := beans[i]
		var node := bean["node"] as Node3D
		var landed := float(bean["drop_phase"]) <= 0.0
		var phase := int(bean["x"]) * 0.61 + int(bean["y"]) * 1.93
		for k in range(TRAIL_BUBBLES_PER_BEAN):
			var cycle := fposmod(seconds * 0.3 + phase + k / float(TRAIL_BUBBLES_PER_BEAN), 1.0)
			var rise := cycle * 2.2
			var size := 0.0
			if landed:
				size = sin(cycle * PI) * (0.55 + 0.25 * sin(phase * 3.0 + k))
			var position := Vector3(
				int(bean["x"]) + sin(seconds * 2.2 + phase + k * 2.1) * 0.08 * (0.3 + cycle),
				node.position.y + 0.3 + rise,
				int(bean["y"]) + cos(seconds * 1.9 + phase * 1.4 + k) * 0.08 * (0.3 + cycle),
			)
			multimesh.set_instance_transform(
				i * TRAIL_BUBBLES_PER_BEAN + k,
				Transform3D(Basis.from_scale(Vector3.ONE * maxf(size, 0.001)), position),
			)
	multimesh.visible_instance_count = count * TRAIL_BUBBLES_PER_BEAN


func _create_bean(color_index: int) -> MeshInstance3D:
	var bean := MeshInstance3D.new()
	bean.mesh = bean_meshes[color_index]
	bean.material_override = bean_materials[color_index]
	bean.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var halo := Sprite3D.new()
	halo.texture = halo_textures[color_index]
	halo.pixel_size = 0.03
	halo.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	halo.shaded = false
	bean.add_child(halo)
	return bean
