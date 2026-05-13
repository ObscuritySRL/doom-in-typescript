import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MENU_JOYWAIT_TICS,
  VANILLA_MENU_MOUSEWAIT_TICS,
  VANILLA_MENU_MOUSE_VERTICAL_THRESHOLD_PIXELS,
  classifyVanillaMouseVerticalDelta,
  computeVanillaMenuWaitUntil,
  vanillaMenuInputIsGated,
} from '../../../src/ui/implement-menu-repeat-timing.ts';

describe('repeat timing constants', () => {
  test('joywait and mousewait are both 5 tics', () => {
    expect(VANILLA_MENU_JOYWAIT_TICS).toBe(5);
    expect(VANILLA_MENU_MOUSEWAIT_TICS).toBe(5);
  });

  test('mouse vertical threshold is 30 pixels', () => {
    expect(VANILLA_MENU_MOUSE_VERTICAL_THRESHOLD_PIXELS).toBe(30);
  });
});

describe('vanillaMenuInputIsGated', () => {
  test('returns true when waitUntil >= currentTime (input still gated)', () => {
    expect(vanillaMenuInputIsGated({ currentTime: 10, waitUntil: 15 })).toBe(true);
    expect(vanillaMenuInputIsGated({ currentTime: 10, waitUntil: 10 })).toBe(true);
  });

  test('returns false when waitUntil < currentTime (input accepted)', () => {
    expect(vanillaMenuInputIsGated({ currentTime: 16, waitUntil: 15 })).toBe(false);
  });
});

describe('computeVanillaMenuWaitUntil', () => {
  test('returns currentTime + 5', () => {
    expect(computeVanillaMenuWaitUntil(0)).toBe(5);
    expect(computeVanillaMenuWaitUntil(100)).toBe(105);
  });
});

describe('classifyVanillaMouseVerticalDelta', () => {
  test('mouseY < lastY-30 yields down', () => {
    const result = classifyVanillaMouseVerticalDelta({ mouseY: 50, lastY: 100 });
    expect(result.direction).toBe('down');
    expect(result.nextLastY).toBe(70);
  });

  test('mouseY > lastY+30 yields up', () => {
    const result = classifyVanillaMouseVerticalDelta({ mouseY: 150, lastY: 100 });
    expect(result.direction).toBe('up');
    expect(result.nextLastY).toBe(130);
  });

  test('mouseY within +/-30 of lastY yields none', () => {
    expect(classifyVanillaMouseVerticalDelta({ mouseY: 90, lastY: 100 }).direction).toBe('none');
    expect(classifyVanillaMouseVerticalDelta({ mouseY: 110, lastY: 100 }).direction).toBe('none');
    expect(classifyVanillaMouseVerticalDelta({ mouseY: 100, lastY: 100 }).direction).toBe('none');
  });

  test('exactly lastY+30 stays "none" (strict greater-than)', () => {
    expect(classifyVanillaMouseVerticalDelta({ mouseY: 130, lastY: 100 }).direction).toBe('none');
  });

  test('result is frozen', () => {
    expect(Object.isFrozen(classifyVanillaMouseVerticalDelta({ mouseY: 0, lastY: 0 }))).toBe(true);
  });
});
