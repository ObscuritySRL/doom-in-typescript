import { computeClientDimensions, SCREENHEIGHT, SCREENWIDTH } from '../../host/windowPolicy.ts';

const AUDITED_LAUNCHER_TRANSITION = 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
const PALETTE_CONVERSION_CALL = 'convertIndexedFrame(session.framebuffer, indexedFrameBuffer, paletteLookup);';
const PRESENT_CALL = 'presentFrame(user32.symbols, gdi32.symbols, windowHandle, indexedFrameBytes, indexedFrameHeader, backgroundFillBytes, backgroundFillHeader);';
const RENDER_CALL = 'renderLauncherFrame(session);';
const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';

export interface ScreenshotCaptureHook {
  readonly captureFormat: 'argb8888-320x200' | 'indexed-320x200' | 'windowed-presentation-plan';
  readonly description: string;
  readonly hookId: 'after-palette-conversion' | 'after-render-launcher-frame' | 'before-window-present';
  readonly mutationPolicy: 'observe-only';
  readonly sourceBuffer: 'indexedFrameBytes' | 'presentFrame' | 'session.framebuffer';
}

export interface ScreenshotCaptureHooksContract {
  readonly auditedLauncherTransition: string;
  readonly defaultWindowClientArea: Readonly<{ width: number; height: number }>;
  readonly framebuffer: Readonly<{ width: number; height: number }>;
  readonly hooks: readonly ScreenshotCaptureHook[];
  readonly liveSourceEvidence: Readonly<{
    paletteConversionCall: string;
    presentCall: string;
    renderCall: string;
  }>;
  readonly replayCompatibility: string;
  readonly runtimeCommand: string;
  readonly stepId: '04-014';
  readonly stepTitle: 'add-screenshot-capture-hooks';
}

const defaultWindowClientArea = computeClientDimensions(2, true);

export const SCREENSHOT_CAPTURE_HOOKS_CONTRACT = Object.freeze({
  auditedLauncherTransition: AUDITED_LAUNCHER_TRANSITION,
  defaultWindowClientArea,
  framebuffer: Object.freeze({
    height: SCREENHEIGHT,
    width: SCREENWIDTH,
  }),
  hooks: Object.freeze([
    Object.freeze({
      captureFormat: 'indexed-320x200',
      description: 'Observe the freshly rendered indexed framebuffer before palette expansion.',
      hookId: 'after-render-launcher-frame',
      mutationPolicy: 'observe-only',
      sourceBuffer: 'session.framebuffer',
    }),
    Object.freeze({
      captureFormat: 'argb8888-320x200',
      description: 'Observe the palette-expanded ARGB framebuffer before window presentation.',
      hookId: 'after-palette-conversion',
      mutationPolicy: 'observe-only',
      sourceBuffer: 'indexedFrameBytes',
    }),
    Object.freeze({
      captureFormat: 'windowed-presentation-plan',
      description: 'Observe the final presentation handoff without mutating timing or blit order.',
      hookId: 'before-window-present',
      mutationPolicy: 'observe-only',
      sourceBuffer: 'presentFrame',
    }),
  ]),
  liveSourceEvidence: Object.freeze({
    paletteConversionCall: PALETTE_CONVERSION_CALL,
    presentCall: PRESENT_CALL,
    renderCall: RENDER_CALL,
  }),
  replayCompatibility: 'Observe-only hooks capture framebuffer state without mutating session, input, timing, or presentation order.',
  runtimeCommand: REQUIRED_RUNTIME_COMMAND,
  stepId: '04-014',
  stepTitle: 'add-screenshot-capture-hooks',
} as const satisfies ScreenshotCaptureHooksContract);

export interface AddScreenshotCaptureHooksOptions {
  readonly runtimeCommand: string;
}

export function addScreenshotCaptureHooks(options: AddScreenshotCaptureHooksOptions): ScreenshotCaptureHooksContract {
  if (options.runtimeCommand !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error(`addScreenshotCaptureHooks requires ${REQUIRED_RUNTIME_COMMAND}`);
  }

  return SCREENSHOT_CAPTURE_HOOKS_CONTRACT;
}
