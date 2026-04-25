import { SCREENHEIGHT, SCREENWIDTH } from '../../host/windowPolicy.ts';

const PALETTE_ENTRIES = 256;
const PALETTE_ENTRY_BYTES = 3;

export const APPLY_PLAYPAL_PALETTE_CONTRACT = Object.freeze({
  alphaMask: 0xff00_0000,
  auditedHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  blueShift: 0,
  deterministicReplayCompatible: true,
  greenShift: 8,
  indexedFramebufferBytesLength: SCREENWIDTH * SCREENHEIGHT,
  indexedFramebufferHeight: SCREENHEIGHT,
  indexedFramebufferPixelCount: SCREENWIDTH * SCREENHEIGHT,
  indexedFramebufferWidth: SCREENWIDTH,
  paletteBytesLength: PALETTE_ENTRIES * PALETTE_ENTRY_BYTES,
  paletteEntries: PALETTE_ENTRIES,
  paletteEntryBytes: PALETTE_ENTRY_BYTES,
  paletteLookupSourceEvidence: 'const paletteLookup = buildPaletteLookup(session.palette);',
  palettePresentationSourceEvidence: 'convertIndexedFrame(session.framebuffer, indexedFrameBuffer, paletteLookup);',
  paletteWriteSourceEvidence: 'colors[colorIndex] = blue | (green << 8) | (red << 16) | 0xff00_0000;',
  presentedPixelFormat: '0xAARRGGBB',
  redShift: 16,
  runtimeCommand: 'bun run doom.ts',
  scope: 'palette-application-only',
} as const);

export interface ApplyPlaypalPaletteOptions {
  readonly indexedFramebuffer: Uint8Array;
  readonly playpalPalette: Uint8Array;
  readonly runtimeCommand: string;
}

export interface ApplyPlaypalPaletteResult {
  readonly contract: typeof APPLY_PLAYPAL_PALETTE_CONTRACT;
  readonly paletteLookup: Uint32Array;
  readonly presentedFramebuffer: Uint32Array;
}

export function applyPlaypalPalette(options: ApplyPlaypalPaletteOptions): ApplyPlaypalPaletteResult {
  if (options.runtimeCommand !== APPLY_PLAYPAL_PALETTE_CONTRACT.runtimeCommand) {
    throw new Error(`Expected runtime command ${APPLY_PLAYPAL_PALETTE_CONTRACT.runtimeCommand}, received ${options.runtimeCommand}`);
  }

  if (options.indexedFramebuffer.length !== APPLY_PLAYPAL_PALETTE_CONTRACT.indexedFramebufferBytesLength) {
    throw new Error(`Expected indexed framebuffer byte length ${APPLY_PLAYPAL_PALETTE_CONTRACT.indexedFramebufferBytesLength}, received ${options.indexedFramebuffer.length}`);
  }

  if (options.playpalPalette.length !== APPLY_PLAYPAL_PALETTE_CONTRACT.paletteBytesLength) {
    throw new Error(`Expected PLAYPAL byte length ${APPLY_PLAYPAL_PALETTE_CONTRACT.paletteBytesLength}, received ${options.playpalPalette.length}`);
  }

  const paletteLookup = buildPaletteLookup(options.playpalPalette);
  const presentedFramebuffer = new Uint32Array(APPLY_PLAYPAL_PALETTE_CONTRACT.indexedFramebufferPixelCount);

  for (let pixelIndex = 0; pixelIndex < options.indexedFramebuffer.length; pixelIndex += 1) {
    presentedFramebuffer[pixelIndex] = paletteLookup[options.indexedFramebuffer[pixelIndex]!]!;
  }

  return Object.freeze({
    contract: APPLY_PLAYPAL_PALETTE_CONTRACT,
    paletteLookup,
    presentedFramebuffer,
  });
}

function buildPaletteLookup(playpalPalette: Uint8Array): Uint32Array {
  const paletteLookup = new Uint32Array(APPLY_PLAYPAL_PALETTE_CONTRACT.paletteEntries);

  for (let colorIndex = 0; colorIndex < APPLY_PLAYPAL_PALETTE_CONTRACT.paletteEntries; colorIndex += 1) {
    const paletteOffset = colorIndex * APPLY_PLAYPAL_PALETTE_CONTRACT.paletteEntryBytes;
    const blue = playpalPalette[paletteOffset + 2]!;
    const green = playpalPalette[paletteOffset + 1]!;
    const red = playpalPalette[paletteOffset]!;

    paletteLookup[colorIndex] = blue | (green << APPLY_PLAYPAL_PALETTE_CONTRACT.greenShift) | (red << APPLY_PLAYPAL_PALETTE_CONTRACT.redShift) | APPLY_PLAYPAL_PALETTE_CONTRACT.alphaMask;
  }

  return paletteLookup;
}
