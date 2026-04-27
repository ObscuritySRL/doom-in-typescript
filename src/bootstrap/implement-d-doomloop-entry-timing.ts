/**
 * Audit ledger for the vanilla DOOM 1.9 `D_DoomLoop` entry-timing
 * skeleton inside id Software's `linuxdoom-1.10/d_main.c`. The
 * accompanying focused test cross-checks every audited contract clause
 * against a self-contained reference handler that walks the canonical
 * pre-loop entry sequence the same way vanilla `D_DoomLoop` does.
 *
 * The canonical vanilla DOOM 1.9 `D_DoomLoop` entry surface is the
 * verbatim sequence of three pre-loop operations that fire before the
 * perpetual `while (1)` frame loop opens:
 *
 *   1. `if (demorecording) G_BeginRecording();` — gated on the
 *      `demorecording` flag, no stdout side-effect.
 *   2. `if (M_CheckParm("-debugfile")) { ... }` — gated on the
 *      `-debugfile` command-line parm; the body builds a per-player
 *      filename via `sprintf(filename,"debug%i.txt",consoleplayer)`,
 *      prints the verbatim line `"debug output to: %s\n"` with the
 *      filename, then opens the file via `fopen(filename,"w")`.
 *   3. `I_InitGraphics();` — unconditional, fires every entry. No
 *      stdout side-effect inside `D_DoomLoop` itself.
 *
 * Immediately after `I_InitGraphics`, vanilla opens the perpetual
 * `while (1)` frame loop whose first statement is `I_StartFrame();`
 * (the frame-synchronous IO call). The loop has no exit condition;
 * vanilla relies on `I_Quit` and `I_Error` (called from inside
 * callees) to terminate the process. The frame cadence is governed by
 * `TICRATE = 35` (defined in `i_timer.h`), the canonical 35 Hz tic
 * rate of vanilla DOOM.
 *
 * Vanilla DOOM 1.9 `D_DoomLoop` does NOT contain any of the eleven
 * Chocolate Doom 2.2.1 entry-time additions:
 *
 *   - The BFG-Edition compatibility-warning printf block at the very
 *     start of `D_DoomLoop` (`if (bfgedition && (demorecording || ...))
 *     { printf(" WARNING: ...\n"); }`).
 *   - The `main_loop_started = true;` boolean flag set immediately
 *     after the `demorecording` branch.
 *   - The single pre-loop `TryRunTics();` call that primes the tic
 *     accumulator before `I_InitGraphics`.
 *   - The `I_SetWindowTitle(gamedescription);` call.
 *   - The `I_GraphicsCheckCommandLine();` call.
 *   - The `I_SetGrabMouseCallback(D_GrabMouseCallback);` call.
 *   - The `EnableLoadingDisk();` call after `I_InitGraphics`.
 *   - The `V_RestoreBuffer();` call after `EnableLoadingDisk`.
 *   - The `R_ExecuteSetViewSize();` call after `V_RestoreBuffer`.
 *   - The `D_StartGameLoop();` call after `R_ExecuteSetViewSize`.
 *   - The `if (testcontrols) { wipegamestate = gamestate; }` branch
 *     that disables wipe transitions in the Chocolate test-controls
 *     mode.
 *
 * The Chocolate `while (1)` body delegates per-frame work to a single
 * `D_RunFrame();` call; vanilla inlines the same per-frame work
 * (`I_StartFrame`, tic processing, `S_UpdateSounds`, `D_Display`, and
 * the optional `I_UpdateSound`/`I_SubmitSound` macro-gated tail) inside
 * the loop body. The audit pins `I_StartFrame` as the first per-frame
 * call because that is the visible boundary between entry-time work
 * and frame-time work in vanilla.
 *
 * No runtime `D_DoomLoop` skeleton drives the `bun run doom.ts`
 * entrypoint yet — `src/mainLoop.ts` models a Chocolate-shaped
 * `MainLoop` (with `initialTryRunTics → restoreBuffer →
 * executeSetViewSize → startGameLoop` pre-loop and `startFrame →
 * tryRunTics → updateSounds → display` per-frame) that is NOT the
 * vanilla 1.9 contract. This step pins the vanilla-1.9-only entry-
 * timing contract so a later implementation step (or an oracle follow-
 * up that observes `doom/DOOMD.EXE` directly) can be cross-checked for
 * parity. The audit module deliberately avoids importing from any
 * runtime main-loop module so that a corrupted runtime cannot silently
 * calibrate the audit's own probe table.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the
 *      `D_DoomLoop` entry skeleton — `d_main.c` `D_DoomLoop()` is the
 *      verbatim source of the three pre-loop operations, the
 *      conditional gates on `demorecording` and `-debugfile`, the
 *      `debug%i.txt` filename format, the `"debug output to: %s\n"`
 *      printf literal, the unconditional `I_InitGraphics();` call, the
 *      `while (1)` perpetual loop, and the `I_StartFrame();` first
 *      per-frame call; `i_timer.h` is the verbatim source of
 *      `TICRATE = 35`),
 *   5. Chocolate Doom 2.2.1 source.
 *
 * The audit invariants below are pinned against authority 4 because
 * the entry skeleton is a textual property of `D_DoomLoop`: a fixed
 * three-operation pre-loop sequence followed by a perpetual frame
 * loop whose first statement is `I_StartFrame`. Authority 1 (the DOS
 * binary) cannot disagree because the entry-time work is the visible
 * pre-condition every vanilla startup path produces; authority 5
 * (Chocolate Doom 2.2.1) deliberately diverges (it adds eleven entry-
 * time operations) and so is NOT the authority for this audit even
 * though it covers a superset of the surface.
 */

/**
 * Phase classification of one vanilla `D_DoomLoop` entry-time step.
 *
 * - `pre-loop` covers the three operations that fire before the
 *   `while (1)` frame loop opens (G_BeginRecording, debugfile setup,
 *   I_InitGraphics).
 * - `frame-loop-first` covers the first per-frame call inside the
 *   loop body (`I_StartFrame` in vanilla).
 *
 * The audit does not classify the rest of the per-frame work because
 * those calls are scheduled by the per-frame ordering audit (a
 * separate step, 04-015 / 04-014) rather than by the entry-timing
 * audit pinned here.
 */
export type VanillaDoomLoopEntryStepPhase = 'pre-loop' | 'frame-loop-first';

/**
 * Discriminator of the C-source-level condition that gates a vanilla
 * `D_DoomLoop` entry-time operation.
 *
 * - `demorecording-flag-set` matches `if (demorecording)` — the gate
 *   on the `G_BeginRecording` call.
 * - `debugfile-parm-present` matches `if (M_CheckParm("-debugfile"))`
 *   — the gate on the per-player debug-file setup block.
 * - `always` matches an unconditional call (no gating expression). In
 *   vanilla the only unconditional pre-loop op is `I_InitGraphics`.
 */
export type VanillaDoomLoopEntryStepCondition = 'demorecording-flag-set' | 'debugfile-parm-present' | 'always';

/**
 * Verbatim symbol of a vanilla DOOM 1.9 `D_DoomLoop` entry-time step.
 *
 * The three pre-loop steps are pinned by their canonical names. The
 * `debugfileSetup` step is named after the role the block plays
 * (per-player debug-file open) rather than a single C function call;
 * vanilla does not factor the block into a named helper.
 */
export type VanillaDoomLoopEntryStepName = 'G_BeginRecording' | 'debugfileSetup' | 'I_InitGraphics';

/**
 * One entry-time step pinned by the canonical vanilla 1.9 sequence.
 */
export interface VanillaDoomLoopEntryStep {
  /** 0-based index in the canonical 3-step pre-loop sequence. */
  readonly index: number;
  /** Verbatim step name. */
  readonly opName: VanillaDoomLoopEntryStepName;
  /** Condition under which the step fires. */
  readonly condition: VanillaDoomLoopEntryStepCondition;
  /** Phase classification. */
  readonly phase: VanillaDoomLoopEntryStepPhase;
  /**
   * Verbatim printf literal the step prints, or `null` when the step
   * has no stdout side-effect inside `D_DoomLoop` itself. In vanilla
   * only the `debugfileSetup` step prints — the literal is
   * `"debug output to: %s\n"` (with the `%s` filled in by `sprintf`).
   */
  readonly printfLiteral: string | null;
}

/** Verbatim canonical 35 Hz tic rate (`TICRATE` in `i_timer.h`). */
export const VANILLA_D_DOOMLOOP_TICRATE_HZ = 35;

/** Canonical first per-frame call inside the `while (1)` body. */
export const VANILLA_D_DOOMLOOP_FRAME_LOOP_FIRST_CALL_C_SYMBOL = 'I_StartFrame';

/**
 * Whether vanilla `D_DoomLoop`'s frame loop has an explicit exit
 * condition. It does not — the vanilla source uses `while (1)` and
 * relies on `I_Quit`/`I_Error` callees to terminate the process. Any
 * handler that reports `true` for this is a parity violation.
 */
export const VANILLA_D_DOOMLOOP_FRAME_LOOP_HAS_EXIT_CONDITION = false;

/**
 * Verbatim filename format string used by vanilla's debugfile setup
 * block (`sprintf(filename,"debug%i.txt",consoleplayer)`). The literal
 * `%i` (rather than `%d`) is a vanilla-1.9 idiosyncrasy that any
 * cross-platform port must preserve to match the DOS binary's filename
 * fingerprint (the per-player file ends up being named `debug0.txt`,
 * `debug1.txt`, etc.).
 */
export const VANILLA_D_DOOMLOOP_DEBUGFILE_FILENAME_FORMAT = 'debug%i.txt';

/**
 * Verbatim `fopen` mode used by vanilla's debugfile setup block
 * (`debugfile = fopen(filename,"w")`). The literal `"w"` (write,
 * truncate) is the canonical vanilla mode; any handler that uses
 * `"a"` (append) or any other mode is a parity violation.
 */
export const VANILLA_D_DOOMLOOP_DEBUGFILE_FOPEN_MODE = 'w';

/**
 * Verbatim printf literal emitted by the debugfile setup block
 * (`printf("debug output to: %s\n",filename)`). The literal `%s`
 * placeholder is filled in with the per-player filename.
 */
export const VANILLA_D_DOOMLOOP_DEBUGFILE_PRINTF_LITERAL = 'debug output to: %s\n';

/**
 * Verbatim command-line parm string the debugfile setup block tests
 * via `M_CheckParm("-debugfile")`. The leading hyphen is part of the
 * literal (the vanilla `M_CheckParm` matcher requires the leading
 * dash).
 */
export const VANILLA_D_DOOMLOOP_DEBUGFILE_PARM_LITERAL = '-debugfile';

/**
 * Frozen canonical 3-step entry-time sequence pinned by vanilla DOOM
 * 1.9 `D_DoomLoop`. The three pre-loop steps fire in the verbatim
 * order G_BeginRecording → debugfileSetup → I_InitGraphics; only the
 * third (`I_InitGraphics`) is unconditional.
 */
export const VANILLA_D_DOOMLOOP_ENTRY_ORDER: readonly VanillaDoomLoopEntryStep[] = Object.freeze([
  Object.freeze({ index: 0, opName: 'G_BeginRecording', condition: 'demorecording-flag-set', phase: 'pre-loop', printfLiteral: null } satisfies VanillaDoomLoopEntryStep),
  Object.freeze({ index: 1, opName: 'debugfileSetup', condition: 'debugfile-parm-present', phase: 'pre-loop', printfLiteral: 'debug output to: %s\n' } satisfies VanillaDoomLoopEntryStep),
  Object.freeze({ index: 2, opName: 'I_InitGraphics', condition: 'always', phase: 'pre-loop', printfLiteral: null } satisfies VanillaDoomLoopEntryStep),
]);

/** Total number of pre-loop steps in vanilla `D_DoomLoop` entry timing. */
export const VANILLA_D_DOOMLOOP_PRE_LOOP_STEP_COUNT = 3;

/**
 * Symbols/operations that appear in Chocolate Doom 2.2.1's
 * `D_DoomLoop` entry sequence but NOT in vanilla DOOM 1.9's. A
 * vanilla-1.9 handler must report `false` for "is this op present in
 * the entry sequence?" for every entry in this list.
 *
 * The eleven Chocolate-only entry-time additions are:
 *   - `bfgEditionWarning` — the 4-line printf-block at the start of
 *     Chocolate's `D_DoomLoop` warning about Doom 3: BFG-Edition IWADs
 *     desyncing demos and net games.
 *   - `mainLoopStartedFlag` — the `main_loop_started = true;`
 *     assignment Chocolate uses as a tripwire for late-init guards.
 *   - `preLoopTryRunTics` — the single `TryRunTics();` call Chocolate
 *     issues before `I_InitGraphics` to prime the tic accumulator.
 *   - `I_SetWindowTitle` — Chocolate's window-title call,
 *     `I_SetWindowTitle(gamedescription);`.
 *   - `I_GraphicsCheckCommandLine` — Chocolate's parsing of `-grabmouse`
 *     and related video-host parms.
 *   - `I_SetGrabMouseCallback` — Chocolate's
 *     `I_SetGrabMouseCallback(D_GrabMouseCallback);` registration.
 *   - `EnableLoadingDisk` — Chocolate's loading-disk-icon enabler
 *     after `I_InitGraphics`.
 *   - `V_RestoreBuffer` — Chocolate's `V_RestoreBuffer();` call after
 *     `EnableLoadingDisk`.
 *   - `R_ExecuteSetViewSize` — Chocolate's deferred view-size apply
 *     after `V_RestoreBuffer`.
 *   - `D_StartGameLoop` — Chocolate's
 *     `D_StartGameLoop();` timer-priming call.
 *   - `testcontrolsBranch` — Chocolate's `if (testcontrols)
 *     { wipegamestate = gamestate; }` branch that disables wipe
 *     transitions in test-controls mode.
 */
export const VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OPS: readonly string[] = Object.freeze([
  'bfgEditionWarning',
  'mainLoopStartedFlag',
  'preLoopTryRunTics',
  'I_SetWindowTitle',
  'I_GraphicsCheckCommandLine',
  'I_SetGrabMouseCallback',
  'EnableLoadingDisk',
  'V_RestoreBuffer',
  'R_ExecuteSetViewSize',
  'D_StartGameLoop',
  'testcontrolsBranch',
]);

/** Number of Chocolate-only entry-time ops absent from the vanilla 1.9 sequence. */
export const VANILLA_D_DOOMLOOP_ABSENT_CHOCOLATE_OP_COUNT = 11;

/**
 * One audited contract invariant of the vanilla DOOM 1.9 `D_DoomLoop`
 * entry-timing skeleton.
 */
export interface VanillaDDoomLoopEntryTimingContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'ENTRY_HAS_THREE_PRE_LOOP_OPERATIONS'
    | 'ENTRY_FIRST_OP_IS_CONDITIONAL_G_BEGINRECORDING'
    | 'ENTRY_SECOND_OP_IS_CONDITIONAL_DEBUGFILE_SETUP'
    | 'ENTRY_THIRD_OP_IS_UNCONDITIONAL_I_INITGRAPHICS'
    | 'ENTRY_DEBUGFILE_FILENAME_FORMAT_IS_DEBUG_PERCENT_I_TXT'
    | 'ENTRY_DEBUGFILE_PRINTF_LITERAL_IS_DEBUG_OUTPUT_TO_PERCENT_S_NEWLINE'
    | 'ENTRY_DEBUGFILE_FOPEN_MODE_IS_WRITE'
    | 'ENTRY_DEBUGFILE_PARM_LITERAL_IS_DASH_DEBUGFILE'
    | 'ENTRY_FRAME_LOOP_FIRST_CALL_IS_I_STARTFRAME'
    | 'ENTRY_FRAME_LOOP_HAS_NO_EXIT_CONDITION'
    | 'ENTRY_FRAME_LOOP_TIC_RATE_IS_THIRTY_FIVE_HZ'
    | 'ENTRY_OMITS_BFG_EDITION_WARNING_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_MAIN_LOOP_STARTED_FLAG_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_PRELOOP_TRYRUNTICS_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_I_SETWINDOWTITLE_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_I_GRAPHICSCHECKCOMMANDLINE_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_I_SETGRABMOUSECALLBACK_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_ENABLELOADINGDISK_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_V_RESTOREBUFFER_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_R_EXECUTESETVIEWSIZE_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_D_STARTGAMELOOP_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_OMITS_TESTCONTROLS_BRANCH_PRESENT_ONLY_IN_CHOCOLATE'
    | 'ENTRY_PRELOOP_OPS_PRECEDE_FRAME_LOOP_FIRST_CALL';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'd_main.c' | 'i_timer.h';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'D_DoomLoop' | 'TICRATE';
}

/**
 * Pinned ledger of every contract clause of the vanilla DOOM 1.9
 * `D_DoomLoop` entry-timing skeleton.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_AUDIT: readonly VanillaDDoomLoopEntryTimingContractAuditEntry[] = [
  {
    id: 'ENTRY_HAS_THREE_PRE_LOOP_OPERATIONS',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` performs exactly three operations before opening the perpetual `while (1)` frame loop. The three operations are (in canonical order): a conditional `G_BeginRecording` gated by `demorecording`, a conditional debugfile-setup block gated by `M_CheckParm("-debugfile")`, and an unconditional `I_InitGraphics();` call. Adding a fourth pre-loop operation (e.g., a Chocolate-Doom-2.2.1-style `main_loop_started = true;` assignment, a `TryRunTics();` priming call, an `I_SetWindowTitle`/`I_GraphicsCheckCommandLine`/`I_SetGrabMouseCallback` triple, an `EnableLoadingDisk();` call, a `V_RestoreBuffer();` call, an `R_ExecuteSetViewSize();` call, a `D_StartGameLoop();` call, or a `testcontrols` branch) is a parity violation against vanilla; removing one of the three is also a parity violation. The count is three and only three.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_FIRST_OP_IS_CONDITIONAL_G_BEGINRECORDING',
    invariant:
      'The first pre-loop operation in vanilla `D_DoomLoop` is `G_BeginRecording()`, gated by the `demorecording` flag (`if (demorecording) G_BeginRecording();`). When `demorecording` is false the call is skipped entirely; when true the call fires as the very first entry-time action — there is no prior pre-loop work in vanilla. The call has no stdout side-effect inside `D_DoomLoop` itself (G_BeginRecording opens the demo file via `M_WriteFile` in `g_game.c`, but emits no `printf` line at the entry-time level).',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_SECOND_OP_IS_CONDITIONAL_DEBUGFILE_SETUP',
    invariant:
      'The second pre-loop operation in vanilla `D_DoomLoop` is the per-player debugfile-setup block, gated by `M_CheckParm("-debugfile")`. The block: (1) builds a per-player filename via `sprintf(filename,"debug%i.txt",consoleplayer)`, (2) prints the verbatim line `"debug output to: %s\\n"` with the filename, and (3) opens the file for write via `debugfile = fopen(filename,"w")`. When the `-debugfile` parm is absent the entire block is skipped; the printf line is the only stdout side-effect of the entry-time path other than what occurs inside `I_InitGraphics`.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_THIRD_OP_IS_UNCONDITIONAL_I_INITGRAPHICS',
    invariant:
      'The third and last pre-loop operation in vanilla `D_DoomLoop` is the unconditional `I_InitGraphics();` call. Unlike the prior two operations, this call has no gating expression — it fires every entry. After `I_InitGraphics` returns, the perpetual `while (1)` frame loop opens immediately; there are no further pre-loop calls. (Chocolate Doom 2.2.1 inserts seven additional calls — `EnableLoadingDisk`, `V_RestoreBuffer`, `R_ExecuteSetViewSize`, `D_StartGameLoop`, the `testcontrols` branch, plus the three host-config calls before `I_InitGraphics` — none of which are vanilla.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_DEBUGFILE_FILENAME_FORMAT_IS_DEBUG_PERCENT_I_TXT',
    invariant:
      'The vanilla debugfile-setup block uses the verbatim `sprintf` format string `"debug%i.txt"` to construct the per-player filename. The literal `%i` (rather than `%d` or `%u`) is a vanilla-1.9 idiosyncrasy preserved verbatim from the linuxdoom-1.10 source; while `%i` and `%d` produce identical output for non-negative `consoleplayer` values, the literal pinned in the source is `%i`. A handler that uses `"debug%d.txt"` is a parity violation against the vanilla source-literal fingerprint.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_DEBUGFILE_PRINTF_LITERAL_IS_DEBUG_OUTPUT_TO_PERCENT_S_NEWLINE',
    invariant:
      'The vanilla debugfile-setup block emits the verbatim printf literal `"debug output to: %s\\n"` with the per-player filename filled into `%s`. The literal includes a single space after the colon, no leading newline, and a single trailing newline. Modifying the literal — capitalisation, punctuation, whitespace, the `%s` placeholder — is a parity violation against the vanilla stdout fingerprint that any debug-trace oracle will observe.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_DEBUGFILE_FOPEN_MODE_IS_WRITE',
    invariant:
      'The vanilla debugfile-setup block opens the per-player file for write via `fopen(filename,"w")`. The mode literal is `"w"` (write, truncate) — not `"a"` (append) or `"w+"` (read/write/truncate). A handler that opens the debug file in append or read/write mode is a parity violation against vanilla DOS behavior, where launching twice with `-debugfile` produces a fresh per-player log on each run.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_DEBUGFILE_PARM_LITERAL_IS_DASH_DEBUGFILE',
    invariant:
      'The vanilla debugfile-setup block is gated by the verbatim parm string `"-debugfile"` (with a leading hyphen — `M_CheckParm` requires the dash). Any handler that gates the block on `"debugfile"` (no dash) or any other literal is a parity violation against the vanilla command-line fingerprint.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_FRAME_LOOP_FIRST_CALL_IS_I_STARTFRAME',
    invariant:
      'Immediately after `I_InitGraphics();` returns, vanilla `D_DoomLoop` opens the perpetual `while (1)` frame loop whose first statement is `I_StartFrame();` (the frame-synchronous IO call). `I_StartFrame` is the visible boundary between entry-time work and frame-time work in vanilla. Chocolate Doom 2.2.1 instead delegates the entire per-frame body to a single `D_RunFrame();` call; vanilla inlines `I_StartFrame` directly inside the `while (1)` body.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_FRAME_LOOP_HAS_NO_EXIT_CONDITION',
    invariant:
      'Vanilla `D_DoomLoop` uses `while (1)` for the frame loop — there is no explicit exit condition. The process terminates only via `I_Quit` or `I_Error` callees inside per-frame work (e.g., from the menu QUIT path or from a fatal error). A handler that reports an explicit exit condition (`while (!quit)` or similar) is a parity violation: vanilla intentionally has no boolean exit gate, and any port that adds one risks shadowing the `I_Quit`/`I_Error` shutdown path that `quitFlow.ts` mirrors.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_FRAME_LOOP_TIC_RATE_IS_THIRTY_FIVE_HZ',
    invariant:
      'The vanilla DOOM 1.9 frame loop runs at the canonical 35 Hz tic rate pinned by `TICRATE = 35` in `i_timer.h`. Every per-frame body — including the Chocolate-only `D_RunFrame` and the vanilla-only inlined `I_StartFrame → tic processing → S_UpdateSounds → D_Display` sequence — assumes 35 ticks per second. Reporting a different tic rate is a parity violation against the foundational vanilla cadence.',
    referenceSourceFile: 'i_timer.h',
    cSymbol: 'TICRATE',
  },
  {
    id: 'ENTRY_OMITS_BFG_EDITION_WARNING_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT print the Chocolate Doom 2.2.1 BFG-Edition compatibility-warning block at function entry. Chocolate prints a four-line `printf(" WARNING: ...");` block when `bfgedition && (demorecording || (gameaction == ga_playdemo) || netgame)`; vanilla 1.9 has no `bfgedition` flag, no such warning, and no awareness of Doom 3: BFG-Edition IWAD layouts. A handler that emits the BFG-Edition warning in the vanilla-1.9 entry order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_MAIN_LOOP_STARTED_FLAG_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT set a `main_loop_started = true;` boolean flag. `main_loop_started` is a Chocolate Doom 2.2.1 addition that the host uses to gate late-init guards (e.g., to suppress some warning prints once the loop has been entered); vanilla 1.9 has no such flag and no such gating. A handler that sets a main-loop-started tripwire in the vanilla entry order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_PRELOOP_TRYRUNTICS_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT call `TryRunTics()` before entering the `while (1)` loop. The single pre-loop `TryRunTics();` priming call is a Chocolate Doom 2.2.1 addition that runs at least one tic before `I_InitGraphics` to populate the tic accumulator; vanilla 1.9 calls `TryRunTics()` only inside the per-frame body (and only when `singletics` is false). A handler that primes the tic accumulator before entering the frame loop is a parity violation against vanilla.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_I_SETWINDOWTITLE_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT call `I_SetWindowTitle(gamedescription)`. `I_SetWindowTitle` is a Chocolate Doom 2.2.1 addition that propagates the gamemode-derived banner (`gamedescription`) into the SDL window title bar; vanilla 1.9 has no SDL window and no equivalent call (the DOS build has no separate window-title concept). A handler that sets a window title in the vanilla entry order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_I_GRAPHICSCHECKCOMMANDLINE_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT call `I_GraphicsCheckCommandLine()`. `I_GraphicsCheckCommandLine` is a Chocolate Doom 2.2.1 addition that parses video-host command-line parms (`-grabmouse`, `-novert`, `-nograb`, etc.) at entry-time; vanilla 1.9 reads its video-host config statically inside `I_Init`. A handler that parses video-host command-line flags during `D_DoomLoop` entry is a parity violation against vanilla.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_I_SETGRABMOUSECALLBACK_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT call `I_SetGrabMouseCallback(D_GrabMouseCallback)`. `I_SetGrabMouseCallback` is a Chocolate Doom 2.2.1 addition that registers the runtime mouse-grab policy callback; vanilla 1.9 has no mouse-grab callback (the DOS build grabs the mouse unconditionally). A handler that registers a grab-mouse callback in the vanilla entry order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_ENABLELOADINGDISK_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT call `EnableLoadingDisk()`. `EnableLoadingDisk` is a Chocolate Doom 2.2.1 addition that enables the loading-disk-icon overlay (the small spinning disk in the corner during long blocks like map load); vanilla 1.9 emits the disk icon directly inside `I_BeginRead`/`I_EndRead` calls scattered through `w_wad.c` and `r_data.c`, without a separate enabler. A handler that enables a loading-disk overlay in the vanilla entry order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_V_RESTOREBUFFER_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT call `V_RestoreBuffer()`. `V_RestoreBuffer` is a Chocolate Doom 2.2.1 addition that restores the back buffer pointer to the SDL surface after `EnableLoadingDisk` swaps it out; vanilla 1.9 has no SDL surface and no equivalent restore. A handler that restores a video buffer pointer in the vanilla entry order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_R_EXECUTESETVIEWSIZE_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT call `R_ExecuteSetViewSize()`. `R_ExecuteSetViewSize` is a Chocolate Doom 2.2.1 addition that applies the deferred view-size change (`setsizeneeded`) immediately at entry-time; vanilla 1.9 defers the call to `R_RenderPlayerView` inside the per-frame body. A handler that applies a deferred view-size change during `D_DoomLoop` entry is a parity violation against vanilla.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_D_STARTGAMELOOP_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT call `D_StartGameLoop()`. `D_StartGameLoop` is a Chocolate Doom 2.2.1 addition that initialises the game-loop timer (sets `oldentertics`, etc.) before the perpetual loop opens; vanilla 1.9 has no equivalent timer-priming call (the per-frame `I_GetTime` queries cover the same role implicitly). A handler that primes a game-loop timer in the vanilla entry order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_OMITS_TESTCONTROLS_BRANCH_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomLoop` does NOT contain an `if (testcontrols) { wipegamestate = gamestate; }` branch. The `testcontrols` mode is a Chocolate Doom 2.2.1 addition that lets users test their input config without entering a game; the branch disables wipe transitions in that mode. Vanilla 1.9 has no `testcontrols` flag and no `wipegamestate` patching at entry-time. A handler that contains a testcontrols branch in the vanilla entry order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
  {
    id: 'ENTRY_PRELOOP_OPS_PRECEDE_FRAME_LOOP_FIRST_CALL',
    invariant:
      'All three pre-loop ops (`G_BeginRecording`, `debugfileSetup`, `I_InitGraphics`) precede the first per-frame call (`I_StartFrame`) in the canonical vanilla `D_DoomLoop` source ordering. The pre-loop ops are textually above the `while (1)` brace; the first per-frame call is the first statement inside the brace. A handler that schedules `I_StartFrame` before `I_InitGraphics` (or any other pre-loop op) is a parity violation: the frame loop cannot legally begin until the host graphics subsystem has been initialised.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomLoop',
  },
] as const;

/** Number of audited contract clauses pinned by the ledger. */
export const VANILLA_D_DOOMLOOP_ENTRY_TIMING_CONTRACT_CLAUSE_COUNT = 23;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity D_DoomLoop entry-timing handler must
 * preserve.
 */
export interface VanillaDDoomLoopEntryTimingDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANTS: readonly VanillaDDoomLoopEntryTimingDerivedInvariant[] = [
  {
    id: 'ENTRY_HAS_EXACTLY_THREE_PRE_LOOP_OPS',
    description: 'The vanilla 1.9 D_DoomLoop entry sequence has exactly three pre-loop operations. A handler reporting more than 3 (e.g., the way Chocolate Doom 2.2.1 does with eleven additions) or fewer than 3 is a parity violation.',
  },
  {
    id: 'ENTRY_PRE_LOOP_ORDER_IS_GBR_DEBUGFILE_IINITGRAPHICS',
    description: 'The pre-loop phase walks the operations in the exact order G_BeginRecording → debugfileSetup → I_InitGraphics. Reordering any pair (e.g., placing I_InitGraphics before debugfileSetup) is a parity violation.',
  },
  {
    id: 'ENTRY_G_BEGINRECORDING_IS_GATED_BY_DEMORECORDING_FLAG',
    description: 'G_BeginRecording in vanilla is gated by `if (demorecording)`. A handler that calls G_BeginRecording unconditionally — or gates it on a different flag — is a parity violation.',
  },
  {
    id: 'ENTRY_DEBUGFILE_SETUP_IS_GATED_BY_DEBUGFILE_PARM',
    description: 'The debugfile-setup block in vanilla is gated by `M_CheckParm("-debugfile")`. A handler that runs the block unconditionally — or gates it on a different parm name — is a parity violation.',
  },
  {
    id: 'ENTRY_I_INITGRAPHICS_IS_UNCONDITIONAL',
    description: 'I_InitGraphics in vanilla is unconditional. A handler that gates I_InitGraphics on any flag or parm is a parity violation.',
  },
  {
    id: 'ENTRY_DEBUGFILE_FILENAME_FORMAT_AND_FOPEN_MODE_ARE_VERBATIM',
    description:
      'The debugfile filename format `"debug%i.txt"` and fopen mode `"w"` are verbatim source literals. A handler that uses `"debug%d.txt"`, `"a"`, or any other literal is a parity violation against the vanilla source-literal fingerprint.',
  },
  {
    id: 'ENTRY_DEBUGFILE_PRINTF_LITERAL_IS_VERBATIM',
    description:
      'The debugfile printf literal `"debug output to: %s\\n"` is the verbatim vanilla stdout fingerprint. A handler that emits a different literal — punctuation, capitalisation, whitespace, or a different placeholder — is a parity violation.',
  },
  {
    id: 'ENTRY_FRAME_LOOP_FIRST_CALL_IS_I_STARTFRAME_NOT_D_RUNFRAME',
    description: 'The first per-frame call inside the vanilla `while (1)` body is `I_StartFrame`. A handler that reports `D_RunFrame` (the Chocolate-style delegated body) as the first per-frame call is a parity violation.',
  },
  {
    id: 'ENTRY_FRAME_LOOP_HAS_NO_BOOLEAN_EXIT_GATE',
    description: 'The vanilla frame loop is `while (1)` — no explicit exit condition. A handler that reports an explicit exit gate is a parity violation.',
  },
  {
    id: 'ENTRY_TICRATE_IS_THIRTY_FIVE',
    description: 'The vanilla tic rate is 35 Hz (TICRATE = 35 in i_timer.h). A handler that reports a different tic rate (e.g., 30, 60, 70) is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_BFG_EDITION_WARNING',
    description: 'Vanilla 1.9 has no BFG-Edition compatibility-warning at D_DoomLoop entry. A handler that includes this warning is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_MAIN_LOOP_STARTED_FLAG',
    description: 'Vanilla 1.9 has no main_loop_started flag set at D_DoomLoop entry. A handler that sets such a flag is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_PRELOOP_TRYRUNTICS',
    description: 'Vanilla 1.9 has no pre-loop TryRunTics priming call. A handler that primes the tic accumulator before entering the frame loop is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_I_SETWINDOWTITLE',
    description: 'Vanilla 1.9 has no I_SetWindowTitle call at D_DoomLoop entry. A handler that sets a window title is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_I_GRAPHICSCHECKCOMMANDLINE',
    description: 'Vanilla 1.9 has no I_GraphicsCheckCommandLine call at D_DoomLoop entry. A handler that parses video-host command-line flags is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_I_SETGRABMOUSECALLBACK',
    description: 'Vanilla 1.9 has no I_SetGrabMouseCallback registration at D_DoomLoop entry. A handler that registers a grab-mouse callback is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_ENABLELOADINGDISK',
    description: 'Vanilla 1.9 has no EnableLoadingDisk call at D_DoomLoop entry. A handler that enables a loading-disk overlay is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_V_RESTOREBUFFER',
    description: 'Vanilla 1.9 has no V_RestoreBuffer call at D_DoomLoop entry. A handler that restores a video buffer pointer is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_R_EXECUTESETVIEWSIZE',
    description: 'Vanilla 1.9 has no R_ExecuteSetViewSize call at D_DoomLoop entry. A handler that applies a deferred view-size change at entry is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_D_STARTGAMELOOP',
    description: 'Vanilla 1.9 has no D_StartGameLoop call at D_DoomLoop entry. A handler that primes a game-loop timer at entry is a parity violation.',
  },
  {
    id: 'ENTRY_OMITS_TESTCONTROLS_BRANCH',
    description: 'Vanilla 1.9 has no testcontrols branch at D_DoomLoop entry. A handler that contains a testcontrols branch is a parity violation.',
  },
  {
    id: 'ENTRY_PRELOOP_OPS_PRECEDE_FRAME_LOOP',
    description: 'All three pre-loop ops textually precede the `while (1)` body in vanilla source ordering. A handler that swaps any pre-loop op with the frame-loop boundary is a parity violation.',
  },
];

/** Number of derived invariants. */
export const VANILLA_D_DOOMLOOP_ENTRY_TIMING_DERIVED_INVARIANT_COUNT = 22;

/**
 * Discriminator for one probe-style query against the canonical
 * vanilla 1.9 `D_DoomLoop` entry-timing skeleton.
 *
 * - `op-at-index`: ask the handler what op it places at the given
 *   0-based pre-loop index.
 * - `op-condition`: ask the handler the gating condition of the named
 *   op.
 * - `op-presence`: ask the handler whether the named op is present in
 *   the entry sequence at all.
 * - `op-printf-literal`: ask the handler the verbatim printf literal
 *   the named op emits, or `null` when the op has no stdout
 *   side-effect at the entry-time level.
 * - `pre-loop-op-count`: ask the handler the total pre-loop step
 *   count.
 * - `frame-loop-first-call`: ask the handler the C symbol of the
 *   first per-frame call inside the `while (1)` body.
 * - `frame-loop-has-exit`: ask the handler whether the frame loop
 *   has an explicit exit condition.
 * - `tic-rate-hz`: ask the handler the canonical tic rate.
 * - `debugfile-filename-format`: ask the handler the verbatim
 *   `sprintf` format string used by the debugfile-setup block.
 * - `debugfile-fopen-mode`: ask the handler the verbatim `fopen`
 *   mode used by the debugfile-setup block.
 * - `debugfile-printf-literal`: ask the handler the verbatim printf
 *   literal emitted by the debugfile-setup block.
 * - `debugfile-parm-literal`: ask the handler the verbatim parm
 *   literal that gates the debugfile-setup block.
 * - `op-precedes-op`: ask the handler whether the first named op
 *   precedes the second named op in the canonical source ordering.
 */
export type VanillaDDoomLoopEntryTimingQueryKind =
  | 'op-at-index'
  | 'op-condition'
  | 'op-presence'
  | 'op-printf-literal'
  | 'pre-loop-op-count'
  | 'frame-loop-first-call'
  | 'frame-loop-has-exit'
  | 'tic-rate-hz'
  | 'debugfile-filename-format'
  | 'debugfile-fopen-mode'
  | 'debugfile-printf-literal'
  | 'debugfile-parm-literal'
  | 'op-precedes-op';

/**
 * One probe applied to a runtime vanilla `D_DoomLoop` entry-timing
 * handler.
 */
export interface VanillaDDoomLoopEntryTimingProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Discriminator for the query kind. */
  readonly queryKind: VanillaDDoomLoopEntryTimingQueryKind;
  /** Numeric query argument (0-based index for `op-at-index`). */
  readonly queryIndex: number | null;
  /** Op-name query argument (the queried op). */
  readonly queryOpName: string | null;
  /** Earlier op for `op-precedes-op` queries. */
  readonly queryEarlierOpName: string | null;
  /** Later op for `op-precedes-op` queries. */
  readonly queryLaterOpName: string | null;
  /** Expected answered op name (for `op-at-index` and `frame-loop-first-call`). */
  readonly expectedAnsweredOpName: string | null;
  /** Expected answered presence boolean (for `op-presence`). */
  readonly expectedAnsweredPresent: boolean | null;
  /** Expected answered condition (for `op-condition`). */
  readonly expectedAnsweredCondition: VanillaDoomLoopEntryStepCondition | null;
  /** Expected answered verbatim printf literal (for `op-printf-literal` and the debugfile-printf query). */
  readonly expectedAnsweredPrintfLiteral: string | null;
  /** Expected answered count (for `pre-loop-op-count` and `tic-rate-hz`). */
  readonly expectedAnsweredCount: number | null;
  /** Expected answered exit-condition boolean (for `frame-loop-has-exit`). */
  readonly expectedAnsweredHasExitCondition: boolean | null;
  /** Expected answered literal (for `debugfile-filename-format`, `debugfile-fopen-mode`, `debugfile-parm-literal`). */
  readonly expectedAnsweredLiteral: string | null;
  /** Expected answered precedence boolean (for `op-precedes-op`). */
  readonly expectedAnsweredPrecedes: boolean | null;
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId: string;
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a single query against the canonical sequence plus the
 * expected answer.
 */
export const VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES: readonly VanillaDDoomLoopEntryTimingProbe[] = [
  {
    id: 'index-zero-is-g-beginrecording',
    description: 'The pre-loop op at canonical index 0 is G_BeginRecording.',
    queryKind: 'op-at-index',
    queryIndex: 0,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'G_BeginRecording',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_PRE_LOOP_ORDER_IS_GBR_DEBUGFILE_IINITGRAPHICS',
  },
  {
    id: 'index-one-is-debugfile-setup',
    description: 'The pre-loop op at canonical index 1 is debugfileSetup.',
    queryKind: 'op-at-index',
    queryIndex: 1,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'debugfileSetup',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_PRE_LOOP_ORDER_IS_GBR_DEBUGFILE_IINITGRAPHICS',
  },
  {
    id: 'index-two-is-i-initgraphics',
    description: 'The pre-loop op at canonical index 2 is I_InitGraphics.',
    queryKind: 'op-at-index',
    queryIndex: 2,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'I_InitGraphics',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_PRE_LOOP_ORDER_IS_GBR_DEBUGFILE_IINITGRAPHICS',
  },
  {
    id: 'g-beginrecording-condition-is-demorecording-flag',
    description: 'G_BeginRecording in vanilla is gated by the demorecording flag.',
    queryKind: 'op-condition',
    queryIndex: null,
    queryOpName: 'G_BeginRecording',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: 'demorecording-flag-set',
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_G_BEGINRECORDING_IS_GATED_BY_DEMORECORDING_FLAG',
  },
  {
    id: 'debugfile-setup-condition-is-debugfile-parm',
    description: 'debugfileSetup in vanilla is gated by the -debugfile parm.',
    queryKind: 'op-condition',
    queryIndex: null,
    queryOpName: 'debugfileSetup',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: 'debugfile-parm-present',
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_DEBUGFILE_SETUP_IS_GATED_BY_DEBUGFILE_PARM',
  },
  {
    id: 'i-initgraphics-condition-is-always',
    description: 'I_InitGraphics in vanilla is unconditional.',
    queryKind: 'op-condition',
    queryIndex: null,
    queryOpName: 'I_InitGraphics',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: 'always',
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_I_INITGRAPHICS_IS_UNCONDITIONAL',
  },
  {
    id: 'g-beginrecording-is-present',
    description: 'G_BeginRecording is present in the vanilla 1.9 entry sequence (positive control).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'G_BeginRecording',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: true,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_HAS_EXACTLY_THREE_PRE_LOOP_OPS',
  },
  {
    id: 'bfg-edition-warning-is-absent',
    description: 'bfgEditionWarning is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'bfgEditionWarning',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_BFG_EDITION_WARNING',
  },
  {
    id: 'main-loop-started-flag-is-absent',
    description: 'mainLoopStartedFlag is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'mainLoopStartedFlag',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_MAIN_LOOP_STARTED_FLAG',
  },
  {
    id: 'preloop-tryruntics-is-absent',
    description: 'preLoopTryRunTics is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'preLoopTryRunTics',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_PRELOOP_TRYRUNTICS',
  },
  {
    id: 'i-setwindowtitle-is-absent',
    description: 'I_SetWindowTitle is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'I_SetWindowTitle',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_I_SETWINDOWTITLE',
  },
  {
    id: 'i-graphicscheckcommandline-is-absent',
    description: 'I_GraphicsCheckCommandLine is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'I_GraphicsCheckCommandLine',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_I_GRAPHICSCHECKCOMMANDLINE',
  },
  {
    id: 'i-setgrabmousecallback-is-absent',
    description: 'I_SetGrabMouseCallback is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'I_SetGrabMouseCallback',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_I_SETGRABMOUSECALLBACK',
  },
  {
    id: 'enable-loading-disk-is-absent',
    description: 'EnableLoadingDisk is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'EnableLoadingDisk',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_ENABLELOADINGDISK',
  },
  {
    id: 'v-restorebuffer-is-absent',
    description: 'V_RestoreBuffer is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'V_RestoreBuffer',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_V_RESTOREBUFFER',
  },
  {
    id: 'r-executesetviewsize-is-absent',
    description: 'R_ExecuteSetViewSize is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'R_ExecuteSetViewSize',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_R_EXECUTESETVIEWSIZE',
  },
  {
    id: 'd-startgameloop-is-absent',
    description: 'D_StartGameLoop is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'D_StartGameLoop',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_D_STARTGAMELOOP',
  },
  {
    id: 'testcontrols-branch-is-absent',
    description: 'testcontrolsBranch is not present in the vanilla 1.9 entry sequence (Chocolate-only).',
    queryKind: 'op-presence',
    queryIndex: null,
    queryOpName: 'testcontrolsBranch',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: false,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_OMITS_TESTCONTROLS_BRANCH',
  },
  {
    id: 'g-beginrecording-printf-literal-is-null',
    description: 'G_BeginRecording has no stdout side-effect at the entry-time level.',
    queryKind: 'op-printf-literal',
    queryIndex: null,
    queryOpName: 'G_BeginRecording',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_DEBUGFILE_PRINTF_LITERAL_IS_VERBATIM',
  },
  {
    id: 'debugfile-setup-printf-literal-is-debug-output-to',
    description: 'debugfileSetup emits the verbatim printf literal "debug output to: %s\\n".',
    queryKind: 'op-printf-literal',
    queryIndex: null,
    queryOpName: 'debugfileSetup',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: 'debug output to: %s\n',
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_DEBUGFILE_PRINTF_LITERAL_IS_VERBATIM',
  },
  {
    id: 'i-initgraphics-printf-literal-is-null',
    description: 'I_InitGraphics has no stdout side-effect at the entry-time level (its internal stdout, if any, is from inside the called function, not from D_DoomLoop itself).',
    queryKind: 'op-printf-literal',
    queryIndex: null,
    queryOpName: 'I_InitGraphics',
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_DEBUGFILE_PRINTF_LITERAL_IS_VERBATIM',
  },
  {
    id: 'pre-loop-op-count-is-three',
    description: 'The vanilla pre-loop op count is 3.',
    queryKind: 'pre-loop-op-count',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: 3,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_HAS_EXACTLY_THREE_PRE_LOOP_OPS',
  },
  {
    id: 'frame-loop-first-call-is-i-startframe',
    description: 'The first per-frame call inside the vanilla while(1) body is I_StartFrame.',
    queryKind: 'frame-loop-first-call',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: 'I_StartFrame',
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_FRAME_LOOP_FIRST_CALL_IS_I_STARTFRAME_NOT_D_RUNFRAME',
  },
  {
    id: 'frame-loop-has-no-exit-condition',
    description: 'The vanilla frame loop is while(1) — no explicit exit condition.',
    queryKind: 'frame-loop-has-exit',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: false,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_FRAME_LOOP_HAS_NO_BOOLEAN_EXIT_GATE',
  },
  {
    id: 'tic-rate-is-thirty-five-hz',
    description: 'The vanilla tic rate is 35 Hz (TICRATE = 35 in i_timer.h).',
    queryKind: 'tic-rate-hz',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: 35,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_TICRATE_IS_THIRTY_FIVE',
  },
  {
    id: 'debugfile-filename-format-is-debug-percent-i-txt',
    description: 'The vanilla debugfile filename format is "debug%i.txt".',
    queryKind: 'debugfile-filename-format',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: 'debug%i.txt',
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_DEBUGFILE_FILENAME_FORMAT_AND_FOPEN_MODE_ARE_VERBATIM',
  },
  {
    id: 'debugfile-fopen-mode-is-write',
    description: 'The vanilla debugfile fopen mode is "w".',
    queryKind: 'debugfile-fopen-mode',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: 'w',
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_DEBUGFILE_FILENAME_FORMAT_AND_FOPEN_MODE_ARE_VERBATIM',
  },
  {
    id: 'debugfile-printf-literal-is-debug-output-to',
    description: 'The verbatim debugfile printf literal is "debug output to: %s\\n".',
    queryKind: 'debugfile-printf-literal',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: 'debug output to: %s\n',
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_DEBUGFILE_PRINTF_LITERAL_IS_VERBATIM',
  },
  {
    id: 'debugfile-parm-literal-is-dash-debugfile',
    description: 'The verbatim debugfile parm literal is "-debugfile".',
    queryKind: 'debugfile-parm-literal',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: null,
    queryLaterOpName: null,
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: '-debugfile',
    expectedAnsweredPrecedes: null,
    witnessInvariantId: 'ENTRY_DEBUGFILE_SETUP_IS_GATED_BY_DEBUGFILE_PARM',
  },
  {
    id: 'g-beginrecording-precedes-i-initgraphics',
    description: 'G_BeginRecording precedes I_InitGraphics in the canonical pre-loop ordering.',
    queryKind: 'op-precedes-op',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: 'G_BeginRecording',
    queryLaterOpName: 'I_InitGraphics',
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: true,
    witnessInvariantId: 'ENTRY_PRE_LOOP_ORDER_IS_GBR_DEBUGFILE_IINITGRAPHICS',
  },
  {
    id: 'debugfile-setup-precedes-i-initgraphics',
    description: 'debugfileSetup precedes I_InitGraphics in the canonical pre-loop ordering.',
    queryKind: 'op-precedes-op',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: 'debugfileSetup',
    queryLaterOpName: 'I_InitGraphics',
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: true,
    witnessInvariantId: 'ENTRY_PRE_LOOP_ORDER_IS_GBR_DEBUGFILE_IINITGRAPHICS',
  },
  {
    id: 'i-initgraphics-does-not-precede-g-beginrecording',
    description: 'I_InitGraphics does NOT precede G_BeginRecording — the reverse ordering returns false.',
    queryKind: 'op-precedes-op',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: 'I_InitGraphics',
    queryLaterOpName: 'G_BeginRecording',
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: false,
    witnessInvariantId: 'ENTRY_PRELOOP_OPS_PRECEDE_FRAME_LOOP',
  },
  {
    id: 'absent-op-precedence-against-g-beginrecording-is-false',
    description: 'mainLoopStartedFlag does NOT precede G_BeginRecording because mainLoopStartedFlag is absent from the vanilla entry sequence; the precedence query returns false on any pair where the first argument is absent.',
    queryKind: 'op-precedes-op',
    queryIndex: null,
    queryOpName: null,
    queryEarlierOpName: 'mainLoopStartedFlag',
    queryLaterOpName: 'G_BeginRecording',
    expectedAnsweredOpName: null,
    expectedAnsweredPresent: null,
    expectedAnsweredCondition: null,
    expectedAnsweredPrintfLiteral: null,
    expectedAnsweredCount: null,
    expectedAnsweredHasExitCondition: null,
    expectedAnsweredLiteral: null,
    expectedAnsweredPrecedes: false,
    witnessInvariantId: 'ENTRY_OMITS_MAIN_LOOP_STARTED_FLAG',
  },
];

/** Number of pinned probes. */
export const VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBE_COUNT = 33;

/**
 * Result of a single probe run against a vanilla `D_DoomLoop` entry-
 * timing handler. Each query kind populates a different result field;
 * fields not relevant to the query kind are `null`.
 */
export interface VanillaDDoomLoopEntryTimingResult {
  readonly answeredOpName: string | null;
  readonly answeredPresent: boolean | null;
  readonly answeredCondition: VanillaDoomLoopEntryStepCondition | null;
  readonly answeredPrintfLiteral: string | null;
  readonly answeredCount: number | null;
  readonly answeredHasExitCondition: boolean | null;
  readonly answeredLiteral: string | null;
  readonly answeredPrecedes: boolean | null;
}

/**
 * A minimal handler interface modelling the canonical vanilla 1.9
 * `D_DoomLoop` entry-timing skeleton. The reference implementation
 * answers each query against the pinned 3-step canonical sequence;
 * the cross-check accepts any handler shape so the focused test can
 * exercise deliberately broken adapters and observe the failure ids.
 */
export interface VanillaDDoomLoopEntryTimingHandler {
  /**
   * Run a probe against a fresh handler instance. Returns the relevant
   * answer fields populated for the probe's query kind; unrelated
   * fields are `null`.
   */
  readonly runProbe: (probe: VanillaDDoomLoopEntryTimingProbe) => VanillaDDoomLoopEntryTimingResult;
}

const NULL_ANSWER: VanillaDDoomLoopEntryTimingResult = Object.freeze({
  answeredOpName: null,
  answeredPresent: null,
  answeredCondition: null,
  answeredPrintfLiteral: null,
  answeredCount: null,
  answeredHasExitCondition: null,
  answeredLiteral: null,
  answeredPrecedes: null,
});

/**
 * Reference handler that answers every query against the canonical
 * 3-step vanilla 1.9 entry sequence. The focused test asserts that
 * this handler passes every probe with zero failures.
 */
function referenceVanillaDDoomLoopEntryTimingProbe(probe: VanillaDDoomLoopEntryTimingProbe): VanillaDDoomLoopEntryTimingResult {
  switch (probe.queryKind) {
    case 'op-at-index': {
      const index = probe.queryIndex!;
      const step = VANILLA_D_DOOMLOOP_ENTRY_ORDER[index];
      return Object.freeze({
        ...NULL_ANSWER,
        answeredOpName: step ? step.opName : null,
      });
    }
    case 'op-condition': {
      const opName = probe.queryOpName!;
      const found = VANILLA_D_DOOMLOOP_ENTRY_ORDER.find((step) => step.opName === opName);
      return Object.freeze({
        ...NULL_ANSWER,
        answeredCondition: found ? found.condition : null,
      });
    }
    case 'op-presence': {
      const opName = probe.queryOpName!;
      const present = VANILLA_D_DOOMLOOP_ENTRY_ORDER.some((step) => step.opName === opName);
      return Object.freeze({
        ...NULL_ANSWER,
        answeredPresent: present,
      });
    }
    case 'op-printf-literal': {
      const opName = probe.queryOpName!;
      const found = VANILLA_D_DOOMLOOP_ENTRY_ORDER.find((step) => step.opName === opName);
      return Object.freeze({
        ...NULL_ANSWER,
        answeredPrintfLiteral: found ? found.printfLiteral : null,
      });
    }
    case 'pre-loop-op-count': {
      return Object.freeze({
        ...NULL_ANSWER,
        answeredCount: VANILLA_D_DOOMLOOP_ENTRY_ORDER.length,
      });
    }
    case 'frame-loop-first-call': {
      return Object.freeze({
        ...NULL_ANSWER,
        answeredOpName: VANILLA_D_DOOMLOOP_FRAME_LOOP_FIRST_CALL_C_SYMBOL,
      });
    }
    case 'frame-loop-has-exit': {
      return Object.freeze({
        ...NULL_ANSWER,
        answeredHasExitCondition: VANILLA_D_DOOMLOOP_FRAME_LOOP_HAS_EXIT_CONDITION,
      });
    }
    case 'tic-rate-hz': {
      return Object.freeze({
        ...NULL_ANSWER,
        answeredCount: VANILLA_D_DOOMLOOP_TICRATE_HZ,
      });
    }
    case 'debugfile-filename-format': {
      return Object.freeze({
        ...NULL_ANSWER,
        answeredLiteral: VANILLA_D_DOOMLOOP_DEBUGFILE_FILENAME_FORMAT,
      });
    }
    case 'debugfile-fopen-mode': {
      return Object.freeze({
        ...NULL_ANSWER,
        answeredLiteral: VANILLA_D_DOOMLOOP_DEBUGFILE_FOPEN_MODE,
      });
    }
    case 'debugfile-printf-literal': {
      return Object.freeze({
        ...NULL_ANSWER,
        answeredPrintfLiteral: VANILLA_D_DOOMLOOP_DEBUGFILE_PRINTF_LITERAL,
      });
    }
    case 'debugfile-parm-literal': {
      return Object.freeze({
        ...NULL_ANSWER,
        answeredLiteral: VANILLA_D_DOOMLOOP_DEBUGFILE_PARM_LITERAL,
      });
    }
    case 'op-precedes-op': {
      const earlier = probe.queryEarlierOpName!;
      const later = probe.queryLaterOpName!;
      const earlierStep = VANILLA_D_DOOMLOOP_ENTRY_ORDER.find((step) => step.opName === earlier);
      const laterStep = VANILLA_D_DOOMLOOP_ENTRY_ORDER.find((step) => step.opName === later);
      const precedes = earlierStep !== undefined && laterStep !== undefined && earlierStep.index < laterStep.index;
      return Object.freeze({
        ...NULL_ANSWER,
        answeredPrecedes: precedes,
      });
    }
  }
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_D_DOOMLOOP_ENTRY_TIMING_HANDLER: VanillaDDoomLoopEntryTimingHandler = Object.freeze({
  runProbe: referenceVanillaDDoomLoopEntryTimingProbe,
});

/**
 * Cross-check a `VanillaDDoomLoopEntryTimingHandler` against
 * `VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES`. Returns the list of
 * failures by stable identifier; an empty list means the handler is
 * parity-safe with the canonical vanilla 1.9 `D_DoomLoop` entry
 * skeleton.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:answeredOpName:value-mismatch`
 *  - `probe:<probe.id>:answeredPresent:value-mismatch`
 *  - `probe:<probe.id>:answeredCondition:value-mismatch`
 *  - `probe:<probe.id>:answeredPrintfLiteral:value-mismatch`
 *  - `probe:<probe.id>:answeredCount:value-mismatch`
 *  - `probe:<probe.id>:answeredHasExitCondition:value-mismatch`
 *  - `probe:<probe.id>:answeredLiteral:value-mismatch`
 *  - `probe:<probe.id>:answeredPrecedes:value-mismatch`
 */
export function crossCheckVanillaDDoomLoopEntryTiming(handler: VanillaDDoomLoopEntryTimingHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_D_DOOMLOOP_ENTRY_TIMING_PROBES) {
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
    if (probe.expectedAnsweredPrintfLiteral !== null && result.answeredPrintfLiteral !== probe.expectedAnsweredPrintfLiteral) {
      failures.push(`probe:${probe.id}:answeredPrintfLiteral:value-mismatch`);
    }
    if (probe.expectedAnsweredCount !== null && result.answeredCount !== probe.expectedAnsweredCount) {
      failures.push(`probe:${probe.id}:answeredCount:value-mismatch`);
    }
    if (probe.expectedAnsweredHasExitCondition !== null && result.answeredHasExitCondition !== probe.expectedAnsweredHasExitCondition) {
      failures.push(`probe:${probe.id}:answeredHasExitCondition:value-mismatch`);
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
 * probe against the canonical vanilla 1.9 `D_DoomLoop` entry
 * skeleton. The focused test uses this helper to cross-validate
 * probe expectations independently of the reference handler.
 */
export function deriveExpectedVanillaDDoomLoopEntryTimingResult(probe: VanillaDDoomLoopEntryTimingProbe): VanillaDDoomLoopEntryTimingResult {
  return referenceVanillaDDoomLoopEntryTimingProbe(probe);
}
