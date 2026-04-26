import { computeClientDimensions } from '../../host/windowPolicy.ts';

const CURRENT_LAUNCHER_COMMAND = 'bun run src/main.ts';
const CURRENT_WINDOW_CALL = 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
const CURRENT_WINDOW_SOURCE_PATH = 'src/launcher/win32.ts';
const DEFAULT_SCALE = 2;
const TARGET_RUNTIME_COMMAND = 'bun run doom.ts';
const WINDOW_POLICY_SOURCE_PATH = 'src/host/windowPolicy.ts';
const WINDOW_TITLE_PREFIX = 'DOOM Codex - ';
const WINDOW_TITLE_TEMPLATE = 'DOOM Codex - ${session.mapName}';

const defaultClientSize = Object.freeze(computeClientDimensions(DEFAULT_SCALE, true));

export const WINDOW_TITLE_POLICY_CONTRACT = Object.freeze({
  currentLauncherCommand: CURRENT_LAUNCHER_COMMAND,
  currentLauncherTransition: Object.freeze({
    defaultAspectRatioCorrect: true,
    defaultClientSize,
    defaultScale: DEFAULT_SCALE,
    sourceCall: CURRENT_WINDOW_CALL,
    sourcePath: CURRENT_WINDOW_SOURCE_PATH,
    titleTemplate: WINDOW_TITLE_TEMPLATE,
  }),
  deterministicReplayCompatibility: Object.freeze({
    consumesReplayInput: false,
    createsNativeWindow: false,
    mutatesGameState: false,
    mutatesRandomSeed: false,
  }),
  stepId: '04-002',
  stepTitle: 'set-window-title-policy',
  targetRuntimeCommand: TARGET_RUNTIME_COMMAND,
  titlePolicy: Object.freeze({
    mapNameSource: 'gameContext.mapName',
    prefix: WINDOW_TITLE_PREFIX,
    rejectsBlankMapName: true,
    windowPolicySourcePath: WINDOW_POLICY_SOURCE_PATH,
  }),
} as const);

export interface WindowTitlePolicyOptions {
  readonly command: string;
  readonly mapName: string;
}

export interface WindowTitlePolicyResult {
  readonly title: string;
  readonly titleTemplate: typeof WINDOW_TITLE_TEMPLATE;
}

export function setWindowTitlePolicy(options: WindowTitlePolicyOptions): WindowTitlePolicyResult {
  if (options.command !== TARGET_RUNTIME_COMMAND) {
    throw new Error(`Window title policy requires ${TARGET_RUNTIME_COMMAND}`);
  }

  if (options.mapName.trim().length === 0) {
    throw new Error('Window title policy requires a non-empty map name');
  }

  return Object.freeze({
    title: `${WINDOW_TITLE_PREFIX}${options.mapName}`,
    titleTemplate: WINDOW_TITLE_TEMPLATE,
  });
}
