import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  MONSTER_ATTACK_ACTION_COUNT,
  VANILLA_MONSTER_ATTACK_INVARIANTS,
  aBruisAttack,
  aCPosAttack,
  aCPosRefire,
  aFaceTarget,
  aHeadAttack,
  aPosAttack,
  aSPosAttack,
  aSargAttack,
  aTroopAttack,
  wireMonsterAttackActions,
} from '../../../src/vanilla/wireMonsterAttacks.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireMonsterAttacks.ts');

describe('plan_final ai: wire-monster-attacks', () => {
  test('src/vanilla/wireMonsterAttacks.ts exists, is a regular file, and cites plan_final step 10-004', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('10-004');
    expect(fileText).toContain('VANILLA_MONSTER_ATTACK_INVARIANTS');
  });

  test('the facade re-exports only from the read-only attacks module', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../ai/attacks.ts']);
  });

  test('VANILLA_MONSTER_ATTACK_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_MONSTER_ATTACK_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_MONSTER_ATTACK_INVARIANTS)).toBe(true);
    const ids = VANILLA_MONSTER_ATTACK_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'FACE_TARGET_PRECEDES_EVERY_MONSTER_ATTACK',
      'HITSCAN_ZOMBIES_USE_POS_SPOS_CPOS_ATTACKS',
      'IMP_AND_BARON_HAVE_MELEE_OR_MISSILE_BRANCHES',
      'MONSTER_ATTACK_REGISTRY_HAS_105_ACTIONS',
      'SARG_DEMON_ATTACK_IS_PURE_MELEE_BITE',
    ]);
    for (const invariant of VANILLA_MONSTER_ATTACK_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the monster-attack registry count matches vanilla and the shareware attack codepointers are callable', () => {
    expect(MONSTER_ATTACK_ACTION_COUNT).toBe(105);
    expect(typeof aFaceTarget).toBe('function');
    expect(typeof aPosAttack).toBe('function');
    expect(typeof aSPosAttack).toBe('function');
    expect(typeof aCPosAttack).toBe('function');
    expect(typeof aCPosRefire).toBe('function');
    expect(typeof aTroopAttack).toBe('function');
    expect(typeof aSargAttack).toBe('function');
    expect(typeof aHeadAttack).toBe('function');
    expect(typeof aBruisAttack).toBe('function');
    expect(typeof wireMonsterAttackActions).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only attacks module', async () => {
    const attacksSource = await import('../../../src/ai/attacks.ts');
    expect(aFaceTarget).toBe(attacksSource.aFaceTarget);
    expect(aTroopAttack).toBe(attacksSource.aTroopAttack);
    expect(aBruisAttack).toBe(attacksSource.aBruisAttack);
    expect(MONSTER_ATTACK_ACTION_COUNT).toBe(attacksSource.MONSTER_ATTACK_ACTION_COUNT);
  });
});
