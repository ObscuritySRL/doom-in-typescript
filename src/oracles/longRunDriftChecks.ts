/**
 * Vanilla DOOM 1.9 long-run replay drift-check aggregator.
 *
 * Plan_final step `12-008` (lane: save-config-demo) adds the
 * replay drift checks the final acceptance gate runs over the long
 * attract loop, recorded demos, and the scripted E1M1 path.  The
 * read-only `./framebufferHash.ts` (pixel drift) and
 * `./stateHash.ts` (tic/state drift) oracle modules already pin the
 * comparison artifact contracts and the frozen empty baselines for
 * the title-loop and demo-playback run modes; this module is a pure
 * same-directory aggregator and does NOT modify them.  Neither
 * source declares a `const enum`, so every value and structural
 * type is surfaced (values via `export`, types via `export type`)
 * under `verbatimModuleSyntax`.
 *
 * @example
 * ```ts
 * import { EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH, STATE_HASH_COMPONENTS, VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS } from './longRunDriftChecks.ts';
 * VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS.length; // 5
 * ```
 */

export { DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS, EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH, EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH, FRAMEBUFFER_HEIGHT, FRAMEBUFFER_SIZE, FRAMEBUFFER_WIDTH, PALETTE_COUNT } from './framebufferHash.ts';
export type { FramebufferHashArtifact, FramebufferHashEntry, FramebufferHashPayload } from './framebufferHash.ts';
export { DEFAULT_SAMPLING_INTERVAL_TICS, EMPTY_DEMO_PLAYBACK_STATE_HASH, EMPTY_TITLE_LOOP_STATE_HASH, INDIVIDUAL_COMPONENT_COUNT, STATE_HASH_COMPONENTS } from './stateHash.ts';
export type { StateHashArtifact, StateHashComponent, StateHashEntry, StateHashPayload } from './stateHash.ts';

/** One pinned long-run replay drift-check invariant. */
export interface VanillaLongRunDriftCheckInvariant {
  /** Stable ASCII-sortable identifier. */
  readonly id: string;
  /** Human-readable parity rule the drift checks preserve. */
  readonly rule: string;
}

/**
 * Frozen manifest of the five parity rules the long-run replay
 * drift checks preserve across the attract loop, demos, and the
 * scripted E1M1 path.  Ids are ASCII-sorted.
 */
export const VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS: readonly VanillaLongRunDriftCheckInvariant[] = Object.freeze([
  Object.freeze({
    id: 'COMBINED_STATE_HASH_OVER_FIVE_INDIVIDUAL_COMPONENTS',
    rule: "State drift uses the six STATE_HASH_COMPONENTS where 'combined' is the SHA-256 over the INDIVIDUAL_COMPONENT_COUNT (5) others (automap, player, rng, sectors, thinkers) in canonical ASCIIbetical order, giving one pass/fail comparison value per sampled tic.",
  }),
  Object.freeze({
    id: 'DEMO_PLAYBACK_PIXEL_AND_STATE_BASELINES_ARE_FROZEN',
    rule: 'EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH and EMPTY_DEMO_PLAYBACK_STATE_HASH are frozen empty payloads a recorded-demo replay drift-check starts from, so a zero-tic demo run compares structurally equal before any sample is appended.',
  }),
  Object.freeze({
    id: 'DRIFT_CHECKS_SAMPLE_EVERY_35_TICS',
    rule: 'Both the framebuffer (DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS) and state (DEFAULT_SAMPLING_INTERVAL_TICS) drift checks sample at the 35-tic (one second) default cadence across the long attract loop and the scripted E1M1 path.',
  }),
  Object.freeze({
    id: 'FRAMEBUFFER_IS_320x200_WITH_14_PALETTES',
    rule: 'Pixel drift hashes the FRAMEBUFFER_WIDTH (320) x FRAMEBUFFER_HEIGHT (200) = FRAMEBUFFER_SIZE (64000) byte indexed framebuffer across the PALETTE_COUNT (14) vanilla palettes, so a one-pixel or one-palette divergence fails the check.',
  }),
  Object.freeze({
    id: 'TITLE_LOOP_PIXEL_AND_STATE_BASELINES_ARE_FROZEN',
    rule: 'EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH and EMPTY_TITLE_LOOP_STATE_HASH are frozen empty payloads the long attract-loop drift-check starts from, pinning the title/demo attract sequence baseline.',
  }),
]);
