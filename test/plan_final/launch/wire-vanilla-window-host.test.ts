import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ASPECT_CORRECTED_HEIGHT, SCREENHEIGHT, SCREENWIDTH, computePresentationRect } from '../../../src/host/windowPolicy.ts';
import {
  BITMAP_INFO_HEADER_BYTE_LENGTH,
  VANILLA_FRAMEBUFFER_BYTE_LENGTH,
  VANILLA_PALETTE_ENTRY_COUNT,
  buildBgraPaletteLookup,
  buildVanillaBitmapInfoHeader,
  computeVanillaPresentationRect,
  convertIndexedFrameToBgra,
  createIndexedFramebuffer,
} from '../../../src/vanilla/win32WindowHost.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIN32_WINDOW_HOST_RELATIVE_PATH = 'src/vanilla/win32WindowHost.ts';
const WIN32_WINDOW_HOST_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, WIN32_WINDOW_HOST_RELATIVE_PATH);

function buildOpaquePalette(): Uint8Array {
  const palette = new Uint8Array(VANILLA_PALETTE_ENTRY_COUNT * 3);
  for (let colorIndex = 0; colorIndex < VANILLA_PALETTE_ENTRY_COUNT; colorIndex += 1) {
    const paletteOffset = colorIndex * 3;
    palette[paletteOffset] = colorIndex;
    palette[paletteOffset + 1] = (colorIndex * 2) & 0xff;
    palette[paletteOffset + 2] = (255 - colorIndex) & 0xff;
  }
  return palette;
}

describe('plan_final launch: wire-vanilla-window-host', () => {
  test('src/vanilla/win32WindowHost.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(WIN32_WINDOW_HOST_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(WIN32_WINDOW_HOST_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/win32WindowHost.ts cites plan_final step 03-005 in a top-of-file comment', () => {
    const fileText = readFileSync(WIN32_WINDOW_HOST_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('03-005');
    expect(fileText).toContain('createIndexedFramebuffer');
    expect(fileText).toContain('computeVanillaPresentationRect');
  });

  test('src/vanilla/win32WindowHost.ts imports the SCREENWIDTH/SCREENHEIGHT constants from the read-only windowPolicy module without modifying it', () => {
    const fileText = readFileSync(WIN32_WINDOW_HOST_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("import { SCREENHEIGHT, SCREENWIDTH, computePresentationRect } from '../host/windowPolicy.ts';");
  });

  test('src/vanilla/win32WindowHost.ts does NOT import any launcher-glue symbols (no import from src/launcher/)', () => {
    const fileText = readFileSync(WIN32_WINDOW_HOST_ABSOLUTE_PATH, 'utf8');
    expect(fileText).not.toContain("from '../launcher/");
    expect(fileText).not.toContain('import { LauncherSession');
    expect(fileText).not.toContain('import type { LauncherSession');
    expect(fileText).not.toContain('import { LauncherInputState');
    expect(fileText).not.toContain('import type { LauncherInputState');
  });

  test('VANILLA_FRAMEBUFFER_BYTE_LENGTH is exactly SCREENWIDTH * SCREENHEIGHT (64 000 bytes)', () => {
    expect(VANILLA_FRAMEBUFFER_BYTE_LENGTH).toBe(SCREENWIDTH * SCREENHEIGHT);
    expect(VANILLA_FRAMEBUFFER_BYTE_LENGTH).toBe(64_000);
  });

  test('VANILLA_PALETTE_ENTRY_COUNT pins the 256-entry palette length', () => {
    expect(VANILLA_PALETTE_ENTRY_COUNT).toBe(256);
  });

  test('BITMAP_INFO_HEADER_BYTE_LENGTH pins the 40-byte BITMAPINFOHEADER size GDI expects', () => {
    expect(BITMAP_INFO_HEADER_BYTE_LENGTH).toBe(40);
  });

  test('createIndexedFramebuffer allocates exactly 320 * 200 = 64 000 zero-filled bytes', () => {
    const framebuffer = createIndexedFramebuffer();
    expect(framebuffer).toBeInstanceOf(Uint8Array);
    expect(framebuffer.length).toBe(VANILLA_FRAMEBUFFER_BYTE_LENGTH);
    for (let pixelIndex = 0; pixelIndex < framebuffer.length; pixelIndex += 1) {
      expect(framebuffer[pixelIndex]).toBe(0);
    }
  });

  test('createIndexedFramebuffer returns a fresh allocation on every call (no shared state)', () => {
    const firstFramebuffer = createIndexedFramebuffer();
    const secondFramebuffer = createIndexedFramebuffer();
    expect(firstFramebuffer).not.toBe(secondFramebuffer);
    firstFramebuffer[0] = 123;
    expect(secondFramebuffer[0]).toBe(0);
  });

  test('buildBgraPaletteLookup produces a 256-entry lookup table with 0xFF alpha on every entry', () => {
    const palette = buildOpaquePalette();
    const lookup = buildBgraPaletteLookup(palette);
    expect(lookup).toBeInstanceOf(Uint32Array);
    expect(lookup.length).toBe(VANILLA_PALETTE_ENTRY_COUNT);
    for (let colorIndex = 0; colorIndex < lookup.length; colorIndex += 1) {
      expect((lookup[colorIndex]! >>> 24) & 0xff).toBe(0xff);
    }
  });

  test('buildBgraPaletteLookup packs colors as 0xFF_RR_GG_BB so the 32-bit byte order is B, G, R, A on little-endian hosts', () => {
    const palette = new Uint8Array(VANILLA_PALETTE_ENTRY_COUNT * 3);
    palette[0] = 0x12;
    palette[1] = 0x34;
    palette[2] = 0x56;
    const lookup = buildBgraPaletteLookup(palette);
    expect(lookup[0]).toBe((0xff00_0000 | (0x12 << 16) | (0x34 << 8) | 0x56) >>> 0);
    const wireBuffer = new Uint8Array(lookup.buffer.slice(0, 4));
    expect(wireBuffer[0]).toBe(0x56);
    expect(wireBuffer[1]).toBe(0x34);
    expect(wireBuffer[2]).toBe(0x12);
    expect(wireBuffer[3]).toBe(0xff);
  });

  test('buildBgraPaletteLookup throws when the supplied palette is shorter than 256 * 3 bytes', () => {
    const tooShortPalette = new Uint8Array(VANILLA_PALETTE_ENTRY_COUNT * 3 - 1);
    let caughtError: unknown;
    try {
      buildBgraPaletteLookup(tooShortPalette);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(Error);
  });

  test('convertIndexedFrameToBgra maps every source pixel through the palette lookup', () => {
    const framebuffer = createIndexedFramebuffer();
    framebuffer[0] = 0;
    framebuffer[1] = 1;
    framebuffer[2] = 2;
    framebuffer[3] = 255;
    const palette = buildOpaquePalette();
    const lookup = buildBgraPaletteLookup(palette);
    const destination = new Uint32Array(framebuffer.length);
    convertIndexedFrameToBgra(framebuffer, destination, lookup);
    expect(destination[0]).toBe(lookup[0]);
    expect(destination[1]).toBe(lookup[1]);
    expect(destination[2]).toBe(lookup[2]);
    expect(destination[3]).toBe(lookup[255]);
  });

  test('convertIndexedFrameToBgra throws when the palette lookup is not exactly 256 entries', () => {
    const framebuffer = createIndexedFramebuffer();
    const destination = new Uint32Array(framebuffer.length);
    const wrongSizeLookup = new Uint32Array(128);
    let caughtError: unknown;
    try {
      convertIndexedFrameToBgra(framebuffer, destination, wrongSizeLookup);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(Error);
  });

  test('convertIndexedFrameToBgra throws when the destination buffer is shorter than the source', () => {
    const framebuffer = createIndexedFramebuffer();
    const destination = new Uint32Array(framebuffer.length - 1);
    const palette = buildOpaquePalette();
    const lookup = buildBgraPaletteLookup(palette);
    let caughtError: unknown;
    try {
      convertIndexedFrameToBgra(framebuffer, destination, lookup);
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(Error);
  });

  test('buildVanillaBitmapInfoHeader returns a 40-byte Buffer with the GDI BITMAPINFOHEADER layout', () => {
    const header = buildVanillaBitmapInfoHeader();
    expect(header).toBeInstanceOf(Buffer);
    expect(header.byteLength).toBe(BITMAP_INFO_HEADER_BYTE_LENGTH);
    expect(header.readUInt32LE(0)).toBe(40);
    expect(header.readInt32LE(4)).toBe(SCREENWIDTH);
    expect(header.readInt32LE(8)).toBe(-SCREENHEIGHT);
    expect(header.readUInt16LE(12)).toBe(1);
    expect(header.readUInt16LE(14)).toBe(32);
    expect(header.readUInt32LE(16)).toBe(0);
    expect(header.readUInt32LE(20)).toBe(VANILLA_FRAMEBUFFER_BYTE_LENGTH * 4);
  });

  test('buildVanillaBitmapInfoHeader negative height declares a top-down DIB (matches src/launcher/win32.ts convention)', () => {
    const header = buildVanillaBitmapInfoHeader();
    expect(header.readInt32LE(8)).toBeLessThan(0);
  });

  test('computeVanillaPresentationRect at 640x480 returns the full client area (2× integer scale of 320x240)', () => {
    const presentationRect = computeVanillaPresentationRect(640, 480);
    const reference = computePresentationRect(640, 480, true);
    expect(presentationRect).toEqual(reference);
    expect(presentationRect.width).toBe(640);
    expect(presentationRect.height).toBe(480);
    expect(presentationRect.x).toBe(0);
    expect(presentationRect.y).toBe(0);
  });

  test('computeVanillaPresentationRect pillarboxes a 800x480 client area to 640x480 centered horizontally', () => {
    const presentationRect = computeVanillaPresentationRect(800, 480);
    expect(presentationRect.width).toBe(640);
    expect(presentationRect.height).toBe(480);
    expect(presentationRect.x).toBe(80);
    expect(presentationRect.y).toBe(0);
  });

  test('computeVanillaPresentationRect letterboxes a 640x600 client area to 640x480 centered vertically', () => {
    const presentationRect = computeVanillaPresentationRect(640, 600);
    expect(presentationRect.width).toBe(640);
    expect(presentationRect.height).toBe(480);
    expect(presentationRect.x).toBe(0);
    expect(presentationRect.y).toBe(60);
  });

  test('computeVanillaPresentationRect at 0x0 client area returns a zero-size rect (avoids division by zero)', () => {
    const presentationRect = computeVanillaPresentationRect(0, 0);
    expect(presentationRect.width).toBe(0);
    expect(presentationRect.height).toBe(0);
  });

  test('computeVanillaPresentationRect delegates to computePresentationRect with aspect_ratio_correct=true (Chocolate Doom reference default)', () => {
    expect(computeVanillaPresentationRect(640, 480)).toEqual(computePresentationRect(640, 480, true));
    expect(computeVanillaPresentationRect(960, 600)).toEqual(computePresentationRect(960, 600, true));
    expect(computeVanillaPresentationRect(1280, 720)).toEqual(computePresentationRect(1280, 720, true));
  });

  test('vanilla dimensions match the SCREENWIDTH=320, SCREENHEIGHT=200, ASPECT_CORRECTED_HEIGHT=240 windowPolicy constants', () => {
    expect(SCREENWIDTH).toBe(320);
    expect(SCREENHEIGHT).toBe(200);
    expect(ASPECT_CORRECTED_HEIGHT).toBe(240);
  });
});
