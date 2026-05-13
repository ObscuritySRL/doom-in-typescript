/**
 * Vanilla DOOM 1.9 A_FirePistol contract.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c A_FirePistol:
 *   S_StartSound (player->mo, sfx_pistol);
 *   P_SetMobjState (player->mo, S_PLAY_ATK2);
 *   player->ammo[weaponinfo[player->readyweapon].ammo]--;
 *   P_SetPsprite (player, ps_flash, weaponinfo[wp].flashstate);
 *   P_BulletSlope (player->mo);
 *   P_GunShot (player->mo, !player->refire);
 *
 * Notes for parity:
 *   - sfx_pistol = 1 (sounds.h sfxenum_t).
 *   - Ammo decremented by 1 from the weapon's am_clip slot.
 *   - P_GunShot accuracy gate: first shot (refire=0) uses precise aim; held
 *     fire (refire>0) uses spread bullet.
 *   - The flash psprite slot is ps_flash = 1.
 *   - P_PlayerThink calls A_FirePistol via the psprite state chain; the
 *     S_PISTOL3 atkstate references this action.
 */

export const VANILLA_SFX_PISTOL = 1;
export const VANILLA_PS_WEAPON = 0;
export const VANILLA_PS_FLASH = 1;

export interface PistolFireInput {
  readonly currentBullets: number;
  readonly refireCount: number;
}

export interface PistolFireResult {
  readonly bulletsAfter: number;
  readonly soundId: number;
  readonly flashPspriteSlot: number;
  readonly accurateBullet: boolean;
  readonly didFire: boolean;
}

export function applyVanillaPistolFire(input: PistolFireInput): PistolFireResult {
  if (input.currentBullets <= 0) {
    return Object.freeze({ bulletsAfter: 0, soundId: VANILLA_SFX_PISTOL, flashPspriteSlot: VANILLA_PS_FLASH, accurateBullet: false, didFire: false });
  }
  return Object.freeze({
    bulletsAfter: input.currentBullets - 1,
    soundId: VANILLA_SFX_PISTOL,
    flashPspriteSlot: VANILLA_PS_FLASH,
    accurateBullet: input.refireCount === 0,
    didFire: true,
  });
}
