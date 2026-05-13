/**
 * Vanilla DOOM 1.9 P_GiveWeapon contract.
 *
 * From Chocolate Doom 2.2.1 p_inter.c P_GiveWeapon (single-player branch):
 *   if (weaponinfo[weapon].ammo != am_noammo) {
 *     if (dropped) gaveammo = P_GiveAmmo(player, ammo, 1);
 *     else         gaveammo = P_GiveAmmo(player, ammo, 2);
 *   } else gaveammo = false;
 *
 *   if (player->weaponowned[weapon]) gaveweapon = false;
 *   else { gaveweapon = true; weaponowned[weapon]=true; pendingweapon=weapon; }
 *
 *   return (gaveweapon || gaveammo);
 *
 * weaponinfo[].ammo table (p_pspr.c):
 *   fist     -> am_noammo
 *   pistol   -> am_clip
 *   shotgun  -> am_shell
 *   chaingun -> am_clip
 *   missile  -> am_misl
 *   plasma   -> am_cell
 *   bfg      -> am_cell
 *   chainsaw -> am_noammo
 *   ssg      -> am_shell (DOOM 2 only)
 */

export const VANILLA_WP_FIST = 0;
export const VANILLA_WP_PISTOL = 1;
export const VANILLA_WP_SHOTGUN = 2;
export const VANILLA_WP_CHAINGUN = 3;
export const VANILLA_WP_MISSILE = 4;
export const VANILLA_WP_PLASMA = 5;
export const VANILLA_WP_BFG = 6;
export const VANILLA_WP_CHAINSAW = 7;
export const VANILLA_WP_SUPERSHOTGUN = 8;

export const VANILLA_AM_NOAMMO = -1;
export const VANILLA_AM_CLIP = 0;
export const VANILLA_AM_SHELL = 1;
export const VANILLA_AM_CELL = 2;
export const VANILLA_AM_MISL = 3;

export const VANILLA_WEAPON_AMMO_TABLE: readonly number[] = Object.freeze([
  VANILLA_AM_NOAMMO,
  VANILLA_AM_CLIP,
  VANILLA_AM_SHELL,
  VANILLA_AM_CLIP,
  VANILLA_AM_MISL,
  VANILLA_AM_CELL,
  VANILLA_AM_CELL,
  VANILLA_AM_NOAMMO,
  VANILLA_AM_SHELL,
] as const);

export const VANILLA_DROPPED_WEAPON_CLIPS = 1;
export const VANILLA_NORMAL_WEAPON_CLIPS = 2;

export interface WeaponPickupInput {
  readonly weaponType: number;
  readonly currentlyOwned: boolean;
  readonly dropped: boolean;
}

export interface WeaponPickupResult {
  readonly ownsWeapon: boolean;
  readonly pendingWeapon: number | null;
  readonly clipsToGive: number;
  readonly ammoType: number;
  readonly gaveWeapon: boolean;
}

export function applyVanillaWeaponPickup(input: WeaponPickupInput): WeaponPickupResult {
  const ammoType = VANILLA_WEAPON_AMMO_TABLE[input.weaponType] ?? VANILLA_AM_NOAMMO;
  const clips = input.dropped ? VANILLA_DROPPED_WEAPON_CLIPS : VANILLA_NORMAL_WEAPON_CLIPS;
  const gaveWeapon = !input.currentlyOwned;
  return {
    ownsWeapon: true,
    pendingWeapon: gaveWeapon ? input.weaponType : null,
    clipsToGive: ammoType === VANILLA_AM_NOAMMO ? 0 : clips,
    ammoType,
    gaveWeapon,
  };
}
