/**
 * Vanilla DOOM 1.9 end-game confirmation contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_EndGame / M_EndGameResponse:
 *
 *   void M_EndGame(int choice)
 *   {
 *       choice = 0;
 *       if (!usergame)
 *       {
 *           S_StartSound(NULL, sfx_oof);
 *           return;
 *       }
 *       if (netgame)
 *       {
 *           M_StartMessage(DEH_String(NETEND), NULL, false);
 *           return;
 *       }
 *       M_StartMessage(DEH_String(ENDGAME), M_EndGameResponse, true);
 *   }
 *
 *   void M_EndGameResponse(int key)
 *   {
 *       if (key != key_menu_confirm)
 *           return;
 *       currentMenu->lastOn = itemOn;
 *       M_ClearMenus();
 *       D_StartTitle();
 *   }
 *
 * Notes for parity:
 *   - !usergame: play sfx_oof (sound 10), do NOT show any popup.
 *   - netgame: show NETEND popup (cannot end while in a net link), do not advance.
 *   - Single-player: show ENDGAME popup with confirmation gate.
 *   - On confirm: clear menu stack, call D_StartTitle (return to title attract loop).
 *   - On non-confirm key: stay in game, dismiss popup.
 *   - sfx_oof DeHackEd enum value is sfx_oof (index varies; the index is exposed via
 *     the sounds.h enum and is the same as the "ow!" pain sound the player makes).
 */

export type VanillaEndGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export interface EndGameEntryInput {
  readonly usergame: boolean;
  readonly isNetgame: boolean;
}

export type VanillaEndGameEntryResult = 'play-oof-sound' | 'netend-warning' | 'endgame-confirm';

export function resolveVanillaEndGameEntry(input: EndGameEntryInput): VanillaEndGameEntryResult {
  if (!input.usergame) {
    return 'play-oof-sound';
  }
  if (input.isNetgame) {
    return 'netend-warning';
  }
  return 'endgame-confirm';
}

export interface EndGameResponseInput {
  readonly key: string;
  readonly menuConfirmKey: string;
}

export type VanillaEndGameResponseResult = 'cancel' | 'return-to-title';

export function resolveVanillaEndGameResponse(input: EndGameResponseInput): VanillaEndGameResponseResult {
  return input.key === input.menuConfirmKey ? 'return-to-title' : 'cancel';
}

export const VANILLA_ENDGAME_MESSAGE_KEY = 'ENDGAME';
export const VANILLA_NETEND_MESSAGE_KEY = 'NETEND';
export const VANILLA_ENDGAME_OOF_SOUND_KEY = 'sfx_oof';
