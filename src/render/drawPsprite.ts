/**
 * Player weapon sprite (psprite) placement — Chocolate Doom 2.2.1
 * r_things.c `R_DrawPSprite`.
 *
 * `R_DrawPlayerSprites` runs each of the two player sprites (the
 * weapon `ps_weapon` and its muzzle `ps_flash`) through
 * `R_DrawPSprite`, which resolves the sprite frame (`sprframe->lump[0]`
 * / `flip[0]` — psprites are never rotated), projects the screen
 * placement from `psp->sx`/`psp->sy` using `pspritescale`, builds the
 * one-off `vissprite_t`, picks the colormap (invisibility shadow /
 * fixed colormap / `FF_FULLBRIGHT` full-bright / local light), and
 * hands it to `R_DrawVisSprite`.
 *
 * This module is the pure placement/`vissprite` half: it consumes the
 * I6a {@link SpriteDef}[] catalog + I6b {@link SpriteMetrics}, the
 * viewport, and the light state, and returns the resolved
 * {@link PSpriteVis} (or `null` for the two off-screen rejects).  The
 * `R_DrawVisSprite` masked-column blit and the composition into the
 * assembled per-frame flow (after `R_DrawPlanes`) are a later
 * increment — kept separate so this stays bounded, pure, and
 * independent-oracle testable, and touches no other renderer module.
 *
 * Verbatim contract (r_things.c `R_DrawPSprite`):
 *
 *   sprdef   = &sprites[psp->state->sprite];
 *   sprframe = &sprdef->spriteframes[psp->state->frame & FF_FRAMEMASK];
 *   lump = sprframe->lump[0];  flip = sprframe->flip[0];
 *   tx  = psp->sx - 160*FRACUNIT;
 *   tx -= spriteoffset[lump];
 *   x1  = (centerxfrac + FixedMul(tx,pspritescale)) >> FRACBITS;
 *   if (x1 > viewwidth) return;
 *   tx += spritewidth[lump];
 *   x2  = ((centerxfrac + FixedMul(tx,pspritescale)) >> FRACBITS) - 1;
 *   if (x2 < 0) return;
 *   vis->texturemid = (BASEYCENTER<<FRACBITS)+FRACUNIT/2-(psp->sy-spritetopoffset[lump]);
 *   vis->x1 = x1<0?0:x1;  vis->x2 = x2>=viewwidth?viewwidth-1:x2;
 *   vis->scale = pspritescale<<detailshift;
 *   if (flip){ vis->xiscale=-pspriteiscale; vis->startfrac=spritewidth[lump]-1; }
 *   else     { vis->xiscale= pspriteiscale; vis->startfrac=0; }
 *   if (vis->x1 > x1) vis->startfrac += vis->xiscale*(vis->x1-x1);
 *   vis->patch = lump;
 *   if (powers[pw_invisibility] > 4*32 || powers[pw_invisibility]&8) vis->colormap=NULL;
 *   else if (fixedcolormap)            vis->colormap=fixedcolormap;
 *   else if (frame & FF_FULLBRIGHT)    vis->colormap=colormaps;
 *   else                               vis->colormap=spritelights[MAXLIGHTSCALE-1];
 *   R_DrawVisSprite(vis, vis->x1, vis->x2);
 *
 * `pspritescale`/`pspriteiscale` are the R_ExecuteSetViewSize
 * constants `FRACUNIT*viewwidth/SCREENWIDTH` /
 * `FRACUNIT*SCREENWIDTH/viewwidth`; the latter is the existing
 * {@link computePspriteIscale} (reused — single source of truth).
 *
 * Pure: array/arithmetic only, no Win32 / framebuffer / WAD I/O.
 */

import { FRACBITS, FRACUNIT, type Fixed, fixedMul } from '../core/fixed.ts';

import { MAXLIGHTSCALE } from './projection.ts';
import { FF_FRAMEMASK, FF_FULLBRIGHT } from './spriteProjection.ts';
import type { SpriteDef } from './spriteProjection.ts';
import type { SpriteMetrics } from './spriteProjection.ts';
import { computePspriteIscale } from './sky.ts';

/** r_main.c `BASEYCENTER` — the psprite vertical anchor (100). */
export const BASEYCENTER = 100;

/**
 * R_ExecuteSetViewSize `pspritescale = FRACUNIT*viewwidth/SCREENWIDTH`
 * (the forward psprite horizontal scale; {@link computePspriteIscale}
 * is its inverse).
 */
export function computePspriteScale(viewWidth: number): Fixed {
  return ((FRACUNIT * viewWidth) / 320) | 0;
}

/** The pspdef_t fields `R_DrawPSprite` reads (`psp->state->sprite/frame`, `psp->sx/sy`). */
export interface PSprite {
  /** `psp->state->sprite` — index into the I6a sprite catalog. */
  readonly sprite: number;
  /** `psp->state->frame` (the `FF_FULLBRIGHT` bit is honoured; `& FF_FRAMEMASK` selects the frame). */
  readonly frame: number;
  /** `psp->sx` (16.16). */
  readonly sx: Fixed;
  /** `psp->sy` (16.16). */
  readonly sy: Fixed;
}

/** Viewport inputs `R_DrawPSprite` reads. */
export interface PSpriteView {
  readonly centerXFrac: Fixed;
  readonly viewWidth: number;
  /** 0 (high) / 1 (low) — `vis->scale = pspritescale << detailshift`. */
  readonly detailShift: number;
}

/** The light state feeding the colormap selection. */
export interface PSpriteLight {
  /** `viewplayer->powers[pw_invisibility]` (tics; `>4*32` or `&8` → shadow). */
  readonly invisibilityPower: number;
  /** `true` when a fixed colormap (invuln / light-amp) is active. */
  readonly fixedColormap: boolean;
}

/**
 * `vis->colormap` selection, as a discriminant the caller resolves to
 * a concrete colormap row (so this module stays decoupled from the
 * colormap tables): `'shadow'` → `NULL` fuzz, `'fixed'` → the active
 * fixed colormap, `'fullbright'` → `colormaps` (ramp 0),
 * `'spritelights'` → `spritelights[index]`.
 */
export type PSpriteColormap = { readonly kind: 'shadow' } | { readonly kind: 'fixed' } | { readonly kind: 'fullbright' } | { readonly kind: 'spritelights'; readonly index: number };

/** The resolved one-off `vissprite_t` for a player sprite. */
export interface PSpriteVis {
  readonly x1: number;
  readonly x2: number;
  readonly texturemid: Fixed;
  readonly scale: Fixed;
  readonly xiscale: Fixed;
  readonly startfrac: Fixed;
  /** `vis->patch` — the `firstspritelump`-relative lump (I6a `SpriteFrame.lump[0]`). */
  readonly patch: number;
  readonly flip: boolean;
  readonly colormap: PSpriteColormap;
}

/**
 * r_things.c `R_DrawPSprite` placement.  Returns the resolved
 * {@link PSpriteVis}, or `null` for the two vanilla off-screen
 * rejects (`x1 > viewwidth` / `x2 < 0`).  Throws (vanilla
 * `RANGECHECK` `I_Error`) on an out-of-range sprite / frame.
 *
 * `sprites` / `metrics` are the I6a {@link buildSpriteCatalog} /
 * I6b {@link buildSpriteMetrics} outputs; `metrics` is indexed by the
 * `firstspritelump`-relative lump the catalog stores.
 */
export function computePSpriteVis(psp: PSprite, sprites: readonly SpriteDef[], metrics: SpriteMetrics, view: PSpriteView, light: PSpriteLight): PSpriteVis | null {
  if (psp.sprite >>> 0 >= sprites.length) {
    throw new Error(`R_ProjectSprite: invalid sprite number ${psp.sprite}`);
  }
  const sprdef = sprites[psp.sprite]!;
  const frameIndex = psp.frame & FF_FRAMEMASK;
  if (frameIndex >= sprdef.numFrames) {
    throw new Error(`R_ProjectSprite: invalid sprite frame ${psp.sprite} : ${psp.frame}`);
  }
  const sprframe = sprdef.frames[frameIndex]!;

  const lump = sprframe.lump[0]!;
  const flip = sprframe.flip[0]!;

  const pspritescale = computePspriteScale(view.viewWidth);
  const pspriteiscale = computePspriteIscale(view.viewWidth);
  const centerxfrac = view.centerXFrac;
  const viewwidth = view.viewWidth;

  // calculate edges of the shape
  let tx = (psp.sx - 160 * FRACUNIT) | 0;
  tx = (tx - metrics.offset[lump]!) | 0;
  const x1 = (centerxfrac + fixedMul(tx, pspritescale)) >> FRACBITS;

  // off the right side
  if (x1 > viewwidth) {
    return null;
  }

  tx = (tx + metrics.width[lump]!) | 0;
  const x2 = ((centerxfrac + fixedMul(tx, pspritescale)) >> FRACBITS) - 1;

  // off the left side
  if (x2 < 0) {
    return null;
  }

  const texturemid = (((BASEYCENTER << FRACBITS) + ((FRACUNIT / 2) | 0)) | 0) - ((psp.sy - metrics.topOffset[lump]!) | 0);
  const vx1 = x1 < 0 ? 0 : x1;
  const vx2 = x2 >= viewwidth ? viewwidth - 1 : x2;
  const scale = (pspritescale << view.detailShift) | 0;

  let xiscale: Fixed;
  let startfrac: Fixed;
  if (flip) {
    xiscale = -pspriteiscale | 0;
    startfrac = (metrics.width[lump]! - 1) | 0;
  } else {
    xiscale = pspriteiscale;
    startfrac = 0;
  }
  if (vx1 > x1) {
    startfrac = (startfrac + Math.imul(xiscale, vx1 - x1)) | 0;
  }

  let colormap: PSpriteColormap;
  if (light.invisibilityPower > 4 * 32 || (light.invisibilityPower & 8) !== 0) {
    colormap = { kind: 'shadow' };
  } else if (light.fixedColormap) {
    colormap = { kind: 'fixed' };
  } else if ((psp.frame & FF_FULLBRIGHT) !== 0) {
    colormap = { kind: 'fullbright' };
  } else {
    colormap = { kind: 'spritelights', index: MAXLIGHTSCALE - 1 };
  }

  return Object.freeze({ x1: vx1, x2: vx2, texturemid: texturemid | 0, scale, xiscale, startfrac, patch: lump, flip, colormap });
}
