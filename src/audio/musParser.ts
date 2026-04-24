/**
 * MUS score event parser.
 *
 * Reads a MUS lump (header + instrument list + score) and decodes the
 * score section into a sequential list of {@link MusEvent}s with
 * inter-event delays measured in MUS quickticks (the format's native
 * 140 Hz tick).  The header layout itself is delegated to
 * {@link parseMus} in `../assets/mus.ts` (see F-053); this module
 * concentrates on the score grammar described by Chocolate Doom's
 * `mus2mid.c` event loop.
 *
 * Each score event begins with a single descriptor byte:
 *
 * ```text
 *   bit 7    : "last event of group" flag — when set, a variable-length
 *              delay follows the event body and is attached to that
 *              event; when clear the delay is 0 (next event runs on the
 *              same quicktick).
 *   bits 4-6 : event type (0-7)
 *   bits 0-3 : channel number (0-15; channel 15 is percussion, F-053)
 * ```
 *
 * Event-type bodies follow the descriptor byte:
 *
 * | Type | Name              | Body bytes | Notes                               |
 * | ---- | ----------------- | ---------- | ----------------------------------- |
 * | 0    | Release note      | 1          | note (0-127)                        |
 * | 1    | Play note         | 1 or 2     | note (bits 0-6); bit 7 → velocity   |
 * | 2    | Pitch bend        | 1          | bend (0-255, 128 = centre)          |
 * | 3    | System event      | 1          | controller in `[10, 14]`            |
 * | 4    | Controller change | 2          | controller in `[0, 9]`, value 0-127 |
 * | 5    | (reserved)        | —          | invalid — `RangeError`              |
 * | 6    | Score end         | 0          | terminates the score                |
 * | 7    | (reserved)        | —          | invalid — `RangeError`              |
 *
 * Variable-length delays use seven data bits per byte with bit 7 as a
 * continuation flag (`delay = (delay << 7) | (byte & 0x7F)`), matching
 * the MIDI VLQ encoding.  The delay reported on each event is the gap
 * BEFORE the next event, so summing every `event.delay` yields the
 * total quickticks consumed by the score.
 *
 * @example
 * ```ts
 * import { parseMusScore } from "../src/audio/musParser.ts";
 * const score = parseMusScore(lookup.getLumpData("D_E1M1", wad));
 * score.header.channelCount;       // primary MUS channels (≤ 16)
 * score.events[0].kind;            // MusEventKind.ControllerChange
 * score.events.at(-1).kind;        // MusEventKind.ScoreEnd
 * score.totalDelay;                // sum of all inter-event delays
 * ```
 */

import { parseMus, type MusHeader } from '../assets/mus.ts';

/** MUS event-type discriminant (event-byte bits 4-6). */
export const MusEventKind = Object.freeze({
  ReleaseNote: 0,
  PlayNote: 1,
  PitchBend: 2,
  SystemEvent: 3,
  ControllerChange: 4,
  ScoreEnd: 6,
} as const);

/** Numeric union of the MUS event kinds emitted by {@link parseMusScore}. */
export type MusEventKind = (typeof MusEventKind)[keyof typeof MusEventKind];

/** Inclusive lower bound of valid system-event controller numbers. */
export const MUS_SYSTEM_EVENT_CONTROLLER_MIN = 10;

/** Inclusive upper bound of valid system-event controller numbers. */
export const MUS_SYSTEM_EVENT_CONTROLLER_MAX = 14;

/** Inclusive lower bound of valid controller-change controller numbers. */
export const MUS_CONTROLLER_CHANGE_MIN = 0;

/** Inclusive upper bound of valid controller-change controller numbers. */
export const MUS_CONTROLLER_CHANGE_MAX = 9;

/** Inclusive upper bound of valid MUS note numbers (matches MIDI). */
export const MUS_NOTE_MAX = 127;

/** Inclusive upper bound of valid MUS velocity / controller-value bytes. */
export const MUS_VELOCITY_MAX = 127;

/** Bit mask for the "last event of group" descriptor flag. */
export const MUS_LAST_EVENT_FLAG = 0x80;

/** Bit mask isolating the event-type field of the descriptor byte. */
export const MUS_EVENT_TYPE_MASK = 0x70;

/** Bit shift to right-align the event-type field. */
export const MUS_EVENT_TYPE_SHIFT = 4;

/** Bit mask isolating the channel field of the descriptor byte. */
export const MUS_CHANNEL_MASK = 0x0f;

/** Bit mask isolating the velocity-present flag in a play-note body. */
export const MUS_NOTE_VELOCITY_FLAG = 0x80;

/** Bit mask isolating the seven note bits in a play-note body. */
export const MUS_NOTE_VALUE_MASK = 0x7f;

/** Per-event base shape shared by every {@link MusEvent} variant. */
interface MusEventBase {
  /** Channel number (0-15; 15 = percussion). */
  readonly channel: number;
  /** Quickticks of silence between this event and the next. */
  readonly delay: number;
}

/** "Release note" event (type 0). */
export interface MusReleaseNoteEvent extends MusEventBase {
  readonly kind: typeof MusEventKind.ReleaseNote;
  readonly note: number;
}

/** "Play note" event (type 1) — `velocity` is `null` when reusing the previous channel velocity. */
export interface MusPlayNoteEvent extends MusEventBase {
  readonly kind: typeof MusEventKind.PlayNote;
  readonly note: number;
  readonly velocity: number | null;
}

/** "Pitch bend" event (type 2). */
export interface MusPitchBendEvent extends MusEventBase {
  readonly kind: typeof MusEventKind.PitchBend;
  readonly bend: number;
}

/** "System event" event (type 3) — `controller` is constrained to `[10, 14]`. */
export interface MusSystemEvent extends MusEventBase {
  readonly kind: typeof MusEventKind.SystemEvent;
  readonly controller: number;
}

/** "Controller change" event (type 4) — `controller` in `[0, 9]`. */
export interface MusControllerChangeEvent extends MusEventBase {
  readonly kind: typeof MusEventKind.ControllerChange;
  readonly controller: number;
  readonly value: number;
}

/** "Score end" event (type 6); always the final event in a well-formed score. */
export interface MusScoreEndEvent extends MusEventBase {
  readonly kind: typeof MusEventKind.ScoreEnd;
}

/** Union of every event variant produced by {@link parseMusScore}. */
export type MusEvent = MusReleaseNoteEvent | MusPlayNoteEvent | MusPitchBendEvent | MusSystemEvent | MusControllerChangeEvent | MusScoreEndEvent;

/** Fully decoded MUS lump: header, instrument list, and event stream. */
export interface MusScore {
  /** Parsed header from {@link parseMus}. */
  readonly header: Readonly<MusHeader>;
  /** Sequential events in score order, terminated by a {@link MusScoreEndEvent}. */
  readonly events: readonly MusEvent[];
  /** Sum of every `event.delay` across the score. */
  readonly totalDelay: number;
  /** Number of score bytes consumed (descriptors + bodies + delays). */
  readonly bytesConsumed: number;
}

/**
 * Parse a MUS lump into its header and a sequential stream of decoded events.
 *
 * The parser walks the score buffer until it hits an explicit
 * `ScoreEnd` event (type 6).  Each event carries the delay BEFORE the
 * next event so callers can drive a scheduler by accumulating delays.
 * The final `ScoreEnd` event always reports a `delay` of 0.
 *
 * @param lumpData - Raw MUS lump bytes from a WAD lookup.
 * @returns Frozen {@link MusScore} with header, events, and timing totals.
 * @throws {RangeError} If the header is malformed (delegated to {@link parseMus}),
 *   the score contains a reserved event type (5 or 7), a system / controller
 *   event references a controller outside its allowed range, or the score
 *   data ends before a `ScoreEnd` event.
 */
export function parseMusScore(lumpData: Buffer): Readonly<MusScore> {
  const header = parseMus(lumpData);
  const score = header.scoreData;

  const events: MusEvent[] = [];
  let cursor = 0;
  let totalDelay = 0;
  let sawScoreEnd = false;

  while (cursor < score.length) {
    const descriptor = score[cursor++]!;
    const eventType = ((descriptor & MUS_EVENT_TYPE_MASK) >> MUS_EVENT_TYPE_SHIFT) as MusEventKind;
    const channel = descriptor & MUS_CHANNEL_MASK;
    const hasDelay = (descriptor & MUS_LAST_EVENT_FLAG) !== 0;

    let event: MusEvent;
    switch (eventType) {
      case MusEventKind.ReleaseNote: {
        const note = readBodyByte(score, cursor++, 'release-note note');
        if (note > MUS_NOTE_MAX) {
          throw new RangeError(`MUS release-note note ${note} exceeds maximum ${MUS_NOTE_MAX}`);
        }
        event = { kind: MusEventKind.ReleaseNote, channel, note, delay: 0 };
        break;
      }
      case MusEventKind.PlayNote: {
        const noteByte = readBodyByte(score, cursor++, 'play-note note');
        const note = noteByte & MUS_NOTE_VALUE_MASK;
        let velocity: number | null = null;
        if ((noteByte & MUS_NOTE_VELOCITY_FLAG) !== 0) {
          velocity = readBodyByte(score, cursor++, 'play-note velocity');
          if (velocity > MUS_VELOCITY_MAX) {
            throw new RangeError(`MUS play-note velocity ${velocity} exceeds maximum ${MUS_VELOCITY_MAX}`);
          }
        }
        event = { kind: MusEventKind.PlayNote, channel, note, velocity, delay: 0 };
        break;
      }
      case MusEventKind.PitchBend: {
        const bend = readBodyByte(score, cursor++, 'pitch-bend value');
        event = { kind: MusEventKind.PitchBend, channel, bend, delay: 0 };
        break;
      }
      case MusEventKind.SystemEvent: {
        const controller = readBodyByte(score, cursor++, 'system-event controller');
        if (controller < MUS_SYSTEM_EVENT_CONTROLLER_MIN || controller > MUS_SYSTEM_EVENT_CONTROLLER_MAX) {
          throw new RangeError(`MUS system-event controller ${controller} outside [${MUS_SYSTEM_EVENT_CONTROLLER_MIN}, ${MUS_SYSTEM_EVENT_CONTROLLER_MAX}]`);
        }
        event = { kind: MusEventKind.SystemEvent, channel, controller, delay: 0 };
        break;
      }
      case MusEventKind.ControllerChange: {
        const controller = readBodyByte(score, cursor++, 'controller-change controller');
        if (controller < MUS_CONTROLLER_CHANGE_MIN || controller > MUS_CONTROLLER_CHANGE_MAX) {
          throw new RangeError(`MUS controller-change controller ${controller} outside [${MUS_CONTROLLER_CHANGE_MIN}, ${MUS_CONTROLLER_CHANGE_MAX}]`);
        }
        const value = readBodyByte(score, cursor++, 'controller-change value');
        if (value > MUS_VELOCITY_MAX) {
          throw new RangeError(`MUS controller-change value ${value} exceeds maximum ${MUS_VELOCITY_MAX}`);
        }
        event = { kind: MusEventKind.ControllerChange, channel, controller, value, delay: 0 };
        break;
      }
      case MusEventKind.ScoreEnd: {
        event = { kind: MusEventKind.ScoreEnd, channel, delay: 0 };
        sawScoreEnd = true;
        break;
      }
      default: {
        throw new RangeError(`MUS reserved event type ${eventType} at score offset ${cursor - 1}`);
      }
    }

    let delay = 0;
    if (hasDelay) {
      const result = readVariableLengthDelay(score, cursor);
      delay = result.value;
      cursor = result.cursor;
    }

    events.push(Object.freeze({ ...event, delay }));
    totalDelay += delay;

    if (sawScoreEnd) {
      break;
    }
  }

  if (!sawScoreEnd) {
    throw new RangeError('MUS score ended without a ScoreEnd event');
  }

  const result: MusScore = {
    header,
    events: Object.freeze(events),
    totalDelay,
    bytesConsumed: cursor,
  };

  return Object.freeze(result);
}

function readBodyByte(score: Buffer, offset: number, label: string): number {
  if (offset >= score.length) {
    throw new RangeError(`MUS score truncated reading ${label} at offset ${offset}`);
  }
  return score[offset]!;
}

function readVariableLengthDelay(score: Buffer, start: number): { value: number; cursor: number } {
  let value = 0;
  let cursor = start;
  for (;;) {
    if (cursor >= score.length) {
      throw new RangeError(`MUS score truncated reading variable-length delay at offset ${cursor}`);
    }
    const byte = score[cursor++]!;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      return { value, cursor };
    }
  }
}
