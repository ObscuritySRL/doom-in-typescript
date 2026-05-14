import { describe, expect, test } from 'bun:test';

import {
  isVanillaOplValidRegisterIndex,
  vanillaOplChannelOperators,
  VANILLA_OPL2_CHANNEL_COUNT,
  VANILLA_OPL2_OPERATOR_COUNT,
  VANILLA_OPL3_CHANNEL_COUNT,
  VANILLA_OPL3_OPERATOR_COUNT,
  VANILLA_OPL_CHANNEL_OPERATOR_PAIRS,
  VANILLA_OPL_DEFAULT_IO_PORT,
  VANILLA_OPL_REGISTER_BANK_BASES,
  VANILLA_OPL_REGISTER_FILE_SIZE,
} from '../../../src/audio/implement-opl-register-model.ts';

describe('vanilla DOOM 1.9 OPL register model contract', () => {
  test('pins the 256-entry OPL register file and 0x388 default I/O port', () => {
    expect(VANILLA_OPL_REGISTER_FILE_SIZE).toBe(256);
    expect(VANILLA_OPL_DEFAULT_IO_PORT).toBe(0x388);
  });

  test('pins OPL2 channel/operator counts (9 channels, 18 operators)', () => {
    expect(VANILLA_OPL2_CHANNEL_COUNT).toBe(9);
    expect(VANILLA_OPL2_OPERATOR_COUNT).toBe(18);
  });

  test('pins OPL3 channel/operator counts (18 channels, 36 operators)', () => {
    expect(VANILLA_OPL3_CHANNEL_COUNT).toBe(18);
    expect(VANILLA_OPL3_OPERATOR_COUNT).toBe(36);
  });

  test('pins the non-sequential channel→operator pin mapping from the YM3812 datasheet', () => {
    expect(VANILLA_OPL_CHANNEL_OPERATOR_PAIRS).toEqual([
      [0, 3],
      [1, 4],
      [2, 5],
      [6, 9],
      [7, 10],
      [8, 11],
      [12, 15],
      [13, 16],
      [14, 17],
    ]);
  });

  test('vanillaOplChannelOperators returns the operator pair for each channel', () => {
    expect(vanillaOplChannelOperators(0)).toEqual([0, 3]);
    expect(vanillaOplChannelOperators(3)).toEqual([6, 9]);
    expect(vanillaOplChannelOperators(8)).toEqual([14, 17]);
  });

  test('vanillaOplChannelOperators rejects out-of-range channels', () => {
    expect(() => vanillaOplChannelOperators(-1)).toThrow(RangeError);
    expect(() => vanillaOplChannelOperators(9)).toThrow(RangeError);
  });

  test('pins the register bank base addresses', () => {
    expect(VANILLA_OPL_REGISTER_BANK_BASES.OP_TREMOLO_VIBRATO_SUSTAIN_KSR_MULT).toBe(0x20);
    expect(VANILLA_OPL_REGISTER_BANK_BASES.OP_KSL_TOTAL_LEVEL).toBe(0x40);
    expect(VANILLA_OPL_REGISTER_BANK_BASES.OP_ATTACK_DECAY).toBe(0x60);
    expect(VANILLA_OPL_REGISTER_BANK_BASES.OP_SUSTAIN_RELEASE).toBe(0x80);
    expect(VANILLA_OPL_REGISTER_BANK_BASES.CHANNEL_FREQ_LOW).toBe(0xa0);
    expect(VANILLA_OPL_REGISTER_BANK_BASES.CHANNEL_FREQ_HIGH_KEYON_BLOCK).toBe(0xb0);
    expect(VANILLA_OPL_REGISTER_BANK_BASES.CHANNEL_FEEDBACK_CONNECTION_PAN).toBe(0xc0);
    expect(VANILLA_OPL_REGISTER_BANK_BASES.OP_WAVEFORM_SELECT).toBe(0xe0);
  });

  test('isVanillaOplValidRegisterIndex accepts 0..255', () => {
    expect(isVanillaOplValidRegisterIndex(0)).toBe(true);
    expect(isVanillaOplValidRegisterIndex(255)).toBe(true);
    expect(isVanillaOplValidRegisterIndex(256)).toBe(false);
    expect(isVanillaOplValidRegisterIndex(-1)).toBe(false);
    expect(isVanillaOplValidRegisterIndex(1.5)).toBe(false);
  });
});
