/**
 * Vanilla DOOM 1.9 view-border + screen-size-block runtime facade.
 *
 * Plan_final step `06-008` (lane: render) aggregates the
 * view-border-rendering and screen-size-block entry points the
 * framebuffer presentation / composition pass needs into one
 * cohesive re-export barrel.  The read-only
 * `src/render/implement-view-border-rendering.ts` and
 * `src/render/implement-screen-size-blocks.ts` modules already
 * implement vanilla `r_draw.c` `R_DrawViewBorder` and `m_menu.c` /
 * `r_main.c` `R_SetViewSize` screen-block semantics and are
 * SHA-pinned by the `plan_vanilla_parity` renderer inventory; this
 * module does NOT modify them.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `getViewBorderBackground`     — the gamemode-keyed border
 *     background flat (`FLOOR7_2` for Doom 1, `GRNROCK` for Doom 2).
 *   - `isValidScreenBlock`         — the `[3, 11]` screen-block
 *     range guard from `R_SetViewSize`.
 *   - `isFullscreenScreenBlock`    — the `setblocks == 11`
 *     fullscreen (no status-bar) test.
 *   - `scaledViewWidthForScreenBlock` / `viewHeightForScreenBlock`
 *     — the per-block scaled viewport dimensions.
 *
 * @example
 * ```ts
 * import { isValidScreenBlock, VANILLA_SCREEN_BLOCK_DEFAULT, VANILLA_WIPE_BORDER_ENTRY_POINTS } from './wireWipesAndBorders.ts';
 * isValidScreenBlock(VANILLA_SCREEN_BLOCK_DEFAULT); // true
 * VANILLA_WIPE_BORDER_ENTRY_POINTS.length;          // 5
 * ```
 */

export { VANILLA_VIEW_BORDER_BACKGROUND_DOOM1, VANILLA_VIEW_BORDER_BACKGROUND_DOOM2, VANILLA_VIEW_BORDER_PATCHES, getViewBorderBackground } from '../render/implement-view-border-rendering.ts';
export {
  VANILLA_SCREEN_BLOCK_DEFAULT,
  VANILLA_SCREEN_BLOCK_FULLSCREEN,
  VANILLA_SCREEN_BLOCK_MAX,
  VANILLA_SCREEN_BLOCK_MIN,
  VANILLA_SCREEN_HEIGHT,
  VANILLA_SCREEN_HEIGHT_ABOVE_STATUS_BAR,
  VANILLA_SCREEN_WIDTH,
  VANILLA_STATUS_BAR_HEIGHT,
  isFullscreenScreenBlock,
  isValidScreenBlock,
  scaledViewWidthForScreenBlock,
  viewHeightForScreenBlock,
} from '../render/implement-screen-size-blocks.ts';

/**
 * Frozen manifest of the five canonical view-border /
 * screen-size-block entry-point names this facade wires, in the
 * order the presentation pass invokes them (validate the block,
 * test fullscreen, derive the scaled viewport width + height, then
 * resolve the border background flat for the gamemode).
 */
export const VANILLA_WIPE_BORDER_ENTRY_POINTS: readonly string[] = Object.freeze(['getViewBorderBackground', 'isFullscreenScreenBlock', 'isValidScreenBlock', 'scaledViewWidthForScreenBlock', 'viewHeightForScreenBlock']);
