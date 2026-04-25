import type { TicAccumulator } from '../../host/ticAccumulator.ts';
import type { MainLoopPhase } from '../../mainLoop.ts';

export const HANDLE_PAUSE_FOCUS_TIMING_CONTRACT = Object.freeze({
  deterministicReplayGuard: 'Reset the tic accumulator baseline on focus regain and never convert unfocused wall time into runnable tics.',
  focusLossPolicy: 'pause tryRunTics timing immediately when the window is not focused',
  focusRegainPolicy: 'reset the tic accumulator baseline before simulation resumes',
  hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  mainLoopPhase: 'tryRunTics',
  runtimeCommand: 'bun run doom.ts',
  ticTimingAuthority: 'TicAccumulator.reset() and TicAccumulator.totalTics',
} as const);

export type PauseFocusTimingAction = 'continue' | 'pause' | 'resume' | 'skip';

export interface PauseFocusTimingDecision {
  readonly action: PauseFocusTimingAction;
  readonly paused: boolean;
  readonly resetApplied: boolean;
  readonly runnableTics: number;
  readonly totalTics: number;
}

export function handlePauseFocusTiming(runtimeCommand: string, phase: MainLoopPhase, wasFocused: boolean, isFocused: boolean, ticAccumulator: Pick<TicAccumulator, 'reset' | 'totalTics'>): PauseFocusTimingDecision {
  if (runtimeCommand !== HANDLE_PAUSE_FOCUS_TIMING_CONTRACT.runtimeCommand) {
    throw new Error(`handlePauseFocusTiming requires ${HANDLE_PAUSE_FOCUS_TIMING_CONTRACT.runtimeCommand}`);
  }

  if (phase !== HANDLE_PAUSE_FOCUS_TIMING_CONTRACT.mainLoopPhase) {
    return {
      action: 'skip',
      paused: !isFocused,
      resetApplied: false,
      runnableTics: 0,
      totalTics: ticAccumulator.totalTics,
    };
  }

  if (!isFocused) {
    return {
      action: 'pause',
      paused: true,
      resetApplied: false,
      runnableTics: 0,
      totalTics: ticAccumulator.totalTics,
    };
  }

  if (!wasFocused) {
    ticAccumulator.reset();

    return {
      action: 'resume',
      paused: false,
      resetApplied: true,
      runnableTics: 0,
      totalTics: ticAccumulator.totalTics,
    };
  }

  return {
    action: 'continue',
    paused: false,
    resetApplied: false,
    runnableTics: 0,
    totalTics: ticAccumulator.totalTics,
  };
}
