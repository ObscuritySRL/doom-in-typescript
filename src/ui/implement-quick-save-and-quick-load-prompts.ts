/**
 * Vanilla DOOM 1.9 quick-save and quick-load prompt contracts.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_QuickSave / M_QuickLoad / M_QuickSaveResponse / M_QuickLoadResponse:
 *
 *   void M_QuickSave(void)
 *   {
 *       if (!usergame) { S_StartSound(NULL, sfx_oof); return; }
 *       if (gamestate != GS_LEVEL) return;
 *       if (quickSaveSlot < 0)
 *       {
 *           M_StartControlPanel();
 *           M_ReadSaveStrings();
 *           M_SetupNextMenu(&SaveDef);
 *           quickSaveSlot = -2;     // -2 signals "next slot picked becomes quick save"
 *           return;
 *       }
 *       sprintf(tempstring, QSPROMPT, savegamestrings[quickSaveSlot]);
 *       M_StartMessage(tempstring, M_QuickSaveResponse, true);
 *   }
 *
 *   void M_QuickLoad(void)
 *   {
 *       if (netgame) { M_StartMessage(DEH_String(QLOADNET), NULL, false); return; }
 *       if (quickSaveSlot < 0)
 *       {
 *           M_StartMessage(DEH_String(QSAVESPOT), NULL, false);
 *           return;
 *       }
 *       sprintf(tempstring, QLPROMPT, savegamestrings[quickSaveSlot]);
 *       M_StartMessage(tempstring, M_QuickLoadResponse, true);
 *   }
 *
 * Notes for parity:
 *   - Quick save guards:
 *     * !usergame -> play sfx_oof, no popup.
 *     * gamestate != GS_LEVEL -> silently ignore.
 *     * quickSaveSlot < 0 (no slot picked yet) -> open save menu in "pick quick save slot" mode (quickSaveSlot = -2).
 *     * Otherwise show QSPROMPT with the slot's description, await confirmation.
 *   - Quick load guards:
 *     * netgame -> QLOADNET popup, no advance.
 *     * quickSaveSlot < 0 (no slot picked) -> QSAVESPOT popup ("you haven't picked a quick save slot yet").
 *     * Otherwise show QLPROMPT with the slot's description, await confirmation.
 *   - quickSaveSlot is shared state between the two flows.
 *   - QSPROMPT / QLPROMPT contain a printf %s placeholder for the slot description.
 */

export interface QuickSaveInput {
  readonly usergame: boolean;
  readonly gamestate: 'GS_LEVEL' | 'GS_INTERMISSION' | 'GS_FINALE' | 'GS_DEMOSCREEN' | 'GS_TITLESCREEN';
  readonly quickSaveSlot: number;
}

export type VanillaQuickSaveResult = 'play-oof-sound' | 'ignored' | 'pick-slot' | 'confirm-prompt';

export function resolveVanillaQuickSaveAction(input: QuickSaveInput): VanillaQuickSaveResult {
  if (!input.usergame) {
    return 'play-oof-sound';
  }
  if (input.gamestate !== 'GS_LEVEL') {
    return 'ignored';
  }
  if (input.quickSaveSlot < 0) {
    return 'pick-slot';
  }
  return 'confirm-prompt';
}

export interface QuickLoadInput {
  readonly isNetgame: boolean;
  readonly quickSaveSlot: number;
}

export type VanillaQuickLoadResult = 'qloadnet-warning' | 'qsavespot-warning' | 'confirm-prompt';

export function resolveVanillaQuickLoadAction(input: QuickLoadInput): VanillaQuickLoadResult {
  if (input.isNetgame) {
    return 'qloadnet-warning';
  }
  if (input.quickSaveSlot < 0) {
    return 'qsavespot-warning';
  }
  return 'confirm-prompt';
}

export const VANILLA_QSPROMPT_KEY = 'QSPROMPT';
export const VANILLA_QLPROMPT_KEY = 'QLPROMPT';
export const VANILLA_QLOADNET_KEY = 'QLOADNET';
export const VANILLA_QSAVESPOT_KEY = 'QSAVESPOT';
export const VANILLA_QUICKSAVE_SENTINEL_PICK_SLOT = -2;
export const VANILLA_QUICKSAVE_SENTINEL_NO_SLOT = -1;
