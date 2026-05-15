import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { PS_FLASH, PS_WEAPON, VANILLA_NUMPSPRITES, VANILLA_WEAPONBOTTOM_FIXED, VANILLA_WEAPONTOP_FIXED } from '../../../src/render/implement-player-weapon-sprite-rendering.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const PSPRITE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/render/implement-player-weapon-sprite-rendering.ts');
const WEAPON_STATES_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/player/weaponStates.ts');

describe('plan_final render: wire-psprite-renderer', () => {
  test('the read-only player-weapon-sprite + weaponStates source files exist as committed regular files', () => {
    expect(existsSync(PSPRITE_PATH)).toBe(true);
    expect(statSync(PSPRITE_PATH).isFile()).toBe(true);
    expect(existsSync(WEAPON_STATES_PATH)).toBe(true);
    expect(statSync(WEAPON_STATES_PATH).isFile()).toBe(true);
  });

  test('src/render/implement-player-weapon-sprite-rendering.ts cites R_DrawPSprite in its top-of-file comment', () => {
    const fileText = readFileSync(PSPRITE_PATH, 'utf8');
    expect(fileText).toContain('R_DrawPSprite');
    expect(fileText).toContain('Chocolate Doom 2.2.1');
  });

  test('VANILLA_NUMPSPRITES pins the canonical 2-slot psprite array (ps_weapon, ps_flash)', () => {
    expect(VANILLA_NUMPSPRITES).toBe(2);
  });

  test('PS_WEAPON=0 is drawn before PS_FLASH=1 (the canonical psprite slot order)', () => {
    expect(PS_WEAPON).toBe(0);
    expect(PS_FLASH).toBe(1);
    expect(PS_WEAPON).toBeLessThan(PS_FLASH);
  });

  test('VANILLA_WEAPONTOP_FIXED pins 32<<FRACBITS (weapon-up screen Y)', () => {
    expect(VANILLA_WEAPONTOP_FIXED).toBe((32 << 16) | 0);
  });

  test('VANILLA_WEAPONBOTTOM_FIXED pins 128<<FRACBITS (weapon-lowered screen Y)', () => {
    expect(VANILLA_WEAPONBOTTOM_FIXED).toBe((128 << 16) | 0);
  });

  test('the lowered weapon Y is strictly below the raised weapon Y (WEAPONBOTTOM > WEAPONTOP)', () => {
    expect(VANILLA_WEAPONBOTTOM_FIXED).toBeGreaterThan(VANILLA_WEAPONTOP_FIXED);
  });

  test('the psprite slot indices are exactly the integers [0, VANILLA_NUMPSPRITES)', () => {
    const slots = [PS_WEAPON, PS_FLASH].sort((first, second) => first - second);
    expect(slots).toEqual([0, 1]);
    expect(slots.length).toBe(VANILLA_NUMPSPRITES);
  });
});
