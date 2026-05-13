/**
 * Vanilla DOOM 1.9 P_UseLines contract.
 *
 * The player USE keypress draws a ray 64 map units from the eye in the
 * facing direction. The first usable line (single-sided with special, or
 * two-sided with special) within USERANGE is activated. Two-sided lines
 * without a special pass through (the ray continues to the next line).
 */

export const VANILLA_USE_RANGE = 64;

export interface UseLineCandidate {
  readonly distanceFromEye: number;
  readonly hasSpecial: boolean;
  readonly isTwoSided: boolean;
}

export interface UseLineDecisionInput {
  readonly candidates: readonly UseLineCandidate[];
}

export interface UseLineDecision {
  readonly activatedCandidateIndex: number | null;
  readonly skippedCount: number;
}

export function selectUseLineCandidate(input: UseLineDecisionInput): UseLineDecision {
  let skippedCount = 0;
  for (let candidateIndex = 0; candidateIndex < input.candidates.length; candidateIndex += 1) {
    const candidate = input.candidates[candidateIndex]!;
    if (candidate.distanceFromEye > VANILLA_USE_RANGE) {
      break;
    }
    if (candidate.hasSpecial) {
      return Object.freeze({ activatedCandidateIndex: candidateIndex, skippedCount });
    }
    if (candidate.isTwoSided) {
      skippedCount += 1;
      continue;
    }
    break;
  }
  return Object.freeze({ activatedCandidateIndex: null, skippedCount });
}
