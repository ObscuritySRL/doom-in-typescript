import { describe, expect, test } from 'bun:test';

import {
  REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER,
  VANILLA_SHAREWARE_IWAD_DEFAULT_FULL_PATH,
  VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT,
  VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_DERIVED_INVARIANTS,
  VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES,
  VANILLA_SHAREWARE_IWAD_DEFAULT_SEARCH_DIRECTORY,
  VANILLA_SHAREWARE_IWAD_GAME_MODE,
  VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES,
  VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_COUNT,
  VANILLA_SHAREWARE_IWAD_LOCAL_DROP_DIRECTORIES,
  VANILLA_SHAREWARE_IWAD_LOCAL_DROP_PATHS,
  VANILLA_SHAREWARE_IWAD_ON_DISK_BASENAME,
  VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR,
  VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME,
  crossCheckVanillaShareWareIwadDefaultPath,
  deriveExpectedShareWareIwadDefaultPathResult,
} from '../../../src/bootstrap/implement-local-shareware-iwad-default-path.ts';
import type { VanillaShareWareIwadDefaultPathHandler, VanillaShareWareIwadDefaultPathProbe, VanillaShareWareIwadDefaultPathResult } from '../../../src/bootstrap/implement-local-shareware-iwad-default-path.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-005-implement-local-shareware-iwad-default-path.md';

describe('VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly seven contract clauses for the shareware default-path branch', () => {
    expect(VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.length).toBe(7);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references d_main.c and pins the IdentifyVersion symbol', () => {
    for (const entry of VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT) {
      expect(entry.referenceSourceFile).toBe('d_main.c');
      expect(entry.cSymbol).toBe('IdentifyVersion');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the seven contract ids the cross-check enforces', () => {
    const ids = new Set(VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(
      new Set([
        'SHAREWARE_BASENAME_IS_LOWERCASE_DOOM1_WAD_LITERAL',
        'SHAREWARE_PATH_FORMAT_IS_DOOMWADDIR_PREFIXED_BASENAME',
        'SHAREWARE_DEFAULT_DIRECTORY_FALLS_BACK_TO_CURRENT_WORKING_DIRECTORY',
        'SHAREWARE_GAMEMODE_IS_LITERAL_SHAREWARE_ENUM',
        'SHAREWARE_PROBE_RUNS_LAST_AFTER_SIX_HIGHER_PRIORITY_CANDIDATES',
        'SHAREWARE_MISS_FALLS_THROUGH_TO_INDETERMINATE_PRINTOUT',
        'SHAREWARE_BASENAME_RESOLVES_CASE_INSENSITIVELY_ON_WINDOWS_ONLY',
      ]),
    );
  });

  test('the SHAREWARE_BASENAME_IS_LOWERCASE_DOOM1_WAD_LITERAL clause cites the verbatim sprintf format string', () => {
    const entry = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.find((clause) => clause.id === 'SHAREWARE_BASENAME_IS_LOWERCASE_DOOM1_WAD_LITERAL');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('"%s/doom1.wad"');
    expect(entry!.invariant).toContain('lowercase');
    expect(entry!.invariant).toContain('.wad');
  });

  test('the SHAREWARE_PATH_FORMAT_IS_DOOMWADDIR_PREFIXED_BASENAME clause cites the forward-slash separator', () => {
    const entry = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.find((clause) => clause.id === 'SHAREWARE_PATH_FORMAT_IS_DOOMWADDIR_PREFIXED_BASENAME');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('<doomwaddir>/doom1.wad');
    expect(entry!.invariant).toContain('forward-slash');
    expect(entry!.invariant).toContain('D_AddFile');
  });

  test('the SHAREWARE_DEFAULT_DIRECTORY clause cites the DOOMWADDIR fallback rule literally', () => {
    const entry = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.find((clause) => clause.id === 'SHAREWARE_DEFAULT_DIRECTORY_FALLS_BACK_TO_CURRENT_WORKING_DIRECTORY');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('getenv("DOOMWADDIR")');
    expect(entry!.invariant).toContain('"."');
    expect(entry!.invariant).toContain('./doom1.wad');
  });

  test('the SHAREWARE_GAMEMODE clause cites the literal enum assignment', () => {
    const entry = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.find((clause) => clause.id === 'SHAREWARE_GAMEMODE_IS_LITERAL_SHAREWARE_ENUM');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('gamemode = shareware;');
    expect(entry!.invariant).toContain('D_AddFile');
  });

  test('the SHAREWARE_PROBE_RUNS_LAST clause names every higher-priority candidate in canonical order', () => {
    const entry = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.find((clause) => clause.id === 'SHAREWARE_PROBE_RUNS_LAST_AFTER_SIX_HIGHER_PRIORITY_CANDIDATES');
    expect(entry).toBeDefined();
    const orderedFilenames = ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad'];
    let cursor = 0;
    for (const filename of orderedFilenames) {
      const offset = entry!.invariant.indexOf(filename, cursor);
      expect(offset).toBeGreaterThanOrEqual(cursor);
      cursor = offset + filename.length;
    }
  });

  test('the SHAREWARE_MISS clause cites the Game mode indeterminate fallback and notes the Chocolate Doom 2.2.1 divergence', () => {
    const entry = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.find((clause) => clause.id === 'SHAREWARE_MISS_FALLS_THROUGH_TO_INDETERMINATE_PRINTOUT');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('Game mode indeterminate');
    expect(entry!.invariant).toContain('indetermined');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the SHAREWARE_BASENAME_RESOLVES_CASE_INSENSITIVELY_ON_WINDOWS_ONLY clause cites both casings and the Windows-only host constraint', () => {
    const entry = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_CONTRACT_AUDIT.find((clause) => clause.id === 'SHAREWARE_BASENAME_RESOLVES_CASE_INSENSITIVELY_ON_WINDOWS_ONLY');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('doom1.wad');
    expect(entry!.invariant).toContain('DOOM1.WAD');
    expect(entry!.invariant).toContain('CLAUDE.md');
    expect(entry!.invariant).toContain('Windows');
  });
});

describe('vanilla shareware default-path constants', () => {
  test('VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME equals the literal lowercase "doom1.wad"', () => {
    expect(VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME).toBe('doom1.wad');
  });

  test('VANILLA_SHAREWARE_IWAD_ON_DISK_BASENAME equals the canonical id Software uppercase "DOOM1.WAD"', () => {
    expect(VANILLA_SHAREWARE_IWAD_ON_DISK_BASENAME).toBe('DOOM1.WAD');
  });

  test('the on-disk uppercase basename is the case-insensitive equal of the lowercase vanilla probe', () => {
    expect(VANILLA_SHAREWARE_IWAD_ON_DISK_BASENAME.toLowerCase()).toBe(VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME);
    expect(VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME.toUpperCase()).toBe(VANILLA_SHAREWARE_IWAD_ON_DISK_BASENAME);
  });

  test('VANILLA_SHAREWARE_IWAD_DEFAULT_SEARCH_DIRECTORY equals the literal "."', () => {
    expect(VANILLA_SHAREWARE_IWAD_DEFAULT_SEARCH_DIRECTORY).toBe('.');
  });

  test('VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR equals the literal "/"', () => {
    expect(VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR).toBe('/');
  });

  test('VANILLA_SHAREWARE_IWAD_GAME_MODE equals the literal "shareware"', () => {
    expect(VANILLA_SHAREWARE_IWAD_GAME_MODE).toBe('shareware');
  });

  test('VANILLA_SHAREWARE_IWAD_DEFAULT_FULL_PATH equals "./doom1.wad"', () => {
    expect(VANILLA_SHAREWARE_IWAD_DEFAULT_FULL_PATH).toBe('./doom1.wad');
  });

  test('VANILLA_SHAREWARE_IWAD_DEFAULT_FULL_PATH composes the search-directory prefix, the separator, and the lowercase probe basename in order', () => {
    expect(VANILLA_SHAREWARE_IWAD_DEFAULT_FULL_PATH).toBe(`${VANILLA_SHAREWARE_IWAD_DEFAULT_SEARCH_DIRECTORY}${VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR}${VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME}`);
  });
});

describe('VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_* constants', () => {
  test('VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_COUNT equals 6', () => {
    expect(VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_COUNT).toBe(6);
  });

  test('VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES has the six higher-priority basenames in canonical probe order', () => {
    expect([...VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad']);
  });

  test('the higher-priority basename list length agrees with the count constant', () => {
    expect(VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES.length).toBe(VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_COUNT);
  });

  test('the shareware basename does not appear in the higher-priority list', () => {
    expect(VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES.includes(VANILLA_SHAREWARE_IWAD_VANILLA_PROBE_BASENAME)).toBe(false);
  });

  test('the higher-priority basename list is frozen and resists mutation', () => {
    expect(Object.isFrozen(VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES)).toBe(true);
  });
});

describe('VANILLA_SHAREWARE_IWAD_LOCAL_DROP_* constants', () => {
  test('VANILLA_SHAREWARE_IWAD_LOCAL_DROP_DIRECTORIES equals the two gitignored "doom" and "iwad" entries in stable order', () => {
    expect([...VANILLA_SHAREWARE_IWAD_LOCAL_DROP_DIRECTORIES]).toEqual(['doom', 'iwad']);
  });

  test('VANILLA_SHAREWARE_IWAD_LOCAL_DROP_PATHS uses the on-disk uppercase basename joined by the forward-slash separator', () => {
    expect([...VANILLA_SHAREWARE_IWAD_LOCAL_DROP_PATHS]).toEqual(['doom/DOOM1.WAD', 'iwad/DOOM1.WAD']);
  });

  test('every drop path ends with the on-disk uppercase basename', () => {
    for (const path of VANILLA_SHAREWARE_IWAD_LOCAL_DROP_PATHS) {
      expect(path.endsWith(`${VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR}${VANILLA_SHAREWARE_IWAD_ON_DISK_BASENAME}`)).toBe(true);
    }
  });

  test('every drop path is the join of one drop directory, the path separator, and the on-disk basename', () => {
    expect(VANILLA_SHAREWARE_IWAD_LOCAL_DROP_PATHS.length).toBe(VANILLA_SHAREWARE_IWAD_LOCAL_DROP_DIRECTORIES.length);
    for (let index = 0; index < VANILLA_SHAREWARE_IWAD_LOCAL_DROP_PATHS.length; index++) {
      const directory = VANILLA_SHAREWARE_IWAD_LOCAL_DROP_DIRECTORIES[index]!;
      expect(VANILLA_SHAREWARE_IWAD_LOCAL_DROP_PATHS[index]).toBe(`${directory}${VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR}${VANILLA_SHAREWARE_IWAD_ON_DISK_BASENAME}`);
    }
  });

  test('the drop directories and drop paths lists are frozen and resist mutation', () => {
    expect(Object.isFrozen(VANILLA_SHAREWARE_IWAD_LOCAL_DROP_DIRECTORIES)).toBe(true);
    expect(Object.isFrozen(VANILLA_SHAREWARE_IWAD_LOCAL_DROP_PATHS)).toBe(true);
  });
});

describe('VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_DERIVED_INVARIANTS ledger shape', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the nine derived invariants the cross-check witnesses', () => {
    const ids = new Set(VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'VANILLA_PROBE_BASENAME_IS_LOWERCASE_DOOM1_WAD',
        'ON_DISK_BASENAME_IS_UPPERCASE_DOOM1_WAD',
        'DEFAULT_PATH_FALLS_BACK_TO_DOT_PREFIX_WHEN_DOOMWADDIR_UNSET',
        'DEFAULT_PATH_USES_FORWARD_SLASH_SEPARATOR',
        'GAME_MODE_PINNED_BY_BASENAME_MATCH_IS_SHAREWARE',
        'PROBE_ORDER_PUTS_SHAREWARE_LAST_AMONG_SEVEN_CANDIDATES',
        'CASE_INSENSITIVE_HOST_RESOLVES_UPPERCASE_DISK_FILENAME_AGAINST_LOWERCASE_PROBE',
        'LOCAL_DROP_DIRECTORIES_ARE_DOOM_AND_IWAD',
        'LOCAL_DROP_PATHS_USE_ON_DISK_BASENAME_CASING',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES ledger shape', () => {
  test('every probe id is unique', () => {
    const ids = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe witnesses an existing derived invariant', () => {
    const declaredIds = new Set(VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    for (const probe of VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES) {
      expect(declaredIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every probe carries a non-empty description', () => {
    for (const probe of VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES) {
      expect(probe.description.length).toBeGreaterThan(0);
    }
  });

  test('every probe expectedProbedBasenameSequence ends at the matched candidate (or runs through all seven on no match)', () => {
    for (const probe of VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES) {
      if (probe.expectedMatchedFullPath === null) {
        expect(probe.expectedProbedBasenameSequence.length).toBe(7);
      } else {
        const lastProbedBasename = probe.expectedProbedBasenameSequence[probe.expectedProbedBasenameSequence.length - 1];
        expect(probe.expectedMatchedFullPath.endsWith(`${VANILLA_SHAREWARE_IWAD_PATH_SEPARATOR}${lastProbedBasename}`)).toBe(true);
      }
    }
  });

  test('every probe expectedProbedBasenameSequence is a prefix of the canonical seven-candidate order', () => {
    const canonicalOrder = ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad'];
    for (const probe of VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES) {
      for (let index = 0; index < probe.expectedProbedBasenameSequence.length; index++) {
        expect(probe.expectedProbedBasenameSequence[index]).toBe(canonicalOrder[index]!);
      }
    }
  });

  test('every probe expectedGameMode is shareware on shareware match, registered on doom.wad match, or indetermined on null', () => {
    for (const probe of VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES) {
      if (probe.expectedMatchedFullPath === null) {
        expect(probe.expectedGameMode).toBe('indetermined');
      } else if (probe.expectedMatchedFullPath.endsWith('/doom1.wad')) {
        expect(probe.expectedGameMode).toBe('shareware');
      } else if (probe.expectedMatchedFullPath.endsWith('/doom.wad')) {
        expect(probe.expectedGameMode).toBe('registered');
      }
    }
  });

  test('every probe expectation is consistent with deriveExpectedShareWareIwadDefaultPathResult', () => {
    for (const probe of VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES) {
      const derived = deriveExpectedShareWareIwadDefaultPathResult(probe.filesystemState);
      expect(derived.matchedFullPath).toBe(probe.expectedMatchedFullPath);
      expect(derived.gameMode).toBe(probe.expectedGameMode);
      expect([...derived.probedBasenameSequence]).toEqual([...probe.expectedProbedBasenameSequence]);
    }
  });
});

describe('crossCheckVanillaShareWareIwadDefaultPath against REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER', () => {
  test('reports zero failures for the canonical reference handler', () => {
    expect(crossCheckVanillaShareWareIwadDefaultPath(REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER)).toEqual([]);
  });

  test('the reference handler resolves the shareware default path to "./doom1.wad" when DOOMWADDIR is unset and lowercase doom1.wad is present', () => {
    const probe = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES.find((entry) => entry.id === 'shareware-default-path-when-doomwaddir-unset-and-lowercase-doom1-present');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe!);
    expect(result.matchedFullPath).toBe('./doom1.wad');
    expect(result.gameMode).toBe('shareware');
    expect([...result.probedBasenameSequence]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);
  });

  test('the reference handler resolves the shareware path through a DOOMWADDIR override', () => {
    const probe = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES.find((entry) => entry.id === 'shareware-resolves-against-doomwaddir-prefix');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe!);
    expect(result.matchedFullPath).toBe('/usr/local/share/games/doom/doom1.wad');
    expect(result.gameMode).toBe('shareware');
  });

  test('the reference handler matches the on-disk uppercase basename through a case-insensitive host', () => {
    const probe = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES.find((entry) => entry.id === 'case-insensitive-host-matches-uppercase-disk-against-lowercase-probe');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe!);
    expect(result.matchedFullPath).toBe('./doom1.wad');
    expect(result.gameMode).toBe('shareware');
  });

  test('the reference handler misses the on-disk uppercase basename on a case-sensitive host', () => {
    const probe = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES.find((entry) => entry.id === 'case-sensitive-host-misses-uppercase-disk-against-lowercase-probe');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe!);
    expect(result.matchedFullPath).toBeNull();
    expect(result.gameMode).toBe('indetermined');
  });

  test('the reference handler returns indetermined when neither shareware nor any higher-priority candidate is present', () => {
    const probe = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES.find((entry) => entry.id === 'no-shareware-and-no-higher-priority-leaves-game-mode-indetermined');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe!);
    expect(result.matchedFullPath).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.probedBasenameSequence.length).toBe(7);
  });

  test('the reference handler stops at doom.wad when both doom.wad and doom1.wad are present', () => {
    const probe = VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_PROBES.find((entry) => entry.id === 'higher-priority-doom-wad-takes-precedence-over-shareware');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe!);
    expect(result.matchedFullPath).toBe('./doom.wad');
    expect(result.gameMode).toBe('registered');
    expect(result.probedBasenameSequence[result.probedBasenameSequence.length - 1]).toBe('doom.wad');
  });
});

describe('crossCheckVanillaShareWareIwadDefaultPath failure modes', () => {
  test('detects a handler that uppercases the resolved shareware path', () => {
    const uppercaseRewriter: VanillaShareWareIwadDefaultPathHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe);
        if (inner.matchedFullPath === null) {
          return inner;
        }
        return Object.freeze({
          matchedFullPath: inner.matchedFullPath.toUpperCase(),
          gameMode: inner.gameMode,
          probedBasenameSequence: inner.probedBasenameSequence,
        }) satisfies VanillaShareWareIwadDefaultPathResult;
      },
    };
    const failures = crossCheckVanillaShareWareIwadDefaultPath(uppercaseRewriter);
    expect(failures.some((failure) => failure.startsWith('probe:shareware-default-path-when-doomwaddir-unset-and-lowercase-doom1-present:matchedFullPath:value-mismatch'))).toBe(true);
  });

  test('detects a handler that swaps the gameMode for a matched shareware filename to commercial', () => {
    const wrongGameMode: VanillaShareWareIwadDefaultPathHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe);
        if (inner.gameMode !== 'shareware') {
          return inner;
        }
        return Object.freeze({
          matchedFullPath: inner.matchedFullPath,
          gameMode: 'commercial' as const,
          probedBasenameSequence: inner.probedBasenameSequence,
        }) satisfies VanillaShareWareIwadDefaultPathResult;
      },
    };
    const failures = crossCheckVanillaShareWareIwadDefaultPath(wrongGameMode);
    expect(failures.some((failure) => failure.startsWith('probe:shareware-default-path-when-doomwaddir-unset-and-lowercase-doom1-present:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:shareware-resolves-against-doomwaddir-prefix:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that puts the shareware probe ahead of the registered probe', () => {
    const sharewareFirst: VanillaShareWareIwadDefaultPathHandler = {
      runProbe: (probe) => {
        const candidatesInWrongOrder = ['doom1.wad', 'doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad'];
        const probed: string[] = [];
        const present = new Set(probe.filesystemState.presentBasenames.map((basename) => (probe.filesystemState.hostFileSystemIsCaseInsensitive ? basename.toUpperCase() : basename)));
        const searchDirectory = probe.filesystemState.doomWadDirEnvironmentValue ?? '.';
        const gameModeByCandidate: Record<string, string> = {
          'doom2f.wad': 'commercial',
          'doom2.wad': 'commercial',
          'plutonia.wad': 'commercial',
          'tnt.wad': 'commercial',
          'doomu.wad': 'retail',
          'doom.wad': 'registered',
          'doom1.wad': 'shareware',
        };
        for (const candidate of candidatesInWrongOrder) {
          probed.push(candidate);
          const presentMatch = probe.filesystemState.hostFileSystemIsCaseInsensitive ? present.has(candidate.toUpperCase()) : present.has(candidate);
          if (presentMatch) {
            return Object.freeze({
              matchedFullPath: `${searchDirectory}/${candidate}`,
              gameMode: gameModeByCandidate[candidate]! as VanillaShareWareIwadDefaultPathResult['gameMode'],
              probedBasenameSequence: Object.freeze([...probed]),
            }) satisfies VanillaShareWareIwadDefaultPathResult;
          }
        }
        return Object.freeze({
          matchedFullPath: null,
          gameMode: 'indetermined' as const,
          probedBasenameSequence: Object.freeze([...probed]),
        }) satisfies VanillaShareWareIwadDefaultPathResult;
      },
    };
    const failures = crossCheckVanillaShareWareIwadDefaultPath(sharewareFirst);
    expect(failures.some((failure) => failure.startsWith('probe:higher-priority-doom-wad-takes-precedence-over-shareware:matchedFullPath:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:higher-priority-doom-wad-takes-precedence-over-shareware:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that drops case-insensitive folding on Windows-style hosts', () => {
    const caseSensitiveAlways: VanillaShareWareIwadDefaultPathHandler = {
      runProbe: (probe) => {
        const flippedState = { ...probe.filesystemState, hostFileSystemIsCaseInsensitive: false };
        return REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe({ ...probe, filesystemState: flippedState });
      },
    };
    const failures = crossCheckVanillaShareWareIwadDefaultPath(caseSensitiveAlways);
    expect(failures.some((failure) => failure.startsWith('probe:case-insensitive-host-matches-uppercase-disk-against-lowercase-probe:matchedFullPath:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:case-insensitive-host-matches-uppercase-disk-against-lowercase-probe:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that substitutes the shareware default path even on no-match (legacy fallback)', () => {
    const sharewareDefaultOnMiss: VanillaShareWareIwadDefaultPathHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe);
        if (inner.matchedFullPath !== null) {
          return inner;
        }
        return Object.freeze({
          matchedFullPath: VANILLA_SHAREWARE_IWAD_DEFAULT_FULL_PATH,
          gameMode: 'shareware' as const,
          probedBasenameSequence: inner.probedBasenameSequence,
        }) satisfies VanillaShareWareIwadDefaultPathResult;
      },
    };
    const failures = crossCheckVanillaShareWareIwadDefaultPath(sharewareDefaultOnMiss);
    expect(failures.some((failure) => failure.startsWith('probe:no-shareware-and-no-higher-priority-leaves-game-mode-indetermined:matchedFullPath:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:no-shareware-and-no-higher-priority-leaves-game-mode-indetermined:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:case-sensitive-host-misses-uppercase-disk-against-lowercase-probe:matchedFullPath:value-mismatch'))).toBe(true);
  });

  test('detects a handler that swaps the forward-slash separator for a backslash', () => {
    const backslashRewriter: VanillaShareWareIwadDefaultPathHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe);
        if (inner.matchedFullPath === null) {
          return inner;
        }
        return Object.freeze({
          matchedFullPath: inner.matchedFullPath.replace(/\//g, '\\'),
          gameMode: inner.gameMode,
          probedBasenameSequence: inner.probedBasenameSequence,
        }) satisfies VanillaShareWareIwadDefaultPathResult;
      },
    };
    const failures = crossCheckVanillaShareWareIwadDefaultPath(backslashRewriter);
    expect(failures.some((failure) => failure.startsWith('probe:shareware-default-path-uses-forward-slash-separator:matchedFullPath:value-mismatch'))).toBe(true);
  });

  test('detects a handler that short-circuits the probe sequence after the first miss', () => {
    const shortCircuit: VanillaShareWareIwadDefaultPathHandler = {
      runProbe: (probe) => {
        const probed: string[] = ['doom2f.wad'];
        return Object.freeze({
          matchedFullPath: null,
          gameMode: 'indetermined' as const,
          probedBasenameSequence: Object.freeze(probed),
        }) satisfies VanillaShareWareIwadDefaultPathResult;
      },
    };
    const failures = crossCheckVanillaShareWareIwadDefaultPath(shortCircuit);
    expect(failures.some((failure) => failure.startsWith('probe:shareware-default-path-when-doomwaddir-unset-and-lowercase-doom1-present:probedBasenameSequence:length-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:no-shareware-and-no-higher-priority-leaves-game-mode-indetermined:probedBasenameSequence:length-mismatch'))).toBe(true);
  });

  test('detects a handler that reorders the probe sequence', () => {
    const reorderedProbes: VanillaShareWareIwadDefaultPathHandler = {
      runProbe: (probe: VanillaShareWareIwadDefaultPathProbe) => {
        const inner = REFERENCE_VANILLA_SHAREWARE_IWAD_DEFAULT_PATH_HANDLER.runProbe(probe);
        if (inner.probedBasenameSequence.length < 2) {
          return inner;
        }
        const reordered: string[] = [...inner.probedBasenameSequence];
        const swap = reordered[0]!;
        reordered[0] = reordered[1]!;
        reordered[1] = swap;
        return Object.freeze({ matchedFullPath: inner.matchedFullPath, gameMode: inner.gameMode, probedBasenameSequence: Object.freeze(reordered) }) satisfies VanillaShareWareIwadDefaultPathResult;
      },
    };
    const failures = crossCheckVanillaShareWareIwadDefaultPath(reorderedProbes);
    expect(failures.some((failure) => failure.startsWith('probe:no-shareware-and-no-higher-priority-leaves-game-mode-indetermined:probedBasenameSequence:order-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedShareWareIwadDefaultPathResult helper', () => {
  test('returns matchedFullPath=null and gameMode=indetermined for an empty filesystem on a Windows-style host', () => {
    const result = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: null, presentBasenames: [], hostFileSystemIsCaseInsensitive: true });
    expect(result.matchedFullPath).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.probedBasenameSequence.length).toBe(7);
  });

  test('returns "./doom1.wad" and gameMode=shareware for a shareware-only filesystem with DOOMWADDIR unset', () => {
    const result = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: null, presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true });
    expect(result.matchedFullPath).toBe('./doom1.wad');
    expect(result.gameMode).toBe('shareware');
    expect([...result.probedBasenameSequence]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);
  });

  test('returns "./doom1.wad" and gameMode=shareware when only the on-disk uppercase basename is present on a Windows-style host', () => {
    const result = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: null, presentBasenames: ['DOOM1.WAD'], hostFileSystemIsCaseInsensitive: true });
    expect(result.matchedFullPath).toBe('./doom1.wad');
    expect(result.gameMode).toBe('shareware');
  });

  test('returns null and gameMode=indetermined when only the on-disk uppercase basename is present on a POSIX-style host', () => {
    const result = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: null, presentBasenames: ['DOOM1.WAD'], hostFileSystemIsCaseInsensitive: false });
    expect(result.matchedFullPath).toBeNull();
    expect(result.gameMode).toBe('indetermined');
  });

  test('respects the DOOMWADDIR override and the forward-slash separator in the constructed path', () => {
    const result = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: '/iwad', presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true });
    expect(result.matchedFullPath).toBe('/iwad/doom1.wad');
    expect(result.gameMode).toBe('shareware');
  });
});

describe('vanilla DOOM 1.9 local shareware default-path behaves as a last-priority match', () => {
  test('when every higher-priority candidate is present, the shareware probe never fires', () => {
    const everyHigherPresent = [...VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES, 'doom1.wad'];
    const result = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: null, presentBasenames: everyHigherPresent, hostFileSystemIsCaseInsensitive: true });
    expect(result.matchedFullPath).toBe('./doom2f.wad');
    expect(result.gameMode).toBe('commercial');
    expect([...result.probedBasenameSequence]).toEqual(['doom2f.wad']);
  });

  test('removing higher-priority candidates one at a time eventually reaches the shareware probe', () => {
    let presentBasenames: string[] = [...VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES, 'doom1.wad'];
    for (const removal of VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_BASENAMES) {
      const result = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: null, presentBasenames, hostFileSystemIsCaseInsensitive: true });
      expect(result.matchedFullPath?.endsWith(`/${removal}`)).toBe(true);
      presentBasenames = presentBasenames.filter((basename) => basename !== removal);
    }
    const finalResult = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: null, presentBasenames, hostFileSystemIsCaseInsensitive: true });
    expect(finalResult.matchedFullPath).toBe('./doom1.wad');
    expect(finalResult.gameMode).toBe('shareware');
  });

  test('the DOOMWADDIR override does not change the candidate set, the order, or the gameMode pin for the shareware match', () => {
    const withOverride = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: '/usr/share/doom', presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true });
    const withoutOverride = deriveExpectedShareWareIwadDefaultPathResult({ doomWadDirEnvironmentValue: null, presentBasenames: ['doom1.wad'], hostFileSystemIsCaseInsensitive: true });
    expect(withOverride.gameMode).toBe(withoutOverride.gameMode);
    expect([...withOverride.probedBasenameSequence]).toEqual([...withoutOverride.probedBasenameSequence]);
    expect(withOverride.matchedFullPath).toBe('/usr/share/doom/doom1.wad');
    expect(withoutOverride.matchedFullPath).toBe('./doom1.wad');
  });
});

describe('implement-local-shareware-iwad-default-path step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-local-shareware-iwad-default-path.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-local-shareware-iwad-default-path.test.ts');
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
