import { describe, expect, test } from 'bun:test';

import { ANG90 } from '../../src/core/angle.ts';
import { FRACUNIT, fixedDiv } from '../../src/core/fixed.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../../src/core/trig.ts';

import type { AssembledPlaneRenderersConfig } from '../../src/render/assembledPlaneRenderers.ts';
import { makeAssembledPlaneRenderers } from '../../src/render/assembledPlaneRenderers.ts';
import { DetailMode, NUMCOLORMAPS, computeViewport } from '../../src/render/projection.ts';
import { buildPlaneProjectionTables, buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import type { SetupFramePlayer } from '../../src/render/setupFrame.ts';
import { setupFrame } from '../../src/render/setupFrame.ts';
import type { SkyRenderContext } from '../../src/render/sky.ts';
import type { VisplaneSpanContext } from '../../src/render/visplaneSpans.ts';
import type { PreparedWallTexture } from '../../src/render/wallColumns.ts';

const viewport = computeViewport(11, DetailMode.high);
const projectionAngles = buildProjectionAngleTables(viewport);
const planeTables = buildPlaneProjectionTables(viewport, projectionAngles.xtoviewangle);
// xtoviewangle holds angle_t (BAM, unsigned); the committed sky/span
// contexts type it Int32Array — a zero-copy view reinterprets the
// identical 32-bit patterns the renderers read.
const xToViewAngleI32 = new Int32Array(projectionAngles.xtoviewangle.buffer, projectionAngles.xtoviewangle.byteOffset, projectionAngles.xtoviewangle.length);
const colormaps: readonly Uint8Array[] = Array.from({ length: NUMCOLORMAPS }, () => new Uint8Array(256));
const zlightRows: readonly (readonly Uint8Array[])[] = Array.from({ length: 16 }, (_u, i) => Object.freeze([new Uint8Array([i])]));

function skyTexture(): PreparedWallTexture {
  return Object.freeze({ name: 'SKY1', width: 256, height: 128, widthMask: 255, composite: new Uint8Array(1), columns: Object.freeze([new Uint8Array(1)]) });
}

function config(): AssembledPlaneRenderersConfig {
  return {
    skyTexture: skyTexture(),
    baseColormap: colormaps[0]!,
    skyIscale: 1234,
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

function player(fixedColormap = 0): SetupFramePlayer {
  return { mobjX: 96 << 16, mobjY: -128 << 16, mobjAngle: 0x2000_0000, viewz: 41 * FRACUNIT, extralight: 2, fixedColormap };
}

function visplane(picnum: number): Visplane {
  return { height: 0, picnum, lightlevel: 160, minx: 0, maxx: 1, top: new Uint8Array(2), bottom: new Uint8Array(2) };
}

describe('assembledPlaneRenderers: makeAssembledPlaneRenderers — R_DrawPlanes frame binding', () => {
  test('sky drawer gets the frame viewangle + the static sky context', () => {
    const cfg = config();
    const frame = setupFrame(player());
    let skyCtx: SkyRenderContext | null = null;
    const { onSkyPlane } = makeAssembledPlaneRenderers(cfg, { renderSkyVisplaneFn: (_p, ctx) => void (skyCtx = ctx) })(frame);
    onSkyPlane(visplane(99));

    expect(skyCtx!.viewAngle).toBe(frame.viewangle);
    expect(skyCtx!.skyTexture).toBe(cfg.skyTexture);
    expect(skyCtx!.baseColormap).toBe(colormaps[0]!);
    expect(skyCtx!.iscale).toBe(1234);
    expect(skyCtx!.centerY).toBe(viewport.centerY);
    expect(skyCtx!.framebuffer).toBe(cfg.framebuffer);
  });

  test('regular drawer derives basexscale/baseyscale verbatim from R_ClearPlanes', () => {
    const cfg = config();
    const frame = setupFrame(player());
    let spanCtx: VisplaneSpanContext | null = null;
    const { onRegularPlane } = makeAssembledPlaneRenderers(cfg, { renderVisplaneSpansFn: (_p, ctx) => void (spanCtx = ctx) })(frame);
    onRegularPlane(visplane(7));

    // Independent re-derivation: angle = (viewangle-ANG90)>>ANGLETOFINESHIFT
    // (angle_t unsigned wrap), basexscale = FixedDiv(finecosine[angle],
    // centerxfrac), baseyscale = -FixedDiv(finesine[angle], centerxfrac).
    const angle = ((frame.viewangle - ANG90) >>> 0) >>> ANGLETOFINESHIFT;
    expect(spanCtx!.baseXScale).toBe(fixedDiv(finecosine[angle]!, viewport.centerXFrac));
    expect(spanCtx!.baseYScale).toBe(-fixedDiv(finesine[angle]!, viewport.centerXFrac));
    expect(spanCtx!.viewX).toBe(frame.viewx);
    expect(spanCtx!.viewY).toBe(frame.viewy);
    expect(spanCtx!.viewAngle).toBe(frame.viewangle);
    expect(spanCtx!.ySlope).toBe(planeTables.yslope);
    expect(spanCtx!.distScale).toBe(planeTables.distscale);
    expect(spanCtx!.spanStart).toBe(cfg.spanScratch.spanStart);
  });

  test('no fixedcolormap → null; a valid one threads the ramp; out-of-range throws', () => {
    const cfg = config();
    let spanCtx: VisplaneSpanContext | null = null;
    const captureRegular = { renderVisplaneSpansFn: (_p: Visplane, ctx: VisplaneSpanContext) => void (spanCtx = ctx) };

    makeAssembledPlaneRenderers(cfg, captureRegular)(setupFrame(player(0))).onRegularPlane(visplane(7));
    expect(spanCtx!.fixedColormap).toBeNull();

    makeAssembledPlaneRenderers(cfg, captureRegular)(setupFrame(player(1))).onRegularPlane(visplane(7));
    expect(spanCtx!.fixedColormap).toBe(colormaps[1]!);

    expect(() => makeAssembledPlaneRenderers(cfg)(setupFrame(player(9999)))).toThrow(RangeError);
  });

  test('is deterministic — the same frame yields identical derived scales', () => {
    const cfg = config();
    const frame = setupFrame(player());
    let a: VisplaneSpanContext | null = null;
    let b: VisplaneSpanContext | null = null;
    makeAssembledPlaneRenderers(cfg, { renderVisplaneSpansFn: (_p, c) => void (a = c) })(frame).onRegularPlane(visplane(7));
    makeAssembledPlaneRenderers(cfg, { renderVisplaneSpansFn: (_p, c) => void (b = c) })(frame).onRegularPlane(visplane(7));
    expect(a!.baseXScale).toBe(b!.baseXScale);
    expect(a!.baseYScale).toBe(b!.baseYScale);
    expect(a!.planeHeight).toBe(b!.planeHeight);
  });

  test('with no hooks both default committed passes are bound (callable closures)', () => {
    const { onSkyPlane, onRegularPlane } = makeAssembledPlaneRenderers(config())(setupFrame(player()));
    expect(typeof onSkyPlane).toBe('function');
    expect(typeof onRegularPlane).toBe('function');
  });
});
