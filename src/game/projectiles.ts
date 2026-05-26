// Pure motion + collision math for golden projectiles. The 3D mesh, scene
// graph, and collision side-effects (spawning gold beans, removing meshes)
// stay in main.ts — this module only owns the position/life advancement and
// boundary/hit tests so they can be tested without a renderer.

export interface ProjectileState {
    x: number;
    z: number;
    dx: number;
    dz: number;
    life: number;
}

(function (g: any) {
    'use strict';

    function stepProjectile(p: ProjectileState): void {
        p.x += p.dx;
        p.z += p.dz;
        p.life -= 1;
    }

    function isProjectileDead(
        p: ProjectileState,
        cols: number,
        rows: number,
        cell: number,
        margin: number = 2,
    ): boolean {
        if (p.life <= 0) return true;
        if (p.x < -margin) return true;
        if (p.x > cols * cell + margin) return true;
        if (p.z < -margin) return true;
        if (p.z > rows * cell + margin) return true;
        return false;
    }

    function projectileHits(
        p: ProjectileState,
        targetCellX: number,
        targetCellY: number,
        cell: number,
        radius: number = 0.8,
    ): boolean {
        const tx = targetCellX * cell;
        const tz = targetCellY * cell;
        const dx = p.x - tx;
        const dz = p.z - tz;
        return Math.sqrt(dx * dx + dz * dz) < radius;
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.stepProjectile = stepProjectile;
    g.DAIDAI.isProjectileDead = isProjectileDead;
    g.DAIDAI.projectileHits = projectileHits;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (this as any)));
