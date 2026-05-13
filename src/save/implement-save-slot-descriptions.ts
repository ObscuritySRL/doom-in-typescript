/**
 * Vanilla DOOM 1.9 save-slot description contract.
 *
 * Chocolate Doom 2.2.1 g_game.c G_DoSaveGame writes the user-supplied
 * description string as the first field of the savegame header. The
 * description is what the player typed in the Save menu (m_menu.c
 * M_DoSave / SaveDef) and is what the Load menu re-displays as the
 * slot label.
 *
 * Parity-critical details:
 *   - The description field is exactly SAVEGAMESTRINGSIZE = 24 bytes
 *     wide on disk. Strings shorter than 24 bytes are NUL-padded;
 *     strings longer than 23 user characters cannot exist because the
 *     menu UI hard-caps input at SAVESTRINGSIZE-1 chars in the
 *     M_DoSave keystroke handler.
 *   - Default empty-slot label is "                        " (24
 *     ASCII spaces) when SaveGameStrings[i][0] == 0. The Load menu
 *     renders empty slots as "EMPTY".
 *   - When `quicksave` is invoked on an unnamed slot, vanilla
 *     populates the description as "Quicksave Slot {i}". The
 *     constant `QSAVESPOT` in m_menu.c provides this template.
 *   - The description bytes use raw ASCII (no UTF-8 / UTF-16). The
 *     menu keystroke handler `M_StringInput` filters to printable
 *     ASCII (0x20..0x7E) before appending to the buffer, so we cap
 *     the contract at the printable ASCII range.
 *   - On load, vanilla truncates at the first NUL byte (read up to 24
 *     bytes, stop at byte 0).
 */

export const VANILLA_SAVE_STRING_SIZE = 24;

export const VANILLA_SAVE_STRING_USER_INPUT_MAX = VANILLA_SAVE_STRING_SIZE - 1;

export const VANILLA_SAVE_STRING_PRINTABLE_ASCII_MIN = 0x20;
export const VANILLA_SAVE_STRING_PRINTABLE_ASCII_MAX = 0x7e;

export const VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL = 'EMPTY';

export function isVanillaSaveDescriptionCharacter(charCode: number): boolean {
  return Number.isInteger(charCode) && charCode >= VANILLA_SAVE_STRING_PRINTABLE_ASCII_MIN && charCode <= VANILLA_SAVE_STRING_PRINTABLE_ASCII_MAX;
}

export function encodeVanillaSaveDescription(description: string): Uint8Array {
  if (description.length > VANILLA_SAVE_STRING_USER_INPUT_MAX) {
    throw new RangeError(`save description exceeds ${VANILLA_SAVE_STRING_USER_INPUT_MAX}-char user input cap (got ${description.length})`);
  }
  const bytes = new Uint8Array(VANILLA_SAVE_STRING_SIZE);
  for (let i = 0; i < description.length; i++) {
    const code = description.charCodeAt(i);
    if (!isVanillaSaveDescriptionCharacter(code)) {
      throw new RangeError(`save description character at index ${i} (code 0x${code.toString(16)}) is outside printable ASCII 0x20..0x7E`);
    }
    bytes[i] = code;
  }
  return bytes;
}

export function decodeVanillaSaveDescription(bytes: Uint8Array): string {
  if (bytes.length < VANILLA_SAVE_STRING_SIZE) {
    throw new RangeError(`save description buffer must be at least ${VANILLA_SAVE_STRING_SIZE} bytes (got ${bytes.length})`);
  }
  let description = '';
  for (let i = 0; i < VANILLA_SAVE_STRING_SIZE; i++) {
    const code = bytes[i]!;
    if (code === 0) break;
    description += String.fromCharCode(code);
  }
  return description;
}

export function isVanillaSaveSlotEmpty(bytes: Uint8Array): boolean {
  if (bytes.length < VANILLA_SAVE_STRING_SIZE) {
    return true;
  }
  return bytes[0] === 0;
}

export function vanillaSaveSlotMenuLabel(bytes: Uint8Array): string {
  if (isVanillaSaveSlotEmpty(bytes)) {
    return VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL;
  }
  return decodeVanillaSaveDescription(bytes);
}
