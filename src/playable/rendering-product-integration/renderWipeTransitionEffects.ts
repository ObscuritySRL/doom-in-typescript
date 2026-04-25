import { SCREENHEIGHT, SCREENWIDTH } from '../../render/projection.ts';

export const RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND = 'bun run doom.ts';

export interface RenderWipeTransitionEffectsContext {
  readonly columnRevealedRows: ArrayLike<number>;
  readonly command: string;
  readonly destinationFramebuffer: Uint8Array;
  readonly endFramebuffer: Uint8Array;
  readonly startFramebuffer: Uint8Array;
}

export interface RenderWipeTransitionEffectsResult {
  readonly changedPixelCount: number;
  readonly command: typeof RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND;
  readonly complete: boolean;
  readonly effect: 'melt-column-reveal';
  readonly framebufferChecksum: number;
  readonly revealedPixelCount: number;
  readonly screenHeight: typeof SCREENHEIGHT;
  readonly screenWidth: typeof SCREENWIDTH;
  readonly transition: 'start-to-end';
}

const CHECKSUM_OFFSET_BASIS = 0x811c9dc5;
const CHECKSUM_PRIME = 0x01000193;
const FRAMEBUFFER_BYTE_LENGTH = SCREENHEIGHT * SCREENWIDTH;

export function renderWipeTransitionEffects(context: RenderWipeTransitionEffectsContext): RenderWipeTransitionEffectsResult {
  validateCommand(context.command);
  validateFramebufferLength('destinationFramebuffer', context.destinationFramebuffer);
  validateFramebufferLength('endFramebuffer', context.endFramebuffer);
  validateFramebufferLength('startFramebuffer', context.startFramebuffer);
  validateColumnRevealedRows(context.columnRevealedRows);

  let changedPixelCount = 0;
  let complete = true;
  let framebufferChecksum = CHECKSUM_OFFSET_BASIS;
  let revealedPixelCount = 0;

  for (let columnIndex = 0; columnIndex < SCREENWIDTH; columnIndex += 1) {
    const revealedRows = context.columnRevealedRows[columnIndex]!;

    if (revealedRows < SCREENHEIGHT) {
      complete = false;
    }

    for (let rowIndex = 0; rowIndex < SCREENHEIGHT; rowIndex += 1) {
      const framebufferOffset = rowIndex * SCREENWIDTH + columnIndex;
      const sourceByte = rowIndex < revealedRows ? context.endFramebuffer[framebufferOffset]! : context.startFramebuffer[framebufferOffset]!;

      if (context.destinationFramebuffer[framebufferOffset] !== sourceByte) {
        changedPixelCount += 1;
      }

      context.destinationFramebuffer[framebufferOffset] = sourceByte;

      if (rowIndex < revealedRows) {
        revealedPixelCount += 1;
      }

      framebufferChecksum = updateChecksum(framebufferChecksum, sourceByte);
    }
  }

  return {
    changedPixelCount,
    command: RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND,
    complete,
    effect: 'melt-column-reveal',
    framebufferChecksum,
    revealedPixelCount,
    screenHeight: SCREENHEIGHT,
    screenWidth: SCREENWIDTH,
    transition: 'start-to-end',
  };
}

function updateChecksum(checksum: number, byte: number): number {
  return Math.imul(checksum ^ byte, CHECKSUM_PRIME) >>> 0;
}

function validateColumnRevealedRows(columnRevealedRows: ArrayLike<number>): void {
  if (columnRevealedRows.length !== SCREENWIDTH) {
    throw new Error(`columnRevealedRows must contain ${SCREENWIDTH} columns`);
  }

  for (let columnIndex = 0; columnIndex < SCREENWIDTH; columnIndex += 1) {
    const revealedRows = columnRevealedRows[columnIndex]!;

    if (!Number.isInteger(revealedRows) || revealedRows < 0 || revealedRows > SCREENHEIGHT) {
      throw new Error(`columnRevealedRows[${columnIndex}] must be an integer between 0 and ${SCREENHEIGHT}`);
    }
  }
}

function validateCommand(command: string): void {
  if (command !== RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND) {
    throw new Error(`render wipe transition effects requires ${RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND}`);
  }
}

function validateFramebufferLength(name: string, framebuffer: Uint8Array): void {
  if (framebuffer.length !== FRAMEBUFFER_BYTE_LENGTH) {
    throw new Error(`${name} must contain ${FRAMEBUFFER_BYTE_LENGTH} palette-index pixels`);
  }
}
