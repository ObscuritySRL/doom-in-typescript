import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['07-001', '07-002', '07-003', '07-004', '07-005', '07-006', '07-007', '07-008', '07-009', '07-010'];

const PREREQUISITE_TEST_FILES: readonly string[] = [
  'test/plan_final/ui/wire-title-loop-rendering.test.ts',
  'test/plan_final/ui/wire-menu-rendering.test.ts',
  'test/plan_final/ui/wire-menu-actions.test.ts',
  'test/plan_final/ui/wire-status-bar-drawing.test.ts',
  'test/plan_final/ui/wire-hud-messages.test.ts',
  'test/plan_final/ui/wire-automap-runtime.test.ts',
  'test/plan_final/ui/wire-intermission-runtime.test.ts',
  'test/plan_final/ui/wire-finale-runtime.test.ts',
  'test/plan_final/ui/wire-pause-and-help-overlays.test.ts',
  'test/plan_final/ui/wire-quit-and-endoom-ui.test.ts',
];

interface PrerequisiteStatus {
  readonly stepId: string;
  readonly status: string;
  readonly commitSha?: string;
}

interface PrerequisiteEvidence {
  readonly stepId: string;
  readonly knownFailures: readonly unknown[];
  readonly typecheck: string;
}

function readJsonFile(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readStatus(stepId: string): PrerequisiteStatus {
  const path = `plan_final/status/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-ui-parity: prerequisite status ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), status: String(raw.status), commitSha: typeof raw.commitSha === 'string' ? raw.commitSha : undefined };
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-ui-parity: prerequisite evidence ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), knownFailures: Array.isArray(raw.knownFailures) ? raw.knownFailures : [Symbol('missing')], typecheck: String(raw.typecheck) };
}

describe('plan_final ui: gate-ui-parity', () => {
  test('every ui prerequisite (07-001..07-010) has a committed status JSON at plan_final/status/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/status/${stepId}.json`)).toBe(true);
    }
  });

  test('every ui prerequisite status declares status="COMPLETED" and the matching stepId', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every ui prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every ui prerequisite evidence JSON exists at plan_final/evidence/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/evidence/${stepId}.json`)).toBe(true);
    }
  });

  test('every ui prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('every ui prerequisite focused test exists under test/plan_final/ui/', () => {
    for (const testPath of PREREQUISITE_TEST_FILES) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test('the ui gate covers exactly the ten ui-lane prerequisites 07-001 through 07-010', () => {
    expect(PREREQUISITE_STEP_IDS.length).toBe(10);
    expect([...PREREQUISITE_STEP_IDS]).toEqual(['07-001', '07-002', '07-003', '07-004', '07-005', '07-006', '07-007', '07-008', '07-009', '07-010']);
  });
});
