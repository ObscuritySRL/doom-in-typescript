import { TICS_PER_SECOND, TicAccumulator } from '../../host/ticAccumulator.ts';

const IMPLEMENT_TIC_ACCUMULATION_COMMAND = 'bun run doom.ts';
const TIC_ACCUMULATION_ERROR_MESSAGE = 'implementTicAccumulation requires bun run doom.ts';

/**
 * Exact tic-accumulation contract for the Bun-run playable parity path.
 *
 * @example
 * ```ts
 * import { TicAccumulator } from "../../../src/host/ticAccumulator.ts";
 * import { implementTicAccumulation } from "../../../src/playable/real-time-main-loop/implementTicAccumulation.ts";
 *
 * const accumulator = new TicAccumulator({ frequency: 350n, now: () => 0n });
 * const snapshot = implementTicAccumulation('bun run doom.ts', accumulator);
 * console.log(snapshot.newTics);
 * ```
 */
export const IMPLEMENT_TIC_ACCUMULATION_CONTRACT = Object.freeze({
  accumulationFormula: 'floor((delta * 35) / frequency)',
  accumulationMethod: 'TicAccumulator.advance()',
  deterministicReplayCompatibility: 'Discrete tics come from integer-only absolute clock deltas, so gameplay remains tic-driven instead of presentation-driven.',
  launcherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  mainLoopPhase: 'tryRunTics',
  runtimeCommand: IMPLEMENT_TIC_ACCUMULATION_COMMAND,
  stepId: '05-003',
  stepTitle: 'implement-tic-accumulation',
  ticRateHz: TICS_PER_SECOND,
  totalTicsProperty: 'totalTics',
} as const);

export type ImplementTicAccumulationResult = Readonly<
  typeof IMPLEMENT_TIC_ACCUMULATION_CONTRACT & {
    newTics: number;
    totalTics: number;
  }
>;

/**
 * Sample the current tic accumulator and surface the exact Bun-only tic plan.
 *
 * @param runtimeCommand The active launcher command; must remain `bun run doom.ts`.
 * @param ticAccumulator The absolute-baseline 35 Hz accumulator that drives gameplay tics.
 * @returns The exact tic-accumulation contract plus the sampled tic counts.
 *
 * @example
 * ```ts
 * import { TicAccumulator } from "../../../src/host/ticAccumulator.ts";
 * import { implementTicAccumulation } from "../../../src/playable/real-time-main-loop/implementTicAccumulation.ts";
 *
 * let counter = 0n;
 * const accumulator = new TicAccumulator({ frequency: 350n, now: () => counter });
 * counter = 40n;
 * const snapshot = implementTicAccumulation('bun run doom.ts', accumulator);
 * console.log(snapshot.totalTics);
 * ```
 */
export function implementTicAccumulation(runtimeCommand: string, ticAccumulator: TicAccumulator): ImplementTicAccumulationResult {
  if (runtimeCommand !== IMPLEMENT_TIC_ACCUMULATION_COMMAND) {
    throw new Error(TIC_ACCUMULATION_ERROR_MESSAGE);
  }

  const newTics = ticAccumulator.advance();

  return Object.freeze({
    ...IMPLEMENT_TIC_ACCUMULATION_CONTRACT,
    newTics,
    totalTics: ticAccumulator.totalTics,
  });
}
