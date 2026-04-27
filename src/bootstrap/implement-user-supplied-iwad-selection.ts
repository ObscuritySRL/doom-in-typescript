/**
 * Audit ledger for the vanilla DOOM 1.9 user-supplied IWAD selection
 * surface inside `IdentifyVersion()`. The accompanying focused test
 * cross-checks every audited contract clause against a self-contained
 * reference handler that resolves the user-supplied IWAD selection the
 * same way vanilla `IdentifyVersion()` does.
 *
 * The canonical vanilla DOOM 1.9 surface for user-supplied IWAD
 * selection consists of three command-line parameters that override the
 * candidate-scan branch of `IdentifyVersion()`: `-shdev`, `-regdev`,
 * and `-comdev`. Each parameter sets the gamemode to a fixed enum
 * value, sets the global `devparm` flag, calls `D_AddFile` against a
 * hard-coded `DEVDATA"<basename>.wad"` path that bypasses the
 * `getenv("DOOMWADDIR")` lookup, copies a hard-coded `default.cfg`
 * path into the `basedefault` global, and early-returns from
 * `IdentifyVersion()` so the seven `access(R_OK)` candidate probes
 * never run.
 *
 * Vanilla DOOM 1.9 does NOT have a `-iwad <path>` flag. The `-iwad`
 * surface is a Chocolate Doom 2.2.1 addition (`D_FindIWAD`,
 * `D_FindWADByName`, `M_CheckParmWithArgs("-iwad", 1)`); pinning it
 * here would invent behavior beyond the vanilla 1.9 contract. The
 * `-file <basename>...` flag adds extra WADs to the wad list via
 * `D_AddFile` but does NOT change the gamemode or the IWAD selected
 * by `IdentifyVersion()`; vanilla treats `-file` strictly as a PWAD
 * loader.
 *
 * No runtime user-supplied IWAD selection module exists yet in
 * `src/bootstrap/` — this step pins the dev-parameter override
 * semantics so a later implementation step (or an oracle follow-up
 * that observes `doom/DOOMD.EXE` directly under controlled command
 * lines) can be cross-checked for parity. The audit module
 * deliberately avoids importing from any runtime source so that a
 * corrupted runtime cannot silently calibrate the audit's own probe
 * table.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the
 *      dev-parameter triple — `d_main.c` `IdentifyVersion()` is the
 *      verbatim source of the three `if (M_CheckParm("-shdev|-regdev|-comdev"))`
 *      blocks, the `gamemode = <enum>;` assignments, the
 *      `devparm = true;` flag set, the `D_AddFile (DEVDATA"<basename>")`
 *      call, the `strcpy (basedefault,DEVDATA"default.cfg")` copy,
 *      and the early `return;` that short-circuits the candidate
 *      scan),
 *   5. Chocolate Doom 2.2.1 source.
 *
 * The audit invariants below are pinned against authority 4 because
 * the dev-parameter triple is a textual property of the three
 * `if (M_CheckParm(...))` blocks at the top of `IdentifyVersion()`,
 * before the seven `access(R_OK)` candidate probes. Authority 1 (the
 * DOS binary) cannot disagree because the dev-parameter override is
 * the visible pre-condition every vanilla developer-mode startup
 * depends on; authority 5 (Chocolate Doom 2.2.1) deliberately
 * diverges (it removes the `-shdev`/`-regdev`/`-comdev` triple
 * entirely and replaces them with the `-iwad <path>` flag and
 * `D_FindIWAD`) and so is NOT the authority for this audit even
 * though it covers user-supplied IWAD selection at a higher level.
 */

import type { GameMode } from './gameMode.ts';

/**
 * One audited contract invariant of the user-supplied IWAD selection
 * surface inside vanilla DOOM 1.9 `IdentifyVersion()`.
 */
export interface VanillaUserSuppliedIwadSelectionContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'DEV_PARAMETER_NAMES_ARE_FIXED_TRIPLE'
    | 'DEV_PARAMETER_PROBE_ORDER_IS_SHDEV_REGDEV_COMDEV'
    | 'DEV_PARAMETER_TRIPLE_PROBES_PRECEDE_CANDIDATE_SCAN'
    | 'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME'
    | 'DEV_PARAMETER_SETS_DEVPARM_GLOBAL_TRUE'
    | 'DEV_PARAMETER_USES_HARDCODED_DEVDATA_BASENAME'
    | 'DEV_PARAMETER_SHORT_CIRCUITS_CANDIDATE_SCAN_VIA_RETURN'
    | 'DEV_PARAMETER_OVERWRITES_BASEDEFAULT_PATH_LITERAL'
    | 'NO_DASH_IWAD_FLAG_EXISTS_IN_VANILLA_ONE_DOT_NINE'
    | 'DASH_FILE_FLAG_DOES_NOT_OVERRIDE_GAME_MODE'
    | 'DEV_PARAMETER_M_CHECKPARM_LOOKUP_IS_CASE_INSENSITIVE';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'd_main.c';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'IdentifyVersion';
}

/**
 * Pinned ledger of every contract clause of the user-supplied IWAD
 * selection surface inside `IdentifyVersion()`.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT: readonly VanillaUserSuppliedIwadSelectionContractAuditEntry[] = [
  {
    id: 'DEV_PARAMETER_NAMES_ARE_FIXED_TRIPLE',
    invariant:
      'IdentifyVersion probes a fixed triple of developer-mode parameter names at the top of the function, before the seven access(R_OK) candidate probes: "-shdev", "-regdev", and "-comdev". No other developer parameter name is recognised; no synonym, abbreviation, or alternate casing is accepted at the literal level (M_CheckParm folds case during the scan, but the literal probed strings are the exact lowercase forms above).',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'DEV_PARAMETER_PROBE_ORDER_IS_SHDEV_REGDEV_COMDEV',
    invariant:
      'IdentifyVersion calls M_CheckParm on the developer-mode triple in this exact order: -shdev (shareware developer), -regdev (registered developer), -comdev (commercial developer). The order is hard-coded as a sequence of three independent `if (M_CheckParm(...))` blocks and is not data-driven; the first parameter that matches takes effect via early return and the others are never consulted within a single IdentifyVersion call.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'DEV_PARAMETER_TRIPLE_PROBES_PRECEDE_CANDIDATE_SCAN',
    invariant:
      'The three developer-mode probes occur at the top of IdentifyVersion, after the doomwaddir resolution and the home/basedefault setup, but before the first of the seven access(R_OK) candidate probes (doom2f.wad). When any developer parameter matches, the early return inside its block prevents IdentifyVersion from reaching the candidate scan; the canonical filename probe order is therefore short-circuited, not augmented, by the developer parameters.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME',
    invariant:
      'Each developer-mode block assigns the gamemode global to a literal enum constant determined purely by which flag matched: -shdev → shareware, -regdev → registered, -comdev → commercial. Vanilla IdentifyVersion does NOT inspect WAD lump contents to derive the gamemode for a developer-mode override; the flag name is the sole determinant. (Chocolate Doom 2.2.1 diverges by removing the developer-mode triple entirely; this audit pins the vanilla-only behavior.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'DEV_PARAMETER_SETS_DEVPARM_GLOBAL_TRUE',
    invariant:
      'Each developer-mode block sets the file-scope `devparm` global to the literal `true` immediately after assigning the gamemode and before calling D_AddFile. The `devparm` global is consulted later by HUD overlays, screenshots, and limit-checking code paths; the user-supplied IWAD selection branch is therefore the unique entry path that toggles `devparm` on at startup.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'DEV_PARAMETER_USES_HARDCODED_DEVDATA_BASENAME',
    invariant:
      'Each developer-mode block calls D_AddFile with a hardcoded `DEVDATA"<basename>"` literal that bypasses the `getenv("DOOMWADDIR")` lookup used by the candidate scan. The basenames are -shdev → "doom1.wad", -regdev → "doom.wad", -comdev → "doom2.wad". The DEVDATA macro expands to a developer-only directory (e.g., "/usr/local/games/data_se/" on linuxdoom-1.10) and is unrelated to DOOMWADDIR, the current working directory, or the seven candidate probes.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'DEV_PARAMETER_SHORT_CIRCUITS_CANDIDATE_SCAN_VIA_RETURN',
    invariant:
      'Each developer-mode block ends with `return;` after assigning the gamemode, setting devparm, calling D_AddFile, and copying the basedefault path. The early return prevents IdentifyVersion from reaching the seven access(R_OK) candidate probes that would otherwise determine the gamemode; the candidate scan and the developer-mode override are mutually exclusive within a single IdentifyVersion invocation.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'DEV_PARAMETER_OVERWRITES_BASEDEFAULT_PATH_LITERAL',
    invariant:
      'Each developer-mode block calls `strcpy (basedefault, DEVDATA"default.cfg")` after the D_AddFile call and before the early return. The basedefault global is therefore overwritten with the hardcoded developer config path regardless of the previously computed `<HOME>/.doomrc` path. The default config used at startup is consequently a developer-mode default.cfg, not the user\'s home-directory dotfile.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'NO_DASH_IWAD_FLAG_EXISTS_IN_VANILLA_ONE_DOT_NINE',
    invariant:
      'Vanilla DOOM 1.9 (linuxdoom-1.10) does NOT define or recognise a `-iwad <path>` command-line flag. There is no M_CheckParm("-iwad") call inside IdentifyVersion or anywhere else in d_main.c; there is no D_FindIWAD or D_FindWADByName helper. The `-iwad <path>` surface is a Chocolate Doom 2.2.1 addition (introduced via `D_FindIWAD` and `M_CheckParmWithArgs("-iwad", 1)` in d_iwad.c) and pinning it as a vanilla 1.9 user-supplied IWAD mechanism would invent behavior beyond the canonical contract.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'DASH_FILE_FLAG_DOES_NOT_OVERRIDE_GAME_MODE',
    invariant:
      'The `-file <basename>...` command-line flag is recognised by D_DoomMain (not IdentifyVersion). It loops over each trailing argument and calls D_AddFile for every basename, so the user can supply additional WADs (typically PWADs) at startup. -file does NOT call IdentifyVersion, does NOT modify the gamemode, and does NOT alter the IWAD selection performed by either the developer-mode triple or the seven-candidate scan. -file is therefore a PWAD loader, not a user-supplied IWAD selection mechanism in vanilla 1.9.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'DEV_PARAMETER_M_CHECKPARM_LOOKUP_IS_CASE_INSENSITIVE',
    invariant:
      'M_CheckParm performs a case-insensitive comparison via `strcasecmp(check, myargv[i])`. The literal probed strings inside the developer-mode triple are lowercase ("-shdev", "-regdev", "-comdev"), but a user typing "-SHDEV", "-RegDev", or "-ComDev" on the command line will still match because of the case-insensitive scan. The literal lowercase form is the canonical pinned probe; case folding is a property of M_CheckParm, not of the IdentifyVersion blocks themselves.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
] as const;

/**
 * One vanilla developer-mode parameter as it appears in the
 * `IdentifyVersion()` probe sequence: the literal lowercase parameter
 * name plus the gamemode the flag pins, the basename it loads via
 * D_AddFile, and the position of its block within IdentifyVersion.
 */
export interface VanillaDeveloperModeParameter {
  /** Literal lowercase parameter name probed via M_CheckParm. */
  readonly parameterName: '-shdev' | '-regdev' | '-comdev';
  /** Gamemode the parameter pins on a successful match. */
  readonly gameMode: GameMode;
  /** IWAD basename loaded via D_AddFile when the parameter matches. */
  readonly devDataBasename: 'doom1.wad' | 'doom.wad' | 'doom2.wad';
  /** Index of the parameter's block within IdentifyVersion (0-based, in canonical probe order). */
  readonly probeOrderIndex: 0 | 1 | 2;
}

/**
 * Frozen three-entry list of vanilla developer-mode parameters in
 * their canonical probe order. The order is the verbatim sequence of
 * three `if (M_CheckParm(...))` blocks at the top of `IdentifyVersion()`
 * and MUST NOT be reordered.
 */
export const VANILLA_DEVELOPER_MODE_PARAMETERS: readonly VanillaDeveloperModeParameter[] = Object.freeze([
  Object.freeze({ parameterName: '-shdev', gameMode: 'shareware', devDataBasename: 'doom1.wad', probeOrderIndex: 0 }) satisfies VanillaDeveloperModeParameter,
  Object.freeze({ parameterName: '-regdev', gameMode: 'registered', devDataBasename: 'doom.wad', probeOrderIndex: 1 }) satisfies VanillaDeveloperModeParameter,
  Object.freeze({ parameterName: '-comdev', gameMode: 'commercial', devDataBasename: 'doom2.wad', probeOrderIndex: 2 }) satisfies VanillaDeveloperModeParameter,
]);

/**
 * The literal lowercase command-line flag name that does NOT exist in
 * vanilla DOOM 1.9. Pinned so that any cross-check that observes the
 * flag being recognised inside an IdentifyVersion implementation can
 * report a deviation from the vanilla contract.
 */
export const VANILLA_NONEXISTENT_DASH_IWAD_PARAMETER_NAME = '-iwad';

/**
 * The literal lowercase command-line flag name for the PWAD loader
 * that is recognised by D_DoomMain (not IdentifyVersion). Pinned so
 * that any cross-check that observes the flag overriding the gamemode
 * can report a deviation from the vanilla contract.
 */
export const VANILLA_DASH_FILE_PARAMETER_NAME = '-file';

/**
 * The literal lowercase basename of the developer-mode default config
 * the `strcpy (basedefault,DEVDATA"default.cfg")` line installs.
 */
export const VANILLA_DEVELOPER_MODE_DEFAULT_CFG_BASENAME = 'default.cfg';

/**
 * The number of developer-mode parameter probes inside
 * `IdentifyVersion()`. Pinned by the verbatim sequence of three
 * independent `if (M_CheckParm(...))` blocks for `-shdev`, `-regdev`,
 * and `-comdev`.
 */
export const VANILLA_DEVELOPER_MODE_PARAMETER_COUNT = 3;

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity user-supplied IWAD selection handler must
 * preserve.
 */
export interface VanillaUserSuppliedIwadSelectionDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_USER_SUPPLIED_IWAD_SELECTION_DERIVED_INVARIANTS: readonly VanillaUserSuppliedIwadSelectionDerivedInvariant[] = [
  {
    id: 'DEV_PARAMETER_TRIPLE_HAS_EXACTLY_THREE_FLAGS',
    description: 'The vanilla developer-mode parameter list has exactly three entries (-shdev, -regdev, -comdev). Adding or removing entries is a parity violation.',
  },
  {
    id: 'DEV_PARAMETER_TRIPLE_ORDER_IS_VERBATIM_VANILLA',
    description:
      'The developer-mode parameter probe order is the verbatim sequence of `if (M_CheckParm(...))` blocks in IdentifyVersion (-shdev, then -regdev, then -comdev). Reordering is a parity violation even when the parameter set is preserved.',
  },
  {
    id: 'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME_ALONE',
    description:
      'The selected gamemode for a developer-mode match is determined by the matched parameter name alone; no lump inspection occurs in vanilla IdentifyVersion. -shdev pins shareware, -regdev pins registered, -comdev pins commercial.',
  },
  {
    id: 'DEV_PARAMETER_SETS_DEVPARM_FLAG_TRUE',
    description: 'The developer-mode parameter triple is the unique entry path that toggles the `devparm` global to true at startup; the candidate-scan branch never sets `devparm`.',
  },
  {
    id: 'DEV_PARAMETER_LOADS_HARDCODED_DEVDATA_BASENAME_NOT_DOOMWADDIR',
    description:
      'The IWAD basename loaded via D_AddFile under a developer-mode override is hardcoded by the parameter (-shdev → doom1.wad, -regdev → doom.wad, -comdev → doom2.wad) and is loaded from the DEVDATA prefix, NOT from the DOOMWADDIR-resolved candidate path used by the seven access(R_OK) probes.',
  },
  {
    id: 'DEV_PARAMETER_OVERRIDE_BYPASSES_CANDIDATE_SCAN',
    description:
      'When any developer-mode parameter matches, IdentifyVersion early-returns from inside the matching block; the seven access(R_OK) candidate probes never execute. A handler that runs the candidate scan in addition to (or in place of) the developer-mode block is a parity violation.',
  },
  {
    id: 'DEV_PARAMETER_FIRST_MATCH_WINS',
    description:
      'The three developer-mode parameter blocks are mutually exclusive within a single IdentifyVersion invocation: the first block whose M_CheckParm probe succeeds executes its body and returns. A handler that consults a later block after an earlier match is a parity violation.',
  },
  {
    id: 'DEV_PARAMETER_OVERWRITES_BASEDEFAULT_WITH_DEVDATA_DEFAULT_CFG',
    description:
      'Each developer-mode block calls strcpy(basedefault, DEVDATA "default.cfg") before the early return. The basedefault global is therefore guaranteed to point at the developer-mode default.cfg path, not the home-directory .doomrc, after a developer-mode override fires.',
  },
  {
    id: 'DASH_IWAD_FLAG_IS_NOT_RECOGNISED_BY_VANILLA',
    description:
      'The "-iwad" command-line flag is a Chocolate Doom 2.2.1 addition; vanilla 1.9 does not recognise it. A handler that observes "-iwad" overriding the gamemode or the IWAD basename in a vanilla-1.9 audit is a parity violation.',
  },
  {
    id: 'DASH_FILE_FLAG_DOES_NOT_AFFECT_GAME_MODE_OR_IWAD_SELECTION',
    description:
      'The "-file" command-line flag adds extra WADs to the wad list via D_AddFile but does NOT call IdentifyVersion, does NOT change the gamemode, and does NOT alter the IWAD selection performed by either the developer-mode triple or the seven-candidate scan. A handler that uses "-file" as an IWAD override is a parity violation.',
  },
];

/**
 * One probe applied to a runtime vanilla user-supplied IWAD selection
 * handler.
 *
 * Each probe pins:
 *  - a virtual command line (the argv-like sequence of arguments),
 *  - the expected matched developer-mode parameter (or null on no match),
 *  - the expected gameMode,
 *  - the expected `devparm` flag setting,
 *  - the expected IWAD basename loaded via D_AddFile (or null on no match),
 *  - the expected probe sequence (the developer-mode parameter names
 *    the handler must have consulted in order, ending at the matched
 *    parameter or running through all three if no match).
 */
export interface VanillaUserSuppliedIwadSelectionProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Virtual command line as an argv-like sequence (program name at index 0). */
  readonly virtualCommandLine: readonly string[];
  /** Expected matched developer-mode parameter name (one of the three) or null. */
  readonly expectedMatchedParameterName: VanillaDeveloperModeParameter['parameterName'] | null;
  /** Expected gameMode (one of the dev-mode pins or 'indetermined' on no match). */
  readonly expectedGameMode: GameMode;
  /** Expected `devparm` flag setting (true on dev-mode match, false otherwise). */
  readonly expectedDevparmFlag: boolean;
  /** Expected hardcoded DEVDATA IWAD basename loaded via D_AddFile (or null on no match). */
  readonly expectedDevDataBasename: VanillaDeveloperModeParameter['devDataBasename'] | null;
  /**
   * Expected sequence of probed developer-mode parameter names in
   * order. When the handler matches a parameter it stops at that
   * parameter; the probe sequence ends at the match. When no match
   * occurs, the sequence walks through all three parameters.
   */
  readonly expectedProbeSequence: readonly VanillaDeveloperModeParameter['parameterName'][];
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId:
    | 'DEV_PARAMETER_TRIPLE_HAS_EXACTLY_THREE_FLAGS'
    | 'DEV_PARAMETER_TRIPLE_ORDER_IS_VERBATIM_VANILLA'
    | 'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME_ALONE'
    | 'DEV_PARAMETER_SETS_DEVPARM_FLAG_TRUE'
    | 'DEV_PARAMETER_LOADS_HARDCODED_DEVDATA_BASENAME_NOT_DOOMWADDIR'
    | 'DEV_PARAMETER_OVERRIDE_BYPASSES_CANDIDATE_SCAN'
    | 'DEV_PARAMETER_FIRST_MATCH_WINS'
    | 'DEV_PARAMETER_OVERWRITES_BASEDEFAULT_WITH_DEVDATA_DEFAULT_CFG'
    | 'DASH_IWAD_FLAG_IS_NOT_RECOGNISED_BY_VANILLA'
    | 'DASH_FILE_FLAG_DOES_NOT_AFFECT_GAME_MODE_OR_IWAD_SELECTION';
}

/** All three developer-mode parameter names in canonical probe order. */
const ALL_THREE_PARAMETERS: readonly VanillaDeveloperModeParameter['parameterName'][] = Object.freeze(['-shdev', '-regdev', '-comdev']);

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a small virtual command line plus one expected outcome per
 * runtime method.
 */
export const VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES: readonly VanillaUserSuppliedIwadSelectionProbe[] = [
  {
    id: 'shdev-pins-shareware-and-loads-doom1-wad',
    description:
      'A virtual command line containing "-shdev" walks the first developer-mode block, matches at probe index 0, and pins gamemode=shareware with devparm=true and devDataBasename=doom1.wad. The probe sequence stops at -shdev because the early return fires.',
    virtualCommandLine: ['doom', '-shdev'],
    expectedMatchedParameterName: '-shdev',
    expectedGameMode: 'shareware',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom1.wad',
    expectedProbeSequence: ['-shdev'],
    witnessInvariantId: 'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME_ALONE',
  },
  {
    id: 'regdev-pins-registered-and-loads-doom-wad',
    description: 'A virtual command line containing "-regdev" walks past the -shdev probe, matches at probe index 1, and pins gamemode=registered with devparm=true and devDataBasename=doom.wad. The probe sequence ends at -regdev.',
    virtualCommandLine: ['doom', '-regdev'],
    expectedMatchedParameterName: '-regdev',
    expectedGameMode: 'registered',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom.wad',
    expectedProbeSequence: ['-shdev', '-regdev'],
    witnessInvariantId: 'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME_ALONE',
  },
  {
    id: 'comdev-pins-commercial-and-loads-doom2-wad',
    description:
      'A virtual command line containing "-comdev" walks past -shdev and -regdev, matches at probe index 2, and pins gamemode=commercial with devparm=true and devDataBasename=doom2.wad. The probe sequence ends at -comdev (all three probed).',
    virtualCommandLine: ['doom', '-comdev'],
    expectedMatchedParameterName: '-comdev',
    expectedGameMode: 'commercial',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom2.wad',
    expectedProbeSequence: ['-shdev', '-regdev', '-comdev'],
    witnessInvariantId: 'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME_ALONE',
  },
  {
    id: 'no-developer-parameter-leaves-game-mode-indetermined',
    description:
      'A virtual command line that contains no developer-mode parameters walks all three probes, matches none, and reports gamemode=indetermined with devparm=false and devDataBasename=null. (The candidate scan that would otherwise determine the gamemode is outside this audit; this probe pins only the developer-mode override branch.)',
    virtualCommandLine: ['doom'],
    expectedMatchedParameterName: null,
    expectedGameMode: 'indetermined',
    expectedDevparmFlag: false,
    expectedDevDataBasename: null,
    expectedProbeSequence: ALL_THREE_PARAMETERS,
    witnessInvariantId: 'DEV_PARAMETER_TRIPLE_HAS_EXACTLY_THREE_FLAGS',
  },
  {
    id: 'shdev-takes-precedence-over-regdev-when-both-supplied',
    description: 'When both "-shdev" and "-regdev" are present in the command line, the first match wins because of the early return inside the -shdev block. gamemode=shareware, devDataBasename=doom1.wad, probe sequence stops at -shdev.',
    virtualCommandLine: ['doom', '-shdev', '-regdev'],
    expectedMatchedParameterName: '-shdev',
    expectedGameMode: 'shareware',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom1.wad',
    expectedProbeSequence: ['-shdev'],
    witnessInvariantId: 'DEV_PARAMETER_FIRST_MATCH_WINS',
  },
  {
    id: 'regdev-takes-precedence-over-comdev-when-both-supplied',
    description:
      'When both "-regdev" and "-comdev" are present in the command line and -shdev is absent, the -regdev probe matches first because of the canonical probe order and the early return inside its block. gamemode=registered, devDataBasename=doom.wad, probe sequence stops at -regdev.',
    virtualCommandLine: ['doom', '-regdev', '-comdev'],
    expectedMatchedParameterName: '-regdev',
    expectedGameMode: 'registered',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom.wad',
    expectedProbeSequence: ['-shdev', '-regdev'],
    witnessInvariantId: 'DEV_PARAMETER_TRIPLE_ORDER_IS_VERBATIM_VANILLA',
  },
  {
    id: 'developer-parameter-sets-devparm-true',
    description: 'Any developer-mode match (e.g., -comdev) sets the devparm flag to true. A handler that leaves devparm=false after a successful developer-mode match is a parity violation.',
    virtualCommandLine: ['doom', '-comdev'],
    expectedMatchedParameterName: '-comdev',
    expectedGameMode: 'commercial',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom2.wad',
    expectedProbeSequence: ['-shdev', '-regdev', '-comdev'],
    witnessInvariantId: 'DEV_PARAMETER_SETS_DEVPARM_FLAG_TRUE',
  },
  {
    id: 'developer-parameter-loads-hardcoded-basename-not-doomwaddir',
    description:
      'A -shdev override loads "doom1.wad" via D_AddFile from the DEVDATA prefix. The basename is hardcoded inside the developer-mode block; it is NOT resolved against DOOMWADDIR or `.` like the candidate-scan probes. Even when DOOMWADDIR is set to a different directory or contains an alternate basename, the developer-mode override loads the same hardcoded basename.',
    virtualCommandLine: ['doom', '-shdev'],
    expectedMatchedParameterName: '-shdev',
    expectedGameMode: 'shareware',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom1.wad',
    expectedProbeSequence: ['-shdev'],
    witnessInvariantId: 'DEV_PARAMETER_LOADS_HARDCODED_DEVDATA_BASENAME_NOT_DOOMWADDIR',
  },
  {
    id: 'developer-parameter-bypasses-candidate-scan',
    description:
      'A -regdev match early-returns from IdentifyVersion before the candidate scan begins. A handler that runs the seven access(R_OK) probes after a developer-mode match is a parity violation; the developer-mode override is exclusive.',
    virtualCommandLine: ['doom', '-regdev'],
    expectedMatchedParameterName: '-regdev',
    expectedGameMode: 'registered',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom.wad',
    expectedProbeSequence: ['-shdev', '-regdev'],
    witnessInvariantId: 'DEV_PARAMETER_OVERRIDE_BYPASSES_CANDIDATE_SCAN',
  },
  {
    id: 'developer-parameter-overwrites-basedefault-with-devdata-default-cfg',
    description: 'A -comdev match overwrites the basedefault global with the DEVDATA"default.cfg" path. The default-config path used at startup is therefore the developer-mode default.cfg, not the home-directory .doomrc.',
    virtualCommandLine: ['doom', '-comdev'],
    expectedMatchedParameterName: '-comdev',
    expectedGameMode: 'commercial',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom2.wad',
    expectedProbeSequence: ['-shdev', '-regdev', '-comdev'],
    witnessInvariantId: 'DEV_PARAMETER_OVERWRITES_BASEDEFAULT_WITH_DEVDATA_DEFAULT_CFG',
  },
  {
    id: 'iwad-flag-is-not-recognised-by-vanilla-one-dot-nine',
    description:
      'A virtual command line containing "-iwad <path>" walks all three developer-mode probes, matches none of them, and reports gamemode=indetermined. Vanilla 1.9 does not recognise -iwad; the path argument is not consumed by IdentifyVersion. (Pinning -iwad as a vanilla mechanism would invent behavior beyond the canonical contract.)',
    virtualCommandLine: ['doom', '-iwad', '/some/path/DOOM.WAD'],
    expectedMatchedParameterName: null,
    expectedGameMode: 'indetermined',
    expectedDevparmFlag: false,
    expectedDevDataBasename: null,
    expectedProbeSequence: ALL_THREE_PARAMETERS,
    witnessInvariantId: 'DASH_IWAD_FLAG_IS_NOT_RECOGNISED_BY_VANILLA',
  },
  {
    id: 'file-flag-without-developer-parameter-leaves-game-mode-indetermined',
    description:
      'A virtual command line containing only "-file <wad>" arguments (no developer-mode parameters) walks all three developer-mode probes, matches none, and reports gamemode=indetermined. The -file flag is a PWAD loader handled outside IdentifyVersion and does not influence the user-supplied IWAD selection branch.',
    virtualCommandLine: ['doom', '-file', 'mywad.wad'],
    expectedMatchedParameterName: null,
    expectedGameMode: 'indetermined',
    expectedDevparmFlag: false,
    expectedDevDataBasename: null,
    expectedProbeSequence: ALL_THREE_PARAMETERS,
    witnessInvariantId: 'DASH_FILE_FLAG_DOES_NOT_AFFECT_GAME_MODE_OR_IWAD_SELECTION',
  },
  {
    id: 'file-flag-combined-with-shdev-still-pins-shareware',
    description:
      'When both "-file mywad.wad" and "-shdev" are present, the developer-mode override still wins. gamemode=shareware, devDataBasename=doom1.wad. The -file argument is a PWAD loader and does not affect the IWAD selection performed by the developer-mode block.',
    virtualCommandLine: ['doom', '-file', 'mywad.wad', '-shdev'],
    expectedMatchedParameterName: '-shdev',
    expectedGameMode: 'shareware',
    expectedDevparmFlag: true,
    expectedDevDataBasename: 'doom1.wad',
    expectedProbeSequence: ['-shdev'],
    witnessInvariantId: 'DASH_FILE_FLAG_DOES_NOT_AFFECT_GAME_MODE_OR_IWAD_SELECTION',
  },
];

/**
 * Result of a single user-supplied IWAD selection run: which
 * developer-mode parameter matched (or null), the assigned gameMode,
 * the resulting `devparm` flag, the hardcoded DEVDATA basename loaded
 * via D_AddFile (or null on no match), and the sequence of
 * developer-mode parameter names the handler probed in order.
 */
export interface VanillaUserSuppliedIwadSelectionResult {
  readonly matchedParameterName: VanillaDeveloperModeParameter['parameterName'] | null;
  readonly gameMode: GameMode;
  readonly devparmFlag: boolean;
  readonly devDataBasename: VanillaDeveloperModeParameter['devDataBasename'] | null;
  readonly probedSequence: readonly VanillaDeveloperModeParameter['parameterName'][];
}

/**
 * A minimal handler interface modelling the user-supplied IWAD
 * selection branch of vanilla `IdentifyVersion()`. The reference
 * implementation walks the canonical three-parameter list and
 * consults a caller-supplied virtual command line; the cross-check
 * accepts any handler shape so the focused test can exercise
 * deliberately broken adapters and observe the failure ids.
 */
export interface VanillaUserSuppliedIwadSelectionHandler {
  /**
   * Run a probe against a fresh handler instance. Returns the matched
   * developer-mode parameter, the assigned gameMode, the devparm flag,
   * the loaded DEVDATA basename, and the parameter sequence the
   * handler probed in order.
   */
  readonly runProbe: (probe: VanillaUserSuppliedIwadSelectionProbe) => VanillaUserSuppliedIwadSelectionResult;
}

/**
 * Case-insensitive scan that mirrors `M_CheckParm` semantics.
 * Returns true when any argument at index >= 1 matches the literal
 * lowercase parameter name folded to lowercase.
 */
function commandLineContainsParameter(virtualCommandLine: readonly string[], parameterName: string): boolean {
  const lowercaseTarget = parameterName.toLowerCase();
  for (let index = 1; index < virtualCommandLine.length; index++) {
    if (virtualCommandLine[index]!.toLowerCase() === lowercaseTarget) {
      return true;
    }
  }
  return false;
}

/**
 * Reference handler that walks `VANILLA_DEVELOPER_MODE_PARAMETERS` in
 * canonical order, consults the probe's virtual command line, and
 * stops at the first match. The matched developer-mode parameter
 * pins the gameMode, the devparm flag, and the hardcoded DEVDATA
 * basename. When no developer-mode parameter matches, the result is
 * `gameMode='indetermined'`, `devparm=false`, `devDataBasename=null`,
 * and `probedSequence` walks all three parameters in canonical order.
 */
function referenceVanillaUserSuppliedIwadSelectionProbe(probe: VanillaUserSuppliedIwadSelectionProbe): VanillaUserSuppliedIwadSelectionResult {
  const probed: VanillaDeveloperModeParameter['parameterName'][] = [];

  for (const developerParameter of VANILLA_DEVELOPER_MODE_PARAMETERS) {
    probed.push(developerParameter.parameterName);
    if (commandLineContainsParameter(probe.virtualCommandLine, developerParameter.parameterName)) {
      return Object.freeze({
        matchedParameterName: developerParameter.parameterName,
        gameMode: developerParameter.gameMode,
        devparmFlag: true,
        devDataBasename: developerParameter.devDataBasename,
        probedSequence: Object.freeze([...probed]),
      });
    }
  }

  return Object.freeze({
    matchedParameterName: null,
    gameMode: 'indetermined',
    devparmFlag: false,
    devDataBasename: null,
    probedSequence: Object.freeze([...probed]),
  });
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER: VanillaUserSuppliedIwadSelectionHandler = Object.freeze({
  runProbe: referenceVanillaUserSuppliedIwadSelectionProbe,
});

/**
 * Cross-check a `VanillaUserSuppliedIwadSelectionHandler` against
 * `VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES`. Returns the list of
 * failures by stable identifier; an empty list means the handler is
 * parity-safe with the developer-mode override branch of
 * `IdentifyVersion()`.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:matchedParameterName:value-mismatch`
 *  - `probe:<probe.id>:gameMode:value-mismatch`
 *  - `probe:<probe.id>:devparmFlag:value-mismatch`
 *  - `probe:<probe.id>:devDataBasename:value-mismatch`
 *  - `probe:<probe.id>:probedSequence:length-mismatch`
 *  - `probe:<probe.id>:probedSequence:order-mismatch`
 */
export function crossCheckVanillaUserSuppliedIwadSelection(handler: VanillaUserSuppliedIwadSelectionHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
    const result = handler.runProbe(probe);

    if (result.matchedParameterName !== probe.expectedMatchedParameterName) {
      failures.push(`probe:${probe.id}:matchedParameterName:value-mismatch`);
    }

    if (result.gameMode !== probe.expectedGameMode) {
      failures.push(`probe:${probe.id}:gameMode:value-mismatch`);
    }

    if (result.devparmFlag !== probe.expectedDevparmFlag) {
      failures.push(`probe:${probe.id}:devparmFlag:value-mismatch`);
    }

    if (result.devDataBasename !== probe.expectedDevDataBasename) {
      failures.push(`probe:${probe.id}:devDataBasename:value-mismatch`);
    }

    if (result.probedSequence.length !== probe.expectedProbeSequence.length) {
      failures.push(`probe:${probe.id}:probedSequence:length-mismatch`);
    } else {
      for (let index = 0; index < probe.expectedProbeSequence.length; index++) {
        if (result.probedSequence[index] !== probe.expectedProbeSequence[index]) {
          failures.push(`probe:${probe.id}:probedSequence:order-mismatch`);
          break;
        }
      }
    }
  }

  return failures;
}

/**
 * Convenience helper: derive the expected user-supplied IWAD
 * selection result for a given virtual command line, mirroring the
 * developer-mode-override semantics the audit pins. The focused test
 * uses this helper to cross-validate probe expectations independently
 * of the reference handler.
 */
export function deriveExpectedUserSuppliedIwadSelectionResult(virtualCommandLine: readonly string[]): VanillaUserSuppliedIwadSelectionResult {
  return referenceVanillaUserSuppliedIwadSelectionProbe({
    id: 'derive-expected-helper',
    description: 'Internal helper invocation; not part of the pinned probe set.',
    virtualCommandLine,
    expectedMatchedParameterName: null,
    expectedGameMode: 'indetermined',
    expectedDevparmFlag: false,
    expectedDevDataBasename: null,
    expectedProbeSequence: ALL_THREE_PARAMETERS,
    witnessInvariantId: 'DEV_PARAMETER_TRIPLE_HAS_EXACTLY_THREE_FLAGS',
  });
}
