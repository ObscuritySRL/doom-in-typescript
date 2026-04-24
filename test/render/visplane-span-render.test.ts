import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import { ANGLETOFINESHIFT, FINEMASK, finecosine, finesine } from '../../src/core/trig.ts';
import { rDrawSpan } from '../../src/render/drawPrimitives.ts';
import { LIGHTZSHIFT, MAXLIGHTZ, SCREENHEIGHT, SCREENWIDTH } from '../../src/render/projection.ts';
import { VISPLANE_TOP_UNFILLED } from '../../src/render/renderLimits.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import { createPlaneSpanCache, makeSpans, mapPlaneSpan, renderVisplaneSpans } from '../../src/render/visplaneSpans.ts';
import type { CloseSpanCallback, PlaneSpanCache, VisplaneSpanContext } from '../../src/render/visplaneSpans.ts';

const IDENTITY_COLORMAP = Uint8Array.from({ length: 256 }, (_, i) => i);

interface SpanEvent {
  readonly y: number;
  readonly x1: number;
  readonly x2: number;
}

function makeSpanCollector(): { readonly events: SpanEvent[]; readonly callback: CloseSpanCallback } {
  const events: SpanEvent[] = [];
  const callback: CloseSpanCallback = (y, x1, x2) => {
    events.push({ y, x1, x2 });
  };
  return { events, callback };
}

function makeVisplane(overrides: Partial<Pick<Visplane, 'height' | 'picnum' | 'lightlevel' | 'minx' | 'maxx'>> = {}, screenWidth = 32): Visplane {
  return {
    height: 0,
    picnum: 0,
    lightlevel: 0,
    minx: 0,
    maxx: screenWidth - 1,
    top: new Uint8Array(screenWidth).fill(VISPLANE_TOP_UNFILLED),
    bottom: new Uint8Array(screenWidth),
    ...overrides,
  };
}

function paintColumn(plane: Visplane, x: number, top: number, bottom: number): void {
  plane.top[x] = top;
  plane.bottom[x] = bottom;
}

function makeContext(cache: PlaneSpanCache, overrides: Partial<VisplaneSpanContext> = {}, screenWidth = SCREENWIDTH, viewHeight = SCREENHEIGHT): VisplaneSpanContext {
  const planeZLight: readonly Uint8Array[] = Array.from({ length: MAXLIGHTZ }, () => IDENTITY_COLORMAP);
  return {
    planeHeight: FRACUNIT,
    planeZLight,
    fixedColormap: null,
    flatSource: new Uint8Array(4096),
    viewX: 0,
    viewY: 0,
    viewAngle: 0,
    baseXScale: 0,
    baseYScale: 0,
    ySlope: new Int32Array(viewHeight),
    distScale: new Int32Array(screenWidth),
    xToViewAngle: new Int32Array(screenWidth + 1),
    cachedHeight: cache.cachedHeight,
    cachedDistance: cache.cachedDistance,
    cachedXStep: cache.cachedXStep,
    cachedYStep: cache.cachedYStep,
    spanStart: cache.spanStart,
    framebuffer: new Uint8Array(screenWidth * viewHeight),
    screenWidth,
    ...overrides,
  };
}

describe('createPlaneSpanCache', () => {
  test('accepts a zero-row cache for degenerate view heights', () => {
    const cache = createPlaneSpanCache(0);
    expect(cache.spanStart.length).toBe(0);
    expect(cache.cachedHeight.length).toBe(0);
    expect(cache.cachedDistance.length).toBe(0);
    expect(cache.cachedXStep.length).toBe(0);
    expect(cache.cachedYStep.length).toBe(0);
  });

  test('allocates zero-filled Int32Arrays of the requested row count', () => {
    const cache = createPlaneSpanCache(168);
    expect(cache.spanStart).toBeInstanceOf(Int32Array);
    expect(cache.spanStart.length).toBe(168);
    expect(cache.cachedHeight.length).toBe(168);
    expect(cache.cachedDistance.length).toBe(168);
    expect(cache.cachedXStep.length).toBe(168);
    expect(cache.cachedYStep.length).toBe(168);
    for (let i = 0; i < 168; i += 1) {
      expect(cache.spanStart[i]).toBe(0);
      expect(cache.cachedHeight[i]).toBe(0);
      expect(cache.cachedDistance[i]).toBe(0);
      expect(cache.cachedXStep[i]).toBe(0);
      expect(cache.cachedYStep[i]).toBe(0);
    }
  });

  test('each cache has its own backing buffers (no aliasing)', () => {
    const a = createPlaneSpanCache(10);
    const b = createPlaneSpanCache(10);
    a.spanStart[0] = 42;
    expect(b.spanStart[0]).toBe(0);
  });

  test('rejects fractional, NaN, and negative row counts instead of letting TypedArray ToIndex coerce them', () => {
    expect(() => createPlaneSpanCache(-1)).toThrow(RangeError);
    expect(() => createPlaneSpanCache(-0.5)).toThrow(RangeError);
    expect(() => createPlaneSpanCache(1.5)).toThrow(RangeError);
    expect(() => createPlaneSpanCache(Number.NaN)).toThrow(RangeError);
  });
});

describe('makeSpans (R_MakeSpans column-diff walker)', () => {
  test('both untouched (t1=0xff, t2=0xff) is a complete no-op', () => {
    const spanstart = new Int32Array(200);
    const { events, callback } = makeSpanCollector();
    makeSpans(5, VISPLANE_TOP_UNFILLED, 0, VISPLANE_TOP_UNFILLED, 0, spanstart, callback);
    expect(events).toEqual([]);
  });

  test('left-boundary seed (t1=0xff) starts spans from current column', () => {
    const spanstart = new Int32Array(200);
    const { events, callback } = makeSpanCollector();
    makeSpans(10, VISPLANE_TOP_UNFILLED, 0, 40, 50, spanstart, callback);
    expect(events).toEqual([]);
    for (let y = 40; y <= 50; y += 1) {
      expect(spanstart[y]).toBe(10);
    }
    expect(spanstart[39]).toBe(0);
    expect(spanstart[51]).toBe(0);
  });

  test('right-boundary seal (t2=0xff) closes all spans from previous column', () => {
    const spanstart = new Int32Array(200);
    for (let y = 40; y <= 50; y += 1) {
      spanstart[y] = 10;
    }
    const { events, callback } = makeSpanCollector();
    makeSpans(20, 40, 50, VISPLANE_TOP_UNFILLED, 0, spanstart, callback);
    expect(events.length).toBe(11);
    for (let i = 0; i < 11; i += 1) {
      expect(events[i]!).toEqual({ y: 40 + i, x1: 10, x2: 19 });
    }
  });

  test('identical columns (same t, b) produce zero events and no spanstart writes', () => {
    const spanstart = new Int32Array(200);
    for (let y = 40; y <= 50; y += 1) {
      spanstart[y] = 10;
    }
    const { events, callback } = makeSpanCollector();
    makeSpans(12, 40, 50, 40, 50, spanstart, callback);
    expect(events).toEqual([]);
    for (let y = 40; y <= 50; y += 1) {
      expect(spanstart[y]).toBe(10);
    }
  });

  test('top grows taller (t2 < t1) starts new rows at top without closing anything', () => {
    const spanstart = new Int32Array(200);
    for (let y = 40; y <= 50; y += 1) {
      spanstart[y] = 5;
    }
    const { events, callback } = makeSpanCollector();
    makeSpans(8, 40, 50, 30, 50, spanstart, callback);
    expect(events).toEqual([]);
    for (let y = 30; y <= 39; y += 1) {
      expect(spanstart[y]).toBe(8);
    }
    for (let y = 40; y <= 50; y += 1) {
      expect(spanstart[y]).toBe(5);
    }
  });

  test('top shrinks (t1 < t2) closes rows at the top', () => {
    const spanstart = new Int32Array(200);
    for (let y = 30; y <= 50; y += 1) {
      spanstart[y] = 5;
    }
    const { events, callback } = makeSpanCollector();
    makeSpans(9, 30, 50, 35, 50, spanstart, callback);
    expect(events.length).toBe(5);
    for (let i = 0; i < 5; i += 1) {
      expect(events[i]!).toEqual({ y: 30 + i, x1: 5, x2: 8 });
    }
  });

  test('bottom shrinks (b1 > b2) closes rows at the bottom', () => {
    const spanstart = new Int32Array(200);
    for (let y = 40; y <= 50; y += 1) {
      spanstart[y] = 5;
    }
    const { events, callback } = makeSpanCollector();
    makeSpans(9, 40, 50, 40, 45, spanstart, callback);
    expect(events.length).toBe(5);
    expect(events[0]!).toEqual({ y: 50, x1: 5, x2: 8 });
    expect(events[1]!).toEqual({ y: 49, x1: 5, x2: 8 });
    expect(events[2]!).toEqual({ y: 48, x1: 5, x2: 8 });
    expect(events[3]!).toEqual({ y: 47, x1: 5, x2: 8 });
    expect(events[4]!).toEqual({ y: 46, x1: 5, x2: 8 });
  });

  test('bottom grows (b2 > b1) starts new rows at the bottom', () => {
    const spanstart = new Int32Array(200);
    for (let y = 40; y <= 45; y += 1) {
      spanstart[y] = 5;
    }
    const { events, callback } = makeSpanCollector();
    makeSpans(11, 40, 45, 40, 52, spanstart, callback);
    expect(events).toEqual([]);
    for (let y = 46; y <= 52; y += 1) {
      expect(spanstart[y]).toBe(11);
    }
    for (let y = 40; y <= 45; y += 1) {
      expect(spanstart[y]).toBe(5);
    }
  });

  test('span widens in both directions (t2<t1 && b2>b1) starts rows on both ends', () => {
    const spanstart = new Int32Array(200);
    for (let y = 40; y <= 50; y += 1) {
      spanstart[y] = 5;
    }
    const { events, callback } = makeSpanCollector();
    makeSpans(12, 40, 50, 30, 60, spanstart, callback);
    expect(events).toEqual([]);
    for (let y = 30; y <= 39; y += 1) {
      expect(spanstart[y]).toBe(12);
    }
    for (let y = 40; y <= 50; y += 1) {
      expect(spanstart[y]).toBe(5);
    }
    for (let y = 51; y <= 60; y += 1) {
      expect(spanstart[y]).toBe(12);
    }
  });

  test('span narrows in both directions (t1<t2 && b1>b2) closes rows on both ends', () => {
    const spanstart = new Int32Array(200);
    for (let y = 30; y <= 60; y += 1) {
      spanstart[y] = 5;
    }
    const { events, callback } = makeSpanCollector();
    makeSpans(15, 30, 60, 40, 50, spanstart, callback);
    expect(events.length).toBe(20);
    for (let i = 0; i < 10; i += 1) {
      expect(events[i]!).toEqual({ y: 30 + i, x1: 5, x2: 14 });
    }
    for (let i = 0; i < 10; i += 1) {
      expect(events[10 + i]!).toEqual({ y: 60 - i, x1: 5, x2: 14 });
    }
  });

  test('disjoint previous-vs-current (no row overlap) closes all prev and starts all cur', () => {
    const spanstart = new Int32Array(200);
    for (let y = 20; y <= 25; y += 1) {
      spanstart[y] = 3;
    }
    const { events, callback } = makeSpanCollector();
    makeSpans(7, 20, 25, 60, 70, spanstart, callback);
    expect(events.length).toBe(6);
    for (let i = 0; i < 6; i += 1) {
      expect(events[i]!).toEqual({ y: 20 + i, x1: 3, x2: 6 });
    }
    for (let y = 60; y <= 70; y += 1) {
      expect(spanstart[y]).toBe(7);
    }
  });

  test('does not mutate caller t1/b1/t2/b2 (uses local copies)', () => {
    const spanstart = new Int32Array(200);
    const { callback } = makeSpanCollector();
    const t1 = 40;
    const b1 = 50;
    const t2 = 30;
    const b2 = 60;
    makeSpans(10, t1, b1, t2, b2, spanstart, callback);
    expect(t1).toBe(40);
    expect(b1).toBe(50);
    expect(t2).toBe(30);
    expect(b2).toBe(60);
  });

  test('single-row span (t1 === b1 === t2 === b2) is a no-op', () => {
    const spanstart = new Int32Array(200);
    spanstart[42] = 5;
    const { events, callback } = makeSpanCollector();
    makeSpans(10, 42, 42, 42, 42, spanstart, callback);
    expect(events).toEqual([]);
    expect(spanstart[42]).toBe(5);
  });

  test('closeSpan x2 is x-1 (previous column, not current)', () => {
    const spanstart = new Int32Array(200);
    spanstart[50] = 20;
    const { events, callback } = makeSpanCollector();
    makeSpans(35, 50, 50, VISPLANE_TOP_UNFILLED, 0, spanstart, callback);
    expect(events.length).toBe(1);
    expect(events[0]!).toEqual({ y: 50, x1: 20, x2: 34 });
  });
});

describe('mapPlaneSpan (R_MapPlane cache + span emission)', () => {
  test('cache miss populates cachedHeight/Distance/XStep/YStep', () => {
    const cache = createPlaneSpanCache(200);
    const ySlope = new Int32Array(200);
    ySlope[100] = FRACUNIT * 2;
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT * 3,
      ySlope,
      baseXScale: FRACUNIT,
      baseYScale: FRACUNIT * -1,
    });
    expect(cache.cachedHeight[100]).toBe(0);
    mapPlaneSpan(100, 0, 0, ctx);
    expect(cache.cachedHeight[100]).toBe(FRACUNIT * 3);
    expect(cache.cachedDistance[100]).toBe(fixedMul(FRACUNIT * 3, FRACUNIT * 2));
    expect(cache.cachedXStep[100]).toBe(fixedMul(cache.cachedDistance[100]!, FRACUNIT));
    expect(cache.cachedYStep[100]).toBe(fixedMul(cache.cachedDistance[100]!, FRACUNIT * -1));
  });

  test('cache hit reuses cached values without recomputation', () => {
    const cache = createPlaneSpanCache(200);
    cache.cachedHeight[50] = FRACUNIT * 5;
    cache.cachedDistance[50] = 0xdead;
    cache.cachedXStep[50] = 0xbeef;
    cache.cachedYStep[50] = 0xcafe;
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT * 5,
    });
    mapPlaneSpan(50, 0, 0, ctx);
    expect(cache.cachedHeight[50]).toBe(FRACUNIT * 5);
    expect(cache.cachedDistance[50]).toBe(0xdead);
    expect(cache.cachedXStep[50]).toBe(0xbeef);
    expect(cache.cachedYStep[50]).toBe(0xcafe);
  });

  test('cache invalidates and overwrites when planeHeight differs', () => {
    const cache = createPlaneSpanCache(200);
    cache.cachedHeight[75] = FRACUNIT * 2;
    cache.cachedDistance[75] = 0xdead;
    const ySlope = new Int32Array(200);
    ySlope[75] = FRACUNIT;
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT * 7,
      ySlope,
      baseXScale: FRACUNIT,
      baseYScale: FRACUNIT,
    });
    mapPlaneSpan(75, 0, 0, ctx);
    expect(cache.cachedHeight[75]).toBe(FRACUNIT * 7);
    expect(cache.cachedDistance[75]).toBe(fixedMul(FRACUNIT * 7, FRACUNIT));
  });

  test('writes flat-source[0] (masked through colormap) into framebuffer at (y, x1..x2)', () => {
    const cache = createPlaneSpanCache(200);
    const flatSource = new Uint8Array(4096).fill(0x42);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource,
    });
    mapPlaneSpan(50, 10, 15, ctx);
    for (let x = 10; x <= 15; x += 1) {
      expect(ctx.framebuffer[50 * SCREENWIDTH + x]).toBe(0x42);
    }
    expect(ctx.framebuffer[50 * SCREENWIDTH + 9]).toBe(0);
    expect(ctx.framebuffer[50 * SCREENWIDTH + 16]).toBe(0);
  });

  test('fixedColormap override bypasses planeZLight distance bucket', () => {
    const cache = createPlaneSpanCache(200);
    const fixed = Uint8Array.from({ length: 256 }, () => 0x77);
    const distanceSignal = Uint8Array.from({ length: 256 }, () => 0x33);
    const planeZLight: readonly Uint8Array[] = Array.from({ length: MAXLIGHTZ }, () => distanceSignal);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT * 8,
      fixedColormap: fixed,
      planeZLight,
      flatSource: new Uint8Array(4096).fill(0),
    });
    mapPlaneSpan(10, 5, 9, ctx);
    for (let x = 5; x <= 9; x += 1) {
      expect(ctx.framebuffer[10 * SCREENWIDTH + x]).toBe(0x77);
    }
  });

  test('uses planeZLight[distance >> LIGHTZSHIFT] when fixedColormap is null', () => {
    const cache = createPlaneSpanCache(200);
    const ySlope = new Int32Array(200);
    ySlope[30] = FRACUNIT * 4;
    const planeHeight = FRACUNIT * 4;
    const expectedDistance = fixedMul(planeHeight, FRACUNIT * 4);
    const expectedBucket = expectedDistance >> LIGHTZSHIFT;
    const perBucketSignal: Uint8Array[] = [];
    for (let i = 0; i < MAXLIGHTZ; i += 1) {
      perBucketSignal.push(Uint8Array.from({ length: 256 }, () => i & 0xff));
    }
    const ctx = makeContext(cache, {
      planeHeight,
      ySlope,
      planeZLight: perBucketSignal,
      flatSource: new Uint8Array(4096).fill(0),
      baseXScale: 0,
      baseYScale: 0,
    });
    mapPlaneSpan(30, 0, 0, ctx);
    expect(ctx.framebuffer[30 * SCREENWIDTH + 0]).toBe(expectedBucket & 0xff);
  });

  test('clamps distance bucket to MAXLIGHTZ-1 when raw bucket is large', () => {
    const cache = createPlaneSpanCache(200);
    const ySlope = new Int32Array(200);
    ySlope[12] = FRACUNIT * 4;
    const perBucketSignal: Uint8Array[] = [];
    for (let i = 0; i < MAXLIGHTZ; i += 1) {
      perBucketSignal.push(Uint8Array.from({ length: 256 }, () => (i === MAXLIGHTZ - 1 ? 0x9a : 0x11)));
    }
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT * 1000,
      ySlope,
      planeZLight: perBucketSignal,
      flatSource: new Uint8Array(4096).fill(0),
    });
    mapPlaneSpan(12, 0, 0, ctx);
    expect(ctx.framebuffer[12 * SCREENWIDTH + 0]).toBe(0x9a);
  });

  test('xFrac/yFrac encode viewX + cos(angle)*length and -viewY - sin(angle)*length', () => {
    const cache = createPlaneSpanCache(200);
    const ySlope = new Int32Array(200);
    ySlope[25] = FRACUNIT;
    const distScale = new Int32Array(SCREENWIDTH).fill(FRACUNIT);
    const xToViewAngle = new Int32Array(SCREENWIDTH + 1);
    const viewX = 123 << FRACBITS;
    const viewY = 456 << FRACBITS;
    const viewAngle = 0;
    const flatSource = new Uint8Array(4096);
    for (let i = 0; i < flatSource.length; i += 1) {
      flatSource[i] = (i * 7 + 1) & 0xff;
    }
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT * 2,
      flatSource,
      viewX,
      viewY,
      viewAngle,
      ySlope,
      distScale,
      xToViewAngle,
    });
    mapPlaneSpan(25, 40, 40, ctx);
    const expectedDistance = fixedMul(FRACUNIT * 2, FRACUNIT);
    const expectedLength = fixedMul(expectedDistance, FRACUNIT);
    const angleIndex = ((viewAngle + 0) >>> ANGLETOFINESHIFT) & FINEMASK;
    const expectedXFrac = (viewX + fixedMul(finecosine[angleIndex]!, expectedLength)) | 0;
    const expectedYFrac = (-viewY - fixedMul(finesine[angleIndex]!, expectedLength)) | 0;
    const expectedSpot = ((expectedYFrac >> 10) & 4032) + ((expectedXFrac >> FRACBITS) & 63);
    expect(ctx.framebuffer[25 * SCREENWIDTH + 40]).toBe(flatSource[expectedSpot]!);
  });

  test('xToViewAngle offsets the per-column angle lookup', () => {
    const cache = createPlaneSpanCache(200);
    const ySlope = new Int32Array(200);
    ySlope[30] = FRACUNIT;
    const distScale = new Int32Array(SCREENWIDTH).fill(FRACUNIT);
    const xToViewAngle = new Int32Array(SCREENWIDTH + 1);
    xToViewAngle[50] = 0x10000000;
    const flatSource = new Uint8Array(4096);
    for (let i = 0; i < flatSource.length; i += 1) {
      flatSource[i] = i & 0xff;
    }
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource,
      ySlope,
      distScale,
      xToViewAngle,
    });
    mapPlaneSpan(30, 50, 50, ctx);
    const distance = fixedMul(FRACUNIT, FRACUNIT);
    const length = fixedMul(distance, FRACUNIT);
    const angleIndex = ((0 + 0x10000000) >>> ANGLETOFINESHIFT) & FINEMASK;
    const xFrac = fixedMul(finecosine[angleIndex]!, length) | 0;
    const yFrac = -fixedMul(finesine[angleIndex]!, length) | 0;
    const spot = ((yFrac >> 10) & 4032) + ((xFrac >> FRACBITS) & 63);
    expect(ctx.framebuffer[30 * SCREENWIDTH + 50]).toBe(flatSource[spot]!);
  });

  test('invokes rDrawSpan-equivalent write count (x2 - x1 + 1 pixels)', () => {
    const cache = createPlaneSpanCache(200);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0xaa),
    });
    mapPlaneSpan(0, 100, 119, ctx);
    for (let x = 100; x <= 119; x += 1) {
      expect(ctx.framebuffer[x]).toBe(0xaa);
    }
    expect(ctx.framebuffer[99]).toBe(0);
    expect(ctx.framebuffer[120]).toBe(0);
  });

  test('respects context screenWidth override for framebuffer stride', () => {
    const cache = createPlaneSpanCache(200);
    const ctx = makeContext(
      cache,
      {
        planeHeight: FRACUNIT,
        flatSource: new Uint8Array(4096).fill(0x55),
        framebuffer: new Uint8Array(64 * 200),
      },
      64,
    );
    mapPlaneSpan(10, 5, 7, ctx);
    expect(ctx.framebuffer[10 * 64 + 5]).toBe(0x55);
    expect(ctx.framebuffer[10 * 64 + 6]).toBe(0x55);
    expect(ctx.framebuffer[10 * 64 + 7]).toBe(0x55);
  });
});

describe('renderVisplaneSpans (R_DrawPlanes non-sky branch)', () => {
  test('empty plane (minx > maxx) is a complete no-op (no framebuffer writes)', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ctx = makeContext(cache);
    const plane = makeVisplane({ minx: SCREENWIDTH, maxx: -1 });
    const before = new Uint8Array(ctx.framebuffer);
    renderVisplaneSpans(plane, ctx);
    expect(ctx.framebuffer).toEqual(before);
  });

  test('single uniform column (minx === maxx with one top/bottom pair) emits a 1×N span', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0x3c),
    });
    const plane = makeVisplane({ minx: 40, maxx: 40 }, SCREENWIDTH);
    paintColumn(plane, 40, 20, 22);
    renderVisplaneSpans(plane, ctx);
    for (let y = 20; y <= 22; y += 1) {
      expect(ctx.framebuffer[y * SCREENWIDTH + 40]).toBe(0x3c);
      expect(ctx.framebuffer[y * SCREENWIDTH + 39]).toBe(0);
      expect(ctx.framebuffer[y * SCREENWIDTH + 41]).toBe(0);
    }
  });

  test('uniform rectangular plane (all columns identical) emits one span per row spanning the full width', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0x5a),
    });
    const plane = makeVisplane({ minx: 10, maxx: 25 }, SCREENWIDTH);
    for (let x = 10; x <= 25; x += 1) {
      paintColumn(plane, x, 30, 32);
    }
    renderVisplaneSpans(plane, ctx);
    for (let y = 30; y <= 32; y += 1) {
      for (let x = 10; x <= 25; x += 1) {
        expect(ctx.framebuffer[y * SCREENWIDTH + x]).toBe(0x5a);
      }
      expect(ctx.framebuffer[y * SCREENWIDTH + 9]).toBe(0);
      expect(ctx.framebuffer[y * SCREENWIDTH + 26]).toBe(0);
    }
  });

  test('staircase top rows (t2 varies per column) closes spans on the tall side at each transition', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0x80),
    });
    const plane = makeVisplane({ minx: 10, maxx: 19 }, SCREENWIDTH);
    for (let x = 10; x <= 14; x += 1) {
      paintColumn(plane, x, 30, 50);
    }
    for (let x = 15; x <= 19; x += 1) {
      paintColumn(plane, x, 40, 50);
    }
    renderVisplaneSpans(plane, ctx);
    for (let y = 30; y <= 39; y += 1) {
      for (let x = 10; x <= 14; x += 1) {
        expect(ctx.framebuffer[y * SCREENWIDTH + x]).toBe(0x80);
      }
      for (let x = 15; x <= 19; x += 1) {
        expect(ctx.framebuffer[y * SCREENWIDTH + x]).toBe(0);
      }
    }
    for (let y = 40; y <= 50; y += 1) {
      for (let x = 10; x <= 19; x += 1) {
        expect(ctx.framebuffer[y * SCREENWIDTH + x]).toBe(0x80);
      }
    }
  });

  test('column with top[x]=0xff within [minx,maxx] is skipped (treated as untouched)', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0x20),
    });
    const plane = makeVisplane({ minx: 5, maxx: 12 }, SCREENWIDTH);
    for (let x = 5; x <= 7; x += 1) {
      paintColumn(plane, x, 60, 65);
    }
    for (let x = 10; x <= 12; x += 1) {
      paintColumn(plane, x, 60, 65);
    }
    renderVisplaneSpans(plane, ctx);
    for (let y = 60; y <= 65; y += 1) {
      for (let x = 5; x <= 7; x += 1) {
        expect(ctx.framebuffer[y * SCREENWIDTH + x]).toBe(0x20);
      }
      for (let x = 8; x <= 9; x += 1) {
        expect(ctx.framebuffer[y * SCREENWIDTH + x]).toBe(0);
      }
      for (let x = 10; x <= 12; x += 1) {
        expect(ctx.framebuffer[y * SCREENWIDTH + x]).toBe(0x20);
      }
    }
  });

  test('cache persists across multiple renderVisplaneSpans calls with same height (reused per y)', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ySlope = new Int32Array(SCREENHEIGHT);
    ySlope[50] = FRACUNIT;
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT * 3,
      ySlope,
      baseXScale: FRACUNIT,
      baseYScale: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0),
    });
    const planeA = makeVisplane({ minx: 0, maxx: 1 }, SCREENWIDTH);
    paintColumn(planeA, 0, 50, 50);
    paintColumn(planeA, 1, 50, 50);
    renderVisplaneSpans(planeA, ctx);
    const expectedDistance = fixedMul(FRACUNIT * 3, FRACUNIT);
    expect(cache.cachedHeight[50]).toBe(FRACUNIT * 3);
    expect(cache.cachedDistance[50]).toBe(expectedDistance);
    cache.cachedDistance[50] = 0xbeef;
    const planeB = makeVisplane({ minx: 2, maxx: 3 }, SCREENWIDTH);
    paintColumn(planeB, 2, 50, 50);
    paintColumn(planeB, 3, 50, 50);
    renderVisplaneSpans(planeB, ctx);
    expect(cache.cachedDistance[50]).toBe(0xbeef);
  });

  test('different planeHeight invalidates and rewrites cache line for touched rows', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ySlope = new Int32Array(SCREENHEIGHT);
    ySlope[80] = FRACUNIT;
    const baseCtx = {
      ySlope,
      baseXScale: FRACUNIT,
      baseYScale: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0),
    };
    const ctxA = makeContext(cache, { planeHeight: FRACUNIT * 2, ...baseCtx });
    const planeA = makeVisplane({ minx: 5, maxx: 5 }, SCREENWIDTH);
    paintColumn(planeA, 5, 80, 80);
    renderVisplaneSpans(planeA, ctxA);
    expect(cache.cachedHeight[80]).toBe(FRACUNIT * 2);
    const ctxB = makeContext(cache, { planeHeight: FRACUNIT * 9, ...baseCtx });
    const planeB = makeVisplane({ minx: 7, maxx: 7 }, SCREENWIDTH);
    paintColumn(planeB, 7, 80, 80);
    renderVisplaneSpans(planeB, ctxB);
    expect(cache.cachedHeight[80]).toBe(FRACUNIT * 9);
    expect(cache.cachedDistance[80]).toBe(fixedMul(FRACUNIT * 9, FRACUNIT));
  });

  test('boundary synthesis: single column at minx=0 does not fail with out-of-bounds reads', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0x11),
    });
    const plane = makeVisplane({ minx: 0, maxx: 0 }, SCREENWIDTH);
    paintColumn(plane, 0, 100, 100);
    expect(() => renderVisplaneSpans(plane, ctx)).not.toThrow();
    expect(ctx.framebuffer[100 * SCREENWIDTH + 0]).toBe(0x11);
  });

  test('boundary synthesis: single column at maxx=screenWidth-1 does not fail', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0x22),
    });
    const plane = makeVisplane({ minx: SCREENWIDTH - 1, maxx: SCREENWIDTH - 1 }, SCREENWIDTH);
    paintColumn(plane, SCREENWIDTH - 1, 50, 50);
    expect(() => renderVisplaneSpans(plane, ctx)).not.toThrow();
    expect(ctx.framebuffer[50 * SCREENWIDTH + (SCREENWIDTH - 1)]).toBe(0x22);
  });

  test('does not mutate plane.top/bottom arrays (sentinel synthesis is local)', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource: new Uint8Array(4096),
    });
    const plane = makeVisplane({ minx: 5, maxx: 10 }, SCREENWIDTH);
    for (let x = 5; x <= 10; x += 1) {
      paintColumn(plane, x, 40, 45);
    }
    const topBefore = new Uint8Array(plane.top);
    const bottomBefore = new Uint8Array(plane.bottom);
    renderVisplaneSpans(plane, ctx);
    expect(plane.top).toEqual(topBefore);
    expect(plane.bottom).toEqual(bottomBefore);
  });

  test('V-shaped plane (symmetric top dip) produces symmetric row fills', () => {
    const cache = createPlaneSpanCache(SCREENHEIGHT);
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT,
      flatSource: new Uint8Array(4096).fill(0xee),
    });
    const plane = makeVisplane({ minx: 10, maxx: 15 }, SCREENWIDTH);
    paintColumn(plane, 10, 30, 60);
    paintColumn(plane, 11, 35, 60);
    paintColumn(plane, 12, 40, 60);
    paintColumn(plane, 13, 40, 60);
    paintColumn(plane, 14, 35, 60);
    paintColumn(plane, 15, 30, 60);
    renderVisplaneSpans(plane, ctx);
    for (let y = 30; y <= 34; y += 1) {
      expect(ctx.framebuffer[y * SCREENWIDTH + 10]).toBe(0xee);
      expect(ctx.framebuffer[y * SCREENWIDTH + 15]).toBe(0xee);
      expect(ctx.framebuffer[y * SCREENWIDTH + 11]).toBe(0);
      expect(ctx.framebuffer[y * SCREENWIDTH + 14]).toBe(0);
    }
    for (let y = 40; y <= 60; y += 1) {
      for (let x = 10; x <= 15; x += 1) {
        expect(ctx.framebuffer[y * SCREENWIDTH + x]).toBe(0xee);
      }
    }
  });
});

describe('VisplaneSpanContext typing + SCREENWIDTH defaults', () => {
  test('omitting screenWidth defaults to SCREENWIDTH (320) in mapPlaneSpan', () => {
    const cache = createPlaneSpanCache(200);
    const ctx: VisplaneSpanContext = {
      planeHeight: FRACUNIT,
      planeZLight: Array.from({ length: MAXLIGHTZ }, () => IDENTITY_COLORMAP),
      fixedColormap: null,
      flatSource: new Uint8Array(4096).fill(0x7f),
      viewX: 0,
      viewY: 0,
      viewAngle: 0,
      baseXScale: 0,
      baseYScale: 0,
      ySlope: new Int32Array(200),
      distScale: new Int32Array(SCREENWIDTH),
      xToViewAngle: new Int32Array(SCREENWIDTH + 1),
      cachedHeight: cache.cachedHeight,
      cachedDistance: cache.cachedDistance,
      cachedXStep: cache.cachedXStep,
      cachedYStep: cache.cachedYStep,
      spanStart: cache.spanStart,
      framebuffer: new Uint8Array(SCREENWIDTH * SCREENHEIGHT),
    };
    mapPlaneSpan(7, 20, 25, ctx);
    for (let x = 20; x <= 25; x += 1) {
      expect(ctx.framebuffer[7 * SCREENWIDTH + x]).toBe(0x7f);
    }
  });

  test('module re-exports VISPLANE_TOP_UNFILLED = 0xff', async () => {
    const mod = await import('../../src/render/visplaneSpans.ts');
    expect(mod.VISPLANE_TOP_UNFILLED).toBe(0xff);
  });

  test('rDrawSpan-equivalence: mapPlaneSpan produces identical framebuffer output to direct rDrawSpan with same inputs', () => {
    const cache = createPlaneSpanCache(200);
    const ySlope = new Int32Array(200);
    ySlope[20] = FRACUNIT * 2;
    const distScale = new Int32Array(SCREENWIDTH).fill(FRACUNIT);
    const flatSource = new Uint8Array(4096);
    for (let i = 0; i < flatSource.length; i += 1) {
      flatSource[i] = (i + 3) & 0xff;
    }
    const ctx = makeContext(cache, {
      planeHeight: FRACUNIT * 3,
      flatSource,
      ySlope,
      distScale,
      baseXScale: FRACUNIT,
      baseYScale: FRACUNIT * -1,
    });
    mapPlaneSpan(20, 30, 35, ctx);

    const directFb = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    const expectedDistance = fixedMul(FRACUNIT * 3, FRACUNIT * 2);
    const expectedXStep = fixedMul(expectedDistance, FRACUNIT);
    const expectedYStep = fixedMul(expectedDistance, FRACUNIT * -1);
    const length = fixedMul(expectedDistance, FRACUNIT);
    const angleIndex = (0 >>> ANGLETOFINESHIFT) & FINEMASK;
    const xFrac = (0 + fixedMul(finecosine[angleIndex]!, length)) | 0;
    const yFrac = (-0 - fixedMul(finesine[angleIndex]!, length)) | 0;
    rDrawSpan(
      {
        x1: 30,
        x2: 35,
        y: 20,
        xFrac,
        yFrac,
        xStep: expectedXStep,
        yStep: expectedYStep,
        source: flatSource,
        colormap: IDENTITY_COLORMAP,
      },
      directFb,
      SCREENWIDTH,
    );
    for (let x = 30; x <= 35; x += 1) {
      expect(ctx.framebuffer[20 * SCREENWIDTH + x]).toBe(directFb[20 * SCREENWIDTH + x]!);
    }
  });
});
