/**
 * Audit ledger for the vanilla DOOM 1.9 command-line parsing semantics
 * implemented by `src/bootstrap/cmdline.ts`.
 *
 * Each entry pins one contract invariant of Chocolate Doom 2.2.1's
 * `M_CheckParm` and `M_CheckParmWithArgs` (see `src/m_argv.c`) to its
 * upstream source declaration. The accompanying focused test imports the
 * runtime `CommandLine` class and cross-checks every audit entry against
 * concrete probes. If a future change silently weakens the 1-based index
 * sentinel, the case-insensitive match, the program-name skip, the
 * trailing-arg requirement, the dash-prefixed flag convention, or the
 * value-after-flag convention, the audit ledger and the focused test
 * together reject the change.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/m_argv.c`, `src/m_argv.h`,
 *      `src/d_main.c`, `src/g_game.c`).
 *
 * The audit invariants below are pinned against authority 5 because the
 * `M_CheckParm` and `M_CheckParmWithArgs` contract is a textual property
 * of the C source: a sentinel-zero return for "not found", a 1-based
 * argument index for "found", a `strcasecmp` argument comparison, and a
 * scan that begins at index 1 to skip the program name. Authority 1 (the
 * DOS binary) cannot disagree with these because they are the visible
 * pre-condition every vanilla command-line consumer depends on.
 */

import { CommandLine } from './cmdline.ts';

/**
 * One audited contract invariant of `M_CheckParm`.
 */
export interface VanillaCheckParmContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id: 'NOT_FOUND_RETURNS_ZERO' | 'FOUND_RETURNS_ONE_BASED_INDEX' | 'CASE_INSENSITIVE_MATCH' | 'SCAN_STARTS_AT_INDEX_ONE' | 'EXACT_NAME_MATCH';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/m_argv.c';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'M_CheckParm';
}

/**
 * Pinned ledger of every byte-level contract clause of `M_CheckParm`.
 *
 * The ledger is intentionally append-only: future audits MUST extend the
 * ledger rather than mutate prior entries. The focused test enforces that
 * every clause holds against the runtime `CommandLine` class.
 */
export const VANILLA_M_CHECKPARM_CONTRACT_AUDIT: readonly VanillaCheckParmContractAuditEntry[] = [
  {
    id: 'NOT_FOUND_RETURNS_ZERO',
    invariant:
      'M_CheckParm returns 0 when the parameter name does not appear anywhere in the argument list. Zero is the dedicated "not found" sentinel and never a valid found-index because the scan never inspects argv[0] (the program name).',
    referenceSourceFile: 'src/m_argv.c',
    cSymbol: 'M_CheckParm',
  },
  {
    id: 'FOUND_RETURNS_ONE_BASED_INDEX',
    invariant: 'M_CheckParm returns the 1-based argument index of the first matching argument. The returned index is always in [1, myargc - 1] and points at the parameter name itself, not its value.',
    referenceSourceFile: 'src/m_argv.c',
    cSymbol: 'M_CheckParm',
  },
  {
    id: 'CASE_INSENSITIVE_MATCH',
    invariant: 'M_CheckParm compares argument strings with a case-insensitive equality test (vanilla uses strcasecmp). "-IWAD", "-iwad", and "-Iwad" all match a probe of "-iwad".',
    referenceSourceFile: 'src/m_argv.c',
    cSymbol: 'M_CheckParm',
  },
  {
    id: 'SCAN_STARTS_AT_INDEX_ONE',
    invariant: 'M_CheckParm scans starting at index 1 and never inspects index 0. The program name in argv[0] is not eligible to satisfy a parameter probe even if it happens to spell the probed name.',
    referenceSourceFile: 'src/m_argv.c',
    cSymbol: 'M_CheckParm',
  },
  {
    id: 'EXACT_NAME_MATCH',
    invariant: 'M_CheckParm matches the entire argument string. A substring match such as "-iwadextra" against a probe of "-iwad" does not return a found-index; only an exact (case-insensitive) string equality counts.',
    referenceSourceFile: 'src/m_argv.c',
    cSymbol: 'M_CheckParm',
  },
] as const;

/**
 * One audited contract invariant of `M_CheckParmWithArgs`.
 */
export interface VanillaCheckParmWithArgsContractAuditEntry {
  /** Stable identifier of the invariant. */
  readonly id: 'NOT_FOUND_RETURNS_ZERO' | 'INSUFFICIENT_TRAILING_ARGS_RETURNS_ZERO' | 'SUFFICIENT_TRAILING_ARGS_RETURNS_INDEX';
  /** Plain-language description of the contract clause. */
  readonly invariant: string;
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/m_argv.c';
  /** Verbatim C symbol the contract clause is pinned to. */
  readonly cSymbol: 'M_CheckParmWithArgs';
}

/**
 * Pinned ledger of every contract clause of `M_CheckParmWithArgs`.
 */
export const VANILLA_M_CHECKPARM_WITH_ARGS_CONTRACT_AUDIT: readonly VanillaCheckParmWithArgsContractAuditEntry[] = [
  {
    id: 'NOT_FOUND_RETURNS_ZERO',
    invariant: 'M_CheckParmWithArgs returns 0 when the parameter name is absent. Same sentinel-zero contract as M_CheckParm.',
    referenceSourceFile: 'src/m_argv.c',
    cSymbol: 'M_CheckParmWithArgs',
  },
  {
    id: 'INSUFFICIENT_TRAILING_ARGS_RETURNS_ZERO',
    invariant:
      'M_CheckParmWithArgs returns 0 when the parameter is found but fewer than the requested number of trailing arguments follow it. The arity check is `index + requiredArgs < myargc`, so a parameter at the very end of argv with at least one required arg cannot satisfy the contract.',
    referenceSourceFile: 'src/m_argv.c',
    cSymbol: 'M_CheckParmWithArgs',
  },
  {
    id: 'SUFFICIENT_TRAILING_ARGS_RETURNS_INDEX',
    invariant: 'M_CheckParmWithArgs returns the same 1-based index as M_CheckParm when the parameter is present and at least the requested number of trailing arguments follow.',
    referenceSourceFile: 'src/m_argv.c',
    cSymbol: 'M_CheckParmWithArgs',
  },
] as const;

/**
 * One audited convention of vanilla DOOM 1.9 command-line flags.
 */
export interface VanillaCommandLineDashConventionAuditEntry {
  /** Stable identifier of the convention. */
  readonly id: 'SINGLE_DASH_PREFIX' | 'VALUE_FOLLOWS_FLAG';
  /** Plain-language description of the convention. */
  readonly invariant: string;
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/d_main.c';
}

/**
 * Pinned ledger of dash and value-position conventions used by every
 * vanilla command-line flag consumer in `d_main.c`.
 */
export const VANILLA_COMMANDLINE_DASH_CONVENTION_AUDIT: readonly VanillaCommandLineDashConventionAuditEntry[] = [
  {
    id: 'SINGLE_DASH_PREFIX',
    invariant: 'Vanilla DOOM 1.9 flags are written with a single ASCII dash prefix, e.g., "-iwad", "-skill", "-warp", "-devparm". Double-dash long options (GNU style) are not part of the vanilla surface.',
    referenceSourceFile: 'src/d_main.c',
  },
  {
    id: 'VALUE_FOLLOWS_FLAG',
    invariant:
      'When a flag carries a value, the value occupies the immediately following argv slot. For example, `-skill 4` places the literal string "4" at argv[i+1] where argv[i] is "-skill"; M_CheckParmWithArgs guards the read by demanding at least one trailing arg.',
    referenceSourceFile: 'src/d_main.c',
  },
] as const;

/**
 * One derived high-level invariant the cross-check enforces on top of the
 * raw clause declarations. Failures point at concrete identities that any
 * vanilla parity command-line parser must preserve.
 */
export interface VanillaCommandLineDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const VANILLA_COMMANDLINE_DERIVED_INVARIANTS: readonly VanillaCommandLineDerivedInvariant[] = [
  {
    id: 'CHECKPARM_ZERO_IS_NOT_FOUND_SENTINEL',
    description: 'The full M_CheckParm contract collapses to: `result === 0` iff "not found", `result >= 1` iff "found at that 1-based index".',
  },
  {
    id: 'CHECKPARM_IS_CASE_INSENSITIVE',
    description: 'M_CheckParm always compares case-insensitively, so probes like "-IWAD" and "-iwad" find the same arguments.',
  },
  {
    id: 'CHECKPARM_NEVER_MATCHES_PROGRAM_NAME',
    description: 'Index 0 (the program name) is never matched by M_CheckParm even when it spells a probed parameter literally.',
  },
  {
    id: 'CHECKPARM_REQUIRES_EXACT_STRING_EQUALITY',
    description: 'Substrings, prefixes, and suffixes never satisfy M_CheckParm; only the entire argument string is compared.',
  },
  {
    id: 'CHECKPARM_WITH_ARGS_GUARDS_VALUE_READS',
    description: 'M_CheckParmWithArgs returns the same 1-based index as M_CheckParm when enough trailing arguments exist, and 0 otherwise.',
  },
  {
    id: 'VANILLA_FLAGS_USE_SINGLE_DASH_PREFIX',
    description: 'Every vanilla flag the parser consumes uses a single-dash prefix; double-dash long options are outside the contract.',
  },
];

/**
 * One probe applied to a runtime parser. The probe pins a concrete argv,
 * the parameter name being looked up, and the expected results of the
 * three runtime methods. The cross-check helper runs every probe against
 * the runtime parser and reports failures by stable identifier.
 */
export interface VanillaCommandLineProbe {
  /** Stable identifier used in cross-check failure ids. */
  readonly id: string;
  /** Plain-language description of what the probe exercises. */
  readonly description: string;
  /** Verbatim argv. Index 0 is the program name. */
  readonly argv: readonly string[];
  /** Parameter name to look up. */
  readonly probedName: string;
  /** Expected M_CheckParm return value (0 if not found). */
  readonly expectedCheckParmIndex: number;
  /** Expected `parameterExists` return. */
  readonly expectedExists: boolean;
  /** When set, cross-checks `checkParameterWithArgs` with this requested arity. */
  readonly trailingArgsProbe: { readonly requiredArgs: number; readonly expectedIndex: number } | null;
  /** Expected `getParameter` return: a string when present, `null` otherwise. */
  readonly expectedGetParameter: string | null;
  /** Stable invariant id this probe witnesses. */
  readonly witnessInvariantId:
    | 'CHECKPARM_ZERO_IS_NOT_FOUND_SENTINEL'
    | 'CHECKPARM_IS_CASE_INSENSITIVE'
    | 'CHECKPARM_NEVER_MATCHES_PROGRAM_NAME'
    | 'CHECKPARM_REQUIRES_EXACT_STRING_EQUALITY'
    | 'CHECKPARM_WITH_ARGS_GUARDS_VALUE_READS'
    | 'VANILLA_FLAGS_USE_SINGLE_DASH_PREFIX';
}

/**
 * Pinned probe set covering every derived invariant. Each probe is
 * minimal: a tiny argv plus one expected outcome per runtime method.
 */
export const VANILLA_COMMANDLINE_PROBES: readonly VanillaCommandLineProbe[] = [
  {
    id: 'not-found-returns-zero',
    description: 'A probe that does not appear in argv returns 0 from checkParameter, false from parameterExists, and null from getParameter.',
    argv: ['doom.exe', '-iwad', 'DOOM1.WAD'],
    probedName: '-skill',
    expectedCheckParmIndex: 0,
    expectedExists: false,
    trailingArgsProbe: { requiredArgs: 1, expectedIndex: 0 },
    expectedGetParameter: null,
    witnessInvariantId: 'CHECKPARM_ZERO_IS_NOT_FOUND_SENTINEL',
  },
  {
    id: 'found-returns-one-based-index',
    description: 'A probe that appears at argv[1] returns 1, the 1-based index, from checkParameter.',
    argv: ['doom.exe', '-iwad', 'DOOM1.WAD'],
    probedName: '-iwad',
    expectedCheckParmIndex: 1,
    expectedExists: true,
    trailingArgsProbe: { requiredArgs: 1, expectedIndex: 1 },
    expectedGetParameter: 'DOOM1.WAD',
    witnessInvariantId: 'CHECKPARM_ZERO_IS_NOT_FOUND_SENTINEL',
  },
  {
    id: 'case-insensitive-uppercase-probe',
    description: 'An uppercase probe matches a lowercase argv entry; M_CheckParm uses strcasecmp.',
    argv: ['doom.exe', '-iwad', 'DOOM1.WAD'],
    probedName: '-IWAD',
    expectedCheckParmIndex: 1,
    expectedExists: true,
    trailingArgsProbe: null,
    expectedGetParameter: 'DOOM1.WAD',
    witnessInvariantId: 'CHECKPARM_IS_CASE_INSENSITIVE',
  },
  {
    id: 'case-insensitive-mixed-case-argv',
    description: 'A lowercase probe matches a mixed-case argv entry; case bits never affect equality.',
    argv: ['doom.exe', '-Iwad', 'DOOM1.WAD'],
    probedName: '-iwad',
    expectedCheckParmIndex: 1,
    expectedExists: true,
    trailingArgsProbe: null,
    expectedGetParameter: 'DOOM1.WAD',
    witnessInvariantId: 'CHECKPARM_IS_CASE_INSENSITIVE',
  },
  {
    id: 'program-name-is-never-matched-on-its-own',
    description: 'When argv[0] (the program name) is the only entry that spells the probed name, M_CheckParm returns 0 because the scan begins at index 1.',
    argv: ['-iwad'],
    probedName: '-iwad',
    expectedCheckParmIndex: 0,
    expectedExists: false,
    trailingArgsProbe: null,
    expectedGetParameter: null,
    witnessInvariantId: 'CHECKPARM_NEVER_MATCHES_PROGRAM_NAME',
  },
  {
    id: 'program-name-shadowed-by-real-flag',
    description: 'When argv[0] AND argv[1] both spell the probed name, M_CheckParm returns 1, not 0 — argv[0] is skipped and argv[1] is the first eligible match. The trailing value at argv[2] becomes the parameter value.',
    argv: ['-iwad', '-iwad', 'DOOM1.WAD'],
    probedName: '-iwad',
    expectedCheckParmIndex: 1,
    expectedExists: true,
    trailingArgsProbe: { requiredArgs: 1, expectedIndex: 1 },
    expectedGetParameter: 'DOOM1.WAD',
    witnessInvariantId: 'CHECKPARM_NEVER_MATCHES_PROGRAM_NAME',
  },
  {
    id: 'exact-match-rejects-substring',
    description: 'A probe of "-iwad" against an argv that contains "-iwadextra" returns 0; substring overlap is not a match.',
    argv: ['doom.exe', '-iwadextra'],
    probedName: '-iwad',
    expectedCheckParmIndex: 0,
    expectedExists: false,
    trailingArgsProbe: null,
    expectedGetParameter: null,
    witnessInvariantId: 'CHECKPARM_REQUIRES_EXACT_STRING_EQUALITY',
  },
  {
    id: 'with-args-rejects-tail-flag',
    description: 'A flag at the end of argv with no trailing values returns the index from checkParameter but 0 from checkParameterWithArgs(1).',
    argv: ['doom.exe', '-iwad'],
    probedName: '-iwad',
    expectedCheckParmIndex: 1,
    expectedExists: true,
    trailingArgsProbe: { requiredArgs: 1, expectedIndex: 0 },
    expectedGetParameter: null,
    witnessInvariantId: 'CHECKPARM_WITH_ARGS_GUARDS_VALUE_READS',
  },
  {
    id: 'with-args-accepts-mid-flag',
    description: 'A flag with two trailing values satisfies checkParameterWithArgs(2) and returns the same 1-based index.',
    argv: ['doom.exe', '-warp', '1', '1'],
    probedName: '-warp',
    expectedCheckParmIndex: 1,
    expectedExists: true,
    trailingArgsProbe: { requiredArgs: 2, expectedIndex: 1 },
    expectedGetParameter: '1',
    witnessInvariantId: 'CHECKPARM_WITH_ARGS_GUARDS_VALUE_READS',
  },
  {
    id: 'single-dash-prefix-canonical-flag',
    description: 'The canonical "-iwad <path>" pattern is read with the single-dash prefix; getParameter returns the trailing value.',
    argv: ['doom.exe', '-iwad', 'DOOM1.WAD'],
    probedName: '-iwad',
    expectedCheckParmIndex: 1,
    expectedExists: true,
    trailingArgsProbe: { requiredArgs: 1, expectedIndex: 1 },
    expectedGetParameter: 'DOOM1.WAD',
    witnessInvariantId: 'VANILLA_FLAGS_USE_SINGLE_DASH_PREFIX',
  },
];

/**
 * A minimal parser interface covering the three vanilla command-line
 * lookup primitives. The reference implementation routes every method to
 * `CommandLine`, but the cross-check accepts any parser shape so the
 * focused test can exercise deliberately broken adapters and observe the
 * failure ids.
 */
export interface VanillaCommandLineParser {
  /** Wraps `M_CheckParm`: 1-based index, 0 if not found. */
  readonly checkParameter: (argv: readonly string[], parameterName: string) => number;
  /** Wraps `M_CheckParmWithArgs`. */
  readonly checkParameterWithArgs: (argv: readonly string[], parameterName: string, requiredArgs: number) => number;
  /** Wraps the convenience helper `parameterExists`. */
  readonly parameterExists: (argv: readonly string[], parameterName: string) => boolean;
  /** Wraps the convenience helper `getParameter`. */
  readonly getParameter: (argv: readonly string[], parameterName: string) => string | null;
}

/**
 * Reference parser routing every primitive to the runtime `CommandLine`.
 * The focused test asserts that this parser passes every probe with zero
 * failures.
 */
export const REFERENCE_VANILLA_COMMANDLINE_PARSER: VanillaCommandLineParser = Object.freeze({
  checkParameter: (argv: readonly string[], name: string): number => new CommandLine(argv).checkParameter(name),
  checkParameterWithArgs: (argv: readonly string[], name: string, requiredArgs: number): number => new CommandLine(argv).checkParameterWithArgs(name, requiredArgs),
  parameterExists: (argv: readonly string[], name: string): boolean => new CommandLine(argv).parameterExists(name),
  getParameter: (argv: readonly string[], name: string): string | null => new CommandLine(argv).getParameter(name),
});

/**
 * Cross-check a `VanillaCommandLineParser` against `VANILLA_COMMANDLINE_PROBES`.
 * Returns the list of failures by stable identifier; an empty list means
 * the parser is parity-safe with `M_CheckParm`/`M_CheckParmWithArgs`.
 *
 * Identifiers used:
 *  - `probe:<probe.id>:checkParameter:value-mismatch`
 *  - `probe:<probe.id>:parameterExists:value-mismatch`
 *  - `probe:<probe.id>:checkParameterWithArgs:value-mismatch`
 *  - `probe:<probe.id>:getParameter:value-mismatch`
 */
export function crossCheckVanillaCommandLineParser(parser: VanillaCommandLineParser): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_COMMANDLINE_PROBES) {
    const checkParmResult = parser.checkParameter(probe.argv, probe.probedName);
    if (checkParmResult !== probe.expectedCheckParmIndex) {
      failures.push(`probe:${probe.id}:checkParameter:value-mismatch`);
    }

    const existsResult = parser.parameterExists(probe.argv, probe.probedName);
    if (existsResult !== probe.expectedExists) {
      failures.push(`probe:${probe.id}:parameterExists:value-mismatch`);
    }

    if (probe.trailingArgsProbe !== null) {
      const withArgsResult = parser.checkParameterWithArgs(probe.argv, probe.probedName, probe.trailingArgsProbe.requiredArgs);
      if (withArgsResult !== probe.trailingArgsProbe.expectedIndex) {
        failures.push(`probe:${probe.id}:checkParameterWithArgs:value-mismatch`);
      }
    }

    const getParamResult = parser.getParameter(probe.argv, probe.probedName);
    if (getParamResult !== probe.expectedGetParameter) {
      failures.push(`probe:${probe.id}:getParameter:value-mismatch`);
    }
  }

  return failures;
}
