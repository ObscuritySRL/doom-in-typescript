import { describe, expect, test } from 'bun:test';

import {
  REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER,
  VANILLA_DASH_FILE_PARAMETER_NAME,
  VANILLA_DEVELOPER_MODE_DEFAULT_CFG_BASENAME,
  VANILLA_DEVELOPER_MODE_PARAMETER_COUNT,
  VANILLA_DEVELOPER_MODE_PARAMETERS,
  VANILLA_NONEXISTENT_DASH_IWAD_PARAMETER_NAME,
  VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT,
  VANILLA_USER_SUPPLIED_IWAD_SELECTION_DERIVED_INVARIANTS,
  VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES,
  crossCheckVanillaUserSuppliedIwadSelection,
  deriveExpectedUserSuppliedIwadSelectionResult,
} from '../../../src/bootstrap/implement-user-supplied-iwad-selection.ts';
import type { VanillaUserSuppliedIwadSelectionHandler, VanillaUserSuppliedIwadSelectionProbe, VanillaUserSuppliedIwadSelectionResult } from '../../../src/bootstrap/implement-user-supplied-iwad-selection.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-006-implement-user-supplied-iwad-selection.md';

describe('VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly eleven contract clauses for the user-supplied IWAD selection branch', () => {
    expect(VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.length).toBe(11);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references d_main.c and pins the IdentifyVersion symbol', () => {
    for (const entry of VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT) {
      expect(entry.referenceSourceFile).toBe('d_main.c');
      expect(entry.cSymbol).toBe('IdentifyVersion');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the eleven contract ids the cross-check enforces', () => {
    const ids = new Set(VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(
      new Set([
        'DEV_PARAMETER_NAMES_ARE_FIXED_TRIPLE',
        'DEV_PARAMETER_PROBE_ORDER_IS_SHDEV_REGDEV_COMDEV',
        'DEV_PARAMETER_TRIPLE_PROBES_PRECEDE_CANDIDATE_SCAN',
        'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME',
        'DEV_PARAMETER_SETS_DEVPARM_GLOBAL_TRUE',
        'DEV_PARAMETER_USES_HARDCODED_DEVDATA_BASENAME',
        'DEV_PARAMETER_SHORT_CIRCUITS_CANDIDATE_SCAN_VIA_RETURN',
        'DEV_PARAMETER_OVERWRITES_BASEDEFAULT_PATH_LITERAL',
        'NO_DASH_IWAD_FLAG_EXISTS_IN_VANILLA_ONE_DOT_NINE',
        'DASH_FILE_FLAG_DOES_NOT_OVERRIDE_GAME_MODE',
        'DEV_PARAMETER_M_CHECKPARM_LOOKUP_IS_CASE_INSENSITIVE',
      ]),
    );
  });

  test('the DEV_PARAMETER_NAMES_ARE_FIXED_TRIPLE clause names every developer-mode parameter', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DEV_PARAMETER_NAMES_ARE_FIXED_TRIPLE');
    expect(entry).toBeDefined();
    for (const parameterName of ['-shdev', '-regdev', '-comdev']) {
      expect(entry!.invariant).toContain(parameterName);
    }
  });

  test('the DEV_PARAMETER_PROBE_ORDER clause lists the developer parameters in canonical vanilla order', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DEV_PARAMETER_PROBE_ORDER_IS_SHDEV_REGDEV_COMDEV');
    expect(entry).toBeDefined();
    const orderedNames = ['-shdev', '-regdev', '-comdev'];
    let cursor = 0;
    for (const parameterName of orderedNames) {
      const offset = entry!.invariant.indexOf(parameterName, cursor);
      expect(offset).toBeGreaterThanOrEqual(cursor);
      cursor = offset + parameterName.length;
    }
  });

  test('the DEV_PARAMETER_TRIPLE_PROBES_PRECEDE_CANDIDATE_SCAN clause cites doom2f.wad as the first candidate', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DEV_PARAMETER_TRIPLE_PROBES_PRECEDE_CANDIDATE_SCAN');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('doom2f.wad');
    expect(entry!.invariant).toContain('access(R_OK)');
  });

  test('the DEV_PARAMETER_PINS_GAME_MODE clause pairs each flag with its gamemode and notes the Chocolate Doom 2.2.1 divergence', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('-shdev → shareware');
    expect(entry!.invariant).toContain('-regdev → registered');
    expect(entry!.invariant).toContain('-comdev → commercial');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the DEV_PARAMETER_SETS_DEVPARM clause cites the devparm global', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DEV_PARAMETER_SETS_DEVPARM_GLOBAL_TRUE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('devparm');
    expect(entry!.invariant).toContain('true');
  });

  test('the DEV_PARAMETER_USES_HARDCODED_DEVDATA_BASENAME clause names every basename', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DEV_PARAMETER_USES_HARDCODED_DEVDATA_BASENAME');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('-shdev → "doom1.wad"');
    expect(entry!.invariant).toContain('-regdev → "doom.wad"');
    expect(entry!.invariant).toContain('-comdev → "doom2.wad"');
    expect(entry!.invariant).toContain('DEVDATA');
    expect(entry!.invariant).toContain('DOOMWADDIR');
  });

  test('the DEV_PARAMETER_SHORT_CIRCUITS_CANDIDATE_SCAN_VIA_RETURN clause cites the early return', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DEV_PARAMETER_SHORT_CIRCUITS_CANDIDATE_SCAN_VIA_RETURN');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('return;');
    expect(entry!.invariant).toContain('access(R_OK)');
  });

  test('the DEV_PARAMETER_OVERWRITES_BASEDEFAULT_PATH_LITERAL clause cites the strcpy call and DEVDATA literal', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DEV_PARAMETER_OVERWRITES_BASEDEFAULT_PATH_LITERAL');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('strcpy');
    expect(entry!.invariant).toContain('basedefault');
    expect(entry!.invariant).toContain('DEVDATA');
    expect(entry!.invariant).toContain('default.cfg');
  });

  test('the NO_DASH_IWAD_FLAG_EXISTS_IN_VANILLA_ONE_DOT_NINE clause cites Chocolate Doom 2.2.1 as the addition', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'NO_DASH_IWAD_FLAG_EXISTS_IN_VANILLA_ONE_DOT_NINE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('-iwad');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
    expect(entry!.invariant).toContain('D_FindIWAD');
  });

  test('the DASH_FILE_FLAG_DOES_NOT_OVERRIDE_GAME_MODE clause cites D_DoomMain and D_AddFile', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DASH_FILE_FLAG_DOES_NOT_OVERRIDE_GAME_MODE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('-file');
    expect(entry!.invariant).toContain('D_DoomMain');
    expect(entry!.invariant).toContain('D_AddFile');
    expect(entry!.invariant).toContain('PWAD');
  });

  test('the DEV_PARAMETER_M_CHECKPARM_LOOKUP_IS_CASE_INSENSITIVE clause cites strcasecmp and lowercase literals', () => {
    const entry = VANILLA_USER_SUPPLIED_IWAD_SELECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'DEV_PARAMETER_M_CHECKPARM_LOOKUP_IS_CASE_INSENSITIVE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('strcasecmp');
    expect(entry!.invariant).toContain('M_CheckParm');
    expect(entry!.invariant).toContain('-shdev');
  });
});

describe('vanilla user-supplied IWAD selection constants', () => {
  test('VANILLA_DEVELOPER_MODE_PARAMETER_COUNT equals 3', () => {
    expect(VANILLA_DEVELOPER_MODE_PARAMETER_COUNT).toBe(3);
  });

  test('VANILLA_DEVELOPER_MODE_PARAMETERS has exactly three frozen entries in canonical probe order', () => {
    expect(VANILLA_DEVELOPER_MODE_PARAMETERS.length).toBe(3);
    expect(VANILLA_DEVELOPER_MODE_PARAMETERS.length).toBe(VANILLA_DEVELOPER_MODE_PARAMETER_COUNT);
    expect(Object.isFrozen(VANILLA_DEVELOPER_MODE_PARAMETERS)).toBe(true);
    for (const developerParameter of VANILLA_DEVELOPER_MODE_PARAMETERS) {
      expect(Object.isFrozen(developerParameter)).toBe(true);
    }
    expect(VANILLA_DEVELOPER_MODE_PARAMETERS.map((parameter) => parameter.parameterName)).toEqual(['-shdev', '-regdev', '-comdev']);
  });

  test('every developer-mode parameter pins the canonical gameMode', () => {
    const canonicalGameModeByName = {
      '-shdev': 'shareware',
      '-regdev': 'registered',
      '-comdev': 'commercial',
    } as const;
    for (const developerParameter of VANILLA_DEVELOPER_MODE_PARAMETERS) {
      expect(developerParameter.gameMode).toBe(canonicalGameModeByName[developerParameter.parameterName]);
    }
  });

  test('every developer-mode parameter pins the canonical hardcoded DEVDATA basename', () => {
    const canonicalBasenameByName = {
      '-shdev': 'doom1.wad',
      '-regdev': 'doom.wad',
      '-comdev': 'doom2.wad',
    } as const;
    for (const developerParameter of VANILLA_DEVELOPER_MODE_PARAMETERS) {
      expect(developerParameter.devDataBasename).toBe(canonicalBasenameByName[developerParameter.parameterName]);
    }
  });

  test('developer-mode parameters carry probeOrderIndex 0, 1, 2 in canonical order', () => {
    expect(VANILLA_DEVELOPER_MODE_PARAMETERS[0]!.probeOrderIndex).toBe(0);
    expect(VANILLA_DEVELOPER_MODE_PARAMETERS[1]!.probeOrderIndex).toBe(1);
    expect(VANILLA_DEVELOPER_MODE_PARAMETERS[2]!.probeOrderIndex).toBe(2);
  });

  test('VANILLA_NONEXISTENT_DASH_IWAD_PARAMETER_NAME equals the literal lowercase "-iwad"', () => {
    expect(VANILLA_NONEXISTENT_DASH_IWAD_PARAMETER_NAME).toBe('-iwad');
  });

  test('VANILLA_DASH_FILE_PARAMETER_NAME equals the literal lowercase "-file"', () => {
    expect(VANILLA_DASH_FILE_PARAMETER_NAME).toBe('-file');
  });

  test('VANILLA_DEVELOPER_MODE_DEFAULT_CFG_BASENAME equals the literal lowercase "default.cfg"', () => {
    expect(VANILLA_DEVELOPER_MODE_DEFAULT_CFG_BASENAME).toBe('default.cfg');
  });

  test('the developer-mode parameter names form a disjoint set from the dash-iwad and dash-file flags', () => {
    const developerNames = new Set(VANILLA_DEVELOPER_MODE_PARAMETERS.map((parameter) => parameter.parameterName));
    expect(developerNames.has(VANILLA_NONEXISTENT_DASH_IWAD_PARAMETER_NAME as VanillaUserSuppliedIwadSelectionResult['matchedParameterName'] & string)).toBe(false);
    expect(developerNames.has(VANILLA_DASH_FILE_PARAMETER_NAME as VanillaUserSuppliedIwadSelectionResult['matchedParameterName'] & string)).toBe(false);
  });
});

describe('VANILLA_USER_SUPPLIED_IWAD_SELECTION_DERIVED_INVARIANTS ledger shape', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = VANILLA_USER_SUPPLIED_IWAD_SELECTION_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the ten derived invariants the cross-check witnesses', () => {
    const ids = new Set(VANILLA_USER_SUPPLIED_IWAD_SELECTION_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'DEV_PARAMETER_TRIPLE_HAS_EXACTLY_THREE_FLAGS',
        'DEV_PARAMETER_TRIPLE_ORDER_IS_VERBATIM_VANILLA',
        'DEV_PARAMETER_PINS_GAME_MODE_BY_FLAG_NAME_ALONE',
        'DEV_PARAMETER_SETS_DEVPARM_FLAG_TRUE',
        'DEV_PARAMETER_LOADS_HARDCODED_DEVDATA_BASENAME_NOT_DOOMWADDIR',
        'DEV_PARAMETER_OVERRIDE_BYPASSES_CANDIDATE_SCAN',
        'DEV_PARAMETER_FIRST_MATCH_WINS',
        'DEV_PARAMETER_OVERWRITES_BASEDEFAULT_WITH_DEVDATA_DEFAULT_CFG',
        'DASH_IWAD_FLAG_IS_NOT_RECOGNISED_BY_VANILLA',
        'DASH_FILE_FLAG_DOES_NOT_AFFECT_GAME_MODE_OR_IWAD_SELECTION',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of VANILLA_USER_SUPPLIED_IWAD_SELECTION_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES ledger shape', () => {
  test('every probe id is unique', () => {
    const ids = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe witnesses an existing derived invariant', () => {
    const declaredIds = new Set(VANILLA_USER_SUPPLIED_IWAD_SELECTION_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
      expect(declaredIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every probe carries a non-empty description', () => {
    for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
      expect(probe.description.length).toBeGreaterThan(0);
    }
  });

  test('every probe virtualCommandLine has at least one entry (the program name at index 0)', () => {
    for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
      expect(probe.virtualCommandLine.length).toBeGreaterThanOrEqual(1);
      expect(probe.virtualCommandLine[0]!.length).toBeGreaterThan(0);
    }
  });

  test('every probe expectedProbeSequence ends at the matched parameter (or runs through all three on no match)', () => {
    for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
      if (probe.expectedMatchedParameterName === null) {
        expect(probe.expectedProbeSequence.length).toBe(3);
      } else {
        expect(probe.expectedProbeSequence[probe.expectedProbeSequence.length - 1]).toBe(probe.expectedMatchedParameterName);
      }
    }
  });

  test('every probe expectedProbeSequence is a prefix of the canonical three-parameter order', () => {
    const canonicalOrder = ['-shdev', '-regdev', '-comdev'] as const;
    for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
      for (let index = 0; index < probe.expectedProbeSequence.length; index++) {
        expect(probe.expectedProbeSequence[index]).toBe(canonicalOrder[index]!);
      }
    }
  });

  test('every probe expectedDevparmFlag is true on developer-mode match and false on no match', () => {
    for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
      if (probe.expectedMatchedParameterName === null) {
        expect(probe.expectedDevparmFlag).toBe(false);
      } else {
        expect(probe.expectedDevparmFlag).toBe(true);
      }
    }
  });

  test('every probe expectedGameMode is consistent with the matched parameter (or indetermined on null)', () => {
    const expectedGameModeByParameterName = {
      '-shdev': 'shareware',
      '-regdev': 'registered',
      '-comdev': 'commercial',
    } as const;
    for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
      if (probe.expectedMatchedParameterName === null) {
        expect(probe.expectedGameMode).toBe('indetermined');
      } else {
        expect(probe.expectedGameMode).toBe(expectedGameModeByParameterName[probe.expectedMatchedParameterName]);
      }
    }
  });

  test('every probe expectedDevDataBasename is consistent with the matched parameter (or null on no match)', () => {
    const expectedBasenameByParameterName = {
      '-shdev': 'doom1.wad',
      '-regdev': 'doom.wad',
      '-comdev': 'doom2.wad',
    } as const;
    for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
      if (probe.expectedMatchedParameterName === null) {
        expect(probe.expectedDevDataBasename).toBeNull();
      } else {
        expect(probe.expectedDevDataBasename).toBe(expectedBasenameByParameterName[probe.expectedMatchedParameterName]);
      }
    }
  });

  test('every probe expectation is consistent with deriveExpectedUserSuppliedIwadSelectionResult', () => {
    for (const probe of VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES) {
      const derived = deriveExpectedUserSuppliedIwadSelectionResult(probe.virtualCommandLine);
      expect(derived.matchedParameterName).toBe(probe.expectedMatchedParameterName);
      expect(derived.gameMode).toBe(probe.expectedGameMode);
      expect(derived.devparmFlag).toBe(probe.expectedDevparmFlag);
      expect(derived.devDataBasename).toBe(probe.expectedDevDataBasename);
      expect([...derived.probedSequence]).toEqual([...probe.expectedProbeSequence]);
    }
  });
});

describe('crossCheckVanillaUserSuppliedIwadSelection against REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER', () => {
  test('reports zero failures for the canonical reference handler', () => {
    expect(crossCheckVanillaUserSuppliedIwadSelection(REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER)).toEqual([]);
  });

  test('the reference handler resolves -shdev to shareware/doom1.wad', () => {
    const probe = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.find((entry) => entry.id === 'shdev-pins-shareware-and-loads-doom1-wad');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe!);
    expect(result.matchedParameterName).toBe('-shdev');
    expect(result.gameMode).toBe('shareware');
    expect(result.devparmFlag).toBe(true);
    expect(result.devDataBasename).toBe('doom1.wad');
    expect([...result.probedSequence]).toEqual(['-shdev']);
  });

  test('the reference handler resolves -regdev to registered/doom.wad', () => {
    const probe = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.find((entry) => entry.id === 'regdev-pins-registered-and-loads-doom-wad');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe!);
    expect(result.matchedParameterName).toBe('-regdev');
    expect(result.gameMode).toBe('registered');
    expect(result.devparmFlag).toBe(true);
    expect(result.devDataBasename).toBe('doom.wad');
    expect([...result.probedSequence]).toEqual(['-shdev', '-regdev']);
  });

  test('the reference handler resolves -comdev to commercial/doom2.wad after walking past -shdev and -regdev', () => {
    const probe = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.find((entry) => entry.id === 'comdev-pins-commercial-and-loads-doom2-wad');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe!);
    expect(result.matchedParameterName).toBe('-comdev');
    expect(result.gameMode).toBe('commercial');
    expect(result.devparmFlag).toBe(true);
    expect(result.devDataBasename).toBe('doom2.wad');
    expect([...result.probedSequence]).toEqual(['-shdev', '-regdev', '-comdev']);
  });

  test('the reference handler returns indetermined when no developer-mode parameter is supplied', () => {
    const probe = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.find((entry) => entry.id === 'no-developer-parameter-leaves-game-mode-indetermined');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe!);
    expect(result.matchedParameterName).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.devparmFlag).toBe(false);
    expect(result.devDataBasename).toBeNull();
    expect(result.probedSequence.length).toBe(3);
  });

  test('the reference handler picks -shdev first when both -shdev and -regdev are present', () => {
    const probe = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.find((entry) => entry.id === 'shdev-takes-precedence-over-regdev-when-both-supplied');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe!);
    expect(result.matchedParameterName).toBe('-shdev');
    expect(result.gameMode).toBe('shareware');
    expect([...result.probedSequence]).toEqual(['-shdev']);
  });

  test('the reference handler picks -regdev when -shdev is absent and -regdev plus -comdev are both present', () => {
    const probe = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.find((entry) => entry.id === 'regdev-takes-precedence-over-comdev-when-both-supplied');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe!);
    expect(result.matchedParameterName).toBe('-regdev');
    expect(result.gameMode).toBe('registered');
    expect([...result.probedSequence]).toEqual(['-shdev', '-regdev']);
  });

  test('the reference handler ignores the non-vanilla -iwad flag and reports indetermined', () => {
    const probe = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.find((entry) => entry.id === 'iwad-flag-is-not-recognised-by-vanilla-one-dot-nine');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe!);
    expect(result.matchedParameterName).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.devparmFlag).toBe(false);
    expect(result.devDataBasename).toBeNull();
  });

  test('the reference handler ignores -file alone and reports indetermined for the developer-mode branch', () => {
    const probe = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.find((entry) => entry.id === 'file-flag-without-developer-parameter-leaves-game-mode-indetermined');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe!);
    expect(result.matchedParameterName).toBeNull();
    expect(result.gameMode).toBe('indetermined');
  });

  test('the reference handler still pins shareware when both -file and -shdev are supplied', () => {
    const probe = VANILLA_USER_SUPPLIED_IWAD_SELECTION_PROBES.find((entry) => entry.id === 'file-flag-combined-with-shdev-still-pins-shareware');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe!);
    expect(result.matchedParameterName).toBe('-shdev');
    expect(result.gameMode).toBe('shareware');
    expect(result.devDataBasename).toBe('doom1.wad');
  });
});

describe('crossCheckVanillaUserSuppliedIwadSelection failure modes', () => {
  test('detects a handler that swaps the gameMode for a matched developer-mode parameter', () => {
    const wrongGameMode: VanillaUserSuppliedIwadSelectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe);
        if (inner.gameMode !== 'shareware') {
          return inner;
        }
        return Object.freeze({
          matchedParameterName: inner.matchedParameterName,
          gameMode: 'commercial' as const,
          devparmFlag: inner.devparmFlag,
          devDataBasename: inner.devDataBasename,
          probedSequence: inner.probedSequence,
        }) satisfies VanillaUserSuppliedIwadSelectionResult;
      },
    };
    const failures = crossCheckVanillaUserSuppliedIwadSelection(wrongGameMode);
    expect(failures.some((failure) => failure.startsWith('probe:shdev-pins-shareware-and-loads-doom1-wad:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that leaves devparm=false after a developer-mode match', () => {
    const devparmAlwaysFalse: VanillaUserSuppliedIwadSelectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe);
        return Object.freeze({
          matchedParameterName: inner.matchedParameterName,
          gameMode: inner.gameMode,
          devparmFlag: false,
          devDataBasename: inner.devDataBasename,
          probedSequence: inner.probedSequence,
        }) satisfies VanillaUserSuppliedIwadSelectionResult;
      },
    };
    const failures = crossCheckVanillaUserSuppliedIwadSelection(devparmAlwaysFalse);
    expect(failures.some((failure) => failure.startsWith('probe:shdev-pins-shareware-and-loads-doom1-wad:devparmFlag:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:regdev-pins-registered-and-loads-doom-wad:devparmFlag:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:comdev-pins-commercial-and-loads-doom2-wad:devparmFlag:value-mismatch'))).toBe(true);
  });

  test('detects a handler that swaps the hardcoded DEVDATA basename for a different filename', () => {
    const wrongBasename: VanillaUserSuppliedIwadSelectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe);
        if (inner.devDataBasename === null) {
          return inner;
        }
        return Object.freeze({
          matchedParameterName: inner.matchedParameterName,
          gameMode: inner.gameMode,
          devparmFlag: inner.devparmFlag,
          devDataBasename: 'doom2.wad' as const,
          probedSequence: inner.probedSequence,
        }) satisfies VanillaUserSuppliedIwadSelectionResult;
      },
    };
    const failures = crossCheckVanillaUserSuppliedIwadSelection(wrongBasename);
    expect(failures.some((failure) => failure.startsWith('probe:shdev-pins-shareware-and-loads-doom1-wad:devDataBasename:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:regdev-pins-registered-and-loads-doom-wad:devDataBasename:value-mismatch'))).toBe(true);
  });

  test('detects a handler that puts -comdev ahead of -shdev in the probe order', () => {
    const reorderedTriple: VanillaUserSuppliedIwadSelectionHandler = {
      runProbe: (probe) => {
        const wrongOrder: { name: '-shdev' | '-regdev' | '-comdev'; gameMode: 'shareware' | 'registered' | 'commercial'; basename: 'doom1.wad' | 'doom.wad' | 'doom2.wad' }[] = [
          { name: '-comdev', gameMode: 'commercial', basename: 'doom2.wad' },
          { name: '-regdev', gameMode: 'registered', basename: 'doom.wad' },
          { name: '-shdev', gameMode: 'shareware', basename: 'doom1.wad' },
        ];
        const probed: ('-shdev' | '-regdev' | '-comdev')[] = [];
        for (const candidate of wrongOrder) {
          probed.push(candidate.name);
          for (let cursor = 1; cursor < probe.virtualCommandLine.length; cursor++) {
            if (probe.virtualCommandLine[cursor]!.toLowerCase() === candidate.name) {
              return Object.freeze({
                matchedParameterName: candidate.name,
                gameMode: candidate.gameMode,
                devparmFlag: true,
                devDataBasename: candidate.basename,
                probedSequence: Object.freeze([...probed]),
              }) satisfies VanillaUserSuppliedIwadSelectionResult;
            }
          }
        }
        return Object.freeze({
          matchedParameterName: null,
          gameMode: 'indetermined' as const,
          devparmFlag: false,
          devDataBasename: null,
          probedSequence: Object.freeze([...probed]),
        }) satisfies VanillaUserSuppliedIwadSelectionResult;
      },
    };
    const failures = crossCheckVanillaUserSuppliedIwadSelection(reorderedTriple);
    expect(failures.some((failure) => failure.startsWith('probe:shdev-takes-precedence-over-regdev-when-both-supplied:matchedParameterName:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:shdev-takes-precedence-over-regdev-when-both-supplied:probedSequence:length-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:regdev-takes-precedence-over-comdev-when-both-supplied:matchedParameterName:value-mismatch'))).toBe(true);
  });

  test('detects a handler that recognises the non-vanilla -iwad flag and treats it as a developer-mode override', () => {
    const recognisesIwad: VanillaUserSuppliedIwadSelectionHandler = {
      runProbe: (probe) => {
        for (let cursor = 1; cursor < probe.virtualCommandLine.length; cursor++) {
          if (probe.virtualCommandLine[cursor]!.toLowerCase() === '-iwad') {
            return Object.freeze({
              matchedParameterName: '-shdev' as const,
              gameMode: 'shareware' as const,
              devparmFlag: true,
              devDataBasename: 'doom1.wad' as const,
              probedSequence: Object.freeze(['-shdev'] as const),
            }) satisfies VanillaUserSuppliedIwadSelectionResult;
          }
        }
        return REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe);
      },
    };
    const failures = crossCheckVanillaUserSuppliedIwadSelection(recognisesIwad);
    expect(failures.some((failure) => failure.startsWith('probe:iwad-flag-is-not-recognised-by-vanilla-one-dot-nine:matchedParameterName:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:iwad-flag-is-not-recognised-by-vanilla-one-dot-nine:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:iwad-flag-is-not-recognised-by-vanilla-one-dot-nine:devparmFlag:value-mismatch'))).toBe(true);
  });

  test('detects a handler that lets -file override the gamemode when no developer-mode parameter is present', () => {
    const fileFlagOverridesGameMode: VanillaUserSuppliedIwadSelectionHandler = {
      runProbe: (probe) => {
        for (let cursor = 1; cursor < probe.virtualCommandLine.length; cursor++) {
          if (probe.virtualCommandLine[cursor]!.toLowerCase() === '-file') {
            return Object.freeze({
              matchedParameterName: null,
              gameMode: 'commercial' as const,
              devparmFlag: false,
              devDataBasename: null,
              probedSequence: Object.freeze(['-shdev', '-regdev', '-comdev'] as const),
            }) satisfies VanillaUserSuppliedIwadSelectionResult;
          }
        }
        return REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe);
      },
    };
    const failures = crossCheckVanillaUserSuppliedIwadSelection(fileFlagOverridesGameMode);
    expect(failures.some((failure) => failure.startsWith('probe:file-flag-without-developer-parameter-leaves-game-mode-indetermined:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that runs the candidate scan after a developer-mode match (probe sequence too long)', () => {
    const devModeRunsFullScan: VanillaUserSuppliedIwadSelectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe);
        if (inner.matchedParameterName === null) {
          return inner;
        }
        return Object.freeze({
          matchedParameterName: inner.matchedParameterName,
          gameMode: inner.gameMode,
          devparmFlag: inner.devparmFlag,
          devDataBasename: inner.devDataBasename,
          probedSequence: Object.freeze(['-shdev', '-regdev', '-comdev'] as const),
        }) satisfies VanillaUserSuppliedIwadSelectionResult;
      },
    };
    const failures = crossCheckVanillaUserSuppliedIwadSelection(devModeRunsFullScan);
    expect(failures.some((failure) => failure.startsWith('probe:shdev-pins-shareware-and-loads-doom1-wad:probedSequence:length-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:regdev-pins-registered-and-loads-doom-wad:probedSequence:length-mismatch'))).toBe(true);
  });

  test('detects a handler that short-circuits the probe sequence after the first miss', () => {
    const shortCircuit: VanillaUserSuppliedIwadSelectionHandler = {
      runProbe: () => {
        return Object.freeze({
          matchedParameterName: null,
          gameMode: 'indetermined' as const,
          devparmFlag: false,
          devDataBasename: null,
          probedSequence: Object.freeze(['-shdev'] as const),
        }) satisfies VanillaUserSuppliedIwadSelectionResult;
      },
    };
    const failures = crossCheckVanillaUserSuppliedIwadSelection(shortCircuit);
    expect(failures.some((failure) => failure.startsWith('probe:shdev-pins-shareware-and-loads-doom1-wad:matchedParameterName:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:no-developer-parameter-leaves-game-mode-indetermined:probedSequence:length-mismatch'))).toBe(true);
  });

  test('detects a handler that reorders the probe sequence', () => {
    const reorderedProbes: VanillaUserSuppliedIwadSelectionHandler = {
      runProbe: (probe: VanillaUserSuppliedIwadSelectionProbe) => {
        const inner = REFERENCE_VANILLA_USER_SUPPLIED_IWAD_SELECTION_HANDLER.runProbe(probe);
        if (inner.probedSequence.length < 2) {
          return inner;
        }
        const reordered = [...inner.probedSequence];
        const swap = reordered[0]!;
        reordered[0] = reordered[1]!;
        reordered[1] = swap;
        return Object.freeze({
          matchedParameterName: inner.matchedParameterName,
          gameMode: inner.gameMode,
          devparmFlag: inner.devparmFlag,
          devDataBasename: inner.devDataBasename,
          probedSequence: Object.freeze(reordered),
        }) satisfies VanillaUserSuppliedIwadSelectionResult;
      },
    };
    const failures = crossCheckVanillaUserSuppliedIwadSelection(reorderedProbes);
    expect(failures.some((failure) => failure.startsWith('probe:no-developer-parameter-leaves-game-mode-indetermined:probedSequence:order-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedUserSuppliedIwadSelectionResult helper', () => {
  test('returns matchedParameterName=null and gameMode=indetermined for an empty command line', () => {
    const result = deriveExpectedUserSuppliedIwadSelectionResult(['doom']);
    expect(result.matchedParameterName).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.devparmFlag).toBe(false);
    expect(result.devDataBasename).toBeNull();
    expect(result.probedSequence.length).toBe(3);
  });

  test('returns -shdev/shareware/doom1.wad for a -shdev command line', () => {
    const result = deriveExpectedUserSuppliedIwadSelectionResult(['doom', '-shdev']);
    expect(result.matchedParameterName).toBe('-shdev');
    expect(result.gameMode).toBe('shareware');
    expect(result.devparmFlag).toBe(true);
    expect(result.devDataBasename).toBe('doom1.wad');
    expect([...result.probedSequence]).toEqual(['-shdev']);
  });

  test('returns -comdev/commercial/doom2.wad for a -comdev command line and walks all three probes', () => {
    const result = deriveExpectedUserSuppliedIwadSelectionResult(['doom', '-comdev']);
    expect(result.matchedParameterName).toBe('-comdev');
    expect(result.gameMode).toBe('commercial');
    expect(result.devparmFlag).toBe(true);
    expect(result.devDataBasename).toBe('doom2.wad');
    expect([...result.probedSequence]).toEqual(['-shdev', '-regdev', '-comdev']);
  });

  test('respects the case-insensitive M_CheckParm rule (uppercase -SHDEV still matches)', () => {
    const result = deriveExpectedUserSuppliedIwadSelectionResult(['doom', '-SHDEV']);
    expect(result.matchedParameterName).toBe('-shdev');
    expect(result.gameMode).toBe('shareware');
  });

  test('ignores arguments at index 0 (program name) even when they happen to match a developer-mode flag literal', () => {
    const result = deriveExpectedUserSuppliedIwadSelectionResult(['-shdev']);
    expect(result.matchedParameterName).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.devparmFlag).toBe(false);
  });

  test('returns indetermined for the -iwad flag because it is not a vanilla developer-mode parameter', () => {
    const result = deriveExpectedUserSuppliedIwadSelectionResult(['doom', '-iwad', '/some/DOOM.WAD']);
    expect(result.matchedParameterName).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.devparmFlag).toBe(false);
  });
});

describe('vanilla DOOM 1.9 user-supplied IWAD selection acts as a candidate-scan override', () => {
  test('every developer-mode parameter set on the command line short-circuits the candidate scan', () => {
    for (const developerParameter of VANILLA_DEVELOPER_MODE_PARAMETERS) {
      const result = deriveExpectedUserSuppliedIwadSelectionResult(['doom', developerParameter.parameterName]);
      expect(result.matchedParameterName).toBe(developerParameter.parameterName);
      expect(result.gameMode).toBe(developerParameter.gameMode);
      expect(result.devparmFlag).toBe(true);
      expect(result.devDataBasename).toBe(developerParameter.devDataBasename);
    }
  });

  test('removing the developer-mode parameter from a previously matching command line drops back to indetermined', () => {
    const matched = deriveExpectedUserSuppliedIwadSelectionResult(['doom', '-comdev']);
    const withoutFlag = deriveExpectedUserSuppliedIwadSelectionResult(['doom']);
    expect(matched.matchedParameterName).toBe('-comdev');
    expect(withoutFlag.matchedParameterName).toBeNull();
    expect(withoutFlag.gameMode).toBe('indetermined');
  });

  test('combining -shdev with the non-vanilla -iwad flag still pins shareware (the -iwad flag has no effect)', () => {
    const result = deriveExpectedUserSuppliedIwadSelectionResult(['doom', '-iwad', '/iwad/DOOM.WAD', '-shdev']);
    expect(result.matchedParameterName).toBe('-shdev');
    expect(result.gameMode).toBe('shareware');
    expect(result.devparmFlag).toBe(true);
    expect(result.devDataBasename).toBe('doom1.wad');
  });
});

describe('implement-user-supplied-iwad-selection step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-user-supplied-iwad-selection.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-user-supplied-iwad-selection.test.ts');
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
