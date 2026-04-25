export interface HandleLongStallPanicInput {
  currentTotalTics: number;
  elapsedTics: number;
  maximumSafeElapsedTics: number;
  runtimeCommand: string;
}

export interface HandleLongStallPanicResult {
  currentTotalTics: number;
  elapsedTics: number;
  panicReason: string | null;
  panicTriggered: boolean;
  phase: 'tryRunTics';
  ticsToRun: number;
}

export const HANDLE_LONG_STALL_PANIC_CONTRACT = Object.freeze({
  auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  deterministicReplayCompatibility: 'panic decisions depend only on discrete tic counts',
  mainLoopPhase: 'tryRunTics',
  panicPolicy: Object.freeze({
    longStallAction: 'panic',
    thresholdSource: 'caller-supplied maximumSafeElapsedTics',
    ticsToRunWhenPanicking: 0,
    units: 'tics',
  }),
  runtimeCommand: 'bun run doom.ts',
  stepId: '05-006',
  stepTitle: 'handle-long-stall-panic',
  timingAuthority: Object.freeze({
    absoluteCountProperty: 'TicAccumulator.totalTics',
    accumulatorMethod: 'TicAccumulator.advance()',
    arithmetic: 'floor((delta * 35) / frequency)',
  }),
});

export function handleLongStallPanic(input: HandleLongStallPanicInput): HandleLongStallPanicResult {
  if (input.runtimeCommand !== HANDLE_LONG_STALL_PANIC_CONTRACT.runtimeCommand) {
    throw new Error('handleLongStallPanic requires runtime command bun run doom.ts');
  }

  if (!Number.isInteger(input.currentTotalTics) || input.currentTotalTics < 0) {
    throw new Error('currentTotalTics must be a non-negative integer');
  }

  if (!Number.isInteger(input.elapsedTics) || input.elapsedTics < 0) {
    throw new Error('elapsedTics must be a non-negative integer');
  }

  if (!Number.isInteger(input.maximumSafeElapsedTics) || input.maximumSafeElapsedTics < 0) {
    throw new Error('maximumSafeElapsedTics must be a non-negative integer');
  }

  const panicTriggered = input.elapsedTics > input.maximumSafeElapsedTics;

  return {
    currentTotalTics: input.currentTotalTics,
    elapsedTics: input.elapsedTics,
    panicReason: panicTriggered ? `long stall exceeded ${input.maximumSafeElapsedTics} tics` : null,
    panicTriggered,
    phase: HANDLE_LONG_STALL_PANIC_CONTRACT.mainLoopPhase,
    ticsToRun: panicTriggered ? HANDLE_LONG_STALL_PANIC_CONTRACT.panicPolicy.ticsToRunWhenPanicking : input.elapsedTics,
  };
}
