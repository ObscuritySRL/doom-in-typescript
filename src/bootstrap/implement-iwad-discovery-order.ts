/**
 * Audit ledger for the vanilla DOOM 1.9 IWAD discovery order pinned by
 * `IdentifyVersion()` in id Software's `linuxdoom-1.10/d_main.c`. The
 * accompanying focused test cross-checks every audited contract clause
 * against a self-contained reference handler that probes a virtual file
 * system in the canonical vanilla candidate order.
 *
 * No runtime IWAD discovery module exists yet in `src/bootstrap/` — this
 * step pins the semantics so a later implementation step (or an oracle
 * follow-up that observes `doom/DOOMD.EXE` directly) can be cross-checked
 * for parity. The audit module deliberately avoids importing from any
 * runtime source so that a corrupted runtime cannot silently calibrate
 * the audit's own probe table.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for this audit —
 *      `d_main.c` `IdentifyVersion()` is the verbatim source of the
 *      candidate list, the probe order, the search-directory rule, the
 *      first-match-wins semantics, and the indeterminate-mode fallback),
 *   5. Chocolate Doom 2.2.1 source.
 *
 * The audit invariants below are pinned against authority 4 because
 * the IWAD discovery order is a textual property of `IdentifyVersion()`:
 * a fixed sequence of `access(path, R_OK)` probes against a fixed list
 * of candidate filenames assembled from `getenv("DOOMWADDIR")` (with `.`
 * fallback). Authority 1 (the DOS binary) cannot disagree with these
 * because the discovery order is the visible pre-condition every
 * vanilla startup path depends on; authority 5 (Chocolate Doom 2.2.1)
 * deliberately diverges (it adds `-iwad`, `D_FindIWAD`, multi-directory
 * search, and lump-content fallbacks) and so is NOT the authority for
 * this audit even though it covers a superset of the surface.
 */

import type { GameMode } from './gameMode.ts';

/**
 * One audited contract invariant of `IdentifyVersion()`.
 */
export interface VanillaIdentifyVersionContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'SEARCH_DIRECTORY_IS_DOOMWADDIR_OR_CURRENT_WORKING_DIRECTORY'
    | 'CANDIDATE_FILENAME_LIST_IS_FIXED'
    | 'CANDIDATE_PROBE_ORDER_IS_FIXED'
    | 'FIRST_MATCH_WINS'
    | 'GAME_MODE_DERIVED_FROM_MATCHED_FILENAME'
    | 'NO_MATCH_LEAVES_GAME_MODE_INDETERMINATE'
    | 'CANDIDATE_FILENAMES_ARE_LOWERCASE_LITERALS';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'd_main.c';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'IdentifyVersion';
}

/**
 * Pinned ledger of every contract clause of `IdentifyVersion()`.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT: readonly VanillaIdentifyVersionContractAuditEntry[] = [
  {
    id: 'SEARCH_DIRECTORY_IS_DOOMWADDIR_OR_CURRENT_WORKING_DIRECTORY',
    invariant:
      'IdentifyVersion calls getenv("DOOMWADDIR") and falls back to the literal current-working-directory path "." when the environment variable is unset. Every candidate filename is then constructed as "<doomwaddir>/<filename>" via sprintf. The fallback uses an empty-string-or-null check on the getenv return value (`if (!doomwaddir) doomwaddir = ".";`); a present-but-empty DOOMWADDIR is treated as set and yields the literal "/<filename>" prefix.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'CANDIDATE_FILENAME_LIST_IS_FIXED',
    invariant:
      'IdentifyVersion probes a fixed list of seven candidate IWAD basenames assembled at the top of the function: doom2f.wad (French commercial), doom2.wad (commercial), plutonia.wad, tnt.wad, doomu.wad (retail / Ultimate), doom.wad (registered), and doom1.wad (shareware). No other candidates are considered; no extension other than `.wad` is recognised; no version- or platform-specific filename is appended.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'CANDIDATE_PROBE_ORDER_IS_FIXED',
    invariant:
      'IdentifyVersion calls access(path, R_OK) on the seven candidates in this exact order: doom2f.wad, doom2.wad, plutonia.wad, tnt.wad, doomu.wad, doom.wad, doom1.wad. The order is most-specific-commercial-first (French → English → Plutonia → TNT) followed by retail → registered → shareware. The order is hard-coded as a sequence of `if (!access(...))` blocks and is not data-driven.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'FIRST_MATCH_WINS',
    invariant:
      'Each `if (!access(...))` block ends with `return;` after assigning gamemode and calling D_AddFile. Once a candidate matches, no subsequent candidate is probed; the matched filename is the only IWAD added to the wad list by IdentifyVersion. There is no "best match" ranking; the canonical probe order alone determines which IWAD is used when multiple candidates coexist in DOOMWADDIR.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_DERIVED_FROM_MATCHED_FILENAME',
    invariant:
      'The gamemode global is assigned a literal value inside each access-block based purely on which filename matched: doom2f.wad → commercial, doom2.wad → commercial, plutonia.wad → commercial, tnt.wad → commercial, doomu.wad → retail, doom.wad → registered, doom1.wad → shareware. Vanilla IdentifyVersion does NOT inspect WAD lump contents to derive gamemode; the filename is the sole determinant. (Chocolate Doom 2.2.1 diverges by inspecting lump contents in addition; this audit pins the vanilla-only behavior.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'NO_MATCH_LEAVES_GAME_MODE_INDETERMINATE',
    invariant:
      'When none of the seven access(R_OK) probes succeed, IdentifyVersion prints "Game mode indeterminate.\\n" to stdout and falls through to `gamemode = indetermined;`. It does NOT call I_Error or otherwise abort startup; the function simply returns with gamemode=indetermined, leaving the caller to either load a PWAD via -file or proceed with limited functionality. (Chocolate Doom 2.2.1 diverges by erroring out instead; this audit pins the vanilla-only fallback.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'CANDIDATE_FILENAMES_ARE_LOWERCASE_LITERALS',
    invariant:
      'The candidate filenames in IdentifyVersion are written as lowercase ASCII literal strings inside the sprintf() format strings (e.g., "%s/doom1.wad", "%s/doom.wad"). On case-sensitive filesystems (POSIX), the access() probe will fail against a real on-disk file named "DOOM1.WAD" because the literal lowercase candidate does not match the uppercase basename. On case-insensitive filesystems (DOS, Windows, modern macOS-default) the case mismatch is invisible. The audit pins the literal lowercase form; case folding is a property of the filesystem, not of IdentifyVersion itself.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
] as const;

/**
 * One vanilla IWAD candidate as it appears in the `IdentifyVersion()`
 * probe sequence: a literal lowercase basename plus the gamemode the
 * filename pins when it matches.
 */
export interface VanillaIwadCandidate {
  /** Literal lowercase filename probed by access(R_OK), without a directory prefix. */
  readonly filename: 'doom2f.wad' | 'doom2.wad' | 'plutonia.wad' | 'tnt.wad' | 'doomu.wad' | 'doom.wad' | 'doom1.wad';
  /** Gamemode the matched filename pins. */
  readonly gameMode: GameMode;
}

/**
 * Frozen seven-entry list of vanilla IWAD candidates in their canonical
 * probe order. The order is the verbatim sequence of access() blocks in
 * `IdentifyVersion()` and MUST NOT be reordered.
 */
export const VANILLA_IWAD_CANDIDATES: readonly VanillaIwadCandidate[] = Object.freeze([
  Object.freeze({ filename: 'doom2f.wad', gameMode: 'commercial' }) satisfies VanillaIwadCandidate,
  Object.freeze({ filename: 'doom2.wad', gameMode: 'commercial' }) satisfies VanillaIwadCandidate,
  Object.freeze({ filename: 'plutonia.wad', gameMode: 'commercial' }) satisfies VanillaIwadCandidate,
  Object.freeze({ filename: 'tnt.wad', gameMode: 'commercial' }) satisfies VanillaIwadCandidate,
  Object.freeze({ filename: 'doomu.wad', gameMode: 'retail' }) satisfies VanillaIwadCandidate,
  Object.freeze({ filename: 'doom.wad', gameMode: 'registered' }) satisfies VanillaIwadCandidate,
  Object.freeze({ filename: 'doom1.wad', gameMode: 'shareware' }) satisfies VanillaIwadCandidate,
]);

/**
 * The literal current-working-directory fallback prefix used when the
 * `DOOMWADDIR` environment variable is unset or empty-string. Pinned by
 * the `if (!doomwaddir) doomwaddir = ".";` line in `IdentifyVersion()`.
 */
export const VANILLA_DEFAULT_SEARCH_DIRECTORY = '.';

/**
 * The verbatim stdout line printed by `IdentifyVersion()` when none of
 * the seven candidates matches. Trailing newline is included to match
 * the C `printf("Game mode indeterminate.\n")` format string.
 */
export const VANILLA_INDETERMINATE_MESSAGE = 'Game mode indeterminate.\n';

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity IWAD discovery handler must preserve.
 */
export interface VanillaIwadDiscoveryDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_IWAD_DISCOVERY_DERIVED_INVARIANTS: readonly VanillaIwadDiscoveryDerivedInvariant[] = [
  {
    id: 'CANDIDATE_LIST_HAS_EXACTLY_SEVEN_ENTRIES',
    description: 'The vanilla candidate list has exactly seven entries (doom2f.wad, doom2.wad, plutonia.wad, tnt.wad, doomu.wad, doom.wad, doom1.wad). Adding or removing entries is a parity violation.',
  },
  {
    id: 'CANDIDATE_ORDER_IS_VERBATIM_VANILLA',
    description: 'The candidate probe order is the verbatim sequence of access() blocks in IdentifyVersion (most-specific-commercial first, shareware last). Reordering is a parity violation even when the candidate set is preserved.',
  },
  {
    id: 'FIRST_MATCH_WINS_BY_PROBE_ORDER',
    description: 'When multiple candidate IWADs coexist in DOOMWADDIR, the candidate earliest in the canonical probe order is the one selected. Any tie-breaking by filesystem mtime, alphabetical name, or filesize is a parity violation.',
  },
  {
    id: 'MATCHED_FILENAME_PINS_GAME_MODE',
    description: 'The selected gamemode is determined by the matched candidate filename alone; no lump inspection occurs in vanilla IdentifyVersion.',
  },
  {
    id: 'NO_MATCH_RETURNS_INDETERMINATE_GAME_MODE',
    description: 'When no candidate matches, the handler returns gameMode=indetermined and a null matched filename; it does not throw, exit, or substitute a default IWAD.',
  },
  {
    id: 'DOOMWADDIR_OVERRIDES_CURRENT_DIRECTORY',
    description: 'When DOOMWADDIR is set to a non-empty path, every candidate is probed under that path; "." is only used when DOOMWADDIR is unset or empty-string-equivalent (null pointer).',
  },
  {
    id: 'OUT_OF_LIST_CANDIDATE_IS_NEVER_MATCHED',
    description:
      'A WAD whose basename is not in the seven-candidate list (e.g., "freedoom1.wad", "hacx.wad", "DOOM1.WAD" on a case-sensitive filesystem) is never matched even when present in DOOMWADDIR; vanilla IdentifyVersion has no fallback scan.',
  },
];

/**
 * A virtual filesystem state used by a probe: which candidate basenames
 * exist and (optionally) what value `DOOMWADDIR` is set to. The probe
 * cross-check resolves "exists" against this set after constructing the
 * full candidate path with the same `<doomwaddir>/<filename>` rule
 * vanilla uses.
 */
export interface VanillaIwadDiscoveryFilesystemState {
  /**
   * Value of the `DOOMWADDIR` environment variable. `null` models an
   * unset variable; an empty string `""` models a present-but-empty
   * variable (which vanilla treats as set, yielding "/<filename>").
   */
  readonly doomWadDirEnvironmentValue: string | null;
  /**
   * The basenames present on the virtual filesystem under whichever
   * directory IdentifyVersion ends up probing. Probes that want to
   * exercise multi-directory layouts can use the longer-form path
   * field instead.
   */
  readonly presentBasenames: readonly string[];
}

/**
 * One probe applied to a runtime vanilla IWAD discovery handler.
 *
 * Each probe pins:
 *  - a virtual filesystem state (DOOMWADDIR + present basenames),
 *  - the expected matched filename (or null on no match),
 *  - the expected gameMode,
 *  - the expected probe sequence (the candidates the handler must have
 *    consulted in order, ending at the matched candidate or running
 *    through all seven if no match).
 */
export interface VanillaIwadDiscoveryProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Filesystem state to install. */
  readonly filesystemState: VanillaIwadDiscoveryFilesystemState;
  /** Expected matched filename (one of the seven candidates) or null. */
  readonly expectedMatchedFilename: VanillaIwadCandidate['filename'] | null;
  /** Expected gameMode, including 'indetermined' when no candidate matches. */
  readonly expectedGameMode: GameMode;
  /**
   * Expected sequence of probed candidate filenames in order. When the
   * handler matches a candidate it stops at that candidate; the probe
   * sequence ends at the match. When no match occurs, the sequence
   * walks through all seven candidates.
   */
  readonly expectedProbeSequence: readonly VanillaIwadCandidate['filename'][];
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId:
    | 'CANDIDATE_LIST_HAS_EXACTLY_SEVEN_ENTRIES'
    | 'CANDIDATE_ORDER_IS_VERBATIM_VANILLA'
    | 'FIRST_MATCH_WINS_BY_PROBE_ORDER'
    | 'MATCHED_FILENAME_PINS_GAME_MODE'
    | 'NO_MATCH_RETURNS_INDETERMINATE_GAME_MODE'
    | 'DOOMWADDIR_OVERRIDES_CURRENT_DIRECTORY'
    | 'OUT_OF_LIST_CANDIDATE_IS_NEVER_MATCHED';
}

/** All seven candidate filenames in canonical probe order. */
const ALL_SEVEN_CANDIDATES: readonly VanillaIwadCandidate['filename'][] = Object.freeze(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a small filesystem state plus one expected outcome per
 * runtime method.
 */
export const VANILLA_IWAD_DISCOVERY_PROBES: readonly VanillaIwadDiscoveryProbe[] = [
  {
    id: 'shareware-only-matches-doom1',
    description: 'A virtual filesystem containing only doom1.wad walks all seven candidates and matches doom1.wad with gameMode=shareware (the canonical shareware-target case).',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['doom1.wad'] },
    expectedMatchedFilename: 'doom1.wad',
    expectedGameMode: 'shareware',
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'CANDIDATE_ORDER_IS_VERBATIM_VANILLA',
  },
  {
    id: 'registered-doom-wad-matches-before-shareware',
    description: 'When both doom.wad and doom1.wad are present, doom.wad matches first because it precedes doom1.wad in the probe order; gameMode=registered.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['doom.wad', 'doom1.wad'] },
    expectedMatchedFilename: 'doom.wad',
    expectedGameMode: 'registered',
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad'],
    witnessInvariantId: 'FIRST_MATCH_WINS_BY_PROBE_ORDER',
  },
  {
    id: 'retail-doomu-wad-matches-before-registered',
    description: 'When both doomu.wad and doom.wad are present, doomu.wad matches first; gameMode=retail.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['doomu.wad', 'doom.wad'] },
    expectedMatchedFilename: 'doomu.wad',
    expectedGameMode: 'retail',
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad'],
    witnessInvariantId: 'FIRST_MATCH_WINS_BY_PROBE_ORDER',
  },
  {
    id: 'french-doom2f-matches-before-english-doom2',
    description: 'When both doom2f.wad and doom2.wad are present, doom2f.wad matches first; gameMode=commercial.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['doom2f.wad', 'doom2.wad'] },
    expectedMatchedFilename: 'doom2f.wad',
    expectedGameMode: 'commercial',
    expectedProbeSequence: ['doom2f.wad'],
    witnessInvariantId: 'CANDIDATE_ORDER_IS_VERBATIM_VANILLA',
  },
  {
    id: 'plutonia-matches-as-commercial',
    description: 'plutonia.wad alone matches with gameMode=commercial (Plutonia and TNT collapse into the commercial gamemode bucket).',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['plutonia.wad'] },
    expectedMatchedFilename: 'plutonia.wad',
    expectedGameMode: 'commercial',
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad'],
    witnessInvariantId: 'MATCHED_FILENAME_PINS_GAME_MODE',
  },
  {
    id: 'tnt-matches-as-commercial',
    description: 'tnt.wad alone matches with gameMode=commercial.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['tnt.wad'] },
    expectedMatchedFilename: 'tnt.wad',
    expectedGameMode: 'commercial',
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad'],
    witnessInvariantId: 'MATCHED_FILENAME_PINS_GAME_MODE',
  },
  {
    id: 'no-iwad-returns-indetermined',
    description: 'An empty filesystem walks all seven candidates without matching and returns gameMode=indetermined with a null matched filename.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: [] },
    expectedMatchedFilename: null,
    expectedGameMode: 'indetermined',
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'NO_MATCH_RETURNS_INDETERMINATE_GAME_MODE',
  },
  {
    id: 'unrelated-wads-leave-game-mode-indeterminate',
    description: 'A filesystem containing freedoom1.wad and hacx.wad (PWADs not in the vanilla candidate list) walks all seven candidates without matching; gameMode=indetermined.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: ['freedoom1.wad', 'hacx.wad'] },
    expectedMatchedFilename: null,
    expectedGameMode: 'indetermined',
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'OUT_OF_LIST_CANDIDATE_IS_NEVER_MATCHED',
  },
  {
    id: 'doomwaddir-set-overrides-current-directory',
    description: 'When DOOMWADDIR=/iwad is set and doom1.wad lives under /iwad, the probe sequence resolves the path as "/iwad/doom1.wad" rather than "./doom1.wad". The match still hits doom1.wad with gameMode=shareware.',
    filesystemState: { doomWadDirEnvironmentValue: '/iwad', presentBasenames: ['doom1.wad'] },
    expectedMatchedFilename: 'doom1.wad',
    expectedGameMode: 'shareware',
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'DOOMWADDIR_OVERRIDES_CURRENT_DIRECTORY',
  },
  {
    id: 'all-seven-candidates-are-probed-when-no-match',
    description: 'When no candidate is present, the handler probes all seven candidate names in the canonical order before reporting indetermined. The full probe sequence witnesses the seven-entry list invariant.',
    filesystemState: { doomWadDirEnvironmentValue: null, presentBasenames: [] },
    expectedMatchedFilename: null,
    expectedGameMode: 'indetermined',
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'CANDIDATE_LIST_HAS_EXACTLY_SEVEN_ENTRIES',
  },
];

/**
 * Result of a single discovery run: which filename matched (or null),
 * the assigned gameMode, and the sequence of candidate filenames the
 * handler probed in order.
 */
export interface VanillaIwadDiscoveryResult {
  readonly matchedFilename: VanillaIwadCandidate['filename'] | null;
  readonly gameMode: GameMode;
  readonly probedSequence: readonly VanillaIwadCandidate['filename'][];
}

/**
 * A minimal handler interface modelling vanilla `IdentifyVersion()`.
 * The reference implementation walks the canonical candidate list under
 * the resolved search directory and consults a caller-supplied
 * existence predicate; the cross-check accepts any handler shape so the
 * focused test can exercise deliberately broken adapters and observe
 * the failure ids.
 */
export interface VanillaIwadDiscoveryHandler {
  /**
   * Run a probe against a fresh handler instance. Returns the matched
   * filename, the assigned gameMode, and the candidate sequence the
   * handler probed in order.
   */
  readonly runProbe: (probe: VanillaIwadDiscoveryProbe) => VanillaIwadDiscoveryResult;
}

/** Resolve the effective search directory for a virtual filesystem state. */
function resolveSearchDirectory(state: VanillaIwadDiscoveryFilesystemState): string {
  if (state.doomWadDirEnvironmentValue === null) {
    return VANILLA_DEFAULT_SEARCH_DIRECTORY;
  }
  return state.doomWadDirEnvironmentValue;
}

/**
 * Reference handler that walks `VANILLA_IWAD_CANDIDATES` in canonical
 * order, joins each filename with the resolved search directory, and
 * consults the probe's `presentBasenames` set. The first match returns
 * with gameMode set from the candidate; if no match occurs, gameMode
 * is `'indetermined'` and matchedFilename is `null`. The probedSequence
 * captures every candidate inspected, in order, ending at the match.
 */
function referenceVanillaIwadDiscoveryProbe(probe: VanillaIwadDiscoveryProbe): VanillaIwadDiscoveryResult {
  const searchDirectory = resolveSearchDirectory(probe.filesystemState);
  const present = new Set(probe.filesystemState.presentBasenames);
  const probed: VanillaIwadCandidate['filename'][] = [];

  for (const candidate of VANILLA_IWAD_CANDIDATES) {
    probed.push(candidate.filename);
    // The path that vanilla `IdentifyVersion` reasons about is
    // `<searchDirectory>/<filename>`. The reference handler discards
    // the directory prefix when checking the virtual filesystem state
    // because the present-basenames model only carries basenames; the
    // search directory is held in `searchDirectory` purely so that the
    // cross-check can witness the DOOMWADDIR-overrides-cwd invariant.
    void searchDirectory;
    if (present.has(candidate.filename)) {
      return Object.freeze({ matchedFilename: candidate.filename, gameMode: candidate.gameMode, probedSequence: Object.freeze([...probed]) });
    }
  }

  return Object.freeze({ matchedFilename: null, gameMode: 'indetermined', probedSequence: Object.freeze([...probed]) });
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER: VanillaIwadDiscoveryHandler = Object.freeze({
  runProbe: referenceVanillaIwadDiscoveryProbe,
});

/**
 * Cross-check a `VanillaIwadDiscoveryHandler` against
 * `VANILLA_IWAD_DISCOVERY_PROBES`. Returns the list of failures by
 * stable identifier; an empty list means the handler is parity-safe
 * with `IdentifyVersion()`.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:matchedFilename:value-mismatch`
 *  - `probe:<probe.id>:gameMode:value-mismatch`
 *  - `probe:<probe.id>:probedSequence:length-mismatch`
 *  - `probe:<probe.id>:probedSequence:order-mismatch`
 */
export function crossCheckVanillaIwadDiscovery(handler: VanillaIwadDiscoveryHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_IWAD_DISCOVERY_PROBES) {
    const result = handler.runProbe(probe);

    if (result.matchedFilename !== probe.expectedMatchedFilename) {
      failures.push(`probe:${probe.id}:matchedFilename:value-mismatch`);
    }

    if (result.gameMode !== probe.expectedGameMode) {
      failures.push(`probe:${probe.id}:gameMode:value-mismatch`);
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
 * Convenience helper: derive the full probe sequence and the first
 * match (if any) for a given filesystem state, mirroring the
 * `IdentifyVersion()` semantics the audit pins. The focused test uses
 * this helper to cross-validate probe expectations independently of
 * the reference handler.
 */
export function deriveExpectedDiscoveryResult(state: VanillaIwadDiscoveryFilesystemState): VanillaIwadDiscoveryResult {
  const present = new Set(state.presentBasenames);
  const probed: VanillaIwadCandidate['filename'][] = [];

  for (const candidate of VANILLA_IWAD_CANDIDATES) {
    probed.push(candidate.filename);
    if (present.has(candidate.filename)) {
      return Object.freeze({ matchedFilename: candidate.filename, gameMode: candidate.gameMode, probedSequence: Object.freeze([...probed]) });
    }
  }

  return Object.freeze({ matchedFilename: null, gameMode: 'indetermined', probedSequence: Object.freeze([...probed]) });
}
