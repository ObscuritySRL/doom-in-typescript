import { ASPECT_CORRECTED_HEIGHT, SCREENHEIGHT, SCREENWIDTH } from '../../host/windowPolicy.ts';

const CURRENT_LAUNCHER_COMMAND = 'bun run src/main.ts';
const CURRENT_PACKAGE_SCRIPT = 'bun run start';
const CURRENT_WINDOW_HOST_CALL = 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
const CURRENT_WINDOW_TITLE_TEMPLATE = 'DOOM Codex - ${session.mapName}';
const TARGET_RUNTIME_COMMAND = 'bun run doom.ts';

const lockInternal320x200FramebufferContract = Object.freeze({
  commandContract: Object.freeze({
    currentLauncherCommand: CURRENT_LAUNCHER_COMMAND,
    currentPackageScript: CURRENT_PACKAGE_SCRIPT,
    runtimeTargetCommand: TARGET_RUNTIME_COMMAND,
  }),
  currentLauncherHostTransition: Object.freeze({
    call: CURRENT_WINDOW_HOST_CALL,
    defaultScale: 2,
    titleTemplate: CURRENT_WINDOW_TITLE_TEMPLATE,
  }),
  deterministicReplayCompatibility: Object.freeze({
    compatible: true,
    reason: 'Locks framebuffer geometry only and does not consume input, mutate gameplay state, or create a window.',
  }),
  framebuffer: Object.freeze({
    aspectCorrectedDisplayHeight: ASPECT_CORRECTED_HEIGHT,
    height: SCREENHEIGHT,
    indexedByteLength: SCREENWIDTH * SCREENHEIGHT,
    indexedBytesPerPixel: 1,
    paletteEntries: 256,
    pixelCount: SCREENWIDTH * SCREENHEIGHT,
    presentationByteLength: SCREENWIDTH * SCREENHEIGHT * 4,
    presentationBytesPerPixel: 4,
    width: SCREENWIDTH,
  }),
  liveHostEvidence: Object.freeze({
    convertedFrameBufferAllocation: 'const indexedFrameBuffer = new Uint32Array(SCREENWIDTH * SCREENHEIGHT);',
    presentationBitmapHeader: 'const indexedFrameHeader = buildBitmapInfoHeader(SCREENWIDTH, SCREENHEIGHT);',
    presentationBlit:
      'void gdi32.StretchDIBits(deviceContext, presentationRect.x, presentationRect.y, presentationRect.width, presentationRect.height, 0, 0, SCREENWIDTH, SCREENHEIGHT, indexedFrameBytes.ptr, indexedFrameHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
  }),
  stepId: '04-003',
  stepTitle: 'lock-internal-320x200-framebuffer',
} as const);

const lockedInternal320x200FramebufferPlan = Object.freeze({
  aspectCorrectedDisplayHeight: ASPECT_CORRECTED_HEIGHT,
  command: TARGET_RUNTIME_COMMAND,
  currentLauncherCommand: CURRENT_LAUNCHER_COMMAND,
  height: SCREENHEIGHT,
  indexedByteLength: SCREENWIDTH * SCREENHEIGHT,
  pixelCount: SCREENWIDTH * SCREENHEIGHT,
  presentationByteLength: SCREENWIDTH * SCREENHEIGHT * 4,
  titleTemplate: CURRENT_WINDOW_TITLE_TEMPLATE,
  width: SCREENWIDTH,
} as const);

export type LockInternal320x200FramebufferContract = typeof lockInternal320x200FramebufferContract;
export type LockedInternal320x200FramebufferPlan = typeof lockedInternal320x200FramebufferPlan;

export const LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT = lockInternal320x200FramebufferContract;

export function lockInternal320x200Framebuffer(runtimeCommand: string): LockedInternal320x200FramebufferPlan {
  if (runtimeCommand !== TARGET_RUNTIME_COMMAND) {
    throw new Error(`lockInternal320x200Framebuffer requires ${TARGET_RUNTIME_COMMAND}, received ${runtimeCommand}`);
  }

  return lockedInternal320x200FramebufferPlan;
}
