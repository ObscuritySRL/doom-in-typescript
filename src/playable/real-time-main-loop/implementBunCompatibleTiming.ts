import { MAIN_LOOP_PHASES } from '../../mainLoop.ts';
import { TICS_PER_SECOND } from '../../host/ticAccumulator.ts';

const NANOSECONDS_PER_SECOND = 1_000_000_000;
const NANOSECONDS_PER_TIC = Math.floor(NANOSECONDS_PER_SECOND / TICS_PER_SECOND);

export interface BunCompatibleTimingContract {
  readonly deterministicReplayCompatibility: 'Bun host timing is advisory only; TicAccumulator remains the absolute 35 Hz authority.';
  readonly hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
  readonly mainLoopPhaseOrder: typeof MAIN_LOOP_PHASES;
  readonly runtimeCommand: 'bun run doom.ts';
  readonly ticArithmetic: 'floor((delta * 35) / frequency)';
  readonly ticAuthority: 'TicAccumulator';
  readonly ticRate: typeof TICS_PER_SECOND;
  readonly ticTimingPhase: 'tryRunTics';
  readonly timingApi: 'Bun.nanoseconds';
  readonly waitApi: 'Bun.sleep';
}

export interface BunCompatibleTimingPlan {
  readonly baselineNanoseconds: number;
  readonly deterministicReplayCompatible: true;
  readonly hostTransition: BunCompatibleTimingContract['hostTransition'];
  readonly mainLoopPhaseOrder: typeof MAIN_LOOP_PHASES;
  readonly nanosecondsPerTic: number;
  readonly nextTicDeadlineNanoseconds: number;
  readonly runtimeCommand: BunCompatibleTimingContract['runtimeCommand'];
  readonly ticArithmetic: BunCompatibleTimingContract['ticArithmetic'];
  readonly ticAuthority: BunCompatibleTimingContract['ticAuthority'];
  readonly ticRate: typeof TICS_PER_SECOND;
  readonly ticTimingPhase: BunCompatibleTimingContract['ticTimingPhase'];
  readonly timingApi: BunCompatibleTimingContract['timingApi'];
  readonly waitApi: BunCompatibleTimingContract['waitApi'];
}

export const BUN_COMPATIBLE_TIMING_CONTRACT = Object.freeze({
  deterministicReplayCompatibility: 'Bun host timing is advisory only; TicAccumulator remains the absolute 35 Hz authority.',
  hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  mainLoopPhaseOrder: MAIN_LOOP_PHASES,
  runtimeCommand: 'bun run doom.ts',
  ticArithmetic: 'floor((delta * 35) / frequency)',
  ticAuthority: 'TicAccumulator',
  ticRate: TICS_PER_SECOND,
  ticTimingPhase: 'tryRunTics',
  timingApi: 'Bun.nanoseconds',
  waitApi: 'Bun.sleep',
} satisfies BunCompatibleTimingContract);

export function implementBunCompatibleTiming(runtimeCommand: string, sampleNanoseconds: () => number = Bun.nanoseconds): BunCompatibleTimingPlan {
  if (runtimeCommand !== BUN_COMPATIBLE_TIMING_CONTRACT.runtimeCommand) {
    throw new Error(`implementBunCompatibleTiming requires ${BUN_COMPATIBLE_TIMING_CONTRACT.runtimeCommand}`);
  }

  const baselineNanoseconds = Math.trunc(sampleNanoseconds());

  return {
    baselineNanoseconds,
    deterministicReplayCompatible: true,
    hostTransition: BUN_COMPATIBLE_TIMING_CONTRACT.hostTransition,
    mainLoopPhaseOrder: BUN_COMPATIBLE_TIMING_CONTRACT.mainLoopPhaseOrder,
    nanosecondsPerTic: NANOSECONDS_PER_TIC,
    nextTicDeadlineNanoseconds: baselineNanoseconds + NANOSECONDS_PER_TIC,
    runtimeCommand: BUN_COMPATIBLE_TIMING_CONTRACT.runtimeCommand,
    ticArithmetic: BUN_COMPATIBLE_TIMING_CONTRACT.ticArithmetic,
    ticAuthority: BUN_COMPATIBLE_TIMING_CONTRACT.ticAuthority,
    ticRate: BUN_COMPATIBLE_TIMING_CONTRACT.ticRate,
    ticTimingPhase: BUN_COMPATIBLE_TIMING_CONTRACT.ticTimingPhase,
    timingApi: BUN_COMPATIBLE_TIMING_CONTRACT.timingApi,
    waitApi: BUN_COMPATIBLE_TIMING_CONTRACT.waitApi,
  };
}
