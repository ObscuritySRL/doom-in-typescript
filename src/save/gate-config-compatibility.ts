/**
 * Vanilla DOOM 1.9 config-compatibility acceptance gate.
 *
 * This is the Phase 12 gate that combines every config-related
 * contract pinned by 12-001..12-009 into a single accept/reject
 * predicate. A test run that flips this gate green satisfies one
 * of the prerequisites for the Phase 13 acceptance gates
 * (13-001 / 13-002 / 13-003).
 *
 * Gate criteria:
 *
 *   1. The 43-variable vanilla default.cfg namespace round-trips
 *      through parse → write byte-for-byte against a synthetic
 *      fixture built with `buildInMemoryDefaultCfgFixture`.
 *   2. The 113-variable chocolate-doom.cfg namespace round-trips
 *      through parseHostExtraCfg → ... (delegate to host-config
 *      tests).
 *   3. The namespaces are disjoint (zero overlapping names).
 *   4. Hardcoded defaults match the documented Chocolate Doom 2.2.1
 *      C-level globals for every key (mouse_sensitivity=5,
 *      sfx_volume=8, key_right=77, opl_io_port=0x388, etc.).
 *   5. M_LoadDefaultCollection unknown-variable behavior is
 *      preserved (silently ignored, no error).
 *   6. No test reads from user-local config paths (assertion via
 *      assertConfigPathIsTestSafe).
 *
 * This module does NOT execute any of the round-trips itself —
 * those live in the focused tests under
 * `test/vanilla_parity/save/`. The gate is a pure CHECKLIST that
 * tracks which contract IDs are pinned and presents the union as
 * a single readiness flag.
 */

export type VanillaConfigGateCheck =
  | 'default-cfg-43-variables'
  | 'chocolate-doom-cfg-113-variables'
  | 'namespaces-disjoint'
  | 'hardcoded-defaults-match-globals'
  | 'unknown-variables-silently-ignored'
  | 'test-isolation-from-user-local-paths'
  | 'mouse-key-sound-screen-chat-persisters-pinned'
  | 'round-trip-writer-43-line-output';

export const VANILLA_CONFIG_GATE_CHECKS: readonly VanillaConfigGateCheck[] = Object.freeze([
  'default-cfg-43-variables',
  'chocolate-doom-cfg-113-variables',
  'namespaces-disjoint',
  'hardcoded-defaults-match-globals',
  'unknown-variables-silently-ignored',
  'test-isolation-from-user-local-paths',
  'mouse-key-sound-screen-chat-persisters-pinned',
  'round-trip-writer-43-line-output',
]);

export const VANILLA_CONFIG_GATE_CHECK_COUNT = VANILLA_CONFIG_GATE_CHECKS.length;

export const VANILLA_CONFIG_GATE_STEP_ID_TO_CHECK: ReadonlyMap<string, VanillaConfigGateCheck> = Object.freeze(
  new Map<string, VanillaConfigGateCheck>([
    ['12-001', 'default-cfg-43-variables'],
    ['12-002', 'chocolate-doom-cfg-113-variables'],
    ['12-003', 'mouse-key-sound-screen-chat-persisters-pinned'],
    ['12-004', 'mouse-key-sound-screen-chat-persisters-pinned'],
    ['12-005', 'mouse-key-sound-screen-chat-persisters-pinned'],
    ['12-006', 'mouse-key-sound-screen-chat-persisters-pinned'],
    ['12-007', 'mouse-key-sound-screen-chat-persisters-pinned'],
    ['12-008', 'round-trip-writer-43-line-output'],
    ['12-009', 'test-isolation-from-user-local-paths'],
  ]),
);

export function vanillaConfigGateChecksSatisfied(passingCheckSet: ReadonlySet<VanillaConfigGateCheck>): boolean {
  for (const check of VANILLA_CONFIG_GATE_CHECKS) {
    if (!passingCheckSet.has(check)) return false;
  }
  return true;
}

export function vanillaConfigGateMissingChecks(passingCheckSet: ReadonlySet<VanillaConfigGateCheck>): readonly VanillaConfigGateCheck[] {
  const missing: VanillaConfigGateCheck[] = [];
  for (const check of VANILLA_CONFIG_GATE_CHECKS) {
    if (!passingCheckSet.has(check)) missing.push(check);
  }
  return Object.freeze(missing);
}
