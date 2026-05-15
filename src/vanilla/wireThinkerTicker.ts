/**
 * Vanilla DOOM 1.9 P_Ticker thinker-run wiring.
 *
 * Plan_final step `08-002` (lane: map-world) wires the read-only
 * {@link ThinkerList} ring (`src/world/thinkers.ts`) into a
 * P_Ticker-shaped driver.  Chocolate Doom 2.2.1 `p_tick.c`
 * `P_Ticker` calls `P_RunThinkers()` once per game tic after the
 * player tickers and before the special-line/scroll tickers; every
 * mobj's `P_MobjThinker`, every active sector special's think
 * function, and every flying-missile / particle thinker is invoked
 * through the single `P_RunThinkers` ring walk.
 *
 * The {@link ThinkerList} already implements the parity-critical
 * semantics:
 *
 *   - `add` (P_AddThinker) tail-inserts before the sentinel so new
 *     thinkers run AFTER existing ones within the same tic when
 *     they are inserted earlier in the same ring walk.
 *   - `remove` (P_RemoveThinker) only marks the node `REMOVED`; the
 *     actual unlink is deferred to the next `run` so a thinker can
 *     safely remove itself from inside its own action.
 *   - `run` (P_RunThinkers) captures each live node's `next` pointer
 *     AFTER calling its action, so a thinker added during another
 *     thinker's action IS visited in the same tic — matching
 *     vanilla's `currentthinker = currentthinker->next` placement.
 *
 * This step exposes a thin `runVanillaPTicker` driver that performs
 * exactly one `P_RunThinkers` pass.  Later map-world steps layer
 * the player ticker, special-line ticker, and scroll/animation
 * tickers around this call in the canonical P_Ticker order; this
 * step pins the thinker-run step itself.
 *
 * @example
 * ```ts
 * import { runVanillaPTicker } from './wireThinkerTicker.ts';
 * import { ThinkerList } from '../world/thinkers.ts';
 *
 * const list = new ThinkerList();
 * list.init();
 * list.add(someMobjThinker);
 * runVanillaPTicker(list);   // invokes someMobjThinker.action once
 * ```
 */

import type { ThinkerList } from '../world/thinkers.ts';

/**
 * Run one P_RunThinkers pass over the supplied thinker ring,
 * mirroring the `P_RunThinkers()` call inside vanilla
 * `p_tick.c` `P_Ticker`.  Deferred-removed thinkers are unlinked
 * (their action not invoked); live thinkers have their action
 * called once; thinkers added during this pass are visited in the
 * same pass.
 *
 * @param thinkerList The level's thinker ring (from `08-001` map
 *                     setup; populated by mobj spawn + special
 *                     activation).
 */
export function runVanillaPTicker(thinkerList: ThinkerList): void {
  thinkerList.run();
}
