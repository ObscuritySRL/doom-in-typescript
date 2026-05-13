import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';

import { VANILLA_GAMEPLAY_KEY_SCAN_CODES, VANILLA_GAMEPLAY_KEYS_REBINDABLE_AT_RUNTIME, VANILLA_REREADS_GAMEPLAY_KEYS_ON_LEVEL_START, lookupVanillaGameplayKey } from '../../../src/bootstrap/implement-gameplay-key-mapping-from-config.ts';

const DEFAULT_CFG_PATH = 'doom/default.cfg';
const CFG_LINE_PATTERN = /^([a-z][a-z0-9_]*[a-z0-9])\s+(-?\d+)$/;

function loadDefaultCfgKey(keyName: string): number | undefined {
  const lines = readFileSync(DEFAULT_CFG_PATH, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = CFG_LINE_PATTERN.exec(line);
    if (match !== null && match[1] === keyName) {
      return Number.parseInt(match[2]!, 10);
    }
  }
  return undefined;
}

describe('vanilla gameplay key mapping from default.cfg', () => {
  test('every pinned gameplay key matches the default.cfg value', () => {
    for (const [keyName, expectedValue] of Object.entries(VANILLA_GAMEPLAY_KEY_SCAN_CODES)) {
      const cfgKeyName = keyName.toLowerCase();
      const cfgValue = loadDefaultCfgKey(cfgKeyName);
      expect(cfgValue).toBeDefined();
      expect(cfgValue).toBe(expectedValue);
    }
  });

  test('vanilla does not re-read gameplay keys on level start', () => {
    expect(VANILLA_REREADS_GAMEPLAY_KEYS_ON_LEVEL_START).toBe(false);
  });

  test('vanilla gameplay keys are rebindable at runtime via the menu', () => {
    expect(VANILLA_GAMEPLAY_KEYS_REBINDABLE_AT_RUNTIME).toBe(true);
  });

  test('lookup returns the canonical scan code', () => {
    expect(lookupVanillaGameplayKey('KEY_FIRE')).toBe(29);
    expect(lookupVanillaGameplayKey('KEY_USE')).toBe(57);
    expect(lookupVanillaGameplayKey('KEY_STRAFE')).toBe(56);
    expect(lookupVanillaGameplayKey('KEY_SPEED')).toBe(54);
  });

  test('failure mode: a non-existent gameplay key would not appear in the map', () => {
    const keyNames = Object.keys(VANILLA_GAMEPLAY_KEY_SCAN_CODES);
    expect(keyNames).not.toContain('KEY_BOGUS');
  });
});
