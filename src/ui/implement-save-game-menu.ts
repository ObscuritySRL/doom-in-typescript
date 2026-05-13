/**
 * Vanilla DOOM 1.9 save game menu contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c SaveMenu and M_SaveGame:
 *
 *   enum
 *   {
 *       load1, load2, load3, load4, load5, load6,
 *       load_end
 *   } load_e;
 *
 *   menuitem_t SaveMenu[] =
 *   {
 *       {1, "", M_SaveSelect, '1'},
 *       {1, "", M_SaveSelect, '2'},
 *       {1, "", M_SaveSelect, '3'},
 *       {1, "", M_SaveSelect, '4'},
 *       {1, "", M_SaveSelect, '5'},
 *       {1, "", M_SaveSelect, '6'}
 *   };
 *
 *   void M_SaveGame(int choice)
 *   {
 *       if (!usergame)
 *       {
 *           M_StartMessage(DEH_String(SAVEDEAD), NULL, false);
 *           return;
 *       }
 *       if (gamestate != GS_LEVEL)
 *           return;
 *       M_SetupNextMenu(&SaveDef);
 *       M_ReadSaveStrings();
 *   }
 *
 * Notes for parity:
 *   - 6 fixed save slots, hotkeys '1'..'6'.
 *   - Each slot has an empty lump name (the slot row is drawn as the savegame
 *     description text, not as an image).
 *   - All slots use status byte 1 (normal selectable).
 *   - Vanilla SAVESTRINGSIZE is 24 characters for the save description.
 *   - Selecting "Save" from the options menu while not in an active game (usergame=false)
 *     shows the SAVEDEAD message ("you can't save if you aren't playing!") and stops.
 *   - The save menu is only reachable while gamestate == GS_LEVEL.
 */

export interface VanillaSaveSlot {
  readonly slotIndex: number;
  readonly hotkey: string;
  readonly routine: 'M_SaveSelect';
  readonly statusByte: number;
}

export const VANILLA_SAVE_SLOT_COUNT = 6;
export const VANILLA_SAVE_STRING_SIZE = 24;
export const VANILLA_SAVE_DEAD_MESSAGE_KEY = 'SAVEDEAD';

const SLOTS: readonly VanillaSaveSlot[] = Object.freeze([
  Object.freeze({ slotIndex: 0, hotkey: '1', routine: 'M_SaveSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 1, hotkey: '2', routine: 'M_SaveSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 2, hotkey: '3', routine: 'M_SaveSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 3, hotkey: '4', routine: 'M_SaveSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 4, hotkey: '5', routine: 'M_SaveSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 5, hotkey: '6', routine: 'M_SaveSelect' as const, statusByte: 1 }),
]);

export function getVanillaSaveMenuSlots(): readonly VanillaSaveSlot[] {
  return SLOTS;
}

export interface SaveMenuEntryInput {
  readonly usergame: boolean;
  readonly gamestate: 'GS_LEVEL' | 'GS_INTERMISSION' | 'GS_FINALE' | 'GS_DEMOSCREEN' | 'GS_TITLESCREEN';
}

export type SaveMenuEntryResult = 'save-menu' | 'save-dead-warning' | 'ignored';

export function resolveVanillaSaveMenuEntry(input: SaveMenuEntryInput): SaveMenuEntryResult {
  if (!input.usergame) {
    return 'save-dead-warning';
  }
  if (input.gamestate !== 'GS_LEVEL') {
    return 'ignored';
  }
  return 'save-menu';
}

export function clampVanillaSaveDescription(description: string): string {
  if (description.length <= VANILLA_SAVE_STRING_SIZE) {
    return description;
  }
  return description.slice(0, VANILLA_SAVE_STRING_SIZE);
}
