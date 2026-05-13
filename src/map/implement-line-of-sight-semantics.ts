/**
 * Vanilla DOOM 1.9 P_CheckSight contract.
 *
 * P_CheckSight first consults the REJECT fast-path (06-018). If not rejected,
 * it traces a 2D ray from t1->t2 via P_PathTraverse, checking each crossed
 * two-sided line's opening: if the ray's height at that intersection lies
 * outside [openBottom, openTop], sight is blocked. Single-sided lines block
 * sight unconditionally.
 */

export interface SightLineCrossing {
  readonly frac: number;
  readonly isTwoSided: boolean;
  readonly openTop: number;
  readonly openBottom: number;
}

export interface SightTraceInput {
  readonly source: { readonly z: number };
  readonly target: { readonly z: number };
  readonly crossings: readonly SightLineCrossing[];
}

export function evaluateSightTrace(input: SightTraceInput): boolean {
  const dz = input.target.z - input.source.z;
  for (const crossing of input.crossings) {
    if (!crossing.isTwoSided) {
      return false;
    }
    const rayZ = input.source.z + dz * crossing.frac;
    if (rayZ <= crossing.openBottom || rayZ >= crossing.openTop) {
      return false;
    }
  }
  return true;
}
