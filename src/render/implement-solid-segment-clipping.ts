/**
 * Vanilla DOOM 1.9 solid-segment clipping contract.
 *
 * From Chocolate Doom 2.2.1 r_bsp.c R_ClipSolidWallSegment and r_main.c viewangletox:
 *
 *   void R_ClipSolidWallSegment(int first, int last)
 *   {
 *       cliprange_t  *next, *start;
 *
 *       // Find the first range that touches the range
 *       // (adjacent pixels are touching).
 *       start = solidsegs;
 *       while (start->last < first - 1)
 *           start++;
 *
 *       if (first < start->first)
 *       {
 *           if (last < start->first - 1)
 *           {
 *               // Post is entirely visible (above start), so insert a new clippost.
 *               R_StoreWallRange(first, last);
 *               next = newend;
 *               newend++;
 *               while (next != start)
 *               {
 *                   *next = *(next - 1);
 *                   next--;
 *               }
 *               next->first = first;
 *               next->last = last;
 *               return;
 *           }
 *           // There is a fragment above *start.
 *           R_StoreWallRange(first, start->first - 1);
 *           start->first = first;
 *       }
 *
 *       // Bottom contained in start?
 *       if (last <= start->last) return;
 *
 *       next = start;
 *       while (last >= (next+1)->first - 1)
 *       {
 *           R_StoreWallRange(next->last + 1, (next+1)->first - 1);
 *           next++;
 *           if (last <= next->last)
 *           {
 *               start->last = next->last;
 *               goto crunch;
 *           }
 *       }
 *
 *       R_StoreWallRange(next->last + 1, last);
 *       start->last = last;
 *
 *   crunch:
 *       if (next == start) return;
 *       while (next++ != newend)
 *           *++start = *next;
 *       newend = start + 1;
 *   }
 *
 * Notes for parity:
 *   - Solid segments are stored in `solidsegs[]` with sentinel entries at both ends
 *     (initial state: solidsegs[0] = { -0x7fffffff, -1 }, solidsegs[1] = { viewwidth, 0x7fffffff }).
 *   - The clip list is kept sorted by `first` and ranges are non-overlapping.
 *   - "Adjacent pixels are touching" means a gap of exactly 1 pixel is treated as
 *     touching (the condition is `start->last < first - 1`).
 *   - Storing a wall range writes to the drawsegs ring buffer; the count limit is
 *     MAXDRAWSEGS (256 in vanilla).
 *   - When inserting, the array is shifted by one position from the insertion point.
 *   - The "crunch" step compacts the list when adjacent ranges merge.
 */

export const VANILLA_SOLIDSEGS_SENTINEL_LEFT_FIRST = -0x7fffffff;
export const VANILLA_SOLIDSEGS_SENTINEL_LEFT_LAST = -1;
export const VANILLA_SOLIDSEGS_SENTINEL_RIGHT_LAST = 0x7fffffff;
export const VANILLA_MAXDRAWSEGS = 256;

export interface SolidSegRange {
  readonly first: number;
  readonly last: number;
}

export function vanillaSolidSegRangeIsTouching(rangeA: SolidSegRange, rangeBFirst: number): boolean {
  // Upstream condition: start->last < first - 1 means "NOT touching, advance".
  // So touching = !(rangeA.last < rangeBFirst - 1) = rangeA.last >= rangeBFirst - 1.
  return rangeA.last >= rangeBFirst - 1;
}

export function vanillaSolidSegRangeContains(parent: SolidSegRange, child: SolidSegRange): boolean {
  return child.first >= parent.first && child.last <= parent.last;
}

export interface SolidSegInitialSentinelsResult {
  readonly leftSentinel: SolidSegRange;
  readonly rightSentinel: SolidSegRange;
}

export function getVanillaSolidSegInitialSentinels(viewwidth: number): SolidSegInitialSentinelsResult {
  return Object.freeze({
    leftSentinel: Object.freeze({ first: VANILLA_SOLIDSEGS_SENTINEL_LEFT_FIRST, last: VANILLA_SOLIDSEGS_SENTINEL_LEFT_LAST }),
    rightSentinel: Object.freeze({ first: viewwidth, last: VANILLA_SOLIDSEGS_SENTINEL_RIGHT_LAST }),
  });
}
