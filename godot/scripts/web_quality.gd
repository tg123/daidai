extends RefCounted
class_name DaiDaiWebQuality

static var _cached_reduced


static func use_reduced_quality() -> bool:
	if not OS.has_feature("web"):
		return false
	if _cached_reduced != null:
		return bool(_cached_reduced)
	var reduced = JavaScriptBridge.eval(
		"""
(() => {
	const override = new URLSearchParams(location.search).get('quality');
	if (override === 'high') return false;
	if (override === 'low') return true;
	if (matchMedia('(pointer: coarse)').matches) return true;

	const canvas = document.getElementById('canvas');
	const gl = canvas && canvas.getContext('webgl2');
	let renderer = '';
	let maxTextureSize = 0;
	if (gl) {
		const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
		renderer = debugInfo
			? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
			: gl.getParameter(gl.RENDERER);
		maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
	}
	const softwareRenderer = /swiftshader|llvmpipe|software|basic render/i.test(renderer || '');
	const deviceMemory = Number(navigator.deviceMemory || 8);
	const cpuCores = Number(navigator.hardwareConcurrency || 8);
	return softwareRenderer || deviceMemory <= 4 || cpuCores <= 4 || (maxTextureSize > 0 && maxTextureSize < 8192);
})()
""",
		true,
	)
	_cached_reduced = bool(reduced)
	return bool(_cached_reduced)


static func has_coarse_pointer() -> bool:
	if not OS.has_feature("web"):
		return OS.has_feature("mobile") or DisplayServer.is_touchscreen_available()
	return bool(JavaScriptBridge.eval("matchMedia('(pointer: coarse)').matches", true))
