import { SCREENHEIGHT, SCREENWIDTH } from '../../render/projection.ts';

export const COMPOSE_MENU_OVERLAY_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';
export const COMPOSE_MENU_OVERLAY_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  runtimeCommand: 'bun run doom.ts',
  subcommand: 'run',
});

const FRAMEBUFFER_PIXEL_COUNT = SCREENWIDTH * SCREENHEIGHT;

export interface ComposeMenuOverlayEvidence {
  readonly auditManifestPath: typeof COMPOSE_MENU_OVERLAY_AUDIT_MANIFEST_PATH;
  readonly commandContract: typeof COMPOSE_MENU_OVERLAY_COMMAND_CONTRACT;
  readonly copiedPixels: number;
  readonly framebufferLength: number;
  readonly layerCount: number;
  readonly skippedOffscreenPixels: number;
  readonly skippedTransparentPixels: number;
}

export interface ComposeMenuOverlayInput {
  readonly framebuffer: Uint8Array;
  readonly layers: readonly MenuOverlayLayer[];
  readonly runtimeCommand: string;
}

export interface MenuOverlayLayer {
  readonly height: number;
  readonly left: number;
  readonly pixels: Uint8Array;
  readonly top: number;
  readonly transparentPaletteIndex: number;
  readonly width: number;
}

export function composeMenuOverlay(input: ComposeMenuOverlayInput): ComposeMenuOverlayEvidence {
  validateRuntimeCommand(input.runtimeCommand);
  validateFramebuffer(input.framebuffer);

  for (const layer of input.layers) {
    validateLayer(layer);
  }

  const framebuffer = input.framebuffer;
  let copiedPixels = 0;
  let skippedOffscreenPixels = 0;
  let skippedTransparentPixels = 0;

  for (const layer of input.layers) {
    const layerPixels = layer.pixels;
    const layerWidth = layer.width;
    const layerHeight = layer.height;
    const layerLeft = layer.left;
    const layerTop = layer.top;
    const transparentPaletteIndex = layer.transparentPaletteIndex;

    for (let rowIndex = 0; rowIndex < layerHeight; rowIndex += 1) {
      const framebufferRow = layerTop + rowIndex;
      const layerRowOffset = rowIndex * layerWidth;
      const framebufferRowOffset = framebufferRow * SCREENWIDTH;
      const rowOnScreen = framebufferRow >= 0 && framebufferRow < SCREENHEIGHT;

      for (let columnIndex = 0; columnIndex < layerWidth; columnIndex += 1) {
        const paletteIndex = layerPixels[layerRowOffset + columnIndex]!;

        if (paletteIndex === transparentPaletteIndex) {
          skippedTransparentPixels += 1;
          continue;
        }

        const framebufferColumn = layerLeft + columnIndex;

        if (!rowOnScreen || framebufferColumn < 0 || framebufferColumn >= SCREENWIDTH) {
          skippedOffscreenPixels += 1;
          continue;
        }

        framebuffer[framebufferRowOffset + framebufferColumn] = paletteIndex;
        copiedPixels += 1;
      }
    }
  }

  return Object.freeze({
    auditManifestPath: COMPOSE_MENU_OVERLAY_AUDIT_MANIFEST_PATH,
    commandContract: COMPOSE_MENU_OVERLAY_COMMAND_CONTRACT,
    copiedPixels,
    framebufferLength: framebuffer.length,
    layerCount: input.layers.length,
    skippedOffscreenPixels,
    skippedTransparentPixels,
  });
}

function validateFramebuffer(framebuffer: Uint8Array): void {
  if (framebuffer.length !== FRAMEBUFFER_PIXEL_COUNT) {
    throw new Error(`compose menu overlay requires a ${SCREENWIDTH}x${SCREENHEIGHT} framebuffer`);
  }
}

function validateLayer(layer: MenuOverlayLayer): void {
  if (!Number.isInteger(layer.height) || layer.height <= 0) {
    throw new Error('compose menu overlay layer height must be a positive integer');
  }

  if (!Number.isInteger(layer.left)) {
    throw new Error('compose menu overlay layer left must be an integer');
  }

  if (!Number.isInteger(layer.top)) {
    throw new Error('compose menu overlay layer top must be an integer');
  }

  if (!Number.isInteger(layer.transparentPaletteIndex) || layer.transparentPaletteIndex < 0 || layer.transparentPaletteIndex > 0xff) {
    throw new Error('compose menu overlay transparent palette index must be an 8-bit integer');
  }

  if (!Number.isInteger(layer.width) || layer.width <= 0) {
    throw new Error('compose menu overlay layer width must be a positive integer');
  }

  if (layer.pixels.length !== layer.width * layer.height) {
    throw new Error('compose menu overlay layer pixel length must match width and height');
  }
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== COMPOSE_MENU_OVERLAY_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error(`compose menu overlay requires ${COMPOSE_MENU_OVERLAY_COMMAND_CONTRACT.runtimeCommand}`);
  }
}
