import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import { PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES, PHASE_04_CORE_DETERMINISM_REQUIRED_TESTS, evaluateCoreDeterminismGate } from '../../../src/core/gate-core-determinism.ts';

describe('phase 04 core determinism gate', () => {
  test('every required module exists on disk', () => {
    for (const requiredModule of PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES) {
      expect(existsSync(requiredModule)).toBe(true);
    }
  });

  test('every required test exists on disk', () => {
    for (const requiredTest of PHASE_04_CORE_DETERMINISM_REQUIRED_TESTS) {
      expect(existsSync(requiredTest)).toBe(true);
    }
  });

  test('module and test counts match 1:1', () => {
    expect(PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES.length).toBe(PHASE_04_CORE_DETERMINISM_REQUIRED_TESTS.length);
  });

  test('module list is ASCIIbetically sorted and unique', () => {
    expect([...PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES].sort()).toEqual([...PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES]);
    expect(new Set(PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES).size).toBe(PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES.length);
  });

  test('gate closes when observed sets match required', () => {
    const decision = evaluateCoreDeterminismGate({
      observedModules: [...PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES],
      observedTests: [...PHASE_04_CORE_DETERMINISM_REQUIRED_TESTS],
    });
    expect(decision.closed).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags missing_module when a module is absent', () => {
    const decision = evaluateCoreDeterminismGate({
      observedModules: PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES.slice(0, -1),
      observedTests: [...PHASE_04_CORE_DETERMINISM_REQUIRED_TESTS],
    });
    expect(decision.closed).toBe(false);
    expect(decision.violations).toContain('missing_module');
  });

  test('flags missing_test when a test is absent', () => {
    const decision = evaluateCoreDeterminismGate({
      observedModules: [...PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES],
      observedTests: PHASE_04_CORE_DETERMINISM_REQUIRED_TESTS.slice(0, -1),
    });
    expect(decision.closed).toBe(false);
    expect(decision.violations).toContain('missing_test');
  });
});
