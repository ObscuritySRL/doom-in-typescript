import { describe, expect, test } from 'bun:test';

import { ANG180, ANG270, ANG90 } from '../../src/core/angle.ts';
import { FRACUNIT, fixedDiv, fixedMul } from '../../src/core/fixed.ts';
import { ANGLETOFINESHIFT, DBITS, finesine, slopeDiv, tantoangle } from '../../src/core/trig.ts';
import { WALL_SCALE_MAX, WALL_SCALE_MIN, rPointToAngle, rPointToAngle2, rPointToDist, rScaleFromGlobalAngle } from '../../src/render/wallScaleMath.ts';

function expectedPointToAngle(viewX: number, viewY: number, x: number, y: number): number {
  // Independent structural transcription of r_main.c R_PointToAngle.
  let deltaX = (x - viewX) | 0;
  let deltaY = (y - viewY) | 0;
  if (deltaX === 0 && deltaY === 0) {
    return 0;
  }
  if (deltaX >= 0) {
    if (deltaY >= 0) {
      return deltaX > deltaY ? tantoangle[slopeDiv(deltaY, deltaX)]! >>> 0 : (ANG90 - 1 - tantoangle[slopeDiv(deltaX, deltaY)]!) >>> 0;
    }
    deltaY = -deltaY | 0;
    return deltaX > deltaY ? -tantoangle[slopeDiv(deltaY, deltaX)]! >>> 0 : (ANG270 + tantoangle[slopeDiv(deltaX, deltaY)]!) >>> 0;
  }
  deltaX = -deltaX | 0;
  if (deltaY >= 0) {
    return deltaX > deltaY ? (ANG180 - 1 - tantoangle[slopeDiv(deltaY, deltaX)]!) >>> 0 : (ANG90 + tantoangle[slopeDiv(deltaX, deltaY)]!) >>> 0;
  }
  deltaY = -deltaY | 0;
  return deltaX > deltaY ? (ANG180 + tantoangle[slopeDiv(deltaY, deltaX)]!) >>> 0 : (ANG270 - 1 - tantoangle[slopeDiv(deltaX, deltaY)]!) >>> 0;
}

function expectedPointToDist(viewX: number, viewY: number, x: number, y: number): number {
  let dx = Math.abs((x - viewX) | 0) | 0;
  let dy = Math.abs((y - viewY) | 0) | 0;
  if (dy > dx) {
    const swap = dx;
    dx = dy;
    dy = swap;
  }
  const frac = dx !== 0 ? fixedDiv(dy, dx) : 0;
  const angle = ((tantoangle[frac >> DBITS]! + ANG90) >>> 0) >>> ANGLETOFINESHIFT;
  return fixedDiv(dx, finesine[angle]!);
}

function expectedScaleFromGlobalAngle(visangle: number, viewAngle: number, rwNormalangle: number, rwDistance: number, projection: number, detailShift: number): number {
  const anglea = (ANG90 + visangle - viewAngle) >>> 0;
  const angleb = (ANG90 + visangle - rwNormalangle) >>> 0;
  const num = (fixedMul(projection, finesine[angleb >>> ANGLETOFINESHIFT]!) << detailShift) | 0;
  const den = fixedMul(rwDistance, finesine[anglea >>> ANGLETOFINESHIFT]!);
  if (den > num >> 16) {
    const scale = fixedDiv(num, den);
    return scale > WALL_SCALE_MAX ? WALL_SCALE_MAX : scale < WALL_SCALE_MIN ? WALL_SCALE_MIN : scale;
  }
  return WALL_SCALE_MAX;
}

const SAMPLE_COORDINATES: readonly number[] = [-4_194_304, -1_048_576, -65_536, -4096, -1, 0, 1, 4096, 65_536, 1_048_576, 4_194_304];

describe('wallScaleMath: R_PointToAngle / R_PointToAngle2', () => {
  test('cardinal directions match the vanilla octant constants (16.16 fixed-point world coords)', () => {
    const distance = 100 * FRACUNIT;
    expect(rPointToAngle(0, 0, 0, 0)).toBe(0);
    expect(rPointToAngle(0, 0, distance, 0)).toBe(0); // due east
    expect(rPointToAngle(0, 0, 0, distance)).toBe((ANG90 - 1) >>> 0); // due north
    expect(rPointToAngle(0, 0, -distance, 0)).toBe((ANG180 - 1) >>> 0); // due west
    expect(rPointToAngle(0, 0, 0, -distance)).toBe(ANG270 >>> 0); // due south
  });

  test('full independent vanilla re-derivation over a coordinate grid', () => {
    for (const viewX of [0, 4096, -65_536]) {
      for (const viewY of [0, -4096, 65_536]) {
        for (const x of SAMPLE_COORDINATES) {
          for (const y of SAMPLE_COORDINATES) {
            expect(rPointToAngle(viewX, viewY, x, y) >>> 0).toBe(expectedPointToAngle(viewX, viewY, x, y) >>> 0);
          }
        }
      }
    }
  });

  test('R_PointToAngle2 equals R_PointToAngle measured from (x1,y1) and is deterministic', () => {
    for (const x1 of SAMPLE_COORDINATES) {
      for (const y1 of SAMPLE_COORDINATES) {
        expect(rPointToAngle2(x1, y1, 123_456, -98_765) >>> 0).toBe(rPointToAngle(x1, y1, 123_456, -98_765) >>> 0);
      }
    }
    expect(rPointToAngle(10, 20, 30, 40)).toBe(rPointToAngle(10, 20, 30, 40));
  });
});

describe('wallScaleMath: R_PointToDist', () => {
  test('cardinal distance is axis-symmetric, positive, and deterministic', () => {
    for (const distance of [4096, 65_536, 1_048_576, 4_194_304]) {
      const east = rPointToDist(0, 0, distance, 0);
      expect(east).toBeGreaterThan(0);
      expect(rPointToDist(0, 0, -distance, 0)).toBe(east);
      expect(rPointToDist(0, 0, 0, distance)).toBe(east);
      expect(rPointToDist(0, 0, 0, -distance)).toBe(east);
      expect(rPointToDist(0, 0, distance, 0)).toBe(east);
    }
  });

  test('full independent vanilla re-derivation over a coordinate grid and non-negative', () => {
    for (const viewX of [0, 4096, -65_536]) {
      for (const viewY of [0, -4096, 65_536]) {
        for (const x of SAMPLE_COORDINATES) {
          for (const y of SAMPLE_COORDINATES) {
            const observed = rPointToDist(viewX, viewY, x, y);
            expect(observed).toBe(expectedPointToDist(viewX, viewY, x, y));
            expect(observed).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe('wallScaleMath: R_ScaleFromGlobalAngle', () => {
  test('full independent vanilla re-derivation over sampled inputs', () => {
    for (const visangle of [0, ANG90, ANG180, ANG270, 0x1234_5678, 0xabcd_0000]) {
      for (const viewAngle of [0, 0x2000_0000, ANG90, 0x0fed_cba0]) {
        for (const rwNormalangle of [0, ANG90, ANG270]) {
          for (const rwDistance of [256, 65_536, 1_048_576, 64 * FRACUNIT]) {
            for (const projection of [160 * FRACUNIT, 144 * FRACUNIT]) {
              for (const detailShift of [0, 1]) {
                expect(rScaleFromGlobalAngle(visangle >>> 0, viewAngle >>> 0, rwNormalangle >>> 0, rwDistance, projection, detailShift)).toBe(
                  expectedScaleFromGlobalAngle(visangle >>> 0, viewAngle >>> 0, rwNormalangle >>> 0, rwDistance, projection, detailShift),
                );
              }
            }
          }
        }
      }
    }
  });

  test('result is always clamped to [256, 64*FRACUNIT]', () => {
    for (const visangle of [0, ANG90, 0x2222_2222, 0xeeee_eeee]) {
      for (const rwDistance of [1, 256, 1_048_576, 64 * FRACUNIT]) {
        const scale = rScaleFromGlobalAngle(visangle >>> 0, 0, ANG90, rwDistance, 160 * FRACUNIT, 0);
        expect(scale).toBeGreaterThanOrEqual(WALL_SCALE_MIN);
        expect(scale).toBeLessThanOrEqual(WALL_SCALE_MAX);
      }
    }
  });

  test('saturates to 64*FRACUNIT when the denominator guard fails (near-zero distance)', () => {
    expect(rScaleFromGlobalAngle(ANG90 >>> 0, 0, ANG90, 0, 160 * FRACUNIT, 0)).toBe(WALL_SCALE_MAX);
  });
});
