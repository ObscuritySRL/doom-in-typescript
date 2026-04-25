import { MAIN_LOOP_PHASES, type MainLoopPhase } from '../../mainLoop.ts';
import { TICS_PER_SECOND } from '../../host/ticAccumulator.ts';

const TRY_RUN_TICS_PHASE = MAIN_LOOP_PHASES[1];

export const PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT = Object.freeze({
  accumulationAuthority: Object.freeze({
    accumulatorMethod: 'advance',
    accumulatorProperty: 'totalTics',
    accumulationRule: 'integer-only floor((delta * 35) / frequency)',
    fixedTicRate: TICS_PER_SECOND,
    source: 'src/host/ticAccumulator.ts',
  }),
  auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  deterministicReplayCompatible: true,
  frameRateIndependent: true,
  ignoredInput: 'presentedFramesSinceLastSimulation',
  mainLoopPhase: TRY_RUN_TICS_PHASE,
  manifestPath: 'plan_fps/manifests/01-006-audit-playable-host-surface.json',
  runtimeCommand: 'bun run doom.ts',
  simulationRule: 'advance-simulation-by-runnable-tics-only',
});

export interface PreventFrameRateDependentSimulationOptions {
  readonly mainLoopPhase: MainLoopPhase;
  readonly presentedFramesSinceLastSimulation: number;
  readonly runnableTics: number;
  readonly runtimeCommand: string;
  readonly totalTics: number;
}

export interface PreventFrameRateDependentSimulationResult {
  readonly deterministicReplayCompatible: boolean;
  readonly frameRateIndependent: boolean;
  readonly mainLoopPhase: MainLoopPhase;
  readonly simulationTics: number;
  readonly totalTics: number;
}

export function preventFrameRateDependentSimulation(options: PreventFrameRateDependentSimulationOptions): PreventFrameRateDependentSimulationResult {
  if (options.runtimeCommand !== PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT.runtimeCommand) {
    throw new Error('preventFrameRateDependentSimulation requires bun run doom.ts');
  }

  void options.presentedFramesSinceLastSimulation;

  if (options.mainLoopPhase !== PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT.mainLoopPhase) {
    return {
      deterministicReplayCompatible: PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT.deterministicReplayCompatible,
      frameRateIndependent: PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT.frameRateIndependent,
      mainLoopPhase: options.mainLoopPhase,
      simulationTics: 0,
      totalTics: options.totalTics,
    };
  }

  return {
    deterministicReplayCompatible: PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT.deterministicReplayCompatible,
    frameRateIndependent: PREVENT_FRAME_RATE_DEPENDENT_SIMULATION_CONTRACT.frameRateIndependent,
    mainLoopPhase: options.mainLoopPhase,
    simulationTics: options.runnableTics,
    totalTics: options.totalTics,
  };
}
