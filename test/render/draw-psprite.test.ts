/**
 * I7 parity tests for the player weapon sprite placement
 * (`computePSpriteVis` = r_things.c `R_DrawPSprite`, placement half).
 *
 * Rigor bar mirrors the wall/sprite pipeline: exact hand-derived
 * scalar asserts on a synthetic catalog/metrics, both off-screen
 * rejects, all four colormap-selection cases, a STRUCTURALLY DISTINCT
 * in-test re-transcription of R_DrawPSprite over varied inputs, and a
 * REAL doom/DOOM1.WAD pistol-weapon (PISG) integration through the
 * I6a catalog + I6b metrics.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { buildSpriteFrameCache } from '../../src/assets/build-sprite-frame-cache.ts';
import { DetailMode, MAXLIGHTSCALE, computeViewport } from '../../src/render/projection.ts';
import type { SpriteDef, SpriteMetrics } from '../../src/render/spriteProjection.ts';
import { computePspriteIscale } from '../../src/render/sky.ts';
import { VANILLA_SPRNAMES, buildSpriteCatalog } from '../../src/render/spriteCatalog.ts';
import { buildSpriteMetrics } from '../../src/render/spriteMetrics.ts';
import type { PSprite, PSpriteLight, PSpriteView } from '../../src/render/drawPsprite.ts';
import { BASEYCENTER, computePSpriteVis, computePspriteScale } from '../../src/render/drawPsprite.ts';

const view: PSpriteView = (() => {
  const v = computeViewport(9, DetailMode.high);
  return { centerXFrac: v.centerXFrac, viewWidth: v.viewWidth, detailShift: v.detailShift };
})();
const noLight: PSpriteLight = { invisibilityPower: 0, fixedColormap: false };

// Synthetic single-sprite catalog: frame 0, lump 3, no flip.
function synthCatalog(flip = false): { sprites: SpriteDef[]; metrics: SpriteMetrics } {
  const sprites: SpriteDef[] = [{ numFrames: 1, frames: [{ rotate: false, lump: [3, 3, 3, 3, 3, 3, 3, 3], flip: [flip, flip, flip, flip, flip, flip, flip, flip] }] }];
  const offset = new Int32Array(8);
  const topOffset = new Int32Array(8);
  const width = new Int32Array(8);
  offset[3] = 24 << FRACBITS; // leftoffset
  topOffset[3] = 40 << FRACBITS;
  width[3] = 60 << FRACBITS;
  return { sprites, metrics: { offset, topOffset, width } };
}

// Structurally distinct re-transcription of R_DrawPSprite placement.
function oracle(psp: PSprite, sprites: readonly SpriteDef[], metrics: SpriteMetrics, v: PSpriteView, light: PSpriteLight) {
  const sf = sprites[psp.sprite]!.frames[psp.frame & 0x7fff]!;
  const lump = sf.lump[0]!;
  const flip = sf.flip[0]!;
  const ps = computePspriteScale(v.viewWidth);
  const pis = computePspriteIscale(v.viewWidth);
  let tx = (psp.sx - 160 * FRACUNIT) | 0;
  tx = (tx - metrics.offset[lump]!) | 0;
  const x1 = (v.centerXFrac + fixedMul(tx, ps)) >> FRACBITS;
  if (x1 > v.viewWidth) return null;
  tx = (tx + metrics.width[lump]!) | 0;
  const x2 = ((v.centerXFrac + fixedMul(tx, ps)) >> FRACBITS) - 1;
  if (x2 < 0) return null;
  const tm = (((BASEYCENTER << FRACBITS) + ((FRACUNIT / 2) | 0)) | 0) - ((psp.sy - metrics.topOffset[lump]!) | 0);
  const vx1 = x1 < 0 ? 0 : x1;
  const vx2 = x2 >= v.viewWidth ? v.viewWidth - 1 : x2;
  let xis = flip ? -pis | 0 : pis;
  let sfr = flip ? (metrics.width[lump]! - 1) | 0 : 0;
  if (vx1 > x1) sfr = (sfr + Math.imul(xis, vx1 - x1)) | 0;
  let cm: 'shadow' | 'fixed' | 'fullbright' | 'spritelights';
  if (light.invisibilityPower > 128 || (light.invisibilityPower & 8) !== 0) cm = 'shadow';
  else if (light.fixedColormap) cm = 'fixed';
  else if ((psp.frame & 0x8000) !== 0) cm = 'fullbright';
  else cm = 'spritelights';
  return { x1: vx1, x2: vx2, texturemid: tm | 0, scale: (ps << v.detailShift) | 0, xiscale: xis, startfrac: sfr, patch: lump, flip, colormapKind: cm };
}

describe('computePSpriteVis — placement math', () => {
  test('centered weapon (sx=0, sy=WEAPONTOP) matches the verbatim re-transcription', () => {
    const { sprites, metrics } = synthCatalog();
    const psp: PSprite = { sprite: 0, frame: 0, sx: 0, sy: 32 * FRACUNIT };
    const got = computePSpriteVis(psp, sprites, metrics, view, noLight);
    const want = oracle(psp, sprites, metrics, view, noLight)!;
    expect(got).not.toBeNull();
    expect(got!.x1).toBe(want.x1);
    expect(got!.x2).toBe(want.x2);
    expect(got!.texturemid).toBe(want.texturemid);
    expect(got!.scale).toBe(want.scale);
    expect(got!.xiscale).toBe(want.xiscale);
    expect(got!.startfrac).toBe(want.startfrac);
    expect(got!.patch).toBe(3);
    expect(got!.colormap.kind).toBe('spritelights');
  });

  test('texturemid uses BASEYCENTER and the lump topoffset', () => {
    const { sprites, metrics } = synthCatalog();
    const psp: PSprite = { sprite: 0, frame: 0, sx: 0, sy: 32 * FRACUNIT };
    const r = computePSpriteVis(psp, sprites, metrics, view, noLight)!;
    // (100<<16) + 0x8000 - (32<<16 - 40<<16)
    expect(r.texturemid).toBe((BASEYCENTER << FRACBITS) + ((FRACUNIT / 2) | 0) - (32 * FRACUNIT - 40 * FRACUNIT));
  });

  test('off the right side (huge +sx) returns null', () => {
    const { sprites, metrics } = synthCatalog();
    expect(computePSpriteVis({ sprite: 0, frame: 0, sx: 5000 * FRACUNIT, sy: 32 * FRACUNIT }, sprites, metrics, view, noLight)).toBeNull();
  });

  test('off the left side (huge -sx) returns null', () => {
    const { sprites, metrics } = synthCatalog();
    expect(computePSpriteVis({ sprite: 0, frame: 0, sx: -5000 * FRACUNIT, sy: 32 * FRACUNIT }, sprites, metrics, view, noLight)).toBeNull();
  });

  test('flip negates xiscale and seeds startfrac at width-1', () => {
    const { sprites, metrics } = synthCatalog(true);
    const r = computePSpriteVis({ sprite: 0, frame: 0, sx: 0, sy: 32 * FRACUNIT }, sprites, metrics, view, noLight)!;
    expect(r.flip).toBe(true);
    expect(r.xiscale).toBe(-computePspriteIscale(view.viewWidth) | 0);
  });

  test('colormap selection: shadow / fixed / fullbright / spritelights', () => {
    const { sprites, metrics } = synthCatalog();
    const base: PSprite = { sprite: 0, frame: 0, sx: 0, sy: 32 * FRACUNIT };
    expect(computePSpriteVis(base, sprites, metrics, view, { invisibilityPower: 200, fixedColormap: false })!.colormap.kind).toBe('shadow');
    expect(computePSpriteVis(base, sprites, metrics, view, { invisibilityPower: 8, fixedColormap: false })!.colormap.kind).toBe('shadow');
    expect(computePSpriteVis(base, sprites, metrics, view, { invisibilityPower: 0, fixedColormap: true })!.colormap.kind).toBe('fixed');
    const fb = computePSpriteVis({ ...base, frame: 0x8000 }, sprites, metrics, view, noLight)!;
    expect(fb.colormap.kind).toBe('fullbright');
    const sl = computePSpriteVis(base, sprites, metrics, view, noLight)!;
    expect(sl.colormap).toEqual({ kind: 'spritelights', index: MAXLIGHTSCALE - 1 });
  });

  test('out-of-range sprite / frame throw (vanilla RANGECHECK)', () => {
    const { sprites, metrics } = synthCatalog();
    expect(() => computePSpriteVis({ sprite: 9, frame: 0, sx: 0, sy: 0 }, sprites, metrics, view, noLight)).toThrow(/invalid sprite number/);
    expect(() => computePSpriteVis({ sprite: 0, frame: 5, sx: 0, sy: 0 }, sprites, metrics, view, noLight)).toThrow(/invalid sprite frame/);
  });

  test('matches the re-transcription over a viewpoint/flip/sx/sy battery', () => {
    let seed = 0x51_7c_c1_a3 >>> 0;
    const rnd = (n: number): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed % n;
    };
    for (let i = 0; i < 300; i += 1) {
      const { sprites, metrics } = synthCatalog(rnd(2) === 0);
      const psp: PSprite = { sprite: 0, frame: rnd(2) === 0 ? 0 : 0x8000, sx: (rnd(400) - 200) * FRACUNIT, sy: (16 + rnd(120)) * FRACUNIT };
      const lt: PSpriteLight = { invisibilityPower: [0, 8, 200][rnd(3)]!, fixedColormap: rnd(2) === 0 };
      const got = computePSpriteVis(psp, sprites, metrics, view, lt);
      const want = oracle(psp, sprites, metrics, view, lt);
      if (want === null) {
        expect(got).toBeNull();
      } else {
        expect(got).not.toBeNull();
        expect({ x1: got!.x1, x2: got!.x2, texturemid: got!.texturemid, scale: got!.scale, xiscale: got!.xiscale, startfrac: got!.startfrac, patch: got!.patch, flip: got!.flip, colormapKind: got!.colormap.kind }).toEqual(want);
      }
    }
  });
});

describe('computePSpriteVis — real DOOM1.WAD pistol weapon (PISG)', () => {
  test('projects the on-screen PISG A frame through the I6a catalog + I6b metrics', () => {
    const wad = readFileSync('doom/DOOM1.WAD');
    const directory = parseWadDirectory(wad, parseWadHeader(wad));
    const cache = buildSpriteFrameCache({ directory, wadBuffer: wad });
    const sprites = buildSpriteCatalog(cache.namespace.entries.map((e) => ({ name: e.name, spriteNumber: e.spriteNumber })));
    const metrics = buildSpriteMetrics(cache);
    const pisg = VANILLA_SPRNAMES.indexOf('PISG');
    expect(sprites[pisg]!.numFrames).toBeGreaterThan(0);
    // Weapon raised: sx centered (0), sy = WEAPONTOP (32<<FRACBITS).
    const r = computePSpriteVis({ sprite: pisg, frame: 0, sx: 0, sy: 32 * FRACUNIT }, sprites, metrics, view, noLight);
    expect(r).not.toBeNull();
    expect(r!.x1).toBeGreaterThanOrEqual(0);
    expect(r!.x2).toBeLessThan(view.viewWidth);
    expect(r!.x1).toBeLessThanOrEqual(r!.x2);
    expect(r!.patch).toBe(sprites[pisg]!.frames[0]!.lump[0]);
  });
});
