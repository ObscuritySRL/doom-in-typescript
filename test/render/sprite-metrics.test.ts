/**
 * I6b parity tests for the sprite-lump metrics adapter
 * (`buildSpriteMetrics` = r_data.c `R_InitSpriteLumps` → renderer
 * `SpriteMetrics`).
 *
 * The underlying `SHORT(patch->...) << FRACBITS` derivation is
 * asset-tested in `buildSpriteFrameCache`; this verifies the adapter
 * preserves it exactly by re-deriving every sprite lump's metrics
 * STRAIGHT FROM THE WAD BYTES (a structurally distinct oracle: read
 * the patch header int16-LE width/leftoffset/topoffset at each lump's
 * file offset, `<< FRACBITS`) and asserting element-for-element
 * equality over the real doom/DOOM1.WAD, plus round-trip vs the cache
 * arrays and determinism.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { FRACBITS } from '../../src/core/fixed.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { buildSpriteFrameCache } from '../../src/assets/build-sprite-frame-cache.ts';
import { buildSpriteMetrics } from '../../src/render/spriteMetrics.ts';

describe('buildSpriteMetrics — R_InitSpriteLumps adapter over real DOOM1.WAD', () => {
  const wad = readFileSync('doom/DOOM1.WAD');
  const directory = parseWadDirectory(wad, parseWadHeader(wad));
  const cache = buildSpriteFrameCache({ directory, wadBuffer: wad });
  const metrics = buildSpriteMetrics(cache);

  test('shape: three firstspritelump-relative Int32Arrays of numSpriteLumps length', () => {
    const n = cache.namespace.entries.length;
    expect(n).toBeGreaterThan(0);
    expect(metrics.width).toBeInstanceOf(Int32Array);
    expect(metrics.offset).toBeInstanceOf(Int32Array);
    expect(metrics.topOffset).toBeInstanceOf(Int32Array);
    expect(metrics.width.length).toBe(n);
    expect(metrics.offset.length).toBe(n);
    expect(metrics.topOffset.length).toBe(n);
  });

  test('round-trips the bit-exact asset-layer cache parallel arrays', () => {
    expect([...metrics.width]).toEqual([...cache.spriteWidths]);
    expect([...metrics.offset]).toEqual([...cache.spriteOffsets]);
    expect([...metrics.topOffset]).toEqual([...cache.spriteTopOffsets]);
  });

  test('matches an independent re-derivation straight from the WAD patch headers', () => {
    // Vanilla patch_t header: int16-LE width@0, height@2, leftoffset@4,
    // topoffset@6. R_InitSpriteLumps stores SHORT(...) << FRACBITS.
    for (const entry of cache.entries) {
      const base = entry.offset;
      const width = wad.readInt16LE(base + 0) << FRACBITS;
      const leftoffset = wad.readInt16LE(base + 4) << FRACBITS;
      const topoffset = wad.readInt16LE(base + 6) << FRACBITS;
      expect(metrics.width[entry.spriteNumber]).toBe(width);
      expect(metrics.offset[entry.spriteNumber]).toBe(leftoffset);
      expect(metrics.topOffset[entry.spriteNumber]).toBe(topoffset);
    }
  });

  test('deterministic', () => {
    const again = buildSpriteMetrics(buildSpriteFrameCache({ directory, wadBuffer: wad }));
    expect([...again.width]).toEqual([...metrics.width]);
    expect([...again.offset]).toEqual([...metrics.offset]);
    expect([...again.topOffset]).toEqual([...metrics.topOffset]);
  });
});
