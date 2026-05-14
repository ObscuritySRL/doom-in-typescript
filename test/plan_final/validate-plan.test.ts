import { describe, expect, test } from 'bun:test';

import { FINAL_PLAN_LANES, FINAL_PLAN_STEP_COUNT, FINAL_PLAN_STEPS } from '../../plan_final/planData.ts';
import { findFinalProofViolations, stepFilePath, validatePlan } from '../../plan_final/validate-plan.ts';

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
