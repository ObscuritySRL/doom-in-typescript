import { describe, expect, test } from 'bun:test';

import { VANILLA_USE_RANGE, selectUseLineCandidate } from '../../../src/map/implement-use-line-traversal.ts';

describe('vanilla USE traversal contract', () => {
  test('USERANGE is 64 map units', () => {
    expect(VANILLA_USE_RANGE).toBe(64);
  });

  test('activates the first special line within range', () => {
    const decision = selectUseLineCandidate({ candidates: [{ distanceFromEye: 30, hasSpecial: true, isTwoSided: false }] });
    expect(decision.activatedCandidateIndex).toBe(0);
  });

  test('passes through two-sided non-special lines to find a special behind them', () => {
    const decision = selectUseLineCandidate({
      candidates: [
        { distanceFromEye: 10, hasSpecial: false, isTwoSided: true },
        { distanceFromEye: 30, hasSpecial: true, isTwoSided: false },
      ],
    });
    expect(decision.activatedCandidateIndex).toBe(1);
    expect(decision.skippedCount).toBe(1);
  });

  test('blocks on single-sided non-special line (the wall is solid)', () => {
    const decision = selectUseLineCandidate({
      candidates: [
        { distanceFromEye: 10, hasSpecial: false, isTwoSided: false },
        { distanceFromEye: 30, hasSpecial: true, isTwoSided: false },
      ],
    });
    expect(decision.activatedCandidateIndex).toBeNull();
  });

  test('beyond USERANGE no activation occurs', () => {
    const decision = selectUseLineCandidate({ candidates: [{ distanceFromEye: 65, hasSpecial: true, isTwoSided: false }] });
    expect(decision.activatedCandidateIndex).toBeNull();
  });
});
