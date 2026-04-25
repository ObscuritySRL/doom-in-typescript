import { SCREENHEIGHT, SCREENWIDTH, computePresentationRect } from '../../host/windowPolicy.ts';

const BACKGROUND_FILL_COLOR = 0xff00_0000;
const BACKGROUND_FILL_HEIGHT = 1;
const BACKGROUND_FILL_WIDTH = 1;
const TARGET_RUNTIME_COMMAND = 'bun run doom.ts';

const liveSourceEvidence = [
  'presentFrame(user32.symbols, gdi32.symbols, windowHandle, indexedFrameBytes, indexedFrameHeader, backgroundFillBytes, backgroundFillHeader);',
  'const presentationRect = computePresentationRect(clientWidth, clientHeight, true);',
  'void gdi32.StretchDIBits(deviceContext, 0, 0, clientWidth, clientHeight, 0, 0, 1, 1, backgroundFillBytes.ptr, backgroundFillHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
  'void gdi32.StretchDIBits(deviceContext, presentationRect.x, presentationRect.y, presentationRect.width, presentationRect.height, 0, 0, SCREENWIDTH, SCREENHEIGHT, indexedFrameBytes.ptr, indexedFrameHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
  'void user32.ReleaseDC(windowHandle, deviceContext);',
] as const;

const blitFramebufferToWindowContract = {
  aspectRatioCorrect: true,
  auditedHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  backgroundFillColor: BACKGROUND_FILL_COLOR,
  backgroundFillHeight: BACKGROUND_FILL_HEIGHT,
  backgroundFillWidth: BACKGROUND_FILL_WIDTH,
  bitmapHeaderEncoding: 'bi-rgb-32-bit-top-down',
  blitFunctionName: 'StretchDIBits',
  clientRectFunctionName: 'GetClientRect',
  deviceContextAcquireFunctionName: 'GetDC',
  deviceContextReleaseFunctionName: 'ReleaseDC',
  liveSourceEvidence,
  presentationRectFunctionName: 'computePresentationRect',
  runtimeCommand: TARGET_RUNTIME_COMMAND,
  sourceFramebufferHeight: SCREENHEIGHT,
  sourceFramebufferWidth: SCREENWIDTH,
} as const;

export interface BlitFramebufferOperation {
  readonly destinationHeight: number;
  readonly destinationWidth: number;
  readonly destinationX: number;
  readonly destinationY: number;
  readonly sourceHeight: number;
  readonly sourceWidth: number;
}

export interface BlitFramebufferToWindowContract {
  readonly aspectRatioCorrect: true;
  readonly auditedHostTransition: string;
  readonly backgroundFillColor: typeof BACKGROUND_FILL_COLOR;
  readonly backgroundFillHeight: typeof BACKGROUND_FILL_HEIGHT;
  readonly backgroundFillWidth: typeof BACKGROUND_FILL_WIDTH;
  readonly bitmapHeaderEncoding: 'bi-rgb-32-bit-top-down';
  readonly blitFunctionName: 'StretchDIBits';
  readonly clientRectFunctionName: 'GetClientRect';
  readonly deviceContextAcquireFunctionName: 'GetDC';
  readonly deviceContextReleaseFunctionName: 'ReleaseDC';
  readonly liveSourceEvidence: typeof liveSourceEvidence;
  readonly presentationRectFunctionName: 'computePresentationRect';
  readonly runtimeCommand: typeof TARGET_RUNTIME_COMMAND;
  readonly sourceFramebufferHeight: typeof SCREENHEIGHT;
  readonly sourceFramebufferWidth: typeof SCREENWIDTH;
}

export interface BlitFramebufferToWindowInput {
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly runtimeCommand: string;
}

export interface BlitFramebufferToWindowPlan {
  readonly backgroundFill: BlitFramebufferOperation;
  readonly deterministicReplayCompatible: true;
  readonly framebufferBlit: BlitFramebufferOperation;
  readonly isNoOp: boolean;
  readonly runtimeCommand: typeof TARGET_RUNTIME_COMMAND;
  readonly transition: string;
}

export const BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT = Object.freeze(blitFramebufferToWindowContract) satisfies BlitFramebufferToWindowContract;

/**
 * Create the minimal blit plan that maps a prepared framebuffer into the
 * playable window path used by `bun run doom.ts`.
 *
 * @param input - Runtime command and current client-area dimensions.
 * @returns A deterministic blit plan derived from the shared window policy.
 *
 * @example
 * ```ts
 * blitFramebufferToWindow({
 *   clientHeight: 480,
 *   clientWidth: 640,
 *   runtimeCommand: 'bun run doom.ts',
 * });
 * ```
 */
export function blitFramebufferToWindow(input: BlitFramebufferToWindowInput): BlitFramebufferToWindowPlan {
  if (input.runtimeCommand !== BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.runtimeCommand) {
    throw new Error(`blitFramebufferToWindow requires ${BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.runtimeCommand}; received ${input.runtimeCommand}`);
  }

  const safeClientHeight = Math.max(0, input.clientHeight);
  const safeClientWidth = Math.max(0, input.clientWidth);
  const presentationRect = computePresentationRect(safeClientWidth, safeClientHeight, BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.aspectRatioCorrect);
  const isNoOp = presentationRect.width === 0 || presentationRect.height === 0;

  return Object.freeze({
    backgroundFill: Object.freeze({
      destinationHeight: safeClientHeight,
      destinationWidth: safeClientWidth,
      destinationX: 0,
      destinationY: 0,
      sourceHeight: BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.backgroundFillHeight,
      sourceWidth: BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.backgroundFillWidth,
    }),
    deterministicReplayCompatible: true,
    framebufferBlit: Object.freeze({
      destinationHeight: presentationRect.height,
      destinationWidth: presentationRect.width,
      destinationX: presentationRect.x,
      destinationY: presentationRect.y,
      sourceHeight: BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.sourceFramebufferHeight,
      sourceWidth: BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.sourceFramebufferWidth,
    }),
    isNoOp,
    runtimeCommand: BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.runtimeCommand,
    transition: BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.auditedHostTransition,
  });
}
