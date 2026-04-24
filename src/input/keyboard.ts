/**
 * Keyboard scan code mapping from Win32 hardware scan codes to Doom
 * internal key codes.
 *
 * Doom's key code space is a single unsigned byte (0x00-0xFF).
 * Printable ASCII characters keep their ASCII value (lowercase for
 * letters).  Non-ASCII special keys use 0x80 + DOS-scan-code offsets,
 * arrow keys use 0xAC-0xAF, and a few keys use their ASCII control
 * code (Enter=13, Escape=27, Tab=9).
 *
 * The translation table ({@link SCANCODE_TO_DOOM_KEY}) matches the
 * `xlatekey[]` array from vanilla Doom's `i_ibm.c`.  On Win32,
 * hardware scan codes in LPARAM bits 16-23 are identical to DOS
 * scan codes for the standard 101/104-key layout.
 *
 * @example
 * ```ts
 * import { translateScanCode, KEY_UPARROW } from "../src/input/keyboard.ts";
 * const doomKey = translateScanCode(lparam);
 * if (doomKey === KEY_UPARROW) { // player pressed up arrow or numpad 8 }
 * ```
 */

// ── Doom internal key codes (doomkeys.h) ─────────────────────────

/** Right arrow / Numpad 6. */
export const KEY_RIGHTARROW = 0xae;
/** Left arrow / Numpad 4. */
export const KEY_LEFTARROW = 0xac;
/** Up arrow / Numpad 8. */
export const KEY_UPARROW = 0xad;
/** Down arrow / Numpad 2. */
export const KEY_DOWNARROW = 0xaf;

export const KEY_ESCAPE = 27;
export const KEY_ENTER = 13;
export const KEY_TAB = 9;
export const KEY_BACKSPACE = 0x7f;
/** Mapped from DOS scan code 0x45 (NumLock position). */
export const KEY_PAUSE = 0xff;

export const KEY_EQUALS = 0x3d;
export const KEY_MINUS = 0x2d;

/** 0x80 + 0x36 (Right Shift DOS scan code). Both shifts map here. */
export const KEY_RSHIFT = 0xb6;
/** 0x80 + 0x1D (Left Ctrl DOS scan code). Both Ctrls map here. */
export const KEY_RCTRL = 0x9d;
/** 0x80 + 0x38 (Left Alt DOS scan code). Both Alts map here. */
export const KEY_RALT = 0xb8;
export const KEY_LALT = KEY_RALT;

export const KEY_CAPSLOCK = 0xba;
export const KEY_NUMLOCK = 0xc5;
export const KEY_SCRLCK = 0xc6;

export const KEY_HOME = 0xc7;
export const KEY_END = 0xcf;
export const KEY_PGUP = 0xc9;
export const KEY_PGDN = 0xd1;
export const KEY_INS = 0xd2;
export const KEY_DEL = 0xd3;

export const KEY_F1 = 0x80 + 0x3b;
export const KEY_F2 = 0x80 + 0x3c;
export const KEY_F3 = 0x80 + 0x3d;
export const KEY_F4 = 0x80 + 0x3e;
export const KEY_F5 = 0x80 + 0x3f;
export const KEY_F6 = 0x80 + 0x40;
export const KEY_F7 = 0x80 + 0x41;
export const KEY_F8 = 0x80 + 0x42;
export const KEY_F9 = 0x80 + 0x43;
export const KEY_F10 = 0x80 + 0x44;
export const KEY_F11 = 0x80 + 0x57;
export const KEY_F12 = 0x80 + 0x58;

// ── Win32 LPARAM extraction constants ────────────────────────────

/** Bit position of the scan code field within LPARAM. */
export const LPARAM_SCANCODE_SHIFT = 16;
/** Mask for the 8-bit scan code after shifting. */
export const LPARAM_SCANCODE_MASK = 0xff;
/** Bit 24 of LPARAM: set for extended keys (arrows, right Ctrl, etc.). */
export const LPARAM_EXTENDED_FLAG = 0x0100_0000;

// ── Translation table ────────────────────────────────────────────

/** Number of entries in the scan-code-to-key table (DOS scan codes 0-127). */
export const SCANCODE_TABLE_SIZE = 128;

/**
 * DOS scan code → Doom key code translation table.
 *
 * Indexed by DOS hardware scan code (0x00-0x7F).  Returns the
 * corresponding Doom internal key code, or 0 for unmapped codes.
 * Matches vanilla Doom's `xlatekey[128]` in `i_ibm.c` exactly.
 *
 * Notable entries:
 * - Letter keys → lowercase ASCII ('a'-'z')
 * - Number keys → ASCII digits ('0'-'9')
 * - Modifier keys → 0x80 + scan code (KEY_RSHIFT, KEY_RCTRL, KEY_RALT)
 * - Arrow / navigation keys → dedicated Doom constants
 * - Scan code 0x45 (NumLock) → KEY_PAUSE (vanilla Doom quirk)
 * - Numpad 5 (0x4C) → '5' (ASCII 53)
 */
export const SCANCODE_TO_DOOM_KEY: readonly number[] = Object.freeze(buildScancodeTable());

function buildScancodeTable(): number[] {
  const table = new Array<number>(SCANCODE_TABLE_SIZE).fill(0);

  /* 0x01 */ table[0x01] = KEY_ESCAPE;
  /* 0x02 */ table[0x02] = 0x31; // '1'
  /* 0x03 */ table[0x03] = 0x32; // '2'
  /* 0x04 */ table[0x04] = 0x33; // '3'
  /* 0x05 */ table[0x05] = 0x34; // '4'
  /* 0x06 */ table[0x06] = 0x35; // '5'
  /* 0x07 */ table[0x07] = 0x36; // '6'
  /* 0x08 */ table[0x08] = 0x37; // '7'
  /* 0x09 */ table[0x09] = 0x38; // '8'
  /* 0x0A */ table[0x0a] = 0x39; // '9'
  /* 0x0B */ table[0x0b] = 0x30; // '0'
  /* 0x0C */ table[0x0c] = KEY_MINUS;
  /* 0x0D */ table[0x0d] = KEY_EQUALS;
  /* 0x0E */ table[0x0e] = KEY_BACKSPACE;

  /* 0x0F */ table[0x0f] = KEY_TAB;
  /* 0x10 */ table[0x10] = 0x71; // 'q'
  /* 0x11 */ table[0x11] = 0x77; // 'w'
  /* 0x12 */ table[0x12] = 0x65; // 'e'
  /* 0x13 */ table[0x13] = 0x72; // 'r'
  /* 0x14 */ table[0x14] = 0x74; // 't'
  /* 0x15 */ table[0x15] = 0x79; // 'y'
  /* 0x16 */ table[0x16] = 0x75; // 'u'
  /* 0x17 */ table[0x17] = 0x69; // 'i'
  /* 0x18 */ table[0x18] = 0x6f; // 'o'
  /* 0x19 */ table[0x19] = 0x70; // 'p'
  /* 0x1A */ table[0x1a] = 0x5b; // '['
  /* 0x1B */ table[0x1b] = 0x5d; // ']'
  /* 0x1C */ table[0x1c] = KEY_ENTER;

  /* 0x1D */ table[0x1d] = KEY_RCTRL;
  /* 0x1E */ table[0x1e] = 0x61; // 'a'
  /* 0x1F */ table[0x1f] = 0x73; // 's'
  /* 0x20 */ table[0x20] = 0x64; // 'd'
  /* 0x21 */ table[0x21] = 0x66; // 'f'
  /* 0x22 */ table[0x22] = 0x67; // 'g'
  /* 0x23 */ table[0x23] = 0x68; // 'h'
  /* 0x24 */ table[0x24] = 0x6a; // 'j'
  /* 0x25 */ table[0x25] = 0x6b; // 'k'
  /* 0x26 */ table[0x26] = 0x6c; // 'l'
  /* 0x27 */ table[0x27] = 0x3b; // ';'
  /* 0x28 */ table[0x28] = 0x27; // "'"
  /* 0x29 */ table[0x29] = 0x60; // '`'

  /* 0x2A */ table[0x2a] = KEY_RSHIFT;
  /* 0x2B */ table[0x2b] = 0x5c; // '\\'
  /* 0x2C */ table[0x2c] = 0x7a; // 'z'
  /* 0x2D */ table[0x2d] = 0x78; // 'x'
  /* 0x2E */ table[0x2e] = 0x63; // 'c'
  /* 0x2F */ table[0x2f] = 0x76; // 'v'
  /* 0x30 */ table[0x30] = 0x62; // 'b'
  /* 0x31 */ table[0x31] = 0x6e; // 'n'
  /* 0x32 */ table[0x32] = 0x6d; // 'm'
  /* 0x33 */ table[0x33] = 0x2c; // ','
  /* 0x34 */ table[0x34] = 0x2e; // '.'
  /* 0x35 */ table[0x35] = 0x2f; // '/'
  /* 0x36 */ table[0x36] = KEY_RSHIFT;

  /* 0x37 */ table[0x37] = 0x2a; // '*' (numpad)

  /* 0x38 */ table[0x38] = KEY_RALT;
  /* 0x39 */ table[0x39] = 0x20; // ' ' (Space)
  /* 0x3A */ table[0x3a] = KEY_CAPSLOCK;

  /* F1-F10: DOS scan codes 0x3B-0x44 */
  /* 0x3B */ table[0x3b] = KEY_F1;
  /* 0x3C */ table[0x3c] = KEY_F2;
  /* 0x3D */ table[0x3d] = KEY_F3;
  /* 0x3E */ table[0x3e] = KEY_F4;
  /* 0x3F */ table[0x3f] = KEY_F5;
  /* 0x40 */ table[0x40] = KEY_F6;
  /* 0x41 */ table[0x41] = KEY_F7;
  /* 0x42 */ table[0x42] = KEY_F8;
  /* 0x43 */ table[0x43] = KEY_F9;
  /* 0x44 */ table[0x44] = KEY_F10;

  /* 0x45 */ table[0x45] = KEY_PAUSE;
  /* 0x46 */ table[0x46] = KEY_SCRLCK;

  /* Numpad navigation / arrow keys: DOS scan codes 0x47-0x53 */
  /* 0x47 */ table[0x47] = KEY_HOME;
  /* 0x48 */ table[0x48] = KEY_UPARROW;
  /* 0x49 */ table[0x49] = KEY_PGUP;
  /* 0x4A */ table[0x4a] = KEY_MINUS;
  /* 0x4B */ table[0x4b] = KEY_LEFTARROW;
  /* 0x4C */ table[0x4c] = 0x35; // '5' (Numpad 5)
  /* 0x4D */ table[0x4d] = KEY_RIGHTARROW;
  /* 0x4E */ table[0x4e] = 0x2b; // '+' (Numpad +)
  /* 0x4F */ table[0x4f] = KEY_END;
  /* 0x50 */ table[0x50] = KEY_DOWNARROW;
  /* 0x51 */ table[0x51] = KEY_PGDN;
  /* 0x52 */ table[0x52] = KEY_INS;
  /* 0x53 */ table[0x53] = KEY_DEL;

  /* 0x57 */ table[0x57] = KEY_F11;
  /* 0x58 */ table[0x58] = KEY_F12;

  return table;
}

// ── Win32 LPARAM helpers ─────────────────────────────────────────

/**
 * Extract the 8-bit hardware scan code from a Win32 LPARAM.
 *
 * On a standard PC keyboard, bits 16-23 of LPARAM carry the
 * DOS-compatible hardware scan code (0x00-0x7F for make codes).
 */
export function extractScanCode(lparam: number): number {
  return (lparam >>> LPARAM_SCANCODE_SHIFT) & LPARAM_SCANCODE_MASK;
}

/**
 * Test whether the extended-key flag (bit 24) is set in LPARAM.
 *
 * Extended keys include the cursor arrow cluster, Home/End/PgUp/PgDn,
 * Insert/Delete, right Ctrl, right Alt, numpad Enter, and numpad /.
 * In vanilla Doom, extended and non-extended keys with the same base
 * scan code produce the same Doom key code (e.g. numpad 8 and the
 * up-arrow key both yield {@link KEY_UPARROW}).
 */
export function isExtendedKey(lparam: number): boolean {
  return (lparam & LPARAM_EXTENDED_FLAG) !== 0;
}

/**
 * Translate a Win32 LPARAM to a Doom internal key code.
 *
 * Extracts the hardware scan code from bits 16-23 and looks it up
 * in {@link SCANCODE_TO_DOOM_KEY}.  Returns 0 for unmapped or
 * out-of-range scan codes.
 *
 * Both physical arrow keys and their numpad equivalents produce
 * the same Doom key code, matching original DOS behavior where
 * no extended-key distinction was made.
 */
export function translateScanCode(lparam: number): number {
  const scanCode = (lparam >>> LPARAM_SCANCODE_SHIFT) & LPARAM_SCANCODE_MASK;
  if (scanCode >= SCANCODE_TABLE_SIZE) {
    return 0;
  }
  return SCANCODE_TO_DOOM_KEY[scanCode];
}
