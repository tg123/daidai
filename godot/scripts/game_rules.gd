extends RefCounted
class_name DaiDaiRules

const CELL := 1.0
const START_LENGTH := 5
const BEAN_COUNT := 15
const COMBO_THRESHOLD := 5
const COLORS: Array[Color] = [
	Color8(255, 51, 51),
	Color8(34, 102, 255),
	Color8(34, 238, 34),
	Color8(255, 170, 0),
	Color8(221, 85, 255),
]


static func wrap_position(cell: Vector2i, cols: int, rows: int) -> Vector2i:
	return Vector2i(posmod(cell.x, cols), posmod(cell.y, rows))


static func is_opposite(current: Vector2i, next: Vector2i) -> bool:
	return next.x == -current.x and next.y == -current.y


static func classify_delta(delta: Vector2) -> Vector2i:
	var ax := absf(delta.x)
	var ay := absf(delta.y)
	if ax == 0.0 and ay == 0.0:
		return Vector2i.ZERO
	var major := maxf(ax, ay)
	var minor := minf(ax, ay)
	if minor / major >= 0.5:
		return Vector2i(1 if delta.x > 0.0 else -1, 1 if delta.y > 0.0 else -1)
	if ax > ay:
		return Vector2i(1 if delta.x > 0.0 else -1, 0)
	return Vector2i(0, 1 if delta.y > 0.0 else -1)


static func eat_score(is_raining: bool, boost_multiplier: int, god_mode: bool) -> int:
	var points := 15 if is_raining else 5
	points *= maxi(1, boost_multiplier)
	if god_mode:
		points *= 10
	return points
