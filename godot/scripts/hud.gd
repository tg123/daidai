extends CanvasLayer
class_name DaiDaiHUD

const LANGUAGE_LABELS := {
	"zh-cn": "🇨🇳 简体中文",
	"zh-tw": "🇹🇼 繁體中文",
	"en-us": "🇬🇧 English",
	"ja-jp": "🇯🇵 日本語",
	"ko-kr": "🇰🇷 한국어",
	"es-es": "🇪🇸 Español",
	"fr-fr": "🇫🇷 Français",
	"it-it": "🇮🇹 Italiano",
	"de-de": "🇩🇪 Deutsch",
	"pt-br": "🇧🇷 Português",
	"pl-pl": "🇵🇱 Polski",
	"ru-ru": "🇷🇺 Русский",
	"th-th": "🇹🇭 ไทย",
}

var game: DaiDaiGame
var i18n: DaiDaiI18n
var hi_label: Label
var score_label: Label
var timer_label: Label
var length_label: Label
var combo_label: Label
var boost_label: Label
var info_container: HBoxContainer
var message_label: Label
var effect_label: Label
var restart_button: Button
var pause_button: Button
var mute_button: Button
var language_button: Button
var instructions: Label
var language_menu: PanelContainer
var language_list: VBoxContainer
var rain_filter: ColorRect
var effect_generation := 0


func _ready() -> void:
	i18n = DaiDaiI18n.new()
	i18n.initialize()
	_build_hud()
	get_viewport().size_changed.connect(_apply_responsive_layout)
	_apply_responsive_layout()


func bind_game(value: DaiDaiGame) -> void:
	game = value
	restart_button.pressed.connect(func() -> void: game.reset_game(true))
	pause_button.pressed.connect(game.toggle_pause)
	mute_button.pressed.connect(game.toggle_mute)
	language_button.pressed.connect(game.cycle_language)
	_refresh_static_text()


func translate(key: String, params: Dictionary = {}) -> String:
	return i18n.t(key, params)


func set_locale(locale: String) -> void:
	i18n.set_locale(locale)
	DisplayServer.window_set_title(i18n.t("title"))
	_refresh_static_text()
	_rebuild_language_menu()


func show_message(text: String) -> void:
	message_label.text = text
	message_label.visible = not text.is_empty()


func show_effect(text: String) -> void:
	effect_generation += 1
	var generation := effect_generation
	effect_label.text = text
	effect_label.modulate.a = 1.0
	effect_label.visible = true
	if OS.get_environment("DAIDAI_TEST") != "1":
		_hide_effect_later(generation)


func update_state(state: Dictionary) -> void:
	hi_label.text = "%s  %05d" % [translate("ui.hiscore"), int(state["hi_score"])]
	score_label.text = "%s  %05d" % [translate("ui.score"), int(state["score"])]
	var elapsed := int(state["elapsed_seconds"])
	timer_label.text = "⏱  %02d:%02d" % [elapsed / 60, elapsed % 60]
	length_label.text = "📏  %d" % int(state["length"])
	var color_index := int(state["combo_color"])
	var count := int(state["combo_count"])
	combo_label.text = "● ×%d" % count if count > 0 else ""
	combo_label.modulate = DaiDaiRules.COLORS[color_index] if color_index >= 0 else Color.WHITE
	if bool(state["boost_active"]):
		boost_label.text = "🔥 ×%d  %.1fs" % [
			int(state["boost_multiplier"]),
			float(state["boost_remaining"]),
		]
		boost_label.visible = true
	else:
		boost_label.visible = false
	var is_paused := bool(state["paused"])
	var is_game_over := bool(state["game_over"])
	restart_button.visible = is_game_over
	instructions.visible = is_paused or is_game_over
	var pause_icon := "▶" if is_paused else "⏸"
	_set_utility_button(pause_button, pause_icon, "A")
	pause_button.disabled = is_game_over
	var mute_icon := "🔇" if bool(state["muted"]) else "🔊"
	_set_utility_button(mute_button, mute_icon, "X")
	_set_utility_button(language_button, "🌐", "Y")
	if not is_paused:
		_close_language_menu()


func toggle_language_menu() -> void:
	language_menu.visible = not language_menu.visible
	if language_menu.visible and language_list.get_child_count() > 0:
		(language_list.get_child(0) as Control).grab_focus()
	else:
		_release_control_focus()


func play_rain_filter() -> void:
	rain_filter.visible = true
	var material := rain_filter.material as ShaderMaterial
	material.set_shader_parameter("strength", 1.0)
	var tween := create_tween()
	tween.tween_method(
		func(value: float) -> void: material.set_shader_parameter("strength", value),
		1.0,
		0.25,
		2.5,
	)
	tween.tween_method(
		func(value: float) -> void: material.set_shader_parameter("strength", value),
		0.25,
		0.0,
		1.0,
	)
	tween.tween_callback(func() -> void: rain_filter.visible = false)


func show_tribute(subtitle: String) -> void:
	var overlay := ColorRect.new()
	overlay.name = "TributeOverlay"
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.color = Color(0.0, 0.0, 0.0, 0.78)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay)

	var static_shader := Shader.new()
	static_shader.code = """
shader_type canvas_item;
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
void fragment() {
	vec2 cell = floor(UV * vec2(320.0, 180.0));
	float noise = hash(cell + floor(TIME * 16.0));
	COLOR = vec4(vec3(noise), 0.35);
}
"""
	var static_rect := ColorRect.new()
	static_rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var static_material := ShaderMaterial.new()
	static_material.shader = static_shader
	static_rect.material = static_material
	static_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.add_child(static_rect)

	var subtitle_label := Label.new()
	subtitle_label.text = subtitle
	subtitle_label.add_theme_font_size_override("font_size", 48)
	subtitle_label.add_theme_color_override("font_color", Color.WHITE)
	subtitle_label.add_theme_color_override("font_shadow_color", Color(1.0, 0.2, 0.55, 0.9))
	subtitle_label.add_theme_constant_override("shadow_offset_x", 4)
	subtitle_label.add_theme_constant_override("shadow_offset_y", 4)
	subtitle_label.position = Vector2(get_viewport().get_visible_rect().size.x, get_viewport().get_visible_rect().size.y / 2.0 - 40.0)
	overlay.add_child(subtitle_label)
	var tween := create_tween()
	tween.tween_property(
		subtitle_label,
		"position:x",
		-subtitle_label.get_minimum_size().x - get_viewport().get_visible_rect().size.x,
		5.0,
	)
	tween.tween_property(overlay, "modulate:a", 0.0, 0.6)
	tween.tween_callback(overlay.queue_free)


func _build_hud() -> void:
	_build_screen_filters()
	var top_panel := PanelContainer.new()
	top_panel.name = "InfoBar"
	top_panel.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top_panel.offset_bottom = 42.0
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color(0.0, 0.0, 0.0, 0.68)
	panel_style.border_width_bottom = 1
	panel_style.border_color = Color(1.0, 1.0, 1.0, 0.18)
	top_panel.add_theme_stylebox_override("panel", panel_style)
	add_child(top_panel)

	info_container = HBoxContainer.new()
	info_container.alignment = BoxContainer.ALIGNMENT_CENTER
	info_container.add_theme_constant_override("separation", 22)
	top_panel.add_child(info_container)
	hi_label = _info_label()
	score_label = _info_label()
	timer_label = _info_label()
	length_label = _info_label()
	combo_label = _info_label()
	boost_label = _info_label()
	boost_label.add_theme_color_override("font_color", Color8(255, 102, 68))
	for label in [hi_label, score_label, timer_label, length_label, combo_label, boost_label]:
		info_container.add_child(label)

	message_label = Label.new()
	message_label.name = "Message"
	message_label.set_anchors_preset(Control.PRESET_CENTER)
	message_label.position = Vector2(-250.0, -90.0)
	message_label.size = Vector2(500.0, 180.0)
	message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	message_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	message_label.add_theme_font_size_override("font_size", 28)
	message_label.add_theme_color_override("font_color", Color8(255, 221, 87))
	message_label.add_theme_color_override("font_shadow_color", Color(0.0, 0.0, 0.0, 0.9))
	message_label.add_theme_constant_override("shadow_offset_x", 3)
	message_label.add_theme_constant_override("shadow_offset_y", 3)
	message_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(message_label)

	effect_label = Label.new()
	effect_label.name = "EffectText"
	effect_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	effect_label.position = Vector2(-300.0, 76.0)
	effect_label.size = Vector2(600.0, 48.0)
	effect_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	effect_label.add_theme_font_size_override("font_size", 22)
	effect_label.add_theme_color_override("font_color", Color8(255, 221, 87))
	effect_label.add_theme_color_override("font_shadow_color", Color(1.0, 0.65, 0.0, 0.8))
	effect_label.add_theme_constant_override("shadow_offset_x", 2)
	effect_label.add_theme_constant_override("shadow_offset_y", 2)
	effect_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	effect_label.visible = false
	add_child(effect_label)

	restart_button = Button.new()
	restart_button.name = "Restart"
	restart_button.set_anchors_preset(Control.PRESET_CENTER)
	restart_button.position = Vector2(-110.0, 90.0)
	restart_button.size = Vector2(220.0, 58.0)
	restart_button.focus_mode = Control.FOCUS_NONE
	restart_button.add_theme_font_size_override("font_size", 20)
	var restart_style := StyleBoxFlat.new()
	restart_style.bg_color = Color8(255, 190, 75)
	restart_style.corner_radius_top_left = 29
	restart_style.corner_radius_top_right = 29
	restart_style.corner_radius_bottom_left = 29
	restart_style.corner_radius_bottom_right = 29
	restart_style.border_width_left = 2
	restart_style.border_width_top = 2
	restart_style.border_width_right = 2
	restart_style.border_width_bottom = 2
	restart_style.border_color = Color(1.0, 1.0, 1.0, 0.7)
	restart_button.add_theme_stylebox_override("normal", restart_style)
	var restart_hover := restart_style.duplicate() as StyleBoxFlat
	restart_hover.bg_color = Color8(255, 213, 106)
	restart_button.add_theme_stylebox_override("hover", restart_hover)
	var restart_pressed := restart_style.duplicate() as StyleBoxFlat
	restart_pressed.bg_color = Color8(230, 157, 52)
	restart_button.add_theme_stylebox_override("pressed", restart_pressed)
	restart_button.add_theme_stylebox_override("disabled", restart_style)
	restart_button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	restart_button.visible = false
	add_child(restart_button)

	instructions = Label.new()
	instructions.name = "Instructions"
	instructions.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	instructions.position = Vector2(-410.0, -58.0)
	instructions.size = Vector2(820.0, 42.0)
	instructions.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	instructions.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	instructions.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	instructions.add_theme_font_size_override("font_size", 12)
	instructions.add_theme_constant_override("line_spacing", 2)
	instructions.add_theme_color_override("font_color", Color(1.0, 1.0, 1.0, 0.85))
	instructions.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(instructions)

	var utility := VBoxContainer.new()
	utility.name = "UtilityButtons"
	utility.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	utility.position = Vector2(-58.0, 54.0)
	utility.size = Vector2(46.0, 160.0)
	utility.add_theme_constant_override("separation", 6)
	add_child(utility)
	pause_button = _utility_button("⏸")
	mute_button = _utility_button("🔊")
	language_button = _utility_button("🌐")
	for button in [pause_button, mute_button, language_button]:
		utility.add_child(button)

	language_menu = PanelContainer.new()
	language_menu.name = "LanguageMenu"
	language_menu.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	language_menu.position = Vector2(-260.0, 54.0)
	language_menu.size = Vector2(196.0, 468.0)
	var menu_style := StyleBoxFlat.new()
	menu_style.bg_color = Color(0.0, 0.0, 0.0, 0.88)
	menu_style.corner_radius_top_left = 10
	menu_style.corner_radius_top_right = 10
	menu_style.corner_radius_bottom_left = 10
	menu_style.corner_radius_bottom_right = 10
	menu_style.content_margin_left = 8
	menu_style.content_margin_top = 8
	menu_style.content_margin_right = 8
	menu_style.content_margin_bottom = 8
	language_menu.add_theme_stylebox_override("panel", menu_style)
	language_list = VBoxContainer.new()
	language_menu.add_child(language_list)
	language_menu.visible = false
	add_child(language_menu)
	_rebuild_language_menu()


func _rebuild_language_menu() -> void:
	if language_list == null:
		return
	for child in language_list.get_children():
		child.free()
	for locale in i18n.get_locales():
		var button := Button.new()
		button.text = str(LANGUAGE_LABELS.get(locale, locale))
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.flat = true
		if locale == i18n.get_locale():
			button.add_theme_color_override("font_color", Color8(255, 213, 74))
		button.pressed.connect(
			func() -> void:
				if game != null:
					game.set_language(locale)
				_close_language_menu()
		)
		language_list.add_child(button)


func _refresh_static_text() -> void:
	if restart_button == null:
		return
	restart_button.text = (
		"%s  %s" % [_gamepad_glyph("B"), translate("btn.restart")]
		if _has_gamepad()
		else "⟳  %s" % translate("btn.restart")
	)
	pause_button.tooltip_text = (
		translate("hint.pauseGamepad", {"btn": _gamepad_glyph("A")})
		if _has_gamepad()
		else translate("hint.pauseKey")
	)
	mute_button.tooltip_text = translate("btn.sound")
	language_button.tooltip_text = translate("btn.language")
	instructions.text = "%s   |   🔴 %s   🔵 %s   🟢 %s   🟠 %s   🟣 %s" % [
		pause_button.tooltip_text,
		translate("hint.combo.red"),
		translate("hint.combo.blue"),
		translate("hint.combo.green"),
		translate("hint.combo.orange"),
		translate("hint.combo.purple"),
	]
	if OS.is_debug_build():
		instructions.text += "\n🧪 1–5: FX   ·   6: +1"


func _build_screen_filters() -> void:
	var vignette := ColorRect.new()
	vignette.name = "UnderwaterVignette"
	vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var vignette_shader := Shader.new()
	if OS.has_feature("mobile"):
		vignette_shader.code = """
shader_type canvas_item;
void fragment() {
	vec2 centered = UV - vec2(0.5);
	float edge = smoothstep(0.28, 0.72, length(centered));
	vec3 tint = vec3(0.02, 0.18, 0.16);
	COLOR = vec4(tint, 0.08 + edge * 0.28);
}
"""
	else:
		vignette_shader.code = """
shader_type canvas_item;
uniform sampler2D screen_texture : hint_screen_texture, filter_linear;
void fragment() {
	vec2 wave = vec2(
		sin(SCREEN_UV.y * 32.0 + TIME * 1.15),
		cos(SCREEN_UV.x * 29.0 - TIME * 0.9)
	) * SCREEN_PIXEL_SIZE * 1.35;
	vec3 scene_color = texture(screen_texture, SCREEN_UV + wave).rgb;
	vec2 centered = UV - vec2(0.5);
	float edge = smoothstep(0.28, 0.72, length(centered));
	vec3 underwater = scene_color * vec3(0.83, 1.0, 0.94) + vec3(0.0, 0.025, 0.035);
	underwater *= 1.0 - edge * 0.3;
	COLOR = vec4(underwater, 1.0);
}
"""
	var vignette_material := ShaderMaterial.new()
	vignette_material.shader = vignette_shader
	vignette.material = vignette_material
	add_child(vignette)

	rain_filter = ColorRect.new()
	rain_filter.name = "RainFilter"
	rain_filter.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	rain_filter.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var rain_shader := Shader.new()
	if OS.has_feature("mobile"):
		rain_shader.code = """
shader_type canvas_item;
uniform float strength : hint_range(0.0, 1.0) = 0.0;
void fragment() {
	COLOR = vec4(0.05, 0.12, 0.18, strength * 0.38);
}
"""
	else:
		rain_shader.code = """
shader_type canvas_item;
uniform sampler2D screen_texture : hint_screen_texture, filter_linear_mipmap;
uniform float strength : hint_range(0.0, 1.0) = 0.0;
void fragment() {
	vec2 px = SCREEN_PIXEL_SIZE * 2.0 * strength;
	vec4 sum = textureLod(screen_texture, SCREEN_UV, strength * 2.0) * 0.4;
	sum += textureLod(screen_texture, SCREEN_UV + vec2(px.x, 0.0), strength * 2.0) * 0.15;
	sum += textureLod(screen_texture, SCREEN_UV - vec2(px.x, 0.0), strength * 2.0) * 0.15;
	sum += textureLod(screen_texture, SCREEN_UV + vec2(0.0, px.y), strength * 2.0) * 0.15;
	sum += textureLod(screen_texture, SCREEN_UV - vec2(0.0, px.y), strength * 2.0) * 0.15;
	sum.rgb *= mix(1.0, 0.62, strength);
	COLOR = vec4(sum.rgb, strength);
}
"""
	var rain_material := ShaderMaterial.new()
	rain_material.shader = rain_shader
	rain_filter.material = rain_material
	rain_filter.visible = false
	add_child(rain_filter)


func _info_label() -> Label:
	var label := Label.new()
	label.add_theme_font_size_override("font_size", 14)
	label.add_theme_color_override("font_color", Color.WHITE)
	return label


func _utility_button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.focus_mode = Control.FOCUS_NONE
	button.custom_minimum_size = Vector2(44.0, 44.0)
	button.add_theme_font_size_override("font_size", 20)
	button.add_theme_stylebox_override(
		"normal",
		_round_style(Color(0.0, 0.0, 0.0, 0.62), 22, Color(1.0, 1.0, 1.0, 0.3)),
	)
	button.add_theme_stylebox_override(
		"hover",
		_round_style(Color(0.08, 0.3, 0.28, 0.92), 22, Color(0.65, 1.0, 0.9, 0.75), 2),
	)
	button.add_theme_stylebox_override(
		"pressed",
		_round_style(Color(0.025, 0.14, 0.13, 0.96), 22, Color(0.45, 0.9, 0.78, 0.8), 2),
	)
	button.add_theme_stylebox_override(
		"disabled",
		_round_style(Color(0.0, 0.0, 0.0, 0.34), 22, Color(1.0, 1.0, 1.0, 0.12)),
	)
	button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())

	var badge := Label.new()
	badge.name = "GamepadBadge"
	badge.position = Vector2(28.0, -5.0)
	badge.size = Vector2(21.0, 18.0)
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.add_theme_font_size_override("font_size", 10)
	badge.add_theme_color_override("font_color", Color(0.05, 0.08, 0.07))
	badge.add_theme_stylebox_override(
		"normal",
		_round_style(Color(0.95, 0.82, 0.3, 0.98), 9, Color(1.0, 1.0, 0.85, 0.8)),
	)
	badge.visible = false
	button.add_child(badge)
	return button


func _set_utility_button(button: Button, icon: String, gamepad_button: String) -> void:
	button.text = icon
	var badge := button.get_node("GamepadBadge") as Label
	badge.visible = _has_gamepad()
	badge.text = _gamepad_glyph(gamepad_button) if badge.visible else ""


func _round_style(
	background: Color,
	radius: int,
	border: Color,
	border_width: int = 1,
) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = background
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	style.border_width_left = border_width
	style.border_width_top = border_width
	style.border_width_right = border_width
	style.border_width_bottom = border_width
	style.border_color = border
	return style


func _apply_responsive_layout() -> void:
	var viewport_size := get_viewport().get_visible_rect().size
	var width := viewport_size.x
	var mobile := width <= 720.0 or DisplayServer.is_touchscreen_available()
	var font_size := 11 if mobile else 14
	info_container.add_theme_constant_override("separation", 5 if mobile else 22)
	hi_label.visible = not mobile
	for label in [hi_label, score_label, timer_label, length_label, combo_label, boost_label]:
		if label != null:
			label.add_theme_font_size_override("font_size", font_size)
	if message_label != null:
		message_label.add_theme_font_size_override("font_size", 20 if mobile else 28)
	if instructions != null:
		instructions.add_theme_font_size_override("font_size", 10 if mobile else 12)
		var legend_width := minf(820.0, width - 16.0)
		var legend_height := 64.0 if mobile else 42.0
		var bottom_margin := 12.0 if mobile else 16.0
		instructions.set_anchors_preset(Control.PRESET_TOP_LEFT)
		instructions.position = Vector2(
			(width - legend_width) / 2.0,
			viewport_size.y - legend_height - bottom_margin,
		)
		instructions.size = Vector2(legend_width, legend_height)


func _hide_effect_later(generation: int) -> void:
	await get_tree().create_timer(2.0).timeout
	if generation != effect_generation:
		return
	var tween := create_tween()
	tween.tween_property(effect_label, "modulate:a", 0.0, 0.3)
	tween.tween_callback(func() -> void: effect_label.visible = false)


func _close_language_menu() -> void:
	if language_menu == null:
		return
	language_menu.visible = false
	_release_control_focus()


func _release_control_focus() -> void:
	var focus_owner := get_viewport().gui_get_focus_owner()
	if focus_owner == null:
		return
	if (
		focus_owner == pause_button
		or focus_owner == mute_button
		or focus_owner == language_button
		or focus_owner == restart_button
		or language_menu.is_ancestor_of(focus_owner)
	):
		focus_owner.release_focus()


func _has_gamepad() -> bool:
	return not Input.get_connected_joypads().is_empty()


func _gamepad_glyph(button: String) -> String:
	if not _has_gamepad():
		return button
	var name := Input.get_joy_name(Input.get_connected_joypads()[0]).to_lower()
	var is_playstation := (
		"dualshock" in name
		or "dualsense" in name
		or "playstation" in name
		or "sony" in name
		or "054c" in name
	)
	if is_playstation:
		return {"A": "✕", "B": "◯", "X": "☐", "Y": "△"}.get(button, button)
	return {"A": "Ⓐ", "B": "Ⓑ", "X": "Ⓧ", "Y": "Ⓨ"}.get(button, button)
