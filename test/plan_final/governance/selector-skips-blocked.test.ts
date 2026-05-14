import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { selectNextStep } from '../../../plan_final/select-step.ts';

describe('plan_final selector treatment of BLOCKED status JSONs', () => {
  let statusDirectory: string;

  beforeEach(async () => {
    statusDirectory = await mkdtemp(join(tmpdir(), 'plan-final-status-blocked-'));
  });

  afterEach(async () => {
    await rm(statusDirectory, { recursive: true, force: true });
  });

  test('skips a BLOCKED step and advances to the next eligible step whose prereqs are COMPLETED', async () => {
    await writeFile(join(statusDirectory, '00-001.json'), JSON.stringify({ stepId: '00-001', lane: 'governance', status: 'COMPLETED' }));
    await writeFile(join(statusDirectory, '00-002.json'), JSON.stringify({ stepId: '00-002', lane: 'governance', status: 'BLOCKED', blockerReason: 'test fixture: governance blocker' }));

    const selection = await selectNextStep('governance', { statusDirectory });

    expect(selection.step?.id).not.toBe('00-001');
    expect(selection.step?.id).not.toBe('00-002');
    expect(selection.step?.id).toBe('00-003');
    expect(selection.step?.lane).toBe('governance');
    expect(selection.reason).toBe('first eligible step');
  });

  test('does not satisfy prerequisites with a BLOCKED status: downstream steps remain unreachable', async () => {
    await writeFile(join(statusDirectory, '00-001.json'), JSON.stringify({ stepId: '00-001', lane: 'governance', status: 'BLOCKED', blockerReason: 'test fixture: governance blocker' }));

    const selection = await selectNextStep('governance', { statusDirectory });

    expect(selection.step).toBeNull();
    expect(selection.reason).toBe('no eligible step in lane governance');
  });

  test('a BLOCKED step is also skipped when no lane filter is provided', async () => {
    await writeFile(join(statusDirectory, '00-001.json'), JSON.stringify({ stepId: '00-001', lane: 'governance', status: 'COMPLETED' }));
    await writeFile(join(statusDirectory, '00-002.json'), JSON.stringify({ stepId: '00-002', lane: 'governance', status: 'BLOCKED', blockerReason: 'test fixture: governance blocker' }));

    const selection = await selectNextStep(null, { statusDirectory });

    expect(selection.step?.id).toBe('00-003');
    expect(selection.reason).toBe('first eligible step');
  });

  test('mixed BLOCKED and COMPLETED records select the first lane step whose prereqs are all COMPLETED', async () => {
    await writeFile(join(statusDirectory, '00-001.json'), JSON.stringify({ stepId: '00-001', lane: 'governance', status: 'COMPLETED' }));
    await writeFile(join(statusDirectory, '00-002.json'), JSON.stringify({ stepId: '00-002', lane: 'governance', status: 'COMPLETED' }));
    await writeFile(join(statusDirectory, '00-003.json'), JSON.stringify({ stepId: '00-003', lane: 'governance', status: 'COMPLETED' }));
    await writeFile(join(statusDirectory, '00-004.json'), JSON.stringify({ stepId: '00-004', lane: 'governance', status: 'BLOCKED', blockerReason: 'test fixture: governance blocker' }));
    await writeFile(join(statusDirectory, '00-005.json'), JSON.stringify({ stepId: '00-005', lane: 'governance', status: 'COMPLETED' }));
    await writeFile(join(statusDirectory, '00-006.json'), JSON.stringify({ stepId: '00-006', lane: 'governance', status: 'COMPLETED' }));

    const selection = await selectNextStep('governance', { statusDirectory });

    expect(selection.step).toBeNull();
    expect(selection.reason).toBe('no eligible step in lane governance');
  });
});
