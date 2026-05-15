import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { FINAL_PLAN_STEPS, type FinalPlanStep } from '../../../plan_final/planData.ts';
import { selectNextStep } from '../../../plan_final/select-step.ts';
import { findCrossLaneWriteLockOverlaps } from '../../../plan_final/validate-plan.ts';

const GOVERNANCE_STEP_ID = '03-011';
const GATED_ACCEPTANCE_ROOT_IDS = ['13-001', '13-005', '13-007'] as const;
const GOVERNED_UNLOCK_WRITE_LOCK = [
  'doom.ts',
  'test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts',
  'test/plan_final/launch/gate-clean-launch-to-title.test.ts',
  'test/plan_final/launch/replace-root-doom-entrypoint.test.ts',
  'test/plan_final/launch/supersede-doom-ts-skeleton-pins.test.ts',
  'plan_final/status/',
  'plan_final/evidence/',
];
const RESTORED_PIN_TESTS = ['test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts', 'test/plan_final/launch/gate-clean-launch-to-title.test.ts', 'test/plan_final/launch/replace-root-doom-entrypoint.test.ts'];

function stepById(id: string): FinalPlanStep | undefined {
  return FINAL_PLAN_STEPS.find((candidate) => candidate.id === id);
}

function indexOfStep(id: string): number {
  return FINAL_PLAN_STEPS.findIndex((candidate) => candidate.id === id);
}

function prerequisiteClosure(id: string): ReadonlySet<string> {
  const closure = new Set<string>();
  const queue: string[] = [id];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    const step = stepById(current);
    if (step === undefined) {
      continue;
    }
    for (const prerequisite of step.prerequisites) {
      if (!closure.has(prerequisite)) {
        closure.add(prerequisite);
        queue.push(prerequisite);
      }
    }
  }
  return closure;
}

describe('plan_final governance: 03-011 supersede-doom-ts-skeleton-pins', () => {
  test('the governance/unlock step exists in the launch-host-input lane before 13-001', () => {
    const step = stepById(GOVERNANCE_STEP_ID);
    expect(step).toBeDefined();
    expect(step?.lane).toBe('launch-host-input');
    expect(step?.title).toBe('supersede-doom-ts-skeleton-pins');
    expect(indexOfStep(GOVERNANCE_STEP_ID)).toBeGreaterThanOrEqual(0);
    expect(indexOfStep(GOVERNANCE_STEP_ID)).toBeLessThan(indexOfStep('13-001'));
  });

  test('its prerequisites are the already-completed skeleton-creating launch steps (eligible now, not gated by the BLOCKED 03-002)', () => {
    const step = stepById(GOVERNANCE_STEP_ID);
    expect(step?.prerequisites).toEqual(['03-001', '03-010']);
    expect(step?.prerequisites).not.toContain('03-002');
  });

  test('its write lock covers only the governed unlock files (no package.json, no src/main.ts, no cross-lane current-state inventory)', () => {
    const step = stepById(GOVERNANCE_STEP_ID);
    expect([...(step?.writeLock ?? [])].sort()).toEqual([...GOVERNED_UNLOCK_WRITE_LOCK].sort());
    expect(step?.writeLock).not.toContain('package.json');
    expect(step?.writeLock).not.toContain('src/main.ts');
    expect(step?.writeLock).not.toContain('plan_final/current-state/runtime-implementation-modules.json');
    expect(step?.writeLock).not.toContain('test/plan_final/current-state/runtime-implementation-modules.test.ts');
  });

  test('13-001, 13-005, and 13-007 each declare 03-011 as a prerequisite', () => {
    for (const gatedId of GATED_ACCEPTANCE_ROOT_IDS) {
      expect(stepById(gatedId)?.prerequisites).toContain(GOVERNANCE_STEP_ID);
    }
  });

  test('every acceptance-lane step has 03-011 in its prerequisite closure (the whole lane is gated until the unlock step completes)', () => {
    const acceptanceSteps = FINAL_PLAN_STEPS.filter((step) => step.lane === 'acceptance');
    expect(acceptanceSteps.length).toBeGreaterThan(0);
    for (const step of acceptanceSteps) {
      expect(prerequisiteClosure(step.id).has(GOVERNANCE_STEP_ID)).toBe(true);
    }
  });

  test('adding the governance step introduces no cross-lane write-lock overlap', () => {
    expect(findCrossLaneWriteLockOverlaps(FINAL_PLAN_STEPS)).toEqual([]);
  });

  test('the three superseded pin test files are restored on disk, not deleted', () => {
    for (const pinTest of RESTORED_PIN_TESTS) {
      expect(existsSync(pinTest)).toBe(true);
    }
  });

  test('doom.ts is the wired thin runDoomMain entrypoint this governance step formalizes', () => {
    const doomText = Bun.file('doom.ts');
    return doomText.text().then((text) => {
      expect(text).toContain("import { runDoomMain } from './src/vanilla/runDoomMain.ts';");
      expect(text).toContain('await runDoomMain(Bun.argv.slice(2))');
      expect(text).not.toMatch(/^\s*export\s*\{\s*\}\s*;?\s*$/m);
    });
  });

  describe('selector gating against a faithfully seeded status directory', () => {
    let statusDirectory: string;

    async function seedRealWorldStatuses(extraCompletedIds: readonly string[] = []): Promise<void> {
      const completed = new Set<string>(extraCompletedIds);
      for (const step of FINAL_PLAN_STEPS) {
        const phase = step.id.slice(0, 2);
        if (step.id === '03-002') {
          await writeFile(join(statusDirectory, `${step.id}.json`), JSON.stringify({ stepId: step.id, lane: step.lane, status: 'BLOCKED', blockerReason: 'test fixture: accepted cross-plan blocker' }));
          continue;
        }
        if (step.id === GOVERNANCE_STEP_ID || phase === '13') {
          if (completed.has(step.id)) {
            await writeFile(join(statusDirectory, `${step.id}.json`), JSON.stringify({ stepId: step.id, lane: step.lane, status: 'COMPLETED' }));
          }
          continue;
        }
        await writeFile(join(statusDirectory, `${step.id}.json`), JSON.stringify({ stepId: step.id, lane: step.lane, status: 'COMPLETED' }));
      }
    }

    beforeEach(async () => {
      statusDirectory = await mkdtemp(join(tmpdir(), 'plan-final-supersede-'));
    });

    afterEach(async () => {
      await rm(statusDirectory, { recursive: true, force: true });
    });

    test('with everything else done, the no-lane selector picks 03-011 before any 13-* acceptance gate', async () => {
      await seedRealWorldStatuses();

      const selection = await selectNextStep(null, { statusDirectory });

      expect(selection.step?.id).toBe(GOVERNANCE_STEP_ID);
      expect(selection.reason).toBe('first eligible step');
    });

    test('the acceptance lane has no eligible step while 03-011 is incomplete (gates cannot run while doom.ts unlock is unproven)', async () => {
      await seedRealWorldStatuses();

      const selection = await selectNextStep('acceptance', { statusDirectory });

      expect(selection.step).toBeNull();
      expect(selection.reason).toBe('no eligible step in lane acceptance');
    });

    test('once 03-011 is COMPLETED the acceptance lane unblocks and selects 13-001', async () => {
      await seedRealWorldStatuses([GOVERNANCE_STEP_ID]);

      const selection = await selectNextStep('acceptance', { statusDirectory });

      expect(selection.step?.id).toBe('13-001');
      expect(selection.reason).toBe('first eligible step');
    });
  });
});
