import { describe, expect, test } from 'bun:test';

import { buildTwoSidedWallSegment } from '../../src/render/buildTwoSidedWallSegment.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import type { StoredWallRange } from '../../src/render/storeWallRange.ts';
import type { PreparedWallTexture } from '../../src/render/wallColumns.ts';

function prepared(name: string): PreparedWallTexture {
  return Object.freeze({ name, width: 64, height: 128, widthMask: 63, composite: new Uint8Array(64 * 128), columns: Object.freeze([new Uint8Array(128)]) });
}

const WALL_LIGHTS: readonly Uint8Array[] = Object.freeze([new Uint8Array(256)]);

function visplane(picnum: number): Visplane {
  return { height: 0, picnum, lightlevel: 96, minx: 0, maxx: 30, top: new Uint8Array(320), bottom: new Uint8Array(320) };
}

function stored(overrides: Partial<StoredWallRange> = {}): StoredWallRange {
  const textureColumnFor = (x: number): number => x ^ 0x55;
  return Object.freeze({
    rwX: 4,
    rwStopX: 60,
    rwNormalangle: 0x8000_0000,
    rwDistance: 12 << 16,
    rwOffset: -3 << 16,
    rwCenterangle: 0xc000_0000,
    rwScale: 200_000,
    rwScalestep: 42,
    scale1: 200_000,
    scale2: 211_764,
    worldtop: 96 << 16,
    worldbottom: 16 << 16,
    worldhigh: 80 << 16,
    worldlow: 32 << 16,
    midTexture: 0,
    topTexture: 7,
    bottomTexture: 9,
    maskedTexture: false,
    segtextured: true,
    rwMidtexturemid: 0,
    rwToptexturemid: 88 << 16,
    rwBottomtexturemid: 24 << 16,
    markFloor: true,
    markCeiling: true,
    silhouette: 3,
    bsilheight: 0x7fff_ffff,
    tsilheight: -0x8000_0000,
    sprTopClip: null,
    sprBottomClip: null,
    topFrac: 0x0020_0000,
    topStep: -111,
    bottomFrac: 0x00c0_0000,
    bottomStep: 222,
    pixhigh: 0x0030_0000,
    pixhighstep: -55,
    pixlow: 0x00a0_0000,
    pixlowstep: 66,
    lightnum: 6,
    wallLightsIndex: 6,
    textureColumnFor,
    ...overrides,
  });
}

describe('buildTwoSidedWallSegment: R_StoreWallRange → R_RenderSegLoop two-sided binding', () => {
  test('maps every field, injecting top/bottom textures, lights, planes, masked column', () => {
    const s = stored();
    const top = prepared('BROWN1');
    const bottom = prepared('STEP1');
    const ceil = visplane(1);
    const floor = visplane(2);
    const masked = new Int16Array(320);
    const seg = buildTwoSidedWallSegment(s, top, bottom, WALL_LIGHTS, ceil, floor, masked);

    expect(seg.rwX).toBe(4);
    expect(seg.rwStopX).toBe(60);
    expect(seg.topFrac).toBe(0x0020_0000);
    expect(seg.topStep).toBe(-111);
    expect(seg.bottomFrac).toBe(0x00c0_0000);
    expect(seg.bottomStep).toBe(222);
    expect(seg.topTexture).toBe(top);
    expect(seg.topTextureMid).toBe(88 << 16);
    expect(seg.pixHigh).toBe(0x0030_0000);
    expect(seg.pixHighStep).toBe(-55);
    expect(seg.bottomTexture).toBe(bottom);
    expect(seg.bottomTextureMid).toBe(24 << 16);
    expect(seg.pixLow).toBe(0x00a0_0000);
    expect(seg.pixLowStep).toBe(66);
    expect(seg.scale).toBe(200_000);
    expect(seg.scaleStep).toBe(42);
    expect(seg.wallLights).toBe(WALL_LIGHTS);
    expect(seg.markCeiling).toBe(true);
    expect(seg.ceilingPlane).toBe(ceil);
    expect(seg.markFloor).toBe(true);
    expect(seg.floorPlane).toBe(floor);
    expect(seg.textureColumnFor).toBe(s.textureColumnFor);
    expect(seg.maskedTextureCol).toBe(masked);
  });

  test('null pix* (absent upper/lower texture) map to 0 (vanilla unused-global state); null tex/planes/masked pass through', () => {
    const s = stored({ pixhigh: null, pixhighstep: null, pixlow: null, pixlowstep: null });
    const seg = buildTwoSidedWallSegment(s, null, null, WALL_LIGHTS, null, null, null);
    expect(seg.pixHigh).toBe(0);
    expect(seg.pixHighStep).toBe(0);
    expect(seg.pixLow).toBe(0);
    expect(seg.pixLowStep).toBe(0);
    expect(seg.topTexture).toBeNull();
    expect(seg.bottomTexture).toBeNull();
    expect(seg.ceilingPlane).toBeNull();
    expect(seg.floorPlane).toBeNull();
    expect(seg.maskedTextureCol).toBeNull();
    expect(seg).toEqual(buildTwoSidedWallSegment(s, null, null, WALL_LIGHTS, null, null, null));
  });
});
