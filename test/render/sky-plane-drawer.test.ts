import { describe, expect, test } from 'bun:test';

import type { Visplane } from '../../src/render/renderLimits.ts';
import type { SkyRenderContext } from '../../src/render/sky.ts';
import { makeSkyPlaneDrawer } from '../../src/render/skyPlaneDrawer.ts';
import type { PreparedWallTexture } from '../../src/render/wallColumns.ts';

function skyTexture(): PreparedWallTexture {
  return Object.freeze({ name: 'SKY1', width: 256, height: 128, widthMask: 255, composite: new Uint8Array(1), columns: Object.freeze([new Uint8Array(1)]) });
}

function visplane(picnum: number): Visplane {
  return { height: 0, picnum, lightlevel: 0, minx: 0, maxx: 1, top: new Uint8Array(2), bottom: new Uint8Array(2) };
}

function context(): SkyRenderContext {
  return { skyTexture: skyTexture(), viewAngle: 0x4000_0000, xToViewAngle: new Int32Array(4), baseColormap: new Uint8Array(256), iscale: 1, textureMid: 100 << 16, centerY: 84, framebuffer: new Uint8Array(64) };
}

describe('skyPlaneDrawer: makeSkyPlaneDrawer — frame-static sky context bound into onSkyPlane', () => {
  test('forwards (plane, ctx) to renderSkyVisplane with the captured context', () => {
    const ctx = context();
    let args: { plane: Visplane; sameCtx: boolean } | null = null;
    const onSkyPlane = makeSkyPlaneDrawer(ctx, {
      renderSkyVisplaneFn: (plane, passedCtx) => {
        args = { plane, sameCtx: passedCtx === ctx };
      },
    });

    const pl = visplane(2);
    onSkyPlane(pl);

    expect(args!.plane).toBe(pl);
    expect(args!.sameCtx).toBe(true);
  });

  test('the same context is threaded across every sky plane (deterministic)', () => {
    const ctx = context();
    const seen: boolean[] = [];
    const onSkyPlane = makeSkyPlaneDrawer(ctx, {
      renderSkyVisplaneFn: (_plane, passedCtx) => {
        seen.push(passedCtx === ctx);
      },
    });
    onSkyPlane(visplane(2));
    onSkyPlane(visplane(2));
    expect(seen).toEqual([true, true]);
  });

  test('with no hooks the default committed sky pass is bound (callable closure)', () => {
    expect(typeof makeSkyPlaneDrawer(context())).toBe('function');
  });
});
