/**
 * Vanilla DOOM 1.9 deterministic state-snapshot hashing.
 *
 * Plan_final step `04-007` (lane: runtime-core) adds the
 * deterministic per-tic state-snapshot hash every final acceptance
 * checkpoint compares against the reference.  The canonical
 * component set is pinned by the read-only
 * `src/oracles/stateHash.ts` schema:
 *
 *   - `player`   — the console player's serialized state.
 *   - `rng`      — the DOOM LCG index (`rndindex`) snapshot.
 *   - `sectors`  — every sector's floor/ceiling height + light.
 *   - `thinkers` — the ordered live-thinker serialization.
 *   - `automap`  — the automap pan/zoom/marker state.
 *   - `combined` — SHA-256 over the five individual digests, in the
 *     canonical ASCIIbetical component order, giving a single
 *     pass/fail comparison value.
 *
 * `hashStateSnapshot` is pure and deterministic: identical input
 * bytes always produce identical hashes, so an acceptance run can
 * be replayed bit-for-bit.  The function does NOT serialize the
 * runtime itself — the caller supplies the already-serialized bytes
 * for each individual component (a later runtime-core step wires
 * the concrete serializers); this step pins the hashing contract
 * and the combined-digest derivation order.
 *
 * @example
 * ```ts
 * import { hashStateSnapshot } from './wireStateSnapshotHash.ts';
 * const entry = hashStateSnapshot(35, {
 *   automap: automapBytes,
 *   player: playerBytes,
 *   rng: rngBytes,
 *   sectors: sectorBytes,
 *   thinkers: thinkerBytes,
 * });
 * entry.tic;                 // 35
 * entry.hashes.combined;     // 64-hex-char SHA-256 of the 5 digests
 * ```
 */

import { createHash } from 'node:crypto';

import type { StateHashComponent, StateHashEntry } from '../oracles/stateHash.ts';
import { STATE_HASH_COMPONENTS } from '../oracles/stateHash.ts';

/**
 * The five individual (non-`combined`) state components, in the
 * canonical ASCIIbetical order the combined digest concatenates
 * them.  Derived from the read-only `STATE_HASH_COMPONENTS` so a
 * schema change there is reflected here automatically.
 */
export const VANILLA_INDIVIDUAL_STATE_COMPONENTS: readonly Exclude<StateHashComponent, 'combined'>[] = Object.freeze(
  STATE_HASH_COMPONENTS.filter((component): component is Exclude<StateHashComponent, 'combined'> => component !== 'combined'),
);

/**
 * Map of each individual state component to its already-serialized
 * snapshot bytes for one tic.  Every key in
 * {@link VANILLA_INDIVIDUAL_STATE_COMPONENTS} must be present.
 */
export type StateComponentBytes = Readonly<Record<Exclude<StateHashComponent, 'combined'>, Uint8Array>>;

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Compute the deterministic {@link StateHashEntry} for one tic from
 * the five individual component serializations.
 *
 * Each individual component's SHA-256 is computed over its supplied
 * bytes.  The `combined` hash is SHA-256 over the concatenation of
 * the five individual hex digests in the canonical ASCIIbetical
 * component order (automap, player, rng, sectors, thinkers) — a
 * stable order so the combined value is reproducible across runs
 * and machines.
 *
 * @param tic            The game tic this snapshot was captured at.
 * @param componentBytes The serialized bytes for each individual
 *                       component.
 * @returns A frozen {@link StateHashEntry} whose `hashes` keys
 *          exactly match `STATE_HASH_COMPONENTS`.
 * @throws Error When any individual component's bytes are missing.
 */
export function hashStateSnapshot(tic: number, componentBytes: StateComponentBytes): StateHashEntry {
  const hashes: Record<StateHashComponent, string> = {} as Record<StateHashComponent, string>;
  let combinedSource = '';
  for (const component of VANILLA_INDIVIDUAL_STATE_COMPONENTS) {
    const bytes = componentBytes[component];
    if (bytes === undefined) {
      throw new Error(`hashStateSnapshot missing bytes for state component "${component}"`);
    }
    const digest = sha256Hex(bytes);
    hashes[component] = digest;
    combinedSource += digest;
  }
  hashes.combined = createHash('sha256').update(combinedSource, 'utf8').digest('hex');
  return Object.freeze({
    hashes: Object.freeze(hashes),
    tic,
  });
}
