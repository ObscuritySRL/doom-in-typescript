/**
 * Vanilla DOOM 1.9 long-run determinism drift detector.
 *
 * Compares a sequence of per-tic state hashes against an expected sequence.
 * Any divergence at any tic is a determinism failure. Pinned semantics:
 * vanilla DOOM is fully deterministic given the same input stream and starting
 * RNG seed; two runs must produce byte-identical state hashes at every tic.
 *
 * The detector reports the first divergent tic plus any hash-count mismatch
 * (e.g. one run aborted early).
 */

export interface LongRunInput {
  readonly observedHashes: readonly string[];
  readonly expectedHashes: readonly string[];
}

export type LongRunDriftKind = 'first_divergence' | 'length_mismatch' | 'empty_streams';

export interface LongRunDriftDecision {
  readonly drifted: boolean;
  readonly firstDivergentTic: number | null;
  readonly kinds: readonly LongRunDriftKind[];
}

export function detectLongRunDrift(input: LongRunInput): LongRunDriftDecision {
  const kinds = new Set<LongRunDriftKind>();
  if (input.observedHashes.length === 0 && input.expectedHashes.length === 0) {
    kinds.add('empty_streams');
    return Object.freeze({ drifted: false, firstDivergentTic: null, kinds: Object.freeze([...kinds]) });
  }
  if (input.observedHashes.length !== input.expectedHashes.length) {
    kinds.add('length_mismatch');
  }
  const compareUpTo = Math.min(input.observedHashes.length, input.expectedHashes.length);
  let firstDivergentTic: number | null = null;
  for (let ticIndex = 0; ticIndex < compareUpTo; ticIndex += 1) {
    if (input.observedHashes[ticIndex] !== input.expectedHashes[ticIndex]) {
      firstDivergentTic = ticIndex;
      kinds.add('first_divergence');
      break;
    }
  }
  return Object.freeze({
    drifted: kinds.size > 0 && !(kinds.size === 1 && kinds.has('empty_streams')),
    firstDivergentTic,
    kinds: Object.freeze([...kinds].sort()),
  });
}
