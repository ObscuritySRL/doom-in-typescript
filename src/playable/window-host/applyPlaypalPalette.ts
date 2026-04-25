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

  const indexedFramebuffer = options.indexedFramebuffer;
  const indexedFramebufferLength = indexedFramebuffer.length;

  if (indexedFramebufferLength !== APPLY_PLAYPAL_PALETTE_CONTRACT.indexedFramebufferBytesLength) {
    throw new Error(`Expected indexed framebuffer byte length ${APPLY_PLAYPAL_PALETTE_CONTRACT.indexedFramebufferBytesLength}, received ${indexedFramebufferLength}`);
  }

  if (options.playpalPalette.length !== APPLY_PLAYPAL_PALETTE_CONTRACT.paletteBytesLength) {
    throw new Error(`Expected PLAYPAL byte length ${APPLY_PLAYPAL_PALETTE_CONTRACT.paletteBytesLength}, received ${options.playpalPalette.length}`);
  }

  const paletteLookup = buildPaletteLookup(options.playpalPalette);
  const presentedFramebuffer = new Uint32Array(APPLY_PLAYPAL_PALETTE_CONTRACT.indexedFramebufferPixelCount);

  for (let pixelIndex = 0; pixelIndex < indexedFramebufferLength; pixelIndex += 1) {
    presentedFramebuffer[pixelIndex] = paletteLookup[indexedFramebuffer[pixelIndex]!]!;
  }

  return Object.freeze({
    contract: APPLY_PLAYPAL_PALETTE_CONTRACT,
    paletteLookup,
    presentedFramebuffer,
  });
}

function buildPaletteLookup(playpalPalette: Uint8Array): Uint32Array {
  const paletteEntries = APPLY_PLAYPAL_PALETTE_CONTRACT.paletteEntries;
  const paletteEntryBytes = APPLY_PLAYPAL_PALETTE_CONTRACT.paletteEntryBytes;
  const greenShift = APPLY_PLAYPAL_PALETTE_CONTRACT.greenShift;
  const redShift = APPLY_PLAYPAL_PALETTE_CONTRACT.redShift;
  const alphaMask = APPLY_PLAYPAL_PALETTE_CONTRACT.alphaMask;
  const paletteLookup = new Uint32Array(paletteEntries);

  for (let colorIndex = 0; colorIndex < paletteEntries; colorIndex += 1) {
    const paletteOffset = colorIndex * paletteEntryBytes;
    const red = playpalPalette[paletteOffset]!;
    const green = playpalPalette[paletteOffset + 1]!;
    const blue = playpalPalette[paletteOffset + 2]!;

    paletteLookup[colorIndex] = blue | (green << greenShift) | (red << redShift) | alphaMask;
  }

  return paletteLookup;
}
