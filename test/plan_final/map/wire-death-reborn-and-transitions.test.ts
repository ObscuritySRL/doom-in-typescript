import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  NUMAMMO,
  NUMCARDS,
  NUMPOWERS,
  NUMWEAPONS,
  PLAYER_STATE_DEAD,
  PLAYER_STATE_LIVE,
  PLAYER_STATE_REBORN,
  VANILLA_DEAD_VIEWHEIGHT_DROP_FIXED,
  VANILLA_DEAD_VIEWHEIGHT_FIXED,
  VANILLA_DEATHMATCH_RESPAWN_DELAY_TICS,
  VANILLA_DEATH_REBORN_INVARIANTS,
  createPlayer,
  playerReborn,
  stepVanillaDeathThink,
} from '../../../src/vanilla/wireDeathRebornAndTransitions.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireDeathRebornAndTransitions.ts');
const FRACUNIT = 0x1_0000;

describe('plan_final map: wire-death-reborn-and-transitions', () => {
  test('src/vanilla/wireDeathRebornAndTransitions.ts exists, is a regular file, and cites plan_final step 08-009', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('08-009');
    expect(fileText).toContain('VANILLA_DEATH_REBORN_INVARIANTS');
  });

  test('the facade re-exports only from the read-only death-flow + playerSpawn modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../player/implement-death-and-reborn-flow.ts', '../player/playerSpawn.ts']);
  });

  test('VANILLA_DEATH_REBORN_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_DEATH_REBORN_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_DEATH_REBORN_INVARIANTS)).toBe(true);
    const ids = VANILLA_DEATH_REBORN_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['DEAD_VIEWHEIGHT_DROPS_AND_CLAMPS_AT_SIX', 'DEATH_THINK_REBORNS_ONLY_ON_USE', 'PLAYER_REBORN_RESETS_STARTING_LOADOUT', 'PLAYER_STATE_IS_LIVE_DEAD_OR_REBORN', 'VANILLA_DEATHMATCH_RESPAWN_DELAY_IS_TEN']);
    for (const invariant of VANILLA_DEATH_REBORN_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the death/reborn constants match vanilla d_player.h / p_user.c', () => {
    expect(PLAYER_STATE_LIVE).toBe(0);
    expect(PLAYER_STATE_DEAD).toBe(1);
    expect(PLAYER_STATE_REBORN).toBe(2);
    expect(VANILLA_DEAD_VIEWHEIGHT_FIXED).toBe(6 * FRACUNIT);
    expect(VANILLA_DEAD_VIEWHEIGHT_DROP_FIXED).toBe(1 * FRACUNIT);
    expect(VANILLA_DEATHMATCH_RESPAWN_DELAY_TICS).toBe(10);
    expect(NUMWEAPONS).toBe(9);
    expect(NUMAMMO).toBe(4);
    expect(NUMCARDS).toBe(6);
    expect(NUMPOWERS).toBe(6);
  });

  test('stepVanillaDeathThink drops the dead view by one unit, clamps at six, and reborns only on use', () => {
    const dropping = stepVanillaDeathThink({ viewHeightFixed: 41 * FRACUNIT, useButtonPressed: false });
    expect(dropping.viewHeightFixed).toBe(40 * FRACUNIT);
    expect(dropping.transitionsToReborn).toBe(false);

    const clamped = stepVanillaDeathThink({ viewHeightFixed: 3 * FRACUNIT, useButtonPressed: false });
    expect(clamped.viewHeightFixed).toBe(VANILLA_DEAD_VIEWHEIGHT_FIXED);

    const atFloor = stepVanillaDeathThink({ viewHeightFixed: VANILLA_DEAD_VIEWHEIGHT_FIXED, useButtonPressed: true });
    expect(atFloor.viewHeightFixed).toBe(VANILLA_DEAD_VIEWHEIGHT_FIXED);
    expect(atFloor.transitionsToReborn).toBe(true);
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const deathSource = await import('../../../src/player/implement-death-and-reborn-flow.ts');
    const spawnSource = await import('../../../src/player/playerSpawn.ts');
    expect(stepVanillaDeathThink).toBe(deathSource.stepVanillaDeathThink);
    expect(PLAYER_STATE_REBORN).toBe(deathSource.PLAYER_STATE_REBORN);
    expect(playerReborn).toBe(spawnSource.playerReborn);
    expect(NUMWEAPONS).toBe(spawnSource.NUMWEAPONS);
    expect(typeof createPlayer).toBe('function');
  });
});
