import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import tracker from './replace-pending-oracle-fixtures-with-live-evidence.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-034-replace-pending-oracle-fixtures-with-live-evidence.md';
const STEP_ID_PATTERN = /^02-(017|018|019|020|021|022|023|024|025|026|027|028|029|030|031|032|033)$/;
const VALID_TRACKER_STATUSES = new Set(['open', 'closed']);

interface TrackedFixture {
  readonly stepId: string;
  readonly artifactPath: string;
  readonly replacementWork: string;
}

describe('tracker identity and metadata', () => {
  test('declares OR-VP-REPLACE-PENDING-034 oracle id, step 02-034, and oracle lane', () => {
    expect(tracker.id).toBe('OR-VP-REPLACE-PENDING-034');
    expect(tracker.stepId).toBe('02-034');
    expect(tracker.stepTitle).toBe('Replace Pending Oracle Fixtures With Live Evidence');
    expect(tracker.lane).toBe('oracle');
  });

  test('tracker status is one of the canonical values', () => {
    expect(VALID_TRACKER_STATUSES.has(tracker.trackerStatus)).toBe(true);
  });

  test('completion rule references the captureStatus and non-empty entries contract', () => {
    expect(tracker.completionRule).toContain('captureStatus');
    expect(tracker.completionRule).toContain('captured');
  });
});

describe('tracked pending fixtures shape and completeness', () => {
  test('covers exactly the 17 pending oracle capture steps 02-017 through 02-033', () => {
    expect(tracker.trackedPendingFixtures).toHaveLength(17);
    const stepIds = (tracker.trackedPendingFixtures as readonly TrackedFixture[]).map((entry) => entry.stepId);
    for (const stepId of stepIds) {
      expect(stepId).toMatch(STEP_ID_PATTERN);
    }
    expect(new Set(stepIds).size).toBe(stepIds.length);
  });

  test('every tracked artifact path exists on disk and references captureStatus pending-external-reference-run', async () => {
    for (const fixture of tracker.trackedPendingFixtures as readonly TrackedFixture[]) {
      expect(existsSync(fixture.artifactPath)).toBe(true);
      const artifact = (await Bun.file(fixture.artifactPath).json()) as { captureStatus?: string };
      expect(artifact.captureStatus).toBe('pending-external-reference-run');
    }
  });

  test('replacement work descriptions are non-empty', () => {
    for (const fixture of tracker.trackedPendingFixtures as readonly TrackedFixture[]) {
      expect(fixture.replacementWork.length).toBeGreaterThan(0);
    }
  });
});

describe('alignment with plan_vanilla_parity step 02-034', () => {
  test('step file write lock pins the tracker json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/replace-pending-oracle-fixtures-with-live-evidence.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/replace-pending-oracle-fixtures-with-live-evidence.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('unknown tracker statuses are rejected', () => {
    expect(VALID_TRACKER_STATUSES.has('half-done')).toBe(false);
    expect(VALID_TRACKER_STATUSES.has('')).toBe(false);
  });

  test('step id pattern rejects steps outside the pending range', () => {
    expect('02-016').not.toMatch(STEP_ID_PATTERN);
    expect('02-034').not.toMatch(STEP_ID_PATTERN);
    expect('03-001').not.toMatch(STEP_ID_PATTERN);
  });

  test('tracker remains open while any pending fixture remains', () => {
    const anyPending = (tracker.trackedPendingFixtures as readonly TrackedFixture[]).length > 0;
    if (anyPending) {
      expect(tracker.trackerStatus).toBe('open');
    } else {
      expect(tracker.trackerStatus).toBe('closed');
    }
  });
});
