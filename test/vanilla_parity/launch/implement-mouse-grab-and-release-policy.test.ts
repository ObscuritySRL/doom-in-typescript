import { describe, expect, test } from 'bun:test';

import {
  VANILLA_GRAB_REQUIRES_FOCUS,
  VANILLA_GRAB_REQUIRES_VISIBILITY,
  VANILLA_GRABMOUSE_DEFAULT,
  VANILLA_NOMOUSE_FLAG_DISABLES_GRAB,
  VANILLA_UNFOCUSED_RELEASES_CURSOR,
  decideMouseGrab,
} from '../../../src/bootstrap/implement-mouse-grab-and-release-policy.ts';

describe('vanilla mouse grab and release contract', () => {
  test('chocolate-doom.cfg grabmouse default is 1, focus and visibility are required for grab', () => {
    expect(VANILLA_GRABMOUSE_DEFAULT).toBe(1);
    expect(VANILLA_GRAB_REQUIRES_FOCUS).toBe(true);
    expect(VANILLA_GRAB_REQUIRES_VISIBILITY).toBe(true);
  });

  test('unfocused windows release the cursor; -nomouse disables grab', () => {
    expect(VANILLA_UNFOCUSED_RELEASES_CURSOR).toBe(true);
    expect(VANILLA_NOMOUSE_FLAG_DISABLES_GRAB).toBe(true);
  });
});

describe('decideMouseGrab', () => {
  test('grabs when all four conditions are satisfied: enabled, focused, visible, no -nomouse', () => {
    expect(decideMouseGrab({ grabMouseEnabled: true, windowFocused: true, windowVisible: true, nomouseFlagPresent: false })).toBe('grabbed');
  });

  test('releases when -nomouse is set, regardless of other conditions', () => {
    expect(decideMouseGrab({ grabMouseEnabled: true, windowFocused: true, windowVisible: true, nomouseFlagPresent: true })).toBe('released');
  });

  test('releases when grabmouse is 0', () => {
    expect(decideMouseGrab({ grabMouseEnabled: false, windowFocused: true, windowVisible: true, nomouseFlagPresent: false })).toBe('released');
  });

  test('releases when the window is unfocused', () => {
    expect(decideMouseGrab({ grabMouseEnabled: true, windowFocused: false, windowVisible: true, nomouseFlagPresent: false })).toBe('released');
  });

  test('releases when the window is hidden or minimized', () => {
    expect(decideMouseGrab({ grabMouseEnabled: true, windowFocused: true, windowVisible: false, nomouseFlagPresent: false })).toBe('released');
  });
});
