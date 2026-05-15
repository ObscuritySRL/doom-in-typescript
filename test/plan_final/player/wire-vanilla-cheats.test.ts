import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VANILLA_CF_GODMODE, VANILLA_CF_NOCLIP, VANILLA_CF_NOMOMENTUM, VANILLA_CHEATS_AFFECT_DEMO_PARITY, VANILLA_CHEAT_FLAG_BITS, isGodMode, isNoMomentum, isNoclip } from '../../../src/vanilla/wireVanillaCheats.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireVanillaCheats.ts');

describe('plan_final player: wire-vanilla-cheats', () => {
  test('src/vanilla/wireVanillaCheats.ts exists, is a regular file, and cites plan_final step 09-009', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('09-009');
    expect(fileText).toContain('VANILLA_CHEAT_FLAG_BITS');
  });

  test('the facade re-exports the cheat flags from the read-only god-mode/powerup module without modifying it', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../player/implement-god-mode-and-powerup-flags.ts'");
  });

  test('the three vanilla cheat flag bits pin the doomdef.h cheat_t values (NOCLIP=1, GODMODE=2, NOMOMENTUM=4)', () => {
    expect(VANILLA_CF_NOCLIP).toBe(1);
    expect(VANILLA_CF_GODMODE).toBe(2);
    expect(VANILLA_CF_NOMOMENTUM).toBe(4);
  });

  test('VANILLA_CHEAT_FLAG_BITS is frozen and contains exactly the three vanilla flags', () => {
    expect(Object.isFrozen(VANILLA_CHEAT_FLAG_BITS)).toBe(true);
    expect(Object.keys(VANILLA_CHEAT_FLAG_BITS).sort()).toEqual(['CF_GODMODE', 'CF_NOCLIP', 'CF_NOMOMENTUM']);
    expect(VANILLA_CHEAT_FLAG_BITS.CF_GODMODE).toBe(VANILLA_CF_GODMODE);
    expect(VANILLA_CHEAT_FLAG_BITS.CF_NOCLIP).toBe(VANILLA_CF_NOCLIP);
    expect(VANILLA_CHEAT_FLAG_BITS.CF_NOMOMENTUM).toBe(VANILLA_CF_NOMOMENTUM);
  });

  test('VANILLA_CHEATS_AFFECT_DEMO_PARITY pins false — a demo carries ticcmds, not keystrokes, so it cannot toggle a cheat', () => {
    expect(VANILLA_CHEATS_AFFECT_DEMO_PARITY).toBe(false);
  });

  test('isGodMode / isNoclip / isNoMomentum decode the cheat bitfield correctly', () => {
    expect(isGodMode(VANILLA_CF_GODMODE)).toBe(true);
    expect(isGodMode(0)).toBe(false);
    expect(isNoclip(VANILLA_CF_NOCLIP)).toBe(true);
    expect(isNoclip(0)).toBe(false);
    expect(isNoMomentum(VANILLA_CF_NOMOMENTUM)).toBe(true);
    expect(isNoMomentum(0)).toBe(false);
    const combined = VANILLA_CF_GODMODE | VANILLA_CF_NOCLIP;
    expect(isGodMode(combined)).toBe(true);
    expect(isNoclip(combined)).toBe(true);
    expect(isNoMomentum(combined)).toBe(false);
  });

  test('the re-exported predicates are the SAME references as the read-only god-mode module exports', async () => {
    const source = await import('../../../src/player/implement-god-mode-and-powerup-flags.ts');
    expect(isGodMode).toBe(source.isGodMode);
    expect(isNoclip).toBe(source.isNoclip);
    expect(isNoMomentum).toBe(source.isNoMomentum);
  });
});
