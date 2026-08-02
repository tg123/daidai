extends Node3D
class_name DaiDaiEffects

signal falling_bean_landed(cell: Vector2i, color_index: int)

const GOLD_SPARKLE_TEXTURE := preload("res://assets/icons/sparkle.svg")
const GOLD_GLOW_TEXTURE := preload("res://assets/icons/gold_glow.svg")
const GOLD_CORE_TEXTURE := preload("res://assets/icons/gold_core.svg")
const REED_COUNT := 80
const ROCK_COUNT := 32
const FLOATING_LEAF_COUNT := 54
const LILY_PAD_COUNT := 24
const POND_FLOWER_COUNT := 6
const BUBBLE_COUNT := 60

var cols := 40
var rows := 30
var rng := RandomNumberGenerator.new()
var floor_mesh: MeshInstance3D
var water_mesh: MeshInstance3D
var grass_node: MultiMeshInstance3D
var rock_node: MultiMeshInstance3D
var floating_plant_node: MultiMeshInstance3D
var lily_pad_node: MultiMeshInstance3D
var pond_flower_node: MultiMeshInstance3D
var bubble_node: MultiMeshInstance3D
var atmosphere_node: Node3D
var ephemeral_node: Node3D
var particles: Array[Dictionary] = []
var ripples: Array[Dictionary] = []
var falling_beans: Array[Dictionary] = []
var bubbles: Array[Dictionary] = []
var skin_nodes: Array[MeshInstance3D] = []
var gold_nodes: Array[MeshInstance3D] = []
var gold_glow_overlays: Array[Sprite2D] = []
var gold_core_overlays: Array[Sprite2D] = []
var gold_sparkle_overlays: Array[Sprite2D] = []
var gold_overlay_root: Node2D
var gold_additive_material: CanvasItemMaterial
var falling_bean_mesh: SphereMesh
var falling_bean_materials: Array[StandardMaterial3D] = []
var projectile_mesh: SphereMesh
var projectile_material: StandardMaterial3D
var gold_effect_mesh: SphereMesh
var gold_effect_material: StandardMaterial3D
var reduced_web_quality := false


func _ready() -> void:
	rng.randomize()
	reduced_web_quality = _use_reduced_web_quality()
	_prepare_shared_effect_resources()
	atmosphere_node = Node3D.new()
	atmosphere_node.name = "Atmosphere"
	add_child(atmosphere_node)
	ephemeral_node = Node3D.new()
	ephemeral_node.name = "Ephemeral"
	add_child(ephemeral_node)
	gold_overlay_root = Node2D.new()
	gold_overlay_root.name = "GoldOverlay"
	gold_overlay_root.z_index = -5
	(get_node("../HUD") as CanvasLayer).call_deferred("add_child", gold_overlay_root)


func reset(new_cols: int, new_rows: int) -> void:
	cols = new_cols
	rows = new_rows
	for child in ephemeral_node.get_children():
		child.free()
	particles.clear()
	ripples.clear()
	falling_beans.clear()
	skin_nodes.clear()
	gold_nodes.clear()
	for child in gold_overlay_root.get_children():
		child.free()
	gold_glow_overlays.clear()
	gold_core_overlays.clear()
	gold_sparkle_overlays.clear()


func configure_environment(new_cols: int, new_rows: int, camera_distance: float) -> void:
	cols = new_cols
	rows = new_rows
	for child in atmosphere_node.get_children():
		child.free()
	bubbles.clear()
	_build_floor()
	_build_water()
	_build_grass()
	_build_rocks()
	_build_floating_plants()
	_build_lily_pads()
	_build_bubbles()

	var world := get_node("../WorldEnvironment") as WorldEnvironment
	if world.environment != null:
		world.environment.background_mode = Environment.BG_COLOR
		world.environment.background_color = Color8(13, 43, 40)
		world.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		world.environment.ambient_light_color = Color8(184, 225, 209)
		world.environment.ambient_light_energy = 0.75
		world.environment.fog_enabled = true
		world.environment.fog_light_color = Color8(32, 93, 82)
		world.environment.fog_density = 0.02 * (25.0 / camera_distance)


func _prepare_shared_effect_resources() -> void:
	gold_additive_material = CanvasItemMaterial.new()
	gold_additive_material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	falling_bean_mesh = SphereMesh.new()
	falling_bean_mesh.radius = 0.35
	falling_bean_mesh.height = 0.7
	falling_bean_mesh.radial_segments = 8 if reduced_web_quality else 12
	falling_bean_mesh.rings = 6 if reduced_web_quality else 10
	for color: Color in DaiDaiRules.COLORS:
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 0.3
		material.metallic = 0.4
		material.roughness = 0.3
		falling_bean_materials.append(material)

	projectile_mesh = SphereMesh.new()
	projectile_mesh.radius = 0.3
	projectile_mesh.height = 0.6
	projectile_mesh.radial_segments = 8 if reduced_web_quality else 12
	projectile_mesh.rings = 6 if reduced_web_quality else 10
	projectile_material = _create_gold_material()

	gold_effect_mesh = SphereMesh.new()
	gold_effect_mesh.radius = 0.4
	gold_effect_mesh.height = 0.8
	gold_effect_mesh.radial_segments = 8 if reduced_web_quality else 10
	gold_effect_mesh.rings = 6 if reduced_web_quality else 8
	gold_effect_material = _create_gold_material()


func _create_gold_material() -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(1.0, 0.96, 0.42)
	material.emission_enabled = true
	material.emission = Color(1.0, 0.9, 0.28)
	material.emission_energy_multiplier = 5.0
	material.metallic = 0.0
	material.roughness = 0.1
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return material


func _create_gold_glow() -> Sprite3D:
	var glow := Sprite3D.new()
	glow.name = "Glow"
	glow.texture = GOLD_GLOW_TEXTURE
	glow.pixel_size = 0.026
	glow.position = Vector3(0.0, 0.0, 0.08)
	glow.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	glow.shaded = false
	glow.modulate = Color(2.4, 2.0, 0.5, 0.82)
	return glow


func _create_gold_sparkle() -> Sprite3D:
	var sparkle := Sprite3D.new()
	sparkle.name = "Sparkle"
	sparkle.texture = GOLD_SPARKLE_TEXTURE
	sparkle.pixel_size = 0.018
	sparkle.position = Vector3(0.34, 0.64, 0.14)
	sparkle.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sparkle.shaded = false
	sparkle.modulate = Color(2.5, 2.5, 1.0, 1.0)
	return sparkle


func _create_gold_core() -> Sprite3D:
	var core := Sprite3D.new()
	core.name = "Core"
	core.texture = GOLD_CORE_TEXTURE
	core.pixel_size = 0.014
	core.position = Vector3(0.0, 0.0, 0.1)
	core.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	core.shaded = false
	return core


func _create_gold_overlay(texture: Texture2D, name: String, additive: bool = false) -> Sprite2D:
	var sprite := Sprite2D.new()
	sprite.name = name
	sprite.texture = texture
	sprite.centered = true
	if additive:
		sprite.material = gold_additive_material
	return sprite


func spawn_ripple(world_position: Vector3) -> void:
	var ring := MeshInstance3D.new()
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.42
	mesh.outer_radius = 0.5
	mesh.rings = 6 if OS.has_feature("web") else 12
	mesh.ring_segments = 16 if OS.has_feature("web") else 32
	ring.mesh = mesh
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.75, 0.9, 1.0, 0.28)
	material.emission_enabled = true
	material.emission = Color8(191, 230, 255)
	material.emission_energy_multiplier = 0.4
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = material
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	ring.position = Vector3(world_position.x, 0.04, world_position.z)
	ring.scale = Vector3.ONE * 0.4
	ephemeral_node.add_child(ring)
	ripples.append({"node": ring, "life": 0.92, "max_life": 0.92})


func spawn_particles(world_position: Vector3, color: Color, count: int) -> void:
	var particle_count := mini(count, 4) if OS.has_feature("web") else count
	for _i in range(particle_count):
		var particle := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = 0.12
		mesh.height = 0.24
		mesh.radial_segments = 6
		mesh.rings = 4
		particle.mesh = mesh
		var material := StandardMaterial3D.new()
		material.albedo_color = color
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 0.35
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		particle.material_override = material
		particle.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		particle.position = Vector3(world_position.x, 0.5, world_position.z)
		ephemeral_node.add_child(particle)
		particles.append(
			{
				"node": particle,
				"velocity": Vector3(
					rng.randf_range(-4.5, 4.5),
					rng.randf_range(3.0, 12.0),
					rng.randf_range(-4.5, 4.5),
				),
				"life": 1.0,
			},
		)


func start_heavy_rain() -> void:
	_spawn_rain_wave()
	_delayed_rain_wave(0.9)
	if not OS.has_feature("web"):
		_delayed_rain_wave(1.6)


func spawn_falling_bean(cell: Vector2i, color_index: int) -> void:
	var bean := MeshInstance3D.new()
	bean.mesh = falling_bean_mesh
	bean.material_override = falling_bean_materials[color_index]
	bean.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	bean.position = Vector3(cell.x, rng.randf_range(12.0, 17.0), cell.y)
	ephemeral_node.add_child(bean)
	falling_beans.append(
		{
			"node": bean,
			"cell": cell,
			"color": color_index,
			"velocity": 0.0,
			"gravity": rng.randf_range(0.008, 0.012) * 3600.0,
		},
	)


func create_projectile(world_position: Vector3) -> Node3D:
	var root := Node3D.new()
	root.position = Vector3(world_position.x, 0.5, world_position.z)
	var projectile := MeshInstance3D.new()
	projectile.mesh = projectile_mesh
	projectile.material_override = projectile_material
	projectile.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(projectile)
	root.add_child(_create_gold_glow())
	root.add_child(_create_gold_core())
	root.add_child(_create_gold_sparkle())
	if not OS.has_feature("web"):
		var light := OmniLight3D.new()
		light.light_color = Color.GOLD
		light.light_energy = 1.5
		light.omni_range = 5.0
		root.add_child(light)
	ephemeral_node.add_child(root)
	return root


func sync_entities(shed_skin: Array[Dictionary], gold_beans: Array[Dictionary]) -> void:
	while skin_nodes.size() < shed_skin.size():
		var skin := _make_sphere(0.35, Color(0.53, 0.53, 0.53, 0.7))
		ephemeral_node.add_child(skin)
		skin_nodes.append(skin)
	while skin_nodes.size() > shed_skin.size():
		skin_nodes.pop_back().free()
	for i in range(shed_skin.size()):
		var item := shed_skin[i]
		var node := skin_nodes[i]
		node.position = Vector3(int(item["x"]), 0.1, int(item["y"]))
		var material := node.material_override as StandardMaterial3D
		material.albedo_color.a = minf(0.7, int(item["life"]) / 100.0)

	while gold_nodes.size() < gold_beans.size():
		var gold := MeshInstance3D.new()
		gold.mesh = gold_effect_mesh
		gold.material_override = gold_effect_material
		gold.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		gold.visible = false
		ephemeral_node.add_child(gold)
		gold_nodes.append(gold)
		var glow := _create_gold_overlay(GOLD_GLOW_TEXTURE, "Glow", true)
		glow.modulate = Color(1.0, 0.74, 0.08, 0.9)
		gold_overlay_root.add_child(glow)
		gold_glow_overlays.append(glow)
		var core := _create_gold_overlay(GOLD_CORE_TEXTURE, "Core")
		gold_overlay_root.add_child(core)
		gold_core_overlays.append(core)
		var sparkle := _create_gold_overlay(GOLD_SPARKLE_TEXTURE, "Sparkle", true)
		sparkle.modulate = Color(1.0, 0.98, 0.72, 1.0)
		gold_overlay_root.add_child(sparkle)
		gold_sparkle_overlays.append(sparkle)
	while gold_nodes.size() > gold_beans.size():
		gold_nodes.pop_back().free()
		gold_glow_overlays.pop_back().free()
		gold_core_overlays.pop_back().free()
		gold_sparkle_overlays.pop_back().free()
	for i in range(gold_beans.size()):
		var item := gold_beans[i]
		var node := gold_nodes[i]
		node.position = Vector3(int(item["x"]), 0.6, int(item["y"]))


func _process(delta: float) -> void:
	for i in range(particles.size() - 1, -1, -1):
		var particle := particles[i]
		var node := particle["node"] as MeshInstance3D
		var velocity := particle["velocity"] as Vector3
		node.position += velocity * delta
		velocity.y -= 10.8 * delta
		particle["velocity"] = velocity
		particle["life"] = float(particle["life"]) - delta
		var amount := maxf(0.0, float(particle["life"]))
		node.scale = Vector3.ONE * amount
		var material := node.material_override as StandardMaterial3D
		material.albedo_color.a = amount
		if amount <= 0.0:
			node.queue_free()
			particles.remove_at(i)

	for i in range(ripples.size() - 1, -1, -1):
		var ripple := ripples[i]
		var node := ripple["node"] as MeshInstance3D
		ripple["life"] = float(ripple["life"]) - delta
		var normalized := 1.0 - maxf(0.0, float(ripple["life"])) / float(ripple["max_life"])
		var eased := 1.0 - pow(1.0 - normalized, 2.0)
		node.scale = Vector3.ONE * lerpf(0.4, 3.2, eased)
		var material := node.material_override as StandardMaterial3D
		material.albedo_color.a = 0.28 * minf(1.0, normalized * 4.0) * maxf(0.0, 1.0 - normalized)
		if float(ripple["life"]) <= 0.0:
			node.queue_free()
			ripples.remove_at(i)

	for i in range(falling_beans.size() - 1, -1, -1):
		var falling := falling_beans[i]
		var node := falling["node"] as MeshInstance3D
		falling["velocity"] = float(falling["velocity"]) + float(falling["gravity"]) * delta
		node.position.y -= float(falling["velocity"]) * delta
		node.rotation.y += delta * 3.0
		if node.position.y <= 0.4:
			var cell := falling["cell"] as Vector2i
			var color_index := int(falling["color"])
			node.queue_free()
			falling_beans.remove_at(i)
			spawn_particles(Vector3(cell.x, 0.4, cell.y), DaiDaiRules.COLORS[color_index], 6)
			spawn_ripple(Vector3(cell.x, 0.4, cell.y))
			falling_bean_landed.emit(cell, color_index)

	if bubble_node != null and bubble_node.multimesh != null:
		for i in range(bubbles.size()):
			var bubble := bubbles[i]
			var position := bubble["position"] as Vector3
			position.y += float(bubble["speed"]) * delta
			position.x += sin(Time.get_ticks_msec() * 0.001 + float(bubble["phase"])) * 0.004
			if position.y > 5.5:
				position = Vector3(
					rng.randf_range(-cols * 0.2, cols * 1.2),
					-0.2,
					rng.randf_range(-rows * 0.2, rows * 1.2),
				)
			bubble["position"] = position
			var transform := Transform3D.IDENTITY
			transform.origin = position
			bubble_node.multimesh.set_instance_transform(i, transform)

	var now := Time.get_ticks_msec()
	var emission_pulse := 5.0 + sin(now * 0.009) * 1.2
	projectile_material.emission_energy_multiplier = emission_pulse
	gold_effect_material.emission_energy_multiplier = emission_pulse
	var camera := get_node("../Camera3D") as Camera3D
	var display_scale := (get_node("../HUD") as DaiDaiHUD).ui_scale
	for i in range(gold_nodes.size()):
		var node := gold_nodes[i]
		node.position.y = 0.6 + sin(now * 0.006 + i) * 0.2
		node.rotation = Vector3(now * 0.003, now * 0.005, 0.0)
		var screen_position := camera.unproject_position(node.global_position)
		var sparkle := gold_sparkle_overlays[i]
		var glow := gold_glow_overlays[i]
		var core := gold_core_overlays[i]
		var twinkle := 0.85 + sin(now * 0.014 + i * 1.7) * 0.35
		var glow_pulse := 0.92 + sin(now * 0.01 + i * 1.1) * 0.1
		glow.position = screen_position
		glow.scale = Vector2.ONE * 0.92 * glow_pulse * display_scale
		glow.modulate.a = 0.72 + sin(now * 0.01 + i * 1.1) * 0.18
		core.position = screen_position
		core.scale = (
			Vector2.ONE
			* (0.72 + sin(now * 0.01 + i * 1.1) * 0.025)
			* display_scale
		)
		var orbit_angle := now * 0.0018 + i * 1.7
		sparkle.position = (
			screen_position
			+ Vector2(cos(orbit_angle), sin(orbit_angle)) * 22.0 * display_scale
		)
		sparkle.scale = Vector2.ONE * 0.38 * twinkle * display_scale
		sparkle.rotation = now * 0.002 + i
		sparkle.modulate.a = 0.85 + sin(now * 0.014 + i * 1.7) * 0.15


func _build_floor() -> void:
	floor_mesh = MeshInstance3D.new()
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(cols * 10.0, rows * 10.0)
	mesh.subdivide_width = 24 if reduced_web_quality else 40
	mesh.subdivide_depth = 24 if reduced_web_quality else 40
	floor_mesh.mesh = mesh
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode diffuse_burley;
varying vec3 world_position;
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec2 random_gradient(vec2 p) {
	float angle = hash(p) * 6.2831853;
	return vec2(cos(angle), sin(angle));
}
float gradient_noise(vec2 p) {
	vec2 cell = floor(p);
	vec2 local = fract(p);
	vec2 blend = local * local * local * (local * (local * 6.0 - 15.0) + 10.0);
	float a = dot(random_gradient(cell), local);
	float b = dot(random_gradient(cell + vec2(1.0, 0.0)), local - vec2(1.0, 0.0));
	float c = dot(random_gradient(cell + vec2(0.0, 1.0)), local - vec2(0.0, 1.0));
	float d = dot(random_gradient(cell + vec2(1.0, 1.0)), local - vec2(1.0, 1.0));
	return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y) * 0.5 + 0.5;
}
float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	mat2 rotate_domain = mat2(vec2(0.80, 0.60), vec2(-0.60, 0.80));
	for (int i = 0; i < 5; i++) {
		value += gradient_noise(p) * amplitude;
		p = rotate_domain * p * 2.03 + vec2(17.1, 9.2);
		amplitude *= 0.5;
	}
	return value;
}
void vertex() {
	VERTEX.y += sin(VERTEX.x * 0.19) * 0.055;
	VERTEX.y += cos(VERTEX.z * 0.16 + VERTEX.x * 0.07) * 0.045;
	world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 domain = world_position.xz * 0.12;
	vec2 warp = vec2(
		fbm(domain + vec2(7.3, 19.1)),
		fbm(domain + vec2(31.7, 4.8))
	) - vec2(0.5);
	float broad = fbm(domain + warp * 2.2);
	float detail = fbm(world_position.xz * 0.72 + warp * 1.4 + vec2(31.0, 7.0));
	float grain = gradient_noise(world_position.xz * 4.5);
	vec3 dark = vec3(0.025, 0.12, 0.105);
	vec3 light = vec3(0.14, 0.34, 0.22);
	float moss = clamp(broad * 0.65 + detail * 0.3 + grain * 0.05, 0.0, 1.0);
	ALBEDO = mix(dark, light, moss);
	float wave_a = sin(world_position.x * 1.25 + TIME * 0.7 + sin(world_position.z * 0.72 - TIME * 0.4));
	float wave_b = cos(world_position.z * 1.08 - TIME * 0.55 + sin(world_position.x * 0.63 + TIME * 0.35));
	float caustic = pow(clamp((wave_a + wave_b) * 0.25 + 0.5, 0.0, 1.0), 7.0);
	ALBEDO += vec3(0.08, 0.17, 0.14) * caustic;
	ROUGHNESS = 0.85;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	floor_mesh.material_override = material
	floor_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	floor_mesh.position = Vector3((cols - 1) / 2.0, -0.3, (rows - 1) / 2.0)
	atmosphere_node.add_child(floor_mesh)


func _build_water() -> void:
	water_mesh = MeshInstance3D.new()
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(cols * 3.0, rows * 3.0)
	mesh.subdivide_width = 32 if reduced_web_quality else 60
	mesh.subdivide_depth = 32 if reduced_web_quality else 60
	water_mesh.mesh = mesh
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled;
varying vec3 world_position;
void vertex() {
	VERTEX.y += sin(VERTEX.x * 0.4 + TIME * 2.0) * 0.15;
	VERTEX.y += cos(VERTEX.z * 0.3 + TIME * 1.7) * 0.12;
	world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	float caustic = pow(max(0.0, sin(world_position.x * 1.7 + TIME) * cos(world_position.z * 1.3 - TIME * 0.8)), 4.0);
	ALBEDO = vec3(0.32, 0.68, 0.67) + vec3(0.12, 0.26, 0.3) * caustic;
	ROUGHNESS = 0.15;
	ALPHA = 0.045 + caustic * 0.025;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	water_mesh.material_override = material
	water_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	water_mesh.position = Vector3((cols - 1) / 2.0, 4.5, (rows - 1) / 2.0)
	atmosphere_node.add_child(water_mesh)


func _build_grass() -> void:
	grass_node = MultiMeshInstance3D.new()
	var reed_cluster := _create_reed_cluster_mesh()
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded, cull_disabled, blend_mix, depth_draw_never;
varying float blade_height;
void vertex() {
	blade_height = UV.y;
	float phase = float(INSTANCE_ID) * 1.731;
	VERTEX.x += sin(TIME * 1.05 + phase + UV.y * 1.7) * 0.075 * blade_height * blade_height;
	VERTEX.z += cos(TIME * 0.83 + phase * 1.13 + UV.y * 1.3) * 0.055 * blade_height * blade_height;
}
void fragment() {
	ALBEDO = mix(vec3(0.12, 0.4, 0.26), vec3(0.38, 0.82, 0.5), blade_height);
	EMISSION = ALBEDO * 0.14;
	ALPHA = 0.86;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	reed_cluster.surface_set_material(0, material)
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = reed_cluster
	multimesh.instance_count = 48 if reduced_web_quality else REED_COUNT
	for i in range(multimesh.instance_count):
		var transform := Transform3D.IDENTITY
		transform = transform.rotated(Vector3.UP, rng.randf_range(0.0, TAU))
		var width_scale := rng.randf_range(0.75, 1.35)
		var height_scale := rng.randf_range(0.7, 1.45)
		transform = transform.scaled(Vector3(width_scale, height_scale, width_scale))
		transform.origin = Vector3(
			rng.randf_range(-cols * 0.15, cols * 1.15),
			-0.22,
			rng.randf_range(-rows * 0.15, rows * 1.15),
		)
		multimesh.set_instance_transform(i, transform)
	grass_node.multimesh = multimesh
	grass_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	atmosphere_node.add_child(grass_node)


func _create_reed_cluster_mesh() -> ArrayMesh:
	const BLADES := 5
	const SEGMENTS := 7
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	for blade_index in range(BLADES):
		var angle := blade_index / float(BLADES) * TAU
		var direction := Vector3(cos(angle), 0.0, sin(angle))
		var across := Vector3(-direction.z, 0.0, direction.x)
		var blade_start := vertices.size()
		for segment in range(SEGMENTS + 1):
			var progress := segment / float(SEGMENTS)
			var width := lerpf(0.065, 0.012, progress)
			var center := direction * (0.045 + progress * progress * 0.26)
			center.y = progress * 1.05
			center += direction * sin(progress * PI) * 0.08
			vertices.append(center - across * width)
			vertices.append(center + across * width)
			normals.append(direction)
			normals.append(direction)
			uvs.append(Vector2(0.0, progress))
			uvs.append(Vector2(1.0, progress))
		for segment in range(SEGMENTS):
			var base := blade_start + segment * 2
			indices.append_array(
				PackedInt32Array([
					base,
					base + 2,
					base + 1,
					base + 1,
					base + 2,
					base + 3,
				]),
			)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


func _build_rocks() -> void:
	rock_node = MultiMeshInstance3D.new()
	var rock := SphereMesh.new()
	rock.radius = 0.18
	rock.height = 0.24
	rock.radial_segments = 7
	rock.rings = 4
	var material := StandardMaterial3D.new()
	material.albedo_color = Color.WHITE
	material.roughness = 0.95
	material.metallic = 0.05
	material.vertex_color_use_as_albedo = true
	rock.material = material
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.use_colors = true
	multimesh.mesh = rock
	multimesh.instance_count = 20 if reduced_web_quality else ROCK_COUNT
	for i in range(multimesh.instance_count):
		var transform := Transform3D.IDENTITY
		transform = transform.rotated(Vector3.UP, rng.randf_range(0.0, TAU))
		transform = transform.scaled(
			Vector3(
				rng.randf_range(0.65, 1.3),
				rng.randf_range(0.4, 0.85),
				rng.randf_range(0.65, 1.3),
			),
		)
		transform.origin = Vector3(
			rng.randf_range(-cols * 0.08, cols * 1.08),
			-0.13,
			rng.randf_range(-rows * 0.08, rows * 1.08),
		)
		multimesh.set_instance_transform(i, transform)
		var shade := rng.randf_range(0.82, 1.12)
		multimesh.set_instance_color(i, Color(0.25, 0.36, 0.33) * shade)
	rock_node.multimesh = multimesh
	rock_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	atmosphere_node.add_child(rock_node)


func _build_floating_plants() -> void:
	floating_plant_node = MultiMeshInstance3D.new()
	var leaf := _create_leaf_mesh()
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode blend_mix, cull_disabled, depth_draw_never;
varying float leaf_position;
void vertex() {
	leaf_position = UV.y;
	float phase = float(INSTANCE_ID) * 1.417;
	float body = sin(UV.y * 3.14159265);
	VERTEX.x += sin(TIME * 0.75 + phase + UV.y * 2.6) * 0.075 * body;
	VERTEX.y += cos(TIME * 0.62 + phase * 1.19 + UV.y * 3.1) * 0.055 * body;
	VERTEX.z += sin(TIME * 0.48 + phase * 0.73) * 0.035 * body;
}
void fragment() {
	float center_ridge = 1.0 - abs(UV.x * 2.0 - 1.0);
	vec3 root_color = vec3(0.12, 0.4, 0.28);
	vec3 tip_color = vec3(0.4, 0.82, 0.52);
	ALBEDO = mix(root_color, tip_color, leaf_position) + center_ridge * vec3(0.05, 0.12, 0.08);
	EMISSION = ALBEDO * 0.14;
	ROUGHNESS = 0.72;
	ALPHA = 0.78;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	leaf.surface_set_material(0, material)

	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = leaf
	multimesh.instance_count = 32 if reduced_web_quality else FLOATING_LEAF_COUNT
	var cluster_center := Vector2.ZERO
	for i in range(multimesh.instance_count):
		if i % 6 == 0:
			cluster_center = Vector2(
				rng.randf_range(-cols * 0.05, cols * 1.05),
				rng.randf_range(-rows * 0.05, rows * 1.05),
			)
		var transform := Transform3D.IDENTITY
		transform = transform.rotated(Vector3.UP, rng.randf_range(0.0, TAU))
		transform = transform.rotated(Vector3.RIGHT, rng.randf_range(-0.12, 0.12))
		transform = transform.scaled(
			Vector3(
				rng.randf_range(0.75, 1.35),
				rng.randf_range(0.8, 1.2),
				rng.randf_range(0.7, 1.5),
			),
		)
		transform.origin = Vector3(
			cluster_center.x + rng.randf_range(-1.35, 1.35),
			rng.randf_range(0.15, 0.75),
			cluster_center.y + rng.randf_range(-1.35, 1.35),
		)
		multimesh.set_instance_transform(i, transform)
	floating_plant_node.multimesh = multimesh
	floating_plant_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	atmosphere_node.add_child(floating_plant_node)


func _create_leaf_mesh() -> ArrayMesh:
	const SEGMENTS := 10
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	for i in range(SEGMENTS + 1):
		var progress := i / float(SEGMENTS)
		var width := sin(progress * PI) * 0.24 + 0.008
		var z := (progress - 0.5) * 2.1
		var y := sin(progress * PI) * 0.045
		vertices.append(Vector3(-width, y, z))
		vertices.append(Vector3(width, y, z))
		normals.append(Vector3.UP)
		normals.append(Vector3.UP)
		uvs.append(Vector2(0.0, progress))
		uvs.append(Vector2(1.0, progress))
	for i in range(SEGMENTS):
		var base := i * 2
		indices.append_array(
			PackedInt32Array([
				base,
				base + 2,
				base + 1,
				base + 1,
				base + 2,
				base + 3,
			]),
		)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


func _build_lily_pads() -> void:
	lily_pad_node = MultiMeshInstance3D.new()
	var pad := _create_lily_pad_mesh()
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode blend_mix, cull_disabled, depth_draw_never;
varying float distance_from_center;
void vertex() {
	float phase = float(INSTANCE_ID) * 1.913;
	VERTEX.y += sin(TIME * 0.65 + phase) * 0.025;
	distance_from_center = length(UV - vec2(0.5)) * 2.0;
}
void fragment() {
	vec3 center_color = vec3(0.24, 0.62, 0.35);
	vec3 edge_color = vec3(0.45, 0.86, 0.5);
	ALBEDO = mix(center_color, edge_color, smoothstep(0.15, 1.0, distance_from_center));
	EMISSION = ALBEDO * 0.14;
	ROUGHNESS = 0.58;
	ALPHA = 0.9;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	pad.surface_set_material(0, material)

	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = pad
	multimesh.instance_count = 16 if reduced_web_quality else LILY_PAD_COUNT
	var pad_positions: Array[Vector3] = []
	var cluster_center := Vector2.ZERO
	for i in range(multimesh.instance_count):
		if i % 4 == 0:
			cluster_center = Vector2(
				rng.randf_range(-cols * 0.03, cols * 1.03),
				rng.randf_range(-rows * 0.03, rows * 1.03),
			)
		var position := Vector3(
			cluster_center.x + rng.randf_range(-1.0, 1.0),
			rng.randf_range(0.85, 1.4),
			cluster_center.y + rng.randf_range(-1.0, 1.0),
		)
		pad_positions.append(position)
		var transform := Transform3D.IDENTITY
		transform = transform.rotated(Vector3.UP, rng.randf_range(0.0, TAU))
		var scale := rng.randf_range(0.72, 1.28)
		transform = transform.scaled(Vector3(scale, scale, scale))
		transform.origin = position
		multimesh.set_instance_transform(i, transform)
	lily_pad_node.multimesh = multimesh
	lily_pad_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	atmosphere_node.add_child(lily_pad_node)
	_build_pond_flowers(pad_positions)


func _create_lily_pad_mesh() -> ArrayMesh:
	const SEGMENTS := 30
	const RADIUS := 0.38
	const NOTCH := 0.58
	var vertices := PackedVector3Array([Vector3.ZERO])
	var normals := PackedVector3Array([Vector3.UP])
	var uvs := PackedVector2Array([Vector2(0.5, 0.5)])
	var indices := PackedInt32Array()
	for i in range(SEGMENTS + 1):
		var progress := i / float(SEGMENTS)
		var angle := NOTCH / 2.0 + (TAU - NOTCH) * progress
		var x := sin(angle) * RADIUS
		var z := cos(angle) * RADIUS
		vertices.append(Vector3(x, sin(angle * 2.0) * 0.008, z))
		normals.append(Vector3.UP)
		uvs.append(Vector2(0.5 + x / (RADIUS * 2.0), 0.5 + z / (RADIUS * 2.0)))
	for i in range(SEGMENTS):
		indices.append_array(PackedInt32Array([0, i + 1, i + 2]))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh


func _build_pond_flowers(pad_positions: Array[Vector3]) -> void:
	pond_flower_node = MultiMeshInstance3D.new()
	var flower := SphereMesh.new()
	flower.radius = 0.085
	flower.height = 0.11
	flower.radial_segments = 8
	flower.rings = 5
	var material := StandardMaterial3D.new()
	material.albedo_color = Color.WHITE
	material.emission_enabled = true
	material.emission = Color(0.35, 0.12, 0.18)
	material.emission_energy_multiplier = 0.12
	material.roughness = 0.5
	material.vertex_color_use_as_albedo = true
	flower.material = material
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.use_colors = true
	multimesh.mesh = flower
	multimesh.instance_count = mini(POND_FLOWER_COUNT, floori(pad_positions.size() / 4.0))
	for i in range(multimesh.instance_count):
		var position := pad_positions[i * 4]
		var transform := Transform3D.IDENTITY
		transform.origin = position + Vector3(0.0, 0.075, 0.0)
		multimesh.set_instance_transform(i, transform)
		multimesh.set_instance_color(
			i,
			Color(1.0, 0.42, 0.62) if i % 2 == 0 else Color(1.0, 0.78, 0.28),
		)
	pond_flower_node.multimesh = multimesh
	pond_flower_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	atmosphere_node.add_child(pond_flower_node)


func _build_bubbles() -> void:
	bubble_node = MultiMeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.04
	mesh.height = 0.08
	mesh.radial_segments = 6
	mesh.rings = 4
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.87, 0.93, 1.0, 0.45)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.material = material
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = mesh
	multimesh.instance_count = 24 if reduced_web_quality else BUBBLE_COUNT
	for i in range(multimesh.instance_count):
		var position := Vector3(
			rng.randf_range(-cols * 0.2, cols * 1.2),
			rng.randf_range(0.0, 5.0),
			rng.randf_range(-rows * 0.2, rows * 1.2),
		)
		var transform := Transform3D.IDENTITY
		transform.origin = position
		multimesh.set_instance_transform(i, transform)
		bubbles.append(
			{
				"position": position,
				"speed": rng.randf_range(0.24, 0.84),
				"phase": rng.randf_range(0.0, TAU),
			},
		)
	bubble_node.multimesh = multimesh
	bubble_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	atmosphere_node.add_child(bubble_node)


func _spawn_rain_wave() -> void:
	var rain := GPUParticles3D.new()
	rain.amount = 60 if OS.has_feature("web") else 150
	rain.lifetime = 2.5
	rain.one_shot = true
	rain.explosiveness = 0.8
	rain.position = Vector3((cols - 1) / 2.0, 11.0, (rows - 1) / 2.0)
	var process := ParticleProcessMaterial.new()
	process.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	process.emission_box_extents = Vector3(cols / 2.0, 7.5, rows / 2.0)
	process.direction = Vector3.DOWN
	process.spread = 4.0
	process.initial_velocity_min = 5.0
	process.initial_velocity_max = 12.0
	process.gravity = Vector3(0.0, -3.0, 0.0)
	rain.process_material = process
	var drop := CylinderMesh.new()
	drop.top_radius = 0.01
	drop.bottom_radius = 0.03
	drop.height = 1.2
	drop.radial_segments = 4
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.67, 0.8, 1.0, 0.7)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	drop.material = material
	rain.draw_pass_1 = drop
	rain.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	ephemeral_node.add_child(rain)
	rain.emitting = true
	_free_later(rain, 3.0)


func _delayed_rain_wave(delay: float) -> void:
	await get_tree().create_timer(delay).timeout
	_spawn_rain_wave()


func _free_later(node: Node, delay: float) -> void:
	await get_tree().create_timer(delay).timeout
	if is_instance_valid(node):
		node.queue_free()


func _make_sphere(radius: float, color: Color) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 12
	mesh.rings = 8
	instance.mesh = mesh
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	if color.a < 1.0:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return instance


func _use_reduced_web_quality() -> bool:
	return DaiDaiWebQuality.use_reduced_quality()
