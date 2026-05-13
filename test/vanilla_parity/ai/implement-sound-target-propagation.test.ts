import { describe, expect, test } from 'bun:test';

import { VANILLA_ML_SOUNDBLOCK, VANILLA_ML_TWOSIDED, nextSoundBlocksAfterCrossing, vanillaSoundFloodVisitsAndStops } from '../../../src/ai/implement-sound-target-propagation.ts';

describe('vanilla sound propagation constants', () => {
  test('ML_SOUNDBLOCK=64, ML_TWOSIDED=4', () => {
    expect(VANILLA_ML_SOUNDBLOCK).toBe(64);
    expect(VANILLA_ML_TWOSIDED).toBe(4);
  });
});

describe('nextSoundBlocksAfterCrossing', () => {
  test('plain (no soundblock) line propagates with same counter', () => {
    expect(nextSoundBlocksAfterCrossing(0, false)).toBe(0);
    expect(nextSoundBlocksAfterCrossing(1, false)).toBe(1);
  });

  test('first soundblock line bumps counter from 0 to 1', () => {
    expect(nextSoundBlocksAfterCrossing(0, true)).toBe(1);
  });

  test('second soundblock line at counter>=1 stops propagation (returns null)', () => {
    expect(nextSoundBlocksAfterCrossing(1, true)).toBeNull();
  });
});

describe('vanillaSoundFloodVisitsAndStops', () => {
  test('skips one-sided lines', () => {
    const steps = vanillaSoundFloodVisitsAndStops({
      sectorIndex: 0,
      soundBlocksAtEntry: 0,
      outboundEdges: [{ neighborSectorIndex: 1, twoSided: false, openRangePositive: true, hasSoundBlock: false }],
    });
    expect(steps).toHaveLength(0);
  });

  test('skips closed-door (openrange<=0) lines', () => {
    const steps = vanillaSoundFloodVisitsAndStops({
      sectorIndex: 0,
      soundBlocksAtEntry: 0,
      outboundEdges: [{ neighborSectorIndex: 1, twoSided: true, openRangePositive: false, hasSoundBlock: false }],
    });
    expect(steps).toHaveLength(0);
  });

  test('open two-sided line propagates with same counter', () => {
    const steps = vanillaSoundFloodVisitsAndStops({
      sectorIndex: 0,
      soundBlocksAtEntry: 0,
      outboundEdges: [{ neighborSectorIndex: 1, twoSided: true, openRangePositive: true, hasSoundBlock: false }],
    });
    expect(steps).toEqual([{ neighborSectorIndex: 1, nextSoundBlocks: 0 }]);
  });

  test('first soundblock line bumps to 1', () => {
    const steps = vanillaSoundFloodVisitsAndStops({
      sectorIndex: 0,
      soundBlocksAtEntry: 0,
      outboundEdges: [{ neighborSectorIndex: 1, twoSided: true, openRangePositive: true, hasSoundBlock: true }],
    });
    expect(steps).toEqual([{ neighborSectorIndex: 1, nextSoundBlocks: 1 }]);
  });

  test('second soundblock line stops propagation', () => {
    const steps = vanillaSoundFloodVisitsAndStops({
      sectorIndex: 0,
      soundBlocksAtEntry: 1,
      outboundEdges: [{ neighborSectorIndex: 1, twoSided: true, openRangePositive: true, hasSoundBlock: true }],
    });
    expect(steps).toHaveLength(0);
  });
});
