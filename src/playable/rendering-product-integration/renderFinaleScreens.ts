import { SCREENHEIGHT, SCREENWIDTH } from '../../render/projection.ts';

export const RENDER_FINALE_SCREENS_AUDIT_MANIFEST = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';
export const RENDER_FINALE_SCREENS_COMMAND = 'bun run doom.ts';

const FINALE_FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;
const MAX_PALETTE_INDEX = 0xff;

export type FinaleBackground = FinaleFillBackground | FinalePixelBackground;
export type FinaleScreenPhase = 'cast' | 'text' | 'victory';

export interface FinaleFillBackground {
  readonly kind: 'fill';
  readonly paletteIndex: number;
}

export interface FinaleLayer {
  readonly height: number;
  readonly left: number;
  readonly pixels: Uint8Array;
  readonly top: number;
  readonly transparentPaletteIndex: number;
  readonly width: number;
}

export interface FinalePixelBackground {
  readonly kind: 'pixels';
  readonly pixels: Uint8Array;
}

export interface FinaleScreen {
  readonly background: FinaleBackground;
  readonly layers: readonly FinaleLayer[];
  readonly name: string;
  readonly phase: FinaleScreenPhase;
}

export interface RenderFinaleScreensInput {
  readonly command: string;
  readonly framebuffer: Uint8Array;
  readonly previousScreenName: string | null;
  readonly screen: FinaleScreen;
}

export interface RenderFinaleScreensResult {
  readonly backgroundByteCount: number;
  readonly clippedLayerPixelCount: number;
  readonly command: string;
  readonly drawnLayerPixelCount: number;
  readonly framebufferChecksum: number;
  readonly phase: FinaleScreenPhase;
  readonly previousScreenName: string | null;
  readonly screenName: string;
  readonly skippedTransparentPixelCount: number;
  readonly transition: string;
}

interface LayerCompositionEvidence {
  readonly clippedLayerPixelCount: number;
  readonly drawnLayerPixelCount: number;
  readonly skippedTransparentPixelCount: number;
}

export function renderFinaleScreens(input: RenderFinaleScreensInput): RenderFinaleScreensResult {
  assertRuntimeCommand(input.command);
  assertFramebufferByteLength(input.framebuffer, 'framebuffer');
  assertValidFinaleScreen(input.screen);

  const backgroundByteCount = renderFinaleBackground(input.framebuffer, input.screen.background);
  const layerCompositionEvidence = composeFinaleLayers(input.framebuffer, input.screen.layers);
  const screenName = input.screen.name;

  return Object.freeze({
    backgroundByteCount,
    clippedLayerPixelCount: layerCompositionEvidence.clippedLayerPixelCount,
    command: RENDER_FINALE_SCREENS_COMMAND,
    drawnLayerPixelCount: layerCompositionEvidence.drawnLayerPixelCount,
    framebufferChecksum: computeFramebufferChecksum(input.framebuffer),
    phase: input.screen.phase,
    previousScreenName: input.previousScreenName,
    screenName,
    skippedTransparentPixelCount: layerCompositionEvidence.skippedTransparentPixelCount,
    transition: `${input.previousScreenName ?? 'none'}->${screenName}`,
  });
}

function assertFramebufferByteLength(framebuffer: Uint8Array, label: string): void {
  if (framebuffer.length !== FINALE_FRAMEBUFFER_BYTE_LENGTH) {
    throw new RangeError(`${label} must be exactly ${FINALE_FRAMEBUFFER_BYTE_LENGTH} bytes (${SCREENWIDTH}x${SCREENHEIGHT})`);
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer`);
  }
}

function assertPaletteIndex(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_PALETTE_INDEX) {
    throw new RangeError(`${label} must be an integer palette index from 0 to ${MAX_PALETTE_INDEX}`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
}

function assertRuntimeCommand(command: string): void {
  if (command !== RENDER_FINALE_SCREENS_COMMAND) {
    throw new Error(`render finale screens requires ${RENDER_FINALE_SCREENS_COMMAND}`);
  }
}

function assertValidBackground(background: FinaleBackground): void {
  if (background.kind === 'fill') {
    assertPaletteIndex(background.paletteIndex, 'finale fill background palette index');
    return;
  }

  assertFramebufferByteLength(background.pixels, 'finale pixel background');
}

function assertValidFinaleLayer(layer: FinaleLayer, layerIndex: number): void {
  assertPositiveInteger(layer.height, `finale layer ${layerIndex} height`);
  assertInteger(layer.left, `finale layer ${layerIndex} left`);
  assertInteger(layer.top, `finale layer ${layerIndex} top`);
  assertPaletteIndex(layer.transparentPaletteIndex, `finale layer ${layerIndex} transparent palette index`);
  assertPositiveInteger(layer.width, `finale layer ${layerIndex} width`);

  const expectedPixelLength = layer.width * layer.height;
  if (layer.pixels.length !== expectedPixelLength) {
    throw new RangeError(`finale layer ${layerIndex} must have exactly ${expectedPixelLength} pixels`);
  }
}

function assertValidFinaleScreen(screen: FinaleScreen): void {
  if (screen.name.trim().length === 0) {
    throw new Error('finale screen name is required');
  }

  assertValidBackground(screen.background);

  for (let layerIndex = 0; layerIndex < screen.layers.length; layerIndex += 1) {
    assertValidFinaleLayer(screen.layers[layerIndex]!, layerIndex);
  }
}

function composeFinaleLayers(framebuffer: Uint8Array, layers: readonly FinaleLayer[]): LayerCompositionEvidence {
  let clippedLayerPixelCount = 0;
  let drawnLayerPixelCount = 0;
  let skippedTransparentPixelCount = 0;

  for (const layer of layers) {
    for (let layerRow = 0; layerRow < layer.height; layerRow += 1) {
      const screenRow = layer.top + layerRow;

      if (screenRow < 0 || screenRow >= SCREENHEIGHT) {
        clippedLayerPixelCount += layer.width;
        continue;
      }

      for (let layerColumn = 0; layerColumn < layer.width; layerColumn += 1) {
        const screenColumn = layer.left + layerColumn;
        const sourceOffset = layerRow * layer.width + layerColumn;

        if (screenColumn < 0 || screenColumn >= SCREENWIDTH) {
          clippedLayerPixelCount += 1;
          continue;
        }

        const paletteIndex = layer.pixels[sourceOffset]!;

        if (paletteIndex === layer.transparentPaletteIndex) {
          skippedTransparentPixelCount += 1;
          continue;
        }

        framebuffer[screenRow * SCREENWIDTH + screenColumn] = paletteIndex;
        drawnLayerPixelCount += 1;
      }
    }
  }

  return {
    clippedLayerPixelCount,
    drawnLayerPixelCount,
    skippedTransparentPixelCount,
  };
}

function computeFramebufferChecksum(framebuffer: Uint8Array): number {
  let checksum = 0;

  for (let byteIndex = 0; byteIndex < framebuffer.length; byteIndex += 1) {
    checksum = (checksum + framebuffer[byteIndex]! * (byteIndex + 1)) % 0x1_0000_0000;
  }

  return checksum;
}

function renderFinaleBackground(framebuffer: Uint8Array, background: FinaleBackground): number {
  if (background.kind === 'fill') {
    framebuffer.fill(background.paletteIndex);
    return framebuffer.length;
  }

  framebuffer.set(background.pixels);
  return background.pixels.length;
}
