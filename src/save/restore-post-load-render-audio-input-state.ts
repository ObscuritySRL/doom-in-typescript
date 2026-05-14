/**
 * Vanilla DOOM 1.9 post-load subsystem refresh contract.
 *
 * From Chocolate Doom 2.2.1 g_game.c G_DoLoadGame and the side effects
 * the load triggers, three subsystem resets MUST happen after
 * P_RestoreTargets completes:
 *
 *   1. Renderer: R_FillBackScreen (refresh the border framebuffer
 *      because the menu may have left torn pixels), R_ExecuteSetViewSize
 *      (apply the loaded screenblocks setting), R_SetupFrame (rebuild
 *      visplane / drawseg caches).
 *   2. Audio: S_Start (kills all currently-playing SFX channels and
 *      restarts the level's music as defined by the new gamemap).
 *      Without this the previous level's MUS_E1M1 continues over the
 *      newly-loaded level.
 *   3. Input: I_ResetKey (clears any stuck key state), reset the
 *      mouse delta accumulators (the player's mouse position when
 *      they hit Load should not affect their viewangle).
 *
 * Parity-critical details:
 *   - S_Start is called by P_SetupLevel which is invoked by
 *     G_DoLoadLevel — NOT by G_DoLoadGame directly. The "fresh
 *     level" code path runs P_SetupLevel via G_LoadGame's call into
 *     G_InitNew. For save-load, the equivalent restart happens
 *     implicitly when the loaded gamemap differs from the running
 *     map; if they match, S_Start runs anyway to reset SFX channels.
 *   - The screenblocks value loaded from the savegame OVERRIDES the
 *     command-line `-default screenblocks` setting and the menu
 *     slider value. The Load menu commits the saved view size before
 *     dispatching to the renderer reset.
 *   - I_ResetKey is the platform-specific keyboard-state-clear hook.
 *     On DOS it zeros keystate[]; on Win32/SDL it pumps queued
 *     KeyUp messages for any held keys.
 *   - Mouse delta reset is named `D_ResetMouseDeltas` in chocolate-
 *     doom but performs the same operation: zero `mousex` and
 *     `mousey` accumulators before the next G_BuildTiccmd call.
 */

export const VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER: readonly string[] = Object.freeze(['R_FillBackScreen', 'R_ExecuteSetViewSize', 'R_SetupFrame', 'S_Start', 'I_ResetKey', 'D_ResetMouseDeltas']);

export interface VanillaPostLoadResetGroup {
  readonly subsystem: 'renderer' | 'audio' | 'input';
  readonly steps: readonly string[];
}

export const VANILLA_POST_LOAD_RESET_GROUPS: readonly VanillaPostLoadResetGroup[] = Object.freeze([
  Object.freeze({ subsystem: 'renderer', steps: Object.freeze(['R_FillBackScreen', 'R_ExecuteSetViewSize', 'R_SetupFrame']) }),
  Object.freeze({ subsystem: 'audio', steps: Object.freeze(['S_Start']) }),
  Object.freeze({ subsystem: 'input', steps: Object.freeze(['I_ResetKey', 'D_ResetMouseDeltas']) }),
]);

export function vanillaPostLoadResetSubsystemFor(stepName: string): VanillaPostLoadResetGroup['subsystem'] | null {
  for (const group of VANILLA_POST_LOAD_RESET_GROUPS) {
    if (group.steps.includes(stepName)) {
      return group.subsystem;
    }
  }
  return null;
}

export function vanillaPostLoadResetOrderIndex(stepName: string): number {
  return VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER.indexOf(stepName);
}
