import { describe, expect, test } from 'bun:test';

import { applyPaletteEffectsAndGamma, PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT } from '../../../src/playable/rendering-product-integration/applyPaletteEffectsAndGamma.ts';
import type { PaletteEffect } from '../../../src/playable/rendering-product-integration/applyPaletteEffectsAndGamma.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';
const EXPECTED_FIRST_PRESENTATION_BYTES = [195, 242, 245, 255, 112, 103, 242, 255, 29, 156, 240, 255, 137, 209, 238, 255, 54, 71, 236, 255, 163, 124, 233, 255];
const EXPECTED_FRAMEBUFFER_CHECKSUM = 2_004_972_101;
const EXPECTED_LAST_PRESENTATION_BYTES = [194, 176, 115, 255, 111, 230, 113, 255, 28, 91, 110, 255, 137, 144, 108, 255];
const EXPECTED_PRESENTATION_CHECKSUM = 3_773_471_813;
const EXPECTED_PRESENTATION_SHA256 = '08f8bd10b1a13d02c291f75a6ab6005124c1ce8f9b2b670c66c3d2a7fddc5dbc';
const EXPECTED_SOURCE_SHA256 = '89b7cbe5b2f1d4ee000b6042ba10fc1c3dcea8de42915450aec0752a33004925';
const FRAMEBUFFER_PIXEL_COUNT = 320 * 200;
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

  test('rejects invalid palette effect strength before mutating the destination', () => {
    const fixture = createFixture();
    const previousPresentationBytes = Array.from(fixture.presentationFramebuffer.slice(0, 32));

    expect(() =>
      applyPaletteEffectsAndGamma({
        framebuffer: fixture.framebuffer,
        gammaTable: fixture.gammaTable,
        palette: fixture.palette,
        paletteEffect: { blue: 8, green: 32, red: 224, strength: 0x101 },
        presentationFramebuffer: fixture.presentationFramebuffer,
        runtimeCommand: PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT.runtimeCommand,
      }),
    ).toThrow('paletteEffect.strength must be an integer from 0 to 256');
    expect(Array.from(fixture.presentationFramebuffer.slice(0, 32))).toEqual(previousPresentationBytes);
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

function hashBytes(bytes: Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}

async function hashFile(path: string): Promise<string> {
  return new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex');
}
