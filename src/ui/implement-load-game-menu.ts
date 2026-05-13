/**
 * Vanilla DOOM 1.9 load game menu contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c LoadMenu and M_LoadGame:
 *
 *   menuitem_t LoadMenu[] =
 *   {
 *       {1, "", M_LoadSelect, '1'},
 *       {1, "", M_LoadSelect, '2'},
 *       {1, "", M_LoadSelect, '3'},
 *       {1, "", M_LoadSelect, '4'},
 *       {1, "", M_LoadSelect, '5'},
 *       {1, "", M_LoadSelect, '6'}
 *   };
 *
 *   void M_LoadGame(int choice)
 *   {
 *       if (netgame)
 *       {
 *           M_StartMessage(DEH_String(LOADNET), NULL, false);
 *           return;
 *       }
 *       M_SetupNextMenu(&LoadDef);
 *       M_ReadSaveStrings();
 *   }
 *
 * Notes for parity:
 *   - 6 fixed slots identical in structure to the save menu (hotkeys 1..6).
 *   - Each slot routes to M_LoadSelect; all status bytes are 1.
 *   - Netgame guard: cannot load over a net link; shows LOADNET popup and stops.
 *   - Demo playback does NOT bypass the netgame guard for load (unlike M_NewGame).
 *   - Load menu is reachable from any state (title, options, in-game) as long as
 *     not netgame; M_ReadSaveStrings populates each slot's description from the
 *     savegame files on disk.
 */

export interface VanillaLoadSlot {
  readonly slotIndex: number;
  readonly hotkey: string;
  readonly routine: 'M_LoadSelect';
  readonly statusByte: number;
}

export const VANILLA_LOAD_SLOT_COUNT = 6;
export const VANILLA_LOAD_NET_MESSAGE_KEY = 'LOADNET';

const SLOTS: readonly VanillaLoadSlot[] = Object.freeze([
  Object.freeze({ slotIndex: 0, hotkey: '1', routine: 'M_LoadSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 1, hotkey: '2', routine: 'M_LoadSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 2, hotkey: '3', routine: 'M_LoadSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 3, hotkey: '4', routine: 'M_LoadSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 4, hotkey: '5', routine: 'M_LoadSelect' as const, statusByte: 1 }),
  Object.freeze({ slotIndex: 5, hotkey: '6', routine: 'M_LoadSelect' as const, statusByte: 1 }),
]);

export function getVanillaLoadMenuSlots(): readonly VanillaLoadSlot[] {
  return SLOTS;
}

export type LoadMenuEntryResult = 'load-menu' | 'load-net-warning';

export function resolveVanillaLoadMenuEntry(isNetgame: boolean): LoadMenuEntryResult {
  return isNetgame ? 'load-net-warning' : 'load-menu';
}
