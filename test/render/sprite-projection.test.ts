import { describe, expect, test } from 'bun:test';

import { ANG90, ANG180, ANG270 } from '../../src/core/angle.ts';
import { FRACBITS, FRACUNIT, fixedDiv, fixedMul } from '../../src/core/fixed.ts';
import { LIGHTSCALESHIFT, MAXLIGHTSCALE } from '../../src/render/projection.ts';
import type { ProjectableThing, SpriteDef, SpriteFrame, SpriteMetrics, SpriteProjectionContext } from '../../src/render/spriteProjection.ts';
import { FF_FRAMEMASK, FF_FULLBRIGHT, MAXVISSPRITES, MINZ, clearSprites, createVisSpritePool, newVisSprite, projectSprite } from '../../src/render/spriteProjection.ts';

const MF_SHADOW = 0x40000;

interface MetricsSpec {
  readonly offset?: number;
  readonly width?: number;
  readonly topOffset?: number;
  readonly lumps?: number;
}

function makeMetrics(spec: MetricsSpec = {}): SpriteMetrics {
  const lumps = spec.lumps ?? 8;
  const offsetArr = new Int32Array(lumps);
  const widthArr = new Int32Array(lumps);
  const topOffsetArr = new Int32Array(lumps);
  const off = spec.offset ?? 0;
  const w = spec.width ?? 32 << FRACBITS;
  const tOff = spec.topOffset ?? 48 << FRACBITS;
  for (let i = 0; i < lumps; i += 1) {
    offsetArr[i] = off;
    widthArr[i] = w;
    topOffsetArr[i] = tOff;
  }
  return { offset: offsetArr, topOffset: topOffsetArr, width: widthArr };
}

function makeFrame(rotate: boolean, flip: readonly boolean[] = [false, false, false, false, false, false, false, false]): SpriteFrame {
  return { rotate, lump: [0, 1, 2, 3, 4, 5, 6, 7], flip };
}

function makeSprites(frame: SpriteFrame): readonly SpriteDef[] {
  return [{ numFrames: 2, frames: [frame, frame] }];
}

function makeSpriteLights(): readonly Uint8Array[] {
  const lights: Uint8Array[] = [];
  for (let i = 0; i < MAXLIGHTSCALE; i += 1) {
    const row = new Uint8Array(256);
    row[0] = i;
    lights.push(row);
  }
  return lights;
}

interface ContextOverrides {
  readonly viewX?: number;
  readonly viewY?: number;
  readonly viewZ?: number;
  readonly viewCos?: number;
  readonly viewSin?: number;
  readonly viewWidth?: number;
  readonly centerXFrac?: number;
  readonly projection?: number;
  readonly detailShift?: number;
  readonly fixedColormap?: Uint8Array | null;
  readonly spriteMetrics?: SpriteMetrics;
  readonly sprites?: readonly SpriteDef[];
  readonly spriteLights?: readonly Uint8Array[];
  readonly colormaps?: Uint8Array;
}

function makeContext(overrides: ContextOverrides = {}): SpriteProjectionContext {
  return {
    viewX: overrides.viewX ?? 0,
    viewY: overrides.viewY ?? 0,
    viewZ: overrides.viewZ ?? 0,
    viewCos: overrides.viewCos ?? FRACUNIT,
    viewSin: overrides.viewSin ?? 0,
    projection: overrides.projection ?? 160 << FRACBITS,
    centerXFrac: overrides.centerXFrac ?? 160 << FRACBITS,
    viewWidth: overrides.viewWidth ?? 320,
    detailShift: overrides.detailShift ?? 0,
    sprites: overrides.sprites ?? makeSprites(makeFrame(false)),
    spriteMetrics: overrides.spriteMetrics ?? makeMetrics(),
    fixedColormap: overrides.fixedColormap ?? null,
    spriteLights: overrides.spriteLights ?? makeSpriteLights(),
    colormaps: overrides.colormaps ?? new Uint8Array(256),
  };
}

function makeThing(overrides: Partial<ProjectableThing> = {}): ProjectableThing {
  return {
    x: overrides.x ?? 128 << FRACBITS,
    y: overrides.y ?? 0,
    z: overrides.z ?? 0,
    angle: overrides.angle ?? 0,
    sprite: overrides.sprite ?? 0,
    frame: overrides.frame ?? 0,
    flags: overrides.flags ?? 0,
  };
}

describe('sprite-projection constants (r_things.c + p_pspr.h)', () => {
  test('MINZ equals FRACUNIT * 4 (near clip plane)', () => {
    expect(MINZ).toBe(FRACUNIT * 4);
    expect(MINZ).toBe(0x40000);
  });

  test('MAXVISSPRITES matches vanilla pool size (128)', () => {
    expect(MAXVISSPRITES).toBe(128);
  });

  test('FF_FRAMEMASK isolates the low 15 bits of frame', () => {
    expect(FF_FRAMEMASK).toBe(0x7fff);
  });

  test('FF_FULLBRIGHT is bit 15 of frame', () => {
    expect(FF_FULLBRIGHT).toBe(0x8000);
  });
});

describe('createVisSpritePool / clearSprites / newVisSprite', () => {
  test('createVisSpritePool allocates MAXVISSPRITES zeroed slots plus an overflow sentinel', () => {
    const pool = createVisSpritePool();
    expect(pool.sprites.length).toBe(MAXVISSPRITES);
    expect(pool.count).toBe(0);
    expect(pool.overflow).toBeDefined();
    for (const vis of pool.sprites) {
      expect(vis.x1).toBe(0);
      expect(vis.x2).toBe(0);
      expect(vis.scale).toBe(0);
      expect(vis.patch).toBe(0);
      expect(vis.colormap).toBeNull();
      expect(vis.mobjFlags).toBe(0);
    }
    expect(pool.overflow.x1).toBe(0);
    expect(pool.overflow.colormap).toBeNull();
  });

  test('newVisSprite returns slot 0 first and advances count', () => {
    const pool = createVisSpritePool();
    const first = newVisSprite(pool);
    expect(first).toBe(pool.sprites[0]!);
    expect(pool.count).toBe(1);
    const second = newVisSprite(pool);
    expect(second).toBe(pool.sprites[1]!);
    expect(pool.count).toBe(2);
  });

  test('newVisSprite returns the shared overflow slot once the pool is full', () => {
    const pool = createVisSpritePool();
    for (let i = 0; i < MAXVISSPRITES; i += 1) {
      newVisSprite(pool);
    }
    expect(pool.count).toBe(MAXVISSPRITES);
    const overflow1 = newVisSprite(pool);
    const overflow2 = newVisSprite(pool);
    expect(overflow1).toBe(pool.overflow);
    expect(overflow2).toBe(pool.overflow);
    expect(pool.count).toBe(MAXVISSPRITES);
  });

  test('clearSprites resets count to 0 so slot 0 is reused', () => {
    const pool = createVisSpritePool();
    newVisSprite(pool);
    newVisSprite(pool);
    newVisSprite(pool);
    expect(pool.count).toBe(3);
    clearSprites(pool);
    expect(pool.count).toBe(0);
    const reused = newVisSprite(pool);
    expect(reused).toBe(pool.sprites[0]!);
  });

  test('clearSprites does NOT zero previously-used slot fields (vanilla parity)', () => {
    const pool = createVisSpritePool();
    const first = newVisSprite(pool);
    first.x1 = 42;
    first.scale = 0x12345;
    clearSprites(pool);
    expect(pool.sprites[0]!.x1).toBe(42);
    expect(pool.sprites[0]!.scale).toBe(0x12345);
  });
});

describe('projectSprite rejection gates (R_ProjectSprite early returns)', () => {
  test('rejects when tz < MINZ (thing inside near clip plane)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext();
    const thing = makeThing({ x: 1 << FRACBITS });
    expect(projectSprite(thing, ctx, pool)).toBeNull();
    expect(pool.count).toBe(0);
  });

  test('rejects when tz is negative (thing behind the viewer)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext();
    const thing = makeThing({ x: -200 << FRACBITS });
    expect(projectSprite(thing, ctx, pool)).toBeNull();
    expect(pool.count).toBe(0);
  });

  test('accepts when tz === MINZ (boundary condition)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext();
    const thing = makeThing({ x: 4 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
  });

  test('rejects when |tx| > tz << 2 (outside FOV cone)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext();
    const thing = makeThing({ x: 100 << FRACBITS, y: 500 << FRACBITS });
    expect(projectSprite(thing, ctx, pool)).toBeNull();
    expect(pool.count).toBe(0);
  });

  test('rejects when x1 > viewWidth (sprite off right edge)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({ viewWidth: 80, centerXFrac: 40 << FRACBITS, projection: 40 << FRACBITS });
    const thing = makeThing({ x: 100 << FRACBITS, y: -380 << FRACBITS });
    expect(projectSprite(thing, ctx, pool)).toBeNull();
    expect(pool.count).toBe(0);
  });

  test('rejects when x2 < 0 (sprite off left edge)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({
      spriteMetrics: makeMetrics({ offset: 0, width: 1 << FRACBITS }),
    });
    const thing = makeThing({ x: 100 << FRACBITS, y: 380 << FRACBITS });
    expect(projectSprite(thing, ctx, pool)).toBeNull();
    expect(pool.count).toBe(0);
  });
});

describe('projectSprite normal path (R_ProjectSprite fill-in)', () => {
  test('fills every vissprite field for a thing directly ahead', () => {
    const pool = createVisSpritePool();
    const lights = makeSpriteLights();
    const ctx = makeContext({
      spriteMetrics: makeMetrics({ offset: 0, width: 32 << FRACBITS, topOffset: 48 << FRACBITS }),
      spriteLights: lights,
    });
    const thing = makeThing({ x: 128 << FRACBITS, z: 10 << FRACBITS, flags: 0x12345 });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!).toBe(pool.sprites[0]!);

    const tz = 128 << FRACBITS;
    const expectedXScale = fixedDiv(ctx.projection, tz);
    const expectedIScale = fixedDiv(FRACUNIT, expectedXScale);
    const expectedX2 = ((ctx.centerXFrac + fixedMul(32 << FRACBITS, expectedXScale)) >> FRACBITS) - 1;
    let expectedLightIndex = expectedXScale >> (LIGHTSCALESHIFT - ctx.detailShift);
    if (expectedLightIndex >= MAXLIGHTSCALE) expectedLightIndex = MAXLIGHTSCALE - 1;

    expect(vis!.scale).toBe(expectedXScale);
    expect(vis!.gx).toBe(128 << FRACBITS);
    expect(vis!.gy).toBe(0);
    expect(vis!.gz).toBe(10 << FRACBITS);
    expect(vis!.gzt).toBe((10 << FRACBITS) + (48 << FRACBITS));
    expect(vis!.textureMid).toBe(vis!.gzt);
    expect(vis!.patch).toBe(0);
    expect(vis!.mobjFlags).toBe(0x12345);
    expect(vis!.x1).toBe(ctx.centerXFrac >> FRACBITS);
    expect(vis!.x2).toBe(expectedX2);
    expect(vis!.xIscale).toBe(expectedIScale);
    expect(vis!.startFrac).toBe(0);
    expect(vis!.colormap).toBe(lights[expectedLightIndex]!);
    expect(pool.count).toBe(1);
  });

  test('fills the overflow sentinel when the pool is already full', () => {
    const pool = createVisSpritePool();
    for (let i = 0; i < MAXVISSPRITES; i += 1) newVisSprite(pool);
    const ctx = makeContext();
    const thing = makeThing({ x: 128 << FRACBITS, z: 5 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).toBe(pool.overflow);
    expect(pool.overflow.gz).toBe(5 << FRACBITS);
    expect(pool.count).toBe(MAXVISSPRITES);
  });

  test('second projection on the same frame fills slot 1, not slot 0', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext();
    const a = projectSprite(makeThing({ x: 128 << FRACBITS }), ctx, pool);
    const b = projectSprite(makeThing({ x: 64 << FRACBITS }), ctx, pool);
    expect(a).toBe(pool.sprites[0]!);
    expect(b).toBe(pool.sprites[1]!);
    expect(pool.count).toBe(2);
  });

  test('textureMid subtracts viewZ from gzt (exercises non-zero viewZ)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({
      viewZ: 41 << FRACBITS,
      spriteMetrics: makeMetrics({ offset: 0, width: 32 << FRACBITS, topOffset: 48 << FRACBITS }),
    });
    const thing = makeThing({ x: 128 << FRACBITS, z: 100 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.gzt).toBe((100 + 48) << FRACBITS);
    expect(vis!.textureMid).toBe(((100 + 48) << FRACBITS) - (41 << FRACBITS));
    expect(vis!.textureMid).not.toBe(vis!.gzt);
  });
});

describe('projectSprite clip adjustment (R_ProjectSprite x1/x2 clamp + startFrac fix)', () => {
  test('clamps x1 to 0 and advances startFrac by xIscale * (vis.x1 - rawX1)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({
      spriteMetrics: makeMetrics({ offset: 16 << FRACBITS, width: 200 << FRACBITS }),
    });
    const thing = makeThing({ x: 10 << FRACBITS, y: 30 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();

    const tz = 10 << FRACBITS;
    const xscale = fixedDiv(ctx.projection, tz);
    const xIscale = fixedDiv(FRACUNIT, xscale);
    const rawTx = (-30 << FRACBITS) - (16 << FRACBITS);
    const rawX1 = (ctx.centerXFrac + fixedMul(rawTx, xscale)) >> FRACBITS;

    expect(rawX1).toBeLessThan(0);
    expect(vis!.x1).toBe(0);
    expect(vis!.xIscale).toBe(xIscale);
    expect(vis!.startFrac).toBe((0 + xIscale * (0 - rawX1)) | 0);
  });

  test('clamps x2 to viewWidth - 1 for right-clipped sprite', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({
      spriteMetrics: makeMetrics({ offset: 0, width: 200 << FRACBITS }),
      viewWidth: 80,
      centerXFrac: 40 << FRACBITS,
      projection: 40 << FRACBITS,
    });
    const thing = makeThing({ x: 10 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.x1).toBe(40);
    expect(vis!.x2).toBe(79);
  });

  test('no startFrac adjustment when sprite is fully on-screen (vis.x1 === rawX1)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext();
    const thing = makeThing({ x: 128 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.startFrac).toBe(0);
  });
});

describe('projectSprite sprite rotation selection (rotate === true)', () => {
  test('rot 0 when thing faces the viewer (thing.angle = ANG180)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({ sprites: makeSprites(makeFrame(true)) });
    const thing = makeThing({ x: 128 << FRACBITS, angle: ANG180 });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.patch).toBe(0);
  });

  test('rot 4 when thing faces away from the viewer (thing.angle = 0)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({ sprites: makeSprites(makeFrame(true)) });
    const thing = makeThing({ x: 128 << FRACBITS, angle: 0 });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.patch).toBe(4);
  });

  test('rot 2 when viewer sees the right side of the thing (thing.angle = ANG90)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({ sprites: makeSprites(makeFrame(true)) });
    const thing = makeThing({ x: 128 << FRACBITS, angle: ANG90 });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.patch).toBe(2);
  });

  test('rot 6 when viewer sees the left side of the thing (thing.angle = ANG270)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({ sprites: makeSprites(makeFrame(true)) });
    const thing = makeThing({ x: 128 << FRACBITS, angle: ANG270 });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.patch).toBe(6);
  });

  test('odd rotation sectors 1/3/5/7 are reachable via 45-degree offsets', () => {
    // rot = ((viewToThingAngle - thing.angle + 0x90000000) >>> 29) & 7.
    // For a thing straight ahead the view-to-thing angle is 0, so each rot
    // centers at thing.angle = (ANG180 - rot * ANG45) mod 2^32.
    const ctx = makeContext({ sprites: makeSprites(makeFrame(true)) });
    const cases: { angle: number; expected: number }[] = [
      { angle: (ANG90 + ANG90 / 2) | 0, expected: 1 },
      { angle: (ANG90 / 2) | 0, expected: 3 },
      { angle: (ANG270 + ANG90 / 2) | 0, expected: 5 },
      { angle: (ANG180 + ANG90 / 2) | 0, expected: 7 },
    ];
    for (const { angle, expected } of cases) {
      const pool = createVisSpritePool();
      const thing = makeThing({ x: 128 << FRACBITS, angle });
      const vis = projectSprite(thing, ctx, pool);
      expect(vis).not.toBeNull();
      expect(vis!.patch).toBe(expected);
    }
  });

  test('rotate === false always picks lump[0] regardless of thing.angle', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({ sprites: makeSprites(makeFrame(false)) });
    const thing = makeThing({ x: 128 << FRACBITS, angle: ANG90 });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.patch).toBe(0);
  });
});

describe('projectSprite flip handling', () => {
  test('non-flipped sprite starts at U = 0 with positive xIscale', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext();
    const thing = makeThing({ x: 128 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.startFrac).toBe(0);
    expect(vis!.xIscale).toBeGreaterThan(0);
  });

  test('flipped sprite starts at U = width - 1 with negative xIscale', () => {
    const pool = createVisSpritePool();
    const flipFlags: readonly boolean[] = [true, true, true, true, true, true, true, true];
    const frame: SpriteFrame = { rotate: false, lump: [0, 1, 2, 3, 4, 5, 6, 7], flip: flipFlags };
    const spriteWidth = 32 << FRACBITS;
    const ctx = makeContext({
      sprites: [{ numFrames: 1, frames: [frame] }],
      spriteMetrics: makeMetrics({ width: spriteWidth }),
    });
    const thing = makeThing({ x: 128 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.startFrac).toBe(spriteWidth - 1);
    expect(vis!.xIscale).toBeLessThan(0);

    const tz = 128 << FRACBITS;
    const xscale = fixedDiv(ctx.projection, tz);
    expect(vis!.xIscale).toBe(-fixedDiv(FRACUNIT, xscale) | 0);
  });
});

describe('projectSprite colormap priority', () => {
  test('MF_SHADOW overrides every other colormap source (priority 1)', () => {
    const pool = createVisSpritePool();
    const fixed = new Uint8Array(256);
    const ctx = makeContext({ fixedColormap: fixed });
    const thing = makeThing({ x: 128 << FRACBITS, flags: MF_SHADOW, frame: FF_FULLBRIGHT });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.colormap).toBeNull();
  });

  test('fixedColormap overrides FF_FULLBRIGHT and diminishing (priority 2)', () => {
    const pool = createVisSpritePool();
    const fixed = new Uint8Array(256);
    fixed[0] = 0xaa;
    const ctx = makeContext({ fixedColormap: fixed });
    const thing = makeThing({ x: 128 << FRACBITS, frame: FF_FULLBRIGHT });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.colormap).toBe(fixed);
  });

  test('FF_FULLBRIGHT uses colormaps (priority 3) when no MF_SHADOW or fixedColormap', () => {
    const pool = createVisSpritePool();
    const colormaps = new Uint8Array(256);
    colormaps[0] = 0xbb;
    const ctx = makeContext({ colormaps });
    const thing = makeThing({ x: 128 << FRACBITS, frame: FF_FULLBRIGHT | 1 });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.colormap).toBe(colormaps);
  });

  test('default path uses spriteLights[xscale >> (LIGHTSCALESHIFT - detailShift)] (priority 4)', () => {
    const pool = createVisSpritePool();
    const lights = makeSpriteLights();
    const ctx = makeContext({ spriteLights: lights });
    const thing = makeThing({ x: 128 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();

    const xscale = fixedDiv(ctx.projection, 128 << FRACBITS);
    let expectedIndex = xscale >> (LIGHTSCALESHIFT - ctx.detailShift);
    if (expectedIndex >= MAXLIGHTSCALE) expectedIndex = MAXLIGHTSCALE - 1;
    expect(vis!.colormap).toBe(lights[expectedIndex]!);
  });

  test('default path clamps light index to MAXLIGHTSCALE - 1 when sprite is close', () => {
    const pool = createVisSpritePool();
    const lights = makeSpriteLights();
    const ctx = makeContext({ spriteLights: lights });
    const thing = makeThing({ x: 5 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.colormap).toBe(lights[MAXLIGHTSCALE - 1]!);
  });

  test('detailShift = 1 shifts xscale by (LIGHTSCALESHIFT - 1) so the index doubles', () => {
    const lights = makeSpriteLights();
    const poolHigh = createVisSpritePool();
    const poolLow = createVisSpritePool();
    const ctxHigh = makeContext({ detailShift: 0, spriteLights: lights });
    const ctxLow = makeContext({ detailShift: 1, spriteLights: lights });
    const thing = makeThing({ x: 128 << FRACBITS });
    const visHigh = projectSprite(thing, ctxHigh, poolHigh);
    const visLow = projectSprite(thing, ctxLow, poolLow);
    expect(visHigh).not.toBeNull();
    expect(visLow).not.toBeNull();

    const xscale = fixedDiv(160 << FRACBITS, 128 << FRACBITS);
    let idxHigh = xscale >> LIGHTSCALESHIFT;
    if (idxHigh >= MAXLIGHTSCALE) idxHigh = MAXLIGHTSCALE - 1;
    let idxLow = xscale >> (LIGHTSCALESHIFT - 1);
    if (idxLow >= MAXLIGHTSCALE) idxLow = MAXLIGHTSCALE - 1;

    expect(visHigh!.colormap).toBe(lights[idxHigh]!);
    expect(visLow!.colormap).toBe(lights[idxLow]!);
  });
});

describe('projectSprite scale / detailShift', () => {
  test('vis.scale === xscale << detailShift (low-detail doubles the per-column scale)', () => {
    const pool = createVisSpritePool();
    const ctx = makeContext({ detailShift: 1 });
    const thing = makeThing({ x: 128 << FRACBITS });
    const vis = projectSprite(thing, ctx, pool);
    expect(vis).not.toBeNull();
    const xscale = fixedDiv(ctx.projection, 128 << FRACBITS);
    expect(vis!.scale).toBe(xscale << 1);
  });
});

describe('projectSprite frame index masking', () => {
  test('FF_FULLBRIGHT bit in frame does not affect the frame-table lookup', () => {
    const pool = createVisSpritePool();
    const frameA: SpriteFrame = { rotate: false, lump: [10, 11, 12, 13, 14, 15, 16, 17], flip: [false, false, false, false, false, false, false, false] };
    const frameB: SpriteFrame = { rotate: false, lump: [20, 21, 22, 23, 24, 25, 26, 27], flip: [false, false, false, false, false, false, false, false] };
    const ctx = makeContext({ sprites: [{ numFrames: 2, frames: [frameA, frameB] }] });
    const thingFullBright = makeThing({ x: 128 << FRACBITS, frame: 1 | FF_FULLBRIGHT });
    const vis = projectSprite(thingFullBright, ctx, pool);
    expect(vis).not.toBeNull();
    expect(vis!.patch).toBe(20);
  });
});
