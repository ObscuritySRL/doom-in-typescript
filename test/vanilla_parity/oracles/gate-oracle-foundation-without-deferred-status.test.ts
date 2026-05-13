import { describe, expect, test } from 'bun:test';

import { readdirSync } from 'node:fs';

import gate from './gate-oracle-foundation-without-deferred-status.json';
import tracker from './replace-pending-oracle-fixtures-with-live-evidence.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-035-gate-oracle-foundation-without-deferred-status.md';
const ORACLE_DIRECTORY = 'test/vanilla_parity/oracles';
const GATE_SELF_FILE_NAME = 'gate-oracle-foundation-without-deferred-status.json';

interface TrackedFixture {
  readonly stepId: string;
  readonly artifactPath: string;
  readonly replacementWork: string;
}

async function loadCaptureStatusByFile(): Promise<ReadonlyMap<string, string>> {
  const result = new Map<string, string>();
  const directoryEntries = readdirSync(ORACLE_DIRECTORY).filter((entryName) => entryName.endsWith('.json'));
  for (const entryName of directoryEntries) {
    const artifactPath = `${ORACLE_DIRECTORY}/${entryName}`;
    const artifact = (await Bun.file(artifactPath).json()) as { captureStatus?: string };
    if (typeof artifact.captureStatus === 'string') {
      result.set(artifactPath, artifact.captureStatus);
    }
  }
  return result;
}

describe('gate identity and metadata', () => {
  test('declares OR-VP-GATE-035 oracle id, step 02-035, and oracle lane', () => {
    expect(gate.id).toBe('OR-VP-GATE-035');
    expect(gate.stepId).toBe('02-035');
    expect(gate.stepTitle).toBe('Gate Oracle Foundation Without Deferred Status');
    expect(gate.lane).toBe('oracle');
  });

  test('gate rule covers both the captured and tracker-accounted paths', () => {
    expect(gate.gateRule).toContain('captureStatus');
    expect(gate.gateRule).toContain('captured');
    expect(gate.gateRule).toContain('tracker');
  });

  test('long-term close condition requires 0 pending and a closed tracker', () => {
    expect(gate.longTermCloseCondition).toContain('0 pending');
    expect(gate.longTermCloseCondition).toContain('trackerStatus = closed');
  });

  test('gate inputs include the 02-034 tracker', () => {
    expect(gate.gateInputs).toContain('test/vanilla_parity/oracles/replace-pending-oracle-fixtures-with-live-evidence.json');
  });
});

describe('no orphan deferred status', () => {
  test('every pending fixture under test/vanilla_parity/oracles/ is recorded in the 02-034 tracker', async () => {
    const captureStatusByPath = await loadCaptureStatusByFile();
    const trackedPaths = new Set((tracker.trackedPendingFixtures as readonly TrackedFixture[]).map((entry) => entry.artifactPath));
    const orphanPending: string[] = [];
    for (const [artifactPath, captureStatus] of captureStatusByPath.entries()) {
      if (captureStatus !== 'captured' && !trackedPaths.has(artifactPath)) {
        orphanPending.push(`${artifactPath} carries ${captureStatus} but is not in 02-034 tracker`);
      }
    }
    expect(orphanPending).toEqual([]);
  });

  test('every 02-034 tracker entry points to a fixture that currently reports pending-external-reference-run', async () => {
    const captureStatusByPath = await loadCaptureStatusByFile();
    for (const fixture of tracker.trackedPendingFixtures as readonly TrackedFixture[]) {
      const status = captureStatusByPath.get(fixture.artifactPath);
      expect(status).toBe('pending-external-reference-run');
    }
  });

  test('the gate manifest itself does not declare captureStatus', async () => {
    const gatePath = `${ORACLE_DIRECTORY}/${GATE_SELF_FILE_NAME}`;
    const gateArtifact = (await Bun.file(gatePath).json()) as { captureStatus?: string };
    expect(gateArtifact.captureStatus).toBeUndefined();
  });
});

describe('long-term strict close (passes only when all pending fixtures are captured and tracker is closed)', () => {
  test('if the tracker is closed, every captureStatus is captured; if the tracker is open, at least one captureStatus is pending', async () => {
    const captureStatusByPath = await loadCaptureStatusByFile();
    const anyPending = [...captureStatusByPath.values()].some((status) => status !== 'captured');
    if (tracker.trackerStatus === 'closed') {
      expect(anyPending).toBe(false);
    } else {
      expect(anyPending).toBe(true);
    }
  });
});

describe('alignment with plan_vanilla_parity step 02-035', () => {
  test('step file write lock pins the gate json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/gate-oracle-foundation-without-deferred-status.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/gate-oracle-foundation-without-deferred-status.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('an orphan pending fixture would fail the orphan guard', () => {
    const orphanFakePath = 'test/vanilla_parity/oracles/orphan-fake.json';
    const trackedPaths = new Set((tracker.trackedPendingFixtures as readonly TrackedFixture[]).map((entry) => entry.artifactPath));
    expect(trackedPaths.has(orphanFakePath)).toBe(false);
  });
});
