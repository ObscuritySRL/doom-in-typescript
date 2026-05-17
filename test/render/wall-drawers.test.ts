import { describe, expect, test } from 'bun:test';

import type { SolidWallSegment } from '../../src/render/solidWalls.ts';
import type { TwoSidedWallSegment } from '../../src/render/twoSidedWalls.ts';
import type { PreparedWallTexture } from '../../src/render/wallColumns.ts';
import type { WallDrawContext } from '../../src/render/wallDrawers.ts';
import { makeWallDrawers } from '../../src/render/wallDrawers.ts';

function prepared(): PreparedWallTexture {
  return Object.freeze({ name: 'MID', width: 64, height: 128, widthMask: 63, composite: new Uint8Array(1), columns: Object.freeze([new Uint8Array(1)]) });
}
const WALL_LIGHTS: readonly Uint8Array[] = Object.freeze([new Uint8Array(256)]);

const solidSeg: SolidWallSegment = Object.freeze({
  rwX: 0,
  rwStopX: 1,
  topFrac: 0,
  topStep: 0,
  bottomFrac: 0,
  bottomStep: 0,
  midTexture: prepared(),
  midTextureMid: 0,
  scale: 1,
  scaleStep: 0,
  wallLights: WALL_LIGHTS,
  markCeiling: false,
  ceilingPlane: null,
  markFloor: false,
  floorPlane: null,
  textureColumnFor: (x: number) => x,
});

const twoSidedSeg: TwoSidedWallSegment = Object.freeze({
  rwX: 0,
  rwStopX: 1,
  topFrac: 0,
  topStep: 0,
  bottomFrac: 0,
  bottomStep: 0,
  topTexture: null,
  topTextureMid: 0,
  pixHigh: 0,
  pixHighStep: 0,
  bottomTexture: null,
  bottomTextureMid: 0,
  pixLow: 0,
  pixLowStep: 0,
  scale: 1,
  scaleStep: 0,
  wallLights: WALL_LIGHTS,
  markCeiling: false,
  ceilingPlane: null,
  markFloor: false,
  floorPlane: null,
  textureColumnFor: (x: number) => x,
  maskedTextureCol: null,
});

function context(): WallDrawContext {
  return { framebuffer: new Uint8Array(64), viewHeight: 168, centerY: 84, ceilingClip: new Int16Array(8), floorClip: new Int16Array(8) };
}

describe('wallDrawers: makeWallDrawers — per-frame draw context bound into the drawer closures', () => {
  test('drawSolid forwards (seg, ctx) to renderSolidWall with the captured context', () => {
    const ctx = context();
    let solidArgs: { seg: SolidWallSegment; sameCtx: boolean } | null = null;
    let twoSidedCalls = 0;
    const { drawSolid } = makeWallDrawers(ctx, {
      renderSolidWallFn: (seg, passedCtx) => {
        solidArgs = { seg, sameCtx: passedCtx === ctx };
      },
      renderTwoSidedWallFn: () => {
        twoSidedCalls += 1;
      },
    });

    drawSolid(solidSeg);

    expect(solidArgs!.seg).toBe(solidSeg);
    expect(solidArgs!.sameCtx).toBe(true);
    expect(twoSidedCalls).toBe(0);
  });

  test('drawTwoSided forwards (seg, ctx) to renderTwoSidedWall with the captured context', () => {
    const ctx = context();
    let twoArgs: { seg: TwoSidedWallSegment; sameCtx: boolean } | null = null;
    let solidCalls = 0;
    const { drawTwoSided } = makeWallDrawers(ctx, {
      renderSolidWallFn: () => {
        solidCalls += 1;
      },
      renderTwoSidedWallFn: (seg, passedCtx) => {
        twoArgs = { seg, sameCtx: passedCtx === ctx };
      },
    });

    drawTwoSided(twoSidedSeg);

    expect(twoArgs!.seg).toBe(twoSidedSeg);
    expect(twoArgs!.sameCtx).toBe(true);
    expect(solidCalls).toBe(0);
  });

  test('the same context is threaded on every call (deterministic across segs)', () => {
    const ctx = context();
    const seen: boolean[] = [];
    const { drawSolid } = makeWallDrawers(ctx, {
      renderSolidWallFn: (_seg, passedCtx) => {
        seen.push(passedCtx === ctx);
      },
      renderTwoSidedWallFn: () => {},
    });
    drawSolid(solidSeg);
    drawSolid(solidSeg);
    drawSolid(solidSeg);
    expect(seen).toEqual([true, true, true]);
  });

  test('with no hooks the default committed pixel passes are bound (callable closures)', () => {
    const { drawSolid, drawTwoSided } = makeWallDrawers(context());
    expect(typeof drawSolid).toBe('function');
    expect(typeof drawTwoSided).toBe('function');
  });
});
