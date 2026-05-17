/**
 * Sprite-lump metrics — Chocolate Doom 2.2.1 r_data.c
 * `R_InitSpriteLumps`.
 *
 * `R_InitSpriteLumps` walks the `firstspritelump..lastspritelump`
 * span and records each sprite patch's `width` / `leftoffset` /
 * `topoffset` (signed 16-bit, `<< FRACBITS`) into the lump-indexed
 * parallel arrays `spritewidth[]` / `spriteoffset[]` /
 * `spritetopoffset[]` that {@link projectSprite} (r_things.c
 * `R_ProjectSprite`) reads:
 *
 *   firstspritelump = W_GetNumForName("S_START") + 1;
 *   lastspritelump  = W_GetNumForName("S_END")   - 1;
 *   numspritelumps  = lastspritelump - firstspritelump + 1;
 *   for (i = 0 ; i < numspritelumps ; i++) {
 *     patch = W_CacheLumpNum(firstspritelump + i, PU_CACHE);
 *     spritewidth[i]     = SHORT(patch->width)      << FRACBITS;
 *     spriteoffset[i]    = SHORT(patch->leftoffset) << FRACBITS;
 *     spritetopoffset[i] = SHORT(patch->topoffset)  << FRACBITS;
 *   }
 *
 * That exact `SHORT(...) << FRACBITS` derivation over the
 * `firstspritelump`-relative span is ALREADY implemented, bit-exact
 * and asset-tested, by {@link buildSpriteFrameCache} (its
 * `spriteWidths` / `spriteOffsets` / `spriteTopOffsets` parallel
 * arrays = the vanilla `spritewidth[]` / `spriteoffset[]` /
 * `spritetopoffset[]`).  This module is the thin, pure reshape from
 * those `Fixed[]` parallel arrays into the {@link SpriteMetrics}
 * `Int32Array` triple the renderer's sprite-projection consumer
 * expects — lump indexing (`lump - firstspritelump`) is preserved
 * verbatim, so `metrics.width[lump]` etc. equal vanilla
 * `spritewidth[lump]`.
 *
 * Pure: reshapes the supplied cache arrays, no Win32 / WAD I/O.
 */

import type { SpriteFrameCache } from '../assets/build-sprite-frame-cache.ts';

import type { SpriteMetrics } from './spriteProjection.ts';

/**
 * r_data.c `R_InitSpriteLumps` result, as the renderer's
 * {@link SpriteMetrics}.  `cache` is the bit-exact asset-layer
 * {@link buildSpriteFrameCache} output; the returned `Int32Array`s
 * are `firstspritelump`-relative (index by `lump - firstspritelump`,
 * the same index {@link buildSpriteCatalog}'s `SpriteFrame.lump`
 * stores).
 */
export function buildSpriteMetrics(cache: SpriteFrameCache): SpriteMetrics {
  return {
    offset: Int32Array.from(cache.spriteOffsets),
    topOffset: Int32Array.from(cache.spriteTopOffsets),
    width: Int32Array.from(cache.spriteWidths),
  };
}
