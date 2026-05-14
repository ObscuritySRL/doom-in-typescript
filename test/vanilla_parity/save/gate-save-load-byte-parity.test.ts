import { describe, expect, test } from 'bun:test';

import {
  VANILLA_SAVE_LOAD_GATE_CHECKS,
  VANILLA_SAVE_LOAD_GATE_CHECK_COUNT,
  VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK,
  vanillaSaveLoadGateChecksSatisfied,
  vanillaSaveLoadGateMissingChecks,
} from '../../../src/save/gate-save-load-byte-parity.ts';

describe('vanilla DOOM 1.9 save/load byte-parity acceptance gate', () => {
  test('pins the 12 named gate checks', () => {
    expect(VANILLA_SAVE_LOAD_GATE_CHECK_COUNT).toBe(12);
    expect(VANILLA_SAVE_LOAD_GATE_CHECKS).toEqual([
      'save-directory-policy',
      'save-slot-descriptions',
      'save-header-version-magic',
      'player-mobj-thinker-record-sizes',
      'sector-and-line-special-classes',
      'archive-section-terminators',
      'savegamesize-buffer-cap',
      'load-header-layout-and-restoration-order',
      'incompatible-version-silent-return',
      'corruption-detection-error-strings',
      'reference-byte-oracle-comparator',
      'roundtrip-oracle-three-variants',
    ]);
  });

  test('maps every phase-12 save-side step ID to its gate check', () => {
    for (const stepId of ['12-010', '12-011', '12-012', '12-013', '12-014', '12-015', '12-016', '12-017', '12-018', '12-019', '12-020', '12-021', '12-022', '12-023', '12-024', '12-025', '12-026']) {
      expect(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.has(stepId)).toBe(true);
    }
  });

  test('multiple steps may map to a single check (record-sizes, restoration-order)', () => {
    expect(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.get('12-013')).toBe(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.get('12-014'));
    expect(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.get('12-014')).toBe(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.get('12-015'));
    expect(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.get('12-016')).toBe('sector-and-line-special-classes');
    expect(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.get('12-017')).toBe('sector-and-line-special-classes');
    expect(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.get('12-020')).toBe(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.get('12-023'));
    expect(VANILLA_SAVE_LOAD_GATE_STEP_ID_TO_CHECK.get('12-024')).toBe('load-header-layout-and-restoration-order');
  });

  test('vanillaSaveLoadGateChecksSatisfied returns true only when ALL twelve checks pass', () => {
    expect(vanillaSaveLoadGateChecksSatisfied(new Set(VANILLA_SAVE_LOAD_GATE_CHECKS))).toBe(true);
    expect(vanillaSaveLoadGateChecksSatisfied(new Set())).toBe(false);

    const oneMissing = new Set(VANILLA_SAVE_LOAD_GATE_CHECKS);
    oneMissing.delete('savegamesize-buffer-cap');
    expect(vanillaSaveLoadGateChecksSatisfied(oneMissing)).toBe(false);
  });

  test('vanillaSaveLoadGateMissingChecks reports the unsatisfied checks', () => {
    const passing = new Set<(typeof VANILLA_SAVE_LOAD_GATE_CHECKS)[number]>(['save-directory-policy', 'save-header-version-magic']);
    const missing = vanillaSaveLoadGateMissingChecks(passing);
    expect(missing).toContain('reference-byte-oracle-comparator');
    expect(missing).toContain('roundtrip-oracle-three-variants');
    expect(missing.length).toBe(VANILLA_SAVE_LOAD_GATE_CHECK_COUNT - 2);
  });

  test('returns an empty missing-checks array when the gate is fully green', () => {
    expect(vanillaSaveLoadGateMissingChecks(new Set(VANILLA_SAVE_LOAD_GATE_CHECKS))).toEqual([]);
  });
});
