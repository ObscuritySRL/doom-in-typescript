import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BUTTONTIME,
  EXIT_SWITCH_SPECIAL,
  MONSTER_CROSS_SPECIALS,
  MONSTER_SHOOT_SPECIALS,
  MONSTER_USE_SPECIALS,
  SFX_SWTCHN,
  SFX_SWTCHX,
  VANILLA_SPECIAL_LINE_AI_INVARIANTS,
  changeSwitchTexture,
  pCrossSpecialLine,
  pShootSpecialLine,
  pUseSpecialLine,
  startButton,
  updateButtons,
} from '../../../src/vanilla/wireSpecialLineAiEffects.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireSpecialLineAiEffects.ts');

describe('plan_final ai: wire-special-line-ai-effects', () => {
  test('src/vanilla/wireSpecialLineAiEffects.ts exists, is a regular file, and cites plan_final step 10-007', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('10-007');
    expect(fileText).toContain('VANILLA_SPECIAL_LINE_AI_INVARIANTS');
  });

  test('the facade re-exports only from the read-only lineTriggers + switches modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../specials/lineTriggers.ts', '../specials/switches.ts']);
  });

  test('VANILLA_SPECIAL_LINE_AI_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_SPECIAL_LINE_AI_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_SPECIAL_LINE_AI_INVARIANTS)).toBe(true);
    const ids = VANILLA_SPECIAL_LINE_AI_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'BOSS_EXIT_LINES_52_124_DO_NOT_CLEAR_SPECIAL',
      'MONSTER_CROSS_ELIGIBILITY_IS_A_FIXED_SET',
      'MONSTER_SHOOT_AND_USE_SETS_ARE_FIXED',
      'MONSTER_TELEPORT_125_126_GATE_ON_NONPLAYER',
      'SWITCH_TEXTURE_FLIPS_ON_MONSTER_IMPACT',
    ]);
    for (const invariant of VANILLA_SPECIAL_LINE_AI_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the monster-eligibility special sets are the exact frozen vanilla sets', () => {
    expect([...MONSTER_CROSS_SPECIALS]).toEqual([39, 97, 125, 126, 4, 10, 88]);
    expect([...MONSTER_SHOOT_SPECIALS]).toEqual([46]);
    expect([...MONSTER_USE_SPECIALS]).toEqual([1, 32, 33, 34]);
    expect(Object.isFrozen(MONSTER_CROSS_SPECIALS)).toBe(true);
    expect(Object.isFrozen(MONSTER_SHOOT_SPECIALS)).toBe(true);
    expect(Object.isFrozen(MONSTER_USE_SPECIALS)).toBe(true);
    expect(EXIT_SWITCH_SPECIAL).toBe(11);
    expect(SFX_SWTCHN).toBe(23);
    expect(SFX_SWTCHX).toBe(24);
    expect(BUTTONTIME).toBe(35);
  });

  test('every wired special-line dispatcher and switch primitive is re-exported as a callable function', () => {
    expect(typeof pCrossSpecialLine).toBe('function');
    expect(typeof pShootSpecialLine).toBe('function');
    expect(typeof pUseSpecialLine).toBe('function');
    expect(typeof changeSwitchTexture).toBe('function');
    expect(typeof startButton).toBe('function');
    expect(typeof updateButtons).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const lineTriggersSource = await import('../../../src/specials/lineTriggers.ts');
    const switchesSource = await import('../../../src/specials/switches.ts');
    expect(pCrossSpecialLine).toBe(lineTriggersSource.pCrossSpecialLine);
    expect(MONSTER_CROSS_SPECIALS).toBe(lineTriggersSource.MONSTER_CROSS_SPECIALS);
    expect(changeSwitchTexture).toBe(switchesSource.changeSwitchTexture);
    expect(BUTTONTIME).toBe(switchesSource.BUTTONTIME);
  });
});
