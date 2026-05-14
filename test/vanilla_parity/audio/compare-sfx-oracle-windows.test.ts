import { describe, expect, test } from 'bun:test';

import {
  VANILLA_SFX_ORACLE_BYTES_PER_SAMPLE_PAIR,
  VANILLA_SFX_ORACLE_GAMETICS_PER_SECOND,
  VANILLA_SFX_ORACLE_SAMPLE_RATE_HZ,
  VANILLA_SFX_ORACLE_SAMPLES_PER_GAMETIC,
  VANILLA_SFX_ORACLE_WINDOW_BYTES_PER_GAMETIC,
  vanillaSfxOracleWindowIsValid,
  vanillaSfxOracleWindowsEqual,
} from '../../../src/audio/compare-sfx-oracle-windows.ts';

describe('SFX oracle window comparator pin', () => {
  test('sample rate is 11025 Hz', () => {
    expect(VANILLA_SFX_ORACLE_SAMPLE_RATE_HZ).toBe(11025);
  });

  test('window cadence is 35 Hz gametic', () => {
    expect(VANILLA_SFX_ORACLE_GAMETICS_PER_SECOND).toBe(35);
  });

  test('samples per gametic = 11025 / 35 = 315 per channel', () => {
    expect(VANILLA_SFX_ORACLE_SAMPLES_PER_GAMETIC).toBe(315);
    expect(VANILLA_SFX_ORACLE_SAMPLE_RATE_HZ / VANILLA_SFX_ORACLE_GAMETICS_PER_SECOND).toBe(VANILLA_SFX_ORACLE_SAMPLES_PER_GAMETIC);
  });

  test('bytes per sample pair = 4 (signed 16-bit stereo)', () => {
    expect(VANILLA_SFX_ORACLE_BYTES_PER_SAMPLE_PAIR).toBe(4);
  });

  test('window byte count is 315 samples * 4 bytes = 1260', () => {
    expect(VANILLA_SFX_ORACLE_WINDOW_BYTES_PER_GAMETIC).toBe(1260);
    expect(VANILLA_SFX_ORACLE_SAMPLES_PER_GAMETIC * VANILLA_SFX_ORACLE_BYTES_PER_SAMPLE_PAIR).toBe(VANILLA_SFX_ORACLE_WINDOW_BYTES_PER_GAMETIC);
  });

  test('validator accepts 1260-byte sample buffer at non-negative gametic', () => {
    expect(vanillaSfxOracleWindowIsValid({ gameTic: 0, samples: Buffer.alloc(1260) })).toBe(true);
    expect(vanillaSfxOracleWindowIsValid({ gameTic: 35000, samples: Buffer.alloc(1260) })).toBe(true);
  });

  test('validator rejects wrong-size buffer', () => {
    expect(vanillaSfxOracleWindowIsValid({ gameTic: 0, samples: Buffer.alloc(1259) })).toBe(false);
    expect(vanillaSfxOracleWindowIsValid({ gameTic: 0, samples: Buffer.alloc(1261) })).toBe(false);
  });

  test('validator rejects negative gametic', () => {
    expect(vanillaSfxOracleWindowIsValid({ gameTic: -1, samples: Buffer.alloc(1260) })).toBe(false);
  });

  test('empty window lists compare equal', () => {
    expect(vanillaSfxOracleWindowsEqual([], [])).toBe(true);
  });

  test('byte-identical windows compare equal', () => {
    const buffer = Buffer.from([0x12, 0x34, 0x56, 0x78]);
    const padded = Buffer.concat([buffer, Buffer.alloc(1256)]);
    const actual = [{ gameTic: 0, samples: padded }];
    const expected = [{ gameTic: 0, samples: Buffer.from(padded) }];
    expect(vanillaSfxOracleWindowsEqual(actual, expected)).toBe(true);
  });

  test('differing sample byte breaks equality', () => {
    const buffer1 = Buffer.alloc(1260);
    const buffer2 = Buffer.alloc(1260);
    buffer2[100] = 1;
    expect(vanillaSfxOracleWindowsEqual([{ gameTic: 0, samples: buffer1 }], [{ gameTic: 0, samples: buffer2 }])).toBe(false);
  });

  test('different gameTic breaks equality even with same samples', () => {
    const samples = Buffer.alloc(1260);
    expect(vanillaSfxOracleWindowsEqual([{ gameTic: 0, samples }], [{ gameTic: 1, samples }])).toBe(false);
  });

  test('different length window lists are unequal', () => {
    const samples = Buffer.alloc(1260);
    expect(vanillaSfxOracleWindowsEqual([{ gameTic: 0, samples }], [])).toBe(false);
  });
});
