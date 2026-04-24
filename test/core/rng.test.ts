import { describe, expect, it } from 'bun:test';

import { DoomRandom, RNG_TABLE } from '../../src/core/rng.ts';

describe('RNG_TABLE', () => {
  it('has exactly 256 entries', () => {
    expect(RNG_TABLE.length).toBe(256);
  });

  it('contains only values in the 0–255 range', () => {
    for (const value of RNG_TABLE) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(255);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(RNG_TABLE)).toBe(true);
  });

  it('starts with the canonical first 8 values', () => {
    expect(RNG_TABLE.slice(0, 8)).toEqual([0, 8, 109, 220, 222, 241, 149, 107]);
  });

  it('ends with the canonical last 4 values', () => {
    expect(RNG_TABLE.slice(252)).toEqual([120, 163, 236, 249]);
  });

  it('has the canonical value at index 0', () => {
    expect(RNG_TABLE[0]).toBe(0);
  });

  it('has the canonical value at index 255', () => {
    expect(RNG_TABLE[255]).toBe(249);
  });
});

describe('DoomRandom', () => {
  describe('pRandom', () => {
    it('returns RNG_TABLE[1] on the first call (pre-increment)', () => {
      const rng = new DoomRandom();
      expect(rng.pRandom()).toBe(8);
    });

    it('returns sequential table values', () => {
      const rng = new DoomRandom();
      expect(rng.pRandom()).toBe(RNG_TABLE[1]); // 8
      expect(rng.pRandom()).toBe(RNG_TABLE[2]); // 109
      expect(rng.pRandom()).toBe(RNG_TABLE[3]); // 220
    });

    it('wraps around after 256 calls', () => {
      const rng = new DoomRandom();
      for (let i = 0; i < 256; i++) {
        rng.pRandom();
      }
      // prndindex is now back to 0; next call returns RNG_TABLE[1]
      expect(rng.prndindex).toBe(0);
      expect(rng.pRandom()).toBe(RNG_TABLE[1]);
    });

    it('advances prndindex by 1 per call', () => {
      const rng = new DoomRandom();
      expect(rng.prndindex).toBe(0);
      rng.pRandom();
      expect(rng.prndindex).toBe(1);
      rng.pRandom();
      expect(rng.prndindex).toBe(2);
    });

    it('produces values in the 0–255 range over a full cycle', () => {
      const rng = new DoomRandom();
      for (let i = 0; i < 256; i++) {
        const value = rng.pRandom();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('mRandom', () => {
    it('returns RNG_TABLE[1] on the first call (pre-increment)', () => {
      const rng = new DoomRandom();
      expect(rng.mRandom()).toBe(8);
    });

    it('advances rndindex independently of prndindex', () => {
      const rng = new DoomRandom();
      rng.mRandom();
      expect(rng.rndindex).toBe(1);
      expect(rng.prndindex).toBe(0);
    });

    it('wraps around after 256 calls', () => {
      const rng = new DoomRandom();
      for (let i = 0; i < 256; i++) {
        rng.mRandom();
      }
      expect(rng.rndindex).toBe(0);
      expect(rng.mRandom()).toBe(RNG_TABLE[1]);
    });

    it('full 256-call cycle produces exactly the table values in order', () => {
      const rng = new DoomRandom();
      for (let i = 0; i < 256; i++) {
        expect(rng.mRandom()).toBe(RNG_TABLE[(i + 1) & 0xff]);
      }
    });
  });

  describe('stream independence', () => {
    it('pRandom does not affect mRandom stream', () => {
      const rng = new DoomRandom();
      rng.pRandom();
      rng.pRandom();
      rng.pRandom();
      // mRandom should still be at index 0, so first call returns RNG_TABLE[1]
      expect(rng.mRandom()).toBe(RNG_TABLE[1]);
    });

    it('mRandom does not affect pRandom stream', () => {
      const rng = new DoomRandom();
      rng.mRandom();
      rng.mRandom();
      rng.mRandom();
      // pRandom should still be at index 0, so first call returns RNG_TABLE[1]
      expect(rng.pRandom()).toBe(RNG_TABLE[1]);
    });

    it('interleaved calls produce same values as independent streams', () => {
      const interleaved = new DoomRandom();
      const pOnly = new DoomRandom();
      const mOnly = new DoomRandom();

      const pValues: number[] = [];
      const mValues: number[] = [];

      // Interleave P and M calls
      for (let i = 0; i < 10; i++) {
        pValues.push(interleaved.pRandom());
        mValues.push(interleaved.mRandom());
      }

      // Compare against isolated streams
      for (let i = 0; i < 10; i++) {
        expect(pValues[i]).toBe(pOnly.pRandom());
        expect(mValues[i]).toBe(mOnly.mRandom());
      }
    });
  });

  describe('clearRandom', () => {
    it('resets both indices to 0', () => {
      const rng = new DoomRandom();
      rng.pRandom();
      rng.pRandom();
      rng.mRandom();
      rng.clearRandom();
      expect(rng.prndindex).toBe(0);
      expect(rng.rndindex).toBe(0);
    });

    it('produces identical sequence after clear', () => {
      const rng = new DoomRandom();
      const firstRun: number[] = [];
      for (let i = 0; i < 5; i++) {
        firstRun.push(rng.pRandom());
      }

      rng.clearRandom();

      for (let i = 0; i < 5; i++) {
        expect(rng.pRandom()).toBe(firstRun[i]);
      }
    });
  });

  describe('pSubRandom', () => {
    it('returns P_Random() - P_Random() (consumes two values)', () => {
      const rng = new DoomRandom();
      // First P_Random: index 1, value 8
      // Second P_Random: index 2, value 109
      // Result: 8 - 109 = -101
      expect(rng.pSubRandom()).toBe(8 - 109);
    });

    it('advances prndindex by 2', () => {
      const rng = new DoomRandom();
      rng.pSubRandom();
      expect(rng.prndindex).toBe(2);
    });

    it('result range is -255 to +255', () => {
      const rng = new DoomRandom();
      for (let i = 0; i < 128; i++) {
        const value = rng.pSubRandom();
        expect(value).toBeGreaterThanOrEqual(-255);
        expect(value).toBeLessThanOrEqual(255);
      }
    });

    it('does not affect mRandom stream', () => {
      const rng = new DoomRandom();
      rng.pSubRandom();
      expect(rng.rndindex).toBe(0);
    });

    it('spans the 255→0 wrap boundary without losing a step', () => {
      // Advance to prndindex=254. Next pSubRandom consumes index 255 (table
      // value 249) and index 0 (table value 0). Result = 249 - 0 = 249.
      const rng = new DoomRandom();
      for (let i = 0; i < 254; i++) rng.pRandom();
      expect(rng.prndindex).toBe(254);
      expect(rng.pSubRandom()).toBe(RNG_TABLE[255]! - RNG_TABLE[0]!);
      expect(rng.prndindex).toBe(0);
    });
  });

  describe('determinism parity', () => {
    it('two fresh instances produce identical P_Random sequences', () => {
      const rng1 = new DoomRandom();
      const rng2 = new DoomRandom();
      for (let i = 0; i < 512; i++) {
        expect(rng1.pRandom()).toBe(rng2.pRandom());
      }
    });

    it('full 256-call cycle produces exactly the table values in order', () => {
      const rng = new DoomRandom();
      for (let i = 0; i < 256; i++) {
        expect(rng.pRandom()).toBe(RNG_TABLE[(i + 1) & 0xff]);
      }
    });
  });
});
