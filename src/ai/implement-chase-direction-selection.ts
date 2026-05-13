/**
 * Vanilla DOOM 1.9 P_NewChaseDir contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c P_NewChaseDir:
 *   Picks the next movement direction (DI_EAST..DI_NORTHWEST, 8 cardinal+45) for
 *   the monster based on the relative position of its target.
 *
 *   Direction enum (dirtype_t):
 *     DI_EAST=0, DI_NORTHEAST=1, DI_NORTH=2, DI_NORTHWEST=3,
 *     DI_WEST=4, DI_SOUTHWEST=5, DI_SOUTH=6, DI_SOUTHEAST=7,
 *     DI_NODIR=8
 *
 *   Movement speed: 8 directions * (info.speed) per tic.
 *   Direction angle = direction << 29 (BAM units).
 *
 *   When stuck, monster tries opposite direction (dir XOR 4) or two perpendicular
 *   directions. Random byte controls which fallback is preferred.
 */

export const DI_EAST = 0;
export const DI_NORTHEAST = 1;
export const DI_NORTH = 2;
export const DI_NORTHWEST = 3;
export const DI_WEST = 4;
export const DI_SOUTHWEST = 5;
export const DI_SOUTH = 6;
export const DI_SOUTHEAST = 7;
export const DI_NODIR = 8;

export const VANILLA_DIRECTION_COUNT = 8;
export const VANILLA_DIRECTION_ANGLE_SHIFT = 29;

export function directionToBamAngle(direction: number): number {
  if (direction === DI_NODIR) {
    return 0;
  }
  return ((direction << VANILLA_DIRECTION_ANGLE_SHIFT) >>> 0) | 0;
}

export function oppositeDirection(direction: number): number {
  if (direction === DI_NODIR) {
    return DI_NODIR;
  }
  return (direction + 4) % VANILLA_DIRECTION_COUNT;
}
