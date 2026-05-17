import { describe, expect, test } from 'bun:test';

import { SCREENHEIGHT, SCREENWIDTH } from '../../src/host/windowPolicy.ts';
import { SBARHEIGHT, paintAssembledViewBorder } from '../../src/render/assembledViewBorder.ts';
import type { DecodedPatch } from '../../src/render/patchDraw.ts';
import { DetailMode, computeViewport } from '../../src/render/projection.ts';

function patch(): DecodedPatch {
  return Object.freeze({ header: Object.freeze({ width: 8, height: 8, leftOffset: 0, topOffset: 0 }), columns: Object.freeze([]) });
}
const BORDER_NAMES = ['BRDR_T', 'BRDR_B', 'BRDR_L', 'BRDR_R', 'BRDR_TL', 'BRDR_TR', 'BRDR_BL', 'BRDR_BR'];
const PATCHES = new Map<string, DecodedPatch>(BORDER_NAMES.map((n) => [n, patch()]));
// Reverse identity map so the drawPatch hook can name a blitted patch.
const NAME_OF = new Map<DecodedPatch, string>([...PATCHES].map(([n, p]) => [p, n]));
const borderPatchOf = (name: string): DecodedPatch => PATCHES.get(name)!;

// Recognisable 64x64 tile: flat[(r<<6)|c] = (r*7 + c) & 255.
const flat = new Uint8Array(4096);
for (let i = 0; i < 4096; i += 1) {
  flat[i] = ((i >> 6) * 7 + (i & 63)) & 255 || 1;
}

describe('assembledViewBorder: R_FillBackScreen + R_DrawViewBorder', () => {
  test('screenblocks 11 (scaledViewWidth === SCREENWIDTH) draws no border (vanilla early return)', () => {
    const fb = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    let blits = 0;
    paintAssembledViewBorder(fb, computeViewport(11, DetailMode.high), flat, borderPatchOf, { drawPatchFn: () => void (blits += 1) });
    expect(fb.every((v) => v === 0)).toBe(true);
    expect(blits).toBe(0);
  });

  test('screenblocks 9 tiles FLOOR7_2 across 320×(SCREENHEIGHT-SBARHEIGHT), status-bar rows untouched', () => {
    const vp = computeViewport(9, DetailMode.high);
    expect(vp.scaledViewWidth).not.toBe(SCREENWIDTH);
    const fb = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    paintAssembledViewBorder(fb, vp, flat, borderPatchOf, { drawPatchFn: () => {} });

    const backgroundRows = SCREENHEIGHT - SBARHEIGHT;
    // Sampled background cells equal flat[((y&63)<<6) | (x&63)].
    for (const [y, x] of [
      [0, 0],
      [63, 63],
      [100, 17],
      [backgroundRows - 1, 319],
    ] as const) {
      expect(fb[y * SCREENWIDTH + x]).toBe(flat[((y & 63) << 6) | (x & 63)]!);
    }
    // The status bar band (bottom SBARHEIGHT rows) is left untouched.
    expect(fb.subarray(backgroundRows * SCREENWIDTH).every((v) => v === 0)).toBe(true);
  });

  test('draws the eight BRDR_* patches at the vanilla viewwindow geometry', () => {
    const vp = computeViewport(9, DetailMode.high);
    const calls: Array<{ name: string; x: number; y: number }> = [];
    paintAssembledViewBorder(new Uint8Array(SCREENWIDTH * SCREENHEIGHT), vp, flat, borderPatchOf, {
      drawPatchFn: (p, x, y) => {
        calls.push({ name: NAME_OF.get(p) ?? '?', x, y });
      },
    });

    const vwx = vp.viewWindowX;
    const vwy = vp.viewWindowY;
    const svw = vp.scaledViewWidth;
    const vh = vp.viewHeight;

    // Top edge: BRDR_T at (vwx + x, vwy - 8) for x in [0, svw) step 8.
    const topCount = Math.ceil(svw / 8);
    expect(calls.filter((c) => c.name === 'BRDR_T').length).toBe(topCount);
    expect(calls.some((c) => c.name === 'BRDR_T' && c.x === vwx && c.y === vwy - 8)).toBe(true);
    expect(calls.some((c) => c.name === 'BRDR_B' && c.x === vwx && c.y === vwy + vh)).toBe(true);

    const sideCount = Math.ceil(vh / 8);
    expect(calls.filter((c) => c.name === 'BRDR_L').length).toBe(sideCount);
    expect(calls.some((c) => c.name === 'BRDR_L' && c.x === vwx - 8 && c.y === vwy)).toBe(true);
    expect(calls.some((c) => c.name === 'BRDR_R' && c.x === vwx + svw && c.y === vwy)).toBe(true);

    // Four corners.
    expect(calls.some((c) => c.name === 'BRDR_TL' && c.x === vwx - 8 && c.y === vwy - 8)).toBe(true);
    expect(calls.some((c) => c.name === 'BRDR_TR' && c.x === vwx + svw && c.y === vwy - 8)).toBe(true);
    expect(calls.some((c) => c.name === 'BRDR_BL' && c.x === vwx - 8 && c.y === vwy + vh)).toBe(true);
    expect(calls.some((c) => c.name === 'BRDR_BR' && c.x === vwx + svw && c.y === vwy + vh)).toBe(true);
  });
});
