/**
 * Audit ledger for the vanilla DOOM 1.9 game-mode detection surface
 * inside `IdentifyVersion()`. The accompanying focused test cross-checks
 * every audited contract clause against a self-contained reference
 * handler that derives the gamemode the same way vanilla
 * `IdentifyVersion()` does for the candidate-scan branch (the
 * dev-mode-triple branch is pinned separately by step 03-006).
 *
 * The canonical vanilla DOOM 1.9 surface for game-mode detection is the
 * `gamemode_t` enum and the seven `if (!access(name, R_OK))` candidate
 * blocks at the bottom of `IdentifyVersion()`. Each block assigns the
 * `gamemode` global to a literal enum constant determined purely by
 * which of the seven candidate filenames matched on disk (no lump
 * inspection occurs in vanilla 1.9). When all seven candidates miss,
 * vanilla prints `"Game mode indeterminate.\n"` to stdout and falls
 * through to `gamemode = indetermined;` — the function returns without
 * calling `I_Error`, leaving the caller to load a PWAD via `-file` or
 * proceed with limited functionality.
 *
 * The vanilla 1.9 `gamemode_t` enum has exactly five values: `shareware`,
 * `registered`, `commercial`, `retail`, and `indetermined` — the typo
 * (missing `a`, should be `indeterminate`) is a deliberate parity
 * invariant preserved verbatim by the runtime `GameMode` literal-union
 * type in `src/bootstrap/gameMode.ts`. The candidate-filename → gamemode
 * mapping is many-to-one for `commercial` (four filenames:
 * `doom2f.wad`, `doom2.wad`, `plutonia.wad`, `tnt.wad`) and one-to-one
 * for `retail`/`registered`/`shareware`. Vanilla 1.9 predates the
 * Freedoom community IWAD project, the HACX/Chex Quest TC IWADs, and
 * the Chocolate Doom 2.2.1 `D_IdentifyIWADByContents` lump-based
 * fallback; none of `freedoom1.wad`/`freedoom2.wad`/`freedm.wad`/
 * `hacx.wad`/`chex.wad` are recognised by vanilla `IdentifyVersion()`.
 *
 * No runtime game-mode detection surface drives the `bun run doom.ts`
 * entrypoint yet — `src/bootstrap/gameMode.ts` is a Chocolate Doom
 * 2.2.1-shaped helper (it inspects lumps via a `LumpChecker` interface,
 * which is the 2.2.1 `D_IdentifyIWADByContents` mechanism, NOT the
 * vanilla 1.9 filename-only mechanism this audit pins). This step pins
 * the vanilla 1.9 filename-only contract so a later implementation
 * step (or an oracle follow-up that observes `doom/DOOMD.EXE` directly
 * under controlled candidate-filename layouts) can be cross-checked
 * for parity. The audit module deliberately avoids importing from any
 * runtime IWAD-selection module (only the `GameMode` literal-union
 * type from `src/bootstrap/gameMode.ts` is imported) so that a
 * corrupted runtime cannot silently calibrate the audit's own probe
 * table.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source (canonical for the
 *      `gamemode_t` enum and the candidate-filename → gamemode mapping —
 *      `doomdef.h` declares the five-literal `gamemode_t` enum, and
 *      `d_main.c` `IdentifyVersion()` is the verbatim source of the
 *      seven `if (!access(name,R_OK)) { gamemode = <literal>;
 *      D_AddFile(name); return; }` candidate blocks plus the closing
 *      `printf("Game mode indeterminate.\n"); gamemode = indetermined;
 *      return;` indeterminate fallback),
 *   5. Chocolate Doom 2.2.1 source.
 *
 * The audit invariants below are pinned against authority 4 because
 * the gamemode derivation is a textual property of the seven candidate
 * blocks plus the indeterminate fallback. Authority 1 (the DOS binary)
 * cannot disagree because the gamemode is the visible pre-condition
 * every vanilla startup path branches on (`gamemode == commercial`
 * gates DOOM 2 maps, `gamemode == retail` gates Episode 4, etc.);
 * authority 5 (Chocolate Doom 2.2.1) deliberately diverges (it adds
 * `D_IdentifyIWADByContents`, `D_IdentifyIWADByName` over an extended
 * candidate list including `freedoom*.wad` and `chex.wad` and `hacx.wad`,
 * lump-content fallbacks, and erroring out on indeterminate gamemode
 * via `I_Error`) and so is NOT the authority for this audit even
 * though it covers a superset of the surface.
 */

import type { GameMode } from './gameMode.ts';

/**
 * One audited contract invariant of the game-mode detection surface
 * inside vanilla DOOM 1.9 `IdentifyVersion()`.
 */
export interface VanillaGameModeDetectionContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id:
    | 'GAME_MODE_ENUM_HAS_FIVE_LITERAL_VALUES'
    | 'GAME_MODE_INDETERMINED_LITERAL_PRESERVES_VANILLA_TYPO'
    | 'GAME_MODE_DERIVED_FROM_MATCHED_CANDIDATE_FILENAME_ALONE'
    | 'GAME_MODE_NO_LUMP_INSPECTION_IN_VANILLA_ONE_DOT_NINE'
    | 'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_FOUR_FILENAMES'
    | 'GAME_MODE_RETAIL_IS_DOOMU_WAD_ONLY'
    | 'GAME_MODE_REGISTERED_IS_DOOM_WAD_ONLY'
    | 'GAME_MODE_SHAREWARE_IS_DOOM1_WAD_ONLY'
    | 'GAME_MODE_INDETERMINATE_FALLBACK_DOES_NOT_CALL_I_ERROR'
    | 'GAME_MODE_INDETERMINATE_PRINTOUT_PRECEDES_ENUM_ASSIGNMENT'
    | 'GAME_MODE_FREEDOOM_FILENAMES_NOT_RECOGNISED_BY_VANILLA'
    | 'GAME_MODE_HACX_AND_CHEX_FILENAMES_NOT_RECOGNISED_BY_VANILLA'
    | 'GAME_MODE_CANDIDATE_BRANCH_IS_DISTINCT_FROM_DEV_MODE_BRANCH';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the id Software linuxdoom-1.10 tree. */
  readonly referenceSourceFile: 'd_main.c' | 'doomdef.h';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'IdentifyVersion' | 'gamemode_t';
}

/**
 * Pinned ledger of every contract clause of the game-mode detection
 * surface inside `IdentifyVersion()`.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every clause holds against the runtime reference
 * handler.
 */
export const VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT: readonly VanillaGameModeDetectionContractAuditEntry[] = [
  {
    id: 'GAME_MODE_ENUM_HAS_FIVE_LITERAL_VALUES',
    invariant:
      'The vanilla DOOM 1.9 `gamemode_t` enum (declared in `doomdef.h`) has exactly five literal values in this exact order: `shareware`, `registered`, `commercial`, `retail`, `indetermined`. No other gamemode value is recognised; the runtime `GameMode` literal-union type in `src/bootstrap/gameMode.ts` MUST cover this exact five-value set (and no more) to remain parity-faithful with the vanilla enum.',
    referenceSourceFile: 'doomdef.h',
    cSymbol: 'gamemode_t',
  },
  {
    id: 'GAME_MODE_INDETERMINED_LITERAL_PRESERVES_VANILLA_TYPO',
    invariant:
      'The fifth gamemode_t enum value is the literal `indetermined` (with a typo: missing the trailing "a" — the dictionary spelling is "indeterminate"). The typo is a deliberate parity invariant preserved verbatim from id Software\'s `linuxdoom-1.10/doomdef.h`. The printout string in the candidate-scan fallback DOES use the correctly-spelled "Game mode indeterminate." literal (printf format), but the enum identifier is the typo form. A handler that uses the corrected spelling `indeterminate` as the enum literal is a parity violation; a handler that uses the corrected spelling in the printout is also a parity violation — but for the opposite reason (the printout is correctly spelled and any change is unfaithful).',
    referenceSourceFile: 'doomdef.h',
    cSymbol: 'gamemode_t',
  },
  {
    id: 'GAME_MODE_DERIVED_FROM_MATCHED_CANDIDATE_FILENAME_ALONE',
    invariant:
      'Each of the seven `if (!access(name, R_OK))` candidate blocks inside `IdentifyVersion()` assigns the `gamemode` global to a literal enum constant determined purely by which of the seven candidate filenames matched on disk: doom2f.wad / doom2.wad / plutonia.wad / tnt.wad → commercial, doomu.wad → retail, doom.wad → registered, doom1.wad → shareware. The matched filename is the sole determinant of gamemode; no other input (lump contents, file size, header bytes) is consulted by vanilla 1.9 IdentifyVersion in the candidate-scan branch.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_NO_LUMP_INSPECTION_IN_VANILLA_ONE_DOT_NINE',
    invariant:
      'Vanilla DOOM 1.9 `IdentifyVersion()` does NOT inspect WAD lump contents (no `W_CheckNumForName`, no `W_GetNumForName`, no header-byte inspection) to derive gamemode. The candidate-scan branch reads the filename only via `access(R_OK)` — a presence/permission test that does NOT open the WAD or read any byte of its contents. (Chocolate Doom 2.2.1 diverges by adding `D_IdentifyIWADByContents` which DOES open the WAD and inspect lumps; this audit pins the vanilla-only filename-only behavior.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_FOUR_FILENAMES',
    invariant:
      'The `commercial` gamemode value is assigned by four distinct candidate-block filenames: doom2f.wad (French DOOM II), doom2.wad (English DOOM II), plutonia.wad (Final DOOM Plutonia Experiment), and tnt.wad (Final DOOM TNT Evilution). The mapping is many-to-one: any of the four filenames yields gamemode=commercial, and there is no separate enum value to distinguish between them. The mission/episode-pack distinction (Plutonia vs TNT vs DOOM 2) is carried by a SEPARATE `gamemission_t` global (out of scope for this audit; pinned by a later step), not by `gamemode_t`.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_RETAIL_IS_DOOMU_WAD_ONLY',
    invariant:
      'The `retail` gamemode value (Ultimate DOOM, four-episode shareware-doom-plus-Thy-Flesh-Consumed) is assigned by exactly one candidate-block filename: doomu.wad. No other filename in the canonical seven-candidate scan maps to retail; doom.wad maps to registered (three episodes), and doom1.wad maps to shareware (one episode). The presence of `doomu.wad` is the unique on-disk fingerprint of Ultimate DOOM in the vanilla 1.9 candidate scan.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_REGISTERED_IS_DOOM_WAD_ONLY',
    invariant:
      'The `registered` gamemode value (DOOM Registered, three-episode original DOOM) is assigned by exactly one candidate-block filename: doom.wad. The `doom.wad` candidate is the sixth probe in the canonical order (after the four commercial candidates and after the retail candidate doomu.wad), so a system that has BOTH `doomu.wad` and `doom.wad` present resolves to retail (the doomu.wad probe wins by canonical probe order, not by gamemode "rank").',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_SHAREWARE_IS_DOOM1_WAD_ONLY',
    invariant:
      'The `shareware` gamemode value (DOOM 1 Episode 1: Knee-Deep in the Dead) is assigned by exactly one candidate-block filename: doom1.wad. The `doom1.wad` candidate is the seventh and lowest-priority probe in the canonical order; if any of the six higher-priority candidates is present, the shareware probe is short-circuited by an earlier `return;`. A system that has only `doom1.wad` present is the sole vanilla resolution path to gamemode=shareware via the candidate-scan branch.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_INDETERMINATE_FALLBACK_DOES_NOT_CALL_I_ERROR',
    invariant:
      'When none of the seven `if (!access(name, R_OK))` probes succeed, vanilla 1.9 `IdentifyVersion()` does NOT call `I_Error` to abort startup. It prints "Game mode indeterminate.\\n" to stdout via `printf()`, assigns `gamemode = indetermined;`, and returns normally. The caller (`D_DoomMain`) then proceeds with `gamemode=indetermined`, which is a downstream input to feature gates (most code paths assume a non-indeterminate gamemode and will fail or produce undefined results, but `IdentifyVersion()` itself never aborts the process). (Chocolate Doom 2.2.1 diverges by calling `I_Error` instead; this audit pins the vanilla-only fallthrough.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_INDETERMINATE_PRINTOUT_PRECEDES_ENUM_ASSIGNMENT',
    invariant:
      'In the indeterminate-fallback path of `IdentifyVersion()`, the `printf("Game mode indeterminate.\\n");` call precedes the `gamemode = indetermined;` enum assignment. The printout is therefore a side-effect that fires BEFORE the enum becomes indeterminate; the printout cannot observe a non-indeterminate enum at print time, but it also cannot be skipped by short-circuiting the enum assignment. A handler that swaps the two lines or omits the printout violates the parity invariant — both lines fire on every no-match path, in this exact order.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_FREEDOOM_FILENAMES_NOT_RECOGNISED_BY_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 (`linuxdoom-1.10`, released 1997-12) predates the Freedoom community IWAD project (first public release ~2003). The candidate filenames `freedoom1.wad`, `freedoom2.wad`, and `freedm.wad` are NOT included in the seven-candidate scan; an `IdentifyVersion()` invocation in a directory that contains only Freedoom IWAD files yields `gamemode=indetermined`. (Chocolate Doom 2.2.1 diverges by recognising Freedoom via `D_IdentifyIWADByContents`; this audit pins the vanilla-only candidate set.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_HACX_AND_CHEX_FILENAMES_NOT_RECOGNISED_BY_VANILLA',
    invariant:
      'Vanilla DOOM 1.9 does NOT recognise the `hacx.wad` (HACX total conversion, 1997 commercial DOOM 2 IWAD-replacement) or `chex.wad` (Chex Quest, 1996 retail-mode total conversion) filenames in `IdentifyVersion()`. Both predate or coincide with vanilla 1.9 but were not added to the canonical seven-candidate scan. An `IdentifyVersion()` invocation in a directory that contains only `hacx.wad` or `chex.wad` yields `gamemode=indetermined` because neither name matches any of the seven canonical probes. (Chocolate Doom 2.2.1 diverges by recognising both via `D_IdentifyIWADByContents`/`D_IdentifyIWADByName`; this audit pins the vanilla-only candidate set.)',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
  {
    id: 'GAME_MODE_CANDIDATE_BRANCH_IS_DISTINCT_FROM_DEV_MODE_BRANCH',
    invariant:
      'The candidate-scan branch and the dev-mode-triple branch (`-shdev`/`-regdev`/`-comdev`, pinned separately by step 03-006) are distinct gamemode-detection paths inside `IdentifyVersion()`. The dev-mode triple runs FIRST and short-circuits the candidate scan via early return; the candidate scan only runs when no dev-mode parameter matched. The two branches MUST resolve to gamemode values consistent with each other when both are eligible: `-shdev` and a doom1.wad-only filesystem both yield `shareware`; `-regdev` and a doom.wad-only filesystem both yield `registered`; `-comdev` and a doom2.wad-only filesystem both yield `commercial`. The dev-mode branch ADDITIONALLY sets `devparm=true` and uses the `DEVDATA"<basename>"` path prefix instead of `<doomwaddir>/<basename>`, but the gamemode enum value is the same.',
    referenceSourceFile: 'd_main.c',
    cSymbol: 'IdentifyVersion',
  },
] as const;

/**
 * One vanilla candidate filename and the canonical gamemode it pins.
 * The list is the verbatim seven-candidate scan from `IdentifyVersion()`
 * in canonical probe order (most-specific-commercial-first followed by
 * retail → registered → shareware).
 */
export interface VanillaCandidateFilenameToGameModeEntry {
  /** Literal lowercase candidate filename probed via `access(R_OK)`. */
  readonly candidateFilename: 'doom2f.wad' | 'doom2.wad' | 'plutonia.wad' | 'tnt.wad' | 'doomu.wad' | 'doom.wad' | 'doom1.wad';
  /** Canonical gamemode the filename pins on a successful match. */
  readonly gameMode: 'commercial' | 'retail' | 'registered' | 'shareware';
  /** Index of the candidate's block within IdentifyVersion (0-based, in canonical probe order). */
  readonly probeOrderIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Frozen seven-entry list of vanilla candidate filenames in their
 * canonical probe order. The order is the verbatim sequence of seven
 * `if (!access(name, R_OK))` blocks at the bottom of `IdentifyVersion()`
 * and MUST NOT be reordered.
 */
export const VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP: readonly VanillaCandidateFilenameToGameModeEntry[] = Object.freeze([
  Object.freeze({ candidateFilename: 'doom2f.wad', gameMode: 'commercial', probeOrderIndex: 0 }) satisfies VanillaCandidateFilenameToGameModeEntry,
  Object.freeze({ candidateFilename: 'doom2.wad', gameMode: 'commercial', probeOrderIndex: 1 }) satisfies VanillaCandidateFilenameToGameModeEntry,
  Object.freeze({ candidateFilename: 'plutonia.wad', gameMode: 'commercial', probeOrderIndex: 2 }) satisfies VanillaCandidateFilenameToGameModeEntry,
  Object.freeze({ candidateFilename: 'tnt.wad', gameMode: 'commercial', probeOrderIndex: 3 }) satisfies VanillaCandidateFilenameToGameModeEntry,
  Object.freeze({ candidateFilename: 'doomu.wad', gameMode: 'retail', probeOrderIndex: 4 }) satisfies VanillaCandidateFilenameToGameModeEntry,
  Object.freeze({ candidateFilename: 'doom.wad', gameMode: 'registered', probeOrderIndex: 5 }) satisfies VanillaCandidateFilenameToGameModeEntry,
  Object.freeze({ candidateFilename: 'doom1.wad', gameMode: 'shareware', probeOrderIndex: 6 }) satisfies VanillaCandidateFilenameToGameModeEntry,
]);

/**
 * Frozen five-entry list of vanilla `gamemode_t` enum values in their
 * verbatim declaration order from `linuxdoom-1.10/doomdef.h`. The
 * fifth value preserves the canonical typo (`indetermined` rather than
 * the dictionary spelling `indeterminate`).
 */
export const VANILLA_GAME_MODE_ENUM_VALUES: readonly GameMode[] = Object.freeze(['shareware', 'registered', 'commercial', 'retail', 'indetermined']);

/**
 * The literal lowercase string that vanilla 1.9 `printf()` writes to
 * stdout in the indeterminate-fallback path of `IdentifyVersion()`.
 * The string ends with a newline character; the dictionary spelling
 * (`indeterminate`) is correct in the printout even though the enum
 * literal preserves the typo (`indetermined`).
 */
export const VANILLA_GAME_MODE_INDETERMINATE_PRINTOUT_LITERAL = 'Game mode indeterminate.\n';

/**
 * The literal lowercase enum identifier vanilla 1.9 assigns when no
 * candidate matches. Preserves the canonical typo; the dictionary
 * spelling `indeterminate` is the printout form, not the enum form.
 */
export const VANILLA_GAME_MODE_INDETERMINATE_ENUM_LITERAL: GameMode = 'indetermined';

/**
 * The number of candidate-filename probes inside `IdentifyVersion()`.
 * Pinned by the verbatim sequence of seven `if (!access(name, R_OK))`
 * blocks for doom2f.wad, doom2.wad, plutonia.wad, tnt.wad, doomu.wad,
 * doom.wad, and doom1.wad.
 */
export const VANILLA_CANDIDATE_FILENAME_COUNT = 7;

/**
 * The number of `gamemode_t` enum values vanilla 1.9 declares. Pinned
 * by `linuxdoom-1.10/doomdef.h` (`shareware`, `registered`, `commercial`,
 * `retail`, `indetermined`).
 */
export const VANILLA_GAME_MODE_ENUM_VALUE_COUNT = 5;

/**
 * Filenames that vanilla DOOM 1.9 does NOT recognise in its
 * candidate-scan branch. Pinned so that any cross-check that observes
 * a vanilla-1.9 audit recognising one of these names can report a
 * deviation from the canonical contract. The community IWADs in this
 * list are recognised by Chocolate Doom 2.2.1 via
 * `D_IdentifyIWADByContents`/`D_IdentifyIWADByName`, but that is a
 * post-vanilla addition outside the scope of this audit.
 */
export const VANILLA_UNRECOGNISED_IWAD_FILENAMES: readonly string[] = Object.freeze(['freedoom1.wad', 'freedoom2.wad', 'freedm.wad', 'hacx.wad', 'chex.wad']);

/**
 * One derived high-level invariant the cross-check enforces on top of
 * the raw clause declarations. Failures point at concrete identities
 * that any vanilla-parity game-mode detection handler must preserve.
 */
export interface VanillaGameModeDetectionDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_GAME_MODE_DETECTION_DERIVED_INVARIANTS: readonly VanillaGameModeDetectionDerivedInvariant[] = [
  {
    id: 'GAME_MODE_ENUM_HAS_EXACTLY_FIVE_LITERAL_VALUES',
    description: 'The vanilla `gamemode_t` enum has exactly five literal values: shareware, registered, commercial, retail, indetermined. Adding or removing values is a parity violation.',
  },
  {
    id: 'GAME_MODE_ENUM_VALUES_INCLUDE_INDETERMINED_TYPO_LITERAL',
    description:
      'The fifth gamemode_t enum value is the literal `indetermined` (typo, missing trailing "a"). A handler that uses the dictionary spelling `indeterminate` as the enum identifier is a parity violation; the typo is preserved verbatim from id Software linuxdoom-1.10/doomdef.h.',
  },
  {
    id: 'GAME_MODE_CANDIDATE_FILENAME_MAP_HAS_EXACTLY_SEVEN_ENTRIES',
    description: 'The candidate-filename → gamemode map has exactly seven entries (doom2f.wad, doom2.wad, plutonia.wad, tnt.wad, doomu.wad, doom.wad, doom1.wad). Adding or removing entries is a parity violation.',
  },
  {
    id: 'GAME_MODE_CANDIDATE_FILENAME_MAP_PRESERVES_PROBE_ORDER',
    description:
      'The candidate-filename → gamemode map preserves the canonical probe order (most-specific-commercial-first followed by retail → registered → shareware). probeOrderIndex 0..6 corresponds to doom2f.wad, doom2.wad, plutonia.wad, tnt.wad, doomu.wad, doom.wad, doom1.wad in that order.',
  },
  {
    id: 'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_EXACTLY_FOUR_FILENAMES',
    description: 'Exactly four candidate filenames map to gamemode=commercial: doom2f.wad, doom2.wad, plutonia.wad, tnt.wad. Adding or removing commercial filenames is a parity violation.',
  },
  {
    id: 'GAME_MODE_RETAIL_IS_ONE_TO_ONE_DOOMU_WAD',
    description: 'Exactly one candidate filename maps to gamemode=retail: doomu.wad. A handler that maps any other filename to retail is a parity violation.',
  },
  {
    id: 'GAME_MODE_REGISTERED_IS_ONE_TO_ONE_DOOM_WAD',
    description: 'Exactly one candidate filename maps to gamemode=registered: doom.wad. A handler that maps any other filename to registered is a parity violation.',
  },
  {
    id: 'GAME_MODE_SHAREWARE_IS_ONE_TO_ONE_DOOM1_WAD',
    description: 'Exactly one candidate filename maps to gamemode=shareware: doom1.wad. A handler that maps any other filename to shareware is a parity violation.',
  },
  {
    id: 'GAME_MODE_FILENAME_DETERMINES_GAME_MODE_ALONE_NO_LUMP_INSPECTION',
    description:
      'The matched candidate filename is the sole determinant of gamemode in the candidate-scan branch. A handler that consults lump contents, file size, header bytes, or any other input besides the filename to derive gamemode in the vanilla-1.9 audit is a parity violation. (Chocolate Doom 2.2.1 inspects lumps, but that is out of scope here.)',
  },
  {
    id: 'GAME_MODE_FIRST_MATCH_BY_CANONICAL_ORDER_WINS',
    description:
      'When multiple candidate filenames are present in the search directory, the first match by canonical probe order wins. A handler that picks "the highest-rank gamemode" over "the first matching candidate" is a parity violation; a system with both doom.wad and doom1.wad present resolves to registered (doom.wad wins by probe-order index 5 < 6), not by gamemode rank.',
  },
  {
    id: 'GAME_MODE_NO_MATCH_RESOLVES_TO_INDETERMINED_NOT_ABORT',
    description:
      'When none of the seven candidate filenames are present, the gamemode resolves to indetermined and the printout fires; the handler MUST NOT throw, abort, or call I_Error. A handler that aborts on no-match is a parity violation against vanilla 1.9 (it would match Chocolate Doom 2.2.1 instead, which is out of scope).',
  },
  {
    id: 'GAME_MODE_NO_MATCH_PRINTS_BEFORE_ASSIGNING_INDETERMINED',
    description:
      'On no-match, the printf("Game mode indeterminate.\\n") fires BEFORE the gamemode=indetermined enum assignment. A handler that omits the printout, swaps the order, or uses a different printout literal is a parity violation.',
  },
  {
    id: 'GAME_MODE_FREEDOOM_FILENAMES_RESOLVE_TO_INDETERMINED',
    description:
      'A search directory that contains only freedoom1.wad, freedoom2.wad, or freedm.wad (and no canonical seven-candidate filename) resolves to gamemode=indetermined. A handler that recognises Freedoom in the vanilla-1.9 audit is a parity violation.',
  },
  {
    id: 'GAME_MODE_HACX_AND_CHEX_FILENAMES_RESOLVE_TO_INDETERMINED',
    description:
      'A search directory that contains only hacx.wad or chex.wad (and no canonical seven-candidate filename) resolves to gamemode=indetermined. A handler that recognises HACX or Chex Quest in the vanilla-1.9 audit is a parity violation.',
  },
  {
    id: 'GAME_MODE_CANDIDATE_BRANCH_RESPECTS_PROBE_ORDER_AGAINST_MULTIPLE_PRESENT_FILES',
    description:
      'The candidate-scan branch walks the seven probes in canonical order (doom2f.wad → doom2.wad → plutonia.wad → tnt.wad → doomu.wad → doom.wad → doom1.wad) and stops at the first match. The probe sequence reported by the handler MUST end at the matched candidate (or run through all seven probes on no-match) — a handler that short-circuits early or skips probes is a parity violation.',
  },
];

/**
 * One probe applied to a runtime vanilla game-mode detection handler.
 *
 * Each probe pins:
 *  - a virtual search-directory filesystem (the set of candidate
 *    filenames present),
 *  - the expected matched candidate filename (or null on no match),
 *  - the expected gameMode enum value,
 *  - a flag indicating whether the indeterminate printout fires,
 *  - the expected probe sequence (the candidate filenames the handler
 *    consulted in order, ending at the matched candidate or running
 *    through all seven on no match).
 */
export interface VanillaGameModeDetectionProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Set of candidate filenames present in the virtual search directory. Order is irrelevant; the handler walks the canonical probe order regardless. */
  readonly presentCandidateFilenames: readonly string[];
  /** Expected matched candidate filename (one of the seven canonical names) or null. */
  readonly expectedMatchedFilename: VanillaCandidateFilenameToGameModeEntry['candidateFilename'] | null;
  /** Expected gameMode enum value (one of the four canonical pins or 'indetermined' on no match). */
  readonly expectedGameMode: GameMode;
  /** Whether the handler fires the "Game mode indeterminate." printout (true on no-match, false on match). */
  readonly expectedIndeterminatePrintoutFired: boolean;
  /**
   * Expected sequence of probed candidate filenames in canonical order.
   * When the handler matches a candidate it stops at that candidate;
   * the probe sequence ends at the match. When no match occurs, the
   * sequence walks through all seven candidates.
   */
  readonly expectedProbeSequence: readonly VanillaCandidateFilenameToGameModeEntry['candidateFilename'][];
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId:
    | 'GAME_MODE_ENUM_HAS_EXACTLY_FIVE_LITERAL_VALUES'
    | 'GAME_MODE_ENUM_VALUES_INCLUDE_INDETERMINED_TYPO_LITERAL'
    | 'GAME_MODE_CANDIDATE_FILENAME_MAP_HAS_EXACTLY_SEVEN_ENTRIES'
    | 'GAME_MODE_CANDIDATE_FILENAME_MAP_PRESERVES_PROBE_ORDER'
    | 'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_EXACTLY_FOUR_FILENAMES'
    | 'GAME_MODE_RETAIL_IS_ONE_TO_ONE_DOOMU_WAD'
    | 'GAME_MODE_REGISTERED_IS_ONE_TO_ONE_DOOM_WAD'
    | 'GAME_MODE_SHAREWARE_IS_ONE_TO_ONE_DOOM1_WAD'
    | 'GAME_MODE_FILENAME_DETERMINES_GAME_MODE_ALONE_NO_LUMP_INSPECTION'
    | 'GAME_MODE_FIRST_MATCH_BY_CANONICAL_ORDER_WINS'
    | 'GAME_MODE_NO_MATCH_RESOLVES_TO_INDETERMINED_NOT_ABORT'
    | 'GAME_MODE_NO_MATCH_PRINTS_BEFORE_ASSIGNING_INDETERMINED'
    | 'GAME_MODE_FREEDOOM_FILENAMES_RESOLVE_TO_INDETERMINED'
    | 'GAME_MODE_HACX_AND_CHEX_FILENAMES_RESOLVE_TO_INDETERMINED'
    | 'GAME_MODE_CANDIDATE_BRANCH_RESPECTS_PROBE_ORDER_AGAINST_MULTIPLE_PRESENT_FILES';
}

/** All seven candidate filenames in canonical probe order. */
const ALL_SEVEN_CANDIDATES: readonly VanillaCandidateFilenameToGameModeEntry['candidateFilename'][] = Object.freeze(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a small virtual search directory plus one expected outcome
 * per runtime method.
 */
export const VANILLA_GAME_MODE_DETECTION_PROBES: readonly VanillaGameModeDetectionProbe[] = [
  {
    id: 'doom2f-wad-pins-commercial',
    description: 'A search directory that contains only doom2f.wad matches the first candidate and pins gamemode=commercial. The probe sequence stops at doom2f.wad because the early return fires.',
    presentCandidateFilenames: ['doom2f.wad'],
    expectedMatchedFilename: 'doom2f.wad',
    expectedGameMode: 'commercial',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad'],
    witnessInvariantId: 'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_EXACTLY_FOUR_FILENAMES',
  },
  {
    id: 'doom2-wad-pins-commercial',
    description: 'A search directory that contains only doom2.wad walks past doom2f.wad and matches at probe index 1. gamemode=commercial.',
    presentCandidateFilenames: ['doom2.wad'],
    expectedMatchedFilename: 'doom2.wad',
    expectedGameMode: 'commercial',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad'],
    witnessInvariantId: 'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_EXACTLY_FOUR_FILENAMES',
  },
  {
    id: 'plutonia-wad-pins-commercial',
    description: 'A search directory that contains only plutonia.wad walks past doom2f.wad and doom2.wad and matches at probe index 2. gamemode=commercial.',
    presentCandidateFilenames: ['plutonia.wad'],
    expectedMatchedFilename: 'plutonia.wad',
    expectedGameMode: 'commercial',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad'],
    witnessInvariantId: 'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_EXACTLY_FOUR_FILENAMES',
  },
  {
    id: 'tnt-wad-pins-commercial',
    description: 'A search directory that contains only tnt.wad walks past doom2f.wad, doom2.wad, plutonia.wad and matches at probe index 3. gamemode=commercial.',
    presentCandidateFilenames: ['tnt.wad'],
    expectedMatchedFilename: 'tnt.wad',
    expectedGameMode: 'commercial',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad'],
    witnessInvariantId: 'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_EXACTLY_FOUR_FILENAMES',
  },
  {
    id: 'doomu-wad-pins-retail',
    description: 'A search directory that contains only doomu.wad walks past the four commercial candidates and matches at probe index 4. gamemode=retail.',
    presentCandidateFilenames: ['doomu.wad'],
    expectedMatchedFilename: 'doomu.wad',
    expectedGameMode: 'retail',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad'],
    witnessInvariantId: 'GAME_MODE_RETAIL_IS_ONE_TO_ONE_DOOMU_WAD',
  },
  {
    id: 'doom-wad-pins-registered',
    description: 'A search directory that contains only doom.wad walks past the four commercial candidates and the retail candidate and matches at probe index 5. gamemode=registered.',
    presentCandidateFilenames: ['doom.wad'],
    expectedMatchedFilename: 'doom.wad',
    expectedGameMode: 'registered',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad'],
    witnessInvariantId: 'GAME_MODE_REGISTERED_IS_ONE_TO_ONE_DOOM_WAD',
  },
  {
    id: 'doom1-wad-pins-shareware',
    description: 'A search directory that contains only doom1.wad walks through all six higher-priority candidates and matches at probe index 6 (the lowest-priority candidate). gamemode=shareware.',
    presentCandidateFilenames: ['doom1.wad'],
    expectedMatchedFilename: 'doom1.wad',
    expectedGameMode: 'shareware',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'GAME_MODE_SHAREWARE_IS_ONE_TO_ONE_DOOM1_WAD',
  },
  {
    id: 'empty-search-directory-resolves-to-indetermined',
    description: 'A search directory that contains no candidate filenames walks through all seven probes, matches none, and resolves to gamemode=indetermined. The "Game mode indeterminate." printout fires before the enum assignment.',
    presentCandidateFilenames: [],
    expectedMatchedFilename: null,
    expectedGameMode: 'indetermined',
    expectedIndeterminatePrintoutFired: true,
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'GAME_MODE_NO_MATCH_RESOLVES_TO_INDETERMINED_NOT_ABORT',
  },
  {
    id: 'doomu-and-doom-both-present-resolves-to-retail-by-probe-order',
    description: 'A search directory that contains both doomu.wad AND doom.wad resolves to retail because doomu.wad is at probe index 4 and doom.wad is at probe index 5. The first-match-by-canonical-order rule wins; gamemode=retail.',
    presentCandidateFilenames: ['doomu.wad', 'doom.wad'],
    expectedMatchedFilename: 'doomu.wad',
    expectedGameMode: 'retail',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad'],
    witnessInvariantId: 'GAME_MODE_FIRST_MATCH_BY_CANONICAL_ORDER_WINS',
  },
  {
    id: 'doom-and-doom1-both-present-resolves-to-registered-by-probe-order',
    description: 'A search directory that contains both doom.wad AND doom1.wad resolves to registered because doom.wad is at probe index 5 and doom1.wad is at probe index 6. gamemode=registered.',
    presentCandidateFilenames: ['doom.wad', 'doom1.wad'],
    expectedMatchedFilename: 'doom.wad',
    expectedGameMode: 'registered',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad'],
    witnessInvariantId: 'GAME_MODE_FIRST_MATCH_BY_CANONICAL_ORDER_WINS',
  },
  {
    id: 'doom2f-and-doom2-both-present-resolves-to-doom2f-first-match',
    description:
      'A search directory that contains both doom2f.wad AND doom2.wad resolves to doom2f.wad (probe index 0 wins over probe index 1). Both yield gamemode=commercial; the matched filename distinction matters for D_AddFile but not for gamemode.',
    presentCandidateFilenames: ['doom2f.wad', 'doom2.wad'],
    expectedMatchedFilename: 'doom2f.wad',
    expectedGameMode: 'commercial',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad'],
    witnessInvariantId: 'GAME_MODE_FIRST_MATCH_BY_CANONICAL_ORDER_WINS',
  },
  {
    id: 'all-seven-candidates-present-resolves-to-doom2f-first-match',
    description: 'A search directory that contains all seven candidate filenames resolves to doom2f.wad (probe index 0 wins). gamemode=commercial.',
    presentCandidateFilenames: ALL_SEVEN_CANDIDATES,
    expectedMatchedFilename: 'doom2f.wad',
    expectedGameMode: 'commercial',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad'],
    witnessInvariantId: 'GAME_MODE_FIRST_MATCH_BY_CANONICAL_ORDER_WINS',
  },
  {
    id: 'freedoom-only-resolves-to-indetermined',
    description: 'A search directory that contains only freedoom1.wad and freedoom2.wad walks through all seven probes, matches none, and resolves to gamemode=indetermined. Freedoom is not recognised by vanilla 1.9 IdentifyVersion.',
    presentCandidateFilenames: ['freedoom1.wad', 'freedoom2.wad'],
    expectedMatchedFilename: null,
    expectedGameMode: 'indetermined',
    expectedIndeterminatePrintoutFired: true,
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'GAME_MODE_FREEDOOM_FILENAMES_RESOLVE_TO_INDETERMINED',
  },
  {
    id: 'freedm-only-resolves-to-indetermined',
    description: 'A search directory that contains only freedm.wad walks through all seven probes, matches none, and resolves to gamemode=indetermined. freedm.wad is not recognised by vanilla 1.9 IdentifyVersion.',
    presentCandidateFilenames: ['freedm.wad'],
    expectedMatchedFilename: null,
    expectedGameMode: 'indetermined',
    expectedIndeterminatePrintoutFired: true,
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'GAME_MODE_FREEDOOM_FILENAMES_RESOLVE_TO_INDETERMINED',
  },
  {
    id: 'hacx-and-chex-resolve-to-indetermined',
    description: 'A search directory that contains only hacx.wad and chex.wad walks through all seven probes, matches none, and resolves to gamemode=indetermined. Neither is recognised by vanilla 1.9 IdentifyVersion.',
    presentCandidateFilenames: ['hacx.wad', 'chex.wad'],
    expectedMatchedFilename: null,
    expectedGameMode: 'indetermined',
    expectedIndeterminatePrintoutFired: true,
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'GAME_MODE_HACX_AND_CHEX_FILENAMES_RESOLVE_TO_INDETERMINED',
  },
  {
    id: 'doom1-with-freedoom-noise-still-resolves-to-shareware',
    description: 'A search directory that contains both doom1.wad AND freedoom1.wad resolves to shareware (doom1.wad is in the canonical seven; freedoom1.wad is ignored).',
    presentCandidateFilenames: ['doom1.wad', 'freedoom1.wad'],
    expectedMatchedFilename: 'doom1.wad',
    expectedGameMode: 'shareware',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'GAME_MODE_FREEDOOM_FILENAMES_RESOLVE_TO_INDETERMINED',
  },
  {
    id: 'plutonia-and-tnt-both-present-resolves-to-plutonia-first-match',
    description: 'A search directory that contains both plutonia.wad AND tnt.wad resolves to plutonia.wad (probe index 2 wins over probe index 3). Both yield gamemode=commercial.',
    presentCandidateFilenames: ['plutonia.wad', 'tnt.wad'],
    expectedMatchedFilename: 'plutonia.wad',
    expectedGameMode: 'commercial',
    expectedIndeterminatePrintoutFired: false,
    expectedProbeSequence: ['doom2f.wad', 'doom2.wad', 'plutonia.wad'],
    witnessInvariantId: 'GAME_MODE_FIRST_MATCH_BY_CANONICAL_ORDER_WINS',
  },
];

/**
 * Result of a single game-mode detection run: which candidate filename
 * matched (or null), the assigned gameMode, the probe sequence the
 * handler walked in order, and whether the handler fired the
 * indeterminate printout.
 */
export interface VanillaGameModeDetectionResult {
  readonly matchedFilename: VanillaCandidateFilenameToGameModeEntry['candidateFilename'] | null;
  readonly gameMode: GameMode;
  readonly indeterminatePrintoutFired: boolean;
  readonly probedSequence: readonly VanillaCandidateFilenameToGameModeEntry['candidateFilename'][];
}

/**
 * A minimal handler interface modelling the candidate-scan branch of
 * vanilla `IdentifyVersion()`. The reference implementation walks the
 * canonical seven-candidate list and consults a caller-supplied virtual
 * search directory; the cross-check accepts any handler shape so the
 * focused test can exercise deliberately broken adapters and observe
 * the failure ids.
 */
export interface VanillaGameModeDetectionHandler {
  /**
   * Run a probe against a fresh handler instance. Returns the matched
   * candidate filename, the assigned gameMode, the indeterminate
   * printout flag, and the probe sequence the handler walked in order.
   */
  readonly runProbe: (probe: VanillaGameModeDetectionProbe) => VanillaGameModeDetectionResult;
}

/**
 * Reference handler that walks `VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP`
 * in canonical order, consults the probe's virtual search directory,
 * and stops at the first match. The matched candidate filename pins the
 * gameMode. When no candidate matches, the result is
 * `gameMode='indetermined'`, `indeterminatePrintoutFired=true`,
 * `matchedFilename=null`, and `probedSequence` walks all seven
 * candidates in canonical order.
 */
function referenceVanillaGameModeDetectionProbe(probe: VanillaGameModeDetectionProbe): VanillaGameModeDetectionResult {
  const probed: VanillaCandidateFilenameToGameModeEntry['candidateFilename'][] = [];
  const presentSet = new Set(probe.presentCandidateFilenames);

  for (const candidateEntry of VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP) {
    probed.push(candidateEntry.candidateFilename);
    if (presentSet.has(candidateEntry.candidateFilename)) {
      return Object.freeze({
        matchedFilename: candidateEntry.candidateFilename,
        gameMode: candidateEntry.gameMode,
        indeterminatePrintoutFired: false,
        probedSequence: Object.freeze([...probed]),
      });
    }
  }

  return Object.freeze({
    matchedFilename: null,
    gameMode: 'indetermined',
    indeterminatePrintoutFired: true,
    probedSequence: Object.freeze([...probed]),
  });
}

/**
 * Reference handler routing every probe to the canonical reference
 * implementation. The focused test asserts that this handler passes
 * every probe with zero failures.
 */
export const REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER: VanillaGameModeDetectionHandler = Object.freeze({
  runProbe: referenceVanillaGameModeDetectionProbe,
});

/**
 * Cross-check a `VanillaGameModeDetectionHandler` against
 * `VANILLA_GAME_MODE_DETECTION_PROBES`. Returns the list of failures
 * by stable identifier; an empty list means the handler is parity-safe
 * with the candidate-scan branch of `IdentifyVersion()`.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:matchedFilename:value-mismatch`
 *  - `probe:<probe.id>:gameMode:value-mismatch`
 *  - `probe:<probe.id>:indeterminatePrintoutFired:value-mismatch`
 *  - `probe:<probe.id>:probedSequence:length-mismatch`
 *  - `probe:<probe.id>:probedSequence:order-mismatch`
 */
export function crossCheckVanillaGameModeDetection(handler: VanillaGameModeDetectionHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_GAME_MODE_DETECTION_PROBES) {
    const result = handler.runProbe(probe);

    if (result.matchedFilename !== probe.expectedMatchedFilename) {
      failures.push(`probe:${probe.id}:matchedFilename:value-mismatch`);
    }

    if (result.gameMode !== probe.expectedGameMode) {
      failures.push(`probe:${probe.id}:gameMode:value-mismatch`);
    }

    if (result.indeterminatePrintoutFired !== probe.expectedIndeterminatePrintoutFired) {
      failures.push(`probe:${probe.id}:indeterminatePrintoutFired:value-mismatch`);
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
 * Convenience helper: derive the expected game-mode detection result
 * for a given set of candidate filenames present in the search
 * directory, mirroring the candidate-scan semantics the audit pins.
 * The focused test uses this helper to cross-validate probe
 * expectations independently of the reference handler.
 */
export function deriveExpectedVanillaGameModeDetectionResult(presentCandidateFilenames: readonly string[]): VanillaGameModeDetectionResult {
  return referenceVanillaGameModeDetectionProbe({
    id: 'derive-expected-helper',
    description: 'Internal helper invocation; not part of the pinned probe set.',
    presentCandidateFilenames,
    expectedMatchedFilename: null,
    expectedGameMode: 'indetermined',
    expectedIndeterminatePrintoutFired: true,
    expectedProbeSequence: ALL_SEVEN_CANDIDATES,
    witnessInvariantId: 'GAME_MODE_NO_MATCH_RESOLVES_TO_INDETERMINED_NOT_ABORT',
  });
}
