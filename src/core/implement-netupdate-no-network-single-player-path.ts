/**
 * Audit ledger for the vanilla DOOM 1.9 NetUpdate body, restricted
 * to the single-player no-network execution path. The 04-011 audit
 * pinned the OUTER TryRunTics phase ordering (entertic capture →
 * NetUpdate → counts derivation → wait loop → outer run loop →
 * post-inner NetUpdate) and the 04-012 audit pinned the INNER
 * I_StartTic / D_PostEvent / D_ProcessEvents trio that NetUpdate
 * invokes per newtic. This audit pins the BODY of NetUpdate itself
 * — the function that sits between TryRunTics's outer phases and
 * the I_StartTic event pump — restricted to the single-player
 * (numplayers=1, numnodes=1, no peer packets, no demo round-trip)
 * shape that the active product target (`bun run doom.ts`) is gated
 * by `plan_vanilla_parity/MASTER_CHECKLIST.md`.
 *
 * The canonical NetUpdate body lives in `linuxdoom-1.10/d_net.c`
 * (vanilla) and `chocolate-doom-2.2.1/src/d_loop.c` (Chocolate's
 * structural refactor — same body, renamed locals, fewer goto
 * labels). Both honour the same single-player execution profile:
 *  - Phase 1 (time check): sample `nowtime = I_GetTime () / ticdup`,
 *    compute `newtics = nowtime - lasttime`, update
 *    `lasttime = nowtime`. Pinned because a port that resets
 *    `lasttime` to zero on every call would observe `newtics == nowtime`
 *    (the absolute wall-clock value) and would flood the build loop
 *    with phantom newtics on every invocation.
 *  - Phase 2 (no-newtics short-circuit): if `newtics <= 0`, the
 *    canonical vanilla body executes `goto listen;` (jumping past
 *    the build loop and the send phase) and the Chocolate body
 *    executes the equivalent early `return`. Pinned because a port
 *    that runs the build loop with `newtics == 0` would either
 *    iterate zero times (semantically equivalent — fine) or, if the
 *    iteration count is recomputed inside the loop body, would loop
 *    forever.
 *  - Phase 3 (skiptics consumption): vanilla applies the canonical
 *    `if (skiptics <= newtics) { newtics -= skiptics; skiptics = 0; }
 *    else { skiptics -= newtics; newtics = 0; }` rule. The skiptics
 *    counter is set non-zero by the netgame protocol when the local
 *    node has built ticcmds for a future tic that remote nodes have
 *    not caught up to yet; in single-player no-network play the
 *    counter is always zero (it is only incremented by the network
 *    protocol's `NCMD_SETUP` / `NCMD_RETRANSMIT` resync paths) so
 *    Phase 3 is a documented no-op for the single-player path. Pinned
 *    because a port that omits the skiptics consumption would diverge
 *    if a future test surface ever drives skiptics>0 (e.g. via demo
 *    sync recovery).
 *  - Phase 4 (build loop): for each of the (post-skiptics) newtics
 *    the canonical body runs `I_StartTic (); D_ProcessEvents (); if
 *    (maketic - gameticdiv >= BACKUPTICS/2-1) break; G_BuildTiccmd
 *    (&localcmds[maketic%BACKUPTICS]); maketic++;`. The half-buffer
 *    guard at `BACKUPTICS/2-1` (= 5 with BACKUPTICS=12) leaves room
 *    in the localcmds ring buffer for delayed remote ticcmds to fit
 *    when network play resumes; in single-player, gameticdiv keeps
 *    up with maketic (TryRunTics drains gametic the same frame
 *    NetUpdate produces maketic), so the guard rarely fires. Pinned
 *    because (a) the per-iteration order I_StartTic → D_ProcessEvents
 *    → guard → G_BuildTiccmd → maketic++ is what the 04-012 audit
 *    relies on, and (b) the half-buffer threshold (NOT BACKUPTICS-1)
 *    is the load-bearing constant.
 *  - Phase 5 (singletics early return): `if (singletics) return;`
 *    bails out before the send phase. The `singletics` flag is set
 *    by `-singletics` on the command line (a vanilla testing flag
 *    used to lock-step the engine to one tic per call regardless of
 *    real-time advance). In single-player no-network play, the flag
 *    has no behavioural effect on the build loop (only on the send
 *    phase, which is itself a no-op for numnodes=1). Pinned because
 *    a port that runs the send phase regardless would attempt to
 *    write packets to a non-existent doomcom struct.
 *  - Phase 6 (send phase): vanilla iterates `for (i=0;
 *    i<doomcom->numnodes; i++)` and calls `HSendPacket(i, NCMD_RETRANSMIT)`
 *    or equivalent. With numnodes=1 the loop iterates ONE time, but
 *    the only "node" is the local console player (consoleplayer=0)
 *    and the canonical vanilla body skips the local node via
 *    `if (i == doomcom->consoleplayer) continue;` style guards
 *    (effectively making the send loop a no-op in single-player).
 *    Pinned because a port that fires actual packets in single-player
 *    would either trigger an OS-level network error or silently
 *    corrupt the loopback buffer.
 *  - Phase 7 (listen / GetPackets): vanilla executes `listen:
 *    GetPackets ();` to drain incoming packets. With numnodes=1
 *    there are no incoming packets; the canonical loop terminates
 *    on the first `if (!HGetPacket()) break;` check (HGetPacket
 *    returns false when the network buffer is empty). In
 *    single-player, GetPackets is a documented no-op. Pinned because
 *    a port that always reads from a packet queue would diverge if
 *    the queue contains stale packets from a previous session.
 *
 * The single-player no-network specialization adds two derived
 * properties on top of the canonical body:
 *  - `nettics[0] == maketic` after every NetUpdate call: in
 *    single-player there is no separate consumer, so the local
 *    node's nettic counter increments alongside maketic (in vanilla
 *    `nettics[]` is updated by GetPackets, which is a no-op here, so
 *    nettics[0] is updated at maketic++ time via the `else` branch
 *    of the consoleplayer check OR — equivalently in Chocolate — by
 *    `recvtic = maketic` at function exit).
 *  - The `availabletics = lowtic - gametic/ticdup` formula in
 *    TryRunTics reduces to `availabletics = maketic - gametic`
 *    (because `lowtic = min(nettics[i] for i in 0..numnodes) ==
 *    nettics[0] == maketic` and `ticdup == 1`).
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source — PRIMARY for this audit
 *      because the body of NetUpdate is a sequence of single-line
 *      statements whose order DOSBox cannot disagree with,
 *   5. Chocolate Doom 2.2.1 source — secondary; preserves the
 *      canonical phase ordering and per-newtic build sequence;
 *      diverges only in the renaming of locals (`recvtic` vs
 *      `nettics[consoleplayer]`) and the splitting of the function
 *      body across `src/d_loop.c` and `src/net_client.c`,
 *   6. DoomWiki only for orientation.
 *
 * This audit pins:
 *  - the canonical phase ordering inside NetUpdate (time check →
 *    no-newtics short-circuit → skiptics consumption → build loop →
 *    singletics early return → send phase → listen phase),
 *  - the canonical per-iteration build-loop body
 *    (`I_StartTic () / D_ProcessEvents () / half-buffer guard /
 *    G_BuildTiccmd / maketic++`),
 *  - the canonical `BACKUPTICS/2-1` half-buffer guard form (NOT
 *    `BACKUPTICS-1`),
 *  - the canonical `lasttime` static baseline persistence across
 *    calls,
 *  - the canonical `goto listen` / early-return short-circuit on
 *    `newtics <= 0`,
 *  - the canonical single-player numnodes=1, numplayers=1,
 *    consoleplayer=0 boundary values that make the send phase and
 *    the listen phase no-ops,
 *  - the canonical "NetUpdate never invokes M_Ticker / G_Ticker /
 *    gametic++" role boundary (ticker invocation is TryRunTics's
 *    job, not NetUpdate's),
 *  - the operational invariants every parity-faithful re-implementation
 *    of the single-player NetUpdate body must honour, and
 *  - a curated probe table covering the canonical no-tic, one-tic,
 *    multi-tic, half-buffer-overflow, lasttime-persistence, and
 *    no-tickers-called boundaries.
 *
 * The audit module deliberately does NOT import from any runtime
 * NetUpdate or tic-runner module. The audit stands on its own
 * canonical-source authority so a corruption of the runtime cannot
 * also silently corrupt the audit that detects the corruption. The
 * focused test validates the ledger AND a hand-rolled reference
 * candidate that mirrors vanilla NetUpdate semantics for the
 * single-player no-network path.
 */

/**
 * Audited canonical `BACKUPTICS` macro value, shared across vanilla
 * `linuxdoom-1.10/d_net.h` and Chocolate Doom 2.2.1 `src/d_loop.h`
 * — exactly 12. Pinned (re-pinned alongside the 04-011 audit which
 * also pins it) because the half-buffer guard `BACKUPTICS/2-1` and
 * the localcmds ring buffer `localcmds[maketic % BACKUPTICS]`
 * indexing both depend on the canonical 12 value.
 */
export const AUDITED_BACKUPTICS = 12;

/**
 * Audited canonical `BACKUPTICS / 2 - 1` half-buffer guard threshold
 * — exactly 5 (= 12 / 2 - 1). Pinned because the canonical vanilla
 * NetUpdate guard `if (maketic - gameticdiv >= BACKUPTICS/2-1) break;`
 * uses HALF the buffer depth minus one as the upper limit on local
 * ticcmd build ahead, NOT the full `BACKUPTICS-1` cap. The half
 * depth is what reserves the second half for delayed remote ticcmds
 * to fit when network play resumes; a port that uses `BACKUPTICS-1`
 * (= 11) would build twice as far ahead and would mask the
 * canonical demo-recording byte boundary at 5 ticcmds-per-newtic.
 */
export const AUDITED_NETUPDATE_HALF_BUFFER_GUARD = 5;

/**
 * Audited canonical single-player `numnodes` count — exactly 1
 * (the local console player is the only "node" in the doomcom
 * struct). Pinned because the send-phase loop `for (i=0;
 * i<doomcom->numnodes; i++)` iterates exactly once in single-player
 * AND the iteration is itself a no-op (the only node is the local
 * one). A port that uses `doomcom->numnodes == 0` would skip the
 * loop entirely (semantically equivalent in single-player but
 * inconsistent with the canonical doomcom contract).
 */
export const AUDITED_SINGLE_PLAYER_NUMNODES = 1;

/**
 * Audited canonical single-player `numplayers` count — exactly 1
 * (the local console player is the only player in the game).
 * Pinned alongside numnodes=1 to defend against a port that uses
 * `numplayers > numnodes` (impossible in vanilla but a common
 * temptation when adding bot players that share a node).
 */
export const AUDITED_SINGLE_PLAYER_NUMPLAYERS = 1;

/**
 * Audited canonical single-player `consoleplayer` index — exactly 0.
 * Pinned because the canonical localcmds indexing
 * `localcmds[maketic % BACKUPTICS]` and the `nettics[consoleplayer]`
 * read both depend on the local player being slot 0; a port that
 * uses consoleplayer=1 would write to the slot reserved for player
 * 1 in a four-player game.
 */
export const AUDITED_SINGLE_PLAYER_CONSOLEPLAYER = 0;

/**
 * Audited canonical fresh-state `lasttime` baseline — exactly 0
 * (the C runtime zero-initialises file-scope `static int lasttime`).
 * Pinned because the canonical `newtics = nowtime - lasttime`
 * delta on the first NetUpdate call observes `newtics == nowtime`
 * (the absolute clock value at first sample); a port that
 * pre-initialises lasttime to a non-zero baseline would observe a
 * negative delta on the first call and short-circuit via the
 * `newtics <= 0` early exit.
 */
export const AUDITED_FRESH_LASTTIME = 0;

/**
 * Audited canonical fresh-state `maketic` baseline — exactly 0 (the
 * C runtime zero-initialises file-scope `int maketic`). Pinned
 * because the canonical `localcmds[maketic % BACKUPTICS]` indexing
 * starts at slot 0 on the first build; a port that pre-initialises
 * maketic to a non-zero value would skip the first slots of the
 * ring buffer.
 */
export const AUDITED_FRESH_MAKETIC = 0;

/**
 * Audited canonical fresh-state `skiptics` baseline — exactly 0 (the
 * C runtime zero-initialises file-scope `int skiptics`). Pinned
 * because the canonical `if (skiptics <= newtics) { newtics -=
 * skiptics; }` consumption rule is a no-op when skiptics=0; in
 * single-player no-network play, skiptics is never set non-zero
 * (it is only incremented by the network protocol's resync path).
 */
export const AUDITED_FRESH_SKIPTICS = 0;

/**
 * Audited canonical NetUpdate phase index — exactly 1 (time check
 * is the first observable side effect of entering NetUpdate).
 * Pinned because a port that defers the time check to after the
 * build loop would either build with stale newtics (build first,
 * compute later) or build zero ticcmds on every call.
 */
export const AUDITED_NETUPDATE_PHASE_TIME_CHECK = 1;

/**
 * Audited canonical NetUpdate phase index — exactly 2 (newtics<=0
 * short-circuit happens immediately after the time check, before
 * skiptics consumption and the build loop). Pinned because a port
 * that runs skiptics consumption with newtics<=0 would observe
 * `skiptics -= newtics` add to skiptics (a negative subtraction is
 * an addition), inflating skiptics on every no-clock-advance call.
 */
export const AUDITED_NETUPDATE_PHASE_NO_NEWTICS_SHORT_CIRCUIT = 2;

/**
 * Audited canonical NetUpdate phase index — exactly 3 (skiptics
 * consumption happens after the no-newtics short-circuit, before
 * the build loop). Pinned because the build loop iteration count
 * is the post-skiptics newtics value; a port that runs the build
 * loop with the pre-skiptics value would over-build.
 */
export const AUDITED_NETUPDATE_PHASE_SKIPTICS_CONSUMPTION = 3;

/**
 * Audited canonical NetUpdate phase index — exactly 4 (build loop
 * is the central work phase, after the time check / no-newtics /
 * skiptics phases). Pinned because the build loop is where I_StartTic
 * → D_ProcessEvents → G_BuildTiccmd → maketic++ runs.
 */
export const AUDITED_NETUPDATE_PHASE_BUILD_LOOP = 4;

/**
 * Audited canonical NetUpdate phase index — exactly 5 (singletics
 * early return happens after the build loop, before the send phase).
 * Pinned because a port that returns BEFORE the build loop would
 * never produce ticcmds when -singletics is set.
 */
export const AUDITED_NETUPDATE_PHASE_SINGLETICS_RETURN = 5;

/**
 * Audited canonical NetUpdate phase index — exactly 6 (send phase
 * runs only after the build loop and the singletics check; in
 * single-player numnodes=1 it is a no-op).
 */
export const AUDITED_NETUPDATE_PHASE_SEND = 6;

/**
 * Audited canonical NetUpdate phase index — exactly 7 (listen phase
 * runs last, draining incoming packets via GetPackets; in
 * single-player numnodes=1 it is a no-op).
 */
export const AUDITED_NETUPDATE_PHASE_LISTEN = 7;

/**
 * Audited canonical name of the linuxdoom source file containing
 * the vanilla NetUpdate body — exactly `linuxdoom-1.10/d_net.c`.
 * Pinned to disambiguate from any future refactor that moves
 * NetUpdate.
 */
export const AUDITED_VANILLA_NETUPDATE_SOURCE_FILE = 'linuxdoom-1.10/d_net.c';

/**
 * Audited canonical name of the Chocolate Doom source file
 * containing the refactored NetUpdate body — exactly
 * `chocolate-doom-2.2.1/src/d_loop.c`. Pinned because Chocolate
 * deliberately split the loop body out of `d_net.c` (where vanilla
 * kept the network protocol) into a dedicated `d_loop.c`; a
 * parity-faithful re-implementation is free to locate the body in
 * either file as long as the canonical phase ordering is preserved.
 */
export const AUDITED_CHOCOLATE_NETUPDATE_SOURCE_FILE = 'chocolate-doom-2.2.1/src/d_loop.c';

/**
 * Stable identifier for one pinned C-source fact about the canonical
 * single-player no-network NetUpdate path.
 */
export type DoomNetUpdateSinglePlayerFactId =
  | 'C_BODY_NETUPDATE_TIME_CHECK_USES_TICDUP_DIVISION'
  | 'C_BODY_NETUPDATE_NEWTICS_DELTA_FROM_LASTTIME'
  | 'C_BODY_NETUPDATE_LASTTIME_UPDATE_BEFORE_BUILD_LOOP'
  | 'C_BODY_NETUPDATE_NEWTICS_NONPOSITIVE_GOTO_LISTEN'
  | 'C_BODY_NETUPDATE_SKIPTICS_CONSUMED_AGAINST_NEWTICS'
  | 'C_BODY_NETUPDATE_BUILD_LOOP_HEADER_FOR_NEWTICS'
  | 'C_BODY_NETUPDATE_BUILD_LOOP_STARTTIC_BEFORE_PROCESS'
  | 'C_BODY_NETUPDATE_BUILD_LOOP_PROCESS_BEFORE_BUILDTICCMD'
  | 'C_BODY_NETUPDATE_HALF_BUFFER_GUARD_BREAK'
  | 'C_BODY_NETUPDATE_LOCALCMDS_INDEXED_BY_MAKETIC_MOD_BACKUPTICS'
  | 'C_BODY_NETUPDATE_MAKETIC_INCREMENT_AFTER_BUILDTICCMD'
  | 'C_BODY_NETUPDATE_SINGLETICS_EARLY_RETURN'
  | 'C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_SEND_NOOP'
  | 'C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_LISTEN_NOOP'
  | 'C_BODY_NETUPDATE_DOES_NOT_INVOKE_M_TICKER_OR_G_TICKER'
  | 'C_BODY_NETUPDATE_DOES_NOT_ADVANCE_GAMETIC'
  | 'C_HEADER_BACKUPTICS_HALF_DEPTH_MINUS_ONE_IS_FIVE'
  | 'C_HEADER_VANILLA_LASTTIME_FILE_SCOPE_STATIC'
  | 'C_BODY_CHOCOLATE_RECVTIC_REPLACES_NETTICS_INDEX';

/** One pinned C-source fact about the single-player no-network NetUpdate path. */
export interface DoomNetUpdateSinglePlayerFact {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomNetUpdateSinglePlayerFactId;
  /** Whether the fact comes from the upstream C declaration or the upstream C body. */
  readonly category: 'c-header' | 'c-body';
  /** Plain-language description of what this fact pins. */
  readonly description: string;
  /** Verbatim C reference snippet. */
  readonly cReference: string;
  /** Reference source file path inside the upstream tree. */
  readonly referenceSourceFile: 'linuxdoom-1.10/d_net.c' | 'linuxdoom-1.10/d_net.h' | 'chocolate-doom-2.2.1/src/d_loop.c' | 'chocolate-doom-2.2.1/src/d_loop.h' | 'shared:vanilla+chocolate';
}

/**
 * Pinned ledger of nineteen C-source facts that together define the
 * canonical single-player no-network NetUpdate path. The focused
 * test asserts the ledger is closed (every id appears exactly once)
 * and that every fact is honoured by the runtime.
 *
 * Categorisation:
 *  - `c-header` — file-scope or preprocessor declaration whose
 *    presence and value are visible without entering any function
 *    body.
 *  - `c-body`   — function body statement or call site.
 */
export const DOOM_NETUPDATE_SINGLE_PLAYER_AUDIT: readonly DoomNetUpdateSinglePlayerFact[] = [
  {
    id: 'C_BODY_NETUPDATE_TIME_CHECK_USES_TICDUP_DIVISION',
    category: 'c-body',
    description:
      'The vanilla `linuxdoom-1.10/d_net.c` NetUpdate body opens with `nowtime = I_GetTime ()/ticdup;` — the host clock divided by ticdup BEFORE the newtics computation. Pinned because a port that omits the division would observe `nowtime` advancing `ticdup` times faster than the vanilla baseline; in single-player ticdup=1 the division is the identity (no observable difference), but a port that hard-codes the division to "/1" would diverge if ticdup ever changes (e.g. demo replay of a 2-player demo with ticdup=2).',
    cReference: 'nowtime = I_GetTime ()/ticdup;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_NEWTICS_DELTA_FROM_LASTTIME',
    category: 'c-body',
    description:
      'Immediately after the time check, the vanilla body computes `newtics = nowtime - lasttime;` where `lasttime` is a function-local `static int lasttime;` that persists across calls. Pinned because the static baseline is the load-bearing property: a port that uses a non-static (auto) `lasttime` would re-initialise on every call and would observe `newtics == nowtime` on every call, building one ticcmd per absolute-clock-tic instead of one per delta-clock-tic.',
    cReference: 'newtics = nowtime - lasttime;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_LASTTIME_UPDATE_BEFORE_BUILD_LOOP',
    category: 'c-body',
    description:
      'After the newtics delta computation, the vanilla body updates `lasttime = nowtime;` BEFORE the `if (newtics <= 0) goto listen;` short-circuit and BEFORE the build loop. Pinned because the update must happen exactly once per NetUpdate call (not per iteration of the build loop, not after the build loop); a port that defers lasttime update to after the build loop would observe a stale baseline if the build loop bails out early via the half-buffer guard.',
    cReference: 'lasttime = nowtime;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_NEWTICS_NONPOSITIVE_GOTO_LISTEN',
    category: 'c-body',
    description:
      'The vanilla NetUpdate body executes `if (newtics <= 0) goto listen;` immediately after the lasttime update. The goto skips the skiptics consumption, the build loop, the singletics check, and the send phase, jumping directly to the `listen:` label that wraps GetPackets. Pinned because a port that omits the short-circuit would run the build loop with newtics=0 (a documented no-op iteration) but would also run the skiptics consumption with newtics=0, which incorrectly increments skiptics via the `else { skiptics -= newtics; newtics = 0; }` branch (skiptics -= 0 is a no-op, but the branch could be re-entered on subsequent calls if newtics computation ever yields negative).',
    cReference: 'if (newtics <= 0)\n        goto listen;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_SKIPTICS_CONSUMED_AGAINST_NEWTICS',
    category: 'c-body',
    description:
      'The vanilla body applies the canonical skiptics rule: `if (skiptics <= newtics) { newtics -= skiptics; skiptics = 0; } else { skiptics -= newtics; newtics = 0; }`. The rule consumes up to `newtics` skiptics per call (with the remainder carried over for the next call). In single-player no-network play, skiptics is never set non-zero (the network protocol resync paths that increment it are not reachable), so the rule is a no-op (the `if` branch fires with skiptics=0 and newtics=N, yielding newtics=N unchanged). Pinned because a port that omits the rule would diverge if a future test surface ever drives skiptics>0 via demo sync recovery.',
    cReference: 'if (skiptics <= newtics) { newtics -= skiptics; skiptics = 0; } else { skiptics -= newtics; newtics = 0; }',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_BUILD_LOOP_HEADER_FOR_NEWTICS',
    category: 'c-body',
    description:
      'The vanilla build loop header is exactly `for (i=0 ; i<newtics ; i++)` — an integer-iteration loop with `newtics` (post-skiptics) as the upper bound. Pinned because a port that uses `while (i < newtics)` with a manually-incremented i would diverge if the body modifies newtics or i (the canonical body modifies neither, but a port might be tempted to e.g. recompute newtics inside the loop after the half-buffer guard).',
    cReference: 'for (i=0 ; i<newtics ; i++)',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_BUILD_LOOP_STARTTIC_BEFORE_PROCESS',
    category: 'c-body',
    description:
      'The first statement inside the build loop body is `I_StartTic ();` — the host event pump that drains the OS-level keyboard / mouse queue into the global `events[MAXEVENTS]` buffer (via D_PostEvent). Pinned because I_StartTic must run BEFORE D_ProcessEvents on every iteration; a port that swaps the order would drain stale events from the previous iteration.',
    cReference: 'I_StartTic ();',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_BUILD_LOOP_PROCESS_BEFORE_BUILDTICCMD',
    category: 'c-body',
    description:
      "The second statement inside the build loop body is `D_ProcessEvents ();` — the event drain that dispatches each pumped event through M_Responder then G_Responder. The drain MUST run BEFORE G_BuildTiccmd because G_BuildTiccmd reads the responder-mutated state (e.g. `gamekeydown[]`, `mousebuttons[]`) to encode the ticcmd. Pinned because a port that calls G_BuildTiccmd before D_ProcessEvents would encode the previous frame's input state, introducing a one-frame input lag.",
    cReference: 'D_ProcessEvents ();',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_HALF_BUFFER_GUARD_BREAK',
    category: 'c-body',
    description:
      'The third statement inside the build loop body is `if (maketic - gameticdiv >= BACKUPTICS/2-1) break;` — the half-buffer guard that prevents the localcmds ring buffer from filling more than half-deep. The threshold is `BACKUPTICS/2-1` = 5 (with BACKUPTICS=12), NOT `BACKUPTICS-1` = 11. The half-depth limit reserves the second half for delayed remote ticcmds. Pinned because a port that uses `BACKUPTICS-1` as the limit would build twice as many local ticcmds before bailing, which would overflow the buffer when network play resumes after a stall.',
    cReference: "if (maketic - gameticdiv >= BACKUPTICS/2-1)\n            break;          // can't hold any more",
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_LOCALCMDS_INDEXED_BY_MAKETIC_MOD_BACKUPTICS',
    category: 'c-body',
    description:
      'After the half-buffer guard, the canonical body calls `G_BuildTiccmd (&localcmds[maketic%BACKUPTICS]);` — building into the slot at `maketic % BACKUPTICS` of the localcmds ring. Pinned because the modulo wrap is what makes the buffer behave as a ring: maketic increments unboundedly but the slot index wraps at BACKUPTICS-1. A port that uses a linear array (no wrap) would overflow at maketic=BACKUPTICS.',
    cReference: 'G_BuildTiccmd (&localcmds[maketic%BACKUPTICS]);',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_MAKETIC_INCREMENT_AFTER_BUILDTICCMD',
    category: 'c-body',
    description:
      'The last statement inside the build loop body is `maketic++;` — the maketic counter advances AFTER G_BuildTiccmd has populated the slot. Pinned because a port that pre-increments would write the i-th ticcmd to slot i+1 (off-by-one), leaving slot 0 unwritten on the first iteration and overwriting slot 1 on the second.',
    cReference: 'maketic++;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_SINGLETICS_EARLY_RETURN',
    category: 'c-body',
    description:
      'After the build loop, the canonical body executes `if (singletics) return;` — bails out before the send phase when -singletics is on the command line. The flag exists in vanilla as a testing aid (locks the engine to one tic per NetUpdate call regardless of real-time). In single-player no-network play, the early return is observationally equivalent to running the (no-op) send phase; pinned because a port that omits the check would run the send phase even with -singletics on, which is a no-op for numnodes=1 but would diverge if a future test surface ever drives numnodes>1 in single-player demo replay.',
    cReference: 'if (singletics)\n        return;         // singletic update is syncronous',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_SEND_NOOP',
    category: 'c-body',
    description:
      'In single-player play, `doomcom->numnodes == 1` and the only "node" is the local console player. The vanilla send-phase loop `for (i=0 ; i<doomcom->numnodes ; i++) { ... HSendPacket(...); }` iterates exactly once but the iteration is a guarded no-op (the canonical body skips the local node via `if (i == doomcom->consoleplayer) continue;` style guards or never sets a remote ackbase to receive the packet). Pinned because a port that fires actual packets in single-player would attempt to write to a non-existent doomcom struct and would fault.',
    cReference: 'for (i=0 ; i<doomcom->numnodes ; i++) { /* skip consoleplayer */ }',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_SINGLE_PLAYER_NUMNODES_MAKES_LISTEN_NOOP',
    category: 'c-body',
    description:
      'In single-player play, the listen phase `listen: GetPackets ();` drains incoming packets via a `while (HGetPacket()) { ... }` loop. With numnodes=1 there are no incoming packets and the loop terminates on the first HGetPacket call (which returns false for an empty network buffer). Pinned because a port that always reads from a pre-populated packet queue would diverge if the queue contains stale packets from a previous session.',
    cReference: 'listen:\n    GetPackets ();',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_NETUPDATE_DOES_NOT_INVOKE_M_TICKER_OR_G_TICKER',
    category: 'c-body',
    description:
      "The canonical NetUpdate body in `linuxdoom-1.10/d_net.c` does NOT call `M_Ticker ()` or `G_Ticker ()`. The ticker invocations are TryRunTics's job (inside the inner ticdup loop, after the outer counts loop's NetUpdate call). Pinned because a port that runs the ticker from inside NetUpdate would advance gametic out of phase with the canonical TryRunTics ordering, breaking demo replay parity.",
    cReference: 'NetUpdate body has no M_Ticker or G_Ticker call sites',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
  {
    id: 'C_BODY_NETUPDATE_DOES_NOT_ADVANCE_GAMETIC',
    category: 'c-body',
    description:
      'The canonical NetUpdate body in `linuxdoom-1.10/d_net.c` does NOT modify `gametic` (the simulation tic counter). It modifies `maketic` (the producer-side counter) which is a strictly different variable. Pinned because a port that conflates maketic and gametic (e.g. shares a single counter) would advance the simulation on every NetUpdate call, breaking the canonical "build then run" separation that demo replay parity depends on.',
    cReference: 'NetUpdate body has no gametic write sites',
    referenceSourceFile: 'shared:vanilla+chocolate',
  },
  {
    id: 'C_HEADER_BACKUPTICS_HALF_DEPTH_MINUS_ONE_IS_FIVE',
    category: 'c-header',
    description:
      'BACKUPTICS == 12, so BACKUPTICS / 2 == 6, so BACKUPTICS / 2 - 1 == 5. The compile-time arithmetic produces 5 as the canonical half-buffer guard threshold. Pinned because a port that uses a different BACKUPTICS value (e.g. shrinks to 6) would compute a different guard threshold (6/2-1 = 2), tightening the build window by 60%; conversely a port that uses BACKUPTICS=24 would compute 11 as the guard threshold, doubling the build window.',
    cReference: 'BACKUPTICS/2-1 == 12/2-1 == 5',
    referenceSourceFile: 'linuxdoom-1.10/d_net.h',
  },
  {
    id: 'C_HEADER_VANILLA_LASTTIME_FILE_SCOPE_STATIC',
    category: 'c-header',
    description:
      'The vanilla `linuxdoom-1.10/d_net.c` declares `int lasttime;` at file scope (zero-initialised by the C runtime). The lasttime variable persists across NetUpdate calls; it is the static baseline for the newtics computation. Pinned because a port that declares lasttime as a function-local auto variable would re-initialise to 0 on every call, observing `newtics == nowtime` on every call.',
    cReference: 'int             lasttime;',
    referenceSourceFile: 'linuxdoom-1.10/d_net.c',
  },
  {
    id: 'C_BODY_CHOCOLATE_RECVTIC_REPLACES_NETTICS_INDEX',
    category: 'c-body',
    description:
      "Chocolate Doom 2.2.1 `src/d_loop.c` renames the half-buffer guard to use `recvtic` (the receive-side counter) instead of vanilla's `gameticdiv = gametic/ticdup;`. The Chocolate guard is `if (maketic - recvtic >= BACKUPTICS/2-1) break;`. The two forms agree in single-player ticdup=1 because `recvtic == gametic == gameticdiv` (no remote tics in flight), so the deviation is observably equivalent in single-player. Pinned to highlight that the rename is the one structural deviation a parity-faithful re-implementation may safely emulate.",
    cReference: 'if (maketic - recvtic >= BACKUPTICS/2-1) break;',
    referenceSourceFile: 'chocolate-doom-2.2.1/src/d_loop.c',
  },
] as const;

/**
 * Stable identifier for one operational invariant the cross-check
 * helper enforces against any candidate single-player no-network
 * NetUpdate surface tuple.
 */
export type DoomNetUpdateSinglePlayerInvariantId =
  | 'NETUPDATE_FRESH_INSTANCE_MAKETIC_IS_ZERO'
  | 'NETUPDATE_FRESH_INSTANCE_LASTTIME_IS_ZERO'
  | 'NETUPDATE_NO_CLOCK_ADVANCE_BUILDS_NO_TICCMDS'
  | 'NETUPDATE_ONE_TIC_PER_CLOCK_UNIT_BELOW_HALF_BUFFER'
  | 'NETUPDATE_HALF_BUFFER_GUARD_CAPS_BUILD_AT_FIVE'
  | 'NETUPDATE_PER_ITERATION_CALLBACK_ORDER_STARTTIC_PROCESS_BUILD'
  | 'NETUPDATE_LASTTIME_PERSISTS_ACROSS_CALLS'
  | 'NETUPDATE_DOES_NOT_INVOKE_TICKER_CALLBACKS'
  | 'NETUPDATE_DOES_NOT_INVOKE_DOADVANCEDEMO_CALLBACK'
  | 'NETUPDATE_MAKETIC_NEVER_DECREMENTS'
  | 'NETUPDATE_TWO_INSTANCES_ARE_INDEPENDENT'
  | 'NETUPDATE_LASTTIME_UPDATED_EVEN_ON_SHORT_CIRCUIT'
  | 'NETUPDATE_BACK_TO_BACK_CALLS_ACCUMULATE_MAKETIC'
  | 'NETUPDATE_NEWTICS_NEGATIVE_DELTA_BUILDS_NO_TICCMDS'
  | 'NETUPDATE_GAMETIC_FEEDBACK_RELEASES_HALF_BUFFER_GUARD';

/** One operational invariant the cross-check helper enforces. */
export interface DoomNetUpdateSinglePlayerInvariant {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomNetUpdateSinglePlayerInvariantId;
  /** Plain-language description of the invariant. */
  readonly description: string;
}

/**
 * Pinned ledger of fifteen operational invariants. The focused test
 * asserts the ledger is closed and that the cross-check helper
 * returns exactly the right failure id for each tampered candidate.
 */
export const DOOM_NETUPDATE_SINGLE_PLAYER_INVARIANTS: readonly DoomNetUpdateSinglePlayerInvariant[] = [
  {
    id: 'NETUPDATE_FRESH_INSTANCE_MAKETIC_IS_ZERO',
    description:
      'A freshly-constructed candidate exposes `maketic === 0` before any netUpdate call. Pinned because the canonical file-scope `int maketic;` declaration zero-initialises (C runtime guarantee for static int storage); a port that pre-initialises to a non-zero value would skip the first slots of the localcmds ring buffer.',
  },
  {
    id: 'NETUPDATE_FRESH_INSTANCE_LASTTIME_IS_ZERO',
    description:
      'A freshly-constructed candidate exposes `lasttime === 0` before any netUpdate call. Pinned because the canonical file-scope `int lasttime;` declaration zero-initialises (C runtime guarantee for static int storage); a port that pre-initialises to a non-zero baseline would observe a negative newtics delta on the first call and short-circuit via the `newtics <= 0` early exit.',
  },
  {
    id: 'NETUPDATE_NO_CLOCK_ADVANCE_BUILDS_NO_TICCMDS',
    description:
      'A netUpdate call with `currentClock === lasttime` (no advance from baseline) on a fresh candidate builds zero ticcmds: leaves maketic unchanged, invokes no startTic / processEvents / buildTiccmd callbacks. Pinned because the canonical `if (newtics <= 0) goto listen;` short-circuit skips the build loop when newtics is 0; a port that runs the build loop with newtics=0 would (semantically equivalently) iterate zero times, but a port that recomputes newtics inside the loop would loop forever.',
  },
  {
    id: 'NETUPDATE_ONE_TIC_PER_CLOCK_UNIT_BELOW_HALF_BUFFER',
    description:
      'A netUpdate call with `currentClock - lasttime === K` where K < BACKUPTICS/2-1 = 5 builds exactly K ticcmds (assuming gameticFeedback keeps maketic - gameticFeedback well below the half-buffer guard). Pinned because the canonical build loop runs `for (i=0; i<newtics; i++)` with newtics=K and the half-buffer guard does not trip below the K=5 threshold.',
  },
  {
    id: 'NETUPDATE_HALF_BUFFER_GUARD_CAPS_BUILD_AT_FIVE',
    description:
      'A netUpdate call with `currentClock - lasttime` >= BACKUPTICS/2-1 = 5 on a fresh candidate (gametic feedback at 0) builds AT MOST 5 ticcmds before the guard `if (maketic - gameticdiv >= BACKUPTICS/2-1) break;` fires and bails out of the build loop. Pinned because the canonical guard is what reserves half the buffer for delayed remote ticcmds; a port that uses BACKUPTICS-1 (= 11) as the cap would build 11 ticcmds and overflow the second half of the buffer.',
  },
  {
    id: 'NETUPDATE_PER_ITERATION_CALLBACK_ORDER_STARTTIC_PROCESS_BUILD',
    description:
      "For each iteration of the build loop, the candidate must invoke `startTic` BEFORE `processEvents` BEFORE `buildTiccmd`. Pinned because the canonical body is `I_StartTic (); D_ProcessEvents (); ... G_BuildTiccmd (...);` — startTic pumps the host queue, processEvents drains the queue into game state, buildTiccmd reads the freshly-drained state. A port that reorders these (e.g. buildTiccmd first) would encode the previous iteration's state.",
  },
  {
    id: 'NETUPDATE_LASTTIME_PERSISTS_ACROSS_CALLS',
    description:
      'After a netUpdate call with currentClock=A, the next netUpdate call with currentClock=A+B observes newtics=B (NOT newtics=A+B). Pinned because the canonical `static int lasttime;` baseline is updated to nowtime once per call and persists to the next call; a port that resets lasttime to 0 on every call would observe newtics=A+B and would over-build by A on the second call.',
  },
  {
    id: 'NETUPDATE_DOES_NOT_INVOKE_TICKER_CALLBACKS',
    description:
      "A netUpdate call NEVER invokes `ticker` callbacks (M_Ticker / G_Ticker equivalents). Pinned because the canonical NetUpdate body is build-only, NOT run-only; the ticker invocations are TryRunTics's job (inside the inner ticdup loop). A port that runs the ticker inside NetUpdate would advance gametic out of phase with the canonical TryRunTics ordering, breaking demo replay parity.",
  },
  {
    id: 'NETUPDATE_DOES_NOT_INVOKE_DOADVANCEDEMO_CALLBACK',
    description:
      "A netUpdate call NEVER invokes `doAdvanceDemo` callbacks. Pinned because the canonical NetUpdate body has no `if (advancedemo) D_DoAdvanceDemo ();` call site; the demo state machine is advanced from inside TryRunTics's inner ticdup loop. A port that conflates the two would advance the demo state on every NetUpdate call.",
  },
  {
    id: 'NETUPDATE_MAKETIC_NEVER_DECREMENTS',
    description:
      'Across any sequence of netUpdate calls, `maketic` is monotonically non-decreasing (it either stays the same on no-newtics calls or increases by `min(newtics, BACKUPTICS/2-1)` on tic-bearing calls). Pinned because the canonical body has only one maketic write site (`maketic++;` inside the build loop) and that write is post-increment-by-1; a port that decrements maketic on overflow (a common temptation) would corrupt the localcmds ring buffer indexing.',
  },
  {
    id: 'NETUPDATE_TWO_INSTANCES_ARE_INDEPENDENT',
    description:
      'Two independently-constructed candidates do not share state: ticking instance A by 5 clock units leaves instance B at maketic=0 and lasttime=0. Pinned because a port that uses a global static state (rather than per-instance) would couple test fixtures and break demo replay isolation.',
  },
  {
    id: 'NETUPDATE_LASTTIME_UPDATED_EVEN_ON_SHORT_CIRCUIT',
    description:
      'A netUpdate call with `currentClock < lasttime` (negative newtics delta) STILL updates lasttime to the new currentClock value before the short-circuit. Pinned because the canonical body executes `lasttime = nowtime;` BEFORE the `if (newtics <= 0) goto listen;` check; a port that defers the lasttime update to after the short-circuit would observe a stale baseline on the next call (the negative delta would persist) and would over-build on the recovery call.',
  },
  {
    id: 'NETUPDATE_BACK_TO_BACK_CALLS_ACCUMULATE_MAKETIC',
    description:
      'Two consecutive netUpdate calls with currentClock=A then currentClock=A+B advance maketic by exactly A+B (assuming both deltas are positive and stay below the half-buffer guard). Pinned because the canonical static-baseline `lasttime` persists across calls; a port that resets lasttime would observe the second call running A+B tics instead of B tics.',
  },
  {
    id: 'NETUPDATE_NEWTICS_NEGATIVE_DELTA_BUILDS_NO_TICCMDS',
    description:
      'A netUpdate call with `currentClock < lasttime` (negative newtics delta — host clock went backwards, e.g. due to a debugger pause or a manually-stepped test fixture) builds zero ticcmds. Pinned because the canonical `if (newtics <= 0) goto listen;` short-circuit catches negative deltas; a port that omits the `<=` check (e.g. `if (newtics < 0)`) would still short-circuit, but a port that omits the check entirely would either execute `for (i=0; i < -3; i++)` (zero iterations on signed int comparison — semantically equivalent) or convert to unsigned and iterate billions of times (catastrophic).',
  },
  {
    id: 'NETUPDATE_GAMETIC_FEEDBACK_RELEASES_HALF_BUFFER_GUARD',
    description:
      'When the candidate is fed a gameticFeedback value that catches up to maketic, the half-buffer guard releases and subsequent netUpdate calls can build new ticcmds again. Concretely: after one call builds 5 ticcmds (capping at the guard), advancing gameticFeedback to 5 should let the next call build 5 more ticcmds (assuming sufficient newtics). Pinned because the guard is `maketic - gameticdiv >= BACKUPTICS/2-1` — it depends on the LIVE gameticdiv, not the maketic-at-call-start; a port that captures gameticdiv only at function entry would miss the release.',
  },
] as const;

/** Stable identifier for one curated single-player NetUpdate probe. */
export type DoomNetUpdateSinglePlayerProbeId =
  | 'fresh_no_clock_advance_builds_zero'
  | 'fresh_clock_one_builds_one_ticcmd'
  | 'fresh_clock_three_builds_three_ticcmds'
  | 'fresh_clock_five_builds_five_ticcmds_at_guard'
  | 'fresh_clock_six_capped_at_five_by_half_buffer_guard'
  | 'fresh_clock_eleven_capped_at_five_by_half_buffer_guard'
  | 'lasttime_persistence_two_calls_three_then_two'
  | 'negative_clock_delta_builds_zero'
  | 'after_gametic_catchup_half_buffer_guard_releases'
  | 'no_ticker_or_doAdvanceDemo_calls';

/** Which kind of expectation a probe pins. */
export type DoomNetUpdateSinglePlayerProbeTarget =
  | 'maketic_after_calls'
  | 'startTic_call_count_after_calls'
  | 'processEvents_call_count_after_calls'
  | 'buildTiccmd_call_count_after_calls'
  | 'ticker_call_count_after_calls'
  | 'doAdvanceDemo_call_count_after_calls';

/** One step in a probe's input sequence. */
export interface DoomNetUpdateSinglePlayerProbeStep {
  /** Absolute host clock value passed to netUpdate. */
  readonly currentClock: number;
  /** Gametic feedback (analogous to vanilla `gameticdiv`); controls the half-buffer guard. */
  readonly gameticFeedback: number;
}

/** One curated single-player NetUpdate probe expectation. */
export interface DoomNetUpdateSinglePlayerProbe {
  /** Stable identifier; cross-referenced by the focused test. */
  readonly id: DoomNetUpdateSinglePlayerProbeId;
  /** Which surface this probe inspects. */
  readonly target: DoomNetUpdateSinglePlayerProbeTarget;
  /** Description of the call sequence run from a freshly-constructed instance. */
  readonly input: {
    readonly steps: readonly DoomNetUpdateSinglePlayerProbeStep[];
  };
  /** Expected canonical observed value at the END of the step sequence. */
  readonly expected: number;
  /** Plain-language note explaining what this probe defends against. */
  readonly note: string;
}

/**
 * Curated probe table covering the canonical single-player no-network
 * NetUpdate boundaries. Each probe is hand-pinned from the canonical
 * `linuxdoom-1.10/d_net.c` source.
 */
export const DOOM_NETUPDATE_SINGLE_PLAYER_PROBES: readonly DoomNetUpdateSinglePlayerProbe[] = [
  {
    id: 'fresh_no_clock_advance_builds_zero',
    target: 'maketic_after_calls',
    input: { steps: [{ currentClock: 0, gameticFeedback: 0 }] },
    expected: 0,
    note: 'A netUpdate call with currentClock=0 on a fresh candidate (lasttime=0) builds zero ticcmds. Anchors the canonical `if (newtics <= 0) goto listen;` short-circuit.',
  },
  {
    id: 'fresh_clock_one_builds_one_ticcmd',
    target: 'maketic_after_calls',
    input: { steps: [{ currentClock: 1, gameticFeedback: 0 }] },
    expected: 1,
    note: 'A netUpdate call with currentClock=1 on a fresh candidate builds exactly one ticcmd (newtics=1, half-buffer guard not tripped). Anchors the smallest tic-bearing build.',
  },
  {
    id: 'fresh_clock_three_builds_three_ticcmds',
    target: 'maketic_after_calls',
    input: { steps: [{ currentClock: 3, gameticFeedback: 0 }] },
    expected: 3,
    note: 'A netUpdate call with currentClock=3 on a fresh candidate builds exactly three ticcmds (newtics=3, well below half-buffer guard at 5).',
  },
  {
    id: 'fresh_clock_five_builds_five_ticcmds_at_guard',
    target: 'maketic_after_calls',
    input: { steps: [{ currentClock: 5, gameticFeedback: 0 }] },
    expected: 5,
    note: 'A netUpdate call with currentClock=5 on a fresh candidate builds exactly five ticcmds; the half-buffer guard `maketic - 0 >= 5` evaluates true ONLY after the fifth ticcmd is built (the guard runs at the START of the iteration AFTER startTic and processEvents but BEFORE buildTiccmd, so iteration 5 starts with maketic=4, processes startTic+processEvents, then the guard `4 >= 5` is false, builds, increments to 5; iteration 6 starts with maketic=5, the guard `5 >= 5` is TRUE, breaks). Anchors the half-buffer cap at exactly 5.',
  },
  {
    id: 'fresh_clock_six_capped_at_five_by_half_buffer_guard',
    target: 'maketic_after_calls',
    input: { steps: [{ currentClock: 6, gameticFeedback: 0 }] },
    expected: 5,
    note: 'A netUpdate call with currentClock=6 on a fresh candidate (newtics=6) is capped at maketic=5 by the half-buffer guard. Anchors the cap firing at the boundary.',
  },
  {
    id: 'fresh_clock_eleven_capped_at_five_by_half_buffer_guard',
    target: 'maketic_after_calls',
    input: { steps: [{ currentClock: 11, gameticFeedback: 0 }] },
    expected: 5,
    note: 'A netUpdate call with currentClock=11 on a fresh candidate (newtics=11) is capped at maketic=5 by the half-buffer guard. Anchors the cap holding for any newtics value above the threshold.',
  },
  {
    id: 'lasttime_persistence_two_calls_three_then_two',
    target: 'maketic_after_calls',
    input: {
      steps: [
        { currentClock: 3, gameticFeedback: 0 },
        { currentClock: 5, gameticFeedback: 3 },
      ],
    },
    expected: 5,
    note: 'Two consecutive netUpdate calls: first with currentClock=3 builds 3, second with currentClock=5 builds 2 more (newtics=5-3=2). Cumulative maketic = 5. Anchors the canonical static-baseline `lasttime` persistence across calls.',
  },
  {
    id: 'negative_clock_delta_builds_zero',
    target: 'maketic_after_calls',
    input: {
      steps: [
        { currentClock: 5, gameticFeedback: 0 },
        { currentClock: 3, gameticFeedback: 5 },
      ],
    },
    expected: 5,
    note: 'After a first call advances lasttime to 5, a second call with currentClock=3 (negative delta -2) builds zero ticcmds (newtics=-2, short-circuit fires). Cumulative maketic stays at 5. Anchors the canonical `if (newtics <= 0) goto listen;` catching negative deltas.',
  },
  {
    id: 'after_gametic_catchup_half_buffer_guard_releases',
    target: 'maketic_after_calls',
    input: {
      steps: [
        { currentClock: 10, gameticFeedback: 0 },
        { currentClock: 20, gameticFeedback: 5 },
      ],
    },
    expected: 10,
    note: 'First call (currentClock=10, gameticFeedback=0) caps at maketic=5. Second call (currentClock=20, gameticFeedback=5) sees the guard `5 - 5 >= 5` evaluate false on iteration 1 (releases), builds 5 more ticcmds before the guard `10 - 5 >= 5` re-fires. Cumulative maketic = 10. Anchors the live-gameticdiv release of the half-buffer guard.',
  },
  {
    id: 'no_ticker_or_doAdvanceDemo_calls',
    target: 'ticker_call_count_after_calls',
    input: {
      steps: [
        { currentClock: 5, gameticFeedback: 0 },
        { currentClock: 10, gameticFeedback: 5 },
      ],
    },
    expected: 0,
    note: 'Across two netUpdate calls (each building up to 5 ticcmds), the candidate must invoke ZERO ticker callbacks. Anchors the canonical "NetUpdate is build-only" role boundary; the ticker is TryRunTics\'s job.',
  },
] as const;

/**
 * A candidate single-player no-network NetUpdate surface tuple for
 * cross-checking. The tuple captures the canonical NetUpdate body
 * restricted to the single-player ticdup=1 numnodes=1 path: a
 * constructor that returns a fresh instance, plus a per-instance
 * `maketic` getter, a per-instance `lasttime` getter, and a
 * `netUpdate(input, callbacks)` operation that runs the canonical
 * NetUpdate body.
 */
export interface DoomNetUpdateSinglePlayerCandidate {
  /** Factory that returns a fresh instance with maketic=0 and lasttime=0. */
  readonly create: () => DoomNetUpdateSinglePlayerCandidateInstance;
}

/** The single-player NetUpdate surface a candidate must expose. */
export interface DoomNetUpdateSinglePlayerCandidateInstance {
  /**
   * The current maketic value. After a netUpdate call that built K
   * ticcmds, this returns `previous_maketic + K` (where K is bounded
   * by the half-buffer guard).
   */
  readonly maketic: number;
  /**
   * The current lasttime baseline. After a netUpdate call with
   * currentClock=C, this returns C (regardless of whether newtics was
   * positive, zero, or negative).
   */
  readonly lasttime: number;
  /**
   * NetUpdate equivalent. Runs the canonical single-player no-network
   * NetUpdate body:
   *  1. Compute `newtics = input.currentClock - this.lasttime`;
   *     update `this.lasttime = input.currentClock`.
   *  2. If `newtics <= 0`, return immediately (goto listen — no-op
   *     in single-player).
   *  3. (Skiptics consumption — no-op in single-player; modelled
   *     implicitly: `newtics -= skiptics; skiptics = 0;` with
   *     skiptics=0 always.)
   *  4. For each i in [0, newtics):
   *     a. Call `callbacks.startTic()`.
   *     b. Call `callbacks.processEvents()`.
   *     c. If `this.maketic - input.gameticFeedback >= 5`
   *        (BACKUPTICS/2-1 with BACKUPTICS=12), break out of the loop.
   *     d. Call `callbacks.buildTiccmd()`.
   *     e. Increment `this.maketic` by exactly +1.
   *  5. (Singletics early return — observationally equivalent to
   *     running the no-op send phase in single-player.)
   *  6. (Send phase — no-op in single-player numnodes=1.)
   *  7. (Listen phase — no-op in single-player numnodes=1.)
   *
   * The candidate MUST NOT invoke `ticker` or `doAdvanceDemo`
   * callbacks (those are TryRunTics's job, not NetUpdate's).
   */
  netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void;
}

/** Inputs to one netUpdate call. */
export interface NetUpdateCandidateInput {
  /**
   * The current absolute host-clock counter (analogous to vanilla
   * `I_GetTime() / ticdup`, with ticdup=1 in single-player). The
   * candidate computes `newtics = currentClock - lasttime` and
   * updates `lasttime = currentClock`.
   */
  readonly currentClock: number;
  /**
   * The current `gameticdiv` value (analogous to vanilla
   * `gametic / ticdup`, with ticdup=1 in single-player). Drives
   * the half-buffer guard `maketic - gameticFeedback >=
   * BACKUPTICS/2-1`. In a real engine this is read from the live
   * `gametic` global; here it is passed explicitly to make the
   * guard testable in isolation.
   */
  readonly gameticFeedback: number;
}

/** Callbacks invoked by netUpdate during the per-newtic build loop. */
export interface NetUpdateCandidateCallbacks {
  /** I_StartTic equivalent. Pumps host events into the queue. */
  startTic(): void;
  /** D_ProcessEvents equivalent. Drains the queue into responder state. */
  processEvents(): void;
  /** G_BuildTiccmd equivalent. Encodes a ticcmd for slot `maketic % BACKUPTICS`. */
  buildTiccmd(): void;
  /**
   * M_Ticker / G_Ticker equivalent. Should NEVER be invoked by
   * netUpdate (the canonical body has no ticker call sites). Present
   * in the callback bag to detect tampered candidates that mistakenly
   * invoke it.
   */
  ticker(): void;
  /**
   * D_DoAdvanceDemo equivalent. Should NEVER be invoked by netUpdate
   * (the canonical body has no doAdvanceDemo call sites). Present in
   * the callback bag to detect tampered candidates that mistakenly
   * invoke it.
   */
  doAdvanceDemo(): void;
}

/**
 * Single-player no-network NetUpdate implementation.
 *
 * This owns the canonical vanilla build-only path for the local
 * player: persist `lasttime`, build local ticcmds up to the
 * half-buffer guard, and leave ticker/demo advancement to TryRunTics.
 *
 * @example
 * ```ts
 * import { DoomNetUpdateSinglePlayer } from "../src/core/implement-netupdate-no-network-single-player-path.ts";
 * const netUpdate = new DoomNetUpdateSinglePlayer();
 * netUpdate.netUpdate(input, callbacks);
 * ```
 */
export class DoomNetUpdateSinglePlayer implements DoomNetUpdateSinglePlayerCandidateInstance {
  #lasttime = AUDITED_FRESH_LASTTIME;
  #maketic = AUDITED_FRESH_MAKETIC;

  /** Current `lasttime` baseline used to derive the next `newtics` delta. */
  get lasttime(): number {
    return this.#lasttime;
  }

  /** Current local `maketic` count, incremented after each built ticcmd. */
  get maketic(): number {
    return this.#maketic;
  }

  /**
   * Run one single-player no-network NetUpdate pass.
   *
   * @param input Absolute clock and live gametic feedback.
   * @param callbacks Build-loop callbacks matching vanilla call order.
   * @returns Nothing; state is exposed through `maketic` and `lasttime`.
   * @example
   * ```ts
   * const netUpdate = new DoomNetUpdateSinglePlayer();
   * netUpdate.netUpdate({ currentClock: 1, gameticFeedback: 0 }, callbacks);
   * ```
   */
  netUpdate(input: NetUpdateCandidateInput, callbacks: NetUpdateCandidateCallbacks): void {
    const newTicCount = input.currentClock - this.#lasttime;
    this.#lasttime = input.currentClock;
    if (newTicCount <= 0) {
      return;
    }

    for (let newTicIndex = 0; newTicIndex < newTicCount; newTicIndex++) {
      callbacks.startTic();
      callbacks.processEvents();
      if (this.#maketic - input.gameticFeedback >= AUDITED_NETUPDATE_HALF_BUFFER_GUARD) {
        break;
      }
      callbacks.buildTiccmd();
      this.#maketic++;
    }
  }
}

/**
 * Runtime candidate tuple for the focused parity cross-check.
 *
 * @example
 * ```ts
 * import { DOOM_NETUPDATE_SINGLE_PLAYER_CANDIDATE } from "../src/core/implement-netupdate-no-network-single-player-path.ts";
 * const instance = DOOM_NETUPDATE_SINGLE_PLAYER_CANDIDATE.create();
 * ```
 */
export const DOOM_NETUPDATE_SINGLE_PLAYER_CANDIDATE: DoomNetUpdateSinglePlayerCandidate = Object.freeze({
  create: (): DoomNetUpdateSinglePlayer => new DoomNetUpdateSinglePlayer(),
});

/**
 * Cross-check a candidate single-player NetUpdate surface tuple
 * against `DOOM_NETUPDATE_SINGLE_PLAYER_PROBES` and
 * `DOOM_NETUPDATE_SINGLE_PLAYER_INVARIANTS`. Returns the list of
 * failures by stable identifier; an empty list means the candidate
 * honours every audited fact.
 *
 * Identifiers used:
 *  - `probe:<id>` for a per-probe expectation mismatch.
 *  - `invariant:<id>` for a derived invariant that fails on at least
 *    one observation.
 */
export function crossCheckDoomNetUpdateSinglePlayer(candidate: DoomNetUpdateSinglePlayerCandidate): readonly string[] {
  const failures: string[] = [];

  // Per-probe checks
  for (const probe of DOOM_NETUPDATE_SINGLE_PLAYER_PROBES) {
    const instance = candidate.create();
    let startTicCount = 0;
    let processEventsCount = 0;
    let buildTiccmdCount = 0;
    let tickerCount = 0;
    let doAdvanceDemoCount = 0;
    for (const step of probe.input.steps) {
      instance.netUpdate(
        { currentClock: step.currentClock, gameticFeedback: step.gameticFeedback },
        {
          startTic: () => {
            startTicCount++;
          },
          processEvents: () => {
            processEventsCount++;
          },
          buildTiccmd: () => {
            buildTiccmdCount++;
          },
          ticker: () => {
            tickerCount++;
          },
          doAdvanceDemo: () => {
            doAdvanceDemoCount++;
          },
        },
      );
    }
    let actual: number;
    if (probe.target === 'maketic_after_calls') {
      actual = instance.maketic;
    } else if (probe.target === 'startTic_call_count_after_calls') {
      actual = startTicCount;
    } else if (probe.target === 'processEvents_call_count_after_calls') {
      actual = processEventsCount;
    } else if (probe.target === 'buildTiccmd_call_count_after_calls') {
      actual = buildTiccmdCount;
    } else if (probe.target === 'ticker_call_count_after_calls') {
      actual = tickerCount;
    } else {
      actual = doAdvanceDemoCount;
    }
    if (actual !== probe.expected) {
      failures.push(`probe:${probe.id}`);
    }
  }

  // Invariant: fresh instance maketic === 0
  {
    const instance = candidate.create();
    if (instance.maketic !== 0) {
      failures.push('invariant:NETUPDATE_FRESH_INSTANCE_MAKETIC_IS_ZERO');
    }
  }

  // Invariant: fresh instance lasttime === 0
  {
    const instance = candidate.create();
    if (instance.lasttime !== 0) {
      failures.push('invariant:NETUPDATE_FRESH_INSTANCE_LASTTIME_IS_ZERO');
    }
  }

  // Invariant: no clock advance builds no ticcmds
  {
    const instance = candidate.create();
    let buildTiccmdCount = 0;
    let processEventsCount = 0;
    let startTicCount = 0;
    instance.netUpdate(
      { currentClock: 0, gameticFeedback: 0 },
      {
        startTic: () => startTicCount++,
        processEvents: () => processEventsCount++,
        buildTiccmd: () => buildTiccmdCount++,
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    if (instance.maketic !== 0 || startTicCount !== 0 || processEventsCount !== 0 || buildTiccmdCount !== 0) {
      failures.push('invariant:NETUPDATE_NO_CLOCK_ADVANCE_BUILDS_NO_TICCMDS');
    }
  }

  // Invariant: one tic per clock unit below half buffer
  {
    let allClockAdvancesMatch = true;
    for (const clockAdvance of [1, 2, 3, 4]) {
      const instance = candidate.create();
      let buildTiccmdCount = 0;
      instance.netUpdate(
        { currentClock: clockAdvance, gameticFeedback: 0 },
        {
          startTic: () => {},
          processEvents: () => {},
          buildTiccmd: () => buildTiccmdCount++,
          ticker: () => {},
          doAdvanceDemo: () => {},
        },
      );
      if (instance.maketic !== clockAdvance || buildTiccmdCount !== clockAdvance) {
        allClockAdvancesMatch = false;
        break;
      }
    }
    if (!allClockAdvancesMatch) {
      failures.push('invariant:NETUPDATE_ONE_TIC_PER_CLOCK_UNIT_BELOW_HALF_BUFFER');
    }
  }

  // Invariant: half buffer guard caps build at five
  {
    let allGuardCasesMatch = true;
    for (const clockAdvance of [5, 6, 7, 10, 11, 100]) {
      const instance = candidate.create();
      let buildTiccmdCount = 0;
      instance.netUpdate(
        { currentClock: clockAdvance, gameticFeedback: 0 },
        {
          startTic: () => {},
          processEvents: () => {},
          buildTiccmd: () => buildTiccmdCount++,
          ticker: () => {},
          doAdvanceDemo: () => {},
        },
      );
      if (instance.maketic !== 5 || buildTiccmdCount !== 5) {
        allGuardCasesMatch = false;
        break;
      }
    }
    if (!allGuardCasesMatch) {
      failures.push('invariant:NETUPDATE_HALF_BUFFER_GUARD_CAPS_BUILD_AT_FIVE');
    }
  }

  // Invariant: per-iteration callback order startTic / processEvents / buildTiccmd
  {
    const instance = candidate.create();
    const events: string[] = [];
    instance.netUpdate(
      { currentClock: 3, gameticFeedback: 0 },
      {
        startTic: () => events.push('startTic'),
        processEvents: () => events.push('processEvents'),
        buildTiccmd: () => events.push('buildTiccmd'),
        ticker: () => events.push('ticker'),
        doAdvanceDemo: () => events.push('doAdvanceDemo'),
      },
    );
    let orderMatches = events.length === 9;
    if (orderMatches) {
      const expected = ['startTic', 'processEvents', 'buildTiccmd', 'startTic', 'processEvents', 'buildTiccmd', 'startTic', 'processEvents', 'buildTiccmd'];
      for (let eventIndex = 0; eventIndex < expected.length; eventIndex++) {
        if (events[eventIndex] !== expected[eventIndex]) {
          orderMatches = false;
          break;
        }
      }
    }
    if (!orderMatches) {
      failures.push('invariant:NETUPDATE_PER_ITERATION_CALLBACK_ORDER_STARTTIC_PROCESS_BUILD');
    }
  }

  // Invariant: lasttime persists across calls
  {
    const instance = candidate.create();
    instance.netUpdate(
      { currentClock: 3, gameticFeedback: 0 },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    let lasttimePersists = instance.lasttime === 3;
    if (lasttimePersists) {
      let secondCallBuilds = 0;
      instance.netUpdate(
        { currentClock: 5, gameticFeedback: 3 },
        {
          startTic: () => {},
          processEvents: () => {},
          buildTiccmd: () => secondCallBuilds++,
          ticker: () => {},
          doAdvanceDemo: () => {},
        },
      );
      lasttimePersists = secondCallBuilds === 2 && instance.lasttime === 5 && instance.maketic === 5;
    }
    if (!lasttimePersists) {
      failures.push('invariant:NETUPDATE_LASTTIME_PERSISTS_ACROSS_CALLS');
    }
  }

  // Invariant: does not invoke ticker callbacks
  {
    const instance = candidate.create();
    let tickerCount = 0;
    instance.netUpdate(
      { currentClock: 5, gameticFeedback: 0 },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => tickerCount++,
        doAdvanceDemo: () => {},
      },
    );
    if (tickerCount !== 0) {
      failures.push('invariant:NETUPDATE_DOES_NOT_INVOKE_TICKER_CALLBACKS');
    }
  }

  // Invariant: does not invoke doAdvanceDemo callbacks
  {
    const instance = candidate.create();
    let doAdvanceDemoCount = 0;
    instance.netUpdate(
      { currentClock: 5, gameticFeedback: 0 },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => doAdvanceDemoCount++,
      },
    );
    if (doAdvanceDemoCount !== 0) {
      failures.push('invariant:NETUPDATE_DOES_NOT_INVOKE_DOADVANCEDEMO_CALLBACK');
    }
  }

  // Invariant: maketic never decrements
  {
    const instance = candidate.create();
    const observed: number[] = [];
    observed.push(instance.maketic);
    for (const currentClock of [3, 5, 5, 8, 10]) {
      instance.netUpdate(
        { currentClock, gameticFeedback: instance.maketic },
        {
          startTic: () => {},
          processEvents: () => {},
          buildTiccmd: () => {},
          ticker: () => {},
          doAdvanceDemo: () => {},
        },
      );
      observed.push(instance.maketic);
    }
    let neverDecrements = true;
    for (let observedIndex = 1; observedIndex < observed.length; observedIndex++) {
      if (observed[observedIndex] < observed[observedIndex - 1]) {
        neverDecrements = false;
        break;
      }
    }
    if (!neverDecrements) {
      failures.push('invariant:NETUPDATE_MAKETIC_NEVER_DECREMENTS');
    }
  }

  // Invariant: two instances are independent
  {
    const firstInstance = candidate.create();
    const secondInstance = candidate.create();
    firstInstance.netUpdate(
      { currentClock: 5, gameticFeedback: 0 },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    if (firstInstance.maketic !== 5 || firstInstance.lasttime !== 5 || secondInstance.maketic !== 0 || secondInstance.lasttime !== 0) {
      failures.push('invariant:NETUPDATE_TWO_INSTANCES_ARE_INDEPENDENT');
    }
  }

  // Invariant: lasttime updated even on short-circuit
  {
    const instance = candidate.create();
    // First call advances lasttime to 5
    instance.netUpdate(
      { currentClock: 5, gameticFeedback: 0 },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    // Second call with currentClock=3 has newtics=-2, short-circuits.
    // The canonical body still updates lasttime to 3 BEFORE the short-circuit.
    instance.netUpdate(
      { currentClock: 3, gameticFeedback: instance.maketic },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    if (instance.lasttime !== 3) {
      failures.push('invariant:NETUPDATE_LASTTIME_UPDATED_EVEN_ON_SHORT_CIRCUIT');
    }
  }

  // Invariant: back-to-back calls accumulate maketic
  {
    const instance = candidate.create();
    instance.netUpdate(
      { currentClock: 3, gameticFeedback: 0 },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    instance.netUpdate(
      { currentClock: 5, gameticFeedback: 3 },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    if (instance.maketic !== 5) {
      failures.push('invariant:NETUPDATE_BACK_TO_BACK_CALLS_ACCUMULATE_MAKETIC');
    }
  }

  // Invariant: newtics negative delta builds no ticcmds
  {
    const instance = candidate.create();
    instance.netUpdate(
      { currentClock: 5, gameticFeedback: 0 },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    const maketicAfterFirst = instance.maketic;
    let secondCallBuilds = 0;
    instance.netUpdate(
      { currentClock: 3, gameticFeedback: maketicAfterFirst },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => secondCallBuilds++,
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    if (secondCallBuilds !== 0 || instance.maketic !== maketicAfterFirst) {
      failures.push('invariant:NETUPDATE_NEWTICS_NEGATIVE_DELTA_BUILDS_NO_TICCMDS');
    }
  }

  // Invariant: gametic feedback releases the half-buffer guard
  {
    const instance = candidate.create();
    instance.netUpdate(
      { currentClock: 10, gameticFeedback: 0 },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    const cappedMaketic = instance.maketic;
    instance.netUpdate(
      { currentClock: 20, gameticFeedback: cappedMaketic },
      {
        startTic: () => {},
        processEvents: () => {},
        buildTiccmd: () => {},
        ticker: () => {},
        doAdvanceDemo: () => {},
      },
    );
    if (cappedMaketic !== 5 || instance.maketic !== 10) {
      failures.push('invariant:NETUPDATE_GAMETIC_FEEDBACK_RELEASES_HALF_BUFFER_GUARD');
    }
  }

  return failures;
}
