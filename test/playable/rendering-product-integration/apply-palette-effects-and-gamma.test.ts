import { describe, expect, test } from 'bun:test';

import { applyPaletteEffectsAndGamma, PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT } from '../../../src/playable/rendering-product-integration/applyPaletteEffectsAndGamma.ts';
import type { PaletteEffect } from '../../../src/playable/rendering-product-integration/applyPaletteEffectsAndGamma.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';
const EXPECTED_FIRST_PRESENTATION_BYTES = [195, 242, 245, 255, 112, 103, 242, 255, 29, 156, 240, 255, 137, 209, 238, 255, 54, 71, 236, 255, 163, 124, 233, 255];
const EXPECTED_FRAMEBUFFER_CHECKSUM = 2_004_972_101;
const EXPECTED_LAST_PRESENTATION_BYTES = [194, 176, 115, 255, 111, 230, 113, 255, 28, 91, 110, 255, 137, 144, 108, 255];
const EXPECTED_PRESENTATION_CHECKSUM = 3_773_471_813;
const EXPECTED_PRESENTATION_SHA256 = '08f8bd10b1a13d02c291f75a6ab6005124c1ce8f9b2b670c66c3d2a7fddc5dbc';
const EXPECTED_SOURCE_SHA256 = '99241bad3b9e0ba8472d0765a079b576b18aae6021fb316ad8622fa72fcf00f9';
const FRAMEBUFFER_PIXEL_COUNT = 320 * 200;
const PRESENTATION_BYTE_LENGTH = FRAMEBUFFER_PIXEL_COUNT * 4;
const SOURCE_PATH = 'src/playable/rendering-product-integration/applyPaletteEffectsAndGamma.ts';

interface PaletteEffectsAndGammaFixture {
  readonly framebuffer: Uint8Array;
  readonly gammaTable: Uint8Array;
  readonly palette: Uint8Array;
  readonly paletteEffect: PaletteEffect;
  readonly presentationFramebuffer: Uint8Array;
}

describe('applyPaletteEffectsAndGamma', () => {
  test('locks the Bun command contract and missing-rendering audit surface', async () => {
    expect(PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });

    const auditManifestText = await Bun.file(AUDIT_MANIFEST_PATH).text();

    expect(auditManifestText).toContain('"schemaVersion": 1');
    expect(auditManifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(auditManifestText).toContain('"surface": "palette-and-gamma-application"');
    expect(auditManifestText).toContain('"path": null');
    expect(await hashFile(SOURCE_PATH)).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('applies palette effects and gamma to the full presentation framebuffer', () => {
    const fixture = createFixture();
    const result = applyPaletteEffectsAndGamma({
      framebuffer: fixture.framebuffer,
      gammaTable: fixture.gammaTable,
      palette: fixture.palette,
      paletteEffect: fixture.paletteEffect,
      presentationFramebuffer: fixture.presentationFramebuffer,
      runtimeCommand: PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT.runtimeCommand,
    });

    expect(result.commandContract).toBe(PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT);
    expect(result.framebufferChecksum).toBe(EXPECTED_FRAMEBUFFER_CHECKSUM);
    expect(result.gammaTableByteLength).toBe(0x100);
    expect(result.paletteByteLength).toBe(0x100 * 3);
    expect(result.paletteEffect).toEqual({ blue: 8, green: 32, red: 224, strength: 64 });
    expect(result.paletteEffect).toBe(fixture.paletteEffect);
    expect(result.pixelCount).toBe(FRAMEBUFFER_PIXEL_COUNT);
    expect(result.presentationChecksum).toBe(EXPECTED_PRESENTATION_CHECKSUM);
    expect(result.presentationFramebuffer).toBe(fixture.presentationFramebuffer);
    expect(result.transition).toBe('palette-effects-and-gamma-applied');
    expect(Array.from(fixture.presentationFramebuffer.slice(0, EXPECTED_FIRST_PRESENTATION_BYTES.length))).toEqual(EXPECTED_FIRST_PRESENTATION_BYTES);
    expect(Array.from(fixture.presentationFramebuffer.slice(fixture.presentationFramebuffer.length - EXPECTED_LAST_PRESENTATION_BYTES.length))).toEqual(EXPECTED_LAST_PRESENTATION_BYTES);
    expect(hashBytes(fixture.presentationFramebuffer)).toBe(EXPECTED_PRESENTATION_SHA256);
  });

  test('rejects non-Bun-runtime command paths before mutating the destination', () => {
    const fixture = createFixture();
    const previousPresentationBytes = Array.from(fixture.presentationFramebuffer);

    expect(() =>
      applyPaletteEffectsAndGamma({
        framebuffer: fixture.framebuffer,
        gammaTable: fixture.gammaTable,
        palette: fixture.palette,
        paletteEffect: fixture.paletteEffect,
        presentationFramebuffer: fixture.presentationFramebuffer,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('apply palette effects and gamma requires bun run doom.ts');
    expect(Array.from(fixture.presentationFramebuffer)).toEqual(previousPresentationBytes);
  });

  test.each([
    { byteLength: FRAMEBUFFER_PIXEL_COUNT - 1, message: 'framebuffer must contain 64000 bytes', name: 'framebuffer' },
    { byteLength: FRAMEBUFFER_PIXEL_COUNT + 1, message: 'framebuffer must contain 64000 bytes', name: 'framebuffer' },
    { byteLength: 0xff, message: 'gammaTable must contain 256 bytes', name: 'gammaTable' },
    { byteLength: 0x101, message: 'gammaTable must contain 256 bytes', name: 'gammaTable' },
    { byteLength: 0x100 * 3 - 1, message: 'palette must contain 768 bytes', name: 'palette' },
    { byteLength: 0x100 * 3 + 1, message: 'palette must contain 768 bytes', name: 'palette' },
    { byteLength: PRESENTATION_BYTE_LENGTH - 1, message: 'presentationFramebuffer must contain 256000 bytes', name: 'presentationFramebuffer' },
    { byteLength: PRESENTATION_BYTE_LENGTH + 1, message: 'presentationFramebuffer must contain 256000 bytes', name: 'presentationFramebuffer' },
    { byteLength: 0, message: 'framebuffer must contain 64000 bytes', name: 'framebuffer' },
  ])('rejects $name with byteLength $byteLength before mutating the destination', ({ byteLength, message, name }) => {
    const fixture = createFixture();
    const previousPresentationBytes = Array.from(fixture.presentationFramebuffer.slice(0, 32));
    const overrides = {
      framebuffer: fixture.framebuffer,
      gammaTable: fixture.gammaTable,
      palette: fixture.palette,
      presentationFramebuffer: fixture.presentationFramebuffer,
    };

    overrides[name as keyof typeof overrides] = new Uint8Array(byteLength);

    expect(() =>
      applyPaletteEffectsAndGamma({
        framebuffer: overrides.framebuffer,
        gammaTable: overrides.gammaTable,
        palette: overrides.palette,
        paletteEffect: fixture.paletteEffect,
        presentationFramebuffer: overrides.presentationFramebuffer,
        runtimeCommand: PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT.runtimeCommand,
      }),
    ).toThrow(new RangeError(message));

    if (name !== 'presentationFramebuffer') {
      expect(Array.from(fixture.presentationFramebuffer.slice(0, 32))).toEqual(previousPresentationBytes);
    }
  });

  test.each([
    { component: 'blue' as const, message: 'paletteEffect.blue must be an integer from 0 to 255', value: -1 },
    { component: 'blue' as const, message: 'paletteEffect.blue must be an integer from 0 to 255', value: 256 },
    { component: 'blue' as const, message: 'paletteEffect.blue must be an integer from 0 to 255', value: 1.5 },
    { component: 'blue' as const, message: 'paletteEffect.blue must be an integer from 0 to 255', value: Number.NaN },
    { component: 'green' as const, message: 'paletteEffect.green must be an integer from 0 to 255', value: -1 },
    { component: 'green' as const, message: 'paletteEffect.green must be an integer from 0 to 255', value: 256 },
    { component: 'green' as const, message: 'paletteEffect.green must be an integer from 0 to 255', value: Number.POSITIVE_INFINITY },
    { component: 'red' as const, message: 'paletteEffect.red must be an integer from 0 to 255', value: -1 },
    { component: 'red' as const, message: 'paletteEffect.red must be an integer from 0 to 255', value: 256 },
    { component: 'red' as const, message: 'paletteEffect.red must be an integer from 0 to 255', value: 0.5 },
    { component: 'strength' as const, message: 'paletteEffect.strength must be an integer from 0 to 256', value: -1 },
    { component: 'strength' as const, message: 'paletteEffect.strength must be an integer from 0 to 256', value: 0x101 },
    { component: 'strength' as const, message: 'paletteEffect.strength must be an integer from 0 to 256', value: 32.5 },
    { component: 'strength' as const, message: 'paletteEffect.strength must be an integer from 0 to 256', value: Number.NaN },
  ])('rejects paletteEffect.$component value $value before mutating the destination', ({ component, message, value }) => {
    const fixture = createFixture();
    const previousPresentationBytes = Array.from(fixture.presentationFramebuffer.slice(0, 32));
    const paletteEffect: PaletteEffect = { ...fixture.paletteEffect, [component]: value };

    expect(() =>
      applyPaletteEffectsAndGamma({
        framebuffer: fixture.framebuffer,
        gammaTable: fixture.gammaTable,
        palette: fixture.palette,
        paletteEffect,
        presentationFramebuffer: fixture.presentationFramebuffer,
        runtimeCommand: PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT.runtimeCommand,
      }),
    ).toThrow(new RangeError(message));
    expect(Array.from(fixture.presentationFramebuffer.slice(0, 32))).toEqual(previousPresentationBytes);
  });

  test('passes palette through gamma unchanged at strength 0', () => {
    const fixture = createFixture();
    const paletteEffect: PaletteEffect = { blue: 200, green: 100, red: 50, strength: 0 };
    const expectedPresentation = computeExpectedPresentation(fixture.framebuffer, fixture.palette, fixture.gammaTable, paletteEffect);

    applyPaletteEffectsAndGamma({
      framebuffer: fixture.framebuffer,
      gammaTable: fixture.gammaTable,
      palette: fixture.palette,
      paletteEffect,
      presentationFramebuffer: fixture.presentationFramebuffer,
      runtimeCommand: PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT.runtimeCommand,
    });

    expect(hashBytes(fixture.presentationFramebuffer)).toBe(hashBytes(expectedPresentation));
    expect(Array.from(fixture.presentationFramebuffer.slice(0, 8))).toEqual(Array.from(expectedPresentation.slice(0, 8)));
    expect(Array.from(fixture.presentationFramebuffer.slice(-8))).toEqual(Array.from(expectedPresentation.slice(-8)));

    const sampledPixelIndex = 12345;
    const sampledPaletteIndex = fixture.framebuffer[sampledPixelIndex]!;
    const sampledPaletteOffset = sampledPaletteIndex * 3;
    const sampledPresentationOffset = sampledPixelIndex * 4;
    expect(fixture.presentationFramebuffer[sampledPresentationOffset]).toBe(fixture.gammaTable[fixture.palette[sampledPaletteOffset]!]!);
    expect(fixture.presentationFramebuffer[sampledPresentationOffset + 1]).toBe(fixture.gammaTable[fixture.palette[sampledPaletteOffset + 1]!]!);
    expect(fixture.presentationFramebuffer[sampledPresentationOffset + 2]).toBe(fixture.gammaTable[fixture.palette[sampledPaletteOffset + 2]!]!);
    expect(fixture.presentationFramebuffer[sampledPresentationOffset + 3]).toBe(0xff);
  });

  test('replaces every pixel with the gamma-corrected target color at strength 256', () => {
    const fixture = createFixture();
    const paletteEffect: PaletteEffect = { blue: 128, green: 64, red: 32, strength: 0x100 };

    applyPaletteEffectsAndGamma({
      framebuffer: fixture.framebuffer,
      gammaTable: fixture.gammaTable,
      palette: fixture.palette,
      paletteEffect,
      presentationFramebuffer: fixture.presentationFramebuffer,
      runtimeCommand: PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT.runtimeCommand,
    });

    const expectedRed = fixture.gammaTable[paletteEffect.red]!;
    const expectedGreen = fixture.gammaTable[paletteEffect.green]!;
    const expectedBlue = fixture.gammaTable[paletteEffect.blue]!;

    expect(expectedRed).toBe(0xff - 32);
    expect(expectedGreen).toBe(0xff - 64);
    expect(expectedBlue).toBe(0xff - 128);

    const expectedPresentation = new Uint8Array(PRESENTATION_BYTE_LENGTH);
    for (let pixelIndex = 0; pixelIndex < FRAMEBUFFER_PIXEL_COUNT; pixelIndex += 1) {
      const presentationOffset = pixelIndex * 4;
      expectedPresentation[presentationOffset] = expectedRed;
      expectedPresentation[presentationOffset + 1] = expectedGreen;
      expectedPresentation[presentationOffset + 2] = expectedBlue;
      expectedPresentation[presentationOffset + 3] = 0xff;
    }

    expect(hashBytes(fixture.presentationFramebuffer)).toBe(hashBytes(expectedPresentation));
    expect(Array.from(fixture.presentationFramebuffer.slice(0, 16))).toEqual(Array.from(expectedPresentation.slice(0, 16)));
    expect(Array.from(fixture.presentationFramebuffer.slice(-16))).toEqual(Array.from(expectedPresentation.slice(-16)));
  });
});

function createFixture(): PaletteEffectsAndGammaFixture {
  const framebuffer = new Uint8Array(FRAMEBUFFER_PIXEL_COUNT);
  const gammaTable = new Uint8Array(0x100);
  const palette = new Uint8Array(0x100 * 3);
  const paletteEffect: PaletteEffect = { blue: 8, green: 32, red: 224, strength: 64 };
  const presentationFramebuffer = new Uint8Array(FRAMEBUFFER_PIXEL_COUNT * 4);

  for (let pixelIndex = 0; pixelIndex < framebuffer.length; pixelIndex += 1) {
    framebuffer[pixelIndex] = (pixelIndex * 37 + (pixelIndex >> 3)) & 0xff;
  }

  for (let value = 0; value < gammaTable.length; value += 1) {
    gammaTable[value] = 0xff - value;
  }

  for (let paletteIndex = 0; paletteIndex < 0x100; paletteIndex += 1) {
    const paletteOffset = paletteIndex * 3;
    palette[paletteOffset] = (paletteIndex * 3 + 5) & 0xff;
    palette[paletteOffset + 1] = (paletteIndex * 5 + 7) & 0xff;
    palette[paletteOffset + 2] = (paletteIndex * 7 + 11) & 0xff;
  }

  return {
    framebuffer,
    gammaTable,
    palette,
    paletteEffect,
    presentationFramebuffer,
  };
}

function computeExpectedPresentation(framebuffer: Uint8Array, palette: Uint8Array, gammaTable: Uint8Array, paletteEffect: PaletteEffect): Uint8Array {
  const expected = new Uint8Array(framebuffer.length * 4);
  const inverseStrength = 0x100 - paletteEffect.strength;
  const targetRedScaled = paletteEffect.red * paletteEffect.strength;
  const targetGreenScaled = paletteEffect.green * paletteEffect.strength;
  const targetBlueScaled = paletteEffect.blue * paletteEffect.strength;

  for (let pixelIndex = 0; pixelIndex < framebuffer.length; pixelIndex += 1) {
    const paletteOffset = framebuffer[pixelIndex]! * 3;
    const presentationOffset = pixelIndex * 4;
    expected[presentationOffset] = gammaTable[((palette[paletteOffset]! * inverseStrength + targetRedScaled + 0x80) >> 8) & 0xff]!;
    expected[presentationOffset + 1] = gammaTable[((palette[paletteOffset + 1]! * inverseStrength + targetGreenScaled + 0x80) >> 8) & 0xff]!;
    expected[presentationOffset + 2] = gammaTable[((palette[paletteOffset + 2]! * inverseStrength + targetBlueScaled + 0x80) >> 8) & 0xff]!;
    expected[presentationOffset + 3] = 0xff;
  }

  return expected;
}

function hashBytes(bytes: Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}

async function hashFile(path: string): Promise<string> {
  return new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex');
}
