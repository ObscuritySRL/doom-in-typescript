/**
 * Vanilla launch smoke-test contract for the future `bun run doom.ts` entrypoint.
 *
 * The smoke test asserts the canonical phase ordering between argv parsing and
 * the first attract-loop tic: command-line parse, IWAD discovery, config load,
 * resource init (Z/V/W/I/M/R/P/S), network check (D_CheckNetGame), HUD/status
 * init (HU/ST), and finally D_DoomLoop. The Ralph loop builds this contract
 * before doom.ts actually exists so the launch wiring lands against a verified
 * invariant.
 */

import { VANILLA_PER_TIC_PHASE_ORDER } from './implement-message-pump-ordering.ts';

/** Phases that must run before D_DoomLoop. */
export const VANILLA_PRE_LOOP_PHASES = Object.freeze([
  'parse_cmdline',
  'discover_iwad',
  'load_default_cfg',
  'load_chocolate_doom_cfg',
  'z_init',
  'v_init',
  'm_load_defaults',
  'w_init',
  'i_init',
  'opl_init',
  'net_init',
  'm_init',
  'r_init',
  'p_init',
  's_init',
  'd_check_net_game',
  'hu_init',
  'st_init',
  'i_init_stretch_tables',
] as const);

export type LaunchPhase = (typeof VANILLA_PRE_LOOP_PHASES)[number];

export interface LaunchSmokeInput {
  readonly observedPreLoopPhases: readonly LaunchPhase[];
  readonly enteredDoomLoop: boolean;
  readonly firstPerTicPhaseOrder: readonly string[];
}

export type LaunchSmokeViolation = 'missing_pre_loop_phase' | 'pre_loop_phase_order_mismatch' | 'did_not_enter_doom_loop' | 'per_tic_phase_order_mismatch';

export interface LaunchSmokeDecision {
  readonly passed: boolean;
  readonly violations: readonly LaunchSmokeViolation[];
}

function arrayEqual(observedSequence: readonly string[], expectedSequence: readonly string[]): boolean {
  if (observedSequence.length !== expectedSequence.length) {
    return false;
  }
  for (let index = 0; index < expectedSequence.length; index += 1) {
    if (observedSequence[index] !== expectedSequence[index]) {
      return false;
    }
  }
  return true;
}

export function evaluateLaunchSmoke(input: LaunchSmokeInput): LaunchSmokeDecision {
  const violations = new Set<LaunchSmokeViolation>();
  const expectedPhaseSet = new Set<string>(VANILLA_PRE_LOOP_PHASES);
  const observedPhaseSet = new Set<string>(input.observedPreLoopPhases);
  for (const expectedPhase of expectedPhaseSet) {
    if (!observedPhaseSet.has(expectedPhase)) {
      violations.add('missing_pre_loop_phase');
    }
  }
  if (!arrayEqual(input.observedPreLoopPhases, [...VANILLA_PRE_LOOP_PHASES])) {
    violations.add('pre_loop_phase_order_mismatch');
  }
  if (!input.enteredDoomLoop) {
    violations.add('did_not_enter_doom_loop');
  }
  if (!arrayEqual(input.firstPerTicPhaseOrder, [...VANILLA_PER_TIC_PHASE_ORDER])) {
    violations.add('per_tic_phase_order_mismatch');
  }
  return Object.freeze({
    passed: violations.size === 0,
    violations: Object.freeze([...violations].sort()),
  });
}
