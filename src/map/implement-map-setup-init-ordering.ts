/**
 * Vanilla DOOM 1.9 P_SetupLevel ordering contract.
 *
 * Pinned from p_setup.c::P_SetupLevel:
 *   1. P_LoadBlockMap
 *   2. P_LoadVertexes
 *   3. P_LoadSectors
 *   4. P_LoadSideDefs
 *   5. P_LoadLineDefs
 *   6. P_LoadSubsectors
 *   7. P_LoadNodes
 *   8. P_LoadSegs
 *   9. P_LoadReject
 *  10. P_GroupLines
 *  11. P_LoadThings (spawn map things)
 *  12. P_SpawnSpecials
 */

export const VANILLA_MAP_SETUP_PHASES = Object.freeze([
  'P_LoadBlockMap',
  'P_LoadVertexes',
  'P_LoadSectors',
  'P_LoadSideDefs',
  'P_LoadLineDefs',
  'P_LoadSubsectors',
  'P_LoadNodes',
  'P_LoadSegs',
  'P_LoadReject',
  'P_GroupLines',
  'P_LoadThings',
  'P_SpawnSpecials',
] as const);

export type MapSetupPhase = (typeof VANILLA_MAP_SETUP_PHASES)[number];

export type MapSetupViolation = 'missing_phase' | 'wrong_order' | 'duplicate_phase';

export interface MapSetupDecision {
  readonly accepted: boolean;
  readonly violations: readonly MapSetupViolation[];
}

export function evaluateMapSetupOrder(observed: readonly MapSetupPhase[]): MapSetupDecision {
  const violations = new Set<MapSetupViolation>();
  const observedSet = new Set<MapSetupPhase>();
  for (const phase of observed) {
    if (observedSet.has(phase)) {
      violations.add('duplicate_phase');
    }
    observedSet.add(phase);
  }
  for (const expectedPhase of VANILLA_MAP_SETUP_PHASES) {
    if (!observedSet.has(expectedPhase)) {
      violations.add('missing_phase');
    }
  }
  if (observed.length === VANILLA_MAP_SETUP_PHASES.length) {
    for (let phaseIndex = 0; phaseIndex < VANILLA_MAP_SETUP_PHASES.length; phaseIndex += 1) {
      if (observed[phaseIndex] !== VANILLA_MAP_SETUP_PHASES[phaseIndex]) {
        violations.add('wrong_order');
        break;
      }
    }
  } else if (violations.size === 0) {
    violations.add('wrong_order');
  }
  return Object.freeze({
    accepted: violations.size === 0,
    violations: Object.freeze([...violations].sort()),
  });
}
