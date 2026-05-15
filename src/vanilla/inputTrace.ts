/**
 * Vanilla DOOM 1.9 deterministic input trace record / replay.
 *
 * Plan_final step `03-008` (lane: launch-host-input) wires
 * record-and-replay support for the live event queue (built in
 * `03-006`) against the oracle input-script schema (read-only at
 * `src/oracles/inputScript.ts`).  Oracle runs and acceptance
 * captures need to:
 *
 *   - Record every input event that hits the queue, tagged with the
 *     tic it arrived on, and serialize the result to disk as a
 *     stable {@link InputScriptPayload}.
 *   - Replay a serialized payload: at each tic, post the scheduled
 *     events back into a target queue so the engine receives the
 *     exact same input sequence on every run.
 *
 * The recorder maintains a live event list bound to a caller-
 * advancing tic counter (the caller calls `advanceTic()` once per
 * game tic; `record(event)` tags the event with the current tic).
 * Calling `freezePayload()` returns a frozen
 * {@link InputScriptPayload} ready for serialization.
 *
 * The replayer is single-pass: every call to `replayTic(tic, queue)`
 * posts every event whose `tic` matches into the supplied
 * {@link VanillaEventQueue}.  Events are consumed in order and the
 * replayer's read cursor advances past them.  Calling
 * `replayTic(N, queue)` after events with tic < N have been replayed
 * does not double-post earlier events.
 *
 * Event-kind mapping between the script schema and the vanilla
 * event queue:
 *
 *   - `key-down`               ↔ `ev_keydown` (data1 = scanCode)
 *   - `key-up`                 ↔ `ev_keyup` (data1 = scanCode)
 *   - `mouse-button-down/up`   ↔ `ev_mouse` (data1 = button bitmask;
 *                                 button index 0..4 becomes 1 << button)
 *   - `quit`                   ↔ `ev_quit`
 *   - `mouse-move`             — no `VanillaEvent` analog (motion
 *                                 deltas are accumulated by
 *                                 `src/input/mouse.ts` and folded into
 *                                 a per-tic `ev_mouse` event by the
 *                                 host bring-up step; the replayer
 *                                 silently skips `mouse-move` entries
 *                                 because they belong to the motion
 *                                 accumulator, not the event queue).
 *
 * @example
 * ```ts
 * import { VanillaInputTraceRecorder, VanillaInputTraceReplayer } from './inputTrace.ts';
 * import { VanillaEventQueue } from './eventQueue.ts';
 *
 * const recorder = new VanillaInputTraceRecorder({ description: 'sample', targetRunMode: 'title-loop' });
 * recorder.advanceTic();
 * recorder.record({ type: 'ev_keydown', data1: 27, data2: 0, data3: 0 });
 * recorder.advanceTic();
 * const payload = recorder.freezePayload();
 *
 * const replayer = new VanillaInputTraceReplayer(payload);
 * const queue = new VanillaEventQueue();
 * replayer.replayTic(1, queue);
 * queue.size; // 1
 * ```
 */

import type { InputScriptEvent, InputScriptPayload } from '../oracles/inputScript.ts';
import type { RunMode } from '../oracles/referenceRunManifest.ts';
import type { VanillaEvent, VanillaEventQueue } from './eventQueue.ts';

/** Canonical Doom tic rate in Hz (matches the reference). */
export const VANILLA_TIC_RATE_HZ = 35;

/**
 * Constructor options for {@link VanillaInputTraceRecorder}.
 *
 * `description` is a human-readable label baked into the produced
 * payload; `targetRunMode` discriminates the capture mode oracle
 * runs use; `ticRateHz` defaults to {@link VANILLA_TIC_RATE_HZ}.
 */
export interface VanillaInputTraceRecorderOptions {
  readonly description: string;
  readonly targetRunMode: RunMode;
  readonly ticRateHz?: number;
}

const MOUSE_BUTTON_BIT_MASK = 0x1f;

function deriveMouseButtonIndexFromMask(mask: number): number | null {
  const masked = mask & MOUSE_BUTTON_BIT_MASK;
  for (let buttonIndex = 0; buttonIndex < 5; buttonIndex += 1) {
    if (masked >>> buttonIndex === 1) {
      return buttonIndex;
    }
  }
  return null;
}

/**
 * Convert one {@link VanillaEvent} into the corresponding
 * {@link InputScriptEvent} tagged with `tic`.  Returns `null` for
 * `ev_mouse` events that carry no button-press transition (the mask
 * is zero, meaning a button release that left the mask empty — the
 * recorder still wants to log such events, but only after the
 * caller derives the up/down direction; this is the host bring-up
 * step's job).  For `ev_mouse` events with exactly one bit set in
 * the mask, the helper produces a `mouse-button-down` event.
 */
export function convertVanillaEventToInputScriptEvent(event: VanillaEvent, tic: number): InputScriptEvent | null {
  switch (event.type) {
    case 'ev_keydown':
      return Object.freeze({ kind: 'key-down', scanCode: event.data1 & 0xff, tic });
    case 'ev_keyup':
      return Object.freeze({ kind: 'key-up', scanCode: event.data1 & 0xff, tic });
    case 'ev_mouse': {
      const buttonIndex = deriveMouseButtonIndexFromMask(event.data1);
      if (buttonIndex === null) {
        return null;
      }
      return Object.freeze({ button: buttonIndex, kind: 'mouse-button-down', tic });
    }
    case 'ev_quit':
      return Object.freeze({ kind: 'quit', tic });
  }
}

/**
 * Convert one {@link InputScriptEvent} into the corresponding
 * {@link VanillaEvent}.  Returns `null` for `mouse-move` entries
 * because the vanilla event queue has no motion event kind (motion
 * is accumulated separately by `src/input/mouse.ts`).
 */
export function convertInputScriptEventToVanillaEvent(event: InputScriptEvent): VanillaEvent | null {
  switch (event.kind) {
    case 'key-down':
      return Object.freeze({ data1: event.scanCode & 0xff, data2: 0, data3: 0, type: 'ev_keydown' });
    case 'key-up':
      return Object.freeze({ data1: event.scanCode & 0xff, data2: 0, data3: 0, type: 'ev_keyup' });
    case 'mouse-button-down':
      return Object.freeze({ data1: (1 << event.button) & 0xff, data2: 0, data3: 0, type: 'ev_mouse' });
    case 'mouse-button-up':
      return Object.freeze({ data1: 0, data2: 0, data3: 0, type: 'ev_mouse' });
    case 'mouse-move':
      return null;
    case 'quit':
      return Object.freeze({ data1: 0, data2: 0, data3: 0, type: 'ev_quit' });
  }
}

/**
 * Record live {@link VanillaEvent}s into an
 * {@link InputScriptPayload}-shaped trace.  The recorder maintains a
 * tic counter advanced by the caller via {@link advanceTic}; every
 * `record(event)` call tags the event with the current tic before
 * appending it to the live event list.  `freezePayload()` returns
 * the final frozen payload ready for serialization.
 */
export class VanillaInputTraceRecorder {
  #description: string;
  #targetRunMode: RunMode;
  #ticRateHz: number;
  #currentTic = 0;
  #events: InputScriptEvent[] = [];

  public constructor(options: VanillaInputTraceRecorderOptions) {
    this.#description = options.description;
    this.#targetRunMode = options.targetRunMode;
    this.#ticRateHz = options.ticRateHz ?? VANILLA_TIC_RATE_HZ;
  }

  /** Current tic index (zero before the first advanceTic call). */
  public get currentTic(): number {
    return this.#currentTic;
  }

  /** Number of events recorded so far. */
  public get recordedEventCount(): number {
    return this.#events.length;
  }

  /** Advance the internal tic counter by one. */
  public advanceTic(): void {
    this.#currentTic += 1;
  }

  /**
   * Record one event tagged with the current tic.  Returns the
   * recorded {@link InputScriptEvent} or `null` when the event has
   * no script-schema analog (e.g. `ev_mouse` with an empty mask).
   */
  public record(event: VanillaEvent): InputScriptEvent | null {
    const scriptEvent = convertVanillaEventToInputScriptEvent(event, this.#currentTic);
    if (scriptEvent !== null) {
      this.#events.push(scriptEvent);
    }
    return scriptEvent;
  }

  /**
   * Freeze the recorded events into a stable
   * {@link InputScriptPayload}.  `totalTics` is set to
   * `currentTic + 1` so the payload covers every tic the recorder
   * observed (including the one currently in progress).
   */
  public freezePayload(): InputScriptPayload {
    return Object.freeze({
      description: this.#description,
      events: Object.freeze([...this.#events]),
      targetRunMode: this.#targetRunMode,
      ticRateHz: this.#ticRateHz,
      totalTics: this.#currentTic === 0 && this.#events.length === 0 ? 0 : this.#currentTic + 1,
    } satisfies InputScriptPayload);
  }
}

/**
 * Replay a serialized {@link InputScriptPayload} into a live
 * {@link VanillaEventQueue}.  The replayer walks the payload's
 * event list in order and posts each event whose `tic` matches the
 * tic passed to {@link replayTic} into the queue.  Events are
 * consumed exactly once; the read cursor advances past them so
 * subsequent calls do not re-post earlier events.
 *
 * The payload's events must already be sorted ascending by tic
 * (per the {@link InputScriptPayload} contract); the replayer does
 * not re-sort them.  Events tagged with tics below the cursor are
 * silently skipped (defensive against caller misuse).
 */
export class VanillaInputTraceReplayer {
  readonly #events: readonly InputScriptEvent[];
  #cursor = 0;

  public constructor(payload: InputScriptPayload) {
    this.#events = payload.events;
  }

  /** Number of events still pending replay. */
  public get pendingEventCount(): number {
    return this.#events.length - this.#cursor;
  }

  /**
   * Replay every event whose `tic === tic` into the supplied queue.
   * Returns the number of events posted to the queue.  Events with
   * `tic < tic` (already past) are silently skipped; events with
   * `tic > tic` (in the future) are left in the pending list.
   */
  public replayTic(tic: number, queue: VanillaEventQueue): number {
    let postedCount = 0;
    while (this.#cursor < this.#events.length) {
      const event = this.#events[this.#cursor]!;
      if (event.tic < tic) {
        this.#cursor += 1;
        continue;
      }
      if (event.tic > tic) {
        break;
      }
      const vanillaEvent = convertInputScriptEventToVanillaEvent(event);
      if (vanillaEvent !== null) {
        queue.post(vanillaEvent);
        postedCount += 1;
      }
      this.#cursor += 1;
    }
    return postedCount;
  }
}
