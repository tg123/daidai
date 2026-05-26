import { describe, it, expect } from 'vitest';
import {
    isPlayStationGamepadId,
    glyphForButton,
    detectConnectedGamepad,
    pickStartPromptKey,
} from '../../src/input/gamepad';

describe('isPlayStationGamepadId', () => {
    it('returns false for nullish / non-string input', () => {
        expect(isPlayStationGamepadId(undefined)).toBe(false);
        expect(isPlayStationGamepadId(null)).toBe(false);
        expect(isPlayStationGamepadId('')).toBe(false);
        expect(isPlayStationGamepadId(42)).toBe(false);
    });
    it('matches Sony / PlayStation vendor strings (case-insensitive)', () => {
        expect(isPlayStationGamepadId('DualShock 4 Wireless Controller')).toBe(true);
        expect(isPlayStationGamepadId('DualSense Wireless Controller')).toBe(true);
        expect(isPlayStationGamepadId('Sony PLAYSTATION(R)3 Controller')).toBe(true);
        expect(isPlayStationGamepadId('PS5 Controller (Vendor: 054c Product: 0ce6)')).toBe(true);
        expect(isPlayStationGamepadId('054c-0ce6-Wireless Controller')).toBe(true);
    });
    it('does not match Xbox / generic pads', () => {
        expect(isPlayStationGamepadId('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe(false);
        expect(isPlayStationGamepadId('Xbox Wireless Controller')).toBe(false);
        expect(isPlayStationGamepadId('Generic USB Joystick')).toBe(false);
    });
});

describe('glyphForButton', () => {
    it('returns PS glyphs when isPS=true', () => {
        expect(glyphForButton('A', true)).toBe('✕');
        expect(glyphForButton('B', true)).toBe('◯');
        expect(glyphForButton('X', true)).toBe('☐');
        expect(glyphForButton('Y', true)).toBe('△');
    });
    it('returns Xbox glyphs when isPS=false', () => {
        expect(glyphForButton('A', false)).toBe('Ⓐ');
        expect(glyphForButton('B', false)).toBe('Ⓑ');
        expect(glyphForButton('X', false)).toBe('Ⓧ');
        expect(glyphForButton('Y', false)).toBe('Ⓨ');
    });
    it('falls through unknown labels unchanged', () => {
        expect(glyphForButton('Start', false)).toBe('Start');
        expect(glyphForButton('Start', true)).toBe('Start');
    });
});

describe('detectConnectedGamepad', () => {
    it('handles null / empty arrays', () => {
        expect(detectConnectedGamepad(null)).toEqual({ connected: false, isPS: false });
        expect(detectConnectedGamepad([])).toEqual({ connected: false, isPS: false });
        expect(detectConnectedGamepad([null, null])).toEqual({ connected: false, isPS: false });
    });
    it('ignores ghost pads with connected=false', () => {
        const ghost = { connected: false, id: 'Xbox Controller' };
        expect(detectConnectedGamepad([ghost])).toEqual({ connected: false, isPS: false });
    });
    it('ignores pads with blank ids', () => {
        expect(detectConnectedGamepad([{ connected: true, id: '' }])).toEqual({ connected: false, isPS: false });
        expect(detectConnectedGamepad([{ connected: true, id: '   ' }])).toEqual({ connected: false, isPS: false });
    });
    it('detects an Xbox pad as connected non-PS', () => {
        expect(detectConnectedGamepad([{ connected: true, id: 'Xbox Wireless' }])).toEqual({
            connected: true,
            isPS: false,
        });
    });
    it('detects a PS pad and reports isPS=true', () => {
        expect(detectConnectedGamepad([{ connected: true, id: 'DualSense Wireless Controller' }])).toEqual({
            connected: true,
            isPS: true,
        });
    });
    it('isPS=true if any connected pad in the list is a Sony pad', () => {
        const xb = { connected: true, id: 'Xbox 360 Controller' };
        const ps = { connected: true, id: 'PS5 Controller' };
        expect(detectConnectedGamepad([xb, ps])).toEqual({ connected: true, isPS: true });
    });
});

describe('pickStartPromptKey', () => {
    it('keyboard fallback', () => {
        expect(pickStartPromptKey({})).toBe('start.keyboard');
    });
    it('gamepad wins regardless of other flags', () => {
        expect(pickStartPromptKey({ hasGamepad: true, hasTouchEnv: true, hasFineKeyboardEnv: true })).toBe(
            'start.gamepad',
        );
    });
    it('touch-only when no fine keyboard', () => {
        expect(pickStartPromptKey({ hasTouchEnv: true, hasFineKeyboardEnv: false })).toBe('start.touch');
    });
    it('both when touch + fine keyboard', () => {
        expect(pickStartPromptKey({ hasTouchEnv: true, hasFineKeyboardEnv: true })).toBe('start.both');
    });
    it('keyboard when only fine keyboard', () => {
        expect(pickStartPromptKey({ hasFineKeyboardEnv: true })).toBe('start.keyboard');
    });
});
