/**
 * Vanilla DOOM 1.9 weapon ownership and selection contract.
 *
 * From Chocolate Doom 2.2.1 p_user.c P_PlayerThink and p_pspr.c P_DropWeapon:
 *   Number keys 1..7 (BT_CHANGE | weapon_index<<BT_WEAPONSHIFT) request a
 *   weapon switch. P_DropWeapon transitions to lower state, then BringUpWeapon
 *   raises the pending weapon when the lower state finishes.
 *
 * Weapon-change validation in P_PlayerThink:
 *   - Must own the requested weapon (player->weaponowned[w]).
 *   - Must have enough ammo (player->ammo[weaponinfo[w].ammo] >= 1).
 *   - Specifically: SSG requires shells, BFG/PLASMA require cells, ROCKET
 *     requires missiles, SHOTGUN/CHAINGUN/PISTOL require clip.
 *
 * Weapon preference order in P_DropWeapon (highest-priority owned weapon
 * with ammo): plasma > chaingun > shotgun > pistol > chainsaw > fist.
 *
 * From d_items.c weaponinfo[]:
 *   pistol/chaingun: am_clip       shotgun: am_shell
 *   plasma/bfg:      am_cell       missile: am_misl
 *   fist/chainsaw:   am_noammo (always usable)
 *   ssg (DOOM 2):    am_shell
 */

import {
  VANILLA_AM_CELL,
  VANILLA_AM_CLIP,
  VANILLA_AM_MISL,
  VANILLA_AM_NOAMMO,
  VANILLA_AM_SHELL,
  VANILLA_WP_BFG,
  VANILLA_WP_CHAINGUN,
  VANILLA_WP_CHAINSAW,
  VANILLA_WP_FIST,
  VANILLA_WP_MISSILE,
  VANILLA_WP_PISTOL,
  VANILLA_WP_PLASMA,
  VANILLA_WP_SHOTGUN,
  VANILLA_WP_SUPERSHOTGUN,
  VANILLA_WEAPON_AMMO_TABLE,
} from './implement-weapon-pickups.ts';

export const VANILLA_WEAPONS_RE_EXPORT = Object.freeze({
  WP_FIST: VANILLA_WP_FIST,
  WP_PISTOL: VANILLA_WP_PISTOL,
  WP_SHOTGUN: VANILLA_WP_SHOTGUN,
  WP_CHAINGUN: VANILLA_WP_CHAINGUN,
  WP_MISSILE: VANILLA_WP_MISSILE,
  WP_PLASMA: VANILLA_WP_PLASMA,
  WP_BFG: VANILLA_WP_BFG,
  WP_CHAINSAW: VANILLA_WP_CHAINSAW,
  WP_SUPERSHOTGUN: VANILLA_WP_SUPERSHOTGUN,
} as const);

/** P_DropWeapon priority order (highest-priority first; vanilla auto-switch). */
export const VANILLA_DROP_WEAPON_PRIORITY = Object.freeze([VANILLA_WP_PLASMA, VANILLA_WP_CHAINGUN, VANILLA_WP_SHOTGUN, VANILLA_WP_PISTOL, VANILLA_WP_CHAINSAW, VANILLA_WP_FIST] as const);

export interface WeaponSelectInput {
  readonly weaponType: number;
  readonly weaponowned: readonly boolean[];
  readonly ammo: readonly [number, number, number, number];
}

export function isWeaponSelectable(input: WeaponSelectInput): boolean {
  if (!input.weaponowned[input.weaponType]) {
    return false;
  }
  const ammoType = VANILLA_WEAPON_AMMO_TABLE[input.weaponType];
  if (ammoType === VANILLA_AM_NOAMMO || ammoType === undefined) {
    return true;
  }
  if (ammoType === VANILLA_AM_CLIP) {
    return input.ammo[0] > 0;
  }
  if (ammoType === VANILLA_AM_SHELL) {
    return input.ammo[1] > 0;
  }
  if (ammoType === VANILLA_AM_CELL) {
    return input.ammo[2] > 0;
  }
  if (ammoType === VANILLA_AM_MISL) {
    return input.ammo[3] > 0;
  }
  return false;
}

export function pickBestAutoSwitchWeapon(input: { readonly weaponowned: readonly boolean[]; readonly ammo: readonly [number, number, number, number] }): number {
  for (const candidate of VANILLA_DROP_WEAPON_PRIORITY) {
    if (isWeaponSelectable({ weaponType: candidate, weaponowned: input.weaponowned, ammo: input.ammo })) {
      return candidate;
    }
  }
  return VANILLA_WP_FIST;
}
