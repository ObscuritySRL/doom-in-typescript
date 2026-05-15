import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['04-002', '04-003', '04-004', '04-005', '04-006', '04-007'];

const PREREQUISITE_TEST_FILES: readonly string[] = [
  'test/plan_final/runtime/wire-d-doommain-init-order.test.ts',
  'test/plan_final/runtime/wire-d-doomloop.test.ts',
  'test/plan_final/runtime/wire-try-run-tics.test.ts',
  'test/plan_final/runtime/wire-game-state-transitions.test.ts',
  'test/plan_final/runtime/wire-rng-and-demo-streams.test.ts',
  'test/plan_final/runtime/wire-state-snapshot-hash.test.ts',
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

function readStatus(stepId: string): PrerequisiteStatus {
  const path = `plan_final/status/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-runtime-core: prerequisite status ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteStatus;
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-runtime-core: prerequisite evidence ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteEvidence;
}

describe('plan_final runtime: gate-runtime-core', () => {
  test('every runtime-core prerequisite (04-002..04-007) has a committed status JSON at plan_final/status/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/status/${stepId}.json`)).toBe(true);
    }
  });

  test('every runtime-core prerequisite status declares status="COMPLETED" and the matching stepId', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every runtime-core prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every runtime-core prerequisite evidence JSON exists at plan_final/evidence/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/evidence/${stepId}.json`)).toBe(true);
    }
  });

  test('every runtime-core prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('every runtime-core prerequisite focused test exists under test/plan_final/runtime/', () => {
    for (const testPath of PREREQUISITE_TEST_FILES) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test('the runtime-core gate covers exactly the six lane prerequisites 04-002 through 04-007', () => {
    expect(PREREQUISITE_STEP_IDS.length).toBe(6);
    expect([...PREREQUISITE_STEP_IDS]).toEqual(['04-002', '04-003', '04-004', '04-005', '04-006', '04-007']);
  });
});
