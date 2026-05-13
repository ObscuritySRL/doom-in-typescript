/**
 * Vanilla DOOM 1.9 cheat flag bits and powerup constants.
 *
 * From Chocolate Doom 2.2.1 doomdef.h:
 *   typedef enum cheat_t {
 *     CF_NOCLIP    = 1,
 *     CF_GODMODE   = 2,
 *     CF_NOMOMENTUM = 4
 *   };
 *
 * Powerup slots (powerType enum, NUMPOWERS=6):
 *   pw_invulnerability = 0    INVULNTICS = 30 * TICRATE
 *   pw_strength        = 1    (no timer — berserk is permanent until death)
 *   pw_invisibility    = 2    INVISTICS  = 60 * TICRATE
 *   pw_ironfeet        = 3    IRONTICS   = 60 * TICRATE
 *   pw_allmap          = 4    (no timer)
 *   pw_infrared        = 5    INFRATICS  = 120 * TICRATE
 */

export const VANILLA_TICRATE = 35;

export const VANILLA_CF_NOCLIP = 1;
export const VANILLA_CF_GODMODE = 2;
export const VANILLA_CF_NOMOMENTUM = 4;

export const VANILLA_PW_INVULNERABILITY = 0;
export const VANILLA_PW_STRENGTH = 1;
export const VANILLA_PW_INVISIBILITY = 2;
export const VANILLA_PW_IRONFEET = 3;
export const VANILLA_PW_ALLMAP = 4;
export const VANILLA_PW_INFRARED = 5;
export const VANILLA_NUMPOWERS = 6;

export const VANILLA_INVULNTICS = 30 * VANILLA_TICRATE;
export const VANILLA_INVISTICS = 60 * VANILLA_TICRATE;
export const VANILLA_IRONTICS = 60 * VANILLA_TICRATE;
export const VANILLA_INFRATICS = 120 * VANILLA_TICRATE;

export function isGodMode(cheats: number): boolean {
  return (cheats & VANILLA_CF_GODMODE) !== 0;
}

export function isNoclip(cheats: number): boolean {
  return (cheats & VANILLA_CF_NOCLIP) !== 0;
}

export function isNoMomentum(cheats: number): boolean {
  return (cheats & VANILLA_CF_NOMOMENTUM) !== 0;
}

export function powerupInitialDuration(powerType: number): number {
  switch (powerType) {
    case VANILLA_PW_INVULNERABILITY:
      return VANILLA_INVULNTICS;
    case VANILLA_PW_INVISIBILITY:
      return VANILLA_INVISTICS;
    case VANILLA_PW_IRONFEET:
      return VANILLA_IRONTICS;
    case VANILLA_PW_INFRARED:
      return VANILLA_INFRATICS;
    default:
      return 0;
  }
}
