import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { selectNextStep } from '../../plan_final/select-step.ts';

describe('plan_final step selector', () => {
  let statusDirectory: string;

  beforeEach(async () => {
    statusDirectory = await mkdtemp(join(tmpdir(), 'plan-final-status-'));
  });

  afterEach(async () => {
    await rm(statusDirectory, { recursive: true, force: true });
  });

  test('selects the first governance step when no status files exist', async () => {
    const selection = await selectNextStep(null, { statusDirectory });

    expect(selection.step?.id).toBe('00-001');
    expect(selection.step?.lane).toBe('governance');
    expect(selection.stepFile).toBe('plan_final/steps/00-001-create-final-control-center.md');
  });

  test('honors a lane filter without scanning unrelated implementation files', async () => {
    const selection = await selectNextStep('governance', { statusDirectory });

    expect(selection.step?.id).toBe('00-001');
    expect(selection.step?.lane).toBe('governance');
    expect(selection.stepFile).toBe('plan_final/steps/00-001-create-final-control-center.md');
  });

  test('skips steps whose status file reports COMPLETED', async () => {
    await writeFile(join(statusDirectory, '00-001.json'), JSON.stringify({ stepId: '00-001', status: 'COMPLETED' }));

    const selection = await selectNextStep('governance', { statusDirectory });

    expect(selection.step?.id).toBe('00-002');
    expect(selection.step?.lane).toBe('governance');
  });

  test('blocks a step whose prerequisite is not COMPLETED', async () => {
    const selection = await selectNextStep('current-state', { statusDirectory });

    expect(selection.step).toBeNull();
    expect(selection.reason).toBe('no eligible step in lane current-state');
  });

  test('reports a clear reason when no step is eligible at all', async () => {
    for (const stepId of ['00-001', '00-002', '00-003', '00-004', '00-005', '00-006', '00-007']) {
      await writeFile(join(statusDirectory, `${stepId}.json`), JSON.stringify({ stepId, status: 'COMPLETED' }));
    }

    const selection = await selectNextStep('governance', { statusDirectory });

    expect(selection.step).toBeNull();
    expect(selection.reason).toBe('no eligible step in lane governance');
  });
});
