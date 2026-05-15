/**
 * Vanilla DOOM 1.9 weapon + psprite-state runtime facade.
 *
 * Plan_final step `09-004` (lane: player-weapons-items) aggregates
 * the weapon ownership/selection functions and the weapon
 * psprite-state-machine action functions the weapon ticker calls
 * every tic into one cohesive re-export barrel.  The read-only
 * `src/player/weapons.ts` and `src/player/weaponStates.ts` modules
 * already implement vanilla `p_inter.c` `P_GiveWeapon`/`P_GiveAmmo`
 * and `p_pspr.c` `A_WeaponReady`/`A_Lower`/`A_Raise`/`A_ReFire`/
 * `A_GunFlash` semantics and are SHA-pinned by the
 * `plan_vanilla_parity` player inventory; this module does NOT
 * modify them.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `giveAmmo` / `giveWeapon` / `giveBackpack` — `p_inter.c`
 *     `P_GiveAmmo` / `P_GiveWeapon` / `P_GiveBackpack`.
 *   - `checkAmmo`            — `p_pspr.c` `P_CheckAmmo` (auto-switch
 *     when the ready weapon runs dry).
 *   - `fireWeapon`           — `p_pspr.c` `P_FireWeapon`.
 *   - `dropWeapon`           — `p_pspr.c` `P_DropWeapon`.
 *   - `aWeaponReady`/`aLower`/`aRaise`/`aReFire`/`aCheckReload`/
 *     `aGunFlash` — the `p_pspr.c` weapon-action state functions.
 *   - `setWeaponStateContext`/`getWeaponStateContext` — the
 *     per-frame context the action functions read.
 *
 * @example
 * ```ts
 * import { fireWeapon, VANILLA_WEAPON_PSPRITE_ENTRY_POINTS } from './wireWeaponPsprites.ts';
 * VANILLA_WEAPON_PSPRITE_ENTRY_POINTS.length; // 11
 * ```
 */

export { checkAmmo, giveAmmo, giveBackpack, giveWeapon } from '../player/weapons.ts';
export { aCheckReload, aGunFlash, aLower, aRaise, aReFire, aWeaponReady, dropWeapon, fireWeapon, getWeaponStateContext, setWeaponStateContext } from '../player/weaponStates.ts';

/**
 * Frozen manifest of the eleven canonical weapon + psprite-state
 * entry-point names this facade wires, in the order the weapon
 * ticker / pickup path invokes them (give ammo/weapon/backpack +
 * check-ammo auto-switch, then the fire/drop transitions and the
 * weapon-action state functions).
 */
export const VANILLA_WEAPON_PSPRITE_ENTRY_POINTS: readonly string[] = Object.freeze(['aCheckReload', 'aGunFlash', 'aLower', 'aRaise', 'aReFire', 'aWeaponReady', 'checkAmmo', 'dropWeapon', 'fireWeapon', 'giveAmmo', 'giveWeapon']);
