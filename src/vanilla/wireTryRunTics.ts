/**
 * Vanilla DOOM 1.9 TryRunTics wiring.
 *
 * Plan_final step `04-004` (lane: runtime-core) wires the read-only
 * {@link TicRunner} class from `src/bootstrap/tryRunTics.ts` to live
 * callbacks driven by the event queue from `03-006` and the runtime
 * context from `04-001`, replacing the contract-only TryRunTics
 * stubs supplied earlier in the lane.
 *
 * The {@link TicRunner} contract has five callback slots
 * ({@link TicCallbacks}):
 *
 *   - `startTic`        — drain the input event queue (vanilla's
 *                         `I_StartTic + D_ProcessEvents`).
 *   - `buildTiccmd`     — build the console-player ticcmd.
 *   - `ticker`          — advance one game tic.
 *   - `advancedemo`     — title-loop demo-advance pending flag.
 *   - `doAdvanceDemo`   — run the demo advance.
 *
 * This step's wiring stays minimal but observable: each callback
 * mutates a {@link VanillaTryRunTicsState} so the focused test can
 * assert the canonical TryRunTics order without depending on the
 * real subsystems (game ticker, demo ticker, render invalidation —
 * each lands in a separate runtime-core step).  The wiring proves:
 *
 *   - Every queued event reaches the runtime via `startTic` (the
 *     drained events are appended to `state.drainedEvents`).
 *   - `buildTiccmd` is called once per newly-elapsed tic and
 *     returns an `EMPTY_TICCMD` (real ticcmd building lands in the
 *     player-weapons-items lane).
 *   - `ticker` increments `state.tickerInvocations` per executed
 *     tic and sets `state.renderInvalidated` so the host bring-up
 *     step can blit a fresh frame.
 *   - `advancedemo` returns `state.advanceDemoRequested`; when
 *     true the runner calls `doAdvanceDemo`, which clears the flag
 *     and increments `state.advanceDemoInvocations`.
 *
 * @example
 * ```ts
 * import { TicRunner } from '../bootstrap/tryRunTics.ts';
 * import { VanillaEventQueue } from './eventQueue.ts';
 * import { createVanillaTryRunTicsState, buildVanillaTicCallbacks, runVanillaTryRunTicsDriver } from './wireTryRunTics.ts';
 *
 * const runner = new TicRunner();
 * const queue = new VanillaEventQueue();
 * const state = createVanillaTryRunTicsState();
 *
 * runVanillaTryRunTicsDriver(runner, { getTime: () => 1 }, state, queue);
 * state.tickerInvocations;   // 1
 * state.renderInvalidated;   // true
 * ```
 */

import type { TicCallbacks, TicTimeSource } from '../bootstrap/tryRunTics.ts';
import { TicRunner } from '../bootstrap/tryRunTics.ts';
import type { TicCommand } from '../input/ticcmd.ts';
import { EMPTY_TICCMD } from '../input/ticcmd.ts';
import type { VanillaEvent, VanillaEventQueue } from './eventQueue.ts';

/**
 * Mutable wiring state observed by the {@link TicCallbacks} bodies.
 *
 * The four counters (`startTicInvocations`, `buildTiccmdInvocations`,
 * `tickerInvocations`, `advanceDemoInvocations`) increment per
 * callback invocation.  `drainedEvents` accumulates every event the
 * queue drained during `startTic`.  `renderInvalidated` flips to
 * `true` whenever the ticker runs; a subsequent host bring-up step
 * resets it after presenting a fresh frame.  `advanceDemoRequested`
 * is the writable backing slot for the `advancedemo` callback —
 * external callers set this to `true` to request a demo advance on
 * the next tic; `doAdvanceDemo` clears it after the title-loop
 * advance lands.
 */
export interface VanillaTryRunTicsState {
  startTicInvocations: number;
  buildTiccmdInvocations: number;
  tickerInvocations: number;
  advanceDemoInvocations: number;
  renderInvalidated: boolean;
  advanceDemoRequested: boolean;
  readonly drainedEvents: VanillaEvent[];
}

/**
 * Build a fresh {@link VanillaTryRunTicsState} with every counter at
 * zero and an empty drained-events log.
 */
export function createVanillaTryRunTicsState(): VanillaTryRunTicsState {
  return {
    advanceDemoInvocations: 0,
    advanceDemoRequested: false,
    buildTiccmdInvocations: 0,
    drainedEvents: [],
    renderInvalidated: false,
    startTicInvocations: 0,
    tickerInvocations: 0,
  };
}

/**
 * Build a {@link TicCallbacks} bound to the supplied state and event
 * queue.  Each callback mutates the state per the contract in the
 * module docstring.  The returned object is not frozen — `TicRunner`
 * reads the `advancedemo` slot fresh on every iteration, and the
 * getter reads from `state.advanceDemoRequested` at read time.
 */
export function buildVanillaTicCallbacks(state: VanillaTryRunTicsState, eventQueue: VanillaEventQueue): TicCallbacks {
  return {
    buildTiccmd: (): TicCommand => {
      state.buildTiccmdInvocations += 1;
      return EMPTY_TICCMD;
    },
    doAdvanceDemo: (): void => {
      state.advanceDemoInvocations += 1;
      state.advanceDemoRequested = false;
    },
    get advancedemo(): boolean {
      return state.advanceDemoRequested;
    },
    startTic: (): void => {
      state.startTicInvocations += 1;
      const drained = eventQueue.drainAll();
      for (let drainedIndex = 0; drainedIndex < drained.length; drainedIndex += 1) {
        state.drainedEvents.push(drained[drainedIndex]!);
      }
    },
    ticker: (): void => {
      state.tickerInvocations += 1;
      state.renderInvalidated = true;
    },
  };
}

/**
 * Drive one {@link TicRunner.tryRunTics} call using the runtime
 * wiring.  The runner builds ticcmds for any newly-elapsed tics
 * (per the `timeSource.getTime()` delta) and then runs the
 * available tics through {@link buildVanillaTicCallbacks}.  Returns
 * the number of tics the runner executed.
 *
 * @param runner      A `TicRunner` instance (caller owns the
 *                    instance so the gametic/maketic counters carry
 *                    across frames).
 * @param timeSource  The `TicTimeSource` providing the current
 *                    absolute tic count.
 * @param state       The wiring state — mutated in place as the
 *                    callbacks fire.
 * @param eventQueue  The vanilla event queue — drained by
 *                    `startTic` once per newly-elapsed tic.
 * @returns The number of tics executed.
 */
export function runVanillaTryRunTicsDriver(runner: TicRunner, timeSource: TicTimeSource, state: VanillaTryRunTicsState, eventQueue: VanillaEventQueue): number {
  const callbacks = buildVanillaTicCallbacks(state, eventQueue);
  return runner.tryRunTics(timeSource, callbacks);
}
