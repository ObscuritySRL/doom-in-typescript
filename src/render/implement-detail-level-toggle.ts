/**
 * Vanilla DOOM 1.9 detail level toggle contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_ChangeDetail and r_main.c:
 *   detailshift: 0 = high detail (1 column per pixel), 1 = low detail
 *     (2 columns per pixel doubled horizontally).
 *
 *   R_RenderPlayerView checks detailshift; low-detail uses R_DrawColumnLow /
 *   R_DrawSpanLow that write 2 pixels per column iteration.
 *
 * Detail level enum: 0=high, 1=low.
 */

export const VANILLA_DETAIL_HIGH = 0;
export const VANILLA_DETAIL_LOW = 1;
export const VANILLA_DETAIL_LOW_PIXEL_STRIDE = 2;

export type DetailLevel = typeof VANILLA_DETAIL_HIGH | typeof VANILLA_DETAIL_LOW;

export function isLowDetail(detailshift: number): boolean {
  return detailshift === VANILLA_DETAIL_LOW;
}
