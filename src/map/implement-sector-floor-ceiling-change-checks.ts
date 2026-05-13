/**
 * Vanilla DOOM 1.9 P_ChangeSector contract.
 *
 * When a sector's floor or ceiling moves (door, lift, crusher), P_ChangeSector
 * calls PIT_ChangeSector for every thing in the sector's affected blockmap
 * cells. The thing is crushed if it cannot fit in the new height; crushers
 * also damage living things by CRUSHDAMAGE every fourth tic.
 */

export const VANILLA_CRUSHER_DAMAGE_PER_HIT = 10;
export const VANILLA_CRUSHER_DAMAGE_TIC_INTERVAL = 4;

export interface SectorChangeInput {
  readonly thingHeight: number;
  readonly thingFloorZ: number;
  readonly thingCeilingZ: number;
  readonly thingIsAlive: boolean;
  readonly crushIsEnabled: boolean;
  readonly currentTic: number;
}

export interface SectorChangeResult {
  readonly fits: boolean;
  readonly damageApplied: number;
}

export function evaluateSectorChange(input: SectorChangeInput): SectorChangeResult {
  const availableHeight = input.thingCeilingZ - input.thingFloorZ;
  const fits = availableHeight >= input.thingHeight;
  if (fits) {
    return Object.freeze({ fits: true, damageApplied: 0 });
  }
  const damageThisTic = input.crushIsEnabled && input.thingIsAlive && input.currentTic % VANILLA_CRUSHER_DAMAGE_TIC_INTERVAL === 0 ? VANILLA_CRUSHER_DAMAGE_PER_HIT : 0;
  return Object.freeze({ fits: false, damageApplied: damageThisTic });
}
