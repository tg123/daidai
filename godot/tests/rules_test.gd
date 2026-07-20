extends SceneTree

var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)


func _run() -> void:
	_check(DaiDaiRules.wrap_position(Vector2i(-1, 3), 10, 8) == Vector2i(9, 3), "wraps left")
	_check(DaiDaiRules.wrap_position(Vector2i(10, 8), 10, 8) == Vector2i(0, 0), "wraps both axes")
	_check(DaiDaiRules.classify_delta(Vector2(10, 5)) == Vector2i(1, 1), "50% swipe is diagonal")
	_check(DaiDaiRules.classify_delta(Vector2(10, 4)) == Vector2i(1, 0), "dominant swipe is cardinal")
	_check(DaiDaiRules.is_opposite(Vector2i(1, 1), Vector2i(-1, -1)), "diagonal reversal is blocked")
	_check(not DaiDaiRules.is_opposite(Vector2i(1, 1), Vector2i(-1, 0)), "partial turn is allowed")
	_check(DaiDaiRules.eat_score(false, 1, false) == 5, "base score")
	_check(DaiDaiRules.eat_score(true, 1, false) == 15, "rain bonus precedes multipliers")
	_check(DaiDaiRules.eat_score(true, 4, true) == 600, "rain boost and god multipliers stack")

	if failures.is_empty():
		print("Godot rules test passed")
		quit()
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
