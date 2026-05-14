import { describe, expect, test } from 'bun:test';

import { FINAL_PLAN_LANES, FINAL_PLAN_STEP_COUNT, FINAL_PLAN_STEPS } from '../../plan_final/planData.ts';
import { stepFilePath, validatePlan } from '../../plan_final/validate-plan.ts';

describe('plan_final control center', () => {
  test('validates the generated plan structure', async () => {
    const result = await validatePlan();

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.stepCount).toBe(FINAL_PLAN_STEP_COUNT);
  });

  test('contains a small-step checklist across every final lane', () => {
    expect(FINAL_PLAN_STEP_COUNT).toBeGreaterThanOrEqual(100);
    expect(FINAL_PLAN_LANES.map((lane) => lane.lane)).toEqual([
      'governance',
      'current-state',
      'oracle',
      'launch-host-input',
      'runtime-core',
      'wad-assets',
      'render',
      'ui',
      'map-world',
      'player-weapons-items',
      'ai-specials',
      'audio',
      'save-config-demo',
      'acceptance',
    ]);
  });

  test('requires every step to fix failures before completion', async () => {
    for (const step of FINAL_PLAN_STEPS) {
      const stepText = await Bun.file(stepFilePath(step)).text();

      expect(stepText).toContain('Any failure is fixed in this same step');
      expect(stepText).toContain('not marked complete');
      expect(stepText).toContain('committed with a Conventional Commit');
      expect(stepText).toContain('pushed directly with local git commands');
    }
  });

  test('makes final acceptance execute doom.ts instead of accepting manifest-only proof', () => {
    const finalStep = FINAL_PLAN_STEPS.find((step) => step.id === '13-011');

    expect(finalStep).toBeDefined();
    expect(finalStep?.goal).toContain('Execute final side-by-side');
    expect(finalStep?.goal).toContain('no pending evidence');
    expect(finalStep?.readOnlyPaths).toContain('doom.ts');
    expect(finalStep?.testFiles).toContain('test/plan_final/acceptance/gate-final-side-by-side-zero-diff.test.ts');
  });
});
