/**
 * Vanilla DOOM 1.9 sprite sorting contract.
 *
 * From Chocolate Doom 2.2.1 r_things.c R_SortVisSprites:
 *   - Sprites in vissprites[] array are sorted by scale (xscale) descending,
 *     meaning farther sprites first.
 *   - Sort is a simple iterative insertion sort selecting min-scale on each
 *     pass, swapping into the head of the sorted region.
 *
 * MAXVISSPRITES = 128 (vanilla limit; overflow simply truncates).
 */

export const VANILLA_MAXVISSPRITES = 128;

export interface VisSprite {
  readonly id: number;
  readonly xscale: number;
}

/** Sort sprites by xscale ascending (smallest first = farthest first). */
export function sortVisSpritesAscendingByScale(sprites: readonly VisSprite[]): readonly VisSprite[] {
  return [...sprites].sort((a, b) => a.xscale - b.xscale);
}
