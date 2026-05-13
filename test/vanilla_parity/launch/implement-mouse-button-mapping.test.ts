import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';

import { VANILLA_MOUSE_BUTTON_BINDINGS, VANILLA_MOUSE_BUTTONS_REBINDABLE_AT_RUNTIME, VANILLA_MOUSEB_MAX, VANILLA_MOUSEB_MIN, VANILLA_MOUSEB_UNBOUND, lookupVanillaMouseButton } from '../../../src/bootstrap/implement-mouse-button-mapping.ts';

const CHOCOLATE_CFG_PATH = 'doom/chocolate-doom.cfg';
const DEFAULT_CFG_PATH = 'doom/default.cfg';
const CFG_LINE_PATTERN = /^([a-z][a-z0-9_]*[a-z0-9])\s+(-?\d+)$/;

function loadCfgKey(cfgPath: string, keyName: string): number | undefined {
  const lines = readFileSync(cfgPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = CFG_LINE_PATTERN.exec(line);
    if (match !== null && match[1] === keyName) {
      return Number.parseInt(match[2]!, 10);
    }
  }
  return undefined;
}

describe('vanilla mouse button mapping', () => {
  test('fire is button 0, strafe is button 1, forward is button 2', () => {
    expect(VANILLA_MOUSE_BUTTON_BINDINGS.MOUSEB_FIRE).toBe(0);
    expect(VANILLA_MOUSE_BUTTON_BINDINGS.MOUSEB_STRAFE).toBe(1);
    expect(VANILLA_MOUSE_BUTTON_BINDINGS.MOUSEB_FORWARD).toBe(2);
  });

  test('chocolate-doom.cfg extras and default.cfg fire / strafe / forward agree with the pinned bindings', () => {
    const extras = ['mouseb_strafeleft', 'mouseb_straferight', 'mouseb_use', 'mouseb_backward', 'mouseb_prevweapon', 'mouseb_nextweapon'];
    for (const extra of extras) {
      expect(loadCfgKey(CHOCOLATE_CFG_PATH, extra)).toBe(VANILLA_MOUSEB_UNBOUND);
    }
    expect(loadCfgKey(DEFAULT_CFG_PATH, 'mouseb_fire')).toBe(0);
    expect(loadCfgKey(DEFAULT_CFG_PATH, 'mouseb_strafe')).toBe(1);
    expect(loadCfgKey(DEFAULT_CFG_PATH, 'mouseb_forward')).toBe(2);
  });

  test('mouse buttons are rebindable at runtime', () => {
    expect(VANILLA_MOUSE_BUTTONS_REBINDABLE_AT_RUNTIME).toBe(true);
  });

  test('unbound sentinel is -1', () => {
    expect(VANILLA_MOUSEB_UNBOUND).toBe(-1);
  });

  test('button index range is [0, 4]', () => {
    expect(VANILLA_MOUSEB_MIN).toBe(0);
    expect(VANILLA_MOUSEB_MAX).toBe(4);
  });

  test('lookup returns the canonical binding', () => {
    expect(lookupVanillaMouseButton('MOUSEB_FIRE')).toBe(0);
    expect(lookupVanillaMouseButton('MOUSEB_STRAFE')).toBe(1);
    expect(lookupVanillaMouseButton('MOUSEB_FORWARD')).toBe(2);
    expect(lookupVanillaMouseButton('MOUSEB_USE')).toBe(-1);
  });
});
