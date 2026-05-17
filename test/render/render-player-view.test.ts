import { describe, expect, test } from 'bun:test';

import { ANG90 } from '../../src/core/angle.ts';
import type { CheckBBoxView } from '../../src/render/checkBBox.ts';
import type { ProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import type { RenderBspScene } from '../../src/render/renderBspNode.ts';
import { renderPlayerViewWalls } from '../../src/render/renderPlayerView.ts';
import type { SetupFramePlayer } from '../../src/render/setupFrame.ts';
import { setupFrame } from '../../src/render/setupFrame.ts';
import type { ClipState } from '../../src/render/solidSegs.ts';
import { createVisplanePool } from '../../src/render/visplanes.ts';

const VIEW_WIDTH = 320;
const SKY_FLAT_NUM = 2;

function player(): SetupFramePlayer {
  return { mobjX: 512 << 16, mobjY: -768 << 16, mobjAngle: ANG90, viewz: 41 << 16, extralight: 1, fixedColormap: 0 };
}

function projectionAngles(): ProjectionAngleTables {
  return Object.freeze({ clipangle: 0x2000_0000, viewangletox: new Int32Array([1, 2, 3]), xtoviewangle: new Uint32Array([0x2000_0000]) });
}

const SCENE: RenderBspScene = { nodes: [], subsectorCount: 1 };

describe('renderPlayerViewWalls: R_RenderPlayerView control flow', () => {
  test('runs setup → clear → BSP walk → plane flush in vanilla order with the frame-derived view', () => {
    const pool = createVisplanePool();
    pool.count = 5; // dirty: must be reset to 0 by clearPlanes (R_ClearPlanes)

    const order: string[] = [];
    let bspView: CheckBBoxView | null = null;
    let bspClip: ClipState | null = null;

    const result = renderPlayerViewWalls(
      SCENE,
      player(),
      projectionAngles(),
      pool,
      VIEW_WIDTH,
      SKY_FLAT_NUM,
      () => order.push('subsector'),
      () => order.push('sky'),
      () => order.push('regular'),
      {
        bspWalk: (scene, view, state) => {
          order.push('bsp');
          bspView = view;
          bspClip = state;
          expect(scene).toBe(SCENE);
        },
        planeFlush: (poolArg, skyFlatNum, onSky, onRegular) => {
          order.push('planes');
          expect(poolArg).toBe(pool);
          expect(skyFlatNum).toBe(SKY_FLAT_NUM);
          onSky(pool.planes[0]!);
          onRegular(pool.planes[0]!);
        },
      },
    );

    // R_ClearPlanes reset the caller pool.
    expect(pool.count).toBe(0);
    // Vanilla order: BSP walk before plane flush; the injected sky/regular
    // run inside the plane flush (after the walk).
    expect(order).toEqual(['bsp', 'planes', 'sky', 'regular']);

    // The view handed to R_RenderBSPNode is the setupFrame transform
    // (viewx/viewy/viewangle) plus the I1 clipangle/viewangletox.
    const expectedFrame = setupFrame(player());
    expect(bspView!.viewx).toBe(expectedFrame.viewx);
    expect(bspView!.viewy).toBe(expectedFrame.viewy);
    expect(bspView!.viewangle).toBe(expectedFrame.viewangle);
    expect(bspView!.clipangle).toBe(0x2000_0000);
    expect([...bspView!.viewangletox]).toEqual([1, 2, 3]);

    // Result exposes the frame transform + a fresh clip state.
    expect(result.frame).toEqual(expectedFrame);
    expect(result.clipState).toBe(bspClip!);
    expect(result.clipState).not.toBeNull();
  });

  test('passes the caller subsector/plane closures straight through to the BSP walk and plane flush', () => {
    const pool = createVisplanePool();
    const seen: string[] = [];
    renderPlayerViewWalls(
      SCENE,
      player(),
      projectionAngles(),
      pool,
      VIEW_WIDTH,
      SKY_FLAT_NUM,
      (ssIndex) => seen.push(`ss:${ssIndex}`),
      () => seen.push('sky'),
      () => seen.push('reg'),
      {
        bspWalk: (_scene, _view, _state, onSubsector) => onSubsector(7),
        planeFlush: (_pool, _sky, onSky, onRegular) => {
          onSky(pool.planes[0]!);
          onRegular(pool.planes[1]!);
        },
      },
    );
    expect(seen).toEqual(['ss:7', 'sky', 'reg']);
  });

  test('viewangleoffset is applied to the setup frame view angle', () => {
    const pool = createVisplanePool();
    let captured: CheckBBoxView | null = null;
    renderPlayerViewWalls(
      SCENE,
      player(),
      projectionAngles(),
      pool,
      VIEW_WIDTH,
      SKY_FLAT_NUM,
      () => {},
      () => {},
      () => {},
      {
        viewangleoffset: ANG90,
        bspWalk: (_s, view) => {
          captured = view;
        },
        planeFlush: () => {},
      },
    );
    expect(captured!.viewangle).toBe((ANG90 + ANG90) >>> 0);
  });

  test('is deterministic with the real committed bspWalk/planeFlush defaults on an empty scene', () => {
    const poolA = createVisplanePool();
    const poolB = createVisplanePool();
    const a = renderPlayerViewWalls(
      SCENE,
      player(),
      projectionAngles(),
      poolA,
      VIEW_WIDTH,
      SKY_FLAT_NUM,
      () => {},
      () => {},
      () => {},
    );
    const b = renderPlayerViewWalls(
      SCENE,
      player(),
      projectionAngles(),
      poolB,
      VIEW_WIDTH,
      SKY_FLAT_NUM,
      () => {},
      () => {},
      () => {},
    );
    expect(a.frame).toEqual(b.frame);
    expect(poolA.count).toBe(0);
    expect(poolB.count).toBe(0);
  });
});
