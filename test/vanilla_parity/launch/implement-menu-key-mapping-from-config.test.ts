import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';

import { VANILLA_MENU_KEY_SCAN_CODES, VANILLA_MENU_KEYS_REBINDABLE_AT_RUNTIME, VANILLA_REREADS_MENU_KEYS_ON_OPEN, lookupVanillaMenuKey } from '../../../src/bootstrap/implement-menu-key-mapping-from-config.ts';

const CHOCOLATE_CFG_PATH = 'doom/chocolate-doom.cfg';
const CFG_LINE_PATTERN = /^([a-z][a-z0-9_]*[a-z0-9])\s+(-?\d+)$/;

function loadChocolateCfgKey(keyName: string): number | undefined {
  const lines = readFileSync(CHOCOLATE_CFG_PATH, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = CFG_LINE_PATTERN.exec(line);
    if (match !== null && match[1] === keyName) {
      return Number.parseInt(match[2]!, 10);
    }
  }
  return undefined;
}

describe('vanilla menu key mapping from chocolate-doom.cfg', () => {
  test('every pinned menu key matches the chocolate-doom.cfg default', () => {
    for (const [keyName, expectedValue] of Object.entries(VANILLA_MENU_KEY_SCAN_CODES)) {
      const cfgKeyName = keyName.toLowerCase();
      const cfgValue = loadChocolateCfgKey(cfgKeyName);
      expect(cfgValue).toBeDefined();
      expect(cfgValue).toBe(expectedValue);
    }
  });

  test('vanilla does not re-read menu keys on menu open', () => {
    expect(VANILLA_REREADS_MENU_KEYS_ON_OPEN).toBe(false);
  });

  test('vanilla menu keys are rebindable at runtime', () => {
    expect(VANILLA_MENU_KEYS_REBINDABLE_AT_RUNTIME).toBe(true);
  });

  test('lookup returns the canonical scan code', () => {
    expect(lookupVanillaMenuKey('KEY_MENU_ACTIVATE')).toBe(1);
    expect(lookupVanillaMenuKey('KEY_MENU_FORWARD')).toBe(28);
    expect(lookupVanillaMenuKey('KEY_MENU_BACK')).toBe(14);
    expect(lookupVanillaMenuKey('KEY_MENU_QUIT')).toBe(68);
  });

  test('failure mode: a non-existent menu key would not appear in the map', () => {
    const keyNames = Object.keys(VANILLA_MENU_KEY_SCAN_CODES);
    expect(keyNames).not.toContain('KEY_MENU_BOGUS');
  });
});
