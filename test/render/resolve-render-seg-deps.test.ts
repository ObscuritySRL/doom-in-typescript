import { describe, expect, test } from 'bun:test';

import type { Visplane } from '../../src/render/renderLimits.ts';
import { makeResolveRenderSegDeps } from '../../src/render/resolveRenderSegDeps.ts';
import type { StoredWallRange } from '../../src/render/storeWallRange.ts';
import { createVisplanePool, findPlane } from '../../src/render/visplanes.ts';
import type { PreparedWallTexture } from '../../src/render/wallColumns.ts';

function prepared(name: string): PreparedWallTexture {
  return Object.freeze({ name, width: 64, height: 128, widthMask: 63, composite: new Uint8Array(1), columns: Object.freeze([new Uint8Array(1)]) });
}
function visplane(picnum: number): Visplane {
  return { height: 0, picnum, lightlevel: 128, minx: 0, maxx: 1, top: new Uint8Array(2), bottom: new Uint8Array(2) };
}
// A real frame visplane pool — `R_CheckPlane` only runs when a seg
// marks ceiling/floor; the resolution tests below leave markFloor /
// markCeiling false so the pool is inert, but the type requires it.
const POOL = createVisplanePool({ screenWidth: 320 });

const SCALELIGHT_ROWS: readonly (readonly Uint8Array[])[] = Object.freeze([Object.freeze([new Uint8Array([0])]), Object.freeze([new Uint8Array([1])]), Object.freeze([new Uint8Array([2])])]);
const FIXED_ROW: readonly Uint8Array[] = Object.freeze([new Uint8Array([255])]);

const CATALOG = new Map<number, PreparedWallTexture>([
  [5, prepared('STARTAN3')],
  [7, prepared('BROWN1')],
  [9, prepared('STEP1')],
]);
const textureOf = (n: number): PreparedWallTexture | null => CATALOG.get(n) ?? null;

function stored(overrides: Partial<StoredWallRange>): StoredWallRange {
  return Object.freeze({
    rwX: 0,
    rwStopX: 1,
    rwNormalangle: 0,
    rwDistance: 0,
    rwOffset: 0,
    rwCenterangle: 0,
    rwScale: 1,
    rwScalestep: 0,
    scale1: 1,
    scale2: 1,
    worldtop: 0,
    worldbottom: 0,
    worldhigh: null,
    worldlow: null,
    midTexture: 0,
    topTexture: 0,
    bottomTexture: 0,
    maskedTexture: false,
    segtextured: false,
    rwMidtexturemid: 0,
    rwToptexturemid: 0,
    rwBottomtexturemid: 0,
    markFloor: false,
    markCeiling: false,
    silhouette: 0,
    bsilheight: 0,
    tsilheight: 0,
    sprTopClip: null,
    sprBottomClip: null,
    topFrac: 0,
    topStep: 0,
    bottomFrac: 0,
    bottomStep: 0,
    pixhigh: null,
    pixhighstep: null,
    pixlow: null,
    pixlowstep: null,
    lightnum: 1,
    wallLightsIndex: 1,
    textureColumnFor: (x: number) => x,
    ...overrides,
  });
}

describe('resolveRenderSegDeps: R_StoreWallRange texture/light/plane resolution', () => {
  test('one-sided: resolves midTexture, scalelight row by wallLightsIndex, and injects planes', () => {
    const ceil = visplane(1);
    const floor = visplane(2);
    const resolve = makeResolveRenderSegDeps(SCALELIGHT_ROWS, textureOf, { ceilingPlane: ceil, floorPlane: floor, maskedTextureCol: null, fixedColormapRow: null, pool: POOL });
    const r = resolve(stored({ midTexture: 5, wallLightsIndex: 2 }));
    expect(r.midTexture!.name).toBe('STARTAN3');
    expect(r.topTexture).toBeNull();
    expect(r.bottomTexture).toBeNull();
    expect(r.wallLights).toBe(SCALELIGHT_ROWS[2]!);
    expect(r.ceilingPlane).toBe(ceil);
    expect(r.floorPlane).toBe(floor);
    expect(r.maskedTextureCol).toBeNull();
  });

  test('two-sided: resolves top/bottom textures; absent (0) → null', () => {
    const resolve = makeResolveRenderSegDeps(SCALELIGHT_ROWS, textureOf, { ceilingPlane: null, floorPlane: null, maskedTextureCol: null, fixedColormapRow: null, pool: POOL });
    const r = resolve(stored({ midTexture: 0, topTexture: 7, bottomTexture: 0, wallLightsIndex: 0 }));
    expect(r.midTexture).toBeNull();
    expect(r.topTexture!.name).toBe('BROWN1');
    expect(r.bottomTexture).toBeNull();
    expect(r.wallLights).toBe(SCALELIGHT_ROWS[0]!);
  });

  test('null wallLightsIndex: fixedColormapRow when supplied; segtextured + none throws; non-segtextured → inert row', () => {
    const withFixed = makeResolveRenderSegDeps(SCALELIGHT_ROWS, textureOf, { ceilingPlane: null, floorPlane: null, maskedTextureCol: null, fixedColormapRow: FIXED_ROW, pool: POOL });
    expect(withFixed(stored({ wallLightsIndex: null, segtextured: true })).wallLights).toBe(FIXED_ROW);

    const noFixed = makeResolveRenderSegDeps(SCALELIGHT_ROWS, textureOf, { ceilingPlane: null, floorPlane: null, maskedTextureCol: null, fixedColormapRow: null, pool: POOL });
    // Segtextured + null + no fixed row = genuine fixed-colormap wiring error.
    expect(() => noFixed(stored({ wallLightsIndex: null, segtextured: true }))).toThrow('fixed colormap active');
    // Non-segtextured + null = vanilla never samples walllights → inert
    // valid row (scalelightRows[0]), no throw.
    expect(noFixed(stored({ wallLightsIndex: null, segtextured: false })).wallLights).toBe(SCALELIGHT_ROWS[0]!);
  });

  test('out-of-range wallLightsIndex throws (no silent fallback)', () => {
    const resolve = makeResolveRenderSegDeps(SCALELIGHT_ROWS, textureOf, { ceilingPlane: null, floorPlane: null, maskedTextureCol: null, fixedColormapRow: null, pool: POOL });
    expect(() => resolve(stored({ wallLightsIndex: 9 }))).toThrow('out of range');
  });

  test('R_CheckPlane: a marked seg grows the floor/ceiling visplane over [rwX, rwStopX-1] (regression: planes were never marked → all skipped)', () => {
    const pool = createVisplanePool({ screenWidth: 320 });
    // Fresh planes start at the empty sentinel (minx > maxx) — exactly
    // the production state where every plane was skipped by R_DrawPlanes.
    const ceil = findPlane(pool, 0, 10, 128, 99);
    const floor = findPlane(pool, 8 << 16, 11, 128, 99);
    expect(ceil.minx).toBeGreaterThan(ceil.maxx);
    expect(floor.minx).toBeGreaterThan(floor.maxx);

    const resolve = makeResolveRenderSegDeps(SCALELIGHT_ROWS, textureOf, { ceilingPlane: ceil, floorPlane: floor, maskedTextureCol: null, fixedColormapRow: null, pool });

    // markCeiling/markFloor false → no R_CheckPlane, planes untouched.
    const inert = resolve(stored({ midTexture: 5, rwX: 10, rwStopX: 21, markCeiling: false, markFloor: false }));
    expect(inert.ceilingPlane).toBe(ceil);
    expect(ceil.minx).toBeGreaterThan(ceil.maxx); // still empty

    // markCeiling/markFloor true → R_CheckPlane grows each plane over
    // the seg's screen columns [rwX, rwStopX-1] = [10, 20].
    const marked = resolve(stored({ midTexture: 5, rwX: 10, rwStopX: 21, markCeiling: true, markFloor: true }));
    expect(marked.ceilingPlane).not.toBeNull();
    expect(marked.ceilingPlane!.minx).toBeLessThanOrEqual(10);
    expect(marked.ceilingPlane!.maxx).toBeGreaterThanOrEqual(20);
    expect(marked.ceilingPlane!.minx).toBeLessThanOrEqual(marked.ceilingPlane!.maxx); // no longer skipped
    expect(marked.floorPlane!.minx).toBeLessThanOrEqual(10);
    expect(marked.floorPlane!.maxx).toBeGreaterThanOrEqual(20);

    // Per-subsector accumulation (vanilla mutates the global plane
    // across the subsector's segs): a second non-overlapping seg
    // extends the SAME plane's [minx, maxx].
    const second = resolve(stored({ midTexture: 5, rwX: 40, rwStopX: 51, markCeiling: true, markFloor: false }));
    expect(second.ceilingPlane!.minx).toBeLessThanOrEqual(10);
    expect(second.ceilingPlane!.maxx).toBeGreaterThanOrEqual(50);
  });

  test('passes through the injected masked column and is deterministic', () => {
    const masked = new Int16Array(4);
    const resolve = makeResolveRenderSegDeps(SCALELIGHT_ROWS, textureOf, { ceilingPlane: null, floorPlane: null, maskedTextureCol: masked, fixedColormapRow: null, pool: POOL });
    const s = stored({ midTexture: 9, wallLightsIndex: 1 });
    const a = resolve(s);
    const b = resolve(s);
    expect(a.maskedTextureCol).toBe(masked);
    expect(a.midTexture).toBe(b.midTexture);
    expect(a.wallLights).toBe(b.wallLights);
  });
});
