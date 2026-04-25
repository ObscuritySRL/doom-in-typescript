import { ASPECT_CORRECTED_HEIGHT, ASPECT_STRETCH_RATIO, computeClientDimensions, computePresentationRect, DISPLAY_ASPECT_RATIO, SCREENHEIGHT, SCREENWIDTH } from '../../host/windowPolicy.ts';

const CURRENT_LAUNCHER_COMMAND = 'bun run src/main.ts';
const CURRENT_LAUNCHER_HOST_TRANSITION = 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
const DEFAULT_SCALE = 2;
const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';

const DEFAULT_CLIENT_DIMENSIONS = computeClientDimensions(DEFAULT_SCALE, true);
const DEFAULT_PRESENTATION_RECT = computePresentationRect(DEFAULT_CLIENT_DIMENSIONS.width, DEFAULT_CLIENT_DIMENSIONS.height, true);

export const DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT = Object.freeze({
  correctedDisplay: Object.freeze({
    aspectRatio: DISPLAY_ASPECT_RATIO,
    height: ASPECT_CORRECTED_HEIGHT,
    stretchRatio: ASPECT_STRETCH_RATIO,
    width: SCREENWIDTH,
  }),
  deterministicReplayCompatibility: Object.freeze({
    createsWindow: false,
    mutatesFramebuffer: false,
    mutatesGameState: false,
    mutatesRandomSeed: false,
    readsInputEvents: false,
  }),
  presentation: Object.freeze({
    backgroundFill: 'black',
    defaultClientHeightAtScaleTwo: DEFAULT_CLIENT_DIMENSIONS.height,
    defaultClientWidthAtScaleTwo: DEFAULT_CLIENT_DIMENSIONS.width,
    defaultPresentationRectAtScaleTwo: DEFAULT_PRESENTATION_RECT,
    defaultScale: DEFAULT_SCALE,
    maintainCorrectedAspectRatio: true,
    preserveIntegerSourceFramebuffer: true,
  }),
  runtime: Object.freeze({
    currentLauncherCommand: CURRENT_LAUNCHER_COMMAND,
    currentLauncherHostTransition: CURRENT_LAUNCHER_HOST_TRANSITION,
    requiredRuntimeCommand: REQUIRED_RUNTIME_COMMAND,
  }),
  sourceFramebuffer: Object.freeze({
    height: SCREENHEIGHT,
    width: SCREENWIDTH,
  }),
  stepId: '04-005',
  stepTitle: 'define-aspect-correction-policy',
} as const);

export type DefineAspectCorrectionPolicyContract = typeof DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT;

export function defineAspectCorrectionPolicy(runtimeCommand: string): DefineAspectCorrectionPolicyContract {
  if (runtimeCommand !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error(`Aspect correction policy requires ${REQUIRED_RUNTIME_COMMAND}`);
  }

  return DEFINE_ASPECT_CORRECTION_POLICY_CONTRACT;
}
