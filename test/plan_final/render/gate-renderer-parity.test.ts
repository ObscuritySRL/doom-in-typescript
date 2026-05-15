import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['06-002', '06-003', '06-004', '06-005', '06-006', '06-007', '06-008', '06-009'];

const PREREQUISITE_TEST_FILES: readonly string[] = [
  'test/plan_final/render/wire-bsp-wall-renderer.test.ts',
  'test/plan_final/render/wire-visplane-renderer.test.ts',
  'test/plan_final/render/wire-masked-textures.test.ts',
  'test/plan_final/render/wire-sprite-renderer.test.ts',
  'test/plan_final/render/wire-psprite-renderer.test.ts',
  'test/plan_final/render/wire-sky-detail-gamma-palette.test.ts',
  'test/plan_final/render/wire-wipes-and-borders.test.ts',
  'test/plan_final/render/wire-framebuffer-hash.test.ts',
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
    throw new Error(`gate-renderer-parity: prerequisite status ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteStatus;
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-renderer-parity: prerequisite evidence ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteEvidence;
}

describe('plan_final render: gate-renderer-parity', () => {
  test('every render prerequisite (06-002..06-009) has a committed status JSON at plan_final/status/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/status/${stepId}.json`)).toBe(true);
    }
  });

  test('every render prerequisite status declares status="COMPLETED" and the matching stepId', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every render prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every render prerequisite evidence JSON exists at plan_final/evidence/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/evidence/${stepId}.json`)).toBe(true);
    }
  });

  test('every render prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('every render prerequisite focused test exists under test/plan_final/render/', () => {
    for (const testPath of PREREQUISITE_TEST_FILES) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test('the renderer gate covers exactly the eight render-lane prerequisites 06-002 through 06-009', () => {
    expect(PREREQUISITE_STEP_IDS.length).toBe(8);
    expect([...PREREQUISITE_STEP_IDS]).toEqual(['06-002', '06-003', '06-004', '06-005', '06-006', '06-007', '06-008', '06-009']);
  });
});
