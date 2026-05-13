/**
 * Vanilla DOOM 1.9 main menu tree contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c MainMenu and M_Init:
 *
 *   menuitem_t MainMenu[] =
 *   {
 *       { 1, "M_NGAME",   M_NewGame,   'n' },
 *       { 1, "M_OPTION",  M_Options,   'o' },
 *       { 1, "M_LOADG",   M_LoadGame,  'l' },
 *       { 1, "M_SAVEG",   M_SaveGame,  's' },
 *       { 1, "M_RDTHIS",  M_ReadThis,  'r' },   // shareware/registered only
 *       { 1, "M_QUITG",   M_QuitDOOM,  'q' }
 *   };
 *
 *   void M_Init (void)
 *   {
 *       ...
 *       switch (gamemode)
 *       {
 *         case commercial:
 *             MainDef.numitems = main_end - 1;  // drop READTHIS
 *             ...
 *             break;
 *         case retail:
 *             MainMenu[readthis].routine = M_ReadThis;  // (Ultimate Doom uses credits screen)
 *             break;
 *         default:
 *             break;
 *       }
 *   }
 *
 * Notes for parity:
 *   - Order is FIXED: newgame, options, loadgame, savegame, readthis, quitdoom.
 *   - Commercial (Doom II) drops the readthis entry, leaving 5 items.
 *   - Shareware, registered, retail (Ultimate Doom) all keep 6 items.
 *   - The lump names are exact (M_NGAME, M_OPTION, M_LOADG, M_SAVEG, M_RDTHIS, M_QUITG).
 *   - Each item has a one-character hotkey: n, o, l, s, r, q.
 *   - The leading `1` byte in each menuitem is the "status" flag (1 = enabled).
 */

export type VanillaMainMenuGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export type VanillaMainMenuRoutine = 'M_NewGame' | 'M_Options' | 'M_LoadGame' | 'M_SaveGame' | 'M_ReadThis' | 'M_QuitDOOM';

export interface VanillaMainMenuItem {
  readonly lumpName: string;
  readonly routine: VanillaMainMenuRoutine;
  readonly hotkey: string;
  readonly enabled: boolean;
}

const NEW_GAME: VanillaMainMenuItem = Object.freeze({ lumpName: 'M_NGAME', routine: 'M_NewGame', hotkey: 'n', enabled: true });
const OPTIONS: VanillaMainMenuItem = Object.freeze({ lumpName: 'M_OPTION', routine: 'M_Options', hotkey: 'o', enabled: true });
const LOAD_GAME: VanillaMainMenuItem = Object.freeze({ lumpName: 'M_LOADG', routine: 'M_LoadGame', hotkey: 'l', enabled: true });
const SAVE_GAME: VanillaMainMenuItem = Object.freeze({ lumpName: 'M_SAVEG', routine: 'M_SaveGame', hotkey: 's', enabled: true });
const READ_THIS: VanillaMainMenuItem = Object.freeze({ lumpName: 'M_RDTHIS', routine: 'M_ReadThis', hotkey: 'r', enabled: true });
const QUIT_DOOM: VanillaMainMenuItem = Object.freeze({ lumpName: 'M_QUITG', routine: 'M_QuitDOOM', hotkey: 'q', enabled: true });

const NON_COMMERCIAL_TREE: readonly VanillaMainMenuItem[] = Object.freeze([NEW_GAME, OPTIONS, LOAD_GAME, SAVE_GAME, READ_THIS, QUIT_DOOM]);
const COMMERCIAL_TREE: readonly VanillaMainMenuItem[] = Object.freeze([NEW_GAME, OPTIONS, LOAD_GAME, SAVE_GAME, QUIT_DOOM]);

export function getVanillaMainMenuTree(gameMode: VanillaMainMenuGameMode): readonly VanillaMainMenuItem[] {
  return gameMode === 'commercial' ? COMMERCIAL_TREE : NON_COMMERCIAL_TREE;
}

export function getVanillaMainMenuItemCount(gameMode: VanillaMainMenuGameMode): number {
  return getVanillaMainMenuTree(gameMode).length;
}
