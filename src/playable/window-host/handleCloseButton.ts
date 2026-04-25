import { computeClientDimensions } from '../../host/windowPolicy.ts';

const DEFAULT_CLIENT_SIZE = computeClientDimensions(2, true);
const RUNTIME_COMMAND = 'bun run doom.ts';
const WM_CLOSE = 0x0010;

export const HANDLE_CLOSE_BUTTON_CONTRACT = Object.freeze({
  auditedCurrentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  defaultClientSize: DEFAULT_CLIENT_SIZE,
  deterministicReplayCompatibility: 'native close-button handling only; gameplay replay state remains untouched',
  laterStep: '04-010 run-message-pump',
  liveCloseButtonHandling: Object.freeze({
    branchSource: `if (message === WM_CLOSE) {
          void user32.symbols.DestroyWindow(windowHandle);
          windowDestroyed = true;
          return;
        }`,
    destroyFunctionCall: 'void user32.symbols.DestroyWindow(windowHandle);',
    returnBehavior: 'mark-window-destroyed-and-return',
  }),
  runtimeCommand: RUNTIME_COMMAND,
  stepId: '04-009',
  stepTitle: 'handle-close-button',
  windowMessages: Object.freeze({
    close: Object.freeze({
      name: 'WM_CLOSE',
      value: WM_CLOSE,
      valueHex: '0x0010',
    }),
  }),
} as const);

export type HandleCloseButtonAction = 'continue-message-pump' | 'destroy-window-and-return';

export interface HandleCloseButtonOptions {
  readonly runtimeCommand: string;
  readonly windowMessage: number;
}

export interface HandleCloseButtonPlan {
  readonly action: HandleCloseButtonAction;
  readonly auditedCurrentLauncherHostTransition: typeof HANDLE_CLOSE_BUTTON_CONTRACT.auditedCurrentLauncherHostTransition;
  readonly defaultClientSize: typeof HANDLE_CLOSE_BUTTON_CONTRACT.defaultClientSize;
  readonly destroyWindow: boolean;
  readonly deterministicReplayCompatible: true;
  readonly handled: boolean;
  readonly returnFromLoop: boolean;
  readonly windowDestroyed: boolean;
  readonly windowMessage: number;
}

export function handleCloseButton(options: HandleCloseButtonOptions): HandleCloseButtonPlan {
  if (options.runtimeCommand !== HANDLE_CLOSE_BUTTON_CONTRACT.runtimeCommand) {
    throw new Error(`handleCloseButton only supports ${HANDLE_CLOSE_BUTTON_CONTRACT.runtimeCommand}`);
  }

  const handled = options.windowMessage === HANDLE_CLOSE_BUTTON_CONTRACT.windowMessages.close.value;

  return Object.freeze({
    action: handled ? 'destroy-window-and-return' : 'continue-message-pump',
    auditedCurrentLauncherHostTransition: HANDLE_CLOSE_BUTTON_CONTRACT.auditedCurrentLauncherHostTransition,
    defaultClientSize: HANDLE_CLOSE_BUTTON_CONTRACT.defaultClientSize,
    destroyWindow: handled,
    deterministicReplayCompatible: true,
    handled,
    returnFromLoop: handled,
    windowDestroyed: handled,
    windowMessage: options.windowMessage,
  });
}
