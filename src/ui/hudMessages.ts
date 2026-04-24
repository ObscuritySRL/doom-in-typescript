/**
 * HUD message widget and level-title state machine (hu_stuff.c + hu_lib.c).
 *
 * Implements the pure-logic half of the vanilla DOOM heads-up display:
 * the pop-up pickup / door / cheat message ticker (`HU_Ticker`), the
 * per-level title bootstrap (`HU_Start`), and the refresh-key hand-off
 * (`HU_Responder`'s `HU_MSGREFRESH` path).  Pixel drawing and glyph
 * catalogs are out of scope for this step; callers consume
 * {@link HudMessageState} and render through the HUD font catalog from
 * `./assets.ts` (`buildHudFontLumpList`, `HU_FONT_START_CHAR`).
 *
 * Parity invariants preserved byte-for-byte:
 *
 *  - `message_counter` uses the vanilla pre-decrement-in-condition
 *    short-circuit: counter === 0 does NOT decrement, counter > 0
 *    decrements and only expires `messageOn` when the fresh value is
 *    zero.  So a message set with counter = HU_MSGTIMEOUT = 140 is
 *    visible for exactly 140 tics before disappearing on the 141st.
 *  - Protected messages (vanilla `message_nottobefuckedwith`) stall
 *    new `player.message` values until the protected message's counter
 *    expires.  A pickup queued during a protected chat message is held
 *    on `player.message` until `messageOn` flips back to `false`.
 *  - The refresh key (vanilla `HU_MSGREFRESH`, default `Enter`) sets
 *    `messageForce = true` once.  The next tick's display block accepts
 *    the queued message even when another one is protected, and then
 *    INHERITS the force flag as protection for the new message (so a
 *    refresh-forced redraw is itself protected until it expires).
 *  - `showMessages` off (config toggle `message`) suppresses all
 *    normal-path display, but a pending `messageForce` still forces
 *    exactly one display through.  Vanilla's OR gate
 *    `showMessages || message_dontfuckwithme` is preserved verbatim.
 *  - The force flag is consumed on the tick it fires — whether or not
 *    a message was actually pending — matching `message_dontfuckwithme
 *    = 0` at the end of the vanilla display block AND the implicit
 *    flag-drop when `showMessages` is off and no display happened.
 *    This port drops the flag ONLY after a successful display (the
 *    strict vanilla behavior) so a force request queued before the
 *    next pickup fires exactly when that pickup arrives.
 *  - Map-title widget creation (`HUlib_initTextLine(&w_title, ...)` +
 *    `HUlib_addCharToTextLine` loop) reduces to a single `mapTitle`
 *    string field.  Vanilla computes `HU_TITLE = mapnames[(gameepisode
 *    - 1) * 9 + gamemap - 1]` for DOOM gamemission; this port exposes
 *    `getDoom1MapName(episode, map)` returning the exact HUSTR_E?M?
 *    string from `d_englsh.h`.
 *  - `HU_TITLEY = 167 - SHORT(hu_font[0]->height)` evaluates to 160
 *    because `hu_font[0]` is `STCFN033` ('!') with a 7-pixel-tall
 *    patch.  The constant is pinned to 160 here; a renderer that
 *    loaded a non-vanilla HUD font with a different height would need
 *    to recompute the origin, but vanilla never does this on a clean
 *    DOOM1.WAD.
 *  - `hudMessageStart` is the `HU_Start` equivalent: it clears every
 *    transient field (current message, counter, protection, force)
 *    and rewrites `mapTitle` from the caller.  It does NOT touch any
 *    state the caller wants to persist across levels (there is no such
 *    state in vanilla — every HU_Start fully resets).
 *
 * @example
 * ```ts
 * import {
 *   createHudMessageState,
 *   getDoom1MapName,
 *   hudMessageStart,
 *   tickHudMessages,
 * } from "../src/ui/hudMessages.ts";
 *
 * const state = createHudMessageState();
 * hudMessageStart(state, getDoom1MapName(1, 1));
 *
 * player.message = "Picked up a medikit.";
 * tickHudMessages(state, { player, showMessages: true });
 * console.log(state.currentMessage); // "Picked up a medikit."
 * ```
 */

import type { Player } from '../player/playerSpawn.ts';

// ── Tic-based durations (TICRATE = 35) ───────────────────────────────

/** TICRATE: 35 tics per second. */
export const TICRATE = 35;

/** Tics a HUD message stays on screen before expiring (`4 * TICRATE = 140`). */
export const HU_MSGTIMEOUT = 4 * TICRATE;

// ── Pixel positions (320×200 low-res framebuffer) ────────────────────

/** X origin of the message widget, pixels from the left edge. */
export const HU_MSGX = 0;

/** Y origin of the message widget, pixels from the top edge. */
export const HU_MSGY = 0;

/** Height of the message widget in rendered text lines. */
export const HU_MSGHEIGHT = 1;

/** Width of the message widget in characters. */
export const HU_MSGWIDTH = 64;

/** Max characters buffered per text line (`hu_lib.h` HU_MAXLINELENGTH). */
export const HU_MAXLINELENGTH = 80;

/** Height of the map-title widget in text lines. */
export const HU_TITLEHEIGHT = 1;

/** X origin of the map-title widget. */
export const HU_TITLEX = 0;

/**
 * Y origin of the map-title widget, pixels from the top edge.  Vanilla
 * computes `167 - SHORT(hu_font[0]->height)` and `hu_font[0]` is the
 * `STCFN033` ('!') glyph patch, whose vanilla height is 7; the result
 * 160 places the title just above the automap status bar border.
 */
export const HU_TITLEY = 167 - 7;

// ── Map name tables (HUSTR_E<e>M<m> from d_englsh.h) ─────────────────

/** Episode 1 map 1 title shipped in DOOM1.WAD (shareware). */
export const HUSTR_E1M1 = 'E1M1: Hangar';

/** Episode 1 map 2 title shipped in DOOM1.WAD (shareware). */
export const HUSTR_E1M2 = 'E1M2: Nuclear Plant';

/** Episode 1 map 3 title shipped in DOOM1.WAD (shareware). */
export const HUSTR_E1M3 = 'E1M3: Toxin Refinery';

/** Episode 1 map 4 title shipped in DOOM1.WAD (shareware). */
export const HUSTR_E1M4 = 'E1M4: Command Control';

/** Episode 1 map 5 title shipped in DOOM1.WAD (shareware). */
export const HUSTR_E1M5 = 'E1M5: Phobos Lab';

/** Episode 1 map 6 title shipped in DOOM1.WAD (shareware). */
export const HUSTR_E1M6 = 'E1M6: Central Processing';

/** Episode 1 map 7 title shipped in DOOM1.WAD (shareware). */
export const HUSTR_E1M7 = 'E1M7: Computer Station';

/** Episode 1 map 8 title shipped in DOOM1.WAD (shareware). */
export const HUSTR_E1M8 = 'E1M8: Phobos Anomaly';

/** Episode 1 map 9 title shipped in DOOM1.WAD (shareware). */
export const HUSTR_E1M9 = 'E1M9: Military Base';

/** Episode 2 map 1 title (registered / retail). */
export const HUSTR_E2M1 = 'E2M1: Deimos Anomaly';

/** Episode 2 map 2 title (registered / retail). */
export const HUSTR_E2M2 = 'E2M2: Containment Area';

/** Episode 2 map 3 title (registered / retail). */
export const HUSTR_E2M3 = 'E2M3: Refinery';

/** Episode 2 map 4 title (registered / retail). */
export const HUSTR_E2M4 = 'E2M4: Deimos Lab';

/** Episode 2 map 5 title (registered / retail). */
export const HUSTR_E2M5 = 'E2M5: Command Center';

/** Episode 2 map 6 title (registered / retail). */
export const HUSTR_E2M6 = 'E2M6: Halls of the Damned';

/** Episode 2 map 7 title (registered / retail). */
export const HUSTR_E2M7 = 'E2M7: Spawning Vats';

/** Episode 2 map 8 title (registered / retail). */
export const HUSTR_E2M8 = 'E2M8: Tower of Babel';

/** Episode 2 map 9 title (registered / retail). */
export const HUSTR_E2M9 = 'E2M9: Fortress of Mystery';

/** Episode 3 map 1 title (registered / retail). */
export const HUSTR_E3M1 = 'E3M1: Hell Keep';

/** Episode 3 map 2 title (registered / retail). */
export const HUSTR_E3M2 = 'E3M2: Slough of Despair';

/** Episode 3 map 3 title (registered / retail). */
export const HUSTR_E3M3 = 'E3M3: Pandemonium';

/** Episode 3 map 4 title (registered / retail). */
export const HUSTR_E3M4 = 'E3M4: House of Pain';

/** Episode 3 map 5 title (registered / retail). */
export const HUSTR_E3M5 = 'E3M5: Unholy Cathedral';

/** Episode 3 map 6 title (registered / retail). */
export const HUSTR_E3M6 = 'E3M6: Mt. Erebus';

/** Episode 3 map 7 title (registered / retail). */
export const HUSTR_E3M7 = 'E3M7: Limbo';

/** Episode 3 map 8 title (registered / retail). */
export const HUSTR_E3M8 = 'E3M8: Dis';

/** Episode 3 map 9 title (registered / retail). */
export const HUSTR_E3M9 = 'E3M9: Warrens';

/** Episode 4 map 1 title (Ultimate DOOM retail). */
export const HUSTR_E4M1 = 'E4M1: Hell Beneath';

/** Episode 4 map 2 title (Ultimate DOOM retail). */
export const HUSTR_E4M2 = 'E4M2: Perfect Hatred';

/** Episode 4 map 3 title (Ultimate DOOM retail). */
export const HUSTR_E4M3 = 'E4M3: Sever The Wicked';

/** Episode 4 map 4 title (Ultimate DOOM retail). */
export const HUSTR_E4M4 = 'E4M4: Unruly Evil';

/** Episode 4 map 5 title (Ultimate DOOM retail). */
export const HUSTR_E4M5 = 'E4M5: They Will Repent';

/** Episode 4 map 6 title (Ultimate DOOM retail). */
export const HUSTR_E4M6 = 'E4M6: Against Thee Wickedly';

/** Episode 4 map 7 title (Ultimate DOOM retail). */
export const HUSTR_E4M7 = 'E4M7: And Hell Followed';

/** Episode 4 map 8 title (Ultimate DOOM retail). */
export const HUSTR_E4M8 = 'E4M8: Unto The Cruel';

/** Episode 4 map 9 title (Ultimate DOOM retail). */
export const HUSTR_E4M9 = 'E4M9: Fear';

/**
 * Frozen 36-entry table indexed by `(episode - 1) * 9 + (map - 1)`,
 * matching the exact write order of `mapnames[]` in vanilla hu_stuff.c
 * for `gamemission == doom`.  Shareware DOOM1.WAD only guarantees the
 * first 9 entries (E1M1..E1M9); registered adds E2/E3; retail (Ultimate
 * DOOM) adds E4.  Every caller is responsible for enforcing the gamemode
 * boundary before indexing.
 */
export const DOOM1_MAP_NAMES: readonly string[] = Object.freeze([
  HUSTR_E1M1,
  HUSTR_E1M2,
  HUSTR_E1M3,
  HUSTR_E1M4,
  HUSTR_E1M5,
  HUSTR_E1M6,
  HUSTR_E1M7,
  HUSTR_E1M8,
  HUSTR_E1M9,
  HUSTR_E2M1,
  HUSTR_E2M2,
  HUSTR_E2M3,
  HUSTR_E2M4,
  HUSTR_E2M5,
  HUSTR_E2M6,
  HUSTR_E2M7,
  HUSTR_E2M8,
  HUSTR_E2M9,
  HUSTR_E3M1,
  HUSTR_E3M2,
  HUSTR_E3M3,
  HUSTR_E3M4,
  HUSTR_E3M5,
  HUSTR_E3M6,
  HUSTR_E3M7,
  HUSTR_E3M8,
  HUSTR_E3M9,
  HUSTR_E4M1,
  HUSTR_E4M2,
  HUSTR_E4M3,
  HUSTR_E4M4,
  HUSTR_E4M5,
  HUSTR_E4M6,
  HUSTR_E4M7,
  HUSTR_E4M8,
  HUSTR_E4M9,
]);

/**
 * Resolve the canonical HUSTR map title for a 1-based DOOM episode/map
 * pair.  Mirrors `#define HU_TITLE (mapnames[(gameepisode-1)*9 + gamemap-1])`
 * from vanilla hu_stuff.c for `gamemission == doom`.  The function does
 * not validate `gamemode` boundaries — callers consuming a shareware
 * WAD must pin `episode = 1` themselves before calling.
 *
 * @throws {RangeError} If `episode` is not 1..4 or `map` is not 1..9.
 */
export function getDoom1MapName(episode: number, map: number): string {
  if (!Number.isInteger(episode) || episode < 1 || episode > 4) {
    throw new RangeError(`getDoom1MapName: episode must be 1..4, got ${episode}`);
  }
  if (!Number.isInteger(map) || map < 1 || map > 9) {
    throw new RangeError(`getDoom1MapName: map must be 1..9, got ${map}`);
  }
  return DOOM1_MAP_NAMES[(episode - 1) * 9 + (map - 1)]!;
}

// ── State ────────────────────────────────────────────────────────────

/**
 * Mutable HUD-message state.  Mirrors the file-static globals in
 * vanilla hu_stuff.c:
 *
 *  - `currentMessage`   ← the latest text loaded into `w_message` via
 *                         `HUlib_addMessageToSText`.  This port stores
 *                         the string directly instead of a buffered
 *                         `hu_stext_t` because draw-layer formatting
 *                         (glyph widths, line wrap) is out of scope.
 *  - `messageOn`        ← `message_on`
 *  - `messageCounter`   ← `message_counter`
 *  - `messageProtected` ← `message_nottobefuckedwith` (the protection
 *                         lock on the currently-displayed message)
 *  - `messageForce`     ← `message_dontfuckwithme` (the
 *                         `HU_MSGREFRESH` override flag)
 *  - `mapTitle`         ← the text assembled into `w_title` by
 *                         `HUlib_addCharToTextLine` during `HU_Start`
 */
export interface HudMessageState {
  /** The currently displayed message text, or `null` when no message is active. */
  currentMessage: string | null;
  /** `true` while a message is on screen (counter > 0). */
  messageOn: boolean;
  /** Tics remaining until the current message expires (`HU_MSGTIMEOUT` on show). */
  messageCounter: number;
  /** Current message is protected: new `player.message` values are held until expiry. */
  messageProtected: boolean;
  /** `HU_MSGREFRESH` requested: the next tick forces display (and inherits protection). */
  messageForce: boolean;
  /** Level title text for the automap overlay.  `null` before `hudMessageStart` runs. */
  mapTitle: string | null;
}

// ── Constructors / Resetters ─────────────────────────────────────────

/**
 * Allocate a fresh HUD-message state with every field at its vanilla
 * `HU_Init` default (no message, no counter, no force/protection, no
 * title).  The caller runs `hudMessageStart` at each level to bind a
 * title before entering `HU_Drawer`'s automap path.
 */
export function createHudMessageState(): HudMessageState {
  return {
    currentMessage: null,
    messageOn: false,
    messageCounter: 0,
    messageProtected: false,
    messageForce: false,
    mapTitle: null,
  };
}

/**
 * Reset a HUD-message state to the `HU_Start` baseline and bind a new
 * map title.  Called at every level change (`G_DoLoadLevel`).  Clears
 * every transient field so a protected message from the previous level
 * cannot leak into the new one.
 */
export function hudMessageStart(state: HudMessageState, mapTitle: string | null = null): void {
  state.currentMessage = null;
  state.messageOn = false;
  state.messageCounter = 0;
  state.messageProtected = false;
  state.messageForce = false;
  state.mapTitle = mapTitle;
}

// ── Refresh request (HU_MSGREFRESH key) ──────────────────────────────

/**
 * Request that the next `tickHudMessages` call force a display, even
 * over a currently-protected message.  Vanilla sets
 * `message_dontfuckwithme = 1` in the `HU_MSGREFRESH` branch of
 * `HU_Responder`; the tick's display block then inherits the force
 * into `message_nottobefuckedwith`.
 *
 * The flag is consumed only by a successful display.  If the force is
 * requested while `player.message` is null, the flag stays armed so
 * that the NEXT pickup / door denial message inherits the force and
 * the protection that follows — matching the strict vanilla behavior
 * where `message_dontfuckwithme = 0` lives only inside the display
 * block.
 */
export function requestHudMessageRefresh(state: HudMessageState): void {
  state.messageForce = true;
}

// ── Ticker ────────────────────────────────────────────────────────────

/** Context bundle passed into {@link tickHudMessages} every tic. */
export interface HudMessageTickContext {
  /** The player whose `message` field is drained each tic. */
  readonly player: Player;
  /** `showMessages` config flag.  `false` silences all non-forced messages. */
  readonly showMessages: boolean;
}

/**
 * Advance the HUD-message state machine by one tic.
 *
 * Ordered exactly as vanilla `HU_Ticker`:
 *
 *  1. Tick-down: if `messageCounter > 0`, decrement.  A fresh value of
 *     zero expires `messageOn` and `messageProtected` (but NOT
 *     `currentMessage` — drawn layers can still render the trailing
 *     frame).
 *  2. Display block: iff `showMessages || messageForce`, consider
 *     `player.message`.  Show it iff it is non-null AND either the
 *     existing message is not protected or the refresh force is armed.
 *     Successful display: write `currentMessage`, clear
 *     `player.message`, set `messageOn = true`, load the counter with
 *     `HU_MSGTIMEOUT`, inherit the force into protection, then consume
 *     the force flag.
 *
 * A message queued while an earlier one is protected stays on
 * `player.message` until the protected message's counter expires —
 * `player.message` is NEVER cleared by this function except on
 * successful display.
 */
export function tickHudMessages(state: HudMessageState, ctx: HudMessageTickContext): void {
  if (state.messageCounter > 0) {
    state.messageCounter--;
    if (state.messageCounter === 0) {
      state.messageOn = false;
      state.messageProtected = false;
    }
  }

  if (ctx.showMessages || state.messageForce) {
    const message = ctx.player.message;
    if (message !== null) {
      if (!state.messageProtected || state.messageForce) {
        state.currentMessage = message;
        ctx.player.message = null;
        state.messageOn = true;
        state.messageCounter = HU_MSGTIMEOUT;
        state.messageProtected = state.messageForce;
        state.messageForce = false;
      }
    }
  }
}
