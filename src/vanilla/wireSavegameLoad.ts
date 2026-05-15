/**
 * Vanilla DOOM 1.9 savegame-load wiring facade.
 *
 * Plan_final step `12-005` (lane: save-config-demo) wires the
 * savegame load path: the version check / corrupted-save guard, the
 * `SAVEGAME_EOF` terminator, the world/thinker/special state
 * restore, and the post-load render / audio / input refresh, over
 * the read-only `src/save/loadgame.ts` and
 * `src/save/restore-post-load-render-audio-input-state.ts` modules.
 *
 * Those modules already implement the byte-exact `G_DoLoadGame` /
 * post-load reset behavior from Chocolate Doom 2.2.1 and are
 * SHA-pinned by the inventory; this module does NOT modify them.
 * It is a pure re-export barrel (value/type split for
 * `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. State restore goes through `readLoadGame`, which parses the
 *      header, players, world, thinkers and specials in the vanilla
 *      order.
 *   2. A corrupted save or a version-field mismatch makes
 *      `readLoadGame` return `null` (vanilla aborts the load and
 *      keeps the current game), never a partial restore.
 *   3. The save stream ends with the `SAVEGAME_EOF` = `0x1d`
 *      terminator byte.
 *   4. The post-load reset is the fixed six-step
 *      `VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER`:
 *      `R_FillBackScreen` → `R_ExecuteSetViewSize` → `R_SetupFrame`
 *      → `S_Start` → `I_ResetKey` → `D_ResetMouseDeltas`.
 *   5. That order is render first, then audio (`S_Start`), then
 *      input (`I_ResetKey` / `D_ResetMouseDeltas`);
 *      `vanillaPostLoadResetSubsystemFor` classifies each step and
 *      `vanillaPostLoadResetOrderIndex` returns its fixed position.
 *
 * @example
 * ```ts
 * import { vanillaPostLoadResetOrderIndex, SAVEGAME_EOF, VANILLA_SAVEGAME_LOAD_INVARIANTS } from './wireSavegameLoad.ts';
 * vanillaPostLoadResetOrderIndex('S_Start');          // 3
 * SAVEGAME_EOF;                                       // 0x1d
 * VANILLA_SAVEGAME_LOAD_INVARIANTS.length;            // 5
 * ```
 */

export { SAVEGAME_EOF, readLoadGame } from '../save/loadgame.ts';
export type { LoadGameLayout, LoadGameRestore } from '../save/loadgame.ts';
export { VANILLA_POST_LOAD_RESET_GROUPS, VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER, vanillaPostLoadResetOrderIndex, vanillaPostLoadResetSubsystemFor } from '../save/restore-post-load-render-audio-input-state.ts';
export type { VanillaPostLoadResetGroup } from '../save/restore-post-load-render-audio-input-state.ts';

/**
 * One pinned savegame-load parity invariant.
 */
export interface VanillaSavegameLoadInvariant {
  readonly id: 'CORRUPTED_OR_WRONG_VERSION_LOAD_RETURNS_NULL' | 'POST_LOAD_RESET_ORDER_IS_SIX_FIXED_STEPS' | 'POST_LOAD_RESET_RUNS_RENDER_THEN_AUDIO_THEN_INPUT' | 'SAVEGAME_EOF_MARKER_IS_0x1D' | 'STATE_RESTORE_GOES_THROUGH_READLOADGAME';
  readonly rule: string;
}

/**
 * Frozen manifest of the five savegame-load parity invariants this
 * step pins.  A later step that drives the live load must preserve
 * all five.
 */
export const VANILLA_SAVEGAME_LOAD_INVARIANTS: readonly VanillaSavegameLoadInvariant[] = Object.freeze([
  Object.freeze({
    id: 'CORRUPTED_OR_WRONG_VERSION_LOAD_RETURNS_NULL',
    rule: 'readLoadGame returns null on a corrupted save or a version-field mismatch — vanilla aborts G_DoLoadGame and keeps the current game rather than applying a partial restore.',
  } satisfies VanillaSavegameLoadInvariant),
  Object.freeze({
    id: 'POST_LOAD_RESET_ORDER_IS_SIX_FIXED_STEPS',
    rule: 'VANILLA_POST_LOAD_SUBSYSTEM_RESET_ORDER is the frozen six-step list [R_FillBackScreen, R_ExecuteSetViewSize, R_SetupFrame, S_Start, I_ResetKey, D_ResetMouseDeltas]; vanillaPostLoadResetOrderIndex returns each step fixed position.',
  } satisfies VanillaSavegameLoadInvariant),
  Object.freeze({
    id: 'POST_LOAD_RESET_RUNS_RENDER_THEN_AUDIO_THEN_INPUT',
    rule: 'The post-load reset runs render (R_FillBackScreen / R_ExecuteSetViewSize / R_SetupFrame) first, then audio (S_Start), then input (I_ResetKey / D_ResetMouseDeltas); vanillaPostLoadResetSubsystemFor classifies each step into that subsystem.',
  } satisfies VanillaSavegameLoadInvariant),
  Object.freeze({
    id: 'SAVEGAME_EOF_MARKER_IS_0x1D',
    rule: 'The savegame byte stream ends with the SAVEGAME_EOF = 0x1d terminator, matching vanilla p_saveg.c.',
  } satisfies VanillaSavegameLoadInvariant),
  Object.freeze({
    id: 'STATE_RESTORE_GOES_THROUGH_READLOADGAME',
    rule: 'World/thinker/special state is restored only through readLoadGame, which parses header -> players -> world -> thinkers -> specials in the vanilla G_DoLoadGame order.',
  } satisfies VanillaSavegameLoadInvariant),
]);
