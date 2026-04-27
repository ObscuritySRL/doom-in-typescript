/**
 * Audit ledger for the vanilla DOOM 1.9 clean-quit and ENDOOM policy
 * pinned against id Software's `linuxdoom-1.10/i_system.c`. The
 * accompanying focused test cross-checks every audited contract clause
 * against a self-contained reference handler that walks the canonical
 * `I_Quit` and `I_Error` cleanup sequences the same way vanilla does.
 *
 * The canonical vanilla DOOM 1.9 `I_Quit` function in
 * `linuxdoom-1.10/i_system.c` fires exactly five operations in this
 * verbatim order:
 *
 *   1. `D_QuitNetGame ();` — disconnect net game (calls
 *      `NetSendQuit`/`NetCleanup` in the net layer).
 *   2. `G_CheckDemoStatus ();` — finalize demo recording (writes the
 *      tail bytes via `M_WriteFile`) or end demo playback (frees the
 *      replay buffer).
 *   3. `M_SaveDefaults ();` — save config to `default.cfg` via the
 *      pinned defaults table.
 *   4. `I_ShutdownGraphics ();` — restore VGA text mode (DOS) or shut
 *      down the X11 window (linuxdoom-1.10).
 *   5. `exit (0);` — process termination with success code 0.
 *
 * The canonical vanilla DOOM 1.9 `I_Error` function in
 * `linuxdoom-1.10/i_system.c` fires this sequence after building the
 * error message:
 *
 *   1. (stderr prologue) `va_start (argptr,error);` then four prints:
 *      `fprintf (stderr, "Error: ");`, `vfprintf (stderr,error,argptr);`,
 *      `fprintf (stderr, "\n");`, `va_end (argptr);`, `fflush (stderr);`.
 *   2. `if (demorecording) G_CheckDemoStatus();` — gated cleanup that
 *      only fires when demo recording was active.
 *   3. `D_QuitNetGame ();` — disconnect net game.
 *   4. `I_ShutdownGraphics ();` — restore VGA text mode (DOS) or shut
 *      down the X11 window (linuxdoom-1.10).
 *   5. `exit (-1);` — process termination with error code -1.
 *
 * Critical differences between `I_Quit` and `I_Error` in vanilla 1.9:
 *   - `I_Error` does NOT call `M_SaveDefaults` (no config save on
 *     error — the defaults table is potentially in an inconsistent
 *     state when an error fires, so vanilla intentionally skips the
 *     save).
 *   - `I_Error` gates `G_CheckDemoStatus` on the `demorecording` flag.
 *     `I_Quit` always calls `G_CheckDemoStatus` (which internally
 *     checks `demorecording`/`demoplayback`).
 *   - `I_Error` exits with `-1`; `I_Quit` exits with `0`.
 *   - `I_Error` performs a stderr prologue with a verbatim `"Error: "`
 *     prefix and trailing `"\n"`; `I_Quit` has no stderr side-effect.
 *
 * Vanilla 1.9 (linuxdoom-1.10) has NO ENDOOM display:
 *   - No `D_Endoom` function in `d_main.c` or anywhere else in the
 *     source tree.
 *   - No `I_Endoom` function in `i_video.c` or anywhere else.
 *   - Neither `I_Quit` nor `I_Error` reads the ENDOOM lump or writes
 *     it to text-mode video memory.
 *   - The ENDOOM lump is present in the IWAD (`DOOM1.WAD` and the
 *     retail IWADs) but linuxdoom-1.10 never reads it because the
 *     Linux X11 host has no DOS text-mode buffer to display it in.
 *
 * The DOS DOOM 1.9 binary (`doom/DOOMD.EXE` and `doom/DOOM.EXE`) does
 * display ENDOOM after `I_ShutdownGraphics` restores text mode and
 * before `exit` returns control to DOS. The DOS-specific behavior is
 * pinned against authority 1 (the local DOS binary observation under
 * DOSBox) but is not visible in the linuxdoom-1.10 source we treat as
 * authority 4. A future oracle-capture step targeting `doom/DOOMD.EXE`
 * can pin the exact ENDOOM display semantics; this audit pins the
 * structural ENDOOM lump facts plus the linuxdoom-source absence of
 * any ENDOOM machinery, and lists the DOS display position relative
 * to `I_ShutdownGraphics` as an oracle-capture follow-up.
 *
 * Chocolate Doom 2.2.1 deliberately diverges from vanilla 1.9 at the
 * clean-quit boundary in eight specific ways:
 *
 *   - `I_AtExit` registration stack: Chocolate maintains a singly-
 *     linked list of `(func, run_on_error)` pairs that grows during
 *     init via prepend; vanilla 1.9 has no such list and inlines the
 *     5-step `I_Quit` body verbatim.
 *   - LIFO traversal: Chocolate walks the prepended list head-to-tail
 *     to achieve LIFO order; vanilla has nothing to traverse.
 *   - `run_on_error` filter: Chocolate's `I_Error` skips handlers
 *     whose `run_on_error` is false; vanilla 1.9 has no per-handler
 *     gate (only the explicit `if (demorecording)` gate around
 *     `G_CheckDemoStatus`).
 *   - `D_Endoom` registration: Chocolate registers `D_Endoom` (which
 *     reads ENDOOM and calls `I_Endoom`) via `I_AtExit`; vanilla 1.9
 *     has no `D_Endoom` function at all.
 *   - `I_Endoom` host helper: Chocolate's `i_endoom.c` provides a
 *     dedicated host helper that writes the lump bytes to a text-mode
 *     surface; vanilla 1.9 has no equivalent helper.
 *   - `S_Shutdown` handler: Chocolate registers `S_Shutdown` via
 *     `I_AtExit`; vanilla 1.9 has no sound-subsystem shutdown call in
 *     the `I_Quit` sequence.
 *   - `I_ShutdownSound` / `I_ShutdownMusic` handlers: Chocolate
 *     registers these separately; vanilla 1.9 has no audio host
 *     shutdown calls in `I_Quit`.
 *   - `I_ShutdownTimer` handler: Chocolate registers
 *     `I_ShutdownTimer`; vanilla 1.9 has no timer-shutdown call in
 *     `I_Quit`.
 *   - Recursive-call sentinel: Chocolate guards `I_Error` against
 *     re-entry via a static `already_quitting` boolean; vanilla 1.9
 *     has no such guard (an error inside cleanup loops back into
 *     `I_Error`).
 *
 * No runtime quit skeleton drives the `bun run doom.ts` entrypoint
 * yet — `src/bootstrap/quitFlow.ts` models the Chocolate-shaped
 * `QuitFlow` (with `I_AtExit` registration stack, `runOnError` filter,
 * and 8-handler LIFO traversal) that is NOT the vanilla 1.9 contract.
 * This step pins the vanilla-1.9-only clean-quit and ENDOOM policy so
 * a later implementation step (or an oracle follow-up that observes
 * `doom/DOOMD.EXE` directly) can be cross-checked for parity. The
 * audit module deliberately avoids importing from any runtime quit
 * module so that a corrupted runtime cannot silently calibrate the
 * audit's own probe table.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the `I_Quit`
 *      and `I_Error` 5-step and 4-step cleanup sequences in
 *      `i_system.c` and the structural absence of any `D_Endoom` /
 *      `I_Endoom` function in `d_main.c` / `i_video.c`),
 *   5. Chocolate Doom 2.2.1 source (counterexample for the eight
 *      Chocolate-only divergences listed above).
 *
 * The audit invariants below are pinned against authority 4 because
 * the 5-step / 4-step cleanup contract is a textual property of the
 * C source — `linuxdoom-1.10/i_system.c` has the verbatim sequences
 * with no preprocessor branching that could hide alternate orderings.
 * Authority 1 (the DOS binary) cannot disagree because the cleanup
 * sequence is the visible pre-condition every vanilla shutdown path
 * produces. The structural ENDOOM lump facts (4000 bytes, 80x25 cells,
 * 2 bytes per cell) are pinned against authority 2 (the IWAD) and
 * cross-validated against the existing `src/ui/endoom.ts` parser
 * constants, but the audit module does not import from that runtime
 * file to preserve isolation.
 */

/**
 * Phase classification of one vanilla `I_Quit` / `I_Error` cleanup
 * step.
 *
 * - `quit-cleanup` covers the four cleanup calls in `I_Quit`
 *   (`D_QuitNetGame`, `G_CheckDemoStatus`, `M_SaveDefaults`,
 *   `I_ShutdownGraphics`).
 * - `quit-termination` covers the final `exit(0)` call in `I_Quit`.
 * - `error-prologue` covers the stderr-prologue prints in `I_Error`
 *   that build and emit the formatted error message.
 * - `error-cleanup` covers the three cleanup calls in `I_Error` after
 *   the prologue (`G_CheckDemoStatus` gated on `demorecording`,
 *   `D_QuitNetGame`, `I_ShutdownGraphics`).
 * - `error-termination` covers the final `exit(-1)` call in `I_Error`.
 */
export type VanillaCleanupPhase = 'quit-cleanup' | 'quit-termination' | 'error-prologue' | 'error-cleanup' | 'error-termination';

/**
 * Discriminator of the C-source-level condition that gates a vanilla
 * cleanup step.
 *
 * - `always` matches an unconditional call.
 * - `demorecording-flag-set` matches the `if (demorecording)` gate
 *   around `G_CheckDemoStatus` inside `I_Error`.
 */
export type VanillaCleanupCondition = 'always' | 'demorecording-flag-set';

/**
 * Verbatim C symbol of a vanilla DOOM 1.9 cleanup step.
 *
 * The five `I_Quit` ops and the four `I_Error` cleanup ops draw from
 * a small fixed alphabet of canonical vanilla function names. The
 * `exit-zero` and `exit-minus-one` discriminators distinguish the two
 * exit-code variants (the `exit()` library call name is the same).
 */
export type VanillaCleanupOpName =
  | 'D_QuitNetGame'
  | 'G_CheckDemoStatus'
  | 'M_SaveDefaults'
  | 'I_ShutdownGraphics'
  | 'exit-zero'
  | 'exit-minus-one'
  | 'fprintf-error-prefix'
  | 'vfprintf-error-message'
  | 'fprintf-trailing-newline'
  | 'fflush-stderr';

/**
 * One ordered step in either the canonical `I_Quit` 5-step sequence or
 * the canonical `I_Error` (prologue + cleanup + termination) sequence.
 */
export interface VanillaCleanupStep {
  /** 0-based index in the relevant canonical sequence. */
  readonly index: number;
  /** Verbatim C symbol or discriminator name. */
  readonly opName: VanillaCleanupOpName;
  /** Condition under which the step fires. */
  readonly condition: VanillaCleanupCondition;
  /** Phase classification. */
  readonly phase: VanillaCleanupPhase;
}

/** Verbatim canonical exit code returned by vanilla `I_Quit` (`exit(0)`). */
export const VANILLA_I_QUIT_EXIT_CODE = 0;

/** Verbatim canonical exit code returned by vanilla `I_Error` (`exit(-1)`). */
export const VANILLA_I_ERROR_EXIT_CODE = -1;

/** Verbatim stderr prefix emitted by `I_Error` (`fprintf(stderr,"Error: ")`). */
export const VANILLA_I_ERROR_STDERR_PREFIX = 'Error: ';

/** Verbatim trailing newline emitted by `I_Error` after the formatted message. */
export const VANILLA_I_ERROR_STDERR_TRAILING_NEWLINE = '\n';

/** Total number of cleanup operations in the canonical `I_Quit` body (D_QuitNetGame → G_CheckDemoStatus → M_SaveDefaults → I_ShutdownGraphics → exit). */
export const VANILLA_I_QUIT_TOTAL_STEP_COUNT = 5;

/** Total number of cleanup operations in `I_Quit` excluding the `exit(0)` termination (4 cleanup calls). */
export const VANILLA_I_QUIT_CLEANUP_OP_COUNT = 4;

/** Total number of cleanup operations in the canonical `I_Error` body excluding the prologue prints and the `exit(-1)` termination (G_CheckDemoStatus, D_QuitNetGame, I_ShutdownGraphics). */
export const VANILLA_I_ERROR_CLEANUP_OP_COUNT = 3;

/** Total number of stderr prologue prints inside `I_Error` before the cleanup phase begins (Error: prefix, vfprintf body, trailing newline, fflush). */
export const VANILLA_I_ERROR_PROLOGUE_OP_COUNT = 4;

/**
 * Frozen canonical 5-step `I_Quit` sequence pinned by vanilla DOOM 1.9
 * `linuxdoom-1.10/i_system.c`. The first four ops are unconditional
 * cleanup calls in the verbatim order
 * `D_QuitNetGame → G_CheckDemoStatus → M_SaveDefaults → I_ShutdownGraphics`;
 * the fifth op is the unconditional `exit(0)` termination.
 */
export const VANILLA_I_QUIT_ORDER: readonly VanillaCleanupStep[] = Object.freeze([
  Object.freeze({ index: 0, opName: 'D_QuitNetGame', condition: 'always', phase: 'quit-cleanup' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 1, opName: 'G_CheckDemoStatus', condition: 'always', phase: 'quit-cleanup' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 2, opName: 'M_SaveDefaults', condition: 'always', phase: 'quit-cleanup' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 3, opName: 'I_ShutdownGraphics', condition: 'always', phase: 'quit-cleanup' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 4, opName: 'exit-zero', condition: 'always', phase: 'quit-termination' } satisfies VanillaCleanupStep),
]);

/**
 * Frozen canonical 4-step `I_Error` cleanup sequence (after the
 * prologue prints) pinned by vanilla DOOM 1.9
 * `linuxdoom-1.10/i_system.c`. The first cleanup call is gated on
 * `demorecording`; the remaining two cleanup calls are unconditional;
 * the fourth op is the unconditional `exit(-1)` termination.
 *
 * NOTE: This array does NOT contain the four prologue ops
 * (`fprintf-error-prefix`, `vfprintf-error-message`,
 * `fprintf-trailing-newline`, `fflush-stderr`); those are pinned by
 * `VANILLA_I_ERROR_PROLOGUE_ORDER` separately so the cleanup ordering
 * can be queried independently of the prologue ordering.
 */
export const VANILLA_I_ERROR_CLEANUP_ORDER: readonly VanillaCleanupStep[] = Object.freeze([
  Object.freeze({ index: 0, opName: 'G_CheckDemoStatus', condition: 'demorecording-flag-set', phase: 'error-cleanup' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 1, opName: 'D_QuitNetGame', condition: 'always', phase: 'error-cleanup' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 2, opName: 'I_ShutdownGraphics', condition: 'always', phase: 'error-cleanup' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 3, opName: 'exit-minus-one', condition: 'always', phase: 'error-termination' } satisfies VanillaCleanupStep),
]);

/**
 * Frozen canonical 4-step `I_Error` prologue sequence pinned by
 * vanilla DOOM 1.9 `linuxdoom-1.10/i_system.c`. The four prologue
 * ops fire unconditionally before the cleanup phase begins, in the
 * verbatim order
 * `fprintf("Error: ") → vfprintf(error,argptr) → fprintf("\n") → fflush(stderr)`.
 */
export const VANILLA_I_ERROR_PROLOGUE_ORDER: readonly VanillaCleanupStep[] = Object.freeze([
  Object.freeze({ index: 0, opName: 'fprintf-error-prefix', condition: 'always', phase: 'error-prologue' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 1, opName: 'vfprintf-error-message', condition: 'always', phase: 'error-prologue' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 2, opName: 'fprintf-trailing-newline', condition: 'always', phase: 'error-prologue' } satisfies VanillaCleanupStep),
  Object.freeze({ index: 3, opName: 'fflush-stderr', condition: 'always', phase: 'error-prologue' } satisfies VanillaCleanupStep),
]);

/** Verbatim canonical lump name read by the DOS DOOM 1.9 binary at quit time (and by Chocolate Doom 2.2.1 `D_Endoom`). */
export const VANILLA_ENDOOM_LUMP_NAME = 'ENDOOM';

/** Verbatim total byte count of the ENDOOM lump (80 columns × 25 rows × 2 bytes/cell). */
export const VANILLA_ENDOOM_LUMP_SIZE_BYTES = 4000;

/** Verbatim ENDOOM grid column count (the canonical VGA text-mode column width). */
export const VANILLA_ENDOOM_GRID_COLUMNS = 80;

/** Verbatim ENDOOM grid row count (the canonical VGA text-mode row count). */
export const VANILLA_ENDOOM_GRID_ROWS = 25;

/** Verbatim ENDOOM bytes-per-cell count (one CP437 character byte plus one VGA attribute byte). */
export const VANILLA_ENDOOM_BYTES_PER_CELL = 2;

/** Verbatim ENDOOM total cell count (80 × 25 = 2000 cells). */
export const VANILLA_ENDOOM_CELL_COUNT = 2000;

/**
 * Whether the vanilla DOOM 1.9 `linuxdoom-1.10` source contains a
 * `D_Endoom` function. It does not — `D_Endoom` is a Chocolate Doom
 * 2.2.1 addition (`src/d_main.c`). Any handler that reports `true`
 * for this is a parity violation against the linuxdoom-1.10 source.
 */
export const VANILLA_LINUXDOOM_HAS_D_ENDOOM_FUNCTION = false;

/**
 * Whether the vanilla DOOM 1.9 `linuxdoom-1.10` source contains an
 * `I_Endoom` function. It does not — `I_Endoom` is a Chocolate Doom
 * 2.2.1 addition (`src/i_endoom.c`).
 */
export const VANILLA_LINUXDOOM_HAS_I_ENDOOM_FUNCTION = false;

/**
 * Whether the vanilla DOOM 1.9 `linuxdoom-1.10` source contains an
 * `I_AtExit` registration stack. It does not — `I_AtExit` is a
 * Chocolate Doom 2.2.1 addition (`src/i_system.c`); vanilla inlines
 * the cleanup body of `I_Quit` verbatim.
 */
export const VANILLA_LINUXDOOM_HAS_I_ATEXIT_STACK = false;

/**
 * Whether vanilla `I_Error` contains a recursive-call guard sentinel
 * (Chocolate Doom 2.2.1's `already_quitting` static boolean). It does
 * not — vanilla `I_Error` has no re-entry protection.
 */
export const VANILLA_I_ERROR_HAS_RECURSIVE_GUARD = false;

/**
 * Verbatim list of cleanup-stage features present in Chocolate Doom
 * 2.2.1 but ABSENT from vanilla DOOM 1.9 `linuxdoom-1.10`. A vanilla-
 * 1.9 handler must report `false` for "is this feature present in the
 * cleanup machinery?" for every entry in this list.
 *
 * The eight Chocolate-only cleanup-stage features are:
 *
 *   - `I_AtExit` — Chocolate's `(func, run_on_error)` registration
 *     stack used to build the cleanup linked list.
 *   - `lifoTraversal` — Chocolate's head-to-tail walk of the
 *     prepended `exit_funcs` list that yields LIFO execution order.
 *   - `runOnErrorFilter` — Chocolate's per-handler boolean gate that
 *     skips handlers whose `run_on_error` is false on the error path.
 *   - `D_Endoom` — Chocolate's `D_Endoom` function in `d_main.c` that
 *     reads the ENDOOM lump and dispatches to `I_Endoom`.
 *   - `I_Endoom` — Chocolate's `I_Endoom` host helper in
 *     `i_endoom.c` that writes the lump bytes to a text-mode surface.
 *   - `S_Shutdown` — Chocolate's sound-subsystem shutdown call
 *     registered via `I_AtExit` during `S_Init`.
 *   - `I_ShutdownTimer` — Chocolate's timer-shutdown call registered
 *     via `I_AtExit` during `I_InitTimer`.
 *   - `recursiveCallGuard` — Chocolate's `already_quitting` static
 *     boolean inside `I_Error` that short-circuits re-entry.
 *
 * The list excludes `I_ShutdownSound` and `I_ShutdownMusic` because
 * those are nested inside `S_Shutdown` (which is itself absent), so
 * a single absence of `S_Shutdown` covers them implicitly. The
 * `runOnErrorFilter` entry is distinct from the cleanup ordering: it
 * is a per-handler boolean filter, not an ordering rule.
 */
export const VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURES: readonly string[] = Object.freeze(['I_AtExit', 'lifoTraversal', 'runOnErrorFilter', 'D_Endoom', 'I_Endoom', 'S_Shutdown', 'I_ShutdownTimer', 'recursiveCallGuard']);

/** Number of Chocolate-only quit-stage features absent from the vanilla 1.9 cleanup machinery. */
export const VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURE_COUNT = 8;

/**
 * One audited contract invariant of the vanilla DOOM 1.9 clean-quit
 * and ENDOOM policy.
 */
export interface VanillaCleanQuitAndEndoomPolicyContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'I_QUIT_HAS_FIVE_OPERATIONS'
    | 'I_QUIT_FIRST_OP_IS_D_QUITNETGAME'
    | 'I_QUIT_SECOND_OP_IS_G_CHECKDEMOSTATUS'
    | 'I_QUIT_THIRD_OP_IS_M_SAVEDEFAULTS'
    | 'I_QUIT_FOURTH_OP_IS_I_SHUTDOWNGRAPHICS'
    | 'I_QUIT_FIFTH_OP_IS_EXIT_ZERO'
    | 'I_QUIT_EXIT_CODE_IS_ZERO'
    | 'I_QUIT_ALL_CLEANUP_OPS_ARE_UNCONDITIONAL'
    | 'I_ERROR_HAS_FOUR_PROLOGUE_PRINTS'
    | 'I_ERROR_PROLOGUE_PREFIX_IS_ERROR_COLON_SPACE'
    | 'I_ERROR_PROLOGUE_TRAILING_IS_NEWLINE'
    | 'I_ERROR_FFLUSH_STDERR_PRECEDES_CLEANUP'
    | 'I_ERROR_HAS_FOUR_CLEANUP_OPERATIONS'
    | 'I_ERROR_FIRST_CLEANUP_IS_DEMORECORDING_GATED_G_CHECKDEMOSTATUS'
    | 'I_ERROR_SECOND_CLEANUP_IS_D_QUITNETGAME'
    | 'I_ERROR_THIRD_CLEANUP_IS_I_SHUTDOWNGRAPHICS'
    | 'I_ERROR_FOURTH_CLEANUP_IS_EXIT_MINUS_ONE'
    | 'I_ERROR_EXIT_CODE_IS_MINUS_ONE'
    | 'I_ERROR_OMITS_M_SAVEDEFAULTS'
    | 'I_ERROR_HAS_NO_RECURSIVE_GUARD_SENTINEL'
    | 'LINUXDOOM_OMITS_D_ENDOOM_FUNCTION'
    | 'LINUXDOOM_OMITS_I_ENDOOM_FUNCTION'
    | 'LINUXDOOM_OMITS_I_ATEXIT_REGISTRATION_STACK'
    | 'ENDOOM_LUMP_NAME_IS_ENDOOM'
    | 'ENDOOM_LUMP_SIZE_IS_FOUR_THOUSAND_BYTES'
    | 'ENDOOM_GRID_IS_EIGHTY_BY_TWENTY_FIVE_CELLS'
    | 'ENDOOM_BYTES_PER_CELL_IS_TWO'
    | 'QUIT_OMITS_S_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE'
    | 'QUIT_OMITS_I_SHUTDOWNTIMER_PRESENT_ONLY_IN_CHOCOLATE'
    | 'QUIT_OMITS_LIFO_TRAVERSAL_PRESENT_ONLY_IN_CHOCOLATE'
    | 'QUIT_OMITS_RUN_ON_ERROR_FILTER_PRESENT_ONLY_IN_CHOCOLATE';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'i_system.c' | 'd_main.c' | 'i_video.c' | 'DOOM1.WAD';
  /** Verbatim C symbol or lump name the contract clause is pinned to. */
  readonly cSymbol: 'I_Quit' | 'I_Error' | 'D_Endoom' | 'I_Endoom' | 'I_AtExit' | 'ENDOOM';
}

/**
 * Pinned ledger of every contract clause of the vanilla DOOM 1.9
 * clean-quit and ENDOOM policy.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_AUDIT: readonly VanillaCleanQuitAndEndoomPolicyContractAuditEntry[] = [
  {
    id: 'I_QUIT_HAS_FIVE_OPERATIONS',
    invariant:
      'Vanilla DOOM 1.9 `I_Quit` performs exactly five operations in the verbatim order `D_QuitNetGame → G_CheckDemoStatus → M_SaveDefaults → I_ShutdownGraphics → exit(0)`. Adding a sixth op (e.g., a Chocolate-Doom-2.2.1-style `S_Shutdown`, `I_ShutdownSound`, `I_ShutdownMusic`, `I_ShutdownTimer`, or `D_Endoom` call) is a parity violation; removing any of the five is also a parity violation. The count is five and only five.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'I_QUIT_FIRST_OP_IS_D_QUITNETGAME',
    invariant:
      'The first op in vanilla `I_Quit` is `D_QuitNetGame()` (calls into the net layer to send a `NETPACKET_QUIT` packet and free per-player buffers). The call is unconditional — there is no `if (netgame)` gate around it; vanilla calls `D_QuitNetGame` even in single-player so the net layer can perform a no-op cleanup pass.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'I_QUIT_SECOND_OP_IS_G_CHECKDEMOSTATUS',
    invariant:
      'The second op in vanilla `I_Quit` is `G_CheckDemoStatus()` (finalizes demo recording by writing the trailing bytes via `M_WriteFile`, or ends demo playback by freeing the replay buffer). The call is unconditional; the demo-state branching happens inside `G_CheckDemoStatus` itself based on the `demorecording` and `demoplayback` flags.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'I_QUIT_THIRD_OP_IS_M_SAVEDEFAULTS',
    invariant:
      'The third op in vanilla `I_Quit` is `M_SaveDefaults()` (serializes the runtime defaults table to `default.cfg`). The call is unconditional and fires on every clean exit. Crucially, `M_SaveDefaults` is NOT called by `I_Error` — vanilla intentionally skips the config save on the error path because the defaults table may be in an inconsistent state when an error fires.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'I_QUIT_FOURTH_OP_IS_I_SHUTDOWNGRAPHICS',
    invariant:
      'The fourth op in vanilla `I_Quit` is `I_ShutdownGraphics()` (restores VGA text mode in DOS or shuts down the X11 window in linuxdoom-1.10). The call is unconditional and must precede the final `exit(0)` so DOS DOOM 1.9 can paint the ENDOOM lump to the restored text-mode buffer before the process terminates.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'I_QUIT_FIFTH_OP_IS_EXIT_ZERO',
    invariant: 'The fifth and final op in vanilla `I_Quit` is the unconditional `exit(0)` library call. The exit code is zero (success). Any handler that reports a non-zero exit code from `I_Quit` is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'I_QUIT_EXIT_CODE_IS_ZERO',
    invariant:
      'Vanilla `I_Quit` terminates the process with exit code 0 (success). The C source literal is `exit(0)` — not `exit(EXIT_SUCCESS)`, not `_exit(0)`, not `exit(1)`. A handler that reports a different exit code is a parity violation against the canonical vanilla success semantics.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'I_QUIT_ALL_CLEANUP_OPS_ARE_UNCONDITIONAL',
    invariant:
      'All four cleanup ops in vanilla `I_Quit` (`D_QuitNetGame`, `G_CheckDemoStatus`, `M_SaveDefaults`, `I_ShutdownGraphics`) fire unconditionally — there is no `if (...)` gate around any of them inside `I_Quit`. Internal sub-branching (e.g., `G_CheckDemoStatus` checking `demorecording` internally) does not change the unconditional nature of the call from `I_Quit`. A handler that gates any cleanup op on a flag is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'I_ERROR_HAS_FOUR_PROLOGUE_PRINTS',
    invariant:
      'Vanilla `I_Error` performs exactly four stderr-prologue operations before the cleanup phase begins, in this verbatim order: (1) `fprintf(stderr, "Error: ")`, (2) `vfprintf(stderr, error, argptr)`, (3) `fprintf(stderr, "\\n")`, (4) `fflush(stderr)`. The `va_start`/`va_end` macros bracket the prints but are not themselves runtime ops — only the four print/flush calls are observable.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_PROLOGUE_PREFIX_IS_ERROR_COLON_SPACE',
    invariant:
      'The first stderr-prologue print in vanilla `I_Error` emits the verbatim literal `"Error: "` (capitalised "E", lowercase "rror", colon, single space, no trailing punctuation). A handler that emits `"error: "` (lowercase), `"ERROR: "` (uppercase), `"Error: "` with a different trailing whitespace, or any other prefix is a parity violation against the vanilla stderr fingerprint.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_PROLOGUE_TRAILING_IS_NEWLINE',
    invariant:
      'After the formatted error message is emitted via `vfprintf`, vanilla `I_Error` emits a verbatim trailing `"\\n"` newline literal via `fprintf(stderr, "\\n")`. The trailing newline is a single LF (`0x0A`); on DOS the CRT may translate to CR/LF on output but the source literal is `"\\n"`.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_FFLUSH_STDERR_PRECEDES_CLEANUP',
    invariant:
      'Vanilla `I_Error` flushes stderr via `fflush(stderr)` after the trailing newline and before the cleanup phase begins. This ordering guarantees that the formatted error message is observable on stderr even if a subsequent cleanup call (e.g., `I_ShutdownGraphics`) crashes — without the flush, the error message could be buffered indefinitely in the stdio layer. A handler that places `fflush(stderr)` after any cleanup op is a parity violation against the vanilla stderr-visibility guarantee.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_HAS_FOUR_CLEANUP_OPERATIONS',
    invariant:
      'Vanilla `I_Error` performs exactly four cleanup operations after the stderr prologue, in this verbatim order: (1) `if (demorecording) G_CheckDemoStatus();`, (2) `D_QuitNetGame()`, (3) `I_ShutdownGraphics()`, (4) `exit(-1)`. The cleanup count is four (three calls plus the termination); adding `M_SaveDefaults` (vanilla intentionally omits it from `I_Error`) or any other Chocolate-only handler is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_FIRST_CLEANUP_IS_DEMORECORDING_GATED_G_CHECKDEMOSTATUS',
    invariant:
      'The first cleanup op in vanilla `I_Error` is `G_CheckDemoStatus()`, gated by the `demorecording` flag (`if (demorecording) G_CheckDemoStatus();`). When `demorecording` is false the call is skipped entirely; when true the call fires before any other cleanup. This differs from `I_Quit` where `G_CheckDemoStatus` is unconditional — the `I_Error` gate exists because demo playback should not be finalised on the error path (only recording needs to be flushed to disk).',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_SECOND_CLEANUP_IS_D_QUITNETGAME',
    invariant:
      'The second cleanup op in vanilla `I_Error` is `D_QuitNetGame()`, fired unconditionally after the (conditional) `G_CheckDemoStatus`. Mirrors the position of `D_QuitNetGame` in `I_Quit` (where it is the first cleanup op) but in `I_Error` it is preceded by the demorecording-gated G_CheckDemoStatus.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_THIRD_CLEANUP_IS_I_SHUTDOWNGRAPHICS',
    invariant:
      'The third cleanup op in vanilla `I_Error` is `I_ShutdownGraphics()`, fired unconditionally after `D_QuitNetGame`. Restores VGA text mode (DOS) or shuts down the X11 window (linuxdoom-1.10) so that the formatted error message is visible to the user when the process terminates.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_FOURTH_CLEANUP_IS_EXIT_MINUS_ONE',
    invariant:
      'The fourth and final op in vanilla `I_Error` is the unconditional `exit(-1)` library call. The exit code is `-1` (or `0xFFFFFFFF` when interpreted as unsigned by the OS — DOS reports the low byte as 255). Any handler that reports a different exit code is a parity violation against the canonical vanilla error-exit semantics.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_EXIT_CODE_IS_MINUS_ONE',
    invariant:
      'Vanilla `I_Error` terminates the process with exit code -1 (error). The C source literal is `exit(-1)` — not `exit(1)`, not `exit(EXIT_FAILURE)`, not `_exit(-1)`. The literal `-1` is preserved verbatim in the linuxdoom-1.10 source despite being undefined behaviour by the C standard (which requires non-negative exit codes).',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_OMITS_M_SAVEDEFAULTS',
    invariant:
      'Vanilla `I_Error` does NOT call `M_SaveDefaults()`. The defaults table is intentionally not saved on the error path because it may be in an inconsistent state when an error fires (e.g., a config-mutating menu operation that crashed mid-update). A handler that calls `M_SaveDefaults` from `I_Error` is a parity violation: a future user would otherwise observe a partially-mutated `default.cfg` after a crash.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'I_ERROR_HAS_NO_RECURSIVE_GUARD_SENTINEL',
    invariant:
      "Vanilla `I_Error` has no recursive-call guard. If a cleanup op (e.g., `I_ShutdownGraphics`) raises another `I_Error`, the second call re-runs the entire prologue + cleanup sequence — there is no static `already_quitting` boolean (Chocolate Doom 2.2.1's addition in `src/i_system.c`). A handler that short-circuits re-entry is a parity violation: vanilla intentionally trusts the cleanup ops not to re-error and accepts unbounded recursion as the consequence.",
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'LINUXDOOM_OMITS_D_ENDOOM_FUNCTION',
    invariant:
      'The vanilla DOOM 1.9 `linuxdoom-1.10` source contains NO `D_Endoom` function. `D_Endoom` is a Chocolate Doom 2.2.1 addition in `src/d_main.c` that reads the ENDOOM lump via `W_CacheLumpName("ENDOOM", PU_STATIC)` and dispatches to `I_Endoom`. A handler that reports the presence of `D_Endoom` in the linuxdoom-1.10 source is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_Endoom',
  },
  {
    id: 'LINUXDOOM_OMITS_I_ENDOOM_FUNCTION',
    invariant:
      'The vanilla DOOM 1.9 `linuxdoom-1.10` source contains NO `I_Endoom` function. `I_Endoom` is a Chocolate Doom 2.2.1 addition in `src/i_endoom.c` that writes the ENDOOM lump bytes to a text-mode surface (the SDL host emulates the DOS B8000 text buffer). The linuxdoom-1.10 X11 host has no equivalent text-mode surface, so the function was never written; the DOS port (DOOMD.EXE / DOOM.EXE) implements ENDOOM in inline asm that is not in any source file we have access to.',
    referenceSourceFile: 'i_video.c',
    cSymbol: 'I_Endoom',
  },
  {
    id: 'LINUXDOOM_OMITS_I_ATEXIT_REGISTRATION_STACK',
    invariant:
      'The vanilla DOOM 1.9 `linuxdoom-1.10` source contains NO `I_AtExit` registration stack. The Chocolate Doom 2.2.1 `I_AtExit` (in `src/i_system.c`) maintains a singly-linked list of `(func, run_on_error)` pairs that grows during init via prepend; vanilla 1.9 inlines the cleanup body of `I_Quit` verbatim with no list. A handler that reports an `I_AtExit`-style stack is a parity violation: vanilla cannot register additional cleanup handlers from non-`I_Quit` sites.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_AtExit',
  },
  {
    id: 'ENDOOM_LUMP_NAME_IS_ENDOOM',
    invariant:
      'The verbatim ENDOOM lump name in the IWAD directory is `"ENDOOM"` — exactly six uppercase ASCII characters with no padding marker characters around it. The lump name is case-insensitive in DOOM\'s lump-lookup helpers but the canonical directory entry stores the upper-case form. A handler that reports `"ENDOOM2"`, `"ENDDOOM"`, or any other variant is a parity violation against the canonical IWAD layout.',
    referenceSourceFile: 'DOOM1.WAD',
    cSymbol: 'ENDOOM',
  },
  {
    id: 'ENDOOM_LUMP_SIZE_IS_FOUR_THOUSAND_BYTES',
    invariant:
      'The ENDOOM lump in every shareware/registered/Ultimate DOOM IWAD is exactly 4000 bytes long (80 columns × 25 rows × 2 bytes/cell). The size is fixed by the DOS VGA text-mode buffer layout (the famous 0xB8000 segment) and is not parameterised — every IWAD variant ships exactly 4000 bytes of ENDOOM data.',
    referenceSourceFile: 'DOOM1.WAD',
    cSymbol: 'ENDOOM',
  },
  {
    id: 'ENDOOM_GRID_IS_EIGHTY_BY_TWENTY_FIVE_CELLS',
    invariant:
      'The ENDOOM grid is 80 columns wide by 25 rows tall — the canonical IBM PC VGA text-mode dimensions. This produces 2000 cells total. A handler that reports a different grid (e.g., 40×25 for CGA, 80×50 for VESA EGA) is a parity violation against the DOS DOOM 1.9 text-mode target.',
    referenceSourceFile: 'DOOM1.WAD',
    cSymbol: 'ENDOOM',
  },
  {
    id: 'ENDOOM_BYTES_PER_CELL_IS_TWO',
    invariant:
      'Each ENDOOM cell is encoded as exactly 2 bytes: a CP437 character byte (range 0-255) followed by a VGA attribute byte (low nibble = foreground colour 0-15, bits 4-6 = background colour 0-7, bit 7 = blink). A handler that reports a different bytes-per-cell value (e.g., 1 for character-only, 4 for RGBA) is a parity violation against the canonical VGA text-mode encoding.',
    referenceSourceFile: 'DOOM1.WAD',
    cSymbol: 'ENDOOM',
  },
  {
    id: 'QUIT_OMITS_S_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla `I_Quit` does NOT call `S_Shutdown()`. `S_Shutdown` is a Chocolate Doom 2.2.1 addition that closes the sound subsystem (and indirectly the music subsystem) before exit; vanilla 1.9 has no equivalent call inside `I_Quit`. A handler that includes `S_Shutdown` in the canonical 5-step `I_Quit` sequence is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'QUIT_OMITS_I_SHUTDOWNTIMER_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla `I_Quit` does NOT call `I_ShutdownTimer()`. `I_ShutdownTimer` is a Chocolate Doom 2.2.1 addition registered via `I_AtExit` during `I_InitTimer`. Vanilla 1.9 has no timer-shutdown call because the DOS interrupt-based timer is reclaimed by DOS itself when the process exits. A handler that includes `I_ShutdownTimer` in the canonical 5-step `I_Quit` sequence is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'QUIT_OMITS_LIFO_TRAVERSAL_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      "Vanilla `I_Quit` does NOT walk a registration list to dispatch handlers. The Chocolate Doom 2.2.1 implementation walks `exit_funcs` head-to-tail, achieving LIFO execution because `I_AtExit` prepends each new entry; vanilla 1.9 inlines the four cleanup calls verbatim in source order with no traversal. A handler that reports LIFO ordering as the vanilla cleanup mechanism is a parity violation: vanilla's cleanup ordering is determined by the textual order of statements inside `I_Quit`, not by any prepend-and-traverse logic.",
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Quit',
  },
  {
    id: 'QUIT_OMITS_RUN_ON_ERROR_FILTER_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      "Vanilla `I_Error` does NOT apply a `run_on_error` per-handler filter. The Chocolate Doom 2.2.1 implementation skips handlers whose `run_on_error` is false on the error path; vanilla 1.9 has no such filter — it inlines the three cleanup calls (`G_CheckDemoStatus` gated on `demorecording`, `D_QuitNetGame`, `I_ShutdownGraphics`) verbatim. A handler that reports a `run_on_error` filter as the vanilla error-cleanup mechanism is a parity violation: vanilla's only error-side gate is the explicit `if (demorecording)` around `G_CheckDemoStatus`.",
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
] as const;

/** Number of audited contract clauses pinned by the ledger. */
export const VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_CONTRACT_CLAUSE_COUNT = 31;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity clean-quit / ENDOOM-policy handler must
 * preserve.
 */
export interface VanillaCleanQuitAndEndoomPolicyDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANTS: readonly VanillaCleanQuitAndEndoomPolicyDerivedInvariant[] = [
  {
    id: 'QUIT_HAS_EXACTLY_FIVE_OPS',
    description: 'The vanilla 1.9 `I_Quit` sequence has exactly five operations (four cleanup calls plus the `exit(0)` termination). Reporting more or fewer is a parity violation.',
  },
  {
    id: 'QUIT_ORDER_IS_DQNG_GCDS_MSD_ISG_EXIT',
    description: 'The `I_Quit` ops walk in the verbatim order `D_QuitNetGame → G_CheckDemoStatus → M_SaveDefaults → I_ShutdownGraphics → exit(0)`. Reordering any pair is a parity violation.',
  },
  {
    id: 'QUIT_EXIT_CODE_IS_ZERO',
    description: 'The vanilla `I_Quit` exit code is 0 (success). A handler that reports any other code is a parity violation.',
  },
  {
    id: 'QUIT_EVERY_CLEANUP_OP_IS_UNCONDITIONAL',
    description: 'All four cleanup ops in `I_Quit` (`D_QuitNetGame`, `G_CheckDemoStatus`, `M_SaveDefaults`, `I_ShutdownGraphics`) fire unconditionally. A handler that gates any cleanup op on a flag is a parity violation.',
  },
  {
    id: 'ERROR_PROLOGUE_HAS_EXACTLY_FOUR_PRINTS',
    description: 'The `I_Error` stderr prologue performs exactly four print/flush operations: `fprintf("Error: ") → vfprintf(error,argptr) → fprintf("\\n") → fflush(stderr)`. A handler that reports more or fewer is a parity violation.',
  },
  {
    id: 'ERROR_PROLOGUE_PREFIX_IS_VERBATIM_ERROR_COLON_SPACE',
    description: 'The `I_Error` stderr prefix is the verbatim literal `"Error: "` — capital E, lowercase rror, colon, single trailing space. A handler that emits a different literal is a parity violation.',
  },
  {
    id: 'ERROR_PROLOGUE_TRAILING_IS_VERBATIM_NEWLINE',
    description: 'The `I_Error` stderr trailing is the verbatim literal `"\\n"` — single LF byte. A handler that emits a different terminator is a parity violation.',
  },
  {
    id: 'ERROR_FFLUSH_PRECEDES_CLEANUP',
    description: 'The `I_Error` `fflush(stderr)` call precedes the cleanup phase. A handler that places `fflush` after any cleanup op is a parity violation.',
  },
  {
    id: 'ERROR_HAS_EXACTLY_FOUR_CLEANUP_OPS',
    description: 'The `I_Error` cleanup phase has exactly four ops: gated `G_CheckDemoStatus`, `D_QuitNetGame`, `I_ShutdownGraphics`, `exit(-1)`. A handler that reports more or fewer is a parity violation.',
  },
  {
    id: 'ERROR_FIRST_CLEANUP_IS_DEMORECORDING_GATED',
    description: 'The first `I_Error` cleanup op is `G_CheckDemoStatus`, gated by `if (demorecording)`. A handler that fires the call unconditionally — or gates it on a different flag — is a parity violation.',
  },
  {
    id: 'ERROR_EXIT_CODE_IS_MINUS_ONE',
    description: 'The vanilla `I_Error` exit code is `-1` (error). A handler that reports `1`, `EXIT_FAILURE`, or any other code is a parity violation.',
  },
  {
    id: 'ERROR_OMITS_M_SAVEDEFAULTS',
    description: '`I_Error` does NOT call `M_SaveDefaults` (vanilla intentionally skips the config save on the error path). A handler that includes `M_SaveDefaults` in the error cleanup is a parity violation.',
  },
  {
    id: 'ERROR_HAS_NO_RECURSIVE_GUARD',
    description: 'Vanilla `I_Error` has no `already_quitting` static sentinel. A handler that reports re-entry protection is a parity violation against linuxdoom-1.10 source.',
  },
  {
    id: 'LINUXDOOM_HAS_NO_D_ENDOOM',
    description: 'The vanilla 1.9 linuxdoom-1.10 source has no `D_Endoom` function. A handler that reports its presence is a parity violation.',
  },
  {
    id: 'LINUXDOOM_HAS_NO_I_ENDOOM',
    description: 'The vanilla 1.9 linuxdoom-1.10 source has no `I_Endoom` function. A handler that reports its presence is a parity violation.',
  },
  {
    id: 'LINUXDOOM_HAS_NO_I_ATEXIT_STACK',
    description: 'The vanilla 1.9 linuxdoom-1.10 source has no `I_AtExit` registration stack. A handler that reports its presence is a parity violation.',
  },
  {
    id: 'ENDOOM_LUMP_NAME_IS_VERBATIM_ENDOOM',
    description: 'The ENDOOM lump name is the verbatim ASCII string `"ENDOOM"`. A handler that reports a different name is a parity violation.',
  },
  {
    id: 'ENDOOM_LUMP_SIZE_IS_FOUR_THOUSAND_BYTES',
    description: 'The ENDOOM lump is exactly 4000 bytes. A handler that reports a different size is a parity violation.',
  },
  {
    id: 'ENDOOM_GRID_DIMENSIONS_ARE_EIGHTY_BY_TWENTY_FIVE',
    description: 'The ENDOOM grid is 80 columns × 25 rows. A handler that reports different dimensions is a parity violation.',
  },
  {
    id: 'ENDOOM_BYTES_PER_CELL_IS_TWO',
    description: 'Each ENDOOM cell occupies 2 bytes (character + attribute). A handler that reports a different value is a parity violation.',
  },
  {
    id: 'QUIT_OMITS_S_SHUTDOWN',
    description: 'Vanilla `I_Quit` does NOT call `S_Shutdown`. A handler that includes it is a parity violation.',
  },
  {
    id: 'QUIT_OMITS_I_SHUTDOWNTIMER',
    description: 'Vanilla `I_Quit` does NOT call `I_ShutdownTimer`. A handler that includes it is a parity violation.',
  },
  {
    id: 'QUIT_OMITS_LIFO_TRAVERSAL',
    description: 'Vanilla `I_Quit` does NOT walk a list to dispatch handlers. A handler that reports LIFO traversal is a parity violation.',
  },
  {
    id: 'ERROR_OMITS_RUN_ON_ERROR_FILTER',
    description: 'Vanilla `I_Error` does NOT apply a per-handler `run_on_error` filter. A handler that reports such a filter is a parity violation.',
  },
];

/** Number of derived invariants. */
export const VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_DERIVED_INVARIANT_COUNT = 24;

/**
 * Discriminator for one probe-style query against the canonical
 * vanilla 1.9 clean-quit and ENDOOM-policy contract.
 *
 * - `quit-op-at-index`: ask the handler what op it places at the given
 *   0-based `I_Quit` index (0..4).
 * - `error-cleanup-op-at-index`: ask the handler what op it places at
 *   the given 0-based `I_Error` cleanup index (0..3).
 * - `error-prologue-op-at-index`: ask the handler what op it places at
 *   the given 0-based `I_Error` prologue index (0..3).
 * - `op-condition`: ask the handler the gating condition of the named
 *   op inside the named phase (`I_Quit` or `I_Error` cleanup).
 * - `op-presence-in-quit`: ask the handler whether the named op is
 *   present in the canonical `I_Quit` sequence at all.
 * - `op-presence-in-error-cleanup`: ask the handler whether the named
 *   op is present in the canonical `I_Error` cleanup sequence at all.
 * - `quit-total-step-count`: ask the handler the total `I_Quit` step
 *   count (5).
 * - `error-cleanup-op-count`: ask the handler the total `I_Error`
 *   cleanup op count excluding prologue and termination (3).
 * - `quit-exit-code`: ask the handler the `I_Quit` exit code (0).
 * - `error-exit-code`: ask the handler the `I_Error` exit code (-1).
 * - `error-stderr-prefix`: ask the handler the verbatim stderr
 *   prefix literal (`"Error: "`).
 * - `error-trailing-newline`: ask the handler the verbatim trailing
 *   newline literal (`"\n"`).
 * - `endoom-lump-name`: ask the handler the verbatim ENDOOM lump
 *   name (`"ENDOOM"`).
 * - `endoom-lump-size-bytes`: ask the handler the ENDOOM byte count
 *   (4000).
 * - `endoom-grid-columns`: ask the handler the ENDOOM column count
 *   (80).
 * - `endoom-grid-rows`: ask the handler the ENDOOM row count (25).
 * - `endoom-bytes-per-cell`: ask the handler the ENDOOM bytes-per-
 *   cell count (2).
 * - `linuxdoom-has-feature`: ask the handler whether the named
 *   linuxdoom-1.10 source feature is present (false for every
 *   Chocolate-only feature).
 * - `error-has-recursive-guard`: ask the handler whether `I_Error`
 *   has a recursive-call guard sentinel (false in vanilla).
 * - `quit-op-precedes-quit-op`: ask the handler whether the first
 *   named op precedes the second named op in the canonical `I_Quit`
 *   ordering.
 */
export type VanillaCleanQuitAndEndoomPolicyQueryKind =
  | 'quit-op-at-index'
  | 'error-cleanup-op-at-index'
  | 'error-prologue-op-at-index'
  | 'op-condition'
  | 'op-presence-in-quit'
  | 'op-presence-in-error-cleanup'
  | 'quit-total-step-count'
  | 'error-cleanup-op-count'
  | 'quit-exit-code'
  | 'error-exit-code'
  | 'error-stderr-prefix'
  | 'error-trailing-newline'
  | 'endoom-lump-name'
  | 'endoom-lump-size-bytes'
  | 'endoom-grid-columns'
  | 'endoom-grid-rows'
  | 'endoom-bytes-per-cell'
  | 'linuxdoom-has-feature'
  | 'error-has-recursive-guard'
  | 'quit-op-precedes-quit-op';

/**
 * Discriminator for the phase used by `op-condition` and
 * `op-presence-*` query kinds. The probe uses this to disambiguate
 * the lookup target — e.g., `G_CheckDemoStatus` is unconditional in
 * `I_Quit` but `demorecording-flag-set` in `I_Error`.
 */
export type VanillaCleanQuitAndEndoomPolicyQueryPhase = 'quit' | 'error-cleanup' | 'error-prologue';

/**
 * One probe applied to a runtime vanilla clean-quit / ENDOOM-policy
 * handler.
 */
export interface VanillaCleanQuitAndEndoomPolicyProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Discriminator for the query kind. */
  readonly queryKind: VanillaCleanQuitAndEndoomPolicyQueryKind;
  /** Numeric query argument (0-based index for op-at-index queries). */
  readonly queryIndex: number | null;
  /** Op-name query argument (the queried op). */
  readonly queryOpName: string | null;
  /** Phase discriminator for op-condition / op-presence queries. */
  readonly queryPhase: VanillaCleanQuitAndEndoomPolicyQueryPhase | null;
  /** Feature-name query argument (for `linuxdoom-has-feature`). */
  readonly queryFeatureName: string | null;
  /** Earlier op for `quit-op-precedes-quit-op` queries. */
  readonly queryEarlierOpName: string | null;
  /** Later op for `quit-op-precedes-quit-op` queries. */
  readonly queryLaterOpName: string | null;
  /** Expected answered op name (for op-at-index queries). */
  readonly expectedAnsweredOpName: string | null;
  /** Expected answered presence boolean. */
  readonly expectedAnsweredPresent: boolean | null;
  /** Expected answered condition (for `op-condition`). */
  readonly expectedAnsweredCondition: VanillaCleanupCondition | null;
  /** Expected answered count (for the count/dimensional/exit-code queries). */
  readonly expectedAnsweredCount: number | null;
  /** Expected answered literal (for the stderr-prefix/newline/lump-name queries). */
  readonly expectedAnsweredLiteral: string | null;
  /** Expected answered precedence boolean (for `quit-op-precedes-quit-op`). */
  readonly expectedAnsweredPrecedes: boolean | null;
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId: string;
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a single query against the canonical sequence plus the
 * expected answer.
 */
export const VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES: readonly VanillaCleanQuitAndEndoomPolicyProbe[] = [
  {
    id: 'quit-index-zero-is-d-quitnetgame',
    description: 'The `I_Quit` op at canonical index 0 is `D_QuitNetGame`.',
    queryKind: 'quit-op-at-index',
    queryIndex: 0,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'D_QuitNetGame',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_ORDER_IS_DQNG_GCDS_MSD_ISG_EXIT',
  },
  {
    id: 'quit-index-one-is-g-checkdemostatus',
    description: 'The `I_Quit` op at canonical index 1 is `G_CheckDemoStatus`.',
    queryKind: 'quit-op-at-index',
    queryIndex: 1,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'G_CheckDemoStatus',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_ORDER_IS_DQNG_GCDS_MSD_ISG_EXIT',
  },
  {
    id: 'quit-index-two-is-m-savedefaults',
    description: 'The `I_Quit` op at canonical index 2 is `M_SaveDefaults`.',
    queryKind: 'quit-op-at-index',
    queryIndex: 2,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'M_SaveDefaults',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_ORDER_IS_DQNG_GCDS_MSD_ISG_EXIT',
  },
  {
    id: 'quit-index-three-is-i-shutdowngraphics',
    description: 'The `I_Quit` op at canonical index 3 is `I_ShutdownGraphics`.',
    queryKind: 'quit-op-at-index',
    queryIndex: 3,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'I_ShutdownGraphics',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_ORDER_IS_DQNG_GCDS_MSD_ISG_EXIT',
  },
  {
    id: 'quit-index-four-is-exit-zero',
    description: 'The `I_Quit` op at canonical index 4 is `exit-zero`.',
    queryKind: 'quit-op-at-index',
    queryIndex: 4,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'exit-zero',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_ORDER_IS_DQNG_GCDS_MSD_ISG_EXIT',
  },
  {
    id: 'quit-total-step-count-is-five',
    description: 'The `I_Quit` total step count is 5 (4 cleanup + 1 termination).',
    queryKind: 'quit-total-step-count',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: 5,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_HAS_EXACTLY_FIVE_OPS',
  },
  {
    id: 'quit-exit-code-is-zero',
    description: 'The `I_Quit` exit code is 0.',
    queryKind: 'quit-exit-code',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: 0,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_EXIT_CODE_IS_ZERO',
  },
  {
    id: 'quit-d-quitnetgame-is-unconditional',
    description: '`D_QuitNetGame` in `I_Quit` is unconditional.',
    queryKind: 'op-condition',
    queryIndex: null,
    queryOpName: 'D_QuitNetGame',
    queryPhase: 'quit',
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: 'always',
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_EVERY_CLEANUP_OP_IS_UNCONDITIONAL',
  },
  {
    id: 'quit-g-checkdemostatus-is-unconditional',
    description: '`G_CheckDemoStatus` in `I_Quit` is unconditional (the demo-state branching happens inside the function, not in the call site).',
    queryKind: 'op-condition',
    queryIndex: null,
    queryOpName: 'G_CheckDemoStatus',
    queryPhase: 'quit',
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: 'always',
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_EVERY_CLEANUP_OP_IS_UNCONDITIONAL',
  },
  {
    id: 'quit-m-savedefaults-is-unconditional',
    description: '`M_SaveDefaults` in `I_Quit` is unconditional.',
    queryKind: 'op-condition',
    queryIndex: null,
    queryOpName: 'M_SaveDefaults',
    queryPhase: 'quit',
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: 'always',
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_EVERY_CLEANUP_OP_IS_UNCONDITIONAL',
  },
  {
    id: 'quit-i-shutdowngraphics-is-unconditional',
    description: '`I_ShutdownGraphics` in `I_Quit` is unconditional.',
    queryKind: 'op-condition',
    queryIndex: null,
    queryOpName: 'I_ShutdownGraphics',
    queryPhase: 'quit',
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: 'always',
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_EVERY_CLEANUP_OP_IS_UNCONDITIONAL',
  },
  {
    id: 'error-prologue-index-zero-is-fprintf-error-prefix',
    description: 'The `I_Error` prologue op at canonical index 0 is `fprintf-error-prefix`.',
    queryKind: 'error-prologue-op-at-index',
    queryIndex: 0,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'fprintf-error-prefix',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_PROLOGUE_HAS_EXACTLY_FOUR_PRINTS',
  },
  {
    id: 'error-prologue-index-three-is-fflush-stderr',
    description: 'The `I_Error` prologue op at canonical index 3 is `fflush-stderr`.',
    queryKind: 'error-prologue-op-at-index',
    queryIndex: 3,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'fflush-stderr',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_FFLUSH_PRECEDES_CLEANUP',
  },
  {
    id: 'error-stderr-prefix-is-error-colon-space',
    description: 'The `I_Error` stderr prefix literal is `"Error: "`.',
    queryKind: 'error-stderr-prefix',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: 'Error: ',
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_PROLOGUE_PREFIX_IS_VERBATIM_ERROR_COLON_SPACE',
  },
  {
    id: 'error-trailing-newline-is-newline',
    description: 'The `I_Error` trailing newline literal is `"\\n"`.',
    queryKind: 'error-trailing-newline',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: '\n',
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_PROLOGUE_TRAILING_IS_VERBATIM_NEWLINE',
  },
  {
    id: 'error-cleanup-index-zero-is-g-checkdemostatus',
    description: 'The `I_Error` cleanup op at canonical index 0 is `G_CheckDemoStatus` (gated).',
    queryKind: 'error-cleanup-op-at-index',
    queryIndex: 0,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'G_CheckDemoStatus',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_FIRST_CLEANUP_IS_DEMORECORDING_GATED',
  },
  {
    id: 'error-cleanup-index-one-is-d-quitnetgame',
    description: 'The `I_Error` cleanup op at canonical index 1 is `D_QuitNetGame`.',
    queryKind: 'error-cleanup-op-at-index',
    queryIndex: 1,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'D_QuitNetGame',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_HAS_EXACTLY_FOUR_CLEANUP_OPS',
  },
  {
    id: 'error-cleanup-index-two-is-i-shutdowngraphics',
    description: 'The `I_Error` cleanup op at canonical index 2 is `I_ShutdownGraphics`.',
    queryKind: 'error-cleanup-op-at-index',
    queryIndex: 2,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'I_ShutdownGraphics',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_HAS_EXACTLY_FOUR_CLEANUP_OPS',
  },
  {
    id: 'error-cleanup-index-three-is-exit-minus-one',
    description: 'The `I_Error` cleanup op at canonical index 3 is `exit-minus-one`.',
    queryKind: 'error-cleanup-op-at-index',
    queryIndex: 3,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'exit-minus-one',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_HAS_EXACTLY_FOUR_CLEANUP_OPS',
  },
  {
    id: 'error-cleanup-op-count-is-three',
    description: 'The `I_Error` cleanup op count (excluding prologue and termination) is 3.',
    queryKind: 'error-cleanup-op-count',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: 3,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_HAS_EXACTLY_FOUR_CLEANUP_OPS',
  },
  {
    id: 'error-exit-code-is-minus-one',
    description: 'The `I_Error` exit code is -1.',
    queryKind: 'error-exit-code',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: -1,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_EXIT_CODE_IS_MINUS_ONE',
  },
  {
    id: 'error-g-checkdemostatus-is-demorecording-gated',
    description: '`G_CheckDemoStatus` in `I_Error` cleanup is gated by `demorecording`.',
    queryKind: 'op-condition',
    queryIndex: null,
    queryOpName: 'G_CheckDemoStatus',
    queryPhase: 'error-cleanup',
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: 'demorecording-flag-set',
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_FIRST_CLEANUP_IS_DEMORECORDING_GATED',
  },
  {
    id: 'm-savedefaults-is-absent-from-error-cleanup',
    description: '`M_SaveDefaults` is absent from the `I_Error` cleanup sequence.',
    queryKind: 'op-presence-in-error-cleanup',
    queryIndex: null,
    queryOpName: 'M_SaveDefaults',
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_OMITS_M_SAVEDEFAULTS',
  },
  {
    id: 'd-quitnetgame-is-present-in-quit',
    description: '`D_QuitNetGame` is present in the `I_Quit` sequence (positive control).',
    queryKind: 'op-presence-in-quit',
    queryIndex: null,
    queryOpName: 'D_QuitNetGame',
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: true,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_HAS_EXACTLY_FIVE_OPS',
  },
  {
    id: 's-shutdown-is-absent-from-quit',
    description: '`S_Shutdown` is absent from the `I_Quit` sequence (Chocolate-only).',
    queryKind: 'op-presence-in-quit',
    queryIndex: null,
    queryOpName: 'S_Shutdown',
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_OMITS_S_SHUTDOWN',
  },
  {
    id: 'i-shutdowntimer-is-absent-from-quit',
    description: '`I_ShutdownTimer` is absent from the `I_Quit` sequence (Chocolate-only).',
    queryKind: 'op-presence-in-quit',
    queryIndex: null,
    queryOpName: 'I_ShutdownTimer',
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_OMITS_I_SHUTDOWNTIMER',
  },
  {
    id: 'd-endoom-is-absent-from-linuxdoom',
    description: '`D_Endoom` is absent from the linuxdoom-1.10 source (Chocolate-only).',
    queryKind: 'linuxdoom-has-feature',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: 'D_Endoom',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'LINUXDOOM_HAS_NO_D_ENDOOM',
  },
  {
    id: 'i-endoom-is-absent-from-linuxdoom',
    description: '`I_Endoom` is absent from the linuxdoom-1.10 source (Chocolate-only).',
    queryKind: 'linuxdoom-has-feature',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: 'I_Endoom',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'LINUXDOOM_HAS_NO_I_ENDOOM',
  },
  {
    id: 'i-atexit-is-absent-from-linuxdoom',
    description: '`I_AtExit` is absent from the linuxdoom-1.10 source (Chocolate-only).',
    queryKind: 'linuxdoom-has-feature',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: 'I_AtExit',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'LINUXDOOM_HAS_NO_I_ATEXIT_STACK',
  },
  {
    id: 'lifo-traversal-is-absent-from-linuxdoom',
    description: '`lifoTraversal` is absent from the linuxdoom-1.10 source (Chocolate-only).',
    queryKind: 'linuxdoom-has-feature',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: 'lifoTraversal',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'QUIT_OMITS_LIFO_TRAVERSAL',
  },
  {
    id: 'run-on-error-filter-is-absent-from-linuxdoom',
    description: '`runOnErrorFilter` is absent from the linuxdoom-1.10 source (Chocolate-only).',
    queryKind: 'linuxdoom-has-feature',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: 'runOnErrorFilter',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_OMITS_RUN_ON_ERROR_FILTER',
  },
  {
    id: 'error-has-no-recursive-guard',
    description: '`I_Error` in vanilla 1.9 has no recursive-call guard sentinel.',
    queryKind: 'error-has-recursive-guard',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ERROR_HAS_NO_RECURSIVE_GUARD',
  },
  {
    id: 'endoom-lump-name-is-endoom',
    description: 'The ENDOOM lump name is the verbatim string `"ENDOOM"`.',
    queryKind: 'endoom-lump-name',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: 'ENDOOM',
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENDOOM_LUMP_NAME_IS_VERBATIM_ENDOOM',
  },
  {
    id: 'endoom-lump-size-is-four-thousand-bytes',
    description: 'The ENDOOM lump byte count is 4000.',
    queryKind: 'endoom-lump-size-bytes',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: 4000,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENDOOM_LUMP_SIZE_IS_FOUR_THOUSAND_BYTES',
  },
  {
    id: 'endoom-grid-columns-is-eighty',
    description: 'The ENDOOM grid column count is 80.',
    queryKind: 'endoom-grid-columns',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: 80,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENDOOM_GRID_DIMENSIONS_ARE_EIGHTY_BY_TWENTY_FIVE',
  },
  {
    id: 'endoom-grid-rows-is-twenty-five',
    description: 'The ENDOOM grid row count is 25.',
    queryKind: 'endoom-grid-rows',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: 25,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENDOOM_GRID_DIMENSIONS_ARE_EIGHTY_BY_TWENTY_FIVE',
  },
  {
    id: 'endoom-bytes-per-cell-is-two',
    description: 'The ENDOOM bytes-per-cell count is 2.',
    queryKind: 'endoom-bytes-per-cell',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: 2,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENDOOM_BYTES_PER_CELL_IS_TWO',
  },
  {
    id: 'd-quitnetgame-precedes-i-shutdowngraphics-in-quit',
    description: '`D_QuitNetGame` strictly precedes `I_ShutdownGraphics` in the canonical `I_Quit` ordering.',
    queryKind: 'quit-op-precedes-quit-op',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: 'D_QuitNetGame',
    queryLaterOpName: 'I_ShutdownGraphics',
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: true,
    witnessInvariantId: 'QUIT_ORDER_IS_DQNG_GCDS_MSD_ISG_EXIT',
  },
  {
    id: 'm-savedefaults-precedes-i-shutdowngraphics-in-quit',
    description: '`M_SaveDefaults` strictly precedes `I_ShutdownGraphics` in the canonical `I_Quit` ordering.',
    queryKind: 'quit-op-precedes-quit-op',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: 'M_SaveDefaults',
    queryLaterOpName: 'I_ShutdownGraphics',
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: true,
    witnessInvariantId: 'QUIT_ORDER_IS_DQNG_GCDS_MSD_ISG_EXIT',
  },
  {
    id: 'i-shutdowngraphics-does-not-precede-d-quitnetgame-in-quit',
    description: '`I_ShutdownGraphics` does NOT precede `D_QuitNetGame` in the canonical `I_Quit` ordering — the reverse query returns false.',
    queryKind: 'quit-op-precedes-quit-op',
    queryIndex: null,
    queryOpName: null,
    queryPhase: null,
    queryFeatureName: null,
    queryEarlierOpName: 'I_ShutdownGraphics',
    queryLaterOpName: 'D_QuitNetGame',
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredCount: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: false,
    witnessInvariantId: 'QUIT_ORDER_IS_DQNG_GCDS_MSD_ISG_EXIT',
  },
];

/** Number of pinned probes. */
export const VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBE_COUNT = 40;

/**
 * Result of a single probe run against a vanilla clean-quit / ENDOOM-
 * policy handler. Each query kind populates a different result field;
 * fields not relevant to the query kind are `null`.
 */
export interface VanillaCleanQuitAndEndoomPolicyResult {
  readonly answeredOpName: string | null;
  readonly answeredPresent: boolean | null;
  readonly answeredCondition: VanillaCleanupCondition | null;
  readonly answeredCount: number | null;
  readonly answeredLiteral: string | null;
  readonly answeredPrecedes: boolean | null;
}

/**
 * A minimal handler interface modelling the canonical vanilla 1.9
 * clean-quit / ENDOOM-policy contract. The reference implementation
 * answers each query against the pinned canonical sequences; the
 * cross-check accepts any handler shape so the focused test can
 * exercise deliberately broken adapters and observe the failure ids.
 */
export interface VanillaCleanQuitAndEndoomPolicyHandler {
  /**
   * Run a probe against a fresh handler instance. Returns the relevant
   * answer fields populated for the probe's query kind; unrelated
   * fields are `null`.
   */
  readonly runProbe: (probe: VanillaCleanQuitAndEndoomPolicyProbe) => VanillaCleanQuitAndEndoomPolicyResult;
}

const NULL_ANSWER: VanillaCleanQuitAndEndoomPolicyResult = Object.freeze({
  answeredOpName: null,
  answeredPresent: null,
  answeredCondition: null,
  answeredCount: null,
  answeredLiteral: null,
  answeredPrecedes: null,
});

/**
 * Reference handler that answers every query against the canonical
 * vanilla 1.9 clean-quit / ENDOOM-policy contract. The focused test
 * asserts that this handler passes every probe with zero failures.
 */
function referenceVanillaCleanQuitAndEndoomPolicyProbe(probe: VanillaCleanQuitAndEndoomPolicyProbe): VanillaCleanQuitAndEndoomPolicyResult {
  switch (probe.queryKind) {
    case 'quit-op-at-index': {
      const index = probe.queryIndex!;
      const step = VANILLA_I_QUIT_ORDER[index];
      return Object.freeze({ ...NULL_ANSWER, answeredOpName: step ? step.opName : null });
    }
    case 'error-cleanup-op-at-index': {
      const index = probe.queryIndex!;
      const step = VANILLA_I_ERROR_CLEANUP_ORDER[index];
      return Object.freeze({ ...NULL_ANSWER, answeredOpName: step ? step.opName : null });
    }
    case 'error-prologue-op-at-index': {
      const index = probe.queryIndex!;
      const step = VANILLA_I_ERROR_PROLOGUE_ORDER[index];
      return Object.freeze({ ...NULL_ANSWER, answeredOpName: step ? step.opName : null });
    }
    case 'op-condition': {
      const opName = probe.queryOpName!;
      const phase = probe.queryPhase!;
      const sequence = phase === 'quit' ? VANILLA_I_QUIT_ORDER : phase === 'error-cleanup' ? VANILLA_I_ERROR_CLEANUP_ORDER : VANILLA_I_ERROR_PROLOGUE_ORDER;
      const found = sequence.find((step) => step.opName === opName);
      return Object.freeze({ ...NULL_ANSWER, answeredCondition: found ? found.condition : null });
    }
    case 'op-presence-in-quit': {
      const opName = probe.queryOpName!;
      const present = VANILLA_I_QUIT_ORDER.some((step) => step.opName === opName);
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: present });
    }
    case 'op-presence-in-error-cleanup': {
      const opName = probe.queryOpName!;
      const present = VANILLA_I_ERROR_CLEANUP_ORDER.some((step) => step.opName === opName);
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: present });
    }
    case 'quit-total-step-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_I_QUIT_ORDER.length });
    }
    case 'error-cleanup-op-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_I_ERROR_CLEANUP_OP_COUNT });
    }
    case 'quit-exit-code': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_I_QUIT_EXIT_CODE });
    }
    case 'error-exit-code': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_I_ERROR_EXIT_CODE });
    }
    case 'error-stderr-prefix': {
      return Object.freeze({ ...NULL_ANSWER, answeredLiteral: VANILLA_I_ERROR_STDERR_PREFIX });
    }
    case 'error-trailing-newline': {
      return Object.freeze({ ...NULL_ANSWER, answeredLiteral: VANILLA_I_ERROR_STDERR_TRAILING_NEWLINE });
    }
    case 'endoom-lump-name': {
      return Object.freeze({ ...NULL_ANSWER, answeredLiteral: VANILLA_ENDOOM_LUMP_NAME });
    }
    case 'endoom-lump-size-bytes': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_ENDOOM_LUMP_SIZE_BYTES });
    }
    case 'endoom-grid-columns': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_ENDOOM_GRID_COLUMNS });
    }
    case 'endoom-grid-rows': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_ENDOOM_GRID_ROWS });
    }
    case 'endoom-bytes-per-cell': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_ENDOOM_BYTES_PER_CELL });
    }
    case 'linuxdoom-has-feature': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: !VANILLA_LINUXDOOM_ABSENT_CHOCOLATE_QUIT_FEATURES.includes(probe.queryFeatureName!) });
    }
    case 'error-has-recursive-guard': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: VANILLA_I_ERROR_HAS_RECURSIVE_GUARD });
    }
    case 'quit-op-precedes-quit-op': {
      const earlier = probe.queryEarlierOpName!;
      const later = probe.queryLaterOpName!;
      const earlierStep = VANILLA_I_QUIT_ORDER.find((step) => step.opName === earlier);
      const laterStep = VANILLA_I_QUIT_ORDER.find((step) => step.opName === later);
      const precedes = earlierStep !== undefined && laterStep !== undefined && earlierStep.index < laterStep.index;
      return Object.freeze({ ...NULL_ANSWER, answeredPrecedes: precedes });
    }
  }
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_HANDLER: VanillaCleanQuitAndEndoomPolicyHandler = Object.freeze({
  runProbe: referenceVanillaCleanQuitAndEndoomPolicyProbe,
});

/**
 * Cross-check a `VanillaCleanQuitAndEndoomPolicyHandler` against the
 * pinned probe set. Returns the list of failures by stable identifier;
 * an empty list means the handler is parity-safe with the canonical
 * vanilla 1.9 clean-quit / ENDOOM-policy contract.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:answeredOpName:value-mismatch`
 *  - `probe:<probe.id>:answeredPresent:value-mismatch`
 *  - `probe:<probe.id>:answeredCondition:value-mismatch`
 *  - `probe:<probe.id>:answeredCount:value-mismatch`
 *  - `probe:<probe.id>:answeredLiteral:value-mismatch`
 *  - `probe:<probe.id>:answeredPrecedes:value-mismatch`
 */
export function crossCheckVanillaCleanQuitAndEndoomPolicy(handler: VanillaCleanQuitAndEndoomPolicyHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_CLEAN_QUIT_AND_ENDOOM_POLICY_PROBES) {
    const result = handler.runProbe(probe);

    if (probe.expectedAnsweredOpName !== null && result.answeredOpName !== probe.expectedAnsweredOpName) {
      failures.push(`probe:${probe.id}:answeredOpName:value-mismatch`);
    }
    if (probe.expectedAnsweredPresent !== null && result.answeredPresent !== probe.expectedAnsweredPresent) {
      failures.push(`probe:${probe.id}:answeredPresent:value-mismatch`);
    }
    if (probe.expectedAnsweredCondition !== null && result.answeredCondition !== probe.expectedAnsweredCondition) {
      failures.push(`probe:${probe.id}:answeredCondition:value-mismatch`);
    }
    if (probe.expectedAnsweredCount !== null && result.answeredCount !== probe.expectedAnsweredCount) {
      failures.push(`probe:${probe.id}:answeredCount:value-mismatch`);
    }
    if (probe.expectedAnsweredLiteral !== null && result.answeredLiteral !== probe.expectedAnsweredLiteral) {
      failures.push(`probe:${probe.id}:answeredLiteral:value-mismatch`);
    }
    if (probe.expectedAnsweredPrecedes !== null && result.answeredPrecedes !== probe.expectedAnsweredPrecedes) {
      failures.push(`probe:${probe.id}:answeredPrecedes:value-mismatch`);
    }
  }

  return failures;
}

/**
 * Convenience helper: derive the expected answer for an arbitrary
 * probe against the canonical vanilla 1.9 clean-quit / ENDOOM-policy
 * contract. The focused test uses this helper to cross-validate probe
 * expectations independently of the reference handler.
 */
export function deriveExpectedVanillaCleanQuitAndEndoomPolicyResult(probe: VanillaCleanQuitAndEndoomPolicyProbe): VanillaCleanQuitAndEndoomPolicyResult {
  return referenceVanillaCleanQuitAndEndoomPolicyProbe(probe);
}
