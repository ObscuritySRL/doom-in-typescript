/**
 * Vanilla DOOM 1.9 save/load round-trip oracle contract.
 *
 * The round-trip oracle complements the byte-level oracle: rather
 * than comparing the implementation's bytes against a frozen
 * reference file, it asserts that save(load(file)) === file (and
 * symmetrically load(save(state)) preserves the playable state).
 *
 * Round-trip variants:
 *
 *   1. WRITE-READ-WRITE: write a save from the current in-memory
 *      state, read it back, then write again. The two written
 *      buffers must be byte-identical. This catches non-deterministic
 *      serialization (e.g., uninitialized padding, non-stable
 *      iteration over hash sets).
 *
 *   2. READ-WRITE-READ: read a reference save, write it back out,
 *      then read again. The two parsed game states must be
 *      structurally equal. This catches lossy parsing (e.g., loss
 *      of low bits via fixed-point widening).
 *
 *   3. STATE-SAVE-LOAD-STATE: build an in-memory state, save it,
 *      load the saved bytes into a fresh state object, compare.
 *      This is the strongest gate — it requires both encoder and
 *      decoder to be lossless.
 *
 * Parity-critical details:
 *   - The save buffer's UNINITIALIZED bytes inside PADSAVEP regions
 *     ARE significant for byte equality. Vanilla DOS allocates the
 *     save buffer on the stack and the padding bytes carry whatever
 *     was on the stack — usually zero, but not guaranteed. A
 *     TypeScript port must zero-fill the buffer to make byte
 *     equality reproducible.
 *   - Pointer-to-index conversion is the most fragile area: a mobj
 *     archived with target=index_42 must, after load, target the
 *     same logical mobj. P_RestoreTargets is the round-trip choke
 *     point.
 *   - The leveltime field is THREE bytes; round-tripping a 64-bit
 *     tic counter through three bytes loses high bits. Tests must
 *     compare modulo 2^24 — or use leveltimes < 2^24 only.
 */

export type VanillaRoundTripVariant = 'write-read-write' | 'read-write-read' | 'state-save-load-state';

export const VANILLA_ROUND_TRIP_VARIANTS: readonly VanillaRoundTripVariant[] = Object.freeze(['write-read-write', 'read-write-read', 'state-save-load-state']);

export interface VanillaRoundTripPlan {
  readonly variant: VanillaRoundTripVariant;
  readonly steps: readonly string[];
}

export const VANILLA_ROUND_TRIP_PLANS: ReadonlyMap<VanillaRoundTripVariant, VanillaRoundTripPlan> = Object.freeze(
  new Map<VanillaRoundTripVariant, VanillaRoundTripPlan>([
    ['write-read-write', Object.freeze({ variant: 'write-read-write', steps: Object.freeze(['writeFromState1', 'readToState2', 'writeFromState2', 'compareBuffers']) })],
    ['read-write-read', Object.freeze({ variant: 'read-write-read', steps: Object.freeze(['readToState1', 'writeFromState1', 'readToState2', 'compareStates']) })],
    ['state-save-load-state', Object.freeze({ variant: 'state-save-load-state', steps: Object.freeze(['buildState1', 'writeFromState1', 'readToState2', 'compareStates']) })],
  ]),
);

export function vanillaRoundTripPlanFor(variant: VanillaRoundTripVariant): VanillaRoundTripPlan {
  const plan = VANILLA_ROUND_TRIP_PLANS.get(variant);
  if (plan === undefined) {
    throw new RangeError(`unknown round-trip variant: "${variant}"`);
  }
  return plan;
}
