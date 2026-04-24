/**
 * DOOM patch lump decode and draw (v_video.c `V_DrawPatch` / r_data.c
 * `R_GetColumn` source format).
 *
 * A "patch" is the column-packed 8-bit palette bitmap vanilla DOOM uses
 * for wall patches, sprites, HUD graphics, font glyphs, menu art, and the
 * title / status-bar backgrounds.  Every masked bitmap in DOOM1.WAD (and
 * every patch consumed by a composite wall texture) ships in this
 * format.  The structure is:
 *
 * ```
 * offset  size   field
 *  0       2    width            (int16 LE)
 *  2       2    height           (int16 LE)
 *  4       2    leftOffset       (int16 LE, signed — sprite origin)
 *  6       2    topOffset        (int16 LE, signed — sprite origin)
 *  8    4*width columnOffsets    (int32 LE each, byte offset from lump
 *                                  start to that column's post chain)
 * ```
 *
 * Each column is a chain of "posts"; each post is:
 *
 * ```
 *   byte topDelta      // 0xFF terminates the chain
 *   byte length
 *   byte leadingPad    // vanilla stuffs last written byte here for
 *                      //   the DOS smoothing trick; we never read it
 *   byte pixels[length]
 *   byte trailingPad   // vanilla stuffs the first byte of the next
 *                      //   post here; we never read it either
 * ```
 *
 * DOOM1.WAD uses the plain "single topdelta" encoding — each post's
 * `topDelta` is the vertical offset in rows from the top of the patch
 * (row 0).  The later "tall patch" (DeePsea) extension chains topdeltas
 * by summing successive values when they regress; that extension is
 * not present in the shareware IWAD so this decoder treats `topDelta`
 * as absolute.  A column that paints nothing stores a single 0xFF end
 * byte with no preceding posts.
 *
 * {@link drawPatch} mirrors v_video.c `V_DrawPatch` byte-for-byte: the
 * draw origin is adjusted by `(leftOffset, topOffset)` so the patch's
 * in-art origin lands at the supplied screen `(x, y)`, posts are
 * blitted at their `topDelta` rows, and gaps between posts are left
 * untouched (the masked-pixel "transparent" semantics vanilla gets from
 * just not writing those bytes).  No colormap, no scaling, no blending
 * — this is the pure V-layer copy primitive; the lit, scaled
 * column-draw path used by sprites and walls routes through
 * {@link rDrawColumn} in `drawPrimitives.ts`.
 *
 * Per-pixel bounds checking silently discards out-of-framebuffer writes.
 * Vanilla on DOS had a `RANGECHECK_DRAW` assert that `I_Error`'d on
 * out-of-bounds patches and was compiled out in release builds —
 * release behavior on DOS was "write into wrong memory".  Uint8Array
 * silently discards negative indices but would wrap on indices past
 * `length`, so we clip both axes explicitly to avoid accidental row
 * wrap without changing any in-bounds pixel.
 *
 * This module is pure buffer decoding and array writes — no Win32 or
 * runtime dependencies.
 *
 * @example
 * ```ts
 * import { decodePatch, drawPatch } from "../src/render/patchDraw.ts";
 * const patch = decodePatch(lumpBuffer);
 * const framebuffer = new Uint8Array(320 * 200);
 * drawPatch(patch, 160, 100, framebuffer);
 * ```
 */

import { SCREENHEIGHT, SCREENWIDTH } from './projection.ts';

/** Size in bytes of the fixed patch header (width, height, leftOffset, topOffset). */
export const PATCH_HEADER_BYTES = 8;

/** Size in bytes of each entry in the `columnOffsets` table (int32 LE). */
export const PATCH_COLUMN_OFFSET_BYTES = 4;

/** Sentinel byte that terminates a column's post chain (vanilla `0xff`). */
export const PATCH_COLUMN_END_MARKER = 0xff;

/** Header bytes consumed before pixel data inside a post (topDelta, length, leading pad). */
export const POST_HEADER_BYTES = 3;

/** Trailing pad byte vanilla writes after the pixel run in each post. */
export const POST_TRAILING_PAD_BYTES = 1;

/**
 * Parsed header of a DOOM patch lump.  Matches the first 8 bytes of
 * the lump: width/height are the bounding-box dimensions and
 * leftOffset/topOffset are the signed sprite-origin adjustments the
 * draw path subtracts from the caller's `(x, y)`.
 */
export interface PatchHeader {
  /** Column count (int16 LE at offset 0). */
  readonly width: number;
  /** Row count (int16 LE at offset 2). */
  readonly height: number;
  /** Signed horizontal origin offset (int16 LE at offset 4). */
  readonly leftOffset: number;
  /** Signed vertical origin offset (int16 LE at offset 6). */
  readonly topOffset: number;
}

/**
 * A single post inside a patch column.  `topDelta` is the row offset
 * inside the patch where `pixels[0]` is blitted; `pixels.length ===
 * length`.
 */
export interface PatchPost {
  /** Row offset of the first pixel of this post within the patch. */
  readonly topDelta: number;
  /** Pixel count in this post (matches `pixels.length`). */
  readonly length: number;
  /** Palette-indexed pixel bytes, row-major (one per row of the post). */
  readonly pixels: Uint8Array;
}

/** A patch column, in the order the posts appear in the lump. */
export type PatchColumn = readonly PatchPost[];

/**
 * Fully-decoded patch: header plus `header.width` columns, each column
 * a frozen array of posts.  A column containing only an end marker
 * decodes as an empty array.
 */
export interface DecodedPatch {
  /** Decoded header block. */
  readonly header: PatchHeader;
  /** Exactly `header.width` columns, in lump-order. */
  readonly columns: readonly PatchColumn[];
}

/**
 * Decode a DOOM patch lump buffer into its header and column posts.
 *
 * The returned {@link DecodedPatch} is frozen at every level — the
 * header, the columns array, each column's post array, and each
 * post's `pixels` view is an independent `Uint8Array` copy (via
 * `buffer.slice`) so callers can keep the decoded patch alive after
 * the source buffer is reclaimed.
 *
 * @param buffer - Raw patch lump bytes (header at offset 0).
 * @returns Frozen {@link DecodedPatch}.
 * @throws {RangeError} If a column offset points past the end of the
 *   buffer or a post's pixel run extends past the end.
 * @example
 * ```ts
 * import { decodePatch } from "../src/render/patchDraw.ts";
 * const patch = decodePatch(lumpBuffer);
 * console.log(patch.header.width, patch.header.height);
 * console.log(patch.columns[0][0].pixels.length); // first post length
 * ```
 */
export function decodePatch(buffer: Uint8Array): DecodedPatch {
  if (buffer.length < PATCH_HEADER_BYTES) {
    throw new RangeError(`Patch buffer too small for header: ${buffer.length} bytes`);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const width = view.getInt16(0, true);
  const height = view.getInt16(2, true);
  const leftOffset = view.getInt16(4, true);
  const topOffset = view.getInt16(6, true);

  const columnTableBytes = width * PATCH_COLUMN_OFFSET_BYTES;
  if (buffer.length < PATCH_HEADER_BYTES + columnTableBytes) {
    throw new RangeError(`Patch buffer too small for ${width}-column offset table: ${buffer.length} bytes`);
  }

  const columns: PatchColumn[] = new Array(width);
  for (let col = 0; col < width; col += 1) {
    const columnOffset = view.getInt32(PATCH_HEADER_BYTES + col * PATCH_COLUMN_OFFSET_BYTES, true);
    const posts: PatchPost[] = [];
    let cursor = columnOffset;
    while (true) {
      if (cursor < 0 || cursor >= buffer.length) {
        throw new RangeError(`Column ${col} post header at offset ${cursor} is out of range (buffer length ${buffer.length})`);
      }
      const topDelta = buffer[cursor]!;
      if (topDelta === PATCH_COLUMN_END_MARKER) {
        break;
      }
      if (cursor + POST_HEADER_BYTES > buffer.length) {
        throw new RangeError(`Column ${col} post at offset ${cursor} header extends past buffer end`);
      }
      const length = buffer[cursor + 1]!;
      const pixelsStart = cursor + POST_HEADER_BYTES;
      if (pixelsStart + length > buffer.length) {
        throw new RangeError(`Column ${col} post at offset ${cursor} pixel run extends past buffer end`);
      }
      const pixels = buffer.slice(pixelsStart, pixelsStart + length);
      posts.push(Object.freeze({ topDelta, length, pixels }));
      cursor = pixelsStart + length + POST_TRAILING_PAD_BYTES;
    }
    columns[col] = Object.freeze(posts);
  }

  return Object.freeze({
    header: Object.freeze({ width, height, leftOffset, topOffset }),
    columns: Object.freeze(columns),
  });
}

/**
 * Blit a decoded patch into an 8-bit palette-indexed framebuffer,
 * reproducing v_video.c `V_DrawPatch` byte-for-byte.
 *
 * The patch origin lands at `(x - leftOffset, y - topOffset)`.  Each
 * post writes its `pixels` bytes into consecutive framebuffer rows
 * starting at `originY + topDelta`.  Gaps between posts (and every
 * column whose post chain is empty) are skipped — the framebuffer
 * bytes underneath are left untouched so the caller's prior content
 * shows through the masked pixels.
 *
 * Out-of-range destination columns and rows are skipped silently;
 * in-bounds pixels are parity-identical to vanilla.  No colormap and
 * no scaling are applied — pixel bytes are written as-is, so `pixels`
 * is assumed to already hold palette indices.
 *
 * @param patch - Decoded patch (from {@link decodePatch}).
 * @param x - Screen X where the patch origin (after leftOffset) lands.
 * @param y - Screen Y where the patch origin (after topOffset) lands.
 * @param framebuffer - 8-bit destination buffer.
 * @param screenWidth - Row stride (defaults to {@link SCREENWIDTH}).
 * @param screenHeight - Framebuffer row count (defaults to {@link SCREENHEIGHT}).
 * @example
 * ```ts
 * import { decodePatch, drawPatch } from "../src/render/patchDraw.ts";
 * const patch = decodePatch(lumpBuffer);
 * const framebuffer = new Uint8Array(320 * 200);
 * drawPatch(patch, 160, 100, framebuffer);
 * ```
 */
export function drawPatch(patch: DecodedPatch, x: number, y: number, framebuffer: Uint8Array, screenWidth: number = SCREENWIDTH, screenHeight: number = SCREENHEIGHT): void {
  const originX = x - patch.header.leftOffset;
  const originY = y - patch.header.topOffset;
  const { columns } = patch;
  const columnCount = patch.header.width;

  for (let col = 0; col < columnCount; col += 1) {
    const screenX = originX + col;
    if (screenX < 0 || screenX >= screenWidth) {
      continue;
    }
    const posts = columns[col]!;
    for (let postIndex = 0; postIndex < posts.length; postIndex += 1) {
      const post = posts[postIndex]!;
      const postTopY = originY + post.topDelta;
      const { pixels, length } = post;
      for (let row = 0; row < length; row += 1) {
        const screenY = postTopY + row;
        if (screenY < 0 || screenY >= screenHeight) {
          continue;
        }
        framebuffer[screenY * screenWidth + screenX] = pixels[row]!;
      }
    }
  }
}
