/**
 * Per-sector visible-thing collection — Chocolate Doom 2.2.1
 * r_things.c `R_AddSprites`.
 *
 * `R_Subsector` calls `R_AddSprites(frontsector)` for every visited
 * subsector; it selects the sector's diminishing-light row
 * (`spritelights = scalelight[lightnum]`) and projects every mobj in
 * the sector's thing list into the vissprite pool via
 * `R_ProjectSprite` (the committed bit-exact {@link projectSprite}).
 * The `sec->validcount == validcount` guard makes each sector
 * contribute its things at most once per frame (a sector spans
 * multiple subsectors).
 *
 * Verbatim r_things.c:
 *
 *   void R_AddSprites (sector_t* sec) {
 *       if (sec->validcount == validcount) return;
 *       sec->validcount = validcount;
 *       lightnum = (sec->lightlevel >> LIGHTSEGSHIFT) + extralight;
 *       if (lightnum < 0)            spritelights = scalelight[0];
 *       else if (lightnum>=LIGHTLEVELS) spritelights = scalelight[LIGHTLEVELS-1];
 *       else                          spritelights = scalelight[lightnum];
 *       for (thing=sec->thinglist; thing; thing=thing->snext)
 *           R_ProjectSprite (thing);
 *   }
 *
 * The `(lightlevel >> LIGHTSEGSHIFT) + extralight` clamp to
 * `[0, LIGHTLEVELS-1]` is the existing bit-exact
 * {@link computeVanillaWallLightLevel} with the no-adjustment
 * `'diagonal'` orientation (sprites, like planes, take no
 * horizontal/vertical light tweak). The per-frame `validcount`
 * sector guard is modelled as a caller-owned visited-sector set.
 *
 * Pure; no Win32 or runtime dependencies. The mobj→vissprite math is
 * the committed verbatim {@link projectSprite}.
 */

import { computeVanillaWallLightLevel } from './implement-light-level-and-colormap-selection.ts';
import { projectSprite } from './spriteProjection.ts';
import type { ProjectableThing, SpriteProjectionContext, VisSpritePool } from './spriteProjection.ts';

/** Frame-static sprite projection inputs (everything except the per-sector `spriteLights`). */
export type AddSpritesProjection = Omit<SpriteProjectionContext, 'spriteLights'>;

/** Optional DI hook (defaults to the committed bit-exact R_ProjectSprite). */
export interface AddSpritesHooks {
  readonly projectSpriteFn?: typeof projectSprite;
}

/**
 * r_things.c `R_AddSprites` — collect one sector's things into the
 * vissprite pool (once per frame, via the `addedSectors` validcount
 * model), selecting `scalelight[lightnum]` for that sector.
 *
 * @param sectorIndex - The sector's index (the `validcount` key).
 * @param sectorLightLevel - `sec->lightlevel`.
 * @param things - The sector's thing list (`sec->thinglist`, in `snext` order).
 * @param scalelightRows - `scalelight[LIGHTLEVELS][MAXLIGHTSCALE]` (the I1 rows).
 * @param extralight - `extralight` global.
 * @param projection - Frame-static {@link SpriteProjectionContext} minus `spriteLights`.
 * @param pool - The caller-owned vissprite pool (vanilla `vissprites`).
 * @param addedSectors - Per-frame visited-sector set (vanilla `sec->validcount`).
 *
 * @example
 * ```ts
 * for (const ss of visitedSubsectors)
 *   addSprites(sectorOf(ss), sectorLight(ss), thingsOf(sectorOf(ss)), scalelightRows, extralight, projection, pool, addedSectors);
 * ```
 */
export function addSprites(
  sectorIndex: number,
  sectorLightLevel: number,
  things: Iterable<ProjectableThing>,
  scalelightRows: readonly (readonly Uint8Array[])[],
  extralight: number,
  projection: AddSpritesProjection,
  pool: VisSpritePool,
  addedSectors: Set<number>,
  hooks: AddSpritesHooks = {},
): void {
  // sec->validcount == validcount → contribute at most once per frame.
  if (addedSectors.has(sectorIndex)) {
    return;
  }
  addedSectors.add(sectorIndex);

  // lightnum = (sec->lightlevel >> LIGHTSEGSHIFT) + extralight, clamped
  // [0, LIGHTLEVELS-1] (no orientation tweak for sprites — 'diagonal').
  const lightnum = computeVanillaWallLightLevel({ sectorLightLevel, extralight, wallOrientation: 'diagonal' });
  const spriteLights = scalelightRows[lightnum];
  if (spriteLights === undefined) {
    throw new RangeError(`addSprites: scalelight row ${lightnum} outside 0..${scalelightRows.length - 1}`);
  }

  const project = hooks.projectSpriteFn ?? projectSprite;
  const ctx: SpriteProjectionContext = { ...projection, spriteLights };
  for (const thing of things) {
    project(thing, ctx, pool);
  }
}
