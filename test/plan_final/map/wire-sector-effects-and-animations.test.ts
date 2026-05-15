import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  DAMAGE_HELLSLIME,
  DAMAGE_NUKAGE,
  DAMAGE_STROBE_SUPER,
  EXIT_DAMAGE_HEALTH_THRESHOLD,
  IRONFEET_BYPASS_THRESHOLD,
  MAXANIMS,
  VANILLA_SECTOR_EFFECT_ENTRY_POINTS,
  initPicAnims,
  playerInSpecialSector,
  updateAnimTranslation,
} from '../../../src/vanilla/wireSectorEffectsAndAnimations.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireSectorEffectsAndAnimations.ts');

describe('plan_final map: wire-sector-effects-and-animations', () => {
  test('src/vanilla/wireSectorEffectsAndAnimations.ts exists, is a regular file, and cites plan_final step 08-007', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('08-007');
    expect(fileText).toContain('VANILLA_SECTOR_EFFECT_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only specials primitives without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../specials/sectorSpecials.ts'");
    expect(fileText).toContain("from '../specials/animations.ts'");
  });

  test('VANILLA_SECTOR_EFFECT_ENTRY_POINTS pins the three canonical entry points and is frozen', () => {
    expect(VANILLA_SECTOR_EFFECT_ENTRY_POINTS).toEqual(['initPicAnims', 'playerInSpecialSector', 'updateAnimTranslation']);
    expect(Object.isFrozen(VANILLA_SECTOR_EFFECT_ENTRY_POINTS)).toBe(true);
  });

  test('the damaging-floor + threshold constants pin vanilla p_spec.c values', () => {
    expect(DAMAGE_NUKAGE).toBe(5);
    expect(DAMAGE_HELLSLIME).toBe(10);
    expect(DAMAGE_STROBE_SUPER).toBe(20);
    expect(IRONFEET_BYPASS_THRESHOLD).toBe(5);
    expect(EXIT_DAMAGE_HEALTH_THRESHOLD).toBe(10);
  });

  test('MAXANIMS pins the vanilla 32-entry animated-texture/flat cap', () => {
    expect(MAXANIMS).toBe(32);
  });

  test('every wired entry point is re-exported as a callable function', () => {
    expect(typeof playerInSpecialSector).toBe('function');
    expect(typeof initPicAnims).toBe('function');
    expect(typeof updateAnimTranslation).toBe('function');
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const sectorSpecialsSource = await import('../../../src/specials/sectorSpecials.ts');
    const animationsSource = await import('../../../src/specials/animations.ts');
    expect(playerInSpecialSector).toBe(sectorSpecialsSource.playerInSpecialSector);
    expect(initPicAnims).toBe(animationsSource.initPicAnims);
    expect(updateAnimTranslation).toBe(animationsSource.updateAnimTranslation);
  });
});
