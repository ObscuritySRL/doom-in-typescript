import { createHash } from 'node:crypto';

import { computeClientDimensions } from '../../host/windowPolicy.ts';

export interface RunMessagePumpOptions {
  readonly queuedMessages: readonly string[];
  readonly runtimeCommand: string;
}

export interface RunMessagePumpResult {
  readonly defaultClientSize: Readonly<{ width: number; height: number }>;
  readonly destroyWindow: boolean;
  readonly deterministicReplayCompatible: true;
  readonly idleSleepMilliseconds: number;
  readonly processedMessages: readonly string[];
  readonly terminalReason: 'continue-running' | 'window-close-requested' | 'window-quit-requested';
  readonly translatedAndDispatchedMessages: readonly string[];
}

const DEFAULT_SCALE = 2;
const IDLE_SLEEP_MILLISECONDS = 1;
const RUNTIME_COMMAND = 'bun run doom.ts';
const WINDOW_CLOSE_MESSAGE = 'WM_CLOSE';
const WINDOW_DESTROY_MESSAGE = 'WM_DESTROY';
const WINDOW_QUIT_MESSAGE = 'WM_QUIT';

const DEFAULT_CLIENT_SIZE = Object.freeze(computeClientDimensions(DEFAULT_SCALE, true));

export const RUN_MESSAGE_PUMP_CONTRACT = Object.freeze({
  auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  defaultClientSize: DEFAULT_CLIENT_SIZE,
  defaultScale: DEFAULT_SCALE,
  deterministicReplayBoundary: 'Process native window messages only and leave tic scheduling and framebuffer presentation timing to later steps.',
  idleSleepMilliseconds: IDLE_SLEEP_MILLISECONDS,
  nativeMessageSource: Object.freeze({
    closeBranch: 'if (message === WM_CLOSE) {',
    destroyBranch: 'if (message === WM_DESTROY || message === WM_QUIT) {',
    dispatchCall: 'void user32.symbols.DispatchMessageW(messageBuffer.ptr);',
    messageLoop: 'while (user32.symbols.PeekMessageW(messageBuffer.ptr, 0n, 0, 0, PM_REMOVE) !== 0) {',
    sleepCall: 'await Bun.sleep(1);',
    translateCall: 'void user32.symbols.TranslateMessage(messageBuffer.ptr);',
  }),
  runtimeCommand: RUNTIME_COMMAND,
  stepId: '04-010',
  stepSlug: 'run-message-pump',
});

export const RUN_MESSAGE_PUMP_CONTRACT_SHA256 = createHash('sha256').update(JSON.stringify(RUN_MESSAGE_PUMP_CONTRACT)).digest('hex');

export function runMessagePump(options: RunMessagePumpOptions): RunMessagePumpResult {
  if (options.runtimeCommand !== RUN_MESSAGE_PUMP_CONTRACT.runtimeCommand) {
    throw new Error(`runMessagePump only supports ${RUN_MESSAGE_PUMP_CONTRACT.runtimeCommand}`);
  }

  const translatedAndDispatchedMessages: string[] = [];
  const processedMessages: string[] = [];

  for (const queuedMessage of options.queuedMessages) {
    processedMessages.push(queuedMessage);

    if (queuedMessage === WINDOW_CLOSE_MESSAGE) {
      return Object.freeze({
        defaultClientSize: DEFAULT_CLIENT_SIZE,
        destroyWindow: true,
        deterministicReplayCompatible: true as const,
        idleSleepMilliseconds: IDLE_SLEEP_MILLISECONDS,
        processedMessages: Object.freeze([...processedMessages]),
        terminalReason: 'window-close-requested' as const,
        translatedAndDispatchedMessages: Object.freeze([...translatedAndDispatchedMessages]),
      });
    }

    if (queuedMessage === WINDOW_DESTROY_MESSAGE || queuedMessage === WINDOW_QUIT_MESSAGE) {
      return Object.freeze({
        defaultClientSize: DEFAULT_CLIENT_SIZE,
        destroyWindow: false,
        deterministicReplayCompatible: true as const,
        idleSleepMilliseconds: IDLE_SLEEP_MILLISECONDS,
        processedMessages: Object.freeze([...processedMessages]),
        terminalReason: 'window-quit-requested' as const,
        translatedAndDispatchedMessages: Object.freeze([...translatedAndDispatchedMessages]),
      });
    }

    translatedAndDispatchedMessages.push(queuedMessage);
  }

  return Object.freeze({
    defaultClientSize: DEFAULT_CLIENT_SIZE,
    destroyWindow: false,
    deterministicReplayCompatible: true as const,
    idleSleepMilliseconds: IDLE_SLEEP_MILLISECONDS,
    processedMessages: Object.freeze([...processedMessages]),
    terminalReason: 'continue-running' as const,
    translatedAndDispatchedMessages: Object.freeze([...translatedAndDispatchedMessages]),
  });
}
