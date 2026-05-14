/**
 * Vanilla DOOM 1.9 music pause / resume contract.
 *
 * From Chocolate Doom 2.2.1 i_music.c I_PauseSong / I_ResumeSong:
 *
 *   Pause and resume operate on the active song handle and do NOT
 *   destroy or restart the score state:
 *
 *     - I_PauseSong(handle)  — sets the music driver to "paused":
 *       quicktick advancement halts, but the score pointer, MUS
 *       channel state (velocity cache, controller state, pitch bend),
 *       and OPL voice state are preserved.  No NoteOff is emitted on
 *       active notes — they continue sustaining at the synth level
 *       until the driver stops processing the OPL register stream.
 *
 *     - I_ResumeSong(handle) — clears the "paused" flag and continues
 *       scheduling from the saved score pointer / quicktick counter.
 *       Channel state is reused as-is.  No NoteOn is emitted on entry
 *       — the same notes that were sustaining continue sustaining.
 *
 *   Pause is idempotent: calling I_PauseSong on an already-paused
 *   handle is a no-op.  Same for I_ResumeSong on an already-playing
 *   handle.  Stop transitions out of either state are valid via
 *   I_StopSong, which does emit NoteOff for active voices.
 *
 *   Vanilla pauses music when:
 *     - The pause-game key is pressed (G_DoLoadLevel pauses; ::paused).
 *     - The menu opens AND the player has selected "Pause when menu" in
 *       the options menu (default off; pause behaviour configurable).
 *     - The game is in an intermission / finale screen the music
 *       supports pausing (rare; intermission music plays continuously).
 */

export const VANILLA_MUSIC_PAUSE_PRESERVES_SCORE_POINTER = true;
export const VANILLA_MUSIC_PAUSE_PRESERVES_CHANNEL_STATE = true;
export const VANILLA_MUSIC_PAUSE_EMITS_NOTE_OFF = false;
export const VANILLA_MUSIC_RESUME_EMITS_NOTE_ON = false;
export const VANILLA_MUSIC_PAUSE_IS_IDEMPOTENT = true;
export const VANILLA_MUSIC_RESUME_IS_IDEMPOTENT = true;

export type VanillaMusicTransport = 'playing' | 'paused' | 'stopped';

export function applyVanillaMusicCommand(state: VanillaMusicTransport, command: 'play' | 'pause' | 'resume' | 'stop'): VanillaMusicTransport {
  switch (command) {
    case 'play':
      return state === 'stopped' ? 'playing' : state;
    case 'pause':
      return state === 'playing' ? 'paused' : state;
    case 'resume':
      return state === 'paused' ? 'playing' : state;
    case 'stop':
      return 'stopped';
  }
}
