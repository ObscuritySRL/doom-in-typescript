import { computeClientDimensions } from '../../host/windowPolicy.ts';

export type WindowFocusState = 'background' | 'foreground';

export interface WindowFocusContext {
  readonly foregroundWindowHandle: bigint;
  readonly runtimeCommand: string;
  readonly windowHandle: bigint;
}

export interface WindowFocusPlan {
  readonly allowLiveInput: boolean;
  readonly clearHeldInput: boolean;
  readonly clearPressedOnceState: boolean;
  readonly clientDimensions: Readonly<{ height: number; width: number }>;
  readonly deterministicReplayCompatible: boolean;
  readonly focusState: WindowFocusState;
  readonly keepPresentingFrames: boolean;
  readonly pauseGameLoop: boolean;
  readonly sourceApi: string;
}

export const HANDLE_WINDOW_FOCUS_CONTRACT = Object.freeze({
  auditedHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  currentLauncherCommand: 'bun run src/main.ts',
  defaultClientDimensions: computeClientDimensions(2, true),
  focusDetectionApi: 'GetForegroundWindow',
  focusForegroundExpression: 'const windowIsForeground = foregroundWindowResult === windowHandle;',
  focusInputGuard: 'if (!windowIsForeground) {\n      return false;\n    }',
  focusLossPolicy: Object.freeze({
    allowLiveInput: false,
    clearHeldInput: true,
    clearPressedOnceState: true,
    keepPresentingFrames: true,
    pauseGameLoop: false,
  }),
  focusRestorePolicy: Object.freeze({
    allowLiveInput: true,
    clearHeldInput: false,
    clearPressedOnceState: false,
    keepPresentingFrames: true,
    pauseGameLoop: false,
  }),
  runtimeCommand: 'bun run doom.ts',
  windowTitleTemplate: 'DOOM Codex - ${session.mapName}',
});

export function handleWindowFocus(context: WindowFocusContext): WindowFocusPlan {
  if (context.runtimeCommand !== HANDLE_WINDOW_FOCUS_CONTRACT.runtimeCommand) {
    throw new Error(`handleWindowFocus requires ${HANDLE_WINDOW_FOCUS_CONTRACT.runtimeCommand}`);
  }

  const focusState: WindowFocusState = context.foregroundWindowHandle === context.windowHandle ? 'foreground' : 'background';
  const focusPolicy = focusState === 'foreground' ? HANDLE_WINDOW_FOCUS_CONTRACT.focusRestorePolicy : HANDLE_WINDOW_FOCUS_CONTRACT.focusLossPolicy;

  return Object.freeze({
    allowLiveInput: focusPolicy.allowLiveInput,
    clearHeldInput: focusPolicy.clearHeldInput,
    clearPressedOnceState: focusPolicy.clearPressedOnceState,
    clientDimensions: HANDLE_WINDOW_FOCUS_CONTRACT.defaultClientDimensions,
    deterministicReplayCompatible: true,
    focusState,
    keepPresentingFrames: focusPolicy.keepPresentingFrames,
    pauseGameLoop: focusPolicy.pauseGameLoop,
    sourceApi: HANDLE_WINDOW_FOCUS_CONTRACT.focusDetectionApi,
  });
}
