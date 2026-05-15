import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  VANILLA_BT_ATTACK,
  VANILLA_BT_CHANGE,
  VANILLA_BT_USE,
  VANILLA_BT_WEAPONMASK,
  VANILLA_BT_WEAPONSHIFT,
  VANILLA_PLAYER_TICCMD_ENTRY_POINTS,
  applyUseButtonLatch,
  calcHeight,
  decodeWeaponChangeRequest,
  movePlayer,
  thrust,
} from '../../../src/vanilla/wirePlayerTiccmdApplication.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wirePlayerTiccmdApplication.ts');

describe('plan_final player: wire-player-ticcmd-application', () => {
  test('src/vanilla/wirePlayerTiccmdApplication.ts exists, is a regular file, and cites plan_final step 09-002', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('09-002');
    expect(fileText).toContain('VANILLA_PLAYER_TICCMD_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only movement + ticcmd-application modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../player/movement.ts'");
    expect(fileText).toContain("from '../player/implement-ticcmd-application.ts'");
  });

  test('VANILLA_PLAYER_TICCMD_ENTRY_POINTS pins the five canonical entry points and is frozen', () => {
    expect(VANILLA_PLAYER_TICCMD_ENTRY_POINTS).toEqual(['applyUseButtonLatch', 'calcHeight', 'decodeWeaponChangeRequest', 'movePlayer', 'thrust']);
    expect(Object.isFrozen(VANILLA_PLAYER_TICCMD_ENTRY_POINTS)).toBe(true);
  });

  test('the BT_ button-flag constants pin the vanilla g_game.c values', () => {
    expect(VANILLA_BT_ATTACK).toBe(1);
    expect(VANILLA_BT_USE).toBe(2);
    expect(VANILLA_BT_CHANGE).toBe(4);
    expect(VANILLA_BT_WEAPONMASK).toBe(8 | 16 | 32);
    expect(VANILLA_BT_WEAPONSHIFT).toBe(3);
  });

  test('every wired function is re-exported as a callable function', () => {
    expect(typeof thrust).toBe('function');
    expect(typeof calcHeight).toBe('function');
    expect(typeof movePlayer).toBe('function');
    expect(typeof applyUseButtonLatch).toBe('function');
    expect(typeof decodeWeaponChangeRequest).toBe('function');
  });

  test('decodeWeaponChangeRequest decodes the weapon index from a BT_CHANGE buttons value', () => {
    const buttons = VANILLA_BT_CHANGE | (3 << VANILLA_BT_WEAPONSHIFT);
    expect(decodeWeaponChangeRequest(buttons)).toBe(3);
    expect(decodeWeaponChangeRequest(0)).toBeNull();
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const movementSource = await import('../../../src/player/movement.ts');
    const ticcmdSource = await import('../../../src/player/implement-ticcmd-application.ts');
    expect(thrust).toBe(movementSource.thrust);
    expect(movePlayer).toBe(movementSource.movePlayer);
    expect(decodeWeaponChangeRequest).toBe(ticcmdSource.decodeWeaponChangeRequest);
  });
});
