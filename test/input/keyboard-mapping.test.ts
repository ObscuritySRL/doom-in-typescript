import { describe, expect, test } from 'bun:test';

import {
  KEY_BACKSPACE,
  KEY_CAPSLOCK,
  KEY_DEL,
  KEY_DOWNARROW,
  KEY_END,
  KEY_ENTER,
  KEY_EQUALS,
  KEY_ESCAPE,
  KEY_F1,
  KEY_F10,
  KEY_F11,
  KEY_F12,
  KEY_F2,
  KEY_F3,
  KEY_F4,
  KEY_F5,
  KEY_F6,
  KEY_F7,
  KEY_F8,
  KEY_F9,
  KEY_HOME,
  KEY_INS,
  KEY_LALT,
  KEY_LEFTARROW,
  KEY_MINUS,
  KEY_NUMLOCK,
  KEY_PAUSE,
  KEY_PGDN,
  KEY_PGUP,
  KEY_RALT,
  KEY_RCTRL,
  KEY_RIGHTARROW,
  KEY_RSHIFT,
  KEY_SCRLCK,
  KEY_TAB,
  KEY_UPARROW,
  LPARAM_EXTENDED_FLAG,
  LPARAM_SCANCODE_MASK,
  LPARAM_SCANCODE_SHIFT,
  SCANCODE_TABLE_SIZE,
  SCANCODE_TO_DOOM_KEY,
  extractScanCode,
  isExtendedKey,
  translateScanCode,
} from '../../src/input/keyboard.ts';
import { SCANCODE_MAX } from '../../src/oracles/inputScript.ts';

/** Build an LPARAM value from a scan code and optional extended flag. */
function makeLparam(scanCode: number, extended = false): number {
  let lparam = scanCode << LPARAM_SCANCODE_SHIFT;
  if (extended) {
    lparam |= LPARAM_EXTENDED_FLAG;
  }
  return lparam;
}

describe('Doom key constants', () => {
  test('arrow keys are 0xAC-0xAF', () => {
    expect(KEY_LEFTARROW).toBe(0xac);
    expect(KEY_UPARROW).toBe(0xad);
    expect(KEY_RIGHTARROW).toBe(0xae);
    expect(KEY_DOWNARROW).toBe(0xaf);
  });

  test('ASCII-based special keys', () => {
    expect(KEY_ESCAPE).toBe(27);
    expect(KEY_ENTER).toBe(13);
    expect(KEY_TAB).toBe(9);
    expect(KEY_BACKSPACE).toBe(0x7f);
    expect(KEY_EQUALS).toBe(0x3d);
    expect(KEY_MINUS).toBe(0x2d);
  });

  test('modifier keys are 0x80 + DOS scan code', () => {
    expect(KEY_RSHIFT).toBe(0x80 + 0x36);
    expect(KEY_RCTRL).toBe(0x80 + 0x1d);
    expect(KEY_RALT).toBe(0x80 + 0x38);
    expect(KEY_LALT).toBe(KEY_RALT);
  });

  test('lock keys are 0x80 + DOS scan code', () => {
    expect(KEY_CAPSLOCK).toBe(0x80 + 0x3a);
    expect(KEY_NUMLOCK).toBe(0x80 + 0x45);
    expect(KEY_SCRLCK).toBe(0x80 + 0x46);
  });

  test('navigation keys are 0x80 + DOS scan code', () => {
    expect(KEY_HOME).toBe(0x80 + 0x47);
    expect(KEY_END).toBe(0x80 + 0x4f);
    expect(KEY_PGUP).toBe(0x80 + 0x49);
    expect(KEY_PGDN).toBe(0x80 + 0x51);
    expect(KEY_INS).toBe(0x80 + 0x52);
    expect(KEY_DEL).toBe(0x80 + 0x53);
  });

  test('F1-F10 are 0x80 + DOS scan code (0x3B-0x44)', () => {
    const fKeys = [KEY_F1, KEY_F2, KEY_F3, KEY_F4, KEY_F5, KEY_F6, KEY_F7, KEY_F8, KEY_F9, KEY_F10];
    for (let index = 0; index < fKeys.length; index++) {
      expect(fKeys[index]).toBe(0x80 + 0x3b + index);
    }
  });

  test('F11 and F12 are 0x80 + DOS scan code (0x57, 0x58)', () => {
    expect(KEY_F11).toBe(0x80 + 0x57);
    expect(KEY_F12).toBe(0x80 + 0x58);
  });

  test('KEY_PAUSE is 0xFF', () => {
    expect(KEY_PAUSE).toBe(0xff);
  });

  test('all key constants are within the 0x00-0xFF byte range', () => {
    const allKeys = [
      KEY_RIGHTARROW,
      KEY_LEFTARROW,
      KEY_UPARROW,
      KEY_DOWNARROW,
      KEY_ESCAPE,
      KEY_ENTER,
      KEY_TAB,
      KEY_BACKSPACE,
      KEY_PAUSE,
      KEY_EQUALS,
      KEY_MINUS,
      KEY_RSHIFT,
      KEY_RCTRL,
      KEY_RALT,
      KEY_LALT,
      KEY_CAPSLOCK,
      KEY_NUMLOCK,
      KEY_SCRLCK,
      KEY_HOME,
      KEY_END,
      KEY_PGUP,
      KEY_PGDN,
      KEY_INS,
      KEY_DEL,
      KEY_F1,
      KEY_F2,
      KEY_F3,
      KEY_F4,
      KEY_F5,
      KEY_F6,
      KEY_F7,
      KEY_F8,
      KEY_F9,
      KEY_F10,
      KEY_F11,
      KEY_F12,
    ];
    for (const key of allKeys) {
      expect(key).toBeGreaterThanOrEqual(0);
      expect(key).toBeLessThanOrEqual(SCANCODE_MAX);
    }
  });
});

describe('KEY_RCTRL / KEY_F12 distinction', () => {
  test('KEY_F12 and KEY_RCTRL are distinct values', () => {
    expect(KEY_RCTRL).toBe(0x9d);
    expect(KEY_F12).toBe(0xd8);
    expect(KEY_F12).not.toBe(KEY_RCTRL);
  });
});

describe('SCANCODE_TO_DOOM_KEY table', () => {
  test('has exactly 128 entries', () => {
    expect(SCANCODE_TO_DOOM_KEY.length).toBe(SCANCODE_TABLE_SIZE);
    expect(SCANCODE_TABLE_SIZE).toBe(128);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(SCANCODE_TO_DOOM_KEY)).toBe(true);
  });

  test('scan code 0x00 is unmapped', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x00]).toBe(0);
  });

  test('letter keys map to lowercase ASCII', () => {
    const letterScanCodes: [number, string][] = [
      [0x10, 'q'],
      [0x11, 'w'],
      [0x12, 'e'],
      [0x13, 'r'],
      [0x14, 't'],
      [0x15, 'y'],
      [0x16, 'u'],
      [0x17, 'i'],
      [0x18, 'o'],
      [0x19, 'p'],
      [0x1e, 'a'],
      [0x1f, 's'],
      [0x20, 'd'],
      [0x21, 'f'],
      [0x22, 'g'],
      [0x23, 'h'],
      [0x24, 'j'],
      [0x25, 'k'],
      [0x26, 'l'],
      [0x2c, 'z'],
      [0x2d, 'x'],
      [0x2e, 'c'],
      [0x2f, 'v'],
      [0x30, 'b'],
      [0x31, 'n'],
      [0x32, 'm'],
    ];
    for (const [scanCode, letter] of letterScanCodes) {
      expect(SCANCODE_TO_DOOM_KEY[scanCode]).toBe(letter.charCodeAt(0));
    }
  });

  test('number keys map to ASCII digits', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x02]).toBe(0x31); // '1'
    expect(SCANCODE_TO_DOOM_KEY[0x03]).toBe(0x32); // '2'
    expect(SCANCODE_TO_DOOM_KEY[0x0b]).toBe(0x30); // '0'
  });

  test('arrow / navigation scan codes produce Doom key codes', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x48]).toBe(KEY_UPARROW);
    expect(SCANCODE_TO_DOOM_KEY[0x4b]).toBe(KEY_LEFTARROW);
    expect(SCANCODE_TO_DOOM_KEY[0x4d]).toBe(KEY_RIGHTARROW);
    expect(SCANCODE_TO_DOOM_KEY[0x50]).toBe(KEY_DOWNARROW);
    expect(SCANCODE_TO_DOOM_KEY[0x47]).toBe(KEY_HOME);
    expect(SCANCODE_TO_DOOM_KEY[0x4f]).toBe(KEY_END);
    expect(SCANCODE_TO_DOOM_KEY[0x49]).toBe(KEY_PGUP);
    expect(SCANCODE_TO_DOOM_KEY[0x51]).toBe(KEY_PGDN);
    expect(SCANCODE_TO_DOOM_KEY[0x52]).toBe(KEY_INS);
    expect(SCANCODE_TO_DOOM_KEY[0x53]).toBe(KEY_DEL);
  });

  test('modifier scan codes produce Doom key codes', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x1d]).toBe(KEY_RCTRL);
    expect(SCANCODE_TO_DOOM_KEY[0x2a]).toBe(KEY_RSHIFT);
    expect(SCANCODE_TO_DOOM_KEY[0x36]).toBe(KEY_RSHIFT);
    expect(SCANCODE_TO_DOOM_KEY[0x38]).toBe(KEY_RALT);
  });

  test('F-key scan codes produce Doom F-key codes', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x3b]).toBe(KEY_F1);
    expect(SCANCODE_TO_DOOM_KEY[0x44]).toBe(KEY_F10);
    expect(SCANCODE_TO_DOOM_KEY[0x57]).toBe(KEY_F11);
    expect(SCANCODE_TO_DOOM_KEY[0x58]).toBe(KEY_F12);
  });

  test('special key scan codes', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x01]).toBe(KEY_ESCAPE);
    expect(SCANCODE_TO_DOOM_KEY[0x0e]).toBe(KEY_BACKSPACE);
    expect(SCANCODE_TO_DOOM_KEY[0x0f]).toBe(KEY_TAB);
    expect(SCANCODE_TO_DOOM_KEY[0x1c]).toBe(KEY_ENTER);
    expect(SCANCODE_TO_DOOM_KEY[0x39]).toBe(0x20); // Space
    expect(SCANCODE_TO_DOOM_KEY[0x3a]).toBe(KEY_CAPSLOCK);
    expect(SCANCODE_TO_DOOM_KEY[0x46]).toBe(KEY_SCRLCK);
  });

  test('scan code 0x45 maps to KEY_PAUSE (vanilla Doom quirk)', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x45]).toBe(KEY_PAUSE);
  });

  test("numpad 5 maps to ASCII '5'", () => {
    expect(SCANCODE_TO_DOOM_KEY[0x4c]).toBe(0x35);
  });

  test('numpad arithmetic keys', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x37]).toBe(0x2a); // '*'
    expect(SCANCODE_TO_DOOM_KEY[0x4a]).toBe(KEY_MINUS); // numpad '-'
    expect(SCANCODE_TO_DOOM_KEY[0x4e]).toBe(0x2b); // '+'
  });

  test('punctuation keys', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x0c]).toBe(KEY_MINUS); // main '-'
    expect(SCANCODE_TO_DOOM_KEY[0x0d]).toBe(KEY_EQUALS); // '='
    expect(SCANCODE_TO_DOOM_KEY[0x1a]).toBe(0x5b); // '['
    expect(SCANCODE_TO_DOOM_KEY[0x1b]).toBe(0x5d); // ']'
    expect(SCANCODE_TO_DOOM_KEY[0x27]).toBe(0x3b); // ';'
    expect(SCANCODE_TO_DOOM_KEY[0x28]).toBe(0x27); // "'"
    expect(SCANCODE_TO_DOOM_KEY[0x29]).toBe(0x60); // '`'
    expect(SCANCODE_TO_DOOM_KEY[0x2b]).toBe(0x5c); // '\\'
    expect(SCANCODE_TO_DOOM_KEY[0x33]).toBe(0x2c); // ','
    expect(SCANCODE_TO_DOOM_KEY[0x34]).toBe(0x2e); // '.'
    expect(SCANCODE_TO_DOOM_KEY[0x35]).toBe(0x2f); // '/'
  });

  test('all non-zero entries are within SCANCODE_MAX', () => {
    for (let index = 0; index < SCANCODE_TABLE_SIZE; index++) {
      const value = SCANCODE_TO_DOOM_KEY[index];
      if (value !== 0) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(SCANCODE_MAX);
      }
    }
  });

  test('both left and right shift scan codes map to KEY_RSHIFT', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x2a]).toBe(SCANCODE_TO_DOOM_KEY[0x36]);
  });
});

describe('LPARAM extraction', () => {
  test('LPARAM constants', () => {
    expect(LPARAM_SCANCODE_SHIFT).toBe(16);
    expect(LPARAM_SCANCODE_MASK).toBe(0xff);
    expect(LPARAM_EXTENDED_FLAG).toBe(0x0100_0000);
  });

  test('extractScanCode reads bits 16-23', () => {
    expect(extractScanCode(makeLparam(0x48))).toBe(0x48);
    expect(extractScanCode(makeLparam(0x01))).toBe(0x01);
    expect(extractScanCode(makeLparam(0x00))).toBe(0x00);
    expect(extractScanCode(makeLparam(0x7f))).toBe(0x7f);
  });

  test('extractScanCode ignores the extended-key flag', () => {
    expect(extractScanCode(makeLparam(0x48, true))).toBe(0x48);
    expect(extractScanCode(makeLparam(0x1d, true))).toBe(0x1d);
  });

  test('isExtendedKey detects bit 24', () => {
    expect(isExtendedKey(makeLparam(0x48, false))).toBe(false);
    expect(isExtendedKey(makeLparam(0x48, true))).toBe(true);
    expect(isExtendedKey(0)).toBe(false);
    expect(isExtendedKey(LPARAM_EXTENDED_FLAG)).toBe(true);
  });
});

describe('translateScanCode', () => {
  test('translates arrow key scan codes', () => {
    expect(translateScanCode(makeLparam(0x48))).toBe(KEY_UPARROW);
    expect(translateScanCode(makeLparam(0x4b))).toBe(KEY_LEFTARROW);
    expect(translateScanCode(makeLparam(0x4d))).toBe(KEY_RIGHTARROW);
    expect(translateScanCode(makeLparam(0x50))).toBe(KEY_DOWNARROW);
  });

  test('extended and non-extended produce same Doom key', () => {
    expect(translateScanCode(makeLparam(0x48, false))).toBe(KEY_UPARROW);
    expect(translateScanCode(makeLparam(0x48, true))).toBe(KEY_UPARROW);
    expect(translateScanCode(makeLparam(0x4d, false))).toBe(KEY_RIGHTARROW);
    expect(translateScanCode(makeLparam(0x4d, true))).toBe(KEY_RIGHTARROW);
  });

  test('translates letter keys to lowercase ASCII', () => {
    expect(translateScanCode(makeLparam(0x11))).toBe(0x77); // 'w'
    expect(translateScanCode(makeLparam(0x1e))).toBe(0x61); // 'a'
    expect(translateScanCode(makeLparam(0x1f))).toBe(0x73); // 's'
    expect(translateScanCode(makeLparam(0x20))).toBe(0x64); // 'd'
  });

  test('returns 0 for out-of-range scan codes', () => {
    expect(translateScanCode(makeLparam(0x80))).toBe(0);
    expect(translateScanCode(makeLparam(0xff))).toBe(0);
  });

  test('returns 0 for unmapped scan codes', () => {
    expect(translateScanCode(makeLparam(0x00))).toBe(0);
    expect(translateScanCode(makeLparam(0x54))).toBe(0);
  });

  test('translates modifier keys', () => {
    expect(translateScanCode(makeLparam(0x1d))).toBe(KEY_RCTRL);
    expect(translateScanCode(makeLparam(0x2a))).toBe(KEY_RSHIFT);
    expect(translateScanCode(makeLparam(0x38))).toBe(KEY_RALT);
  });
});

describe('reference config cross-reference', () => {
  test('default.cfg key_right (77) → KEY_RIGHTARROW via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[77]).toBe(KEY_RIGHTARROW);
  });

  test('default.cfg key_left (75) → KEY_LEFTARROW via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[75]).toBe(KEY_LEFTARROW);
  });

  test('default.cfg key_up (72) → KEY_UPARROW via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[72]).toBe(KEY_UPARROW);
  });

  test('default.cfg key_down (80) → KEY_DOWNARROW via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[80]).toBe(KEY_DOWNARROW);
  });

  test('default.cfg key_fire (29) → KEY_RCTRL via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[29]).toBe(KEY_RCTRL);
  });

  test('default.cfg key_use (57) → Space via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[57]).toBe(0x20);
  });

  test('default.cfg key_strafe (56) → KEY_RALT via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[56]).toBe(KEY_RALT);
  });

  test('default.cfg key_speed (54) → KEY_RSHIFT via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[54]).toBe(KEY_RSHIFT);
  });

  test('default.cfg key_strafeleft (51) → comma via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[51]).toBe(0x2c);
  });

  test('default.cfg key_straferight (52) → period via xlatekey', () => {
    expect(SCANCODE_TO_DOOM_KEY[52]).toBe(0x2e);
  });
});

describe('parity-sensitive edge cases', () => {
  test('Numpad minus and main minus both produce KEY_MINUS', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x0c]).toBe(KEY_MINUS);
    expect(SCANCODE_TO_DOOM_KEY[0x4a]).toBe(KEY_MINUS);
    expect(SCANCODE_TO_DOOM_KEY[0x0c]).toBe(SCANCODE_TO_DOOM_KEY[0x4a]);
  });

  test('scan code 0x45 (NumLock position) maps to KEY_PAUSE, not KEY_NUMLOCK', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x45]).toBe(KEY_PAUSE);
    expect(SCANCODE_TO_DOOM_KEY[0x45]).not.toBe(KEY_NUMLOCK);
  });

  test('all Doom key codes fit in SCANCODE_MAX (input script range)', () => {
    for (let index = 0; index < SCANCODE_TABLE_SIZE; index++) {
      const value = SCANCODE_TO_DOOM_KEY[index];
      if (value !== 0) {
        expect(value).toBeLessThanOrEqual(SCANCODE_MAX);
      }
    }
    expect(SCANCODE_MAX).toBe(0xff);
  });

  test('WASD cluster maps to lowercase ASCII', () => {
    expect(SCANCODE_TO_DOOM_KEY[0x11]).toBe('w'.charCodeAt(0));
    expect(SCANCODE_TO_DOOM_KEY[0x1e]).toBe('a'.charCodeAt(0));
    expect(SCANCODE_TO_DOOM_KEY[0x1f]).toBe('s'.charCodeAt(0));
    expect(SCANCODE_TO_DOOM_KEY[0x20]).toBe('d'.charCodeAt(0));
  });

  test('26 letter keys are all mapped and all lowercase', () => {
    const letterScanCodes = [
      0x10,
      0x11,
      0x12,
      0x13,
      0x14,
      0x15,
      0x16,
      0x17,
      0x18,
      0x19, // q-p
      0x1e,
      0x1f,
      0x20,
      0x21,
      0x22,
      0x23,
      0x24,
      0x25,
      0x26, // a-l
      0x2c,
      0x2d,
      0x2e,
      0x2f,
      0x30,
      0x31,
      0x32, // z-m
    ];
    expect(letterScanCodes.length).toBe(26);
    for (const scanCode of letterScanCodes) {
      const doomKey = SCANCODE_TO_DOOM_KEY[scanCode];
      const character = String.fromCharCode(doomKey);
      expect(character).toMatch(/^[a-z]$/);
    }
  });
});
