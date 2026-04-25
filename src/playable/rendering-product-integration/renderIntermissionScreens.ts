import { SCREENHEIGHT, SCREENWIDTH } from '../../render/projection.ts';

const FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;
const MAX_PALETTE_INDEX = 0xff;

export const RENDER_INTERMISSION_SCREENS_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
} as const);

export interface IntermissionPatchLayer {
  readonly height: number;
  readonly pixels: Uint8Array;
  readonly transparentPaletteIndex: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface IntermissionScreenResources {
  readonly backgroundPixels: Uint8Array;
  readonly layers?: readonly IntermissionPatchLayer[];
  readonly screenKind: IntermissionScreenKind;
  readonly sourceName: string;
}

export type IntermissionScreenKind = 'entering' | 'finished' | 'stats';

export interface IntermissionTransition {
  readonly completedMap: string;
  readonly enteringMap: string | null;
  readonly totalTics: number;
}

export interface RenderIntermissionScreensEvidence {
  readonly backgroundByteLength: number;
  readonly completedMap: string;
  readonly drawnLayerPixelCount: number;
  readonly enteringMap: string | null;
  readonly framebufferChecksum: number;
  readonly layerCount: number;
  readonly runtimeCommand: string;
  readonly screenHeight: number;
  readonly screenKind: IntermissionScreenKind;
  readonly screenWidth: number;
  readonly sourceName: string;
  readonly totalTics: number;
  readonly transitionKind: IntermissionTransitionKind;
}

export interface RenderIntermissionScreensOptions {
  readonly framebuffer: Uint8Array;
  readonly resources: IntermissionScreenResources;
  readonly runtimeCommand: string;
  readonly transition: IntermissionTransition;
}

export type IntermissionTransitionKind = 'episode-complete' | 'finished-to-entering';

/**
 * Render a complete intermission screen into the replay-visible framebuffer.
 *
 * @param options Bun command, framebuffer, intermission resources, and transition data.
 * @returns Deterministic evidence describing the rendered intermission frame.
 * @example
 * ```ts
 * const framebuffer = new Uint8Array(320 * 200);
 * const backgroundPixels = new Uint8Array(320 * 200);
 * renderIntermissionScreens({
 *   framebuffer,
 *   resources: { backgroundPixels, screenKind: 'finished', sourceName: 'WIMAP0' },
 *   runtimeCommand: 'bun run doom.ts',
 *   transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 3500 },
 * });
 * ```
 */
export function renderIntermissionScreens(options: RenderIntermissionScreensOptions): RenderIntermissionScreensEvidence {
  validateOptions(options);

  const layers = options.resources.layers ?? [];
  let drawnLayerPixelCount = 0;

  options.framebuffer.set(options.resources.backgroundPixels);

  for (const layer of layers) {
    drawnLayerPixelCount += drawLayer(options.framebuffer, layer);
  }

  return {
    backgroundByteLength: options.resources.backgroundPixels.length,
    completedMap: options.transition.completedMap,
    drawnLayerPixelCount,
    enteringMap: options.transition.enteringMap,
    framebufferChecksum: computeFramebufferChecksum(options.framebuffer),
    layerCount: layers.length,
    runtimeCommand: options.runtimeCommand,
    screenHeight: SCREENHEIGHT,
    screenKind: options.resources.screenKind,
    screenWidth: SCREENWIDTH,
    sourceName: options.resources.sourceName,
    totalTics: options.transition.totalTics,
    transitionKind: options.transition.enteringMap === null ? 'episode-complete' : 'finished-to-entering',
  };
}

function computeFramebufferChecksum(framebuffer: Uint8Array): number {
  let checksum = 0x811c9dc5;
  const byteCount = framebuffer.length;

  for (let byteIndex = 0; byteIndex < byteCount; byteIndex += 1) {
    checksum ^= framebuffer[byteIndex]!;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }

  return checksum;
}

function drawLayer(framebuffer: Uint8Array, layer: IntermissionPatchLayer): number {
  const layerHeight = layer.height;
  const layerWidth = layer.width;
  const layerOriginX = layer.x;
  const layerOriginY = layer.y;
  const layerPixels = layer.pixels;
  const transparentPaletteIndex = layer.transparentPaletteIndex;
  let drawnPixelCount = 0;

  for (let layerRowIndex = 0; layerRowIndex < layerHeight; layerRowIndex += 1) {
    const framebufferRowIndex = layerOriginY + layerRowIndex;

    if (framebufferRowIndex < 0 || framebufferRowIndex >= SCREENHEIGHT) {
      continue;
    }

    const layerRowOffset = layerRowIndex * layerWidth;
    const framebufferRowOffset = framebufferRowIndex * SCREENWIDTH;

    for (let layerColumnIndex = 0; layerColumnIndex < layerWidth; layerColumnIndex += 1) {
      const framebufferColumnIndex = layerOriginX + layerColumnIndex;

      if (framebufferColumnIndex < 0 || framebufferColumnIndex >= SCREENWIDTH) {
        continue;
      }

      const paletteIndex = layerPixels[layerRowOffset + layerColumnIndex]!;

      if (paletteIndex === transparentPaletteIndex) {
        continue;
      }

      framebuffer[framebufferRowOffset + framebufferColumnIndex] = paletteIndex;
      drawnPixelCount += 1;
    }
  }

  return drawnPixelCount;
}

function validateLayer(layer: IntermissionPatchLayer, layerIndex: number): void {
  if (!Number.isInteger(layer.height) || layer.height <= 0) {
    throw new Error(`Intermission layer ${layerIndex} height must be a positive integer.`);
  }

  if (!Number.isInteger(layer.transparentPaletteIndex) || layer.transparentPaletteIndex < 0 || layer.transparentPaletteIndex > MAX_PALETTE_INDEX) {
    throw new Error(`Intermission layer ${layerIndex} transparent palette index must be 0..255.`);
  }

  if (!Number.isInteger(layer.width) || layer.width <= 0) {
    throw new Error(`Intermission layer ${layerIndex} width must be a positive integer.`);
  }

  if (!Number.isInteger(layer.x)) {
    throw new Error(`Intermission layer ${layerIndex} x must be an integer.`);
  }

  if (!Number.isInteger(layer.y)) {
    throw new Error(`Intermission layer ${layerIndex} y must be an integer.`);
  }

  if (layer.pixels.length !== layer.width * layer.height) {
    throw new Error(`Intermission layer ${layerIndex} pixel buffer must match width * height.`);
  }
}

function validateOptions(options: RenderIntermissionScreensOptions): void {
  if (options.runtimeCommand !== RENDER_INTERMISSION_SCREENS_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error('Intermission screens require bun run doom.ts.');
  }

  if (options.framebuffer.length !== FRAMEBUFFER_BYTE_LENGTH) {
    throw new Error('Intermission framebuffer must be 320x200.');
  }

  if (options.resources.backgroundPixels.length !== FRAMEBUFFER_BYTE_LENGTH) {
    throw new Error('Intermission background must be 320x200.');
  }

  if (!isIntermissionScreenKind(options.resources.screenKind)) {
    throw new Error('Intermission screen kind must be entering, finished, or stats.');
  }

  if (options.resources.sourceName.length === 0) {
    throw new Error('Intermission source name is required.');
  }

  if (options.transition.completedMap.length === 0) {
    throw new Error('Intermission completed map is required.');
  }

  if (options.transition.enteringMap !== null && options.transition.enteringMap.length === 0) {
    throw new Error('Intermission entering map must be non-empty when present.');
  }

  if (!Number.isInteger(options.transition.totalTics) || options.transition.totalTics < 0) {
    throw new Error('Intermission total tics must be a non-negative integer.');
  }

  const layers = options.resources.layers ?? [];

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    validateLayer(layers[layerIndex]!, layerIndex);
  }
}

function isIntermissionScreenKind(value: string): value is IntermissionScreenKind {
  return value === 'entering' || value === 'finished' || value === 'stats';
}
