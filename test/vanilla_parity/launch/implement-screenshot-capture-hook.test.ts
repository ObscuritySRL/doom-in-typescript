import { describe, expect, test } from 'bun:test';

import {
  VANILLA_DEFAULT_PNG_SCREENSHOTS,
  VANILLA_DEFAULT_SCREENSHOT_KEY_SCANCODE,
  VANILLA_SCREENSHOT_FILENAME_PREFIX,
  VANILLA_SCREENSHOT_HEIGHT,
  VANILLA_SCREENSHOT_MAX_SLOT,
  VANILLA_SCREENSHOT_WIDTH,
  buildScreenshotFilename,
  decideScreenshotFormat,
} from '../../../src/bootstrap/implement-screenshot-capture-hook.ts';

describe('vanilla screenshot capture hook contract', () => {
  test('default screenshot key is unbound (scancode 0) and png_screenshots default is 0 (PCX)', () => {
    expect(VANILLA_DEFAULT_SCREENSHOT_KEY_SCANCODE).toBe(0);
    expect(VANILLA_DEFAULT_PNG_SCREENSHOTS).toBe(0);
  });

  test('filename prefix is DOOM, slot range 0-99', () => {
    expect(VANILLA_SCREENSHOT_FILENAME_PREFIX).toBe('DOOM');
    expect(VANILLA_SCREENSHOT_MAX_SLOT).toBe(99);
  });

  test('screenshot dimensions are the raw 320x200 framebuffer', () => {
    expect(VANILLA_SCREENSHOT_WIDTH).toBe(320);
    expect(VANILLA_SCREENSHOT_HEIGHT).toBe(200);
  });
});

describe('decideScreenshotFormat', () => {
  test('png_screenshots=0 yields pcx', () => {
    expect(decideScreenshotFormat(0)).toBe('pcx');
  });

  test('png_screenshots=1 yields png', () => {
    expect(decideScreenshotFormat(1)).toBe('png');
  });
});

describe('buildScreenshotFilename', () => {
  test('zero-padded slot with pcx extension for default config', () => {
    expect(buildScreenshotFilename({ nextAvailableSlot: 0, pngScreenshotsCfg: 0 })).toBe('DOOM00.pcx');
    expect(buildScreenshotFilename({ nextAvailableSlot: 7, pngScreenshotsCfg: 0 })).toBe('DOOM07.pcx');
    expect(buildScreenshotFilename({ nextAvailableSlot: 99, pngScreenshotsCfg: 0 })).toBe('DOOM99.pcx');
  });

  test('png extension when png_screenshots is 1', () => {
    expect(buildScreenshotFilename({ nextAvailableSlot: 0, pngScreenshotsCfg: 1 })).toBe('DOOM00.png');
  });

  test('throws on out-of-range slot', () => {
    expect(() => buildScreenshotFilename({ nextAvailableSlot: -1, pngScreenshotsCfg: 0 })).toThrow();
    expect(() => buildScreenshotFilename({ nextAvailableSlot: 100, pngScreenshotsCfg: 0 })).toThrow();
  });
});
