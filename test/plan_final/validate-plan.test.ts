import { describe, expect, test } from 'bun:test';

import { FINAL_PLAN_LANES, FINAL_PLAN_STEP_COUNT, FINAL_PLAN_STEPS } from '../../plan_final/planData.ts';
import { findCrossLaneWriteLockOverlaps, findEvidencePathMismatch, findFinalProofViolations, findLaneOwnershipViolations, findStatusSchemaViolations, stepFilePath, validatePlan } from '../../plan_final/validate-plan.ts';

const FORTY_HEX = '0123456789abcdef0123456789abcdef01234567';

function fullEvidenceCommands(focusedTestPath: string): readonly string[] {
  return ['bun run format', `bun test ${focusedTestPath}`, 'bun test --only-failures', 'bun x tsc --noEmit --project tsconfig.json'];
}

describe('plan_final control center', () => {
  test('validates the generated plan structure', async () => {
    const result = await validatePlan();

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.stepCount).toBe(FINAL_PLAN_STEP_COUNT);
  });

  test('contains a small-step checklist across every final lane', () => {
    expect(FINAL_PLAN_STEP_COUNT).toBeGreaterThanOrEqual(100);
    expect(FINAL_PLAN_LANES.map((lane) => lane.lane)).toEqual([
      'governance',
      'current-state',
      'oracle',
      'launch-host-input',
      'runtime-core',
      'wad-assets',
      'render',
      'ui',
      'map-world',
      'player-weapons-items',
      'ai-specials',
      'audio',
      'save-config-demo',
      'acceptance',
    ]);
  });

  test('requires every step to fix failures before completion', async () => {
    for (const step of FINAL_PLAN_STEPS) {
      const stepText = await Bun.file(stepFilePath(step)).text();

      expect(stepText).toContain('Any failure is fixed in this same step');
      expect(stepText).toContain('not marked complete');
      expect(stepText).toContain('committed with a Conventional Commit');
      expect(stepText).toContain('pushed directly with local git commands');
    }
  });

  test('makes final acceptance execute doom.ts instead of accepting manifest-only proof', () => {
    const finalStep = FINAL_PLAN_STEPS.find((step) => step.id === '13-011');

    expect(finalStep).toBeDefined();
    expect(finalStep?.goal).toContain('Execute final side-by-side');
    expect(finalStep?.goal).toContain('no pending evidence');
    expect(finalStep?.readOnlyPaths).toContain('doom.ts');
    expect(finalStep?.testFiles).toContain('test/plan_final/acceptance/gate-final-side-by-side-zero-diff.test.ts');
  });

  test('rejects pending-fixture proof for final gates', () => {
    const pendingSample = JSON.stringify({ comparisonStatus: 'pending-live-capture', report: 'pending-unimplemented-surface' });
    const violations = findFinalProofViolations(pendingSample);

    expect(violations.some((violation) => violation.category === 'pending-fixture')).toBe(true);
  });

  test('rejects manifest-only proof for final gates', () => {
    const manifestSample = JSON.stringify({ implementationStatus: 'manifest-only', inheritedSourceHashes: [{ path: 'package.json' }] });
    const violations = findFinalProofViolations(manifestSample);

    expect(violations.some((violation) => violation.category === 'manifest-only')).toBe(true);
  });

  test('rejects human attestation alone for final gates', () => {
    const attestationOnly = JSON.stringify({ gate_id: '13-X', human_attestation_required: true, oracle_evidence_required: [] });
    const violations = findFinalProofViolations(attestationOnly);

    expect(violations.some((violation) => violation.category === 'human-attestation-alone')).toBe(true);
  });

  test('accepts human attestation when paired with non-empty oracle evidence', () => {
    const pairedAttestation = JSON.stringify({
      gate_id: '13-Y',
      human_attestation_required: true,
      oracle_evidence_required: ['framebuffer-hash-per-tic-window-across-three-iwad-scopes', 'audio-hash-per-tic-window-across-three-iwad-scopes'],
    });
    const violations = findFinalProofViolations(pairedAttestation);

    expect(violations.some((violation) => violation.category === 'human-attestation-alone')).toBe(false);
  });

  test('treats manifest tokens as acceptable when paired with explicit live-capture evidence', () => {
    const replacedManifest = JSON.stringify({ implementationStatus: 'manifest-only', replacement: 'live-capture confirmed' });
    const violations = findFinalProofViolations(replacedManifest);

    expect(violations.some((violation) => violation.category === 'manifest-only')).toBe(false);
  });
});

describe('plan_final completion status schema', () => {
  const focusedTestPath = 'test/plan_final/validate-plan.test.ts';
  const evidencePath = 'plan_final/evidence/00-099.json';

  test('accepts a fully attested completion record', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath) };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations).toEqual([]);
  });

  test('accepts a fully attested record whose evidence uses structured command entries', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const evidence = {
      commands: fullEvidenceCommands(focusedTestPath).map((command) => ({ command, result: 'pass' })),
    };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations).toEqual([]);
  });

  test('ignores non-COMPLETED records', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'IN_PROGRESS', evidence: evidencePath, commitSha: null };
    const violations = findStatusSchemaViolations(status, null);

    expect(violations).toEqual([]);
  });

  test('rejects a null commit SHA on a COMPLETED record', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: null };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath) };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations.some((violation) => violation.category === 'missing-commit-sha')).toBe(true);
  });

  test('rejects a commit SHA shorter than 40 hex characters', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: 'abc123' };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath) };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations.some((violation) => violation.category === 'invalid-commit-sha-format')).toBe(true);
  });

  test('rejects a commit SHA with uppercase hex characters', () => {
    const uppercaseSha = FORTY_HEX.toUpperCase();
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: uppercaseSha };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath) };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations.some((violation) => violation.category === 'invalid-commit-sha-format')).toBe(true);
  });

  test('rejects an empty stepId on a COMPLETED record', () => {
    const status = { stepId: '', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath) };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations.some((violation) => violation.category === 'step-id-missing')).toBe(true);
  });

  test('rejects an empty lane on a COMPLETED record', () => {
    const status = { stepId: '00-099', lane: '', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath) };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations.some((violation) => violation.category === 'lane-missing')).toBe(true);
  });

  test('rejects a missing evidence reference', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', commitSha: FORTY_HEX };
    const violations = findStatusSchemaViolations(status, null);

    expect(violations.some((violation) => violation.category === 'evidence-missing-required')).toBe(true);
  });

  test('rejects a COMPLETED record whose evidence record was not supplied', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const violations = findStatusSchemaViolations(status, null);

    expect(violations.some((violation) => violation.category === 'evidence-missing-required')).toBe(true);
  });

  test('rejects evidence missing bun run format', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath).filter((command) => command !== 'bun run format') };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations.some((violation) => violation.category === 'evidence-missing-format-command')).toBe(true);
  });

  test('rejects evidence missing the full bun test run', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath).filter((command) => command !== 'bun test --only-failures') };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations.some((violation) => violation.category === 'evidence-missing-full-test-command')).toBe(true);
  });

  test('rejects evidence missing the focused bun test run', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath).filter((command) => !command.startsWith('bun test ')) };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations.some((violation) => violation.category === 'evidence-missing-focused-test-command')).toBe(true);
  });

  test('rejects evidence missing the typecheck command', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const evidence = { commands: fullEvidenceCommands(focusedTestPath).filter((command) => !command.includes('tsc --noEmit')) };
    const violations = findStatusSchemaViolations(status, evidence);

    expect(violations.some((violation) => violation.category === 'evidence-missing-typecheck-command')).toBe(true);
  });

  test('flags an evidence path mismatch between status and the expected path', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: 'plan_final/evidence/wrong.json', commitSha: FORTY_HEX };
    const mismatch = findEvidencePathMismatch(status, evidencePath);

    expect(mismatch).not.toBeNull();
    expect(mismatch?.category).toBe('evidence-path-mismatch');
  });

  test('returns no mismatch when the evidence path matches the expected path', () => {
    const status = { stepId: '00-099', lane: 'governance', status: 'COMPLETED', evidence: evidencePath, commitSha: FORTY_HEX };
    const mismatch = findEvidencePathMismatch(status, evidencePath);

    expect(mismatch).toBeNull();
  });
});

describe('plan_final parallel lane contract', () => {
  test('passes the current FINAL_PLAN_LANES through findLaneOwnershipViolations with no violations', () => {
    const violations = findLaneOwnershipViolations(FINAL_PLAN_LANES);

    expect(violations).toEqual([]);
  });

  test('flags duplicate ownership claims across lanes when not documented as shared', () => {
    const lanes = [
      { description: 'first lane', lane: 'alpha', owns: ['src/shared-x/'] },
      { description: 'second lane', lane: 'beta', owns: ['src/shared-x/'] },
    ];
    const violations = findLaneOwnershipViolations(lanes);

    expect(violations.some((violation) => violation.category === 'duplicate-ownership-claim')).toBe(true);
  });

  test('accepts a duplicate ownership claim that appears in the documented shared list', () => {
    const lanes = [
      { description: 'first lane', lane: 'alpha', owns: ['src/specials/'] },
      { description: 'second lane', lane: 'beta', owns: ['src/specials/'] },
    ];
    const violations = findLaneOwnershipViolations(lanes);

    expect(violations.some((violation) => violation.category === 'duplicate-ownership-claim')).toBe(false);
  });

  test('flags a lane that claims no owned paths', () => {
    const lanes = [
      { description: 'empty lane', lane: 'alpha', owns: [] },
      { description: 'second lane', lane: 'beta', owns: ['src/beta/'] },
    ];
    const violations = findLaneOwnershipViolations(lanes);

    expect(violations.some((violation) => violation.category === 'lane-owns-no-paths')).toBe(true);
  });

  test('passes the current FINAL_PLAN_STEPS through findCrossLaneWriteLockOverlaps with no violations', () => {
    const overlaps = findCrossLaneWriteLockOverlaps(FINAL_PLAN_STEPS);

    expect(overlaps).toEqual([]);
  });

  test('flags a cross-lane write-lock overlap on a non-shared path', () => {
    const stepA = {
      expectedChanges: ['src/custom/foo.ts'],
      goal: 'a',
      id: '99-001',
      lane: 'alpha',
      parallelSafeWith: [],
      prerequisites: [],
      readOnlyPaths: [],
      researchSources: [],
      testFiles: [],
      title: 't-a',
      writeLock: ['src/custom/'],
    };
    const stepB = { ...stepA, id: '99-002', lane: 'beta', title: 't-b' };
    const overlaps = findCrossLaneWriteLockOverlaps([stepA, stepB]);

    expect(overlaps.some((overlap) => overlap.path === 'src/custom/')).toBe(true);
  });

  test('does not flag same-lane write-lock overlaps', () => {
    const stepA = {
      expectedChanges: ['src/custom/foo.ts'],
      goal: 'a',
      id: '99-001',
      lane: 'alpha',
      parallelSafeWith: [],
      prerequisites: [],
      readOnlyPaths: [],
      researchSources: [],
      testFiles: [],
      title: 't-a',
      writeLock: ['src/custom/'],
    };
    const stepB = { ...stepA, id: '99-002', title: 't-b' };
    const overlaps = findCrossLaneWriteLockOverlaps([stepA, stepB]);

    expect(overlaps).toEqual([]);
  });

  test('does not flag overlaps on shared control paths', () => {
    const stepA = {
      expectedChanges: [],
      goal: 'a',
      id: '99-001',
      lane: 'alpha',
      parallelSafeWith: [],
      prerequisites: [],
      readOnlyPaths: [],
      researchSources: [],
      testFiles: [],
      title: 't-a',
      writeLock: ['plan_final/evidence/', 'plan_final/status/'],
    };
    const stepB = { ...stepA, id: '99-002', lane: 'beta', title: 't-b' };
    const overlaps = findCrossLaneWriteLockOverlaps([stepA, stepB]);

    expect(overlaps).toEqual([]);
  });
});
