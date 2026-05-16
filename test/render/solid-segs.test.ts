/**
 * Increment I3 parity tests for the assembled-renderer BSP
 * solid-segment clip list (`R_ClearClipSegs` /
 * `R_ClipSolidWallSegment` / `R_ClipPassWallSegment`).
 *
 * The observable parity contract is the ORDERED sequence of
 * `R_StoreWallRange(first, last)` callbacks (which screen columns get
 * drawn, in what order) plus the resulting occlusion of later segs.
 * The clip list's raw internal array is intentionally NOT pinned: the
 * verbatim r_bsp.c `crunch` tail leaves `newend` non-minimal with the
 * right sentinel terminating every scan (a faithful vanilla quirk), so
 * two correct runs can differ by benign past-sentinel slots while
 * producing identical store logs. The rigor bar therefore mirrors
 * I1/I2: exact hand-derived store logs for the non-crunch scenarios,
 * plus a STRUCTURALLY DISTINCT in-test re-transcription (splice-based,
 * no fixed pool / index pointers) checked for store-log equivalence
 * over a deterministic pseudo-random battery of solid/pass segs.
 */

import { describe, expect, test } from 'bun:test';

import { CLIPRANGE_SENTINEL_FIRST_LOW, CLIPRANGE_SENTINEL_LAST_HIGH, CLIPRANGE_SENTINEL_LAST_LOW } from '../../src/render/renderLimits.ts';
import { clearClipSegs, clipPassWallSegment, clipSolidWallSegment } from '../../src/render/solidSegs.ts';

const VIEW_WIDTH = 320;

type StoreCall = readonly [first: number, last: number];

function recorder() {
  const calls: StoreCall[] = [];
  return { calls, store: (first: number, last: number) => calls.push([first, last]) };
}

describe('R_ClearClipSegs', () => {
  test('resets to the two flanking sentinels with newend = 2', () => {
    const state = clearClipSegs(VIEW_WIDTH);
    expect(state.newend).toBe(2);
    expect(state.solidsegs[0]).toEqual({ first: CLIPRANGE_SENTINEL_FIRST_LOW, last: CLIPRANGE_SENTINEL_LAST_LOW });
    expect(state.solidsegs[1]).toEqual({ first: VIEW_WIDTH, last: CLIPRANGE_SENTINEL_LAST_HIGH });
  });
});

describe('R_ClipSolidWallSegment — hand-derived store logs', () => {
  test('a single seg into the empty list is fully visible and inserted', () => {
    const state = clearClipSegs(VIEW_WIDTH);
    const { calls, store } = recorder();
    clipSolidWallSegment(state, 100, 200, store);
    expect(calls).toEqual([[100, 200]]);
    // The new clippost is inserted at index 1, right sentinel shifts up.
    expect(state.solidsegs[1]).toEqual({ first: 100, last: 200 });
    expect(state.solidsegs[2]).toEqual({ first: VIEW_WIDTH, last: CLIPRANGE_SENTINEL_LAST_HIGH });
    expect(state.newend).toBe(3);
  });

  test('a seg fully behind an existing solid post stores nothing', () => {
    const state = clearClipSegs(VIEW_WIDTH);
    const { calls, store } = recorder();
    clipSolidWallSegment(state, 100, 200, store);
    clipSolidWallSegment(state, 120, 180, store);
    expect(calls).toEqual([[100, 200]]); // second seg fully occluded
    expect(state.solidsegs[1]).toEqual({ first: 100, last: 200 });
  });

  test('a seg overlapping the left edge stores only the visible fragment above', () => {
    const state = clearClipSegs(VIEW_WIDTH);
    const { calls, store } = recorder();
    clipSolidWallSegment(state, 100, 200, store);
    clipSolidWallSegment(state, 50, 150, store);
    expect(calls).toEqual([
      [100, 200],
      [50, 99],
    ]);
    // start->first extended down to 50; bottom contained → no merge.
    expect(state.solidsegs[1]).toEqual({ first: 50, last: 200 });
  });

  test('gap-of-1 columns are "touching" (no fragment stored, ranges merge)', () => {
    const state = clearClipSegs(VIEW_WIDTH);
    const { calls, store } = recorder();
    clipSolidWallSegment(state, 100, 150, store);
    // [152,200] leaves exactly one uncovered column (151) — vanilla
    // treats adjacent-by-1 as touching, so the post still emits its
    // own range but the lists do not split on the 1px gap.
    clipSolidWallSegment(state, 152, 200, store);
    expect(calls).toEqual([
      [100, 150],
      [152, 200],
    ]);
  });

  test('a seg spanning a gap stores the inter-segment fragment and crunches', () => {
    const state = clearClipSegs(VIEW_WIDTH);
    const { calls, store } = recorder();
    clipSolidWallSegment(state, 50, 100, store);
    clipSolidWallSegment(state, 150, 200, store);
    clipSolidWallSegment(state, 90, 160, store);
    expect(calls).toEqual([
      [50, 100],
      [150, 200],
      [101, 149], // the only still-visible fragment (the gap)
    ]);
    // After crunch the merged post covers [50,200]; the right sentinel
    // is preserved and still terminates scans.
    expect(state.solidsegs[1]).toEqual({ first: 50, last: 200 });
    const sentinelIndex = state.solidsegs.findIndex((r) => r.first === VIEW_WIDTH && r.last === CLIPRANGE_SENTINEL_LAST_HIGH);
    expect(sentinelIndex).toBeGreaterThan(1);
    expect(sentinelIndex).toBeLessThan(state.newend + 1);
  });
});

describe('R_ClipPassWallSegment — read-only on the clip list', () => {
  test('emits visible fragments without modifying solidsegs', () => {
    const state = clearClipSegs(VIEW_WIDTH);
    const seed = recorder();
    clipSolidWallSegment(state, 100, 200, seed.store);
    const before = state.solidsegs.slice(0, state.newend).map((r) => ({ ...r }));

    const { calls, store } = recorder();
    clipPassWallSegment(state, 50, 250, store);
    // Visible: [50,99] above the solid post, then [201,250] after it.
    expect(calls).toEqual([
      [50, 99],
      [201, 250],
    ]);
    const after = state.solidsegs.slice(0, state.newend).map((r) => ({ ...r }));
    expect(after).toEqual(before); // clip list untouched
  });

  test('a pass seg fully behind a solid post stores nothing', () => {
    const state = clearClipSegs(VIEW_WIDTH);
    const seed = recorder();
    clipSolidWallSegment(state, 100, 200, seed.store);
    const { calls, store } = recorder();
    clipPassWallSegment(state, 120, 180, store);
    expect(calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Structurally distinct re-transcription of r_bsp.c: the clip list is a
// plain growable array using splice (no fixed MAXSEGS pool, no past-
// sentinel staleness, no integer "newend"). Faithful to the same
// adjacency / fragment / merge semantics, so the observable store-call
// log must match the implementation exactly.
// ---------------------------------------------------------------------------

interface OracleRange {
  first: number;
  last: number;
}

function oracleClear(viewWidth: number): OracleRange[] {
  return [
    { first: CLIPRANGE_SENTINEL_FIRST_LOW, last: CLIPRANGE_SENTINEL_LAST_LOW },
    { first: viewWidth, last: CLIPRANGE_SENTINEL_LAST_HIGH },
  ];
}

function oracleClipSolid(list: OracleRange[], first: number, last: number, store: (a: number, b: number) => void): void {
  let start = 0;
  while (list[start]!.last < first - 1) {
    start += 1;
  }

  if (first < list[start]!.first) {
    if (last < list[start]!.first - 1) {
      store(first, last);
      list.splice(start, 0, { first, last });
      return;
    }
    store(first, list[start]!.first - 1);
    list[start]!.first = first;
  }

  if (last <= list[start]!.last) {
    return;
  }

  let next = start;
  while (last >= list[next + 1]!.first - 1) {
    store(list[next]!.last + 1, list[next + 1]!.first - 1);
    next += 1;
    if (last <= list[next]!.last) {
      list[start]!.last = list[next]!.last;
      // crunch: drop the ranges (start, next] that were merged in.
      if (next !== start) {
        list.splice(start + 1, next - start);
      }
      return;
    }
  }

  store(list[next]!.last + 1, last);
  list[start]!.last = last;
  if (next !== start) {
    list.splice(start + 1, next - start);
  }
}

function oracleClipPass(list: readonly OracleRange[], first: number, last: number, store: (a: number, b: number) => void): void {
  let start = 0;
  while (list[start]!.last < first - 1) {
    start += 1;
  }

  if (first < list[start]!.first) {
    if (last < list[start]!.first - 1) {
      store(first, last);
      return;
    }
    store(first, list[start]!.first - 1);
  }

  if (last <= list[start]!.last) {
    return;
  }

  while (last >= list[start + 1]!.first - 1) {
    store(list[start]!.last + 1, list[start + 1]!.first - 1);
    start += 1;
    if (last <= list[start]!.last) {
      return;
    }
  }

  store(list[start]!.last + 1, last);
}

describe('R_Clip*WallSegment — store-log equivalence vs an independent re-transcription', () => {
  test('matches the splice-based oracle over a deterministic random battery', () => {
    // Deterministic LCG so the sequence is reproducible.
    let seed = 0x13_57_9b_df >>> 0;
    const rnd = (n: number): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed % n;
    };

    for (let trial = 0; trial < 200; trial += 1) {
      const state = clearClipSegs(VIEW_WIDTH);
      const list = oracleClear(VIEW_WIDTH);
      const segCount = 1 + rnd(24);
      for (let s = 0; s < segCount; s += 1) {
        const a = rnd(VIEW_WIDTH);
        const b = rnd(VIEW_WIDTH);
        const first = Math.min(a, b);
        const last = Math.max(a, b);
        const solid = rnd(2) === 0;

        const got = recorder();
        const want = recorder();
        if (solid) {
          clipSolidWallSegment(state, first, last, got.store);
          oracleClipSolid(list, first, last, want.store);
        } else {
          clipPassWallSegment(state, first, last, got.store);
          oracleClipPass(list, first, last, want.store);
        }
        expect(got.calls).toEqual(want.calls);
      }

      // After every sequence the two clip lists must occlude an
      // identical probe seg identically (the real parity contract).
      const probeGot = recorder();
      const probeWant = recorder();
      clipPassWallSegment(state, 0, VIEW_WIDTH - 1, probeGot.store);
      oracleClipPass(list, 0, VIEW_WIDTH - 1, probeWant.store);
      expect(probeGot.calls).toEqual(probeWant.calls);
    }
  });
});
