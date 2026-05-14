/**
 * Vanilla DOOM 1.9 view border rendering contract.
 *
 * From Chocolate Doom 2.2.1 r_draw.c R_DrawViewBorder and R_FillBackScreen:
 *   View border surrounds the 3D viewport when screen block < fullscreen.
 *   Uses FLOOR7_2 flat as background, BRDR_T/B/L/R/TL/TR/BL/BR patches for
 *   the border edges/corners.
 *
 *   Border patch names:
 *     BRDR_T (top edge), BRDR_B (bottom), BRDR_L (left), BRDR_R (right)
 *     BRDR_TL, BRDR_TR, BRDR_BL, BRDR_BR (corners)
 *
 *   Background flat: FLOOR7_2 (DOOM 1) or GRNROCK (DOOM 2).
 */

export const VANILLA_VIEW_BORDER_PATCHES = Object.freeze(['BRDR_T', 'BRDR_B', 'BRDR_L', 'BRDR_R', 'BRDR_TL', 'BRDR_TR', 'BRDR_BL', 'BRDR_BR'] as const);

export const VANILLA_VIEW_BORDER_BACKGROUND_DOOM1 = 'FLOOR7_2';
export const VANILLA_VIEW_BORDER_BACKGROUND_DOOM2 = 'GRNROCK';

export function getViewBorderBackground(gameMode: 'shareware' | 'registered' | 'retail' | 'commercial'): string {
  if (gameMode === 'commercial') {
    return VANILLA_VIEW_BORDER_BACKGROUND_DOOM2;
  }
  return VANILLA_VIEW_BORDER_BACKGROUND_DOOM1;
}
