extends RefCounted
class_name DaiDaiBeanVisuals

## Builds the power-themed bean shapes shared by resting and falling beans.
## Color indices follow DaiDaiRules.COLORS: 0 boost, 1 rain, 2 skin, 3 gold, 4 halve.

enum Power { BOOST, RAIN, SKIN, GOLD, HALVE }

const PART_BODY := 0.0
const PART_ACCENT := 1.0
const PART_DETAIL := 2.0
const VISUAL_SCALE := 1.35
const SHADER_CODE := """
shader_type spatial;
render_mode cull_disabled, specular_schlick_ggx;
uniform int power = 0;
uniform vec3 base_color : source_color = vec3(1.0);
varying vec3 local_position;
varying vec3 world_position;
varying float part;
varying float part_param;
varying float seed;

float value_noise(vec2 p) {
	vec2 cell = floor(p);
	vec2 local = fract(p);
	local = local * local * (3.0 - 2.0 * local);
	float a = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
	float b = fract(sin(dot(cell + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
	float c = fract(sin(dot(cell + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
	float d = fract(sin(dot(cell + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
	return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

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
	if (power == 0) {
		if (part < 0.5) {
			float h = clamp(v.y / 0.62, 0.0, 1.0);
			float angle = atan(v.z, v.x);
			float tongues = sin(angle * 3.0 + t * 7.0 + seed) * 0.6 + sin(t * 11.0 + v.y * 14.0 + seed) * 0.4;
			v.xz *= 1.0 + tongues * 0.16 * h;
			v.x += sin(t * 5.3 + seed) * 0.07 * h * h;
			v.z += cos(t * 4.1 + seed) * 0.05 * h * h;
			v.y *= 1.0 + sin(t * 8.0 + seed) * 0.07 * h;
		} else {
			float cycle = fract(t * 0.9 + part_param + seed * 0.1);
			vec3 center = orbit_center(part_param, 0.2, 0.25);
			float size = smoothstep(0.0, 0.2, cycle) * (1.0 - smoothstep(0.6, 1.0, cycle));
			v = shrink_toward(v, center, size) + vec3(sin(t * 6.0 + part_param * 9.0) * 0.05, cycle * 0.75, 0.0);
		}
	} else if (power == 1) {
		if (part > 0.5) {
			float cycle = fract(t * 0.75 + part_param + seed * 0.1);
			vec3 center = orbit_center(part_param, 0.16, -0.2);
			float size = smoothstep(0.0, 0.15, cycle) * (1.0 - smoothstep(0.65, 1.0, cycle));
			v = shrink_toward(v, center, size) - vec3(0.0, cycle * cycle * 0.55, 0.0);
		} else {
			float wobble = sin(t * 3.2 + seed) * 0.03;
			v.xz *= 1.0 + wobble * (1.0 - clamp(v.y + 0.3, 0.0, 1.0));
			v.y *= 1.0 - wobble;
		}
	} else if (power == 2) {
		if (part > 0.5) {
			float sway = sin(t * 2.1 + seed) * 0.28 + sin(t * 3.7 + seed) * 0.08;
			vec3 pivot = vec3(0.0, 0.25, 0.0);
			vec3 rel = v - pivot;
			float bend = sway * clamp(rel.y / 0.2, 0.0, 1.0);
			float c = cos(bend);
			float s = sin(bend);
			v = pivot + vec3(rel.x * c - rel.y * s, rel.x * s + rel.y * c, rel.z);
		} else {
			v *= 1.0 + sin(t * 1.8 + seed) * 0.025;
		}
	} else if (power == 3) {
		if (part > 0.5) {
			float angle = t * 2.6 + seed;
			vec3 center = vec3(0.0, 0.05, 0.0);
			vec3 rel = v - center;
			float c = cos(angle);
			float s = sin(angle);
			vec3 orbit = vec3(c * 0.42, sin(angle * 2.0) * 0.1, s * 0.42);
			v = center + orbit + rel * (0.85 + sin(t * 12.0) * 0.15);
		} else {
			v.y += sin(t * 2.0 + seed) * 0.02;
		}
	} else {
		float gap = 0.05 + (0.5 + 0.5 * sin(t * 2.4 + seed)) * 0.09;
		if (abs(part) > 0.5) {
			v.x += sign(part) * gap;
			v.y += sin(t * 2.4 + seed) * 0.015 * sign(part);
		} else {
			v *= 0.75 + (gap - 0.05) * 3.0;
		}
	}
	VERTEX = v;
	local_position = v;
	world_position = (MODEL_MATRIX * vec4(v, 1.0)).xyz;
}

void fragment() {
	vec3 view_normal = NORMAL;
	float facing = clamp(dot(view_normal, VIEW), 0.0, 1.0);
	float rim = pow(1.0 - facing, 3.0);
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(view_normal, 0.0)).xyz);
	float spec = pow(clamp(dot(view_normal, normalize(vec3(-0.45, 0.6, 0.66))), 0.0, 1.0), 48.0);
	vec3 albedo = base_color;
	vec3 emission = vec3(0.0);
	float roughness = 0.35;
	float metallic = 0.0;
	float caustic_receiver = 1.0;
	float t = TIME;

	if (power == 0) {
		caustic_receiver = 0.0;
		if (part < 0.5) {
			float h = clamp(local_position.y / 0.62, 0.0, 1.0);
			float angle = atan(local_position.z, local_position.x);
			float flicker = value_noise(vec2(angle * 1.6 + seed, local_position.y * 7.0 - t * 5.5));
			float heat = clamp(facing * 1.15 - h * 0.75 + (flicker - 0.5) * 0.7, 0.0, 1.0);
			vec3 ember = base_color * vec3(1.0, 0.55, 0.45);
			vec3 hot = vec3(1.0, 0.86, 0.35);
			vec3 white = vec3(1.0, 0.98, 0.85);
			vec3 fire = mix(ember, hot, smoothstep(0.2, 0.7, heat));
			fire = mix(fire, white, smoothstep(0.9, 1.0, heat) * 0.7);
			albedo = fire * 0.35;
			emission = fire * (0.85 + heat * 0.55);
		} else {
			albedo = vec3(1.0, 0.6, 0.2);
			emission = vec3(1.0, 0.72, 0.3) * 2.2;
		}
		roughness = 0.8;
	} else if (power == 1) {
		vec3 deep = base_color * vec3(0.35, 0.55, 0.8);
		vec3 shallow = vec3(0.55, 0.85, 1.0);
		float inner = sin(local_position.y * 22.0 - t * 3.5 + atan(local_position.z, local_position.x) * 2.0) * 0.5 + 0.5;
		albedo = mix(deep, shallow, clamp(rim * 1.4 + inner * 0.12, 0.0, 1.0));
		emission = base_color * 0.28 + shallow * rim * 0.9 + vec3(1.0) * spec * 2.4;
		float lower_glow = smoothstep(0.1, -0.25, local_position.y) * facing;
		emission += shallow * lower_glow * 0.35;
		roughness = 0.04;
		if (part > 0.5) {
			emission += shallow * 0.5;
		}
	} else if (power == 2) {
		if (part > 0.5) {
			float along = clamp((local_position.y - 0.25) / 0.2, 0.0, 1.0);
			albedo = mix(vec3(0.18, 0.5, 0.2), vec3(0.55, 0.98, 0.4), along);
			float vein = 1.0 - smoothstep(0.0, 0.07, abs(UV.x - 0.5));
			albedo += vec3(0.25, 0.3, 0.1) * vein * step(0.5, part_param);
			emission = albedo * 0.3;
		} else {
			float angle = atan(local_position.z, local_position.x) / 6.2831853;
			vec2 scale_uv = vec2(angle * 7.0, local_position.y * 11.0);
			scale_uv.x += mod(floor(scale_uv.y), 2.0) * 0.5;
			vec2 cell = fract(scale_uv) - vec2(0.5, 0.35);
			float scale_shape = 1.0 - smoothstep(0.32, 0.48, length(cell * vec2(1.0, 1.25)));
			float band_position = fract(t * 0.32 + seed * 0.15) * 1.3 - 0.4;
			float shed = exp(-pow((local_position.y - band_position) * 11.0, 2.0));
			vec3 dark = base_color * vec3(0.18, 0.32, 0.16);
			vec3 light = base_color * vec3(0.6, 0.85, 0.45) + vec3(0.1, 0.12, 0.02);
			albedo = mix(dark, light, scale_shape);
			emission = base_color * 0.14 + vec3(0.75, 1.0, 0.55) * shed * (0.25 + scale_shape * 0.9);
			emission += vec3(0.6, 1.0, 0.7) * rim * 0.25;
		}
		roughness = 0.45;
	} else if (power == 3) {
		if (part > 0.5) {
			caustic_receiver = 0.0;
			albedo = vec3(1.0, 0.9, 0.5);
			emission = vec3(1.0, 0.85, 0.35) * 3.0;
		} else {
			vec3 facet_normal = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
			if (dot(facet_normal, VIEW) < 0.0) {
				facet_normal = -facet_normal;
			}
			NORMAL = facet_normal;
			vec3 facet_world = normalize((INV_VIEW_MATRIX * vec4(facet_normal, 0.0)).xyz);
			float facet_id = fract(sin(dot(floor(facet_world * 4.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
			vec3 gold = vec3(1.0, 0.45, 0.02);
			albedo = gold * (0.3 + facet_id * 0.3);
			vec3 light_dir = normalize(vec3(sin(t * 1.3 + seed), 0.9, cos(t * 1.3 + seed)));
			float glint = pow(clamp(dot(facet_world, light_dir), 0.0, 1.0), 18.0);
			emission = gold * (0.75 + facet_id * 0.45) + vec3(1.0, 0.85, 0.5) * glint * 1.6;
			metallic = 0.2;
			roughness = 0.25;
		}
	} else {
		if (abs(part) > 0.5) {
			if (part_param > 0.5) {
				float pulse = 0.5 + 0.5 * sin(t * 4.8 + seed);
				albedo = vec3(1.0, 0.75, 1.0);
				emission = mix(base_color, vec3(1.0, 0.85, 1.0), 0.55) * (1.6 + pulse * 1.2);
				caustic_receiver = 0.0;
			} else {
				float stripe = smoothstep(0.02, 0.0, abs(fract(local_position.y * 5.0 + t * 0.4) - 0.5) - 0.42);
				albedo = base_color * vec3(0.55, 0.4, 0.75);
				emission = base_color * (0.18 + rim * 0.7) + vec3(0.9, 0.7, 1.0) * stripe * 0.25;
				roughness = 0.25;
			}
		} else {
			albedo = vec3(1.0, 0.85, 1.0);
			emission = vec3(1.0, 0.7, 1.0) * 2.4;
			caustic_receiver = 0.0;
		}
	}

	float wave_a = sin(world_position.x * 2.6 + t * 1.1 + sin(world_position.z * 1.9 - t * 0.7) * 1.4);
	float wave_b = sin(world_position.z * 2.3 - t * 0.9 + sin(world_position.x * 1.7 + t * 0.6) * 1.4);
	float caustic = pow(clamp(1.0 - abs(wave_a + wave_b) * 0.5, 0.0, 1.0), 6.0);
	emission += vec3(0.55, 1.0, 0.85) * caustic * clamp(world_normal.y, 0.0, 1.0) * 0.35 * caustic_receiver;

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


static func create_mesh(color_index: int, reduced_quality: bool = false) -> ArrayMesh:
	var segments := 12 if reduced_quality else 20
	var builder := _MeshBuilder.new()
	match color_index:
		Power.BOOST:
			builder.lathe(_flame_profile(), segments, PART_BODY, 0.0)
			for i in range(3):
				builder.sphere(Vector3(0.0, 0.0, 0.0), 0.045, 6, PART_ACCENT, i / 3.0,
					_orbit_center(i / 3.0, 0.2, 0.25))
		Power.RAIN:
			builder.lathe(_droplet_profile(), segments, PART_BODY, 0.0)
			for i in range(3):
				builder.sphere(Vector3.ZERO, 0.05, 6, PART_ACCENT, i / 3.0,
					_orbit_center(i / 3.0, 0.16, -0.2))
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
			builder.sphere(Vector3.ZERO, 0.055, 6, PART_ACCENT, 0.0, Vector3(0.0, 0.05, 0.0))
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


static func _flame_profile() -> PackedVector2Array:
	var points := PackedVector2Array()
	for i in range(7):
		var angle := -PI / 2.0 + i / 6.0 * (PI / 2.0)
		points.append(Vector2(cos(angle) * 0.29, sin(angle) * 0.27))
	for i in range(1, 11):
		var progress := i / 10.0
		points.append(Vector2(0.29 * pow(1.0 - progress, 0.85), progress * 0.62))
	return points


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
