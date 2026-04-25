import { SCREENHEIGHT, SCREENWIDTH } from '../../host/windowPolicy.ts';

const CURRENT_LAUNCHER_COMMAND = 'bun run src/main.ts';
const CURRENT_LAUNCHER_HOST_TRANSITION = 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
const DEFERRED_POLICIES = Object.freeze({
  aspectCorrection: '04-005 define-aspect-correction-policy',
  blit: '04-011 blit-framebuffer-to-window',
  filtering: '04-013 prevent-host-filtering',
  resize: '04-007 define-resize-policy',
  scaling: '04-006 define-integer-nearest-scaling-policy',
});
const DETERMINISTIC_REPLAY_COMPATIBILITY = Object.freeze({
  createsWindowHandle: false,
  mutatesGameState: false,
  readsReplayInput: false,
  requiresDisplayModeSwitch: false,
});
const PRESENTATION_SURFACE = Object.freeze({
  fullscreen: false,
  mode: 'windowed',
  target: 'win32-window-client-area',
});
const RUNTIME_COMMAND = 'bun run doom.ts';
const SOURCE_FRAMEBUFFER = Object.freeze({
  height: SCREENHEIGHT,
  pixelFormat: 'indexed-8-bit',
  width: SCREENWIDTH,
});
const STEP_ID = '04-004';
const STEP_TITLE = 'present-windowed-framebuffer';

export interface PresentWindowedFramebufferOptions {
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly command: string;
  readonly title: string;
}

export interface WindowedFramebufferPresentationPlan {
  readonly clientArea: Readonly<{
    height: number;
    width: number;
  }>;
  readonly currentLauncherCommand: typeof CURRENT_LAUNCHER_COMMAND;
  readonly currentLauncherHostTransition: typeof CURRENT_LAUNCHER_HOST_TRANSITION;
  readonly deferredPolicies: typeof DEFERRED_POLICIES;
  readonly deterministicReplayCompatibility: typeof DETERMINISTIC_REPLAY_COMPATIBILITY;
  readonly presentationSurface: typeof PRESENTATION_SURFACE;
  readonly runtimeCommand: typeof RUNTIME_COMMAND;
  readonly sourceFramebuffer: typeof SOURCE_FRAMEBUFFER;
  readonly stepId: typeof STEP_ID;
  readonly stepTitle: typeof STEP_TITLE;
  readonly title: string;
}

export const PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT = Object.freeze({
  currentLauncherCommand: CURRENT_LAUNCHER_COMMAND,
  currentLauncherHostTransition: CURRENT_LAUNCHER_HOST_TRANSITION,
  deferredPolicies: DEFERRED_POLICIES,
  deterministicReplayCompatibility: DETERMINISTIC_REPLAY_COMPATIBILITY,
  presentationSurface: PRESENTATION_SURFACE,
  runtimeCommand: RUNTIME_COMMAND,
  sourceFramebuffer: SOURCE_FRAMEBUFFER,
  stepId: STEP_ID,
  stepTitle: STEP_TITLE,
} satisfies Omit<WindowedFramebufferPresentationPlan, 'clientArea' | 'title'>);

export function presentWindowedFramebuffer(options: PresentWindowedFramebufferOptions): WindowedFramebufferPresentationPlan {
  if (options.command !== PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.runtimeCommand) {
    throw new Error(`presentWindowedFramebuffer requires \`${PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.runtimeCommand}\`, received \`${options.command}\``);
  }

  if (!Number.isInteger(options.clientWidth) || options.clientWidth <= 0) {
    throw new Error(`presentWindowedFramebuffer requires a positive integer clientWidth, received ${options.clientWidth}`);
  }

  if (!Number.isInteger(options.clientHeight) || options.clientHeight <= 0) {
    throw new Error(`presentWindowedFramebuffer requires a positive integer clientHeight, received ${options.clientHeight}`);
  }

  const normalizedTitle = options.title.trim();

  if (normalizedTitle.length === 0) {
    throw new Error('presentWindowedFramebuffer requires a non-empty window title');
  }

  return Object.freeze({
    clientArea: Object.freeze({
      height: options.clientHeight,
      width: options.clientWidth,
    }),
    currentLauncherCommand: PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.currentLauncherCommand,
    currentLauncherHostTransition: PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.currentLauncherHostTransition,
    deferredPolicies: PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.deferredPolicies,
    deterministicReplayCompatibility: PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.deterministicReplayCompatibility,
    presentationSurface: PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.presentationSurface,
    runtimeCommand: PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.runtimeCommand,
    sourceFramebuffer: PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.sourceFramebuffer,
    stepId: PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.stepId,
    stepTitle: PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.stepTitle,
    title: normalizedTitle,
  });
}
