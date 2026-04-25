import { TICS_PER_SECOND } from '../../host/ticAccumulator.ts';
import { MAIN_LOOP_PHASES } from '../../mainLoop.ts';

const EXPECTED_RUNTIME_COMMAND = 'bun run doom.ts';
const HOST_TRANSITION_CALL = 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })';
const TIC_FORMULA = 'floor((delta * 35) / frequency)';

export const SCHEDULE_35HZ_GAME_TICS_CONTRACT = Object.freeze({
  accumulator: Object.freeze({
    advanceMethod: 'advance',
    className: 'TicAccumulator',
    totalTicsField: 'totalTics',
  }),
  deterministicReplayCompatible: true,
  hostTransitionCall: HOST_TRANSITION_CALL,
  mainLoop: Object.freeze({
    phaseCount: MAIN_LOOP_PHASES.length,
    phaseOrder: MAIN_LOOP_PHASES,
    scheduledPhase: 'tryRunTics',
  }),
  runtimeCommand: EXPECTED_RUNTIME_COMMAND,
  stepId: '05-001',
  stepTitle: 'schedule-35hz-game-tics',
  timing: Object.freeze({
    clockCounterType: 'bigint',
    clockFrequencyType: 'bigint',
    formula: TIC_FORMULA,
    ticRateHz: TICS_PER_SECOND,
  }),
});

export type Schedule35hzGameTicsContract = typeof SCHEDULE_35HZ_GAME_TICS_CONTRACT;

export function schedule35hzGameTics(runtimeCommand: string): Schedule35hzGameTicsContract {
  if (runtimeCommand !== EXPECTED_RUNTIME_COMMAND) {
    throw new Error(`schedule35hzGameTics requires runtime command ${EXPECTED_RUNTIME_COMMAND}`);
  }

  return SCHEDULE_35HZ_GAME_TICS_CONTRACT;
}
