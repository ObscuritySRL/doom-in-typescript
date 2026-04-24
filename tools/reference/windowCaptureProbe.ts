/**
 * Window capture feasibility probe for oracle framebuffer verification.
 *
 * Defines the GDI capture pipeline configuration, Win32 constants,
 * BITMAPINFOHEADER layout, and the capture step sequence needed to
 * read the Chocolate Doom window's client area into a pixel buffer.
 * This module is a feasibility proof — it declares what is needed
 * and verifies that the required APIs exist in the bun-win32 packages,
 * but does not execute a live capture.
 *
 * @example
 * ```ts
 * import { CAPTURE_PIPELINE } from "../../tools/reference/windowCaptureProbe.ts";
 * console.log(CAPTURE_PIPELINE.displayWidth); // 640
 * ```
 */

import { dlopen, FFIType, ptr } from 'bun:ffi';

import type { ScreenParameters } from '../../src/oracles/referenceRunManifest.ts';

// ---------------------------------------------------------------------------
// GDI raster-operation and DIB constants (not in @bun-win32/gdi32 types)
// ---------------------------------------------------------------------------

/** Raster operation: copy source rectangle to destination as-is. */
export const SRCCOPY = 0x00cc_0020;

/** GetDIBits / SetDIBits usage flag: palette is literal RGB values. */
export const DIB_RGB_COLORS = 0;

/** BITMAPINFOHEADER biCompression: uncompressed RGB. */
export const BI_RGB = 0;

// ---------------------------------------------------------------------------
// BITMAPINFOHEADER struct layout (40 bytes)
// ---------------------------------------------------------------------------

/** Size of a BITMAPINFOHEADER structure in bytes. */
export const BITMAPINFOHEADER_SIZE = 40;

/**
 * Byte offsets within a BITMAPINFOHEADER structure.
 *
 * All fields are little-endian.  The struct is packed to 40 bytes
 * with no padding.
 *
 * Reference: Microsoft Win32 BITMAPINFOHEADER documentation.
 */
export const BITMAPINFOHEADER_OFFSETS = Object.freeze({
  /** uint32 — Structure size (always 40). */
  biSize: 0,
  /** int32 — Bitmap width in pixels. */
  biWidth: 4,
  /** int32 — Bitmap height in pixels (positive = bottom-up). */
  biHeight: 8,
  /** uint16 — Number of color planes (always 1). */
  biPlanes: 12,
  /** uint16 — Bits per pixel (32 for BGRA). */
  biBitCount: 14,
  /** uint32 — Compression type (BI_RGB = 0 for uncompressed). */
  biCompression: 16,
  /** uint32 — Image data size (may be 0 for BI_RGB). */
  biSizeImage: 20,
  /** int32 — Horizontal resolution in pixels per meter. */
  biXPelsPerMeter: 24,
  /** int32 — Vertical resolution in pixels per meter. */
  biYPelsPerMeter: 28,
  /** uint32 — Number of used color indices (0 = max for bit depth). */
  biClrUsed: 32,
  /** uint32 — Number of required color indices (0 = all). */
  biClrImportant: 36,
} as const);

// ---------------------------------------------------------------------------
// Capture pipeline configuration
// ---------------------------------------------------------------------------

/** Chocolate Doom SDL window title as observed in reference runs. */
export const CHOCOLATE_DOOM_WINDOW_TITLE = 'Chocolate Doom 2.2.1';

/** Bytes per pixel in the GDI capture bitmap (32-bit BGRA). */
export const CAPTURE_BITS_PER_PIXEL = 32;

/** Bytes per pixel as a byte count. */
export const CAPTURE_BYTES_PER_PIXEL = CAPTURE_BITS_PER_PIXEL / 8;

/**
 * A single step in the GDI window capture pipeline.
 *
 * Steps are ordered and must execute in sequence.  Each step
 * names the Win32 API, which bun-win32 package provides it,
 * and a brief description of what the call accomplishes.
 */
export interface CaptureStep {
  /** Sequential step number (1-based). */
  readonly order: number;
  /** Win32 API function name. */
  readonly apiFunction: string;
  /** bun-win32 package that exports this function. */
  readonly package: string;
  /** What this step accomplishes in the capture pipeline. */
  readonly description: string;
}

/**
 * Complete configuration for the GDI window capture pipeline.
 *
 * Derived from the reference run manifest screen parameters.
 * The pipeline captures the Chocolate Doom window's client area
 * at display resolution (640x480x32bpp) via GDI BitBlt, then
 * reads the pixel data via GetDIBits into a BGRA buffer.
 */
export interface CapturePipelineConfig {
  /** Expected display width of the Chocolate Doom window client area. */
  readonly displayWidth: number;
  /** Expected display height of the Chocolate Doom window client area. */
  readonly displayHeight: number;
  /** Bits per pixel of the captured bitmap. */
  readonly bitsPerPixel: number;
  /** Total byte size of the captured pixel buffer. */
  readonly captureBufferSize: number;
  /** Doom's internal framebuffer width for downscale target. */
  readonly internalWidth: number;
  /** Doom's internal framebuffer height for downscale target. */
  readonly internalHeight: number;
  /** Window title used to locate the Chocolate Doom window. */
  readonly windowTitle: string;
  /** Ordered capture pipeline steps. */
  readonly steps: readonly CaptureStep[];
}

/**
 * Ordered sequence of GDI capture pipeline steps.
 *
 * Each step names the exact Win32 API function and bun-win32 package.
 * The pipeline follows the standard GDI screen-capture pattern:
 * find window, get its DC, create a compatible memory DC and bitmap,
 * BitBlt the client area, read back the pixel data, then clean up.
 */
export const CAPTURE_STEPS: readonly CaptureStep[] = Object.freeze([
  Object.freeze({
    order: 1,
    apiFunction: 'FindWindowW',
    package: '@bun-win32/user32',
    description: 'Locate the Chocolate Doom window by title',
  } satisfies CaptureStep),
  Object.freeze({
    order: 2,
    apiFunction: 'GetClientRect',
    package: '@bun-win32/user32',
    description: 'Query the client area dimensions to verify 640x480',
  } satisfies CaptureStep),
  Object.freeze({
    order: 3,
    apiFunction: 'GetDC',
    package: '@bun-win32/user32',
    description: 'Obtain a device context for the window client area',
  } satisfies CaptureStep),
  Object.freeze({
    order: 4,
    apiFunction: 'CreateCompatibleDC',
    package: '@bun-win32/gdi32',
    description: 'Create a memory device context compatible with the window DC',
  } satisfies CaptureStep),
  Object.freeze({
    order: 5,
    apiFunction: 'CreateCompatibleBitmap',
    package: '@bun-win32/gdi32',
    description: 'Create a bitmap at display dimensions for the memory DC',
  } satisfies CaptureStep),
  Object.freeze({
    order: 6,
    apiFunction: 'SelectObject',
    package: '@bun-win32/gdi32',
    description: 'Select the bitmap into the memory DC',
  } satisfies CaptureStep),
  Object.freeze({
    order: 7,
    apiFunction: 'BitBlt',
    package: '@bun-win32/gdi32',
    description: 'Copy the window client area to the memory DC bitmap',
  } satisfies CaptureStep),
  Object.freeze({
    order: 8,
    apiFunction: 'GetDIBits',
    package: '@bun-win32/gdi32',
    description: 'Read the bitmap pixel data into a BGRA buffer',
  } satisfies CaptureStep),
  Object.freeze({
    order: 9,
    apiFunction: 'SelectObject',
    package: '@bun-win32/gdi32',
    description: 'Restore the original bitmap in the memory DC',
  } satisfies CaptureStep),
  Object.freeze({
    order: 10,
    apiFunction: 'DeleteObject',
    package: '@bun-win32/gdi32',
    description: 'Delete the capture bitmap',
  } satisfies CaptureStep),
  Object.freeze({
    order: 11,
    apiFunction: 'DeleteDC',
    package: '@bun-win32/gdi32',
    description: 'Delete the memory device context',
  } satisfies CaptureStep),
  Object.freeze({
    order: 12,
    apiFunction: 'ReleaseDC',
    package: '@bun-win32/user32',
    description: 'Release the window device context',
  } satisfies CaptureStep),
]);

/**
 * Frozen capture pipeline configuration derived from the reference
 * run manifest's screen parameters.
 *
 * The capture buffer size is displayWidth * displayHeight * 4 bytes
 * (32-bit BGRA).  The internal dimensions define the downscale target
 * for framebuffer hash comparison with the oracle.
 */
export const CAPTURE_PIPELINE: CapturePipelineConfig = Object.freeze({
  displayWidth: 640,
  displayHeight: 480,
  bitsPerPixel: CAPTURE_BITS_PER_PIXEL,
  captureBufferSize: 640 * 480 * CAPTURE_BYTES_PER_PIXEL,
  internalWidth: 320,
  internalHeight: 200,
  windowTitle: CHOCOLATE_DOOM_WINDOW_TITLE,
  steps: CAPTURE_STEPS,
} satisfies CapturePipelineConfig);

/**
 * Set of unique Win32 API function names required by the capture pipeline.
 *
 * Exported for test verification that every required API is available
 * in the bun-win32 packages.
 */
export const REQUIRED_API_FUNCTIONS: readonly string[] = Object.freeze([
  'BitBlt',
  'CreateCompatibleBitmap',
  'CreateCompatibleDC',
  'DeleteDC',
  'DeleteObject',
  'FindWindowW',
  'GetClientRect',
  'GetDC',
  'GetDIBits',
  'ReleaseDC',
  'SelectObject',
] as const);

/**
 * Mapping of required API functions to their bun-win32 package names.
 *
 * Used to verify that every function is available from its declared package.
 */
export const API_PACKAGE_MAP: ReadonlyMap<string, string> = new Map([
  ['BitBlt', '@bun-win32/gdi32'],
  ['CreateCompatibleBitmap', '@bun-win32/gdi32'],
  ['CreateCompatibleDC', '@bun-win32/gdi32'],
  ['DeleteDC', '@bun-win32/gdi32'],
  ['DeleteObject', '@bun-win32/gdi32'],
  ['FindWindowW', '@bun-win32/user32'],
  ['GetClientRect', '@bun-win32/user32'],
  ['GetDC', '@bun-win32/user32'],
  ['GetDIBits', '@bun-win32/gdi32'],
  ['ReleaseDC', '@bun-win32/user32'],
  ['SelectObject', '@bun-win32/gdi32'],
]);

/**
 * Builds a BITMAPINFOHEADER buffer for GetDIBits at the given dimensions.
 *
 * The returned buffer is 40 bytes (BITMAPINFOHEADER_SIZE) with all fields
 * in little-endian layout.  biHeight is negative to produce a top-down
 * DIB, matching the typical screen-coordinate convention.
 *
 * @param width - Bitmap width in pixels
 * @param height - Bitmap height in pixels (stored as negative for top-down)
 * @returns A 40-byte Buffer containing the packed BITMAPINFOHEADER
 *
 * @example
 * ```ts
 * const header = buildBitmapInfoHeader(640, 480);
 * console.log(header.byteLength); // 40
 * ```
 */
export function buildBitmapInfoHeader(width: number, height: number): Buffer {
  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError(`width must be a positive integer, got ${width}`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new RangeError(`height must be a positive integer, got ${height}`);
  }

  const buffer = Buffer.alloc(BITMAPINFOHEADER_SIZE);
  buffer.writeUInt32LE(BITMAPINFOHEADER_SIZE, BITMAPINFOHEADER_OFFSETS.biSize);
  buffer.writeInt32LE(width, BITMAPINFOHEADER_OFFSETS.biWidth);
  buffer.writeInt32LE(-height, BITMAPINFOHEADER_OFFSETS.biHeight);
  buffer.writeUInt16LE(1, BITMAPINFOHEADER_OFFSETS.biPlanes);
  buffer.writeUInt16LE(CAPTURE_BITS_PER_PIXEL, BITMAPINFOHEADER_OFFSETS.biBitCount);
  buffer.writeUInt32LE(BI_RGB, BITMAPINFOHEADER_OFFSETS.biCompression);
  buffer.writeUInt32LE(width * height * CAPTURE_BYTES_PER_PIXEL, BITMAPINFOHEADER_OFFSETS.biSizeImage);
  return buffer;
}

/**
 * Validates that the capture pipeline configuration is consistent
 * with the given reference screen parameters.
 *
 * @param screen - Screen parameters from the reference run manifest
 * @returns An array of inconsistency descriptions (empty if valid)
 *
 * @example
 * ```ts
 * import { REFERENCE_RUN_MANIFEST } from "../../src/oracles/referenceRunManifest.ts";
 * const issues = validateCaptureConfig(REFERENCE_RUN_MANIFEST.screen);
 * console.log(issues.length); // 0
 * ```
 */
export function validateCaptureConfig(screen: ScreenParameters): readonly string[] {
  const issues: string[] = [];
  if (CAPTURE_PIPELINE.displayWidth !== screen.displayWidth) {
    issues.push(`displayWidth mismatch: pipeline=${CAPTURE_PIPELINE.displayWidth}, manifest=${screen.displayWidth}`);
  }
  if (CAPTURE_PIPELINE.displayHeight !== screen.displayHeight) {
    issues.push(`displayHeight mismatch: pipeline=${CAPTURE_PIPELINE.displayHeight}, manifest=${screen.displayHeight}`);
  }
  if (CAPTURE_PIPELINE.bitsPerPixel !== screen.bitsPerPixel) {
    issues.push(`bitsPerPixel mismatch: pipeline=${CAPTURE_PIPELINE.bitsPerPixel}, manifest=${screen.bitsPerPixel}`);
  }
  if (CAPTURE_PIPELINE.internalWidth !== screen.internalWidth) {
    issues.push(`internalWidth mismatch: pipeline=${CAPTURE_PIPELINE.internalWidth}, manifest=${screen.internalWidth}`);
  }
  if (CAPTURE_PIPELINE.internalHeight !== screen.internalHeight) {
    issues.push(`internalHeight mismatch: pipeline=${CAPTURE_PIPELINE.internalHeight}, manifest=${screen.internalHeight}`);
  }
  const expectedBuffer = CAPTURE_PIPELINE.displayWidth * CAPTURE_PIPELINE.displayHeight * CAPTURE_BYTES_PER_PIXEL;
  if (CAPTURE_PIPELINE.captureBufferSize !== expectedBuffer) {
    issues.push(`captureBufferSize mismatch: pipeline=${CAPTURE_PIPELINE.captureBufferSize}, expected=${expectedBuffer}`);
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Live FFI feasibility proof
// ---------------------------------------------------------------------------

/** FFI symbol definitions for user32.dll capture functions. */
export const USER32_CAPTURE_SYMBOLS = {
  FindWindowW: { args: [FFIType.ptr, FFIType.ptr] as const, returns: FFIType.u64 },
  GetClientRect: { args: [FFIType.u64, FFIType.ptr] as const, returns: FFIType.i32 },
  GetDC: { args: [FFIType.u64] as const, returns: FFIType.u64 },
  GetDesktopWindow: { args: [] as const, returns: FFIType.u64 },
  ReleaseDC: { args: [FFIType.u64, FFIType.u64] as const, returns: FFIType.i32 },
} as const;

/** FFI symbol definitions for gdi32.dll capture functions. */
export const GDI32_CAPTURE_SYMBOLS = {
  BitBlt: {
    args: [FFIType.u64, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.u64, FFIType.i32, FFIType.i32, FFIType.u32] as const,
    returns: FFIType.i32,
  },
  CreateCompatibleBitmap: { args: [FFIType.u64, FFIType.i32, FFIType.i32] as const, returns: FFIType.u64 },
  CreateCompatibleDC: { args: [FFIType.u64] as const, returns: FFIType.u64 },
  DeleteDC: { args: [FFIType.u64] as const, returns: FFIType.i32 },
  DeleteObject: { args: [FFIType.u64] as const, returns: FFIType.i32 },
  GetDIBits: {
    args: [FFIType.u64, FFIType.u64, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.u32] as const,
    returns: FFIType.i32,
  },
  SelectObject: { args: [FFIType.u64, FFIType.u64] as const, returns: FFIType.u64 },
} as const;

/** Result of a live desktop region capture. */
export interface WindowCaptureResult {
  /** Width of the captured region in pixels. */
  readonly width: number;
  /** Height of the captured region in pixels. */
  readonly height: number;
  /** Raw BGRA pixel data (4 bytes per pixel, top-down scan order). */
  readonly pixels: Buffer;
  /** Number of scan lines successfully read by GetDIBits. */
  readonly scanLinesRead: number;
}

/**
 * Captures a region of the desktop into a BGRA pixel buffer.
 *
 * Executes the full GDI capture pipeline (GetDesktopWindow → GetDC →
 * CreateCompatibleDC → CreateCompatibleBitmap → SelectObject → BitBlt →
 * GetDIBits) using direct bun:ffi dlopen calls.  All Win32 handles are
 * released in finally blocks to prevent resource leaks.
 *
 * Uses the desktop window (always available) as a stand-in for the
 * Chocolate Doom window, proving the pipeline is functional end-to-end.
 *
 * @param width - Width of the region to capture in pixels
 * @param height - Height of the region to capture in pixels
 * @returns The capture result with pixel data and metadata
 *
 * @example
 * ```ts
 * const result = captureDesktopRegion(64, 48);
 * console.log(result.pixels.byteLength); // 64 * 48 * 4 = 12288
 * ```
 */
export function captureDesktopRegion(width: number, height: number): WindowCaptureResult {
  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError(`width must be a positive integer, got ${width}`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new RangeError(`height must be a positive integer, got ${height}`);
  }

  const user32 = dlopen('user32.dll', USER32_CAPTURE_SYMBOLS);
  let gdi32;
  try {
    gdi32 = dlopen('gdi32.dll', GDI32_CAPTURE_SYMBOLS);
  } catch (error) {
    user32.close();
    throw error;
  }

  try {
    const hDesktop = user32.symbols.GetDesktopWindow();
    if (hDesktop === 0n) {
      throw new Error('GetDesktopWindow returned NULL');
    }

    const hWindowDC = user32.symbols.GetDC(hDesktop);
    if (hWindowDC === 0n) {
      throw new Error('GetDC returned NULL');
    }

    try {
      const hMemoryDC = gdi32.symbols.CreateCompatibleDC(hWindowDC);
      if (hMemoryDC === 0n) {
        throw new Error('CreateCompatibleDC returned NULL');
      }

      try {
        const hBitmap = gdi32.symbols.CreateCompatibleBitmap(hWindowDC, width, height);
        if (hBitmap === 0n) {
          throw new Error('CreateCompatibleBitmap returned NULL');
        }

        try {
          const hOldBitmap = gdi32.symbols.SelectObject(hMemoryDC, hBitmap);
          if (hOldBitmap === 0n) {
            throw new Error('SelectObject returned NULL');
          }

          try {
            const bitBltResult = gdi32.symbols.BitBlt(hMemoryDC, 0, 0, width, height, hWindowDC, 0, 0, SRCCOPY);
            if (bitBltResult === 0) {
              throw new Error('BitBlt failed');
            }

            const bitmapInfoHeader = buildBitmapInfoHeader(width, height);
            const pixels = Buffer.alloc(width * height * CAPTURE_BYTES_PER_PIXEL);

            const scanLinesRead = gdi32.symbols.GetDIBits(hWindowDC, hBitmap, 0, height, ptr(pixels), ptr(bitmapInfoHeader), DIB_RGB_COLORS);
            if (scanLinesRead !== height) {
              throw new Error(`GetDIBits read ${scanLinesRead} scan lines, expected ${height}`);
            }

            return { width, height, pixels, scanLinesRead };
          } finally {
            gdi32.symbols.SelectObject(hMemoryDC, hOldBitmap);
          }
        } finally {
          gdi32.symbols.DeleteObject(hBitmap);
        }
      } finally {
        gdi32.symbols.DeleteDC(hMemoryDC);
      }
    } finally {
      user32.symbols.ReleaseDC(hDesktop, hWindowDC);
    }
  } finally {
    gdi32.close();
    user32.close();
  }
}
