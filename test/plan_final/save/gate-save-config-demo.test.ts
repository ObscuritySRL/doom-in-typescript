import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['12-001', '12-002', '12-003', '12-004', '12-005', '12-006', '12-007', '12-008'];

const PREREQUISITE_TEST_FILES: readonly string[] = [
  'test/plan_final/save/wire-config-load-and-persist.test.ts',
  'test/plan_final/save/wire-settings-menus-to-config.test.ts',
  'test/plan_final/save/wire-save-slot-ui.test.ts',
  'test/plan_final/save/wire-savegame-write.test.ts',
  'test/plan_final/save/wire-savegame-load.test.ts',
  'test/plan_final/save/wire-demo-playback-runtime.test.ts',
  'test/plan_final/save/wire-demo-record-and-timedemo.test.ts',
  'test/plan_final/save/wire-long-run-drift-checks.test.ts',
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
    throw new Error(`gate-save-config-demo: prerequisite status ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), status: String(raw.status), commitSha: typeof raw.commitSha === 'string' ? raw.commitSha : undefined };
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-save-config-demo: prerequisite evidence ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), knownFailures: Array.isArray(raw.knownFailures) ? raw.knownFailures : [Symbol('missing')], typecheck: String(raw.typecheck) };
}

describe('plan_final save-config-demo: gate-save-config-demo', () => {
  test('every save-config-demo prerequisite (12-001..12-008) has a committed status JSON at plan_final/status/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/status/${stepId}.json`)).toBe(true);
    }
  });

  test('every save-config-demo prerequisite status declares status="COMPLETED" and the matching stepId', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every save-config-demo prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every save-config-demo prerequisite evidence JSON exists at plan_final/evidence/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/evidence/${stepId}.json`)).toBe(true);
    }
  });

  test('every save-config-demo prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('every save-config-demo prerequisite focused test exists under test/plan_final/save/', () => {
    for (const testPath of PREREQUISITE_TEST_FILES) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test('the save-config-demo gate covers exactly the eight save-config-demo-lane prerequisites 12-001 through 12-008', () => {
    expect(PREREQUISITE_STEP_IDS.length).toBe(8);
    expect([...PREREQUISITE_STEP_IDS]).toEqual(['12-001', '12-002', '12-003', '12-004', '12-005', '12-006', '12-007', '12-008']);
  });
});
