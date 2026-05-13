/**
 * Vanilla Chocolate Doom 2.2.1 demo playback state machine.
 *
 * Phases pinned from g_game.c::G_PlayDemo / G_DoPlayDemo:
 *   idle       -> awaiting -playdemo or attract-loop dispatch
 *   loading    -> read lump, parseDemoHeader
 *   playing    -> each tic consume one 4-byte ticcmd, advance gametic
 *   stopped    -> demo terminator (0x80) reached or G_CheckDemoStatus(forced)
 *   error      -> any violation surfaced by 04-019 header parse or 04-020 ticcmd parse
 */

export type DemoPlaybackPhase = 'error' | 'idle' | 'loading' | 'playing' | 'stopped';

export const VANILLA_DEMO_PLAYBACK_PHASES: readonly DemoPlaybackPhase[] = Object.freeze(['error', 'idle', 'loading', 'playing', 'stopped'] as const);

export type DemoPlaybackEvent = 'header_parse_failed' | 'load_demo' | 'reach_terminator' | 'request_stop' | 'start_playback' | 'tick_advance' | 'ticcmd_parse_failed';

export interface DemoPlaybackInput {
  readonly currentPhase: DemoPlaybackPhase;
  readonly event: DemoPlaybackEvent;
}

const TRANSITIONS: ReadonlyMap<string, DemoPlaybackPhase> = new Map<string, DemoPlaybackPhase>([
  ['idle|load_demo', 'loading'],
  ['loading|start_playback', 'playing'],
  ['loading|header_parse_failed', 'error'],
  ['playing|tick_advance', 'playing'],
  ['playing|ticcmd_parse_failed', 'error'],
  ['playing|reach_terminator', 'stopped'],
  ['playing|request_stop', 'stopped'],
]);

export function stepDemoPlayback(input: DemoPlaybackInput): DemoPlaybackPhase {
  const key = `${input.currentPhase}|${input.event}`;
  return TRANSITIONS.get(key) ?? input.currentPhase;
}
