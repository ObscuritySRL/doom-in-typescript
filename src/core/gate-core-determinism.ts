/**
 * Phase 04 gate: core determinism.
 *
 * Aggregates the core-lane contracts pinned in steps 04-016 through 04-028
 * into a single closed gate. The gate is closed when every named contract
 * module exists with its canonical exports.
 */

export const PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES = Object.freeze([
  'src/core/add-determinism-state-hash-hook.ts',
  'src/core/detect-long-run-drift.ts',
  'src/core/enforce-vanilla-demo-size-limit.ts',
  'src/core/implement-demo-lump-header-parser.ts',
  'src/core/implement-demo-playback-state-machine.ts',
  'src/core/implement-demo-recording-state-machine.ts',
  'src/core/implement-demo-ticcmd-parser.ts',
  'src/core/implement-pause-timing-semantics.ts',
  'src/core/reject-frame-rate-dependent-simulation.ts',
  'src/core/reject-visible-interpolation-in-simulation.ts',
  'src/demo/compare-demo-one-ticcmd-stream.ts',
  'src/demo/compare-demo-three-ticcmd-stream.ts',
  'src/demo/compare-demo-two-ticcmd-stream.ts',
] as const);

export const PHASE_04_CORE_DETERMINISM_REQUIRED_TESTS = Object.freeze([
  'test/vanilla_parity/core/add-determinism-state-hash-hook.test.ts',
  'test/vanilla_parity/core/compare-demo-one-ticcmd-stream.test.ts',
  'test/vanilla_parity/core/compare-demo-three-ticcmd-stream.test.ts',
  'test/vanilla_parity/core/compare-demo-two-ticcmd-stream.test.ts',
  'test/vanilla_parity/core/detect-long-run-drift.test.ts',
  'test/vanilla_parity/core/enforce-vanilla-demo-size-limit.test.ts',
  'test/vanilla_parity/core/implement-demo-lump-header-parser.test.ts',
  'test/vanilla_parity/core/implement-demo-playback-state-machine.test.ts',
  'test/vanilla_parity/core/implement-demo-recording-state-machine.test.ts',
  'test/vanilla_parity/core/implement-demo-ticcmd-parser.test.ts',
  'test/vanilla_parity/core/implement-pause-timing-semantics.test.ts',
  'test/vanilla_parity/core/reject-frame-rate-dependent-simulation.test.ts',
  'test/vanilla_parity/core/reject-visible-interpolation-in-simulation.test.ts',
] as const);

export type CoreDeterminismGateViolation = 'count_mismatch' | 'missing_module' | 'missing_test';

export interface CoreDeterminismGateInput {
  readonly observedModules: readonly string[];
  readonly observedTests: readonly string[];
}

export interface CoreDeterminismGateDecision {
  readonly closed: boolean;
  readonly violations: readonly CoreDeterminismGateViolation[];
}

export function evaluateCoreDeterminismGate(input: CoreDeterminismGateInput): CoreDeterminismGateDecision {
  const violations = new Set<CoreDeterminismGateViolation>();
  const observedModuleSet = new Set(input.observedModules);
  const observedTestSet = new Set(input.observedTests);
  for (const requiredModule of PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES) {
    if (!observedModuleSet.has(requiredModule)) {
      violations.add('missing_module');
    }
  }
  for (const requiredTest of PHASE_04_CORE_DETERMINISM_REQUIRED_TESTS) {
    if (!observedTestSet.has(requiredTest)) {
      violations.add('missing_test');
    }
  }
  if (PHASE_04_CORE_DETERMINISM_REQUIRED_MODULES.length !== PHASE_04_CORE_DETERMINISM_REQUIRED_TESTS.length) {
    violations.add('count_mismatch');
  }
  return Object.freeze({
    closed: violations.size === 0,
    violations: Object.freeze([...violations].sort()),
  });
}
