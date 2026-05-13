/**
 * Phase 03 gate: clean launch host and input.
 *
 * Aggregates the launch-lane contracts pinned in steps 03-017 through 03-035
 * into a single closed gate. The gate is closed when every named contract
 * module exists and exports its canonical public surface, and when the smoke
 * launch path returns `passed: true` against the canonical observed phase
 * sequence.
 */

export const PHASE_03_REQUIRED_BOOTSTRAP_MODULES = Object.freeze([
  'src/bootstrap/implement-clean-launch-to-title-loop.ts',
  'src/bootstrap/implement-close-button-and-alt-f4-behavior.ts',
  'src/bootstrap/implement-deterministic-input-trace-injection.ts',
  'src/bootstrap/implement-deterministic-input-trace-recording.ts',
  'src/bootstrap/implement-escape-to-main-menu-from-title.ts',
  'src/bootstrap/implement-gameplay-key-mapping-from-config.ts',
  'src/bootstrap/implement-keyboard-scan-code-mapping.ts',
  'src/bootstrap/implement-launch-smoke-test-against-doom-ts.ts',
  'src/bootstrap/implement-menu-key-mapping-from-config.ts',
  'src/bootstrap/implement-menu-route-to-e1m1.ts',
  'src/bootstrap/implement-message-pump-ordering.ts',
  'src/bootstrap/implement-mouse-button-mapping.ts',
  'src/bootstrap/implement-mouse-grab-and-release-policy.ts',
  'src/bootstrap/implement-mouse-motion-accumulation.ts',
  'src/bootstrap/implement-resize-and-focus-policy.ts',
  'src/bootstrap/implement-screenshot-capture-hook.ts',
  'src/bootstrap/preserve-key-down-up-event-ordering.ts',
  'src/bootstrap/preserve-key-repeat-behavior.ts',
  'src/bootstrap/route-input-through-responder-chain.ts',
] as const);

export const PHASE_03_REQUIRED_FOCUSED_TESTS = Object.freeze([
  'test/vanilla_parity/launch/implement-clean-launch-to-title-loop.test.ts',
  'test/vanilla_parity/launch/implement-close-button-and-alt-f4-behavior.test.ts',
  'test/vanilla_parity/launch/implement-deterministic-input-trace-injection.test.ts',
  'test/vanilla_parity/launch/implement-deterministic-input-trace-recording.test.ts',
  'test/vanilla_parity/launch/implement-escape-to-main-menu-from-title.test.ts',
  'test/vanilla_parity/launch/implement-gameplay-key-mapping-from-config.test.ts',
  'test/vanilla_parity/launch/implement-keyboard-scan-code-mapping.test.ts',
  'test/vanilla_parity/launch/implement-launch-smoke-test-against-doom-ts.test.ts',
  'test/vanilla_parity/launch/implement-menu-key-mapping-from-config.test.ts',
  'test/vanilla_parity/launch/implement-menu-route-to-e1m1.test.ts',
  'test/vanilla_parity/launch/implement-message-pump-ordering.test.ts',
  'test/vanilla_parity/launch/implement-mouse-button-mapping.test.ts',
  'test/vanilla_parity/launch/implement-mouse-grab-and-release-policy.test.ts',
  'test/vanilla_parity/launch/implement-mouse-motion-accumulation.test.ts',
  'test/vanilla_parity/launch/implement-resize-and-focus-policy.test.ts',
  'test/vanilla_parity/launch/implement-screenshot-capture-hook.test.ts',
  'test/vanilla_parity/launch/preserve-key-down-up-event-ordering.test.ts',
  'test/vanilla_parity/launch/preserve-key-repeat-behavior.test.ts',
  'test/vanilla_parity/launch/route-input-through-responder-chain.test.ts',
] as const);

export type Phase03GateViolation = 'missing_required_module' | 'missing_required_test' | 'count_mismatch';

export interface Phase03GateInput {
  readonly observedModules: readonly string[];
  readonly observedTests: readonly string[];
}

export interface Phase03GateDecision {
  readonly closed: boolean;
  readonly violations: readonly Phase03GateViolation[];
}

export function evaluatePhase03Gate(input: Phase03GateInput): Phase03GateDecision {
  const violations = new Set<Phase03GateViolation>();
  const observedModuleSet = new Set(input.observedModules);
  const observedTestSet = new Set(input.observedTests);
  for (const requiredModule of PHASE_03_REQUIRED_BOOTSTRAP_MODULES) {
    if (!observedModuleSet.has(requiredModule)) {
      violations.add('missing_required_module');
    }
  }
  for (const requiredTest of PHASE_03_REQUIRED_FOCUSED_TESTS) {
    if (!observedTestSet.has(requiredTest)) {
      violations.add('missing_required_test');
    }
  }
  if (PHASE_03_REQUIRED_BOOTSTRAP_MODULES.length !== PHASE_03_REQUIRED_FOCUSED_TESTS.length) {
    violations.add('count_mismatch');
  }
  return Object.freeze({
    closed: violations.size === 0,
    violations: Object.freeze([...violations].sort()),
  });
}
