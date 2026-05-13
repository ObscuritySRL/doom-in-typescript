import { describe, expect, test } from 'bun:test';

import {
  decodeVanillaSaveDescription,
  encodeVanillaSaveDescription,
  isVanillaSaveDescriptionCharacter,
  isVanillaSaveSlotEmpty,
  VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL,
  VANILLA_SAVE_STRING_PRINTABLE_ASCII_MAX,
  VANILLA_SAVE_STRING_PRINTABLE_ASCII_MIN,
  VANILLA_SAVE_STRING_SIZE,
  VANILLA_SAVE_STRING_USER_INPUT_MAX,
  vanillaSaveSlotMenuLabel,
} from '../../../src/save/implement-save-slot-descriptions.ts';

describe('vanilla DOOM 1.9 save-slot description contract', () => {
  test('pins the SAVESTRINGSIZE=24 disk field width and 23-char user input cap', () => {
    expect(VANILLA_SAVE_STRING_SIZE).toBe(24);
    expect(VANILLA_SAVE_STRING_USER_INPUT_MAX).toBe(23);
  });

  test('pins the printable ASCII range filter from M_StringInput', () => {
    expect(VANILLA_SAVE_STRING_PRINTABLE_ASCII_MIN).toBe(0x20);
    expect(VANILLA_SAVE_STRING_PRINTABLE_ASCII_MAX).toBe(0x7e);
    expect(isVanillaSaveDescriptionCharacter(0x20)).toBe(true);
    expect(isVanillaSaveDescriptionCharacter(0x41)).toBe(true);
    expect(isVanillaSaveDescriptionCharacter(0x7e)).toBe(true);
    expect(isVanillaSaveDescriptionCharacter(0x1f)).toBe(false);
    expect(isVanillaSaveDescriptionCharacter(0x7f)).toBe(false);
    expect(isVanillaSaveDescriptionCharacter(0x00)).toBe(false);
  });

  test('pins the empty-slot menu label "EMPTY" from m_menu.c LoadDef', () => {
    expect(VANILLA_EMPTY_SAVE_SLOT_MENU_LABEL).toBe('EMPTY');
  });

  test('encodeVanillaSaveDescription produces a 24-byte NUL-padded ASCII buffer', () => {
    const bytes = encodeVanillaSaveDescription('e1m1');
    expect(bytes.length).toBe(24);
    expect(bytes[0]).toBe(0x65);
    expect(bytes[1]).toBe(0x31);
    expect(bytes[2]).toBe(0x6d);
    expect(bytes[3]).toBe(0x31);
    expect(bytes[4]).toBe(0x00);
    expect(bytes[23]).toBe(0x00);
  });

  test('encodeVanillaSaveDescription rejects descriptions longer than 23 user chars', () => {
    expect(() => encodeVanillaSaveDescription('A'.repeat(24))).toThrow(RangeError);
    expect(() => encodeVanillaSaveDescription('A'.repeat(23))).not.toThrow();
  });

  test('encodeVanillaSaveDescription rejects non-printable ASCII characters', () => {
    expect(() => encodeVanillaSaveDescription('hi\n')).toThrow(RangeError);
    expect(() => encodeVanillaSaveDescription('hi\t')).toThrow(RangeError);
    expect(() => encodeVanillaSaveDescription('café')).toThrow(RangeError);
  });

  test('decodeVanillaSaveDescription stops at first NUL byte', () => {
    const bytes = new Uint8Array(24);
    bytes[0] = 0x65;
    bytes[1] = 0x31;
    bytes[2] = 0x6d;
    bytes[3] = 0x31;
    bytes[4] = 0x00;
    bytes[5] = 0x58;
    expect(decodeVanillaSaveDescription(bytes)).toBe('e1m1');
  });

  test('decodeVanillaSaveDescription returns the full 24 chars when no NUL is present', () => {
    const bytes = new Uint8Array(24);
    for (let i = 0; i < 24; i++) bytes[i] = 0x41 + (i % 26);
    expect(decodeVanillaSaveDescription(bytes).length).toBe(24);
  });

  test('isVanillaSaveSlotEmpty returns true when byte 0 is NUL', () => {
    expect(isVanillaSaveSlotEmpty(new Uint8Array(24))).toBe(true);
    const populated = new Uint8Array(24);
    populated[0] = 0x41;
    expect(isVanillaSaveSlotEmpty(populated)).toBe(false);
  });

  test('vanillaSaveSlotMenuLabel returns EMPTY for unpopulated slots and the description otherwise', () => {
    expect(vanillaSaveSlotMenuLabel(new Uint8Array(24))).toBe('EMPTY');
    const populated = encodeVanillaSaveDescription('demo run');
    expect(vanillaSaveSlotMenuLabel(populated)).toBe('demo run');
  });

  test('round-trips arbitrary printable-ASCII descriptions through encode/decode', () => {
    for (const original of ['', 'a', 'e1m1', 'My quick test save', '!@#$%^&*()_+-=']) {
      const bytes = encodeVanillaSaveDescription(original);
      expect(decodeVanillaSaveDescription(bytes)).toBe(original);
    }
  });
});
