/**
 * Vanilla DOOM 1.9 berserk, partial invisibility, and radiation suit contract.
 *
 * From Chocolate Doom 2.2.1 p_inter.c P_GivePower:
 *   pw_strength (berserk):
 *     - Heals to 100 health if below 100 (one-shot).
 *     - Sets powers[pw_strength] = 1 (counts UP each tic in P_PlayerThink).
 *     - Permanent until death (no expiry).
 *
 *   pw_invisibility (partial):
 *     - Sets powers[pw_invisibility] = INVISTICS (60 * 35 = 2100 tics).
 *     - Sets mobj->flags |= MF_SHADOW so renderer uses fuzz column.
 *     - Counts DOWN each tic; when it hits 0, removes MF_SHADOW.
 *
 *   pw_ironfeet (radiation suit):
 *     - Sets powers[pw_ironfeet] = IRONTICS (60 * 35 = 2100 tics).
 *     - Negates radiation damage from radioactive sectors.
 *     - Counts DOWN each tic.
 *
 * The CountDown flag bit P_PlayerThink uses to discriminate ticking
 * direction: STRENGTH counts up; others count down to 0.
 */

export const VANILLA_BERSERK_HEALTH = 100;
export const VANILLA_INVISTICS = 60 * 35;
export const VANILLA_IRONTICS = 60 * 35;

export const VANILLA_MF_SHADOW = 0x40000;

export interface PowerPickupInput {
  readonly powerType: 'strength' | 'invisibility' | 'ironfeet';
  readonly currentHealth: number;
}

export interface PowerPickupResult {
  readonly powerTics: number;
  readonly mobjFlagsToOr: number;
  readonly newHealth: number;
  readonly countDirection: 'up' | 'down';
}

export function applyVanillaPowerPickup(input: PowerPickupInput): PowerPickupResult {
  if (input.powerType === 'strength') {
    return Object.freeze({
      powerTics: 1,
      mobjFlagsToOr: 0,
      newHealth: input.currentHealth < VANILLA_BERSERK_HEALTH ? VANILLA_BERSERK_HEALTH : input.currentHealth,
      countDirection: 'up',
    });
  }
  if (input.powerType === 'invisibility') {
    return Object.freeze({
      powerTics: VANILLA_INVISTICS,
      mobjFlagsToOr: VANILLA_MF_SHADOW,
      newHealth: input.currentHealth,
      countDirection: 'down',
    });
  }
  return Object.freeze({
    powerTics: VANILLA_IRONTICS,
    mobjFlagsToOr: 0,
    newHealth: input.currentHealth,
    countDirection: 'down',
  });
}
