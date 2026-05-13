/**
 * Vanilla DOOM 1.9 "Read This" help-page sequence contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_ReadThis / M_ReadThis2 / M_FinishReadThis / M_Init:
 *
 *   void M_ReadThis(int choice)
 *   {
 *       choice = 0;
 *       M_SetupNextMenu(&ReadDef1);
 *   }
 *
 *   void M_ReadThis2(int choice)
 *   {
 *       choice = 0;
 *       M_SetupNextMenu(&ReadDef2);
 *   }
 *
 *   void M_FinishReadThis(int choice)
 *   {
 *       choice = 0;
 *       M_SetupNextMenu(&MainDef);
 *   }
 *
 *   void M_Init(void)
 *   {
 *       switch (gamemode)
 *       {
 *         case retail:
 *             // The Ultimate Doom changes the second help screen.
 *             // ReadMenu1 routine drops directly to MainMenu.
 *             ReadMenu1[rdthsempty1].routine = M_FinishReadThis;
 *             break;
 *         case shareware:
 *         case registered:
 *             // 2 help pages (HELP1, HELP2) then back to main.
 *             break;
 *         case commercial:
 *             MainDef.numitems = main_end - 1;  // Doom II has no Read This.
 *             break;
 *       }
 *   }
 *
 * Notes for parity:
 *   - Shareware and registered: HELP1 -> HELP2 -> MainDef (2 help screens).
 *   - Retail (Ultimate Doom): HELP1 -> MainDef (only 1 help screen; M_FinishReadThis fires directly).
 *   - Commercial (Doom II): the "Read This" main-menu entry is removed entirely; no help screens
 *     are reachable from the menu (F1 in-game shows HELP1 only).
 *   - The help screens themselves are full-screen image lumps: HELP1 (160x100 patch),
 *     HELP2 (160x100 patch). For Ultimate Doom the upstream version of HELP1 differs
 *     visually but the menu sequence is HELP1 only.
 *   - The page advance is triggered by any key press or click while in ReadDef1/ReadDef2.
 */

export type VanillaReadThisGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export type VanillaReadThisPageId = 'HELP1' | 'HELP2';

export interface VanillaReadThisSequence {
  readonly pages: readonly VanillaReadThisPageId[];
  readonly returnsToMainMenu: boolean;
}

const SHAREWARE_SEQUENCE: VanillaReadThisSequence = Object.freeze({
  pages: Object.freeze(['HELP1', 'HELP2'] as const),
  returnsToMainMenu: true,
});

const RETAIL_SEQUENCE: VanillaReadThisSequence = Object.freeze({
  pages: Object.freeze(['HELP1'] as const),
  returnsToMainMenu: true,
});

const COMMERCIAL_SEQUENCE: VanillaReadThisSequence = Object.freeze({
  pages: Object.freeze([] as const),
  returnsToMainMenu: true,
});

export function getVanillaReadThisSequence(gameMode: VanillaReadThisGameMode): VanillaReadThisSequence {
  switch (gameMode) {
    case 'shareware':
    case 'registered':
      return SHAREWARE_SEQUENCE;
    case 'retail':
      return RETAIL_SEQUENCE;
    case 'commercial':
      return COMMERCIAL_SEQUENCE;
    default: {
      const exhaustive: never = gameMode;
      throw new Error(`unreachable game mode ${String(exhaustive)}`);
    }
  }
}

export function vanillaReadThisIsReachableFromMainMenu(gameMode: VanillaReadThisGameMode): boolean {
  return gameMode !== 'commercial';
}

export function advanceVanillaReadThisPage(sequence: VanillaReadThisSequence, currentIndex: number): 'next-page' | 'main-menu' {
  return currentIndex + 1 < sequence.pages.length ? 'next-page' : 'main-menu';
}
