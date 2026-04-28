/**
 * Audit ledger for the vanilla DOOM 1.9 game tic counter ownership —
 * the precise semantics of `gametic`, the file-scope `int` counter
 * declared in `linuxdoom-1.10/g_game.c` that drives every per-tic
 * decision in the engine: monster behaviour scheduled on
 * `(gametic & 3)` tic boundaries (A_Tracer trail, see
 * `src/ai/attacks.ts:702`), menu mouse/joystick input cooldowns
 * indexed off absolute gametic (see `src/ui/menus.ts:804..815`),
 * level start time captured via `levelstarttic = gametic;` inside
 * `G_DoLoadLevel`, demo-sync tic counting reported by
 * `G_CheckDemoStatus` ("timed %i gametics in %i realtics"), and the
 * consistency-check circular buffer index
 * `(gametic/ticdup)%BACKUPTICS` inside `G_Ticker`.
 *
 * The 04-008 audit pinned the deterministic reset seed; this audit
 * pins the matching tic counter contract:
 *  - `gametic` starts at 0 (file-scope `int gametic;` with C-default
 *    zero-initialisation; no explicit `= 0` initialiser is needed
 *    because `gametic` has static storage duration),
 *  - it is incremented by exactly 1 per tic via `gametic++`
 *    (post-increment statement form, NOT `++gametic` and NOT
 *    `gametic = gametic + 1;`),
 *  - the increment occurs AFTER `M_Ticker()` and `G_Ticker()` run for
 *    that tic — so the value observed during `G_Ticker()` execution
 *    for the K-th tic (1-indexed) is K-1 (zero-indexed),
 *  - `gametic` is NEVER reset to 0 anywhere in the canonical
 *    `linuxdoom-1.10` source tree (NOT in `G_InitNew`, NOT in
 *    `G_DoLoadGame`, NOT in `G_DoSaveGame`, NOT in `G_DoLoadLevel`,
 *    NOT in `D_DoomMain`); it is a process-lifetime monotonic
 *    counter,
 *  - the canonical increment site has TWO physical locations in
 *    `linuxdoom-1.10`: `d_main.c` D_DoomLoop singletics branch (when
 *    the `-singletics` flag is active) AND `d_net.c` TryRunTics inner
 *    `for (i=0 ; i<ticdup ; i++)` loop (the normal path),
 *  - both call sites use the identical four-step ordering:
 *    `advancedemo` check (and possibly `D_DoAdvanceDemo`) →
 *    `M_Ticker()` → `G_Ticker()` → `gametic++`,
 *  - `levelstarttic` is declared beside `gametic` in `g_game.c`
 *    (`int             levelstarttic;          // gametic at level start`)
 *    and captures the absolute gametic at level start via
 *    `levelstarttic = gametic;` inside `G_DoLoadLevel()`.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. id Software `linuxdoom-1.10` source — PRIMARY for this audit
 *      because the increment is a one-statement post-increment and
 *      the file-scope declaration is a single line that the binary
 *      cannot disagree with,
 *   4. Chocolate Doom 2.2.1 source — secondary; the Chocolate Doom
 *      `src/d_loop.c` extraction of `gametic++` from `d_main.c` and
 *      `d_net.c` into a single `RunTics` body is a structural
 *      refactor that preserves the canonical post-Ticker increment
 *      contract (the `gametic++;` immediately follows the
 *      `loop_interface->RunTic(...)` call inside `RunTics` in
 *      `chocolate-doom-2.2.1/src/d_loop.c`),
 *   5. DoomWiki only for orientation.
 *
 * This audit pins:
 *  - the canonical file-scope declaration of `gametic` in
 *    `linuxdoom-1.10/g_game.c` and its C-default zero initialisation,
 *  - both canonical call sites of `gametic++` and the canonical
 *    `advancedemo / M_Ticker / G_Ticker / gametic++` four-step
 *    ordering,
 *  - the operational invariants every parity-faithful re-implementation
 *    must honour (zero-init, monotonic by exactly +1 per tic,
 *    post-Ticker increment, never-reset across the process lifetime,
 *    no premature wrap),
 *  - a curated probe table of canonical observable values from a
 *    fresh instance after K tics for K in {0, 1, 2, 35, 70, 256,
 *    1000, 2100, 35*60*60},
 *  - and a cross-check helper that any candidate (`gametic` accessor
 *    + `runOneTic(tickerCallback)` operation) tuple must satisfy.
 *
 * The audit module deliberately does NOT import from
 * `src/bootstrap/tryRunTics.ts` (or any runtime tic-runner module).
 * The audit stands on its own canonical-source authority so a
 * corruption of the runtime cannot also silently corrupt the audit
 * that detects the corruption. The focused test validates the ledger
 * AND a hand-rolled reference candidate that mirrors vanilla
 * semantics; a future step will wire a runtime cross-check on
 * `src/bootstrap/tryRunTics.ts` once that module enters this lane's
 * read-only path.
 */

/**
 * Audited canonical initial value of `gametic` after the
 * file-scope C declaration `int             gametic;` in
 * `linuxdoom-1.10/g_game.c`. Pinned independently of any runtime
 * module so a transcription drift (e.g. a port that initialises
 * gametic to 1 to match the "first tic is tic 1" intuition) fails
 * loudly.
 */
export const AUDITED_GAMETIC_INITIAL_VALUE = 0;

/**
 * Audited canonical increment delta applied per tic — exactly +1.
 * The C source uses `gametic++` (post-increment), which is a +1
 * step. Pinned because a port that uses `gametic += ticdup` (a
 * common temptation when collapsing the inner ticdup loop) would
 * silently advance the counter by 4 in a 4-player ticdup=4 game.
 */
export const AUDITED_GAMETIC_INCREMENT_DELTA = 1;

/**
 * Audited canonical count of `gametic = N` reset statements anywhere
 * in the entire `linuxdoom-1.10` source tree — exactly 0. Pinned
 * because a port that resets gametic on level transition (a common
 * temptation when re-using the variable as a "level tic" counter)
 * would silently break demo timing, monster `(gametic & 3)`
 * scheduling, and menu input cooldowns that depend on the absolute
 * monotonic walk.
 */
export const AUDITED_GAMETIC_RESET_STATEMENT_COUNT_LINUXDOOM = 0;

/**
 * Audited canonical count of `gametic++` increment sites in the
 * `linuxdoom-1.10` source tree — exactly 2. The two sites are
 * `d_main.c` D_DoomLoop singletics branch and `d_net.c` TryRunTics
 * inner ticdup loop. Pinned because a port that adds an extra
 * increment site (for example, inside `G_Ticker()` body, or inside
 * a demo-replay fast path) would silently double the counter rate.
 */
export const AUDITED_GAMETIC_INCREMENT_SITE_COUNT_LINUXDOOM = 2;

/**
 * Audited canonical observed `gametic` value DURING the first
 * `G_Ticker()` call after a fresh boot — exactly 0. The increment
 * is post-Ticker (`M_Ticker(); G_Ticker(); gametic++;`), so the
 * value visible inside G_Ticker for the K-th tic (1-indexed) is
 * K-1 (zero-indexed). Pinned because a port that pre-increments
 * (`++gametic` BEFORE G_Ticker) would observe 1 here instead of 0
 * and would silently shift every consistency-check buf index and
 * every `(gametic & 3)` schedule by one tic.
 */
export const AUDITED_GAMETIC_DURING_FIRST_TICKER_VALUE = 0;

/**
 * Audited canonical observed `gametic` value AFTER one full tic
 * (a single `runOneTic` call from a fresh instance) — exactly 1.
 * Pinned alongside `AUDITED_GAMETIC_DURING_FIRST_TICKER_VALUE` to
 * fix the post-Ticker post-increment contract: during the call,
 * the value is 0; after the call returns, the value is 1.
 */
export const AUDITED_GAMETIC_AFTER_FIRST_TICK_VALUE = 1;

/**
 * Audited canonical observed `gametic` value after exactly 35 tics
 * — exactly 35. 35 tics is one second of vanilla DOOM simulation
 * (the engine runs at 35 Hz). Pinned because a port that wraps at
 * a byte boundary (& 0xff) would still report 35 here, but a port
 * that wraps every second (a common temptation when treating
 * gametic as a "tics this second" counter) would report 0.
 */
export const AUDITED_GAMETIC_AFTER_ONE_SECOND_VALUE = 35;

/**
 * Audited canonical observed `gametic` value after exactly 256
 * tics — exactly 256 (no byte wrap). Pinned because a port that
 * stores gametic in an `uint8_t` (a common temptation when
 * confusing it with the rndtable index) would wrap to 0 here. The
 * canonical type is `int`, never a narrower one.
 */
export const AUDITED_GAMETIC_AFTER_256_TICS_VALUE = 256;

/**
 * Audited canonical name of the vanilla DOOM 1.9 source file
 * containing the file-scope declaration of `gametic` — exactly
 * `linuxdoom-1.10/g_game.c`. Pinned to disambiguate from any
 * future refactor that splits g_game.c.
 */
export const AUDITED_GAMETIC_DECLARATION_FILE = 'linuxdoom-1.10/g_game.c';

/**
 * Audited canonical increment statement form — exactly `gametic++`
 * (post-increment, semicolon-terminated as `gametic++;`). Pinned
 * because a port that uses `++gametic;` would still observe the
 * same post-state from outside, BUT would couple the increment to
 * any expression-evaluation order side effect a future refactor
 * introduces (the post-increment form is the canonical signature
 * of "advance by 1 unconditionally" in this codebase).
 */
export const AUDITED_GAMETIC_INCREMENT_STATEMENT = 'gametic++;';

/**
 * Stable identifier for one pinned C-source fact about the canonical
 * gametic ownership contract.
 */
export type DoomGameTicFactId =
  | 'C_HEADER_GAMETIC_FILE_SCOPE_INT_DECLARATION'
  | 'C_HEADER_GAMETIC_DEFAULT_INITIALISES_TO_ZERO'
  | 'C_HEADER_LEVELSTARTTIC_DECLARED_BESIDE_GAMETIC'
  | 'C_BODY_GAMETIC_INCREMENT_IN_DOOMLOOP_SINGLETICS_PATH'
  | 'C_BODY_GAMETIC_INCREMENT_IN_TRYRUNTICS_TICDUP_LOOP'
  | 'C_BODY_GAMETIC_INCREMENT_USES_POST_INCREMENT_FORM'
  | 'C_BODY_GAMETIC_NEVER_RESET_IN_LINUXDOOM_TREE'
  | 'C_BODY_GAMETIC_NOT_TOUCHED_IN_G_INIT_NEW'
  | 'C_BODY_GAMETIC_NOT_TOUCHED_IN_G_DO_LOAD_GAME_OR_SAVE_GAME'
  | 'C_BODY_LEVELSTARTTIC_CAPTURES_GAMETIC_IN_G_DO_LOAD_LEVEL'
  | 'C_BODY_GAMETIC_TICKER_ORDER_M_THEN_G_THEN_INCREMENT'
  | 'C_BODY_GAMETIC_INCREMENT_HAS_EXACTLY_TWO_CALL_SITES';

/** One pinned C-source fact about gametic ownership. */
export interface DoomGameTicFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomGameTicFactId;
  /** Whether the fact comes from the upstream C declaration or the upstream C body. */
  readonly category: 'c-header' | 'c-body';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet. */
  readonly cReference: string;
  /** Reference source file path inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'linuxdoom-1.10/d_main.c' | 'linuxdoom-1.10/d_net.c' | 'linuxdoom-1.10/g_game.c';
}

/**
 * Pinned ledger of twelve C-source facts that together define the
 * canonical gametic ownership contract. The focused test asserts the
 * ledger is closed (every id appears exactly once) and that every
 * fact is honoured by the runtime.
 *
 * Categorisation:
 *  - `c-header` — file-scope declaration whose presence and value
 *    are visible without entering any function body.
 *  - `c-body`   — function body statement or call site.
 */
export const DOOM_GAME_TIC_AUDIT: readonly DoomGameTicFact[] = [
  {
    id: 'C_HEADER_GAMETIC_FILE_SCOPE_INT_DECLARATION',
    category: 'c-header',
    description:
      'The file-scope declaration `int             gametic;` appears in `linuxdoom-1.10/g_game.c` (no explicit initialiser). The variable has external linkage and is referenced by `d_main.c`, `d_net.c`, `m_menu.c`, `p_enemy.c`, and other translation units that include the matching extern in `doomstat.h`. Pinned because a port that hides gametic behind a private accessor and forbids cross-module reads would diverge from the canonical "shared file-scope counter" contract every other subsystem depends on.',
    cReference: 'int             gametic;',
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
  },
  {
    id: 'C_HEADER_GAMETIC_DEFAULT_INITIALISES_TO_ZERO',
    category: 'c-header',
    description:
      'No explicit `= 0` initialiser appears on the `int gametic;` declaration in `linuxdoom-1.10/g_game.c`. The C standard guarantees objects with static storage duration are zero-initialised at process start, so `gametic` is observably 0 at the first call to `D_DoomLoop`. Pinned because a TypeScript port that constructs a tic-runner object in a non-zero state (for example, seeding from a clock) would silently shift every absolute-gametic deadline (mouseWait / joyWait / monster `(gametic & 3)` schedule) on the very first frame.',
    cReference: 'int             gametic;',
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
  },
  {
    id: 'C_HEADER_LEVELSTARTTIC_DECLARED_BESIDE_GAMETIC',
    category: 'c-header',
    description:
      'Immediately following the gametic declaration in `linuxdoom-1.10/g_game.c` is the line `int             levelstarttic;          // gametic at level start`. The verbatim comment `// gametic at level start` documents the intended capture semantics and pins gametic as the absolute-monotonic source of truth (a level-start delta is computed from it, not the other way around). Pinned because a port that re-purposes `gametic` as a "tics since level start" counter would invert the semantics: there would be no absolute clock for `levelstarttic` to capture, and the comment would no longer make sense.',
    cReference: 'int             levelstarttic;          // gametic at level start',
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
  },
  {
    id: 'C_BODY_GAMETIC_INCREMENT_IN_DOOMLOOP_SINGLETICS_PATH',
    category: 'c-body',
    description:
      'Inside D_DoomLoop in `linuxdoom-1.10/d_main.c`, the singletics branch (taken when the `-singletics` command-line flag was passed) executes the canonical four-step ordering: `if (advancedemo) D_DoAdvanceDemo (); M_Ticker (); G_Ticker (); gametic++; maketic++;` — both gametic and maketic are incremented inline AFTER the tickers run. Pinned because a port that misses the singletics branch would not advance gametic when a developer runs the engine with `-singletics` for a demo-record session, silently corrupting demo timing in that mode.',
    cReference: 'M_Ticker (); G_Ticker (); gametic++; maketic++;',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
  {
    id: 'C_BODY_GAMETIC_INCREMENT_IN_TRYRUNTICS_TICDUP_LOOP',
    category: 'c-body',
    description:
      'Inside TryRunTics in `linuxdoom-1.10/d_net.c`, the inner `for (i=0 ; i<ticdup ; i++)` loop executes the canonical four-step ordering: `if (advancedemo) D_DoAdvanceDemo (); M_Ticker (); G_Ticker (); gametic++;` — gametic is incremented once per ticdup iteration, AFTER the tickers run. Pinned because the increment is INSIDE the ticdup loop (so a 4-player ticdup=4 game advances gametic by 4 per outer iteration, not 1). A port that hoists the increment outside the inner loop would silently desync demo timing in network play.',
    cReference: 'M_Ticker (); G_Ticker (); gametic++;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_GAMETIC_INCREMENT_USES_POST_INCREMENT_FORM',
    category: 'c-body',
    description:
      'Both increment statements are written as `gametic++;` (post-increment as a discard-result statement), NOT `++gametic;` and NOT `gametic = gametic + 1;`. Pinned because the post-increment form is the canonical "advance unconditionally by 1" signature in this codebase; a port that uses `gametic += ticdup` inside the inner loop (a common temptation when collapsing the loop) would advance gametic by ticdup-squared-times in a single outer iteration.',
    cReference: 'gametic++;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_GAMETIC_NEVER_RESET_IN_LINUXDOOM_TREE',
    category: 'c-body',
    description:
      'Across the entire `linuxdoom-1.10` source tree, no statement of the form `gametic = N;` (for any N) appears in any function body. The variable is incremented (twice — d_main.c singletics path, d_net.c TryRunTics) and read (in `G_Ticker` consistency-check buf, in `D_Display` non-zero gating, in `G_DoLoadLevel` levelstarttic capture, in `G_CheckDemoStatus` "timed %i gametics" error, in monster `(gametic & 3)` scheduling, in menu mouseWait / joyWait deadlines), but it is never assigned. Pinned because a port that resets gametic on level transition or new-game start would silently break every per-tic schedule that depends on the absolute monotonic walk.',
    cReference: 'gametic',
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
  },
  {
    id: 'C_BODY_GAMETIC_NOT_TOUCHED_IN_G_INIT_NEW',
    category: 'c-body',
    description:
      'Inside G_InitNew in `linuxdoom-1.10/g_game.c`, the function body validates the map index, calls `M_ClearRandom();` (the deterministic reset seed pinned by 04-008), branches on `skill == sk_nightmare || respawnparm`, sets `usergame`, `paused`, `demoplayback`, `automapactive`, `viewactive`, `gameepisode`, `gamemap`, `gameskill` — but it does NOT touch `gametic`. The reset of `gametic` is intentionally omitted because the variable is shared across every game start within a process lifetime; a "new game" does not zero the absolute monotonic clock. Pinned because a port that adds `gametic = 0;` inside G_InitNew would break demo timing for any record-then-replay sequence within a single process.',
    cReference: 'M_ClearRandom ();',
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
  },
  {
    id: 'C_BODY_GAMETIC_NOT_TOUCHED_IN_G_DO_LOAD_GAME_OR_SAVE_GAME',
    category: 'c-body',
    description:
      'Neither G_DoLoadGame nor G_DoSaveGame in `linuxdoom-1.10/g_game.c` assigns `gametic`. The save format records and restores `leveltime` (per-level tic counter, distinct from gametic) and the per-mobj state, but the absolute monotonic gametic is left untouched on save and on load. Pinned because a port that restores gametic from the save file would let a save-load cycle rewind monster `(gametic & 3)` schedules and menu mouseWait deadlines mid-session, breaking the canonical "absolute walk across process lifetime" contract.',
    cReference: 'gametic',
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
  },
  {
    id: 'C_BODY_LEVELSTARTTIC_CAPTURES_GAMETIC_IN_G_DO_LOAD_LEVEL',
    category: 'c-body',
    description:
      'Inside G_DoLoadLevel in `linuxdoom-1.10/g_game.c`, the statement `levelstarttic = gametic;        // for time calculation` captures the absolute monotonic gametic at the moment the level loads. Every subsequent per-level time calculation (intermission timing, par/total timer in the status bar) is computed as `gametic - levelstarttic`. Pinned because the capture direction is one-way: gametic feeds levelstarttic, not the other way around. A port that recomputes gametic from levelstarttic would invert the dependency and break the per-process monotonic invariant.',
    cReference: 'levelstarttic = gametic;        // for time calculation',
    referenceSourceFile: 'linuxdoom-1.10/g_game.c',
  },
  {
    id: 'C_BODY_GAMETIC_TICKER_ORDER_M_THEN_G_THEN_INCREMENT',
    category: 'c-body',
    description:
      'Both increment sites (d_main.c singletics path and d_net.c TryRunTics inner loop) use the identical four-step ordering: (1) `if (advancedemo) D_DoAdvanceDemo ();`, (2) `M_Ticker ();` (menu/intermission ticker), (3) `G_Ticker ();` (game-state ticker), (4) `gametic++;`. The ordering matters: M_Ticker must run BEFORE G_Ticker so menu input gates the game-state advance, and the increment must happen AFTER G_Ticker so the consistency-check `buf = (gametic/ticdup)%BACKUPTICS;` inside G_Ticker observes the pre-increment value. Pinned because a port that increments before G_Ticker would shift every consistency-check buffer slot by one tic.',
    cReference: 'M_Ticker (); G_Ticker (); gametic++;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_GAMETIC_INCREMENT_HAS_EXACTLY_TWO_CALL_SITES',
    category: 'c-body',
    description:
      'Across the entire `linuxdoom-1.10` source tree, `gametic++` appears in exactly two locations: the singletics branch of D_DoomLoop in `d_main.c` and the inner ticdup loop of TryRunTics in `d_net.c`. There is no third increment site in `g_game.c` (G_Ticker reads gametic for the consistency-check buf calculation but does not modify it), no third site in `wi_stuff.c` (intermission), no third site in `f_finale.c` (finale), and no third site in `m_menu.c` (menu). Pinned because a port that adds an extra increment site (for example, inside `G_Ticker()` body or inside a demo-replay fast path) would silently double the counter rate and corrupt every per-tic schedule.',
    cReference: 'gametic++;',
    referenceSourceFile: 'linuxdoom-1.10/d_main.c',
  },
] as const;

/**
 * Stable identifier for one operational invariant the cross-check
 * helper enforces against any candidate gametic surface tuple.
 */
export type DoomGameTicInvariantId =
  | 'GAMETIC_INITIALISES_TO_ZERO'
  | 'GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_TIC'
  | 'GAMETIC_NEVER_DECREASES_DURING_LIFETIME'
  | 'GAMETIC_OBSERVED_DURING_TICKER_EQUALS_PRE_INCREMENT_VALUE'
  | 'GAMETIC_AFTER_N_TICS_EQUALS_N_FROM_FRESH_INSTANCE'
  | 'GAMETIC_NOT_RESET_BY_REPEATED_TICKING'
  | 'GAMETIC_TICKER_OBSERVED_VALUES_ARE_ZERO_INDEXED_SEQUENCE'
  | 'GAMETIC_INCREMENT_IS_INTEGER_NEVER_FRACTIONAL'
  | 'GAMETIC_SURVIVES_LARGE_COUNT_WITHOUT_PREMATURE_WRAP'
  | 'GAMETIC_AFTER_ONE_SECOND_EQUALS_THIRTY_FIVE'
  | 'GAMETIC_AFTER_TWO_SECONDS_EQUALS_SEVENTY'
  | 'GAMETIC_AFTER_BYTE_BOUNDARY_DOES_NOT_WRAP'
  | 'GAMETIC_TWO_INSTANCES_ARE_INDEPENDENT'
  | 'GAMETIC_DURING_TICKER_OF_KTH_TIC_EQUALS_K_MINUS_ONE'
  | 'GAMETIC_INCREMENT_OBSERVABLE_BEFORE_TICKER_RETURN_IS_FALSE';

/** One operational invariant the cross-check helper enforces. */
export interface DoomGameTicInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomGameTicInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of fifteen operational invariants. The focused test
 * asserts the ledger is closed and that the cross-check helper
 * returns exactly the right failure id for each tampered candidate.
 */
export const DOOM_GAME_TIC_INVARIANTS: readonly DoomGameTicInvariant[] = [
  {
    id: 'GAMETIC_INITIALISES_TO_ZERO',
    description:
      'A freshly-constructed candidate exposes `gametic === 0` before any tic has been run. Pinned because a port that seeds gametic from the wall-clock or a saved value would diverge from the canonical zero-initialised file-scope C contract.',
  },
  {
    id: 'GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_TIC',
    description:
      'Each `runOneTic` call advances gametic by exactly +1 (not +0 if the tic was skipped, not +2 if the loop double-incremented). Pinned because a port that uses `gametic += ticdup` inside the inner loop would advance by more than 1 per `runOneTic` call.',
  },
  {
    id: 'GAMETIC_NEVER_DECREASES_DURING_LIFETIME',
    description:
      'Across an arbitrary sequence of `runOneTic` calls, gametic is monotonic non-decreasing. Pinned because a port that uses an unsigned narrow type and saturates would still satisfy +1 per tic locally but would observe a decrease across a wrap. Vanilla DOOM uses an `int` (typically 32-bit signed); for any practical session length the observed sequence is strictly increasing.',
  },
  {
    id: 'GAMETIC_OBSERVED_DURING_TICKER_EQUALS_PRE_INCREMENT_VALUE',
    description:
      'Inside `runOneTic`, the candidate must invoke its ticker callback with the PRE-increment value of gametic — that is, the value visible during `G_Ticker()` for the K-th tic (1-indexed) is K-1 (zero-indexed). Pinned because a port that pre-increments would shift the consistency-check buf index by one tic.',
  },
  {
    id: 'GAMETIC_AFTER_N_TICS_EQUALS_N_FROM_FRESH_INSTANCE',
    description:
      'For every N in {0, 1, 2, 5, 35, 70, 256, 1000, 2100}, after exactly N `runOneTic` calls on a fresh candidate, `gametic === N`. Pinned because a port that uses a non-affine increment (e.g. exponential, polynomial) would still hit one or two probe values by coincidence but would fail the closed sweep.',
  },
  {
    id: 'GAMETIC_NOT_RESET_BY_REPEATED_TICKING',
    description:
      'No internal operation of the candidate may reset gametic to 0 mid-session. After any sequence of `runOneTic` calls, gametic equals the count of calls; specifically, calling `runOneTic` 100 times then capturing `gametic` returns 100, not 0. Pinned because a port that conditions the increment on a wrap state (e.g. `if (gametic == 35) gametic = 0;`) would mask itself in single-K probes but fail across K.',
  },
  {
    id: 'GAMETIC_TICKER_OBSERVED_VALUES_ARE_ZERO_INDEXED_SEQUENCE',
    description:
      'Across N consecutive `runOneTic` calls on a fresh candidate, the sequence of values captured by the ticker callbacks is exactly [0, 1, 2, ..., N-1]. Pinned to defend against a port that captures the post-increment value (which would yield [1, 2, 3, ..., N]) or that captures stale values (which would yield repeats).',
  },
  {
    id: 'GAMETIC_INCREMENT_IS_INTEGER_NEVER_FRACTIONAL',
    description:
      'Every observed value of gametic is an integer (Number.isInteger check) and is non-negative. Pinned because a port that accumulates a fixed-point delta would silently introduce sub-tic resolution that breaks discrete `(gametic & 3)` scheduling.',
  },
  {
    id: 'GAMETIC_SURVIVES_LARGE_COUNT_WITHOUT_PREMATURE_WRAP',
    description:
      'After 35 * 60 * 60 (=126000) tics — one game hour — gametic equals 126000 exactly, with no premature wrap. Pinned because a port that uses an `int8_t` or `uint8_t` would wrap at 128 or 256, and a port that uses a 16-bit type would wrap at 65536 (well below one game hour).',
  },
  {
    id: 'GAMETIC_AFTER_ONE_SECOND_EQUALS_THIRTY_FIVE',
    description:
      'After exactly 35 `runOneTic` calls, `gametic === 35`. Pinned because 35 Hz is the canonical vanilla DOOM simulation rate and 35 tics is the canonical one-second window — a port that miscalibrates the increment would visibly desync menu animations and intermission timers at the one-second boundary.',
  },
  {
    id: 'GAMETIC_AFTER_TWO_SECONDS_EQUALS_SEVENTY',
    description:
      'After exactly 70 `runOneTic` calls, `gametic === 70`. Pinned alongside the one-second probe to defend against a port that resets gametic at the 35-tic boundary — that port would pass the one-second invariant but fail the two-second invariant.',
  },
  {
    id: 'GAMETIC_AFTER_BYTE_BOUNDARY_DOES_NOT_WRAP',
    description:
      'After 256 `runOneTic` calls, `gametic === 256` (NOT 0, NOT 255). Pinned because a port that stores gametic as a `Uint8Array` byte (a common temptation when confusing it with the 256-entry rndtable index) would wrap to 0 here.',
  },
  {
    id: 'GAMETIC_TWO_INSTANCES_ARE_INDEPENDENT',
    description:
      'Two independently-constructed candidates do not share gametic state: ticking instance A by 5 leaves instance B at 0. Pinned because a port that uses a global static counter (rather than per-instance) would couple test fixtures and break demo replay isolation.',
  },
  {
    id: 'GAMETIC_DURING_TICKER_OF_KTH_TIC_EQUALS_K_MINUS_ONE',
    description:
      'For every K in {1, 2, 3, 36, 100, 1000}, the value observed by the ticker callback during the K-th `runOneTic` call (1-indexed) on a fresh candidate is exactly K-1 (zero-indexed). Pinned to anchor the post-increment contract more strongly than the single-tic probe: a port that pre-increments would observe K, and a port that double-increments would observe 2*(K-1).',
  },
  {
    id: 'GAMETIC_INCREMENT_OBSERVABLE_BEFORE_TICKER_RETURN_IS_FALSE',
    description:
      'Inside the ticker callback (i.e. before `runOneTic` returns), the candidate exposes the PRE-increment gametic value via its `gametic` getter. Pinned because a port that pre-increments AND captures the post value via the callback would still pass the K-1 probe coincidentally if the callback is also broken, but accessing `instance.gametic` from within the callback must agree with the captured value.',
  },
] as const;

/** Stable identifier for one curated gametic probe. */
export type DoomGameTicProbeId =
  | 'fresh_instance_gametic_is_zero'
  | 'after_one_tic_gametic_is_one'
  | 'after_two_tics_gametic_is_two'
  | 'after_five_tics_gametic_is_five'
  | 'after_thirty_five_tics_gametic_is_thirty_five'
  | 'after_seventy_tics_gametic_is_seventy'
  | 'after_one_hundred_tics_gametic_is_one_hundred'
  | 'after_two_hundred_fifty_six_tics_gametic_is_two_hundred_fifty_six'
  | 'after_one_thousand_tics_gametic_is_one_thousand'
  | 'after_two_thousand_one_hundred_tics_gametic_is_two_thousand_one_hundred'
  | 'during_first_ticker_observed_gametic_is_zero'
  | 'during_second_ticker_observed_gametic_is_one'
  | 'during_thirty_sixth_ticker_observed_gametic_is_thirty_five'
  | 'during_one_thousandth_ticker_observed_gametic_is_nine_hundred_ninety_nine'
  | 'after_one_game_minute_gametic_is_two_thousand_one_hundred'
  | 'after_one_game_hour_gametic_is_one_hundred_twenty_six_thousand';

/** Which kind of expectation a probe pins. */
export type DoomGameTicProbeTarget = 'gametic_after_n_tics' | 'gametic_observed_during_kth_ticker';

/** One curated gametic probe expectation. */
export interface DoomGameTicProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomGameTicProbeId;
  /** Which surface this probe inspects. */
  readonly target: DoomGameTicProbeTarget;
  /**
   * Description of the call sequence run from a freshly-constructed
   * instance. The harness performs:
   *   1. Exactly `setupTicCount` `runOneTic` calls.
   *   2. The observation: either a read of `gametic` after the
   *      sequence (`gametic_after_n_tics`), or a capture of the value
   *      observed inside the ticker callback during the K-th call
   *      (`gametic_observed_during_kth_ticker`, 1-indexed).
   */
  readonly input: {
    readonly setupTicCount: number;
    readonly observeTickerOfKthCall?: number;
  };
  /** Expected canonical observed value. */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/**
 * Curated probe table of sixteen probes covering the canonical
 * gametic ownership contract. Each probe is hand-pinned from the
 * canonical `linuxdoom-1.10` source and re-verified by the focused
 * test against a hand-rolled reference candidate.
 *
 * Coverage:
 *  - fresh-instance state (gametic=0).
 *  - small-K post-state probes (1, 2, 5).
 *  - one-second probe (35 tics).
 *  - two-second probe (70 tics).
 *  - 100-tic probe.
 *  - byte-boundary probe (256 tics, no wrap).
 *  - 1000-tic probe.
 *  - 60-second / one game minute probe (2100 tics).
 *  - one game hour probe (126000 tics).
 *  - during-ticker observation for K=1 (expects 0).
 *  - during-ticker observation for K=2 (expects 1).
 *  - during-ticker observation for K=36 (expects 35).
 *  - during-ticker observation for K=1000 (expects 999).
 */
export const DOOM_GAME_TIC_PROBES: readonly DoomGameTicProbe[] = [
  {
    id: 'fresh_instance_gametic_is_zero',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 0 },
    expected: 0,
    note: 'A freshly-constructed candidate exposes gametic === 0 before any tic. Anchors the C-default zero-initialisation contract.',
  },
  {
    id: 'after_one_tic_gametic_is_one',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 1 },
    expected: 1,
    note: 'After exactly one runOneTic call, gametic === 1. Confirms the +1 per-tic increment.',
  },
  {
    id: 'after_two_tics_gametic_is_two',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 2 },
    expected: 2,
    note: 'After two runOneTic calls, gametic === 2. Confirms the increment is by exactly 1, not 2 or 0.5.',
  },
  {
    id: 'after_five_tics_gametic_is_five',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 5 },
    expected: 5,
    note: 'After five runOneTic calls, gametic === 5. Anchors the linear walk across small K.',
  },
  {
    id: 'after_thirty_five_tics_gametic_is_thirty_five',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 35 },
    expected: 35,
    note: 'After 35 runOneTic calls (one second of vanilla DOOM simulation at 35 Hz), gametic === 35. Defends against a port that wraps at the one-second boundary.',
  },
  {
    id: 'after_seventy_tics_gametic_is_seventy',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 70 },
    expected: 70,
    note: 'After 70 runOneTic calls (two seconds of simulation), gametic === 70. Cross-validates against the one-second probe.',
  },
  {
    id: 'after_one_hundred_tics_gametic_is_one_hundred',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 100 },
    expected: 100,
    note: 'After 100 runOneTic calls, gametic === 100. Anchors the linear walk at a non-multiple of 35.',
  },
  {
    id: 'after_two_hundred_fifty_six_tics_gametic_is_two_hundred_fifty_six',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 256 },
    expected: 256,
    note: 'After 256 runOneTic calls, gametic === 256 (NOT 0, NOT 255). Defends against a port that stores gametic in a Uint8Array byte cell.',
  },
  {
    id: 'after_one_thousand_tics_gametic_is_one_thousand',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 1000 },
    expected: 1000,
    note: 'After 1000 runOneTic calls, gametic === 1000. Anchors the linear walk past the byte boundary.',
  },
  {
    id: 'after_two_thousand_one_hundred_tics_gametic_is_two_thousand_one_hundred',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 2100 },
    expected: 2100,
    note: 'After 35 * 60 = 2100 runOneTic calls (one game minute), gametic === 2100. Defends against a port that wraps at a per-minute boundary.',
  },
  {
    id: 'during_first_ticker_observed_gametic_is_zero',
    target: 'gametic_observed_during_kth_ticker',
    input: { setupTicCount: 1, observeTickerOfKthCall: 1 },
    expected: 0,
    note: 'During the first runOneTic call, the ticker callback observes gametic === 0. Anchors the post-Ticker post-increment contract — the value visible inside G_Ticker for the 1st tic is the pre-increment value.',
  },
  {
    id: 'during_second_ticker_observed_gametic_is_one',
    target: 'gametic_observed_during_kth_ticker',
    input: { setupTicCount: 2, observeTickerOfKthCall: 2 },
    expected: 1,
    note: 'During the second runOneTic call, the ticker callback observes gametic === 1. Confirms the increment is committed BEFORE the next ticker call.',
  },
  {
    id: 'during_thirty_sixth_ticker_observed_gametic_is_thirty_five',
    target: 'gametic_observed_during_kth_ticker',
    input: { setupTicCount: 36, observeTickerOfKthCall: 36 },
    expected: 35,
    note: 'During the 36th runOneTic call, the ticker callback observes gametic === 35 (=36-1). Anchors the post-increment contract at the one-second boundary.',
  },
  {
    id: 'during_one_thousandth_ticker_observed_gametic_is_nine_hundred_ninety_nine',
    target: 'gametic_observed_during_kth_ticker',
    input: { setupTicCount: 1000, observeTickerOfKthCall: 1000 },
    expected: 999,
    note: 'During the 1000th runOneTic call, the ticker callback observes gametic === 999. Defends against a port that observes an off-by-one drift only at large K.',
  },
  {
    id: 'after_one_game_minute_gametic_is_two_thousand_one_hundred',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 2100 },
    expected: 2100,
    note: 'Aliases the 60-second probe — included to make the canonical "one game minute" boundary explicit. Note: shares the value with after_two_thousand_one_hundred_tics_gametic_is_two_thousand_one_hundred but is a separate id for documentation reasons.',
  },
  {
    id: 'after_one_game_hour_gametic_is_one_hundred_twenty_six_thousand',
    target: 'gametic_after_n_tics',
    input: { setupTicCount: 126000 },
    expected: 126000,
    note: 'After 35 * 60 * 60 = 126000 runOneTic calls (one game hour), gametic === 126000. Defends against a port that uses a 16-bit type that would wrap at 65536, well below one game hour.',
  },
] as const;

/**
 * A candidate gametic surface tuple for cross-checking. The tuple
 * captures the canonical gametic ownership surface: a constructor
 * that returns a fresh instance, plus a per-instance `gametic`
 * getter and a `runOneTic(tickerCallback)` operation.
 */
export interface DoomGameTicCandidate {
  /** Factory that returns a fresh instance with gametic at 0. */
  readonly create: () => DoomGameTicCandidateInstance;
}

/** The gametic surface a candidate must expose for the cross-check to inspect. */
export interface DoomGameTicCandidateInstance {
  /**
   * The current gametic value. Inside a `runOneTic` ticker callback,
   * this MUST return the pre-increment value (matching the canonical
   * `M_Ticker(); G_Ticker(); gametic++;` ordering).
   */
  readonly gametic: number;
  /**
   * Execute one tic. The candidate MUST:
   *   1. Call `tickerCallback(this.gametic)` exactly once. The value
   *      passed to the callback is captured by the cross-check
   *      helper as the during-ticker observation.
   *   2. After the callback returns, increment `gametic` by exactly +1.
   * The candidate MUST NOT touch gametic during the callback (a
   * read of `instance.gametic` from inside the callback must agree
   * with the captured value).
   */
  runOneTic(tickerCallback: (gameticDuringTicker: number) => void): void;
}

/**
 * Cross-check a candidate gametic surface tuple against
 * `DOOM_GAME_TIC_PROBES` and `DOOM_GAME_TIC_INVARIANTS`. Returns the
 * list of failures by stable identifier; an empty list means the
 * candidate honours every audited gametic ownership fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one observation.
 */
export function crossCheckDoomGameTicCounter(candidate: DoomGameTicCandidate): readonly string[] {
  const failures: string[] = [];

  // Per-probe checks
  for (const probe of DOOM_GAME_TIC_PROBES) {
    const instance = candidate.create();
    let observedDuringKthTicker: number | null = null;
    for (let k = 1; k <= probe.input.setupTicCount; k++) {
      instance.runOneTic((current) => {
        if (probe.input.observeTickerOfKthCall !== undefined && k === probe.input.observeTickerOfKthCall) {
          observedDuringKthTicker = current;
        }
      });
    }
    let actual: number;
    if (probe.target === 'gametic_after_n_tics') {
      actual = instance.gametic;
    } else {
      actual = observedDuringKthTicker ?? Number.NaN;
    }
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  // Invariant: fresh instance gametic === 0
  {
    const instance = candidate.create();
    if (instance.gametic !== AUDITED_GAMETIC_INITIAL_VALUE) {
      failures.push('invariant:GAMETIC_INITIALISES_TO_ZERO');
    }
  }

  // Invariant: increment is by exactly +1 per tic
  {
    let allMatch = true;
    const instance = candidate.create();
    for (let i = 0; i < 17; i++) {
      const before = instance.gametic;
      instance.runOneTic(() => {});
      const after = instance.gametic;
      if (after - before !== AUDITED_GAMETIC_INCREMENT_DELTA) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_TIC');
    }
  }

  // Invariant: gametic never decreases during lifetime
  {
    let monotonic = true;
    const instance = candidate.create();
    let prev = instance.gametic;
    for (let i = 0; i < 50; i++) {
      instance.runOneTic(() => {});
      const cur = instance.gametic;
      if (cur < prev) {
        monotonic = false;
        break;
      }
      prev = cur;
    }
    if (!monotonic) {
      failures.push('invariant:GAMETIC_NEVER_DECREASES_DURING_LIFETIME');
    }
  }

  // Invariant: gametic observed during ticker equals pre-increment value
  {
    const instance = candidate.create();
    let observed = -1;
    instance.runOneTic((current) => {
      observed = current;
    });
    if (observed !== AUDITED_GAMETIC_DURING_FIRST_TICKER_VALUE) {
      failures.push('invariant:GAMETIC_OBSERVED_DURING_TICKER_EQUALS_PRE_INCREMENT_VALUE');
    }
  }

  // Invariant: gametic after N tics equals N from fresh instance
  {
    let allMatch = true;
    for (const n of [0, 1, 2, 5, 35, 70, 256, 1000, 2100]) {
      const instance = candidate.create();
      for (let i = 0; i < n; i++) instance.runOneTic(() => {});
      if (instance.gametic !== n) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:GAMETIC_AFTER_N_TICS_EQUALS_N_FROM_FRESH_INSTANCE');
    }
  }

  // Invariant: gametic not reset by repeated ticking
  {
    const instance = candidate.create();
    for (let i = 0; i < 100; i++) instance.runOneTic(() => {});
    if (instance.gametic !== 100) {
      failures.push('invariant:GAMETIC_NOT_RESET_BY_REPEATED_TICKING');
    }
  }

  // Invariant: ticker observed values are zero-indexed sequence
  {
    const instance = candidate.create();
    const captured: number[] = [];
    for (let i = 0; i < 10; i++) {
      instance.runOneTic((current) => {
        captured.push(current);
      });
    }
    let isExpectedSequence = captured.length === 10;
    if (isExpectedSequence) {
      for (let i = 0; i < 10; i++) {
        if (captured[i] !== i) {
          isExpectedSequence = false;
          break;
        }
      }
    }
    if (!isExpectedSequence) {
      failures.push('invariant:GAMETIC_TICKER_OBSERVED_VALUES_ARE_ZERO_INDEXED_SEQUENCE');
    }
  }

  // Invariant: gametic increment is integer never fractional
  {
    let allInteger = true;
    const instance = candidate.create();
    for (let i = 0; i < 30; i++) {
      instance.runOneTic((current) => {
        if (!Number.isInteger(current) || current < 0) {
          allInteger = false;
        }
      });
      if (!Number.isInteger(instance.gametic) || instance.gametic < 0) {
        allInteger = false;
      }
    }
    if (!allInteger) {
      failures.push('invariant:GAMETIC_INCREMENT_IS_INTEGER_NEVER_FRACTIONAL');
    }
  }

  // Invariant: gametic survives large count without premature wrap
  {
    const instance = candidate.create();
    const target = 35 * 60 * 60; // one game hour
    for (let i = 0; i < target; i++) instance.runOneTic(() => {});
    if (instance.gametic !== target) {
      failures.push('invariant:GAMETIC_SURVIVES_LARGE_COUNT_WITHOUT_PREMATURE_WRAP');
    }
  }

  // Invariant: gametic after one second equals 35
  {
    const instance = candidate.create();
    for (let i = 0; i < 35; i++) instance.runOneTic(() => {});
    if (instance.gametic !== AUDITED_GAMETIC_AFTER_ONE_SECOND_VALUE) {
      failures.push('invariant:GAMETIC_AFTER_ONE_SECOND_EQUALS_THIRTY_FIVE');
    }
  }

  // Invariant: gametic after two seconds equals 70
  {
    const instance = candidate.create();
    for (let i = 0; i < 70; i++) instance.runOneTic(() => {});
    if (instance.gametic !== 70) {
      failures.push('invariant:GAMETIC_AFTER_TWO_SECONDS_EQUALS_SEVENTY');
    }
  }

  // Invariant: gametic after byte boundary does not wrap
  {
    const instance = candidate.create();
    for (let i = 0; i < 256; i++) instance.runOneTic(() => {});
    if (instance.gametic !== AUDITED_GAMETIC_AFTER_256_TICS_VALUE) {
      failures.push('invariant:GAMETIC_AFTER_BYTE_BOUNDARY_DOES_NOT_WRAP');
    }
  }

  // Invariant: two instances are independent
  {
    const a = candidate.create();
    const b = candidate.create();
    for (let i = 0; i < 5; i++) a.runOneTic(() => {});
    if (a.gametic !== 5 || b.gametic !== 0) {
      failures.push('invariant:GAMETIC_TWO_INSTANCES_ARE_INDEPENDENT');
    }
  }

  // Invariant: gametic during ticker of K-th tic equals K-1
  {
    let allMatch = true;
    for (const k of [1, 2, 3, 36, 100, 1000]) {
      const instance = candidate.create();
      let observed = -1;
      for (let i = 1; i <= k; i++) {
        instance.runOneTic((current) => {
          if (i === k) observed = current;
        });
      }
      if (observed !== k - 1) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:GAMETIC_DURING_TICKER_OF_KTH_TIC_EQUALS_K_MINUS_ONE');
    }
  }

  // Invariant: gametic increment is not observable inside the ticker callback
  {
    let consistent = true;
    const instance = candidate.create();
    for (let i = 0; i < 5; i++) {
      let captured = -1;
      let getterDuringCallback = -1;
      instance.runOneTic((current) => {
        captured = current;
        getterDuringCallback = instance.gametic;
      });
      if (captured !== getterDuringCallback) {
        consistent = false;
        break;
      }
    }
    if (!consistent) {
      failures.push('invariant:GAMETIC_INCREMENT_OBSERVABLE_BEFORE_TICKER_RETURN_IS_FALSE');
    }
  }

  return failures;
}
