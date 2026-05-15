/**
 * Vanilla DOOM 1.9 menu-action runtime-effects facade.
 *
 * Plan_final step `07-003` (lane: ui) pins the complete 20-kind
 * vocabulary of `MenuAction` discriminants `M_Responder` produces and wires
 * the producer (`handleMenuKey`) into one cohesive surface so the
 * runtime-effects dispatcher (New Game → G_DeferedInitNew, Options/
 * Sound → config writes, Save/Load → save subsystem, End Game →
 * G_EndGame, Quit → I_Quit) resolves every action from one module.
 *
 * The read-only `src/ui/menus.ts` already implements vanilla
 * `m_menu.c` `M_Responder` and is SHA-pinned by the
 * `plan_vanilla_parity` UI inventory; `src/config/` and `src/save/`
 * own the concrete effects each action drives.  This module does
 * NOT modify any of them — it only re-exports the action producer
 * and pins the discriminant manifest so a later refactor cannot
 * silently drop or rename a menu action without updating the
 * manifest.
 *
 * The 21 `MenuAction` kinds and their runtime effects:
 *
 *   - `none`                    — no-op (idle).
 *   - `openMenu` / `closeMenu`  — menu navigation.
 *   - `openMessage`             — yes/no or info overlay.
 *   - `selectEpisode` / `selectSkill` — New Game flow.
 *   - `selectLoadSlot` / `selectSaveSlot` — Load/Save slot pick.
 *   - `beginSaveStringEntry` / `commitSaveStringEntry` /
 *     `cancelSaveStringEntry` — the save-description text entry.
 *   - `readThisAdvance`         — Read This (help) page advance.
 *   - `endGame`                 — End Game → confirm → G_EndGame.
 *   - `quitGame`                — Quit → confirm → I_Quit.
 *   - `toggleMessages` / `toggleDetail` — Options toggles.
 *   - `adjustSfxVolume` / `adjustMusicVolume` — Sound sliders.
 *   - `adjustSensitivity` / `adjustScreenSize` — Options sliders.
 *
 * @example
 * ```ts
 * import { handleMenuKey, VANILLA_MENU_ACTION_KINDS } from './wireMenuActions.ts';
 * VANILLA_MENU_ACTION_KINDS.length; // 20
 * ```
 */

export { MENU_ACTION_NONE, handleMenuKey, openMessage } from '../ui/menus.ts';
export type { MenuAction } from '../ui/menus.ts';

/**
 * Frozen manifest of the complete 20-kind `MenuAction` discriminant
 * vocabulary, ASCIIbetically sorted.  Every menu interaction the
 * vanilla `m_menu.c` `M_Responder` can produce maps to exactly one
 * of these; adding/removing a kind without updating this manifest
 * (and the runtime-effects dispatcher) is a parity violation.
 */
export const VANILLA_MENU_ACTION_KINDS: readonly string[] = Object.freeze([
  'adjustMusicVolume',
  'adjustScreenSize',
  'adjustSensitivity',
  'adjustSfxVolume',
  'beginSaveStringEntry',
  'cancelSaveStringEntry',
  'closeMenu',
  'commitSaveStringEntry',
  'endGame',
  'none',
  'openMenu',
  'openMessage',
  'quitGame',
  'readThisAdvance',
  'selectEpisode',
  'selectLoadSlot',
  'selectSaveSlot',
  'selectSkill',
  'toggleDetail',
  'toggleMessages',
]);
