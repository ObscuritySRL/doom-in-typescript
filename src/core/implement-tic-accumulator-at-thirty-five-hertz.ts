/**
 * Audit ledger for the vanilla DOOM 1.9 tic accumulator at 35 Hz —
 * the precise semantics of `I_GetTime()`, the host-clock-to-game-tic
 * conversion that drives every per-frame `TryRunTics` decision in
 * `D_DoomLoop`. The accumulator owns the contract: a fresh
 * baseline captured on the first call, an integer-truncating
 * `(delta * TICRATE) / units_per_second` formula, and a monotonic
 * non-decreasing absolute tic count from which per-frame "new tics
 * to run" is computed as a delta.
 *
 * The 04-009 audit pinned the post-Ticker post-increment contract
 * for `gametic`; this audit pins the matching wall-clock-to-tic
 * accumulator contract that feeds `runOneTic` calls into the
 * `M_Ticker(); G_Ticker(); gametic++;` sequence:
 *  - `TICRATE` is exactly 35, defined as the verbatim
 *    `#define TICRATE\t\t35` in `linuxdoom-1.10/doomdef.h` and
 *    inherited unchanged by Chocolate Doom 2.2.1,
 *  - the canonical vanilla formula in `linuxdoom-1.10/i_system.c`
 *    is `newtics = (tp.tv_sec - basetime) * TICRATE + tp.tv_usec * TICRATE / 1000000;`
 *    where `(tp, tzp)` is the result of `gettimeofday`, `basetime`
 *    is a function-local `static int basetime=0;` lazily captured on
 *    the first call via `if (!basetime) basetime = tp.tv_sec;`, and
 *    the result is a `int I_GetTime (void)` (signed integer),
 *  - the canonical Chocolate Doom 2.2.1 formula in
 *    `chocolate-doom-2.2.1/src/i_timer.c` is
 *    `return (ticks * TICRATE) / 1000;` where `ticks =
 *    SDL_GetTicks();` is a `Uint32` of milliseconds since SDL init
 *    and `basetime` is a file-scope `static Uint32 basetime = 0;`
 *    lazily captured via `if (basetime == 0) basetime = ticks;`,
 *  - both formulas share the canonical contract:
 *    `tics = floor((delta * TICRATE) / units_per_second)` where
 *    `delta = current - basetime` is the non-negative count of
 *    host-clock units since baseline capture and `units_per_second`
 *    is the host clock's resolution (1_000_000 for `gettimeofday`
 *    microseconds, 1_000 for `SDL_GetTicks` milliseconds, and
 *    `QueryPerformanceFrequency()` for the Win32 high-resolution
 *    counter),
 *  - the formula is INTEGER-TRUNCATING (towards zero in C, away
 *    from zero only for negative deltas which never occur because
 *    the host clock is monotonic), NOT rounding-to-nearest and NOT
 *    rounding-up,
 *  - the formula is BASELINE-RELATIVE (the baseline is captured
 *    once at first call and the formula reads `delta = current -
 *    basetime` on every subsequent call), NOT epoch-relative,
 *  - per-frame "new tics to run" is `total_tics - last_total_tics`
 *    where `total_tics` is the absolute count from baseline, NOT
 *    accumulated incrementally — this avoids drift from rounding
 *    error accumulation if the formula were applied to per-frame
 *    deltas instead of absolute deltas,
 *  - the formula is MONOTONIC NON-DECREASING as the host clock
 *    advances (which it does monotonically by host-OS contract),
 *  - the first call from a freshly-baselined state returns 0
 *    (because `delta = 0`, so `tics = floor(0 * 35 / freq) = 0`),
 *  - the fundamental cadence is exactly 35 tics per second of host
 *    wall time (by construction: `floor(units_per_second * 35 /
 *    units_per_second) = 35`).
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. id Software `linuxdoom-1.10` source — PRIMARY for the
 *      `TICRATE` definition and the `I_GetTime` formula, both of
 *      which are textual constants the binary cannot disagree with,
 *   4. Chocolate Doom 2.2.1 source — secondary; the
 *      `(ticks * TICRATE) / 1000` SDL formula is a deliberate
 *      port-of-port preserving the canonical accumulator semantics
 *      while swapping the host clock from `gettimeofday`
 *      microseconds to `SDL_GetTicks` milliseconds,
 *   5. DoomWiki only for orientation.
 *
 * This audit pins:
 *  - the canonical `#define TICRATE 35` in `linuxdoom-1.10/doomdef.h`,
 *  - the canonical vanilla `I_GetTime` body in
 *    `linuxdoom-1.10/i_system.c` (formula, lazy basetime capture,
 *    `int` return type, function-local static basetime),
 *  - the canonical Chocolate Doom 2.2.1 `I_GetTime` body in
 *    `chocolate-doom-2.2.1/src/i_timer.c` (formula, lazy basetime
 *    capture, file-scope static basetime, separate `I_GetTimeMS`
 *    that returns the raw millisecond delta without TICRATE scaling),
 *  - the operational invariants every parity-faithful re-implementation
 *    must honour (fresh-baseline-returns-zero, integer-truncating,
 *    baseline-relative, monotonic non-decreasing, exact-35-per-second,
 *    no premature wrap, two-instance independence, idempotent
 *    advance to same counter, baseline offset does not affect delta
 *    math, supports millisecond / microsecond / QPC clock resolutions),
 *  - a curated probe table covering canonical wall-clock-to-tic
 *    boundaries (zero-delta, sub-tic-boundary, tic-boundary, one
 *    second, two seconds, one minute, one hour, microsecond
 *    resolution, QPC resolution, nonzero baseline offset),
 *  - and a cross-check helper that any candidate (factory + per-instance
 *    `totalTics` getter + `advanceTo(currentCounter)` operation +
 *    `reset(currentCounter)` operation) tuple must satisfy.
 *
 * The audit module deliberately does NOT import from
 * `src/host/ticAccumulator.ts` (or any runtime tic-accumulator
 * module). Hardcoding the canonical TICRATE value, formula, and
 * probe expectations here means a corruption of the runtime
 * accumulator cannot also silently corrupt the audit that detects
 * the corruption. The focused test validates the ledger AND a
 * hand-rolled reference candidate that mirrors vanilla semantics;
 * a future step will wire a runtime cross-check against
 * `src/host/ticAccumulator.ts` once that module enters this lane's
 * read-only path.
 */

/**
 * Audited canonical TICRATE constant — exactly 35. Defined as the
 * verbatim `#define TICRATE\t\t35` in `linuxdoom-1.10/doomdef.h`
 * and inherited unchanged by Chocolate Doom 2.2.1
 * (`src/doom/doomdef.h`). Pinned independently of any runtime
 * module so a transcription drift (e.g. a port that uses 30 Hz to
 * match NTSC field rate or 60 Hz to match modern monitor refresh
 * rate) fails loudly. Every per-tic timer in the engine
 * (intermission `cnt_pause = TICRATE`, hudMessages `4 * TICRATE`,
 * platforms `TICRATE * PLATWAIT`, doors `30 * TICRATE`,
 * automap `4 * TICRATE` pan, weapon-state `S_PISTOL` durations,
 * `INVULNTICS = 30 * TICRATE`, `INVISTICS = 60 * TICRATE`) reads
 * this constant; a port that miscalibrates the value would visibly
 * desync every animation, intermission, and powerup duration in
 * the engine.
 */
export const AUDITED_TICRATE = 35;

/**
 * Audited canonical `units_per_second` for the vanilla
 * `linuxdoom-1.10/i_system.c` `I_GetTime` formula — exactly
 * 1_000_000 (microseconds, from `gettimeofday`'s `tv_usec` field).
 * Pinned because the canonical formula
 * `newtics = (tp.tv_sec - basetime) * TICRATE + tp.tv_usec * TICRATE / 1000000;`
 * combines a seconds component scaled by `TICRATE` directly with a
 * microseconds component scaled by `TICRATE / 1_000_000` — both
 * pieces use 1_000_000 as the implicit microseconds-per-second
 * denominator.
 */
export const AUDITED_VANILLA_UNITS_PER_SECOND_MICROSECONDS = 1_000_000;

/**
 * Audited canonical `units_per_second` for the Chocolate Doom 2.2.1
 * `src/i_timer.c` `I_GetTime` formula — exactly 1_000
 * (milliseconds, from `SDL_GetTicks`). Pinned because the formula
 * `return (ticks * TICRATE) / 1000;` uses 1_000 as the explicit
 * milliseconds-per-second denominator.
 */
export const AUDITED_CHOCOLATE_UNITS_PER_SECOND_MILLISECONDS = 1_000;

/**
 * Audited canonical fresh-baseline total tic count — exactly 0.
 * Pinned because both the vanilla `static int basetime=0; ...
 * if (!basetime) basetime = tp.tv_sec;` lazy-capture pattern and
 * the Chocolate `static Uint32 basetime = 0; ... if (basetime == 0)
 * basetime = ticks;` pattern guarantee `delta = 0` on the first
 * call, and `floor(0 * 35 / units_per_second) = 0`. A port that
 * seeds the baseline from epoch (instead of capturing on first
 * call) would observe a large nonzero tic count on the first call,
 * shifting every absolute-deadline schedule (mouseWait/joyWait,
 * `(gametic & 3)` monster scheduling) by that initial offset.
 */
export const AUDITED_FRESH_TOTAL_TICS = 0;

/**
 * Audited canonical tic count after exactly one second of wall
 * time — exactly 35. The formula `floor(units_per_second * TICRATE
 * / units_per_second)` reduces to TICRATE for any units_per_second.
 * Pinned to defend against a port that miscalibrates the
 * units_per_second denominator (e.g., a port that treats
 * `gettimeofday` microseconds as milliseconds would observe 35000
 * tics per second of wall time).
 */
export const AUDITED_ONE_SECOND_TICS = 35;

/**
 * Audited canonical tic count after exactly one minute (60 seconds)
 * of wall time — exactly 2100 (= 35 * 60). Pinned alongside the
 * one-second probe to defend against a port that wraps the tic
 * count at a 1024 boundary (a common temptation when packing
 * tics into a 10-bit field) — that port would observe 76 (= 2100 -
 * 2 * 1024) instead of 2100.
 */
export const AUDITED_ONE_MINUTE_TICS = 2100;

/**
 * Audited canonical tic count after exactly one hour of wall time
 * — exactly 126_000 (= 35 * 60 * 60). Pinned to defend against a
 * port that uses a 16-bit type for the tic counter, which would
 * wrap at 65_536 (well below one game hour and below even the
 * canonical demo tick limit of `MAXDEMOTICS = 360`).
 */
export const AUDITED_ONE_HOUR_TICS = 126_000;

/**
 * Audited canonical source file for the `#define TICRATE 35`
 * declaration — exactly `linuxdoom-1.10/doomdef.h`. Pinned to
 * disambiguate from any future refactor that splits doomdef.h.
 */
export const AUDITED_TICRATE_DEFINITION_FILE = 'linuxdoom-1.10/doomdef.h';

/**
 * Audited canonical source file for the vanilla `I_GetTime` body
 * — exactly `linuxdoom-1.10/i_system.c`. Pinned because vanilla
 * places the host-clock conversion in the platform-specific
 * `i_system.c` (NOT `g_game.c` or `d_main.c`).
 */
export const AUDITED_VANILLA_I_GET_TIME_FILE = 'linuxdoom-1.10/i_system.c';

/**
 * Audited canonical source file for the Chocolate Doom 2.2.1
 * `I_GetTime` body — exactly `chocolate-doom-2.2.1/src/i_timer.c`.
 * Pinned because Chocolate refactored the timer code out of
 * `i_system.c` (where vanilla kept it) into a dedicated `i_timer.c`
 * for the SDL port; a parity-faithful re-implementation is free to
 * locate the formula in either file as long as the contract
 * (lazy-baseline, integer-truncating, formula) is preserved.
 */
export const AUDITED_CHOCOLATE_I_GET_TIME_FILE = 'chocolate-doom-2.2.1/src/i_timer.c';

/**
 * Audited verbatim canonical TICRATE definition statement form —
 * exactly `#define TICRATE\t\t35` (with two tab characters between
 * the macro name and the value, matching the upstream alignment
 * with the surrounding `#define` block). Pinned because the
 * preprocessor treats this as a literal substitution: a port that
 * uses `const int TICRATE = 35;` would still compile but would
 * lose the constant-folding that the original arithmetic relies
 * on.
 */
export const AUDITED_TICRATE_DEFINITION_STATEMENT = '#define TICRATE\t\t35';

/**
 * Stable identifier for one pinned C-source fact about the canonical
 * tic accumulator contract.
 */
export type DoomTicAccumulatorFactId =
  | 'C_HEADER_TICRATE_DEFINED_AS_THIRTY_FIVE'
  | 'C_BODY_LINUXDOOM_I_GET_TIME_USES_TIMEVAL'
  | 'C_BODY_LINUXDOOM_I_GET_TIME_FORMULA'
  | 'C_BODY_LINUXDOOM_I_GET_TIME_BASETIME_LAZY_CAPTURE'
  | 'C_BODY_LINUXDOOM_I_GET_TIME_RETURNS_INT'
  | 'C_BODY_LINUXDOOM_BASETIME_IS_FUNCTION_LOCAL_STATIC'
  | 'C_BODY_CHOCOLATE_I_GET_TIME_USES_SDL_GETTICKS'
  | 'C_BODY_CHOCOLATE_I_GET_TIME_FORMULA'
  | 'C_BODY_CHOCOLATE_I_GET_TIME_BASETIME_LAZY_CAPTURE'
  | 'C_BODY_CHOCOLATE_BASETIME_IS_FILE_SCOPE_STATIC'
  | 'C_BODY_CHOCOLATE_I_GET_TIME_MS_RETURNS_RAW_DELTA'
  | 'C_BEHAVIOR_TIC_FORMULA_IS_INTEGER_TRUNCATING'
  | 'C_BEHAVIOR_TIC_RESULT_IS_BASELINE_RELATIVE'
  | 'C_BEHAVIOR_TIC_FORMULA_IS_MONOTONIC_NONDECREASING'
  | 'C_BEHAVIOR_FRESH_BASETIME_FIRST_CALL_RETURNS_ZERO';

/** One pinned C-source fact about the tic accumulator contract. */
export interface DoomTicAccumulatorFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomTicAccumulatorFactId;
  /** Whether the fact comes from the upstream C declaration, the upstream C body, or a derived behavior shared across both. */
  readonly category: 'c-behavior' | 'c-body' | 'c-header';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet. */
  readonly cReference: string;
  /** Reference source file path inside the upstream tree. */
  readonly referenceSourceFile: 'chocolate-doom-2.2.1/src/i_timer.c' | 'linuxdoom-1.10/doomdef.h' | 'linuxdoom-1.10/i_system.c' | 'shared:vanilla+chocolate';
}

/**
 * Pinned ledger of fifteen C-source facts that together define the
 * canonical tic accumulator contract. The focused test asserts the
 * ledger is closed (every id appears exactly once) and that every
 * fact is honoured by the runtime.
 *
 * Categorisation:
 *  - `c-header` — preprocessor or file-scope declaration whose value
 *    is visible without entering any function body.
 *  - `c-body`   — function body statement specific to one upstream
 *    source (vanilla or Chocolate).
 *  - `c-behavior` — derived behavior shared by both vanilla and
 *    Chocolate Doom that follows from the formula's algebraic
 *    structure (integer-truncating division, baseline-relative
 *    delta, monotonic non-decreasing output, fresh-baseline-zero).
 */
export const DOOM_TIC_ACCUMULATOR_AUDIT: readonly DoomTicAccumulatorFact[] = [
  {
    id: 'C_HEADER_TICRATE_DEFINED_AS_THIRTY_FIVE',
    category: 'c-header',
    description:
      'The preprocessor macro `#define TICRATE 35` (with two tab characters between TICRATE and 35) appears in `linuxdoom-1.10/doomdef.h` under the verbatim header comment "State updates, number of tics / second." and is inherited unchanged by Chocolate Doom 2.2.1 in `src/doom/doomdef.h`. Pinned because every tic-based timer in the engine (intermission, hudMessages, platforms, doors, automap, weapon-state, INVULNTICS / INVISTICS / INFRATICS / IRONTICS powerup durations) reads this constant; a port that miscalibrates the value would visibly desync every animation, intermission, and powerup duration in the engine.',
    cReference: '#define TICRATE\t\t35',
    referenceSourceFile: 'linuxdoom-1.10/doomdef.h',
  },
  {
    id: 'C_BODY_LINUXDOOM_I_GET_TIME_USES_TIMEVAL',
    category: 'c-body',
    description:
      'The vanilla `I_GetTime` body in `linuxdoom-1.10/i_system.c` reads the host clock via `gettimeofday(&tp, &tzp);` where `tp` is a `struct timeval` and `tzp` is a `struct timezone`. Pinned because `gettimeofday` reports microseconds (1_000_000 per second) — a port that confuses the resolution and treats `tv_usec` as milliseconds (1_000 per second) would scale the tic count by 1000x.',
    cReference: 'gettimeofday(&tp, &tzp);',
    referenceSourceFile: 'linuxdoom-1.10/i_system.c',
  },
  {
    id: 'C_BODY_LINUXDOOM_I_GET_TIME_FORMULA',
    category: 'c-body',
    description:
      'The vanilla tic formula in `linuxdoom-1.10/i_system.c` is `newtics = (tp.tv_sec - basetime) * TICRATE + tp.tv_usec * TICRATE / 1000000;` — a sum of two pieces, the seconds component `(tp.tv_sec - basetime) * TICRATE` (exact, no truncation) and the microseconds component `tp.tv_usec * TICRATE / 1000000` (integer-truncated). The combined output equals `floor(((tp.tv_sec - basetime) * 1000000 + tp.tv_usec) * TICRATE / 1000000)` — i.e. the formula is mathematically `floor(delta_microseconds * TICRATE / 1000000)`. Pinned because a port that omits the seconds component (or hoists `tv_usec * TICRATE` out of the integer division) would silently drift on long sessions.',
    cReference: 'newtics = (tp.tv_sec-basetime)*TICRATE + tp.tv_usec*TICRATE/1000000;',
    referenceSourceFile: 'linuxdoom-1.10/i_system.c',
  },
  {
    id: 'C_BODY_LINUXDOOM_I_GET_TIME_BASETIME_LAZY_CAPTURE',
    category: 'c-body',
    description:
      'The vanilla `I_GetTime` body captures its baseline lazily: `if (!basetime) basetime = tp.tv_sec;` — the baseline is set ONCE on the first call (when the file-scope `static int basetime=0;` is still zero) and never reassigned. Pinned because a port that captures the baseline at process start (e.g., in `D_DoomMain`) would behave equivalently here, but a port that reseeds the baseline on every call (treating it as a sliding-window reference) would degenerate to per-frame deltas and lose the absolute monotonic walk that the per-frame `total_tics - last_total_tics` subtraction relies on.',
    cReference: 'if (!basetime)\n\tbasetime = tp.tv_sec;',
    referenceSourceFile: 'linuxdoom-1.10/i_system.c',
  },
  {
    id: 'C_BODY_LINUXDOOM_I_GET_TIME_RETURNS_INT',
    category: 'c-body',
    description:
      'The vanilla `I_GetTime` signature is `int I_GetTime (void)` — the return type is `int` (signed integer, typically 32-bit on the original target), NOT `unsigned int`, NOT `long`, NOT `int64_t`. Pinned because the `int` return type means every consumer (`TryRunTics`, demo timing, the `runtics = nowtime - lasttime;` subtraction in `D_DoomLoop`) operates on signed integer arithmetic; a port that widens the type silently would not change observable behavior immediately but would defer the eventual wrap from ~2.4 years (signed 32-bit at 35 Hz) to ~9.7 billion years (signed 64-bit), which differs from the canonical type contract.',
    cReference: 'int  I_GetTime (void)',
    referenceSourceFile: 'linuxdoom-1.10/i_system.c',
  },
  {
    id: 'C_BODY_LINUXDOOM_BASETIME_IS_FUNCTION_LOCAL_STATIC',
    category: 'c-body',
    description:
      'The vanilla `basetime` storage is a function-local `static int basetime=0;` declared inside the `I_GetTime` function body — the variable has internal linkage scoped to the single function. Pinned because the function-local-static placement means no other translation unit can reset or read the baseline, eliminating the possibility of a stray reset from an unrelated init sequence. A port that promotes `basetime` to file-scope (which Chocolate Doom 2.2.1 does for the SDL port — see fact `C_BODY_CHOCOLATE_BASETIME_IS_FILE_SCOPE_STATIC`) preserves the contract as long as no other file modifies it.',
    cReference: 'static int\t\tbasetime=0;',
    referenceSourceFile: 'linuxdoom-1.10/i_system.c',
  },
  {
    id: 'C_BODY_CHOCOLATE_I_GET_TIME_USES_SDL_GETTICKS',
    category: 'c-body',
    description:
      'The Chocolate Doom 2.2.1 `I_GetTime` body in `chocolate-doom-2.2.1/src/i_timer.c` reads the host clock via `Uint32 ticks = SDL_GetTicks();` — `SDL_GetTicks()` returns the count of milliseconds since SDL was initialized as a `Uint32` (32-bit unsigned). Pinned because `SDL_GetTicks` reports milliseconds (1_000 per second), NOT microseconds — a port that uses a microsecond clock with the Chocolate formula would scale the tic count by 1000x (35_000 tics per second).',
    cReference: 'ticks = SDL_GetTicks();',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/i_timer.c',
  },
  {
    id: 'C_BODY_CHOCOLATE_I_GET_TIME_FORMULA',
    category: 'c-body',
    description:
      'The Chocolate tic formula in `chocolate-doom-2.2.1/src/i_timer.c` is `return (ticks * TICRATE) / 1000;` after `ticks -= basetime;` — a single integer division with `1000` as the milliseconds-per-second denominator. The output equals `floor(delta_milliseconds * TICRATE / 1000)`. Pinned because a port that swaps the order of operations (computes `ticks / 1000 * TICRATE` instead) would lose sub-second resolution: every fractional tic would round to zero before being scaled to TICRATE, and the result would only update at one-second granularity.',
    cReference: 'return (ticks * TICRATE) / 1000;',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/i_timer.c',
  },
  {
    id: 'C_BODY_CHOCOLATE_I_GET_TIME_BASETIME_LAZY_CAPTURE',
    category: 'c-body',
    description:
      "The Chocolate `I_GetTime` body captures its baseline lazily: `if (basetime == 0) basetime = ticks;` — the baseline is set ONCE on the first call (when the file-scope `static Uint32 basetime = 0;` is still zero) and never reassigned. Pinned because the explicit `== 0` test (instead of vanilla's `!basetime`) is functionally identical for unsigned types and preserves the same fresh-capture-once contract.",
    cReference: 'if (basetime == 0)\n        basetime = ticks;',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/i_timer.c',
  },
  {
    id: 'C_BODY_CHOCOLATE_BASETIME_IS_FILE_SCOPE_STATIC',
    category: 'c-body',
    description:
      'The Chocolate `basetime` storage is a file-scope `static Uint32 basetime = 0;` declaration at the top of `i_timer.c` — the variable has internal linkage scoped to the entire translation unit, so both `I_GetTime` and `I_GetTimeMS` share the same baseline. Pinned because the shared file-scope basetime ensures that `I_GetTime` and `I_GetTimeMS` agree on the time origin (a caller can sample both functions and convert between tic count and milliseconds without basetime drift).',
    cReference: 'static Uint32 basetime = 0;',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/i_timer.c',
  },
  {
    id: 'C_BODY_CHOCOLATE_I_GET_TIME_MS_RETURNS_RAW_DELTA',
    category: 'c-body',
    description:
      'Chocolate Doom 2.2.1 also exposes `I_GetTimeMS` in `i_timer.c` whose body is `ticks = SDL_GetTicks(); if (basetime == 0) basetime = ticks; return ticks - basetime;` — it returns the raw millisecond delta WITHOUT TICRATE scaling. Pinned because the existence of a separate "raw delta" function confirms the canonical separation of concerns: the tic conversion (multiplying by TICRATE then dividing by units-per-second) is the responsibility of `I_GetTime`, NOT the host clock or its raw-delta accessor. A port that bakes TICRATE into the host clock primitive would conflate the two.',
    cReference: 'return ticks - basetime;',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/i_timer.c',
  },
  {
    id: 'C_BEHAVIOR_TIC_FORMULA_IS_INTEGER_TRUNCATING',
    category: 'c-behavior',
    description:
      'Both the vanilla `tp.tv_usec * TICRATE / 1000000` and the Chocolate `(ticks * TICRATE) / 1000` use C integer division `/` — the result truncates toward zero (i.e., for non-negative operands, it floors). Pinned because a port that uses floating-point division and rounds-to-nearest (or rounds-up) would observe the K-th tic boundary one host-clock unit earlier than the canonical formula on roughly half of all boundaries. Specifically, with millisecond resolution, the canonical first tic boundary is at 29 ms (since `floor(29 * 35 / 1000) = floor(1015/1000) = 1` but `floor(28 * 35 / 1000) = floor(980/1000) = 0`); a rounding-to-nearest port would observe tic 1 at 28 ms (since `28 * 35 / 1000 = 0.98` rounds to 1), shifting every tic boundary earlier by one host-clock unit.',
    cReference: '(ticks * TICRATE) / 1000',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
  {
    id: 'C_BEHAVIOR_TIC_RESULT_IS_BASELINE_RELATIVE',
    category: 'c-behavior',
    description:
      'Both formulas compute `delta = current - basetime` then `tics = floor(delta * TICRATE / units_per_second)`. The output is BASELINE-RELATIVE (the absolute clock origin can be the Unix epoch, SDL initialization moment, system boot, or any other fixed moment — the formula subtracts the baseline before applying TICRATE), NOT EPOCH-RELATIVE. Pinned because a port that omits the baseline subtraction would observe `tics ≈ 35 * (Unix epoch seconds)` ≈ 60+ trillion on first call in 2026, which would silently work for the per-frame `total_tics - last_total_tics` subtraction (the constant offset cancels) BUT would break demo timing (which expects absolute tic values starting near zero) and would overflow `int` (signed 32-bit max ≈ 2.1B at 35 Hz ≈ 60 million seconds ≈ 1.9 years from epoch = 1971-08-23 — already overflowed by current time).',
    cReference: 'ticks -= basetime;',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
  {
    id: 'C_BEHAVIOR_TIC_FORMULA_IS_MONOTONIC_NONDECREASING',
    category: 'c-behavior',
    description:
      'As `delta` grows monotonically (which it does because the host clock is monotonic by OS contract — `gettimeofday` returns the wall clock which can be set backwards but is rarely so by an active OS, and `SDL_GetTicks` is documented as a monotonic counter), the output `floor(delta * TICRATE / units_per_second)` is monotonic non-decreasing. Pinned because a port that uses a non-monotonic clock (e.g. `time(NULL)` after a manual clock adjustment, or a `Date.now()`-based clock that reflects user wall-clock changes) would observe a backwards jump in the tic count, which would break the per-frame `total_tics - last_total_tics` subtraction (it could go negative, and a port that runs `for (i=0; i<newtics; i++)` would either skip the body or run a near-infinite loop depending on the loop variable type).',
    cReference: 'newtics = (tp.tv_sec-basetime)*TICRATE + tp.tv_usec*TICRATE/1000000;',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
  {
    id: 'C_BEHAVIOR_FRESH_BASETIME_FIRST_CALL_RETURNS_ZERO',
    category: 'c-behavior',
    description:
      'On the first call from a freshly-initialised state (basetime still zero, lazy capture pattern fires), both formulas observe `current == captured_basetime`, so `delta = 0`, and `floor(0 * TICRATE / units_per_second) = 0`. Pinned because every parity-faithful re-implementation must observe a zero tic count on the first call (this is the contract that lets the engine schedule its first frame at gametic=0, preventing the first frame from running anomalously many tics). A port that pre-seeds `basetime` from a different clock, or that runs the host clock for some time before calling `I_GetTime` for the first time without lazy capture, would observe a nonzero first call.',
    cReference: 'if (basetime == 0)\n        basetime = ticks;\n    ticks -= basetime;',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
] as const;

/**
 * Stable identifier for one operational invariant the cross-check
 * helper enforces against any candidate tic accumulator surface
 * tuple.
 */
export type DoomTicAccumulatorInvariantId =
  | 'TIC_ACCUMULATOR_FRESH_TOTAL_TICS_IS_ZERO'
  | 'TIC_ACCUMULATOR_ADVANCE_TO_BASELINE_RETURNS_ZERO_NEW_TICS'
  | 'TIC_ACCUMULATOR_TOTAL_TICS_IS_FLOOR_OF_DELTA_TIMES_TICRATE_OVER_FREQUENCY'
  | 'TIC_ACCUMULATOR_NEW_TICS_EQUALS_TOTAL_TICS_DELTA'
  | 'TIC_ACCUMULATOR_TOTAL_TICS_NEVER_DECREASES_AS_CLOCK_ADVANCES'
  | 'TIC_ACCUMULATOR_NEW_TICS_AT_ONE_SECOND_BOUNDARY_IS_THIRTY_FIVE'
  | 'TIC_ACCUMULATOR_INTEGER_TRUNCATING_DIVISION_NOT_ROUNDING'
  | 'TIC_ACCUMULATOR_RESET_ZEROES_TOTAL_TICS'
  | 'TIC_ACCUMULATOR_TWO_INSTANCES_ARE_INDEPENDENT'
  | 'TIC_ACCUMULATOR_NONZERO_BASELINE_DOES_NOT_AFFECT_DELTA_MATH'
  | 'TIC_ACCUMULATOR_IDEMPOTENT_ADVANCE_TO_SAME_COUNTER_RETURNS_ZERO'
  | 'TIC_ACCUMULATOR_SUPPORTS_MILLISECOND_CLOCK_RESOLUTION'
  | 'TIC_ACCUMULATOR_SUPPORTS_MICROSECOND_CLOCK_RESOLUTION'
  | 'TIC_ACCUMULATOR_SUPPORTS_HIGH_RESOLUTION_QPC_CLOCK'
  | 'TIC_ACCUMULATOR_NO_PREMATURE_WRAP_AT_ONE_HOUR';

/** One operational invariant the cross-check helper enforces. */
export interface DoomTicAccumulatorInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomTicAccumulatorInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of fifteen operational invariants. The focused test
 * asserts the ledger is closed and that the cross-check helper
 * returns exactly the right failure id for each tampered candidate.
 */
export const DOOM_TIC_ACCUMULATOR_INVARIANTS: readonly DoomTicAccumulatorInvariant[] = [
  {
    id: 'TIC_ACCUMULATOR_FRESH_TOTAL_TICS_IS_ZERO',
    description:
      'A freshly-constructed accumulator with any baseline counter and any units-per-second exposes `totalTics === 0` before any advance. Pinned because the canonical lazy-capture pattern guarantees `delta = 0` on the first call.',
  },
  {
    id: 'TIC_ACCUMULATOR_ADVANCE_TO_BASELINE_RETURNS_ZERO_NEW_TICS',
    description:
      'Calling `advanceTo(baselineCounter)` on a fresh accumulator returns 0 new tics (because `delta = 0` and `floor(0 * 35 / freq) = 0`). Pinned to defend against a port that returns 1 on first call (a common temptation when treating "frame 1 just started" as "1 tic to run").',
  },
  {
    id: 'TIC_ACCUMULATOR_TOTAL_TICS_IS_FLOOR_OF_DELTA_TIMES_TICRATE_OVER_FREQUENCY',
    description:
      'For any units-per-second `F`, baseline `B`, and current counter `C >= B`, the post-advance `totalTics === floor((C - B) * 35 / F)`. Pinned across a sweep of (F, B, C) tuples to defend against a port that uses rounding-to-nearest division, that omits the baseline subtraction, that hard-codes the units-per-second, or that scales by a wrong TICRATE.',
  },
  {
    id: 'TIC_ACCUMULATOR_NEW_TICS_EQUALS_TOTAL_TICS_DELTA',
    description:
      'Across consecutive `advanceTo(C1)`, `advanceTo(C2)` calls, the second call returns `totalTics_after_C2 - totalTics_after_C1`. Pinned because the canonical per-frame "new tics to run" is computed as the absolute-tic delta, NOT incrementally accumulated from per-frame counter deltas (which would drift due to integer truncation).',
  },
  {
    id: 'TIC_ACCUMULATOR_TOTAL_TICS_NEVER_DECREASES_AS_CLOCK_ADVANCES',
    description:
      'Across any sequence of advances with non-decreasing counter values, `totalTics` is monotonic non-decreasing. Pinned because the canonical formula `floor(delta * TICRATE / freq)` is monotonic non-decreasing in `delta` (the host clock is monotonic by OS contract).',
  },
  {
    id: 'TIC_ACCUMULATOR_NEW_TICS_AT_ONE_SECOND_BOUNDARY_IS_THIRTY_FIVE',
    description: 'A fresh accumulator with units-per-second `F`, advanced to baseline+F, returns 35 new tics. Pinned for F in {1_000, 1_000_000, 10_000_000} — the canonical millisecond, microsecond, and 10 MHz QPC frequencies.',
  },
  {
    id: 'TIC_ACCUMULATOR_INTEGER_TRUNCATING_DIVISION_NOT_ROUNDING',
    description:
      'For F=1000, advancing from baseline to baseline+28 returns 0 new tics (`floor(28*35/1000) = floor(980/1000) = 0`); advancing to baseline+29 returns 1 new tic (`floor(29*35/1000) = floor(1015/1000) = 1`). Pinned to defend against a port that uses rounding-to-nearest division, which would observe the first tic boundary at 28 ms instead of 29 ms.',
  },
  {
    id: 'TIC_ACCUMULATOR_RESET_ZEROES_TOTAL_TICS',
    description:
      'After `reset(currentCounter)`, the accumulator exposes `totalTics === 0` and a subsequent `advanceTo(currentCounter)` returns 0 new tics. Pinned because the canonical reset semantics (used in `D_StartGameLoop` to re-anchor the baseline at game start) must zero the accumulated count and re-arm the lazy-capture pattern.',
  },
  {
    id: 'TIC_ACCUMULATOR_TWO_INSTANCES_ARE_INDEPENDENT',
    description:
      'Two independently-constructed accumulators do not share state: advancing instance A by 1000 ms leaves instance B at totalTics=0. Pinned because a port that uses a global `static` baseline (matching the C lazy-capture pattern at the static-storage level) is fine for a single-process engine but breaks test fixtures that construct multiple instances.',
  },
  {
    id: 'TIC_ACCUMULATOR_NONZERO_BASELINE_DOES_NOT_AFFECT_DELTA_MATH',
    description:
      'For any baseline counter `B` and any current counter `C >= B`, `totalTics === floor((C - B) * 35 / F)` — the output depends only on the delta `C - B`, not on the absolute value of `B`. Pinned across multiple baseline values (0, 1_000_000, 0xFFFF_FFFF, a large 64-bit value) to defend against a port that omits the baseline subtraction and feeds `C * 35 / F` directly into the formula.',
  },
  {
    id: 'TIC_ACCUMULATOR_IDEMPOTENT_ADVANCE_TO_SAME_COUNTER_RETURNS_ZERO',
    description:
      'After `advanceTo(C)`, a subsequent `advanceTo(C)` (same counter, no time has passed) returns 0 new tics. Pinned because the canonical "compute total from absolute baseline, return delta" pattern guarantees that re-sampling the same clock reading produces zero new tics; a port that uses incremental accumulation (per-frame delta plumbed through TICRATE conversion separately) would still return 0 here, but a port that defines "new tics" as the post-state minus a per-frame snapshot would corrupt the value if the snapshot was not taken atomically.',
  },
  {
    id: 'TIC_ACCUMULATOR_SUPPORTS_MILLISECOND_CLOCK_RESOLUTION',
    description:
      'Construct an accumulator with units-per-second F=1000 (matching `SDL_GetTicks` resolution), advance to baseline+1000, observe totalTics=35; advance to baseline+2000, observe totalTics=70. Pinned because the Chocolate Doom 2.2.1 SDL port targets exactly this resolution.',
  },
  {
    id: 'TIC_ACCUMULATOR_SUPPORTS_MICROSECOND_CLOCK_RESOLUTION',
    description:
      'Construct an accumulator with units-per-second F=1_000_000 (matching `gettimeofday` microsecond resolution), advance to baseline+1_000_000, observe totalTics=35; advance to baseline+2_000_000, observe totalTics=70. Pinned because the linuxdoom-1.10 vanilla port targets exactly this resolution.',
  },
  {
    id: 'TIC_ACCUMULATOR_SUPPORTS_HIGH_RESOLUTION_QPC_CLOCK',
    description:
      'Construct an accumulator with units-per-second F=10_000_000 (matching a typical Win32 QueryPerformanceCounter resolution of 10 MHz), advance to baseline+10_000_000, observe totalTics=35. Pinned because the Win32 host this project runs on uses QPC, NOT `SDL_GetTicks` or `gettimeofday`; the formula must be agnostic to the host clock resolution.',
  },
  {
    id: 'TIC_ACCUMULATOR_NO_PREMATURE_WRAP_AT_ONE_HOUR',
    description:
      'Construct an accumulator with F=1000 and advance to baseline+3_600_000 (one hour of millisecond ticks), observe totalTics=126_000. Pinned to defend against a port that uses a 16-bit type for the tic counter (which would wrap at 65_536) or a `Uint16` mid-formula that would overflow at much smaller deltas.',
  },
] as const;

/** Stable identifier for one curated tic accumulator probe. */
export type DoomTicAccumulatorProbeId =
  | 'fresh_accumulator_total_tics_is_zero'
  | 'fresh_accumulator_total_tics_is_zero_with_nonzero_baseline'
  | 'advance_to_baseline_returns_zero_new_tics'
  | 'advance_one_unit_below_first_tic_returns_zero'
  | 'advance_to_first_tic_boundary_returns_one'
  | 'advance_to_one_second_returns_thirty_five'
  | 'advance_to_two_seconds_returns_seventy'
  | 'advance_to_one_unit_below_second_tic_returns_one'
  | 'advance_to_second_tic_boundary_returns_two'
  | 'microsecond_clock_advance_to_one_second_returns_thirty_five'
  | 'microsecond_clock_advance_below_first_tic_returns_zero'
  | 'microsecond_clock_advance_to_first_tic_returns_one'
  | 'qpc_clock_advance_to_one_second_returns_thirty_five'
  | 'one_minute_at_millisecond_resolution_returns_two_thousand_one_hundred'
  | 'one_hour_at_millisecond_resolution_returns_one_hundred_twenty_six_thousand'
  | 'consecutive_advances_return_per_window_delta'
  | 'nonzero_baseline_offset_preserves_delta_math'
  | 'reset_zeroes_total_tics'
  | 'reset_then_advance_to_one_second_returns_thirty_five';

/** Which kind of expectation a probe pins. */
export type DoomTicAccumulatorProbeTarget = 'new_tics_after_sequence' | 'total_tics_after_sequence';

/**
 * One step in the per-probe construction sequence: either an
 * `advance` to the given counter delta from baseline, or a `reset`
 * with the given counter delta from baseline.
 */
export interface DoomTicAccumulatorProbeStep {
  readonly kind: 'advance' | 'reset';
  /** Counter offset from the construction baseline (in host-clock units). */
  readonly counterOffset: bigint;
}

/** One curated tic accumulator probe expectation. */
export interface DoomTicAccumulatorProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomTicAccumulatorProbeId;
  /** Which surface this probe inspects. */
  readonly target: DoomTicAccumulatorProbeTarget;
  /**
   * Construction parameters for the freshly-built accumulator.
   * The harness performs `candidate.create(unitsPerSecond,
   * baselineCounter)` then plays back the step sequence.
   */
  readonly create: {
    readonly unitsPerSecond: bigint;
    readonly baselineCounter: bigint;
  };
  /**
   * Sequence of steps applied from the freshly-built state. The
   * `target` field selects which observation is captured:
   *  - `total_tics_after_sequence`: after the last step, read
   *    `instance.totalTics`.
   *  - `new_tics_after_sequence`: capture the return value of the
   *    LAST step (which must be an `advance`).
   */
  readonly steps: readonly DoomTicAccumulatorProbeStep[];
  /** Expected canonical observed value. */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/**
 * Curated probe table of nineteen probes covering the canonical tic
 * accumulator contract. Each probe is hand-pinned from the
 * canonical vanilla and Chocolate sources and re-verified by the
 * focused test against a hand-rolled reference candidate.
 *
 * Coverage:
 *  - fresh-instance state at zero and nonzero baselines (totalTics=0).
 *  - sub-tic-boundary probes at millisecond resolution (28 ms below
 *    first tic, 29 ms at first tic, 57 ms below second tic, 58 ms
 *    at second tic).
 *  - one-second probe at three host-clock resolutions (1ms, 1us, 100ns).
 *  - one-minute and one-hour probes for premature-wrap defense.
 *  - sub-tic-boundary probes at microsecond resolution (28571 us
 *    below first tic, 28572 us at first tic).
 *  - consecutive-advance windows.
 *  - nonzero-baseline offset.
 *  - reset semantics (zero totalTics after reset, then re-arm).
 */
export const DOOM_TIC_ACCUMULATOR_PROBES: readonly DoomTicAccumulatorProbe[] = [
  {
    id: 'fresh_accumulator_total_tics_is_zero',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [],
    expected: 0,
    note: 'A freshly-constructed accumulator with zero baseline and millisecond resolution exposes totalTics === 0 before any advance. Anchors the canonical lazy-capture / fresh-zero contract.',
  },
  {
    id: 'fresh_accumulator_total_tics_is_zero_with_nonzero_baseline',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 1_000_000n },
    steps: [],
    expected: 0,
    note: 'A freshly-constructed accumulator with a nonzero baseline still exposes totalTics === 0 before any advance — confirms the baseline subtraction is intrinsic to the formula, not derived from a zero-init counter.',
  },
  {
    id: 'advance_to_baseline_returns_zero_new_tics',
    target: 'new_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 1_000_000n },
    steps: [{ kind: 'advance', counterOffset: 0n }],
    expected: 0,
    note: 'advanceTo(baseline) on a fresh accumulator returns 0 new tics — confirms delta=0 produces tics=0 regardless of baseline magnitude.',
  },
  {
    id: 'advance_one_unit_below_first_tic_returns_zero',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 28n }],
    expected: 0,
    note: 'At F=1000, advancing to baseline+28 ms produces totalTics=0 (since floor(28*35/1000) = floor(980/1000) = 0). Defends against rounding-to-nearest division, which would observe tic 1 at 28 ms.',
  },
  {
    id: 'advance_to_first_tic_boundary_returns_one',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 29n }],
    expected: 1,
    note: 'At F=1000, advancing to baseline+29 ms produces totalTics=1 (since floor(29*35/1000) = floor(1015/1000) = 1). Anchors the canonical first-tic boundary at integer-truncating division.',
  },
  {
    id: 'advance_to_one_second_returns_thirty_five',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 1000n }],
    expected: 35,
    note: 'At F=1000, advancing to baseline+1000 ms (one second) produces totalTics=35 — the canonical 35 Hz cadence by construction.',
  },
  {
    id: 'advance_to_two_seconds_returns_seventy',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 2000n }],
    expected: 70,
    note: 'At F=1000, advancing to baseline+2000 ms (two seconds) produces totalTics=70 — confirms the linear walk holds across the one-second boundary.',
  },
  {
    id: 'advance_to_one_unit_below_second_tic_returns_one',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 57n }],
    expected: 1,
    note: 'At F=1000, advancing to baseline+57 ms produces totalTics=1 (since floor(57*35/1000) = floor(1995/1000) = 1). Defends against off-by-one drift at the second tic boundary.',
  },
  {
    id: 'advance_to_second_tic_boundary_returns_two',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 58n }],
    expected: 2,
    note: 'At F=1000, advancing to baseline+58 ms produces totalTics=2 (since floor(58*35/1000) = floor(2030/1000) = 2). Anchors the second tic boundary with the same integer-truncating semantics.',
  },
  {
    id: 'microsecond_clock_advance_to_one_second_returns_thirty_five',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1_000_000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 1_000_000n }],
    expected: 35,
    note: 'At F=1_000_000 (microsecond resolution, matching gettimeofday), advancing to baseline+1_000_000 us (one second) produces totalTics=35 — confirms the formula is host-clock-resolution agnostic.',
  },
  {
    id: 'microsecond_clock_advance_below_first_tic_returns_zero',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1_000_000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 28_571n }],
    expected: 0,
    note: 'At F=1_000_000, advancing to baseline+28571 us produces totalTics=0 (since floor(28571*35/1000000) = floor(999985/1000000) = 0). Anchors the microsecond-resolution first-tic boundary.',
  },
  {
    id: 'microsecond_clock_advance_to_first_tic_returns_one',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1_000_000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 28_572n }],
    expected: 1,
    note: 'At F=1_000_000, advancing to baseline+28572 us produces totalTics=1 (since floor(28572*35/1000000) = floor(1000020/1000000) = 1). Cross-validates the millisecond first-tic probe at three orders of magnitude finer resolution.',
  },
  {
    id: 'qpc_clock_advance_to_one_second_returns_thirty_five',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 10_000_000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 10_000_000n }],
    expected: 35,
    note: 'At F=10_000_000 (10 MHz, a typical Win32 QPC frequency), advancing to baseline+10_000_000 counter units (one second) produces totalTics=35 — confirms the formula scales to the high-resolution host clock this project actually uses on Win32.',
  },
  {
    id: 'one_minute_at_millisecond_resolution_returns_two_thousand_one_hundred',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 60_000n }],
    expected: 2100,
    note: 'At F=1000, advancing to baseline+60_000 ms (one minute) produces totalTics=2100 = 35 * 60. Defends against premature wrap at sub-minute boundaries.',
  },
  {
    id: 'one_hour_at_millisecond_resolution_returns_one_hundred_twenty_six_thousand',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [{ kind: 'advance', counterOffset: 3_600_000n }],
    expected: 126000,
    note: 'At F=1000, advancing to baseline+3_600_000 ms (one hour) produces totalTics=126_000 = 35 * 60 * 60. Defends against a 16-bit tic counter that would wrap at 65_536.',
  },
  {
    id: 'consecutive_advances_return_per_window_delta',
    target: 'new_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [
      { kind: 'advance', counterOffset: 1000n },
      { kind: 'advance', counterOffset: 2000n },
    ],
    expected: 35,
    note: 'Two consecutive advances at F=1000: first to baseline+1000 (totalTics 0->35, new=35), second to baseline+2000 (totalTics 35->70, new=35). The second advance returns exactly 35 new tics — the per-window delta. Confirms new_tics is the absolute-tic delta, not an incrementally-computed approximation.',
  },
  {
    id: 'nonzero_baseline_offset_preserves_delta_math',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0xffff_ffffn },
    steps: [{ kind: 'advance', counterOffset: 1000n }],
    expected: 35,
    note: 'At F=1000 and baseline=0xFFFFFFFF (a 32-bit-MAX-adjacent value), advancing by 1000 ms produces totalTics=35 — the formula uses delta from baseline, not absolute counter, so the wide baseline does not perturb the math.',
  },
  {
    id: 'reset_zeroes_total_tics',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [
      { kind: 'advance', counterOffset: 5000n },
      { kind: 'reset', counterOffset: 5000n },
    ],
    expected: 0,
    note: 'After advancing 5 seconds (totalTics=175) then resetting at the same counter, totalTics is zero again. Confirms the reset semantics zero the absolute-tic accumulator, not just the per-frame delta.',
  },
  {
    id: 'reset_then_advance_to_one_second_returns_thirty_five',
    target: 'total_tics_after_sequence',
    create: { unitsPerSecond: 1000n, baselineCounter: 0n },
    steps: [
      { kind: 'advance', counterOffset: 5000n },
      { kind: 'reset', counterOffset: 5000n },
      { kind: 'advance', counterOffset: 6000n },
    ],
    expected: 35,
    note: 'After reset at counter 5000, the new baseline is 5000; advancing to 6000 (one second past the new baseline) produces totalTics=35. Confirms the reset re-anchors the baseline so subsequent absolute-tic counts are computed from the reset moment, NOT the original construction baseline.',
  },
] as const;

/**
 * A candidate tic accumulator surface tuple for cross-checking. The
 * tuple captures the canonical accumulator surface: a constructor
 * that returns a fresh instance with a baseline counter and a
 * host-clock units-per-second, plus a per-instance `totalTics`
 * getter, an `advanceTo(currentCounter)` operation, and a
 * `reset(currentCounter)` operation.
 */
export interface DoomTicAccumulatorCandidate {
  /**
   * Factory that returns a fresh instance with totalTics=0, the
   * given units-per-second (matching the host clock's resolution),
   * and the given baseline counter (the fresh-capture baseline
   * value).
   */
  readonly create: (unitsPerSecond: bigint, baselineCounter: bigint) => DoomTicAccumulatorCandidateInstance;
}

/** The tic accumulator surface a candidate must expose for the cross-check to inspect. */
export interface DoomTicAccumulatorCandidateInstance {
  /**
   * The current absolute tic count since the most recent baseline
   * (set at construction or by the most recent `reset`). Equal to
   * `floor((current - baseline) * 35 / unitsPerSecond)` after the
   * most recent `advanceTo`.
   */
  readonly totalTics: number;
  /**
   * Sample the counter at the given value. Must update the
   * accumulator's internal `totalTics` to match
   * `floor((currentCounter - baseline) * 35 / unitsPerSecond)`,
   * and return the count of new tics since the previous
   * `advanceTo` (or construction / reset).
   */
  advanceTo(currentCounter: bigint): number;
  /**
   * Re-anchor the baseline at the given counter value, zeroing
   * `totalTics`. Subsequent `advanceTo` calls compute the absolute
   * tic count from this new baseline.
   */
  reset(currentCounter: bigint): void;
}

/**
 * Cross-check a candidate tic accumulator surface tuple against
 * `DOOM_TIC_ACCUMULATOR_PROBES` and `DOOM_TIC_ACCUMULATOR_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the candidate honours every audited tic accumulator fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one observation.
 */
export function crossCheckDoomTicAccumulator(candidate: DoomTicAccumulatorCandidate): readonly string[] {
  const failures: string[] = [];

  // Per-probe checks
  for (const probe of DOOM_TIC_ACCUMULATOR_PROBES) {
    const instance = candidate.create(probe.create.unitsPerSecond, probe.create.baselineCounter);
    let lastNewTics = 0;
    for (const step of probe.steps) {
      const counter = probe.create.baselineCounter + step.counterOffset;
      if (step.kind === 'advance') {
        lastNewTics = instance.advanceTo(counter);
      } else {
        instance.reset(counter);
      }
    }
    let actual: number;
    if (probe.target === 'total_tics_after_sequence') {
      actual = instance.totalTics;
    } else {
      actual = lastNewTics;
    }
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  // Invariant: fresh accumulator totalTics === 0
  {
    const instance = candidate.create(1000n, 0n);
    if (instance.totalTics !== AUDITED_FRESH_TOTAL_TICS) {
      failures.push('invariant:TIC_ACCUMULATOR_FRESH_TOTAL_TICS_IS_ZERO');
    }
  }

  // Invariant: advance to baseline returns zero new tics
  {
    const instance = candidate.create(1000n, 1_000_000n);
    const newTics = instance.advanceTo(1_000_000n);
    if (newTics !== 0) {
      failures.push('invariant:TIC_ACCUMULATOR_ADVANCE_TO_BASELINE_RETURNS_ZERO_NEW_TICS');
    }
  }

  // Invariant: totalTics === floor((C - B) * 35 / F)
  {
    const cases: ReadonlyArray<readonly [bigint, bigint, bigint]> = [
      [1000n, 0n, 0n],
      [1000n, 0n, 28n],
      [1000n, 0n, 29n],
      [1000n, 0n, 1000n],
      [1000n, 0n, 60_000n],
      [1_000_000n, 0n, 1_000_000n],
      [10_000_000n, 0n, 10_000_000n],
      [1000n, 1_000_000n, 1_001_000n],
    ];
    let allMatch = true;
    for (const [F, B, C] of cases) {
      const instance = candidate.create(F, B);
      instance.advanceTo(C);
      const expected = Number(((C - B) * BigInt(AUDITED_TICRATE)) / F);
      if (instance.totalTics !== expected) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:TIC_ACCUMULATOR_TOTAL_TICS_IS_FLOOR_OF_DELTA_TIMES_TICRATE_OVER_FREQUENCY');
    }
  }

  // Invariant: new tics === totalTics delta across consecutive advances
  {
    const instance = candidate.create(1000n, 0n);
    const firstNew = instance.advanceTo(1000n);
    const totalAfterFirst = instance.totalTics;
    const secondNew = instance.advanceTo(2500n);
    const totalAfterSecond = instance.totalTics;
    if (firstNew !== totalAfterFirst || secondNew !== totalAfterSecond - totalAfterFirst) {
      failures.push('invariant:TIC_ACCUMULATOR_NEW_TICS_EQUALS_TOTAL_TICS_DELTA');
    }
  }

  // Invariant: totalTics never decreases as clock advances
  {
    const instance = candidate.create(1000n, 0n);
    let prev = instance.totalTics;
    let monotonic = true;
    for (let i = 0; i < 50; i++) {
      instance.advanceTo(BigInt(i * 137));
      const cur = instance.totalTics;
      if (cur < prev) {
        monotonic = false;
        break;
      }
      prev = cur;
    }
    if (!monotonic) {
      failures.push('invariant:TIC_ACCUMULATOR_TOTAL_TICS_NEVER_DECREASES_AS_CLOCK_ADVANCES');
    }
  }

  // Invariant: new tics at one-second boundary is 35 (across F values)
  {
    let allMatch = true;
    for (const F of [1000n, 1_000_000n, 10_000_000n]) {
      const instance = candidate.create(F, 0n);
      const newTics = instance.advanceTo(F);
      if (newTics !== AUDITED_ONE_SECOND_TICS) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:TIC_ACCUMULATOR_NEW_TICS_AT_ONE_SECOND_BOUNDARY_IS_THIRTY_FIVE');
    }
  }

  // Invariant: integer-truncating division (not rounding)
  {
    const before = candidate.create(1000n, 0n);
    before.advanceTo(28n);
    const after = candidate.create(1000n, 0n);
    after.advanceTo(29n);
    if (before.totalTics !== 0 || after.totalTics !== 1) {
      failures.push('invariant:TIC_ACCUMULATOR_INTEGER_TRUNCATING_DIVISION_NOT_ROUNDING');
    }
  }

  // Invariant: reset zeroes totalTics
  {
    const instance = candidate.create(1000n, 0n);
    instance.advanceTo(5000n);
    instance.reset(5000n);
    const afterReset = instance.totalTics;
    const newTicsAtBaseline = instance.advanceTo(5000n);
    if (afterReset !== 0 || newTicsAtBaseline !== 0) {
      failures.push('invariant:TIC_ACCUMULATOR_RESET_ZEROES_TOTAL_TICS');
    }
  }

  // Invariant: two instances are independent
  {
    const a = candidate.create(1000n, 0n);
    const b = candidate.create(1000n, 0n);
    a.advanceTo(1000n);
    if (a.totalTics !== 35 || b.totalTics !== 0) {
      failures.push('invariant:TIC_ACCUMULATOR_TWO_INSTANCES_ARE_INDEPENDENT');
    }
  }

  // Invariant: nonzero baseline does not affect delta math
  {
    let allMatch = true;
    for (const baseline of [0n, 1_000_000n, 0xffff_ffffn, 0xffff_ffff_ffff_ffffn - 10_000n]) {
      const instance = candidate.create(1000n, baseline);
      instance.advanceTo(baseline + 1000n);
      if (instance.totalTics !== 35) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:TIC_ACCUMULATOR_NONZERO_BASELINE_DOES_NOT_AFFECT_DELTA_MATH');
    }
  }

  // Invariant: idempotent advance to same counter returns zero
  {
    const instance = candidate.create(1000n, 0n);
    instance.advanceTo(1000n);
    const second = instance.advanceTo(1000n);
    if (second !== 0) {
      failures.push('invariant:TIC_ACCUMULATOR_IDEMPOTENT_ADVANCE_TO_SAME_COUNTER_RETURNS_ZERO');
    }
  }

  // Invariant: supports millisecond resolution
  {
    const instance = candidate.create(1000n, 0n);
    instance.advanceTo(1000n);
    const oneSec = instance.totalTics;
    instance.advanceTo(2000n);
    const twoSec = instance.totalTics;
    if (oneSec !== 35 || twoSec !== 70) {
      failures.push('invariant:TIC_ACCUMULATOR_SUPPORTS_MILLISECOND_CLOCK_RESOLUTION');
    }
  }

  // Invariant: supports microsecond resolution
  {
    const instance = candidate.create(1_000_000n, 0n);
    instance.advanceTo(1_000_000n);
    const oneSec = instance.totalTics;
    instance.advanceTo(2_000_000n);
    const twoSec = instance.totalTics;
    if (oneSec !== 35 || twoSec !== 70) {
      failures.push('invariant:TIC_ACCUMULATOR_SUPPORTS_MICROSECOND_CLOCK_RESOLUTION');
    }
  }

  // Invariant: supports high-resolution QPC clock
  {
    const instance = candidate.create(10_000_000n, 0n);
    instance.advanceTo(10_000_000n);
    if (instance.totalTics !== 35) {
      failures.push('invariant:TIC_ACCUMULATOR_SUPPORTS_HIGH_RESOLUTION_QPC_CLOCK');
    }
  }

  // Invariant: no premature wrap at one hour
  {
    const instance = candidate.create(1000n, 0n);
    instance.advanceTo(3_600_000n);
    if (instance.totalTics !== AUDITED_ONE_HOUR_TICS) {
      failures.push('invariant:TIC_ACCUMULATOR_NO_PREMATURE_WRAP_AT_ONE_HOUR');
    }
  }

  return failures;
}
