import { describe, expect, test } from 'bun:test';

import {
  VANILLA_ST_AMMO_X,
  VANILLA_ST_AMMO_Y_OFFSETS,
  VANILLA_ST_KEY_PATCH_PREFIX,
  VANILLA_ST_KEY_X,
  VANILLA_ST_KEY_Y_OFFSETS,
  VANILLA_ST_MAXAMMO_X,
  keyPatchIndex,
  keyPatchName,
} from '../../../src/ui/implement-status-bar-key-and-ammo-widgets.ts';

describe('vanilla status bar key column positions', () => {
  test('all three key slots share x=239', () => {
    expect(VANILLA_ST_KEY_X).toBe(239);
  });

  test('key Y offsets: 171, 181, 191 (blue, yellow, red)', () => {
    expect([...VANILLA_ST_KEY_Y_OFFSETS]).toEqual([171, 181, 191]);
  });
});

describe('vanilla status bar ammo column positions', () => {
  test('current-ammo column at x=288, max-ammo column at x=314', () => {
    expect(VANILLA_ST_AMMO_X).toBe(288);
    expect(VANILLA_ST_MAXAMMO_X).toBe(314);
  });

  test('ammo Y offsets: 173, 179, 185, 191 (bullets, shells, rockets, cells)', () => {
    expect([...VANILLA_ST_AMMO_Y_OFFSETS]).toEqual([173, 179, 185, 191]);
  });
});

describe('keyPatchIndex / keyPatchName', () => {
  test('cards map to STKEYS0/1/2 in blue/yellow/red order', () => {
    expect(keyPatchIndex('blue', 'card')).toBe(0);
    expect(keyPatchIndex('yellow', 'card')).toBe(1);
    expect(keyPatchIndex('red', 'card')).toBe(2);
  });

  test('skulls map to STKEYS3/4/5 in blue/yellow/red order', () => {
    expect(keyPatchIndex('blue', 'skull')).toBe(3);
    expect(keyPatchIndex('yellow', 'skull')).toBe(4);
    expect(keyPatchIndex('red', 'skull')).toBe(5);
  });

  test('an empty key slot returns null (no patch drawn)', () => {
    expect(keyPatchIndex('blue', 'none')).toBeNull();
    expect(keyPatchName('blue', 'none')).toBeNull();
  });

  test('keyPatchName composes STKEYS<n>', () => {
    expect(keyPatchName('blue', 'card')).toBe('STKEYS0');
    expect(keyPatchName('red', 'skull')).toBe('STKEYS5');
    expect(VANILLA_ST_KEY_PATCH_PREFIX).toBe('STKEYS');
  });
});
