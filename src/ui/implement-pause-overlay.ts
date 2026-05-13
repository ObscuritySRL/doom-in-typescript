/**
 * Vanilla DOOM 1.9 pause overlay contract.
 *
 * From Chocolate Doom 2.2.1 d_main.c D_Display and g_game.c G_Responder:
 *
 *   if (paused && gamestate == GS_LEVEL)
 *   {
 *       patch = W_CacheLumpName(DEH_String("M_PAUSE"), PU_CACHE);
 *       V_DrawPatchDirect(
 *           (SCREENWIDTH - SHORT(patch->width)) / 2,
 *           4,
 *           patch);
 *   }
 *
 *   // G_Responder:
 *   case ev_keydown:
 *       if (ev->data1 == key_pause)
 *       {
 *           sendpause = true;
 *           return true;
 *       }
 *
 * Notes for parity:
 *   - The pause overlay is only drawn when `paused == true` AND `gamestate == GS_LEVEL`
 *     (not at the title, intermission, or finale screens).
 *   - Lump name is M_PAUSE.
 *   - x position is centered: (SCREENWIDTH - patch.width) / 2 with SCREENWIDTH = 320.
 *   - y position is fixed at 4 (near the top of the screen, above the player view).
 *   - The pause toggle is gated by the key_pause binding; pressing it sets `sendpause`
 *     which becomes a buf_pause action in the next ticcmd.
 *   - The pause flag is shared across all four players in coop/dm; any player can
 *     pause and unpause.
 *   - When paused, the game world ticker is suspended but the menu, status bar,
 *     and HUD still render and respond to input.
 */

export const VANILLA_PAUSE_LUMP_NAME = 'M_PAUSE';
export const VANILLA_PAUSE_OVERLAY_Y = 4;
export const VANILLA_SCREEN_WIDTH = 320;

export interface PauseOverlayInput {
  readonly paused: boolean;
  readonly gamestate: 'GS_LEVEL' | 'GS_INTERMISSION' | 'GS_FINALE' | 'GS_DEMOSCREEN' | 'GS_TITLESCREEN';
  readonly patchWidth: number;
}

export interface PauseOverlayDrawCommand {
  readonly shouldDraw: boolean;
  readonly lumpName: string;
  readonly x: number;
  readonly y: number;
}

export function resolveVanillaPauseOverlay(input: PauseOverlayInput): PauseOverlayDrawCommand {
  const shouldDraw = input.paused && input.gamestate === 'GS_LEVEL';
  return Object.freeze({
    shouldDraw,
    lumpName: VANILLA_PAUSE_LUMP_NAME,
    x: (VANILLA_SCREEN_WIDTH - input.patchWidth) / 2,
    y: VANILLA_PAUSE_OVERLAY_Y,
  });
}
