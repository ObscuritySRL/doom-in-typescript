import { ASPECT_CORRECTED_HEIGHT, SCREENHEIGHT, SCREENWIDTH, computeClientDimensions, computeScaleMultiplier } from '../../host/windowPolicy.ts';

const AUDITED_CURRENT_LAUNCHER_COMMAND = 'bun run src/main.ts';
const AUDITED_LAUNCHER_TRANSITION = 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
const DEFAULT_SCALE = 2;
const FILTER = 'nearest';
const MINIMUM_SCALE = 1;
const PRESENTATION_MODE = 'centered-integer-scale';
const RUNTIME_COMMAND = 'bun run doom.ts';
const SCALE_MODE = 'integer-only';
const STEP_ID = '04-006';
const STEP_TITLE = 'define-integer-nearest-scaling-policy';
const WINDOW_HOST_PRESENTATION_HELPER = 'computePresentationRect(clientWidth, clientHeight, true)';
const WINDOW_HOST_PRESENTATION_SYMBOL = 'StretchDIBits';

const defaultClientDimensions = computeClientDimensions(DEFAULT_SCALE, true);

export const DEFINE_INTEGER_NEAREST_SCALING_POLICY_CONTRACT = Object.freeze({
  auditedCurrentLauncherCommand: AUDITED_CURRENT_LAUNCHER_COMMAND,
  auditedLauncherTransition: AUDITED_LAUNCHER_TRANSITION,
  defaultClientDimensions: Object.freeze({
    height: defaultClientDimensions.height,
    width: defaultClientDimensions.width,
  }),
  defaultScale: DEFAULT_SCALE,
  deterministicReplayCompatibility: Object.freeze({
    consumesReplayInput: false,
    createsWindowHost: false,
    mutatesFramebuffer: false,
    mutatesGameState: false,
  }),
  displayDimensions: Object.freeze({
    height: ASPECT_CORRECTED_HEIGHT,
    width: SCREENWIDTH,
  }),
  filter: FILTER,
  framebufferDimensions: Object.freeze({
    height: SCREENHEIGHT,
    width: SCREENWIDTH,
  }),
  hostEvidence: Object.freeze({
    presentationHelper: WINDOW_HOST_PRESENTATION_HELPER,
    presentationSymbol: WINDOW_HOST_PRESENTATION_SYMBOL,
  }),
  minimumScale: MINIMUM_SCALE,
  presentationMode: PRESENTATION_MODE,
  runtimeCommand: RUNTIME_COMMAND,
  scaleMode: SCALE_MODE,
  stepId: STEP_ID,
  stepTitle: STEP_TITLE,
});

export interface DefineIntegerNearestScalingPolicyOptions {
  readonly aspectRatioCorrect: boolean;
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly command: string;
}

export interface IntegerNearestScalingPolicy {
  readonly aspectRatioCorrect: boolean;
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly filter: 'nearest';
  readonly fitsWithinClient: boolean;
  readonly presentationMode: 'centered-integer-scale';
  readonly scaleMode: 'integer-only';
  readonly scaleMultiplier: number;
  readonly scaledHeight: number;
  readonly scaledWidth: number;
}

export function defineIntegerNearestScalingPolicy(options: DefineIntegerNearestScalingPolicyOptions): IntegerNearestScalingPolicy {
  validateCommand(options.command);
  validateDimension('clientWidth', options.clientWidth);
  validateDimension('clientHeight', options.clientHeight);

  const scaleMultiplier = computeScaleMultiplier(options.clientWidth, options.clientHeight, options.aspectRatioCorrect);
  const scaledClientDimensions = computeClientDimensions(scaleMultiplier, options.aspectRatioCorrect);

  return Object.freeze({
    aspectRatioCorrect: options.aspectRatioCorrect,
    clientHeight: options.clientHeight,
    clientWidth: options.clientWidth,
    filter: FILTER,
    fitsWithinClient: scaledClientDimensions.width <= options.clientWidth && scaledClientDimensions.height <= options.clientHeight,
    presentationMode: PRESENTATION_MODE,
    scaleMode: SCALE_MODE,
    scaleMultiplier,
    scaledHeight: scaledClientDimensions.height,
    scaledWidth: scaledClientDimensions.width,
  });
}

function validateCommand(command: string): void {
  if (command !== RUNTIME_COMMAND) {
    throw new Error(`defineIntegerNearestScalingPolicy requires ${RUNTIME_COMMAND}; received ${command}`);
  }
}

function validateDimension(name: 'clientHeight' | 'clientWidth', value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`defineIntegerNearestScalingPolicy requires a positive integer ${name}`);
  }
}
