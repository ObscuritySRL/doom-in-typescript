/**
 * Vanilla DOOM 1.9 save/load slot-UI wiring facade.
 *
 * Plan_final step `12-003` (lane: save-config-demo) wires the
 * save/load slot descriptions, slot selection, quicksave /
 * quickload, and the associated HUD messages: the
 * `src/save/define-save-directory-policy.ts` slot-file policy, the
 * `src/save/implement-save-slot-descriptions.ts` 24-byte
 * description codec, and the `src/ui/menus.ts` save/load menu
 * vocabulary (the `MenuAction` kinds pinned by `07-003`).
 *
 * The read-only modules already implement the per-piece behavior
 * byte-for-byte and are SHA-pinned by the inventory; this module
 * does NOT modify them.  It is a pure re-export barrel (value/type
 * split for `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. There are `VANILLA_SAVE_SLOT_COUNT` = 6 save slots, each
 *      `doomsav<N>.dsg`; `isVanillaSaveSlotFilename` recognises only
 *      that exact form.
 *   2. A save is staged through `VANILLA_SAVE_STAGING_FILENAME` =
 *      `temp.dsg` before being committed to the slot file.
 *   3. The save description is a `VANILLA_SAVE_STRING_SIZE` = 24-byte
 *      buffer (23 user chars + NUL) restricted to printable ASCII
 *      `[0x20, 0x7e]`; `encode`/`decode` round-trip exactly.
 *   4. An empty slot renders the `VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL`
 *      = `EMPTY` label.
 *   5. Slot selection, quicksave, quickload and the save-name text
 *      entry are driven by the `07-003` `MenuAction` kinds
 *      (selectLoadSlot / selectSaveSlot / beginSaveStringEntry /
 *      commitSaveStringEntry / cancelSaveStringEntry).
 *
 * @example
 * ```ts
 * import { encodeVanillaSaveDescription, decodeVanillaSaveDescription, VANILLA_SAVE_SLOT_UI_INVARIANTS } from './wireSaveSlotUi.ts';
 * decodeVanillaSaveDescription(encodeVanillaSaveDescription('MY GAME')); // 'MY GAME'
 * VANILLA_SAVE_SLOT_UI_INVARIANTS.length;                                // 5
 * ```
 */

export {
  VANILLA_SAVEGAME_NAME_SIZE,
  VANILLA_SAVE_DIRECTORY_MODE,
  VANILLA_SAVE_DIRECTORY_NAMES_BY_PLATFORM,
  VANILLA_SAVE_SLOT_COUNT,
  VANILLA_SAVE_SLOT_FILENAME_EXTENSION,
  VANILLA_SAVE_SLOT_FILENAME_PREFIX,
  VANILLA_SAVE_STAGING_FILENAME,
  isVanillaSaveSlotFilename,
  vanillaSaveDirectoryPathSegments,
  vanillaSaveSlotFilename,
} from '../save/define-save-directory-policy.ts';
export {
  VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL,
  VANILLA_SAVE_STRING_PRINTABLE_ASCII_MAX,
  VANILLA_SAVE_STRING_PRINTABLE_ASCII_MIN,
  VANILLA_SAVE_STRING_SIZE,
  VANILLA_SAVE_STRING_USER_INPUT_MAX,
  decodeVanillaSaveDescription,
  encodeVanillaSaveDescription,
  isVanillaSaveDescriptionCharacter,
  isVanillaSaveSlotEmpty,
  vanillaSaveSlotMenuLabel,
} from '../save/implement-save-slot-descriptions.ts';
export { SAVESTRINGSIZE } from '../ui/menus.ts';
export type { MenuAction } from '../ui/menus.ts';

/**
 * One pinned save/load slot-UI parity invariant.
 */
export interface VanillaSaveSlotUiInvariant {
  readonly id: 'EMPTY_SLOT_LABEL_IS_EMPTY' | 'QUICKSAVE_QUICKLOAD_AND_SLOT_SELECT_VIA_MENU_ACTIONS' | 'SAVE_DESCRIPTION_IS_24_BYTES_23_PRINTABLE_ASCII' | 'SAVE_SLOTS_ARE_SIX_DOOMSAV_DSG_FILES' | 'SAVE_STAGING_USES_TEMP_DSG';
  readonly rule: string;
}

/**
 * Frozen manifest of the five save/load slot-UI parity invariants
 * this step pins.  A later step that wires the live save/load menu
 * input must preserve all five.
 */
export const VANILLA_SAVE_SLOT_UI_INVARIANTS: readonly VanillaSaveSlotUiInvariant[] = Object.freeze([
  Object.freeze({
    id: 'EMPTY_SLOT_LABEL_IS_EMPTY',
    rule: 'An empty save slot renders VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL = "EMPTY" (isVanillaSaveSlotEmpty true), matching vanilla m_menu.c empty-slot rendering.',
  } satisfies VanillaSaveSlotUiInvariant),
  Object.freeze({
    id: 'QUICKSAVE_QUICKLOAD_AND_SLOT_SELECT_VIA_MENU_ACTIONS',
    rule: 'Slot selection, quicksave, quickload, and the save-name text entry are driven by the 07-003 MenuAction kinds (selectLoadSlot / selectSaveSlot / beginSaveStringEntry / commitSaveStringEntry / cancelSaveStringEntry) with the SAVESTRINGSIZE = 24 buffer.',
  } satisfies VanillaSaveSlotUiInvariant),
  Object.freeze({
    id: 'SAVE_DESCRIPTION_IS_24_BYTES_23_PRINTABLE_ASCII',
    rule: 'The save description is a VANILLA_SAVE_STRING_SIZE = 24-byte buffer (VANILLA_SAVE_STRING_USER_INPUT_MAX = 23 user chars + NUL) restricted to printable ASCII [VANILLA_SAVE_STRING_PRINTABLE_ASCII_MIN 0x20, VANILLA_SAVE_STRING_PRINTABLE_ASCII_MAX 0x7e]; encode/decode round-trip exactly.',
  } satisfies VanillaSaveSlotUiInvariant),
  Object.freeze({
    id: 'SAVE_SLOTS_ARE_SIX_DOOMSAV_DSG_FILES',
    rule: 'There are VANILLA_SAVE_SLOT_COUNT = 6 slots, file name VANILLA_SAVE_SLOT_FILENAME_PREFIX (doomsav) + index + VANILLA_SAVE_SLOT_FILENAME_EXTENSION (.dsg); isVanillaSaveSlotFilename recognises only that exact form.',
  } satisfies VanillaSaveSlotUiInvariant),
  Object.freeze({
    id: 'SAVE_STAGING_USES_TEMP_DSG',
    rule: 'A save is written through VANILLA_SAVE_STAGING_FILENAME = temp.dsg before being committed to the destination slot file, matching the vanilla two-step write.',
  } satisfies VanillaSaveSlotUiInvariant),
]);
