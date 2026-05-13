/**
 * Vanilla DOOM 1.9 menu and HUD parity gate.
 *
 * Re-exports the canonical contracts pinned by 10-001 through 10-021 + 10-026
 * so a single import verifies that the menu and HUD surface is wired together
 * and parity-consistent. Acts as a "smoke test" composite for the menu lane.
 */

export { advanceVanillaTitleSequence, computeVanillaTitleStep, VANILLA_TITLE_CYCLE_LENGTH } from './implement-title-loop-sequence.ts';
export { requestVanillaAdvanceDemo, tickVanillaPagetic } from './implement-page-ticker-and-advance-demo.ts';
export { getVanillaMainMenuItemCount, getVanillaMainMenuTree } from './implement-main-menu-tree.ts';
export { resolveVanillaNewGameRoute } from './implement-new-game-menu.ts';
export { getVanillaEpisodeMenuTree, resolveVanillaEpisodeChoice } from './implement-episode-menu-shareware-restrictions.ts';
export { deriveVanillaDeferedInitNewArgs, getVanillaSkillMenuTree, resolveVanillaSkillSelection, VANILLA_SKILL_MENU_DEFAULT_CURSOR_INDEX } from './implement-skill-menu.ts';
export { getVanillaOptionsMenuTree, VANILLA_OPTIONS_ENTRY_COUNT } from './implement-options-menu.ts';
export { clampVanillaSoundVolume, getVanillaSoundVolumeMenuTree, VANILLA_SOUND_VOLUME_MAX, VANILLA_SOUND_VOLUME_MIN } from './implement-sound-volume-menu.ts';
export { applyVanillaSizeDisplay, cycleVanillaGamma, toggleVanillaDetail } from './implement-screen-size-detail-gamma-menu.ts';
export { clampVanillaSaveDescription, getVanillaSaveMenuSlots, resolveVanillaSaveMenuEntry, VANILLA_SAVE_STRING_SIZE } from './implement-save-game-menu.ts';
export { getVanillaLoadMenuSlots, resolveVanillaLoadMenuEntry } from './implement-load-game-menu.ts';
export { advanceVanillaReadThisPage, getVanillaReadThisSequence } from './implement-read-this-help-pages.ts';
export { pickVanillaQuitMessageIndex, pickVanillaQuitSound, resolveVanillaQuitResponse, VANILLA_NUM_QUITMESSAGES } from './implement-quit-confirmation.ts';
export { resolveVanillaEndGameEntry, resolveVanillaEndGameResponse } from './implement-end-game-confirmation.ts';
export { resolveVanillaQuickLoadAction, resolveVanillaQuickSaveAction } from './implement-quick-save-and-quick-load-prompts.ts';
export { getVanillaSkullLumpForFrame, tickVanillaSkullCursor, VANILLA_SKULL_ANIM_RESET_TICS } from './implement-menu-skull-cursor-timing.ts';
export { getVanillaMenuSfx, listVanillaMenuSoundEvents } from './implement-menu-sound-events.ts';
export { classifyVanillaMouseVerticalDelta, computeVanillaMenuWaitUntil, vanillaMenuInputIsGated, VANILLA_MENU_JOYWAIT_TICS } from './implement-menu-repeat-timing.ts';
export { resolveVanillaPauseOverlay, VANILLA_PAUSE_LUMP_NAME } from './implement-pause-overlay.ts';
export { tickVanillaHudMessageQueue, VANILLA_HU_MSGTIMEOUT_TICS } from './implement-hud-message-queue.ts';
export { getVanillaChatMacroConfigKey, getVanillaChatMacroDefault, VANILLA_CHAT_MACRO_COUNT } from './implement-chat-macro-storage-for-config-compatibility.ts';
export { getVanillaMenuNavigationOracle, VANILLA_MENU_NAVIGATION_ORACLES } from './compare-menu-navigation-oracles.ts';

import { VANILLA_TITLE_CYCLE_LENGTH } from './implement-title-loop-sequence.ts';
import { getVanillaMainMenuItemCount } from './implement-main-menu-tree.ts';

export interface VanillaMenuAndHudGateInvariants {
  readonly titleCycleLength: 6;
  readonly mainMenuNonCommercialItemCount: 6;
  readonly mainMenuCommercialItemCount: 5;
}

export const VANILLA_MENU_AND_HUD_GATE_INVARIANTS: VanillaMenuAndHudGateInvariants = Object.freeze({
  titleCycleLength: 6,
  mainMenuNonCommercialItemCount: 6,
  mainMenuCommercialItemCount: 5,
});

export function assertVanillaMenuAndHudGateInvariants(): void {
  if (VANILLA_TITLE_CYCLE_LENGTH !== VANILLA_MENU_AND_HUD_GATE_INVARIANTS.titleCycleLength) {
    throw new Error(`title cycle length mismatch: ${VANILLA_TITLE_CYCLE_LENGTH}`);
  }
  const sharewareItems = getVanillaMainMenuItemCount('shareware');
  if (sharewareItems !== VANILLA_MENU_AND_HUD_GATE_INVARIANTS.mainMenuNonCommercialItemCount) {
    throw new Error(`main menu non-commercial item count mismatch: ${sharewareItems}`);
  }
  const commercialItems = getVanillaMainMenuItemCount('commercial');
  if (commercialItems !== VANILLA_MENU_AND_HUD_GATE_INVARIANTS.mainMenuCommercialItemCount) {
    throw new Error(`main menu commercial item count mismatch: ${commercialItems}`);
  }
}
