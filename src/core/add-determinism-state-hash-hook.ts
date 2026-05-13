/**
 * Vanilla DOOM 1.9 per-tic determinism state hash hook.
 *
 * Adds a per-tic state hash collection point that runs at the end of each
 * P_Ticker pass, after thinkers have advanced but before D_Display. Hashes
 * are SHA-256 over the canonical component byte order pinned in 02-012
 * (automap | player | rng | sectors | thinkers concatenation), with the
 * combined hash derived by hashing the concatenation of the individual
 * component hashes.
 */

export const VANILLA_STATE_HASH_HOOK_INSERTION_PHASE = 'after_p_ticker_before_d_display';
export const VANILLA_STATE_HASH_COMPONENTS_FROM_02_012 = Object.freeze(['automap', 'player', 'rng', 'sectors', 'thinkers'] as const);
export const VANILLA_STATE_HASH_ALGORITHM = 'SHA-256';
export const VANILLA_STATE_HASH_COMBINED_NAME = 'combined';

export interface PerTicStateHashCollection {
  readonly tic: number;
  readonly automap: string;
  readonly player: string;
  readonly rng: string;
  readonly sectors: string;
  readonly thinkers: string;
  readonly combined: string;
}

export type StateHashHookViolation = 'invalid_tic' | 'missing_component_hash' | 'malformed_hash';

const SHA256_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;

export function validatePerTicStateHashCollection(collection: PerTicStateHashCollection): readonly StateHashHookViolation[] {
  const violations: StateHashHookViolation[] = [];
  if (!Number.isInteger(collection.tic) || collection.tic < 0) {
    violations.push('invalid_tic');
  }
  for (const componentName of VANILLA_STATE_HASH_COMPONENTS_FROM_02_012) {
    const componentHash = collection[componentName];
    if (typeof componentHash !== 'string' || componentHash.length === 0) {
      violations.push('missing_component_hash');
    } else if (!SHA256_HEX_PATTERN.test(componentHash)) {
      violations.push('malformed_hash');
    }
  }
  if (typeof collection.combined !== 'string' || !SHA256_HEX_PATTERN.test(collection.combined)) {
    violations.push('malformed_hash');
  }
  return Object.freeze([...new Set(violations)].sort());
}
