import { DetailMode, MAX_SETBLOCKS, MIN_SETBLOCKS, SCREENHEIGHT, SCREENWIDTH, computeViewport } from '../../render/projection.ts';

export const RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;
export const RENDER_SCREENBLOCKS_RUNTIME_COMMAND = 'bun run doom.ts';
export const RENDER_SCREENBLOCKS_RUNTIME_ENTRY_FILE = 'doom.ts';

export interface RenderScreenblocksEvidence {
  readonly changedPixelCount: number;
  readonly command: string;
  readonly copiedPixelCount: number;
  readonly destinationChecksum: number;
  readonly detailMode: DetailMode;
  readonly framebufferByteLength: number;
  readonly preservedPixelCount: number;
  readonly runtimeEntryFile: string;
  readonly setBlocks: number;
  readonly viewport: RenderScreenblocksViewport;
}

export interface RenderScreenblocksOptions {
  readonly command: string;
  readonly destinationFramebuffer: Uint8Array;
  readonly detailMode: DetailMode;
  readonly setBlocks: number;
  readonly sourceFramebuffer: Uint8Array;
}

export interface RenderScreenblocksViewport {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

export function renderScreenblocks(options: RenderScreenblocksOptions): RenderScreenblocksEvidence {
  assertRuntimeCommand(options.command);
  assertFramebufferLength('destinationFramebuffer', options.destinationFramebuffer);
  assertFramebufferLength('sourceFramebuffer', options.sourceFramebuffer);

  const detailMode = normalizeDetailMode(options.detailMode);
  const setBlocks = normalizeSetBlocks(options.setBlocks);
  const viewport = computeViewport(setBlocks, detailMode);
  const viewportEvidence = {
    height: viewport.viewHeight,
    left: viewport.viewWindowX,
    top: viewport.viewWindowY,
    width: viewport.scaledViewWidth,
  };
  let changedPixelCount = 0;

  for (let y = viewportEvidence.top; y < viewportEvidence.top + viewportEvidence.height; y += 1) {
    const rowOffset = y * SCREENWIDTH;

    for (let x = viewportEvidence.left; x < viewportEvidence.left + viewportEvidence.width; x += 1) {
      const framebufferOffset = rowOffset + x;
      const sourcePixel = options.sourceFramebuffer[framebufferOffset]!;

      if (options.destinationFramebuffer[framebufferOffset] !== sourcePixel) {
        changedPixelCount += 1;
      }

      options.destinationFramebuffer[framebufferOffset] = sourcePixel;
    }
  }

  const copiedPixelCount = viewportEvidence.width * viewportEvidence.height;

  return {
    changedPixelCount,
    command: RENDER_SCREENBLOCKS_RUNTIME_COMMAND,
    copiedPixelCount,
    destinationChecksum: checksumFramebuffer(options.destinationFramebuffer),
    detailMode,
    framebufferByteLength: RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH,
    preservedPixelCount: RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH - copiedPixelCount,
    runtimeEntryFile: RENDER_SCREENBLOCKS_RUNTIME_ENTRY_FILE,
    setBlocks,
    viewport: viewportEvidence,
  };
}

function assertFramebufferLength(label: string, framebuffer: Uint8Array): void {
  if (framebuffer.length !== RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH) {
    throw new RangeError(`${label} must contain exactly ${RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH} bytes.`);
  }
}

function assertRuntimeCommand(command: string): void {
  if (command !== RENDER_SCREENBLOCKS_RUNTIME_COMMAND) {
    throw new Error(`render screenblocks requires ${RENDER_SCREENBLOCKS_RUNTIME_COMMAND}.`);
  }
}

function checksumFramebuffer(framebuffer: Uint8Array): number {
  let checksum = 0x811c_9dc5;

  for (let index = 0; index < framebuffer.length; index += 1) {
    checksum ^= framebuffer[index]!;
    checksum = Math.imul(checksum, 0x0100_0193) >>> 0;
  }

  return checksum;
}

function normalizeDetailMode(detailMode: DetailMode): DetailMode {
  return (detailMode | 0) === DetailMode.high ? DetailMode.high : DetailMode.low;
}

function normalizeSetBlocks(setBlocks: number): number {
  if (!Number.isFinite(setBlocks)) {
    throw new RangeError('setBlocks must be a finite number.');
  }

  const integerSetBlocks = Math.trunc(setBlocks);

  if (integerSetBlocks < MIN_SETBLOCKS) {
    return MIN_SETBLOCKS;
  }

  if (integerSetBlocks > MAX_SETBLOCKS) {
    return MAX_SETBLOCKS;
  }

  return integerSetBlocks;
}
