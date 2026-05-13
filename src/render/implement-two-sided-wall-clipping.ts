/**
 * Vanilla DOOM 1.9 two-sided (passable / pass-through) wall clipping contract.
 *
 * From Chocolate Doom 2.2.1 r_bsp.c R_ClipPassWallSegment / R_AddLine:
 *
 *   void R_ClipPassWallSegment(int first, int last)
 *   {
 *       cliprange_t *start;
 *
 *       // Find the first range that touches the range.
 *       start = solidsegs;
 *       while (start->last < first - 1)
 *           start++;
 *
 *       if (first < start->first)
 *       {
 *           if (last < start->first - 1)
 *           {
 *               // Post is entirely visible (above start).
 *               R_StoreWallRange(first, last);
 *               return;
 *           }
 *           // There is a fragment above *start.
 *           R_StoreWallRange(first, start->first - 1);
 *       }
 *
 *       // Bottom contained in start?
 *       if (last <= start->last) return;
 *
 *       while (last >= (start+1)->first - 1)
 *       {
 *           R_StoreWallRange(start->last + 1, (start+1)->first - 1);
 *           start++;
 *           if (last <= start->last) return;
 *       }
 *
 *       R_StoreWallRange(start->last + 1, last);
 *   }
 *
 * Notes for parity:
 *   - Passable walls (two-sided linedefs without solid mid-textures) emit drawsegs
 *     for the visible fragments between existing solidsegs entries WITHOUT modifying
 *     the solidseg list (the clipping list is read-only here).
 *   - This is the key difference vs R_ClipSolidWallSegment (09-004): solid walls
 *     extend the clip list; pass walls do not.
 *   - Three cases:
 *     1. Entirely above the first overlapping solidseg -> store full range, return.
 *     2. Fragment above start (first < start->first) -> store [first, start->first-1].
 *     3. Walk forward through solidsegs storing inter-segment gaps until last is
 *        fully consumed.
 *   - The adjacency rule is identical to the solid path: `start->last < first - 1`
 *     means NOT touching (advance), so gap-of-0 and gap-of-1 (touching) skip.
 */

export type VanillaPassClipFragmentKind = 'fully-visible' | 'fragment-above-start' | 'inter-segment-gap' | 'fully-occluded';

export interface PassClipRange {
  readonly first: number;
  readonly last: number;
}

export function classifyVanillaPassClipFragment(input: { range: PassClipRange; firstOverlappingSolid: PassClipRange }): VanillaPassClipFragmentKind {
  const { range, firstOverlappingSolid } = input;
  if (range.last < firstOverlappingSolid.first - 1) {
    return 'fully-visible';
  }
  if (range.first < firstOverlappingSolid.first) {
    return 'fragment-above-start';
  }
  if (range.last <= firstOverlappingSolid.last) {
    return 'fully-occluded';
  }
  return 'inter-segment-gap';
}

export function vanillaPassClipFragmentRange(input: { range: PassClipRange; firstOverlappingSolid: PassClipRange }): PassClipRange | null {
  const kind = classifyVanillaPassClipFragment(input);
  if (kind === 'fully-visible') {
    return Object.freeze({ first: input.range.first, last: input.range.last });
  }
  if (kind === 'fragment-above-start') {
    return Object.freeze({ first: input.range.first, last: input.firstOverlappingSolid.first - 1 });
  }
  return null;
}

export function vanillaPassClipBottomIsContained(range: PassClipRange, solid: PassClipRange): boolean {
  return range.last <= solid.last;
}

export function vanillaPassClipGapBetween(left: PassClipRange, right: PassClipRange): PassClipRange | null {
  if (right.first - 1 < left.last + 1) {
    return null;
  }
  return Object.freeze({ first: left.last + 1, last: right.first - 1 });
}
