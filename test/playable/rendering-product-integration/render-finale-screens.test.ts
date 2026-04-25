import { describe, expect, test } from 'bun:test';

import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';
import { RENDER_FINALE_SCREENS_AUDIT_MANIFEST, RENDER_FINALE_SCREENS_COMMAND, renderFinaleScreens } from '../../../src/playable/rendering-product-integration/renderFinaleScreens.ts';
import type { FinaleLayer, FinaleScreen } from '../../../src/playable/rendering-product-integration/renderFinaleScreens.ts';

const EXPECTED_RENDERED_FRAMEBUFFER_SHA256 = '24e7dde1b639e94aa8745b569ce7520e704cdfd50995a8433a6422bbdd07a99e';
const EXPECTED_SOURCE_SHA256 = 'eda4fe86e2c73d46fe8ab5d8099c321fff14e8080f3d86a9f0d99bfcb4e0d037';
const FINALE_FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;
const SOURCE_PATH = 'src/playable/rendering-product-integration/renderFinaleScreens.ts';

describe('renderFinaleScreens', () => {
  test('locks the Bun runtime command contract and rendering audit manifest schema', async () => {
    const manifestJson = await Bun.file(RENDER_FINALE_SCREENS_AUDIT_MANIFEST).json();
    const manifestRecord = requireRecord(manifestJson, 'rendering audit manifest');
    const commandContractsRecord = requireRecord(manifestRecord.commandContracts, 'rendering audit manifest command contracts');
    const targetCommandRecord = requireRecord(commandContractsRecord.target, 'rendering audit manifest target command');

    expect(FINALE_FRAMEBUFFER_BYTE_LENGTH).toBe(64_000);
    expect(manifestRecord.schemaVersion).toBe(1);
    expect(targetCommandRecord.entryFile).toBe('doom.ts');
    expect(targetCommandRecord.runtimeCommand).toBe(RENDER_FINALE_SCREENS_COMMAND);
  });

  test('locks the implementation source hash', async () => {
    expect(await sha256FileHex(SOURCE_PATH)).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('renders deterministic finale background and transparent patch layers', async () => {
    const backgroundPixels = createFinaleBackgroundPixels();
    const framebuffer = new Uint8Array(FINALE_FRAMEBUFFER_BYTE_LENGTH);
    const result = renderFinaleScreens({
      command: RENDER_FINALE_SCREENS_COMMAND,
      framebuffer,
      previousScreenName: 'intermission',
      screen: createVictoryFinaleScreen(backgroundPixels),
    });

    expect(result).toEqual({
      backgroundByteCount: 64_000,
      clippedLayerPixelCount: 4,
      command: RENDER_FINALE_SCREENS_COMMAND,
      drawnLayerPixelCount: 9,
      framebufferChecksum: 3_414_621_058,
      phase: 'victory',
      previousScreenName: 'intermission',
      screenName: 'bunny-scroll',
      skippedTransparentPixelCount: 5,
      transition: 'intermission->bunny-scroll',
    });
    expect(framebuffer[96 * SCREENWIDTH + 158]).toBe(getBackgroundPaletteIndex(96, 158));
    expect(framebuffer[96 * SCREENWIDTH + 159]).toBe(201);
    expect(framebuffer[96 * SCREENWIDTH + 160]).toBe(202);
    expect(framebuffer[97 * SCREENWIDTH + 161]).toBe(206);
    expect(framebuffer[199 * SCREENWIDTH + 0]).toBe(getBackgroundPaletteIndex(199, 0));
    expect(framebuffer[199 * SCREENWIDTH + 1]).toBe(211);
    expect(await sha256BytesHex(framebuffer)).toBe(EXPECTED_RENDERED_FRAMEBUFFER_SHA256);
  });

  test('rejects invalid finale layers before mutating the framebuffer', () => {
    const framebuffer = new Uint8Array(FINALE_FRAMEBUFFER_BYTE_LENGTH);
    framebuffer.fill(17);
    const beforeFramebuffer = framebuffer.slice();
    const invalidLayer: FinaleLayer = {
      height: 2,
      left: 10,
      pixels: new Uint8Array([1, 2, 3]),
      top: 10,
      transparentPaletteIndex: 0,
      width: 2,
    };

    expect(() =>
      renderFinaleScreens({
        command: RENDER_FINALE_SCREENS_COMMAND,
        framebuffer,
        previousScreenName: null,
        screen: {
          background: {
            kind: 'fill',
            paletteIndex: 48,
          },
          layers: [invalidLayer],
          name: 'cast-call',
          phase: 'cast',
        },
      }),
    ).toThrow('finale layer 0 must have exactly 4 pixels');
    expect(framebuffer).toEqual(beforeFramebuffer);
  });

  test('rejects the wrong runtime command before mutating the framebuffer', () => {
    const framebuffer = new Uint8Array(FINALE_FRAMEBUFFER_BYTE_LENGTH);
    framebuffer.fill(23);
    const beforeFramebuffer = framebuffer.slice();

    expect(() =>
      renderFinaleScreens({
        command: 'bun run src/main.ts',
        framebuffer,
        previousScreenName: null,
        screen: createVictoryFinaleScreen(createFinaleBackgroundPixels()),
      }),
    ).toThrow(`render finale screens requires ${RENDER_FINALE_SCREENS_COMMAND}`);
    expect(framebuffer).toEqual(beforeFramebuffer);
  });
});

function createFinaleBackgroundPixels(): Uint8Array<ArrayBuffer> {
  const backgroundPixels = new Uint8Array(FINALE_FRAMEBUFFER_BYTE_LENGTH);

  for (let screenRow = 0; screenRow < SCREENHEIGHT; screenRow += 1) {
    for (let screenColumn = 0; screenColumn < SCREENWIDTH; screenColumn += 1) {
      backgroundPixels[screenRow * SCREENWIDTH + screenColumn] = getBackgroundPaletteIndex(screenRow, screenColumn);
    }
  }

  return backgroundPixels;
}

function createVictoryFinaleScreen(backgroundPixels: Uint8Array<ArrayBuffer>): FinaleScreen {
  return {
    background: {
      kind: 'pixels',
      pixels: backgroundPixels,
    },
    layers: [
      {
        height: 3,
        left: 158,
        pixels: new Uint8Array([0, 201, 202, 0, 203, 204, 205, 206, 0, 207, 208, 0]),
        top: 96,
        transparentPaletteIndex: 0,
        width: 4,
      },
      {
        height: 2,
        left: -1,
        pixels: new Uint8Array([210, 0, 211, 212, 213, 214]),
        top: 199,
        transparentPaletteIndex: 0,
        width: 3,
      },
    ],
    name: 'bunny-scroll',
    phase: 'victory',
  };
}

function getBackgroundPaletteIndex(screenRow: number, screenColumn: number): number {
  const byteIndex = screenRow * SCREENWIDTH + screenColumn;
  return (byteIndex * 17 + screenRow * 3) % 256;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

async function sha256ArrayBufferHex(arrayBuffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256BytesHex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return sha256ArrayBufferHex(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

async function sha256FileHex(path: string): Promise<string> {
  return sha256ArrayBufferHex(await Bun.file(path).arrayBuffer());
}
