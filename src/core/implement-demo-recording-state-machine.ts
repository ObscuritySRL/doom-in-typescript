/**
 * Vanilla Chocolate Doom 2.2.1 demo recording state machine.
 *
 * Mirror of 04-021 for the recording side (g_game.c::G_RecordDemo /
 * G_WriteDemoTiccmd / G_CheckDemoStatus). Phases:
 *   idle      -> awaiting -record dispatch
 *   writing   -> 13-byte header has been written; each tic appends one ticcmd
 *   finalized -> 0x80 terminator written, file flushed and closed
 *   error     -> write failed or unsupported flag combo
 */

export type DemoRecordingPhase = 'error' | 'finalized' | 'idle' | 'writing';

export const VANILLA_DEMO_RECORDING_PHASES: readonly DemoRecordingPhase[] = Object.freeze(['error', 'finalized', 'idle', 'writing'] as const);

export type DemoRecordingEvent = 'append_ticcmd' | 'finalize_demo' | 'request_record' | 'write_failed' | 'unsupported_flag_combo';

export interface DemoRecordingInput {
  readonly currentPhase: DemoRecordingPhase;
  readonly event: DemoRecordingEvent;
}

const TRANSITIONS: ReadonlyMap<string, DemoRecordingPhase> = new Map<string, DemoRecordingPhase>([
  ['idle|request_record', 'writing'],
  ['idle|unsupported_flag_combo', 'error'],
  ['writing|append_ticcmd', 'writing'],
  ['writing|finalize_demo', 'finalized'],
  ['writing|write_failed', 'error'],
]);

export function stepDemoRecording(input: DemoRecordingInput): DemoRecordingPhase {
  const key = `${input.currentPhase}|${input.event}`;
  return TRANSITIONS.get(key) ?? input.currentPhase;
}
