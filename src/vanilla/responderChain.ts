/**
 * Vanilla DOOM 1.9 input responder chain.
 *
 * Plan_final step `03-007` (lane: launch-host-input) wires events
 * drained from the vanilla event queue (built in `03-006`) through
 * the canonical four-position responder chain `D_ProcessEvents`
 * runs in Chocolate Doom 2.2.1's `d_main.c`:
 *
 *   1. `M_Responder`  — main menu (modal; consumes Esc, arrows, etc.).
 *   2. `AM_Responder` — automap (consumes pan/zoom keys when active).
 *   3. `F_Responder`  — finale screen (consumes any key to advance).
 *   4. `G_Responder`  — game (the catch-all that feeds the gameplay
 *      input layer when no UI is modal).
 *
 * Each responder is a function returning `true` when it consumed the
 * event; subsequent responders in the chain are then skipped.  The
 * vanilla source pattern is:
 *
 * ```c
 * if (M_Responder(ev)) return;
 * if (AM_Responder(ev)) return;
 * if (F_Responder(ev)) return;
 * G_Responder(ev);
 * ```
 *
 * This module exposes the dispatch wiring only.  The individual
 * responder bodies are plugged in by later launch-host-input steps
 * (menu, automap, finale, game) — the canonical four-position order
 * is locked here so subsequent steps cannot accidentally reorder
 * the chain.
 *
 * @example
 * ```ts
 * import { routeEventThroughResponderChain, VANILLA_RESPONDER_ORDER } from './responderChain.ts';
 *
 * const responders = [menuResponder, automapResponder, finaleResponder, gameResponder];
 * const result = routeEventThroughResponderChain(event, responders);
 * result.consumedByIndex;            // 0 when menu consumed, etc.
 * result.consumedByName;             // 'M_Responder' or 'AM_Responder' or 'F_Responder' or 'G_Responder' or null
 * VANILLA_RESPONDER_ORDER.length;    // 4
 * ```
 */

import type { VanillaEvent } from './eventQueue.ts';

/**
 * One position in the canonical four-responder chain.  The names
 * match the C symbols from Chocolate Doom 2.2.1's `d_main.c`
 * `D_ProcessEvents`.
 */
export type VanillaResponderName = 'M_Responder' | 'AM_Responder' | 'F_Responder' | 'G_Responder';

/** Frozen four-entry list of responder positions in canonical order. */
export const VANILLA_RESPONDER_ORDER: readonly VanillaResponderName[] = Object.freeze(['M_Responder', 'AM_Responder', 'F_Responder', 'G_Responder']);

/** Number of positions in the canonical responder chain. */
export const VANILLA_RESPONDER_COUNT = 4;

/**
 * One responder callable.  Returns `true` when the responder
 * consumed the event (chain stops); `false` when the event should
 * propagate to the next responder.  Matches the vanilla
 * `boolean Responder(event_t *ev)` signature.
 */
export type VanillaResponder = (event: VanillaEvent) => boolean;

/**
 * Result of routing one event through the canonical chain.
 *
 * `consumedByIndex` is the zero-based index of the responder that
 * returned `true`, or `null` when no responder consumed the event.
 * `consumedByName` mirrors the indexed value as a stable label.
 * `callOrder` lists the names of every responder that was actually
 * invoked, in invocation order — when a responder consumes the
 * event the chain stops there, so `callOrder.length ===
 * consumedByIndex + 1`; when no responder consumes, every responder
 * is invoked and `callOrder.length === 4`.
 */
export interface VanillaResponderChainResult {
  readonly consumedByIndex: number | null;
  readonly consumedByName: VanillaResponderName | null;
  readonly callOrder: readonly VanillaResponderName[];
}

/**
 * Route one event through a four-position responder chain in
 * canonical order.  The chain stops at the first responder that
 * returns `true`; subsequent responders are not invoked.  Throws
 * if `responders.length !== 4` — the canonical chain has exactly
 * four positions and adding/removing one is a parity violation.
 *
 * The four entries in `responders` must be positioned as
 * `[M_Responder, AM_Responder, F_Responder, G_Responder]` — the
 * function does not check the runtime identity of each responder
 * (callers may inject doubles for testing).
 *
 * @param event       The vanilla event to route.
 * @param responders  Exactly four responders in canonical order.
 * @returns A frozen {@link VanillaResponderChainResult}.
 * @throws Error When `responders.length !== 4`.
 */
export function routeEventThroughResponderChain(event: VanillaEvent, responders: readonly VanillaResponder[]): VanillaResponderChainResult {
  if (responders.length !== VANILLA_RESPONDER_COUNT) {
    throw new Error(`routeEventThroughResponderChain expected ${VANILLA_RESPONDER_COUNT} responders; received ${responders.length}`);
  }
  const callOrder: VanillaResponderName[] = [];
  for (let responderIndex = 0; responderIndex < VANILLA_RESPONDER_COUNT; responderIndex += 1) {
    const responderName = VANILLA_RESPONDER_ORDER[responderIndex]!;
    callOrder.push(responderName);
    if (responders[responderIndex]!(event)) {
      return Object.freeze({
        callOrder: Object.freeze([...callOrder]),
        consumedByIndex: responderIndex,
        consumedByName: responderName,
      });
    }
  }
  return Object.freeze({
    callOrder: Object.freeze([...callOrder]),
    consumedByIndex: null,
    consumedByName: null,
  });
}
