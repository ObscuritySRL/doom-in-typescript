/**
 * Ammo and weapon ownership (p_inter.c, p_pspr.c).
 *
 * Implements P_GiveAmmo (ammo pickup with skill doubling and auto-switch),
 * P_GiveWeapon (weapon pickup with netgame/deathmatch handling),
 * P_CheckAmmo (out-of-ammo weapon preference cascade), and backpack
 * logic from P_TouchSpecialThing SPR_BPAK case.
 *
 * All constants and behavior match Chocolate Doom 2.2.1 exactly.
 *
 * @example
 * ```ts
 * import { giveAmmo, checkAmmo } from "../src/player/weapons.ts";
 * const picked = giveAmmo(player, AmmoType.CLIP, 1, 2);
 * const hasAmmo = checkAmmo(player, "shareware");
 * ```
 */

import type { GameMode } from '../bootstrap/gameMode.ts';

import type { Player } from './playerSpawn.ts';
import { AM_NOAMMO, AmmoType, NUMAMMO, PsprNum, WEAPON_INFO, WeaponType, WP_NOCHANGE, setPsprite } from './playerSpawn.ts';

// ── Constants ────────────────────────────────────────────────────────

/**
 * clipammo[] from p_inter.c: base ammo per clip for each ammo type.
 *
 * Indexed by AmmoType. P_GiveAmmo multiplies `num` by this value;
 * `num=0` gives half a clip.
 */
export const CLIP_AMMO: readonly number[] = Object.freeze([10, 4, 20, 1]);

/**
 * deh_bfg_cells_per_shot default (DEH_DEFAULT_BFG_CELLS_PER_SHOT from deh_misc.h).
 *
 * P_CheckAmmo uses this as the minimum ammo count for the BFG.
 */
export const BFG_CELLS_PER_SHOT = 40;

/** Bonus count increment on weapon pickup (BONUSADD from p_inter.c). */
export const BONUSADD = 6;

/** Skill level: "I'm too young to die" (sk_baby from doomdef.h). */
export const SK_BABY = 0;

/** Skill level: Nightmare (sk_nightmare from doomdef.h). */
export const SK_NIGHTMARE = 4;

// ── P_GiveAmmo ───────────────────────────────────────────────────────

/**
 * P_GiveAmmo: give ammo to a player.
 *
 * `num` is the number of clip loads (not individual rounds). `num=0`
 * gives half a clip (used for dropped ammo clips). Baby and Nightmare
 * skill levels double the amount.
 *
 * When the player goes from zero ammo to non-zero, an automatic weapon
 * switch is triggered based on the ammo type and currently held weapon,
 * matching the vanilla Doom preference table in p_inter.c.
 *
 * Parity-critical: the `am_misl` case falls through to `default: break`
 * in the original C code (missing break). This is harmless since default
 * only contains `break`, but the behavior is preserved exactly.
 *
 * @param player - The player receiving ammo.
 * @param ammo - Ammo type index (AmmoType value or AM_NOAMMO).
 * @param num - Number of clip loads (0 = half clip).
 * @param gameskill - Current game skill level (0–4).
 * @returns Whether the ammo was picked up (false if already at max or am_noammo).
 */
export function giveAmmo(player: Player, ammo: number, num: number, gameskill: number): boolean {
  if (ammo === AM_NOAMMO) {
    return false;
  }

  if (player.ammo[ammo]! === player.maxammo[ammo]!) {
    return false;
  }

  let amount = num;
  if (amount) {
    amount *= CLIP_AMMO[ammo]!;
  } else {
    amount = (CLIP_AMMO[ammo]! / 2) | 0;
  }

  if (gameskill === SK_BABY || gameskill === SK_NIGHTMARE) {
    amount <<= 1;
  }

  const oldammo = player.ammo[ammo]!;
  player.ammo[ammo] = (player.ammo[ammo]! + amount) | 0;

  if (player.ammo[ammo]! > player.maxammo[ammo]!) {
    player.ammo[ammo] = player.maxammo[ammo]!;
  }

  // If non-zero ammo before pickup, don't auto-switch —
  // player was lower on purpose.
  if (oldammo) {
    return true;
  }

  // We were at zero: select a new weapon based on ammo type.
  switch (ammo) {
    case AmmoType.CLIP:
      if (player.readyweapon === WeaponType.FIST) {
        if (player.weaponowned[WeaponType.CHAINGUN]) {
          player.pendingweapon = WeaponType.CHAINGUN;
        } else {
          player.pendingweapon = WeaponType.PISTOL;
        }
      }
      break;

    case AmmoType.SHELL:
      if (player.readyweapon === WeaponType.FIST || player.readyweapon === WeaponType.PISTOL) {
        if (player.weaponowned[WeaponType.SHOTGUN]) {
          player.pendingweapon = WeaponType.SHOTGUN;
        }
      }
      break;

    case AmmoType.CELL:
      if (player.readyweapon === WeaponType.FIST || player.readyweapon === WeaponType.PISTOL) {
        if (player.weaponowned[WeaponType.PLASMA]) {
          player.pendingweapon = WeaponType.PLASMA;
        }
      }
      break;

    case AmmoType.MISL:
      if (player.readyweapon === WeaponType.FIST) {
        if (player.weaponowned[WeaponType.MISSILE]) {
          player.pendingweapon = WeaponType.MISSILE;
        }
      }
      // Vanilla fallthrough to default: break — harmless but preserved.
      break;

    default:
      break;
  }

  return true;
}

// ── P_GiveWeapon ─────────────────────────────────────────────────────

/**
 * P_GiveWeapon: give a weapon to a player.
 *
 * In netgame (non-deathmatch-2, non-dropped): weapon stays on map,
 * already-owned returns false, gives 5 clips in deathmatch / 2 in co-op,
 * always sets pendingweapon, plays sfx_wpnup for console player, returns false.
 *
 * In single-player or deathmatch-2 or dropped: gives 1 clip (dropped) or
 * 2 clips (placed), sets pendingweapon only if weapon is new, returns true
 * if either the weapon or ammo was actually given.
 *
 * @param player - The player receiving the weapon.
 * @param weapon - WeaponType index.
 * @param dropped - Whether the weapon was dropped by a monster (half ammo).
 * @param netgame - Whether this is a network game.
 * @param deathmatch - Deathmatch mode (0=co-op, 1=deathmatch, 2=altdeath).
 * @param isConsolePlayer - Whether this player is the local console player.
 * @param gameskill - Current game skill level (0–4).
 * @param weaponSoundCallback - Optional callback to play sfx_wpnup.
 * @returns Whether the pickup should be consumed (false = leave on map).
 */
export function giveWeapon(player: Player, weapon: number, dropped: boolean, netgame: boolean, deathmatch: number, isConsolePlayer: boolean, gameskill: number, weaponSoundCallback?: () => void): boolean {
  if (netgame && deathmatch !== 2 && !dropped) {
    // Leave placed weapons on map in co-op/deathmatch-1.
    if (player.weaponowned[weapon]) {
      return false;
    }

    player.bonuscount += BONUSADD;
    player.weaponowned[weapon] = true;

    if (deathmatch) {
      giveAmmo(player, WEAPON_INFO[weapon]!.ammo, 5, gameskill);
    } else {
      giveAmmo(player, WEAPON_INFO[weapon]!.ammo, 2, gameskill);
    }

    player.pendingweapon = weapon;

    if (isConsolePlayer && weaponSoundCallback) {
      weaponSoundCallback();
    }

    return false;
  }

  let gaveammo: boolean;
  if (WEAPON_INFO[weapon]!.ammo !== AM_NOAMMO) {
    if (dropped) {
      gaveammo = giveAmmo(player, WEAPON_INFO[weapon]!.ammo, 1, gameskill);
    } else {
      gaveammo = giveAmmo(player, WEAPON_INFO[weapon]!.ammo, 2, gameskill);
    }
  } else {
    gaveammo = false;
  }

  let gaveweapon: boolean;
  if (player.weaponowned[weapon]) {
    gaveweapon = false;
  } else {
    gaveweapon = true;
    player.weaponowned[weapon] = true;
    player.pendingweapon = weapon;
  }

  return gaveweapon || gaveammo;
}

// ── P_CheckAmmo ──────────────────────────────────────────────────────

/**
 * P_CheckAmmo: check if the player has enough ammo to fire.
 *
 * Returns true if there is enough ammo (or the weapon needs no ammo).
 * If not, selects the best available weapon via a fixed preference
 * cascade and lowers the current weapon.
 *
 * Preference order: plasma → super shotgun → chaingun → shotgun →
 * pistol → chainsaw → rocket launcher → BFG → fist.
 *
 * Parity-critical: the `do...while` loop always terminates after one
 * iteration because every code path sets `pendingweapon` to something
 * other than `WP_NOCHANGE`. The loop is preserved for structural parity.
 *
 * Parity-critical: super shotgun check uses `> 2` (not `>= 2`),
 * meaning it requires 3+ shells. BFG check uses `> 40` (not `>= 40`),
 * meaning it requires 41+ cells. This matches the original C code.
 *
 * @param player - The player to check.
 * @param gamemode - Current game mode (affects shareware/commercial checks).
 * @returns Whether the player has enough ammo to keep firing.
 */
export function checkAmmo(player: Player, gamemode: GameMode): boolean {
  const ammo = WEAPON_INFO[player.readyweapon]!.ammo;

  // Minimal amount for one shot varies by weapon.
  let count: number;
  if (player.readyweapon === WeaponType.BFG) {
    count = BFG_CELLS_PER_SHOT;
  } else if (player.readyweapon === WeaponType.SUPERSHOTGUN) {
    count = 2;
  } else {
    count = 1;
  }

  // Some weapons do not need ammunition.
  if (ammo === AM_NOAMMO || player.ammo[ammo]! >= count) {
    return true;
  }

  // Out of ammo — weapon preference cascade.
  do {
    if (player.weaponowned[WeaponType.PLASMA] && player.ammo[AmmoType.CELL]! && gamemode !== 'shareware') {
      player.pendingweapon = WeaponType.PLASMA;
    } else if (player.weaponowned[WeaponType.SUPERSHOTGUN] && player.ammo[AmmoType.SHELL]! > 2 && gamemode === 'commercial') {
      player.pendingweapon = WeaponType.SUPERSHOTGUN;
    } else if (player.weaponowned[WeaponType.CHAINGUN] && player.ammo[AmmoType.CLIP]!) {
      player.pendingweapon = WeaponType.CHAINGUN;
    } else if (player.weaponowned[WeaponType.SHOTGUN] && player.ammo[AmmoType.SHELL]!) {
      player.pendingweapon = WeaponType.SHOTGUN;
    } else if (player.ammo[AmmoType.CLIP]!) {
      player.pendingweapon = WeaponType.PISTOL;
    } else if (player.weaponowned[WeaponType.CHAINSAW]) {
      player.pendingweapon = WeaponType.CHAINSAW;
    } else if (player.weaponowned[WeaponType.MISSILE] && player.ammo[AmmoType.MISL]!) {
      player.pendingweapon = WeaponType.MISSILE;
    } else if (player.weaponowned[WeaponType.BFG] && player.ammo[AmmoType.CELL]! > BFG_CELLS_PER_SHOT && gamemode !== 'shareware') {
      player.pendingweapon = WeaponType.BFG;
    } else {
      player.pendingweapon = WeaponType.FIST;
    }
  } while (player.pendingweapon === WP_NOCHANGE);

  // Lower the current weapon.
  setPsprite(player, PsprNum.WEAPON, WEAPON_INFO[player.readyweapon]!.downstate);

  return false;
}

// ── Backpack ─────────────────────────────────────────────────────────

/**
 * Give a backpack to the player (SPR_BPAK case from P_TouchSpecialThing).
 *
 * First pickup doubles all maxammo values and sets the backpack flag.
 * Every pickup gives one clip of each ammo type via P_GiveAmmo.
 *
 * @param player - The player receiving the backpack.
 * @param gameskill - Current game skill level (0–4).
 */
export function giveBackpack(player: Player, gameskill: number): void {
  if (!player.backpack) {
    for (let index = 0; index < NUMAMMO; index++) {
      player.maxammo[index] = (player.maxammo[index]! * 2) | 0;
    }
    player.backpack = true;
  }

  for (let index = 0; index < NUMAMMO; index++) {
    giveAmmo(player, index, 1, gameskill);
  }
}
