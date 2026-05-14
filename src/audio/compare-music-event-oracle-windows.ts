/**
 * Vanilla DOOM 1.9 music-event oracle window comparator.
 *
 * The music oracle records the live MUS event stream emitted by the MUS
 * scheduler over a deterministic playback. Each oracle window holds a fixed
 * number of events; comparing the recorded stream byte-for-byte against the
 * reference window catches dropped events, reordered events, or wrong
 * channel/data parameters.
 *
 * Event record layout (8 bytes per event):
 *   eventType   u8   release_note=0, play_note=1, pitch_wheel=2, system=3,
 *                    change_controller=4, score_end=6
 *   channel     u8   0..15 (MUS percussion is channel 15)
 *   data0       u8   first parameter
 *   data1       u8   second parameter
 *   lastInGroup u8   trailing-delay flag from MUS event header
 *   reserved    u8   zero padding for alignment
 *   gameTicLo   u8   game tic low byte
 *   gameTicHi   u8   game tic high byte
 *
 * Each oracle window holds VANILLA_MUSIC_EVENT_LOG_WINDOW_EVENTS = 1024
 * events. The window is hashed with SHA-256 (64-hex digest) for compact
 * comparison; the raw bytes are kept on disk for diagnostics.
 */

export const VANILLA_MUSIC_EVENT_LOG_BYTES_PER_EVENT = 8;
export const VANILLA_MUSIC_EVENT_LOG_WINDOW_EVENTS = 1024;
export const VANILLA_MUSIC_EVENT_LOG_WINDOW_BYTES = VANILLA_MUSIC_EVENT_LOG_BYTES_PER_EVENT * VANILLA_MUSIC_EVENT_LOG_WINDOW_EVENTS;
export const VANILLA_MUSIC_EVENT_LOG_HASH_HEX_LENGTH = 64;

export const MUS_EVENT_RELEASE = 0;
export const MUS_EVENT_PLAY = 1;
export const MUS_EVENT_PITCH = 2;
export const MUS_EVENT_SYSTEM = 3;
export const MUS_EVENT_CONTROLLER = 4;
export const MUS_EVENT_SCORE_END = 6;

export type VanillaMusEventCode = typeof MUS_EVENT_RELEASE | typeof MUS_EVENT_PLAY | typeof MUS_EVENT_PITCH | typeof MUS_EVENT_SYSTEM | typeof MUS_EVENT_CONTROLLER | typeof MUS_EVENT_SCORE_END;

export interface MusicEventOracleWindow {
  readonly bytes: Buffer;
}

/** A window is well-formed iff it is exactly the canonical byte length. */
export function vanillaMusicEventOracleWindowIsValid(window: MusicEventOracleWindow): boolean {
  return window.bytes.length === VANILLA_MUSIC_EVENT_LOG_WINDOW_BYTES;
}

/** Strict byte comparison of two music-event windows. */
export function vanillaMusicEventOracleWindowsEqual(actual: MusicEventOracleWindow, expected: MusicEventOracleWindow): boolean {
  if (actual.bytes.length !== expected.bytes.length) {
    return false;
  }
  return Buffer.compare(actual.bytes, expected.bytes) === 0;
}
