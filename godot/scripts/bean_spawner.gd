extends Node3D
## Bean spawner skeleton — ports the bean spawn/eat loop from
## src/main.ts and src/scene/meshFactories.ts on main.
##
## Not implemented yet. Open issues to track when porting:
##   - reuse Snake's COLS/ROWS so beans never spawn on the worm
##   - port the 7 bean color palette (matches body coloring queue)
##   - emit a `bean_eaten` signal so Snake can grow + audio can play

const BEAN_COUNT := 5

func _ready() -> void:
	# Placeholder: scatter a few static beans so the scene isn't empty.
	for i in range(BEAN_COUNT):
		var bean := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = 0.35
		mesh.height = 0.7
		bean.mesh = mesh
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color.from_hsv(randf(), 0.8, 0.95)
		bean.material_override = mat
		bean.position = Vector3(randf_range(-18, 18), 0.4, randf_range(-13, 13))
		add_child(bean)
