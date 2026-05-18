import { describe, expect, test } from 'bun:test';

import { addSprites } from '../../src/render/addSprites.ts';
import type { AddSpritesProjection } from '../../src/render/addSprites.ts';
import { createVisSpritePool } from '../../src/render/spriteProjection.ts';
import type { ProjectableThing, SpriteDef, SpriteMetrics } from '../../src/render/spriteProjection.ts';

const SPRITES: readonly SpriteDef[] = Object.freeze([
  Object.freeze({ numFrames: 1, frames: Object.freeze([Object.freeze({ rotate: false, lump: Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]), flip: Object.freeze([false, false, false, false, false, false, false, false]) })]) }),
]);
const METRICS: SpriteMetrics = Object.freeze({ offset: new Int32Array(1), topOffset: new Int32Array(1), width: new Int32Array(1) });

const PROJECTION: AddSpritesProjection = Object.freeze({
  viewX: 0,
  viewY: 0,
  viewZ: 0,
  viewCos: 0,
  viewSin: 0,
  projection: 160 << 16,
  centerXFrac: 160 << 16,
  viewWidth: 320,
  detailShift: 0,
  sprites: SPRITES,
  spriteMetrics: METRICS,
  fixedColormap: null,
  colormaps: new Uint8Array(256),
});

// scalelight[16][...]; distinct row markers to verify lightnum selection.
const SCALELIGHT: readonly (readonly Uint8Array[])[] = Array.from({ length: 16 }, (_u, i) => Object.freeze([new Uint8Array([i])]));

function thing(sprite: number): ProjectableThing {
  return Object.freeze({ x: 0, y: 0, z: 0, angle: 0, sprite, frame: 0, flags: 0 });
}

describe('addSprites: R_AddSprites — per-sector thing collection', () => {
  test('projects every thing in the sector with scalelight[clamped lightnum]', () => {
    const pool = createVisSpritePool();
    const seen: Array<{ sprite: number; lights: readonly Uint8Array[] }> = [];
    const added = new Set<number>();
    const things = [thing(0), thing(0), thing(0)];
    // lightlevel 160 >> 4 = 10, extralight 0 → row 10.
    addSprites(5, 160, things, SCALELIGHT, 0, PROJECTION, pool, added, {
      projectSpriteFn: (t, ctx) => {
        seen.push({ sprite: t.sprite, lights: ctx.spriteLights });
        return null;
      },
    });
    expect(seen.length).toBe(3);
    expect(seen.every((s) => s.lights === SCALELIGHT[10]!)).toBe(true);
    expect(added.has(5)).toBe(true);
  });

  test('sec->validcount guard: a sector contributes its things at most once per frame', () => {
    const pool = createVisSpritePool();
    let calls = 0;
    const added = new Set<number>();
    const hooks = {
      projectSpriteFn: () => {
        calls += 1;
        return null;
      },
    };
    addSprites(7, 128, [thing(0), thing(0)], SCALELIGHT, 0, PROJECTION, pool, added, hooks);
    addSprites(7, 128, [thing(0), thing(0)], SCALELIGHT, 0, PROJECTION, pool, added, hooks); // same sector, same frame
    expect(calls).toBe(2); // only the first call projected; second short-circuited
  });

  test('lightnum clamps to [0, LIGHTLEVELS-1] with extralight (no orientation tweak)', () => {
    const pool = createVisSpritePool();
    let lights: readonly Uint8Array[] | null = null;
    const grab = {
      projectSpriteFn: (_t: ProjectableThing, ctx: { spriteLights: readonly Uint8Array[] }) => {
        lights = ctx.spriteLights;
        return null;
      },
    };
    // 160>>4=10, extralight 8 → 18 → clamp 15.
    addSprites(1, 160, [thing(0)], SCALELIGHT, 8, PROJECTION, pool, new Set(), grab);
    expect(lights === SCALELIGHT[15]).toBe(true);
    // 0>>4=0 → row 0 (no negative underflow).
    addSprites(2, 0, [thing(0)], SCALELIGHT, 0, PROJECTION, pool, new Set(), grab);
    expect(lights === SCALELIGHT[0]).toBe(true);
  });

  test('an empty sector adds nothing but still marks the validcount', () => {
    const pool = createVisSpritePool();
    let calls = 0;
    const added = new Set<number>();
    addSprites(9, 128, [], SCALELIGHT, 0, PROJECTION, pool, added, {
      projectSpriteFn: () => {
        calls += 1;
        return null;
      },
    });
    expect(calls).toBe(0);
    expect(added.has(9)).toBe(true);
  });

  test('a clamped lightnum missing scalelightRows is a hard error', () => {
    const pool = createVisSpritePool();
    expect(() => addSprites(1, 160, [thing(0)], [Object.freeze([new Uint8Array(1)])], 0, PROJECTION, pool, new Set())).toThrow(RangeError);
  });

  test('is deterministic for a given sector/things/light', () => {
    const a: number[] = [];
    const b: number[] = [];
    addSprites(1, 144, [thing(0), thing(0)], SCALELIGHT, 0, PROJECTION, createVisSpritePool(), new Set(), {
      projectSpriteFn: (t) => {
        a.push(t.sprite);
        return null;
      },
    });
    addSprites(1, 144, [thing(0), thing(0)], SCALELIGHT, 0, PROJECTION, createVisSpritePool(), new Set(), {
      projectSpriteFn: (t) => {
        b.push(t.sprite);
        return null;
      },
    });
    expect(a).toEqual(b);
  });
});
