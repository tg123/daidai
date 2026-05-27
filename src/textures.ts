// Procedural canvas-based THREE textures. Pure functions, browser-only.

import * as THREE from 'three';

export type CanvasTextureFactory = (size: number) => THREE.CanvasTexture;

// Procedural high-res grass texture generator (seamless, tileable)
export function makeGrassTexture(size: number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    // Flat base color — desaturated to let beans pop
    ctx.fillStyle = '#1f3a18';
    ctx.fillRect(0, 0, size, size);
    // Helper: draw with wrap so edges stay seamless
    const wrapDraw = (x: number, y: number, drawFn: (px: number, py: number) => void) => {
        const offsets = [-size, 0, size];
        for (const ox of offsets) for (const oy of offsets) drawFn(x + ox, y + oy);
    };
    // Large soft tonal patches — subtle, low contrast
    for (let i = 0; i < 35; i++) {
        const x = Math.random() * size,
            y = Math.random() * size;
        const r = size * (0.05 + Math.random() * 0.1);
        const hue = 95 + Math.random() * 20;
        const sat = 25 + Math.random() * 15;
        const light = 18 + Math.random() * 12;
        const alpha = 0.2 + Math.random() * 0.15;
        wrapDraw(x, y, (px, py) => {
            if (px < -r || px > size + r || py < -r || py > size + r) return;
            const rg = ctx.createRadialGradient(px, py, 0, px, py, r);
            rg.addColorStop(0, `hsla(${hue},${sat}%,${light}%,${alpha})`);
            rg.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`);
            ctx.fillStyle = rg;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    // Crisp vector-style grass blades — fewer and dimmer
    const bladeCount = Math.floor(size * 0.5);
    for (let i = 0; i < bladeCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const len = 6 + Math.random() * 16;
        const w = 1.0 + Math.random() * 1.5;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        const dxT = Math.cos(angle) * len;
        const dyT = Math.sin(angle) * len;
        const perp = angle + Math.PI / 2;
        const bxOff = Math.cos(perp) * w * 0.5;
        const byOff = Math.sin(perp) * w * 0.5;
        const hue = 90 + Math.random() * 25;
        const light = 22 + Math.random() * 25;
        const curveOff = (Math.random() - 0.5) * 4;
        wrapDraw(x, y, (px, py) => {
            if (px < -30 || px > size + 30 || py < -30 || py > size + 30) return;
            const tipX = px + dxT,
                tipY = py + dyT;
            const lg = ctx.createLinearGradient(px, py, tipX, tipY);
            lg.addColorStop(0, `hsla(${hue},40%,${light * 0.6}%,0.5)`);
            lg.addColorStop(1, `hsla(${hue + 5},45%,${light}%,0.65)`);
            ctx.fillStyle = lg;
            ctx.beginPath();
            ctx.moveTo(px + bxOff, py + byOff);
            ctx.quadraticCurveTo(px + dxT * 0.5 + curveOff, py + dyT * 0.5, tipX, tipY);
            ctx.lineTo(px - bxOff, py - byOff);
            ctx.closePath();
            ctx.fill();
        });
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// Single grass-tuft sprite for top-down 3D grass clumps
export function makeTuftTexture(size: number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2,
        cy = size / 2;
    // Radial blades from center
    const blades = 14;
    for (let i = 0; i < blades; i++) {
        const a = (i / blades) * Math.PI * 2 + Math.random() * 0.2;
        const len = size * (0.35 + Math.random() * 0.12);
        const w = size * 0.05;
        const tipX = cx + Math.cos(a) * len;
        const tipY = cy + Math.sin(a) * len;
        const perp = a + Math.PI / 2;
        const bx1 = cx + Math.cos(perp) * w;
        const by1 = cy + Math.sin(perp) * w;
        const bx2 = cx - Math.cos(perp) * w;
        const by2 = cy - Math.sin(perp) * w;
        const hue = 90 + Math.random() * 30;
        const lg = ctx.createLinearGradient(cx, cy, tipX, tipY);
        lg.addColorStop(0, `hsla(${hue},65%,28%,0.95)`);
        lg.addColorStop(1, `hsla(${hue + 10},75%,55%,0.95)`);
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.6, tipX, tipY);
        ctx.lineTo(bx2, by2);
        ctx.closePath();
        ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
