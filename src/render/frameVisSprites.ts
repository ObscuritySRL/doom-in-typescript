/**
 * Per-frame vissprite assembly — Chocolate Doom 2.2.1 r_things.c
 * `R_AddSprites` (the projection half) + `R_SortVisSprites`.
 *
 * Vanilla `R_RenderBSPNode` calls `R_AddSprites(frontsector)` for
 * every visible subsector's sector (guarded by `sec->validcount` so a
 * sector spanning several visible subsectors is projected once); each
 * `R_AddSprites` walks `sector->thinglist` and calls `R_ProjectSprite`
 * on every mobj, filling the frame `vissprites[]` pool. After the BSP
 * walk, `R_DrawMasked` runs `R_SortVisSprites` (back-to-front by
 * ascending `scale`) and then draws each.
 *
 * This module is the pure composition of those two committed pieces:
 * given the visible mobjs already gathered by the BSP walk (in
 * traversal order — the caller owns the per-sector `validcount`
 * dedup and `thinglist` iteration) plus the per-frame projection
 * context, it projects each via {@link projectSprite} into a fresh
 * pool and returns the {@link sortVisSprites} back-to-front order the
 * draw step consumes. `R_ProjectSprite`'s own culls (`tz < MINZ`,
 * off-`tx` rejection) and the `MAXVISSPRITES` pool clamp are handled
 * inside {@link projectSprite} / {@link createVisSpritePool}, so a
 * culled or overflowing thing simply does not appear in the result.
 *
 * The remaining R_DrawMasked work — the drawseg pool the wall pass
 * records, the per-sprite drawseg clip ({@link clipVisSprite}), and
 * the masked-midtexture seg range — is layered on next; this is the
 * bounded, independently-testable projection+sort core.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import { sortVisSprites } from './spriteClip.ts';
import { createVisSpritePool, projectSprite } from './spriteProjection.ts';
import type { ProjectableThing, SpriteProjectionContext, VisSprite } from './spriteProjection.ts';

/**
 * `R_AddSprites` (projection half, over the BSP-walk-collected
 * visible things) + `R_SortVisSprites`. Returns the frame's
 * vissprites sorted back-to-front (index `0` = farthest / smallest
 * `scale`, last = nearest), exactly the order `R_DrawMasked` draws.
 *
 * @param things - The visible mobjs the BSP walk gathered, in
 *   traversal order (the caller owns per-sector `validcount` dedup).
 * @param ctx - The per-frame `R_ProjectSprite` view + sprite-table
 *   context.
 *
 * @example
 * ```ts
 * const backToFront = buildSortedVisSprites(visibleThings, projectionCtx);
 * for (const spr of backToFront) drawAndClipSprite(spr);
 * ```
 */
export function buildSortedVisSprites(things: readonly ProjectableThing[], ctx: SpriteProjectionContext): VisSprite[] {
  const pool = createVisSpritePool();
  for (let index = 0; index < things.length; index += 1) {
    projectSprite(things[index]!, ctx, pool);
  }
  return sortVisSprites(pool);
}
