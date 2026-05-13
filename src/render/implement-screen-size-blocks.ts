/**
 * Vanilla DOOM 1.9 screen size blocks contract.
 *
 * From Chocolate Doom 2.2.1 r_main.c R_ExecuteSetViewSize and m_menu.c:
 *   Screen size blocks: 3..11 (R_SetViewSize input range).
 *     block 3..10: progressively larger viewports inside status bar.
 *     block 11: full screen with HUD overlay (status bar hidden).
 *   block 10 = default (status bar visible, max viewport above it).
 *
 *   View widths/heights for each block from R_SetViewSize:
 *     viewwidth = setblocks * SCREENWIDTH / 10 (for blocks 3..10)
 *     For block 11: viewwidth = SCREENWIDTH (full).
 *     viewheight = (setblocks*SCREENHEIGHT/10) & ~7 (or - statusbar height).
 */

export const VANILLA_SCREEN_BLOCK_MIN = 3;
export const VANILLA_SCREEN_BLOCK_MAX = 11;
export const VANILLA_SCREEN_BLOCK_DEFAULT = 10;
export const VANILLA_SCREEN_BLOCK_FULLSCREEN = 11;

export function isValidScreenBlock(setblocks: number): boolean {
  return setblocks >= VANILLA_SCREEN_BLOCK_MIN && setblocks <= VANILLA_SCREEN_BLOCK_MAX;
}

export function isFullscreenScreenBlock(setblocks: number): boolean {
  return setblocks === VANILLA_SCREEN_BLOCK_FULLSCREEN;
}
