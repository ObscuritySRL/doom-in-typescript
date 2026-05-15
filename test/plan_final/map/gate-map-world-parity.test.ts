import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['08-001', '08-002', '08-003', '08-004', '08-005', '08-006', '08-007', '08-008', '08-009'];

const PREREQUISITE_TEST_FILES: readonly string[] = [
  'test/plan_final/map/wire-level-setup.test.ts',
  'test/plan_final/map/wire-thinker-ticker.test.ts',
  'test/plan_final/map/wire-collision-and-movement.test.ts',
  'test/plan_final/map/wire-line-crossing-and-use.test.ts',
  'test/plan_final/map/wire-door-specials.test.ts',
  'test/plan_final/map/wire-floor-ceiling-platform-specials.test.ts',
  'test/plan_final/map/wire-sector-effects-and-animations.test.ts',
  'test/plan_final/map/wire-level-exits.test.ts',
  'test/plan_final/map/wire-death-reborn-and-transitions.test.ts',
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
    throw new Error(`gate-map-world-parity: prerequisite status ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), status: String(raw.status), commitSha: typeof raw.commitSha === 'string' ? raw.commitSha : undefined };
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-map-world-parity: prerequisite evidence ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), knownFailures: Array.isArray(raw.knownFailures) ? raw.knownFailures : [Symbol('missing')], typecheck: String(raw.typecheck) };
}

describe('plan_final map-world: gate-map-world-parity', () => {
  test('every map-world prerequisite (08-001..08-009) has a committed status JSON at plan_final/status/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/status/${stepId}.json`)).toBe(true);
    }
  });

  test('every map-world prerequisite status declares status="COMPLETED" and the matching stepId', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every map-world prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every map-world prerequisite evidence JSON exists at plan_final/evidence/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/evidence/${stepId}.json`)).toBe(true);
    }
  });

  test('every map-world prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('every map-world prerequisite focused test exists under test/plan_final/map/', () => {
    for (const testPath of PREREQUISITE_TEST_FILES) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test('the map-world gate covers exactly the nine map-world-lane prerequisites 08-001 through 08-009', () => {
    expect(PREREQUISITE_STEP_IDS.length).toBe(9);
    expect([...PREREQUISITE_STEP_IDS]).toEqual(['08-001', '08-002', '08-003', '08-004', '08-005', '08-006', '08-007', '08-008', '08-009']);
  });
});
