/**
 * Vanilla DOOM 1.9 level-exit wiring facade.
 *
 * Plan_final step `08-008` (lane: map-world) wires the level-exit
 * path — normal exit, secret exit, episode endings, the shareware
 * E1M8 boss-death exit, and the post-exit intermission / next-map
 * selection — over the read-only `src/ai/bossSpecials.ts`
 * (`A_BossDeath` E1M8 tag-666 gate) and `src/ui/intermission.ts`
 * (the single-player intermission state machine).
 *
 * Those modules already implement the byte-exact g_game.c
 * `G_ExitLevel` / `G_SecretExitLevel` / `G_DoCompleted` and
 * wi_stuff.c intermission behavior, and are SHA-pinned by the
 * inventory; this module does NOT modify them.  It is a pure
 * re-export barrel (value/type split for `verbatimModuleSyntax`,
 * no `const enum`s) plus a frozen invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. A normal exit advances to the next map (the intermission
 *      runs, then `G_DoCompleted` picks the next level).
 *   2. A secret exit routes to the episode's secret level.
 *   3. The shareware E1M8 Baron death (`A_BossDeath`, the
 *      `BOSS_DEATH_TAG` = 666 gate) ends episode 1 — it transitions
 *      to the finale, not to a next map.
 *   4. The single-player intermission runs the ten-state machine
 *      `SP_STATE_INITIAL_PAUSE` (1) … `SP_STATE_FINAL` (10).
 *   5. The "entering next level" pointer is shown for
 *      `WI_SHOW_NEXT_LOC_TICS` = `WI_SHOW_NEXT_LOC_SECONDS` (4) ×
 *      `TICRATE` (35) = 140 tics.
 *
 * @example
 * ```ts
 * import { SP_STATE_FINAL, BOSS_DEATH_TAG, VANILLA_LEVEL_EXIT_INVARIANTS } from './wireLevelExits.ts';
 * SP_STATE_FINAL;                                // 10
 * BOSS_DEATH_TAG;                                // 666
 * VANILLA_LEVEL_EXIT_INVARIANTS.length;          // 5
 * ```
 */

export { BOSS_DEATH_TAG, aBossDeath } from '../ai/bossSpecials.ts';
export {
  SP_STATE_FINAL,
  SP_STATE_INITIAL_PAUSE,
  SP_STATE_ITEMS,
  SP_STATE_KILLS,
  SP_STATE_SECRETS,
  SP_STATE_TIME_AND_PAR,
  TICRATE,
  WI_MAX_PERCENT,
  WI_NO_STATE_TICS,
  WI_SHOW_NEXT_LOC_SECONDS,
  WI_SHOW_NEXT_LOC_TICS,
  WI_SP_PAUSE_TICS,
  createIntermissionState,
} from '../ui/intermission.ts';
export type { IntermissionMusicCue, IntermissionSoundId, IntermissionState, IntermissionTickResult } from '../ui/intermission.ts';

/**
 * One pinned level-exit parity invariant.
 */
export interface VanillaLevelExitInvariant {
  readonly id: 'E1M8_BOSS_DEATH_ENDS_THE_EPISODE' | 'INTERMISSION_SP_STATE_MACHINE_HAS_TEN_STATES' | 'NEXT_LOCATION_POINTER_SHOWS_FOR_FOUR_SECONDS' | 'NORMAL_EXIT_ADVANCES_TO_THE_NEXT_MAP' | 'SECRET_EXIT_ROUTES_TO_THE_SECRET_MAP';
  readonly rule: string;
}

/**
 * Frozen manifest of the five level-exit parity invariants this
 * step pins.  A later step that wires the live exit / intermission
 * flow must preserve all five.
 */
export const VANILLA_LEVEL_EXIT_INVARIANTS: readonly VanillaLevelExitInvariant[] = Object.freeze([
  Object.freeze({
    id: 'E1M8_BOSS_DEATH_ENDS_THE_EPISODE',
    rule: 'The shareware E1M8 Baron death (A_BossDeath, BOSS_DEATH_TAG = 666 gate on the last boss-type mobj) ends episode 1 and transitions to the finale, not to a next map, matching p_enemy.c A_BossDeath + g_game.c.',
  } satisfies VanillaLevelExitInvariant),
  Object.freeze({
    id: 'INTERMISSION_SP_STATE_MACHINE_HAS_TEN_STATES',
    rule: 'The single-player intermission runs the ten-state machine from SP_STATE_INITIAL_PAUSE (1) to SP_STATE_FINAL (10) (kills -> items -> secrets -> time/par with paced pauses), matching wi_stuff.c.',
  } satisfies VanillaLevelExitInvariant),
  Object.freeze({
    id: 'NEXT_LOCATION_POINTER_SHOWS_FOR_FOUR_SECONDS',
    rule: 'The "entering next level" pointer is shown for WI_SHOW_NEXT_LOC_TICS = WI_SHOW_NEXT_LOC_SECONDS (4) * TICRATE (35) = 140 tics before the next map loads.',
  } satisfies VanillaLevelExitInvariant),
  Object.freeze({
    id: 'NORMAL_EXIT_ADVANCES_TO_THE_NEXT_MAP',
    rule: 'A normal exit runs the intermission and then G_DoCompleted selects the next sequential map for the current episode.',
  } satisfies VanillaLevelExitInvariant),
  Object.freeze({
    id: 'SECRET_EXIT_ROUTES_TO_THE_SECRET_MAP',
    rule: 'A secret exit (G_SecretExitLevel) routes to the episode secret level (E1M9 for shareware episode 1) instead of the next sequential map.',
  } satisfies VanillaLevelExitInvariant),
]);
