import { describe, expect, test } from 'bun:test';

import {
  MOUSE_BUTTON_COUNT,
  MOUSE_BUTTON_EXTRA1,
  MOUSE_BUTTON_EXTRA2,
  MOUSE_BUTTON_LEFT,
  MOUSE_BUTTON_MAX,
  MOUSE_BUTTON_MIDDLE,
  MOUSE_BUTTON_RIGHT,
  MouseSampler,
  WM_LBUTTONDOWN,
  WM_LBUTTONUP,
  WM_MBUTTONDOWN,
  WM_MBUTTONUP,
  WM_MOUSEMOVE,
  WM_RBUTTONDOWN,
  WM_RBUTTONUP,
  WM_XBUTTONDOWN,
  WM_XBUTTONUP,
  XBUTTON1,
  XBUTTON2,
  accelerateMouse,
  isMouseButtonDown,
  isMouseButtonUp,
  translateMouseButton,
} from '../../src/input/mouse.ts';
import type { MouseSample } from '../../src/input/mouse.ts';
import { MOUSE_BUTTON_MAX as INPUT_SCRIPT_MOUSE_MAX } from '../../src/oracles/inputScript.ts';

// ── Doom mouse button constants ───────────────────────────────────

describe('mouse button constants', () => {
  test('button indices are 0-4 in order', () => {
    expect(MOUSE_BUTTON_LEFT).toBe(0);
    expect(MOUSE_BUTTON_RIGHT).toBe(1);
    expect(MOUSE_BUTTON_MIDDLE).toBe(2);
    expect(MOUSE_BUTTON_EXTRA1).toBe(3);
    expect(MOUSE_BUTTON_EXTRA2).toBe(4);
  });

  test('MOUSE_BUTTON_COUNT is 5', () => {
    expect(MOUSE_BUTTON_COUNT).toBe(5);
  });

  test('MOUSE_BUTTON_MAX is 4', () => {
    expect(MOUSE_BUTTON_MAX).toBe(4);
  });

  test('MOUSE_BUTTON_MAX matches input script MOUSE_BUTTON_MAX', () => {
    expect(MOUSE_BUTTON_MAX).toBe(INPUT_SCRIPT_MOUSE_MAX);
  });

  test('MOUSE_BUTTON_COUNT equals MOUSE_BUTTON_MAX + 1', () => {
    expect(MOUSE_BUTTON_COUNT).toBe(MOUSE_BUTTON_MAX + 1);
  });
});

// ── Win32 mouse message constants ─────────────────────────────────

describe('Win32 mouse message constants', () => {
  test('WM_MOUSEMOVE is 0x0200', () => {
    expect(WM_MOUSEMOVE).toBe(0x0200);
  });

  test('button-down messages are sequential pairs', () => {
    expect(WM_LBUTTONDOWN).toBe(0x0201);
    expect(WM_RBUTTONDOWN).toBe(0x0204);
    expect(WM_MBUTTONDOWN).toBe(0x0207);
    expect(WM_XBUTTONDOWN).toBe(0x020b);
  });

  test('each button-up is one greater than its button-down', () => {
    expect(WM_LBUTTONUP).toBe(WM_LBUTTONDOWN + 1);
    expect(WM_RBUTTONUP).toBe(WM_RBUTTONDOWN + 1);
    expect(WM_MBUTTONUP).toBe(WM_MBUTTONDOWN + 1);
    expect(WM_XBUTTONUP).toBe(WM_XBUTTONDOWN + 1);
  });

  test('XBUTTON values are 1 and 2', () => {
    expect(XBUTTON1).toBe(1);
    expect(XBUTTON2).toBe(2);
  });
});

// ── translateMouseButton ──────────────────────────────────────────

describe('translateMouseButton', () => {
  test('WM_LBUTTONDOWN → MOUSE_BUTTON_LEFT', () => {
    expect(translateMouseButton(WM_LBUTTONDOWN, 0)).toBe(MOUSE_BUTTON_LEFT);
  });

  test('WM_LBUTTONUP → MOUSE_BUTTON_LEFT', () => {
    expect(translateMouseButton(WM_LBUTTONUP, 0)).toBe(MOUSE_BUTTON_LEFT);
  });

  test('WM_RBUTTONDOWN → MOUSE_BUTTON_RIGHT', () => {
    expect(translateMouseButton(WM_RBUTTONDOWN, 0)).toBe(MOUSE_BUTTON_RIGHT);
  });

  test('WM_RBUTTONUP → MOUSE_BUTTON_RIGHT', () => {
    expect(translateMouseButton(WM_RBUTTONUP, 0)).toBe(MOUSE_BUTTON_RIGHT);
  });

  test('WM_MBUTTONDOWN → MOUSE_BUTTON_MIDDLE', () => {
    expect(translateMouseButton(WM_MBUTTONDOWN, 0)).toBe(MOUSE_BUTTON_MIDDLE);
  });

  test('WM_MBUTTONUP → MOUSE_BUTTON_MIDDLE', () => {
    expect(translateMouseButton(WM_MBUTTONUP, 0)).toBe(MOUSE_BUTTON_MIDDLE);
  });

  test('WM_XBUTTONDOWN with XBUTTON1 → MOUSE_BUTTON_EXTRA1', () => {
    const wParam = XBUTTON1 << 16;
    expect(translateMouseButton(WM_XBUTTONDOWN, wParam)).toBe(MOUSE_BUTTON_EXTRA1);
  });

  test('WM_XBUTTONDOWN with XBUTTON2 → MOUSE_BUTTON_EXTRA2', () => {
    const wParam = XBUTTON2 << 16;
    expect(translateMouseButton(WM_XBUTTONDOWN, wParam)).toBe(MOUSE_BUTTON_EXTRA2);
  });

  test('WM_XBUTTONUP with XBUTTON1 → MOUSE_BUTTON_EXTRA1', () => {
    const wParam = XBUTTON1 << 16;
    expect(translateMouseButton(WM_XBUTTONUP, wParam)).toBe(MOUSE_BUTTON_EXTRA1);
  });

  test('WM_XBUTTONUP with XBUTTON2 → MOUSE_BUTTON_EXTRA2', () => {
    const wParam = XBUTTON2 << 16;
    expect(translateMouseButton(WM_XBUTTONUP, wParam)).toBe(MOUSE_BUTTON_EXTRA2);
  });

  test('WM_XBUTTONDOWN with unknown XBUTTON returns -1', () => {
    const wParam = 0x0003 << 16;
    expect(translateMouseButton(WM_XBUTTONDOWN, wParam)).toBe(-1);
  });

  test('WM_MOUSEMOVE returns -1', () => {
    expect(translateMouseButton(WM_MOUSEMOVE, 0)).toBe(-1);
  });

  test('unrecognized message returns -1', () => {
    expect(translateMouseButton(0x9999, 0)).toBe(-1);
  });
});

// ── isMouseButtonDown / isMouseButtonUp ───────────────────────────

describe('isMouseButtonDown', () => {
  test('recognizes all four button-down messages', () => {
    expect(isMouseButtonDown(WM_LBUTTONDOWN)).toBe(true);
    expect(isMouseButtonDown(WM_RBUTTONDOWN)).toBe(true);
    expect(isMouseButtonDown(WM_MBUTTONDOWN)).toBe(true);
    expect(isMouseButtonDown(WM_XBUTTONDOWN)).toBe(true);
  });

  test('rejects button-up and non-button messages', () => {
    expect(isMouseButtonDown(WM_LBUTTONUP)).toBe(false);
    expect(isMouseButtonDown(WM_MOUSEMOVE)).toBe(false);
    expect(isMouseButtonDown(0x0012)).toBe(false);
  });
});

describe('isMouseButtonUp', () => {
  test('recognizes all four button-up messages', () => {
    expect(isMouseButtonUp(WM_LBUTTONUP)).toBe(true);
    expect(isMouseButtonUp(WM_RBUTTONUP)).toBe(true);
    expect(isMouseButtonUp(WM_MBUTTONUP)).toBe(true);
    expect(isMouseButtonUp(WM_XBUTTONUP)).toBe(true);
  });

  test('rejects button-down and non-button messages', () => {
    expect(isMouseButtonUp(WM_LBUTTONDOWN)).toBe(false);
    expect(isMouseButtonUp(WM_MOUSEMOVE)).toBe(false);
    expect(isMouseButtonUp(0x0012)).toBe(false);
  });
});

// ── accelerateMouse ───────────────────────────────────────────────

describe('accelerateMouse', () => {
  test('below threshold passes through unchanged', () => {
    expect(accelerateMouse(5, 10, 2.0)).toBe(5);
  });

  test('at threshold passes through unchanged', () => {
    expect(accelerateMouse(10, 10, 2.0)).toBe(10);
  });

  test('above threshold applies acceleration to excess', () => {
    // threshold + (15 - 10) * 2.0 = 10 + 10 = 20
    expect(accelerateMouse(15, 10, 2.0)).toBe(20);
  });

  test('negative value: below threshold unchanged', () => {
    expect(accelerateMouse(-5, 10, 2.0)).toBe(-5);
  });

  test('negative value: at threshold unchanged', () => {
    expect(accelerateMouse(-10, 10, 2.0)).toBe(-10);
  });

  test('negative value: above threshold applies acceleration', () => {
    // -(10 + (15 - 10) * 2.0) = -20
    expect(accelerateMouse(-15, 10, 2.0)).toBe(-20);
  });

  test('zero value unchanged', () => {
    expect(accelerateMouse(0, 10, 2.0)).toBe(0);
  });

  test('acceleration <= 1.0 disables acceleration', () => {
    expect(accelerateMouse(100, 10, 1.0)).toBe(100);
    expect(accelerateMouse(100, 10, 0.5)).toBe(100);
  });

  test('threshold <= 0 disables acceleration', () => {
    expect(accelerateMouse(100, 0, 2.0)).toBe(100);
    expect(accelerateMouse(100, -1, 2.0)).toBe(100);
  });

  test('fractional result is truncated toward zero', () => {
    // threshold=10, accel=1.5, val=13 → 10 + 3 * 1.5 = 14.5 → 14
    expect(accelerateMouse(13, 10, 1.5)).toBe(14);
    // negative: -(10 + 3 * 1.5) = -14.5 → -14
    expect(accelerateMouse(-13, 10, 1.5)).toBe(-14);
  });

  test('reference config defaults: threshold=10, acceleration=2.0', () => {
    expect(accelerateMouse(10, 10, 2.0)).toBe(10);
    expect(accelerateMouse(11, 10, 2.0)).toBe(12);
    expect(accelerateMouse(20, 10, 2.0)).toBe(30);
    expect(accelerateMouse(-20, 10, 2.0)).toBe(-30);
  });
});

// ── MouseSampler ──────────────────────────────────────────────────

describe('MouseSampler', () => {
  test('initial state: no buttons, no deltas', () => {
    const sampler = new MouseSampler();
    expect(sampler.buttons).toBe(0);
    expect(sampler.pendingDeltaX).toBe(0);
    expect(sampler.pendingDeltaY).toBe(0);
  });

  test('handleButtonDown sets correct bit', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonDown(MOUSE_BUTTON_LEFT);
    expect(sampler.buttons).toBe(1);
    sampler.handleButtonDown(MOUSE_BUTTON_RIGHT);
    expect(sampler.buttons).toBe(3);
    sampler.handleButtonDown(MOUSE_BUTTON_MIDDLE);
    expect(sampler.buttons).toBe(7);
  });

  test('handleButtonUp clears correct bit', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonDown(MOUSE_BUTTON_LEFT);
    sampler.handleButtonDown(MOUSE_BUTTON_RIGHT);
    sampler.handleButtonUp(MOUSE_BUTTON_LEFT);
    expect(sampler.buttons).toBe(2);
  });

  test('button state persists across samples', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonDown(MOUSE_BUTTON_LEFT);
    const first = sampler.sample(0, 1.0);
    const second = sampler.sample(0, 1.0);
    expect(first.buttons).toBe(1);
    expect(second.buttons).toBe(1);
  });

  test('handleMotion accumulates deltas', () => {
    const sampler = new MouseSampler();
    sampler.handleMotion(5, 3);
    sampler.handleMotion(7, -1);
    expect(sampler.pendingDeltaX).toBe(12);
    expect(sampler.pendingDeltaY).toBe(2);
  });

  test('sample returns accumulated deltas and resets them', () => {
    const sampler = new MouseSampler();
    sampler.handleMotion(10, 20);
    const snap = sampler.sample(0, 1.0);
    expect(snap.deltaX).toBe(10);
    expect(snap.deltaY).toBe(20);
    expect(sampler.pendingDeltaX).toBe(0);
    expect(sampler.pendingDeltaY).toBe(0);
  });

  test('sample applies acceleration to accumulated deltas', () => {
    const sampler = new MouseSampler();
    sampler.handleMotion(15, -20);
    const snap = sampler.sample(10, 2.0);
    // X: 10 + (15-10)*2.0 = 20
    expect(snap.deltaX).toBe(20);
    // Y: -(10 + (20-10)*2.0) = -30
    expect(snap.deltaY).toBe(-30);
  });

  test('sample returns frozen object', () => {
    const sampler = new MouseSampler();
    sampler.handleMotion(1, 1);
    const snap = sampler.sample(0, 1.0);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  test('consecutive samples are independent', () => {
    const sampler = new MouseSampler();
    sampler.handleMotion(10, 5);
    const first = sampler.sample(0, 1.0);
    sampler.handleMotion(3, 2);
    const second = sampler.sample(0, 1.0);
    expect(first.deltaX).toBe(10);
    expect(second.deltaX).toBe(3);
  });

  test('sample with no motion returns zero deltas', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonDown(MOUSE_BUTTON_LEFT);
    const snap = sampler.sample(10, 2.0);
    expect(snap.deltaX).toBe(0);
    expect(snap.deltaY).toBe(0);
    expect(snap.buttons).toBe(1);
  });

  test('reset clears all state', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonDown(MOUSE_BUTTON_LEFT);
    sampler.handleMotion(10, 20);
    sampler.reset();
    expect(sampler.buttons).toBe(0);
    expect(sampler.pendingDeltaX).toBe(0);
    expect(sampler.pendingDeltaY).toBe(0);
  });

  test('out-of-range button indices are ignored', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonDown(-1);
    sampler.handleButtonDown(5);
    expect(sampler.buttons).toBe(0);
    sampler.handleButtonUp(-1);
    sampler.handleButtonUp(5);
    expect(sampler.buttons).toBe(0);
  });

  test('all 5 buttons can be held simultaneously', () => {
    const sampler = new MouseSampler();
    for (let index = 0; index <= MOUSE_BUTTON_MAX; index++) {
      sampler.handleButtonDown(index);
    }
    expect(sampler.buttons).toBe(0b11111);
    const snap = sampler.sample(0, 1.0);
    expect(snap.buttons).toBe(0b11111);
  });

  test('double press is idempotent', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonDown(MOUSE_BUTTON_LEFT);
    sampler.handleButtonDown(MOUSE_BUTTON_LEFT);
    expect(sampler.buttons).toBe(1);
  });

  test('release without press is safe', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonUp(MOUSE_BUTTON_LEFT);
    expect(sampler.buttons).toBe(0);
  });
});

// ── Parity-sensitive edge cases ───────────────────────────────────

describe('parity-sensitive edge cases', () => {
  test('acceleration symmetry: |accel(v)| === |accel(-v)|', () => {
    for (const value of [0, 5, 10, 11, 20, 50, 100]) {
      const positive = accelerateMouse(value, 10, 2.0);
      const negative = accelerateMouse(-value, 10, 2.0);
      expect(Math.abs(positive)).toBe(Math.abs(negative));
    }
  });

  test('button bitmask layout matches ev_mouse data1 convention', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonDown(MOUSE_BUTTON_LEFT);
    expect(sampler.buttons & 1).toBe(1);
    sampler.handleButtonDown(MOUSE_BUTTON_RIGHT);
    expect(sampler.buttons & 2).toBe(2);
    sampler.handleButtonDown(MOUSE_BUTTON_MIDDLE);
    expect(sampler.buttons & 4).toBe(4);
    sampler.handleButtonDown(MOUSE_BUTTON_EXTRA1);
    expect(sampler.buttons & 8).toBe(8);
    sampler.handleButtonDown(MOUSE_BUTTON_EXTRA2);
    expect(sampler.buttons & 16).toBe(16);
  });

  test('reference config: fire=button0, strafe=button1, forward=button2', () => {
    const sampler = new MouseSampler();
    sampler.handleButtonDown(0);
    sampler.handleButtonDown(1);
    sampler.handleButtonDown(2);
    const snap = sampler.sample(0, 1.0);
    expect(snap.buttons & (1 << 0)).not.toBe(0);
    expect(snap.buttons & (1 << 1)).not.toBe(0);
    expect(snap.buttons & (1 << 2)).not.toBe(0);
  });

  test('delta accumulation does not overflow on large values', () => {
    const sampler = new MouseSampler();
    sampler.handleMotion(1_000_000, -1_000_000);
    sampler.handleMotion(1_000_000, -1_000_000);
    const snap = sampler.sample(0, 1.0);
    expect(snap.deltaX).toBe(2_000_000);
    expect(snap.deltaY).toBe(-2_000_000);
  });

  test('XBUTTON wParam with low-word modifier bits does not affect button translation', () => {
    const wParam = (XBUTTON1 << 16) | 0x0011;
    expect(translateMouseButton(WM_XBUTTONDOWN, wParam)).toBe(MOUSE_BUTTON_EXTRA1);
  });

  test('MouseSample satisfies the interface contract', () => {
    const sampler = new MouseSampler();
    sampler.handleMotion(1, 2);
    sampler.handleButtonDown(MOUSE_BUTTON_LEFT);
    const snap: MouseSample = sampler.sample(0, 1.0);
    expect(typeof snap.buttons).toBe('number');
    expect(typeof snap.deltaX).toBe('number');
    expect(typeof snap.deltaY).toBe('number');
  });
});
