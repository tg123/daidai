extends Node3D
## DaiDai snake — gameplay skeleton port from src/main.ts
##
## TypeScript reference: src/main.ts (grid step, direction queue,
## body growth) and src/snake/* on the main branch.
##
## This is a minimal vertical slice: arrow keys / WASD / left stick
## move the head, body follows, each step is on a fixed grid tick.
## Bean eating, easter eggs, audio, splash UI, etc. are NOT ported
## yet; this scaffold only proves the engine swap is viable.

const GRID_CELL := 1.0
const STEP_SECONDS := 0.18
const COLS := 40
const ROWS := 30
const START_LENGTH := 5

# Direction vectors keyed by input action name. The y axis is the
# horizontal grid axis in our top-down setup (Godot Y is vertical;
# we keep snake flat on the XZ plane and treat Z as "rows").
const DIRS := {
	"snake_up": Vector2i(0, -1),
	"snake_down": Vector2i(0, 1),
	"snake_left": Vector2i(-1, 0),
	"snake_right": Vector2i(1, 0),
}

var body: Array[Vector2i] = []
var direction := Vector2i(1, 0)
var queued_direction := Vector2i(1, 0)
var step_timer := 0.0
var body_node: Node3D

func _ready() -> void:
	body_node = Node3D.new()
	add_child(body_node)
	_reset_snake()

func _reset_snake() -> void:
	body.clear()
	for child in body_node.get_children():
		child.queue_free()
	var start := Vector2i(COLS / 2, ROWS / 2)
	for i in range(START_LENGTH):
		body.append(start - Vector2i(i, 0))
		_spawn_segment(body[i])
	direction = Vector2i(1, 0)
	queued_direction = direction

func _spawn_segment(cell: Vector2i) -> void:
	var seg := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = GRID_CELL * 0.45
	mesh.height = GRID_CELL * 0.9
	seg.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.85, 0.78, 0.25)
	seg.material_override = mat
	seg.position = _cell_to_world(cell)
	body_node.add_child(seg)

func _cell_to_world(cell: Vector2i) -> Vector3:
	# Center the grid on the origin so the camera framing in Main.tscn lines up.
	var x := (cell.x - COLS / 2.0) * GRID_CELL + GRID_CELL * 0.5
	var z := (cell.y - ROWS / 2.0) * GRID_CELL + GRID_CELL * 0.5
	return Vector3(x, GRID_CELL * 0.5, z)

func _process(delta: float) -> void:
	_read_input()
	step_timer += delta
	if step_timer >= STEP_SECONDS:
		step_timer = 0.0
		_advance()

func _read_input() -> void:
	for action in DIRS.keys():
		if Input.is_action_pressed(action):
			var d: Vector2i = DIRS[action]
			# Disallow 180° reversal into the snake's own neck.
			if d + direction != Vector2i.ZERO:
				queued_direction = d

func _advance() -> void:
	direction = queued_direction
	var new_head: Vector2i = body[0] + direction
	# Wrap around the pond edges (matches the JS version's torus pond).
	new_head.x = posmod(new_head.x, COLS)
	new_head.y = posmod(new_head.y, ROWS)
	body.insert(0, new_head)
	var tail: Vector2i = body.pop_back()
	# Recycle the tail mesh to the new head slot instead of allocating.
	var tail_node: Node3D = body_node.get_child(body_node.get_child_count() - 1)
	body_node.move_child(tail_node, 0)
	tail_node.position = _cell_to_world(new_head)
