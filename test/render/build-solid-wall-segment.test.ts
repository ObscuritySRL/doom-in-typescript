import { describe, expect, test } from 'bun:test';

import { buildSolidWallSegment } from '../../src/render/buildSolidWallSegment.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import type { StoredWallRange } from '../../src/render/storeWallRange.ts';
import type { PreparedWallTexture } from '../../src/render/wallColumns.ts';

const PREPARED: PreparedWallTexture = Object.freeze({ name: 'STARTAN3', width: 128, height: 128, widthMask: 127, composite: new Uint8Array(128 * 128), columns: Object.freeze([new Uint8Array(128)]) });

const WALL_LIGHTS: readonly Uint8Array[] = Object.freeze([new Uint8Array(256), new Uint8Array(256)]);

function visplane(picnum: number): Visplane {
  return { height: 64 << 16, picnum, lightlevel: 160, minx: 10, maxx: 40, top: new Uint8Array(320), bottom: new Uint8Array(320) };
}

function stored(): StoredWallRange {
  const textureColumnFor = (x: number): number => x * 3 + 1;
  return Object.freeze({
    rwX: 12,
    rwStopX: 47,
    rwNormalangle: 0x4000_0000,
    rwDistance: 5 << 16,
    rwOffset: 8 << 16,
    rwCenterangle: 0x2000_0000,
    rwScale: 123_456,
    rwScalestep: -789,
    scale1: 123_456,
    scale2: 100_000,
    worldtop: 64 << 16,
    worldbottom: 0,
    worldhigh: null,
    worldlow: null,
    midTexture: 5,
    topTexture: 0,
    bottomTexture: 0,
    maskedTexture: false,
    segtextured: true,
    rwMidtexturemid: 41 << 16,
    rwToptexturemid: 0,
    rwBottomtexturemid: 0,
    markFloor: true,
    markCeiling: false,
    silhouette: 0,
    bsilheight: 0,
    tsilheight: 0,
    sprTopClip: null,
    sprBottomClip: null,
    topFrac: 0x0010_0000,
    topStep: -512,
    bottomFrac: 0x00f0_0000,
    bottomStep: 256,
    pixhigh: null,
    pixhighstep: null,
    pixlow: null,
    pixlowstep: null,
    lightnum: 9,
    wallLightsIndex: 9,
    textureColumnFor,
  });
}

describe('buildSolidWallSegment: R_StoreWallRange → R_RenderSegLoop single-sided binding', () => {
  test('maps every StoredWallRange field onto the SolidWallSegment, injecting texture/lights/planes', () => {
    const s = stored();
    const ceil = visplane(1);
    const floor = visplane(2);
    const seg = buildSolidWallSegment(s, PREPARED, WALL_LIGHTS, ceil, floor);

    expect(seg.rwX).toBe(12);
    expect(seg.rwStopX).toBe(47);
    expect(seg.topFrac).toBe(0x0010_0000);
    expect(seg.topStep).toBe(-512);
    expect(seg.bottomFrac).toBe(0x00f0_0000);
    expect(seg.bottomStep).toBe(256);
    // rw_scale / rw_scalestep / rw_midtexturemid → scale / scaleStep / midTextureMid
    expect(seg.scale).toBe(123_456);
    expect(seg.scaleStep).toBe(-789);
    expect(seg.midTextureMid).toBe(41 << 16);
    expect(seg.markCeiling).toBe(false);
    expect(seg.markFloor).toBe(true);
    // injected, passed through by identity
    expect(seg.midTexture).toBe(PREPARED);
    expect(seg.wallLights).toBe(WALL_LIGHTS);
    expect(seg.ceilingPlane).toBe(ceil);
    expect(seg.floorPlane).toBe(floor);
    // the texture-column closure storeWallRange already built is reused
    expect(seg.textureColumnFor).toBe(s.textureColumnFor);
    expect(seg.textureColumnFor(20)).toBe(61);
  });

  test('null ceiling/floor planes pass through as null and the result is deterministic', () => {
    const s = stored();
    const a = buildSolidWallSegment(s, PREPARED, WALL_LIGHTS, null, null);
    const b = buildSolidWallSegment(s, PREPARED, WALL_LIGHTS, null, null);
    expect(a.ceilingPlane).toBeNull();
    expect(a.floorPlane).toBeNull();
    expect(a).toEqual(b);
  });
});
