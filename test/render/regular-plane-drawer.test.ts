import { describe, expect, test } from 'bun:test';

import type { Visplane } from '../../src/render/renderLimits.ts';
import type { RegularPlaneDrawerConfig } from '../../src/render/regularPlaneDrawer.ts';
import { makeRegularPlaneDrawer } from '../../src/render/regularPlaneDrawer.ts';
import type { VisplaneSpanContext } from '../../src/render/visplaneSpans.ts';

const LIGHTLEVELS = 16;
const zlightRows: readonly (readonly Uint8Array[])[] = Array.from({ length: LIGHTLEVELS }, (_unused, i) => Object.freeze([new Uint8Array([i])]));

const FLATS = new Map<number, Uint8Array>([
  [3, new Uint8Array(4096).fill(3)],
  [7, new Uint8Array(4096).fill(7)],
]);

function config(overrides: Partial<RegularPlaneDrawerConfig> = {}): RegularPlaneDrawerConfig {
  return {
    viewz: 41 << 16,
    extralight: 0,
    fixedColormap: null,
    zlightRows,
    flatSource: (picnum) => FLATS.get(picnum)!,
    viewX: 100,
    viewY: 200,
    viewAngle: 0x4000_0000,
    baseXScale: 11,
    baseYScale: 22,
    ySlope: new Int32Array(8),
    distScale: new Int32Array(8),
    xToViewAngle: new Int32Array(9),
    cachedHeight: new Int32Array(8),
    cachedDistance: new Int32Array(8),
    cachedXStep: new Int32Array(8),
    cachedYStep: new Int32Array(8),
    spanStart: new Int32Array(8),
    framebuffer: new Uint8Array(64),
    ...overrides,
  };
}

function visplane(height: number, picnum: number, lightlevel: number): Visplane {
  return { height, picnum, lightlevel, minx: 0, maxx: 1, top: new Uint8Array(2), bottom: new Uint8Array(2) };
}

function capture(cfg: RegularPlaneDrawerConfig, plane: Visplane): VisplaneSpanContext {
  let ctx: VisplaneSpanContext | null = null;
  const onRegularPlane = makeRegularPlaneDrawer(cfg, {
    renderVisplaneSpansFn: (_plane, passedCtx) => {
      ctx = passedCtx;
    },
  });
  onRegularPlane(plane);
  expect(ctx).not.toBeNull();
  return ctx!;
}

describe('regularPlaneDrawer: makeRegularPlaneDrawer — R_DrawPlanes non-sky per-plane prologue', () => {
  test('planeHeight = abs(pl->height - viewz) and ds_source = flat for pl->picnum', () => {
    const cfg = config();
    const above = capture(cfg, visplane(200 << 16, 7, 160));
    expect(above.planeHeight).toBe(Math.abs((200 << 16) - (41 << 16)));
    expect(above.flatSource).toBe(FLATS.get(7)!);

    const below = capture(cfg, visplane(0, 3, 160));
    expect(below.planeHeight).toBe(Math.abs(0 - (41 << 16)));
    expect(below.flatSource).toBe(FLATS.get(3)!);
  });

  test('planezlight = zlight[clamp((lightlevel >> LIGHTSEGSHIFT) + extralight, 0, LIGHTLEVELS-1)]', () => {
    // 160 >> 4 = 10, extralight 0 → row 10.
    expect(capture(config(), visplane(0, 7, 160)).planeZLight).toBe(zlightRows[10]!);
    // 160 >> 4 = 10, extralight 8 → 18 → clamp 15.
    expect(capture(config({ extralight: 8 }), visplane(0, 7, 160)).planeZLight).toBe(zlightRows[15]!);
    // 0 >> 4 = 0 → row 0 (no negative underflow).
    expect(capture(config(), visplane(0, 7, 0)).planeZLight).toBe(zlightRows[0]!);
  });

  test('frame-static span state is threaded by reference; fixedColormap passes through', () => {
    const fixed = new Uint8Array(256);
    const cfg = config({ fixedColormap: fixed });
    const ctx = capture(cfg, visplane(0, 7, 128));
    expect(ctx.fixedColormap).toBe(fixed);
    expect(ctx.ySlope).toBe(cfg.ySlope);
    expect(ctx.spanStart).toBe(cfg.spanStart);
    expect(ctx.xToViewAngle).toBe(cfg.xToViewAngle);
    expect(ctx.framebuffer).toBe(cfg.framebuffer);
    expect(ctx.baseXScale).toBe(11);
    expect(ctx.viewAngle).toBe(0x4000_0000);
  });

  test('is deterministic — the same plane yields identical derived context', () => {
    const cfg = config();
    const a = capture(cfg, visplane(96 << 16, 3, 144));
    const b = capture(cfg, visplane(96 << 16, 3, 144));
    expect(a.planeHeight).toBe(b.planeHeight);
    expect(a.planeZLight).toBe(b.planeZLight);
    expect(a.flatSource).toBe(b.flatSource);
  });

  test('a clamped light index missing zlightRows is a hard error (no silent wrong colormap)', () => {
    const shortCfg = config({ zlightRows: [Object.freeze([new Uint8Array(1)])] }); // only row 0
    const onRegularPlane = makeRegularPlaneDrawer(shortCfg);
    expect(() => onRegularPlane(visplane(0, 7, 160))).toThrow(RangeError); // wants row 10
  });

  test('with no hooks the default committed span pass is bound (callable closure)', () => {
    expect(typeof makeRegularPlaneDrawer(config())).toBe('function');
  });
});
