import { MAIN_LOOP_PHASE_COUNT, MAIN_LOOP_PHASES } from '../../mainLoop.ts';

import type { MainLoopPhase } from '../../mainLoop.ts';

const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';

export const ADD_TIMING_INSTRUMENTATION_CONTRACT = Object.freeze({
  deterministicReplayCompatibility: 'Observer-only timing instrumentation records phase durations without advancing, resetting, or interpolating tic timing.',
  hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  instrumentationBoundary: 'MainLoop.runOneFrame',
  phaseCount: MAIN_LOOP_PHASE_COUNT,
  phaseMetricFields: Object.freeze(['frameIndex', 'phase', 'phaseDurationNanoseconds', 'phaseEndNanoseconds', 'phaseStartNanoseconds', 'totalTics']),
  phaseOrder: MAIN_LOOP_PHASES,
  playableHostManifestPath: 'plan_fps/manifests/01-006-audit-playable-host-surface.json',
  runtimeCommand: REQUIRED_RUNTIME_COMMAND,
  ticAuthority: 'TicAccumulator.totalTics',
  ticAuthorityPath: 'src/host/ticAccumulator.ts',
  timingPrimitive: 'Bun.nanoseconds',
  timingRule: 'phaseDurationNanoseconds = phaseEndNanoseconds - phaseStartNanoseconds',
});

export interface TimingInstrumentationOptions {
  readonly frameIndex: number;
  readonly phase: MainLoopPhase;
  readonly phaseEndNanoseconds: bigint;
  readonly phaseStartNanoseconds: bigint;
  readonly runtimeCommand: string;
  readonly ticSource: TimingTicSource;
}

export interface TimingInstrumentationSample {
  readonly frameIndex: number;
  readonly phase: MainLoopPhase;
  readonly phaseDurationNanoseconds: bigint;
  readonly phaseEndNanoseconds: bigint;
  readonly phaseStartNanoseconds: bigint;
  readonly totalTics: number;
}

export interface TimingTicSource {
  readonly totalTics: number;
}

export function addTimingInstrumentation(options: TimingInstrumentationOptions): TimingInstrumentationSample {
  if (options.runtimeCommand !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error(`addTimingInstrumentation requires ${REQUIRED_RUNTIME_COMMAND}`);
  }

  if (!MAIN_LOOP_PHASES.includes(options.phase)) {
    throw new Error(`Unknown main loop phase: ${options.phase}`);
  }

  if (options.phaseEndNanoseconds < options.phaseStartNanoseconds) {
    throw new Error('phaseEndNanoseconds must be greater than or equal to phaseStartNanoseconds');
  }

  return Object.freeze({
    frameIndex: options.frameIndex,
    phase: options.phase,
    phaseDurationNanoseconds: options.phaseEndNanoseconds - options.phaseStartNanoseconds,
    phaseEndNanoseconds: options.phaseEndNanoseconds,
    phaseStartNanoseconds: options.phaseStartNanoseconds,
    totalTics: options.ticSource.totalTics,
  });
}
