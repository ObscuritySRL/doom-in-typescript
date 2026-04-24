/**
 * MUS event scheduler.
 *
 * Consumes the {@link MusEvent} stream produced by
 * {@link parseMusScore} and drives it forward on the MUS native tick
 * (140 Hz; four quickticks per 35 Hz game tic).  Each call to
 * {@link advanceMusScheduler} consumes a caller-supplied number of
 * quickticks, accumulates the per-event `delay` into the scheduler's
 * internal wall-clock, and returns the sequence of events that fire
 * within the advance window.  The returned entries carry the absolute
 * MUS quicktick at which the event fires so the host-side music
 * device can dispatch them on their intended timeline.
 *
 * Vanilla `mus2mid.c` keeps a per-channel `channelvelocities[16]`
 * cache.  When a play-note event has bit 7 clear on its note byte,
 * the vanilla converter reuses the previous velocity for that
 * channel.  {@link parseMusScore} deliberately surfaces that case as
 * `velocity: null` so the scheduler can mirror the cache: explicit
 * velocities update the cache, `null` velocities resolve back to the
 * cached value.  The cache is seeded with
 * {@link MUS_DEFAULT_VELOCITY} (127) — the same initial value
 * `channelvelocities[]` carries in mus2mid.c — so a score whose
 * first play-note on a channel omits velocity still produces an
 * audible note instead of a silent one.
 *
 * Looping is the scheduler's responsibility.  {@link parseMusScore}
 * terminates at the first `ScoreEnd` and never re-reads the buffer.
 * When {@link createMusScheduler} is called with `looping: true`,
 * dispatching a `ScoreEnd` event rewinds `eventIndex` to 0 and
 * preserves the ScoreEnd's own `delay` as the pause before the
 * score re-fires.  The per-channel velocity cache persists across
 * loops (vanilla's cache is never reset mid-song), so a score whose
 * first play-note relies on a velocity set near the end of the prior
 * loop continues to sound identical on the second iteration.
 *
 * The module is pure: it mutates only the caller-supplied
 * {@link MusSchedulerState} and returns a fresh frozen array of
 * dispatched events per call.  Zero Win32 bindings, zero I/O, zero
 * global mutable state.  The host-side music device (future steps
 * 15-009/15-010/15-011) consumes the dispatched events via their
 * resolved `velocity` field and maps them to OPL registers or an
 * external MIDI bridge.
 *
 * @example
 * ```ts
 * import { parseMusScore } from "../src/audio/musParser.ts";
 * import { advanceMusScheduler, createMusScheduler, MUS_TICKS_PER_GAME_TIC }
 *   from "../src/audio/musScheduler.ts";
 *
 * const score = parseMusScore(lookup.getLumpData("D_E1M1", wad));
 * const scheduler = createMusScheduler(score, { looping: true });
 *
 * // Every game tic: advance the scheduler by four quickticks and
 * // dispatch any events that fire in that window.
 * const dispatched = advanceMusScheduler(scheduler, MUS_TICKS_PER_GAME_TIC);
 * for (const entry of dispatched) {
 *   applyEventToDevice(entry.event);
 * }
 * ```
 */

import type { MusControllerChangeEvent, MusEvent, MusPitchBendEvent, MusPlayNoteEvent, MusReleaseNoteEvent, MusScore, MusScoreEndEvent, MusSystemEvent } from './musParser.ts';
import { MusEventKind } from './musParser.ts';

/** MUS native tick rate in Hertz.  Four MUS quickticks elapse per 35 Hz game tic. */
export const MUS_TICK_HZ = 140;

/** Number of MUS quickticks that elapse during a single 35 Hz game tic. */
export const MUS_TICKS_PER_GAME_TIC = 4;

/** Default per-channel velocity used when a play-note fires before any explicit velocity on that channel. */
export const MUS_DEFAULT_VELOCITY = 127;

/** Number of MUS channels tracked by the per-channel velocity cache (0-15; 15 is percussion). */
export const MUS_CHANNEL_COUNT = 16;

/** A play-note event whose velocity has been resolved via the per-channel cache. */
export interface DispatchedMusPlayNoteEvent extends Omit<MusPlayNoteEvent, 'velocity'> {
  readonly velocity: number;
}

/** Discriminated union of events as emitted by the scheduler (play-notes are always velocity-resolved). */
export type DispatchedMusEvent = MusReleaseNoteEvent | DispatchedMusPlayNoteEvent | MusPitchBendEvent | MusSystemEvent | MusControllerChangeEvent | MusScoreEndEvent;

/** A single dispatched event paired with the absolute MUS quicktick at which it fires. */
export interface DispatchedMusEventEntry {
  /** Absolute MUS quicktick (0-based) at which this event fires. */
  readonly musQuicktick: number;
  /** Dispatched event with per-channel velocity resolved on play-notes. */
  readonly event: DispatchedMusEvent;
}

/** Mutable scheduler state produced by {@link createMusScheduler}. */
export interface MusSchedulerState {
  /** Events from the parsed MUS score in dispatch order. */
  readonly events: readonly MusEvent[];
  /** Whether {@link MusEventKind.ScoreEnd} rewinds to the start. */
  readonly looping: boolean;
  /** Index of the next event to dispatch; equals `events.length` when exhausted without looping. */
  eventIndex: number;
  /** Quickticks remaining before `events[eventIndex]` fires. */
  delayRemaining: number;
  /** Per-channel last-seen velocity; length always {@link MUS_CHANNEL_COUNT}. */
  readonly channelVelocities: number[];
  /** True once a non-looping scheduler has dispatched {@link MusEventKind.ScoreEnd}. */
  finished: boolean;
  /** Absolute MUS quickticks advanced since creation. */
  elapsedQuickticks: number;
}

export interface CreateMusSchedulerOptions {
  /** When true, {@link MusEventKind.ScoreEnd} rewinds and replays from the start.  Default `false`. */
  readonly looping?: boolean;
}

/**
 * Create a fresh scheduler seeded from a parsed MUS {@link MusScore}.
 *
 * The per-channel velocity cache is initialized to
 * {@link MUS_DEFAULT_VELOCITY} (127), matching the initial value of
 * `channelvelocities[16]` in chocolate-doom's `mus2mid.c`.
 * `eventIndex` and `elapsedQuickticks` start at 0, `delayRemaining`
 * starts at 0 (so the first advance call fires the first event at
 * quicktick 0 before waiting on any delay), `finished` starts at
 * `false`.
 *
 * @throws {TypeError} If `score.events` is not an array.
 */
export function createMusScheduler(score: Readonly<MusScore>, options?: CreateMusSchedulerOptions): MusSchedulerState {
  if (!Array.isArray(score.events)) {
    throw new TypeError('createMusScheduler: score.events must be an array');
  }
  const looping = options?.looping ?? false;
  const channelVelocities = new Array<number>(MUS_CHANNEL_COUNT).fill(MUS_DEFAULT_VELOCITY);
  return {
    events: score.events,
    looping,
    eventIndex: 0,
    delayRemaining: 0,
    channelVelocities,
    finished: false,
    elapsedQuickticks: 0,
  };
}

/**
 * Advance the scheduler by `quickticks` MUS quickticks and return the
 * events that fire during the advance window.
 *
 * Each iteration consumes `delayRemaining` first (subtracting the
 * smaller of `delayRemaining` and `quickticks` remaining in the
 * window).  When `delayRemaining` reaches 0 and the window still has
 * budget, the next event is dispatched at the current
 * `elapsedQuickticks` value and `delayRemaining` advances to that
 * event's own `delay`.  Consecutive events with `delay: 0` chain on
 * the same quicktick.
 *
 * Dispatching a {@link MusEventKind.ScoreEnd} event:
 *
 * - For non-looping schedulers, `finished` is set and the window's
 *   remaining budget is still accounted for in `elapsedQuickticks`.
 * - For looping schedulers, `eventIndex` rewinds to 0 and
 *   `delayRemaining` takes the ScoreEnd's own `delay` as the pause
 *   before the replay starts.  The per-channel velocity cache is
 *   preserved.
 *
 * Play-note events are emitted with their velocity resolved from
 * (or written into) the per-channel cache: explicit velocities
 * update the cache; `null` velocities read from it.
 *
 * Zero-duration looping scores (all event delays are 0 including
 * ScoreEnd) would otherwise spin forever.  The scheduler detects
 * this by remembering the elapsed tick of each looping rewind; if
 * the next rewind would fire at the same elapsed tick without any
 * delay consumed since, the advance call terminates early after a
 * single pass.  State stays `finished: false` so a subsequent
 * advance call begins a fresh pass.
 *
 * @throws {RangeError} If `quickticks` is negative or not an integer.
 * @returns Frozen array of {@link DispatchedMusEventEntry} in dispatch order.
 */
export function advanceMusScheduler(state: MusSchedulerState, quickticks: number): readonly DispatchedMusEventEntry[] {
  if (!Number.isInteger(quickticks) || quickticks < 0) {
    throw new RangeError(`advanceMusScheduler: quickticks must be a non-negative integer, got ${quickticks}`);
  }

  const dispatched: DispatchedMusEventEntry[] = [];
  let remaining = quickticks;
  let lastLoopElapsed = -1;
  let justRewound = false;

  while (remaining > 0 && !state.finished) {
    if (justRewound && state.delayRemaining === 0 && state.elapsedQuickticks === lastLoopElapsed) {
      break;
    }
    justRewound = false;

    if (state.delayRemaining > 0) {
      const consume = Math.min(state.delayRemaining, remaining);
      state.delayRemaining -= consume;
      state.elapsedQuickticks += consume;
      remaining -= consume;
      if (state.delayRemaining > 0) {
        break;
      }
    }

    if (state.eventIndex >= state.events.length) {
      state.finished = true;
      break;
    }

    const event = state.events[state.eventIndex]!;
    const dispatchedEvent = resolveEvent(event, state.channelVelocities);
    dispatched.push({ musQuicktick: state.elapsedQuickticks, event: dispatchedEvent });

    state.delayRemaining = event.delay;

    if (event.kind === MusEventKind.ScoreEnd) {
      if (state.looping) {
        lastLoopElapsed = state.elapsedQuickticks;
        justRewound = true;
        state.eventIndex = 0;
      } else {
        state.finished = true;
        break;
      }
    } else {
      state.eventIndex++;
    }
  }

  if (remaining > 0) {
    state.elapsedQuickticks += remaining;
  }

  return Object.freeze(dispatched);
}

function resolveEvent(event: MusEvent, channelVelocities: number[]): DispatchedMusEvent {
  if (event.kind !== MusEventKind.PlayNote) {
    return event;
  }
  let velocity: number;
  if (event.velocity !== null) {
    velocity = event.velocity;
    channelVelocities[event.channel] = velocity;
  } else {
    velocity = channelVelocities[event.channel]!;
  }
  const resolved: DispatchedMusPlayNoteEvent = {
    kind: event.kind,
    channel: event.channel,
    note: event.note,
    velocity,
    delay: event.delay,
  };
  return resolved;
}
