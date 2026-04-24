/**
 * State hash format for oracle game-state verification.
 *
 * Defines the component vocabulary, entry structure, and payload shape
 * for capturing deterministic game-state hashes at specific tic
 * intervals during oracle reference runs.  Each entry records
 * per-component SHA-256 hashes and a combined hash for quick
 * pass/fail parity comparison.
 *
 * @example
 * ```ts
 * import { STATE_HASH_COMPONENTS, DEFAULT_SAMPLING_INTERVAL_TICS } from "../src/oracles/stateHash.ts";
 * console.log(STATE_HASH_COMPONENTS[0]); // "automap"
 * ```
 */

import type { OracleArtifact } from './schema.ts';
import type { RunMode } from './referenceRunManifest.ts';

/**
 * Discriminant tag for a game-state component included in the hash.
 *
 * Individual components (`automap`, `player`, `rng`, `sectors`, `thinkers`)
 * are hashed independently.  The `combined` component is derived by hashing
 * the concatenation of all individual component hashes in ASCIIbetical
 * component-name order.
 */
export type StateHashComponent = 'automap' | 'combined' | 'player' | 'rng' | 'sectors' | 'thinkers';

/** Frozen, ASCIIbetically sorted list of every valid state hash component. */
export const STATE_HASH_COMPONENTS: readonly StateHashComponent[] = Object.freeze(['automap', 'combined', 'player', 'rng', 'sectors', 'thinkers'] as const);

/**
 * Default sampling interval in tics between state hash captures.
 *
 * 35 tics equals exactly one second at the Doom tic rate (F-010).
 * Use 1 for tic-by-tic parity debugging.
 */
export const DEFAULT_SAMPLING_INTERVAL_TICS = 35;

/**
 * Number of individual (non-combined) state hash components.
 *
 * The combined hash is derived from all individual component hashes,
 * so the number of independently hashed components is one fewer
 * than the total component count.
 */
export const INDIVIDUAL_COMPONENT_COUNT = STATE_HASH_COMPONENTS.length - 1;

/**
 * A single game-state hash snapshot at a specific tic.
 *
 * Each entry records a SHA-256 hash for every state component
 * at the given tic number.  The `combined` hash is derived by
 * hashing the concatenation of all individual component hashes
 * in ASCIIbetical component-name order.
 */
export interface StateHashEntry {
  /** Game tic number at which this snapshot was captured (0-based). */
  readonly tic: number;
  /** SHA-256 hashes keyed by state component name. */
  readonly hashes: Readonly<Record<StateHashComponent, string>>;
}

/**
 * Payload for a state-hash oracle artifact.
 *
 * Entries must be sorted ascending by tic number.  Each entry
 * contains per-component SHA-256 hashes for fine-grained divergence
 * isolation and a combined hash for quick pass/fail comparison.
 * The sampling interval determines the tic spacing between captures;
 * entries at non-interval tics are permitted for targeted debugging.
 */
export interface StateHashPayload {
  /** Human-readable description of what this state hash set verifies. */
  readonly description: string;
  /** Which run mode this state hash set was captured from. */
  readonly targetRunMode: RunMode;
  /**
   * Tic interval between regular hash captures.
   * Use DEFAULT_SAMPLING_INTERVAL_TICS (35) for one-second resolution.
   * Use 1 for tic-by-tic debugging.
   */
  readonly samplingIntervalTics: number;
  /** Tic rate in Hz; must match the reference target (35). */
  readonly ticRateHz: number;
  /** Components included in each hash entry, ASCIIbetically sorted. */
  readonly components: readonly StateHashComponent[];
  /** Ordered sequence of state hash entries, sorted ascending by tic. */
  readonly entries: readonly StateHashEntry[];
}

/** Type alias for a complete state-hash oracle artifact. */
export type StateHashArtifact = OracleArtifact<StateHashPayload>;

/**
 * Frozen empty state hash payload for title-loop captures where no
 * state snapshots have been recorded yet.  Used as a template before
 * the reference capture populates entries.
 */
export const EMPTY_TITLE_LOOP_STATE_HASH: StateHashPayload = Object.freeze({
  description: 'Empty state hash template for title/demo attract loop capture',
  targetRunMode: 'title-loop',
  samplingIntervalTics: DEFAULT_SAMPLING_INTERVAL_TICS,
  ticRateHz: 35,
  components: STATE_HASH_COMPONENTS,
  entries: Object.freeze([]),
} satisfies StateHashPayload);

/**
 * Frozen empty state hash payload for demo-playback captures where no
 * state snapshots have been recorded yet.  Used as a template before
 * the reference capture populates entries.
 */
export const EMPTY_DEMO_PLAYBACK_STATE_HASH: StateHashPayload = Object.freeze({
  description: 'Empty state hash template for demo playback capture',
  targetRunMode: 'demo-playback',
  samplingIntervalTics: DEFAULT_SAMPLING_INTERVAL_TICS,
  ticRateHz: 35,
  components: STATE_HASH_COMPONENTS,
  entries: Object.freeze([]),
} satisfies StateHashPayload);
