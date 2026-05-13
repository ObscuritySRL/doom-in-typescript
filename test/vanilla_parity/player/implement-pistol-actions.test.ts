import { describe, expect, test } from 'bun:test';

import { VANILLA_PS_FLASH, VANILLA_PS_WEAPON, VANILLA_SFX_PISTOL, applyVanillaPistolFire } from '../../../src/player/implement-pistol-actions.ts';

describe('vanilla A_FirePistol constants', () => {
  test('sfx_pistol enum value is 1 (sounds.h sfxenum_t)', () => {
    expect(VANILLA_SFX_PISTOL).toBe(1);
  });

  test('psprite slot indices: ps_weapon=0, ps_flash=1', () => {
    expect(VANILLA_PS_WEAPON).toBe(0);
    expect(VANILLA_PS_FLASH).toBe(1);
  });
});

describe('applyVanillaPistolFire', () => {
  test('first shot with bullets > 0 consumes one bullet, uses accurate aim', () => {
    const result = applyVanillaPistolFire({ currentBullets: 50, refireCount: 0 });
    expect(result.didFire).toBe(true);
    expect(result.bulletsAfter).toBe(49);
    expect(result.accurateBullet).toBe(true);
    expect(result.soundId).toBe(VANILLA_SFX_PISTOL);
    expect(result.flashPspriteSlot).toBe(VANILLA_PS_FLASH);
  });

  test('held fire (refire>0) uses spread bullet, still consumes one ammo', () => {
    const result = applyVanillaPistolFire({ currentBullets: 50, refireCount: 1 });
    expect(result.didFire).toBe(true);
    expect(result.bulletsAfter).toBe(49);
    expect(result.accurateBullet).toBe(false);
  });

  test('higher refire counts still treat shot as spread', () => {
    const result = applyVanillaPistolFire({ currentBullets: 50, refireCount: 5 });
    expect(result.accurateBullet).toBe(false);
  });

  test('zero bullets blocks fire (no ammo consumption)', () => {
    const result = applyVanillaPistolFire({ currentBullets: 0, refireCount: 0 });
    expect(result.didFire).toBe(false);
    expect(result.bulletsAfter).toBe(0);
  });

  test('exactly one bullet fires once then leaves zero', () => {
    const result = applyVanillaPistolFire({ currentBullets: 1, refireCount: 0 });
    expect(result.didFire).toBe(true);
    expect(result.bulletsAfter).toBe(0);
  });

  test('result object is frozen', () => {
    const result = applyVanillaPistolFire({ currentBullets: 10, refireCount: 0 });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
