/**
 * Vanilla DOOM 1.9 skill (difficulty) menu contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c NewGameMenu and M_ChooseSkill:
 *
 *   enum
 *   {
 *       killthings,
 *       toorough,
 *       hurtme,
 *       violence,
 *       nightmare,
 *       newg_end
 *   } newgame_e;
 *
 *   menuitem_t NewGameMenu[] =
 *   {
 *       { 1, "M_JKILL",  M_ChooseSkill, 'i' },
 *       { 1, "M_ROUGH",  M_ChooseSkill, 'h' },
 *       { 1, "M_HURT",   M_ChooseSkill, 'h' },
 *       { 1, "M_ULTRA",  M_ChooseSkill, 'u' },
 *       { 1, "M_NMARE",  M_ChooseSkill, 'n' }
 *   };
 *
 *   void M_ChooseSkill(int choice)
 *   {
 *       if (choice == nightmare)
 *       {
 *           M_StartMessage(DEH_String(NIGHTMARE), M_VerifyNightmare, true);
 *           return;
 *       }
 *       G_DeferedInitNew(choice, epi+1, 1);
 *       M_ClearMenus();
 *   }
 *
 * Notes for parity:
 *   - Five skill entries in fixed order:
 *       0 killthings  -> "I'm too young to die!"  (M_JKILL,  hotkey i)
 *       1 toorough    -> "Hey, not too rough."     (M_ROUGH,  hotkey h)
 *       2 hurtme      -> "Hurt me plenty."         (M_HURT,   hotkey h)
 *       3 violence    -> "Ultra-Violence."         (M_ULTRA,  hotkey u)
 *       4 nightmare   -> "Nightmare!"              (M_NMARE,  hotkey n)
 *   - The default cursor position is `hurtme` (index 2). M_Init sets NewDef.lastOn = 2.
 *   - Nightmare requires Y/N confirmation via NIGHTMARE DeHackEd key and M_VerifyNightmare.
 *   - Non-nightmare picks call G_DeferedInitNew(choice, epi+1, 1) and M_ClearMenus.
 *   - The episode argument starts at 1-based (epi+1) for G_DeferedInitNew.
 */

export interface VanillaSkillMenuItem {
  readonly lumpName: string;
  readonly hotkey: string;
  readonly skillIndex: number;
}

export type VanillaSkillSelectionResult = 'start-game' | 'nightmare-confirm';

const TOO_YOUNG: VanillaSkillMenuItem = Object.freeze({ lumpName: 'M_JKILL', hotkey: 'i', skillIndex: 0 });
const NOT_TOO_ROUGH: VanillaSkillMenuItem = Object.freeze({ lumpName: 'M_ROUGH', hotkey: 'h', skillIndex: 1 });
const HURT_ME: VanillaSkillMenuItem = Object.freeze({ lumpName: 'M_HURT', hotkey: 'h', skillIndex: 2 });
const ULTRA_VIOLENCE: VanillaSkillMenuItem = Object.freeze({ lumpName: 'M_ULTRA', hotkey: 'u', skillIndex: 3 });
const NIGHTMARE: VanillaSkillMenuItem = Object.freeze({ lumpName: 'M_NMARE', hotkey: 'n', skillIndex: 4 });

export const VANILLA_SKILL_MENU_TREE: readonly VanillaSkillMenuItem[] = Object.freeze([TOO_YOUNG, NOT_TOO_ROUGH, HURT_ME, ULTRA_VIOLENCE, NIGHTMARE]);

export const VANILLA_SKILL_MENU_DEFAULT_CURSOR_INDEX = 2;
export const VANILLA_SKILL_NIGHTMARE_INDEX = 4;
export const VANILLA_SKILL_NIGHTMARE_MESSAGE_KEY = 'NIGHTMARE';
export const VANILLA_SKILL_NIGHTMARE_REQUIRES_CONFIRM = true;

export function getVanillaSkillMenuTree(): readonly VanillaSkillMenuItem[] {
  return VANILLA_SKILL_MENU_TREE;
}

export interface SkillSelectionInput {
  readonly choice: number;
}

export function resolveVanillaSkillSelection(input: SkillSelectionInput): VanillaSkillSelectionResult {
  return input.choice === VANILLA_SKILL_NIGHTMARE_INDEX ? 'nightmare-confirm' : 'start-game';
}

export interface NewGameDeferralArgs {
  readonly skill: number;
  readonly episodeOneBased: number;
  readonly map: number;
}

export function deriveVanillaDeferedInitNewArgs(zeroBasedEpisode: number, choice: number): NewGameDeferralArgs {
  return Object.freeze({
    skill: choice,
    episodeOneBased: zeroBasedEpisode + 1,
    map: 1,
  });
}
