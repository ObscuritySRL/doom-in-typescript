/**
 * Per-frame view-transform setup — Chocolate Doom 2.2.1 r_main.c
 * `R_SetupFrame` (the first call in `R_RenderPlayerView`).
 *
 * Verbatim r_main.c:
 *
 *   viewx     = player->mo->x;
 *   viewy     = player->mo->y;
 *   viewangle = player->mo->angle + viewangleoffset;
 *   extralight = player->extralight;
 *   viewz     = player->viewz;
 *   viewsin = finesine[viewangle>>ANGLETOFINESHIFT];
 *   viewcos = finecosine[viewangle>>ANGLETOFINESHIFT];
 *   if (player->fixedcolormap) { fixedcolormap = colormaps +
 *       player->fixedcolormap*256; walllights = scalelightfixed;
 *       for i<MAXLIGHTSCALE scalelightfixed[i]=fixedcolormap; }
 *   else fixedcolormap = 0;
 *
 * This module is the pure view-transform half — the parity-critical
 * render inputs `R_RenderPlayerView`'s BSP/seg/plane passes consume.
 * `viewangleoffset` is the (normally 0) debug global, taken as a
 * parameter so this stays pure. `fixedColormapIndex` is `null` when
 * `player->fixedcolormap == 0` (no override) else the colormap row
 * index (vanilla's `colormaps + n*256` pointer; the wall/span drawers
 * resolve the row). The `framecount++` / `validcount++` / `sscount=0`
 * global-counter side effects are NOT outputs here — they are managed
 * by the sequencer that wires the full `R_RenderPlayerView`, matching
 * vanilla globals.
 *
 * Pure arithmetic; no Win32 or runtime dependencies.
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../core/trig.ts';

/** The `player_t` fields `R_SetupFrame` reads. */
export interface SetupFramePlayer {
  /** `player->mo->x`. */
  readonly mobjX: Fixed;
  /** `player->mo->y`. */
  readonly mobjY: Fixed;
  /** `player->mo->angle` (32-bit BAM). */
  readonly mobjAngle: Angle;
  /** `player->viewz` (eye height, 16.16). */
  readonly viewz: Fixed;
  /** `player->extralight` (gun-flash / IDBEHOLD light add). */
  readonly extralight: number;
  /**
   * `player->fixedcolormap` — `0` means none; non-zero selects a
   * fixed colormap row (invulnerability = 32, light-amp goggles = 1).
   */
  readonly fixedColormap: number;
}

/** The view-transform `R_RenderPlayerView`'s passes consume. */
export interface ViewFrame {
  readonly viewx: Fixed;
  readonly viewy: Fixed;
  readonly viewz: Fixed;
  /** `player->mo->angle + viewangleoffset` (32-bit BAM, wrapped). */
  readonly viewangle: Angle;
  /** `finesine[viewangle>>ANGLETOFINESHIFT]`. */
  readonly viewsin: number;
  /** `finecosine[viewangle>>ANGLETOFINESHIFT]`. */
  readonly viewcos: number;
  readonly extralight: number;
  /**
   * `null` when `player->fixedcolormap == 0` (distance-lit normally);
   * else the fixed colormap row index (`fixedcolormap` /
   * `walllights = scalelightfixed` override is active).
   */
  readonly fixedColormapIndex: number | null;
}

/**
 * r_main.c `R_SetupFrame`: derive the per-frame view transform from
 * the player. `viewangleoffset` is the (normally 0) debug global.
 *
 * @example
 * ```ts
 * const frame = setupFrame({ mobjX, mobjY, mobjAngle, viewz, extralight: 0, fixedColormap: 0 });
 * // frame.viewsin === finesine[frame.viewangle >>> ANGLETOFINESHIFT]
 * ```
 */
export function setupFrame(player: SetupFramePlayer, viewangleoffset: Angle = 0): ViewFrame {
  const viewangle = (player.mobjAngle + viewangleoffset) >>> 0;
  const fineIndex = viewangle >>> ANGLETOFINESHIFT;

  return Object.freeze({
    viewx: player.mobjX,
    viewy: player.mobjY,
    viewz: player.viewz,
    viewangle,
    viewsin: finesine[fineIndex]!,
    viewcos: finecosine[fineIndex]!,
    extralight: player.extralight,
    fixedColormapIndex: player.fixedColormap !== 0 ? player.fixedColormap : null,
  });
}
