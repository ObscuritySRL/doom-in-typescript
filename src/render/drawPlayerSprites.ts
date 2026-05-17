/**
 * Player weapon sprite rasterization — Chocolate Doom 2.2.1
 * r_things.c `R_DrawPlayerSprites` + `R_DrawMaskedColumn` (sprite
 * path), closing the I7 chain.
 *
 * `R_DrawPlayerSprites` selects `spritelights` from the player's
 * subsector-sector light level, sets the screen-only clip
 * (`mfloorclip = screenheightarray`, `mceilingclip = negonearray` —
 * psprites are NOT drawseg-clipped), and runs each active player
 * sprite (`ps_weapon` + `ps_flash`) through `R_DrawPSprite` (I7
 * {@link computePSpriteVis}) → `R_DrawVisSprite` (I7
 * {@link planVisSpriteColumns}) → `R_DrawMaskedColumn`, which blits
 * each patch post into the framebuffer via the bit-exact
 * {@link rDrawColumn} (`colfunc`) or {@link rDrawFuzzColumn}
 * (NULL-colormap shadow).
 *
 * Verbatim contract (r_things.c):
 *
 *   R_DrawPlayerSprites:
 *     lightnum = (mo->subsector->sector->lightlevel>>LIGHTSEGSHIFT)+extralight;
 *     spritelights = scalelight[clamp(lightnum,0,LIGHTLEVELS-1)];
 *     mfloorclip = screenheightarray;  mceilingclip = negonearray;
 *     for (psp in psprites[NUMPSPRITES]) if (psp->state) R_DrawPSprite(psp);
 *
 *   R_DrawMaskedColumn(column):
 *     basetexturemid = dc_texturemid;
 *     for (; column->topdelta != 0xff; column = next) {
 *       topscreen    = sprtopscreen + spryscale*column->topdelta;
 *       bottomscreen = topscreen + spryscale*column->length;
 *       dc_yl = (topscreen+FRACUNIT-1)>>FRACBITS;
 *       dc_yh = (bottomscreen-1)>>FRACBITS;
 *       if (dc_yh >= mfloorclip[dc_x])  dc_yh = mfloorclip[dc_x]-1;
 *       if (dc_yl <= mceilingclip[dc_x]) dc_yl = mceilingclip[dc_x]+1;
 *       if (dc_yl <= dc_yh) {
 *         dc_source = (byte*)column+3;
 *         dc_texturemid = basetexturemid - (column->topdelta<<FRACBITS);
 *         colfunc();          // R_DrawColumn, or R_DrawFuzzColumn (shadow)
 *       }
 *     }
 *     dc_texturemid = basetexturemid;
 *
 * For psprites the screen clip is constant — `mfloorclip[dc_x] =
 * viewheight`, `mceilingclip[dc_x] = -1` — so the per-post clamp
 * reduces to `dc_yh = min(dc_yh, viewheight-1)` /
 * `dc_yl = max(dc_yl, 0)`.  `dc_iscale` / `dc_texturemid` /
 * `spryscale` / `sprtopscreen` come from {@link planVisSpriteColumns}
 * (R_DrawVisSprite).  The colormap discriminant from
 * {@link computePSpriteVis} resolves here: `spritelights` →
 * `spritelights[MAXLIGHTSCALE-1]`, `fullbright` → `colormaps` ramp 0,
 * `fixed` → the active fixed colormap row, `shadow` → fuzz.
 *
 * Writes the supplied framebuffer (like every other wall/plane/column
 * drawer); otherwise pure — no Win32 / WAD I/O.
 */

import { FRACBITS, FRACUNIT, type Fixed } from '../core/fixed.ts';

import { rDrawColumn } from './drawPrimitives.ts';
import { rDrawFuzzColumn } from './fuzz.ts';
import type { DecodedPatch } from './patchDraw.ts';
import { LIGHTLEVELS, LIGHTSEGSHIFT, MAXLIGHTSCALE } from './projection.ts';
import type { SpriteDef, SpriteMetrics } from './spriteProjection.ts';
import type { PSprite } from './drawPsprite.ts';
import { computePSpriteVis } from './drawPsprite.ts';
import { planVisSpriteColumns } from './drawVisSprite.ts';

/** The two player sprites (`ps_weapon`, `ps_flash`); `null` = inactive (`!psp->state`). */
export type PlayerPSprites = readonly [PSprite | null, PSprite | null];

/** Viewport state `R_DrawPlayerSprites` reads. */
export interface DrawPlayerSpritesView {
  readonly centerXFrac: Fixed;
  readonly centerYFrac: Fixed;
  /** `centery` global — forwarded to {@link rDrawColumn}. */
  readonly centerY: number;
  readonly viewWidth: number;
  /** `viewheight` — the constant `mfloorclip` for the psprite screen clip. */
  readonly viewHeight: number;
  readonly detailShift: number;
  /** Framebuffer row stride. */
  readonly screenWidth: number;
}

/** Light / colormap state `R_DrawPlayerSprites` + `R_DrawPSprite` read. */
export interface DrawPlayerSpritesLight {
  /** `viewplayer->mo->subsector->sector->lightlevel`. */
  readonly sectorLightLevel: number;
  readonly extralight: number;
  /** `viewplayer->powers[pw_invisibility]` (tics). */
  readonly invisibilityPower: number;
  /** Active fixed colormap row (invuln / light-amp), or `null`. */
  readonly fixedColormapRow: Uint8Array | null;
  /**
   * `scalelight[LIGHTLEVELS][MAXLIGHTSCALE]` materialised colormap
   * rows (row-major), as I1 {@link materializeColormapRows} yields.
   */
  readonly scalelightRows: readonly (readonly Uint8Array[])[];
  /** The COLORMAP lump (`colormaps`); ramp 0 = full-bright; fuzz reads ramp 6. */
  readonly colormaps: Uint8Array;
}

/**
 * r_things.c `R_DrawPlayerSprites`.  Resolves `spritelights` from the
 * player sector light, sets the constant psprite screen clip, and
 * rasterizes each active player sprite into `framebuffer`.
 */
export function drawPlayerSprites(
  psprites: PlayerPSprites,
  sprites: readonly SpriteDef[],
  metrics: SpriteMetrics,
  patchFor: (lump: number) => DecodedPatch,
  view: DrawPlayerSpritesView,
  light: DrawPlayerSpritesLight,
  framebuffer: Uint8Array,
): void {
  // get light level
  let lightnum = (light.sectorLightLevel >> LIGHTSEGSHIFT) + light.extralight;
  if (lightnum < 0) {
    lightnum = 0;
  } else if (lightnum >= LIGHTLEVELS) {
    lightnum = LIGHTLEVELS - 1;
  }
  const spritelights = light.scalelightRows[lightnum]!;

  // psprite screen-only clip: mfloorclip = viewheight, mceilingclip = -1.
  const mfloorclip = view.viewHeight;
  const mceilingclip = -1;

  const fullbrightRow = light.colormaps.subarray(0, 256);

  for (const psp of psprites) {
    if (psp === null) {
      continue; // !psp->state
    }

    const vis = computePSpriteVis(
      psp,
      sprites,
      metrics,
      { centerXFrac: view.centerXFrac, viewWidth: view.viewWidth, detailShift: view.detailShift },
      { invisibilityPower: light.invisibilityPower, fixedColormap: light.fixedColormapRow !== null },
    );
    if (vis === null) {
      continue;
    }

    const patch = patchFor(vis.patch);
    const plan = planVisSpriteColumns(
      { x1: vis.x1, x2: vis.x2, texturemid: vis.texturemid, scale: vis.scale, xiscale: vis.xiscale, startfrac: vis.startfrac, patchWidth: patch.columns.length, colormap: vis.colormap },
      { centerYFrac: view.centerYFrac, detailShift: view.detailShift },
    );

    const isShadow = plan.colfunc === 'fuzz';
    let colormapRow: Uint8Array;
    switch (vis.colormap.kind) {
      case 'fullbright':
        colormapRow = fullbrightRow;
        break;
      case 'fixed':
        colormapRow = light.fixedColormapRow!;
        break;
      case 'spritelights':
        colormapRow = spritelights[MAXLIGHTSCALE - 1]!;
        break;
      default: // 'shadow' — fuzz colfunc, no colormap row read
        colormapRow = fullbrightRow;
        break;
    }

    const basetexturemid = plan.dcTexturemid;
    const { spryscale, sprtopscreen } = plan;

    for (const { dcX, textureColumn } of plan.columns) {
      const column = patch.columns[textureColumn]!;
      for (const post of column) {
        // calculate unclipped screen coordinates for post
        const topscreen = (sprtopscreen + Math.imul(spryscale, post.topDelta)) | 0;
        const bottomscreen = (topscreen + Math.imul(spryscale, post.length)) | 0;

        let dcYl = (topscreen + FRACUNIT - 1) >> FRACBITS;
        let dcYh = (bottomscreen - 1) >> FRACBITS;

        if (dcYh >= mfloorclip) {
          dcYh = mfloorclip - 1;
        }
        if (dcYl <= mceilingclip) {
          dcYl = mceilingclip + 1;
        }

        if (dcYl <= dcYh) {
          if (isShadow) {
            rDrawFuzzColumn({ x: dcX, yl: dcYl, yh: dcYh, viewHeight: view.viewHeight, colormaps: light.colormaps }, framebuffer, view.screenWidth);
          } else {
            const dcTexturemid = (basetexturemid - (post.topDelta << FRACBITS)) | 0;
            rDrawColumn({ x: dcX, yl: dcYl, yh: dcYh, textureMid: dcTexturemid, iscale: plan.dcIscale, centerY: view.centerY, source: post.pixels, colormap: colormapRow }, framebuffer, view.screenWidth);
          }
        }
      }
    }
  }
}
