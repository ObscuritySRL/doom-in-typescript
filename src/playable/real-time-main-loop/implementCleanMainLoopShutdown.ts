const CLEAN_MAIN_LOOP_SHUTDOWN_RUNTIME_COMMAND = 'bun run doom.ts';
const CLEAN_MAIN_LOOP_PHASE_ORDER = Object.freeze(['startFrame', 'tryRunTics', 'updateSounds', 'display'] as const);
const CLEAN_MAIN_LOOP_SHUTDOWN_PHASE = CLEAN_MAIN_LOOP_PHASE_ORDER[3];
const CLEAN_MAIN_LOOP_SHUTDOWN_TRANSITION = 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';

export interface ImplementCleanMainLoopShutdownContract {
  readonly deterministicReplayCompatibility: 'Stop only after a completed frame without advancing, resetting, or inventing tic timing during shutdown.';
  readonly phaseOrder: readonly ['startFrame', 'tryRunTics', 'updateSounds', 'display'];
  readonly replaySafeTicAuthority: 'TicAccumulator.totalTics';
  readonly runOneFrameCompletionBoundary: 'callbacks.display();\n    this.#frameCount++;';
  readonly runtimeCommand: 'bun run doom.ts';
  readonly shutdownBoundaryPhase: 'display';
  readonly shutdownTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
  readonly ticMutationPolicy: 'Shutdown does not call TicAccumulator.advance() or TicAccumulator.reset().';
}

export const IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT: ImplementCleanMainLoopShutdownContract = Object.freeze({
  deterministicReplayCompatibility: 'Stop only after a completed frame without advancing, resetting, or inventing tic timing during shutdown.',
  phaseOrder: CLEAN_MAIN_LOOP_PHASE_ORDER,
  replaySafeTicAuthority: 'TicAccumulator.totalTics',
  runOneFrameCompletionBoundary: 'callbacks.display();\n    this.#frameCount++;',
  runtimeCommand: CLEAN_MAIN_LOOP_SHUTDOWN_RUNTIME_COMMAND,
  shutdownBoundaryPhase: CLEAN_MAIN_LOOP_SHUTDOWN_PHASE,
  shutdownTransition: CLEAN_MAIN_LOOP_SHUTDOWN_TRANSITION,
  ticMutationPolicy: 'Shutdown does not call TicAccumulator.advance() or TicAccumulator.reset().',
});

/**
 * Return the clean main-loop shutdown contract for the Bun playable path.
 *
 * @param runtimeCommand Exact runtime command used to launch the playable path.
 * @returns The frozen clean-shutdown contract.
 * @example
 * ```ts
 * import { implementCleanMainLoopShutdown } from "./src/playable/real-time-main-loop/implementCleanMainLoopShutdown.ts";
 *
 * const contract = implementCleanMainLoopShutdown('bun run doom.ts');
 * console.log(contract.shutdownBoundaryPhase);
 * ```
 */
export function implementCleanMainLoopShutdown(runtimeCommand: string): ImplementCleanMainLoopShutdownContract {
  if (runtimeCommand !== CLEAN_MAIN_LOOP_SHUTDOWN_RUNTIME_COMMAND) {
    throw new Error(`implementCleanMainLoopShutdown requires ${CLEAN_MAIN_LOOP_SHUTDOWN_RUNTIME_COMMAND}`);
  }

  return IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT;
}
