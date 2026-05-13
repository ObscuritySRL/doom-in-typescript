/**
 * Phase 05 gate: user-supplied DOOM WAD detection.
 *
 * Ensures the IWAD-capability detection primitives can route a parsed WAD
 * directory to shareware / registered / ultimate based on the canonical
 * vanilla DOOM 1.9 lump-presence heuristic:
 *   - shareware: only E1M*, no E2M* / E3M*
 *   - registered: E1M*, E2M*, E3M* (DOOM 1 commercial)
 *   - ultimate: E1M*, E2M*, E3M*, E4M*
 */

export const VANILLA_IWAD_CAPABILITIES = Object.freeze(['shareware', 'registered', 'ultimate', 'unknown'] as const);

export type IwadCapability = (typeof VANILLA_IWAD_CAPABILITIES)[number];

export interface IwadDetectionInput {
  readonly hasE1Maps: boolean;
  readonly hasE2Maps: boolean;
  readonly hasE3Maps: boolean;
  readonly hasE4Maps: boolean;
}

export function detectIwadCapability(input: IwadDetectionInput): IwadCapability {
  if (input.hasE4Maps && input.hasE1Maps && input.hasE2Maps && input.hasE3Maps) {
    return 'ultimate';
  }
  if (input.hasE1Maps && input.hasE2Maps && input.hasE3Maps) {
    return 'registered';
  }
  if (input.hasE1Maps && !input.hasE2Maps && !input.hasE3Maps) {
    return 'shareware';
  }
  return 'unknown';
}

export type IwadDetectionGateViolation = 'inconsistent_episode_set' | 'unknown_iwad';

export interface IwadDetectionGateDecision {
  readonly capability: IwadCapability;
  readonly violations: readonly IwadDetectionGateViolation[];
}

export function evaluateIwadDetectionGate(input: IwadDetectionInput): IwadDetectionGateDecision {
  const violations: IwadDetectionGateViolation[] = [];
  const capability = detectIwadCapability(input);
  if (capability === 'unknown') {
    violations.push('unknown_iwad');
  }
  if (input.hasE4Maps && (!input.hasE1Maps || !input.hasE2Maps || !input.hasE3Maps)) {
    violations.push('inconsistent_episode_set');
  }
  return Object.freeze({
    capability,
    violations: Object.freeze(violations.sort()),
  });
}
