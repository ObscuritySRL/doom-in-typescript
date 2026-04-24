import { describe, expect, test } from 'bun:test';

import { parseChecklist, validatePlan } from './validate-plan.ts';

describe('playable plan validator', () => {
  test('accepts the generated plan with the exact step count and first step', async () => {
    const result = await validatePlan();

    expect(result.errors).toEqual([]);
    expect(result.totalSteps).toBe(223);
    expect(result.firstStep).toBe('00-001');
  });

  test('parses every checklist entry with exact ids and step file paths', async () => {
    const checklistText = await Bun.file('plan_fps/MASTER_CHECKLIST.md').text();
    const checklistSteps = parseChecklist(checklistText);

    expect(checklistSteps).toHaveLength(223);
    expect(checklistSteps[0]).toEqual({
      filePath: 'plan_fps/steps/00-001-classify-existing-plan.md',
      id: '00-001',
      lineNumber: 10,
      prereq: 'none',
      titleSlug: 'classify-existing-plan',
    });
    expect(checklistSteps.at(-1)).toEqual({
      filePath: 'plan_fps/steps/15-010-gate-final-side-by-side.md',
      id: '15-010',
      lineNumber: 277,
      prereq: '15-009',
      titleSlug: 'gate-final-side-by-side',
    });
  });
});
