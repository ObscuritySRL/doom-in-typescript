/**
 * Vanilla DOOM 1.9 intermission-runtime wiring facade.
 *
 * Plan_final step `07-007` (lane: ui) wires the intermission
 * (wi_stuff.c) runtime — the single-player stat tally state
 * machine, the accelerate skip, the `mus_inter` music cue, and the
 * world-done transition to the next map — over the read-only
 * `src/ui/intermission.ts` module.
 *
 * That module already implements the byte-exact wi_stuff.c
 * `WI_Ticker` / `WI_updateStats` behavior and is SHA-pinned by the
 * inventory; this module does NOT modify it.  It is a pure
 * re-export barrel (value/type split for `verbatimModuleSyntax`,
 * no `const enum`s) plus a frozen invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. The single-player tally runs the ten-state machine
 *      `SP_STATE_INITIAL_PAUSE` (1) … `SP_STATE_FINAL` (10):
 *      kills → items → secrets → time/par with paced pauses.
 *   2. The stat counters animate by the fixed per-tic deltas
 *      `SP_KILLS_DELTA` / `SP_ITEMS_DELTA` / `SP_SECRETS_DELTA` = 2
 *      and `SP_TIME_DELTA` = 3, clamped at `WI_MAX_PERCENT` = 100.
 *   3. `checkForAccelerate` lets a fire/use press skip the pause
 *      between stat lines (snap to the line's final value).
 *   4. The intermission music is the `mus_inter` cue
 *      (`IntermissionMusicCue`), started once on entry.
 *   5. After `SP_STATE_FINAL`, `tickIntermission` signals
 *      world-done so the host advances to the next map (or finale).
 *
 * @example
 * ```ts
 * import { createIntermissionState, SP_STATE_FINAL, VANILLA_INTERMISSION_RUNTIME_INVARIANTS } from './wireIntermissionRuntime.ts';
 * typeof createIntermissionState();              // 'object'
 * SP_STATE_FINAL;                                // 10
 * VANILLA_INTERMISSION_RUNTIME_INVARIANTS.length; // 5
 * ```
 */

export {
  SP_ITEMS_DELTA,
  SP_KILLS_DELTA,
  SP_SECRETS_DELTA,
  SP_STATE_FINAL,
  SP_STATE_INITIAL_PAUSE,
  SP_STATE_ITEMS,
  SP_STATE_KILLS,
  SP_STATE_SECRETS,
  SP_STATE_TIME_AND_PAR,
  SP_TIME_DELTA,
  TICRATE,
  WI_MAX_PERCENT,
  WI_NO_STATE_TICS,
  WI_SHOW_NEXT_LOC_TICS,
  WI_SP_PAUSE_TICS,
  beginIntermission,
  checkForAccelerate,
  createIntermissionState,
  tickIntermission,
} from '../ui/intermission.ts';
export type { IntermissionMusicCue, IntermissionPlayerInput, IntermissionPlayerResult, IntermissionRound, IntermissionSoundId, IntermissionState, IntermissionTickResult } from '../ui/intermission.ts';

/**
 * One pinned intermission-runtime parity invariant.
 */
export interface VanillaIntermissionRuntimeInvariant {
  readonly id: 'ACCELERATE_SKIPS_THE_STAT_PAUSE' | 'INTERMISSION_ANIMATES_STATS_BY_FIXED_DELTAS' | 'INTERMISSION_USES_MUS_INTER' | 'SP_STATE_MACHINE_HAS_TEN_STATES' | 'WORLD_DONE_TRANSITIONS_AFTER_FINAL_STATE';
  readonly rule: string;
}

/**
 * Frozen manifest of the five intermission-runtime parity
 * invariants this step pins.  A later step that wires the live
 * intermission screen must preserve all five.
 */
export const VANILLA_INTERMISSION_RUNTIME_INVARIANTS: readonly VanillaIntermissionRuntimeInvariant[] = Object.freeze([
  Object.freeze({
    id: 'ACCELERATE_SKIPS_THE_STAT_PAUSE',
    rule: 'checkForAccelerate lets a fire/use press skip the pause between stat lines, snapping the current counter to its final value, matching wi_stuff.c WI_checkForAccelerate.',
  } satisfies VanillaIntermissionRuntimeInvariant),
  Object.freeze({
    id: 'INTERMISSION_ANIMATES_STATS_BY_FIXED_DELTAS',
    rule: 'The kills/items/secrets percentages tick up by SP_KILLS_DELTA / SP_ITEMS_DELTA / SP_SECRETS_DELTA = 2 and time by SP_TIME_DELTA = 3 per tic, clamped at WI_MAX_PERCENT = 100, matching wi_stuff.c WI_updateStats.',
  } satisfies VanillaIntermissionRuntimeInvariant),
  Object.freeze({
    id: 'INTERMISSION_USES_MUS_INTER',
    rule: 'The intermission starts the IntermissionMusicCue mus_inter once on entry (the Doom-1 intermission track), not the commercial mus_dm2int.',
  } satisfies VanillaIntermissionRuntimeInvariant),
  Object.freeze({
    id: 'SP_STATE_MACHINE_HAS_TEN_STATES',
    rule: 'createIntermissionState / tickIntermission run the single-player tally state machine SP_STATE_INITIAL_PAUSE (1) through SP_STATE_FINAL (10): kills -> items -> secrets -> time/par with WI_SP_PAUSE_TICS pauses.',
  } satisfies VanillaIntermissionRuntimeInvariant),
  Object.freeze({
    id: 'WORLD_DONE_TRANSITIONS_AFTER_FINAL_STATE',
    rule: 'After SP_STATE_FINAL plus WI_SHOW_NEXT_LOC_TICS, tickIntermission signals the world-done transition so the host advances to the next map or the finale.',
  } satisfies VanillaIntermissionRuntimeInvariant),
]);
