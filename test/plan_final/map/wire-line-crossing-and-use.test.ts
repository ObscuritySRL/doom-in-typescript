import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BUTTONTIME,
  DEFAULT_SPECHIT_MAGIC,
  NON_TRIGGER_PROJECTILE_TYPES,
  USERANGE,
  VANILLA_LINE_CROSSING_USE_INVARIANTS,
  changeSwitchTexture,
  createButtonList,
  pCrossSpecialLine,
  pUseSpecialLine,
  spechitOverrun,
  updateButtons,
} from '../../../src/vanilla/wireLineCrossingAndUse.ts';

import type { LineTriggerCallbacks, LineTriggerLine, LineTriggerThing, SpechitOverrunState, SwitchCallbacks, SwitchLine, SwitchSide } from '../../../src/vanilla/wireLineCrossingAndUse.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireLineCrossingAndUse.ts');

function makeLine(special: number): LineTriggerLine {
  return { special, flags: 0, tag: 0, frontFloorpic: 0, frontSpecial: 0 };
}

function makeTriggerCallbacks(log: string[]): LineTriggerCallbacks {
  const record =
    (name: string, result: number) =>
    (..._args: unknown[]): number => {
      log.push(name);
      return result;
    };
  const recordVoid =
    (name: string) =>
    (..._args: unknown[]): void => {
      log.push(name);
    };
  return {
    evDoDoor: record('evDoDoor', 1),
    evDoLockedDoor: record('evDoLockedDoor', 1),
    evVerticalDoor: recordVoid('evVerticalDoor'),
    evDoPlat: record('evDoPlat', 1),
    evStopPlat: recordVoid('evStopPlat'),
    evDoFloor: record('evDoFloor', 1),
    evDoCeiling: record('evDoCeiling', 1),
    evCeilingCrushStop: record('evCeilingCrushStop', 1),
    evBuildStairs: record('evBuildStairs', 1),
    evDoDonut: record('evDoDonut', 1),
    evTeleport: record('evTeleport', 1),
    evLightTurnOn: recordVoid('evLightTurnOn'),
    evStartLightStrobing: recordVoid('evStartLightStrobing'),
    evTurnTagLightsOff: recordVoid('evTurnTagLightsOff'),
    changeSwitchTexture: recordVoid('changeSwitchTexture'),
    gExitLevel: recordVoid('gExitLevel'),
    gSecretExitLevel: recordVoid('gSecretExitLevel'),
  };
}

const playerThing: LineTriggerThing = { type: NON_TRIGGER_PROJECTILE_TYPES[0]!, player: {} };

describe('plan_final map: wire-line-crossing-and-use', () => {
  test('src/vanilla/wireLineCrossingAndUse.ts exists, is a regular file, and cites plan_final step 08-004', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('08-004');
    expect(fileText).toContain('VANILLA_LINE_CROSSING_USE_INVARIANTS');
  });

  test('the facade re-exports only from the three read-only modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]!);
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../specials/lineTriggers.ts', '../specials/switches.ts', '../world/useLines.ts']);
  });

  test('VANILLA_LINE_CROSSING_USE_INVARIANTS pins the six parity rules and is frozen', () => {
    expect(VANILLA_LINE_CROSSING_USE_INVARIANTS.length).toBe(6);
    expect(Object.isFrozen(VANILLA_LINE_CROSSING_USE_INVARIANTS)).toBe(true);
    const ids = VANILLA_LINE_CROSSING_USE_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'BACK_SIDE_USE_ONLY_UNUSED_SLIDING_DOOR_124',
      'CROSS_ONESHOT_CLEARS_SPECIAL_EXCEPT_EXIT_52_124',
      'CROSS_RETRIGGER_NEVER_CLEARS_SPECIAL',
      'SPECHIT_VANILLA_OVERFLOW_AT_ORIGINAL_8',
      'SWITCH_FLIP_GUARDED_ON_EV_RESULT_EXCEPT_EXIT_AND_LIGHT',
      'USE_LINES_STOPS_AT_FIRST_USABLE_OR_PLAYS_NOWAY',
    ]);
    for (const invariant of VANILLA_LINE_CROSSING_USE_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('a one-shot cross trigger clears line.special after dispatch but the exit trigger 52 does not', () => {
    const log: string[] = [];
    const callbacks = makeTriggerCallbacks(log);

    const oneShot = makeLine(2);
    pCrossSpecialLine(oneShot, 0, playerThing, callbacks);
    expect(log).toContain('evDoDoor');
    expect(oneShot.special).toBe(0);

    const exitLine = makeLine(52);
    pCrossSpecialLine(exitLine, 0, playerThing, callbacks);
    expect(log).toContain('gExitLevel');
    expect(exitLine.special).toBe(52);
  });

  test('a retrigger cross leaves line.special intact so it fires again', () => {
    const log: string[] = [];
    const callbacks = makeTriggerCallbacks(log);
    const retrigger = makeLine(86);
    pCrossSpecialLine(retrigger, 0, playerThing, callbacks);
    pCrossSpecialLine(retrigger, 0, playerThing, callbacks);
    expect(retrigger.special).toBe(86);
    expect(log.filter((entry) => entry === 'evDoDoor').length).toBe(2);
  });

  test('pUseSpecialLine rejects a back-side press unless the special is the UNUSED sliding-door 124', () => {
    const log: string[] = [];
    const callbacks = makeTriggerCallbacks(log);
    expect(pUseSpecialLine(playerThing, makeLine(29), 1, callbacks)).toBe(false);
    expect(log.length).toBe(0);
    expect(pUseSpecialLine(playerThing, makeLine(124), 1, callbacks)).toBe(true);
  });

  test('spechitOverrun reproduces the vanilla overflow into tmbbox at numspechit 9', () => {
    const state: SpechitOverrunState = { tmbbox: [0, 0, 0, 0], crushchange: 0, nofit: 0 };
    spechitOverrun(5, 9, state);
    expect(state.tmbbox[0]).toBe((DEFAULT_SPECHIT_MAGIC + 5 * 0x3e) | 0);
    expect(USERANGE).toBe(64 * 0x1_0000);
  });

  test('changeSwitchTexture flips the matched slot and a held button reverts it after BUTTONTIME', () => {
    const sound: Array<readonly [unknown, number]> = [];
    const switchCallbacks: SwitchCallbacks = {
      startSound: (origin, sfx) => {
        sound.push([origin, sfx]);
      },
    };
    const side: SwitchSide = { toptexture: 10, midtexture: 0, bottomtexture: 0 };
    const switchLine: SwitchLine = { special: 0 };
    const buttons = createButtonList();

    changeSwitchTexture(switchLine, side, true, [10, 11], 1, buttons, switchCallbacks, { sectorId: 7 });
    expect(side.toptexture).toBe(11);
    expect(sound.length).toBe(1);
    expect(buttons.some((slot) => slot.btimer === BUTTONTIME)).toBe(true);

    for (let tic = 0; tic < BUTTONTIME; tic += 1) {
      updateButtons(buttons, switchCallbacks);
    }
    expect(side.toptexture).toBe(10);
    expect(buttons.every((slot) => slot.btimer === 0)).toBe(true);
  });

  test('the re-exported symbols are the SAME references as the read-only source modules export', async () => {
    const lineTriggersSource = await import('../../../src/specials/lineTriggers.ts');
    const switchesSource = await import('../../../src/specials/switches.ts');
    const useLinesSource = await import('../../../src/world/useLines.ts');
    expect(pCrossSpecialLine).toBe(lineTriggersSource.pCrossSpecialLine);
    expect(pUseSpecialLine).toBe(lineTriggersSource.pUseSpecialLine);
    expect(changeSwitchTexture).toBe(switchesSource.changeSwitchTexture);
    expect(spechitOverrun).toBe(useLinesSource.spechitOverrun);
    expect(USERANGE).toBe(useLinesSource.USERANGE);
  });
});
