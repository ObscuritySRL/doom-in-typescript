import { TICS_PER_SECOND } from '../../host/ticAccumulator.ts';
import { MAIN_LOOP_PHASE_COUNT, MAIN_LOOP_PHASES } from '../../mainLoop.ts';
import type { MainLoopPhase } from '../../mainLoop.ts';

const AUDITED_PLAYABLE_HOST_TRANSITION = 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
const CURRENT_LAUNCHER_COMMAND = 'bun run src/main.ts';
const PRESENTATION_PHASE = 'display';
const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';

export interface SchedulePresentationInput {
  readonly frameCount: number;
  readonly mainLoopPhase: MainLoopPhase;
  readonly runtimeCommand: string;
  readonly totalTics: number;
}

export interface ScheduledPresentation {
  readonly frameOrdinal: number;
  readonly mainLoopPhase: 'display';
  readonly presentationScheduled: true;
  readonly runtimeCommand: 'bun run doom.ts';
  readonly ticsPerSecond: typeof TICS_PER_SECOND;
  readonly totalTics: number;
}

export const SCHEDULE_PRESENTATION_CONTRACT = Object.freeze({
  accumulationRule: 'floor((delta * 35) / frequency)',
  currentLauncherCommand: CURRENT_LAUNCHER_COMMAND,
  deterministicReplayCompatibility: 'presentation observes TicAccumulator.totalTics and never advances simulation',
  mainLoopPhaseCount: MAIN_LOOP_PHASE_COUNT,
  mainLoopPhases: [...MAIN_LOOP_PHASES],
  playableHostTransition: AUDITED_PLAYABLE_HOST_TRANSITION,
  presentationPhase: PRESENTATION_PHASE,
  requiredRuntimeCommand: REQUIRED_RUNTIME_COMMAND,
  ticAuthority: ['TicAccumulator.advance()', 'TicAccumulator.totalTics'],
  ticsPerSecond: TICS_PER_SECOND,
} as const);

/**
 * Schedule a presentation only on the display phase of the Bun runtime path.
 *
 * @param input - Current frame, main-loop phase, runtime command, and tic snapshot.
 * @returns The presentation plan for the display phase, or `null` when no presentation is due.
 * @example
 * ```ts
 * schedulePresentation({
 *   frameCount: 0,
 *   mainLoopPhase: 'display',
 *   runtimeCommand: 'bun run doom.ts',
 *   totalTics: 1,
 * });
 * ```
 */
export function schedulePresentation(input: SchedulePresentationInput): ScheduledPresentation | null {
  if (input.runtimeCommand !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error(`schedulePresentation requires runtime command ${REQUIRED_RUNTIME_COMMAND}`);
  }

  if (input.mainLoopPhase !== PRESENTATION_PHASE) {
    return null;
  }

  return Object.freeze({
    frameOrdinal: input.frameCount + 1,
    mainLoopPhase: PRESENTATION_PHASE,
    presentationScheduled: true,
    runtimeCommand: REQUIRED_RUNTIME_COMMAND,
    ticsPerSecond: TICS_PER_SECOND,
    totalTics: input.totalTics,
  });
}
