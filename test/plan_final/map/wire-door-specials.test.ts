import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLOSE30_TICS,
  RAISE_IN_5MINS_TICS,
  SFX_BDCLS,
  SFX_BDOPN,
  SFX_DORCLS,
  SFX_DOROPN,
  SFX_OOF,
  TICRATE,
  VANILLA_DOOR_SPECIALS_INVARIANTS,
  VDOORWAIT,
  VerticalDoor,
  evDoDoor,
  evDoLockedDoor,
  evVerticalDoor,
  spawnDoorCloseIn30,
  spawnDoorRaiseIn5Mins,
  tVerticalDoor,
} from '../../../src/vanilla/wireDoorSpecials.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireDoorSpecials.ts');

describe('plan_final map-world: wire-door-specials', () => {
  test('src/vanilla/wireDoorSpecials.ts exists, is a regular file, and cites plan_final step 08-005', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('08-005');
    expect(fileText).toContain('VANILLA_DOOR_SPECIALS_INVARIANTS');
  });

  test('the facade re-exports only from the read-only doors module', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../specials/doors.ts']);
  });

  test('the facade does NOT re-export the doors const enums (verbatimModuleSyntax)', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const codeWithoutLeadingDoc = fileText.replace(/^\/\*\*[\s\S]*?\*\//, '');
    expect(codeWithoutLeadingDoc).toContain('export {');
    expect(codeWithoutLeadingDoc).not.toContain('VerticalDoorType');
    expect(codeWithoutLeadingDoc).not.toContain('PlaneMoveResult');
    expect(codeWithoutLeadingDoc).not.toContain('DoorDirection');
  });

  test('VANILLA_DOOR_SPECIALS_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_DOOR_SPECIALS_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_DOOR_SPECIALS_INVARIANTS)).toBe(true);
    const ids = VANILLA_DOOR_SPECIALS_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'BLAZE_DOORS_QUADRUPLE_SPEED_SHARE_VDOORWAIT',
      'CLOSE_CRUSH_DOES_NOT_REVERSE_FOR_PLAIN_AND_BLAZE_CLOSE',
      'EV_DO_DOOR_SKIPS_SECTORS_WITH_ACTIVE_SPECIALDATA',
      'LOCKED_DOOR_KEY_MAP_AND_DENIAL_MESSAGES',
      'TIMED_DOOR_SPAWNS_USE_CLOSE30_AND_RAISE_IN_5MINS',
    ]);
    for (const invariant of VANILLA_DOOR_SPECIALS_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the door timing and sound constants match vanilla p_doors.c', () => {
    expect(TICRATE).toBe(35);
    expect(VDOORWAIT).toBe(150);
    expect(CLOSE30_TICS).toBe(30 * TICRATE);
    expect(RAISE_IN_5MINS_TICS).toBe(5 * 60 * TICRATE);
    expect(SFX_DOROPN).toBe(20);
    expect(SFX_DORCLS).toBe(21);
    expect(SFX_OOF).toBe(34);
    expect(SFX_BDOPN).toBe(86);
    expect(SFX_BDCLS).toBe(87);
  });

  test('the door runtime entry points are re-exported as callable functions / the thinker class', () => {
    expect(typeof evDoDoor).toBe('function');
    expect(typeof evDoLockedDoor).toBe('function');
    expect(typeof evVerticalDoor).toBe('function');
    expect(typeof tVerticalDoor).toBe('function');
    expect(typeof spawnDoorCloseIn30).toBe('function');
    expect(typeof spawnDoorRaiseIn5Mins).toBe('function');
    expect(typeof VerticalDoor).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only doors module', async () => {
    const doorsSource = await import('../../../src/specials/doors.ts');
    expect(evDoDoor).toBe(doorsSource.evDoDoor);
    expect(evVerticalDoor).toBe(doorsSource.evVerticalDoor);
    expect(VerticalDoor).toBe(doorsSource.VerticalDoor);
    expect(VDOORWAIT).toBe(doorsSource.VDOORWAIT);
    expect(SFX_BDOPN).toBe(doorsSource.SFX_BDOPN);
  });
});
