import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['09-001', '09-002', '09-003', '09-004', '09-005', '09-006', '09-007', '09-008', '09-009'];

const PREREQUISITE_TEST_FILES: readonly string[] = [
  'test/plan_final/player/wire-player-spawn-state.test.ts',
  'test/plan_final/player/wire-player-ticcmd-application.test.ts',
  'test/plan_final/player/wire-player-use-action.test.ts',
  'test/plan_final/player/wire-weapon-psprites.test.ts',
  'test/plan_final/player/wire-hitscan-weapons.test.ts',
  'test/plan_final/player/wire-projectile-weapons.test.ts',
  'test/plan_final/player/wire-pickups.test.ts',
  'test/plan_final/player/wire-player-damage.test.ts',
  'test/plan_final/player/wire-vanilla-cheats.test.ts',
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
    throw new Error(`gate-player-weapons-items: prerequisite status ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteStatus;
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-player-weapons-items: prerequisite evidence ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteEvidence;
}

describe('plan_final player: gate-player-weapons-items', () => {
  test('every player-weapons-items prerequisite (09-001..09-009) has a committed status JSON at plan_final/status/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/status/${stepId}.json`)).toBe(true);
    }
  });

  test('every player-weapons-items prerequisite status declares status="COMPLETED" and the matching stepId', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every player-weapons-items prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every player-weapons-items prerequisite evidence JSON exists at plan_final/evidence/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/evidence/${stepId}.json`)).toBe(true);
    }
  });

  test('every player-weapons-items prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('every player-weapons-items prerequisite focused test exists under test/plan_final/player/', () => {
    for (const testPath of PREREQUISITE_TEST_FILES) {
      expect(existsSync(testPath)).toBe(true);
    }
  });

  test('the player-weapons-items gate covers exactly the nine lane prerequisites 09-001 through 09-009', () => {
    expect(PREREQUISITE_STEP_IDS.length).toBe(9);
    expect([...PREREQUISITE_STEP_IDS]).toEqual(['09-001', '09-002', '09-003', '09-004', '09-005', '09-006', '09-007', '09-008', '09-009']);
  });
});
