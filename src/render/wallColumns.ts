/**
 * Wall-texture column fetch (r_data.c `R_GetColumn` / `R_GenerateLookup` /
 * `R_GenerateComposite` / `R_DrawColumnInCache`).
 *
 * A DOOM wall texture is a composite image assembled from one or more
 * patch lumps placed at `(originX, originY)` offsets within a fixed-size
 * canvas.  `R_GetColumn(tex, col)` returns the bytes of a single texture
 * column so the wall renderer can iterate them with a fixed-point
 * accumulator and feed the light-diminished lookup into
 * {@link rDrawColumn}.
 *
 * Vanilla takes a two-pass shortcut:
 *
 * 1. `R_GenerateLookup` counts, per column, how many patches cover it.
 *    Columns covered by exactly one patch are stored as a direct
 *    `(lumpNumber, offset)` reference — the reference points at the
 *    first post's pixel bytes, i.e. `columnofs[c] + 3`, and subsequent
 *    reads walk the raw lump data.  Columns covered by two or more
 *    patches are flagged `lumpNumber = -1` and allocated a
 *    `texture.height`-byte slot inside a per-texture composite buffer.
 * 2. `R_GenerateComposite` revisits each patch and, for every column it
 *    covers that was flagged as composite, calls `R_DrawColumnInCache`
 *    to memcpy every post into the composite slot at
 *    `position = originY + topDelta`.  Later patches in the list
 *    overwrite earlier ones at the same position, matching vanilla.
 *
 * `R_GetColumn(tex, col)` then masks `col` with
 * {@link PreparedWallTexture.widthMask} (the highest power-of-2 less
 * than or equal to the texture width, minus one), consults the lookup,
 * and returns either the raw patch pixel bytes or a slice of the
 * composite buffer.
 *
 * Parity invariants locked here:
 *
 * - {@link computeTextureWidthMask} produces the vanilla mask.  For
 *   power-of-2 widths it covers the full texture (width=128 → mask=127).
 *   For non-power-of-2 widths it covers the **largest** power of 2 that
 *   still fits — e.g. width=96 → mask=63, so columns 64..95 wrap to 0..31
 *   when fetched.  This is the well-known "textures of non-power-of-2
 *   width wrap prematurely" vanilla quirk.
 * - `R_DrawColumnInCache` has a vanilla bug: when a post's
 *   `position = originY + topDelta` is negative, `count` is reduced but
 *   the source pointer is **not** advanced.  The effect is that the
 *   post's top pixels are not clipped — instead `pixels[0..count-1]` are
 *   written at `cache[0..count-1]`, shifting the pixel rows down by
 *   `|position|` and dropping the bottom `|position|` rows off the end.
 *   {@link prepareWallTexture} reproduces this byte-for-byte.
 * - Patches are drawn into composite columns in patch-list order; later
 *   patches overwrite earlier ones pixel-by-pixel (posts that do not
 *   overlap leave the earlier patch's pixels intact).
 * - `R_GenerateLookup` rejects textures whose composite cache would
 *   exceed 64 KiB.  Vanilla performs the guard before adding each
 *   `texture.height` column slot, so an exact 65536-byte composite is
 *   allowed and the next composite column is rejected.
 * - For single-patch columns, vanilla returns
 *   `(byte *)lump + columnofs[c] + 3` — the raw bytes of the first
 *   post's pixel data.  We return the `pixels` Uint8Array of that
 *   patch column's first post.  If the column has no posts (empty
 *   0xFF-terminated column) the returned buffer is empty.
 * - If no patch covers a column at all, `R_GenerateLookup` leaves
 *   `collump[x]` and `colofs[x]` uninitialized — vanilla reads garbage
 *   memory there.  {@link prepareWallTexture} returns an empty
 *   `Uint8Array(0)` for those columns so the interface stays total;
 *   DOOM1.WAD textures always have at least one patch per column so
 *   this path is not exercised by parity fixtures.
 *
 * This module is pure arithmetic / buffer assembly with no Win32 or
 * runtime dependencies.
 *
 * @example
 * ```ts
 * import { decodePatch } from "../src/render/patchDraw.ts";
 * import { getWallColumn, prepareWallTexture } from "../src/render/wallColumns.ts";
 *
 * const patch = decodePatch(patchLumpBytes);
 * const texture = prepareWallTexture("STARTAN1", 64, 128, [
 *   { originX: 0, originY: 0, patch },
 * ]);
 * const column = getWallColumn(texture, 10);
 * // column is a 128-byte Uint8Array of palette indices
 * ```
 */

import type { DecodedPatch, PatchColumn } from './patchDraw.ts';

const MAX_TEXTURE_COMPOSITE_BYTES = 0x1_0000;

/**
 * A patch placed at a specific `(originX, originY)` inside a composite
 * wall texture.  Mirrors r_defs.h `texpatch_t`: the originX/originY
 * values can be negative (the patch extends past the left/top edge and
 * the out-of-bounds portion is clipped).
 */
export interface WallPatchPlacement {
  /** X offset (in texture columns) of this patch's column 0. Signed. */
  readonly originX: number;
  /** Y offset (in texture rows) of this patch's row 0. Signed. */
  readonly originY: number;
  /** Pre-decoded patch (see {@link decodePatch}). */
  readonly patch: DecodedPatch;
}

/**
 * Fully prepared wall texture ready for column fetch.  Combines the
 * outputs of vanilla's two-pass `R_GenerateLookup` +
 * `R_GenerateComposite` into a single frozen record.
 */
export interface PreparedWallTexture {
  /** Texture name (upper-case, up to 8 ASCII characters). */
  readonly name: string;
  /** Width in pixels (columns). */
  readonly width: number;
  /** Height in pixels (rows per column). */
  readonly height: number;
  /** Wrap mask for column indices (`col & widthMask`). */
  readonly widthMask: number;
  /**
   * Composite buffer holding every multi-patch column's assembled
   * pixels.  Length is `height * numberOfCompositeColumns`; the slice
   * for composite column `c` is
   * `composite.subarray(offsetFor(c), offsetFor(c) + height)`.  Empty
   * buffer (`length === 0`) when no column is composite.
   */
  readonly composite: Uint8Array;
  /**
   * One pre-resolved byte buffer per texture column, indexed `0..width-1`.
   * Use {@link getWallColumn} to fetch by a possibly-wrapping `col`.
   * Single-patch columns reference the patch's first post's pixel bytes
   * directly; composite columns reference a slice of {@link composite}.
   */
  readonly columns: readonly Uint8Array[];
}

/**
 * Compute the vanilla wall-texture wrap mask for a given texture width.
 *
 * Matches r_data.c `R_InitTextures`:
 *
 * ```c
 * j = 1;
 * while (j*2 <= texture->width) j <<= 1;
 * texturewidthmask[i] = j - 1;
 * ```
 *
 * I.e. the **largest** power of 2 that is less than or equal to `width`,
 * minus one.  Power-of-2 widths produce a mask that covers every column
 * (`mask = width - 1`); non-power-of-2 widths produce a mask that covers
 * only the bottom power-of-2 chunk, causing columns past that chunk to
 * wrap prematurely.
 *
 * @example
 * ```ts
 * computeTextureWidthMask(128); // 127
 * computeTextureWidthMask(96);  // 63  — columns 64..95 wrap back to 0..31
 * computeTextureWidthMask(256); // 255
 * ```
 */
export function computeTextureWidthMask(width: number): number {
  if (width <= 0) {
    return 0;
  }
  let j = 1;
  while (j * 2 <= width) {
    j <<= 1;
  }
  return j - 1;
}

/**
 * Prepare a wall texture for column fetch by running vanilla's
 * `R_GenerateLookup` + `R_GenerateComposite` passes over the supplied
 * patch placements.
 *
 * The returned {@link PreparedWallTexture} is fully deep-frozen: the
 * outer object and `columns` array.  Individual column buffers remain
 * `Uint8Array` (Uint8Arrays cannot be frozen without losing their
 * typed-array identity); callers must treat them as read-only.  For
 * single-patch columns the buffer aliases the underlying
 * {@link DecodedPatch} post's pixel Uint8Array — mutation would corrupt
 * the decoded patch.
 *
 * @param name - Texture name (e.g. `"STARTAN1"`).
 * @param width - Texture width in columns. Must be a non-negative integer.
 * @param height - Texture height in rows. Must be a non-negative integer.
 * @param patches - Patch placements, in the order they appear in the
 *   `TEXTUREx` lump.  Later entries overwrite earlier ones inside
 *   composite columns.
 * @throws {RangeError} If `width` or `height` is not a non-negative integer,
 *   or if the composite texture would exceed vanilla's 64 KiB cache limit.
 */
export function prepareWallTexture(name: string, width: number, height: number, patches: readonly WallPatchPlacement[]): PreparedWallTexture {
  if (!Number.isInteger(width) || width < 0) {
    throw new RangeError(`Texture width must be a non-negative integer, got ${width}`);
  }
  if (!Number.isInteger(height) || height < 0) {
    throw new RangeError(`Texture height must be a non-negative integer, got ${height}`);
  }

  const widthMask = computeTextureWidthMask(width);
  const maxCompositeOffset = MAX_TEXTURE_COMPOSITE_BYTES - height;

  const patchCount = new Int32Array(width);
  const lastPatchIndex = new Int32Array(width).fill(-1);
  const lastPatchColumn = new Int32Array(width);

  for (let placementIndex = 0; placementIndex < patches.length; placementIndex += 1) {
    const placement = patches[placementIndex]!;
    const { originX, patch } = placement;
    const patchWidth = patch.header.width;
    const clipLeft = originX < 0 ? 0 : originX;
    const patchRight = originX + patchWidth;
    const clipRight = patchRight > width ? width : patchRight;
    for (let x = clipLeft; x < clipRight; x += 1) {
      patchCount[x]! += 1;
      lastPatchIndex[x] = placementIndex;
      lastPatchColumn[x] = x - originX;
    }
  }

  const isComposite: boolean[] = new Array(width).fill(false);
  const compositeOffset = new Int32Array(width);
  let compositeSize = 0;
  for (let x = 0; x < width; x += 1) {
    if (patchCount[x]! > 1) {
      if (compositeSize > maxCompositeOffset) {
        throw new RangeError(`R_GenerateLookup: texture ${name} is >64k`);
      }
      isComposite[x] = true;
      compositeOffset[x] = compositeSize;
      compositeSize += height;
    }
  }

  const composite = new Uint8Array(compositeSize);

  for (let placementIndex = 0; placementIndex < patches.length; placementIndex += 1) {
    const placement = patches[placementIndex]!;
    const { originX, originY, patch } = placement;
    const patchWidth = patch.header.width;
    const clipLeft = originX < 0 ? 0 : originX;
    const patchRight = originX + patchWidth;
    const clipRight = patchRight > width ? width : patchRight;
    for (let x = clipLeft; x < clipRight; x += 1) {
      if (!isComposite[x]) {
        continue;
      }
      const patchColumn = patch.columns[x - originX]!;
      drawColumnInCache(patchColumn, composite, compositeOffset[x]!, originY, height);
    }
  }

  const columns: Uint8Array[] = new Array(width);
  for (let x = 0; x < width; x += 1) {
    if (isComposite[x]) {
      const offset = compositeOffset[x]!;
      columns[x] = composite.subarray(offset, offset + height);
      continue;
    }
    const placementIndex = lastPatchIndex[x]!;
    if (placementIndex < 0) {
      columns[x] = new Uint8Array(0);
      continue;
    }
    const placement = patches[placementIndex]!;
    const patchColumn = placement.patch.columns[lastPatchColumn[x]!]!;
    const firstPost = patchColumn[0];
    columns[x] = firstPost ? firstPost.pixels : new Uint8Array(0);
  }

  return Object.freeze({
    name,
    width,
    height,
    widthMask,
    composite,
    columns: Object.freeze(columns),
  });
}

/**
 * Fetch the bytes of a single texture column, wrapping `col` through
 * {@link PreparedWallTexture.widthMask}.  Matches r_data.c
 * `R_GetColumn(tex, col)` byte-for-byte:
 *
 * ```c
 * col &= texturewidthmask[tex];
 * return collump[col] > 0 ? cache + colofs[col] : composite + colofs[col];
 * ```
 *
 * The returned Uint8Array is the live reference the preparation built;
 * callers must not mutate it.  For single-patch columns the buffer is
 * the first post's `pixels` slice (length equals that post's length);
 * for composite columns it is a subarray of
 * {@link PreparedWallTexture.composite} of length `texture.height`.
 *
 * @example
 * ```ts
 * const texture = prepareWallTexture(...);
 * const column = getWallColumn(texture, 130); // wraps via widthMask
 * for (let row = 0; row < column.length; row += 1) {
 *   const paletteIndex = column[row];
 * }
 * ```
 */
export function getWallColumn(texture: PreparedWallTexture, col: number): Uint8Array {
  return texture.columns[col & texture.widthMask]!;
}

/**
 * Mirrors r_data.c `R_DrawColumnInCache` byte-for-byte including the
 * vanilla bug where a top-clipped post keeps its source pointer at
 * `pixels[0]` (the post's original top) rather than advancing by
 * `|position|`.  The bug only triggers when `originY + topDelta < 0`;
 * in DOOM1.WAD this happens for a small number of decorative patches
 * whose top pixels are expected to clip off the top of a composite
 * texture.  The visible effect is that the post's top pixels draw
 * where the clipped-off pixels should have been, and the bottom
 * `|position|` rows of the post are dropped.
 */
function drawColumnInCache(column: PatchColumn, cache: Uint8Array, destOffset: number, originY: number, cacheHeight: number): void {
  for (let postIndex = 0; postIndex < column.length; postIndex += 1) {
    const post = column[postIndex]!;
    let count = post.length;
    let position = originY + post.topDelta;
    if (position < 0) {
      count += position;
      position = 0;
    }
    if (position + count > cacheHeight) {
      count = cacheHeight - position;
    }
    if (count > 0) {
      if (count === post.length) {
        cache.set(post.pixels, destOffset + position);
      } else {
        cache.set(post.pixels.subarray(0, count), destOffset + position);
      }
    }
  }
}
