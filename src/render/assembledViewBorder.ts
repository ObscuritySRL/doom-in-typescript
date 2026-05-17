/**
 * Screen-block view border — Chocolate Doom 2.2.1 r_draw.c
 * `R_FillBackScreen` + `R_DrawViewBorder`.
 *
 * At `screenblocks < 11` the 3D view is a sub-window; vanilla tiles a
 * flat across the 320×(SCREENHEIGHT-SBARHEIGHT) background and draws the
 * eight `BRDR_*` edge patches around the view window (`R_FillBackScreen`
 * into `screens[1]`), then copies the non-view margins onto the screen
 * each frame (`R_DrawViewBorder`). The 3D view then overwrites the
 * window. Because nothing else writes the margins, painting the full
 * background + border once into the shared framebuffer and letting the
 * per-frame 3D pass overwrite the window yields the identical
 * `screens[0]` vanilla produces.
 *
 * Verbatim r_draw.c (SBARHEIGHT = 32; non-commercial background
 * `FLOOR7_2`):
 *
 *   for (y=0; y<SCREENHEIGHT-SBARHEIGHT; y++)
 *     for (x=0; x<SCREENWIDTH/64; x++) memcpy(dest, src+((y&63)<<6), 64);
 *   // SCREENWIDTH&63 == 0 for 320 → no remainder
 *   brdr_t: x in [0,scaledviewwidth) step 8 → V_DrawPatch(vwx+x, vwy-8)
 *   brdr_b:                                  → V_DrawPatch(vwx+x, vwy+viewheight)
 *   brdr_l: y in [0,viewheight) step 8       → V_DrawPatch(vwx-8, vwy+y)
 *   brdr_r:                                  → V_DrawPatch(vwx+scaledviewwidth, vwy+y)
 *   brdr_tl/tr/bl/br at the four corners.
 *
 * `scaledviewwidth == SCREENWIDTH` (screenblocks 11) → no border
 * (vanilla early-returns). The bottom `SBARHEIGHT` rows are the status
 * bar (a separate widget; the E1M1 gate excludes them) and are left
 * untouched here.
 *
 * Pure raster fill + committed {@link drawPatch}; no Win32 or runtime
 * dependencies.
 */

import { SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';

import type { Viewport } from './projection.ts';
import { drawPatch } from './patchDraw.ts';
import type { DecodedPatch } from './patchDraw.ts';

/** r_draw.c `SBARHEIGHT` — status-bar rows excluded from the background fill. */
export const SBARHEIGHT = 32;

/** The eight `BRDR_*` edge/corner patch lump names (r_draw.c). */
export const VIEW_BORDER_PATCH_NAMES = Object.freeze(['BRDR_T', 'BRDR_B', 'BRDR_L', 'BRDR_R', 'BRDR_TL', 'BRDR_TR', 'BRDR_BL', 'BRDR_BR'] as const);

/** Lump-name → decoded patch (`W_CacheLumpName` + {@link decodePatch}). */
export type BorderPatchResolver = (name: string) => DecodedPatch;

/** Optional DI hook (defaults to the committed bit-exact V_DrawPatch). */
export interface AssembledViewBorderHooks {
  readonly drawPatchFn?: typeof drawPatch;
}

/**
 * Paint the tiled background + the eight `BRDR_*` border patches into
 * `framebuffer` for a `screenblocks < 11` viewport (once per level —
 * the 3D view overwrites the window each frame; the margins persist).
 *
 * @param framebuffer - The shared `SCREENWIDTH * SCREENHEIGHT` palette framebuffer.
 * @param viewport - The active viewport (`viewWindowX/Y`, `scaledViewWidth`, `viewHeight`).
 * @param backgroundFlat - The 4096-byte 64×64 tile flat (`FLOOR7_2` for DOOM1).
 * @param borderPatchOf - `W_CacheLumpName` + decode for the `BRDR_*` lumps.
 *
 * @example
 * ```ts
 * paintAssembledViewBorder(framebuffer, viewport, flatSource(flatNumber('FLOOR7_2')), (n) => decodePatch(lookup.getLumpData(n, wadBuffer)));
 * ```
 */
export function paintAssembledViewBorder(framebuffer: Uint8Array, viewport: Viewport, backgroundFlat: Uint8Array, borderPatchOf: BorderPatchResolver, hooks: AssembledViewBorderHooks = {}): void {
  // R_FillBackScreen: full-screen view (screenblocks 11) has no border.
  if (viewport.scaledViewWidth === SCREENWIDTH) {
    return;
  }

  const blit = hooks.drawPatchFn ?? drawPatch;
  const backgroundRows = SCREENHEIGHT - SBARHEIGHT;

  // Tile the flat: framebuffer[y*W + x] = flat[((y&63)<<6) | (x&63)].
  for (let y = 0; y < backgroundRows; y += 1) {
    const flatRow = (y & 63) << 6;
    const destRow = y * SCREENWIDTH;
    for (let x = 0; x < SCREENWIDTH; x += 1) {
      framebuffer[destRow + x] = backgroundFlat[flatRow | (x & 63)]!;
    }
  }

  const vwx = viewport.viewWindowX;
  const vwy = viewport.viewWindowY;
  const svw = viewport.scaledViewWidth;
  const vh = viewport.viewHeight;

  const brdrT = borderPatchOf('BRDR_T');
  const brdrB = borderPatchOf('BRDR_B');
  for (let x = 0; x < svw; x += 8) {
    blit(brdrT, vwx + x, vwy - 8, framebuffer, SCREENWIDTH, SCREENHEIGHT);
    blit(brdrB, vwx + x, vwy + vh, framebuffer, SCREENWIDTH, SCREENHEIGHT);
  }

  const brdrL = borderPatchOf('BRDR_L');
  const brdrR = borderPatchOf('BRDR_R');
  for (let y = 0; y < vh; y += 8) {
    blit(brdrL, vwx - 8, vwy + y, framebuffer, SCREENWIDTH, SCREENHEIGHT);
    blit(brdrR, vwx + svw, vwy + y, framebuffer, SCREENWIDTH, SCREENHEIGHT);
  }

  blit(borderPatchOf('BRDR_TL'), vwx - 8, vwy - 8, framebuffer, SCREENWIDTH, SCREENHEIGHT);
  blit(borderPatchOf('BRDR_TR'), vwx + svw, vwy - 8, framebuffer, SCREENWIDTH, SCREENHEIGHT);
  blit(borderPatchOf('BRDR_BL'), vwx - 8, vwy + vh, framebuffer, SCREENWIDTH, SCREENHEIGHT);
  blit(borderPatchOf('BRDR_BR'), vwx + svw, vwy + vh, framebuffer, SCREENWIDTH, SCREENHEIGHT);
}
