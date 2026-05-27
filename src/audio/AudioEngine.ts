// AudioEngine: tiny Web Audio + decoded buffer cache, with iOS unlock helpers.
// Browser-only — Web Audio APIs are not stubbed for Vitest, so no unit tests;
// the class is exercised by E2E.
export class AudioEngine {
        ctx: any;
        initialized: boolean;
        buffers: Record<string, AudioBuffer>;
        rawBuffers: Record<string, ArrayBuffer>;
        loopSources: Record<string, any>;
        masterGain: any;
        muted: boolean;
        files: Record<string, string>;
        deferredFiles: Record<string, string>;
        loaded: number;
        total: number;
        onProgress: ((loaded: number, total: number, name?: string) => void) | null;
        [k: string]: any;

        constructor() {
            this.ctx = null;
            this.initialized = false;
            this.buffers = {};
            this.rawBuffers = {};
            this.loopSources = {};
            this.masterGain = null;
            let mutedFromStorage = false;
            try {
                if (typeof localStorage !== 'undefined') {
                    mutedFromStorage = localStorage.getItem('daidai_muted') === '1';
                }
            } catch (_) {
                // localStorage can throw SecurityError in sandboxed iframes / privacy modes.
                // Default to unmuted when storage is unavailable.
            }
            this.muted = mutedFromStorage;
            this.files = {
                eat: 'audio/eat.ogg',
                die: 'audio/die.ogg',
                drop: 'audio/drop.ogg',
                freeze: 'audio/freeze.ogg',
                laser: 'audio/laser.ogg',
                warp: 'audio/warp.ogg',
                thunder1: 'audio/thunder1.ogg',
                thunder2: 'audio/thunder2.ogg',
                rainloop: 'audio/rainloop.ogg',
                speedup: 'audio/speedup.ogg',
                speedown: 'audio/speedown.ogg',
                beat: 'audio/beat.ogg',
                fade: 'audio/fade.ogg',
                loop: 'audio/loop.ogg',
                popo: 'audio/popo.ogg',
                start: 'audio/start.ogg',
                select: 'audio/select.ogg'
            };
            this.deferredFiles = {
                music: 'audio/music.ogg'
            };
            this.loaded = 0;
            this.total = Object.keys(this.files).length;
            this.onProgress = null;
        }
        async _fetchOne(name, url) {
            const ctrl = new AbortController();
            const tid = setTimeout(() => { console.warn(`[audio] timeout ${name}`); ctrl.abort(); }, 60000);
            try {
                const resp = await fetch(url, { signal: ctrl.signal });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                const arrayBuf = await resp.arrayBuffer();
                this.rawBuffers[name] = arrayBuf;
                if (this.ctx) {
                    try { this.buffers[name] = await this.ctx.decodeAudioData(arrayBuf.slice(0)); } catch (_e) { /* decode failures are non-fatal */ }
                }
                return true;
            } catch (e) {
                console.warn(`[audio] failed ${name}:`, e.message || e);
                return false;
            } finally {
                clearTimeout(tid);
            }
        }
        _ensureCtx() {
            if (this.ctx) return;
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = this.muted ? 0 : 1;
                this.masterGain.connect(this.ctx.destination);
                this.ctx.onstatechange = () => {
                    if (this.ctx.state === 'running') this._flushQueue();
                };
            } catch (e) { console.warn('[audio] ctx create fail:', e); }
        }
        async preload() {
            if (this._preloading) return this._preloading;
            this._ensureCtx();
            this._preloading = (async () => {
                const entries = Object.entries(this.files);
                const failures = [];
                await Promise.all(entries.map(async ([name, url]) => {
                    const ok = await this._fetchOne(name, url);
                    if (!ok) failures.push(name);
                    this.loaded++;
                    if (this.onProgress) this.onProgress(this.loaded, this.total, name);
                }));
                for (const [name, url] of Object.entries(this.deferredFiles)) {
                    this._fetchOne(name, url).then(ok => {
                        if (ok && this.ctx && name === 'music' && !this.loopSources.music) {
                            this._startLoop('music', 0.3);
                        }
                    });
                }
                this.failedAssets = failures;
                return { loaded: this.loaded - failures.length, total: this.total, failed: failures };
            })();
            return this._preloading;
        }
        init() {
            this._ensureCtx();
            if (this.initialized) {
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume().then(() => { this._flushQueue(); }).catch(e => console.warn('[audio] re-resume fail:', e));
                }
                return;
            }
            this.initialized = true;
            this._pendingPlays = [];
            this.ctx.resume().then(() => {
                this._flushQueue();
            }).catch(err => console.warn('[audio] resume failed:', err));
            try {
                const silent = this.ctx.createBuffer(1, 1, 22050);
                const src = this.ctx.createBufferSource();
                src.buffer = silent;
                src.connect(this.ctx.destination);
                src.start(0);
                const osc = this.ctx.createOscillator();
                const ga = this.ctx.createGain();
                ga.gain.value = 0;
                osc.connect(ga).connect(this.ctx.destination);
                osc.start(0);
                osc.stop(this.ctx.currentTime + 0.05);
            } catch(e) { console.warn('[audio] unlock fail:', e); }
            this._ensureSilentVideo();
            this._decodeAll();
        }
        _ensureSilentVideo() {
            try {
                let v = this._silentVideo;
                if (!v) {
                    v = document.createElement('video');
                    v.src = 'audio/silent.mp4';
                    v.loop = true;
                    v.muted = false;
                    v.volume = 0.01;
                    v.setAttribute('playsinline', '');
                    v.setAttribute('webkit-playsinline', '');
                    v.setAttribute('preload', 'auto');
                    v.crossOrigin = 'anonymous';
                    v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';
                    document.body.appendChild(v);
                    this._silentVideo = v;
                    v.addEventListener('ended', () => { try { v.currentTime = 0; v.play().catch(()=>{}); } catch(_){} });
                }
                if (v.paused || v.ended) {
                    const p = v.play();
                    if (p) Promise.resolve(p).catch(err => console.warn('[audio] silent-video play fail:', err && err.message));
                }
            } catch(e) { console.warn('[audio] silent-video fail:', e); }
        }
        /** Public no-op-if-not-ready hook for page lifecycle code: keep the
         *  silent-video heartbeat alive on user gestures / visibility / focus. */
        keepAlive() {
            if (this.initialized && !this.muted) this._ensureSilentVideo();
        }
        /** Public hook: if the AudioContext was suspended (e.g. tab backgrounded
         *  on mobile Safari), bring it back. Safe to call anytime. */
        resumeIfSuspended() {
            if (this.initialized && this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
        }
        _flushQueue() {
            if (!this._pendingPlays || this._pendingPlays.length === 0) return;
            const q = this._pendingPlays.splice(0);
            for (const type of q) this.play(type);
        }
        setMuted(m) {
            this.muted = !!m;
            try { localStorage.setItem('daidai_muted', this.muted ? '1' : '0'); } catch(_){}
            if (this.masterGain && this.ctx) {
                const t = this.ctx.currentTime;
                this.masterGain.gain.cancelScheduledValues(t);
                this.masterGain.gain.linearRampToValueAtTime(this.muted ? 0 : 1, t + 0.1);
            }
        }
        async _decodeAll() {
            await this.preload();
            const entries = Object.entries(this.rawBuffers);
            await Promise.all(entries.map(async ([name, arrayBuf]) => {
                if (this.buffers[name]) return;
                try {
                    const buf = arrayBuf.slice(0);
                    this.buffers[name] = await this.ctx.decodeAudioData(buf);
                } catch (e) {
                    console.warn(`Failed to decode ${name}:`, e);
                }
            }));
            this._startLoop('music', 0.3);
        }
        _playBuffer(name, volume = 0.6, loop = false) {
            if (!this.initialized) { console.warn('[audio] not initialized, skipping', name); return null; }
            if (!this.buffers[name]) { console.warn('[audio] buffer missing:', name); return null; }
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers[name];
            source.loop = loop;
            const gain = this.ctx.createGain();
            gain.gain.value = volume;
            source.connect(gain);
            gain.connect(this.masterGain);
            source.start();
            return { source, gain };
        }
        _startLoop(name, volume = 0.5) {
            if (this.loopSources[name]) return;
            const node = this._playBuffer(name, volume, true);
            if (node) this.loopSources[name] = node;
        }
        setLoopVolume(name, volume, rampTime = 0.3) {
            const node = this.loopSources[name];
            if (!node) return;
            node.gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + rampTime);
        }
        _stopLoop(name, fadeTime = 0.5) {
            const node = this.loopSources[name];
            if (!node) return;
            node.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeTime);
            node.source.stop(this.ctx.currentTime + fadeTime);
            delete this.loopSources[name];
        }
        play(type) {
            if (!this.initialized) return;
            if (this.ctx.state === 'suspended') {
                this._pendingPlays = this._pendingPlays || [];
                if (this._pendingPlays.length < 32) this._pendingPlays.push(type);
                this.ctx.resume().catch(()=>{});
                return;
            }
            switch(type) {
                case 'eat': this._playBuffer('eat', 0.7); break;
                case 'combo': this._playBuffer('beat', 0.8); break;
                case 'grow': this._playBuffer('popo', 0.7); break;
                case 'magic_red': this._playBuffer('speedup', 0.8); break;
                case 'magic_blue':
                    this._playBuffer('thunder1', 0.9);
                    setTimeout(() => this._playBuffer('rainloop', 0.6), 500);
                    setTimeout(() => this._playBuffer('thunder2', 0.7), 2000);
                    break;
                case 'magic_green': this._playBuffer('warp', 0.7); break;
                case 'magic_orange': this._playBuffer('laser', 0.8); break;
                case 'magic_purple': this._playBuffer('fade', 0.7); break;
                case 'gold': this._playBuffer('select', 0.8); break;
                case 'die': this._playBuffer('die', 0.9); break;
                case 'move': this._playBuffer('drop', 0.15); break;
                case 'speed_end': this._playBuffer('speedown', 0.7); break;
                case 'start': this._playBuffer('start', 0.8); break;
                case 'freeze': this._playBuffer('freeze', 0.9); break;
                case 'plop': this._playBuffer('drop', 0.35); break;
                case 'heartbeat_start': this._startLoop('beat', 0.25); break;
                case 'heartbeat_stop': this._stopLoop('beat', 0.1); break;
            }
        }
    }

