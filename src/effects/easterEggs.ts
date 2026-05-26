import type { AudioEngine } from '../audio/AudioEngine';

export type TFn = (key: string, vars?: Record<string, unknown>) => string;
export type Cell = { x: number; y: number };

export function showEffect(text: string): void {
    const el = document.getElementById('effect-text');
    if (!el) return;
    el.textContent = text;
    el.style.opacity = '1';
    setTimeout(() => {
        el.style.opacity = '0';
    }, 2000);
}

export function showMessage(text: string): void {
    const el = document.getElementById('message');
    if (!el) return;
    el.textContent = text;
    el.style.display = text ? 'block' : 'none';
}

export interface EasterEggDeps {
    audio: AudioEngine;
    t: TFn;
    THREE: typeof import('three');
    getSnake: () => Cell[];
    cell: number;
    cols: number;
    rows: number;
    colorsHexCount: number;
    spawnParticles3D: (x: number, z: number, color: number, n: number) => void;
    spawnFallingBean: (x: number, y: number, color: number) => void;
}

export interface TributeState {
    tributeActive: boolean;
    tributeTriggeredThisLoad: boolean;
}

/**
 * Build the easter-egg side-effect helpers. Caller owns the booleans for
 * godMode / tribute and passes them in (godMode as `alreadyOn`, tribute as
 * a mutable state object); each helper performs the visual / audio side
 * effects and returns / mutates the boolean state accordingly.
 */
export function createEasterEggs(deps: EasterEggDeps) {
    const { audio, t, THREE, getSnake, cell, cols, rows, colorsHexCount, spawnParticles3D, spawnFallingBean } = deps;

    function activateGodMode(alreadyOn: boolean): boolean {
        if (alreadyOn) return true;
        showEffect(t('fx.godmode'));
        audio.play('magic_orange');
        const snake = getSnake();
        if (snake && snake[0]) {
            for (let k = 0; k < 5; k++) {
                const hue = (k * 72) % 360;
                const col = new THREE.Color().setHSL(hue / 360, 1, 0.5).getHex();
                spawnParticles3D(snake[0].x * cell, snake[0].y * cell, col, 20);
            }
        }
        return true;
    }

    function spawnMeteorShower(): void {
        showEffect(t('fx.meteor'));
        audio.play('magic_blue');
        for (let i = 0; i < 30; i++) {
            const x = Math.floor(Math.random() * cols);
            const y = Math.floor(Math.random() * rows);
            const c = Math.floor(Math.random() * colorsHexCount);
            setTimeout(() => spawnFallingBean(x, y, c), i * 60);
        }
    }

    function activateTribute(state: TributeState): void {
        if (state.tributeActive || state.tributeTriggeredThisLoad) return;
        state.tributeTriggeredThisLoad = true;
        state.tributeActive = true;
        audio.play('magic_orange');
        const wrap = document.createElement('div');
        wrap.id = 'tribute-overlay';
        wrap.style.cssText =
            'position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden;background:radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%);';
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        canvas.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;opacity:0.35;mix-blend-mode:screen;image-rendering:pixelated;';
        wrap.appendChild(canvas);
        const ctx = canvas.getContext('2d')!;
        const staticTimer = setInterval(() => {
            const img = ctx.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < img.data.length; i += 4) {
                const v = (Math.random() * 255) | 0;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
                img.data[i + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
        }, 60);
        wrap.dataset.staticTimer = String(staticTimer);
        const subtitle = document.createElement('div');
        subtitle.style.cssText =
            'position:absolute;left:100%;top:50%;transform:translateY(-50%);white-space:nowrap;font-size:56px;font-weight:bold;color:#fff;text-shadow:0 0 18px #ff66aa, 0 0 4px #000;font-family:inherit;letter-spacing:6px;transition:left 5s linear;';
        subtitle.textContent = t('subtitle');
        wrap.appendChild(subtitle);
        document.body.appendChild(wrap);
        requestAnimationFrame(() => {
            subtitle.style.left = '-100%';
        });
        setTimeout(() => {
            clearInterval(staticTimer);
            wrap.style.transition = 'opacity 0.6s';
            wrap.style.opacity = '0';
            setTimeout(() => {
                wrap.remove();
                state.tributeActive = false;
            }, 700);
        }, 5000);
    }

    return { activateGodMode, spawnMeteorShower, activateTribute };
}
