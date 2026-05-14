import { describe, expect, test } from 'bun:test';

import {
  isVanillaGenmidiFixedPitchInstrument,
  isVanillaGenmidiTwoVoiceInstrument,
  VANILLA_GENMIDI_INSTRUMENT_FLAG_DELAY,
  VANILLA_GENMIDI_INSTRUMENT_FLAG_FIXED_PITCH,
  VANILLA_GENMIDI_INSTRUMENT_FLAG_TWO_VOICE,
  VANILLA_GENMIDI_MAGIC,
  VANILLA_GENMIDI_MAGIC_BYTE_LENGTH,
  VANILLA_GENMIDI_MELODIC_INSTRUMENT_COUNT,
  VANILLA_GENMIDI_NAME_RECORD_BYTE_LENGTH,
  VANILLA_GENMIDI_PERCUSSION_FIRST_GM_NOTE,
  VANILLA_GENMIDI_PERCUSSION_INSTRUMENT_COUNT,
  VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT,
  VANILLA_GENMIDI_TOTAL_LUMP_BYTE_LENGTH,
  VANILLA_GENMIDI_VOICE_RECORD_BYTE_LENGTH,
  vanillaGenmidiPercussionGmNote,
} from '../../../src/audio/implement-opl-instrument-mapping.ts';

describe('vanilla DOOM 1.9 GENMIDI instrument mapping contract', () => {
  test('pins the GENMIDI magic and 8-byte length', () => {
    expect(VANILLA_GENMIDI_MAGIC).toBe('#OPL_II#');
    expect(VANILLA_GENMIDI_MAGIC_BYTE_LENGTH).toBe(8);
  });

  test('pins 128 melodic + 47 percussion = 175 total instruments', () => {
    expect(VANILLA_GENMIDI_MELODIC_INSTRUMENT_COUNT).toBe(128);
    expect(VANILLA_GENMIDI_PERCUSSION_INSTRUMENT_COUNT).toBe(47);
    expect(VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT).toBe(175);
  });

  test('pins the 36-byte voice record and 32-byte name record sizes', () => {
    expect(VANILLA_GENMIDI_VOICE_RECORD_BYTE_LENGTH).toBe(36);
    expect(VANILLA_GENMIDI_NAME_RECORD_BYTE_LENGTH).toBe(32);
  });

  test('total GENMIDI lump bytes = 8 + 175*36 + 175*32', () => {
    expect(VANILLA_GENMIDI_TOTAL_LUMP_BYTE_LENGTH).toBe(8 + 175 * 36 + 175 * 32);
    expect(VANILLA_GENMIDI_TOTAL_LUMP_BYTE_LENGTH).toBe(11908);
  });

  test('percussion slot 0..46 maps to General MIDI percussion notes 35..81', () => {
    expect(VANILLA_GENMIDI_PERCUSSION_FIRST_GM_NOTE).toBe(35);
    expect(vanillaGenmidiPercussionGmNote(0)).toBe(35);
    expect(vanillaGenmidiPercussionGmNote(46)).toBe(81);
  });

  test('vanillaGenmidiPercussionGmNote rejects out-of-range slots', () => {
    expect(() => vanillaGenmidiPercussionGmNote(-1)).toThrow(RangeError);
    expect(() => vanillaGenmidiPercussionGmNote(47)).toThrow(RangeError);
  });

  test('pins the GENMIDI instrument flag bits (fixed=1, delay=2, two_voice=4)', () => {
    expect(VANILLA_GENMIDI_INSTRUMENT_FLAG_FIXED_PITCH).toBe(1);
    expect(VANILLA_GENMIDI_INSTRUMENT_FLAG_DELAY).toBe(2);
    expect(VANILLA_GENMIDI_INSTRUMENT_FLAG_TWO_VOICE).toBe(4);
  });

  test('two-voice detection accepts any value with bit 2 set', () => {
    expect(isVanillaGenmidiTwoVoiceInstrument(4)).toBe(true);
    expect(isVanillaGenmidiTwoVoiceInstrument(5)).toBe(true);
    expect(isVanillaGenmidiTwoVoiceInstrument(7)).toBe(true);
    expect(isVanillaGenmidiTwoVoiceInstrument(0)).toBe(false);
    expect(isVanillaGenmidiTwoVoiceInstrument(3)).toBe(false);
  });

  test('fixed-pitch detection accepts any value with bit 0 set', () => {
    expect(isVanillaGenmidiFixedPitchInstrument(1)).toBe(true);
    expect(isVanillaGenmidiFixedPitchInstrument(5)).toBe(true);
    expect(isVanillaGenmidiFixedPitchInstrument(0)).toBe(false);
    expect(isVanillaGenmidiFixedPitchInstrument(2)).toBe(false);
  });
});
