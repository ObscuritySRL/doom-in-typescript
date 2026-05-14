/**
 * Vanilla DOOM 1.9 status bar background contract.
 *
 * From Chocolate Doom 2.2.1 st_stuff.c and st_lib.c:
 *   - ST_WIDTH  = 320 (full screen width)
 *   - ST_HEIGHT = 32  (status bar height in logical pixels)
 *   - ST_Y      = SCREENHEIGHT - ST_HEIGHT = 168
 *   - ST_X      = 0
 *
 *   ST_refreshBackground draws the STBAR patch at (ST_X, ST_Y) followed by the
 *   STARMS patch overlay at (ST_ARMSBGX, ST_Y) when in single-player and the
 *   chainsaw or fist is current (so the arms display is meaningful).
 *
 *   Patch names (from r_data.c TEXTURE name conventions and st_stuff.c):
 *     STBAR  — the status bar background.
 *     STARMS — the small inset that holds the weapon arms 2..7 display.
 *
 *   ST_ARMSBGX coordinates from st_stuff.c:
 *     ST_ARMSBGX = ST_X + 104
 *     ST_ARMSBGY = ST_Y (same row as STBAR)
 *
 * Source-authoritative values: SCREENHEIGHT 200, status bar 320x32 with origin
 * at (0, 168). These match the i_video.c SCREENWIDTH/SCREENHEIGHT constants
 * used throughout the renderer.
 */

export const VANILLA_STATUS_BAR_WIDTH = 320;
export const VANILLA_STATUS_BAR_HEIGHT = 32;
export const VANILLA_STATUS_BAR_X = 0;
export const VANILLA_STATUS_BAR_Y = 168;

export const VANILLA_STBAR_PATCH_NAME = 'STBAR';
export const VANILLA_STARMS_PATCH_NAME = 'STARMS';

export const VANILLA_STARMS_X = 104;
export const VANILLA_STARMS_Y = VANILLA_STATUS_BAR_Y;

export interface VanillaStatusBarBackgroundDraw {
  readonly patch: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Returns the ordered list of background draws required to refresh the status
 * bar: STBAR first as the full-width strip, then STARMS overlaying the small
 * arms inset on the left side. Order matters: STARMS is drawn ON TOP of STBAR.
 *
 * When `singlePlayerArmsVisible` is false (e.g., deathmatch where the frag
 * count overlay replaces the arms display), only STBAR is emitted.
 */
export function buildStatusBarBackgroundDraws(singlePlayerArmsVisible: boolean): readonly VanillaStatusBarBackgroundDraw[] {
  const draws: VanillaStatusBarBackgroundDraw[] = [{ patch: VANILLA_STBAR_PATCH_NAME, x: VANILLA_STATUS_BAR_X, y: VANILLA_STATUS_BAR_Y }];
  if (singlePlayerArmsVisible) {
    draws.push({ patch: VANILLA_STARMS_PATCH_NAME, x: VANILLA_STARMS_X, y: VANILLA_STARMS_Y });
  }
  return draws;
}
