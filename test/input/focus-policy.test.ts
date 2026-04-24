import { describe, expect, test } from 'bun:test';

import { FocusPolicy, GRAB_TRANSITIONS, WM_ACTIVATEAPP } from '../../src/input/focusPolicy.ts';
import type { GrabTransition } from '../../src/input/focusPolicy.ts';

// ── WM_ACTIVATEAPP constant ───────────────────────────────────────

describe('WM_ACTIVATEAPP constant', () => {
  test('hex value matches Win32 SDK', () => {
    expect(WM_ACTIVATEAPP).toBe(0x001c);
  });

  test('decimal value is 28', () => {
    expect(WM_ACTIVATEAPP).toBe(28);
  });
});

// ── GRAB_TRANSITIONS array ────────────────────────────────────────

describe('GRAB_TRANSITIONS', () => {
  test('contains 3 values', () => {
    expect(GRAB_TRANSITIONS).toHaveLength(3);
  });

  test('ASCIIbetically sorted', () => {
    const sorted = [...GRAB_TRANSITIONS].sort();
    expect(GRAB_TRANSITIONS).toEqual(sorted);
  });

  test('contains all expected values', () => {
    expect(GRAB_TRANSITIONS).toContain('grab');
    expect(GRAB_TRANSITIONS).toContain('none');
    expect(GRAB_TRANSITIONS).toContain('release');
  });

  test('frozen', () => {
    expect(Object.isFrozen(GRAB_TRANSITIONS)).toBe(true);
  });
});

// ── FocusPolicy construction ──────────────────────────────────────

describe('FocusPolicy construction', () => {
  test('starts focused', () => {
    expect(new FocusPolicy().windowFocused).toBe(true);
  });

  test('starts visible', () => {
    expect(new FocusPolicy().screenVisible).toBe(true);
  });

  test('starts with grab enabled', () => {
    expect(new FocusPolicy().grabEnabled).toBe(true);
  });

  test('starts not grabbed', () => {
    expect(new FocusPolicy().mouseGrabbed).toBe(false);
  });

  test('input not suppressed initially', () => {
    expect(new FocusPolicy().inputSuppressed).toBe(false);
  });

  test('shouldGrab true initially (focused + visible + enabled)', () => {
    expect(new FocusPolicy().shouldGrab).toBe(true);
  });
});

// ── handleActivateApp ─────────────────────────────────────────────

describe('handleActivateApp', () => {
  test('wParam 0 clears focus', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    expect(policy.windowFocused).toBe(false);
  });

  test('wParam 1 sets focus', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    policy.handleActivateApp(1);
    expect(policy.windowFocused).toBe(true);
  });

  test('any nonzero wParam counts as focused', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    policy.handleActivateApp(0xdead);
    expect(policy.windowFocused).toBe(true);
  });

  test('focus loss suppresses input', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    expect(policy.inputSuppressed).toBe(true);
  });

  test('focus gain re-enables input', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    policy.handleActivateApp(1);
    expect(policy.inputSuppressed).toBe(false);
  });
});

// ── setScreenVisible ──────────────────────────────────────────────

describe('setScreenVisible', () => {
  test('minimizing clears screenVisible', () => {
    const policy = new FocusPolicy();
    policy.setScreenVisible(false);
    expect(policy.screenVisible).toBe(false);
  });

  test('restoring sets screenVisible', () => {
    const policy = new FocusPolicy();
    policy.setScreenVisible(false);
    policy.setScreenVisible(true);
    expect(policy.screenVisible).toBe(true);
  });

  test('minimizing disables shouldGrab', () => {
    const policy = new FocusPolicy();
    policy.setScreenVisible(false);
    expect(policy.shouldGrab).toBe(false);
  });

  test('minimizing alone does not suppress input', () => {
    const policy = new FocusPolicy();
    policy.setScreenVisible(false);
    expect(policy.inputSuppressed).toBe(false);
  });
});

// ── setGrabEnabled ────────────────────────────────────────────────

describe('setGrabEnabled', () => {
  test('disabling clears grabEnabled', () => {
    const policy = new FocusPolicy();
    policy.setGrabEnabled(false);
    expect(policy.grabEnabled).toBe(false);
  });

  test('re-enabling sets grabEnabled', () => {
    const policy = new FocusPolicy();
    policy.setGrabEnabled(false);
    policy.setGrabEnabled(true);
    expect(policy.grabEnabled).toBe(true);
  });

  test('disabling grab does not suppress input', () => {
    const policy = new FocusPolicy();
    policy.setGrabEnabled(false);
    expect(policy.inputSuppressed).toBe(false);
  });
});

// ── grab transitions ──────────────────────────────────────────────

describe('grab transitions', () => {
  test('evaluate triggers initial grab', () => {
    const policy = new FocusPolicy();
    expect(policy.evaluate()).toBe('grab');
    expect(policy.mouseGrabbed).toBe(true);
  });

  test("second evaluate returns 'none'", () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    expect(policy.evaluate()).toBe('none');
  });

  test("focus loss after grab returns 'release'", () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    expect(policy.handleActivateApp(0)).toBe('release');
    expect(policy.mouseGrabbed).toBe(false);
  });

  test("focus gain after release returns 'grab'", () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    policy.handleActivateApp(0);
    expect(policy.handleActivateApp(1)).toBe('grab');
    expect(policy.mouseGrabbed).toBe(true);
  });

  test("focus loss when not grabbed returns 'none'", () => {
    const policy = new FocusPolicy();
    expect(policy.handleActivateApp(0)).toBe('none');
  });

  test("disabling grab after grab returns 'release'", () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    expect(policy.setGrabEnabled(false)).toBe('release');
  });

  test("enabling grab when focused returns 'grab'", () => {
    const policy = new FocusPolicy();
    policy.setGrabEnabled(false);
    expect(policy.setGrabEnabled(true)).toBe('grab');
  });

  test("minimizing after grab returns 'release'", () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    expect(policy.setScreenVisible(false)).toBe('release');
  });

  test("restoring when focused and enabled returns 'grab'", () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    policy.setScreenVisible(false);
    expect(policy.setScreenVisible(true)).toBe('grab');
  });
});

// ── shouldGrab equation ───────────────────────────────────────────

describe('shouldGrab equation', () => {
  test('all three conditions met', () => {
    expect(new FocusPolicy().shouldGrab).toBe(true);
  });

  test('unfocused prevents grab', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    expect(policy.shouldGrab).toBe(false);
  });

  test('not visible prevents grab', () => {
    const policy = new FocusPolicy();
    policy.setScreenVisible(false);
    expect(policy.shouldGrab).toBe(false);
  });

  test('grab disabled prevents grab', () => {
    const policy = new FocusPolicy();
    policy.setGrabEnabled(false);
    expect(policy.shouldGrab).toBe(false);
  });

  test('all conditions false', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    policy.setScreenVisible(false);
    policy.setGrabEnabled(false);
    expect(policy.shouldGrab).toBe(false);
  });
});

// ── reset ─────────────────────────────────────────────────────────

describe('reset', () => {
  test('restores initial state', () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    policy.handleActivateApp(0);
    policy.setScreenVisible(false);
    policy.setGrabEnabled(false);
    policy.reset();
    expect(policy.windowFocused).toBe(true);
    expect(policy.screenVisible).toBe(true);
    expect(policy.grabEnabled).toBe(true);
    expect(policy.mouseGrabbed).toBe(false);
  });

  test('reset clears grab state', () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    expect(policy.mouseGrabbed).toBe(true);
    policy.reset();
    expect(policy.mouseGrabbed).toBe(false);
  });

  test("evaluate after reset returns 'grab'", () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    policy.handleActivateApp(0);
    policy.reset();
    expect(policy.evaluate()).toBe('grab');
  });
});

// ── parity-sensitive edge cases ───────────────────────────────────

describe('parity-sensitive edge cases', () => {
  test('consecutive focus losses are idempotent', () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    expect(policy.handleActivateApp(0)).toBe('release');
    expect(policy.handleActivateApp(0)).toBe('none');
    expect(policy.mouseGrabbed).toBe(false);
  });

  test('consecutive focus gains are idempotent', () => {
    const policy = new FocusPolicy();
    policy.evaluate();
    expect(policy.handleActivateApp(1)).toBe('none');
    expect(policy.mouseGrabbed).toBe(true);
  });

  test('focus gain while minimized does not grab', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    policy.setScreenVisible(false);
    expect(policy.handleActivateApp(1)).toBe('none');
    expect(policy.mouseGrabbed).toBe(false);
  });

  test('restoring while unfocused does not grab', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    policy.setScreenVisible(false);
    expect(policy.setScreenVisible(true)).toBe('none');
    expect(policy.mouseGrabbed).toBe(false);
  });

  test('grab disabled while minimized and unfocused: no release', () => {
    const policy = new FocusPolicy();
    policy.handleActivateApp(0);
    policy.setScreenVisible(false);
    expect(policy.setGrabEnabled(false)).toBe('none');
    expect(policy.mouseGrabbed).toBe(false);
  });

  test('full focus cycle preserves correct state', () => {
    const policy = new FocusPolicy();
    expect(policy.evaluate()).toBe('grab');
    expect(policy.handleActivateApp(0)).toBe('release');
    expect(policy.inputSuppressed).toBe(true);
    expect(policy.handleActivateApp(1)).toBe('grab');
    expect(policy.inputSuppressed).toBe(false);
    expect(policy.setScreenVisible(false)).toBe('release');
    expect(policy.setScreenVisible(true)).toBe('grab');
    expect(policy.setGrabEnabled(false)).toBe('release');
    expect(policy.setGrabEnabled(true)).toBe('grab');
    expect(policy.mouseGrabbed).toBe(true);
  });

  test('GrabTransition type narrows correctly', () => {
    const policy = new FocusPolicy();
    const transition: GrabTransition = policy.evaluate();
    switch (transition) {
      case 'grab':
      case 'release':
      case 'none':
        break;
      default: {
        const exhaustive: never = transition;
        throw new Error(`Unexpected: ${exhaustive}`);
      }
    }
  });

  test('independent instances do not share state', () => {
    const policyA = new FocusPolicy();
    const policyB = new FocusPolicy();
    policyA.evaluate();
    policyA.handleActivateApp(0);
    expect(policyA.windowFocused).toBe(false);
    expect(policyA.mouseGrabbed).toBe(false);
    expect(policyB.windowFocused).toBe(true);
    expect(policyB.mouseGrabbed).toBe(false);
  });
});
