import { describe, expect, test } from 'bun:test';

import { ANG90 } from '../../src/core/angle.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';

import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ST_HORIZONTAL } from '../../src/map/lineSectorGeometry.ts';
import type { MapSeg, MapSubsector } from '../../src/map/bspStructs.ts';
import type { AssembledOnSubsectorConfig } from '../../src/render/assembledOnSubsector.ts';
import type { AssembledPlaneRenderersConfig } from '../../src/render/assembledPlaneRenderers.ts';
import type { AssembledPlayerFrameConfig } from '../../src/render/assembledPlayerFrame.ts';
import { makeAssembledPlayerFrameRenderer } from '../../src/render/assembledPlayerFrame.ts';
import { DetailMode, NUMCOLORMAPS, computeViewport } from '../../src/render/projection.ts';
import type { RenderBspScene } from '../../src/render/renderBspNode.ts';
import { buildPlaneProjectionTables, buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import type { SetupFramePlayer } from '../../src/render/setupFrame.ts';
import { setupFrame } from '../../src/render/setupFrame.ts';
import { createVisplanePool } from '../../src/render/visplanes.ts';

const viewport = computeViewport(11, DetailMode.high);
const projectionAngles = buildProjectionAngleTables(viewport);
const planeTables = buildPlaneProjectionTables(viewport, projectionAngles.xtoviewangle);
const xToViewAngleI32 = new Int32Array(projectionAngles.xtoviewangle.buffer, projectionAngles.xtoviewangle.byteOffset, projectionAngles.xtoviewangle.length);
const colormaps: readonly Uint8Array[] = Array.from({ length: NUMCOLORMAPS }, () => new Uint8Array(256));
const zlightRows: readonly (readonly Uint8Array[])[] = Array.from({ length: 16 }, (_u, i) => Object.freeze([new Uint8Array([i])]));

const vertexes: readonly MapVertex[] = [
  { x: 0, y: 0 },
  { x: 64 * FRACUNIT, y: 0 },
];
const sectors: readonly MapSector[] = [{ floorheight: 0, ceilingheight: 128 * FRACUNIT, floorpic: 'FLOOR', ceilingpic: 'CEIL', lightlevel: 160, special: 0, tag: 0 }];
const sidedefs: readonly MapSidedef[] = [{ textureoffset: 0, rowoffset: 0, toptexture: '-', bottomtexture: '-', midtexture: '-', sector: 0 }];
const linedefs: readonly MapLinedef[] = [{ v1: 0, v2: 1, dx: 0, dy: 0, flags: 0, special: 0, tag: 0, sidenum0: 0, sidenum1: -1, slopetype: ST_HORIZONTAL, bbox: [0, 0, 0, 0] }];
const segs: readonly MapSeg[] = [{ v1: 0, v2: 1, angle: 0, linedef: 0, side: 0, offset: 0 }];
const subsectors: readonly MapSubsector[] = [{ firstseg: 0, numsegs: 0 }];

const flatNumber = (name: string): number => (name === 'F_SKY1' ? 99 : name === 'CEIL' ? 1 : 2);
const textureNumber = (name: string): number => (name === '-' ? 0 : 5);

function skyTexture() {
  return Object.freeze({ name: 'SKY1', width: 256, height: 128, widthMask: 255, composite: new Uint8Array(1), columns: Object.freeze([new Uint8Array(1)]) });
}

const SCENE: RenderBspScene = { nodes: [], subsectorCount: 1 };

function onSubsectorConfig(pool = createVisplanePool()): { cfg: AssembledOnSubsectorConfig; pool: ReturnType<typeof createVisplanePool> } {
  return {
    pool,
    cfg: {
      map: { subsectors, segs, linedefs, sidedefs, sectors, vertexes },
      flatNumber,
      textureNumber,
      segScene: { vertexes, segs, linedefs, sidedefs, sectors },
      orderedDefinitions: [],
      pnames: [],
      patchByName: () => null,
      colormaps,
      viewport,
      projectionAngles,
      skyflatnum: 99,
      pool,
      drawContext: { framebuffer: new Uint8Array(64), viewHeight: 168, centerY: 84, ceilingClip: new Int16Array(8), floorClip: new Int16Array(8) },
    },
  };
}

function planesConfig(): AssembledPlaneRenderersConfig {
  return {
    skyTexture: skyTexture(),
    baseColormap: colormaps[0]!,
    skyIscale: 1,
    skyTextureMid: 100 << 16,
    colormaps,
    zlightRows,
    flatSource: () => new Uint8Array(4096),
    viewport,
    xToViewAngle: xToViewAngleI32,
    planeTables,
    spanScratch: { cachedHeight: new Int32Array(8), cachedDistance: new Int32Array(8), cachedXStep: new Int32Array(8), cachedYStep: new Int32Array(8), spanStart: new Int32Array(8) },
    framebuffer: new Uint8Array(64),
  };
}

function frameConfig(pool = createVisplanePool()): AssembledPlayerFrameConfig {
  const { cfg } = onSubsectorConfig(pool);
  return { scene: SCENE, projectionAngles, visplanePool: pool, viewWidth: viewport.viewWidth, skyflatnum: 99, onSubsector: cfg, planes: planesConfig() };
}

function player(): SetupFramePlayer {
  return { mobjX: 0, mobjY: 0, mobjAngle: ANG90, viewz: 41 * FRACUNIT, extralight: 0, fixedColormap: 0 };
}

function visplane(): Visplane {
  return { height: 0, picnum: 7, lightlevel: 160, minx: 0, maxx: 1, top: new Uint8Array(2), bottom: new Uint8Array(2) };
}

describe('assembledPlayerFrame: makeAssembledPlayerFrameRenderer — full R_RenderPlayerView', () => {
  test('builds a per-frame renderer; a frame runs the full pipeline (planes selected, result exposed)', () => {
    const pool = createVisplanePool();
    const renderFrame = makeAssembledPlayerFrameRenderer(frameConfig(pool));
    expect(typeof renderFrame).toBe('function');

    const result = renderFrame(player());
    expect(result.frame).toEqual(setupFrame(player()));
    expect(result.clipState).not.toBeNull();
    // The empty subsector still selects floor+ceiling planes (wall path ran).
    expect(pool.count).toBeGreaterThan(0);
  });

  test('the plane factory is derived once per frame and both drawers work (single-frame memo)', () => {
    let skyCalls = 0;
    let spanCalls = 0;
    const cfg: AssembledPlayerFrameConfig = {
      ...frameConfig(),
      planeHooks: { renderSkyVisplaneFn: () => void (skyCalls += 1), renderVisplaneSpansFn: () => void (spanCalls += 1) },
      renderHooks: {
        bspWalk: (_s, _v, _st, onSubsector) => onSubsector(0),
        planeFlush: (_pool, _sky, onSky, onRegular) => {
          const pl = visplane();
          onSky(pl);
          onRegular(pl);
        },
      },
    };
    makeAssembledPlayerFrameRenderer(cfg)(player());
    expect(skyCalls).toBe(1);
    expect(spanCalls).toBe(1);
  });

  test('is deterministic — two renderers, same player, identical frame + plane selection', () => {
    const poolA = createVisplanePool();
    const poolB = createVisplanePool();
    const a = makeAssembledPlayerFrameRenderer(frameConfig(poolA))(player());
    const b = makeAssembledPlayerFrameRenderer(frameConfig(poolB))(player());
    expect(a.frame).toEqual(b.frame);
    expect(poolA.count).toBe(poolB.count);
  });

  test('a second frame re-derives the plane drawers (memo keyed by frame identity)', () => {
    let skyCalls = 0;
    const cfg: AssembledPlayerFrameConfig = {
      ...frameConfig(),
      planeHooks: { renderSkyVisplaneFn: () => void (skyCalls += 1) },
      renderHooks: { planeFlush: (_p, _s, onSky) => onSky(visplane()) },
    };
    const renderFrame = makeAssembledPlayerFrameRenderer(cfg);
    renderFrame(player());
    renderFrame(player());
    expect(skyCalls).toBe(2);
  });

  test('the deferred drawMasked slot fires once per frame, AFTER R_DrawPlanes, with the result frame + player', () => {
    const order: string[] = [];
    const p = player();
    let seenFrame: unknown = null;
    let seenPlayer: unknown = null;
    const cfg: AssembledPlayerFrameConfig = {
      ...frameConfig(),
      renderHooks: {
        bspWalk: (_s, _v, _st, onSubsector) => onSubsector(0),
        planeFlush: () => void order.push('planes'), // R_DrawPlanes
      },
      drawMasked: (frame, pl) => {
        order.push('masked'); // R_DrawMasked → R_DrawPlayerSprites
        seenFrame = frame;
        seenPlayer = pl;
      },
    };
    const result = makeAssembledPlayerFrameRenderer(cfg)(p);
    // Vanilla R_RenderPlayerView order: … R_DrawPlanes() then R_DrawMasked().
    expect(order).toEqual(['planes', 'masked']);
    expect(seenFrame).toBe(result.frame);
    expect(seenPlayer).toBe(p);
  });

  test('omitting drawMasked leaves the per-frame call unchanged (wall + visplane path only)', () => {
    const poolA = createVisplanePool();
    const poolB = createVisplanePool();
    const without = makeAssembledPlayerFrameRenderer(frameConfig(poolA))(player());
    let called = 0;
    const withNoop = makeAssembledPlayerFrameRenderer({ ...frameConfig(poolB), drawMasked: () => void (called += 1) })(player());
    expect(called).toBe(1);
    expect(withNoop.frame).toEqual(without.frame);
    expect(poolA.count).toBe(poolB.count);
  });

  test('drawMasked is invoked once per frame (two frames → two calls)', () => {
    let calls = 0;
    const renderFrame = makeAssembledPlayerFrameRenderer({ ...frameConfig(), drawMasked: () => void (calls += 1) });
    renderFrame(player());
    renderFrame(player());
    expect(calls).toBe(2);
  });
});
