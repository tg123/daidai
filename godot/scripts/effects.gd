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
const MARINE_SNOW_COUNT := 160
const MAX_RIPPLES := 96

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
var marine_snow_node: MultiMeshInstance3D
var ripple_node: MultiMeshInstance3D
var rain_splash_start_ms := 0
var rain_splash_end_ms := 0
var rain_splash_budget := 0.0
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
var projectile_overlays: Array[Dictionary] = []
var falling_bean_shader: Shader
var falling_bean_meshes: Array[ArrayMesh] = []
var falling_bean_materials: Array[ShaderMaterial] = []
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
	_build_ripple_renderer()
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
	ripple_node.multimesh.visible_instance_count = 0
	rain_splash_start_ms = 0
	rain_splash_end_ms = 0
	rain_splash_budget = 0.0
	falling_beans.clear()
	skin_nodes.clear()
	gold_nodes.clear()
	for child in gold_overlay_root.get_children():
		child.free()
	gold_glow_overlays.clear()
	gold_core_overlays.clear()
	gold_sparkle_overlays.clear()
	projectile_overlays.clear()


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
	_build_marine_snow()

	var world := get_node("../WorldEnvironment") as WorldEnvironment
	if world.environment != null:
		var environment := world.environment
		environment.background_mode = Environment.BG_COLOR
		environment.background_color = Color8(10, 38, 36)
		environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		environment.ambient_light_color = Color8(176, 222, 208)
		environment.ambient_light_energy = 0.72
		environment.fog_enabled = true
		environment.fog_light_color = Color8(18, 72, 68)
		environment.fog_density = 0.012 * (25.0 / camera_distance)
		environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
		environment.tonemap_exposure = 0.86
		environment.adjustment_enabled = true
		environment.adjustment_brightness = 1.0
		environment.adjustment_contrast = 1.1
		environment.adjustment_saturation = 1.12
		environment.glow_enabled = not reduced_web_quality
		environment.glow_intensity = 0.45
		environment.glow_strength = 1.0
		environment.glow_bloom = 0.0
		environment.glow_hdr_threshold = 1.3
		environment.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE


func _prepare_shared_effect_resources() -> void:
	gold_additive_material = CanvasItemMaterial.new()
	gold_additive_material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	falling_bean_shader = DaiDaiBeanVisuals.create_shader()
	for color_index in range(DaiDaiRules.COLORS.size()):
		falling_bean_meshes.append(DaiDaiBeanVisuals.create_mesh(color_index, true))
		falling_bean_materials.append(
			DaiDaiBeanVisuals.create_material(color_index, falling_bean_shader),
		)

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


func _create_gold_overlay(texture: Texture2D, name: String, additive: bool = false) -> Sprite2D:
	var sprite := Sprite2D.new()
	sprite.name = name
	sprite.texture = texture
	sprite.centered = true
	if additive:
		sprite.material = gold_additive_material
	return sprite


func _create_gold_overlay_set() -> Dictionary:
	var glow := _create_gold_overlay(GOLD_GLOW_TEXTURE, "Glow", true)
	glow.modulate = Color(1.0, 0.74, 0.08, 0.9)
	gold_overlay_root.add_child(glow)
	var core := _create_gold_overlay(GOLD_CORE_TEXTURE, "Core")
	gold_overlay_root.add_child(core)
	var sparkle := _create_gold_overlay(GOLD_SPARKLE_TEXTURE, "Sparkle", true)
	sparkle.modulate = Color(1.0, 0.98, 0.72, 1.0)
	gold_overlay_root.add_child(sparkle)
	return {"glow": glow, "core": core, "sparkle": sparkle}


func _free_gold_overlay_set(overlay: Dictionary) -> void:
	for key in ["glow", "core", "sparkle"]:
		var sprite = overlay.get(key)
		if is_instance_valid(sprite):
			(sprite as Sprite2D).queue_free()


func spawn_ripple(
	world_position: Vector3,
	max_scale: float = 3.2,
	life: float = 0.92,
	strength: float = 1.0,
) -> void:
	if ripples.size() >= _max_ripples():
		ripples.remove_at(0)
	ripples.append(
		{
			"position": Vector3(world_position.x, 0.04, world_position.z),
			"life": life,
			"max_life": life,
			"max_scale": max_scale,
			"strength": strength,
			"rotation": rng.randf_range(0.0, TAU),
		},
	)


func _max_ripples() -> int:
	return 48 if reduced_web_quality else MAX_RIPPLES


func _build_ripple_renderer() -> void:
	ripple_node = MultiMeshInstance3D.new()
	ripple_node.name = "Ripples"
	var quad := PlaneMesh.new()
	quad.size = Vector2(1.2, 1.2)
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
varying float progress;
varying float strength;
float band(float r, float center, float width) {
	float x = (r - center) / width;
	return exp(-x * x);
}
void vertex() {
	progress = INSTANCE_CUSTOM.x;
	strength = INSTANCE_CUSTOM.y;
}
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	if (r > 1.0) {
		discard;
	}
	float width = mix(0.05, 0.085, progress);
	float crest = band(r, 0.84, width) + band(r, 0.6, width) * 0.55 + band(r, 0.38, width) * 0.25;
	float trough = band(r, 0.75, width) + band(r, 0.51, width) * 0.55 + band(r, 0.29, width) * 0.25;
	vec2 dir = p / max(r, 0.0001);
	float lit = 0.65 + 0.35 * dot(dir, normalize(vec2(-0.55, -0.83)));
	float fade = smoothstep(0.0, 0.08, progress) * pow(1.0 - progress, 1.4);
	fade *= 1.0 - smoothstep(0.9, 1.0, r);
	float highlight = crest * lit;
	float splash = band(r, 0.0, 0.16) * (1.0 - smoothstep(0.0, 0.25, progress));
	highlight += splash * 1.5;
	ALBEDO = mix(vec3(0.0, 0.08, 0.09), vec3(0.88, 1.0, 0.97), highlight / (highlight + trough * 0.8 + 0.0001));
	ALPHA = clamp((highlight * 0.7 + trough * 0.26) * fade * strength, 0.0, 1.0);
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	quad.material = material
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.use_custom_data = true
	multimesh.mesh = quad
	multimesh.instance_count = _max_ripples()
	multimesh.visible_instance_count = 0
	ripple_node.multimesh = multimesh
	ripple_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	ripple_node.custom_aabb = AABB(Vector3(-1.0e4, -10.0, -1.0e4), Vector3(2.0e4, 20.0, 2.0e4))
	add_child(ripple_node)


func _update_ripples(delta: float) -> void:
	for i in range(ripples.size() - 1, -1, -1):
		ripples[i]["life"] = float(ripples[i]["life"]) - delta
		if float(ripples[i]["life"]) <= 0.0:
			ripples.remove_at(i)
	var multimesh := ripple_node.multimesh
	for i in range(ripples.size()):
		var ripple := ripples[i]
		var normalized := 1.0 - float(ripple["life"]) / float(ripple["max_life"])
		var eased := 1.0 - pow(1.0 - normalized, 2.2)
		var scale := lerpf(0.35, float(ripple["max_scale"]), eased)
		var transform := Transform3D(
			Basis(Vector3.UP, float(ripple["rotation"])).scaled(Vector3(scale, 1.0, scale)),
			ripple["position"] as Vector3,
		)
		multimesh.set_instance_transform(i, transform)
		multimesh.set_instance_custom_data(i, Color(normalized, float(ripple["strength"]), 0.0, 0.0))
	multimesh.visible_instance_count = ripples.size()


func _update_rain_splashes(delta: float) -> void:
	var now := Time.get_ticks_msec()
	if now < rain_splash_start_ms or now > rain_splash_end_ms:
		return
	var rate := 14.0 if reduced_web_quality else 38.0
	rain_splash_budget += rate * delta
	while rain_splash_budget >= 1.0:
		rain_splash_budget -= 1.0
		spawn_ripple(
			Vector3(rng.randf_range(-0.5, cols - 0.5), 0.0, rng.randf_range(-0.5, rows - 0.5)),
			rng.randf_range(0.8, 1.5),
			rng.randf_range(0.45, 0.7),
			rng.randf_range(1.0, 1.4),
		)


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
	var now := Time.get_ticks_msec()
	rain_splash_start_ms = now + 650
	rain_splash_end_ms = now + (3400 if OS.has_feature("web") else 4200)
	_spawn_rain_wave()
	_delayed_rain_wave(0.9)
	if not OS.has_feature("web"):
		_delayed_rain_wave(1.6)


func spawn_falling_bean(cell: Vector2i, color_index: int) -> void:
	var bean := MeshInstance3D.new()
	bean.mesh = falling_bean_meshes[color_index]
	bean.material_override = falling_bean_materials[color_index]
	bean.scale = Vector3.ONE * DaiDaiBeanVisuals.VISUAL_SCALE
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
	projectile.visible = false
	root.add_child(projectile)
	if not OS.has_feature("web"):
		var light := OmniLight3D.new()
		light.light_color = Color.GOLD
		light.light_energy = 1.5
		light.omni_range = 5.0
		root.add_child(light)
	ephemeral_node.add_child(root)
	var overlay := _create_gold_overlay_set()
	overlay["node"] = root
	projectile_overlays.append(overlay)
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
		var overlay := _create_gold_overlay_set()
		gold_glow_overlays.append(overlay["glow"] as Sprite2D)
		gold_core_overlays.append(overlay["core"] as Sprite2D)
		gold_sparkle_overlays.append(overlay["sparkle"] as Sprite2D)
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

	_update_rain_splashes(delta)
	_update_ripples(delta)

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
			position.x += sin(Time.get_ticks_msec() * 0.001 + float(bubble["phase"])) * 0.24 * delta
			if position.y > 5.5:
				position = Vector3(
					rng.randf_range(-cols * 0.2, cols * 1.2),
					-0.2,
					rng.randf_range(-rows * 0.2, rows * 1.2),
				)
			bubble["position"] = position
			var wobble := sin(Time.get_ticks_msec() * 0.006 + float(bubble["phase"]) * 3.0) * 0.08
			var size := float(bubble["size"])
			var transform := Transform3D(
				Basis.from_scale(Vector3(size * (1.0 + wobble), size * (1.0 - wobble), size * (1.0 + wobble))),
				position,
			)
			bubble_node.multimesh.set_instance_transform(i, transform)

	var now := Time.get_ticks_msec()
	var emission_pulse := 5.0 + sin(now * 0.009) * 1.2
	projectile_material.emission_energy_multiplier = emission_pulse
	gold_effect_material.emission_energy_multiplier = emission_pulse
	var camera := get_node("../Camera3D") as Camera3D
	var display_scale := (get_node("../HUD") as DaiDaiHUD).ui_scale
	for i in range(projectile_overlays.size() - 1, -1, -1):
		var overlay := projectile_overlays[i]
		var candidate = overlay.get("node")
		if not is_instance_valid(candidate) or (candidate as Node).is_queued_for_deletion():
			_free_gold_overlay_set(overlay)
			projectile_overlays.remove_at(i)
			continue
		var projectile := candidate as Node3D
		var screen_position := camera.unproject_position(projectile.global_position)
		var sparkle := overlay["sparkle"] as Sprite2D
		var glow := overlay["glow"] as Sprite2D
		var core := overlay["core"] as Sprite2D
		var phase := now * 0.018 + i
		glow.position = screen_position
		glow.scale = Vector2.ONE * (0.76 + sin(phase) * 0.08) * display_scale
		glow.modulate.a = 0.78 + sin(phase) * 0.14
		core.position = screen_position
		core.scale = Vector2.ONE * 0.6 * display_scale
		sparkle.position = screen_position + Vector2(13.0, -13.0) * display_scale
		sparkle.scale = Vector2.ONE * (0.3 + sin(phase * 1.3) * 0.08) * display_scale
		sparkle.rotation = now * 0.004
		sparkle.modulate.a = 0.85 + sin(phase * 1.3) * 0.15
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
uniform bool high_quality = true;
uniform float caustic_strength = 0.22;
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
vec2 hash2(vec2 p) {
	p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
	return fract(sin(p) * 43758.5453);
}
// Distance between the two nearest animated cells: zero on cell borders,
// which produces the bright web-like network of real pond caustics.
float caustic_web(vec2 p, float t) {
	vec2 cell = floor(p);
	vec2 local = fract(p);
	float nearest = 8.0;
	float second = 8.0;
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 offset = vec2(float(x), float(y));
			vec2 seed = hash2(cell + offset);
			vec2 point = offset + 0.5 + 0.42 * sin(t + seed * 6.2831853) - local;
			float d = dot(point, point);
			if (d < nearest) {
				second = nearest;
				nearest = d;
			} else if (d < second) {
				second = d;
			}
		}
	}
	return sqrt(second) - sqrt(nearest);
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
	vec3 dark = vec3(0.02, 0.1, 0.095);
	vec3 light = vec3(0.13, 0.33, 0.21);
	vec3 sand = vec3(0.34, 0.4, 0.27);
	float moss = clamp(broad * 0.65 + detail * 0.3 + grain * 0.05, 0.0, 1.0);
	vec3 bed = mix(dark, light, moss);
	float sand_mask = smoothstep(0.58, 0.72, fbm(domain * 0.7 + vec2(53.0, 11.0) - warp));
	bed = mix(bed, sand * (0.82 + grain * 0.3), sand_mask * 0.55);

	// Two drifting caustic layers, bent by the moving surface.
	vec2 flow = vec2(
		sin(world_position.z * 0.45 + TIME * 0.6),
		cos(world_position.x * 0.4 - TIME * 0.5)
	) * 0.18;
	vec2 caustic_uv = world_position.xz * 0.46 + flow;
	// Warp the cell domain so the network bends into organic, curved filaments.
	caustic_uv += vec2(
		gradient_noise(caustic_uv * 0.85 + vec2(TIME * 0.11, 0.0)),
		gradient_noise(caustic_uv * 0.85 + vec2(5.2, 1.3 - TIME * 0.09))
	) * 0.9 - 0.45;
	float web_a = caustic_web(caustic_uv, TIME * 0.85);
	float lines = exp(-web_a * web_a * 260.0);
	if (high_quality) {
		float web_b = caustic_web(caustic_uv * 1.31 + vec2(3.1, 7.7) - flow, TIME * -0.7 + 2.0);
		float lines_b = exp(-web_b * web_b * 380.0);
		lines = lines * 0.6 + lines_b * 0.35 + lines * lines_b * 0.9;
	}
	lines = clamp(lines, 0.0, 1.5);
	// Large, slowly moving pools of sunlight so caustics breathe across the pond.
	float sun_pool = smoothstep(0.38, 0.7, fbm(world_position.xz * 0.045 + vec2(TIME * 0.018, -TIME * 0.012)));
	float caustic = lines * mix(0.12, 1.0, sun_pool);
	vec3 caustic_color = vec3(0.62, 1.0, 0.86);
	ALBEDO = bed * mix(0.8, 1.06, sun_pool) + caustic_color * caustic * 0.04;
	EMISSION = caustic_color * caustic * caustic_strength;
	ROUGHNESS = 0.85;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("high_quality", not reduced_web_quality)
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
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform bool high_quality = true;
uniform vec3 sun_direction = vec3(-0.35, 0.8, 0.48);
uniform vec2 glint_tilt = vec2(0.1, -0.16);
varying vec3 world_position;
vec2 random_gradient(vec2 p) {
	float angle = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453) * 6.2831853;
	return vec2(cos(angle), sin(angle));
}
float gradient_noise(vec2 p) {
	vec2 cell = floor(p);
	vec2 local = fract(p);
	vec2 blend = local * local * (3.0 - 2.0 * local);
	float a = dot(random_gradient(cell), local);
	float b = dot(random_gradient(cell + vec2(1.0, 0.0)), local - vec2(1.0, 0.0));
	float c = dot(random_gradient(cell + vec2(0.0, 1.0)), local - vec2(0.0, 1.0));
	float d = dot(random_gradient(cell + vec2(1.0, 1.0)), local - vec2(1.0, 1.0));
	return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}
float swell(vec2 p, float t) {
	float h = sin(dot(p, vec2(0.38, 0.12)) + t * 1.6) * 0.12;
	h += sin(dot(p, vec2(-0.21, 0.33)) + t * 1.3) * 0.1;
	h += sin(dot(p, vec2(0.9, -0.55)) + t * 2.3) * 0.035;
	h += sin(dot(p, vec2(-0.7, -1.1)) + t * 2.9) * 0.025;
	return h;
}
float surface(vec2 p, float t) {
	float h = swell(p, t);
	h += gradient_noise(p * 1.7 + vec2(t * 0.35, t * 0.22)) * 0.07;
	if (high_quality) {
		h += gradient_noise(p * 3.9 - vec2(t * 0.42, -t * 0.3)) * 0.028;
	}
	return h;
}
void vertex() {
	vec3 world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += swell(world.xz, TIME);
	world_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 p = world_position.xz;
	float e = 0.06;
	float h = surface(p, TIME);
	float hx = surface(p + vec2(e, 0.0), TIME);
	float hz = surface(p + vec2(0.0, e), TIME);
	vec3 n = normalize(vec3(h - hx, e, h - hz));
	vec3 view_world = normalize((INV_VIEW_MATRIX * vec4(VIEW, 0.0)).xyz);

	float fresnel = 0.03 + 0.97 * pow(1.0 - clamp(abs(dot(n, view_world)), 0.0, 1.0), 5.0);
	float diffuse = clamp(dot(n, normalize(sun_direction)), 0.0, 1.0);
	float sun_pool = smoothstep(0.05, 0.4, gradient_noise(p * 0.05 + vec2(TIME * 0.02, -TIME * 0.015)));

	vec3 glint_normal = normalize(vec3(glint_tilt.x, 1.0, glint_tilt.y));
	float alignment = max(dot(n, glint_normal), 0.0);
	float glint = pow(alignment, high_quality ? 1600.0 : 900.0) * 1.8;
	glint *= sun_pool;

	vec3 deep = vec3(0.04, 0.26, 0.27);
	vec3 sky = vec3(0.72, 0.93, 0.95);
	vec3 color = mix(deep, sky, clamp(fresnel * 2.5 + diffuse * 0.12, 0.0, 1.0));
	float sheen = smoothstep(0.12, 0.32, h) * 0.035;
	ALBEDO = color + vec3(1.0, 0.98, 0.9) * glint;
	ALPHA = clamp(0.035 + fresnel * 0.35 + sheen + glint * 0.85, 0.0, 0.9);
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("high_quality", not reduced_web_quality)
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
	mesh.radius = 0.05
	mesh.height = 0.1
	mesh.radial_segments = 10
	mesh.rings = 6
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled;
void fragment() {
	float facing = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float rim = pow(1.0 - facing, 2.2);
	float highlight = pow(clamp(dot(NORMAL, normalize(vec3(-0.45, 0.6, 0.65))), 0.0, 1.0), 28.0);
	ALBEDO = mix(vec3(0.62, 0.9, 0.92), vec3(1.0), highlight);
	ALPHA = clamp(0.06 + rim * 0.7 + highlight * 0.9, 0.0, 1.0);
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
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
		var size := rng.randf_range(0.55, 1.6)
		var transform := Transform3D(Basis.from_scale(Vector3.ONE * size), position)
		multimesh.set_instance_transform(i, transform)
		bubbles.append(
			{
				"position": position,
				"speed": rng.randf_range(0.24, 0.84) * lerpf(0.8, 1.25, (size - 0.55) / 1.05),
				"phase": rng.randf_range(0.0, TAU),
				"size": size,
			},
		)
	bubble_node.multimesh = multimesh
	bubble_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	atmosphere_node.add_child(bubble_node)


func _build_marine_snow() -> void:
	marine_snow_node = MultiMeshInstance3D.new()
	marine_snow_node.name = "MarineSnow"
	var quad := QuadMesh.new()
	quad.size = Vector2(0.09, 0.09)
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec3 box_min;
uniform vec3 box_size;
varying float twinkle;
void vertex() {
	vec3 origin = MODEL_MATRIX[3].xyz;
	float id = float(INSTANCE_ID);
	vec3 drift = vec3(
		TIME * 0.11 + sin(TIME * 0.17 + id * 1.3) * 0.5,
		sin(TIME * 0.23 + id * 0.7) * 0.25 - TIME * 0.035,
		TIME * 0.05 + cos(TIME * 0.13 + id * 2.1) * 0.5
	);
	vec3 moved = mod(origin + drift - box_min, box_size) + box_min;
	float size = 0.6 + fract(id * 0.618) * 0.9;
	vec3 world = moved + (INV_VIEW_MATRIX * vec4(VERTEX * size, 0.0)).xyz;
	POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(world, 1.0);
	twinkle = 0.55 + 0.45 * sin(TIME * 1.1 + id * 2.3);
}
void fragment() {
	float d = length(UV - vec2(0.5)) * 2.0;
	float dot_shape = 1.0 - smoothstep(0.2, 1.0, d);
	ALBEDO = vec3(0.75, 0.95, 0.85);
	ALPHA = dot_shape * twinkle * 0.32;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	var box_min := Vector3(-cols * 0.1, -0.2, -rows * 0.1)
	var box_size := Vector3(cols * 1.2, 3.4, rows * 1.2)
	material.set_shader_parameter("box_min", box_min)
	material.set_shader_parameter("box_size", box_size)
	quad.material = material
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = quad
	multimesh.instance_count = 70 if reduced_web_quality else MARINE_SNOW_COUNT
	for i in range(multimesh.instance_count):
		var origin := box_min + Vector3(
			rng.randf() * box_size.x,
			rng.randf() * box_size.y,
			rng.randf() * box_size.z,
		)
		multimesh.set_instance_transform(i, Transform3D(Basis.IDENTITY, origin))
	marine_snow_node.multimesh = multimesh
	marine_snow_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	marine_snow_node.custom_aabb = AABB(box_min - Vector3.ONE * 2.0, box_size + Vector3.ONE * 4.0)
	atmosphere_node.add_child(marine_snow_node)


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
