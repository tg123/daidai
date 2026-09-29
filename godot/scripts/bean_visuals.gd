extends RefCounted
class_name DaiDaiBeanVisuals

## Builds the power-themed bean shapes shared by resting beans, falling beans,
## and the worm's eaten-bean body segments.
## Color indices follow DaiDaiRules.COLORS: 0 boost, 1 rain, 2 skin, 3 gold, 4 halve.

enum Power { BOOST, RAIN, SKIN, GOLD, HALVE }

const PART_BODY := 0.0
const PART_ACCENT := 1.0
const VISUAL_SCALE := 1.3
const SHADER_CODE := """
shader_type spatial;
render_mode cull_disabled, specular_schlick_ggx;
uniform int power = -1;
uniform vec3 base_color : source_color = vec3(1.0);
// Body mode paints the same power surface onto the worm's round body segments.
uniform bool body_mode = false;
varying vec3 local_position;
varying float part;
varying float part_param;
varying float seed;
varying vec3 world_position;

vec3 orbit_center(float phase, float radius, float height) {
	float angle = phase * 6.2831853;
	return vec3(cos(angle) * radius, height, sin(angle) * radius);
}

vec3 shrink_toward(vec3 v, vec3 center, float amount) {
	return center + (v - center) * amount;
}

void vertex() {
	part = UV2.x;
	part_param = UV2.y;
	vec3 origin = MODEL_MATRIX[3].xyz;
	seed = fract(sin(dot(floor(origin.xz + 0.5), vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
	vec3 v = VERTEX;
	float t = TIME;
	if (!body_mode) {
		if (power == 1 && part > 0.5) {
			float cycle = fract(t * 0.4 + part_param + seed * 0.1);
			vec3 center = orbit_center(part_param, 0.14, -0.2);
			float size = smoothstep(0.0, 0.2, cycle) * (1.0 - smoothstep(0.55, 1.0, cycle));
			v = shrink_toward(v, center, size) - vec3(0.0, cycle * cycle * 0.35, 0.0);
		} else if (power == 2 && part > 0.5) {
			float sway = sin(t * 1.4 + seed) * 0.16;
			vec3 pivot = vec3(0.0, 0.25, 0.0);
			vec3 rel = v - pivot;
			float bend = sway * clamp(rel.y / 0.2, 0.0, 1.0);
			float c = cos(bend);
			float s = sin(bend);
			v = pivot + vec3(rel.x * c - rel.y * s, rel.x * s + rel.y * c, rel.z);
		} else if (power == 3 && part > 0.5) {
			float angle = t * 1.2 + seed;
			vec3 center = vec3(0.0, 0.05, 0.0);
			v = center + vec3(cos(angle) * 0.4, sin(angle * 2.0) * 0.06, sin(angle) * 0.4) + (v - center) * 0.8;
		} else if (power == 4) {
			float gap = 0.025 + (0.5 + 0.5 * sin(t * 1.3 + seed)) * 0.035;
			if (abs(part) > 0.5) {
				v.x += sign(part) * gap;
			} else {
				v *= 0.85;
			}
		}
	}
	VERTEX = v;
	local_position = v;
	world_position = (MODEL_MATRIX * vec4(v, 1.0)).xyz;
}

void fragment() {
	float facing = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float rim = pow(1.0 - facing, 3.0);
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	float spec = pow(clamp(dot(NORMAL, normalize(vec3(-0.45, 0.6, 0.66))), 0.0, 1.0), 60.0);
	float height = body_mode ? normalize(local_position).y * 0.35 : local_position.y;
	float angle = atan(local_position.z, local_position.x) / 6.2831853;
	vec3 albedo = base_color;
	vec3 emission = vec3(0.0);
	float roughness = 0.3;
	float metallic = 0.0;
	float caustic_receiver = 1.0;
	float t = TIME;

	if (power == 0) {
		float spiral = body_mode
			? fract(angle + height * 4.5 - t * 0.45)
			: fract(UV.x + UV.y * 3.0 - t * 0.45);
		float stripe = smoothstep(0.0, 0.12, spiral) * (1.0 - smoothstep(0.3, 0.45, spiral));
		vec3 dark = base_color * vec3(0.55, 0.2, 0.18);
		vec3 light = base_color * vec3(1.0, 0.62, 0.52) + vec3(0.06, 0.04, 0.03);
		albedo = mix(dark, light, stripe * 0.8);
		if (!body_mode) {
			albedo = mix(albedo, vec3(1.0, 0.78, 0.7), (1.0 - smoothstep(0.05, 0.2, UV.y)) * 0.5);
		}
		emission = base_color * 0.07 + light * stripe * 0.05;
		roughness = 0.28;
	} else if (power == 1) {
		vec3 deep = base_color * vec3(0.4, 0.6, 0.85);
		vec3 shallow = vec3(0.6, 0.85, 1.0);
		albedo = mix(deep, shallow, clamp(rim * 1.2, 0.0, 1.0));
		emission = base_color * 0.1 + shallow * rim * 0.3 + vec3(1.0) * spec * 0.8;
		roughness = 0.05;
	} else if (power == 2) {
		if (!body_mode && part > 0.5) {
			float along = clamp((local_position.y - 0.25) / 0.2, 0.0, 1.0);
			albedo = mix(vec3(0.18, 0.5, 0.2), vec3(0.5, 0.9, 0.38), along);
			float vein = 1.0 - smoothstep(0.0, 0.07, abs(UV.x - 0.5));
			albedo += vec3(0.2, 0.25, 0.08) * vein * step(0.5, part_param);
			emission = albedo * 0.08;
		} else {
			vec2 scale_uv = vec2(angle * 7.0, height * 11.0);
			scale_uv.x += mod(floor(scale_uv.y), 2.0) * 0.5;
			vec2 cell = fract(scale_uv) - vec2(0.5, 0.35);
			float scale_shape = 1.0 - smoothstep(0.32, 0.48, length(cell * vec2(1.0, 1.25)));
			float band_position = fract(t * 0.2 + seed * 0.15) * 1.3 - 0.4;
			float shed = exp(-pow((height - band_position) * 11.0, 2.0));
			albedo = mix(base_color * vec3(0.2, 0.35, 0.18), base_color * vec3(0.55, 0.8, 0.42) + vec3(0.08, 0.1, 0.02), scale_shape);
			emission = base_color * 0.06 + vec3(0.7, 1.0, 0.55) * shed * scale_shape * 0.25;
		}
		roughness = 0.45;
	} else if (power == 3) {
		if (!body_mode && part > 0.5) {
			albedo = vec3(1.0, 0.85, 0.45);
			emission = vec3(1.0, 0.8, 0.35) * 0.9;
			caustic_receiver = 0.0;
		} else {
			vec3 facet_world;
			if (body_mode) {
				facet_world = normalize(round(world_normal * 1.7));
			} else {
				vec3 facet_view = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
				if (dot(facet_view, VIEW) < 0.0) {
					facet_view = -facet_view;
				}
				facet_world = normalize((INV_VIEW_MATRIX * vec4(facet_view, 0.0)).xyz);
			}
			NORMAL = normalize((VIEW_MATRIX * vec4(facet_world, 0.0)).xyz);
			float facet_id = fract(sin(dot(floor(facet_world * 4.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
			vec3 gold = vec3(1.0, 0.5, 0.04);
			albedo = gold * (0.4 + facet_id * 0.35);
			vec3 light_dir = normalize(vec3(sin(t * 0.7 + seed), 0.9, cos(t * 0.7 + seed)));
			float glint = pow(clamp(dot(facet_world, light_dir), 0.0, 1.0), 20.0);
			emission = gold * (0.3 + facet_id * 0.2) + vec3(1.0, 0.85, 0.55) * glint * 0.6;
			metallic = 0.2;
			roughness = 0.25;
		}
	} else if (power == 4) {
		vec3 shell = base_color * vec3(0.6, 0.45, 0.8);
		float pulse = 0.5 + 0.5 * sin(t * 1.3 + seed);
		vec3 seam_color = mix(base_color, vec3(1.0, 0.85, 1.0), 0.5);
		if (body_mode) {
			float seam = 1.0 - smoothstep(0.0, 0.07, abs(normalize(local_position).x));
			albedo = mix(shell, seam_color, seam);
			emission = base_color * (0.08 + rim * 0.2) + seam_color * seam * (0.3 + pulse * 0.2);
		} else if (abs(part) > 0.5 && part_param > 0.5) {
			albedo = seam_color;
			emission = seam_color * (0.45 + pulse * 0.25);
			caustic_receiver = 0.0;
		} else if (abs(part) > 0.5) {
			albedo = shell;
			emission = base_color * (0.08 + rim * 0.25);
		} else {
			albedo = seam_color;
			emission = seam_color * (0.55 + pulse * 0.25);
			caustic_receiver = 0.0;
		}
		roughness = 0.25;
	}

	float wave_a = sin(world_position.x * 2.6 + t * 1.1 + sin(world_position.z * 1.9 - t * 0.7) * 1.4);
	float wave_b = sin(world_position.z * 2.3 - t * 0.9 + sin(world_position.x * 1.7 + t * 0.6) * 1.4);
	float caustic = pow(clamp(1.0 - abs(wave_a + wave_b) * 0.5, 0.0, 1.0), 6.0);
	emission += vec3(0.55, 1.0, 0.85) * caustic * clamp(world_normal.y, 0.0, 1.0) * 0.22 * caustic_receiver;

	ALBEDO = albedo;
	EMISSION = emission;
	ROUGHNESS = roughness;
	METALLIC = metallic;
}
"""


static func create_shader() -> Shader:
	var shader := Shader.new()
	shader.code = SHADER_CODE
	return shader


static func create_material(color_index: int, shader: Shader) -> ShaderMaterial:
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("power", color_index)
	material.set_shader_parameter("base_color", DaiDaiRules.COLORS[color_index])
	return material


static func create_body_material(shader: Shader, color: Color) -> ShaderMaterial:
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("body_mode", true)
	set_body_power(material, -1, color)
	return material


static func set_body_power(material: ShaderMaterial, color_index: int, color: Color) -> void:
	material.set_shader_parameter("power", color_index)
	material.set_shader_parameter("base_color", color)


static func create_mesh(color_index: int, reduced_quality: bool = false) -> ArrayMesh:
	var segments := 12 if reduced_quality else 20
	var builder := _MeshBuilder.new()
	match color_index:
		Power.BOOST:
			builder.lathe(
				_shell_profile(),
				segments,
				PART_BODY,
				0.0,
				Transform3D(Basis(Vector3.BACK, -0.75), Vector3(-0.04, 0.02, 0.0)),
			)
		Power.RAIN:
			builder.lathe(_droplet_profile(), segments, PART_BODY, 0.0)
			for i in range(2):
				builder.sphere(Vector3.ZERO, 0.04, 6, PART_ACCENT, i / 2.0,
					_orbit_center(i / 2.0, 0.14, -0.2))
		Power.SKIN:
			builder.lathe(_seed_profile(), segments, PART_BODY, 0.0)
			builder.lathe(
				PackedVector2Array([Vector2(0.0, 0.2), Vector2(0.022, 0.2), Vector2(0.016, 0.34), Vector2(0.0, 0.345)]),
				6,
				PART_ACCENT,
				0.0,
			)
			builder.leaf(Vector3(0.0, 0.33, 0.0), Vector3(1.0, 0.5, 0.0).normalized(), 0.3, 0.11, PART_ACCENT)
			builder.leaf(Vector3(0.0, 0.3, 0.0), Vector3(-1.0, 0.4, 0.2).normalized(), 0.24, 0.09, PART_ACCENT)
		Power.GOLD:
			builder.lathe(_gem_profile(), 8, PART_BODY, 0.0)
			builder.sphere(Vector3.ZERO, 0.04, 6, PART_ACCENT, 0.0, Vector3(0.0, 0.05, 0.0))
		Power.HALVE:
			var half := _hemisphere_profile(0.31)
			var cap := PackedVector2Array([Vector2(0.0, 0.0), Vector2(0.31, 0.0)])
			var right := Transform3D(Basis(Vector3.BACK, -PI / 2.0), Vector3.ZERO)
			var left := Transform3D(Basis(Vector3.BACK, PI / 2.0), Vector3.ZERO)
			builder.lathe(half, segments, 1.0, 0.0, right)
			builder.lathe(cap, segments, 1.0, 1.0, right)
			builder.lathe(half, segments, -1.0, 0.0, left)
			builder.lathe(cap, segments, -1.0, 1.0, left)
			builder.sphere(Vector3.ZERO, 0.13, 8, PART_BODY, 0.0, Vector3.ZERO)
	return builder.commit()


static func _orbit_center(phase: float, radius: float, height: float) -> Vector3:
	var angle := phase * TAU
	return Vector3(cos(angle) * radius, height, sin(angle) * radius)


static func _shell_profile() -> PackedVector2Array:
	# Turban-shell whorls stacked from a rounded aperture up to a pointed spire.
	return PackedVector2Array([
		Vector2(0.0, -0.24),
		Vector2(0.17, -0.23),
		Vector2(0.27, -0.17),
		Vector2(0.31, -0.07),
		Vector2(0.3, 0.02),
		Vector2(0.25, 0.07),
		Vector2(0.24, 0.1),
		Vector2(0.22, 0.15),
		Vector2(0.17, 0.2),
		Vector2(0.15, 0.22),
		Vector2(0.13, 0.26),
		Vector2(0.09, 0.31),
		Vector2(0.07, 0.33),
		Vector2(0.04, 0.38),
		Vector2(0.0, 0.41),
	])


static func _droplet_profile() -> PackedVector2Array:
	var points := PackedVector2Array()
	for i in range(8):
		var angle := -PI / 2.0 + i / 7.0 * (PI / 2.0 + 0.35)
		points.append(Vector2(cos(angle) * 0.29, sin(angle) * 0.29))
	var start := points[points.size() - 1]
	for i in range(1, 9):
		var progress := i / 8.0
		points.append(Vector2(start.x * pow(1.0 - progress, 1.7), lerpf(start.y, 0.52, progress)))
	return points


static func _seed_profile() -> PackedVector2Array:
	var points := PackedVector2Array()
	for i in range(13):
		var angle := -PI / 2.0 + i / 12.0 * PI
		points.append(Vector2(cos(angle) * 0.3, sin(angle) * 0.25 + 0.0))
	return points


static func _gem_profile() -> PackedVector2Array:
	return PackedVector2Array([
		Vector2(0.0, -0.34),
		Vector2(0.31, 0.02),
		Vector2(0.2, 0.17),
		Vector2(0.0, 0.17),
	])


static func _hemisphere_profile(radius: float) -> PackedVector2Array:
	var points := PackedVector2Array()
	for i in range(9):
		var angle := i / 8.0 * (PI / 2.0)
		points.append(Vector2(cos(angle) * radius, sin(angle) * radius))
	return points


class _MeshBuilder:
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var uvs := PackedVector2Array()
	var uv2s := PackedVector2Array()
	var indices := PackedInt32Array()

	func lathe(
		profile: PackedVector2Array,
		segments: int,
		part: float,
		param: float,
		transform: Transform3D = Transform3D.IDENTITY,
	) -> void:
		var start := vertices.size()
		var count := profile.size()
		for ring in range(segments + 1):
			var angle := ring / float(segments) * TAU
			var direction := Vector3(cos(angle), 0.0, sin(angle))
			for i in range(count):
				var point := profile[i]
				var tangent := profile[mini(i + 1, count - 1)] - profile[maxi(i - 1, 0)]
				var profile_normal := Vector2(tangent.y, -tangent.x).normalized()
				var normal := direction * profile_normal.x + Vector3.UP * profile_normal.y
				vertices.append(transform * (direction * point.x + Vector3.UP * point.y))
				normals.append((transform.basis * normal).normalized())
				uvs.append(Vector2(ring / float(segments), i / float(count - 1)))
				uv2s.append(Vector2(part, param))
		for ring in range(segments):
			for i in range(count - 1):
				var a := start + ring * count + i
				var b := a + count
				indices.append_array(PackedInt32Array([a, b, a + 1, a + 1, b, b + 1]))

	func sphere(
		center: Vector3,
		radius: float,
		segments: int,
		part: float,
		param: float,
		offset: Vector3,
	) -> void:
		var profile := PackedVector2Array()
		var steps := int(segments / 2.0)
		for i in range(steps + 1):
			var angle := -PI / 2.0 + i / float(steps) * PI
			profile.append(Vector2(cos(angle) * radius, sin(angle) * radius))
		lathe(profile, segments, part, param, Transform3D(Basis.IDENTITY, center + offset))

	func leaf(base: Vector3, direction: Vector3, length: float, width: float, part: float) -> void:
		const STEPS := 6
		var across := direction.cross(Vector3.UP)
		if across.length() < 0.01:
			across = Vector3.RIGHT
		across = across.normalized()
		var up := across.cross(direction).normalized()
		if up.y < 0.0:
			up = -up
		var start := vertices.size()
		for i in range(STEPS + 1):
			var progress := i / float(STEPS)
			var half_width := sin(progress * PI) * width + 0.004
			var center := base + direction * (progress * length) - Vector3.UP * (progress * progress * 0.05)
			vertices.append(center - across * half_width)
			vertices.append(center + across * half_width)
			normals.append(up)
			normals.append(up)
			uvs.append(Vector2(0.0, progress))
			uvs.append(Vector2(1.0, progress))
			uv2s.append(Vector2(part, 1.0))
			uv2s.append(Vector2(part, 1.0))
		for i in range(STEPS):
			var a := start + i * 2
			indices.append_array(PackedInt32Array([a, a + 2, a + 1, a + 1, a + 2, a + 3]))

	func commit() -> ArrayMesh:
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = vertices
		arrays[Mesh.ARRAY_NORMAL] = normals
		arrays[Mesh.ARRAY_TEX_UV] = uvs
		arrays[Mesh.ARRAY_TEX_UV2] = uv2s
		arrays[Mesh.ARRAY_INDEX] = indices
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		return mesh
