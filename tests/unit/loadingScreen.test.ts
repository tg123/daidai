import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectFastBoot } from '../../src/bootstrap/loadingScreen';

type WinShape = { __TEST_FAST_BOOT?: boolean; location?: { search?: string } };

describe('detectFastBoot', () => {
    let origWindow: unknown;
    let origLocation: unknown;
    beforeEach(() => {
        origWindow = (globalThis as { window?: unknown }).window;
        origLocation = (globalThis as { location?: unknown }).location;
    });
    afterEach(() => {
        if (origWindow === undefined) delete (globalThis as { window?: unknown }).window;
        else (globalThis as { window?: unknown }).window = origWindow;
        if (origLocation === undefined) delete (globalThis as { location?: unknown }).location;
        else (globalThis as { location?: unknown }).location = origLocation;
    });

    function setup(opts: { fastBoot?: boolean; search?: string } = {}) {
        const win: WinShape = {};
        if (opts.fastBoot !== undefined) win.__TEST_FAST_BOOT = opts.fastBoot;
        (globalThis as { window?: WinShape }).window = win;
        (globalThis as { location?: { search: string } }).location = { search: opts.search ?? '' };
    }

    it('returns true when window.__TEST_FAST_BOOT is set', () => {
        setup({ fastBoot: true });
        expect(detectFastBoot()).toBe(true);
    });

    it('returns true when ?test=1 is in the URL', () => {
        setup({ search: '?test=1' });
        expect(detectFastBoot()).toBe(true);
    });

    it('returns true when test=1 appears among other params', () => {
        setup({ search: '?lang=en-us&test=1&foo=bar' });
        expect(detectFastBoot()).toBe(true);
    });

    it('returns false when neither flag nor query is present', () => {
        setup({ search: '?lang=en-us' });
        expect(detectFastBoot()).toBe(false);
    });

    it('returns false for a different value like test=0', () => {
        setup({ search: '?test=0' });
        expect(detectFastBoot()).toBe(false);
    });
});
