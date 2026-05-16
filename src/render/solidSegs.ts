/**
 * BSP solid-segment clip list — Chocolate Doom 2.2.1 r_bsp.c
 * `R_ClearClipSegs` / `R_ClipSolidWallSegment` / `R_ClipPassWallSegment`.
 *
 * As the BSP walker visits each seg front-to-back it produces a screen
 * column range `[first, last]`.  This module owns the `solidsegs[]`
 * occlusion list (kept sorted by `first`, non-overlapping, flanked by
 * the two `R_ClearClipSegs` sentinels) that decides which sub-ranges
 * of the seg are still visible and invokes the supplied
 * `R_StoreWallRange` callback (the I2 {@link storeWallRange}
 * coordinator) once per visible fragment:
 *
 * - {@link clipSolidWallSegment} (one-sided / solid two-sided): emits
 *   the visible fragments AND extends/merges the clip list so later
 *   segs behind it are occluded.
 * - {@link clipPassWallSegment} (passable two-sided): emits the
 *   visible fragments but leaves the clip list unchanged (read-only) —
 *   the one structural difference from the solid path.
 *
 * The verbatim r_bsp.c source is transcribed in
 * {@link ./implement-solid-segment-clipping.ts} and
 * {@link ./implement-two-sided-wall-clipping.ts}; pointer arithmetic
 * (`start`, `next`, `newend`) is modelled with array indices, and the
 * `cliprange_t` struct copies (`*next = *(next-1)`) are by-value to
 * match vanilla's struct-assignment semantics exactly.  Vanilla's
 * `RANGECHECK` bounds asserts compile out of the release build and are
 * not reintroduced — the two sentinels guarantee the scans terminate
 * for every valid `[first, last]` (`0 <= first <= last < viewWidth`).
 *
 * Pure: no Win32, framebuffer, drawseg-pool, or visplane side effects.
 * The only outward effect is the `store(first, last)` callback.
 */

import { CLIPRANGE_SENTINEL_FIRST_LOW, CLIPRANGE_SENTINEL_LAST_HIGH, CLIPRANGE_SENTINEL_LAST_LOW, type ClipRange, MAXSEGS } from './renderLimits.ts';

/**
 * The per-frame BSP clip state.  `solidsegs` is a fixed `MAXSEGS`-long
 * pool (vanilla `cliprange_t solidsegs[MAXSEGS]`); only `[0, newend)`
 * is live.  `newend` is the index one past the last used entry
 * (vanilla's `newend` pointer).
 */
export interface ClipState {
  readonly solidsegs: ClipRange[];
  newend: number;
}

/**
 * `R_StoreWallRange(first, last)` callback — invoked once per visible
 * screen-column fragment, in vanilla's exact order.
 */
export type StoreWallRangeFn = (first: number, last: number) => void;

/**
 * r_bsp.c `R_ClearClipSegs` — reset the clip list to the two flanking
 * sentinels for a viewport `viewWidth` columns wide:
 * `solidsegs[0] = {-0x7fffffff, -1}`, `solidsegs[1] = {viewWidth,
 * 0x7fffffff}`, `newend = solidsegs + 2`.
 */
export function clearClipSegs(viewWidth: number): ClipState {
  const solidsegs: ClipRange[] = new Array(MAXSEGS);
  for (let i = 0; i < MAXSEGS; i += 1) {
    solidsegs[i] = { first: 0, last: 0 };
  }
  solidsegs[0]!.first = CLIPRANGE_SENTINEL_FIRST_LOW;
  solidsegs[0]!.last = CLIPRANGE_SENTINEL_LAST_LOW;
  solidsegs[1]!.first = viewWidth;
  solidsegs[1]!.last = CLIPRANGE_SENTINEL_LAST_HIGH;
  return { solidsegs, newend: 2 };
}

/**
 * r_bsp.c `R_ClipSolidWallSegment` — clip `[first, last]` against the
 * solidsegs list, store every still-visible fragment via `store`, and
 * insert/crunch the range into the list so it occludes later segs.
 */
export function clipSolidWallSegment(state: ClipState, first: number, last: number, store: StoreWallRangeFn): void {
  const segs = state.solidsegs;

  // Find the first range that touches the range
  // (adjacent pixels are touching).
  let start = 0;
  while (segs[start]!.last < first - 1) {
    start += 1;
  }

  if (first < segs[start]!.first) {
    if (last < segs[start]!.first - 1) {
      // Post is entirely visible (above start), so insert a new clippost.
      store(first, last);
      let next = state.newend;
      state.newend += 1;
      while (next !== start) {
        segs[next]!.first = segs[next - 1]!.first;
        segs[next]!.last = segs[next - 1]!.last;
        next -= 1;
      }
      segs[next]!.first = first;
      segs[next]!.last = last;
      return;
    }
    // There is a fragment above *start.
    store(first, segs[start]!.first - 1);
    segs[start]!.first = first;
  }

  // Bottom contained in start?
  if (last <= segs[start]!.last) {
    return;
  }

  let next = start;
  while (last >= segs[next + 1]!.first - 1) {
    store(segs[next]!.last + 1, segs[next + 1]!.first - 1);
    next += 1;
    if (last <= segs[next]!.last) {
      segs[start]!.last = segs[next]!.last;
      crunch(state, start, next);
      return;
    }
  }

  store(segs[next]!.last + 1, last);
  segs[start]!.last = last;
  crunch(state, start, next);
}

/**
 * The `crunch:` tail of `R_ClipSolidWallSegment` — compact the list
 * when the new range subsumed one or more following ranges.
 */
function crunch(state: ClipState, start: number, next: number): void {
  const segs = state.solidsegs;
  if (next === start) {
    return;
  }
  // Upstream: `while (next++ != newend) *++start = *next;`
  for (;;) {
    const current = next;
    next += 1;
    if (current === state.newend) {
      break;
    }
    start += 1;
    segs[start]!.first = segs[next]!.first;
    segs[start]!.last = segs[next]!.last;
  }
  state.newend = start + 1;
}

/**
 * r_bsp.c `R_ClipPassWallSegment` — clip `[first, last]` against the
 * solidsegs list and store every still-visible fragment via `store`,
 * WITHOUT modifying the clip list (passable two-sided walls do not
 * occlude later segs).
 */
export function clipPassWallSegment(state: ClipState, first: number, last: number, store: StoreWallRangeFn): void {
  const segs = state.solidsegs;

  // Find the first range that touches the range.
  let start = 0;
  while (segs[start]!.last < first - 1) {
    start += 1;
  }

  if (first < segs[start]!.first) {
    if (last < segs[start]!.first - 1) {
      // Post is entirely visible (above start).
      store(first, last);
      return;
    }
    // There is a fragment above *start.
    store(first, segs[start]!.first - 1);
  }

  // Bottom contained in start?
  if (last <= segs[start]!.last) {
    return;
  }

  while (last >= segs[start + 1]!.first - 1) {
    store(segs[start]!.last + 1, segs[start + 1]!.first - 1);
    start += 1;
    if (last <= segs[start]!.last) {
      return;
    }
  }

  store(segs[start]!.last + 1, last);
}
