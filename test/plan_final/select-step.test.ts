import { describe, expect, test } from 'bun:test';

import { selectNextStep } from '../../plan_final/select-step.ts';

describe('plan_final step selector', () => {
  test('selects the first governance step when no status files exist', async () => {
    const selection = await selectNextStep();

    expect(selection.step?.id).toBe('00-001');
    expect(selection.step?.lane).toBe('governance');
    expect(selection.stepFile).toBe('plan_final/steps/00-001-create-final-control-center.md');
  });

  test('honors a lane filter without scanning unrelated implementation files', async () => {
    const selection = await selectNextStep('governance');

    expect(selection.step?.id).toBe('00-001');
    expect(selection.step?.lane).toBe('governance');
    expect(selection.stepFile).toBe('plan_final/steps/00-001-create-final-control-center.md');
  });
});
