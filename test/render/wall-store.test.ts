import { describe, expect, test } from 'bun:test';

import type { RenderSegResolved } from '../../src/render/renderSeg.ts';
import type { SegRenderModel } from '../../src/render/segRenderModel.ts';
import type { StoredWallRange, StoreWallRangeSeg, StoreWallRangeView } from '../../src/render/storeWallRange.ts';
import { makeWallStore } from '../../src/render/wallStore.ts';

const SECTOR = Object.freeze({ ceilingheight: 128 << 16, floorheight: 0, ceilingpic: 3, floorpic: 4, lightlevel: 160 });
const SIDEDEF = Object.freeze({ midtexture: 5, toptexture: 0, bottomtexture: 0, textureoffset: 0, rowoffset: 0 });
const V1 = Object.freeze({ x: 0, y: 0 });
const V2 = Object.freeze({ x: 64 << 16, y: 0 });

const MODEL: SegRenderModel = Object.freeze({
  addLineSeg: Object.freeze({ v1: V1, v2: V2, backsector: null, sidedefMidtexture: 5 }),
  frontsector: SECTOR,
  backsector: null,
  backsectorIsNullAddress: false,
  sidedef: SIDEDEF,
  curlineAngle: 0x2000_0000,
  curlineOffset: 8 << 16,
  linedefFlags: 0,
  v1: V1,
  v2: V2,
});

const VIEW: StoreWallRangeView = Object.freeze({
  viewx: 0,
  viewy: 0,
  viewz: 41 << 16,
  viewangle: 0,
  extralight: 0,
  skyflatnum: 99,
  fixedColormap: false,
  centeryfrac: 100 << 16,
  projection: 160 << 16,
  detailshift: 0,
  xtoviewangle: new Uint32Array(321),
});

const RESOLVED: RenderSegResolved = Object.freeze({ midTexture: null, topTexture: null, bottomTexture: null, wallLights: Object.freeze([new Uint8Array(256)]), ceilingPlane: null, floorPlane: null, maskedTextureCol: null });

function storedStub(rwX: number): StoredWallRange {
  return Object.freeze({
    rwX,
    rwStopX: rwX + 1,
    rwNormalangle: 0,
    rwDistance: 1 << 16,
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
    lightnum: null,
    wallLightsIndex: null,
    textureColumnFor: (x: number) => x,
  });
}

describe('wallStore: makeWallStore — clip store → buildStoreWallRangeSeg → storeWallRange → renderSeg', () => {
  test('threads [first,last] + rwAngle1 + model through buildStoreWallRangeSeg into storeWallRange, then renderSeg', () => {
    const fakeStored = storedStub(0);
    let swrSeg: StoreWallRangeSeg | null = null;
    let dispatchStored: StoredWallRange | null = null;
    let dispatchResolved: RenderSegResolved | null = null;
    let drawSolidRef = 0;
    let drawTwoSidedRef = 0;
    const drawSolid = (): void => {
      drawSolidRef += 1;
    };
    const drawTwoSided = (): void => {
      drawTwoSidedRef += 1;
    };

    const store = makeWallStore(
      MODEL,
      0xdead_0000 >>> 0,
      VIEW,
      {},
      (stored) => {
        expect(stored).toBe(fakeStored);
        return RESOLVED;
      },
      drawSolid,
      drawTwoSided,
      {
        storeWallRangeFn: (seg, viewArg, texturesArg) => {
          swrSeg = seg;
          expect(viewArg).toBe(VIEW);
          expect(texturesArg).toEqual({});
          return fakeStored;
        },
        renderSegFn: (stored, resolved, ds, dts) => {
          dispatchStored = stored;
          dispatchResolved = resolved;
          expect(ds).toBe(drawSolid);
          expect(dts).toBe(drawTwoSided);
          return 'solid';
        },
      },
    );

    store(12, 47);

    expect(swrSeg!.start).toBe(12);
    expect(swrSeg!.stop).toBe(47);
    expect(swrSeg!.rwAngle1).toBe(0xdead_0000 >>> 0);
    expect(swrSeg!.curlineAngle).toBe(0x2000_0000);
    expect(swrSeg!.curlineOffset).toBe(8 << 16);
    expect(swrSeg!.sidedef).toBe(SIDEDEF);
    expect(swrSeg!.frontsector).toBe(SECTOR);
    expect(swrSeg!.backsector).toBeNull();
    expect(dispatchStored === fakeStored).toBe(true);
    expect(dispatchResolved === RESOLVED).toBe(true);
    // wallStore itself does not call the drawers — renderSeg does.
    expect(drawSolidRef).toBe(0);
    expect(drawTwoSidedRef).toBe(0);
  });

  test('a second span reuses the same seg model/rwAngle1 with the new [first,last] (deterministic)', () => {
    const ranges: Array<[number, number]> = [];
    const store = makeWallStore(
      MODEL,
      7,
      VIEW,
      {},
      () => RESOLVED,
      () => {},
      () => {},
      {
        storeWallRangeFn: (seg) => {
          ranges.push([seg.start, seg.stop]);
          expect(seg.rwAngle1).toBe(7);
          return storedStub(seg.start);
        },
        renderSegFn: () => 'twosided',
      },
    );
    store(0, 5);
    store(100, 130);
    expect(ranges).toEqual([
      [0, 5],
      [100, 130],
    ]);
  });
});
