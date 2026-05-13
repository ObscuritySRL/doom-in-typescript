/**
 * Vanilla DOOM 1.9 options menu contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c OptionsMenu:
 *
 *   enum
 *   {
 *       endgame, messages, detail, scrnsize,
 *       option_empty1, mousesens, option_empty2, soundvol,
 *       opt_end
 *   } options_e;
 *
 *   menuitem_t OptionsMenu[] =
 *   {
 *       { 1, "M_ENDGAM", M_EndGame,           'e' },
 *       { 1, "M_MESSG",  M_ChangeMessages,    'm' },
 *       { 1, "M_DETAIL", M_ChangeDetail,      'g' },
 *       { 2, "M_SCRNSZ", M_SizeDisplay,       's' },
 *       {-1, "",          0,                   0 },
 *       { 2, "M_MSENS",  M_ChangeSensitivity, 'm' },
 *       {-1, "",          0,                   0 },
 *       { 1, "M_SVOL",   M_Sound,             's' }
 *   };
 *
 * Notes for parity:
 *   - The leading status byte encodes the kind: 1 = selectable, 2 = slider/sizable,
 *     -1 = empty (skipped by cursor, drawn as blank space).
 *   - The two empty separators sit between scrnsize and mousesens, and between
 *     mousesens and soundvol.
 *   - The total entry count is 8 (including the two -1 separators).
 *   - The mouse sensitivity and screen size items act as sliders that respond to
 *     left/right arrow keys; the others are flat selectables.
 *   - Hotkeys per entry: e, m, g, s, (none), m, (none), s.
 */

export type VanillaOptionsItemKind = 'selectable' | 'slider' | 'separator';

export interface VanillaOptionsMenuItem {
  readonly kind: VanillaOptionsItemKind;
  readonly lumpName: string;
  readonly routine: string | null;
  readonly hotkey: string | null;
  readonly statusByte: number;
}

const ITEM_ENDGAME: VanillaOptionsMenuItem = Object.freeze({ kind: 'selectable', lumpName: 'M_ENDGAM', routine: 'M_EndGame', hotkey: 'e', statusByte: 1 });
const ITEM_MESSAGES: VanillaOptionsMenuItem = Object.freeze({ kind: 'selectable', lumpName: 'M_MESSG', routine: 'M_ChangeMessages', hotkey: 'm', statusByte: 1 });
const ITEM_DETAIL: VanillaOptionsMenuItem = Object.freeze({ kind: 'selectable', lumpName: 'M_DETAIL', routine: 'M_ChangeDetail', hotkey: 'g', statusByte: 1 });
const ITEM_SCRNSIZE: VanillaOptionsMenuItem = Object.freeze({ kind: 'slider', lumpName: 'M_SCRNSZ', routine: 'M_SizeDisplay', hotkey: 's', statusByte: 2 });
const SEPARATOR: VanillaOptionsMenuItem = Object.freeze({ kind: 'separator', lumpName: '', routine: null, hotkey: null, statusByte: -1 });
const ITEM_MSENS: VanillaOptionsMenuItem = Object.freeze({ kind: 'slider', lumpName: 'M_MSENS', routine: 'M_ChangeSensitivity', hotkey: 'm', statusByte: 2 });
const ITEM_SVOL: VanillaOptionsMenuItem = Object.freeze({ kind: 'selectable', lumpName: 'M_SVOL', routine: 'M_Sound', hotkey: 's', statusByte: 1 });

export const VANILLA_OPTIONS_MENU_TREE: readonly VanillaOptionsMenuItem[] = Object.freeze([ITEM_ENDGAME, ITEM_MESSAGES, ITEM_DETAIL, ITEM_SCRNSIZE, SEPARATOR, ITEM_MSENS, SEPARATOR, ITEM_SVOL]);

export const VANILLA_OPTIONS_ENTRY_COUNT = 8;
export const VANILLA_OPTIONS_INDEX_ENDGAME = 0;
export const VANILLA_OPTIONS_INDEX_MESSAGES = 1;
export const VANILLA_OPTIONS_INDEX_DETAIL = 2;
export const VANILLA_OPTIONS_INDEX_SCRNSIZE = 3;
export const VANILLA_OPTIONS_INDEX_MSENS = 5;
export const VANILLA_OPTIONS_INDEX_SVOL = 7;

export function getVanillaOptionsMenuTree(): readonly VanillaOptionsMenuItem[] {
  return VANILLA_OPTIONS_MENU_TREE;
}

export function vanillaOptionsItemIsCursorEligible(item: VanillaOptionsMenuItem): boolean {
  return item.kind !== 'separator';
}
