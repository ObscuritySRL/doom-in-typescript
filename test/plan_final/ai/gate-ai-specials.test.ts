import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['10-001', '10-002', '10-003', '10-004', '10-005', '10-006', '10-007'];

const PREREQUISITE_TEST_FILES: readonly string[] = [
  'test/plan_final/ai/wire-monster-spawn-flags.test.ts',
  'test/plan_final/ai/wire-damage-and-targeting.test.ts',
  'test/plan_final/ai/wire-monster-look-chase.test.ts',
  'test/plan_final/ai/wire-monster-attacks.test.ts',
  'test/plan_final/ai/wire-state-transitions.test.ts',
  'test/plan_final/ai/wire-boss-specials.test.ts',
  'test/plan_final/ai/wire-special-line-ai-effects.test.ts',
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
    throw new Error(`gate-ai-specials: prerequisite status ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), status: String(raw.status), commitSha: typeof raw.commitSha === 'string' ? raw.commitSha : undefined };
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-ai-specials: prerequisite evidence ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), knownFailures: Array.isArray(raw.knownFailures) ? raw.knownFailures : [Symbol('missing')], typecheck: String(raw.typecheck) };
}

describe('plan_final ai: gate-ai-specials', () => {
  test('every ai prerequisite (10-001..10-007) has a committed status JSON at plan_final/status/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/status/${stepId}.json`)).toBe(true);
    }
  });

  test('every ai prerequisite status declares status="COMPLETED" and the matching stepId', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every ai prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every ai prerequisite evidence JSON exists at plan_final/evidence/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/evidence/${stepId}.json`)).toBe(true);
    }
  });

  test('every ai prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('every ai prerequisite focused test exists under test/plan_final/ai/', () => {
    for (const testPath of PREREQUISITE_TEST_FILES) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test('the ai gate covers exactly the seven ai-lane prerequisites 10-001 through 10-007', () => {
    expect(PREREQUISITE_STEP_IDS.length).toBe(7);
    expect([...PREREQUISITE_STEP_IDS]).toEqual(['10-001', '10-002', '10-003', '10-004', '10-005', '10-006', '10-007']);
  });
});
