/**
 * Vanilla DOOM 1.9 P_GiveBackpack contract.
 *
 * From Chocolate Doom 2.2.1 p_inter.c P_GiveBackpack:
 *   if (!player->backpack) {
 *     for (i = 0; i < NUMAMMO; i++)
 *       player->maxammo[i] *= 2;     // doubles max ammo
 *     player->backpack = true;
 *   }
 *   for (i = 0; i < NUMAMMO; i++)
 *     P_GiveAmmo (player, i, 1);     // grants 1 clip of every ammo type
 *
 * The first pickup doubles maxammo; subsequent pickups still grant +1 clip
 * of each ammo type but maxammo stays at the doubled value.
 *
 * Vanilla maxammo defaults (before backpack): [200, 50, 300, 50]
 * Vanilla maxammo after backpack:             [400, 100, 600, 100]
 */

export const VANILLA_BACKPACK_AMMO_MULTIPLIER = 2;

export const VANILLA_DEFAULT_MAX_AMMO = Object.freeze([200, 50, 300, 50] as const);
export const VANILLA_BACKPACK_MAX_AMMO = Object.freeze([400, 100, 600, 100] as const);

/** P_GiveAmmo amount=1 grants this many of each ammo (clip table from p_pspr.c). */
export const VANILLA_BACKPACK_CLIP_PER_TYPE = Object.freeze([10, 4, 20, 1] as const);

export interface BackpackPickupInput {
  readonly hasBackpack: boolean;
  readonly currentMaxAmmo: readonly [number, number, number, number];
}

export interface BackpackPickupResult {
  readonly hasBackpack: boolean;
  readonly newMaxAmmo: readonly [number, number, number, number];
  readonly clipsGranted: readonly [number, number, number, number];
}

export function applyVanillaBackpackPickup(input: BackpackPickupInput): BackpackPickupResult {
  const newMax: [number, number, number, number] = input.hasBackpack
    ? [input.currentMaxAmmo[0], input.currentMaxAmmo[1], input.currentMaxAmmo[2], input.currentMaxAmmo[3]]
    : [
        input.currentMaxAmmo[0] * VANILLA_BACKPACK_AMMO_MULTIPLIER,
        input.currentMaxAmmo[1] * VANILLA_BACKPACK_AMMO_MULTIPLIER,
        input.currentMaxAmmo[2] * VANILLA_BACKPACK_AMMO_MULTIPLIER,
        input.currentMaxAmmo[3] * VANILLA_BACKPACK_AMMO_MULTIPLIER,
      ];
  return Object.freeze({
    hasBackpack: true,
    newMaxAmmo: Object.freeze(newMax) as readonly [number, number, number, number],
    clipsGranted: VANILLA_BACKPACK_CLIP_PER_TYPE,
  });
}
