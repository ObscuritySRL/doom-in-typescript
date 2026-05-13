/**
 * Vanilla DOOM 1.9 episode menu and shareware restriction contracts.
 *
 * From Chocolate Doom 2.2.1 m_menu.c:
 *
 *   menuitem_t EpisodeMenu[] =
 *   {
 *       {1, "M_EPI1", M_Episode, 'k'},   // Knee-Deep in the Dead
 *       {1, "M_EPI2", M_Episode, 't'},   // The Shores of Hell
 *       {1, "M_EPI3", M_Episode, 'i'},   // Inferno
 *       {1, "M_EPI4", M_Episode, 't'}    // Thy Flesh Consumed
 *   };
 *
 *   void M_Init(void)
 *   {
 *       switch (gamemode)
 *       {
 *         case shareware:   EpiDef.numitems = 1;  break;
 *         case registered:  EpiDef.numitems = 3;  break;
 *         case retail:      EpiDef.numitems = 4;  break;
 *         case commercial:  ...  // episode menu not used
 *       }
 *   }
 *
 *   void M_Episode(int choice)
 *   {
 *       if ((gamemode == shareware) && choice)
 *       {
 *           M_StartMessage(DEH_String(SWSTRING), NULL, false);
 *           M_SetupNextMenu(&ReadDef1);
 *           return;
 *       }
 *       epi = choice;
 *       M_SetupNextMenu(&NewDef);
 *   }
 *
 * Notes for parity:
 *   - The shareware menu shows ONE entry (Knee-Deep). Selecting it routes to the skill menu.
 *   - The "if choice" guard means "if any episode other than the first" — but the shareware
 *     menu only renders one entry, so this branch fires only via cheats / deh patches that
 *     re-enable hidden entries; the contract still pins it because vanilla code did.
 *   - Registered shows 3 entries (no Thy Flesh Consumed).
 *   - Retail (Ultimate Doom) shows all 4 entries.
 *   - Commercial (Doom II) does not use the episode menu at all.
 *   - The popup message uses the SWSTRING DeHackEd key.
 *   - The fallback menu after SWSTRING is ReadDef1 (the first "Read This" help page).
 */

export type VanillaEpisodeMenuGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export interface VanillaEpisodeMenuItem {
  readonly lumpName: string;
  readonly hotkey: string;
  readonly episodeIndex: number;
}

export type VanillaEpisodeSelectionResult = 'skill-menu' | 'shareware-warning';

const KNEE_DEEP: VanillaEpisodeMenuItem = Object.freeze({ lumpName: 'M_EPI1', hotkey: 'k', episodeIndex: 0 });
const SHORES: VanillaEpisodeMenuItem = Object.freeze({ lumpName: 'M_EPI2', hotkey: 't', episodeIndex: 1 });
const INFERNO: VanillaEpisodeMenuItem = Object.freeze({ lumpName: 'M_EPI3', hotkey: 'i', episodeIndex: 2 });
const THY_FLESH: VanillaEpisodeMenuItem = Object.freeze({ lumpName: 'M_EPI4', hotkey: 't', episodeIndex: 3 });

const SHAREWARE_TREE: readonly VanillaEpisodeMenuItem[] = Object.freeze([KNEE_DEEP]);
const REGISTERED_TREE: readonly VanillaEpisodeMenuItem[] = Object.freeze([KNEE_DEEP, SHORES, INFERNO]);
const RETAIL_TREE: readonly VanillaEpisodeMenuItem[] = Object.freeze([KNEE_DEEP, SHORES, INFERNO, THY_FLESH]);
const COMMERCIAL_TREE: readonly VanillaEpisodeMenuItem[] = Object.freeze([]);

export function getVanillaEpisodeMenuTree(gameMode: VanillaEpisodeMenuGameMode): readonly VanillaEpisodeMenuItem[] {
  switch (gameMode) {
    case 'shareware':
      return SHAREWARE_TREE;
    case 'registered':
      return REGISTERED_TREE;
    case 'retail':
      return RETAIL_TREE;
    case 'commercial':
      return COMMERCIAL_TREE;
    default: {
      const exhaustive: never = gameMode;
      throw new Error(`unreachable game mode ${String(exhaustive)}`);
    }
  }
}

export interface EpisodeChoiceInput {
  readonly gameMode: VanillaEpisodeMenuGameMode;
  readonly choice: number;
}

export function resolveVanillaEpisodeChoice(input: EpisodeChoiceInput): VanillaEpisodeSelectionResult {
  if (input.gameMode === 'shareware' && input.choice !== 0) {
    return 'shareware-warning';
  }
  return 'skill-menu';
}

export const VANILLA_EPISODE_SHAREWARE_MESSAGE_KEY = 'SWSTRING';
export const VANILLA_EPISODE_SHAREWARE_FALLBACK_MENU = 'ReadDef1';
