/**
 * Vanilla DOOM 1.9 MUS music looping contract pin.
 *
 * From Chocolate Doom 2.2.1 i_music.c I_PlaySong and s_sound.c
 * S_ChangeMusic:
 *
 *   - Music tracks loop indefinitely until S_StopMusic or
 *     I_StopSong is called. Vanilla never plays a music track once
 *     and stops; the loop is the default play mode.
 *
 *   - When the MUS scheduler dispatches a ScoreEnd event under loop
 *     mode, it MUST rewind eventIndex to 0 and re-fire from the
 *     beginning. The ScoreEnd's own trailing delay is preserved as
 *     the gap between the last note and the first note of the next
 *     iteration.
 *
 *   - The per-channel velocity cache (channelvelocities[16]) is NOT
 *     reset between loops. A score whose first play-note relies on
 *     a velocity set near the end of the prior loop continues to
 *     sound identical on the second iteration. This matches the
 *     mus2mid.c reference behavior — channelvelocities is module
 *     scope and lives across the entire program lifetime.
 *
 *   - S_StopMusic vs natural-end: a song stops only via explicit
 *     stop call (level change, menu mute, etc.). Reaching ScoreEnd
 *     under non-looping mode marks the scheduler as finished but
 *     does not re-trigger. Looping mode is selected via the
 *     `looping: true` option to the music scheduler.
 *
 *   The vanilla loop policy applies to BOTH MUS-source tracks and
 *   the MIDI variants registered through the music driver. Pause /
 *   resume (S_PauseSound) freezes the scheduler in place without
 *   rewinding, separate from the loop wrap.
 */

export const VANILLA_MUS_LOOP_REWIND_EVENT_INDEX = 0;
export const VANILLA_MUS_LOOP_DEFAULT = true;
export const VANILLA_MUS_LOOP_VELOCITY_CACHE_RESET_ON_WRAP = false;
export const VANILLA_MUS_LOOP_PRESERVES_SCORE_END_TRAILING_DELAY = true;

export type VanillaMusPlaybackMode = 'looping' | 'once';

export interface VanillaMusLoopOutcome {
  readonly nextEventIndex: number;
  readonly residualDelay: number;
  readonly finished: boolean;
  readonly velocityCachePreserved: boolean;
}

/**
 * Models the scheduler's ScoreEnd handler. On a looping scheduler the
 * eventIndex resets to 0 and the ScoreEnd's own trailing delay becomes
 * the next residual; on a once scheduler the scheduler is marked finished
 * and eventIndex advances past the end.
 */
export function handleVanillaMusScoreEnd(input: { readonly mode: VanillaMusPlaybackMode; readonly scoreEndTrailingDelay: number; readonly eventsLength: number }): VanillaMusLoopOutcome {
  if (input.mode === 'looping') {
    return Object.freeze({
      nextEventIndex: VANILLA_MUS_LOOP_REWIND_EVENT_INDEX,
      residualDelay: input.scoreEndTrailingDelay | 0,
      finished: false,
      velocityCachePreserved: true,
    });
  }
  return Object.freeze({
    nextEventIndex: input.eventsLength | 0,
    residualDelay: 0,
    finished: true,
    velocityCachePreserved: true,
  });
}
