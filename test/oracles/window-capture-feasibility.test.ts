import { describe, expect, test } from 'bun:test';

import {
  API_PACKAGE_MAP,
  BI_RGB,
  BITMAPINFOHEADER_OFFSETS,
  BITMAPINFOHEADER_SIZE,
  CAPTURE_BITS_PER_PIXEL,
  CAPTURE_BYTES_PER_PIXEL,
  CAPTURE_PIPELINE,
  CAPTURE_STEPS,
  CHOCOLATE_DOOM_WINDOW_TITLE,
  DIB_RGB_COLORS,
  GDI32_CAPTURE_SYMBOLS,
  REQUIRED_API_FUNCTIONS,
  SRCCOPY,
  USER32_CAPTURE_SYMBOLS,
  buildBitmapInfoHeader,
  captureDesktopRegion,
  validateCaptureConfig,
} from '../../tools/reference/windowCaptureProbe.ts';
import type { CapturePipelineConfig, CaptureStep, WindowCaptureResult } from '../../tools/reference/windowCaptureProbe.ts';
import { REFERENCE_RUN_MANIFEST } from '../../src/oracles/referenceRunManifest.ts';
import { FRAMEBUFFER_HEIGHT, FRAMEBUFFER_WIDTH } from '../../src/oracles/framebufferHash.ts';

describe('GDI constants', () => {
  test('SRCCOPY is 0x00CC0020', () => {
    expect(SRCCOPY).toBe(0x00cc_0020);
  });

  test('DIB_RGB_COLORS is 0', () => {
    expect(DIB_RGB_COLORS).toBe(0);
  });

  test('BI_RGB is 0', () => {
    expect(BI_RGB).toBe(0);
  });
});

describe('BITMAPINFOHEADER layout', () => {
  test('struct size is 40 bytes', () => {
    expect(BITMAPINFOHEADER_SIZE).toBe(40);
  });

  test('offsets are sequential and non-overlapping', () => {
    const fields = [
      { name: 'biSize', offset: 0, size: 4 },
      { name: 'biWidth', offset: 4, size: 4 },
      { name: 'biHeight', offset: 8, size: 4 },
      { name: 'biPlanes', offset: 12, size: 2 },
      { name: 'biBitCount', offset: 14, size: 2 },
      { name: 'biCompression', offset: 16, size: 4 },
      { name: 'biSizeImage', offset: 20, size: 4 },
      { name: 'biXPelsPerMeter', offset: 24, size: 4 },
      { name: 'biYPelsPerMeter', offset: 28, size: 4 },
      { name: 'biClrUsed', offset: 32, size: 4 },
      { name: 'biClrImportant', offset: 36, size: 4 },
    ];
    for (const field of fields) {
      const actual: number = BITMAPINFOHEADER_OFFSETS[field.name as keyof typeof BITMAPINFOHEADER_OFFSETS];
      expect(actual).toBe(field.offset);
    }
    const lastField = fields[fields.length - 1];
    expect(lastField.offset + lastField.size).toBe(BITMAPINFOHEADER_SIZE);
  });

  test('offsets object is frozen', () => {
    expect(Object.isFrozen(BITMAPINFOHEADER_OFFSETS)).toBe(true);
  });

  test('contains all 11 BITMAPINFOHEADER fields', () => {
    expect(Object.keys(BITMAPINFOHEADER_OFFSETS)).toHaveLength(11);
  });
});

describe('capture pipeline configuration', () => {
  test('display dimensions match REFERENCE_RUN_MANIFEST', () => {
    expect(CAPTURE_PIPELINE.displayWidth).toBe(REFERENCE_RUN_MANIFEST.screen.displayWidth);
    expect(CAPTURE_PIPELINE.displayHeight).toBe(REFERENCE_RUN_MANIFEST.screen.displayHeight);
  });

  test('bits per pixel matches REFERENCE_RUN_MANIFEST', () => {
    expect(CAPTURE_PIPELINE.bitsPerPixel).toBe(REFERENCE_RUN_MANIFEST.screen.bitsPerPixel);
  });

  test('internal dimensions match framebuffer constants', () => {
    expect(CAPTURE_PIPELINE.internalWidth).toBe(FRAMEBUFFER_WIDTH);
    expect(CAPTURE_PIPELINE.internalHeight).toBe(FRAMEBUFFER_HEIGHT);
  });

  test('capture buffer size is displayWidth * displayHeight * 4', () => {
    const expected = CAPTURE_PIPELINE.displayWidth * CAPTURE_PIPELINE.displayHeight * CAPTURE_BYTES_PER_PIXEL;
    expect(CAPTURE_PIPELINE.captureBufferSize).toBe(expected);
    expect(CAPTURE_PIPELINE.captureBufferSize).toBe(640 * 480 * 4);
  });

  test('CAPTURE_BYTES_PER_PIXEL is CAPTURE_BITS_PER_PIXEL / 8', () => {
    expect(CAPTURE_BYTES_PER_PIXEL).toBe(CAPTURE_BITS_PER_PIXEL / 8);
    expect(CAPTURE_BYTES_PER_PIXEL).toBe(4);
  });

  test('window title matches Chocolate Doom version string', () => {
    expect(CAPTURE_PIPELINE.windowTitle).toBe(CHOCOLATE_DOOM_WINDOW_TITLE);
    expect(CAPTURE_PIPELINE.windowTitle).toContain('Chocolate Doom');
    expect(CAPTURE_PIPELINE.windowTitle).toContain('2.2.1');
  });

  test('pipeline object is frozen', () => {
    expect(Object.isFrozen(CAPTURE_PIPELINE)).toBe(true);
  });
});

describe('capture pipeline steps', () => {
  test('has 12 ordered steps', () => {
    expect(CAPTURE_STEPS).toHaveLength(12);
  });

  test('step orders are sequential 1 through 12', () => {
    for (let index = 0; index < CAPTURE_STEPS.length; index++) {
      expect(CAPTURE_STEPS[index].order).toBe(index + 1);
    }
  });

  test('first step is FindWindowW (locate the window)', () => {
    expect(CAPTURE_STEPS[0].apiFunction).toBe('FindWindowW');
  });

  test('last step is ReleaseDC (cleanup)', () => {
    expect(CAPTURE_STEPS[CAPTURE_STEPS.length - 1].apiFunction).toBe('ReleaseDC');
  });

  test('BitBlt step uses SRCCOPY raster operation', () => {
    const bitBltStep = CAPTURE_STEPS.find((step) => step.apiFunction === 'BitBlt');
    expect(bitBltStep).toBeDefined();
    expect(bitBltStep!.description).toContain('Copy');
  });

  test('GetDIBits step reads pixel data into buffer', () => {
    const getDIBitsStep = CAPTURE_STEPS.find((step) => step.apiFunction === 'GetDIBits');
    expect(getDIBitsStep).toBeDefined();
    expect(getDIBitsStep!.description).toContain('pixel data');
  });

  test('every step has a non-empty description', () => {
    for (const step of CAPTURE_STEPS) {
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  test('every step references a valid bun-win32 package', () => {
    const validPackages = new Set(['@bun-win32/gdi32', '@bun-win32/user32']);
    for (const step of CAPTURE_STEPS) {
      expect(validPackages.has(step.package)).toBe(true);
    }
  });

  test('steps array is frozen', () => {
    expect(Object.isFrozen(CAPTURE_STEPS)).toBe(true);
  });

  test('cleanup steps follow capture steps (DeleteObject, DeleteDC, ReleaseDC at end)', () => {
    const lastThree = CAPTURE_STEPS.slice(-3).map((step) => step.apiFunction);
    expect(lastThree).toEqual(['DeleteObject', 'DeleteDC', 'ReleaseDC']);
  });
});

describe('required API functions', () => {
  test('contains 11 unique functions', () => {
    expect(REQUIRED_API_FUNCTIONS).toHaveLength(11);
    expect(new Set(REQUIRED_API_FUNCTIONS).size).toBe(11);
  });

  test('is ASCIIbetically sorted', () => {
    for (let index = 1; index < REQUIRED_API_FUNCTIONS.length; index++) {
      expect(REQUIRED_API_FUNCTIONS[index] > REQUIRED_API_FUNCTIONS[index - 1]).toBe(true);
    }
  });

  test('covers all unique functions from capture steps', () => {
    const stepFunctions = new Set(CAPTURE_STEPS.map((step) => step.apiFunction));
    for (const functionName of stepFunctions) {
      expect(REQUIRED_API_FUNCTIONS).toContain(functionName);
    }
  });

  test('is frozen', () => {
    expect(Object.isFrozen(REQUIRED_API_FUNCTIONS)).toBe(true);
  });
});

describe('API package map', () => {
  test('covers every required API function', () => {
    for (const functionName of REQUIRED_API_FUNCTIONS) {
      expect(API_PACKAGE_MAP.has(functionName)).toBe(true);
    }
  });

  test('GDI32 functions map to @bun-win32/gdi32', () => {
    const gdi32Functions = ['BitBlt', 'CreateCompatibleBitmap', 'CreateCompatibleDC', 'DeleteDC', 'DeleteObject', 'GetDIBits', 'SelectObject'];
    for (const functionName of gdi32Functions) {
      expect(API_PACKAGE_MAP.get(functionName)).toBe('@bun-win32/gdi32');
    }
  });

  test('User32 functions map to @bun-win32/user32', () => {
    const user32Functions = ['FindWindowW', 'GetClientRect', 'GetDC', 'ReleaseDC'];
    for (const functionName of user32Functions) {
      expect(API_PACKAGE_MAP.get(functionName)).toBe('@bun-win32/user32');
    }
  });
});

describe('buildBitmapInfoHeader', () => {
  test('returns a 40-byte buffer', () => {
    const header = buildBitmapInfoHeader(640, 480);
    expect(header.byteLength).toBe(BITMAPINFOHEADER_SIZE);
  });

  test('biSize field is 40', () => {
    const header = buildBitmapInfoHeader(640, 480);
    expect(header.readUInt32LE(BITMAPINFOHEADER_OFFSETS.biSize)).toBe(40);
  });

  test('biWidth matches requested width', () => {
    const header = buildBitmapInfoHeader(640, 480);
    expect(header.readInt32LE(BITMAPINFOHEADER_OFFSETS.biWidth)).toBe(640);
  });

  test('biHeight is negative for top-down DIB', () => {
    const header = buildBitmapInfoHeader(640, 480);
    expect(header.readInt32LE(BITMAPINFOHEADER_OFFSETS.biHeight)).toBe(-480);
  });

  test('biPlanes is 1', () => {
    const header = buildBitmapInfoHeader(640, 480);
    expect(header.readUInt16LE(BITMAPINFOHEADER_OFFSETS.biPlanes)).toBe(1);
  });

  test('biBitCount is 32', () => {
    const header = buildBitmapInfoHeader(640, 480);
    expect(header.readUInt16LE(BITMAPINFOHEADER_OFFSETS.biBitCount)).toBe(32);
  });

  test('biCompression is BI_RGB', () => {
    const header = buildBitmapInfoHeader(640, 480);
    expect(header.readUInt32LE(BITMAPINFOHEADER_OFFSETS.biCompression)).toBe(BI_RGB);
  });

  test('biSizeImage matches the packed pixel buffer size', () => {
    const header = buildBitmapInfoHeader(640, 480);
    expect(header.readUInt32LE(BITMAPINFOHEADER_OFFSETS.biSizeImage)).toBe(640 * 480 * CAPTURE_BYTES_PER_PIXEL);
  });

  test('works with internal framebuffer dimensions (320x200)', () => {
    const header = buildBitmapInfoHeader(320, 200);
    expect(header.readInt32LE(BITMAPINFOHEADER_OFFSETS.biWidth)).toBe(320);
    expect(header.readInt32LE(BITMAPINFOHEADER_OFFSETS.biHeight)).toBe(-200);
  });

  test('rejects zero and negative dimensions', () => {
    expect(() => buildBitmapInfoHeader(0, 480)).toThrow(/width must be a positive integer/);
    expect(() => buildBitmapInfoHeader(640, -1)).toThrow(/height must be a positive integer/);
  });

  test('rejects non-integer dimensions', () => {
    expect(() => buildBitmapInfoHeader(640.5, 480)).toThrow(/width must be a positive integer/);
    expect(() => buildBitmapInfoHeader(640, 480.5)).toThrow(/height must be a positive integer/);
  });
});

describe('validateCaptureConfig', () => {
  test('returns no issues for REFERENCE_RUN_MANIFEST screen', () => {
    const issues = validateCaptureConfig(REFERENCE_RUN_MANIFEST.screen);
    expect(issues).toHaveLength(0);
  });

  test('detects display width mismatch', () => {
    const screen = { ...REFERENCE_RUN_MANIFEST.screen, displayWidth: 800 };
    const issues = validateCaptureConfig(screen);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.includes('displayWidth'))).toBe(true);
  });

  test('detects display height mismatch', () => {
    const screen = { ...REFERENCE_RUN_MANIFEST.screen, displayHeight: 600 };
    const issues = validateCaptureConfig(screen);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.includes('displayHeight'))).toBe(true);
  });

  test('detects bitsPerPixel mismatch', () => {
    const screen = { ...REFERENCE_RUN_MANIFEST.screen, bitsPerPixel: 24 };
    const issues = validateCaptureConfig(screen);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.includes('bitsPerPixel'))).toBe(true);
  });
});

describe('parity-sensitive edge cases', () => {
  test('display-to-internal downscale is exactly 2x horizontal and 2.4x vertical', () => {
    const horizontalScale = CAPTURE_PIPELINE.displayWidth / CAPTURE_PIPELINE.internalWidth;
    const verticalScale = CAPTURE_PIPELINE.displayHeight / CAPTURE_PIPELINE.internalHeight;
    expect(horizontalScale).toBe(2);
    expect(verticalScale).toBe(2.4);
  });

  test('aspect ratio correction produces non-integer vertical scale', () => {
    const verticalScale = CAPTURE_PIPELINE.displayHeight / CAPTURE_PIPELINE.internalHeight;
    expect(Number.isInteger(verticalScale)).toBe(false);
  });

  test('capture buffer can hold the full display at 32bpp', () => {
    const totalPixels = CAPTURE_PIPELINE.displayWidth * CAPTURE_PIPELINE.displayHeight;
    expect(CAPTURE_PIPELINE.captureBufferSize).toBe(totalPixels * 4);
    expect(CAPTURE_PIPELINE.captureBufferSize).toBe(1_228_800);
  });

  test('negative biHeight in BITMAPINFOHEADER ensures top-down scan order for deterministic hashing', () => {
    const header = buildBitmapInfoHeader(CAPTURE_PIPELINE.displayWidth, CAPTURE_PIPELINE.displayHeight);
    const biHeight = header.readInt32LE(BITMAPINFOHEADER_OFFSETS.biHeight);
    expect(biHeight).toBeLessThan(0);
    expect(Math.abs(biHeight)).toBe(CAPTURE_PIPELINE.displayHeight);
  });
});

describe('compile-time type satisfaction', () => {
  test('CaptureStep interface is satisfied by step entries', () => {
    const step: CaptureStep = CAPTURE_STEPS[0];
    expect(step.order).toBeTypeOf('number');
    expect(step.apiFunction).toBeTypeOf('string');
    expect(step.package).toBeTypeOf('string');
    expect(step.description).toBeTypeOf('string');
  });

  test('CapturePipelineConfig interface is satisfied by CAPTURE_PIPELINE', () => {
    const config: CapturePipelineConfig = CAPTURE_PIPELINE;
    expect(config.displayWidth).toBeTypeOf('number');
    expect(config.displayHeight).toBeTypeOf('number');
    expect(config.bitsPerPixel).toBeTypeOf('number');
    expect(config.captureBufferSize).toBeTypeOf('number');
    expect(config.internalWidth).toBeTypeOf('number');
    expect(config.internalHeight).toBeTypeOf('number');
    expect(config.windowTitle).toBeTypeOf('string');
    expect(Array.isArray(config.steps)).toBe(true);
  });

  test('WindowCaptureResult interface is satisfied by captureDesktopRegion return', () => {
    const result: WindowCaptureResult = captureDesktopRegion(2, 2);
    expect(result.width).toBeTypeOf('number');
    expect(result.height).toBeTypeOf('number');
    expect(result.pixels).toBeInstanceOf(Buffer);
    expect(result.scanLinesRead).toBeTypeOf('number');
  });
});

describe('FFI symbol definitions', () => {
  test('USER32_CAPTURE_SYMBOLS defines the documented user32 capture functions', () => {
    expect(USER32_CAPTURE_SYMBOLS).toHaveProperty('FindWindowW');
    expect(USER32_CAPTURE_SYMBOLS).toHaveProperty('GetDesktopWindow');
    expect(USER32_CAPTURE_SYMBOLS).toHaveProperty('GetClientRect');
    expect(USER32_CAPTURE_SYMBOLS).toHaveProperty('GetDC');
    expect(USER32_CAPTURE_SYMBOLS).toHaveProperty('ReleaseDC');
  });

  test('GDI32_CAPTURE_SYMBOLS defines all 7 required GDI functions', () => {
    const requiredGdiFunctions = ['BitBlt', 'CreateCompatibleBitmap', 'CreateCompatibleDC', 'DeleteDC', 'DeleteObject', 'GetDIBits', 'SelectObject'];
    for (const functionName of requiredGdiFunctions) {
      expect(GDI32_CAPTURE_SYMBOLS).toHaveProperty(functionName);
    }
  });

  test('symbol arg and return types are defined for every entry', () => {
    for (const symbol of Object.values(USER32_CAPTURE_SYMBOLS)) {
      expect(symbol).toHaveProperty('args');
      expect(symbol).toHaveProperty('returns');
    }
    for (const symbol of Object.values(GDI32_CAPTURE_SYMBOLS)) {
      expect(symbol).toHaveProperty('args');
      expect(symbol).toHaveProperty('returns');
    }
  });
});

describe('live GDI capture feasibility', () => {
  test('rejects invalid capture dimensions before calling Win32 APIs', () => {
    expect(() => captureDesktopRegion(0, 48)).toThrow(/width must be a positive integer/);
    expect(() => captureDesktopRegion(64, -1)).toThrow(/height must be a positive integer/);
  });

  test('rejects non-integer capture dimensions before calling Win32 APIs', () => {
    expect(() => captureDesktopRegion(64.5, 48)).toThrow(/width must be a positive integer/);
    expect(() => captureDesktopRegion(64, 48.5)).toThrow(/height must be a positive integer/);
  });

  test('captureDesktopRegion captures a 64x48 region successfully', () => {
    const result = captureDesktopRegion(64, 48);
    expect(result.width).toBe(64);
    expect(result.height).toBe(48);
    expect(result.scanLinesRead).toBe(48);
  });

  test('pixel buffer has correct byte size (width * height * 4)', () => {
    const result = captureDesktopRegion(64, 48);
    expect(result.pixels.byteLength).toBe(64 * 48 * CAPTURE_BYTES_PER_PIXEL);
  });

  test('pixel buffer contains non-trivial data (not all zeros)', () => {
    const result = captureDesktopRegion(64, 48);
    let hasNonZero = false;
    for (let index = 0; index < result.pixels.byteLength; index++) {
      if (result.pixels[index] !== 0) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });

  test('captures at reference display dimensions (640x480)', () => {
    const result = captureDesktopRegion(CAPTURE_PIPELINE.displayWidth, CAPTURE_PIPELINE.displayHeight);
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(result.pixels.byteLength).toBe(CAPTURE_PIPELINE.captureBufferSize);
    expect(result.scanLinesRead).toBe(480);
  });

  test('minimal 1x1 capture works (edge case)', () => {
    const result = captureDesktopRegion(1, 1);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.pixels.byteLength).toBe(4);
    expect(result.scanLinesRead).toBe(1);
  });
});
