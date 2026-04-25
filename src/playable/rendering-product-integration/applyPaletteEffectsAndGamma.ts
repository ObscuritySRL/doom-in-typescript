import { SCREENHEIGHT, SCREENWIDTH } from '../../render/projection.ts';

const FRAMEBUFFER_PIXEL_COUNT = SCREENWIDTH * SCREENHEIGHT;
const GAMMA_TABLE_BYTE_LENGTH = 0x100;
const PALETTE_BYTE_LENGTH = 0x100 * 3;
const PRESENTATION_BYTES_PER_PIXEL = 4;
const PRESENTATION_FRAMEBUFFER_BYTE_LENGTH = FRAMEBUFFER_PIXEL_COUNT * PRESENTATION_BYTES_PER_PIXEL;

export const PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
} as const);

export interface PaletteEffect {
  readonly blue: number;
  readonly green: number;
  readonly red: number;
  readonly strength: number;
}

export interface PaletteEffectsAndGammaContext {
  readonly framebuffer: Uint8Array;
  readonly gammaTable: Uint8Array;
  readonly palette: Uint8Array;
  readonly paletteEffect: PaletteEffect;
  readonly presentationFramebuffer: Uint8Array;
  readonly runtimeCommand: string;
}

export interface PaletteEffectsAndGammaResult {
  readonly commandContract: typeof PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT;
  readonly framebufferChecksum: number;
  readonly gammaTableByteLength: number;
  readonly paletteByteLength: number;
  readonly paletteEffect: PaletteEffect;
  readonly pixelCount: number;
  readonly presentationChecksum: number;
  readonly presentationFramebuffer: Uint8Array;
  readonly transition: 'palette-effects-and-gamma-applied';
}

/**
 * Apply the selected palette effect and gamma table to a full 320x200
 * palette-index framebuffer for the Bun-run playable path.
 *
 * @param context - Full framebuffer, palette, gamma table, palette effect, presentation destination, and runtime command.
 * @returns Replay-stable evidence plus the caller-owned presentation framebuffer.
 *
 * @example
 * ```ts
 * import { applyPaletteEffectsAndGamma } from "../src/playable/rendering-product-integration/applyPaletteEffectsAndGamma.ts";
 *
 * const result = applyPaletteEffectsAndGamma({
 *   framebuffer: new Uint8Array(320 * 200),
 *   gammaTable: Uint8Array.from({ length: 256 }, (_, value) => value),
 *   palette: new Uint8Array(256 * 3),
 *   paletteEffect: { blue: 0, green: 0, red: 0, strength: 0 },
 *   presentationFramebuffer: new Uint8Array(320 * 200 * 4),
 *   runtimeCommand: "bun run doom.ts",
 * });
 * ```
 */
export function applyPaletteEffectsAndGamma(context: PaletteEffectsAndGammaContext): PaletteEffectsAndGammaResult {
  if (context.runtimeCommand !== PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error(`apply palette effects and gamma requires ${PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT.runtimeCommand}`);
  }

  assertByteLength('framebuffer', context.framebuffer, FRAMEBUFFER_PIXEL_COUNT);
  assertByteLength('gammaTable', context.gammaTable, GAMMA_TABLE_BYTE_LENGTH);
  assertByteLength('palette', context.palette, PALETTE_BYTE_LENGTH);
  assertByteLength('presentationFramebuffer', context.presentationFramebuffer, PRESENTATION_FRAMEBUFFER_BYTE_LENGTH);
  assertPaletteEffect(context.paletteEffect);

  let framebufferChecksum = 0x811c_9dc5;
  let presentationChecksum = 0x811c_9dc5;
  const inverseStrength = 0x100 - context.paletteEffect.strength;

  for (let pixelIndex = 0; pixelIndex < FRAMEBUFFER_PIXEL_COUNT; pixelIndex += 1) {
    const paletteIndex = context.framebuffer[pixelIndex]!;
    const paletteOffset = paletteIndex * 3;
    const presentationOffset = pixelIndex * PRESENTATION_BYTES_PER_PIXEL;
    const blue = context.gammaTable[blendChannel(context.palette[paletteOffset + 2]!, context.paletteEffect.blue, context.paletteEffect.strength, inverseStrength)]!;
    const green = context.gammaTable[blendChannel(context.palette[paletteOffset + 1]!, context.paletteEffect.green, context.paletteEffect.strength, inverseStrength)]!;
    const red = context.gammaTable[blendChannel(context.palette[paletteOffset]!, context.paletteEffect.red, context.paletteEffect.strength, inverseStrength)]!;

    context.presentationFramebuffer[presentationOffset] = red;
    context.presentationFramebuffer[presentationOffset + 1] = green;
    context.presentationFramebuffer[presentationOffset + 2] = blue;
    context.presentationFramebuffer[presentationOffset + 3] = 0xff;

    framebufferChecksum ^= paletteIndex;
    framebufferChecksum = Math.imul(framebufferChecksum, 0x0100_0193) >>> 0;
    presentationChecksum ^= red;
    presentationChecksum = Math.imul(presentationChecksum, 0x0100_0193) >>> 0;
    presentationChecksum ^= green;
    presentationChecksum = Math.imul(presentationChecksum, 0x0100_0193) >>> 0;
    presentationChecksum ^= blue;
    presentationChecksum = Math.imul(presentationChecksum, 0x0100_0193) >>> 0;
    presentationChecksum ^= 0xff;
    presentationChecksum = Math.imul(presentationChecksum, 0x0100_0193) >>> 0;
  }

  return {
    commandContract: PALETTE_EFFECTS_AND_GAMMA_COMMAND_CONTRACT,
    framebufferChecksum,
    gammaTableByteLength: context.gammaTable.byteLength,
    paletteByteLength: context.palette.byteLength,
    paletteEffect: context.paletteEffect,
    pixelCount: FRAMEBUFFER_PIXEL_COUNT,
    presentationChecksum,
    presentationFramebuffer: context.presentationFramebuffer,
    transition: 'palette-effects-and-gamma-applied',
  };
}

function assertByteLength(name: string, bytes: Uint8Array, expectedByteLength: number): void {
  if (bytes.byteLength !== expectedByteLength) {
    throw new RangeError(`${name} must contain ${expectedByteLength} bytes`);
  }
}

function assertChannel(name: string, value: number, maximum: number): void {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`${name} must be an integer from 0 to ${maximum}`);
  }
}

function assertPaletteEffect(paletteEffect: PaletteEffect): void {
  assertChannel('paletteEffect.blue', paletteEffect.blue, 0xff);
  assertChannel('paletteEffect.green', paletteEffect.green, 0xff);
  assertChannel('paletteEffect.red', paletteEffect.red, 0xff);
  assertChannel('paletteEffect.strength', paletteEffect.strength, 0x100);
}

function blendChannel(source: number, target: number, strength: number, inverseStrength: number): number {
  return ((source * inverseStrength + target * strength + 0x80) >> 8) & 0xff;
}
