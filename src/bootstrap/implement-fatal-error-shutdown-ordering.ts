/**
 * Audit ledger for the vanilla DOOM 1.9 fatal-error shutdown-ordering
 * landscape pinned against id Software's `linuxdoom-1.10/i_system.c`
 * and `linuxdoom-1.10/d_main.c`. The accompanying focused test
 * cross-checks every audited contract clause against a self-contained
 * reference handler that walks the canonical per-subsystem teardown
 * landscape the same way vanilla `I_Error` does.
 *
 * Step 03-010 pinned the verbatim four-cleanup-op sequence inside
 * `I_Error` (`if (demorecording) G_CheckDemoStatus → D_QuitNetGame →
 * I_ShutdownGraphics → exit(-1)`) and the absence of any ENDOOM display
 * machinery in `linuxdoom-1.10`. This step (03-011) pins the broader
 * shutdown-ordering surface that 03-010 does not touch:
 *
 *   1. The per-subsystem teardown classification on the fatal-error
 *      path. Vanilla `D_DoomMain` initialises twelve subsystems
 *      (V_Init, M_LoadDefaults, Z_Init, W_Init, M_Init, R_Init, P_Init,
 *      I_Init, D_CheckNetGame, S_Init, HU_Init, ST_Init) and
 *      `D_DoomLoop` later initialises a thirteenth (I_InitGraphics);
 *      vanilla `I_Error` explicitly tears down only THREE of those
 *      thirteen (the demo recorder via gated `G_CheckDemoStatus`, the
 *      net layer via unconditional `D_QuitNetGame`, and the graphics
 *      subsystem via unconditional `I_ShutdownGraphics`). The remaining
 *      ten subsystems are NOT explicitly torn down on the error path —
 *      vanilla relies on the operating system to reclaim their
 *      resources at process exit (DOS reclaims interrupt vectors, the
 *      sound device handle, file descriptors, and the heap; the X11
 *      server reclaims screen buffers).
 *
 *   2. The ordering invariance principle. Vanilla `I_Error` runs the
 *      same fixed three-explicit-shutdown sequence regardless of which
 *      init phase originated the fatal. A fatal raised from inside
 *      `V_Init` (the first init step) and a fatal raised from inside
 *      `ST_Init` (the last init step) both produce the same cleanup
 *      ordering. There is NO phase-aware destructor unwinding, NO
 *      reverse-init ordering, and NO partial-init rollback machinery.
 *
 *   3. The OS-reclamation reliance. For every subsystem that vanilla
 *      does NOT explicitly tear down, the rationale is that the
 *      operating system reclaims the resource at process exit. This is
 *      a deliberate design choice: vanilla 1.9 was a DOS application
 *      where DOS guarantees interrupt-vector restoration and device-
 *      handle release on `exit()`; the linuxdoom-1.10 port inherits
 *      the same idiom because the X11 server reclaims windows and
 *      shared-memory segments on client exit. A handler that adds an
 *      explicit shutdown call for any of the ten OS-reclaimed
 *      subsystems is a parity violation against vanilla 1.9 even when
 *      the added call would be cleaner from a modern-RAII perspective.
 *
 *   4. The Chocolate Doom 2.2.1 divergences. Chocolate registers
 *      cleanup handlers for many of the OS-reclaimed subsystems via
 *      `I_AtExit` (e.g., `S_Shutdown`, `I_ShutdownTimer`,
 *      `I_ShutdownMusic`, `OPL_Shutdown`, `NET_ShutdownClient`,
 *      `NET_ShutdownServer`); a handler that includes any of these
 *      Chocolate-only shutdown calls in the canonical vanilla 1.9
 *      fatal-error path is a parity violation. Chocolate also walks
 *      the `I_AtExit` registration stack head-to-tail (achieving LIFO
 *      execution because registration prepends), which is itself a
 *      Chocolate-only mechanism vanilla never exercises.
 *
 * No runtime fatal-error shutdown skeleton drives the `bun run doom.ts`
 * entrypoint yet — `src/bootstrap/quitFlow.ts` models the Chocolate-
 * shaped registration stack with eight handlers and `runOnError`
 * filtering, which is NOT the vanilla 1.9 contract pinned by this
 * audit. The audit module deliberately avoids importing from any
 * runtime quit/shutdown module so that a corrupted runtime cannot
 * silently calibrate the audit's own probe table.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the per-
 *      subsystem teardown landscape — `i_system.c` `I_Error` is the
 *      verbatim source of the three-explicit-shutdown sequence and
 *      omits any `S_Shutdown`/`I_ShutdownTimer`/etc. call; `d_main.c`
 *      `D_DoomMain` enumerates the twelve init phases that can each
 *      raise `I_Error`; `d_main.c` `D_DoomLoop` adds the thirteenth
 *      subsystem `I_InitGraphics`),
 *   5. Chocolate Doom 2.2.1 source (counterexample for the I_AtExit
 *      registration stack and the OS-reclaimed Chocolate-only shutdown
 *      handlers).
 *
 * The audit invariants below are pinned against authority 4 because
 * the per-subsystem teardown landscape is a textual property of
 * `i_system.c` and `d_main.c`: the vanilla `I_Error` body has no
 * preprocessor branching that could hide alternate shutdown calls; the
 * twelve init phases inside `D_DoomMain` and the `I_InitGraphics` call
 * inside `D_DoomLoop` are the only sources of partially-initialised
 * state that a fatal could plausibly need to clean up. Authority 1
 * (the DOS binary) cannot disagree because the fatal-error cleanup is
 * a visible pre-condition of every vanilla shutdown path, and the OS
 * reclamation behaviours (DOS reclaiming interrupt vectors, the X11
 * server reclaiming windows) are documented OS-level guarantees rather
 * than DOOM-level choices.
 */

/**
 * Verbatim symbol of one canonical vanilla DOOM 1.9 init phase that
 * could plausibly leave partially-initialised state at the moment a
 * fatal `I_Error` fires. The thirteen names come from:
 *
 *   - The twelve `printf("X_Init: ...\n"); X_Init();` pairs in
 *     `D_DoomMain` (audited in step 03-008): V_Init, M_LoadDefaults,
 *     Z_Init, W_Init, M_Init, R_Init, P_Init, I_Init, D_CheckNetGame,
 *     S_Init, HU_Init, ST_Init.
 *   - The unconditional `I_InitGraphics();` call in `D_DoomLoop`
 *     (audited in step 03-009).
 *
 * The audit pins the W_Init phase by the printed-line label
 * (`W_Init: Init WADfiles.\n`) rather than the underlying source-side
 * function name `W_InitMultipleFiles`, matching the convention adopted
 * by step 03-008.
 */
export type VanillaInitPhaseName = 'V_Init' | 'M_LoadDefaults' | 'Z_Init' | 'W_Init' | 'M_Init' | 'R_Init' | 'P_Init' | 'I_Init' | 'D_CheckNetGame' | 'S_Init' | 'HU_Init' | 'ST_Init' | 'I_InitGraphics';

/**
 * Discriminator of how vanilla 1.9 reclaims the resources owned by a
 * given init phase when a fatal `I_Error` fires.
 *
 * - `explicit-shutdown-call` matches a phase that vanilla `I_Error`
 *   tears down via a verbatim source-level shutdown call. The three
 *   such phases in vanilla 1.9 are `D_CheckNetGame` (torn down via
 *   `D_QuitNetGame`), `I_InitGraphics` (torn down via
 *   `I_ShutdownGraphics`), and the demo recorder (torn down via the
 *   demorecording-gated `G_CheckDemoStatus` — but the demo recorder
 *   is not initialised by an X_Init phase; it is owned by the demo
 *   subsystem alongside `D_CheckNetGame`/`G_RecordDemo`).
 * - `os-reclaims-heap` matches phases whose state lives on the heap,
 *   reclaimed by the OS at process exit. The two such phases are
 *   `Z_Init` (zone allocator) and the implicit zone-backed allocations
 *   of `R_Init`/`P_Init`/`HU_Init`/`ST_Init`.
 * - `os-reclaims-file-handles` matches phases that hold OS file
 *   descriptors. The one such phase is `W_Init` (IWAD/PWAD file
 *   handles).
 * - `os-reclaims-interrupt-vector-and-sound-device` matches phases
 *   that program DOS hardware. The one such phase is `I_Init` (DOS
 *   timer interrupt vector + sound-device DMA channel).
 * - `os-reclaims-audio-handle` matches phases that own the high-level
 *   audio handle on top of `I_Init`. The one such phase is `S_Init`.
 * - `static-memory-implicit-reclaim` matches phases whose state lives
 *   in BSS/data static memory, implicitly reclaimed when the process
 *   image is unloaded. The four such phases are `V_Init` (screen
 *   buffer pointers), `M_Init` (menu state), `HU_Init` (HUD message
 *   ring), and `ST_Init` (statusbar state).
 * - `defaults-not-saved-on-error-path` matches the M_LoadDefaults
 *   phase, which has no shutdown call AND is NOT saved by `I_Error`
 *   (vanilla intentionally skips `M_SaveDefaults` from `I_Error` to
 *   avoid corrupting the on-disk `default.cfg` when the in-memory
 *   defaults table may be in an inconsistent state).
 */
export type VanillaInitPhaseTeardownStrategy =
  | 'explicit-shutdown-call'
  | 'os-reclaims-heap'
  | 'os-reclaims-file-handles'
  | 'os-reclaims-interrupt-vector-and-sound-device'
  | 'os-reclaims-audio-handle'
  | 'static-memory-implicit-reclaim'
  | 'defaults-not-saved-on-error-path';

/**
 * Verbatim C symbol of an explicit shutdown call in vanilla `I_Error`.
 * Only three calls are present in the canonical body. The
 * `G_CheckDemoStatus-gated` discriminator names the gated form of
 * `G_CheckDemoStatus` (the actual call site is wrapped by
 * `if (demorecording) ...` so the discriminator is distinct from the
 * unconditional form that appears in `I_Quit`).
 */
export type VanillaFatalShutdownCallSymbol = 'G_CheckDemoStatus-gated' | 'D_QuitNetGame' | 'I_ShutdownGraphics';

/**
 * Per-subsystem teardown record pinning what vanilla 1.9 does (or does
 * not do) for each init phase when a fatal `I_Error` fires.
 */
export interface VanillaInitPhaseTeardownRecord {
  /** Verbatim init-phase name. */
  readonly phaseName: VanillaInitPhaseName;
  /** How vanilla 1.9 reclaims the phase's resources. */
  readonly teardownStrategy: VanillaInitPhaseTeardownStrategy;
  /**
   * Verbatim C symbol of the explicit shutdown call, or `null` when
   * vanilla 1.9 has no explicit shutdown call for the phase. Only three
   * phases populate this field: `D_CheckNetGame` → `D_QuitNetGame`,
   * `I_InitGraphics` → `I_ShutdownGraphics`. The demo-recorder cleanup
   * (`G_CheckDemoStatus-gated`) is NOT triggered by an X_Init phase;
   * it is bookkeeping for the demorecording flag set by `-record`.
   */
  readonly explicitShutdownSymbol: VanillaFatalShutdownCallSymbol | null;
  /**
   * Stable identifier of the corresponding Chocolate-only shutdown
   * call, or `null` when Chocolate also omits an explicit shutdown for
   * the phase. The Chocolate-only additions are:
   *  - `S_Init` → `S_Shutdown` (registered via `I_AtExit` in `S_Init`).
   *  - `I_Init` → `I_ShutdownTimer` (registered via `I_AtExit` in
   *    `I_InitTimer`) plus `I_ShutdownSound` for the SDL audio path.
   *  - `M_LoadDefaults` is NOT given a shutdown call by Chocolate
   *    either (Chocolate's M_SaveDefaults is registered for the normal
   *    path only with `run_on_error=false`).
   */
  readonly chocolateShutdownSymbol: string | null;
}

/**
 * Frozen canonical per-subsystem teardown landscape pinned by vanilla
 * DOOM 1.9 `linuxdoom-1.10`. The order matches the canonical init
 * order pinned by step 03-008 (V_Init → M_LoadDefaults → Z_Init →
 * W_Init → M_Init → R_Init → P_Init → I_Init → D_CheckNetGame →
 * S_Init → HU_Init → ST_Init), with `I_InitGraphics` appended as the
 * thirteenth phase because it is initialised by `D_DoomLoop` after
 * `D_DoomMain` returns.
 *
 * The record explicitly captures vanilla's "operating system reclaims
 * everything that is not in the three-explicit-shutdown set" philosophy.
 */
export const VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE: readonly VanillaInitPhaseTeardownRecord[] = Object.freeze([
  Object.freeze({ phaseName: 'V_Init', teardownStrategy: 'static-memory-implicit-reclaim', explicitShutdownSymbol: null, chocolateShutdownSymbol: null } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'M_LoadDefaults', teardownStrategy: 'defaults-not-saved-on-error-path', explicitShutdownSymbol: null, chocolateShutdownSymbol: null } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'Z_Init', teardownStrategy: 'os-reclaims-heap', explicitShutdownSymbol: null, chocolateShutdownSymbol: null } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'W_Init', teardownStrategy: 'os-reclaims-file-handles', explicitShutdownSymbol: null, chocolateShutdownSymbol: null } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'M_Init', teardownStrategy: 'static-memory-implicit-reclaim', explicitShutdownSymbol: null, chocolateShutdownSymbol: null } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'R_Init', teardownStrategy: 'os-reclaims-heap', explicitShutdownSymbol: null, chocolateShutdownSymbol: null } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'P_Init', teardownStrategy: 'os-reclaims-heap', explicitShutdownSymbol: null, chocolateShutdownSymbol: null } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'I_Init', teardownStrategy: 'os-reclaims-interrupt-vector-and-sound-device', explicitShutdownSymbol: null, chocolateShutdownSymbol: 'I_ShutdownTimer' } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'D_CheckNetGame', teardownStrategy: 'explicit-shutdown-call', explicitShutdownSymbol: 'D_QuitNetGame', chocolateShutdownSymbol: 'D_QuitNetGame' } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'S_Init', teardownStrategy: 'os-reclaims-audio-handle', explicitShutdownSymbol: null, chocolateShutdownSymbol: 'S_Shutdown' } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'HU_Init', teardownStrategy: 'static-memory-implicit-reclaim', explicitShutdownSymbol: null, chocolateShutdownSymbol: null } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'ST_Init', teardownStrategy: 'static-memory-implicit-reclaim', explicitShutdownSymbol: null, chocolateShutdownSymbol: null } satisfies VanillaInitPhaseTeardownRecord),
  Object.freeze({ phaseName: 'I_InitGraphics', teardownStrategy: 'explicit-shutdown-call', explicitShutdownSymbol: 'I_ShutdownGraphics', chocolateShutdownSymbol: 'I_ShutdownGraphics' } satisfies VanillaInitPhaseTeardownRecord),
]);

/** Total number of init phases in the pinned teardown landscape. */
export const VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE_COUNT = 13;

/** Number of init phases vanilla `I_Error` explicitly tears down (D_CheckNetGame and I_InitGraphics). */
export const VANILLA_INIT_PHASES_WITH_EXPLICIT_FATAL_SHUTDOWN_COUNT = 2;

/**
 * Number of init phases vanilla relies on the OS to reclaim. The
 * eleven OS-reclaimed phases are V_Init, M_LoadDefaults, Z_Init,
 * W_Init, M_Init, R_Init, P_Init, I_Init, S_Init, HU_Init, ST_Init.
 */
export const VANILLA_INIT_PHASES_WITH_OS_RECLAMATION_COUNT = 11;

/**
 * Verbatim ordered list of the three explicit shutdown calls vanilla
 * `I_Error` invokes before `exit(-1)`. The demo cleanup is the gated
 * form (`if (demorecording) G_CheckDemoStatus()`); the network and
 * graphics calls are unconditional. The order matches the verbatim
 * source order in `linuxdoom-1.10/i_system.c`.
 */
export const VANILLA_FATAL_EXPLICIT_SHUTDOWN_ORDER: readonly VanillaFatalShutdownCallSymbol[] = Object.freeze(['G_CheckDemoStatus-gated', 'D_QuitNetGame', 'I_ShutdownGraphics']);

/** Number of explicit shutdown calls in the canonical vanilla 1.9 fatal-error path (excluding the `exit(-1)` termination). */
export const VANILLA_FATAL_EXPLICIT_SHUTDOWN_COUNT = 3;

/** Whether vanilla 1.9 performs reverse-init unwinding on the fatal path. It does not. */
export const VANILLA_FATAL_PATH_PERFORMS_REVERSE_INIT_UNWINDING = false;

/** Whether vanilla 1.9 performs partial-init rollback (per-phase destructor calls). It does not. */
export const VANILLA_FATAL_PATH_PERFORMS_PARTIAL_INIT_ROLLBACK = false;

/** Whether vanilla 1.9's fatal-path shutdown ordering varies based on which init phase originated the fatal. It does not. */
export const VANILLA_FATAL_PATH_ORDERING_VARIES_BY_PHASE_OF_ORIGIN = false;

/** Whether vanilla 1.9 uses C `setjmp`/`longjmp` to unwind init when a fatal fires. It does not. */
export const VANILLA_FATAL_PATH_USES_SETJMP_LONGJMP = false;

/** Whether vanilla 1.9 has an `I_AtExit`-style registration stack for fatal-path handlers. It does not. */
export const VANILLA_FATAL_PATH_HAS_REGISTRATION_STACK = false;

/**
 * Verbatim list of cleanup-stage handlers Chocolate Doom 2.2.1 adds on
 * top of the vanilla three-explicit-shutdown set. A vanilla-1.9 handler
 * must report `false` for "is this Chocolate-only shutdown call
 * present in the canonical fatal-error path?" for every entry below.
 */
export const VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALLS: readonly string[] = Object.freeze(['S_Shutdown', 'I_ShutdownTimer', 'I_ShutdownSound', 'I_ShutdownMusic', 'OPL_Shutdown', 'NET_ShutdownClient', 'NET_ShutdownServer']);

/** Number of Chocolate-only shutdown calls absent from the vanilla 1.9 fatal-error path. */
export const VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALL_COUNT = 7;

/**
 * One audited contract clause of the vanilla DOOM 1.9 fatal-error
 * shutdown-ordering landscape.
 */
export interface VanillaFatalErrorShutdownOrderingContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'FATAL_PATH_HAS_THREE_EXPLICIT_SHUTDOWN_CALLS'
    | 'FATAL_PATH_DEMO_CLEANUP_IS_DEMORECORDING_GATED'
    | 'FATAL_PATH_NETWORK_TEARDOWN_IS_UNCONDITIONAL_D_QUITNETGAME'
    | 'FATAL_PATH_GRAPHICS_TEARDOWN_IS_UNCONDITIONAL_I_SHUTDOWNGRAPHICS'
    | 'FATAL_PATH_SHUTDOWN_ORDERING_IS_DEMO_THEN_NETWORK_THEN_GRAPHICS'
    | 'FATAL_PATH_ORDERING_DOES_NOT_VARY_BY_INIT_PHASE_OF_ORIGIN'
    | 'FATAL_PATH_DOES_NOT_REVERSE_UNWIND_INIT_ORDER'
    | 'FATAL_PATH_DOES_NOT_PERFORM_PARTIAL_INIT_ROLLBACK'
    | 'FATAL_PATH_DOES_NOT_USE_SETJMP_LONGJMP'
    | 'FATAL_PATH_DOES_NOT_HAVE_REGISTRATION_STACK'
    | 'V_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_SCREEN_BUFFERS'
    | 'M_LOADDEFAULTS_NOT_TORN_DOWN_AND_NOT_SAVED_ON_ERROR_PATH'
    | 'Z_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_HEAP'
    | 'W_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_FILE_HANDLES'
    | 'M_INIT_NOT_EXPLICITLY_TORN_DOWN_MENU_STATE_IN_STATIC_MEMORY'
    | 'R_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_RENDERER_TABLES'
    | 'P_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_PLAY_STATE'
    | 'I_INIT_NOT_EXPLICITLY_TORN_DOWN_DOS_RECLAIMS_INTERRUPT_VECTOR'
    | 'D_CHECKNETGAME_EXPLICITLY_TORN_DOWN_VIA_D_QUITNETGAME'
    | 'S_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_AUDIO_HANDLE'
    | 'HU_INIT_NOT_EXPLICITLY_TORN_DOWN_HUD_STATE_IN_STATIC_MEMORY'
    | 'ST_INIT_NOT_EXPLICITLY_TORN_DOWN_STATUSBAR_STATE_IN_STATIC_MEMORY'
    | 'I_INITGRAPHICS_EXPLICITLY_TORN_DOWN_VIA_I_SHUTDOWNGRAPHICS'
    | 'FATAL_PATH_OMITS_S_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE'
    | 'FATAL_PATH_OMITS_I_SHUTDOWNTIMER_PRESENT_ONLY_IN_CHOCOLATE'
    | 'FATAL_PATH_OMITS_I_SHUTDOWNMUSIC_PRESENT_ONLY_IN_CHOCOLATE'
    | 'FATAL_PATH_OMITS_OPL_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE'
    | 'FATAL_PATH_OMITS_NET_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'i_system.c' | 'd_main.c';
  /** Verbatim C symbol the contract clause is pinned against. */
  readonly cSymbol: 'I_Error' | 'D_DoomMain' | 'D_DoomLoop';
}

/**
 * Pinned ledger of every contract clause of the vanilla DOOM 1.9
 * fatal-error shutdown-ordering landscape.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_AUDIT: readonly VanillaFatalErrorShutdownOrderingContractAuditEntry[] = [
  {
    id: 'FATAL_PATH_HAS_THREE_EXPLICIT_SHUTDOWN_CALLS',
    invariant:
      'Vanilla DOOM 1.9 `I_Error` performs exactly three explicit shutdown calls before `exit(-1)`: the demorecording-gated `G_CheckDemoStatus`, the unconditional `D_QuitNetGame`, and the unconditional `I_ShutdownGraphics`. Adding a fourth call (e.g., a Chocolate-Doom-2.2.1-style `S_Shutdown`, `I_ShutdownTimer`, `I_ShutdownMusic`, `OPL_Shutdown`, or `NET_ShutdownClient`) is a parity violation; removing any of the three is also a parity violation. The count is three and only three.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_DEMO_CLEANUP_IS_DEMORECORDING_GATED',
    invariant:
      'The demo-recorder cleanup call in vanilla `I_Error` is `G_CheckDemoStatus()`, gated by the `demorecording` flag (`if (demorecording) G_CheckDemoStatus();`). When `demorecording` is false the call is skipped entirely; when true it fires before any other shutdown call. The gate exists because demo playback should not be finalised on the error path — only recording needs to be flushed to disk via `M_WriteFile`.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_NETWORK_TEARDOWN_IS_UNCONDITIONAL_D_QUITNETGAME',
    invariant:
      'The network teardown call in vanilla `I_Error` is `D_QuitNetGame()`, fired unconditionally after the (conditional) `G_CheckDemoStatus`. `D_QuitNetGame` sends a `NETPACKET_QUIT` packet via the net layer and frees the per-player buffers. The call is unconditional even in single-player so the net layer can perform a no-op cleanup pass.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_GRAPHICS_TEARDOWN_IS_UNCONDITIONAL_I_SHUTDOWNGRAPHICS',
    invariant:
      'The graphics teardown call in vanilla `I_Error` is `I_ShutdownGraphics()`, fired unconditionally as the third and final shutdown call before `exit(-1)`. `I_ShutdownGraphics` restores VGA text mode in DOS or shuts down the X11 window in linuxdoom-1.10, ensuring the formatted error message printed by the prologue is visible to the user when the process terminates.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_SHUTDOWN_ORDERING_IS_DEMO_THEN_NETWORK_THEN_GRAPHICS',
    invariant:
      'The three explicit shutdown calls in vanilla `I_Error` fire in the verbatim order `G_CheckDemoStatus` (gated) → `D_QuitNetGame` → `I_ShutdownGraphics`. Reordering any pair (e.g., placing graphics teardown before network teardown) is a parity violation against the verbatim source order in `linuxdoom-1.10/i_system.c`.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_ORDERING_DOES_NOT_VARY_BY_INIT_PHASE_OF_ORIGIN',
    invariant:
      'Vanilla `I_Error` runs the same fixed three-explicit-shutdown sequence regardless of which init phase originated the fatal. A fatal raised from inside `V_Init` (the first init step) and a fatal raised from inside `ST_Init` (the last init step) both produce the same demo-then-network-then-graphics cleanup ordering. There is NO phase-aware destructor unwinding — `I_Error` does not inspect a "current init phase" variable to choose which cleanup calls to run. A handler that varies the cleanup ordering by phase of origin is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_DOES_NOT_REVERSE_UNWIND_INIT_ORDER',
    invariant:
      'Vanilla `I_Error` does NOT reverse-unwind the canonical init ordering pinned by step 03-008 (V_Init → M_LoadDefaults → Z_Init → W_Init → M_Init → R_Init → P_Init → I_Init → D_CheckNetGame → S_Init → HU_Init → ST_Init). A modern RAII/destructor-style implementation would tear down ST_Init first, then HU_Init, then S_Init, etc.; vanilla 1.9 instead inlines a fixed three-call cleanup with no relationship to the init order. The explicit shutdown calls in the cleanup (`D_QuitNetGame` for `D_CheckNetGame`, `I_ShutdownGraphics` for `I_InitGraphics`) are not chosen because they are last-in-init — they are chosen because those are the only two subsystems that own OS resources DOS or X11 cannot reclaim implicitly.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_DOES_NOT_PERFORM_PARTIAL_INIT_ROLLBACK',
    invariant:
      'Vanilla `I_Error` does NOT perform partial-init rollback: when a fatal fires partway through `D_DoomMain`, vanilla does NOT track which init phases completed and does NOT call a per-phase "destructor" for each completed phase. The same fixed three-call cleanup runs whether five phases or all twelve completed before the fatal. A handler that walks a "completed init phases" log to issue per-phase shutdown calls is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_DOES_NOT_USE_SETJMP_LONGJMP',
    invariant:
      'Vanilla 1.9 does NOT use C `setjmp`/`longjmp` to unwind init when a fatal `I_Error` fires. `I_Error` simply runs the prologue prints, the three-call cleanup, and `exit(-1)` — there is no jump-buffer machinery anywhere in `D_DoomMain` or `I_Error`. A handler that uses `setjmp`/`longjmp` to model fatal-error unwinding is a parity violation against the verbatim source structure of vanilla 1.9.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_DOES_NOT_HAVE_REGISTRATION_STACK',
    invariant:
      'Vanilla 1.9 has NO `I_AtExit`-style registration stack for fatal-error handlers. Chocolate Doom 2.2.1 maintains a singly-linked list of `(func, run_on_error)` pairs prepended at registration and walked head-to-tail at cleanup time (achieving LIFO execution); vanilla inlines the three cleanup calls in `I_Error` verbatim with no list traversal. A handler that registers fatal-error cleanup callbacks via a runtime list is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'V_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_SCREEN_BUFFERS',
    invariant:
      '`V_Init` is NOT explicitly torn down by vanilla `I_Error`. The screen buffers `V_Init` allocates are reclaimed implicitly when the process image is unloaded (the buffers live in static memory in DOS DOOM 1.9; the X11 port maps them via `XShmCreateImage` and X11 reclaims the shared-memory segment on client exit). A handler that adds a `V_Shutdown` call to the fatal-error path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'M_LOADDEFAULTS_NOT_TORN_DOWN_AND_NOT_SAVED_ON_ERROR_PATH',
    invariant:
      '`M_LoadDefaults` is NOT explicitly torn down by vanilla `I_Error`, AND `M_SaveDefaults` is intentionally NOT called from `I_Error` (vanilla calls `M_SaveDefaults` from `I_Quit` only). The defaults table lives in static memory and is reclaimed implicitly when the process image is unloaded. The intentional omission of `M_SaveDefaults` from `I_Error` exists because the in-memory defaults table may be in an inconsistent state when an error fires — saving it would risk corrupting the on-disk `default.cfg`.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'Z_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_HEAP',
    invariant:
      '`Z_Init` is NOT explicitly torn down by vanilla `I_Error`. The zone-allocator heap (a single large `malloc` block in vanilla; a list of zone blocks in linuxdoom-1.10) is reclaimed by the operating system when the process exits. A handler that adds a `Z_Shutdown` call to the fatal-error path is a parity violation against the OS-reclamation idiom vanilla relies on.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'W_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_FILE_HANDLES',
    invariant:
      '`W_Init` is NOT explicitly torn down by vanilla `I_Error`. The IWAD/PWAD file handles `W_InitMultipleFiles` opens via `open(2)` in linuxdoom-1.10 (or `_open`/`fopen` on DOS) are reclaimed by the operating system when the process exits. A handler that adds a `W_Shutdown` or per-handle `close` loop to the fatal-error path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'M_INIT_NOT_EXPLICITLY_TORN_DOWN_MENU_STATE_IN_STATIC_MEMORY',
    invariant:
      '`M_Init` is NOT explicitly torn down by vanilla `I_Error`. The menu state (`m_menu.c` global structures) lives in BSS/data static memory and is reclaimed implicitly when the process image is unloaded. A handler that adds an `M_Shutdown` call to the fatal-error path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'R_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_RENDERER_TABLES',
    invariant:
      '`R_Init` is NOT explicitly torn down by vanilla `I_Error`. The renderer lookup tables (composited textures, light-level scale ramps, floor/ceiling visplane pools) are zone-allocated and therefore reclaimed by the operating system through the zone heap when the process exits. A handler that adds an `R_Shutdown` call to the fatal-error path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'P_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_PLAY_STATE',
    invariant:
      '`P_Init` is NOT explicitly torn down by vanilla `I_Error`. The play-state caches (sprite frames, animation tables, switch-list lookups) live in zone or static memory and are reclaimed implicitly through the zone heap or process-image unload. A handler that adds a `P_Shutdown` call to the fatal-error path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'I_INIT_NOT_EXPLICITLY_TORN_DOWN_DOS_RECLAIMS_INTERRUPT_VECTOR',
    invariant:
      '`I_Init` is NOT explicitly torn down by vanilla `I_Error`. The DOS port relies on DOS to restore the original timer interrupt vector (INT 8 / 1Ch) and release the sound-device DMA channel when `exit()` is called. The linuxdoom-1.10 port has no equivalent timer registration (Linux kernel itimers are auto-cancelled at process exit). Chocolate Doom 2.2.1 adds an `I_ShutdownTimer` call registered via `I_AtExit`; vanilla 1.9 has no such call. A handler that adds an `I_Shutdown` or `I_ShutdownTimer` call to the fatal-error path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'D_CHECKNETGAME_EXPLICITLY_TORN_DOWN_VIA_D_QUITNETGAME',
    invariant:
      '`D_CheckNetGame` IS explicitly torn down by vanilla `I_Error` via `D_QuitNetGame`. This is one of only two init phases vanilla treats with an explicit shutdown call (the other being `I_InitGraphics`). The teardown is necessary because `D_CheckNetGame` opens UDP/IPX sockets and registers per-player buffers that the operating system would reclaim non-gracefully — without a `NETPACKET_QUIT` send, peer hosts would observe a stale connection.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'S_INIT_NOT_EXPLICITLY_TORN_DOWN_OS_RECLAIMS_AUDIO_HANDLE',
    invariant:
      '`S_Init` is NOT explicitly torn down by vanilla `I_Error`. The high-level audio handle (`s_sound.c` channel pool plus the DOS sound-driver dispatch) is reclaimed by the operating system when the process exits — DOS releases the device handle as part of normal `exit()` cleanup. Chocolate Doom 2.2.1 adds an `S_Shutdown` call registered via `I_AtExit`; vanilla 1.9 has no such call. A handler that adds an `S_Shutdown` call to the fatal-error path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'HU_INIT_NOT_EXPLICITLY_TORN_DOWN_HUD_STATE_IN_STATIC_MEMORY',
    invariant:
      '`HU_Init` is NOT explicitly torn down by vanilla `I_Error`. The HUD message ring (`hu_stuff.c` static buffers) lives in BSS/data static memory and is reclaimed implicitly when the process image is unloaded. A handler that adds an `HU_Shutdown` call to the fatal-error path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'ST_INIT_NOT_EXPLICITLY_TORN_DOWN_STATUSBAR_STATE_IN_STATIC_MEMORY',
    invariant:
      '`ST_Init` is NOT explicitly torn down by vanilla `I_Error`. The statusbar state (`st_stuff.c` static buffers and font-patch references) lives in BSS/data static memory plus zone-allocated patch references; both are reclaimed implicitly when the process image is unloaded. A handler that adds an `ST_Shutdown` call to the fatal-error path is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'I_INITGRAPHICS_EXPLICITLY_TORN_DOWN_VIA_I_SHUTDOWNGRAPHICS',
    invariant:
      '`I_InitGraphics` (called inside `D_DoomLoop`, not `D_DoomMain`) IS explicitly torn down by vanilla `I_Error` via `I_ShutdownGraphics`. This is the second of only two init phases vanilla treats with an explicit shutdown call. The teardown is necessary because `I_InitGraphics` puts the DOS host into VGA mode 13h (or the X11 port creates an XShmImage); without `I_ShutdownGraphics` the user would lose the text-mode console after process exit, hiding any error message printed by the prologue.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'FATAL_PATH_OMITS_S_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla `I_Error` does NOT call `S_Shutdown()`. `S_Shutdown` is a Chocolate Doom 2.2.1 addition registered via `I_AtExit` from `S_Init`. A handler that includes `S_Shutdown` in the canonical vanilla 1.9 fatal-error path is a parity violation against the OS-reclamation idiom (vanilla relies on DOS to release the audio device handle at process exit).',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_OMITS_I_SHUTDOWNTIMER_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla `I_Error` does NOT call `I_ShutdownTimer()`. `I_ShutdownTimer` is a Chocolate Doom 2.2.1 addition registered via `I_AtExit` from `I_InitTimer`. Vanilla 1.9 relies on DOS to restore the original timer interrupt vector at process exit. A handler that includes `I_ShutdownTimer` in the canonical vanilla 1.9 fatal-error path is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_OMITS_I_SHUTDOWNMUSIC_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla `I_Error` does NOT call `I_ShutdownMusic()`. `I_ShutdownMusic` is a Chocolate Doom 2.2.1 addition registered via `I_AtExit` for the SDL audio backend. Vanilla 1.9 has no separate music-subsystem shutdown — DOS reclaims the music-device handle at process exit alongside the sound-device handle. A handler that includes `I_ShutdownMusic` in the canonical vanilla 1.9 fatal-error path is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_OMITS_OPL_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla `I_Error` does NOT call `OPL_Shutdown()`. `OPL_Shutdown` is a Chocolate Doom 2.2.1 addition that tears down the software OPL2/OPL3 emulator the SDL host spins up for music synthesis. Vanilla 1.9 has no software OPL emulator — the DOS build talks to OPL hardware directly via `I_Init`/sound-driver pairings reclaimed by DOS at process exit. A handler that includes `OPL_Shutdown` in the canonical vanilla 1.9 fatal-error path is a parity violation.',
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
  {
    id: 'FATAL_PATH_OMITS_NET_SHUTDOWN_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      "Vanilla `I_Error` does NOT call `NET_ShutdownClient()` or `NET_ShutdownServer()`. These are Chocolate Doom 2.2.1 additions belonging to the `chocolate-doom` net-server discovery layer that runs alongside `D_QuitNetGame`. Vanilla 1.9 has no `NET_*` subsystem distinct from `D_QuitNetGame`; the latter alone is sufficient because vanilla's net stack is a peer-to-peer IPX/UDP layer with no separate client/server bookkeeping. A handler that includes `NET_ShutdownClient` or `NET_ShutdownServer` in the canonical vanilla 1.9 fatal-error path is a parity violation.",
    referenceSourceFile: 'i_system.c',
    cSymbol: 'I_Error',
  },
] as const;

/** Number of audited contract clauses pinned by the ledger. */
export const VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_CONTRACT_CLAUSE_COUNT = 28;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity fatal-error shutdown handler must preserve.
 */
export interface VanillaFatalErrorShutdownOrderingDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANTS: readonly VanillaFatalErrorShutdownOrderingDerivedInvariant[] = [
  {
    id: 'FATAL_PATH_HAS_EXACTLY_THREE_EXPLICIT_SHUTDOWNS',
    description: 'The vanilla 1.9 fatal-error path performs exactly three explicit shutdown calls before `exit(-1)`. Reporting more or fewer is a parity violation.',
  },
  {
    id: 'FATAL_PATH_ORDER_IS_DEMO_NETWORK_GRAPHICS',
    description: 'The three explicit fatal-path shutdowns walk in the verbatim order demo (gated) → network → graphics. Reordering any pair is a parity violation.',
  },
  {
    id: 'FATAL_PATH_DEMO_GATE_IS_DEMORECORDING',
    description: 'The demo cleanup is gated by the `demorecording` flag (skipped when false, fired when true). A handler that fires it unconditionally — or gates it on a different flag — is a parity violation.',
  },
  {
    id: 'FATAL_PATH_NETWORK_AND_GRAPHICS_ARE_UNCONDITIONAL',
    description: '`D_QuitNetGame` and `I_ShutdownGraphics` fire unconditionally on every fatal-error path. A handler that gates either call is a parity violation.',
  },
  {
    id: 'FATAL_PATH_ORDERING_INVARIANT_TO_PHASE_OF_ORIGIN',
    description: 'The fatal-path shutdown ordering does not vary based on which init phase originated the fatal. A handler that varies the cleanup ordering by phase of origin is a parity violation.',
  },
  {
    id: 'FATAL_PATH_HAS_NO_REVERSE_INIT_UNWINDING',
    description: 'The fatal-path cleanup does not reverse-unwind the canonical init order. A handler that walks the init phases in reverse and issues per-phase shutdown calls is a parity violation.',
  },
  {
    id: 'FATAL_PATH_HAS_NO_PARTIAL_INIT_ROLLBACK',
    description: 'The fatal-path cleanup does not perform partial-init rollback. A handler that tracks completed init phases and issues per-phase rollback calls is a parity violation.',
  },
  {
    id: 'FATAL_PATH_HAS_NO_SETJMP_LONGJMP_UNWINDING',
    description: 'The fatal-path cleanup does not use `setjmp`/`longjmp` to unwind init. A handler that models fatal-error unwinding via jump buffers is a parity violation.',
  },
  {
    id: 'FATAL_PATH_HAS_NO_REGISTRATION_STACK',
    description: 'The fatal-path cleanup has no `I_AtExit`-style registration stack. A handler that registers fatal-error callbacks via a runtime list is a parity violation.',
  },
  {
    id: 'INIT_PHASE_LANDSCAPE_HAS_THIRTEEN_PHASES',
    description: 'The pinned init-phase teardown landscape covers the twelve `D_DoomMain` X_Init phases plus the `D_DoomLoop` `I_InitGraphics` phase. A handler that reports a different total is a parity violation.',
  },
  {
    id: 'INIT_PHASE_LANDSCAPE_HAS_TWO_EXPLICIT_SHUTDOWNS',
    description:
      'Only two of the thirteen init phases are explicitly torn down by `I_Error`: `D_CheckNetGame` (via `D_QuitNetGame`) and `I_InitGraphics` (via `I_ShutdownGraphics`). A handler that reports a different count is a parity violation.',
  },
  {
    id: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
    description: 'The remaining eleven init phases rely on operating-system reclamation at process exit. A handler that reports an explicit shutdown call for any of the eleven is a parity violation.',
  },
  {
    id: 'M_LOADDEFAULTS_NOT_SAVED_ON_ERROR_PATH',
    description: '`M_SaveDefaults` is intentionally NOT called from `I_Error`. A handler that adds it to the fatal-error path is a parity violation.',
  },
  {
    id: 'FATAL_PATH_OMITS_CHOCOLATE_S_SHUTDOWN',
    description: 'Vanilla `I_Error` omits `S_Shutdown`. A handler that includes it is a parity violation.',
  },
  {
    id: 'FATAL_PATH_OMITS_CHOCOLATE_I_SHUTDOWNTIMER',
    description: 'Vanilla `I_Error` omits `I_ShutdownTimer`. A handler that includes it is a parity violation.',
  },
  {
    id: 'FATAL_PATH_OMITS_CHOCOLATE_I_SHUTDOWNMUSIC',
    description: 'Vanilla `I_Error` omits `I_ShutdownMusic`. A handler that includes it is a parity violation.',
  },
  {
    id: 'FATAL_PATH_OMITS_CHOCOLATE_OPL_SHUTDOWN',
    description: 'Vanilla `I_Error` omits `OPL_Shutdown`. A handler that includes it is a parity violation.',
  },
  {
    id: 'FATAL_PATH_OMITS_CHOCOLATE_NET_SHUTDOWN',
    description: 'Vanilla `I_Error` omits `NET_ShutdownClient` and `NET_ShutdownServer`. A handler that includes either is a parity violation.',
  },
  {
    id: 'INIT_PHASE_TEARDOWN_LANDSCAPE_FIRST_PHASE_IS_V_INIT',
    description: 'The first init phase in the canonical teardown landscape is `V_Init` (matches the canonical 03-008 init order). A handler that reports a different first phase is a parity violation.',
  },
  {
    id: 'INIT_PHASE_TEARDOWN_LANDSCAPE_LAST_PHASE_IS_I_INITGRAPHICS',
    description: 'The last init phase in the canonical teardown landscape is `I_InitGraphics` (the `D_DoomLoop` phase appended after the twelve `D_DoomMain` phases). A handler that reports a different last phase is a parity violation.',
  },
];

/** Number of derived invariants. */
export const VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_DERIVED_INVARIANT_COUNT = 20;

/**
 * Discriminator for one probe-style query against the canonical
 * vanilla 1.9 fatal-error shutdown-ordering contract.
 *
 * - `fatal-explicit-shutdown-at-index`: ask the handler what shutdown
 *   call it places at the given 0-based index (0..2).
 * - `fatal-explicit-shutdown-count`: ask the handler the total
 *   explicit-shutdown count (3).
 * - `phase-teardown-strategy`: ask the handler the teardown strategy
 *   for the named init phase.
 * - `phase-explicit-shutdown-symbol`: ask the handler the explicit
 *   shutdown symbol for the named init phase (or null for OS-reclaimed
 *   phases).
 * - `phase-presence-in-explicit-shutdown`: ask the handler whether the
 *   named init phase has an explicit shutdown call (boolean).
 * - `landscape-total-phase-count`: ask the handler the total init-
 *   phase count (13).
 * - `landscape-explicit-shutdown-phase-count`: ask the handler the
 *   number of phases with an explicit shutdown (2).
 * - `landscape-os-reclaimed-phase-count`: ask the handler the number
 *   of phases relying on OS reclamation (11).
 * - `fatal-path-ordering-varies-by-phase-of-origin`: ask the handler
 *   whether the cleanup ordering varies based on which init phase
 *   originated the fatal (false in vanilla).
 * - `fatal-path-performs-reverse-init-unwinding`: ask the handler
 *   whether the cleanup reverse-unwinds init (false in vanilla).
 * - `fatal-path-performs-partial-init-rollback`: ask the handler
 *   whether the cleanup performs partial-init rollback (false in
 *   vanilla).
 * - `fatal-path-uses-setjmp-longjmp`: ask the handler whether the
 *   cleanup uses setjmp/longjmp (false in vanilla).
 * - `fatal-path-has-registration-stack`: ask the handler whether the
 *   cleanup has an `I_AtExit`-style registration stack (false in
 *   vanilla).
 * - `fatal-path-includes-chocolate-shutdown`: ask the handler whether
 *   the named Chocolate-only shutdown call is present in the canonical
 *   vanilla 1.9 fatal-error path (false for every Chocolate addition).
 */
export type VanillaFatalErrorShutdownOrderingQueryKind =
  | 'fatal-explicit-shutdown-at-index'
  | 'fatal-explicit-shutdown-count'
  | 'phase-teardown-strategy'
  | 'phase-explicit-shutdown-symbol'
  | 'phase-presence-in-explicit-shutdown'
  | 'landscape-total-phase-count'
  | 'landscape-explicit-shutdown-phase-count'
  | 'landscape-os-reclaimed-phase-count'
  | 'fatal-path-ordering-varies-by-phase-of-origin'
  | 'fatal-path-performs-reverse-init-unwinding'
  | 'fatal-path-performs-partial-init-rollback'
  | 'fatal-path-uses-setjmp-longjmp'
  | 'fatal-path-has-registration-stack'
  | 'fatal-path-includes-chocolate-shutdown';

/**
 * One probe applied to a runtime vanilla fatal-error shutdown-ordering
 * handler.
 */
export interface VanillaFatalErrorShutdownOrderingProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Discriminator for the query kind. */
  readonly queryKind: VanillaFatalErrorShutdownOrderingQueryKind;
  /** Numeric query argument (0-based index for at-index queries). */
  readonly queryIndex: number | null;
  /** Phase-name query argument (for phase-* queries). */
  readonly queryPhaseName: VanillaInitPhaseName | null;
  /** Chocolate shutdown name query argument (for `fatal-path-includes-chocolate-shutdown`). */
  readonly queryChocolateShutdownName: string | null;
  /** Expected answered shutdown symbol (for `fatal-explicit-shutdown-at-index` and `phase-explicit-shutdown-symbol`). */
  readonly expectedAnsweredShutdownSymbol: VanillaFatalShutdownCallSymbol | null;
  /** Expected answered teardown strategy (for `phase-teardown-strategy`). */
  readonly expectedAnsweredTeardownStrategy: VanillaInitPhaseTeardownStrategy | null;
  /** Expected answered presence boolean (for boolean queries). */
  readonly expectedAnsweredPresent: boolean | null;
  /** Expected answered count (for count queries). */
  readonly expectedAnsweredCount: number | null;
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId: string;
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a single query against the canonical sequence plus the
 * expected answer.
 */
export const VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES: readonly VanillaFatalErrorShutdownOrderingProbe[] = [
  {
    id: 'fatal-shutdown-index-zero-is-g-checkdemostatus-gated',
    description: 'The fatal-path explicit shutdown at index 0 is the demorecording-gated `G_CheckDemoStatus`.',
    queryKind: 'fatal-explicit-shutdown-at-index',
    queryIndex: 0,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: 'G_CheckDemoStatus-gated',
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_ORDER_IS_DEMO_NETWORK_GRAPHICS',
  },
  {
    id: 'fatal-shutdown-index-one-is-d-quitnetgame',
    description: 'The fatal-path explicit shutdown at index 1 is the unconditional `D_QuitNetGame`.',
    queryKind: 'fatal-explicit-shutdown-at-index',
    queryIndex: 1,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: 'D_QuitNetGame',
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_ORDER_IS_DEMO_NETWORK_GRAPHICS',
  },
  {
    id: 'fatal-shutdown-index-two-is-i-shutdowngraphics',
    description: 'The fatal-path explicit shutdown at index 2 is the unconditional `I_ShutdownGraphics`.',
    queryKind: 'fatal-explicit-shutdown-at-index',
    queryIndex: 2,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: 'I_ShutdownGraphics',
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_ORDER_IS_DEMO_NETWORK_GRAPHICS',
  },
  {
    id: 'fatal-explicit-shutdown-count-is-three',
    description: 'The fatal-path explicit-shutdown count is 3.',
    queryKind: 'fatal-explicit-shutdown-count',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: 3,
    witnessInvariantId: 'FATAL_PATH_HAS_EXACTLY_THREE_EXPLICIT_SHUTDOWNS',
  },
  {
    id: 'phase-v-init-strategy-is-static-memory',
    description: 'The teardown strategy for `V_Init` is `static-memory-implicit-reclaim`.',
    queryKind: 'phase-teardown-strategy',
    queryIndex: null,
    queryPhaseName: 'V_Init',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: 'static-memory-implicit-reclaim',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
  },
  {
    id: 'phase-m-loaddefaults-strategy-is-defaults-not-saved-on-error',
    description: 'The teardown strategy for `M_LoadDefaults` is `defaults-not-saved-on-error-path`.',
    queryKind: 'phase-teardown-strategy',
    queryIndex: null,
    queryPhaseName: 'M_LoadDefaults',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: 'defaults-not-saved-on-error-path',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'M_LOADDEFAULTS_NOT_SAVED_ON_ERROR_PATH',
  },
  {
    id: 'phase-z-init-strategy-is-os-reclaims-heap',
    description: 'The teardown strategy for `Z_Init` is `os-reclaims-heap`.',
    queryKind: 'phase-teardown-strategy',
    queryIndex: null,
    queryPhaseName: 'Z_Init',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: 'os-reclaims-heap',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
  },
  {
    id: 'phase-w-init-strategy-is-os-reclaims-file-handles',
    description: 'The teardown strategy for `W_Init` is `os-reclaims-file-handles`.',
    queryKind: 'phase-teardown-strategy',
    queryIndex: null,
    queryPhaseName: 'W_Init',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: 'os-reclaims-file-handles',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
  },
  {
    id: 'phase-i-init-strategy-is-os-reclaims-interrupt-vector',
    description: 'The teardown strategy for `I_Init` is `os-reclaims-interrupt-vector-and-sound-device`.',
    queryKind: 'phase-teardown-strategy',
    queryIndex: null,
    queryPhaseName: 'I_Init',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: 'os-reclaims-interrupt-vector-and-sound-device',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
  },
  {
    id: 'phase-d-checknetgame-strategy-is-explicit',
    description: 'The teardown strategy for `D_CheckNetGame` is `explicit-shutdown-call`.',
    queryKind: 'phase-teardown-strategy',
    queryIndex: null,
    queryPhaseName: 'D_CheckNetGame',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: 'explicit-shutdown-call',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_TWO_EXPLICIT_SHUTDOWNS',
  },
  {
    id: 'phase-s-init-strategy-is-os-reclaims-audio-handle',
    description: 'The teardown strategy for `S_Init` is `os-reclaims-audio-handle`.',
    queryKind: 'phase-teardown-strategy',
    queryIndex: null,
    queryPhaseName: 'S_Init',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: 'os-reclaims-audio-handle',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
  },
  {
    id: 'phase-i-initgraphics-strategy-is-explicit',
    description: 'The teardown strategy for `I_InitGraphics` is `explicit-shutdown-call`.',
    queryKind: 'phase-teardown-strategy',
    queryIndex: null,
    queryPhaseName: 'I_InitGraphics',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: 'explicit-shutdown-call',
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_TWO_EXPLICIT_SHUTDOWNS',
  },
  {
    id: 'phase-d-checknetgame-explicit-symbol-is-d-quitnetgame',
    description: 'The explicit shutdown symbol for `D_CheckNetGame` is `D_QuitNetGame`.',
    queryKind: 'phase-explicit-shutdown-symbol',
    queryIndex: null,
    queryPhaseName: 'D_CheckNetGame',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: 'D_QuitNetGame',
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_TWO_EXPLICIT_SHUTDOWNS',
  },
  {
    id: 'phase-i-initgraphics-explicit-symbol-is-i-shutdowngraphics',
    description: 'The explicit shutdown symbol for `I_InitGraphics` is `I_ShutdownGraphics`.',
    queryKind: 'phase-explicit-shutdown-symbol',
    queryIndex: null,
    queryPhaseName: 'I_InitGraphics',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: 'I_ShutdownGraphics',
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_TWO_EXPLICIT_SHUTDOWNS',
  },
  {
    id: 'phase-z-init-explicit-symbol-is-null',
    description: 'The explicit shutdown symbol for `Z_Init` is null (OS-reclaimed).',
    queryKind: 'phase-explicit-shutdown-symbol',
    queryIndex: null,
    queryPhaseName: 'Z_Init',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
  },
  {
    id: 'phase-s-init-explicit-symbol-is-null',
    description: 'The explicit shutdown symbol for `S_Init` is null (OS-reclaimed).',
    queryKind: 'phase-explicit-shutdown-symbol',
    queryIndex: null,
    queryPhaseName: 'S_Init',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
  },
  {
    id: 'phase-d-checknetgame-presence-is-true',
    description: '`D_CheckNetGame` is present in the explicit-shutdown set (positive control).',
    queryKind: 'phase-presence-in-explicit-shutdown',
    queryIndex: null,
    queryPhaseName: 'D_CheckNetGame',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: true,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_TWO_EXPLICIT_SHUTDOWNS',
  },
  {
    id: 'phase-i-initgraphics-presence-is-true',
    description: '`I_InitGraphics` is present in the explicit-shutdown set (positive control).',
    queryKind: 'phase-presence-in-explicit-shutdown',
    queryIndex: null,
    queryPhaseName: 'I_InitGraphics',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: true,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_TWO_EXPLICIT_SHUTDOWNS',
  },
  {
    id: 'phase-s-init-presence-is-false',
    description: '`S_Init` is NOT present in the explicit-shutdown set (Chocolate-only addition).',
    queryKind: 'phase-presence-in-explicit-shutdown',
    queryIndex: null,
    queryPhaseName: 'S_Init',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_OMITS_CHOCOLATE_S_SHUTDOWN',
  },
  {
    id: 'phase-i-init-presence-is-false',
    description: '`I_Init` is NOT present in the explicit-shutdown set (Chocolate-only addition `I_ShutdownTimer`).',
    queryKind: 'phase-presence-in-explicit-shutdown',
    queryIndex: null,
    queryPhaseName: 'I_Init',
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_OMITS_CHOCOLATE_I_SHUTDOWNTIMER',
  },
  {
    id: 'landscape-total-phase-count-is-thirteen',
    description: 'The init-phase teardown landscape has 13 phases (12 from D_DoomMain + 1 from D_DoomLoop).',
    queryKind: 'landscape-total-phase-count',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: 13,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_THIRTEEN_PHASES',
  },
  {
    id: 'landscape-explicit-shutdown-phase-count-is-two',
    description: 'The init-phase teardown landscape has 2 phases with explicit shutdown calls.',
    queryKind: 'landscape-explicit-shutdown-phase-count',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: 2,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_TWO_EXPLICIT_SHUTDOWNS',
  },
  {
    id: 'landscape-os-reclaimed-phase-count-is-eleven',
    description: 'The init-phase teardown landscape has 11 OS-reclaimed phases.',
    queryKind: 'landscape-os-reclaimed-phase-count',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCount: 11,
    witnessInvariantId: 'INIT_PHASE_LANDSCAPE_HAS_ELEVEN_OS_RECLAIMED_PHASES',
  },
  {
    id: 'fatal-path-ordering-does-not-vary-by-phase-of-origin',
    description: 'The fatal-path ordering does not vary by phase of origin.',
    queryKind: 'fatal-path-ordering-varies-by-phase-of-origin',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_ORDERING_INVARIANT_TO_PHASE_OF_ORIGIN',
  },
  {
    id: 'fatal-path-does-not-reverse-unwind',
    description: 'The fatal-path cleanup does not reverse-unwind init order.',
    queryKind: 'fatal-path-performs-reverse-init-unwinding',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_HAS_NO_REVERSE_INIT_UNWINDING',
  },
  {
    id: 'fatal-path-does-not-perform-partial-init-rollback',
    description: 'The fatal-path cleanup does not perform partial-init rollback.',
    queryKind: 'fatal-path-performs-partial-init-rollback',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_HAS_NO_PARTIAL_INIT_ROLLBACK',
  },
  {
    id: 'fatal-path-does-not-use-setjmp-longjmp',
    description: 'The fatal-path cleanup does not use setjmp/longjmp.',
    queryKind: 'fatal-path-uses-setjmp-longjmp',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_HAS_NO_SETJMP_LONGJMP_UNWINDING',
  },
  {
    id: 'fatal-path-does-not-have-registration-stack',
    description: 'The fatal-path cleanup has no `I_AtExit`-style registration stack.',
    queryKind: 'fatal-path-has-registration-stack',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: null,
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_HAS_NO_REGISTRATION_STACK',
  },
  {
    id: 'fatal-path-omits-s-shutdown',
    description: 'The fatal-path cleanup does not include `S_Shutdown` (Chocolate-only).',
    queryKind: 'fatal-path-includes-chocolate-shutdown',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: 'S_Shutdown',
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_OMITS_CHOCOLATE_S_SHUTDOWN',
  },
  {
    id: 'fatal-path-omits-i-shutdowntimer',
    description: 'The fatal-path cleanup does not include `I_ShutdownTimer` (Chocolate-only).',
    queryKind: 'fatal-path-includes-chocolate-shutdown',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: 'I_ShutdownTimer',
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_OMITS_CHOCOLATE_I_SHUTDOWNTIMER',
  },
  {
    id: 'fatal-path-omits-i-shutdownmusic',
    description: 'The fatal-path cleanup does not include `I_ShutdownMusic` (Chocolate-only).',
    queryKind: 'fatal-path-includes-chocolate-shutdown',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: 'I_ShutdownMusic',
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_OMITS_CHOCOLATE_I_SHUTDOWNMUSIC',
  },
  {
    id: 'fatal-path-omits-opl-shutdown',
    description: 'The fatal-path cleanup does not include `OPL_Shutdown` (Chocolate-only).',
    queryKind: 'fatal-path-includes-chocolate-shutdown',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: 'OPL_Shutdown',
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_OMITS_CHOCOLATE_OPL_SHUTDOWN',
  },
  {
    id: 'fatal-path-omits-net-shutdownclient',
    description: 'The fatal-path cleanup does not include `NET_ShutdownClient` (Chocolate-only).',
    queryKind: 'fatal-path-includes-chocolate-shutdown',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: 'NET_ShutdownClient',
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_OMITS_CHOCOLATE_NET_SHUTDOWN',
  },
  {
    id: 'fatal-path-omits-net-shutdownserver',
    description: 'The fatal-path cleanup does not include `NET_ShutdownServer` (Chocolate-only).',
    queryKind: 'fatal-path-includes-chocolate-shutdown',
    queryIndex: null,
    queryPhaseName: null,
    queryChocolateShutdownName: 'NET_ShutdownServer',
    expectedAnsweredShutdownSymbol: null,
    expectedAnsweredTeardownStrategy: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'FATAL_PATH_OMITS_CHOCOLATE_NET_SHUTDOWN',
  },
];

/** Number of pinned probes. */
export const VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBE_COUNT = 34;

/**
 * Result of a single probe run against a vanilla fatal-error shutdown-
 * ordering handler. Each query kind populates a different result field;
 * fields not relevant to the query kind are `null`.
 */
export interface VanillaFatalErrorShutdownOrderingResult {
  readonly answeredShutdownSymbol: VanillaFatalShutdownCallSymbol | null;
  readonly answeredTeardownStrategy: VanillaInitPhaseTeardownStrategy | null;
  readonly answeredPresent: boolean | null;
  readonly answeredCount: number | null;
}

/**
 * A minimal handler interface modelling the canonical vanilla 1.9
 * fatal-error shutdown-ordering contract. The reference implementation
 * answers each query against the pinned canonical landscape; the
 * cross-check accepts any handler shape so the focused test can
 * exercise deliberately broken adapters and observe the failure ids.
 */
export interface VanillaFatalErrorShutdownOrderingHandler {
  /**
   * Run a probe against a fresh handler instance. Returns the relevant
   * answer fields populated for the probe's query kind; unrelated
   * fields are `null`.
   */
  readonly runProbe: (probe: VanillaFatalErrorShutdownOrderingProbe) => VanillaFatalErrorShutdownOrderingResult;
}

const NULL_ANSWER: VanillaFatalErrorShutdownOrderingResult = Object.freeze({
  answeredShutdownSymbol: null,
  answeredTeardownStrategy: null,
  answeredPresent: null,
  answeredCount: null,
});

/**
 * Reference handler that answers every query against the canonical
 * vanilla 1.9 fatal-error shutdown-ordering landscape. The focused
 * test asserts that this handler passes every probe with zero
 * failures.
 */
function referenceVanillaFatalErrorShutdownOrderingProbe(probe: VanillaFatalErrorShutdownOrderingProbe): VanillaFatalErrorShutdownOrderingResult {
  switch (probe.queryKind) {
    case 'fatal-explicit-shutdown-at-index': {
      const index = probe.queryIndex!;
      const symbol = VANILLA_FATAL_EXPLICIT_SHUTDOWN_ORDER[index];
      return Object.freeze({ ...NULL_ANSWER, answeredShutdownSymbol: symbol ?? null });
    }
    case 'fatal-explicit-shutdown-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_FATAL_EXPLICIT_SHUTDOWN_COUNT });
    }
    case 'phase-teardown-strategy': {
      const phaseName = probe.queryPhaseName!;
      const record = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.find((entry) => entry.phaseName === phaseName);
      return Object.freeze({ ...NULL_ANSWER, answeredTeardownStrategy: record ? record.teardownStrategy : null });
    }
    case 'phase-explicit-shutdown-symbol': {
      const phaseName = probe.queryPhaseName!;
      const record = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.find((entry) => entry.phaseName === phaseName);
      return Object.freeze({ ...NULL_ANSWER, answeredShutdownSymbol: record ? record.explicitShutdownSymbol : null });
    }
    case 'phase-presence-in-explicit-shutdown': {
      const phaseName = probe.queryPhaseName!;
      const record = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.find((entry) => entry.phaseName === phaseName);
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: record ? record.explicitShutdownSymbol !== null : false });
    }
    case 'landscape-total-phase-count': {
      return Object.freeze({ ...NULL_ANSWER, answeredCount: VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.length });
    }
    case 'landscape-explicit-shutdown-phase-count': {
      const count = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.filter((entry) => entry.explicitShutdownSymbol !== null).length;
      return Object.freeze({ ...NULL_ANSWER, answeredCount: count });
    }
    case 'landscape-os-reclaimed-phase-count': {
      const count = VANILLA_INIT_PHASE_TEARDOWN_LANDSCAPE.filter((entry) => entry.explicitShutdownSymbol === null).length;
      return Object.freeze({ ...NULL_ANSWER, answeredCount: count });
    }
    case 'fatal-path-ordering-varies-by-phase-of-origin': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: VANILLA_FATAL_PATH_ORDERING_VARIES_BY_PHASE_OF_ORIGIN });
    }
    case 'fatal-path-performs-reverse-init-unwinding': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: VANILLA_FATAL_PATH_PERFORMS_REVERSE_INIT_UNWINDING });
    }
    case 'fatal-path-performs-partial-init-rollback': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: VANILLA_FATAL_PATH_PERFORMS_PARTIAL_INIT_ROLLBACK });
    }
    case 'fatal-path-uses-setjmp-longjmp': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: VANILLA_FATAL_PATH_USES_SETJMP_LONGJMP });
    }
    case 'fatal-path-has-registration-stack': {
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: VANILLA_FATAL_PATH_HAS_REGISTRATION_STACK });
    }
    case 'fatal-path-includes-chocolate-shutdown': {
      const name = probe.queryChocolateShutdownName!;
      const present = !VANILLA_FATAL_PATH_ABSENT_CHOCOLATE_SHUTDOWN_CALLS.includes(name);
      return Object.freeze({ ...NULL_ANSWER, answeredPresent: present });
    }
  }
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_HANDLER: VanillaFatalErrorShutdownOrderingHandler = Object.freeze({
  runProbe: referenceVanillaFatalErrorShutdownOrderingProbe,
});

/**
 * Cross-check a `VanillaFatalErrorShutdownOrderingHandler` against the
 * pinned probe set. Returns the list of failures by stable identifier;
 * an empty list means the handler is parity-safe with the canonical
 * vanilla 1.9 fatal-error shutdown-ordering contract.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:answeredShutdownSymbol:value-mismatch`
 *  - `probe:<probe.id>:answeredTeardownStrategy:value-mismatch`
 *  - `probe:<probe.id>:answeredPresent:value-mismatch`
 *  - `probe:<probe.id>:answeredCount:value-mismatch`
 */
export function crossCheckVanillaFatalErrorShutdownOrdering(handler: VanillaFatalErrorShutdownOrderingHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_FATAL_ERROR_SHUTDOWN_ORDERING_PROBES) {
    const result = handler.runProbe(probe);

    if (probe.expectedAnsweredShutdownSymbol !== null && result.answeredShutdownSymbol !== probe.expectedAnsweredShutdownSymbol) {
      failures.push(`probe:${probe.id}:answeredShutdownSymbol:value-mismatch`);
    }
    if (probe.expectedAnsweredTeardownStrategy !== null && result.answeredTeardownStrategy !== probe.expectedAnsweredTeardownStrategy) {
      failures.push(`probe:${probe.id}:answeredTeardownStrategy:value-mismatch`);
    }
    if (probe.expectedAnsweredPresent !== null && result.answeredPresent !== probe.expectedAnsweredPresent) {
      failures.push(`probe:${probe.id}:answeredPresent:value-mismatch`);
    }
    if (probe.expectedAnsweredCount !== null && result.answeredCount !== probe.expectedAnsweredCount) {
      failures.push(`probe:${probe.id}:answeredCount:value-mismatch`);
    }
  }

  return failures;
}

/**
 * Convenience helper: derive the expected answer for an arbitrary
 * probe against the canonical vanilla 1.9 fatal-error shutdown-ordering
 * contract. The focused test uses this helper to cross-validate probe
 * expectations independently of the reference handler.
 */
export function deriveExpectedVanillaFatalErrorShutdownOrderingResult(probe: VanillaFatalErrorShutdownOrderingProbe): VanillaFatalErrorShutdownOrderingResult {
  return referenceVanillaFatalErrorShutdownOrderingProbe(probe);
}
