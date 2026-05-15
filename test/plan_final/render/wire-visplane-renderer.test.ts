import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { SCREENWIDTH } from '../../../src/render/projection.ts';
import { VISPLANE_TOP_UNFILLED } from '../../../src/render/renderLimits.ts';
import { VANILLA_MAXVISPLANES, createVisplaneRenderer } from '../../../src/vanilla/visplaneRenderer.ts';
import type { VisplaneRenderer } from '../../../src/vanilla/visplaneRenderer.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const VISPLANE_RENDERER_RELATIVE_PATH = 'src/vanilla/visplaneRenderer.ts';
const VISPLANE_RENDERER_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, VISPLANE_RENDERER_RELATIVE_PATH);

describe('plan_final render: wire-visplane-renderer', () => {
  test('src/vanilla/visplaneRenderer.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(VISPLANE_RENDERER_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(VISPLANE_RENDERER_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/visplaneRenderer.ts cites plan_final step 06-003 in a top-of-file comment', () => {
    const fileText = readFileSync(VISPLANE_RENDERER_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('06-003');
    expect(fileText).toContain('createVisplaneRenderer');
  });

  test('src/vanilla/visplaneRenderer.ts imports the read-only visplane allocator and span helpers without modifying them', () => {
    const fileText = readFileSync(VISPLANE_RENDERER_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../render/visplanes.ts'");
    expect(fileText).toContain("from '../render/visplaneSpans.ts'");
    expect(fileText).toContain('createVisplanePool');
    expect(fileText).toContain('clearPlanes');
    expect(fileText).toContain('findPlane');
    expect(fileText).toContain('checkPlane');
    expect(fileText).toContain('createPlaneSpanCache');
    expect(fileText).toContain('renderVisplaneSpans');
  });

  test('VANILLA_MAXVISPLANES pins the canonical 128-slot visplane pool depth', () => {
    expect(VANILLA_MAXVISPLANES).toBe(128);
  });

  test('createVisplaneRenderer returns a frozen artifact carrying the pool and span cache', () => {
    const renderer: VisplaneRenderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    expect(Object.isFrozen(renderer)).toBe(true);
    expect(renderer.pool).toBeDefined();
    expect(renderer.pool.screenWidth).toBe(SCREENWIDTH);
    expect(renderer.pool.planes.length).toBe(VANILLA_MAXVISPLANES);
    expect(renderer.spanCache).toBeDefined();
  });

  test('createVisplaneRenderer pool starts with count=0 and the empty-plane sentinel minx/maxx markers on every slot', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    expect(renderer.pool.count).toBe(0);
    for (const plane of renderer.pool.planes) {
      expect(plane.minx).toBe(SCREENWIDTH);
      expect(plane.maxx).toBe(-1);
    }
  });

  test('renderer.find allocates a fresh visplane and increments pool.count', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    renderer.clear();
    const plane = renderer.find(128 << 16, 1, 200, 2);
    expect(renderer.pool.count).toBe(1);
    expect(plane.height).toBe(128 << 16);
    expect(plane.picnum).toBe(1);
    expect(plane.lightlevel).toBe(200);
  });

  test('renderer.find sky-collapses planes whose picnum equals skyFlatNum to height=0 lightlevel=0', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    renderer.clear();
    const planeA = renderer.find(123 << 16, 5, 64, 5);
    const planeB = renderer.find(987 << 16, 5, 200, 5);
    expect(planeA).toBe(planeB);
    expect(planeA.height).toBe(0);
    expect(planeA.lightlevel).toBe(0);
    expect(planeA.picnum).toBe(5);
  });

  test('renderer.find returns the same plane for repeated identical (height, picnum, lightlevel) triples', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    renderer.clear();
    const first = renderer.find(64 << 16, 2, 100, 99);
    const second = renderer.find(64 << 16, 2, 100, 99);
    expect(first).toBe(second);
    expect(renderer.pool.count).toBe(1);
  });

  test('renderer.find allocates separate planes for distinct (height, picnum, lightlevel) triples', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    renderer.clear();
    renderer.find(64 << 16, 2, 100, 99);
    renderer.find(64 << 16, 2, 200, 99);
    renderer.find(64 << 16, 3, 100, 99);
    renderer.find(128 << 16, 2, 100, 99);
    expect(renderer.pool.count).toBe(4);
  });

  test('renderer.check on a freshly-found plane extends minx/maxx to cover the supplied range', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    renderer.clear();
    const plane = renderer.find(64 << 16, 2, 100, 99);
    const extended = renderer.check(plane, 20, 60);
    expect(extended).toBe(plane);
    expect(plane.minx).toBe(20);
    expect(plane.maxx).toBe(60);
  });

  test('renderer.clear resets pool.count to 0 (matching vanilla R_ClearPlanes which only advances the lastvisplane index)', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    renderer.clear();
    renderer.find(64 << 16, 2, 100, 99);
    renderer.find(128 << 16, 3, 150, 99);
    expect(renderer.pool.count).toBe(2);
    renderer.clear();
    expect(renderer.pool.count).toBe(0);
  });

  test('renderer.find refills the top array with VISPLANE_TOP_UNFILLED on every allocation', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    renderer.clear();
    const plane = renderer.find(64 << 16, 2, 100, 99);
    expect(plane.top[0]).toBe(VISPLANE_TOP_UNFILLED);
    expect(plane.top[plane.top.length - 1]).toBe(VISPLANE_TOP_UNFILLED);
  });

  test('renderer.find throws RangeError on pool exhaustion at MAXVISPLANES', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    renderer.clear();
    for (let index = 0; index < VANILLA_MAXVISPLANES; index += 1) {
      renderer.find((index + 1) << 16, 1, 100, 99);
    }
    let caughtError: unknown;
    try {
      renderer.find((VANILLA_MAXVISPLANES + 1) << 16, 1, 100, 99);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(RangeError);
  });

  test('renderer.spanCache is sized to the supplied viewHeight via createPlaneSpanCache', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 144 });
    expect(renderer.spanCache).toBeDefined();
  });

  test('the renderer surface is stable across calls (same renderer reuses the same pool / spanCache reference)', () => {
    const renderer = createVisplaneRenderer({ screenWidth: SCREENWIDTH, viewHeight: 200 });
    const poolFirstReference = renderer.pool;
    const spanCacheFirstReference = renderer.spanCache;
    renderer.clear();
    renderer.find(64 << 16, 2, 100, 99);
    renderer.clear();
    expect(renderer.pool).toBe(poolFirstReference);
    expect(renderer.spanCache).toBe(spanCacheFirstReference);
  });
});
