import { describe, expect, test } from 'bun:test';

import type { RenderSegResolved } from '../../src/render/renderSeg.ts';
import type { SegRenderModel, SegRenderScene } from '../../src/render/segRenderModel.ts';
import { makeSegStoreFactory } from '../../src/render/segStoreFactory.ts';
import type { StoreWallRangeSeg, StoreWallRangeView } from '../../src/render/storeWallRange.ts';

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

// segRenderModel only reads `scene`; the stub asserts pass-through, so an
// empty-table scene is sufficient (the real builder has its own suite).
const SCENE: SegRenderScene = Object.freeze({ vertexes: Object.freeze([]), segs: Object.freeze([]), linedefs: Object.freeze([]), sidedefs: Object.freeze([]), sectors: Object.freeze([]) });
const flatNumber = (name: string): number => (name === 'F_SKY1' ? 99 : 7);
const textureNumber = (name: string): number => (name === '-' ? 0 : 5);

describe('segStoreFactory: makeSegStoreFactory — per-seg R_AddLine→R_StoreWallRange binding', () => {
  test('binds segRenderModel(scene, segIndex, …) + rwAngle1 into the wallStore pipeline', () => {
    let modelArgs: { segIndex: number } | null = null;
    let swrSeg: StoreWallRangeSeg | null = null;
    let dispatchResolved: RenderSegResolved | null = null;
    const drawSolid = (): void => {};
    const drawTwoSided = (): void => {};

    const factory = makeSegStoreFactory(SCENE, flatNumber, textureNumber, VIEW, {}, () => RESOLVED, drawSolid, drawTwoSided, {
      segRenderModelFn: (scene, segIndex, flatNum, texNum) => {
        expect(scene).toBe(SCENE);
        expect(flatNum).toBe(flatNumber);
        expect(texNum).toBe(textureNumber);
        modelArgs = { segIndex };
        return MODEL;
      },
      storeWallRangeFn: (seg, viewArg, texturesArg) => {
        swrSeg = seg;
        expect(viewArg).toBe(VIEW);
        expect(texturesArg).toEqual({});
        // A minimal StoredWallRange — only identity matters for dispatch here.
        return Object.freeze({ ...STORED_BASE, rwX: seg.start, rwStopX: seg.stop });
      },
      renderSegFn: (_stored, resolvedArg, ds, dts) => {
        dispatchResolved = resolvedArg;
        expect(ds).toBe(drawSolid);
        expect(dts).toBe(drawTwoSided);
        return 'solid';
      },
    });

    const store = factory(17, 0xdead_0000 >>> 0);
    store(12, 47);

    expect(modelArgs!.segIndex).toBe(17);
    expect(swrSeg!.start).toBe(12);
    expect(swrSeg!.stop).toBe(47);
    expect(swrSeg!.rwAngle1).toBe(0xdead_0000 >>> 0);
    expect(swrSeg!.curlineAngle).toBe(0x2000_0000);
    expect(swrSeg!.sidedef).toBe(SIDEDEF);
    expect(swrSeg!.frontsector).toBe(SECTOR);
    expect(dispatchResolved === RESOLVED).toBe(true);
  });

  test('each (segIndex, rwAngle1) yields an independent curline-bound store (deterministic)', () => {
    const seen: Array<{ segIndex: number; rwAngle1: number; start: number }> = [];
    const factory = makeSegStoreFactory(
      SCENE,
      flatNumber,
      textureNumber,
      VIEW,
      {},
      () => RESOLVED,
      () => {},
      () => {},
      {
        segRenderModelFn: (_scene, segIndex) => Object.freeze({ ...MODEL, curlineOffset: segIndex << 16 }),
        storeWallRangeFn: (seg) => {
          seen.push({ segIndex: seg.curlineOffset >> 16, rwAngle1: seg.rwAngle1, start: seg.start });
          return Object.freeze({ ...STORED_BASE });
        },
        renderSegFn: () => 'twosided',
      },
    );

    factory(3, 100)(0, 5);
    factory(8, 200)(40, 60);

    expect(seen).toEqual([
      { segIndex: 3, rwAngle1: 100, start: 0 },
      { segIndex: 8, rwAngle1: 200, start: 40 },
    ]);
  });
});

// A structurally complete StoredWallRange skeleton (renderSeg dispatch
// only inspects midTexture here; the rest is inert but typed).
const STORED_BASE = {
  rwX: 0,
  rwStopX: 1,
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
  textureColumnFor: (x: number): number => x,
} as const;
