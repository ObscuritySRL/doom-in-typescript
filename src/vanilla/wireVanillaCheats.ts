/**
 * Vanilla DOOM 1.9 cheat-flag runtime facade.
 *
 * Plan_final step `09-009` (lane: player-weapons-items) pins the
 * vanilla-scope cheat surface and the demo-parity invariant.  The
 * read-only `src/player/implement-god-mode-and-powerup-flags.ts`
 * module already encodes the only three cheat flags the vanilla
 * 1.9 `player_t.cheats` field carries (matching `doomdef.h`
 * `cheat_t`):
 *
 *   - `VANILLA_CF_NOCLIP = 1`     — IDCLIP / IDSPISPOPD.
 *   - `VANILLA_CF_GODMODE = 2`    — IDDQD.
 *   - `VANILLA_CF_NOMOMENTUM = 4` — the (unused-by-codes) no-momentum
 *     debug flag.
 *
 * The cheat-code keystroke recognition lives in vanilla
 * `st_stuff.c` `ST_Responder` / `m_cheat.c`, which only runs on
 * live keyboard input.  Demo playback feeds the engine ticcmds, NOT
 * raw keystrokes, so a recorded/played demo can NEVER set the cheat
 * flags.  The {@link VANILLA_CHEATS_AFFECT_DEMO_PARITY} constant
 * pins this `false` — cheats do not affect demo parity unless a
 * human actually types the code during a live (non-demo) session.
 *
 * @example
 * ```ts
 * import { isGodMode, VANILLA_CF_GODMODE, VANILLA_CHEATS_AFFECT_DEMO_PARITY } from './wireVanillaCheats.ts';
 * isGodMode(VANILLA_CF_GODMODE);              // true
 * VANILLA_CHEATS_AFFECT_DEMO_PARITY;          // false
 * ```
 */

export { VANILLA_CF_GODMODE, VANILLA_CF_NOCLIP, VANILLA_CF_NOMOMENTUM, isGodMode, isNoMomentum, isNoclip } from '../player/implement-god-mode-and-powerup-flags.ts';

import { VANILLA_CF_GODMODE, VANILLA_CF_NOCLIP, VANILLA_CF_NOMOMENTUM } from '../player/implement-god-mode-and-powerup-flags.ts';

/**
 * Frozen manifest of the only three cheat flag bits the vanilla
 * DOOM 1.9 `player_t.cheats` field carries, keyed by name.  Adding
 * or removing a flag is a parity violation — vanilla has exactly
 * these three.
 */
export const VANILLA_CHEAT_FLAG_BITS: Readonly<Record<'CF_GODMODE' | 'CF_NOCLIP' | 'CF_NOMOMENTUM', number>> = Object.freeze({
  CF_GODMODE: VANILLA_CF_GODMODE,
  CF_NOCLIP: VANILLA_CF_NOCLIP,
  CF_NOMOMENTUM: VANILLA_CF_NOMOMENTUM,
});

/**
 * The demo-parity invariant: cheats do NOT affect demo parity.  A
 * recorded or played-back demo carries ticcmds, not raw keystrokes,
 * and the vanilla cheat-code recognizer (`ST_Responder`) only fires
 * on live keyboard input — so a demo can never toggle a cheat flag.
 * Pinned `false` so a later step cannot accidentally wire a cheat
 * into the demo-driven tick path.
 */
export const VANILLA_CHEATS_AFFECT_DEMO_PARITY = false;
