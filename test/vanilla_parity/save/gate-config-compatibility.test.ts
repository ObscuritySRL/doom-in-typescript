import { describe, expect, test } from 'bun:test';

import { VANILLA_CONFIG_GATE_CHECKS, VANILLA_CONFIG_GATE_CHECK_COUNT, VANILLA_CONFIG_GATE_STEP_ID_TO_CHECK, vanillaConfigGateChecksSatisfied, vanillaConfigGateMissingChecks } from '../../../src/save/gate-config-compatibility.ts';

describe('vanilla DOOM 1.9 config-compatibility acceptance gate', () => {
  test('pins the eight gate check identities', () => {
    expect(VANILLA_CONFIG_GATE_CHECK_COUNT).toBe(8);
    expect(VANILLA_CONFIG_GATE_CHECKS).toEqual([
      'default-cfg-43-variables',
      'chocolate-doom-cfg-113-variables',
      'namespaces-disjoint',
      'hardcoded-defaults-match-globals',
      'unknown-variables-silently-ignored',
      'test-isolation-from-user-local-paths',
      'mouse-key-sound-screen-chat-persisters-pinned',
      'round-trip-writer-43-line-output',
    ]);
  });

  test('maps phase-12 config step IDs to their gate checks', () => {
    expect(VANILLA_CONFIG_GATE_STEP_ID_TO_CHECK.get('12-001')).toBe('default-cfg-43-variables');
    expect(VANILLA_CONFIG_GATE_STEP_ID_TO_CHECK.get('12-002')).toBe('chocolate-doom-cfg-113-variables');
    expect(VANILLA_CONFIG_GATE_STEP_ID_TO_CHECK.get('12-003')).toBe('mouse-key-sound-screen-chat-persisters-pinned');
    expect(VANILLA_CONFIG_GATE_STEP_ID_TO_CHECK.get('12-008')).toBe('round-trip-writer-43-line-output');
    expect(VANILLA_CONFIG_GATE_STEP_ID_TO_CHECK.get('12-009')).toBe('test-isolation-from-user-local-paths');
  });

  test('vanillaConfigGateChecksSatisfied returns true only when ALL eight checks pass', () => {
    const allPassing = new Set(VANILLA_CONFIG_GATE_CHECKS);
    expect(vanillaConfigGateChecksSatisfied(allPassing)).toBe(true);

    const oneMissing = new Set(VANILLA_CONFIG_GATE_CHECKS);
    oneMissing.delete('namespaces-disjoint');
    expect(vanillaConfigGateChecksSatisfied(oneMissing)).toBe(false);

    expect(vanillaConfigGateChecksSatisfied(new Set())).toBe(false);
  });

  test('vanillaConfigGateMissingChecks reports the unsatisfied checks', () => {
    const passing = new Set<(typeof VANILLA_CONFIG_GATE_CHECKS)[number]>(['default-cfg-43-variables', 'chocolate-doom-cfg-113-variables']);
    const missing = vanillaConfigGateMissingChecks(passing);
    expect(missing).toContain('namespaces-disjoint');
    expect(missing).toContain('round-trip-writer-43-line-output');
    expect(missing).not.toContain('default-cfg-43-variables');
    expect(missing.length).toBe(VANILLA_CONFIG_GATE_CHECK_COUNT - 2);
  });

  test('returns an empty missing-checks array when the gate is fully green', () => {
    expect(vanillaConfigGateMissingChecks(new Set(VANILLA_CONFIG_GATE_CHECKS))).toEqual([]);
  });
});
