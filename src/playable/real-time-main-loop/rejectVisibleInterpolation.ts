import { MAIN_LOOP_PHASES } from '../../mainLoop.ts';
import type { MainLoopPhase } from '../../mainLoop.ts';

import { TICS_PER_SECOND } from '../../host/ticAccumulator.ts';

export interface RejectVisibleInterpolationContract {
  readonly auditedLauncherTransition: string;
  readonly deterministicReplayCompatibility: string;
  readonly interpolationPolicy: {
    readonly interpolationAlpha: 0;
    readonly presentationMode: 'discrete-tic-only';
    readonly simulationAdvancedByPresentation: false;
    readonly visibleInterpolationAllowed: false;
  };
  readonly mainLoopPhase: MainLoopPhase;
  readonly runtimeCommand: 'bun run doom.ts';
  readonly stepId: '05-009';
  readonly stepTitle: 'reject-visible-interpolation';
  readonly timingAuthority: {
    readonly absoluteTimingSource: 'TicAccumulator';
    readonly newTicsAccessor: 'advance()';
    readonly ticsPerSecond: number;
    readonly totalTicsAccessor: 'totalTics';
  };
}

export interface RejectVisibleInterpolationOptions {
  readonly mainLoopPhase: MainLoopPhase;
  readonly runtimeCommand: string;
  readonly totalTics: number;
}

export interface RejectVisibleInterpolationResult {
  readonly interpolationAlpha: 0;
  readonly mainLoopPhase: MainLoopPhase;
  readonly presentationMode: 'discrete-tic-only' | 'phase-ignored';
  readonly presentedTotalTics: number;
  readonly simulationAdvancedByPresentation: false;
  readonly visibleInterpolationRejected: boolean;
}

export const REJECT_VISIBLE_INTERPOLATION_CONTRACT = Object.freeze({
  auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  deterministicReplayCompatibility: 'Presentation samples only discrete TicAccumulator state, so display never invents blended frames between game tics.',
  interpolationPolicy: {
    interpolationAlpha: 0 as const,
    presentationMode: 'discrete-tic-only' as const,
    simulationAdvancedByPresentation: false as const,
    visibleInterpolationAllowed: false as const,
  },
  mainLoopPhase: MAIN_LOOP_PHASES[MAIN_LOOP_PHASES.length - 1],
  runtimeCommand: 'bun run doom.ts' as const,
  stepId: '05-009' as const,
  stepTitle: 'reject-visible-interpolation' as const,
  timingAuthority: {
    absoluteTimingSource: 'TicAccumulator' as const,
    newTicsAccessor: 'advance()' as const,
    ticsPerSecond: TICS_PER_SECOND,
    totalTicsAccessor: 'totalTics' as const,
  },
}) satisfies RejectVisibleInterpolationContract;

export function rejectVisibleInterpolation(options: RejectVisibleInterpolationOptions): RejectVisibleInterpolationResult {
  if (options.runtimeCommand !== REJECT_VISIBLE_INTERPOLATION_CONTRACT.runtimeCommand) {
    throw new Error('rejectVisibleInterpolation requires runtime command bun run doom.ts');
  }

  if (!Number.isInteger(options.totalTics) || options.totalTics < 0) {
    throw new Error('rejectVisibleInterpolation requires a non-negative integer totalTics value');
  }

  if (options.mainLoopPhase !== REJECT_VISIBLE_INTERPOLATION_CONTRACT.mainLoopPhase) {
    return {
      interpolationAlpha: 0,
      mainLoopPhase: options.mainLoopPhase,
      presentationMode: 'phase-ignored',
      presentedTotalTics: options.totalTics,
      simulationAdvancedByPresentation: false,
      visibleInterpolationRejected: false,
    };
  }

  return {
    interpolationAlpha: REJECT_VISIBLE_INTERPOLATION_CONTRACT.interpolationPolicy.interpolationAlpha,
    mainLoopPhase: options.mainLoopPhase,
    presentationMode: REJECT_VISIBLE_INTERPOLATION_CONTRACT.interpolationPolicy.presentationMode,
    presentedTotalTics: options.totalTics,
    simulationAdvancedByPresentation: REJECT_VISIBLE_INTERPOLATION_CONTRACT.interpolationPolicy.simulationAdvancedByPresentation,
    visibleInterpolationRejected: !REJECT_VISIBLE_INTERPOLATION_CONTRACT.interpolationPolicy.visibleInterpolationAllowed,
  };
}
