/**
 * Vanilla DOOM 1.9 P_GiveAmmo contract.
 *
 * From Chocolate Doom 2.2.1 p_inter.c P_GiveAmmo:
 *   clipammo[NUMAMMO] = {10, 4, 20, 1}     // (bullets, shells, cells, rockets) per clip
 *   maxammo[NUMAMMO] = {200, 50, 300, 50}  // base maximum
 *   maxammo doubled with backpack
 *
 *   if (skill == sk_baby || sk_nightmare) num *= 2 (double pickup on baby/nightmare)
 *   ammo += num, clamp to maxammo
 *
 *   When ammo crosses from <= 0 to > 0, P_GiveAmmo triggers weapon switch.
 */

export const AMMO_BULLETS = 0;
export const AMMO_SHELLS = 1;
export const AMMO_CELLS = 2;
export const AMMO_ROCKETS = 3;
export const NUMAMMO = 4;

export const VANILLA_CLIP_AMMO = Object.freeze([10, 4, 20, 1] as const);
export const VANILLA_MAX_AMMO = Object.freeze([200, 50, 300, 50] as const);
export const VANILLA_BACKPACK_MAX_AMMO = Object.freeze([400, 100, 600, 100] as const);

export interface AmmoPickupInput {
  readonly ammoType: number;
  readonly amount: number;
  readonly currentAmount: number;
  readonly hasBackpack: boolean;
  readonly isBabyOrNightmareSkill: boolean;
}

export function getMaxAmmoFor(ammoType: number, hasBackpack: boolean): number {
  if (hasBackpack) {
    return VANILLA_BACKPACK_MAX_AMMO[ammoType] ?? 0;
  }
  return VANILLA_MAX_AMMO[ammoType] ?? 0;
}

export function applyAmmoPickup(input: AmmoPickupInput): { readonly newAmount: number; readonly gave: boolean } {
  const max = getMaxAmmoFor(input.ammoType, input.hasBackpack);
  if (input.currentAmount >= max) {
    return { newAmount: input.currentAmount, gave: false };
  }
  const add = input.isBabyOrNightmareSkill ? input.amount * 2 : input.amount;
  let newAmount = input.currentAmount + add;
  if (newAmount > max) {
    newAmount = max;
  }
  return { newAmount, gave: true };
}
