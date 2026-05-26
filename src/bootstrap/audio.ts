import type { AudioEngine } from '../audio/AudioEngine';

/**
 * Wire global gestures to the audio engine:
 *   1) prime the engine on the very first user interaction (iOS WKWebView
 *      requires a real gesture for AudioContext / silent-video bypass);
 *   2) keep the silent video alive on subsequent gestures and visibility
 *      changes so iOS doesn't pause it on interruptions.
 */
export function installAudioBootstrap(audio: AudioEngine): void {
    const primeEvents = ['touchend', 'touchstart', 'mousedown', 'click', 'keydown'];
    const primeHandler = () => {
        audio.init();
        primeEvents.forEach((ev) => window.removeEventListener(ev, primeHandler, true));
    };
    primeEvents.forEach((ev) => window.addEventListener(ev, primeHandler, true));

    const refresh = () => {
        if (audio.initialized && !audio.muted) audio._ensureSilentVideo();
    };
    ['touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, refresh, true));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && audio.initialized) {
            if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
            if (!audio.muted) audio._ensureSilentVideo();
        }
    });
    window.addEventListener('focus', refresh);
}
