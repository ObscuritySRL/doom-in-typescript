/**
 * Vanilla DOOM 1.9 Win32 window-host primitives.
 *
 * Plan_final step `03-005` (lane: launch-host-input) wires the final
 * runtime 320x200 framebuffer to a Win32 host without going through
 * the historical `LauncherSession` glue path.  This module exposes
 * the pure-arithmetic primitives a vanilla-host driver needs to:
 *
 *   1. Allocate the canonical 320x200 indexed framebuffer (one byte
 *      per pixel, 64 000 bytes total).
 *   2. Build a palette → BGRA lookup table that mirrors the
 *      Chocolate Doom 2.2.1 `I_BlitBuffer` palette-to-DIB conversion.
 *   3. Convert an indexed frame into the BGRA buffer GDI
 *      `StretchDIBits` expects, with no per-pixel branching beyond a
 *      single 256-entry table lookup.
 *   4. Build the 40-byte `BITMAPINFOHEADER` that GDI requires to
 *      describe the source bitmap, using the same negative-height
 *      top-down layout the launcher uses.
 *   5. Derive the on-screen presentation rectangle for a given
 *      client area, delegating to {@link computePresentationRect}
 *      with `aspect_ratio_correct = true` (the Chocolate Doom
 *      reference default).
 *
 * The actual Win32 window-creation and GDI present loop is
 * intentionally **not** inlined here.  FFI calls into `user32` /
 * `gdi32` cannot be unit-tested without a real window, and the
 * launcher already pins a working end-to-end implementation at
 * `src/launcher/win32.ts`.  This module's role is to expose the
 * building blocks a later launch-host-input step can wire into a
 * `D_DoomLoop`-driven host driver, with the launcher session glue
 * removed.
 *
 * Parity-critical details preserved here:
 *
 *   - Framebuffer dimensions are sourced from the read-only
 *     `windowPolicy.ts` constants (`SCREENWIDTH = 320`,
 *     `SCREENHEIGHT = 200`) — the vanilla mode-13h dimensions.
 *   - The palette lookup packs each color as
 *     `0xFF_RR_GG_BB` little-endian (so when read out of a 32-bit
 *     buffer on x86 the bytes appear as `B, G, R, A` — matching
 *     GDI's 32-bit BGRA expectation in `BI_RGB` mode).
 *   - The bitmap-info header uses a **negative** height to declare
 *     a top-down DIB, matching the launcher's convention and
 *     avoiding the vertical flip GDI applies to positive-height
 *     bottom-up bitmaps.
 *   - The presentation rectangle is computed with
 *     `aspect_ratio_correct = true` — Chocolate Doom 2.2.1's
 *     default config installs `aspect_ratio_correct = 1`, which
 *     stretches the 200-scanline framebuffer to a 240-scanline
 *     display so the output is 4:3.
 *
 * @example
 * ```ts
 * import {
 *   buildBgraPaletteLookup,
 *   buildVanillaBitmapInfoHeader,
 *   computeVanillaPresentationRect,
 *   convertIndexedFrameToBgra,
 *   createIndexedFramebuffer,
 *   VANILLA_FRAMEBUFFER_BYTE_LENGTH,
 * } from './win32WindowHost.ts';
 *
 * const framebuffer = createIndexedFramebuffer();
 * framebuffer.length;            // 64000
 * VANILLA_FRAMEBUFFER_BYTE_LENGTH; // 64000
 *
 * const paletteLookup = buildBgraPaletteLookup(palette);
 * const bgraBuffer = new Uint32Array(framebuffer.length);
 * convertIndexedFrameToBgra(framebuffer, bgraBuffer, paletteLookup);
 *
 * const header = buildVanillaBitmapInfoHeader();
 * header.byteLength;             // 40
 *
 * const presentationRect = computeVanillaPresentationRect(640, 480);
 * presentationRect.width;        // 640
 * presentationRect.height;       // 480
 * ```
 */

import type { PresentationRect } from '../host/windowPolicy.ts';
import { SCREENHEIGHT, SCREENWIDTH, computePresentationRect } from '../host/windowPolicy.ts';

/**
 * Total byte length of the vanilla 320×200 indexed framebuffer.
 * Equal to `SCREENWIDTH * SCREENHEIGHT = 64 000`.  Exported as a
 * constant so a later host bring-up step can allocate scratch
 * buffers of the same length without re-deriving the product.
 */
export const VANILLA_FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;

/**
 * Number of entries in the vanilla DOOM 1.9 palette.  The IWAD's
 * `PLAYPAL` lump contains 14 palettes of 256 entries each; only one
 * palette is active at a time so the lookup table is sized to 256.
 */
export const VANILLA_PALETTE_ENTRY_COUNT = 256;

/**
 * Bytes per palette entry in the on-disk `PLAYPAL` layout (R, G, B
 * triplets, 8 bits per channel).
 */
const PALETTE_BYTES_PER_ENTRY = 3;

/**
 * Byte length of the 40-byte BITMAPINFOHEADER GDI expects for a
 * `BI_RGB` 32-bit-per-pixel bitmap.
 */
export const BITMAP_INFO_HEADER_BYTE_LENGTH = 40;

/**
 * 32-bit-per-pixel pixel format used in the GDI BITMAPINFOHEADER.
 * The bitmap stores one pixel per `Uint32` in BGRA byte order on
 * little-endian hosts when read out of a 32-bit buffer.
 */
const BITMAP_BITS_PER_PIXEL = 32;

/**
 * GDI `BI_RGB` compression constant — used here to declare that
 * the bitmap is uncompressed and stores its pixels directly in
 * the chosen bit-depth's natural byte order.
 */
const BITMAP_COMPRESSION_BI_RGB = 0;

/** Alpha byte (channel A in 0xAA_RR_GG_BB) of the packed BGRA lookup entries. */
const PACKED_BGRA_OPAQUE_ALPHA = 0xff00_0000;

/**
 * Allocate a fresh 320×200 indexed framebuffer.
 *
 * Each element is one byte representing a palette index in the
 * range `[0, 255]`.  The buffer is zero-filled, which corresponds
 * to palette entry 0 (vanilla DOOM's "black" entry).
 *
 * @returns A new `Uint8Array` of length 64 000 — the exact byte
 *   length the vanilla `screens[0]` mode-13h framebuffer occupies.
 */
export function createIndexedFramebuffer(): Uint8Array {
  return new Uint8Array(VANILLA_FRAMEBUFFER_BYTE_LENGTH);
}

/**
 * Build the 256-entry palette → BGRA lookup table used by the
 * indexed-to-BGRA conversion routine.
 *
 * The input palette must be at least
 * `VANILLA_PALETTE_ENTRY_COUNT * 3 = 768` bytes long (one PLAYPAL
 * entry).  Each output entry packs the corresponding palette color
 * as `0xFF_RR_GG_BB` so a 32-bit read on a little-endian host
 * produces the byte sequence `B, G, R, A` GDI's `BI_RGB`
 * `StretchDIBits` expects.  The alpha byte is always 0xFF (fully
 * opaque) — matching the launcher's convention.
 *
 * @param palette Raw RGB triplet bytes from PLAYPAL.  Length must
 *                be ≥ 768.
 * @returns A frozen-length `Uint32Array` of 256 BGRA entries.
 *
 * @example
 * ```ts
 * const lookup = buildBgraPaletteLookup(playpalEntry0);
 * lookup.length;                 // 256
 * (lookup[0]! >>> 24).toString(16); // "ff"
 * ```
 */
export function buildBgraPaletteLookup(palette: Uint8Array): Uint32Array {
  if (palette.length < VANILLA_PALETTE_ENTRY_COUNT * PALETTE_BYTES_PER_ENTRY) {
    throw new Error(`buildBgraPaletteLookup expected at least ${VANILLA_PALETTE_ENTRY_COUNT * PALETTE_BYTES_PER_ENTRY} palette bytes; received ${palette.length}`);
  }
  const lookup = new Uint32Array(VANILLA_PALETTE_ENTRY_COUNT);
  for (let colorIndex = 0; colorIndex < VANILLA_PALETTE_ENTRY_COUNT; colorIndex += 1) {
    const paletteOffset = colorIndex * PALETTE_BYTES_PER_ENTRY;
    const red = palette[paletteOffset]!;
    const green = palette[paletteOffset + 1]!;
    const blue = palette[paletteOffset + 2]!;
    lookup[colorIndex] = (blue | (green << 8) | (red << 16) | PACKED_BGRA_OPAQUE_ALPHA) >>> 0;
  }
  return lookup;
}

/**
 * Convert an indexed framebuffer into a BGRA pixel buffer via the
 * palette lookup table.  The destination buffer must be at least
 * as long as the source — `convertIndexedFrameToBgra` stops at
 * `source.length` pixels and does not read past the end.
 *
 * The loop body is the minimal hot-path conversion: one indexed
 * read, one 256-entry lookup, one 32-bit write per pixel.
 *
 * @param source        Indexed framebuffer (one byte per pixel).
 * @param destination   BGRA destination buffer (one Uint32 per pixel).
 * @param paletteLookup The 256-entry lookup table from
 *                      {@link buildBgraPaletteLookup}.
 * @throws Error When `destination.length < source.length` or
 *               `paletteLookup.length !== 256`.
 */
export function convertIndexedFrameToBgra(source: Uint8Array, destination: Uint32Array, paletteLookup: Uint32Array): void {
  if (paletteLookup.length !== VANILLA_PALETTE_ENTRY_COUNT) {
    throw new Error(`convertIndexedFrameToBgra expected a ${VANILLA_PALETTE_ENTRY_COUNT}-entry palette lookup; received ${paletteLookup.length}`);
  }
  if (destination.length < source.length) {
    throw new Error(`convertIndexedFrameToBgra destination too small: needs ${source.length}, got ${destination.length}`);
  }
  for (let pixelIndex = 0; pixelIndex < source.length; pixelIndex += 1) {
    destination[pixelIndex] = paletteLookup[source[pixelIndex]!]!;
  }
}

/**
 * Build the 40-byte BITMAPINFOHEADER GDI uses to describe the
 * 320×200 BGRA bitmap during `StretchDIBits`.
 *
 * The header is laid out exactly as the Win32 SDK defines:
 *   - 4 bytes: `biSize = 40`
 *   - 4 bytes: `biWidth = 320` (positive, little-endian int32)
 *   - 4 bytes: `biHeight = -200` (negative, declares top-down DIB)
 *   - 2 bytes: `biPlanes = 1`
 *   - 2 bytes: `biBitCount = 32`
 *   - 4 bytes: `biCompression = BI_RGB = 0`
 *   - 4 bytes: `biSizeImage = width * height * 4 = 256 000`
 *   - 4 bytes: `biXPelsPerMeter = 0`
 *   - 4 bytes: `biYPelsPerMeter = 0`
 *   - 4 bytes: `biClrUsed = 0`
 *   - 4 bytes: `biClrImportant = 0`
 *
 * The negative height is intentional and matches the launcher's
 * top-down convention — without it GDI flips the image vertically
 * relative to the source memory layout.
 *
 * @returns A freshly allocated `Buffer` of length 40 bytes.
 */
export function buildVanillaBitmapInfoHeader(): Buffer {
  const header = Buffer.alloc(BITMAP_INFO_HEADER_BYTE_LENGTH);
  header.writeUInt32LE(BITMAP_INFO_HEADER_BYTE_LENGTH, 0);
  header.writeInt32LE(SCREENWIDTH, 4);
  header.writeInt32LE(-SCREENHEIGHT, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(BITMAP_BITS_PER_PIXEL, 14);
  header.writeUInt32LE(BITMAP_COMPRESSION_BI_RGB, 16);
  header.writeUInt32LE(VANILLA_FRAMEBUFFER_BYTE_LENGTH * (BITMAP_BITS_PER_PIXEL / 8), 20);
  return header;
}

/**
 * Compute the on-screen presentation rectangle for the vanilla
 * 320×200 framebuffer inside a client area of the given size.
 *
 * Delegates to {@link computePresentationRect} with
 * `aspect_ratio_correct = true` (the Chocolate Doom 2.2.1
 * reference default).  The 200-scanline framebuffer is stretched
 * to 240 scanlines so the output is 4:3, then letterboxed or
 * pillarboxed inside the client area as needed.
 *
 * @param clientWidth  Client area width in pixels.
 * @param clientHeight Client area height in pixels.
 * @returns A frozen presentation rectangle within the client area.
 */
export function computeVanillaPresentationRect(clientWidth: number, clientHeight: number): PresentationRect {
  return computePresentationRect(clientWidth, clientHeight, true);
}
