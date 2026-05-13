import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import { PHASE_03_REQUIRED_BOOTSTRAP_MODULES, PHASE_03_REQUIRED_FOCUSED_TESTS, evaluatePhase03Gate } from '../../../src/bootstrap/gate-clean-launch-host-and-input.ts';

describe('phase 03 launch gate', () => {
  test('every required bootstrap module exists on disk', () => {
    for (const requiredModule of PHASE_03_REQUIRED_BOOTSTRAP_MODULES) {
      expect(existsSync(requiredModule)).toBe(true);
    }
  });

  test('every required focused test exists on disk', () => {
    for (const requiredTest of PHASE_03_REQUIRED_FOCUSED_TESTS) {
      expect(existsSync(requiredTest)).toBe(true);
    }
  });

  test('module and test counts match (1:1 pairing)', () => {
    expect(PHASE_03_REQUIRED_BOOTSTRAP_MODULES.length).toBe(PHASE_03_REQUIRED_FOCUSED_TESTS.length);
  });

  test('module list is ASCIIbetically sorted and unique', () => {
    expect([...PHASE_03_REQUIRED_BOOTSTRAP_MODULES].sort()).toEqual([...PHASE_03_REQUIRED_BOOTSTRAP_MODULES]);
    expect(new Set(PHASE_03_REQUIRED_BOOTSTRAP_MODULES).size).toBe(PHASE_03_REQUIRED_BOOTSTRAP_MODULES.length);
  });

  test('gate closes when the observed module and test sets match required', () => {
    const decision = evaluatePhase03Gate({
      observedModules: [...PHASE_03_REQUIRED_BOOTSTRAP_MODULES],
      observedTests: [...PHASE_03_REQUIRED_FOCUSED_TESTS],
    });
    expect(decision.closed).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('gate flags missing_required_module when a module is absent', () => {
    const decision = evaluatePhase03Gate({
      observedModules: PHASE_03_REQUIRED_BOOTSTRAP_MODULES.slice(0, -1),
      observedTests: [...PHASE_03_REQUIRED_FOCUSED_TESTS],
    });
    expect(decision.closed).toBe(false);
    expect(decision.violations).toContain('missing_required_module');
  });

  test('gate flags missing_required_test when a test is absent', () => {
    const decision = evaluatePhase03Gate({
      observedModules: [...PHASE_03_REQUIRED_BOOTSTRAP_MODULES],
      observedTests: PHASE_03_REQUIRED_FOCUSED_TESTS.slice(0, -1),
    });
    expect(decision.closed).toBe(false);
    expect(decision.violations).toContain('missing_required_test');
  });
});
