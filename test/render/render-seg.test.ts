import { describe, expect, test } from 'bun:test';

import type { Visplane } from '../../src/render/renderLimits.ts';
import type { RenderSegResolved } from '../../src/render/renderSeg.ts';
import { renderSeg } from '../../src/render/renderSeg.ts';
import type { SolidWallSegment } from '../../src/render/solidWalls.ts';
import type { StoredWallRange } from '../../src/render/storeWallRange.ts';
import type { TwoSidedWallSegment } from '../../src/render/twoSidedWalls.ts';
import type { PreparedWallTexture } from '../../src/render/wallColumns.ts';

function prepared(name: string): PreparedWallTexture {
  return Object.freeze({ name, width: 64, height: 128, widthMask: 63, composite: new Uint8Array(1), columns: Object.freeze([new Uint8Array(1)]) });
}
function visplane(picnum: number): Visplane {
  return { height: 0, picnum, lightlevel: 128, minx: 0, maxx: 10, top: new Uint8Array(8), bottom: new Uint8Array(8) };
}
const WALL_LIGHTS: readonly Uint8Array[] = Object.freeze([new Uint8Array(256)]);

function stored(midTexture: number): StoredWallRange {
  return Object.freeze({
    rwX: 0,
    rwStopX: 9,
    rwNormalangle: 0,
    rwDistance: 1 << 16,
    rwOffset: 0,
    rwCenterangle: 0,
    rwScale: 100_000,
    rwScalestep: 0,
    scale1: 100_000,
    scale2: 100_000,
    worldtop: 64 << 16,
    worldbottom: 0,
    worldhigh: midTexture === 0 ? 32 << 16 : null,
    worldlow: midTexture === 0 ? 16 << 16 : null,
    midTexture,
    topTexture: midTexture === 0 ? 3 : 0,
    bottomTexture: midTexture === 0 ? 4 : 0,
    maskedTexture: false,
    segtextured: true,
    rwMidtexturemid: 0,
    rwToptexturemid: 0,
    rwBottomtexturemid: 0,
    markFloor: true,
    markCeiling: true,
    silhouette: 0,
    bsilheight: 0,
    tsilheight: 0,
    sprTopClip: null,
    sprBottomClip: null,
    topFrac: 0,
    topStep: 0,
    bottomFrac: 0,
    bottomStep: 0,
    pixhigh: midTexture === 0 ? 0x10_0000 : null,
    pixhighstep: midTexture === 0 ? 1 : null,
    pixlow: midTexture === 0 ? 0x20_0000 : null,
    pixlowstep: midTexture === 0 ? 2 : null,
    lightnum: 5,
    wallLightsIndex: 5,
    textureColumnFor: (x: number) => x,
  });
}

function resolved(overrides: Partial<RenderSegResolved> = {}): RenderSegResolved {
  return { midTexture: prepared('MID'), topTexture: prepared('TOP'), bottomTexture: prepared('BOT'), wallLights: WALL_LIGHTS, ceilingPlane: visplane(1), floorPlane: visplane(2), maskedTextureCol: null, ...overrides };
}

describe('renderSeg: R_StoreWallRange/R_RenderSegLoop solid vs two-sided dispatch', () => {
  test('midTexture !== 0 → single-sided: builds a SolidWallSegment and calls drawSolid only', () => {
    let solid: SolidWallSegment | null = null;
    let twoSidedCalls = 0;
    const kind = renderSeg(
      stored(5),
      resolved(),
      (seg) => {
        solid = seg;
      },
      () => {
        twoSidedCalls += 1;
      },
    );
    expect(kind).toBe('solid');
    expect(twoSidedCalls).toBe(0);
    expect(solid!.rwX).toBe(0);
    expect(solid!.rwStopX).toBe(9);
    expect(solid!.scale).toBe(100_000);
    expect(solid!.midTexture.name).toBe('MID');
    expect(solid!.wallLights).toBe(WALL_LIGHTS);
  });

  test('midTexture === 0 → two-sided: builds a TwoSidedWallSegment and calls drawTwoSided only', () => {
    let two: TwoSidedWallSegment | null = null;
    let solidCalls = 0;
    const kind = renderSeg(
      stored(0),
      resolved(),
      () => {
        solidCalls += 1;
      },
      (seg) => {
        two = seg;
      },
    );
    expect(kind).toBe('twosided');
    expect(solidCalls).toBe(0);
    expect(two!.topTexture!.name).toBe('TOP');
    expect(two!.bottomTexture!.name).toBe('BOT');
    expect(two!.pixHigh).toBe(0x10_0000);
    expect(two!.pixLow).toBe(0x20_0000);
  });

  test('single-sided seg with an unresolved midTexture throws (no silent fallback)', () => {
    expect(() =>
      renderSeg(
        stored(5),
        resolved({ midTexture: null }),
        () => {},
        () => {},
      ),
    ).toThrow('renderSeg: a single-sided seg (midTexture != 0) requires a resolved midTexture');
  });

  test('two-sided dispatch tolerates null upper/lower textures and planes', () => {
    let two: TwoSidedWallSegment | null = null;
    const kind = renderSeg(
      stored(0),
      resolved({ topTexture: null, bottomTexture: null, ceilingPlane: null, floorPlane: null }),
      () => {},
      (seg) => {
        two = seg;
      },
    );
    expect(kind).toBe('twosided');
    expect(two!.topTexture).toBeNull();
    expect(two!.bottomTexture).toBeNull();
    expect(two!.ceilingPlane).toBeNull();
    expect(two!.floorPlane).toBeNull();
  });
});
