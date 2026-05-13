import { describe, expect, test } from 'bun:test';

import { evaluateRejectFastPath, rejectBitmapBitOffset, rejectBitmapByteIndex } from '../../../src/map/implement-reject-sight-fast-path.ts';

describe('reject fast-path indexing', () => {
  test('byte index is (s1*N+s2) >> 3, bit offset is (s1*N+s2) & 7', () => {
    expect(rejectBitmapByteIndex(0, 0, 8)).toBe(0);
    expect(rejectBitmapBitOffset(0, 7, 8)).toBe(7);
    expect(rejectBitmapByteIndex(1, 0, 8)).toBe(1);
    expect(rejectBitmapBitOffset(1, 0, 8)).toBe(0);
  });
});

describe('evaluateRejectFastPath', () => {
  test('returns rejected when REJECT bit is set', () => {
    const bitmap = new Uint8Array([0b00000001]); // bit (0,0) set
    expect(evaluateRejectFastPath({ sourceSectorIndex: 0, targetSectorIndex: 0, sectorCount: 8, rejectBitmap: bitmap })).toBe('rejected');
  });

  test('returns requires-trace when bit is clear', () => {
    const bitmap = new Uint8Array([0b00000000]);
    expect(evaluateRejectFastPath({ sourceSectorIndex: 0, targetSectorIndex: 0, sectorCount: 8, rejectBitmap: bitmap })).toBe('requires-trace');
  });

  test('out-of-range sector indexes fall back to trace', () => {
    const bitmap = new Uint8Array(16);
    expect(evaluateRejectFastPath({ sourceSectorIndex: -1, targetSectorIndex: 0, sectorCount: 8, rejectBitmap: bitmap })).toBe('requires-trace');
    expect(evaluateRejectFastPath({ sourceSectorIndex: 8, targetSectorIndex: 0, sectorCount: 8, rejectBitmap: bitmap })).toBe('requires-trace');
  });

  test('reject bit at (1, 0) when set returns rejected', () => {
    const bitmap = new Uint8Array([0b00000000, 0b00000001]);
    expect(evaluateRejectFastPath({ sourceSectorIndex: 1, targetSectorIndex: 0, sectorCount: 8, rejectBitmap: bitmap })).toBe('rejected');
  });
});
