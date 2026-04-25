export interface DeterministicReplayModeContract {
  readonly currentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
  readonly mainLoopPhase: 'tryRunTics';
  readonly presentationTimingMode: 'presentation-independent';
  readonly replayCompatibility: 'deterministic';
  readonly runtimeCommand: 'bun run doom.ts';
  readonly ticAccumulatorAdvanceCall: 'TicAccumulator.advance()';
  readonly ticAccumulatorRule: 'floor((delta * 35) / frequency)';
  readonly ticAccumulatorTotalTicsProperty: 'TicAccumulator.totalTics';
}

export const IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT = Object.freeze({
  currentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  mainLoopPhase: 'tryRunTics',
  presentationTimingMode: 'presentation-independent',
  replayCompatibility: 'deterministic',
  runtimeCommand: 'bun run doom.ts',
  ticAccumulatorAdvanceCall: 'TicAccumulator.advance()',
  ticAccumulatorRule: 'floor((delta * 35) / frequency)',
  ticAccumulatorTotalTicsProperty: 'TicAccumulator.totalTics',
} satisfies DeterministicReplayModeContract);

export interface DeterministicReplayModePlan extends DeterministicReplayModeContract {
  readonly enabled: true;
}

export function implementDeterministicReplayMode(runtimeCommand: string): DeterministicReplayModePlan {
  if (runtimeCommand !== IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT.runtimeCommand) {
    throw new Error(`implementDeterministicReplayMode requires \`${IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT.runtimeCommand}\`, got \`${runtimeCommand}\``);
  }

  return Object.freeze({
    ...IMPLEMENT_DETERMINISTIC_REPLAY_MODE_CONTRACT,
    enabled: true,
  });
}
