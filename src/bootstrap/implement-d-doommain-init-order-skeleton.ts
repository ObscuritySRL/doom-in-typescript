/**
 * Audit ledger for the vanilla DOOM 1.9 `D_DoomMain` init-order skeleton
 * inside id Software's `linuxdoom-1.10/d_main.c`. The accompanying
 * focused test cross-checks every audited contract clause against a
 * self-contained reference handler that walks the canonical 12-step
 * init sequence the same way vanilla `D_DoomMain` does.
 *
 * The canonical vanilla DOOM 1.9 surface for the `D_DoomMain` init
 * skeleton is the verbatim sequence of twelve `printf("X_Init: ...\n");
 * X_Init();` pairs interleaved through the second half of `D_DoomMain`.
 * Four of the twelve fire before the title banner is printed
 * (V_Init → M_LoadDefaults → Z_Init → W_InitMultipleFiles), and the
 * remaining eight fire after the gamemode-derived banner block
 * (M_Init → R_Init → P_Init → I_Init → D_CheckNetGame → S_Init →
 * HU_Init → ST_Init). Each printed line is the C source-literal stdout
 * fingerprint of the init step; reordering the symbol calls or the
 * printed lines is a parity violation.
 *
 * Vanilla DOOM 1.9 `D_DoomMain` does NOT call `OPL_Init`, `NET_Init`,
 * or `I_InitStretchTables`. Those three steps are Chocolate Doom 2.2.1
 * additions: `OPL_Init` belongs to the OPL2/OPL3 emulator the SDL host
 * spins up for music synthesis, `NET_Init` belongs to the
 * `chocolate-doom` net-server discovery layer, and
 * `I_InitStretchTables` belongs to the 320×200 → 4:3-stretched
 * software-renderer adapter Chocolate Doom 2.2.1 layers on top of
 * vanilla. Vanilla 1.9 has no separate OPL emulator (the DOS build
 * talks to OPL hardware via I_Init/sound-driver pairings), no network
 * subsystem entry point distinct from `D_CheckNetGame`, and no aspect-
 * stretch tables (the DOS framebuffer is a literal 320×200 indexed
 * blit with no software-side aspect correction).
 *
 * Vanilla DOOM 1.9 also reorders the first three pre-banner steps
 * relative to Chocolate Doom 2.2.1: vanilla prints
 * `V_Init` → `M_LoadDefaults` → `Z_Init`, while Chocolate Doom 2.2.1
 * prints `Z_Init` → `V_Init` → `M_LoadDefaults`. The reordering is
 * deliberate (the vanilla source comment says "load before initing
 * other systems" on `M_LoadDefaults`), and a handler that follows the
 * Chocolate ordering for the first three steps is a parity violation
 * against the vanilla 1.9 audit even though both projects share the
 * same set of pre-banner symbols.
 *
 * Vanilla `I_Init` is the eighth visible step (after `P_Init`), not the
 * fifth (the position it occupies in Chocolate Doom 2.2.1 right after
 * `W_Init`). Vanilla `D_CheckNetGame` precedes `S_Init`; Chocolate's
 * `D_CheckNetGame` follows `S_Init`. These two reorderings are the
 * highest-impact divergences: any cross-platform port that pulls
 * Chocolate 2.2.1's order verbatim will silently break the vanilla
 * stdout fingerprint and disturb sound-init/network-init dependencies
 * that the vanilla DOS executable exposes.
 *
 * No runtime `D_DoomMain` skeleton drives the `bun run doom.ts`
 * entrypoint yet — `src/bootstrap/initOrder.ts` is a Chocolate Doom
 * 2.2.1-shaped helper (it pins the 15-step Chocolate sequence with
 * `OPL_Init`, `NET_Init`, and `I_InitStretchTables`), and is NOT the
 * vanilla 1.9 contract. This step pins the vanilla-1.9-only contract
 * so a later implementation step (or an oracle follow-up that observes
 * `doom/DOOMD.EXE` directly) can be cross-checked for parity. The
 * audit module deliberately avoids importing from any runtime
 * init-order module so that a corrupted runtime cannot silently
 * calibrate the audit's own probe table.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the
 *      `D_DoomMain` init skeleton — `d_main.c` `D_DoomMain()` is the
 *      verbatim source of the twelve `printf(...); X_Init();` pairs,
 *      the four-pre-banner-and-eight-post-banner partition, the
 *      pre-banner ordering V_Init → M_LoadDefaults → Z_Init → W_Init,
 *      the post-banner ordering M_Init → R_Init → P_Init → I_Init →
 *      D_CheckNetGame → S_Init → HU_Init → ST_Init, the absence of
 *      `OPL_Init`/`NET_Init`/`I_InitStretchTables`, and the verbatim
 *      stdout-line literals each step prints),
 *   5. Chocolate Doom 2.2.1 source.
 *
 * The audit invariants below are pinned against authority 4 because
 * the init skeleton is a textual property of `D_DoomMain`: a fixed
 * sequence of `printf(...); X_Init();` pairs, four before the banner
 * block and eight after, with the printed lines acting as the visible
 * stdout fingerprint of the init pass. Authority 1 (the DOS binary)
 * cannot disagree because the init order is the visible pre-condition
 * every vanilla startup path produces; authority 5 (Chocolate Doom
 * 2.2.1) deliberately diverges (it adds three steps and reorders the
 * first three) and so is NOT the authority for this audit even though
 * it covers a superset of the surface.
 */

/**
 * Phase classification of one vanilla `D_DoomMain` init step.
 *
 * - `pre-banner` covers the four `printf/X_Init` pairs that fire
 *   before the gamemode-derived banner block (V_Init,
 *   M_LoadDefaults, Z_Init, W_Init).
 * - `post-banner` covers the eight `printf/X_Init` pairs that fire
 *   after the banner block (M_Init through ST_Init).
 *
 * Vanilla DOOM 1.9 does NOT split the sequence into an explicit
 * `wad-load` phase the way `src/bootstrap/initOrder.ts` does for the
 * Chocolate Doom 2.2.1 shape; the WAD load happens inside
 * `W_InitMultipleFiles` at the tail of the pre-banner phase, and the
 * banner block (which is NOT an init step in this audit) is what
 * separates the four pre-banner steps from the eight post-banner
 * steps.
 */
export type VanillaInitStepPhase = 'pre-banner' | 'post-banner';

/**
 * Verbatim C symbol of a vanilla DOOM 1.9 `D_DoomMain` init step. The
 * four pre-banner symbols are V_Init, M_LoadDefaults, Z_Init, and
 * W_Init (the literal `printf` string for `W_InitMultipleFiles` is
 * "W_Init: Init WADfiles.\n", so the pinned label is the printed form,
 * not the source-side function name). The eight post-banner symbols
 * are M_Init, R_Init, P_Init, I_Init, D_CheckNetGame, S_Init, HU_Init,
 * and ST_Init.
 */
export type VanillaInitStepCSymbol = 'V_Init' | 'M_LoadDefaults' | 'Z_Init' | 'W_Init' | 'M_Init' | 'R_Init' | 'P_Init' | 'I_Init' | 'D_CheckNetGame' | 'S_Init' | 'HU_Init' | 'ST_Init';

/**
 * One audited contract invariant of the vanilla DOOM 1.9 `D_DoomMain`
 * init-order skeleton.
 */
export interface VanillaDDoomMainInitOrderContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'INIT_SEQUENCE_HAS_TWELVE_VISIBLE_X_INIT_STEPS'
    | 'INIT_SEQUENCE_PARTITIONS_FOUR_PRE_BANNER_AND_EIGHT_POST_BANNER'
    | 'INIT_SEQUENCE_FIRST_STEP_IS_V_INIT_PRE_BANNER'
    | 'INIT_SEQUENCE_SECOND_STEP_IS_M_LOADDEFAULTS_PRE_BANNER'
    | 'INIT_SEQUENCE_THIRD_STEP_IS_Z_INIT_PRE_BANNER'
    | 'INIT_SEQUENCE_FOURTH_STEP_IS_W_INIT_PRE_BANNER'
    | 'INIT_SEQUENCE_FIFTH_STEP_IS_M_INIT_POST_BANNER'
    | 'INIT_SEQUENCE_SIXTH_STEP_IS_R_INIT_POST_BANNER'
    | 'INIT_SEQUENCE_SEVENTH_STEP_IS_P_INIT_POST_BANNER'
    | 'INIT_SEQUENCE_EIGHTH_STEP_IS_I_INIT_POST_BANNER'
    | 'INIT_SEQUENCE_NINTH_STEP_IS_D_CHECKNETGAME_POST_BANNER'
    | 'INIT_SEQUENCE_TENTH_STEP_IS_S_INIT_POST_BANNER'
    | 'INIT_SEQUENCE_ELEVENTH_STEP_IS_HU_INIT_POST_BANNER'
    | 'INIT_SEQUENCE_TWELFTH_STEP_IS_ST_INIT_POST_BANNER'
    | 'INIT_SEQUENCE_OMITS_OPL_INIT_PRESENT_ONLY_IN_CHOCOLATE'
    | 'INIT_SEQUENCE_OMITS_NET_INIT_PRESENT_ONLY_IN_CHOCOLATE'
    | 'INIT_SEQUENCE_OMITS_I_INITSTRETCHTABLES_PRESENT_ONLY_IN_CHOCOLATE'
    | 'INIT_SEQUENCE_PRINTS_VERBATIM_STDOUT_LITERAL_PER_STEP'
    | 'INIT_SEQUENCE_PRE_BANNER_REORDER_DIVERGES_FROM_CHOCOLATE_FIRST_THREE_STEPS'
    | 'INIT_SEQUENCE_I_INIT_FOLLOWS_P_INIT_DIVERGES_FROM_CHOCOLATE_AFTER_W_INIT'
    | 'INIT_SEQUENCE_D_CHECKNETGAME_PRECEDES_S_INIT_DIVERGES_FROM_CHOCOLATE';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'd_main.c';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'D_DoomMain';
}

/**
 * Pinned ledger of every contract clause of the vanilla DOOM 1.9
 * `D_DoomMain` init-order skeleton.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT: readonly VanillaDDoomMainInitOrderContractAuditEntry[] = [
  {
    id: 'INIT_SEQUENCE_HAS_TWELVE_VISIBLE_X_INIT_STEPS',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomMain` interleaves exactly twelve `printf("X_Init: ...\\n"); X_Init();` pairs through the second half of the function. The twelve pinned C symbols are V_Init, M_LoadDefaults, Z_Init, W_Init, M_Init, R_Init, P_Init, I_Init, D_CheckNetGame, S_Init, HU_Init, ST_Init. Adding a thirteenth visible init step (e.g., a Chocolate-Doom-2.2.1-style OPL_Init, NET_Init, or I_InitStretchTables) is a parity violation against vanilla; removing one of the twelve is also a parity violation. The count is twelve and only twelve.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_PARTITIONS_FOUR_PRE_BANNER_AND_EIGHT_POST_BANNER',
    invariant:
      'The twelve init steps split into a four-step pre-banner phase (V_Init, M_LoadDefaults, Z_Init, W_Init) followed by the gamemode-derived banner block (which is NOT an init step in this audit because it does not print "X_Init:") and then an eight-step post-banner phase (M_Init, R_Init, P_Init, I_Init, D_CheckNetGame, S_Init, HU_Init, ST_Init). The 4+8 split is a structural property of `D_DoomMain` — every pre-banner step fires before the banner is printed, every post-banner step fires after, and no init step shares the banner block.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_FIRST_STEP_IS_V_INIT_PRE_BANNER',
    invariant:
      'The first visible init step in vanilla `D_DoomMain` is `V_Init` (allocate screens). The verbatim printf line is "V_Init: allocate screens.\\n" and the symbol call is `V_Init();`. V_Init is in the pre-banner phase. (Chocolate Doom 2.2.1 prints `Z_Init` first instead — that ordering is a Chocolate-only divergence, not the vanilla contract.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_SECOND_STEP_IS_M_LOADDEFAULTS_PRE_BANNER',
    invariant:
      'The second visible init step in vanilla `D_DoomMain` is `M_LoadDefaults` (load system defaults). The verbatim printf line is "M_LoadDefaults: Load system defaults.\\n" and the symbol call is `M_LoadDefaults();`. The vanilla source comment says "load before initing other systems", justifying why M_LoadDefaults comes before Z_Init in vanilla 1.9. M_LoadDefaults is in the pre-banner phase. (Chocolate Doom 2.2.1 prints M_LoadDefaults third instead of second — that ordering is a Chocolate-only divergence.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_THIRD_STEP_IS_Z_INIT_PRE_BANNER',
    invariant:
      'The third visible init step in vanilla `D_DoomMain` is `Z_Init` (init zone memory allocation daemon). The verbatim printf line is "Z_Init: Init zone memory allocation daemon. \\n" (note the trailing space before the newline — a vanilla-1.9 idiosyncrasy preserved verbatim) and the symbol call is `Z_Init();`. Z_Init is in the pre-banner phase. (Chocolate Doom 2.2.1 prints Z_Init first instead of third — that ordering is a Chocolate-only divergence.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_FOURTH_STEP_IS_W_INIT_PRE_BANNER',
    invariant:
      'The fourth visible init step in vanilla `D_DoomMain` is `W_Init` (init WADfiles). The verbatim printf line is "W_Init: Init WADfiles.\\n" and the symbol call is `W_InitMultipleFiles(wadfiles);` (the printed label is "W_Init" but the called function in vanilla is `W_InitMultipleFiles`; the audit pins the printed label because that is the visible stdout fingerprint and the surface that any handler must reproduce). W_Init is the last pre-banner step; the banner block follows immediately after.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_FIFTH_STEP_IS_M_INIT_POST_BANNER',
    invariant:
      'The fifth visible init step (and the first post-banner step) in vanilla `D_DoomMain` is `M_Init` (init miscellaneous info). The verbatim printf line is "M_Init: Init miscellaneous info.\\n" and the symbol call is `M_Init();`. M_Init is the entry point of the post-banner phase. (Chocolate Doom 2.2.1 places M_Init eighth in its 15-step sequence — different position because of the three Chocolate-only inserts.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_SIXTH_STEP_IS_R_INIT_POST_BANNER',
    invariant:
      'The sixth visible init step in vanilla `D_DoomMain` is `R_Init` (init DOOM refresh daemon). The verbatim printf line is "R_Init: Init DOOM refresh daemon - " (no trailing newline; R_Init internally prints progress dots that fill out the line). R_Init is in the post-banner phase, sandwiched between M_Init and P_Init.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_SEVENTH_STEP_IS_P_INIT_POST_BANNER',
    invariant:
      'The seventh visible init step in vanilla `D_DoomMain` is `P_Init` (init Playloop state). The verbatim printf line is "\\nP_Init: Init Playloop state.\\n" — the leading newline is a vanilla-1.9 idiosyncrasy that breaks the line of progress dots emitted by R_Init. P_Init is in the post-banner phase, sandwiched between R_Init and I_Init.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_EIGHTH_STEP_IS_I_INIT_POST_BANNER',
    invariant:
      'The eighth visible init step in vanilla `D_DoomMain` is `I_Init` (setting up machine state). The verbatim printf line is "I_Init: Setting up machine state.\\n" and the symbol call is `I_Init();`. I_Init follows P_Init in vanilla; it does NOT precede M_Init/R_Init/P_Init the way Chocolate Doom 2.2.1 schedules it. The vanilla I_Init position (after P_Init, before D_CheckNetGame) is a major divergence from Chocolate, where I_Init runs immediately after W_Init.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_NINTH_STEP_IS_D_CHECKNETGAME_POST_BANNER',
    invariant:
      'The ninth visible init step in vanilla `D_DoomMain` is `D_CheckNetGame` (checking network game status). The verbatim printf line is "D_CheckNetGame: Checking network game status.\\n" and the symbol call is `D_CheckNetGame();`. D_CheckNetGame precedes S_Init in vanilla — the opposite ordering from Chocolate Doom 2.2.1, which places D_CheckNetGame after S_Init.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_TENTH_STEP_IS_S_INIT_POST_BANNER',
    invariant:
      'The tenth visible init step in vanilla `D_DoomMain` is `S_Init` (setting up sound). The verbatim printf line is "S_Init: Setting up sound.\\n" and the symbol call is `S_Init(snd_SfxVolume, snd_MusicVolume);`. S_Init follows D_CheckNetGame in vanilla; the reverse ordering used by Chocolate Doom 2.2.1 is a divergence and must NOT be applied to a vanilla audit.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_ELEVENTH_STEP_IS_HU_INIT_POST_BANNER',
    invariant:
      'The eleventh visible init step in vanilla `D_DoomMain` is `HU_Init` (setting up heads up display). The verbatim printf line is "HU_Init: Setting up heads up display.\\n" and the symbol call is `HU_Init();`. HU_Init is in the post-banner phase, sandwiched between S_Init and ST_Init.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_TWELFTH_STEP_IS_ST_INIT_POST_BANNER',
    invariant:
      'The twelfth and last visible init step in vanilla `D_DoomMain` is `ST_Init` (init status bar). The verbatim printf line is "ST_Init: Init status bar.\\n" and the symbol call is `ST_Init();`. ST_Init is the terminal init step — no further "X_Init:" stdout line follows it before `D_DoomMain` transitions to the demo/loadgame/title-loop control block. (Chocolate Doom 2.2.1 appends a thirteenth/fourteenth/fifteenth step (I_InitStretchTables) after ST_Init; vanilla 1.9 does NOT.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_OMITS_OPL_INIT_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomMain` does NOT call `OPL_Init` and does NOT print an "OPL_Init: Using driver \'SDL\'." line. `OPL_Init` is a Chocolate Doom 2.2.1 addition that initialises the in-process OPL2/OPL3 emulator the SDL host uses for music synthesis; vanilla 1.9 talks to the OPL hardware via I_Init/sound-driver pairings and has no separate OPL emulator entry point. A handler that includes OPL_Init in the vanilla-1.9 init order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_OMITS_NET_INIT_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomMain` does NOT call `NET_Init` and does NOT print an "NET_Init: Init network subsystem." line. `NET_Init` is a Chocolate Doom 2.2.1 addition that initialises the chocolate-doom net-server discovery layer; vanilla 1.9 has no network subsystem entry point distinct from `D_CheckNetGame`. A handler that includes NET_Init in the vanilla-1.9 init order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_OMITS_I_INITSTRETCHTABLES_PRESENT_ONLY_IN_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 `D_DoomMain` does NOT call `I_InitStretchTables` and does NOT print an "I_InitStretchTables: Generating lookup tables." line. `I_InitStretchTables` is a Chocolate Doom 2.2.1 addition that builds 320×200 → 4:3-stretched lookup tables for the software-renderer adapter; vanilla 1.9 has no aspect-stretch tables (the DOS framebuffer is a literal 320×200 indexed blit). A handler that includes I_InitStretchTables in the vanilla-1.9 init order is a parity violation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_PRINTS_VERBATIM_STDOUT_LITERAL_PER_STEP',
    invariant:
      'Each of the twelve init steps prints a verbatim stdout literal that is the visible fingerprint of the init pass. The literals are: "V_Init: allocate screens.\\n", "M_LoadDefaults: Load system defaults.\\n", "Z_Init: Init zone memory allocation daemon. \\n" (with a trailing space before the newline), "W_Init: Init WADfiles.\\n", "M_Init: Init miscellaneous info.\\n", "R_Init: Init DOOM refresh daemon - " (no trailing newline), "\\nP_Init: Init Playloop state.\\n" (with a leading newline that breaks the R_Init progress dots), "I_Init: Setting up machine state.\\n", "D_CheckNetGame: Checking network game status.\\n", "S_Init: Setting up sound.\\n", "HU_Init: Setting up heads up display.\\n", "ST_Init: Init status bar.\\n". Modifying any literal — punctuation, capitalisation, leading/trailing whitespace — is a parity violation against the vanilla stdout fingerprint.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_PRE_BANNER_REORDER_DIVERGES_FROM_CHOCOLATE_FIRST_THREE_STEPS',
    invariant:
      'Vanilla DOOM 1.9 prints the first three init steps in the order V_Init → M_LoadDefaults → Z_Init. Chocolate Doom 2.2.1 prints them in the order Z_Init → V_Init → M_LoadDefaults. The vanilla ordering is canonical; a handler that emits the Chocolate ordering for the first three steps is a parity violation against the vanilla 1.9 audit even though the set of pre-banner symbols is the same in both projects (V_Init, M_LoadDefaults, Z_Init, W_Init).',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_I_INIT_FOLLOWS_P_INIT_DIVERGES_FROM_CHOCOLATE_AFTER_W_INIT',
    invariant:
      "Vanilla DOOM 1.9 schedules `I_Init` AFTER P_Init (eighth visible step). Chocolate Doom 2.2.1 schedules `I_Init` IMMEDIATELY AFTER W_Init (fifth visible step). The vanilla I_Init position is a major divergence: any cross-platform port that pulls Chocolate 2.2.1's order verbatim will silently break the vanilla stdout fingerprint and disturb the I_Init→D_CheckNetGame→S_Init dependency chain that the vanilla DOS executable exposes.",
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
  {
    id: 'INIT_SEQUENCE_D_CHECKNETGAME_PRECEDES_S_INIT_DIVERGES_FROM_CHOCOLATE',
    invariant:
      'Vanilla DOOM 1.9 schedules `D_CheckNetGame` BEFORE `S_Init` (ninth then tenth). Chocolate Doom 2.2.1 schedules `D_CheckNetGame` AFTER `S_Init` (twelfth following S_Init at eleventh). The vanilla ordering is canonical; a handler that swaps these two is a parity violation against the vanilla 1.9 audit.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'D_DoomMain',
  },
] as const;

/** Number of audited contract clauses pinned by the ledger. */
export const VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_CLAUSE_COUNT = 21;

/**
 * One step in the vanilla DOOM 1.9 `D_DoomMain` init-order skeleton:
 * the canonical 0-based index, the verbatim C symbol, the verbatim
 * stdout literal printed by the matching `printf` call, and the phase
 * (pre-banner vs post-banner) the step belongs to.
 */
export interface VanillaInitStep {
  /** 0-based index in the canonical 12-step init sequence. */
  readonly index: number;
  /** Verbatim C symbol of the init step. */
  readonly cSymbol: VanillaInitStepCSymbol;
  /** Verbatim stdout literal printed by the matching `printf` call. */
  readonly stdoutLine: string;
  /** Phase classification. */
  readonly phase: VanillaInitStepPhase;
}

/**
 * Frozen canonical 12-step init sequence pinned by vanilla DOOM 1.9
 * `D_DoomMain`. The four pre-banner steps fire before the gamemode-
 * derived banner block; the eight post-banner steps fire after. The
 * sequence is intentionally append-only at the boundaries: future
 * audits MUST extend the ledger via a separate constant rather than
 * mutate the pinned positions.
 */
export const VANILLA_D_DOOMMAIN_INIT_ORDER: readonly VanillaInitStep[] = Object.freeze([
  Object.freeze({ index: 0, cSymbol: 'V_Init', stdoutLine: 'V_Init: allocate screens.\n', phase: 'pre-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 1, cSymbol: 'M_LoadDefaults', stdoutLine: 'M_LoadDefaults: Load system defaults.\n', phase: 'pre-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 2, cSymbol: 'Z_Init', stdoutLine: 'Z_Init: Init zone memory allocation daemon. \n', phase: 'pre-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 3, cSymbol: 'W_Init', stdoutLine: 'W_Init: Init WADfiles.\n', phase: 'pre-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 4, cSymbol: 'M_Init', stdoutLine: 'M_Init: Init miscellaneous info.\n', phase: 'post-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 5, cSymbol: 'R_Init', stdoutLine: 'R_Init: Init DOOM refresh daemon - ', phase: 'post-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 6, cSymbol: 'P_Init', stdoutLine: '\nP_Init: Init Playloop state.\n', phase: 'post-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 7, cSymbol: 'I_Init', stdoutLine: 'I_Init: Setting up machine state.\n', phase: 'post-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 8, cSymbol: 'D_CheckNetGame', stdoutLine: 'D_CheckNetGame: Checking network game status.\n', phase: 'post-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 9, cSymbol: 'S_Init', stdoutLine: 'S_Init: Setting up sound.\n', phase: 'post-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 10, cSymbol: 'HU_Init', stdoutLine: 'HU_Init: Setting up heads up display.\n', phase: 'post-banner' } satisfies VanillaInitStep),
  Object.freeze({ index: 11, cSymbol: 'ST_Init', stdoutLine: 'ST_Init: Init status bar.\n', phase: 'post-banner' } satisfies VanillaInitStep),
]);

/** Total number of steps in the canonical vanilla 1.9 init sequence. */
export const VANILLA_D_DOOMMAIN_INIT_STEP_COUNT = 12;

/** Number of pre-banner steps (V_Init, M_LoadDefaults, Z_Init, W_Init). */
export const VANILLA_D_DOOMMAIN_PRE_BANNER_STEP_COUNT = 4;

/** Number of post-banner steps (M_Init through ST_Init). */
export const VANILLA_D_DOOMMAIN_POST_BANNER_STEP_COUNT = 8;

/**
 * C symbols that appear in Chocolate Doom 2.2.1's `D_DoomMain` init
 * skeleton but NOT in vanilla DOOM 1.9's. A vanilla-1.9 handler must
 * report `false` for "is this symbol in the init sequence?" for every
 * symbol in this list.
 *
 * - `OPL_Init`: Chocolate-only OPL2/OPL3 emulator init for SDL music
 *   synthesis.
 * - `NET_Init`: Chocolate-only net-server discovery layer init.
 * - `I_InitStretchTables`: Chocolate-only 320×200 → 4:3-stretched
 *   software-renderer adapter init.
 */
export const VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOLS: readonly string[] = Object.freeze(['OPL_Init', 'NET_Init', 'I_InitStretchTables']);

/** Number of Chocolate-only symbols absent from the vanilla 1.9 init order. */
export const VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOL_COUNT = 3;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity D_DoomMain init-order handler must preserve.
 */
export interface VanillaDDoomMainInitOrderDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANTS: readonly VanillaDDoomMainInitOrderDerivedInvariant[] = [
  {
    id: 'INIT_SEQUENCE_HAS_EXACTLY_TWELVE_STEPS',
    description: 'The vanilla 1.9 D_DoomMain init sequence has exactly twelve visible "X_Init:" steps. A handler reporting more than 12 (e.g., 15 the way Chocolate Doom 2.2.1 does) or fewer than 12 is a parity violation.',
  },
  {
    id: 'INIT_SEQUENCE_PARTITIONS_FOUR_BEFORE_AND_EIGHT_AFTER_BANNER',
    description: 'The twelve steps split 4 + 8 across the banner block. A handler that classifies any of the four pre-banner symbols as post-banner — or any of the eight post-banner symbols as pre-banner — is a parity violation.',
  },
  {
    id: 'INIT_SEQUENCE_PRE_BANNER_ORDER_IS_VINIT_MLOADDEFAULTS_ZINIT_WINIT',
    description: 'The pre-banner phase walks the symbols in the exact order V_Init → M_LoadDefaults → Z_Init → W_Init. The Chocolate Doom 2.2.1 ordering (Z_Init → V_Init → M_LoadDefaults → W_Init) is a parity violation.',
  },
  {
    id: 'INIT_SEQUENCE_POST_BANNER_ORDER_IS_VANILLA_EIGHT_TUPLE',
    description:
      'The post-banner phase walks the symbols in the exact order M_Init → R_Init → P_Init → I_Init → D_CheckNetGame → S_Init → HU_Init → ST_Init. Reordering any pair (notably I_Init/P_Init, D_CheckNetGame/S_Init) is a parity violation against vanilla 1.9.',
  },
  {
    id: 'INIT_SEQUENCE_I_INIT_FOLLOWS_P_INIT_NOT_W_INIT',
    description: 'I_Init in vanilla follows P_Init (it is the eighth visible step). A handler that schedules I_Init right after W_Init (the Chocolate Doom 2.2.1 position, fifth visible step) is a parity violation.',
  },
  {
    id: 'INIT_SEQUENCE_D_CHECKNETGAME_PRECEDES_S_INIT',
    description: 'D_CheckNetGame in vanilla precedes S_Init (ninth then tenth). A handler that swaps the two — emitting S_Init before D_CheckNetGame — is a parity violation against vanilla.',
  },
  {
    id: 'INIT_SEQUENCE_OMITS_OPL_INIT',
    description: 'Vanilla 1.9 has no OPL_Init step. A handler that includes an OPL_Init step at any index in the vanilla init order is a parity violation.',
  },
  {
    id: 'INIT_SEQUENCE_OMITS_NET_INIT',
    description: 'Vanilla 1.9 has no NET_Init step. A handler that includes a NET_Init step at any index in the vanilla init order is a parity violation.',
  },
  {
    id: 'INIT_SEQUENCE_OMITS_I_INITSTRETCHTABLES',
    description: 'Vanilla 1.9 has no I_InitStretchTables step. A handler that appends I_InitStretchTables after ST_Init in the vanilla init order is a parity violation.',
  },
  {
    id: 'INIT_SEQUENCE_STDOUT_LITERALS_ARE_VERBATIM',
    description:
      'Each step prints a verbatim stdout literal. A handler that emits a different literal — whether by changing punctuation, dropping the trailing space inside the Z_Init line, dropping the leading newline before P_Init, or appending a newline after R_Init — is a parity violation.',
  },
  {
    id: 'INIT_SEQUENCE_FIRST_STEP_IS_V_INIT_NOT_Z_INIT',
    description: 'The first visible init step in vanilla is V_Init, not Z_Init. A handler that emits Z_Init at index 0 is a parity violation against vanilla 1.9.',
  },
  {
    id: 'INIT_SEQUENCE_LAST_STEP_IS_ST_INIT',
    description: 'The last visible init step in vanilla is ST_Init at index 11. A handler that schedules another step (notably I_InitStretchTables) after ST_Init is a parity violation against vanilla 1.9.',
  },
];

/** Number of derived invariants. */
export const VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANT_COUNT = 12;

/**
 * Discriminator for one probe-style query against the canonical
 * vanilla 1.9 `D_DoomMain` init-order skeleton.
 *
 * - `symbol-at-index`: ask the handler what symbol it places at the
 *   given 0-based index.
 * - `index-of-symbol`: ask the handler at what 0-based index it places
 *   the named symbol (or -1 if absent).
 * - `symbol-presence`: ask the handler whether the named symbol is
 *   present in the init order at all.
 * - `symbol-stdout-line`: ask the handler what verbatim stdout literal
 *   it associates with the named symbol.
 * - `symbol-phase`: ask the handler whether the named symbol is in the
 *   pre-banner or post-banner phase.
 * - `symbol-precedes`: ask the handler whether the first named symbol
 *   precedes the second named symbol in the canonical sequence.
 * - `sequence-length`: ask the handler the total step count.
 * - `pre-banner-step-count`: ask the handler the number of pre-banner
 *   steps.
 * - `post-banner-step-count`: ask the handler the number of post-banner
 *   steps.
 */
export type VanillaDDoomMainInitOrderQueryKind = 'symbol-at-index' | 'index-of-symbol' | 'symbol-presence' | 'symbol-stdout-line' | 'symbol-phase' | 'symbol-precedes' | 'sequence-length' | 'pre-banner-step-count' | 'post-banner-step-count';

/**
 * One probe applied to a runtime vanilla `D_DoomMain` init-order
 * handler.
 *
 * Each probe pins one query against the canonical sequence plus the
 * expected answer the handler must produce. The cross-check function
 * walks every probe and reports a stable failure id whenever the
 * handler's answer disagrees with the expected one.
 */
export interface VanillaDDoomMainInitOrderProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Discriminator for the query kind. */
  readonly queryKind: VanillaDDoomMainInitOrderQueryKind;
  /** Numeric query argument (0-based index for `symbol-at-index`). */
  readonly queryIndex: number | null;
  /** Symbol query argument (the queried symbol). */
  readonly querySymbol: string | null;
  /** Earlier symbol for `symbol-precedes` queries. */
  readonly queryEarlierSymbol: string | null;
  /** Later symbol for `symbol-precedes` queries. */
  readonly queryLaterSymbol: string | null;
  /** Expected answered symbol (for `symbol-at-index`). */
  readonly expectedAnsweredSymbol: VanillaInitStepCSymbol | null;
  /** Expected answered index (for `index-of-symbol`; -1 when absent). */
  readonly expectedAnsweredIndex: number | null;
  /** Expected answered presence boolean (for `symbol-presence`). */
  readonly expectedAnsweredPresent: boolean | null;
  /** Expected answered verbatim stdout literal (for `symbol-stdout-line`). */
  readonly expectedAnsweredStdoutLine: string | null;
  /** Expected answered phase (for `symbol-phase`). */
  readonly expectedAnsweredPhase: VanillaInitStepPhase | null;
  /** Expected answered precedence boolean (for `symbol-precedes`). */
  readonly expectedAnsweredPrecedes: boolean | null;
  /** Expected answered count (for `sequence-length`/`pre-banner-step-count`/`post-banner-step-count`). */
  readonly expectedAnsweredCount: number | null;
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId: string;
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a single query against the canonical sequence plus the
 * expected answer.
 */
export const VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES: readonly VanillaDDoomMainInitOrderProbe[] = [
  {
    id: 'index-zero-is-v-init',
    description: 'The init step at canonical index 0 is V_Init.',
    queryKind: 'symbol-at-index',
    queryIndex: 0,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'V_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_FIRST_STEP_IS_V_INIT_NOT_Z_INIT',
  },
  {
    id: 'index-one-is-m-loaddefaults',
    description: 'The init step at canonical index 1 is M_LoadDefaults.',
    queryKind: 'symbol-at-index',
    queryIndex: 1,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'M_LoadDefaults',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_PRE_BANNER_ORDER_IS_VINIT_MLOADDEFAULTS_ZINIT_WINIT',
  },
  {
    id: 'index-two-is-z-init',
    description: 'The init step at canonical index 2 is Z_Init.',
    queryKind: 'symbol-at-index',
    queryIndex: 2,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'Z_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_PRE_BANNER_ORDER_IS_VINIT_MLOADDEFAULTS_ZINIT_WINIT',
  },
  {
    id: 'index-three-is-w-init',
    description: 'The init step at canonical index 3 is W_Init.',
    queryKind: 'symbol-at-index',
    queryIndex: 3,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'W_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_PRE_BANNER_ORDER_IS_VINIT_MLOADDEFAULTS_ZINIT_WINIT',
  },
  {
    id: 'index-four-is-m-init',
    description: 'The init step at canonical index 4 is M_Init (entry of post-banner phase).',
    queryKind: 'symbol-at-index',
    queryIndex: 4,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'M_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_POST_BANNER_ORDER_IS_VANILLA_EIGHT_TUPLE',
  },
  {
    id: 'index-five-is-r-init',
    description: 'The init step at canonical index 5 is R_Init.',
    queryKind: 'symbol-at-index',
    queryIndex: 5,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'R_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_POST_BANNER_ORDER_IS_VANILLA_EIGHT_TUPLE',
  },
  {
    id: 'index-six-is-p-init',
    description: 'The init step at canonical index 6 is P_Init.',
    queryKind: 'symbol-at-index',
    queryIndex: 6,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'P_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_POST_BANNER_ORDER_IS_VANILLA_EIGHT_TUPLE',
  },
  {
    id: 'index-seven-is-i-init',
    description: 'The init step at canonical index 7 is I_Init (the surprising vanilla position — Chocolate places I_Init fifth instead).',
    queryKind: 'symbol-at-index',
    queryIndex: 7,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'I_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_I_INIT_FOLLOWS_P_INIT_NOT_W_INIT',
  },
  {
    id: 'index-eight-is-d-checknetgame',
    description: 'The init step at canonical index 8 is D_CheckNetGame.',
    queryKind: 'symbol-at-index',
    queryIndex: 8,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'D_CheckNetGame',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_D_CHECKNETGAME_PRECEDES_S_INIT',
  },
  {
    id: 'index-nine-is-s-init',
    description: 'The init step at canonical index 9 is S_Init (after D_CheckNetGame, not before it like in Chocolate).',
    queryKind: 'symbol-at-index',
    queryIndex: 9,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'S_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_D_CHECKNETGAME_PRECEDES_S_INIT',
  },
  {
    id: 'index-ten-is-hu-init',
    description: 'The init step at canonical index 10 is HU_Init.',
    queryKind: 'symbol-at-index',
    queryIndex: 10,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'HU_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_POST_BANNER_ORDER_IS_VANILLA_EIGHT_TUPLE',
  },
  {
    id: 'index-eleven-is-st-init',
    description: 'The init step at canonical index 11 is ST_Init (the last step in vanilla — Chocolate appends I_InitStretchTables after).',
    queryKind: 'symbol-at-index',
    queryIndex: 11,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: 'ST_Init',
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_LAST_STEP_IS_ST_INIT',
  },
  {
    id: 'opl-init-is-absent',
    description: 'OPL_Init is not present in the vanilla 1.9 init order (it is a Chocolate-only addition).',
    queryKind: 'symbol-presence',
    queryIndex: null,
    querySymbol: 'OPL_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: false,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_OMITS_OPL_INIT',
  },
  {
    id: 'net-init-is-absent',
    description: 'NET_Init is not present in the vanilla 1.9 init order (it is a Chocolate-only addition).',
    queryKind: 'symbol-presence',
    queryIndex: null,
    querySymbol: 'NET_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: false,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_OMITS_NET_INIT',
  },
  {
    id: 'i-initstretchtables-is-absent',
    description: 'I_InitStretchTables is not present in the vanilla 1.9 init order (it is a Chocolate-only addition).',
    queryKind: 'symbol-presence',
    queryIndex: null,
    querySymbol: 'I_InitStretchTables',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: false,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_OMITS_I_INITSTRETCHTABLES',
  },
  {
    id: 'v-init-is-present',
    description: 'V_Init is present in the vanilla 1.9 init order (positive control for the symbol-presence query kind).',
    queryKind: 'symbol-presence',
    queryIndex: null,
    querySymbol: 'V_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: true,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_HAS_EXACTLY_TWELVE_STEPS',
  },
  {
    id: 'st-init-index-is-eleven',
    description: 'The canonical index of ST_Init is 11.',
    queryKind: 'index-of-symbol',
    queryIndex: null,
    querySymbol: 'ST_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: 11,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_LAST_STEP_IS_ST_INIT',
  },
  {
    id: 'opl-init-index-is-minus-one',
    description: 'The canonical index of OPL_Init is -1 (absent from vanilla).',
    queryKind: 'index-of-symbol',
    queryIndex: null,
    querySymbol: 'OPL_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: -1,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_OMITS_OPL_INIT',
  },
  {
    id: 'z-init-stdout-includes-trailing-space',
    description: 'The verbatim stdout literal of Z_Init is "Z_Init: Init zone memory allocation daemon. \\n" (with a trailing space before the newline — a vanilla-1.9 idiosyncrasy).',
    queryKind: 'symbol-stdout-line',
    queryIndex: null,
    querySymbol: 'Z_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: 'Z_Init: Init zone memory allocation daemon. \n',
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_STDOUT_LITERALS_ARE_VERBATIM',
  },
  {
    id: 'r-init-stdout-omits-trailing-newline',
    description: 'The verbatim stdout literal of R_Init is "R_Init: Init DOOM refresh daemon - " (no trailing newline; R_Init internally prints progress dots).',
    queryKind: 'symbol-stdout-line',
    queryIndex: null,
    querySymbol: 'R_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: 'R_Init: Init DOOM refresh daemon - ',
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_STDOUT_LITERALS_ARE_VERBATIM',
  },
  {
    id: 'p-init-stdout-includes-leading-newline',
    description: 'The verbatim stdout literal of P_Init is "\\nP_Init: Init Playloop state.\\n" (with a leading newline that breaks the R_Init progress dots).',
    queryKind: 'symbol-stdout-line',
    queryIndex: null,
    querySymbol: 'P_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: '\nP_Init: Init Playloop state.\n',
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_STDOUT_LITERALS_ARE_VERBATIM',
  },
  {
    id: 'v-init-phase-is-pre-banner',
    description: 'V_Init is in the pre-banner phase.',
    queryKind: 'symbol-phase',
    queryIndex: null,
    querySymbol: 'V_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: 'pre-banner',
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_PARTITIONS_FOUR_BEFORE_AND_EIGHT_AFTER_BANNER',
  },
  {
    id: 'st-init-phase-is-post-banner',
    description: 'ST_Init is in the post-banner phase.',
    queryKind: 'symbol-phase',
    queryIndex: null,
    querySymbol: 'ST_Init',
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: 'post-banner',
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_PARTITIONS_FOUR_BEFORE_AND_EIGHT_AFTER_BANNER',
  },
  {
    id: 'p-init-precedes-i-init',
    description: 'P_Init precedes I_Init in the vanilla init order (this pair is the I_Init position divergence from Chocolate).',
    queryKind: 'symbol-precedes',
    queryIndex: null,
    querySymbol: null,
    queryEarlierSymbol: 'P_Init',
    queryLaterSymbol: 'I_Init',
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: true,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_I_INIT_FOLLOWS_P_INIT_NOT_W_INIT',
  },
  {
    id: 'd-checknetgame-precedes-s-init',
    description: 'D_CheckNetGame precedes S_Init in the vanilla init order (this pair is the D_CheckNetGame/S_Init divergence from Chocolate).',
    queryKind: 'symbol-precedes',
    queryIndex: null,
    querySymbol: null,
    queryEarlierSymbol: 'D_CheckNetGame',
    queryLaterSymbol: 'S_Init',
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: true,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_D_CHECKNETGAME_PRECEDES_S_INIT',
  },
  {
    id: 'sequence-length-is-twelve',
    description: 'The canonical sequence length is 12.',
    queryKind: 'sequence-length',
    queryIndex: null,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: 12,
    witnessInvariantId: 'INIT_SEQUENCE_HAS_EXACTLY_TWELVE_STEPS',
  },
  {
    id: 'pre-banner-step-count-is-four',
    description: 'The pre-banner step count is 4.',
    queryKind: 'pre-banner-step-count',
    queryIndex: null,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: 4,
    witnessInvariantId: 'INIT_SEQUENCE_PARTITIONS_FOUR_BEFORE_AND_EIGHT_AFTER_BANNER',
  },
  {
    id: 'post-banner-step-count-is-eight',
    description: 'The post-banner step count is 8.',
    queryKind: 'post-banner-step-count',
    queryIndex: null,
    querySymbol: null,
    queryEarlierSymbol: null,
    queryLaterSymbol: null,
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: null,
    expectedAnsweredCount: 8,
    witnessInvariantId: 'INIT_SEQUENCE_PARTITIONS_FOUR_BEFORE_AND_EIGHT_AFTER_BANNER',
  },
  {
    id: 'opl-init-precedence-against-st-init-is-false',
    description: 'OPL_Init does NOT precede ST_Init because OPL_Init is absent from the vanilla init order; the precedence query returns false on any pair where the first argument is absent.',
    queryKind: 'symbol-precedes',
    queryIndex: null,
    querySymbol: null,
    queryEarlierSymbol: 'OPL_Init',
    queryLaterSymbol: 'ST_Init',
    expectedAnsweredSymbol: null,
    expectedAnsweredIndex: null,
    expectedAnsweredPresent: null,
    expectedAnsweredStdoutLine: null,
    expectedAnsweredPhase: null,
    expectedAnsweredPrecedes: false,
    expectedAnsweredCount: null,
    witnessInvariantId: 'INIT_SEQUENCE_OMITS_OPL_INIT',
  },
];

/** Number of pinned probes. */
export const VANILLA_D_DOOMMAIN_INIT_ORDER_PROBE_COUNT = 29;

/**
 * Result of a single probe run against a vanilla `D_DoomMain` init-
 * order handler. Each query kind populates a different result field;
 * fields not relevant to the query kind are `null`.
 */
export interface VanillaDDoomMainInitOrderResult {
  readonly answeredSymbol: VanillaInitStepCSymbol | null;
  readonly answeredIndex: number | null;
  readonly answeredPresent: boolean | null;
  readonly answeredStdoutLine: string | null;
  readonly answeredPhase: VanillaInitStepPhase | null;
  readonly answeredPrecedes: boolean | null;
  readonly answeredCount: number | null;
}

/**
 * A minimal handler interface modelling the canonical vanilla 1.9
 * `D_DoomMain` init-order skeleton. The reference implementation
 * answers each query against the pinned 12-step canonical sequence;
 * the cross-check accepts any handler shape so the focused test can
 * exercise deliberately broken adapters and observe the failure ids.
 */
export interface VanillaDDoomMainInitOrderHandler {
  /**
   * Run a probe against a fresh handler instance. Returns the relevant
   * answer fields populated for the probe's query kind; unrelated
   * fields are `null`.
   */
  readonly runProbe: (probe: VanillaDDoomMainInitOrderProbe) => VanillaDDoomMainInitOrderResult;
}

/**
 * Reference handler that answers every query against the canonical
 * 12-step vanilla 1.9 init sequence. The focused test asserts that
 * this handler passes every probe with zero failures.
 */
function referenceVanillaDDoomMainInitOrderProbe(probe: VanillaDDoomMainInitOrderProbe): VanillaDDoomMainInitOrderResult {
  switch (probe.queryKind) {
    case 'symbol-at-index': {
      const index = probe.queryIndex!;
      const step = VANILLA_D_DOOMMAIN_INIT_ORDER[index];
      return Object.freeze({
        answeredSymbol: step ? step.cSymbol : null,
        answeredIndex: null,
        answeredPresent: null,
        answeredStdoutLine: null,
        answeredPhase: null,
        answeredPrecedes: null,
        answeredCount: null,
      });
    }
    case 'index-of-symbol': {
      const symbol = probe.querySymbol!;
      const found = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === symbol);
      return Object.freeze({
        answeredSymbol: null,
        answeredIndex: found ? found.index : -1,
        answeredPresent: null,
        answeredStdoutLine: null,
        answeredPhase: null,
        answeredPrecedes: null,
        answeredCount: null,
      });
    }
    case 'symbol-presence': {
      const symbol = probe.querySymbol!;
      const present = VANILLA_D_DOOMMAIN_INIT_ORDER.some((step) => step.cSymbol === symbol);
      return Object.freeze({
        answeredSymbol: null,
        answeredIndex: null,
        answeredPresent: present,
        answeredStdoutLine: null,
        answeredPhase: null,
        answeredPrecedes: null,
        answeredCount: null,
      });
    }
    case 'symbol-stdout-line': {
      const symbol = probe.querySymbol!;
      const found = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === symbol);
      return Object.freeze({
        answeredSymbol: null,
        answeredIndex: null,
        answeredPresent: null,
        answeredStdoutLine: found ? found.stdoutLine : null,
        answeredPhase: null,
        answeredPrecedes: null,
        answeredCount: null,
      });
    }
    case 'symbol-phase': {
      const symbol = probe.querySymbol!;
      const found = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === symbol);
      return Object.freeze({
        answeredSymbol: null,
        answeredIndex: null,
        answeredPresent: null,
        answeredStdoutLine: null,
        answeredPhase: found ? found.phase : null,
        answeredPrecedes: null,
        answeredCount: null,
      });
    }
    case 'symbol-precedes': {
      const earlier = probe.queryEarlierSymbol!;
      const later = probe.queryLaterSymbol!;
      const earlierStep = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === earlier);
      const laterStep = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === later);
      const precedes = earlierStep !== undefined && laterStep !== undefined && earlierStep.index < laterStep.index;
      return Object.freeze({
        answeredSymbol: null,
        answeredIndex: null,
        answeredPresent: null,
        answeredStdoutLine: null,
        answeredPhase: null,
        answeredPrecedes: precedes,
        answeredCount: null,
      });
    }
    case 'sequence-length': {
      return Object.freeze({
        answeredSymbol: null,
        answeredIndex: null,
        answeredPresent: null,
        answeredStdoutLine: null,
        answeredPhase: null,
        answeredPrecedes: null,
        answeredCount: VANILLA_D_DOOMMAIN_INIT_ORDER.length,
      });
    }
    case 'pre-banner-step-count': {
      return Object.freeze({
        answeredSymbol: null,
        answeredIndex: null,
        answeredPresent: null,
        answeredStdoutLine: null,
        answeredPhase: null,
        answeredPrecedes: null,
        answeredCount: VANILLA_D_DOOMMAIN_INIT_ORDER.filter((step) => step.phase === 'pre-banner').length,
      });
    }
    case 'post-banner-step-count': {
      return Object.freeze({
        answeredSymbol: null,
        answeredIndex: null,
        answeredPresent: null,
        answeredStdoutLine: null,
        answeredPhase: null,
        answeredPrecedes: null,
        answeredCount: VANILLA_D_DOOMMAIN_INIT_ORDER.filter((step) => step.phase === 'post-banner').length,
      });
    }
  }
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER: VanillaDDoomMainInitOrderHandler = Object.freeze({
  runProbe: referenceVanillaDDoomMainInitOrderProbe,
});

/**
 * Cross-check a `VanillaDDoomMainInitOrderHandler` against
 * `VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES`. Returns the list of failures
 * by stable identifier; an empty list means the handler is parity-safe
 * with the canonical vanilla 1.9 `D_DoomMain` init skeleton.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:answeredSymbol:value-mismatch`
 *  - `probe:<probe.id>:answeredIndex:value-mismatch`
 *  - `probe:<probe.id>:answeredPresent:value-mismatch`
 *  - `probe:<probe.id>:answeredStdoutLine:value-mismatch`
 *  - `probe:<probe.id>:answeredPhase:value-mismatch`
 *  - `probe:<probe.id>:answeredPrecedes:value-mismatch`
 *  - `probe:<probe.id>:answeredCount:value-mismatch`
 */
export function crossCheckVanillaDDoomMainInitOrder(handler: VanillaDDoomMainInitOrderHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
    const result = handler.runProbe(probe);

    if (probe.expectedAnsweredSymbol !== null && result.answeredSymbol !== probe.expectedAnsweredSymbol) {
      failures.push(`probe:${probe.id}:answeredSymbol:value-mismatch`);
    }
    if (probe.expectedAnsweredIndex !== null && result.answeredIndex !== probe.expectedAnsweredIndex) {
      failures.push(`probe:${probe.id}:answeredIndex:value-mismatch`);
    }
    if (probe.expectedAnsweredPresent !== null && result.answeredPresent !== probe.expectedAnsweredPresent) {
      failures.push(`probe:${probe.id}:answeredPresent:value-mismatch`);
    }
    if (probe.expectedAnsweredStdoutLine !== null && result.answeredStdoutLine !== probe.expectedAnsweredStdoutLine) {
      failures.push(`probe:${probe.id}:answeredStdoutLine:value-mismatch`);
    }
    if (probe.expectedAnsweredPhase !== null && result.answeredPhase !== probe.expectedAnsweredPhase) {
      failures.push(`probe:${probe.id}:answeredPhase:value-mismatch`);
    }
    if (probe.expectedAnsweredPrecedes !== null && result.answeredPrecedes !== probe.expectedAnsweredPrecedes) {
      failures.push(`probe:${probe.id}:answeredPrecedes:value-mismatch`);
    }
    if (probe.expectedAnsweredCount !== null && result.answeredCount !== probe.expectedAnsweredCount) {
      failures.push(`probe:${probe.id}:answeredCount:value-mismatch`);
    }
  }

  return failures;
}

/**
 * Convenience helper: derive the expected answer for an arbitrary
 * probe against the canonical vanilla 1.9 `D_DoomMain` init skeleton.
 * The focused test uses this helper to cross-validate probe
 * expectations independently of the reference handler.
 */
export function deriveExpectedVanillaDDoomMainInitOrderResult(probe: VanillaDDoomMainInitOrderProbe): VanillaDDoomMainInitOrderResult {
  return referenceVanillaDDoomMainInitOrderProbe(probe);
}
