import { describe, expect, test } from 'bun:test';

import {
  REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER,
  VANILLA_CANDIDATE_FILENAME_COUNT,
  VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP,
  VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT,
  VANILLA_GAME_MODE_DETECTION_DERIVED_INVARIANTS,
  VANILLA_GAME_MODE_DETECTION_PROBES,
  VANILLA_GAME_MODE_ENUM_VALUE_COUNT,
  VANILLA_GAME_MODE_ENUM_VALUES,
  VANILLA_GAME_MODE_INDETERMINATE_ENUM_LITERAL,
  VANILLA_GAME_MODE_INDETERMINATE_PRINTOUT_LITERAL,
  VANILLA_UNRECOGNISED_IWAD_FILENAMES,
  crossCheckVanillaGameModeDetection,
  deriveExpectedVanillaGameModeDetectionResult,
} from '../../../src/bootstrap/implement-doom-game-mode-detection.ts';
import type { VanillaGameModeDetectionHandler, VanillaGameModeDetectionProbe, VanillaGameModeDetectionResult } from '../../../src/bootstrap/implement-doom-game-mode-detection.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-007-implement-doom-game-mode-detection.md';

describe('VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly thirteen contract clauses for the game-mode detection branch', () => {
    expect(VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.length).toBe(13);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references either d_main.c or doomdef.h and pins either IdentifyVersion or gamemode_t', () => {
    for (const entry of VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT) {
      expect(['d_main.c', 'doomdef.h']).toContain(entry.referenceSourceFile);
      expect(['IdentifyVersion', 'gamemode_t']).toContain(entry.cSymbol);
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the thirteen contract ids the cross-check enforces', () => {
    const ids = new Set(VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(
      new Set([
        'GAME_MODE_ENUM_HAS_FIVE_LITERAL_VALUES',
        'GAME_MODE_INDETERMINED_LITERAL_PRESERVES_VANILLA_TYPO',
        'GAME_MODE_DERIVED_FROM_MATCHED_CANDIDATE_FILENAME_ALONE',
        'GAME_MODE_NO_LUMP_INSPECTION_IN_VANILLA_ONE_DOT_NINE',
        'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_FOUR_FILENAMES',
        'GAME_MODE_RETAIL_IS_DOOMU_WAD_ONLY',
        'GAME_MODE_REGISTERED_IS_DOOM_WAD_ONLY',
        'GAME_MODE_SHAREWARE_IS_DOOM1_WAD_ONLY',
        'GAME_MODE_INDETERMINATE_FALLBACK_DOES_NOT_CALL_I_ERROR',
        'GAME_MODE_INDETERMINATE_PRINTOUT_PRECEDES_ENUM_ASSIGNMENT',
        'GAME_MODE_FREEDOOM_FILENAMES_NOT_RECOGNISED_BY_VANILLA',
        'GAME_MODE_HACX_AND_CHEX_FILENAMES_NOT_RECOGNISED_BY_VANILLA',
        'GAME_MODE_CANDIDATE_BRANCH_IS_DISTINCT_FROM_DEV_MODE_BRANCH',
      ]),
    );
  });

  test('the GAME_MODE_ENUM_HAS_FIVE_LITERAL_VALUES clause names every gamemode enum value', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_ENUM_HAS_FIVE_LITERAL_VALUES');
    expect(entry).toBeDefined();
    for (const literal of ['shareware', 'registered', 'commercial', 'retail', 'indetermined']) {
      expect(entry!.invariant).toContain(literal);
    }
    expect(entry!.referenceSourceFile).toBe('doomdef.h');
    expect(entry!.cSymbol).toBe('gamemode_t');
  });

  test('the GAME_MODE_INDETERMINED_LITERAL_PRESERVES_VANILLA_TYPO clause cites both the typo and the dictionary form', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_INDETERMINED_LITERAL_PRESERVES_VANILLA_TYPO');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('indetermined');
    expect(entry!.invariant).toContain('indeterminate');
    expect(entry!.invariant).toContain('typo');
    expect(entry!.invariant).toContain('linuxdoom-1.10');
  });

  test('the GAME_MODE_DERIVED_FROM_MATCHED_CANDIDATE_FILENAME_ALONE clause pairs every filename with its gamemode', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_DERIVED_FROM_MATCHED_CANDIDATE_FILENAME_ALONE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('doom2f.wad');
    expect(entry!.invariant).toContain('doom2.wad');
    expect(entry!.invariant).toContain('plutonia.wad');
    expect(entry!.invariant).toContain('tnt.wad');
    expect(entry!.invariant).toContain('commercial');
    expect(entry!.invariant).toContain('doomu.wad');
    expect(entry!.invariant).toContain('retail');
    expect(entry!.invariant).toContain('doom.wad');
    expect(entry!.invariant).toContain('registered');
    expect(entry!.invariant).toContain('doom1.wad');
    expect(entry!.invariant).toContain('shareware');
  });

  test('the GAME_MODE_NO_LUMP_INSPECTION_IN_VANILLA_ONE_DOT_NINE clause cites Chocolate Doom 2.2.1 D_IdentifyIWADByContents as the divergent mechanism', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_NO_LUMP_INSPECTION_IN_VANILLA_ONE_DOT_NINE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('access(R_OK)');
    expect(entry!.invariant).toContain('lump');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
    expect(entry!.invariant).toContain('D_IdentifyIWADByContents');
  });

  test('the GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_FOUR_FILENAMES clause cites all four commercial filenames and gamemission_t', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_FOUR_FILENAMES');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('doom2f.wad');
    expect(entry!.invariant).toContain('doom2.wad');
    expect(entry!.invariant).toContain('plutonia.wad');
    expect(entry!.invariant).toContain('tnt.wad');
    expect(entry!.invariant).toContain('many-to-one');
    expect(entry!.invariant).toContain('gamemission_t');
  });

  test('the GAME_MODE_RETAIL_IS_DOOMU_WAD_ONLY clause cites Ultimate DOOM and the four-episode count', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_RETAIL_IS_DOOMU_WAD_ONLY');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('doomu.wad');
    expect(entry!.invariant).toContain('Ultimate DOOM');
    expect(entry!.invariant).toContain('four-episode');
  });

  test('the GAME_MODE_REGISTERED_IS_DOOM_WAD_ONLY clause cites the sixth-probe ordering against doomu.wad', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_REGISTERED_IS_DOOM_WAD_ONLY');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('doom.wad');
    expect(entry!.invariant).toContain('doomu.wad');
    expect(entry!.invariant).toContain('sixth probe');
    expect(entry!.invariant).toContain('three-episode');
  });

  test('the GAME_MODE_SHAREWARE_IS_DOOM1_WAD_ONLY clause cites the seventh-probe last-priority position', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_SHAREWARE_IS_DOOM1_WAD_ONLY');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('doom1.wad');
    expect(entry!.invariant).toContain('seventh');
    expect(entry!.invariant).toContain('Knee-Deep in the Dead');
  });

  test('the GAME_MODE_INDETERMINATE_FALLBACK_DOES_NOT_CALL_I_ERROR clause cites both vanilla and Chocolate Doom 2.2.1', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_INDETERMINATE_FALLBACK_DOES_NOT_CALL_I_ERROR');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('I_Error');
    expect(entry!.invariant).toContain('Game mode indeterminate.');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the GAME_MODE_INDETERMINATE_PRINTOUT_PRECEDES_ENUM_ASSIGNMENT clause cites the order rule', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_INDETERMINATE_PRINTOUT_PRECEDES_ENUM_ASSIGNMENT');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('printf');
    expect(entry!.invariant).toContain('Game mode indeterminate.');
    expect(entry!.invariant).toContain('precedes');
  });

  test('the GAME_MODE_FREEDOOM_FILENAMES_NOT_RECOGNISED_BY_VANILLA clause names every Freedoom IWAD basename', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_FREEDOOM_FILENAMES_NOT_RECOGNISED_BY_VANILLA');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('freedoom1.wad');
    expect(entry!.invariant).toContain('freedoom2.wad');
    expect(entry!.invariant).toContain('freedm.wad');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the GAME_MODE_HACX_AND_CHEX_FILENAMES_NOT_RECOGNISED_BY_VANILLA clause names both filenames', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_HACX_AND_CHEX_FILENAMES_NOT_RECOGNISED_BY_VANILLA');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('hacx.wad');
    expect(entry!.invariant).toContain('chex.wad');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the GAME_MODE_CANDIDATE_BRANCH_IS_DISTINCT_FROM_DEV_MODE_BRANCH clause references step 03-006 and the dev-mode flags', () => {
    const entry = VANILLA_GAME_MODE_DETECTION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_CANDIDATE_BRANCH_IS_DISTINCT_FROM_DEV_MODE_BRANCH');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('-shdev');
    expect(entry!.invariant).toContain('-regdev');
    expect(entry!.invariant).toContain('-comdev');
    expect(entry!.invariant).toContain('03-006');
    expect(entry!.invariant).toContain('devparm');
    expect(entry!.invariant).toContain('DEVDATA');
  });
});

describe('vanilla game-mode detection constants', () => {
  test('VANILLA_CANDIDATE_FILENAME_COUNT equals 7', () => {
    expect(VANILLA_CANDIDATE_FILENAME_COUNT).toBe(7);
  });

  test('VANILLA_GAME_MODE_ENUM_VALUE_COUNT equals 5', () => {
    expect(VANILLA_GAME_MODE_ENUM_VALUE_COUNT).toBe(5);
  });

  test('VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP has exactly seven frozen entries in canonical probe order', () => {
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP.length).toBe(7);
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP.length).toBe(VANILLA_CANDIDATE_FILENAME_COUNT);
    expect(Object.isFrozen(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP)).toBe(true);
    for (const candidateEntry of VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP) {
      expect(Object.isFrozen(candidateEntry)).toBe(true);
    }
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP.map((entry) => entry.candidateFilename)).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);
  });

  test('every candidate filename pins the canonical gameMode', () => {
    const canonicalGameModeByFilename = {
      'doom2f.wad': 'commercial',
      'doom2.wad': 'commercial',
      'plutonia.wad': 'commercial',
      'tnt.wad': 'commercial',
      'doomu.wad': 'retail',
      'doom.wad': 'registered',
      'doom1.wad': 'shareware',
    } as const;
    for (const candidateEntry of VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP) {
      expect(candidateEntry.gameMode).toBe(canonicalGameModeByFilename[candidateEntry.candidateFilename]);
    }
  });

  test('candidate entries carry probeOrderIndex 0..6 in canonical order', () => {
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP[0]!.probeOrderIndex).toBe(0);
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP[1]!.probeOrderIndex).toBe(1);
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP[2]!.probeOrderIndex).toBe(2);
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP[3]!.probeOrderIndex).toBe(3);
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP[4]!.probeOrderIndex).toBe(4);
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP[5]!.probeOrderIndex).toBe(5);
    expect(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP[6]!.probeOrderIndex).toBe(6);
  });

  test('VANILLA_GAME_MODE_ENUM_VALUES has exactly five frozen entries in declaration order', () => {
    expect(VANILLA_GAME_MODE_ENUM_VALUES.length).toBe(5);
    expect(VANILLA_GAME_MODE_ENUM_VALUES.length).toBe(VANILLA_GAME_MODE_ENUM_VALUE_COUNT);
    expect(Object.isFrozen(VANILLA_GAME_MODE_ENUM_VALUES)).toBe(true);
    expect([...VANILLA_GAME_MODE_ENUM_VALUES]).toEqual(['shareware', 'registered', 'commercial', 'retail', 'indetermined']);
  });

  test('VANILLA_GAME_MODE_INDETERMINATE_PRINTOUT_LITERAL is the dictionary-spelled "Game mode indeterminate.\\n"', () => {
    expect(VANILLA_GAME_MODE_INDETERMINATE_PRINTOUT_LITERAL).toBe('Game mode indeterminate.\n');
    expect(VANILLA_GAME_MODE_INDETERMINATE_PRINTOUT_LITERAL.endsWith('\n')).toBe(true);
    expect(VANILLA_GAME_MODE_INDETERMINATE_PRINTOUT_LITERAL).toContain('indeterminate');
  });

  test('VANILLA_GAME_MODE_INDETERMINATE_ENUM_LITERAL preserves the typo "indetermined"', () => {
    expect(VANILLA_GAME_MODE_INDETERMINATE_ENUM_LITERAL).toBe('indetermined');
    expect(VANILLA_GAME_MODE_INDETERMINATE_ENUM_LITERAL).not.toBe('indeterminate');
  });

  test('VANILLA_UNRECOGNISED_IWAD_FILENAMES contains the Freedoom, HACX, and Chex Quest basenames', () => {
    expect(Object.isFrozen(VANILLA_UNRECOGNISED_IWAD_FILENAMES)).toBe(true);
    expect([...VANILLA_UNRECOGNISED_IWAD_FILENAMES]).toEqual(['freedoom1.wad', 'freedoom2.wad', 'freedm.wad', 'hacx.wad', 'chex.wad']);
  });

  test('the canonical seven-candidate set is disjoint from the unrecognised filename list', () => {
    const canonical = new Set(VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP.map((entry) => entry.candidateFilename));
    for (const unrecognised of VANILLA_UNRECOGNISED_IWAD_FILENAMES) {
      expect(canonical.has(unrecognised as VanillaGameModeDetectionResult['matchedFilename'] & string)).toBe(false);
    }
  });

  test('every gameMode value in the candidate map is present in VANILLA_GAME_MODE_ENUM_VALUES', () => {
    for (const candidateEntry of VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP) {
      expect(VANILLA_GAME_MODE_ENUM_VALUES).toContain(candidateEntry.gameMode);
    }
  });

  test('VANILLA_GAME_MODE_INDETERMINATE_ENUM_LITERAL is the fifth entry of VANILLA_GAME_MODE_ENUM_VALUES', () => {
    expect(VANILLA_GAME_MODE_ENUM_VALUES[4]).toBe(VANILLA_GAME_MODE_INDETERMINATE_ENUM_LITERAL);
  });

  test('exactly four candidate filenames map to commercial', () => {
    const commercial = VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP.filter((entry) => entry.gameMode === 'commercial');
    expect(commercial.length).toBe(4);
    expect(commercial.map((entry) => entry.candidateFilename)).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad']);
  });

  test('exactly one candidate filename maps to retail', () => {
    const retail = VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP.filter((entry) => entry.gameMode === 'retail');
    expect(retail.length).toBe(1);
    expect(retail[0]!.candidateFilename).toBe('doomu.wad');
  });

  test('exactly one candidate filename maps to registered', () => {
    const registered = VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP.filter((entry) => entry.gameMode === 'registered');
    expect(registered.length).toBe(1);
    expect(registered[0]!.candidateFilename).toBe('doom.wad');
  });

  test('exactly one candidate filename maps to shareware', () => {
    const shareware = VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP.filter((entry) => entry.gameMode === 'shareware');
    expect(shareware.length).toBe(1);
    expect(shareware[0]!.candidateFilename).toBe('doom1.wad');
  });
});

describe('VANILLA_GAME_MODE_DETECTION_DERIVED_INVARIANTS ledger shape', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = VANILLA_GAME_MODE_DETECTION_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the fifteen derived invariants the cross-check witnesses', () => {
    const ids = new Set(VANILLA_GAME_MODE_DETECTION_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'GAME_MODE_ENUM_HAS_EXACTLY_FIVE_LITERAL_VALUES',
        'GAME_MODE_ENUM_VALUES_INCLUDE_INDETERMINED_TYPO_LITERAL',
        'GAME_MODE_CANDIDATE_FILENAME_MAP_HAS_EXACTLY_SEVEN_ENTRIES',
        'GAME_MODE_CANDIDATE_FILENAME_MAP_PRESERVES_PROBE_ORDER',
        'GAME_MODE_COMMERCIAL_IS_MANY_TO_ONE_OVER_EXACTLY_FOUR_FILENAMES',
        'GAME_MODE_RETAIL_IS_ONE_TO_ONE_DOOMU_WAD',
        'GAME_MODE_REGISTERED_IS_ONE_TO_ONE_DOOM_WAD',
        'GAME_MODE_SHAREWARE_IS_ONE_TO_ONE_DOOM1_WAD',
        'GAME_MODE_FILENAME_DETERMINES_GAME_MODE_ALONE_NO_LUMP_INSPECTION',
        'GAME_MODE_FIRST_MATCH_BY_CANONICAL_ORDER_WINS',
        'GAME_MODE_NO_MATCH_RESOLVES_TO_INDETERMINED_NOT_ABORT',
        'GAME_MODE_NO_MATCH_PRINTS_BEFORE_ASSIGNING_INDETERMINED',
        'GAME_MODE_FREEDOOM_FILENAMES_RESOLVE_TO_INDETERMINED',
        'GAME_MODE_HACX_AND_CHEX_FILENAMES_RESOLVE_TO_INDETERMINED',
        'GAME_MODE_CANDIDATE_BRANCH_RESPECTS_PROBE_ORDER_AGAINST_MULTIPLE_PRESENT_FILES',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of VANILLA_GAME_MODE_DETECTION_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_GAME_MODE_DETECTION_PROBES ledger shape', () => {
  test('every probe id is unique', () => {
    const ids = VANILLA_GAME_MODE_DETECTION_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe witnesses an existing derived invariant', () => {
    const declaredIds = new Set(VANILLA_GAME_MODE_DETECTION_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    for (const probe of VANILLA_GAME_MODE_DETECTION_PROBES) {
      expect(declaredIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every probe carries a non-empty description', () => {
    for (const probe of VANILLA_GAME_MODE_DETECTION_PROBES) {
      expect(probe.description.length).toBeGreaterThan(0);
    }
  });

  test('every probe expectedProbeSequence ends at the matched candidate (or runs through all seven on no match)', () => {
    for (const probe of VANILLA_GAME_MODE_DETECTION_PROBES) {
      if (probe.expectedMatchedFilename === null) {
        expect(probe.expectedProbeSequence.length).toBe(7);
      } else {
        expect(probe.expectedProbeSequence[probe.expectedProbeSequence.length - 1]).toBe(probe.expectedMatchedFilename);
      }
    }
  });

  test('every probe expectedProbeSequence is a prefix of the canonical seven-candidate order', () => {
    const canonicalOrder = ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad'] as const;
    for (const probe of VANILLA_GAME_MODE_DETECTION_PROBES) {
      for (let index = 0; index < probe.expectedProbeSequence.length; index++) {
        expect(probe.expectedProbeSequence[index]).toBe(canonicalOrder[index]!);
      }
    }
  });

  test('every probe expectedIndeterminatePrintoutFired is false on candidate match and true on no match', () => {
    for (const probe of VANILLA_GAME_MODE_DETECTION_PROBES) {
      if (probe.expectedMatchedFilename === null) {
        expect(probe.expectedIndeterminatePrintoutFired).toBe(true);
      } else {
        expect(probe.expectedIndeterminatePrintoutFired).toBe(false);
      }
    }
  });

  test('every probe expectedGameMode is consistent with the matched candidate (or indetermined on null)', () => {
    const expectedGameModeByFilename = {
      'doom2f.wad': 'commercial',
      'doom2.wad': 'commercial',
      'plutonia.wad': 'commercial',
      'tnt.wad': 'commercial',
      'doomu.wad': 'retail',
      'doom.wad': 'registered',
      'doom1.wad': 'shareware',
    } as const;
    for (const probe of VANILLA_GAME_MODE_DETECTION_PROBES) {
      if (probe.expectedMatchedFilename === null) {
        expect(probe.expectedGameMode).toBe('indetermined');
      } else {
        expect(probe.expectedGameMode).toBe(expectedGameModeByFilename[probe.expectedMatchedFilename]);
      }
    }
  });

  test('every probe expectation is consistent with deriveExpectedVanillaGameModeDetectionResult', () => {
    for (const probe of VANILLA_GAME_MODE_DETECTION_PROBES) {
      const derived = deriveExpectedVanillaGameModeDetectionResult(probe.presentCandidateFilenames);
      expect(derived.matchedFilename).toBe(probe.expectedMatchedFilename);
      expect(derived.gameMode).toBe(probe.expectedGameMode);
      expect(derived.indeterminatePrintoutFired).toBe(probe.expectedIndeterminatePrintoutFired);
      expect([...derived.probedSequence]).toEqual([...probe.expectedProbeSequence]);
    }
  });
});

describe('crossCheckVanillaGameModeDetection against REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER', () => {
  test('reports zero failures for the canonical reference handler', () => {
    expect(crossCheckVanillaGameModeDetection(REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER)).toEqual([]);
  });

  test('the reference handler resolves doom2f.wad to commercial', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'doom2f-wad-pins-commercial');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doom2f.wad');
    expect(result.gameMode).toBe('commercial');
    expect(result.indeterminatePrintoutFired).toBe(false);
    expect([...result.probedSequence]).toEqual(['doom2f.wad']);
  });

  test('the reference handler resolves doom2.wad to commercial', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'doom2-wad-pins-commercial');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doom2.wad');
    expect(result.gameMode).toBe('commercial');
    expect([...result.probedSequence]).toEqual(['doom2f.wad', 'doom2.wad']);
  });

  test('the reference handler resolves plutonia.wad to commercial', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'plutonia-wad-pins-commercial');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('plutonia.wad');
    expect(result.gameMode).toBe('commercial');
    expect([...result.probedSequence]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad']);
  });

  test('the reference handler resolves tnt.wad to commercial', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'tnt-wad-pins-commercial');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('tnt.wad');
    expect(result.gameMode).toBe('commercial');
    expect([...result.probedSequence]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad']);
  });

  test('the reference handler resolves doomu.wad to retail', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'doomu-wad-pins-retail');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doomu.wad');
    expect(result.gameMode).toBe('retail');
    expect([...result.probedSequence]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad']);
  });

  test('the reference handler resolves doom.wad to registered', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'doom-wad-pins-registered');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doom.wad');
    expect(result.gameMode).toBe('registered');
    expect([...result.probedSequence]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad']);
  });

  test('the reference handler resolves doom1.wad to shareware after walking all six higher-priority probes', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'doom1-wad-pins-shareware');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doom1.wad');
    expect(result.gameMode).toBe('shareware');
    expect(result.probedSequence.length).toBe(7);
  });

  test('the reference handler resolves an empty search directory to indetermined and fires the printout', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'empty-search-directory-resolves-to-indetermined');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.indeterminatePrintoutFired).toBe(true);
    expect(result.probedSequence.length).toBe(7);
  });

  test('the reference handler picks doomu.wad first when both doomu.wad and doom.wad are present', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'doomu-and-doom-both-present-resolves-to-retail-by-probe-order');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doomu.wad');
    expect(result.gameMode).toBe('retail');
  });

  test('the reference handler picks doom.wad first when both doom.wad and doom1.wad are present', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'doom-and-doom1-both-present-resolves-to-registered-by-probe-order');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doom.wad');
    expect(result.gameMode).toBe('registered');
  });

  test('the reference handler ignores Freedoom IWADs and resolves to indetermined', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'freedoom-only-resolves-to-indetermined');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.indeterminatePrintoutFired).toBe(true);
  });

  test('the reference handler ignores HACX and Chex Quest and resolves to indetermined', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'hacx-and-chex-resolve-to-indetermined');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
  });

  test('the reference handler still pins shareware when both doom1.wad and freedoom1.wad are present', () => {
    const probe = VANILLA_GAME_MODE_DETECTION_PROBES.find((entry) => entry.id === 'doom1-with-freedoom-noise-still-resolves-to-shareware');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doom1.wad');
    expect(result.gameMode).toBe('shareware');
  });
});

describe('crossCheckVanillaGameModeDetection failure modes', () => {
  test('detects a handler that swaps the gameMode for a matched candidate', () => {
    const wrongGameMode: VanillaGameModeDetectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe);
        if (inner.gameMode !== 'commercial') {
          return inner;
        }
        return Object.freeze({
          matchedFilename: inner.matchedFilename,
          gameMode: 'retail' as const,
          indeterminatePrintoutFired: inner.indeterminatePrintoutFired,
          probedSequence: inner.probedSequence,
        }) satisfies VanillaGameModeDetectionResult;
      },
    };
    const failures = crossCheckVanillaGameModeDetection(wrongGameMode);
    expect(failures.some((failure) => failure.startsWith('probe:doom2f-wad-pins-commercial:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:doom2-wad-pins-commercial:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:plutonia-wad-pins-commercial:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:tnt-wad-pins-commercial:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that maps doomu.wad to registered instead of retail', () => {
    const swapsRetailForRegistered: VanillaGameModeDetectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe);
        if (inner.matchedFilename !== 'doomu.wad') {
          return inner;
        }
        return Object.freeze({
          matchedFilename: inner.matchedFilename,
          gameMode: 'registered' as const,
          indeterminatePrintoutFired: inner.indeterminatePrintoutFired,
          probedSequence: inner.probedSequence,
        }) satisfies VanillaGameModeDetectionResult;
      },
    };
    const failures = crossCheckVanillaGameModeDetection(swapsRetailForRegistered);
    expect(failures.some((failure) => failure.startsWith('probe:doomu-wad-pins-retail:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:doomu-and-doom-both-present-resolves-to-retail-by-probe-order:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that fails to fire the indeterminate printout on no-match', () => {
    const printoutAlwaysFalse: VanillaGameModeDetectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe);
        return Object.freeze({
          matchedFilename: inner.matchedFilename,
          gameMode: inner.gameMode,
          indeterminatePrintoutFired: false,
          probedSequence: inner.probedSequence,
        }) satisfies VanillaGameModeDetectionResult;
      },
    };
    const failures = crossCheckVanillaGameModeDetection(printoutAlwaysFalse);
    expect(failures.some((failure) => failure.startsWith('probe:empty-search-directory-resolves-to-indetermined:indeterminatePrintoutFired:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:freedoom-only-resolves-to-indetermined:indeterminatePrintoutFired:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:hacx-and-chex-resolve-to-indetermined:indeterminatePrintoutFired:value-mismatch'))).toBe(true);
  });

  test('detects a handler that aborts on no-match instead of returning indetermined', () => {
    const abortsOnNoMatch: VanillaGameModeDetectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe);
        if (inner.matchedFilename !== null) {
          return inner;
        }
        return Object.freeze({
          matchedFilename: null,
          gameMode: 'shareware' as const,
          indeterminatePrintoutFired: true,
          probedSequence: inner.probedSequence,
        }) satisfies VanillaGameModeDetectionResult;
      },
    };
    const failures = crossCheckVanillaGameModeDetection(abortsOnNoMatch);
    expect(failures.some((failure) => failure.startsWith('probe:empty-search-directory-resolves-to-indetermined:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that recognises Freedoom and pins it as commercial', () => {
    const recognisesFreedoom: VanillaGameModeDetectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe);
        if (inner.matchedFilename !== null) {
          return inner;
        }
        const presentSet = new Set(probe.presentCandidateFilenames);
        if (presentSet.has('freedoom2.wad')) {
          return Object.freeze({
            matchedFilename: 'doom2.wad' as const,
            gameMode: 'commercial' as const,
            indeterminatePrintoutFired: false,
            probedSequence: Object.freeze(['doom2f.wad', 'doom2.wad'] as const),
          }) satisfies VanillaGameModeDetectionResult;
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaGameModeDetection(recognisesFreedoom);
    expect(failures.some((failure) => failure.startsWith('probe:freedoom-only-resolves-to-indetermined:matchedFilename:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:freedoom-only-resolves-to-indetermined:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that picks the highest-rank gamemode instead of the first canonical match', () => {
    const highestRankWins: VanillaGameModeDetectionHandler = {
      runProbe: (probe) => {
        const probed: VanillaGameModeDetectionResult['probedSequence'][number][] = [];
        const presentSet = new Set(probe.presentCandidateFilenames);
        const reverseOrder: { name: VanillaGameModeDetectionResult['matchedFilename'] & string; gameMode: 'commercial' | 'retail' | 'registered' | 'shareware' }[] = [
          { name: 'doom1.wad', gameMode: 'shareware' },
          { name: 'doom.wad', gameMode: 'registered' },
          { name: 'doomu.wad', gameMode: 'retail' },
          { name: 'tnt.wad', gameMode: 'commercial' },
          { name: 'plutonia.wad', gameMode: 'commercial' },
          { name: 'doom2.wad', gameMode: 'commercial' },
          { name: 'doom2f.wad', gameMode: 'commercial' },
        ];
        for (const candidate of reverseOrder) {
          probed.push(candidate.name);
          if (presentSet.has(candidate.name)) {
            return Object.freeze({
              matchedFilename: candidate.name,
              gameMode: candidate.gameMode,
              indeterminatePrintoutFired: false,
              probedSequence: Object.freeze([...probed]),
            }) satisfies VanillaGameModeDetectionResult;
          }
        }
        return Object.freeze({
          matchedFilename: null,
          gameMode: 'indetermined' as const,
          indeterminatePrintoutFired: true,
          probedSequence: Object.freeze([...probed]),
        }) satisfies VanillaGameModeDetectionResult;
      },
    };
    const failures = crossCheckVanillaGameModeDetection(highestRankWins);
    expect(failures.some((failure) => failure.startsWith('probe:doomu-and-doom-both-present-resolves-to-retail-by-probe-order:matchedFilename:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:doomu-and-doom-both-present-resolves-to-retail-by-probe-order:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:doomu-and-doom-both-present-resolves-to-retail-by-probe-order:probedSequence:length-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:doom-and-doom1-both-present-resolves-to-registered-by-probe-order:matchedFilename:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:doom-and-doom1-both-present-resolves-to-registered-by-probe-order:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that runs only one probe and short-circuits the rest', () => {
    const onlyChecksDoom1: VanillaGameModeDetectionHandler = {
      runProbe: () => {
        return Object.freeze({
          matchedFilename: null,
          gameMode: 'indetermined' as const,
          indeterminatePrintoutFired: true,
          probedSequence: Object.freeze(['doom2f.wad'] as const),
        }) satisfies VanillaGameModeDetectionResult;
      },
    };
    const failures = crossCheckVanillaGameModeDetection(onlyChecksDoom1);
    expect(failures.some((failure) => failure.startsWith('probe:doom2f-wad-pins-commercial:matchedFilename:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:empty-search-directory-resolves-to-indetermined:probedSequence:length-mismatch'))).toBe(true);
  });

  test('detects a handler that reorders the probe sequence', () => {
    const reorderedProbes: VanillaGameModeDetectionHandler = {
      runProbe: (probe: VanillaGameModeDetectionProbe) => {
        const inner = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe);
        if (inner.probedSequence.length < 2) {
          return inner;
        }
        const reordered = [...inner.probedSequence];
        const swap = reordered[0]!;
        reordered[0] = reordered[1]!;
        reordered[1] = swap;
        return Object.freeze({
          matchedFilename: inner.matchedFilename,
          gameMode: inner.gameMode,
          indeterminatePrintoutFired: inner.indeterminatePrintoutFired,
          probedSequence: Object.freeze(reordered),
        }) satisfies VanillaGameModeDetectionResult;
      },
    };
    const failures = crossCheckVanillaGameModeDetection(reorderedProbes);
    expect(failures.some((failure) => failure.startsWith('probe:empty-search-directory-resolves-to-indetermined:probedSequence:order-mismatch'))).toBe(true);
  });

  test('detects a handler that maps doom2.wad to retail (parity violation against the commercial pin)', () => {
    const mismaps: VanillaGameModeDetectionHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe);
        if (inner.matchedFilename !== 'doom2.wad') {
          return inner;
        }
        return Object.freeze({
          matchedFilename: inner.matchedFilename,
          gameMode: 'retail' as const,
          indeterminatePrintoutFired: inner.indeterminatePrintoutFired,
          probedSequence: inner.probedSequence,
        }) satisfies VanillaGameModeDetectionResult;
      },
    };
    const failures = crossCheckVanillaGameModeDetection(mismaps);
    expect(failures.some((failure) => failure.startsWith('probe:doom2-wad-pins-commercial:gameMode:value-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedVanillaGameModeDetectionResult helper', () => {
  test('returns matchedFilename=null and gameMode=indetermined for an empty filesystem', () => {
    const result = deriveExpectedVanillaGameModeDetectionResult([]);
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.indeterminatePrintoutFired).toBe(true);
    expect(result.probedSequence.length).toBe(7);
  });

  test('returns doom1.wad/shareware for a search directory containing only doom1.wad', () => {
    const result = deriveExpectedVanillaGameModeDetectionResult(['doom1.wad']);
    expect(result.matchedFilename).toBe('doom1.wad');
    expect(result.gameMode).toBe('shareware');
    expect(result.indeterminatePrintoutFired).toBe(false);
  });

  test('returns doom2f.wad/commercial for a search directory containing all four commercial filenames', () => {
    const result = deriveExpectedVanillaGameModeDetectionResult(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad']);
    expect(result.matchedFilename).toBe('doom2f.wad');
    expect(result.gameMode).toBe('commercial');
    expect([...result.probedSequence]).toEqual(['doom2f.wad']);
  });

  test('walks all seven probes for a no-match filesystem', () => {
    const result = deriveExpectedVanillaGameModeDetectionResult(['random.wad', 'unknown.wad']);
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect([...result.probedSequence]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);
  });

  test('does not match an uppercase variant of a canonical filename (vanilla literals are lowercase)', () => {
    const result = deriveExpectedVanillaGameModeDetectionResult(['DOOM1.WAD']);
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
  });

  test('returns indetermined when only Freedoom files are present', () => {
    const result = deriveExpectedVanillaGameModeDetectionResult(['freedoom1.wad', 'freedoom2.wad', 'freedm.wad']);
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
  });
});

describe('vanilla DOOM 1.9 game-mode detection acts as a filename-only canonical scan', () => {
  test('every canonical candidate filename pins the gameMode the audit ledger declares', () => {
    for (const candidateEntry of VANILLA_CANDIDATE_FILENAME_TO_GAME_MODE_MAP) {
      const result = deriveExpectedVanillaGameModeDetectionResult([candidateEntry.candidateFilename]);
      expect(result.matchedFilename).toBe(candidateEntry.candidateFilename);
      expect(result.gameMode).toBe(candidateEntry.gameMode);
    }
  });

  test('removing every canonical filename from a previously matching directory drops back to indetermined', () => {
    const matched = deriveExpectedVanillaGameModeDetectionResult(['doom.wad']);
    const withoutFile = deriveExpectedVanillaGameModeDetectionResult([]);
    expect(matched.matchedFilename).toBe('doom.wad');
    expect(withoutFile.matchedFilename).toBeNull();
    expect(withoutFile.gameMode).toBe('indetermined');
  });

  test('combining canonical and unrecognised filenames still pins the canonical match and ignores the noise', () => {
    const result = deriveExpectedVanillaGameModeDetectionResult(['doomu.wad', 'freedoom1.wad', 'hacx.wad', 'chex.wad']);
    expect(result.matchedFilename).toBe('doomu.wad');
    expect(result.gameMode).toBe('retail');
  });

  test('the indeterminate printout always fires together with a null match (the printout flag is the on-no-match indicator)', () => {
    for (const probe of VANILLA_GAME_MODE_DETECTION_PROBES) {
      const result = REFERENCE_VANILLA_GAME_MODE_DETECTION_HANDLER.runProbe(probe);
      if (result.matchedFilename === null) {
        expect(result.indeterminatePrintoutFired).toBe(true);
      } else {
        expect(result.indeterminatePrintoutFired).toBe(false);
      }
    }
  });
});

describe('implement-doom-game-mode-detection step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-doom-game-mode-detection.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-doom-game-mode-detection.test.ts');
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
