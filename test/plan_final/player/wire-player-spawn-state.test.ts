import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  INITIAL_BULLETS,
  INITIAL_HEALTH,
  MAX_AMMO,
  NUMAMMO,
  NUMCARDS,
  NUMPOWERS,
  NUMWEAPONS,
  VANILLA_PLAYER_SPAWN_ENTRY_POINTS,
  bringUpWeapon,
  createPlayer,
  movePsprites,
  playerReborn,
  setPsprite,
  setupPsprites,
} from '../../../src/vanilla/wirePlayerSpawnState.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wirePlayerSpawnState.ts');

describe('plan_final player: wire-player-spawn-state', () => {
  test('src/vanilla/wirePlayerSpawnState.ts exists, is a regular file, and cites plan_final step 09-001', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('09-001');
    expect(fileText).toContain('VANILLA_PLAYER_SPAWN_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only src/player/playerSpawn.ts without modifying it', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../player/playerSpawn.ts'");
  });

  test('VANILLA_PLAYER_SPAWN_ENTRY_POINTS pins the six canonical entry points and is frozen', () => {
    expect(VANILLA_PLAYER_SPAWN_ENTRY_POINTS).toEqual(['bringUpWeapon', 'createPlayer', 'movePsprites', 'playerReborn', 'setPsprite', 'setupPsprites']);
    expect(Object.isFrozen(VANILLA_PLAYER_SPAWN_ENTRY_POINTS)).toBe(true);
  });

  test('inventory-default constants pin the vanilla p_inter.c / g_game.c values', () => {
    expect(INITIAL_HEALTH).toBe(100);
    expect(INITIAL_BULLETS).toBe(50);
    expect(MAX_AMMO).toEqual([200, 50, 300, 50]);
    expect(NUMWEAPONS).toBe(9);
    expect(NUMAMMO).toBe(4);
    expect(NUMCARDS).toBe(6);
    expect(NUMPOWERS).toBe(6);
  });

  test('every wired spawn-state function is re-exported as a callable function', () => {
    expect(typeof createPlayer).toBe('function');
    expect(typeof playerReborn).toBe('function');
    expect(typeof setupPsprites).toBe('function');
    expect(typeof movePsprites).toBe('function');
    expect(typeof bringUpWeapon).toBe('function');
    expect(typeof setPsprite).toBe('function');
  });

  test('createPlayer produces a fresh zero-initialized player; playerReborn sets the vanilla INITIAL_HEALTH', () => {
    const player = createPlayer();
    expect(player.health).toBe(0);
    const secondPlayer = createPlayer();
    expect(player).not.toBe(secondPlayer);
    playerReborn(player);
    expect(player.health).toBe(INITIAL_HEALTH);
  });

  test('the re-exported functions are the SAME references as the read-only playerSpawn module exports', async () => {
    const source = await import('../../../src/player/playerSpawn.ts');
    expect(createPlayer).toBe(source.createPlayer);
    expect(playerReborn).toBe(source.playerReborn);
    expect(setupPsprites).toBe(source.setupPsprites);
    expect(movePsprites).toBe(source.movePsprites);
  });
});
