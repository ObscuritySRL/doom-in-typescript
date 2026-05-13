/**
 * Vanilla DOOM 1.9 masked-midtexture rendering parity facts.
 *
 * From Chocolate Doom 2.2.1 r_segs.c `R_RenderMaskedSegRange` and
 * r_things.c `R_DrawMaskedColumn`:
 *
 *   void R_RenderMaskedSegRange (drawseg_t* ds, int x1, int x2)
 *   {
 *       ...
 *       for (dc_x = x1 ; dc_x <= x2 ; dc_x++)
 *       {
 *           if (maskedtexturecol[dc_x] != MAXSHORT)
 *           {
 *               if (!fixedcolormap)
 *               {
 *                   index = spryscale >> LIGHTSCALESHIFT;
 *                   if (index >= MAXLIGHTSCALE) index = MAXLIGHTSCALE - 1;
 *                   dc_colormap = walllights[index];
 *               }
 *               sprtopscreen = centeryfrac - FixedMul(dc_texturemid, spryscale);
 *               dc_iscale = 0xffffffffu / (unsigned) spryscale;
 *               col = (column_t*) ((byte*) R_GetColumn(texnum, maskedtexturecol[dc_x]));
 *               R_DrawMaskedColumn (col);
 *               maskedtexturecol[dc_x] = MAXSHORT;
 *           }
 *           spryscale += rw_scalestep;
 *       }
 *   }
 *
 * Parity-critical invariants pinned here:
 *
 *   1. The drawn-flag sentinel is `MAXSHORT = 0x7fff` (32767), the signed
 *      int16 maximum from doomtype.h.  Vanilla writes
 *      `maskedtexturecol[dc_x] = MAXSHORT` after each column's draw so a
 *      second pass (the post-sprite-clip sweep) skips it.
 *   2. The drawn-flag gate uses inequality with MAXSHORT, not `>= 0`.  A
 *      column starting at MAXSHORT short-circuits the entire per-column
 *      block (no light lookup, no iscale divide, no draw).
 *   3. `spryscale += rw_scalestep` runs at the END of the per-column
 *      block, OUTSIDE the `!= MAXSHORT` if.  Skipped columns still
 *      advance scale so the per-column accumulator stays in lockstep
 *      with the seg's geometry.
 *   4. `dc_iscale` is computed as `0xffffffff / (unsigned) spryscale` —
 *      an unsigned 32-bit divide.  When spryscale is 1 this yields
 *      `0xffffffff` which is `-1` after signed int32 reinterpretation,
 *      matching vanilla's overflow-tolerant inverse scale.
 *   5. The colormap selection has two branches:
 *        - `fixedcolormap != NULL` → use the override (INVUL inverse).
 *        - otherwise → index `walllights[spryscale >> LIGHTSCALESHIFT]`
 *          clamped to `[0, MAXLIGHTSCALE - 1]`.  Vanilla clamps only the
 *          upper bound; negative indices read past the start of the
 *          table (undefined in C but never observed in vanilla scenes).
 *   6. `LIGHTSCALESHIFT = 12` and `MAXLIGHTSCALE = 48` from r_main.h.
 *      The 12-bit right shift means a spryscale of `0x10000` (FRACUNIT)
 *      yields index 16; the largest scale that does not saturate is
 *      `(MAXLIGHTSCALE - 1) << LIGHTSCALESHIFT = 47 << 12 = 192512`.
 *   7. Each post in the column is drawn with `dc_texturemid = textureMid
 *      - (post.topDelta << FRACBITS)`.  Vanilla saves
 *      `basetexturemid = dc_texturemid` at entry and restores at exit;
 *      our per-post recomputation is mathematically equivalent and
 *      re-entrant.
 *   8. Per-post screen extents:
 *        - `topscreen = sprtopscreen + spryscale * post.topDelta`
 *        - `bottomscreen = topscreen + spryscale * post.length`
 *        - `yl = (topscreen + FRACUNIT - 1) >> FRACBITS` (ceiling-divide)
 *        - `yh = (bottomscreen - 1) >> FRACBITS` (floor-divide minus one)
 *      The clip order is `yh` against `sprbottomclip[x]` FIRST, then
 *      `yl` against `sprtopclip[x]`.  Reversing changes behavior only
 *      for degenerate clips where `sprtopclip[x] >= sprbottomclip[x]`.
 *   9. Texture column wrap uses `texCol & widthMask` where `widthMask =
 *      (largest power-of-2 ≤ width) - 1`.  Negative `texCol` wraps
 *      correctly under JS int32 bitwise AND (`-1 & 127 === 127`),
 *      matching C's two's-complement semantics.
 *  10. The masked pass runs AFTER solid walls, floors, ceilings, sky,
 *      AND sprite-sort-and-clip.  Drawsegs in front of sprites have
 *      their masked columns rendered FIRST during the sprite pass, then
 *      `maskedtexturecol[x] = MAXSHORT` flags them as drawn; the
 *      remaining-masked post-pass uses the gate from (2) to skip them.
 */

/** Signed int16 maximum used as the per-column drawn-flag sentinel.  Mirrors doomtype.h `MAXSHORT`. */
export const MASKED_MIDTEXTURE_DONE_FLAG = 0x7fff;

/** r_main.h `LIGHTSCALESHIFT`: right-shift applied to `spryscale` to index `walllights[]`. */
export const MASKED_MIDTEXTURE_LIGHTSCALESHIFT = 12;

/** r_main.h `MAXLIGHTSCALE`: upper bound (exclusive) on the light-scale index. */
export const MASKED_MIDTEXTURE_MAXLIGHTSCALE = 48;

/** Numerator of the unsigned 32-bit divide that produces `dc_iscale`. */
export const MASKED_MIDTEXTURE_ISCALE_NUMERATOR = 0xffff_ffff;

/**
 * Compute the per-column light-bucket index from a fixed-point
 * `spryscale`, clamping to `[0, MAXLIGHTSCALE - 1]`.  Vanilla clamps
 * only the upper end; we add a lower clamp to `0` so a negative scale
 * does not read past the start of the table (vanilla UB, never observed
 * in DOOM1.WAD scenes).
 */
export function maskedMidtextureLightBucket(spryscale: number): number {
  let index = spryscale >> MASKED_MIDTEXTURE_LIGHTSCALESHIFT;
  if (index >= MASKED_MIDTEXTURE_MAXLIGHTSCALE) index = MASKED_MIDTEXTURE_MAXLIGHTSCALE - 1;
  if (index < 0) index = 0;
  return index;
}

/**
 * Compute `dc_iscale` from `spryscale` exactly as vanilla:
 * `(unsigned)0xffffffff / (unsigned)spryscale`, then reinterpret as
 * signed int32 via `| 0`.
 *
 * Throws when `spryscale` is `0` (vanilla divides by zero — undefined).
 */
export function maskedMidtextureIscale(spryscale: number): number {
  const denom = spryscale >>> 0;
  if (denom === 0) throw new Error('maskedMidtextureIscale: spryscale was 0 (vanilla divide-by-zero)');
  return ((MASKED_MIDTEXTURE_ISCALE_NUMERATOR >>> 0) / denom) | 0;
}

/**
 * Apply the texture column wrap: `texCol & widthMask`.  Negative
 * `texCol` values produced by negative `rw_offset` wrap correctly under
 * JS int32 bitwise AND, matching C's two's-complement semantics.
 */
export function maskedMidtextureWrapColumn(texCol: number, widthMask: number): number {
  return (texCol & widthMask) | 0;
}

/**
 * Compute the per-post `dc_texturemid` from the seg's base `textureMid`
 * and the post's `topDelta`: `textureMid - (topDelta << FRACBITS)`.
 *
 * `FRACBITS = 16` is hard-coded here because the masked-midtexture
 * algorithm is fixed against vanilla's m_fixed.h definition.
 */
export function maskedMidtexturePostTextureMid(textureMid: number, postTopDelta: number): number {
  return (textureMid - (postTopDelta << 16)) | 0;
}

/**
 * Per-column clip order kind.  Vanilla clips `yh` against
 * `sprbottomclip[x]` BEFORE clipping `yl` against `sprtopclip[x]`.
 */
export const MASKED_MIDTEXTURE_CLIP_ORDER: readonly ['yh-against-sprbottomclip', 'yl-against-sprtopclip'] = Object.freeze(['yh-against-sprbottomclip', 'yl-against-sprtopclip'] as const);

/**
 * Three-phase render order in which masked midtextures participate.
 *   1. Solid walls / planes / skies fill the framebuffer.
 *   2. Sprites are sorted and drawn; per-sprite clipVisSprite pulls
 *      forward any masked columns that overlap, marking them done.
 *   3. The remaining-masked post-pass sweeps drawsegs and renders any
 *      column whose flag is not MASKED_MIDTEXTURE_DONE_FLAG.
 */
export const MASKED_MIDTEXTURE_RENDER_PHASE: 'after-solid-walls-after-sprites' = 'after-solid-walls-after-sprites';
