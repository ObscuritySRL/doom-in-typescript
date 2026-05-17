/**
 * Vissprite column iteration — Chocolate Doom 2.2.1 r_things.c
 * `R_DrawVisSprite`.
 *
 * Both the player weapon (I7 {@link computePSpriteVis}) and world
 * sprites/masked midtextures funnel through `R_DrawVisSprite`, which
 * sets the per-vissprite draw state (`dc_iscale` /`dc_texturemid` /
 * `spryscale` / `sprtopscreen`, the `colfunc` select), then walks
 * `dc_x = vis->x1 .. vis->x2` stepping `frac += vis->xiscale` and
 * blits each `frac >> FRACBITS` patch column via
 * `R_DrawMaskedColumn`.
 *
 * This module is the pure iteration/state half: it returns the
 * per-column {@link VisSpriteColumnPlan} (the exact `dc_*` state +
 * the `(dc_x, textureColumn)` sequence in vanilla order) that the
 * masked-column rasterizer (the `maskedTextures` domain) consumes.
 * The framebuffer post-blit and the composition into the assembled
 * per-frame flow are a later increment — kept separate so this stays
 * bounded, pure, and independent-oracle testable and touches no other
 * renderer module.
 *
 * Verbatim contract (r_things.c `R_DrawVisSprite`):
 *
 *   patch = W_CacheLumpNum(vis->patch+firstspritelump, PU_CACHE);
 *   dc_colormap = vis->colormap;
 *   if (!dc_colormap) colfunc = fuzzcolfunc;            // shadow
 *   else if (vis->mobjflags & MF_TRANSLATION) colfunc = transcolfunc;
 *   dc_iscale     = abs(vis->xiscale) >> detailshift;
 *   dc_texturemid = vis->texturemid;
 *   frac          = vis->startfrac;
 *   spryscale     = vis->scale;
 *   sprtopscreen  = centeryfrac - FixedMul(dc_texturemid, spryscale);
 *   for (dc_x=vis->x1 ; dc_x<=vis->x2 ; dc_x++, frac += vis->xiscale) {
 *     texturecolumn = frac >> FRACBITS;
 *     if (texturecolumn < 0 || texturecolumn >= SHORT(patch->width))
 *       I_Error("R_DrawSpriteRange: bad texturecolumn");   // RANGECHECK
 *     column = patch + columnofs[texturecolumn];
 *     R_DrawMaskedColumn(column);
 *   }
 *   colfunc = basecolfunc;
 *
 * Parity notes:
 *   - `dc_iscale = abs(vis->xiscale) >> detailshift` — arithmetic
 *     shift of the absolute inverse-scale (psprites pass
 *     `±pspriteiscale`).
 *   - `MF_TRANSLATION` (player-color remap) never applies to
 *     psprites or to E1M1-spawn world things, so only the
 *     `fuzz`/`base` colfunc split is exercised; the discriminant is
 *     preserved for completeness.
 *
 * Pure: arithmetic only, no Win32 / framebuffer / WAD I/O.
 */

import { FRACBITS, type Fixed, fixedMul } from '../core/fixed.ts';

import type { PSpriteColormap } from './drawPsprite.ts';

/** Which `colfunc` `R_DrawVisSprite` selects (`fuzz` = NULL-colormap shadow). */
export type VisSpriteColfunc = 'fuzz' | 'translation' | 'base';

/** The `vissprite_t` fields `R_DrawVisSprite` reads. */
export interface VisSpriteColumnInput {
  readonly x1: number;
  readonly x2: number;
  readonly texturemid: Fixed;
  readonly scale: Fixed;
  readonly xiscale: Fixed;
  readonly startfrac: Fixed;
  /** `SHORT(patch->width)` — the sprite patch pixel width (RANGECHECK bound). */
  readonly patchWidth: number;
  /** `vis->colormap` discriminant from I7 ({@link PSpriteColormap}); `'shadow'` → fuzz colfunc. */
  readonly colormap: PSpriteColormap;
  /** `vis->mobjflags & MF_TRANSLATION` present (player-color remap; never for psprites/E1M1 spawn). */
  readonly hasTranslation?: boolean;
}

/** Viewport inputs `R_DrawVisSprite` reads. */
export interface VisSpriteColumnView {
  /** r_main.c `centeryfrac` (16.16). */
  readonly centerYFrac: Fixed;
  /** 0 (high) / 1 (low) — `dc_iscale = abs(xiscale) >> detailshift`. */
  readonly detailShift: number;
}

/** One `R_DrawMaskedColumn` invocation: screen column + patch texture column. */
export interface VisSpriteColumn {
  /** `dc_x`. */
  readonly dcX: number;
  /** `frac >> FRACBITS` — the patch column index. */
  readonly textureColumn: number;
}

/** The resolved `R_DrawVisSprite` per-vissprite draw plan. */
export interface VisSpriteColumnPlan {
  /** `dc_iscale = abs(vis->xiscale) >> detailshift`. */
  readonly dcIscale: Fixed;
  /** `dc_texturemid = vis->texturemid`. */
  readonly dcTexturemid: Fixed;
  /** `spryscale = vis->scale`. */
  readonly spryscale: Fixed;
  /** `sprtopscreen = centeryfrac - FixedMul(dc_texturemid, spryscale)`. */
  readonly sprtopscreen: Fixed;
  readonly colfunc: VisSpriteColfunc;
  /** `(dc_x, texturecolumn)` for `dc_x = x1..x2`, in vanilla order. */
  readonly columns: readonly VisSpriteColumn[];
}

/** `abs()` on a signed-int32 value (`abs(vis->xiscale)`). */
function absInt32(value: number): number {
  return (value < 0 ? -value : value) | 0;
}

/**
 * r_things.c `R_DrawVisSprite` — resolve the per-vissprite draw state
 * and the ordered `(dc_x, texturecolumn)` column sequence.  Throws
 * (vanilla `RANGECHECK` `I_Error`) when a stepped `texturecolumn`
 * falls outside `[0, patchWidth)`.
 */
export function planVisSpriteColumns(vis: VisSpriteColumnInput, view: VisSpriteColumnView): VisSpriteColumnPlan {
  let colfunc: VisSpriteColfunc;
  if (vis.colormap.kind === 'shadow') {
    colfunc = 'fuzz';
  } else if (vis.hasTranslation === true) {
    colfunc = 'translation';
  } else {
    colfunc = 'base';
  }

  const dcIscale = absInt32(vis.xiscale) >> view.detailShift;
  const dcTexturemid = vis.texturemid;
  const spryscale = vis.scale;
  const sprtopscreen = (view.centerYFrac - fixedMul(dcTexturemid, spryscale)) | 0;

  const columns: VisSpriteColumn[] = [];
  let frac = vis.startfrac | 0;
  for (let dcX = vis.x1; dcX <= vis.x2; dcX += 1) {
    const textureColumn = frac >> FRACBITS;
    if (textureColumn < 0 || textureColumn >= vis.patchWidth) {
      throw new Error(`R_DrawSpriteRange: bad texturecolumn ${textureColumn}`);
    }
    columns.push({ dcX, textureColumn });
    frac = (frac + vis.xiscale) | 0;
  }

  return Object.freeze({ dcIscale, dcTexturemid, spryscale, sprtopscreen, colfunc, columns });
}
