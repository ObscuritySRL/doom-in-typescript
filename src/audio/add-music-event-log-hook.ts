/**
 * Music-event-log hook contract.
 *
 * Per-tic capture of the MUS scheduler's emitted events into a stable,
 * comparison-ready log used by the oracle parity harness.  The vanilla
 * MUS scheduler emits events at 140 Hz (4x DOOM gameplay tic); this
 * hook records each event with its (gametic, quicktick, channel,
 * eventType, body) tuple so a captured run can be byte-compared
 * against a reference replay.
 *
 * Log entry shape:
 *   { gameTic, quicktickWithinTic, channel, eventType, body }
 * where:
 *   - gameTic: monotonic 35 Hz tic counter at capture time.
 *   - quicktickWithinTic: 0..3 (since music ticks 4x per gametic).
 *   - channel: MUS channel 0..15.
 *   - eventType: MUS event-type code 0..7 (see parse-mus-event-stream).
 *   - body: variable-width bytes (1 for ReleaseNote/PitchBend/SystemEvent,
 *           2 for ControllerChange, 1-or-2 for PlayNote, 0 for ScoreEnd).
 *
 * Comparison semantics:
 *   - Two logs match iff they record the same sequence of entries in
 *     the same order with byte-identical bodies.
 *   - Empty bodies (ScoreEnd) compare equal.
 *   - Channel state changes (controllers, pitch bend) are captured at
 *     emit time, NOT at apply time — so a port that re-orders
 *     controller-change vs play-note inside a single quicktick will
 *     drift even if final OPL register state is identical.
 */

export const VANILLA_MUSIC_EVENT_LOG_QUICKTICKS_PER_GAMETIC = 4;
export const VANILLA_MUSIC_EVENT_LOG_CHANNEL_COUNT = 16;
export const VANILLA_MUSIC_EVENT_LOG_PERCUSSION_CHANNEL = 15;

export interface MusicEventLogEntry {
  readonly gameTic: number;
  readonly quicktickWithinTic: number;
  readonly channel: number;
  readonly eventType: number;
  readonly body: Uint8Array;
}

export interface MusicEventLog {
  readonly entries: readonly MusicEventLogEntry[];
}

export function vanillaMusicEventLogsEqual(left: MusicEventLog, right: MusicEventLog): boolean {
  if (left.entries.length !== right.entries.length) {
    return false;
  }
  for (let index = 0; index < left.entries.length; index += 1) {
    const a = left.entries[index]!;
    const b = right.entries[index]!;
    if (a.gameTic !== b.gameTic) return false;
    if (a.quicktickWithinTic !== b.quicktickWithinTic) return false;
    if (a.channel !== b.channel) return false;
    if (a.eventType !== b.eventType) return false;
    if (a.body.length !== b.body.length) return false;
    for (let byteIndex = 0; byteIndex < a.body.length; byteIndex += 1) {
      if (a.body[byteIndex] !== b.body[byteIndex]) return false;
    }
  }
  return true;
}

export function vanillaMusicEventLogEntryIsValid(entry: MusicEventLogEntry): boolean {
  if (!Number.isInteger(entry.gameTic) || entry.gameTic < 0) return false;
  if (!Number.isInteger(entry.quicktickWithinTic) || entry.quicktickWithinTic < 0 || entry.quicktickWithinTic >= VANILLA_MUSIC_EVENT_LOG_QUICKTICKS_PER_GAMETIC) return false;
  if (!Number.isInteger(entry.channel) || entry.channel < 0 || entry.channel >= VANILLA_MUSIC_EVENT_LOG_CHANNEL_COUNT) return false;
  if (!Number.isInteger(entry.eventType) || entry.eventType < 0 || entry.eventType > 7) return false;
  return true;
}
