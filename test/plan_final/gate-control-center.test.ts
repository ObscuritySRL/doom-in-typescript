import { readdir } from 'node:fs/promises';

import { describe, expect, test } from 'bun:test';

import { FINAL_PLAN_LANES, FINAL_PLAN_STEPS } from '../../plan_final/planData.ts';
import { findCrossLaneWriteLockOverlaps, findFinalProofViolations, findLaneOwnershipViolations, findStatusSchemaViolations, stepFilePath, validatePlan } from '../../plan_final/validate-plan.ts';

const STATUS_DIRECTORY = 'plan_final/status';
const EVIDENCE_DIRECTORY = 'plan_final/evidence';

async function readStatusEntries(): Promise<readonly { fileName: string; record: Record<string, unknown> }[]> {
  const directoryEntries = await readdir(STATUS_DIRECTORY);
  const records: { fileName: string; record: Record<string, unknown> }[] = [];

  for (const directoryEntry of directoryEntries) {
    if (!directoryEntry.endsWith('.json')) {
      continue;
    }

    const record = (await Bun.file(`${STATUS_DIRECTORY}/${directoryEntry}`).json()) as Record<string, unknown>;
    records.push({ fileName: directoryEntry, record });
  }

  return records;
}

describe('plan_final G0 control-center gate', () => {
  test('validatePlan returns no errors against the committed control-center artifacts', async () => {
    const result = await validatePlan();

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test('every checklist step has its generated step file on disk', async () => {
    for (const step of FINAL_PLAN_STEPS) {
      expect(await Bun.file(stepFilePath(step)).exists()).toBe(true);
    }
  });

  test('every governance status with camelCase schema points at a real evidence file under plan_final/evidence/', async () => {
    const records = await readStatusEntries();

    for (const { fileName, record } of records) {
      if (typeof record.stepId !== 'string') {
        continue;
      }
      if (record.status !== 'COMPLETED') {
        continue;
      }

      expect(typeof record.evidence).toBe('string');
      const evidencePath = String(record.evidence);
      expect(evidencePath.startsWith(EVIDENCE_DIRECTORY)).toBe(true);
      expect(await Bun.file(evidencePath).exists()).toBe(true);
      expect(fileName.startsWith(String(record.stepId))).toBe(true);
    }
  });

  test('findStatusSchemaViolations returns no violations for a freshly attested camelCase governance record', () => {
    const status = {
      stepId: '00-099',
      lane: 'governance',
      status: 'COMPLETED',
      evidence: 'plan_final/evidence/00-099.json',
      commitSha: '0123456789abcdef0123456789abcdef01234567',
    };
    const evidence = {
      commands: ['bun run format', 'bun test test/plan_final/validate-plan.test.ts', 'bun test', 'bun x tsc --noEmit --project tsconfig.json'],
    };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations).toEqual([]);
  });

  test('findFinalProofViolations clears the canonical paired-attestation gate shape', () => {
    const acceptableGate = JSON.stringify({
      gate_id: '13-008',
      human_attestation_required: true,
      oracle_evidence_required: ['framebuffer-hash-per-tic-window', 'audio-hash-per-tic-window', 'music-event-log-per-tic-window', 'savegame-byte-oracle', 'demo-replay-sync'],
    });
    const violations = findFinalProofViolations(acceptableGate);

    expect(violations).toEqual([]);
  });

  test('findLaneOwnershipViolations returns no violations for the locked FINAL_PLAN_LANES', () => {
    const violations = findLaneOwnershipViolations(FINAL_PLAN_LANES);

    expect(violations).toEqual([]);
  });

  test('findCrossLaneWriteLockOverlaps returns no overlaps for the locked FINAL_PLAN_STEPS under the documented shared list', () => {
    const overlaps = findCrossLaneWriteLockOverlaps(FINAL_PLAN_STEPS);

    expect(overlaps).toEqual([]);
  });
});
