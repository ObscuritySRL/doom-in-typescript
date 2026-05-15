import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['11-001', '11-002', '11-003', '11-004', '11-005', '11-006', '11-007', '11-008'];

const PREREQUISITE_TEST_FILES: readonly string[] = [
  'test/plan_final/audio/wire-sfx-loader.test.ts',
  'test/plan_final/audio/wire-channel-and-priority-runtime.test.ts',
  'test/plan_final/audio/wire-spatial-sfx-runtime.test.ts',
  'test/plan_final/audio/wire-sound-callback-bridge.test.ts',
  'test/plan_final/audio/wire-pcm-mixer-win32-output.test.ts',
  'test/plan_final/audio/wire-mus-opl-runtime.test.ts',
  'test/plan_final/audio/wire-music-selection.test.ts',
  'test/plan_final/audio/wire-audio-hash-windows.test.ts',
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
    throw new Error(`gate-audio-parity: prerequisite status ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), status: String(raw.status), commitSha: typeof raw.commitSha === 'string' ? raw.commitSha : undefined };
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-audio-parity: prerequisite evidence ${path} is missing`);
  }
  const raw = readJsonFile(path);
  return { stepId: String(raw.stepId), knownFailures: Array.isArray(raw.knownFailures) ? raw.knownFailures : [Symbol('missing')], typecheck: String(raw.typecheck) };
}

describe('plan_final audio: gate-audio-parity', () => {
  test('every audio prerequisite (11-001..11-008) has a committed status JSON at plan_final/status/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/status/${stepId}.json`)).toBe(true);
    }
  });

  test('every audio prerequisite status declares status="COMPLETED" and the matching stepId', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every audio prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every audio prerequisite evidence JSON exists at plan_final/evidence/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/evidence/${stepId}.json`)).toBe(true);
    }
  });

  test('every audio prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('every audio prerequisite focused test exists under test/plan_final/audio/', () => {
    for (const testPath of PREREQUISITE_TEST_FILES) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test('the audio gate covers exactly the eight audio-lane prerequisites 11-001 through 11-008', () => {
    expect(PREREQUISITE_STEP_IDS.length).toBe(8);
    expect([...PREREQUISITE_STEP_IDS]).toEqual(['11-001', '11-002', '11-003', '11-004', '11-005', '11-006', '11-007', '11-008']);
  });
});
