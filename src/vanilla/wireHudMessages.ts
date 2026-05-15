/**
 * Vanilla DOOM 1.9 HUD-message runtime facade.
 *
 * Plan_final step `07-005` (lane: ui) aggregates the HUD-message
 * state + per-tic functions + Doom 1 map-name resolver the HUD pass
 * calls every tic into one cohesive re-export barrel.  The
 * read-only `src/ui/hudMessages.ts` module already implements
 * vanilla `hu_stuff.c` `HU_Init` / `HU_Start` / `HU_Ticker` and the
 * 4-second message timeout and is SHA-pinned by the
 * `plan_vanilla_parity` UI inventory; this module does NOT modify
 * it.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `createHudMessageState`     — `hu_stuff.c` `HU_Init`.
 *   - `hudMessageStart`           — `hu_stuff.c` `HU_Start`.
 *   - `requestHudMessageRefresh`  — the message-refresh-key handler.
 *   - `tickHudMessages`           — `hu_stuff.c` `HU_Ticker`
 *     (counts down the 4 * TICRATE message timeout).
 *   - `getDoom1MapName`           — the HUSTR map-title lookup.
 *
 * @example
 * ```ts
 * import { tickHudMessages, HU_MSGTIMEOUT, VANILLA_HUD_MESSAGE_ENTRY_POINTS } from './wireHudMessages.ts';
 * HU_MSGTIMEOUT;                              // 140 (4 * 35)
 * VANILLA_HUD_MESSAGE_ENTRY_POINTS.length;    // 5
 * ```
 */

export { HU_MAXLINELENGTH, HU_MSGTIMEOUT, HU_MSGX, HU_MSGY, TICRATE, createHudMessageState, getDoom1MapName, hudMessageStart, requestHudMessageRefresh, tickHudMessages } from '../ui/hudMessages.ts';

/**
 * Frozen manifest of the five canonical HUD-message entry-point
 * names this facade wires, in the order the HUD pass invokes them
 * (state create at level start, start with the map title, the
 * refresh-key request, the per-tic timeout countdown, and the
 * map-name resolver used by `hudMessageStart`).
 */
export const VANILLA_HUD_MESSAGE_ENTRY_POINTS: readonly string[] = Object.freeze(['createHudMessageState', 'getDoom1MapName', 'hudMessageStart', 'requestHudMessageRefresh', 'tickHudMessages']);
