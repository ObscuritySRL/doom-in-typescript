import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ANGLETOSKYSHIFT, SKY_COLORMAP_INDEX, SKY_FLAT_NAME, SKY_TEXTURE_MID, computePspriteIscale, computeSkyColumnAngle, computeSkyIscale } from '../../../src/render/sky.ts';
import { buildPaletteAndColormap } from '../../../src/vanilla/paletteAndColormap.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const SKY_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/render/sky.ts');
const PALETTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/paletteAndColormap.ts');

describe('plan_final render: wire-sky-detail-gamma-palette', () => {
  test('src/render/sky.ts and src/vanilla/paletteAndColormap.ts both exist as regular files', () => {
    expect(existsSync(SKY_PATH)).toBe(true);
    expect(statSync(SKY_PATH).isFile()).toBe(true);
    expect(existsSync(PALETTE_PATH)).toBe(true);
    expect(statSync(PALETTE_PATH).isFile()).toBe(true);
  });

  test('SKY_FLAT_NAME pins the canonical F_SKY1 flat name vanilla checks for the sky-render trigger', () => {
    expect(SKY_FLAT_NAME).toBe('F_SKY1');
  });

  test('ANGLETOSKYSHIFT pins the 22-bit BAM->sky-column shift from Chocolate Doom 2.2.1 r_sky.c', () => {
    expect(ANGLETOSKYSHIFT).toBe(22);
  });

  test('SKY_COLORMAP_INDEX pins colormap 0 (full-bright) for the sky pass per Chocolate Doom 2.2.1 r_sky.c', () => {
    expect(SKY_COLORMAP_INDEX).toBe(0);
  });

  test('SKY_TEXTURE_MID pins the vanilla SCREENHEIGHT/2 * FRACUNIT sky-column texture-mid baseline', () => {
    expect(SKY_TEXTURE_MID).toBe(((200 / 2) * 0x1_0000) | 0);
  });

  test('sky helper functions (computePspriteIscale, computeSkyIscale, computeSkyColumnAngle) are all exported as functions', () => {
    expect(typeof computePspriteIscale).toBe('function');
    expect(typeof computeSkyIscale).toBe('function');
    expect(typeof computeSkyColumnAngle).toBe('function');
  });

  test('buildPaletteAndColormap from 05-002 is exported and accepts (resourceCache, lumpReader)', () => {
    expect(typeof buildPaletteAndColormap).toBe('function');
    expect(buildPaletteAndColormap.length).toBe(2);
  });

  test('computePspriteIscale produces a positive integer for the canonical 320-wide viewport', () => {
    const iscale = computePspriteIscale(320);
    expect(iscale).toBeGreaterThan(0);
    expect(Number.isInteger(iscale)).toBe(true);
  });
});
