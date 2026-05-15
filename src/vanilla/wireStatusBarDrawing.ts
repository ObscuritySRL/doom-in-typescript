/**
 * Vanilla DOOM 1.9 status-bar drawing runtime facade.
 *
 * Plan_final step `07-004` (lane: ui) aggregates the status-bar
 * state + per-tic widget functions the HUD pass calls every frame
 * into one cohesive re-export barrel.  The read-only
 * `src/ui/statusBar.ts` module already implements vanilla
 * `st_stuff.c` `ST_Ticker` / `ST_updateFaceWidget` /
 * `ST_calcPainOffset` semantics and is SHA-pinned by the
 * `plan_vanilla_parity` UI inventory; this module does NOT modify
 * it.
 *
 * Wired functions and their Chocolate Doom 2.2.1 origins:
 *
 *   - `createStatusBarState`  — `st_stuff.c` `ST_Init` / `ST_Start`.
 *   - `tickStatusBar`         — `st_stuff.c` `ST_Ticker`.
 *   - `tickFaceWidget`        — `st_stuff.c` `ST_updateFaceWidget`.
 *   - `calcPainOffset`        — `st_stuff.c` `ST_calcPainOffset`.
 *   - `updateKeyBoxes`        — the per-tic key-card box refresh.
 *   - `computeStatusBarValues`— the numbers/percent/ammo/arms value
 *     computation drawn into the framebuffer.
 *
 * @example
 * ```ts
 * import { tickStatusBar, VANILLA_STATUS_BAR_ENTRY_POINTS } from './wireStatusBarDrawing.ts';
 * VANILLA_STATUS_BAR_ENTRY_POINTS.length; // 6
 * ```
 */

export {
  ST_EVILGRINCOUNT,
  ST_MUCHPAIN,
  ST_OUCHCOUNT,
  ST_RAMPAGEDELAY,
  ST_STRAIGHTFACECOUNT,
  ST_TURNCOUNT,
  calcPainOffset,
  computeStatusBarValues,
  createStatusBarState,
  tickFaceWidget,
  tickStatusBar,
  updateKeyBoxes,
} from '../ui/statusBar.ts';

/**
 * Frozen manifest of the six canonical status-bar entry-point names
 * this facade wires, in the order the HUD pass invokes them (state
 * create at level start, then per-tic key-box refresh, face-widget
 * tick, status-bar tick, value computation; calcPainOffset is the
 * shared helper the face-widget tick delegates to).
 */
export const VANILLA_STATUS_BAR_ENTRY_POINTS: readonly string[] = Object.freeze(['calcPainOffset', 'computeStatusBarValues', 'createStatusBarState', 'tickFaceWidget', 'tickStatusBar', 'updateKeyBoxes']);
