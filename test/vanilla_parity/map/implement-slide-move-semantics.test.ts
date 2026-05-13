import { describe, expect, test } from 'bun:test';

import { VANILLA_SLIDE_MAX_ITERATIONS, projectSlideOntoWall } from '../../../src/map/implement-slide-move-semantics.ts';

describe('vanilla slide move contract', () => {
  test('max iterations is 3 per vanilla P_SlideMove', () => {
    expect(VANILLA_SLIDE_MAX_ITERATIONS).toBe(3);
  });
});

describe('projectSlideOntoWall', () => {
  test('hitting a wall perpendicular to motion zeros out forward motion', () => {
    const result = projectSlideOntoWall({ remainingDx: 10, remainingDy: 0, lineNormalUnitX: 1, lineNormalUnitY: 0 });
    expect(result.slideDx).toBeCloseTo(0, 6);
    expect(result.slideDy).toBeCloseTo(0, 6);
  });

  test('sliding along a wall preserves tangent motion', () => {
    const result = projectSlideOntoWall({ remainingDx: 10, remainingDy: 0, lineNormalUnitX: 0, lineNormalUnitY: 1 });
    expect(result.slideDx).toBeCloseTo(10, 6);
    expect(result.slideDy).toBeCloseTo(0, 6);
  });

  test('45-degree incidence reduces magnitude by sqrt(2)/2', () => {
    const result = projectSlideOntoWall({ remainingDx: 10, remainingDy: 0, lineNormalUnitX: Math.SQRT1_2, lineNormalUnitY: Math.SQRT1_2 });
    expect(result.slideDx).toBeCloseTo(5, 6);
    expect(result.slideDy).toBeCloseTo(-5, 6);
  });
});
