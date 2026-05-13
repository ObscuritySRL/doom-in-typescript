/**
 * Vanilla DOOM 1.9 quit-confirmation contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_QuitDOOM / M_QuitResponse:
 *
 *   void M_QuitDOOM(int choice)
 *   {
 *       sprintf(endstring, "%s\n\n%s",
 *               DEH_String(endmsg[gametic % (NUM_QUITMESSAGES - 1) + 1]),
 *               DEH_String(DOSY));
 *       M_StartMessage(endstring, M_QuitResponse, true);
 *   }
 *
 *   void M_QuitResponse(int key)
 *   {
 *       if (key != key_menu_confirm)
 *           return;
 *       if (!netgame)
 *       {
 *           if (gamemode == commercial)
 *               S_StartSound(NULL, quitsounds2[(gametic >> 2) & 7]);
 *           else
 *               S_StartSound(NULL, quitsounds[(gametic >> 2) & 7]);
 *           I_WaitVBL(105);
 *       }
 *       I_Quit();
 *   }
 *
 * Notes for parity:
 *   - NUM_QUITMESSAGES is 22 in upstream Chocolate Doom 2.2.1 (covering both
 *     Doom 1 and Doom 2 message banks). The picker formula uses NUM_QUITMESSAGES-1
 *     so the indexed range is endmsg[1..NUM_QUITMESSAGES-1].
 *   - The quit message is picked from endmsg[gametic % (NUM_QUITMESSAGES-1) + 1] —
 *     deterministic given the current tic counter at the moment of the prompt.
 *   - The response is gated on a single confirmation key (key_menu_confirm); any
 *     other key cancels the prompt.
 *   - On confirm in single-player: play one of 8 quit sounds picked by (gametic >> 2) & 7,
 *     wait 105 vblank ticks (~3 seconds), then exit. Commercial uses quitsounds2[];
 *     non-commercial uses quitsounds[].
 *   - Netgame skips the sound + wait and exits immediately.
 *   - The DOSY string (DeHackEd key) is the localized "press Y to quit" hint
 *     appended after a blank line.
 *   - The quit-sound table has exactly 8 entries; the bit-mask (& 7) is critical.
 */

export type VanillaQuitGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export const VANILLA_NUM_QUITMESSAGES = 22;
export const VANILLA_QUIT_SOUND_TABLE_SIZE = 8;
export const VANILLA_QUIT_WAIT_VBL_TICS = 105;
export const VANILLA_QUIT_PROMPT_DOSY_KEY = 'DOSY';

export interface QuitMessagePickInput {
  readonly gametic: number;
}

export function pickVanillaQuitMessageIndex(input: QuitMessagePickInput): number {
  return (input.gametic % (VANILLA_NUM_QUITMESSAGES - 1)) + 1;
}

export interface QuitSoundPickInput {
  readonly gametic: number;
  readonly gameMode: VanillaQuitGameMode;
}

export interface QuitSoundResult {
  readonly tableKind: 'quitsounds' | 'quitsounds2';
  readonly index: number;
}

export function pickVanillaQuitSound(input: QuitSoundPickInput): QuitSoundResult {
  return Object.freeze({
    tableKind: input.gameMode === 'commercial' ? 'quitsounds2' : 'quitsounds',
    index: (input.gametic >> 2) & 7,
  });
}

export interface QuitResponseInput {
  readonly key: string;
  readonly menuConfirmKey: string;
  readonly isNetgame: boolean;
}

export type VanillaQuitResponseResult = 'cancel' | 'exit-immediately' | 'play-sound-then-exit';

export function resolveVanillaQuitResponse(input: QuitResponseInput): VanillaQuitResponseResult {
  if (input.key !== input.menuConfirmKey) {
    return 'cancel';
  }
  return input.isNetgame ? 'exit-immediately' : 'play-sound-then-exit';
}
