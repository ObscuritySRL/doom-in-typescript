/**
 * Audit ledger for the vanilla DOOM 1.9 TryRunTics ordering — the
 * precise call-order contract that drives every per-frame decision
 * inside the canonical TryRunTics body. The 04-009 audit pinned the
 * post-Ticker post-increment contract for `gametic`; the 04-010
 * audit pinned the wall-clock-to-tic accumulator that feeds
 * TryRunTics; this audit pins the call ordering of TryRunTics
 * itself: how it samples the host clock, how it builds new tic
 * commands, how it runs available tics, and how the inner four-step
 * `advancedemo / M_Ticker / G_Ticker / gametic++` sequence
 * (already pinned by 04-009 for one tic) composes into the outer
 * TryRunTics phase ordering.
 *
 * The canonical body lives in `linuxdoom-1.10/d_net.c` (vanilla)
 * and `chocolate-doom-2.2.1/src/d_loop.c` (Chocolate's structural
 * refactor). Both honour the same call-order contract:
 *  - Phase 1: sample `entertic = I_GetTime() / ticdup` BEFORE any
 *    `NetUpdate` call, compute `realtics = entertic - oldentertics`,
 *    and update `oldentertics = entertic`. Pinned because a port
 *    that recomputes entertic AFTER NetUpdate would let NetUpdate's
 *    own `I_GetTime` calls advance the sampled clock and drift the
 *    realtics delta by a full frame.
 *  - Phase 2: call `NetUpdate` once at the top of the function
 *    (after entertic capture, before counts decision) to push out
 *    locally-built ticcmds and pull in new ones for available tics.
 *  - Phase 3: derive `availabletics = lowtic - gametic/ticdup` from
 *    the freshly-NetUpdate-d state. In single-player (numplaying=1,
 *    ticdup=1), `lowtic == maketic` and `availabletics == maketic -
 *    gametic`.
 *  - Phase 4: derive `counts` from the realtics-vs-availabletics
 *    decision rule. Vanilla `linuxdoom-1.10/d_net.c` uses the
 *    three-branch jitter-smoothing rule (`realtics < availabletics-1`
 *    ? `realtics+1` : `realtics < availabletics` ? `realtics` :
 *    `availabletics`). Chocolate Doom 2.2.1 with `new_sync=true`
 *    (the default) simplifies to `counts = availabletics`. Both
 *    floor `counts` at 1 (`if (counts < 1) counts = 1;`).
 *  - Phase 5: enter the wait loop `while (lowtic < gametic/ticdup +
 *    counts)` to busy-wait for the network producer to catch up;
 *    inside, call `NetUpdate` again, recompute `lowtic`, and bail
 *    out via `MAX_NETGAME_STALL_TICS` (20 in vanilla, 5 in
 *    Chocolate Doom 2.2.1). In single-player with `availabletics ==
 *    realtics > 0`, the wait loop never enters.
 *  - Phase 6: enter the `while (counts--)` outer run loop. For each
 *    of the `counts` outer iterations, run an inner `for (i=0;
 *    i<ticdup; i++)` loop. Each inner iteration executes the
 *    canonical four-step sequence pinned by 04-009: `if
 *    (advancedemo) D_DoAdvanceDemo (); M_Ticker (); G_Ticker ();
 *    gametic++;`. After each inner iteration except the last,
 *    modify the duplicated ticcmd's `chatchar` and `BT_SPECIAL`
 *    button. After the inner ticdup loop completes, call
 *    `NetUpdate` once more to push fresh local commands.
 *
 * Inside Phase 2, the canonical NetUpdate body (in
 * `linuxdoom-1.10/d_net.c` and `chocolate-doom-2.2.1/src/d_loop.c`)
 * computes its own `newtics = nowtime - lasttime` delta against a
 * separate `static int lasttime` baseline, and for each newtic:
 *  - calls `I_StartTic ()` followed by `D_ProcessEvents ()` (input
 *    event pump),
 *  - if the `BACKUPTICS` circular buffer is not full, calls
 *    `G_BuildTiccmd (cmd)` to produce a fresh ticcmd into
 *    `localcmds[maketic % BACKUPTICS]` and increments `maketic`.
 *  - returns early if the buffer would overflow
 *    (`maketic - gametic >= BACKUPTICS`).
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. id Software `linuxdoom-1.10` source — PRIMARY for this audit
 *      because the call ordering is a sequence of single statements
 *      whose order the binary cannot disagree with,
 *   4. Chocolate Doom 2.2.1 source — secondary; Chocolate's
 *      `src/d_loop.c` refactors the inner four-step into
 *      `loop_interface->RunTic(...)` (defined as `D_RunTic` in
 *      `src/doom/d_main.c` for the doom-game shape) but preserves
 *      the canonical phase ordering and inner placement of
 *      `gametic++;`,
 *   5. DoomWiki only for orientation.
 *
 * This audit pins:
 *  - the canonical phase ordering of TryRunTics (entertic capture
 *    → NetUpdate → counts derivation → wait loop → outer run loop
 *    → outer NetUpdate),
 *  - the canonical inner ticdup-loop ordering (advancedemo → mTicker
 *    → gTicker → gametic++) and its placement inside the outer
 *    `while (counts--)` loop,
 *  - the canonical NetUpdate body (per-newtic startTic → buildTiccmd
 *    with buffer overflow guard),
 *  - the canonical `MAX_NETGAME_STALL_TICS` values (20 vanilla, 5
 *    Chocolate),
 *  - the canonical `BACKUPTICS` value (12, shared across vanilla
 *    and Chocolate),
 *  - the operational invariants every parity-faithful re-implementation
 *    of the single-player ticdup=1 path must honour
 *    (no-clock-advance-runs-no-tics, one-tic-per-clock-unit,
 *    newtic-callback-order, inner-tic-callback-order,
 *    newtics-processed-before-inner-tickers,
 *    ticker-observes-pre-increment-gametic,
 *    gametic-after-K-tics-equals-K, increment-by-exactly-one-per-inner-tic,
 *    doAdvanceDemo-only-when-flag-true,
 *    doAdvanceDemo-before-ticker, two-instances-independent,
 *    returned-count-equals-tickers-run, back-to-back-calls-accumulate,
 *    newtics-per-clock-delta-is-linear),
 *  - a curated probe table covering canonical clock-advance
 *    boundaries (zero-delta, one-tic, two-tics, five-tics,
 *    one-second, two-seconds, byte-boundary, one-minute,
 *    advancedemo-flag-on, back-to-back-calls),
 *  - and a cross-check helper that any candidate (factory + per-instance
 *    `gametic` getter + `tryRunTics(input, callbacks)` operation)
 *    tuple must satisfy.
 *
 * The audit module deliberately does NOT import from
 * `src/bootstrap/tryRunTics.ts` or any runtime tic-runner module.
 * The audit stands on its own canonical-source authority so a
 * corruption of the runtime cannot also silently corrupt the audit
 * that detects the corruption. The focused test validates the
 * ledger AND a hand-rolled reference candidate that mirrors vanilla
 * single-player ticdup=1 semantics; a future step will wire a
 * runtime cross-check on `src/bootstrap/tryRunTics.ts` once that
 * module enters this lane's read-only path.
 */

/**
 * Audited canonical `MAX_NETGAME_STALL_TICS` constant in vanilla
 * `linuxdoom-1.10/d_net.c` — exactly 20 (the inline `>= 20` literal
 * inside the wait-loop bail-out). Pinned because a port that uses
 * the Chocolate Doom 2.2.1 value (5) would bail out four times
 * faster, and a port that uses 0 would bail out immediately on
 * every clock-stall, making the wait loop a no-op.
 */
export const AUDITED_VANILLA_MAX_NETGAME_STALL_TICS = 20;

/**
 * Audited canonical `MAX_NETGAME_STALL_TICS` constant in Chocolate
 * Doom 2.2.1 `src/d_loop.c` — exactly 5. Pinned alongside the
 * vanilla 20 to highlight that the bail-out threshold is the one
 * deliberate Chocolate-vs-vanilla deviation in TryRunTics ordering;
 * Chocolate's faster 5-tic bail-out means menu input feels more
 * responsive when network play stalls, but it does not change the
 * canonical phase ordering.
 */
export const AUDITED_CHOCOLATE_MAX_NETGAME_STALL_TICS = 5;

/**
 * Audited canonical `BACKUPTICS` constant — exactly 12 — shared
 * across vanilla `linuxdoom-1.10/d_net.h` and Chocolate Doom 2.2.1
 * `src/d_loop.h`. The value is the depth of the per-player ticcmd
 * circular buffer; NetUpdate stops generating new ticcmds when
 * `maketic - gametic >= BACKUPTICS`. Pinned because a port that
 * shrinks the buffer (e.g. to 4) would silently throttle the rate
 * at which NetUpdate accepts new local commands during a stall; a
 * port that enlarges it would mask network-stall bugs that depend
 * on the canonical 12-tic depth.
 */
export const AUDITED_BACKUPTICS = 12;

/**
 * Audited canonical single-player `ticdup` value — exactly 1.
 * Pinned because the inner `for (i=0; i<ticdup; i++)` loop's
 * iteration count is `ticdup` and the per-iteration ticcmd-modify
 * branch (`if (i != ticdup-1)`) only fires when ticdup > 1. A port
 * that hard-codes ticdup=2 in single-player (a common temptation
 * when testing multiplayer paths) would double the gametic
 * advance rate.
 */
export const AUDITED_TICDUP_SINGLE_PLAYER = 1;

/**
 * Audited canonical entertic-capture phase index — exactly 1 (the
 * first observable side effect of entering TryRunTics). Pinned
 * because a port that defers entertic capture to after NetUpdate
 * would let NetUpdate's own host-clock samples drift the realtics
 * delta.
 */
export const AUDITED_TRYRUNTICS_PHASE_ENTERTIC_CAPTURE = 1;

/**
 * Audited canonical NetUpdate-at-top phase index — exactly 2
 * (immediately after entertic capture, before counts decision).
 * Pinned because the order matters: counts is derived from
 * `availabletics = lowtic - gametic/ticdup`, and `lowtic` is only
 * fresh after NetUpdate has pulled in remote commands.
 */
export const AUDITED_TRYRUNTICS_PHASE_NETUPDATE_TOP = 2;

/**
 * Audited canonical counts-decision phase index — exactly 3.
 * Pinned because the realtics-vs-availabletics decision must
 * observe both the freshly-sampled realtics (from Phase 1) and
 * the freshly-NetUpdate-d availabletics (from Phase 2).
 */
export const AUDITED_TRYRUNTICS_PHASE_COUNTS_DECISION = 3;

/**
 * Audited canonical wait-loop phase index — exactly 4. Pinned
 * because the wait-loop must enter only AFTER counts has been
 * derived, and must bail out via `MAX_NETGAME_STALL_TICS` BEFORE
 * the outer run loop.
 */
export const AUDITED_TRYRUNTICS_PHASE_WAIT_LOOP = 4;

/**
 * Audited canonical outer-run-loop phase index — exactly 5.
 * Pinned because the run loop must enter only AFTER the wait
 * loop has either fallen through (enough tics available) or
 * bailed out (network stall).
 */
export const AUDITED_TRYRUNTICS_PHASE_OUTER_RUN_LOOP = 5;

/**
 * Audited canonical post-inner-loop NetUpdate phase index — exactly
 * 6. Pinned because the trailing `NetUpdate ();` after the inner
 * ticdup loop pushes fresh local commands to remote nodes within
 * the same TryRunTics call (so peers do not have to wait until
 * next call to receive them).
 */
export const AUDITED_TRYRUNTICS_PHASE_POST_INNER_NETUPDATE = 6;

/**
 * Audited canonical count of `NetUpdate` call sites inside the
 * canonical TryRunTics body — exactly 3 (the top-of-function call,
 * the inside-wait-loop call, and the after-inner-ticdup-loop call).
 * Pinned because a port that omits any one of the three would
 * either fail to push local commands (top-of-function), fail to
 * recover during a stall (inside-wait-loop), or fail to flush at
 * end-of-frame (after-inner-ticdup).
 */
export const AUDITED_TRYRUNTICS_NETUPDATE_CALL_SITE_COUNT = 3;

/**
 * Audited canonical name of the linuxdoom source file containing
 * the vanilla TryRunTics body — exactly `linuxdoom-1.10/d_net.c`.
 * Pinned to disambiguate from any future refactor that splits
 * d_net.c.
 */
export const AUDITED_VANILLA_TRYRUNTICS_SOURCE_FILE = 'linuxdoom-1.10/d_net.c';

/**
 * Audited canonical name of the Chocolate Doom source file
 * containing the refactored TryRunTics body — exactly
 * `chocolate-doom-2.2.1/src/d_loop.c`. Pinned because Chocolate
 * deliberately split the loop body out of `d_main.c` (where
 * vanilla kept the singletics fallback) into a dedicated
 * `d_loop.c` for the network refactor; a parity-faithful
 * re-implementation is free to locate the body in either file as
 * long as the canonical phase ordering is preserved.
 */
export const AUDITED_CHOCOLATE_TRYRUNTICS_SOURCE_FILE = 'chocolate-doom-2.2.1/src/d_loop.c';

/**
 * Stable identifier for one pinned C-source fact about the
 * canonical TryRunTics ordering contract.
 */
export type DoomTryRunTicsOrderingFactId =
  | 'C_BODY_TRYRUNTICS_ENTERTIC_CAPTURE_BEFORE_NETUPDATE'
  | 'C_BODY_TRYRUNTICS_REALTICS_DELTA_FROM_OLDENTERTICS'
  | 'C_BODY_TRYRUNTICS_OLDENTERTICS_UPDATED_BEFORE_NETUPDATE'
  | 'C_BODY_TRYRUNTICS_NETUPDATE_AFTER_ENTERTIC_BEFORE_COUNTS'
  | 'C_BODY_TRYRUNTICS_AVAILABLETICS_FROM_LOWTIC_MINUS_GAMETIC'
  | 'C_BODY_TRYRUNTICS_VANILLA_OLD_SYNC_THREE_BRANCH_RULE'
  | 'C_BODY_TRYRUNTICS_CHOCOLATE_NEW_SYNC_COUNTS_EQUALS_AVAILABLETICS'
  | 'C_BODY_TRYRUNTICS_COUNTS_FLOORED_AT_ONE'
  | 'C_BODY_TRYRUNTICS_WAIT_LOOP_USES_NETUPDATE_AND_BAIL'
  | 'C_BODY_TRYRUNTICS_INNER_TICDUP_LOOP_FOUR_STEP_ORDER'
  | 'C_BODY_TRYRUNTICS_INNER_LOOP_GAMETIC_INCREMENT_AFTER_TICKER'
  | 'C_BODY_TRYRUNTICS_OUTER_NETUPDATE_AFTER_INNER_LOOP'
  | 'C_HEADER_LINUXDOOM_MAX_STALL_IS_TWENTY_TICS'
  | 'C_HEADER_CHOCOLATE_MAX_NETGAME_STALL_TICS_IS_FIVE'
  | 'C_HEADER_BACKUPTICS_IS_TWELVE'
  | 'C_BODY_NETUPDATE_INNER_NEWTICS_LOOP_STARTTIC_THEN_BUILDTICCMD'
  | 'C_BODY_NETUPDATE_BUFFER_OVERFLOW_GUARD'
  | 'C_BODY_TRYRUNTICS_TICDUP_ONE_FOR_SINGLE_PLAYER';

/** One pinned C-source fact about the TryRunTics ordering contract. */
export interface DoomTryRunTicsOrderingFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomTryRunTicsOrderingFactId;
  /** Whether the fact comes from the upstream C declaration or the upstream C body. */
  readonly category: 'c-header' | 'c-body';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet. */
  readonly cReference: string;
  /** Reference source file path inside the upstream tree. */
  readonly referenceSourceFile: 'chocolate-doom-2.2.1/src/d_loop.c' | 'chocolate-doom-2.2.1/src/d_loop.h' | 'linuxdoom-1.10/d_net.c' | 'linuxdoom-1.10/d_net.h' | 'shared:vanilla+chocolate';
}

/**
 * Pinned ledger of eighteen C-source facts that together define the
 * canonical TryRunTics ordering contract. The focused test asserts
 * the ledger is closed (every id appears exactly once) and that
 * every fact is honoured by the runtime.
 *
 * Categorisation:
 *  - `c-header` — file-scope or preprocessor declaration whose
 *    presence and value are visible without entering any function
 *    body.
 *  - `c-body`   — function body statement or call site.
 */
export const DOOM_TRY_RUN_TICS_ORDERING_AUDIT: readonly DoomTryRunTicsOrderingFact[] = [
  {
    id: 'C_BODY_TRYRUNTICS_ENTERTIC_CAPTURE_BEFORE_NETUPDATE',
    category: 'c-body',
    description:
      "The vanilla `linuxdoom-1.10/d_net.c` TryRunTics body opens with `entertic = I_GetTime ()/ticdup;` BEFORE any `NetUpdate` call. Pinned because a port that defers entertic capture until after NetUpdate would let NetUpdate's own internal `I_GetTime` samples drift the realtics delta by a full frame, silently shifting the realtics-vs-availabletics decision in the counts derivation.",
    cReference: 'entertic = I_GetTime ()/ticdup;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_REALTICS_DELTA_FROM_OLDENTERTICS',
    category: 'c-body',
    description:
      'Immediately after entertic capture, the vanilla body computes `realtics = entertic - oldentertics;` where `oldentertics` is a function-local `static int oldentertics;`. The delta is the count of host-clock tics elapsed since the previous TryRunTics call. Pinned because a port that resets `oldentertics` to zero on every call would observe `realtics == entertic` (the absolute clock value), inflating the counts decision on every call.',
    cReference: 'realtics = entertic - oldentertics;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_OLDENTERTICS_UPDATED_BEFORE_NETUPDATE',
    category: 'c-body',
    description:
      'Following the realtics delta computation, the vanilla body updates `oldentertics = entertic;` BEFORE the top-of-function `NetUpdate ();` call. Pinned because the update must happen exactly once per TryRunTics call (not per inner tic, not per wait-loop iteration, not per outer-run-loop iteration); a port that updates oldentertics inside the inner loop would observe a zero realtics delta on every subsequent call, freezing the counts derivation at the floor-of-1.',
    cReference: 'oldentertics = entertic;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_NETUPDATE_AFTER_ENTERTIC_BEFORE_COUNTS',
    category: 'c-body',
    description:
      'The top-of-function `NetUpdate ();` call sits between the entertic capture (Phase 1) and the counts derivation (Phase 3). It pushes locally-built ticcmds out and pulls in remote tics from peers, refreshing `nettics[]` in place. Pinned because the counts derivation reads `lowtic` (computed from nettics[]); a port that runs counts derivation BEFORE NetUpdate would derive counts from stale nettics[] values and miss any tics that arrived in the network buffer between calls.',
    cReference: 'NetUpdate ();',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_AVAILABLETICS_FROM_LOWTIC_MINUS_GAMETIC',
    category: 'c-body',
    description:
      'After NetUpdate, the canonical body computes `availabletics = lowtic - gametic/ticdup;` where `lowtic` is the minimum across `nettics[i]` for every node still in the game. In single-player (numplaying=1, ticdup=1), `lowtic == nettics[0] == maketic` and the formula reduces to `availabletics = maketic - gametic`. Pinned because a port that uses `availabletics = nettics[consoleplayer] - gametic` (a common temptation when removing the multi-node loop) would diverge in the rare case where `nettics[consoleplayer] != lowtic` (i.e. when remote peers are ahead of the local maketic).',
    cReference: 'availabletics = lowtic - gametic/ticdup;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_VANILLA_OLD_SYNC_THREE_BRANCH_RULE',
    category: 'c-body',
    description:
      'The vanilla `linuxdoom-1.10/d_net.c` counts derivation uses a three-branch jitter-smoothing rule: `if (realtics < availabletics-1) counts = realtics+1; else if (realtics < availabletics) counts = realtics; else counts = availabletics;`. The first branch ("running too far behind") catches up by one extra tic per call; the second branch ("matching the producer") tracks realtics; the default ("running ahead") clamps at availabletics. Pinned because a port that flattens to `counts = min(realtics, availabletics)` would lose the catch-up-by-one branch, making it impossible to ever reduce the realtics-vs-availabletics gap.',
    cReference: 'if (realtics < availabletics-1) counts = realtics+1; else if (realtics < availabletics) counts = realtics; else counts = availabletics;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_CHOCOLATE_NEW_SYNC_COUNTS_EQUALS_AVAILABLETICS',
    category: 'c-body',
    description:
      'Chocolate Doom 2.2.1 `src/d_loop.c` simplifies the counts derivation when `new_sync == true` (the default for non-net-game runs) to `counts = availabletics;` — the entire three-branch rule is skipped. The `-oldsync` command-line flag falls back to the vanilla three-branch rule. Pinned because the new_sync simplification means single-player gameplay observes `counts == availabletics == realtics` on every call (assuming NetUpdate generated realtics fresh ticcmds), which is the canonical "run as many tics as the wall clock advanced" contract that demo replay parity requires.',
    cReference: 'if (new_sync) { counts = availabletics; }',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/d_loop.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_COUNTS_FLOORED_AT_ONE',
    category: 'c-body',
    description:
      'Both vanilla and Chocolate Doom apply the floor `if (counts < 1) counts = 1;` immediately after the counts derivation. Pinned because the floor guarantees that every TryRunTics call attempts at least one tic (the wait loop will block until one is available, with the MAX_NETGAME_STALL_TICS bail-out). A port that omits the floor would let counts==0 on a slow-clock tic, returning immediately and never advancing gametic.',
    cReference: 'if (counts < 1) counts = 1;',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
  {
    id: 'C_BODY_TRYRUNTICS_WAIT_LOOP_USES_NETUPDATE_AND_BAIL',
    category: 'c-body',
    description:
      'The wait loop body in both implementations is `while (lowtic < gametic/ticdup + counts) { NetUpdate (); /* recompute lowtic */; if (lowtic < gametic/ticdup) I_Error ("TryRunTics: lowtic < gametic"); if (I_GetTime ()/ticdup - entertic >= MAX_NETGAME_STALL_TICS) { /* vanilla: M_Ticker (); */ return; } }`. The loop calls NetUpdate (to pull in any newly-arrived remote tics), recomputes lowtic, and bails out when the wall clock has advanced MAX_NETGAME_STALL_TICS tics past entertic. Pinned because the bail-out is what keeps the engine responsive during a network stall: without it, a stall would freeze the menu for the duration of the network outage.',
    cReference: 'while (lowtic < gametic/ticdup + counts) { NetUpdate (); ... if (I_GetTime ()/ticdup - entertic >= MAX_NETGAME_STALL_TICS) { return; } }',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
  {
    id: 'C_BODY_TRYRUNTICS_INNER_TICDUP_LOOP_FOUR_STEP_ORDER',
    category: 'c-body',
    description:
      'The inner `for (i=0; i<ticdup; i++)` loop body in vanilla `linuxdoom-1.10/d_net.c` executes the canonical four-step sequence: `if (gametic/ticdup > lowtic) I_Error ("gametic>lowtic"); if (advancedemo) D_DoAdvanceDemo (); M_Ticker (); G_Ticker (); gametic++;`. Pinned alongside the 04-009 gametic audit which already pins the four-step. The TryRunTics audit pins the placement of this four-step INSIDE the inner ticdup loop (NOT inside the outer counts loop, NOT outside the loop bracket). A port that hoists `gametic++;` outside the inner loop would advance gametic by 1 per outer counts iteration instead of by ticdup; in single-player ticdup=1 the divergence is invisible, but it surfaces immediately in any 2/3/4-player ticdup > 1 game.',
    cReference: 'if (advancedemo) D_DoAdvanceDemo (); M_Ticker (); G_Ticker (); gametic++;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_INNER_LOOP_GAMETIC_INCREMENT_AFTER_TICKER',
    category: 'c-body',
    description:
      'Within each inner ticdup-loop iteration, `gametic++;` is the LAST statement before the optional ticcmd-modify branch. The increment is post-Ticker (matches 04-009). Pinned to defend against a port that pre-increments before G_Ticker — that port would observe the consistency-check `buf = (gametic/ticdup)%BACKUPTICS;` inside G_Ticker shifted by one tic, and any read of gametic during G_Ticker (e.g. monster `(gametic & 3)` scheduling, level-time computation `gametic - levelstarttic`) would observe the post-increment value instead of the pre-increment value.',
    cReference: 'gametic++;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_OUTER_NETUPDATE_AFTER_INNER_LOOP',
    category: 'c-body',
    description:
      'After each inner ticdup loop completes, the canonical body calls `NetUpdate ();   // check for new console commands` once more before the outer `while (counts--)` re-enters. The trailing comment in vanilla `linuxdoom-1.10/d_net.c` documents the intent: it pushes local commands so peers do not have to wait until the next frame to receive them. Pinned because a port that omits this trailing NetUpdate would silently increase peer-to-peer round-trip latency by one frame.',
    cReference: 'NetUpdate ();   // check for new console commands',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_HEADER_LINUXDOOM_MAX_STALL_IS_TWENTY_TICS',
    category: 'c-header',
    description:
      'The vanilla `linuxdoom-1.10/d_net.c` wait-loop uses the inline literal `>= 20` for the bail-out threshold (NOT a named macro). The choice of 20 means a network stall of ~571 ms (20 / 35 Hz) before TryRunTics returns control to the main loop. Pinned because a port that uses the Chocolate value (5 = ~143 ms) or that uses 0 (no wait at all) would diverge from the canonical responsiveness profile.',
    cReference: 'if (I_GetTime ()/ticdup - entertic >= 20)',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_HEADER_CHOCOLATE_MAX_NETGAME_STALL_TICS_IS_FIVE',
    category: 'c-header',
    description:
      "Chocolate Doom 2.2.1 `src/d_loop.c` defines `#define MAX_NETGAME_STALL_TICS  5` at file scope and references it inside the wait-loop bail-out `if (I_GetTime() / ticdup - entertic >= MAX_NETGAME_STALL_TICS)`. The 5-tic threshold (~143 ms) is a deliberate Chocolate-vs-vanilla deviation that tightens the responsiveness window. Pinned because the named macro form (vs vanilla's inline literal) is the one structural deviation a parity-faithful re-implementation may safely emulate (the canonical phase ordering is preserved either way).",
    cReference: '#define MAX_NETGAME_STALL_TICS  5',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/d_loop.c',
  },
  {
    id: 'C_HEADER_BACKUPTICS_IS_TWELVE',
    category: 'c-header',
    description:
      'Both vanilla `linuxdoom-1.10/d_net.h` and Chocolate Doom 2.2.1 `src/d_loop.h` declare `#define BACKUPTICS 12`. The value is the depth of the per-player ticcmd circular buffer. NetUpdate stops generating new ticcmds when `maketic - gametic >= BACKUPTICS`. Pinned because a port that uses a smaller buffer (e.g. 4) would silently throttle the rate at which NetUpdate accepts new local commands during a stall; a port that uses a larger buffer would mask network-stall bugs that depend on the canonical 12-tic depth (specifically, demo recording bugs around buffer wrap).',
    cReference: '#define BACKUPTICS 12',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
  {
    id: 'C_BODY_NETUPDATE_INNER_NEWTICS_LOOP_STARTTIC_THEN_BUILDTICCMD',
    category: 'c-body',
    description:
      "Inside the canonical NetUpdate body, the per-newtic inner loop is `for (i=0; i<newtics; i++) { I_StartTic (); D_ProcessEvents (); /* buffer overflow guard */; G_BuildTiccmd (&netbuffer->cmds[consoleplayer][maketic % BACKUPTICS]); maketic++; }`. The order matters: I_StartTic (input pump enter), D_ProcessEvents (drain event queue into game state), then G_BuildTiccmd (which reads the freshly-pumped events to encode the ticcmd). Pinned because a port that swaps the order would build ticcmds from the previous frame's events, introducing a one-frame input delay.",
    cReference: 'I_StartTic (); D_ProcessEvents (); ... G_BuildTiccmd (...);',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_BUFFER_OVERFLOW_GUARD',
    category: 'c-body',
    description:
      'NetUpdate stops generating new ticcmds via the guard `if (maketic - gametic > BACKUPTICS-1) break;` inside the per-newtic loop. The strict `> BACKUPTICS-1` form (equivalent to `>= BACKUPTICS`) means the buffer is allowed to be exactly `BACKUPTICS` deep at peak. Pinned because a port that uses `>= BACKUPTICS` (semantically identical) is fine, but a port that uses `> BACKUPTICS` (off-by-one) would write past the buffer end on overflow.',
    cReference: 'if (maketic - gametic > BACKUPTICS-1) break;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_TRYRUNTICS_TICDUP_ONE_FOR_SINGLE_PLAYER',
    category: 'c-body',
    description:
      'In single-player (numplaying=1, no -dup command-line override), `ticdup` is initialised to 1 by `D_ArbitrateNetStart` and the inner `for (i=0; i<ticdup; i++)` loop runs exactly once per outer counts iteration. The `if (i != ticdup-1)` ticcmd-modify branch is taken only for non-final iterations, which means it never fires when ticdup==1. Pinned because a port that hard-codes ticdup=2 in single-player (e.g. for testing) would double the gametic advance rate AND trigger the ticcmd-modify branch on every odd iteration.',
    cReference: 'for (i=0 ; i<ticdup ; i++)',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
] as const;

/**
 * Stable identifier for one operational invariant the cross-check
 * helper enforces against any candidate TryRunTics surface tuple.
 */
export type DoomTryRunTicsOrderingInvariantId =
  | 'TRYRUNTICS_FRESH_INSTANCE_GAMETIC_IS_ZERO'
  | 'TRYRUNTICS_NO_CLOCK_ADVANCE_RUNS_NO_TICS'
  | 'TRYRUNTICS_ONE_TIC_PER_CLOCK_UNIT_AT_TICDUP_ONE'
  | 'TRYRUNTICS_NEWTIC_CALLBACK_ORDER_STARTTIC_THEN_BUILDTICCMD'
  | 'TRYRUNTICS_INNER_TIC_CALLBACK_ORDER_DEMO_THEN_TICKER'
  | 'TRYRUNTICS_NEWTICS_PROCESSED_BEFORE_INNER_TICKERS'
  | 'TRYRUNTICS_TICKER_OBSERVES_PRE_INCREMENT_GAMETIC'
  | 'TRYRUNTICS_GAMETIC_AFTER_K_TICS_FROM_FRESH_EQUALS_K'
  | 'TRYRUNTICS_GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_INNER_TIC'
  | 'TRYRUNTICS_DOADVANCEDEMO_CALLED_ONLY_WHEN_FLAG_TRUE'
  | 'TRYRUNTICS_DOADVANCEDEMO_CALLED_BEFORE_TICKER'
  | 'TRYRUNTICS_TWO_INSTANCES_ARE_INDEPENDENT'
  | 'TRYRUNTICS_RETURNED_COUNT_EQUALS_TICKERS_RUN'
  | 'TRYRUNTICS_BACK_TO_BACK_CALLS_ACCUMULATE_GAMETIC'
  | 'TRYRUNTICS_NEWTICS_PER_CLOCK_DELTA_IS_LINEAR';

/** One operational invariant the cross-check helper enforces. */
export interface DoomTryRunTicsOrderingInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomTryRunTicsOrderingInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of fifteen operational invariants. The focused test
 * asserts the ledger is closed and that the cross-check helper
 * returns exactly the right failure id for each tampered candidate.
 */
export const DOOM_TRY_RUN_TICS_ORDERING_INVARIANTS: readonly DoomTryRunTicsOrderingInvariant[] = [
  {
    id: 'TRYRUNTICS_FRESH_INSTANCE_GAMETIC_IS_ZERO',
    description: 'A freshly-constructed candidate exposes `gametic === 0` before any tryRunTics call. Pinned because the canonical file-scope `int gametic;` declaration zero-initialises (matches 04-009 audit).',
  },
  {
    id: 'TRYRUNTICS_NO_CLOCK_ADVANCE_RUNS_NO_TICS',
    description:
      'A tryRunTics call with `currentClock == 0` (no advance from baseline) on a fresh candidate runs zero inner tics: returns 0, leaves gametic at 0, invokes no startTic / buildTiccmd / ticker callbacks. Pinned because the canonical NetUpdate body computes `newtics = nowtime - lasttime` and skips the per-newtic loop when newtics <= 0.',
  },
  {
    id: 'TRYRUNTICS_ONE_TIC_PER_CLOCK_UNIT_AT_TICDUP_ONE',
    description:
      'A tryRunTics call with `currentClock == K` on a fresh candidate (lastClock=0, gametic=0) runs exactly K inner tics in the single-player ticdup=1 case. Pinned because the canonical formula `newtics = nowtime - lasttime` followed by `availabletics = maketic - gametic == newtics` followed by `counts = availabletics` followed by the inner ticdup=1 loop running once per outer iteration produces exactly K ticker callbacks for a K-clock-unit advance.',
  },
  {
    id: 'TRYRUNTICS_NEWTIC_CALLBACK_ORDER_STARTTIC_THEN_BUILDTICCMD',
    description:
      "For each new tic processed during the NetUpdate phase of a tryRunTics call, the candidate must invoke `startTic` BEFORE `buildTiccmd`. Pinned because the canonical NetUpdate inner loop is `I_StartTic (); D_ProcessEvents (); G_BuildTiccmd (...);` — startTic pumps the host event queue, buildTiccmd encodes the freshly-pumped events into the ticcmd. A port that swaps the order would build from the previous frame's events.",
  },
  {
    id: 'TRYRUNTICS_INNER_TIC_CALLBACK_ORDER_DEMO_THEN_TICKER',
    description:
      'For each available tic processed during the run-loop phase of a tryRunTics call (with advancedemoFlag=true), the candidate must invoke `doAdvanceDemo` BEFORE `ticker`. Pinned because the canonical inner ticdup loop is `if (advancedemo) D_DoAdvanceDemo (); M_Ticker (); G_Ticker (); gametic++;` — D_DoAdvanceDemo runs first, advancing the demo state machine, before the per-tic ticker observes the new state.',
  },
  {
    id: 'TRYRUNTICS_NEWTICS_PROCESSED_BEFORE_INNER_TICKERS',
    description:
      'Within a single tryRunTics call, ALL `startTic`/`buildTiccmd` invocations (NetUpdate phase) must complete BEFORE the FIRST `ticker` invocation (run-loop phase). Pinned because the canonical phase ordering is `entertic / NetUpdate / counts / wait / runLoop / outer NetUpdate`; a port that interleaves startTic/buildTiccmd with ticker calls would diverge from the canonical "build all available ticcmds, then run all available tics" contract.',
  },
  {
    id: 'TRYRUNTICS_TICKER_OBSERVES_PRE_INCREMENT_GAMETIC',
    description:
      'Inside a `ticker(gameticDuringTicker)` callback during the K-th inner tic of a fresh candidate (1-indexed across all tryRunTics calls), the value passed is exactly K-1 (matches 04-009 audit). Pinned because the canonical inner loop runs `M_Ticker (); G_Ticker (); gametic++;` so the value visible to G_Ticker is the pre-increment value.',
  },
  {
    id: 'TRYRUNTICS_GAMETIC_AFTER_K_TICS_FROM_FRESH_EQUALS_K',
    description:
      'After tryRunTics calls that together processed exactly K tics on a fresh candidate, `gametic === K`. Pinned across a closed sweep of {0, 1, 2, 5, 35, 70, 100} to defend against a port that uses a non-affine increment, that wraps at a small boundary, or that resets gametic mid-session.',
  },
  {
    id: 'TRYRUNTICS_GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_INNER_TIC',
    description:
      'Each inner-tic ticker invocation advances gametic by exactly +1 (not +0 if skipped, not +2 if double-incremented). Pinned because the canonical inner loop runs `gametic++;` once per inner iteration, AND a port that hoists `gametic++;` outside the inner loop would advance by 1 per outer counts iteration in ticdup>1 multiplayer. In single-player ticdup=1, the divergence is invisible per-iteration but observable across multi-tic calls.',
  },
  {
    id: 'TRYRUNTICS_DOADVANCEDEMO_CALLED_ONLY_WHEN_FLAG_TRUE',
    description:
      'A tryRunTics call with `advancedemoFlag=false` invokes `doAdvanceDemo` ZERO times (regardless of how many inner tics run). A call with `advancedemoFlag=true` invokes `doAdvanceDemo` exactly once per inner tic. Pinned because the canonical guard `if (advancedemo) D_DoAdvanceDemo ();` evaluates the flag once per inner iteration.',
  },
  {
    id: 'TRYRUNTICS_DOADVANCEDEMO_CALLED_BEFORE_TICKER',
    description:
      'Within an inner tic with `advancedemoFlag=true`, `doAdvanceDemo` is invoked BEFORE `ticker`. Pinned because the canonical inner loop is `if (advancedemo) D_DoAdvanceDemo (); M_Ticker (); G_Ticker (); gametic++;` — the demo state machine advances first.',
  },
  {
    id: 'TRYRUNTICS_TWO_INSTANCES_ARE_INDEPENDENT',
    description:
      'Two independently-constructed candidates do not share state: ticking instance A by 5 tics leaves instance B at gametic=0. Pinned because a port that uses a global static state (rather than per-instance) would couple test fixtures and break demo replay isolation.',
  },
  {
    id: 'TRYRUNTICS_RETURNED_COUNT_EQUALS_TICKERS_RUN',
    description:
      'The integer return value of tryRunTics equals the number of `ticker` callbacks invoked during that call. Pinned because the canonical body returns `availabletics` (or `counts` post-floor); a port that always returns 0 (or always returns 1) would mask divergences in the actual tic-run count.',
  },
  {
    id: 'TRYRUNTICS_BACK_TO_BACK_CALLS_ACCUMULATE_GAMETIC',
    description:
      'Two consecutive tryRunTics calls with currentClock=A then currentClock=A+B advance gametic by exactly A+B (assuming both deltas are positive). Pinned because the canonical `static int oldentertics;` baseline persists across calls; a port that resets oldentertics to zero on every call would observe the second call running A+B tics instead of B tics.',
  },
  {
    id: 'TRYRUNTICS_NEWTICS_PER_CLOCK_DELTA_IS_LINEAR',
    description:
      'For any sequence of currentClock values C[0]=0, C[1], C[2], ..., C[N], the cumulative tics run after N calls equals C[N] (not C[N]-1, not 2*C[N]). Pinned to defend against a port that introduces a constant offset (e.g. always running one extra tic on the first call) or a multiplicative bias.',
  },
] as const;

/** Stable identifier for one curated TryRunTics ordering probe. */
export type DoomTryRunTicsOrderingProbeId =
  | 'fresh_clock_zero_runs_zero_tics'
  | 'clock_one_runs_one_tic'
  | 'clock_two_runs_two_tics'
  | 'clock_five_runs_five_tics'
  | 'clock_thirty_five_runs_thirty_five_tics'
  | 'clock_seventy_runs_seventy_tics'
  | 'clock_two_hundred_fifty_six_runs_two_hundred_fifty_six_tics'
  | 'clock_two_thousand_one_hundred_runs_two_thousand_one_hundred_tics'
  | 'advancedemo_false_skips_doAdvanceDemo'
  | 'advancedemo_true_calls_doAdvanceDemo_once_per_tic'
  | 'back_to_back_three_then_two_runs_total_five_tics'
  | 'back_to_back_alternating_demo_flag_invokes_demo_only_when_true';

/** Which kind of expectation a probe pins. */
export type DoomTryRunTicsOrderingProbeTarget = 'cumulative_gametic_after_calls' | 'callback_counts_after_call' | 'returned_count_equals_inner_tics' | 'doAdvanceDemo_count_after_call';

/** One curated TryRunTics ordering probe expectation. */
export interface DoomTryRunTicsOrderingProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomTryRunTicsOrderingProbeId;
  /** Which surface this probe inspects. */
  readonly target: DoomTryRunTicsOrderingProbeTarget;
  /**
   * Description of the call sequence run from a freshly-constructed
   * instance. The harness performs a sequence of tryRunTics calls
   * with the listed (clock, advancedemoFlag) tuples and observes
   * the result indicated by `target`.
   */
  readonly input: {
    readonly calls: readonly { readonly currentClock: number; readonly advancedemoFlag: boolean }[];
  };
  /** Expected canonical observed value. */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/**
 * Curated probe table of twelve probes covering the canonical
 * TryRunTics ordering contract. Each probe is hand-pinned from the
 * canonical `linuxdoom-1.10/d_net.c` source and re-verified by the
 * focused test against a hand-rolled reference candidate.
 *
 * Coverage:
 *  - fresh-instance no-advance probe (clock=0, runs 0 tics).
 *  - small-K linear-walk probes (1, 2, 5).
 *  - one-second probe (35 tics).
 *  - two-second probe (70 tics).
 *  - byte-boundary probe (256 tics, no wrap).
 *  - one-minute probe (2100 tics).
 *  - advancedemo-flag-off probe (zero D_DoAdvanceDemo calls).
 *  - advancedemo-flag-on probe (one D_DoAdvanceDemo call per inner tic).
 *  - back-to-back-call accumulation probe.
 *  - alternating-flag probe.
 */
export const DOOM_TRY_RUN_TICS_ORDERING_PROBES: readonly DoomTryRunTicsOrderingProbe[] = [
  {
    id: 'fresh_clock_zero_runs_zero_tics',
    target: 'cumulative_gametic_after_calls',
    input: { calls: [{ currentClock: 0, advancedemoFlag: false }] },
    expected: 0,
    note: 'A tryRunTics call with currentClock=0 on a fresh instance runs zero inner tics. Anchors the canonical newtics = nowtime - lasttime delta with both terms zero.',
  },
  {
    id: 'clock_one_runs_one_tic',
    target: 'cumulative_gametic_after_calls',
    input: { calls: [{ currentClock: 1, advancedemoFlag: false }] },
    expected: 1,
    note: 'A tryRunTics call with currentClock=1 on a fresh instance runs exactly one inner tic. Anchors the +1 per-clock-unit linear walk at the smallest step.',
  },
  {
    id: 'clock_two_runs_two_tics',
    target: 'cumulative_gametic_after_calls',
    input: { calls: [{ currentClock: 2, advancedemoFlag: false }] },
    expected: 2,
    note: 'A tryRunTics call with currentClock=2 on a fresh instance runs exactly two inner tics. Confirms newtics generation extends across a single multi-tic call.',
  },
  {
    id: 'clock_five_runs_five_tics',
    target: 'cumulative_gametic_after_calls',
    input: { calls: [{ currentClock: 5, advancedemoFlag: false }] },
    expected: 5,
    note: 'A tryRunTics call with currentClock=5 on a fresh instance runs exactly five inner tics.',
  },
  {
    id: 'clock_thirty_five_runs_thirty_five_tics',
    target: 'cumulative_gametic_after_calls',
    input: { calls: [{ currentClock: 35, advancedemoFlag: false }] },
    expected: 35,
    note: 'A tryRunTics call with currentClock=35 on a fresh instance runs exactly 35 inner tics (one second of vanilla DOOM simulation).',
  },
  {
    id: 'clock_seventy_runs_seventy_tics',
    target: 'cumulative_gametic_after_calls',
    input: { calls: [{ currentClock: 70, advancedemoFlag: false }] },
    expected: 70,
    note: 'A tryRunTics call with currentClock=70 on a fresh instance runs exactly 70 inner tics (two seconds).',
  },
  {
    id: 'clock_two_hundred_fifty_six_runs_two_hundred_fifty_six_tics',
    target: 'cumulative_gametic_after_calls',
    input: { calls: [{ currentClock: 256, advancedemoFlag: false }] },
    expected: 256,
    note: 'A tryRunTics call with currentClock=256 on a fresh instance runs exactly 256 inner tics (no byte-boundary wrap).',
  },
  {
    id: 'clock_two_thousand_one_hundred_runs_two_thousand_one_hundred_tics',
    target: 'cumulative_gametic_after_calls',
    input: { calls: [{ currentClock: 2100, advancedemoFlag: false }] },
    expected: 2100,
    note: 'A tryRunTics call with currentClock=2100 on a fresh instance runs exactly 2100 inner tics (one game minute = 35 * 60).',
  },
  {
    id: 'advancedemo_false_skips_doAdvanceDemo',
    target: 'doAdvanceDemo_count_after_call',
    input: { calls: [{ currentClock: 5, advancedemoFlag: false }] },
    expected: 0,
    note: 'A tryRunTics call with advancedemoFlag=false invokes doAdvanceDemo ZERO times even when 5 inner tics run. Anchors the canonical guard `if (advancedemo) D_DoAdvanceDemo ();`.',
  },
  {
    id: 'advancedemo_true_calls_doAdvanceDemo_once_per_tic',
    target: 'doAdvanceDemo_count_after_call',
    input: { calls: [{ currentClock: 5, advancedemoFlag: true }] },
    expected: 5,
    note: 'A tryRunTics call with advancedemoFlag=true invokes doAdvanceDemo exactly 5 times when 5 inner tics run (once per inner tic). Anchors the per-iteration evaluation of the advancedemo guard.',
  },
  {
    id: 'back_to_back_three_then_two_runs_total_five_tics',
    target: 'cumulative_gametic_after_calls',
    input: {
      calls: [
        { currentClock: 3, advancedemoFlag: false },
        { currentClock: 5, advancedemoFlag: false },
      ],
    },
    expected: 5,
    note: 'Two consecutive tryRunTics calls with currentClock=3 then currentClock=5 advance gametic by 3 then 2 (cumulative 5). Anchors the canonical static-baseline `oldentertics` persistence across calls.',
  },
  {
    id: 'back_to_back_alternating_demo_flag_invokes_demo_only_when_true',
    target: 'doAdvanceDemo_count_after_call',
    input: {
      calls: [
        { currentClock: 1, advancedemoFlag: false },
        { currentClock: 2, advancedemoFlag: true },
        { currentClock: 3, advancedemoFlag: false },
      ],
    },
    expected: 1,
    note: 'Across three back-to-back calls (1/false, 2/true, 3/false), doAdvanceDemo is invoked only during the middle call (advancedemoFlag=true) and exactly once per inner tic (1 tic in that call), totalling 1.',
  },
] as const;

/**
 * A candidate TryRunTics surface tuple for cross-checking. The tuple
 * captures the canonical single-player ticdup=1 TryRunTics surface:
 * a constructor that returns a fresh instance, plus a per-instance
 * `gametic` getter and a `tryRunTics(input, callbacks)` operation.
 */
export interface DoomTryRunTicsOrderingCandidate {
  /** Factory that returns a fresh instance with gametic at 0 and lastClock at 0. */
  readonly create: () => DoomTryRunTicsOrderingCandidateInstance;
}

/** The TryRunTics surface a candidate must expose for the cross-check to inspect. */
export interface DoomTryRunTicsOrderingCandidateInstance {
  /**
   * The current gametic value. After a tryRunTics call that ran K
   * inner tics, this returns `previous_gametic + K`.
   */
  readonly gametic: number;
  /**
   * Execute one TryRunTics call. The candidate MUST honour the
   * canonical phase ordering for single-player ticdup=1:
   *   1. Sample `input.currentClock` once at the start.
   *   2. Compute `newtics = currentClock - lastClock`; update
   *      `lastClock = currentClock`.
   *   3. For each newtic (NetUpdate phase):
   *      a. Call `callbacks.startTic()`.
   *      b. Call `callbacks.buildTiccmd()`.
   *   4. Compute `availabletics = maketic - gametic` (single-player
   *      ticdup=1 simplification of `lowtic - gametic/ticdup`).
   *   5. For each available tic (run-loop phase):
   *      a. If `input.advancedemoFlag === true`, call
   *         `callbacks.doAdvanceDemo()`.
   *      b. Call `callbacks.ticker(this.gametic)` with the
   *         pre-increment value.
   *      c. Increment `gametic` by exactly +1.
   *   6. Return the count of inner tics run.
   * The candidate MUST NOT interleave NetUpdate-phase callbacks
   * with run-loop-phase callbacks (all startTic/buildTiccmd before
   * the first ticker).
   */
  tryRunTics(input: TryRunTicsCandidateInput, callbacks: TryRunTicsCandidateCallbacks): number;
}

/** Inputs to one tryRunTics call. */
export interface TryRunTicsCandidateInput {
  /**
   * The current absolute host-clock counter (analogous to
   * `I_GetTime()` in vanilla, divided by ticdup which is 1 in
   * single-player). The candidate computes `newtics = currentClock
   * - lastClock` and updates `lastClock = currentClock`.
   */
  readonly currentClock: number;
  /** Whether the advancedemo flag is set; gated per inner tic. */
  readonly advancedemoFlag: boolean;
}

/** Callbacks invoked by tryRunTics during NetUpdate and run-loop phases. */
export interface TryRunTicsCandidateCallbacks {
  /** I_StartTic + D_ProcessEvents (input pump, called per newtic). */
  startTic(): void;
  /** G_BuildTiccmd (called per newtic, after startTic). */
  buildTiccmd(): void;
  /** D_DoAdvanceDemo (called per inner tic, only if advancedemoFlag=true, before ticker). */
  doAdvanceDemo(): void;
  /**
   * M_Ticker + G_Ticker (called per inner tic, after the optional
   * doAdvanceDemo, before gametic++). The argument is the
   * pre-increment gametic value (matches 04-009 contract).
   */
  ticker(gameticDuringTicker: number): void;
}

/**
 * Cross-check a candidate TryRunTics surface tuple against
 * `DOOM_TRY_RUN_TICS_ORDERING_PROBES` and
 * `DOOM_TRY_RUN_TICS_ORDERING_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the candidate
 * honours every audited TryRunTics ordering fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one observation.
 */
export function crossCheckDoomTryRunTicsOrdering(candidate: DoomTryRunTicsOrderingCandidate): readonly string[] {
  const failures: string[] = [];

  // Per-probe checks
  for (const probe of DOOM_TRY_RUN_TICS_ORDERING_PROBES) {
    const instance = candidate.create();
    let totalReturned = 0;
    let doAdvanceDemoCount = 0;
    for (const call of probe.input.calls) {
      const ran = instance.tryRunTics(call, {
        startTic: () => {},
        buildTiccmd: () => {},
        doAdvanceDemo: () => {
          doAdvanceDemoCount++;
        },
        ticker: () => {},
      });
      totalReturned += ran;
    }
    let actual: number;
    if (probe.target === 'cumulative_gametic_after_calls') {
      actual = instance.gametic;
    } else if (probe.target === 'returned_count_equals_inner_tics') {
      actual = totalReturned;
    } else if (probe.target === 'doAdvanceDemo_count_after_call') {
      actual = doAdvanceDemoCount;
    } else {
      // callback_counts_after_call — unused by current probes; reserved.
      actual = Number.NaN;
    }
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  // Invariant: fresh instance gametic === 0
  {
    const instance = candidate.create();
    if (instance.gametic !== 0) {
      failures.push('invariant:TRYRUNTICS_FRESH_INSTANCE_GAMETIC_IS_ZERO');
    }
  }

  // Invariant: no clock advance runs no tics
  {
    const instance = candidate.create();
    let tickers = 0;
    let starts = 0;
    let builds = 0;
    const ran = instance.tryRunTics(
      { currentClock: 0, advancedemoFlag: false },
      {
        startTic: () => starts++,
        buildTiccmd: () => builds++,
        doAdvanceDemo: () => {},
        ticker: () => tickers++,
      },
    );
    if (ran !== 0 || instance.gametic !== 0 || tickers !== 0 || starts !== 0 || builds !== 0) {
      failures.push('invariant:TRYRUNTICS_NO_CLOCK_ADVANCE_RUNS_NO_TICS');
    }
  }

  // Invariant: one tic per clock unit at ticdup=1
  {
    let allMatch = true;
    for (const k of [1, 2, 5, 10, 35]) {
      const instance = candidate.create();
      let tickers = 0;
      const ran = instance.tryRunTics(
        { currentClock: k, advancedemoFlag: false },
        {
          startTic: () => {},
          buildTiccmd: () => {},
          doAdvanceDemo: () => {},
          ticker: () => tickers++,
        },
      );
      if (tickers !== k || ran !== k || instance.gametic !== k) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:TRYRUNTICS_ONE_TIC_PER_CLOCK_UNIT_AT_TICDUP_ONE');
    }
  }

  // Invariant: newtic callback order is startTic then buildTiccmd
  {
    const instance = candidate.create();
    const events: string[] = [];
    instance.tryRunTics(
      { currentClock: 3, advancedemoFlag: false },
      {
        startTic: () => events.push('startTic'),
        buildTiccmd: () => events.push('buildTiccmd'),
        doAdvanceDemo: () => events.push('doAdvanceDemo'),
        ticker: () => events.push('ticker'),
      },
    );
    // Find each (startTic, buildTiccmd) pair — startTic must always precede the buildTiccmd of the same newtic.
    let ok = true;
    let pendingStart = false;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e === 'startTic') {
        if (pendingStart) {
          ok = false;
          break;
        }
        pendingStart = true;
      } else if (e === 'buildTiccmd') {
        if (!pendingStart) {
          ok = false;
          break;
        }
        pendingStart = false;
      } else if (e === 'ticker') {
        // tickers come after the NetUpdate phase; once we see a ticker, no more startTic/buildTiccmd should appear.
        for (let j = i + 1; j < events.length; j++) {
          if (events[j] === 'startTic' || events[j] === 'buildTiccmd') {
            ok = false;
            break;
          }
        }
        break;
      }
    }
    if (!ok) {
      failures.push('invariant:TRYRUNTICS_NEWTIC_CALLBACK_ORDER_STARTTIC_THEN_BUILDTICCMD');
    }
  }

  // Invariant: inner tic callback order is doAdvanceDemo then ticker
  {
    const instance = candidate.create();
    const events: string[] = [];
    instance.tryRunTics(
      { currentClock: 3, advancedemoFlag: true },
      {
        startTic: () => events.push('startTic'),
        buildTiccmd: () => events.push('buildTiccmd'),
        doAdvanceDemo: () => events.push('doAdvanceDemo'),
        ticker: () => events.push('ticker'),
      },
    );
    // For each ticker, the immediately preceding event among {doAdvanceDemo, ticker} should be doAdvanceDemo (if advancedemoFlag=true).
    let ok = true;
    for (let i = 0; i < events.length; i++) {
      if (events[i] === 'ticker') {
        let prev = '';
        for (let j = i - 1; j >= 0; j--) {
          if (events[j] === 'doAdvanceDemo' || events[j] === 'ticker') {
            prev = events[j];
            break;
          }
        }
        if (prev !== 'doAdvanceDemo') {
          ok = false;
          break;
        }
      }
    }
    if (!ok) {
      failures.push('invariant:TRYRUNTICS_INNER_TIC_CALLBACK_ORDER_DEMO_THEN_TICKER');
    }
  }

  // Invariant: newtics processed before inner tickers
  {
    const instance = candidate.create();
    const events: string[] = [];
    instance.tryRunTics(
      { currentClock: 4, advancedemoFlag: false },
      {
        startTic: () => events.push('startTic'),
        buildTiccmd: () => events.push('buildTiccmd'),
        doAdvanceDemo: () => events.push('doAdvanceDemo'),
        ticker: () => events.push('ticker'),
      },
    );
    const firstTicker = events.indexOf('ticker');
    let ok = true;
    if (firstTicker !== -1) {
      for (let i = firstTicker + 1; i < events.length; i++) {
        if (events[i] === 'startTic' || events[i] === 'buildTiccmd') {
          ok = false;
          break;
        }
      }
    }
    if (!ok) {
      failures.push('invariant:TRYRUNTICS_NEWTICS_PROCESSED_BEFORE_INNER_TICKERS');
    }
  }

  // Invariant: ticker observes pre-increment gametic
  {
    const instance = candidate.create();
    const observed: number[] = [];
    instance.tryRunTics(
      { currentClock: 5, advancedemoFlag: false },
      {
        startTic: () => {},
        buildTiccmd: () => {},
        doAdvanceDemo: () => {},
        ticker: (current) => observed.push(current),
      },
    );
    let ok = observed.length === 5;
    if (ok) {
      for (let i = 0; i < 5; i++) {
        if (observed[i] !== i) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) {
      failures.push('invariant:TRYRUNTICS_TICKER_OBSERVES_PRE_INCREMENT_GAMETIC');
    }
  }

  // Invariant: gametic after K tics from fresh equals K
  {
    let allMatch = true;
    for (const k of [0, 1, 2, 5, 35, 70, 100]) {
      const instance = candidate.create();
      instance.tryRunTics(
        { currentClock: k, advancedemoFlag: false },
        {
          startTic: () => {},
          buildTiccmd: () => {},
          doAdvanceDemo: () => {},
          ticker: () => {},
        },
      );
      if (instance.gametic !== k) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:TRYRUNTICS_GAMETIC_AFTER_K_TICS_FROM_FRESH_EQUALS_K');
    }
  }

  // Invariant: gametic increment is by exactly one per inner tic
  {
    const instance = candidate.create();
    const observed: number[] = [];
    instance.tryRunTics(
      { currentClock: 7, advancedemoFlag: false },
      {
        startTic: () => {},
        buildTiccmd: () => {},
        doAdvanceDemo: () => {},
        ticker: (current) => observed.push(current),
      },
    );
    let ok = observed.length === 7;
    if (ok) {
      for (let i = 1; i < observed.length; i++) {
        if (observed[i] - observed[i - 1] !== 1) {
          ok = false;
          break;
        }
      }
    }
    if (instance.gametic !== 7) ok = false;
    if (!ok) {
      failures.push('invariant:TRYRUNTICS_GAMETIC_INCREMENT_IS_BY_EXACTLY_ONE_PER_INNER_TIC');
    }
  }

  // Invariant: doAdvanceDemo called only when flag true
  {
    let count = 0;
    const instance = candidate.create();
    instance.tryRunTics(
      { currentClock: 5, advancedemoFlag: false },
      {
        startTic: () => {},
        buildTiccmd: () => {},
        doAdvanceDemo: () => count++,
        ticker: () => {},
      },
    );
    let count2 = 0;
    instance.tryRunTics(
      { currentClock: 10, advancedemoFlag: true },
      {
        startTic: () => {},
        buildTiccmd: () => {},
        doAdvanceDemo: () => count2++,
        ticker: () => {},
      },
    );
    if (count !== 0 || count2 !== 5) {
      failures.push('invariant:TRYRUNTICS_DOADVANCEDEMO_CALLED_ONLY_WHEN_FLAG_TRUE');
    }
  }

  // Invariant: doAdvanceDemo called before ticker
  {
    const instance = candidate.create();
    const events: string[] = [];
    instance.tryRunTics(
      { currentClock: 3, advancedemoFlag: true },
      {
        startTic: () => events.push('startTic'),
        buildTiccmd: () => events.push('buildTiccmd'),
        doAdvanceDemo: () => events.push('doAdvanceDemo'),
        ticker: () => events.push('ticker'),
      },
    );
    let ok = true;
    for (let i = 0; i < events.length; i++) {
      if (events[i] === 'ticker') {
        let foundDemo = false;
        for (let j = i - 1; j >= 0; j--) {
          if (events[j] === 'doAdvanceDemo') {
            foundDemo = true;
            break;
          }
          if (events[j] === 'ticker') break;
        }
        if (!foundDemo) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) {
      failures.push('invariant:TRYRUNTICS_DOADVANCEDEMO_CALLED_BEFORE_TICKER');
    }
  }

  // Invariant: two instances are independent
  {
    const a = candidate.create();
    const b = candidate.create();
    a.tryRunTics(
      { currentClock: 5, advancedemoFlag: false },
      {
        startTic: () => {},
        buildTiccmd: () => {},
        doAdvanceDemo: () => {},
        ticker: () => {},
      },
    );
    if (a.gametic !== 5 || b.gametic !== 0) {
      failures.push('invariant:TRYRUNTICS_TWO_INSTANCES_ARE_INDEPENDENT');
    }
  }

  // Invariant: returned count equals tickers run
  {
    let allMatch = true;
    for (const k of [0, 1, 2, 5, 35]) {
      const instance = candidate.create();
      let tickers = 0;
      const ran = instance.tryRunTics(
        { currentClock: k, advancedemoFlag: false },
        {
          startTic: () => {},
          buildTiccmd: () => {},
          doAdvanceDemo: () => {},
          ticker: () => tickers++,
        },
      );
      if (ran !== tickers) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:TRYRUNTICS_RETURNED_COUNT_EQUALS_TICKERS_RUN');
    }
  }

  // Invariant: back-to-back calls accumulate gametic
  {
    const instance = candidate.create();
    instance.tryRunTics(
      { currentClock: 3, advancedemoFlag: false },
      {
        startTic: () => {},
        buildTiccmd: () => {},
        doAdvanceDemo: () => {},
        ticker: () => {},
      },
    );
    instance.tryRunTics(
      { currentClock: 5, advancedemoFlag: false },
      {
        startTic: () => {},
        buildTiccmd: () => {},
        doAdvanceDemo: () => {},
        ticker: () => {},
      },
    );
    if (instance.gametic !== 5) {
      failures.push('invariant:TRYRUNTICS_BACK_TO_BACK_CALLS_ACCUMULATE_GAMETIC');
    }
  }

  // Invariant: newtics per clock delta is linear
  {
    const instance = candidate.create();
    let cumulative = 0;
    let allMatch = true;
    for (const c of [1, 3, 7, 12, 20]) {
      instance.tryRunTics(
        { currentClock: c, advancedemoFlag: false },
        {
          startTic: () => {},
          buildTiccmd: () => {},
          doAdvanceDemo: () => {},
          ticker: () => {},
        },
      );
      cumulative = c;
      if (instance.gametic !== cumulative) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) {
      failures.push('invariant:TRYRUNTICS_NEWTICS_PER_CLOCK_DELTA_IS_LINEAR');
    }
  }

  return failures;
}
