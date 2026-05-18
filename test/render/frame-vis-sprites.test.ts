/**
 * Parity tests for the per-frame vissprite assembly
 * (`buildSortedVisSprites` = r_things.c `R_AddSprites` projection half
 * + `R_SortVisSprites`).
 *
 * Verifies the composition is exactly project-each-then-sort-back-to-
 * front, that `R_ProjectSprite`'s culls (too-close `tz < MINZ`,
 * off-screen `tx`) drop things from the result, the `MAXVISSPRITES`
 * pool clamp is honored, and the order is the deterministic
 * ascending-`scale` (farthest-first) order `R_DrawMasked` consumes.
 */

import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { MAXLIGHTSCALE } from '../../src/render/projection.ts';
import { buildSortedVisSprites } from '../../src/render/frameVisSprites.ts';
import type { ProjectableThing, SpriteDef, SpriteFrame, SpriteMetrics, SpriteProjectionContext } from '../../src/render/spriteProjection.ts';
import { MAXVISSPRITES, MINZ } from '../../src/render/spriteProjection.ts';

function makeMetrics(): SpriteMetrics {
  const lumps = 8;
  const offsetArr = new Int32Array(lumps);
  const widthArr = new Int32Array(lumps);
  const topOffsetArr = new Int32Array(lumps);
  for (let i = 0; i < lumps; i += 1) {
    offsetArr[i] = 0;
    widthArr[i] = 32 << FRACBITS;
    topOffsetArr[i] = 48 << FRACBITS;
  }
  return { offset: offsetArr, topOffset: topOffsetArr, width: widthArr };
}

function makeFrame(): SpriteFrame {
  return { rotate: false, lump: [0, 1, 2, 3, 4, 5, 6, 7], flip: [false, false, false, false, false, false, false, false] };
}

function makeSprites(): readonly SpriteDef[] {
  const f = makeFrame();
  return [{ numFrames: 2, frames: [f, f] }];
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

function ctx(): SpriteProjectionContext {
  return {
    viewX: 0,
    viewY: 0,
    viewZ: 0,
    viewCos: FRACUNIT,
    viewSin: 0,
    projection: 160 << FRACBITS,
    centerXFrac: 160 << FRACBITS,
    viewWidth: 320,
    detailShift: 0,
    sprites: makeSprites(),
    spriteMetrics: makeMetrics(),
    fixedColormap: null,
    spriteLights: makeSpriteLights(),
    colormaps: new Uint8Array(256),
  };
}

function thing(x: number, y = 0): ProjectableThing {
  return { x, y, z: 0, angle: 0, sprite: 0, frame: 0, flags: 0 };
}

describe('frameVisSprites: buildSortedVisSprites (R_AddSprites + R_SortVisSprites)', () => {
  test('projects each visible thing and returns them sorted back-to-front (ascending scale)', () => {
    // viewCos=FRACUNIT, viewSin=0 ⇒ tz = thing.x; xscale = projection/tz,
    // so a farther thing has a SMALLER scale. Three things at x = 512,
    // 256, 128 units → sorted order must be 512 (far) → 256 → 128 (near).
    const result = buildSortedVisSprites([thing(256 << FRACBITS), thing(128 << FRACBITS), thing(512 << FRACBITS)], ctx());
    expect(result.length).toBe(3);
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i]!.scale).toBeGreaterThanOrEqual(result[i - 1]!.scale);
    }
    // Farthest (x=512) is first (smallest scale); nearest (x=128) last.
    expect(result[0]!.scale).toBeLessThan(result[2]!.scale);
  });

  test('R_ProjectSprite culls drop things: too-close (tz < MINZ) and off-screen tx', () => {
    const tooClose = thing((MINZ >> 1) | 0); // tz < MINZ → culled
    const offScreen = thing(128 << FRACBITS, 4096 << FRACBITS); // |tx| > tz*4 → culled
    const visible = thing(200 << FRACBITS);
    const result = buildSortedVisSprites([tooClose, offScreen, visible], ctx());
    expect(result.length).toBe(1);
  });

  test('empty input → empty result; deterministic across calls', () => {
    expect(buildSortedVisSprites([], ctx())).toEqual([]);
    const things = [thing(300 << FRACBITS), thing(150 << FRACBITS), thing(450 << FRACBITS)];
    const a = buildSortedVisSprites(things, ctx());
    const b = buildSortedVisSprites(things, ctx());
    expect(a.map((s) => s.scale)).toEqual(b.map((s) => s.scale));
  });

  test('honors the MAXVISSPRITES pool clamp (no overflow past the pool capacity)', () => {
    const many: ProjectableThing[] = [];
    for (let i = 0; i < MAXVISSPRITES + 64; i += 1) {
      // distinct distances so each would project to a distinct slot
      many.push(thing((64 + i) << FRACBITS));
    }
    const result = buildSortedVisSprites(many, ctx());
    expect(result.length).toBeLessThanOrEqual(MAXVISSPRITES);
    expect(result.length).toBeGreaterThan(0);
  });
});
