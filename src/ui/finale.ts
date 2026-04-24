/**
 * End-of-episode finale state machine (f_finale.c).
 *
 * Implements the pure-logic half of vanilla DOOM's F_StartFinale /
 * F_Ticker flow: the typewriter text stage (`F_STAGE_TEXT`) that types
 * out the per-episode E*TEXT string one character per `TEXTSPEED` tics
 * after a 10-tic lead-in, the post-text `TEXTWAIT` pause before the
 * automatic transition to the art screen (`F_STAGE_ARTSCREEN`), the
 * episode-3 bunny scroll music swap, and the optional commercial-mode
 * player-skip path that bridges to either `F_STAGE_CAST` (MAP30) or
 * back to `ga_worlddone` (other commercial maps).
 *
 * Parity invariants preserved byte-for-byte from Chocolate Doom 2.2.1
 * f_finale.c:
 *
 *  - `TEXTSPEED = 3` tics per character and `TEXTWAIT = 250` tics of
 *    post-text pause are the two load-bearing constants.  The visible
 *    character count is `(finalecount - 10) / TEXTSPEED` clamped to
 *    `[0, strlen(finaletext)]`; the leading 10-tic delay is vanilla
 *    `F_TextWrite`'s `count = (finalecount - 10) / TEXTSPEED` with
 *    `count < 0` short-circuited to 0.
 *  - `finalecount` pre-increments at the start of every `F_Ticker`
 *    call, then the stage handlers consume the fresh value.  On the
 *    first tick after `startFinale`, `finalecount === 1`.
 *  - The automatic TEXT → ARTSCREEN transition fires on the first
 *    tick where `finalecount > strlen(finaletext) * TEXTSPEED +
 *    TEXTWAIT`.  On that tick `finalecount` is reset to 0 and the
 *    stage is flipped to `F_STAGE_ARTSCREEN`.  The caller is also
 *    asked to request a screen wipe (`wipeRequested: true`) to match
 *    the vanilla `wipegamestate = -1` trigger.
 *  - Episode 3 swaps from `mus_victor` to `mus_bunny` on the same
 *    tick the stage flips to `F_STAGE_ARTSCREEN`, because vanilla
 *    calls `S_StartMusic(mus_bunny)` inside the `if (gameepisode ==
 *    3)` branch after the stage assignment.  Episodes 1/2/4 do NOT
 *    change music at stage transition.
 *  - The Doom 1 finale has no responder — F_Responder short-circuits
 *    to false unless stage is F_STAGE_CAST (Doom 2 only).  Button
 *    presses during Doom 1 TEXT/ARTSCREEN are silently ignored.
 *  - The commercial-mode skip path gates on `finalecount > 50` AND
 *    any player having `cmd.buttons` non-zero that tic; on hit, MAP30
 *    transitions to cast call (`startCast: true`) and other maps
 *    return `worldDone: true`.  Pre-50-tic button presses are ignored
 *    to prevent accidental skips while the text is still starting.
 *  - Per-episode screen data is frozen at module load:
 *      - E1: flat=FLOOR4_8, text=E1TEXT, art=null (shareware stays on
 *            flat; retail ports repaint the same flat as the ArtScreen
 *            background), bunnyScroll=false, music cue `mus_victor`.
 *      - E2: flat=SFLR6_1, text=E2TEXT, art=VICTORY2, bunnyScroll=false.
 *      - E3: flat=MFLR8_4, text=E3TEXT, art=null (uses bunny scroll
 *            PFUB1/PFUB2 instead), bunnyScroll=true, artScreenMusic=
 *            `mus_bunny`.
 *      - E4: flat=MFLR8_3, text=E4TEXT, art=ENDPIC (Ultimate DOOM
 *            only; shareware/registered never reach episode 4).
 *  - `getVisibleCharacterCount(state)` returns 0 when no finale is
 *    active, when stage is not `Text`, or when `finalecount <= 10`.
 *    Otherwise it returns `min((finalecount - 10) / TEXTSPEED,
 *    strlen(text))`.  Callers render exactly that many characters
 *    and the rest as whitespace — vanilla's `F_TextWrite` iterates
 *    the first `count` bytes of `finaletext` and walks the remaining
 *    columns without emitting glyphs.
 *
 * The cast call (`F_STAGE_CAST`) is declared for type completeness but
 * the ticker implementation is a no-op for the Doom 1 shareware target
 * (cast is Doom 2 MAP30 only); a future commercial step can fill in
 * `castorder[]` iteration without refactoring the state shape.
 *
 * @example
 * ```ts
 * import {
 *   FinaleStage,
 *   createFinaleState,
 *   startFinale,
 *   tickFinale,
 *   getVisibleCharacterCount,
 * } from "../src/ui/finale.ts";
 *
 * const state = createFinaleState();
 * const { music } = startFinale(state, { episode: 1 });
 * // music === "mus_victor"; state.stage === FinaleStage.Text
 *
 * for (let i = 0; i < 100; i++) {
 *   tickFinale(state, { anyButtonPressed: false });
 * }
 * console.log(getVisibleCharacterCount(state));  // 30
 * ```
 */

// ── Vanilla constants (f_finale.c `#define`s) ───────────────────────

/** Tics per visible character during the text stage (`#define TEXTSPEED 3`). */
export const TEXTSPEED = 3;

/** Tics the text stage waits after the last character before auto-advancing (`#define TEXTWAIT 250`). */
export const TEXTWAIT = 250;

/**
 * Lead-in delay before the first character becomes visible.  Vanilla
 * `F_TextWrite` computes `count = (finalecount - 10) / TEXTSPEED`, so
 * `finalecount <= 10` yields zero visible characters.
 */
export const FINALE_TEXT_START_DELAY = 10;

/**
 * Minimum `finalecount` value before the commercial-mode skip accepts
 * player button input.  Vanilla F_Ticker: `if (gamemode == commercial
 * && finalecount > 50)`.  Pre-50 button presses are ignored to stop
 * accidental skips while the text is still starting.
 */
export const FINALE_COMMERCIAL_SKIP_DELAY = 50;

/**
 * Commercial-mode map that bridges to the cast call instead of the
 * next map on player skip.  Vanilla F_Ticker: `if (gamemap == 30)
 * F_StartCast(); else gameaction = ga_worlddone;`.
 */
export const FINALE_CAST_MAP = 30;

/** Vanilla `MAXPLAYERS` capacity for the any-button-pressed scan. */
export const MAXPLAYERS = 4;

// ── Stage enum (f_finale.c `finalestage_t`) ─────────────────────────

/**
 * Top-level finale stage.  Numeric values match vanilla f_finale.c's
 * `finalestage_t`: `F_STAGE_TEXT=0`, `F_STAGE_ARTSCREEN=1`,
 * `F_STAGE_CAST=2`.
 */
export enum FinaleStage {
  Text = 0,
  ArtScreen = 1,
  Cast = 2,
}

// ── Music + game mode string unions ─────────────────────────────────

/**
 * Music cue emitted by `startFinale` (first tick) or by the
 * TEXT→ARTSCREEN transition on episode 3.  `mus_victor` is the
 * universal episode-complete track; `mus_bunny` is the episode-3
 * bunny-scroll track; `mus_read_m` is the Doom 2 commercial finale
 * track (declared for future use but never emitted by the Doom 1
 * path).
 */
export type FinaleMusicCue = 'mus_victor' | 'mus_bunny' | 'mus_read_m';

/**
 * Game-mode discriminator used by the commercial skip gate.  C1
 * shareware target always passes `"shareware"`; `"commercial"` is
 * the only mode that unlocks the skip-to-next-map or skip-to-cast
 * paths.
 */
export type FinaleGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

// ── Per-episode screen data ─────────────────────────────────────────

/** Background flat lump for episode 1 (`FLOOR4_8`). */
export const E1_FLAT = 'FLOOR4_8';

/** Background flat lump for episode 2 (`SFLR6_1`). */
export const E2_FLAT = 'SFLR6_1';

/** Background flat lump for episode 3 (`MFLR8_4`). */
export const E3_FLAT = 'MFLR8_4';

/** Background flat lump for episode 4 (`MFLR8_3`). */
export const E4_FLAT = 'MFLR8_3';

/** Art-screen patch lump for episode 2 (Romero's face — `VICTORY2`). */
export const E2_ART_LUMP = 'VICTORY2';

/** Art-screen patch lump for episode 4 (`ENDPIC`, Ultimate DOOM only). */
export const E4_ART_LUMP = 'ENDPIC';

/**
 * Bunny-scroll art lumps for episode 3's art-screen stage.  Vanilla
 * paints `PFUB1` and `PFUB2` side-by-side and scrolls left; the art
 * stage also renders the `END0`..`END6` letter glyphs sequentially.
 */
export const BUNNY_SCROLL_LUMPS: readonly string[] = Object.freeze(['PFUB1', 'PFUB2']);

/**
 * Vanilla `E1TEXT` (d_englsh.h).  Preserve the double-space inside
 * "Deimos base.  Looks like" byte-for-byte — a refactor that
 * normalizes whitespace would shift the automatic TEXT→ARTSCREEN
 * transition by `TEXTSPEED` tics per collapsed space.
 */
export const E1_TEXT =
  'Once you beat the big badasses and\n' +
  "clean out the moon base you're supposed\n" +
  "to win, aren't you? Aren't you? Where's\n" +
  'your fat reward and ticket home? What\n' +
  "the hell is this? It's not supposed to\n" +
  'end this way!\n' +
  '\n' +
  'It stinks like rotten meat, but looks\n' +
  'like the lost Deimos base.  Looks like\n' +
  "you're stuck on The Shores of Hell.\n" +
  'The only way out is through.\n' +
  '\n' +
  'To continue the DOOM experience, play\n' +
  'The Shores of Hell and its amazing\n' +
  'sequel, Inferno!';

/**
 * Vanilla `E2TEXT` (d_englsh.h).  Preserve the double-space inside
 * "rappel down to  the surface of" byte-for-byte.
 */
export const E2_TEXT =
  "You've done it! The hideous cyber-\n" +
  'demon lord that ruled the lost Deimos\n' +
  'moon base has been slain and you\n' +
  'are triumphant! But ... where are\n' +
  'you? You clamber to the edge of the\n' +
  'moon and look down to see the awful\n' +
  'truth.\n' +
  '\n' +
  'Deimos floats above Hell itself!\n' +
  "You've never heard of anyone escaping\n" +
  "from Hell, but you'll make the bastards\n" +
  'sorry they ever heard of you! Quickly,\n' +
  'you rappel down to  the surface of\n' +
  'Hell.\n' +
  '\n' +
  "Now, it's on to the final chapter of\n" +
  'DOOM! -- Inferno.';

/** Vanilla `E3TEXT` (d_englsh.h). */
export const E3_TEXT =
  'The loathsome spiderdemon that\n' +
  'masterminded the invasion of the moon\n' +
  'bases and caused so much death has had\n' +
  'its ass kicked for all time.\n' +
  '\n' +
  'A hidden doorway opens and you enter.\n' +
  "You've proven too tough for Hell to\n" +
  'contain, and now Hell at last plays\n' +
  'fair -- for you emerge from the door\n' +
  'to see the green fields of Earth!\n' +
  'Home at last.\n' +
  '\n' +
  "You wonder what's been happening on\n" +
  'Earth while you were battling evil\n' +
  "unleashed. It's good that no Hell-\n" +
  'spawn could have come through that\n' +
  'door with you ...';

/**
 * Vanilla `E4TEXT` (d_englsh.h).  All lowercase is intentional and
 * matches the shipped DOOM2 / Ultimate DOOM retro styling.
 */
export const E4_TEXT =
  'the spider mastermind must have sent forth\n' +
  'its legions of hellspawn before your\n' +
  'final confrontation with that terrible\n' +
  'beast from hell.  but you stepped forward\n' +
  'and brought forth eternal damnation and\n' +
  'suffering upon the horde as a true hero\n' +
  'would in the face of something so evil.\n' +
  '\n' +
  'besides, someone was gonna pay for what\n' +
  'happened to daisy, your pet rabbit.\n' +
  '\n' +
  'but now, you see spread before you more\n' +
  'potential pain and gibbitude as a nation\n' +
  'of demons run amok among our cities.\n' +
  '\n' +
  'next stop, hell on earth!';

/**
 * Per-episode finale screen data (flat, text, art, music).  Mirrors
 * the `switch (gameepisode)` block in vanilla `F_StartFinale`.
 */
export interface FinaleScreen {
  readonly episode: number;
  readonly flat: string;
  readonly text: string;
  readonly artLump: string | null;
  readonly bunnyScroll: boolean;
  readonly startMusic: FinaleMusicCue;
  readonly artScreenMusic: FinaleMusicCue | null;
}

const DOOM1_SCREENS: readonly FinaleScreen[] = Object.freeze([
  Object.freeze({
    episode: 1,
    flat: E1_FLAT,
    text: E1_TEXT,
    artLump: null,
    bunnyScroll: false,
    startMusic: 'mus_victor' as FinaleMusicCue,
    artScreenMusic: null,
  }),
  Object.freeze({
    episode: 2,
    flat: E2_FLAT,
    text: E2_TEXT,
    artLump: E2_ART_LUMP,
    bunnyScroll: false,
    startMusic: 'mus_victor' as FinaleMusicCue,
    artScreenMusic: null,
  }),
  Object.freeze({
    episode: 3,
    flat: E3_FLAT,
    text: E3_TEXT,
    artLump: null,
    bunnyScroll: true,
    startMusic: 'mus_victor' as FinaleMusicCue,
    artScreenMusic: 'mus_bunny' as FinaleMusicCue,
  }),
  Object.freeze({
    episode: 4,
    flat: E4_FLAT,
    text: E4_TEXT,
    artLump: E4_ART_LUMP,
    bunnyScroll: false,
    startMusic: 'mus_victor' as FinaleMusicCue,
    artScreenMusic: null,
  }),
]);

/**
 * Return the frozen {@link FinaleScreen} for the given episode.
 * Throws `RangeError` when `episode` is not an integer in `[1, 4]`.
 */
export function getFinaleScreen(episode: number): FinaleScreen {
  if (!Number.isInteger(episode) || episode < 1 || episode > 4) {
    throw new RangeError(`getFinaleScreen: episode must be an integer in [1, 4], got ${episode}`);
  }
  return DOOM1_SCREENS[episode - 1]!;
}

// ── Input + state shapes ────────────────────────────────────────────

/**
 * Per-tic finale input.  Mirrors the union of all players' ticcmd
 * button bitmasks: `anyButtonPressed === true` if ANY player has a
 * non-zero `cmd.buttons` this tic.  `gameMode` + `mapNumber` gate the
 * commercial skip path; shareware callers always pass
 * `gameMode: "shareware"` and the skip is silently inactive.
 */
export interface FinaleInput {
  readonly anyButtonPressed: boolean;
  readonly gameMode: FinaleGameMode;
  readonly mapNumber: number;
}

/**
 * Finale state machine.  Fields map 1:1 to f_finale.c statics:
 *
 *  - `active`       ← caller-owned arming bool (vanilla uses
 *                     `gamestate === GS_FINALE`)
 *  - `stage`        ← `finalestage`
 *  - `finalecount`  ← `finalecount`
 *  - `screen`       ← the `(finaleflat, finaletext)` pair chosen in
 *                     F_StartFinale, kept together so the drawer can
 *                     read it as one snapshot
 */
export interface FinaleState {
  active: boolean;
  stage: FinaleStage;
  finalecount: number;
  screen: FinaleScreen | null;
}

/**
 * Result of `startFinale`: the chosen screen + the initial music cue
 * the caller plays on the same tick (vanilla calls `S_ChangeMusic
 * (mus_victor, true)` in F_StartFinale unconditionally for Doom 1).
 */
export interface FinaleStartResult {
  readonly screen: FinaleScreen;
  readonly music: FinaleMusicCue;
}

/**
 * Result of `tickFinale`.  `stageChanged === true` on the tick the
 * TEXT→ARTSCREEN transition fires.  `music` is non-null on transition
 * for episode 3 (switching to `mus_bunny`).  `wipeRequested` mirrors
 * vanilla `wipegamestate = -1` at the transition tick.  `worldDone`
 * and `startCast` are the two commercial-skip outcomes: MAP30 fires
 * `startCast`, other commercial maps fire `worldDone`.
 */
export interface FinaleTickResult {
  readonly stageChanged: boolean;
  readonly music: FinaleMusicCue | null;
  readonly wipeRequested: boolean;
  readonly worldDone: boolean;
  readonly startCast: boolean;
}

// ── Factories / entrypoints ─────────────────────────────────────────

/**
 * Create a fresh finale state.  The state is inert (`active: false`)
 * until a call to {@link startFinale} seeds it with a screen.
 */
export function createFinaleState(): FinaleState {
  return {
    active: false,
    stage: FinaleStage.Text,
    finalecount: 0,
    screen: null,
  };
}

/**
 * Begin a new finale.  Mirrors `F_StartFinale`: selects the screen
 * for the episode, arms TEXT stage, resets `finalecount = 0`, and
 * returns the initial `mus_victor` music cue for the caller to feed
 * the sound manager.
 *
 * Throws `RangeError` on invalid episode.
 */
export function startFinale(state: FinaleState, config: { episode: number }): FinaleStartResult {
  const screen = getFinaleScreen(config.episode);
  state.active = true;
  state.stage = FinaleStage.Text;
  state.finalecount = 0;
  state.screen = screen;
  return { screen, music: screen.startMusic };
}

/**
 * Advance the finale one tic.  Mirrors `F_Ticker`:
 *
 *  1. If commercial mode AND `finalecount > 50` AND any player
 *     pressed a button: bridge to cast (MAP30) or world-done (other
 *     maps) and short-circuit.
 *  2. Pre-increment `finalecount`.
 *  3. If stage is TEXT and `finalecount > strlen * TEXTSPEED +
 *     TEXTWAIT`: reset `finalecount = 0`, flip to ARTSCREEN, request
 *     wipe.  On episode 3, emit `mus_bunny` music cue.
 *  4. (Stage CAST handler is a no-op for the Doom 1 target; future
 *     commercial step plugs in `F_CastTicker` here.)
 *
 * No-ops when `state.active === false`.
 */
export function tickFinale(state: FinaleState, input: FinaleInput): FinaleTickResult {
  let stageChanged = false;
  let music: FinaleMusicCue | null = null;
  let wipeRequested = false;
  let worldDone = false;
  let startCast = false;

  if (!state.active || state.screen === null) {
    return { stageChanged, music, wipeRequested, worldDone, startCast };
  }

  if (input.gameMode === 'commercial' && state.finalecount > FINALE_COMMERCIAL_SKIP_DELAY && input.anyButtonPressed && state.stage === FinaleStage.Text) {
    if (input.mapNumber === FINALE_CAST_MAP) {
      startCast = true;
      state.stage = FinaleStage.Cast;
      state.finalecount = 0;
    } else {
      worldDone = true;
      state.active = false;
    }
    return { stageChanged, music, wipeRequested, worldDone, startCast };
  }

  state.finalecount++;

  if (state.stage === FinaleStage.Text) {
    const threshold = state.screen.text.length * TEXTSPEED + TEXTWAIT;
    if (state.finalecount > threshold) {
      state.finalecount = 0;
      state.stage = FinaleStage.ArtScreen;
      stageChanged = true;
      wipeRequested = true;
      if (state.screen.artScreenMusic !== null) {
        music = state.screen.artScreenMusic;
      }
    }
  }

  return { stageChanged, music, wipeRequested, worldDone, startCast };
}

/**
 * Return the number of visible characters during the TEXT stage.
 * Mirrors vanilla `F_TextWrite`'s `count = (finalecount - 10) /
 * TEXTSPEED` with `count < 0 → 0` and `count > strlen → strlen`
 * clamps.  Returns 0 for inactive states, non-Text stages, or when
 * `finalecount <= FINALE_TEXT_START_DELAY`.
 */
export function getVisibleCharacterCount(state: FinaleState): number {
  if (!state.active || state.screen === null) return 0;
  if (state.stage !== FinaleStage.Text) return 0;
  const count = Math.trunc((state.finalecount - FINALE_TEXT_START_DELAY) / TEXTSPEED);
  if (count <= 0) return 0;
  const max = state.screen.text.length;
  if (count > max) return max;
  return count;
}
