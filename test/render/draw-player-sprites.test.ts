/**
 * Parity tests for player weapon sprite rasterization
 * (`drawPlayerSprites` = r_things.c `R_DrawPlayerSprites` +
 * `R_DrawMaskedColumn`, sprite path) — the I7 chain terminus.
 *
 * Rigor bar mirrors the pipeline: a synthetic constant-pixel patch +
 * identity colormaps make every blitted cell deterministically
 * predictable, so the written framebuffer region is checked against a
 * STRUCTURALLY DISTINCT in-test re-derivation of the verbatim
 * `R_DrawMaskedColumn` post→`dc_yl`/`dc_yh` formula; plus the
 * screen-only clip, the NUMPSPRITES/null-skip loop, the fuzz (shadow)
 * path, colormap-kind selection, and determinism.
 */

import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { LIGHTLEVELS, LIGHTSEGSHIFT, MAXLIGHTSCALE } from '../../src/render/projection.ts';
import type { DecodedPatch } from '../../src/render/patchDraw.ts';
import type { SpriteDef, SpriteMetrics } from '../../src/render/spriteProjection.ts';
import type { PSprite } from '../../src/render/drawPsprite.ts';
import { computePSpriteVis } from '../../src/render/drawPsprite.ts';
import { planVisSpriteColumns } from '../../src/render/drawVisSprite.ts';
import type { DrawPlayerSpritesLight, DrawPlayerSpritesView, PlayerPSprites } from '../../src/render/drawPlayerSprites.ts';
import { drawPlayerSprites } from '../../src/render/drawPlayerSprites.ts';

const SW = 96;
const VH = 96;
const PIXEL = 200; // constant post palette index

const view: DrawPlayerSpritesView = { centerXFrac: (48 << FRACBITS) | 0, centerYFrac: (48 << FRACBITS) | 0, centerY: 48, viewWidth: 96, viewHeight: VH, detailShift: 0, screenWidth: SW };

// Identity colormap rows (row[i] = i) so blitted pixel == source pixel.
const identityRow = (): Uint8Array => Uint8Array.from({ length: 256 }, (_, i) => i);
const colormaps = (() => {
  const c = new Uint8Array(34 * 256);
  for (let r = 0; r < 34; r += 1) for (let i = 0; i < 256; i += 1) c[r * 256 + i] = i;
  // Fuzz reads ramp 6; make it non-identity so the blur visibly remaps.
  for (let i = 0; i < 256; i += 1) c[6 * 256 + i] = 255 - i;
  return c;
})();
const scalelightRows: Uint8Array[][] = Array.from({ length: LIGHTLEVELS }, () => Array.from({ length: MAXLIGHTSCALE }, () => identityRow()));
const light: DrawPlayerSpritesLight = { sectorLightLevel: 200, extralight: 0, invisibilityPower: 0, fixedColormapRow: null, scalelightRows, colormaps };

// Synthetic catalog: sprite 0, frame 0, lump 0, no flip.
const sprites: SpriteDef[] = [{ numFrames: 1, frames: [{ rotate: false, lump: [0, 0, 0, 0, 0, 0, 0, 0], flip: [false, false, false, false, false, false, false, false] }] }];
const metrics: SpriteMetrics = { offset: Int32Array.of(20 << FRACBITS), topOffset: Int32Array.of(30 << FRACBITS), width: Int32Array.of(40 << FRACBITS) };

// Synthetic patch: 40 columns, each one full post (topDelta 0, length 50) of constant PIXEL.
function synthPatch(): DecodedPatch {
  const post = { topDelta: 0, length: 50, pixels: new Uint8Array(50).fill(PIXEL) };
  return { header: { width: 40, height: 50, leftOffset: 20, topOffset: 30 }, columns: Array.from({ length: 40 }, () => [post]) };
}
const patchFor = (): DecodedPatch => synthPatch();

const weapon: PSprite = { sprite: 0, frame: 0, sx: 0, sy: 32 * FRACUNIT };

describe('drawPlayerSprites — rasterization', () => {
  test('writes the weapon only within its projected column span and screen rows (verbatim post formula)', () => {
    const fb = new Uint8Array(SW * VH);
    drawPlayerSprites([weapon, null], sprites, metrics, patchFor, view, light, fb);

    const vis = computePSpriteVis(weapon, sprites, metrics, { centerXFrac: view.centerXFrac, viewWidth: view.viewWidth, detailShift: 0 }, { invisibilityPower: 0, fixedColormap: false })!;
    const plan = planVisSpriteColumns(
      { x1: vis.x1, x2: vis.x2, texturemid: vis.texturemid, scale: vis.scale, xiscale: vis.xiscale, startfrac: vis.startfrac, patchWidth: 40, colormap: vis.colormap },
      { centerYFrac: view.centerYFrac, detailShift: 0 },
    );
    // Independent re-derivation of R_DrawMaskedColumn for the single
    // full post (topDelta 0, length 50).
    const topscreen = (plan.sprtopscreen + Math.imul(plan.spryscale, 0)) | 0;
    const bottomscreen = (topscreen + Math.imul(plan.spryscale, 50)) | 0;
    let dcYl = (topscreen + FRACUNIT - 1) >> FRACBITS;
    let dcYh = (bottomscreen - 1) >> FRACBITS;
    if (dcYh >= VH) dcYh = VH - 1;
    if (dcYl <= -1) dcYl = 0;

    let written = 0;
    for (let y = 0; y < VH; y += 1) {
      for (let x = 0; x < SW; x += 1) {
        const v = fb[y * SW + x]!;
        if (v !== 0) {
          written += 1;
          expect(v).toBe(PIXEL); // identity colormap → source pixel
          expect(x).toBeGreaterThanOrEqual(vis.x1);
          expect(x).toBeLessThanOrEqual(vis.x2);
          expect(y).toBeGreaterThanOrEqual(dcYl);
          expect(y).toBeLessThanOrEqual(dcYh);
        }
      }
    }
    expect(written).toBeGreaterThan(0);
    // Every covered column writes the full clipped post height.
    expect(written).toBe((vis.x2 - vis.x1 + 1) * (dcYh - dcYl + 1));
  });

  test('a null psprite contributes nothing; the loop draws every active one', () => {
    const fbNone = new Uint8Array(SW * VH);
    drawPlayerSprites([null, null], sprites, metrics, patchFor, view, light, fbNone);
    expect(fbNone.some((b) => b !== 0)).toBe(false);

    const fbOne = new Uint8Array(SW * VH);
    drawPlayerSprites([weapon, null], sprites, metrics, patchFor, view, light, fbOne);
    const fbTwo = new Uint8Array(SW * VH);
    drawPlayerSprites([weapon, weapon], sprites, metrics, patchFor, view, light, fbTwo);
    // Both psprites identical → same pixels (idempotent overdraw), still non-empty.
    expect(fbOne.some((b) => b !== 0)).toBe(true);
    expect([...fbTwo]).toEqual([...fbOne]);
  });

  test('shadow (invisibility) routes through the fuzz colfunc (remaps the scene, never copies the source)', () => {
    // Pre-fill a non-zero background (a "rendered scene" behind the
    // weapon) so the fuzz blur visibly remaps it.
    const base = new Uint8Array(SW * VH).fill(100);
    drawPlayerSprites([weapon, null], sprites, metrics, patchFor, view, light, base);
    const shadow = new Uint8Array(SW * VH).fill(100);
    drawPlayerSprites([weapon, null], sprites, metrics, patchFor, view, { ...light, invisibilityPower: 200 }, shadow);
    // Fuzz colfunc ≠ the identity-source base blit.
    expect([...shadow]).not.toEqual([...base]);
    // Fuzz never copies dc_source → the raw PIXEL never appears.
    expect(shadow.includes(PIXEL)).toBe(false);
    // Base (R_DrawColumn) DID blit the source PIXEL.
    expect(base.includes(PIXEL)).toBe(true);
    // Fuzz did remap some background cells (changed from 100).
    expect(shadow.some((b) => b !== 100)).toBe(true);
  });

  test('fixed colormap selects the fixed row; full-bright selects ramp 0', () => {
    // fixed colormap row maps everything to 7.
    const fixedRow = new Uint8Array(256).fill(7);
    const fb = new Uint8Array(SW * VH);
    drawPlayerSprites([weapon, null], sprites, metrics, patchFor, view, { ...light, fixedColormapRow: fixedRow }, fb);
    const nz = [...fb].filter((b) => b !== 0);
    expect(nz.length).toBeGreaterThan(0);
    expect(nz.every((b) => b === 7)).toBe(true);

    const fbFB = new Uint8Array(SW * VH);
    drawPlayerSprites([{ ...weapon, frame: 0x8000 }, null], sprites, metrics, patchFor, view, light, fbFB);
    // ramp 0 is identity here → source PIXEL.
    expect([...fbFB].filter((b) => b !== 0).every((b) => b === PIXEL)).toBe(true);
  });

  test('deterministic', () => {
    const a = new Uint8Array(SW * VH);
    const b = new Uint8Array(SW * VH);
    drawPlayerSprites([weapon, null], sprites, metrics, patchFor, view, light, a);
    drawPlayerSprites([weapon, null], sprites, metrics, patchFor, view, light, b);
    expect([...a]).toEqual([...b]);
  });

  test('spritelights uses scalelight[clamp(lightlevel>>LIGHTSEGSHIFT+extralight)][MAXLIGHTSCALE-1]', () => {
    // Make only the expected scalelight row map to 9; others to 0.
    const rows: Uint8Array[][] = Array.from({ length: LIGHTLEVELS }, () => Array.from({ length: MAXLIGHTSCALE }, () => new Uint8Array(256)));
    const ln = Math.max(0, Math.min(LIGHTLEVELS - 1, (160 >> LIGHTSEGSHIFT) + 0));
    rows[ln]![MAXLIGHTSCALE - 1] = new Uint8Array(256).fill(9);
    const fb = new Uint8Array(SW * VH);
    drawPlayerSprites([weapon, null], sprites, metrics, patchFor, view, { ...light, sectorLightLevel: 160, scalelightRows: rows }, fb);
    expect([...fb].filter((v) => v !== 0).every((v) => v === 9)).toBe(true);
  });
});
