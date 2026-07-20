extends RefCounted
class_name DaiDaiI18n

## Godot localisation subsystem for DaiDai Worm.
## Mirrors the semantics of src/i18n/index.ts:
##   - Same 13 locale codes (BCP-47, lower-case)
##   - zh-Hant / TW / HK / MO resolution → zh-tw
##   - Language-prefix fallback for all other codes
##   - Translation fallback chain: current → en-us → zh-cn → key
##   - {param} placeholder substitution
##   - Selected locale persisted to user://daidai.cfg
##
## Usage:
##   var i18n := DaiDaiI18n.new()
##   i18n.initialize()          # load JSON + restore persisted locale
##   i18n.t("title")
##   i18n.set_locale("en-us")

const CONFIG_PATH := "user://daidai.cfg"
const CONFIG_SECTION := "locale"
const CONFIG_KEY := "locale"

## Display name for each locale in its own language.
const LANG_NAMES: Dictionary = {
	"zh-cn": "简体中文",
	"zh-tw": "繁體中文",
	"en-us": "English",
	"ja-jp": "日本語",
	"ko-kr": "한국어",
	"es-es": "Español",
	"fr-fr": "Français",
	"it-it": "Italiano",
	"de-de": "Deutsch",
	"pt-br": "Português (BR)",
	"pl-pl": "Polski",
	"ru-ru": "Русский",
	"th-th": "ภาษาไทย",
}

var _dicts: Dictionary = {}
var _current: String = "zh-cn"


## Load dictionaries from res://assets/i18n.json and restore any persisted locale.
## Must be called once after DaiDaiI18n.new() before any other method.
func initialize() -> void:
	_load_json()
	_load_persisted()


func _load_json() -> void:
	var f := FileAccess.open("res://assets/i18n.json", FileAccess.READ)
	if not f:
		push_error("DaiDaiI18n: cannot open res://assets/i18n.json")
		return
	var text := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(text)
	if parsed == null:
		push_error("DaiDaiI18n: failed to parse i18n.json")
		return
	_dicts = parsed


func _load_persisted() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(CONFIG_PATH) != OK:
		_current = pick_lang(OS.get_locale())
		return
	var stored: String = cfg.get_value(CONFIG_SECTION, CONFIG_KEY, "")
	if stored != "":
		# Use pick_lang so an obsolete stored code still resolves gracefully
		_current = pick_lang(stored) if not _dicts.has(stored) else stored
	else:
		_current = pick_lang(OS.get_locale())


func _save_persisted() -> void:
	var cfg := ConfigFile.new()
	cfg.load(CONFIG_PATH)  # preserve other sections (audio etc.)
	cfg.set_value(CONFIG_SECTION, CONFIG_KEY, _current)
	cfg.save(CONFIG_PATH)


## Resolve an arbitrary BCP-47 tag to a supported locale code.
## Replicates the logic in src/i18n/index.ts → pickLang().
func pick_lang(raw: String) -> String:
	var lc := raw.to_lower().replace("_", "-")
	# Traditional Chinese: explicit region/script tags
	if (lc == "zh-tw" or lc == "zh-hk" or lc == "zh-mo"
			or lc.begins_with("zh-hant")
			or lc.begins_with("zh-tw")
			or lc.begins_with("zh-hk")
			or lc.begins_with("zh-mo")):
		return "zh-tw"
	if lc.begins_with("zh"):
		return "zh-cn"
	if lc.begins_with("en"):
		return "en-us"
	if lc.begins_with("ja"):
		return "ja-jp"
	if lc.begins_with("ko"):
		return "ko-kr"
	if lc.begins_with("es"):
		return "es-es"
	if lc.begins_with("fr"):
		return "fr-fr"
	if lc.begins_with("it"):
		return "it-it"
	if lc.begins_with("de"):
		return "de-de"
	if lc.begins_with("pt"):
		return "pt-br"
	if lc.begins_with("pl"):
		return "pl-pl"
	if lc.begins_with("ru"):
		return "ru-ru"
	if lc.begins_with("th"):
		return "th-th"
	return "zh-cn"


## Set the active locale. Accepts a supported code or any BCP-47 tag.
func set_locale(code: String) -> void:
	_current = code if _dicts.has(code) else pick_lang(code)
	_save_persisted()


## Return the currently active locale code.
func get_locale() -> String:
	return _current


## All loaded locale codes in dictionary insertion order.
func get_locales() -> Array[String]:
	var result: Array[String] = []
	result.assign(_dicts.keys())
	return result


## Map of every locale code → its display name in that locale's own language.
func get_language_names() -> Dictionary:
	return LANG_NAMES.duplicate()


## Display name for a single locale code (convenience wrapper).
func lang_name(code: String) -> String:
	return LANG_NAMES.get(code, code)


## Translate key with optional {param} substitution.
## Fallback chain: current locale → en-us → zh-cn → key.
func t(key: String, params: Dictionary = {}) -> String:
	var cur_dict: Dictionary = _dicts.get(_current, {})
	var en_dict: Dictionary = _dicts.get("en-us", {})
	var zh_dict: Dictionary = _dicts.get("zh-cn", {})

	var s: String
	if cur_dict.has(key):
		s = cur_dict[key]
	elif en_dict.has(key):
		s = en_dict[key]
	elif zh_dict.has(key):
		s = zh_dict[key]
	else:
		s = key

	for k: String in params:
		s = s.replace("{" + k + "}", str(params[k]))

	return s
