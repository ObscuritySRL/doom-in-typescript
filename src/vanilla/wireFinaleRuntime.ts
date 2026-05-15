/**
 * Vanilla DOOM 1.9 finale-runtime wiring facade.
 *
 * Plan_final step `07-008` (lane: ui) wires the finale (f_finale.c)
 * runtime — the typed episode text, the art / bunny-scroll screens,
 * the (commercial) cast call, the text/skip timing, the
 * victor/bunny music, and the transition exit back to the title —
 * over the read-only `src/ui/finale.ts` module.
 *
 * That module already implements the byte-exact f_finale.c
 * `F_Ticker` / `F_TextWrite` / `F_BunnyScroll` behavior and is
 * SHA-pinned by the inventory; this module does NOT modify it.
 * It is a pure re-export barrel (value/type split for
 * `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. Finale text types one character every `TEXTSPEED` = 3 tics
 *      after a `FINALE_TEXT_START_DELAY` = 10-tic lead, then holds
 *      for `TEXTWAIT` = 250 tics before the screen can advance.
 *   2. The episode-3 finale runs the bunny-scroll screen built from
 *      `BUNNY_SCROLL_LUMPS` = `['PFUB1', 'PFUB2']`; episode 2 / 4
 *      use the `E2_ART_LUMP` (VICTORY2) / `E4_ART_LUMP` (ENDPIC)
 *      art screens.
 *   3. The cast call is the commercial `FINALE_CAST_MAP` = 30 path
 *      (not exercised on the C1 shareware target but preserved).
 *   4. The finale music is `mus_victor`, swapping to `mus_bunny`
 *      for the episode-3 bunny scroll (the `FinaleMusicCue`).
 *   5. `tickFinale` returns a result that signals the transition
 *      exit (back to the title loop) once the finale is complete.
 *
 * @example
 * ```ts
 * import { TEXTSPEED, createFinaleState, VANILLA_FINALE_RUNTIME_INVARIANTS } from './wireFinaleRuntime.ts';
 * TEXTSPEED;                                     // 3
 * typeof createFinaleState();                    // 'object'
 * VANILLA_FINALE_RUNTIME_INVARIANTS.length;      // 5
 * ```
 */

export {
  BUNNY_SCROLL_LUMPS,
  E1_FLAT,
  E1_TEXT,
  E2_ART_LUMP,
  E2_FLAT,
  E2_TEXT,
  E3_FLAT,
  E3_TEXT,
  E4_ART_LUMP,
  E4_FLAT,
  E4_TEXT,
  FINALE_CAST_MAP,
  FINALE_COMMERCIAL_SKIP_DELAY,
  FINALE_TEXT_START_DELAY,
  MAXPLAYERS,
  TEXTSPEED,
  TEXTWAIT,
  createFinaleState,
  getFinaleScreen,
  getVisibleCharacterCount,
  startFinale,
  tickFinale,
} from '../ui/finale.ts';
export type { FinaleGameMode, FinaleInput, FinaleMusicCue, FinaleScreen, FinaleStartResult, FinaleState, FinaleTickResult } from '../ui/finale.ts';

/**
 * One pinned finale-runtime parity invariant.
 */
export interface VanillaFinaleRuntimeInvariant {
  readonly id: 'BUNNY_SCROLL_USES_PFUB1_PFUB2_ON_EPISODE_3' | 'CAST_CALL_IS_COMMERCIAL_MAP_30' | 'FINALE_TEXT_TYPES_AT_TEXTSPEED_THEN_WAITS' | 'FINALE_USES_VICTOR_THEN_BUNNY_MUSIC' | 'TICK_FINALE_SIGNALS_THE_TRANSITION_EXIT';
  readonly rule: string;
}

/**
 * Frozen manifest of the five finale-runtime parity invariants this
 * step pins.  A later step that wires the live finale screen must
 * preserve all five.
 */
export const VANILLA_FINALE_RUNTIME_INVARIANTS: readonly VanillaFinaleRuntimeInvariant[] = Object.freeze([
  Object.freeze({
    id: 'BUNNY_SCROLL_USES_PFUB1_PFUB2_ON_EPISODE_3',
    rule: 'The episode-3 finale runs the bunny-scroll built from BUNNY_SCROLL_LUMPS = [PFUB1, PFUB2]; episode 2 uses E2_ART_LUMP (VICTORY2) and episode 4 E4_ART_LUMP (ENDPIC), matching f_finale.c F_BunnyScroll / F_ArtScreenDrawer.',
  } satisfies VanillaFinaleRuntimeInvariant),
  Object.freeze({
    id: 'CAST_CALL_IS_COMMERCIAL_MAP_30',
    rule: 'The cast call is the commercial FINALE_CAST_MAP = 30 path; the C1 shareware target does not reach it, but the constant/path is preserved for parity with f_finale.c F_StartCast.',
  } satisfies VanillaFinaleRuntimeInvariant),
  Object.freeze({
    id: 'FINALE_TEXT_TYPES_AT_TEXTSPEED_THEN_WAITS',
    rule: 'Finale text reveals one character every TEXTSPEED = 3 tics after a FINALE_TEXT_START_DELAY = 10-tic lead, then holds for TEXTWAIT = 250 tics before the screen advances, matching f_finale.c F_TextWrite / F_Ticker.',
  } satisfies VanillaFinaleRuntimeInvariant),
  Object.freeze({
    id: 'FINALE_USES_VICTOR_THEN_BUNNY_MUSIC',
    rule: 'The finale plays mus_victor and swaps to mus_bunny for the episode-3 bunny scroll (the FinaleMusicCue), matching f_finale.c F_StartFinale / F_BunnyScroll.',
  } satisfies VanillaFinaleRuntimeInvariant),
  Object.freeze({
    id: 'TICK_FINALE_SIGNALS_THE_TRANSITION_EXIT',
    rule: 'tickFinale returns a FinaleTickResult that signals the transition exit back to the title loop once the finale (text/art/bunny) is complete and the player advances.',
  } satisfies VanillaFinaleRuntimeInvariant),
]);
