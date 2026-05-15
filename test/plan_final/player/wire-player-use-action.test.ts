import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VANILLA_PLAYER_USE_INVARIANTS, VANILLA_SFX_NOWAY, VANILLA_USERANGE, USERANGE, applyPlayerUseAction, classifyVanillaPlayerUseAction, useLines } from '../../../src/vanilla/wirePlayerUseAction.ts';

import type { PlayerUseInput } from '../../../src/vanilla/wirePlayerUseAction.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wirePlayerUseAction.ts');

describe('plan_final player: wire-player-use-action', () => {
  test('src/vanilla/wirePlayerUseAction.ts exists, is a regular file, and cites plan_final step 09-003', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('09-003');
    expect(fileText).toContain('VANILLA_PLAYER_USE_INVARIANTS');
  });

  test('the facade re-exports only from the two read-only use-action modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]!);
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../player/implement-player-use-action.ts', '../world/useLines.ts']);
  });

  test('VANILLA_PLAYER_USE_INVARIANTS pins the four use-button parity rules and is frozen', () => {
    expect(VANILLA_PLAYER_USE_INVARIANTS.length).toBe(4);
    expect(Object.isFrozen(VANILLA_PLAYER_USE_INVARIANTS)).toBe(true);
    const ids = VANILLA_PLAYER_USE_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['BLOCKING_NON_SPECIAL_WALL_PLAYS_NOWAY', 'USERANGE_PLAYER_AND_WORLD_AGREE', 'USE_BUTTON_IS_EDGE_TRIGGERED_VIA_USEDOWN', 'USE_LINES_FIRES_ONLY_ON_RISING_EDGE']);
    for (const invariant of VANILLA_PLAYER_USE_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('player and world USERANGE agree at 64 * FRACUNIT and the no-way sound id is 20', () => {
    expect(VANILLA_USERANGE).toBe(64 * 0x1_0000);
    expect(USERANGE).toBe(VANILLA_USERANGE);
    expect(VANILLA_SFX_NOWAY).toBe(20);
  });

  test('classifyVanillaPlayerUseAction is edge-triggered through usedown', () => {
    expect(classifyVanillaPlayerUseAction({ buttonHeld: true, previousUsedown: false })).toEqual({ fireUseEvent: true, nextUsedown: true });
    expect(classifyVanillaPlayerUseAction({ buttonHeld: true, previousUsedown: true })).toEqual({ fireUseEvent: false, nextUsedown: true });
    expect(classifyVanillaPlayerUseAction({ buttonHeld: false, previousUsedown: true })).toEqual({ fireUseEvent: false, nextUsedown: false });
    expect(classifyVanillaPlayerUseAction({ buttonHeld: false, previousUsedown: false })).toEqual({ fireUseEvent: false, nextUsedown: false });
  });

  test('applyPlayerUseAction invokes the use action exactly on the rising edge and never otherwise', () => {
    let useActionCallCount = 0;
    const useLinesAction = (): void => {
      useActionCallCount += 1;
    };

    const risingInput: PlayerUseInput = { buttonHeld: true, previousUsedown: false };
    const risingOutcome = applyPlayerUseAction(risingInput, useLinesAction);
    expect(risingOutcome).toEqual({ fireUseEvent: true, nextUsedown: true });
    expect(useActionCallCount).toBe(1);

    expect(applyPlayerUseAction({ buttonHeld: true, previousUsedown: true }, useLinesAction)).toEqual({ fireUseEvent: false, nextUsedown: true });
    expect(applyPlayerUseAction({ buttonHeld: false, previousUsedown: true }, useLinesAction)).toEqual({ fireUseEvent: false, nextUsedown: false });
    expect(useActionCallCount).toBe(1);
  });

  test('the re-exported symbols are the SAME references as the read-only source modules export', async () => {
    const playerSource = await import('../../../src/player/implement-player-use-action.ts');
    const worldSource = await import('../../../src/world/useLines.ts');
    expect(classifyVanillaPlayerUseAction).toBe(playerSource.classifyVanillaPlayerUseAction);
    expect(VANILLA_USERANGE).toBe(playerSource.VANILLA_USERANGE);
    expect(useLines).toBe(worldSource.useLines);
    expect(USERANGE).toBe(worldSource.USERANGE);
  });
});
