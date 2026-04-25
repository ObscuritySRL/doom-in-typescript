import { SBARHEIGHT, SCREENHEIGHT, SCREENWIDTH } from '../../render/projection.ts';

const FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;
const STATUS_BAR_FRAME_BYTE_LENGTH = SCREENWIDTH * SBARHEIGHT;

export const RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND = {
  entryFile: 'doom.ts',
  runtime: 'bun',
  subcommand: 'run',
  value: 'bun run doom.ts',
} as const;

export interface RenderStatusBarProductFrameOptions {
  readonly command: string;
  readonly framebuffer: Uint8Array;
  readonly statusBarFrame: Uint8Array;
}

export interface RenderStatusBarProductFrameResult {
  readonly command: string;
  readonly framebuffer: Uint8Array;
  readonly framebufferLength: number;
  readonly statusBarArea: StatusBarProductFrameArea;
  readonly statusBarFrameLength: number;
}

export interface StatusBarProductFrameArea {
  readonly height: number;
  readonly startOffset: number;
  readonly top: number;
  readonly width: number;
}

/**
 * Copy a 320x32 status-bar product frame into the bottom of a 320x200 framebuffer.
 *
 * @param options - Bun command, target framebuffer, and status-bar frame bytes.
 * @returns Deterministic placement evidence for replay verification.
 * @example
 * ```ts
 * import { renderStatusBarProductFrame } from './src/playable/rendering-product-integration/renderStatusBarProductFrame.ts';
 *
 * const framebuffer = new Uint8Array(320 * 200);
 * const statusBarFrame = new Uint8Array(320 * 32);
 * renderStatusBarProductFrame({ command: 'bun run doom.ts', framebuffer, statusBarFrame });
 * ```
 */
export function renderStatusBarProductFrame(options: RenderStatusBarProductFrameOptions): RenderStatusBarProductFrameResult {
  validateCommand(options.command);
  validateFramebuffer(options.framebuffer);
  validateStatusBarFrame(options.statusBarFrame);

  const statusBarArea = getStatusBarProductFrameArea();
  options.framebuffer.set(options.statusBarFrame, statusBarArea.startOffset);

  return {
    command: options.command,
    framebuffer: options.framebuffer,
    framebufferLength: options.framebuffer.length,
    statusBarArea,
    statusBarFrameLength: options.statusBarFrame.length,
  };
}

export function getStatusBarProductFrameArea(): StatusBarProductFrameArea {
  const top = SCREENHEIGHT - SBARHEIGHT;

  return {
    height: SBARHEIGHT,
    startOffset: top * SCREENWIDTH,
    top,
    width: SCREENWIDTH,
  };
}

function validateCommand(command: string): void {
  if (command !== RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value) {
    throw new Error(`render-status-bar-product-frame requires runtime command: ${RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value}`);
  }
}

function validateFramebuffer(framebuffer: Uint8Array): void {
  if (framebuffer.length !== FRAMEBUFFER_BYTE_LENGTH) {
    throw new Error(`framebuffer must be exactly ${FRAMEBUFFER_BYTE_LENGTH} bytes`);
  }
}

function validateStatusBarFrame(statusBarFrame: Uint8Array): void {
  if (statusBarFrame.length !== STATUS_BAR_FRAME_BYTE_LENGTH) {
    throw new Error(`statusBarFrame must be exactly ${STATUS_BAR_FRAME_BYTE_LENGTH} bytes`);
  }
}
