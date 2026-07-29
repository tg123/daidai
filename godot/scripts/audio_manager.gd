extends Node
class_name DaiDaiAudio

## Godot audio subsystem for DaiDai Worm.
## Mirrors the semantics of src/audio/AudioEngine.ts:
##   - Same play(type) aliases and per-type volumes
##   - Background music loop (auto-started)
##   - Beat loop start / stop with fade
##   - Rain + thunder scheduling for magic_blue
##   - Mute state persisted to user://daidai.cfg
##
## Public API for game.gd:
##   play(type)
##   set_muted(bool)   toggle_muted()   is_muted()
##   set_loop_volume(name, volume [, ramp_time])

const CONFIG_PATH := "user://daidai.cfg"
const CONFIG_SECTION := "audio"
const CONFIG_KEY_MUTED := "muted"

# Streams loaded at _ready (non-looping, shared)
var _streams: Dictionary = {}

# Active loop players: name (String) → AudioStreamPlayer
var _loops: Dictionary = {}

# Intended linear volume for each loop — used when restoring after unmute
var _loop_volumes: Dictionary = {}

var _muted: bool = false


func _ready() -> void:
	_load_persisted()
	_preload_streams()
	if OS.get_environment("DAIDAI_TEST") != "1":
		_start_loop("music", 0.3)


func _exit_tree() -> void:
	for name: String in _loops:
		var player := _loops[name] as AudioStreamPlayer
		player.stop()
		player.stream = null
	_loops.clear()
	_loop_volumes.clear()
	_streams.clear()


# ── Stream loading ────────────────────────────────────────────────────────────

func _preload_streams() -> void:
	var files: Dictionary = {
		"eat":      "res://assets/audio/eat.ogg",
		"die":      "res://assets/audio/die.ogg",
		"drop":     "res://assets/audio/drop.ogg",
		"freeze":   "res://assets/audio/freeze.ogg",
		"laser":    "res://assets/audio/laser.ogg",
		"warp":     "res://assets/audio/warp.ogg",
		"thunder1": "res://assets/audio/thunder1.ogg",
		"thunder2": "res://assets/audio/thunder2.ogg",
		"rainloop": "res://assets/audio/rainloop.ogg",
		"speedup":  "res://assets/audio/speedup.ogg",
		"speedown": "res://assets/audio/speedown.ogg",
		"beat":     "res://assets/audio/beat.ogg",
		"fade":     "res://assets/audio/fade.ogg",
		"loop":     "res://assets/audio/loop.ogg",
		"popo":     "res://assets/audio/popo.ogg",
		"start":    "res://assets/audio/start.ogg",
		"select":   "res://assets/audio/select.ogg",
		"music":    "res://assets/audio/music.ogg",
	}
	for name: String in files:
		var path: String = files[name]
		if ResourceLoader.exists(path):
			_streams[name] = load(path)
		else:
			push_warning("DaiDaiAudio: missing asset " + path)


# ── One-shot playback ─────────────────────────────────────────────────────────

func _play_oneshot(stream_name: String, volume: float) -> void:
	if _muted:
		return
	if not _streams.has(stream_name):
		push_warning("DaiDaiAudio: no stream loaded for '" + stream_name + "'")
		return
	var player := AudioStreamPlayer.new()
	add_child(player)
	player.stream = _streams[stream_name]
	player.volume_db = linear_to_db(volume)
	player.play()
	player.finished.connect(player.queue_free)


# ── Loop management ───────────────────────────────────────────────────────────

func _start_loop(stream_name: String, volume: float) -> void:
	if _loops.has(stream_name):
		return
	if not _streams.has(stream_name):
		push_warning("DaiDaiAudio: no stream loaded for loop '" + stream_name + "'")
		return
	# Duplicate so loop=true doesn't affect the shared one-shot stream
	var loop_stream: AudioStream = _streams[stream_name].duplicate()
	if loop_stream is AudioStreamOggVorbis:
		(loop_stream as AudioStreamOggVorbis).loop = true
	var player := AudioStreamPlayer.new()
	add_child(player)
	player.stream = loop_stream
	player.volume_db = linear_to_db(volume) if not _muted else -80.0
	player.play()
	_loops[stream_name] = player
	_loop_volumes[stream_name] = volume


func _stop_loop(stream_name: String, fade_time: float = 0.5) -> void:
	if not _loops.has(stream_name):
		return
	var player: AudioStreamPlayer = _loops[stream_name]
	_loops.erase(stream_name)
	_loop_volumes.erase(stream_name)
	var tween := create_tween()
	tween.tween_property(player, "volume_db", -80.0, fade_time)
	tween.tween_callback(player.queue_free)


## Ramp a loop to a new linear volume over ramp_time seconds.
## Mirrors AudioEngine.setLoopVolume().
func set_loop_volume(stream_name: String, volume: float, ramp_time: float = 0.3) -> void:
	_loop_volumes[stream_name] = volume
	if not _loops.has(stream_name) or _muted:
		return
	var player: AudioStreamPlayer = _loops[stream_name]
	var tween := create_tween()
	tween.tween_property(player, "volume_db", linear_to_db(volume), ramp_time)


# ── Public play API ───────────────────────────────────────────────────────────

## Play a named audio event, matching AudioEngine.play() switch cases exactly.
func play(type: String) -> void:
	match type:
		"eat":
			_play_oneshot("eat", 0.7)
		"combo":
			_play_oneshot("beat", 0.8)
		"grow":
			_play_oneshot("popo", 0.7)
		"magic_red":
			_play_oneshot("speedup", 0.8)
		"magic_blue":
			_play_oneshot("thunder1", 0.9)
			get_tree().create_timer(0.5).timeout.connect(
				func() -> void: _play_oneshot("rainloop", 0.6)
			)
			get_tree().create_timer(2.0).timeout.connect(
				func() -> void: _play_oneshot("thunder2", 0.7)
			)
		"magic_green":
			_play_oneshot("warp", 0.7)
		"magic_orange":
			_play_oneshot("laser", 0.8)
		"magic_purple":
			_play_oneshot("fade", 0.7)
		"gold":
			_play_oneshot("select", 0.8)
		"die":
			_play_oneshot("die", 0.9)
		"move":
			_play_oneshot("drop", 0.15)
		"speed_end":
			_play_oneshot("speedown", 0.7)
		"start":
			_play_oneshot("start", 0.8)
		"freeze":
			_play_oneshot("freeze", 0.9)
		"plop":
			_play_oneshot("drop", 0.35)
		"heartbeat_start":
			_start_loop("beat", 0.25)
		"heartbeat_stop":
			_stop_loop("beat", 0.1)


# ── Mute state ────────────────────────────────────────────────────────────────

func set_muted(m: bool) -> void:
	_muted = m
	if OS.get_environment("DAIDAI_TEST") != "1":
		_save_persisted()
	_apply_mute()


func toggle_muted() -> void:
	set_muted(not _muted)


func is_muted() -> bool:
	return _muted


func _apply_mute() -> void:
	for name: String in _loops:
		var player: AudioStreamPlayer = _loops[name]
		if _muted:
			player.volume_db = -80.0
		else:
			var vol: float = _loop_volumes.get(name, 0.5)
			var tween := create_tween()
			tween.tween_property(player, "volume_db", linear_to_db(vol), 0.1)


# ── Persistence ───────────────────────────────────────────────────────────────

func _load_persisted() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(CONFIG_PATH) != OK:
		return
	_muted = cfg.get_value(CONFIG_SECTION, CONFIG_KEY_MUTED, false)


func _save_persisted() -> void:
	var cfg := ConfigFile.new()
	cfg.load(CONFIG_PATH)  # preserve other sections (locale etc.)
	cfg.set_value(CONFIG_SECTION, CONFIG_KEY_MUTED, _muted)
	cfg.save(CONFIG_PATH)
