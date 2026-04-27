import { describe, expect, test } from 'bun:test';

import { CommandLine } from '../../../src/bootstrap/cmdline.ts';
import {
  REFERENCE_VANILLA_COMMANDLINE_PARSER,
  VANILLA_COMMANDLINE_DASH_CONVENTION_AUDIT,
  VANILLA_COMMANDLINE_DERIVED_INVARIANTS,
  VANILLA_COMMANDLINE_PROBES,
  VANILLA_M_CHECKPARM_CONTRACT_AUDIT,
  VANILLA_M_CHECKPARM_WITH_ARGS_CONTRACT_AUDIT,
  crossCheckVanillaCommandLineParser,
} from '../../../src/bootstrap/implement-vanilla-command-line-parsing.ts';
import type { VanillaCommandLineParser, VanillaCommandLineProbe } from '../../../src/bootstrap/implement-vanilla-command-line-parsing.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-002-implement-vanilla-command-line-parsing.md';

describe('VANILLA_M_CHECKPARM_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly five contract clauses for M_CheckParm', () => {
    expect(VANILLA_M_CHECKPARM_CONTRACT_AUDIT.length).toBe(5);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_M_CHECKPARM_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references src/m_argv.c and pins the M_CheckParm symbol', () => {
    for (const entry of VANILLA_M_CHECKPARM_CONTRACT_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/m_argv.c');
      expect(entry.cSymbol).toBe('M_CheckParm');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the five contract ids the cross-check enforces', () => {
    const ids = new Set(VANILLA_M_CHECKPARM_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(new Set(['NOT_FOUND_RETURNS_ZERO', 'FOUND_RETURNS_ONE_BASED_INDEX', 'CASE_INSENSITIVE_MATCH', 'SCAN_STARTS_AT_INDEX_ONE', 'EXACT_NAME_MATCH']));
  });
});

describe('VANILLA_M_CHECKPARM_WITH_ARGS_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly three contract clauses for M_CheckParmWithArgs', () => {
    expect(VANILLA_M_CHECKPARM_WITH_ARGS_CONTRACT_AUDIT.length).toBe(3);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_M_CHECKPARM_WITH_ARGS_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references src/m_argv.c and pins the M_CheckParmWithArgs symbol', () => {
    for (const entry of VANILLA_M_CHECKPARM_WITH_ARGS_CONTRACT_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/m_argv.c');
      expect(entry.cSymbol).toBe('M_CheckParmWithArgs');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the three contract ids the cross-check enforces', () => {
    const ids = new Set(VANILLA_M_CHECKPARM_WITH_ARGS_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(new Set(['NOT_FOUND_RETURNS_ZERO', 'INSUFFICIENT_TRAILING_ARGS_RETURNS_ZERO', 'SUFFICIENT_TRAILING_ARGS_RETURNS_INDEX']));
  });
});

describe('VANILLA_COMMANDLINE_DASH_CONVENTION_AUDIT ledger shape', () => {
  test('audits exactly two dash and value-position conventions', () => {
    expect(VANILLA_COMMANDLINE_DASH_CONVENTION_AUDIT.length).toBe(2);
  });

  test('every convention id is unique and references src/d_main.c', () => {
    const ids = VANILLA_COMMANDLINE_DASH_CONVENTION_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of VANILLA_COMMANDLINE_DASH_CONVENTION_AUDIT) {
      expect(entry.referenceSourceFile).toBe('src/d_main.c');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the SINGLE_DASH_PREFIX and VALUE_FOLLOWS_FLAG conventions', () => {
    const ids = new Set(VANILLA_COMMANDLINE_DASH_CONVENTION_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(new Set(['SINGLE_DASH_PREFIX', 'VALUE_FOLLOWS_FLAG']));
  });
});

describe('VANILLA_COMMANDLINE_DERIVED_INVARIANTS ledger shape', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = VANILLA_COMMANDLINE_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the six derived invariants the cross-check witnesses', () => {
    const ids = new Set(VANILLA_COMMANDLINE_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'CHECKPARM_ZERO_IS_NOT_FOUND_SENTINEL',
        'CHECKPARM_IS_CASE_INSENSITIVE',
        'CHECKPARM_NEVER_MATCHES_PROGRAM_NAME',
        'CHECKPARM_REQUIRES_EXACT_STRING_EQUALITY',
        'CHECKPARM_WITH_ARGS_GUARDS_VALUE_READS',
        'VANILLA_FLAGS_USE_SINGLE_DASH_PREFIX',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of VANILLA_COMMANDLINE_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_COMMANDLINE_PROBES ledger shape', () => {
  test('every probe id is unique', () => {
    const ids = VANILLA_COMMANDLINE_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe witnesses an existing derived invariant', () => {
    const declaredInvariantIds = new Set(VANILLA_COMMANDLINE_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    for (const probe of VANILLA_COMMANDLINE_PROBES) {
      expect(declaredInvariantIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every derived invariant is witnessed by at least one probe', () => {
    const witnessedInvariantIds = new Set(VANILLA_COMMANDLINE_PROBES.map((probe) => probe.witnessInvariantId));
    const declaredInvariantIds = new Set(VANILLA_COMMANDLINE_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    for (const invariantId of declaredInvariantIds) {
      expect(witnessedInvariantIds.has(invariantId as VanillaCommandLineProbe['witnessInvariantId'])).toBe(true);
    }
  });

  test('every probe carries a non-empty description and a non-empty argv', () => {
    for (const probe of VANILLA_COMMANDLINE_PROBES) {
      expect(probe.description.length).toBeGreaterThan(0);
      expect(probe.argv.length).toBeGreaterThan(0);
      expect(probe.probedName.length).toBeGreaterThan(0);
    }
  });

  test('every found-index probe targets an index in [1, argv.length - 1]', () => {
    for (const probe of VANILLA_COMMANDLINE_PROBES) {
      if (probe.expectedCheckParmIndex !== 0) {
        expect(probe.expectedCheckParmIndex).toBeGreaterThanOrEqual(1);
        expect(probe.expectedCheckParmIndex).toBeLessThanOrEqual(probe.argv.length - 1);
      }
    }
  });
});

describe('crossCheckVanillaCommandLineParser against REFERENCE_VANILLA_COMMANDLINE_PARSER', () => {
  test('reports zero failures for the runtime CommandLine class', () => {
    expect(crossCheckVanillaCommandLineParser(REFERENCE_VANILLA_COMMANDLINE_PARSER)).toEqual([]);
  });

  test('the reference parser routes every method to a fresh CommandLine instance', () => {
    const argv = ['doom.exe', '-iwad', 'DOOM1.WAD'];
    expect(REFERENCE_VANILLA_COMMANDLINE_PARSER.checkParameter(argv, '-iwad')).toBe(new CommandLine(argv).checkParameter('-iwad'));
    expect(REFERENCE_VANILLA_COMMANDLINE_PARSER.parameterExists(argv, '-iwad')).toBe(new CommandLine(argv).parameterExists('-iwad'));
    expect(REFERENCE_VANILLA_COMMANDLINE_PARSER.getParameter(argv, '-iwad')).toBe(new CommandLine(argv).getParameter('-iwad'));
    expect(REFERENCE_VANILLA_COMMANDLINE_PARSER.checkParameterWithArgs(argv, '-iwad', 1)).toBe(new CommandLine(argv).checkParameterWithArgs('-iwad', 1));
  });
});

describe('crossCheckVanillaCommandLineParser failure modes', () => {
  test('detects a parser whose checkParameter is case-sensitive', () => {
    const caseSensitive: VanillaCommandLineParser = {
      checkParameter: (argv, name) => {
        for (let index = 1; index < argv.length; index++) {
          if (argv[index] === name) {
            return index;
          }
        }
        return 0;
      },
      checkParameterWithArgs: (argv, name, requiredArgs) => {
        for (let index = 1; index < argv.length; index++) {
          if (argv[index] === name) {
            return index + requiredArgs < argv.length ? index : 0;
          }
        }
        return 0;
      },
      parameterExists: (argv, name) => {
        for (let index = 1; index < argv.length; index++) {
          if (argv[index] === name) {
            return true;
          }
        }
        return false;
      },
      getParameter: (argv, name) => {
        for (let index = 1; index < argv.length; index++) {
          if (argv[index] === name) {
            return argv[index + 1] ?? null;
          }
        }
        return null;
      },
    };
    const failures = crossCheckVanillaCommandLineParser(caseSensitive);
    expect(failures.some((failure) => failure.startsWith('probe:case-insensitive-uppercase-probe:'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:case-insensitive-mixed-case-argv:'))).toBe(true);
  });

  test('detects a parser whose checkParameter does substring matching instead of equality', () => {
    const substringMatcher: VanillaCommandLineParser = {
      checkParameter: (argv, name) => {
        const lower = name.toLowerCase();
        for (let index = 1; index < argv.length; index++) {
          if (argv[index]!.toLowerCase().startsWith(lower)) {
            return index;
          }
        }
        return 0;
      },
      checkParameterWithArgs: (argv, name, requiredArgs) => {
        const lower = name.toLowerCase();
        for (let index = 1; index < argv.length; index++) {
          if (argv[index]!.toLowerCase().startsWith(lower)) {
            return index + requiredArgs < argv.length ? index : 0;
          }
        }
        return 0;
      },
      parameterExists: (argv, name) => {
        const lower = name.toLowerCase();
        for (let index = 1; index < argv.length; index++) {
          if (argv[index]!.toLowerCase().startsWith(lower)) {
            return true;
          }
        }
        return false;
      },
      getParameter: (argv, name) => {
        const lower = name.toLowerCase();
        for (let index = 1; index < argv.length; index++) {
          if (argv[index]!.toLowerCase().startsWith(lower)) {
            return argv[index + 1] ?? null;
          }
        }
        return null;
      },
    };
    const failures = crossCheckVanillaCommandLineParser(substringMatcher);
    expect(failures.some((failure) => failure.startsWith('probe:exact-match-rejects-substring:'))).toBe(true);
  });

  test('detects a parser that scans starting at index 0 instead of index 1', () => {
    const scanFromZero: VanillaCommandLineParser = {
      checkParameter: (argv, name) => {
        const lower = name.toLowerCase();
        for (let index = 0; index < argv.length; index++) {
          if (argv[index]!.toLowerCase() === lower) {
            return index;
          }
        }
        return 0;
      },
      checkParameterWithArgs: (argv, name, requiredArgs) => {
        const lower = name.toLowerCase();
        for (let index = 0; index < argv.length; index++) {
          if (argv[index]!.toLowerCase() === lower) {
            return index + requiredArgs < argv.length ? index : 0;
          }
        }
        return 0;
      },
      parameterExists: (argv, name) => {
        const lower = name.toLowerCase();
        for (let index = 0; index < argv.length; index++) {
          if (argv[index]!.toLowerCase() === lower) {
            return true;
          }
        }
        return false;
      },
      getParameter: (argv, name) => {
        const lower = name.toLowerCase();
        for (let index = 0; index < argv.length; index++) {
          if (argv[index]!.toLowerCase() === lower) {
            return argv[index + 1] ?? null;
          }
        }
        return null;
      },
    };
    const failures = crossCheckVanillaCommandLineParser(scanFromZero);
    expect(failures.some((failure) => failure.startsWith('probe:program-name-is-never-matched-on-its-own:'))).toBe(true);
  });

  test('detects a parser whose checkParameterWithArgs ignores the trailing-args minimum', () => {
    const ignoreArity: VanillaCommandLineParser = {
      ...REFERENCE_VANILLA_COMMANDLINE_PARSER,
      checkParameterWithArgs: (argv, name) => REFERENCE_VANILLA_COMMANDLINE_PARSER.checkParameter(argv, name),
    };
    const failures = crossCheckVanillaCommandLineParser(ignoreArity);
    expect(failures.some((failure) => failure.startsWith('probe:with-args-rejects-tail-flag:'))).toBe(true);
    expect(failures.some((failure) => failure.includes(':checkParameterWithArgs:value-mismatch'))).toBe(true);
  });

  test('detects a parser that returns 0-based indices instead of 1-based', () => {
    const zeroBasedIndex: VanillaCommandLineParser = {
      ...REFERENCE_VANILLA_COMMANDLINE_PARSER,
      checkParameter: (argv, name) => {
        const result = REFERENCE_VANILLA_COMMANDLINE_PARSER.checkParameter(argv, name);
        return result === 0 ? 0 : result - 1;
      },
    };
    const failures = crossCheckVanillaCommandLineParser(zeroBasedIndex);
    expect(failures.some((failure) => failure.startsWith('probe:found-returns-one-based-index:'))).toBe(true);
  });

  test('reports an empty failure list when a fresh adapter routes to CommandLine', () => {
    const cloned: VanillaCommandLineParser = {
      checkParameter: REFERENCE_VANILLA_COMMANDLINE_PARSER.checkParameter,
      checkParameterWithArgs: REFERENCE_VANILLA_COMMANDLINE_PARSER.checkParameterWithArgs,
      parameterExists: REFERENCE_VANILLA_COMMANDLINE_PARSER.parameterExists,
      getParameter: REFERENCE_VANILLA_COMMANDLINE_PARSER.getParameter,
    };
    expect(crossCheckVanillaCommandLineParser(cloned)).toEqual([]);
  });
});

describe('runtime CommandLine satisfies the documented vanilla probes directly', () => {
  test('argv ["doom.exe", "-iwad", "DOOM1.WAD"] yields checkParameter("-iwad") === 1', () => {
    const cmdline = new CommandLine(['doom.exe', '-iwad', 'DOOM1.WAD']);
    expect(cmdline.checkParameter('-iwad')).toBe(1);
  });

  test('argv ["doom.exe"] yields checkParameter("-iwad") === 0 (program-name skip)', () => {
    const cmdline = new CommandLine(['doom.exe']);
    expect(cmdline.checkParameter('-iwad')).toBe(0);
  });

  test('argv ["-iwad"] (program name == "-iwad") yields checkParameter("-iwad") === 0', () => {
    const cmdline = new CommandLine(['-iwad']);
    expect(cmdline.checkParameter('-iwad')).toBe(0);
  });

  test('argv ["doom.exe", "-IWAD"] yields checkParameter("-iwad") === 1 (case-insensitive)', () => {
    const cmdline = new CommandLine(['doom.exe', '-IWAD']);
    expect(cmdline.checkParameter('-iwad')).toBe(1);
  });

  test('argv ["doom.exe", "-iwadextra"] yields checkParameter("-iwad") === 0 (no substring match)', () => {
    const cmdline = new CommandLine(['doom.exe', '-iwadextra']);
    expect(cmdline.checkParameter('-iwad')).toBe(0);
  });

  test('argv ["doom.exe", "-iwad"] yields checkParameterWithArgs("-iwad", 1) === 0 (no trailing arg)', () => {
    const cmdline = new CommandLine(['doom.exe', '-iwad']);
    expect(cmdline.checkParameterWithArgs('-iwad', 1)).toBe(0);
  });

  test('argv ["doom.exe", "-iwad", "DOOM1.WAD"] yields checkParameterWithArgs("-iwad", 1) === 1', () => {
    const cmdline = new CommandLine(['doom.exe', '-iwad', 'DOOM1.WAD']);
    expect(cmdline.checkParameterWithArgs('-iwad', 1)).toBe(1);
  });

  test('argv ["doom.exe", "-warp", "1", "1"] yields checkParameterWithArgs("-warp", 2) === 1', () => {
    const cmdline = new CommandLine(['doom.exe', '-warp', '1', '1']);
    expect(cmdline.checkParameterWithArgs('-warp', 2)).toBe(1);
  });

  test('argv ["doom.exe", "-warp", "1"] yields checkParameterWithArgs("-warp", 2) === 0', () => {
    const cmdline = new CommandLine(['doom.exe', '-warp', '1']);
    expect(cmdline.checkParameterWithArgs('-warp', 2)).toBe(0);
  });
});

describe('implement-vanilla-command-line-parsing step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-vanilla-command-line-parsing.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-vanilla-command-line-parsing.test.ts');
  });

  test('lists d_main.c, g_game.c, i_timer.c, i_video.c, and m_menu.c as research sources', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
    expect(stepText).toContain('- i_timer.c');
    expect(stepText).toContain('- i_video.c');
    expect(stepText).toContain('- m_menu.c');
  });

  test('declares the prerequisite gate 00-018', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
