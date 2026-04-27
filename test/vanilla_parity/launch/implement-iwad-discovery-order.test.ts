import { describe, expect, test } from 'bun:test';

import {
  REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER,
  VANILLA_DEFAULT_SEARCH_DIRECTORY,
  VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT,
  VANILLA_INDETERMINATE_MESSAGE,
  VANILLA_IWAD_CANDIDATES,
  VANILLA_IWAD_DISCOVERY_DERIVED_INVARIANTS,
  VANILLA_IWAD_DISCOVERY_PROBES,
  crossCheckVanillaIwadDiscovery,
  deriveExpectedDiscoveryResult,
} from '../../../src/bootstrap/implement-iwad-discovery-order.ts';
import type { VanillaIwadCandidate, VanillaIwadDiscoveryHandler, VanillaIwadDiscoveryProbe, VanillaIwadDiscoveryResult } from '../../../src/bootstrap/implement-iwad-discovery-order.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-004-implement-iwad-discovery-order.md';

describe('VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly seven contract clauses for IdentifyVersion', () => {
    expect(VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT.length).toBe(7);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references d_main.c and pins the IdentifyVersion symbol', () => {
    for (const entry of VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT) {
      expect(entry.referenceSourceFile).toBe('d_main.c');
      expect(entry.cSymbol).toBe('IdentifyVersion');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the seven contract ids the cross-check enforces', () => {
    const ids = new Set(VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(
      new Set([
        'SEARCH_DIRECTORY_IS_DOOMWADDIR_OR_CURRENT_WORKING_DIRECTORY',
        'CANDIDATE_FILENAME_LIST_IS_FIXED',
        'CANDIDATE_PROBE_ORDER_IS_FIXED',
        'FIRST_MATCH_WINS',
        'GAME_MODE_DERIVED_FROM_MATCHED_FILENAME',
        'NO_MATCH_LEAVES_GAME_MODE_INDETERMINATE',
        'CANDIDATE_FILENAMES_ARE_LOWERCASE_LITERALS',
      ]),
    );
  });

  test('the SEARCH_DIRECTORY clause cites the DOOMWADDIR fallback rule literally', () => {
    const entry = VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT.find((clause) => clause.id === 'SEARCH_DIRECTORY_IS_DOOMWADDIR_OR_CURRENT_WORKING_DIRECTORY');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('getenv("DOOMWADDIR")');
    expect(entry!.invariant).toContain('".";');
  });

  test('the CANDIDATE_FILENAME_LIST clause names every one of the seven canonical basenames', () => {
    const entry = VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT.find((clause) => clause.id === 'CANDIDATE_FILENAME_LIST_IS_FIXED');
    expect(entry).toBeDefined();
    for (const filename of ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']) {
      expect(entry!.invariant).toContain(filename);
    }
  });

  test('the CANDIDATE_PROBE_ORDER clause lists candidates in canonical vanilla order', () => {
    const entry = VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT.find((clause) => clause.id === 'CANDIDATE_PROBE_ORDER_IS_FIXED');
    expect(entry).toBeDefined();
    const orderedFilenames = ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad'];
    let cursor = 0;
    for (const filename of orderedFilenames) {
      const offset = entry!.invariant.indexOf(filename, cursor);
      expect(offset).toBeGreaterThanOrEqual(cursor);
      cursor = offset + filename.length;
    }
  });

  test('the FIRST_MATCH_WINS clause cites the early return inside the access block', () => {
    const entry = VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT.find((clause) => clause.id === 'FIRST_MATCH_WINS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('return;');
    expect(entry!.invariant).toContain('D_AddFile');
  });

  test('the GAME_MODE_DERIVED clause notes the divergence from Chocolate Doom 2.2.1', () => {
    const entry = VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT.find((clause) => clause.id === 'GAME_MODE_DERIVED_FROM_MATCHED_FILENAME');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the NO_MATCH clause cites the Game mode indeterminate fallback', () => {
    const entry = VANILLA_IDENTIFY_VERSION_CONTRACT_AUDIT.find((clause) => clause.id === 'NO_MATCH_LEAVES_GAME_MODE_INDETERMINATE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('Game mode indeterminate');
    expect(entry!.invariant).toContain('indetermined');
  });
});

describe('VANILLA_IWAD_CANDIDATES list shape', () => {
  test('has exactly seven entries in canonical probe order', () => {
    expect(VANILLA_IWAD_CANDIDATES.length).toBe(7);
    const filenames = VANILLA_IWAD_CANDIDATES.map((entry) => entry.filename);
    expect(filenames).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);
  });

  test('every filename is unique', () => {
    const filenames = VANILLA_IWAD_CANDIDATES.map((entry) => entry.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  test('every filename is lowercase ASCII', () => {
    for (const candidate of VANILLA_IWAD_CANDIDATES) {
      expect(candidate.filename === candidate.filename.toLowerCase()).toBe(true);
    }
  });

  test('every filename ends with the .wad extension', () => {
    for (const candidate of VANILLA_IWAD_CANDIDATES) {
      expect(candidate.filename.endsWith('.wad')).toBe(true);
    }
  });

  test('the four commercial-bucket candidates all map to gameMode commercial', () => {
    const commercialFilenames: VanillaIwadCandidate['filename'][] = ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad'];
    for (const filename of commercialFilenames) {
      const entry = VANILLA_IWAD_CANDIDATES.find((candidate) => candidate.filename === filename);
      expect(entry).toBeDefined();
      expect(entry!.gameMode).toBe('commercial');
    }
  });

  test('doomu.wad pins gameMode retail', () => {
    const entry = VANILLA_IWAD_CANDIDATES.find((candidate) => candidate.filename === 'doomu.wad');
    expect(entry).toBeDefined();
    expect(entry!.gameMode).toBe('retail');
  });

  test('doom.wad pins gameMode registered', () => {
    const entry = VANILLA_IWAD_CANDIDATES.find((candidate) => candidate.filename === 'doom.wad');
    expect(entry).toBeDefined();
    expect(entry!.gameMode).toBe('registered');
  });

  test('doom1.wad pins gameMode shareware', () => {
    const entry = VANILLA_IWAD_CANDIDATES.find((candidate) => candidate.filename === 'doom1.wad');
    expect(entry).toBeDefined();
    expect(entry!.gameMode).toBe('shareware');
  });

  test('the candidate list is frozen and resists mutation', () => {
    expect(Object.isFrozen(VANILLA_IWAD_CANDIDATES)).toBe(true);
    for (const candidate of VANILLA_IWAD_CANDIDATES) {
      expect(Object.isFrozen(candidate)).toBe(true);
    }
  });
});

describe('VANILLA_DEFAULT_SEARCH_DIRECTORY constant', () => {
  test('equals the literal current-working-directory string ".', () => {
    expect(VANILLA_DEFAULT_SEARCH_DIRECTORY).toBe('.');
  });
});

describe('VANILLA_INDETERMINATE_MESSAGE constant', () => {
  test('equals the verbatim printf format including the trailing newline', () => {
    expect(VANILLA_INDETERMINATE_MESSAGE).toBe('Game mode indeterminate.\n');
  });
});

describe('VANILLA_IWAD_DISCOVERY_DERIVED_INVARIANTS ledger shape', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = VANILLA_IWAD_DISCOVERY_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares the seven derived invariants the cross-check witnesses', () => {
    const ids = new Set(VANILLA_IWAD_DISCOVERY_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'CANDIDATE_LIST_HAS_EXACTLY_SEVEN_ENTRIES',
        'CANDIDATE_ORDER_IS_VERBATIM_VANILLA',
        'FIRST_MATCH_WINS_BY_PROBE_ORDER',
        'MATCHED_FILENAME_PINS_GAME_MODE',
        'NO_MATCH_RETURNS_INDETERMINATE_GAME_MODE',
        'DOOMWADDIR_OVERRIDES_CURRENT_DIRECTORY',
        'OUT_OF_LIST_CANDIDATE_IS_NEVER_MATCHED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of VANILLA_IWAD_DISCOVERY_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_IWAD_DISCOVERY_PROBES ledger shape', () => {
  test('every probe id is unique', () => {
    const ids = VANILLA_IWAD_DISCOVERY_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe witnesses an existing derived invariant', () => {
    const declaredIds = new Set(VANILLA_IWAD_DISCOVERY_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    for (const probe of VANILLA_IWAD_DISCOVERY_PROBES) {
      expect(declaredIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every derived invariant is witnessed by at least one probe', () => {
    const witnessedIds = new Set(VANILLA_IWAD_DISCOVERY_PROBES.map((probe) => probe.witnessInvariantId));
    const declaredIds = new Set(VANILLA_IWAD_DISCOVERY_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    for (const id of declaredIds) {
      expect(witnessedIds.has(id as VanillaIwadDiscoveryProbe['witnessInvariantId'])).toBe(true);
    }
  });

  test('every probe carries a non-empty description', () => {
    for (const probe of VANILLA_IWAD_DISCOVERY_PROBES) {
      expect(probe.description.length).toBeGreaterThan(0);
    }
  });

  test('every probe expectedProbeSequence ends at the matched candidate (or runs through all seven on no match)', () => {
    for (const probe of VANILLA_IWAD_DISCOVERY_PROBES) {
      if (probe.expectedMatchedFilename === null) {
        expect(probe.expectedProbeSequence.length).toBe(7);
      } else {
        const lastProbed = probe.expectedProbeSequence[probe.expectedProbeSequence.length - 1];
        expect(lastProbed).toBe(probe.expectedMatchedFilename);
      }
    }
  });

  test('every probe expectedProbeSequence is a prefix of the canonical seven-candidate order', () => {
    const canonicalOrder = VANILLA_IWAD_CANDIDATES.map((candidate) => candidate.filename);
    for (const probe of VANILLA_IWAD_DISCOVERY_PROBES) {
      for (let index = 0; index < probe.expectedProbeSequence.length; index++) {
        expect(probe.expectedProbeSequence[index]).toBe(canonicalOrder[index]);
      }
    }
  });

  test('every probe expectedGameMode matches the matched candidate gameMode (or indetermined on null)', () => {
    for (const probe of VANILLA_IWAD_DISCOVERY_PROBES) {
      if (probe.expectedMatchedFilename === null) {
        expect(probe.expectedGameMode).toBe('indetermined');
      } else {
        const candidate = VANILLA_IWAD_CANDIDATES.find((entry) => entry.filename === probe.expectedMatchedFilename);
        expect(candidate).toBeDefined();
        expect(probe.expectedGameMode).toBe(candidate!.gameMode);
      }
    }
  });

  test('every probe expectation is consistent with deriveExpectedDiscoveryResult', () => {
    for (const probe of VANILLA_IWAD_DISCOVERY_PROBES) {
      const derived = deriveExpectedDiscoveryResult(probe.filesystemState);
      expect(derived.matchedFilename).toBe(probe.expectedMatchedFilename);
      expect(derived.gameMode).toBe(probe.expectedGameMode);
      expect([...derived.probedSequence]).toEqual([...probe.expectedProbeSequence]);
    }
  });
});

describe('crossCheckVanillaIwadDiscovery against REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER', () => {
  test('reports zero failures for the canonical reference handler', () => {
    expect(crossCheckVanillaIwadDiscovery(REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER)).toEqual([]);
  });

  test('the reference handler matches doom1.wad in the shareware-only filesystem', () => {
    const probe = VANILLA_IWAD_DISCOVERY_PROBES.find((entry) => entry.id === 'shareware-only-matches-doom1');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doom1.wad');
    expect(result.gameMode).toBe('shareware');
    expect([...result.probedSequence]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);
  });

  test('the reference handler stops at doom.wad when both doom.wad and doom1.wad coexist', () => {
    const probe = VANILLA_IWAD_DISCOVERY_PROBES.find((entry) => entry.id === 'registered-doom-wad-matches-before-shareware');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBe('doom.wad');
    expect(result.gameMode).toBe('registered');
    expect(result.probedSequence[result.probedSequence.length - 1]).toBe('doom.wad');
  });

  test('the reference handler returns indetermined when no candidate matches', () => {
    const probe = VANILLA_IWAD_DISCOVERY_PROBES.find((entry) => entry.id === 'no-iwad-returns-indetermined');
    expect(probe).toBeDefined();
    const result = REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER.runProbe(probe!);
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.probedSequence.length).toBe(7);
  });
});

describe('crossCheckVanillaIwadDiscovery failure modes', () => {
  test('detects a handler that prefers shareware doom1.wad over registered doom.wad', () => {
    const sharewarePreferred: VanillaIwadDiscoveryHandler = {
      runProbe: (probe) => {
        const present = new Set(probe.filesystemState.presentBasenames);
        const reverseOrder: VanillaIwadCandidate['filename'][] = ['doom1.wad', 'doom.wad', 'doomu.wad', 'tnt.wad', 'plutonia.wad', 'doom2.wad', 'doom2f.wad'];
        const probed: VanillaIwadCandidate['filename'][] = [];
        for (const filename of reverseOrder) {
          probed.push(filename);
          if (present.has(filename)) {
            const candidate = VANILLA_IWAD_CANDIDATES.find((entry) => entry.filename === filename)!;
            return Object.freeze({ matchedFilename: candidate.filename, gameMode: candidate.gameMode, probedSequence: Object.freeze([...probed]) }) satisfies VanillaIwadDiscoveryResult;
          }
        }
        return Object.freeze({ matchedFilename: null, gameMode: 'indetermined' as const, probedSequence: Object.freeze([...probed]) }) satisfies VanillaIwadDiscoveryResult;
      },
    };
    const failures = crossCheckVanillaIwadDiscovery(sharewarePreferred);
    expect(failures.some((failure) => failure.startsWith('probe:registered-doom-wad-matches-before-shareware:matchedFilename:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:registered-doom-wad-matches-before-shareware:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that returns the wrong gameMode for a matched filename', () => {
    const wrongGameMode: VanillaIwadDiscoveryHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER.runProbe(probe);
        if (inner.matchedFilename === null) {
          return inner;
        }
        return Object.freeze({ matchedFilename: inner.matchedFilename, gameMode: 'commercial' as const, probedSequence: inner.probedSequence }) satisfies VanillaIwadDiscoveryResult;
      },
    };
    const failures = crossCheckVanillaIwadDiscovery(wrongGameMode);
    expect(failures.some((failure) => failure.startsWith('probe:shareware-only-matches-doom1:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:registered-doom-wad-matches-before-shareware:gameMode:value-mismatch'))).toBe(true);
  });

  test('detects a handler that throws away the no-match sentinel and substitutes shareware', () => {
    const sharewareDefault: VanillaIwadDiscoveryHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER.runProbe(probe);
        if (inner.matchedFilename === null) {
          return Object.freeze({ matchedFilename: 'doom1.wad' as const, gameMode: 'shareware' as const, probedSequence: inner.probedSequence }) satisfies VanillaIwadDiscoveryResult;
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaIwadDiscovery(sharewareDefault);
    expect(failures.some((failure) => failure.startsWith('probe:no-iwad-returns-indetermined:matchedFilename:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:no-iwad-returns-indetermined:gameMode:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:unrelated-wads-leave-game-mode-indeterminate:matchedFilename:value-mismatch'))).toBe(true);
  });

  test('detects a handler that short-circuits the probe sequence after the first miss', () => {
    const shortCircuit: VanillaIwadDiscoveryHandler = {
      runProbe: (probe) => {
        const present = new Set(probe.filesystemState.presentBasenames);
        const probed: VanillaIwadCandidate['filename'][] = [];
        for (const candidate of VANILLA_IWAD_CANDIDATES) {
          probed.push(candidate.filename);
          if (present.has(candidate.filename)) {
            return Object.freeze({ matchedFilename: candidate.filename, gameMode: candidate.gameMode, probedSequence: Object.freeze([...probed]) }) satisfies VanillaIwadDiscoveryResult;
          }
          if (probed.length >= 1) break;
        }
        return Object.freeze({ matchedFilename: null, gameMode: 'indetermined' as const, probedSequence: Object.freeze([...probed]) }) satisfies VanillaIwadDiscoveryResult;
      },
    };
    const failures = crossCheckVanillaIwadDiscovery(shortCircuit);
    expect(failures.some((failure) => failure.startsWith('probe:no-iwad-returns-indetermined:probedSequence:length-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:shareware-only-matches-doom1:matchedFilename:value-mismatch'))).toBe(true);
  });

  test('detects a handler that recognises an out-of-list filename like freedoom1.wad', () => {
    const freedoomRecogniser: VanillaIwadDiscoveryHandler = {
      runProbe: (probe) => {
        const present = new Set(probe.filesystemState.presentBasenames);
        if (present.has('freedoom1.wad')) {
          return Object.freeze({
            matchedFilename: 'doom1.wad' as const,
            gameMode: 'shareware' as const,
            probedSequence: Object.freeze(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad'] as const),
          }) satisfies VanillaIwadDiscoveryResult;
        }
        return REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER.runProbe(probe);
      },
    };
    const failures = crossCheckVanillaIwadDiscovery(freedoomRecogniser);
    expect(failures.some((failure) => failure.startsWith('probe:unrelated-wads-leave-game-mode-indeterminate:matchedFilename:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reorders the probe sequence', () => {
    const reorderedProbes: VanillaIwadDiscoveryHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_IWAD_DISCOVERY_HANDLER.runProbe(probe);
        if (inner.probedSequence.length < 2) {
          return inner;
        }
        const reordered: VanillaIwadCandidate['filename'][] = [...inner.probedSequence];
        const swap = reordered[0]!;
        reordered[0] = reordered[1]!;
        reordered[1] = swap;
        return Object.freeze({ matchedFilename: inner.matchedFilename, gameMode: inner.gameMode, probedSequence: Object.freeze(reordered) }) satisfies VanillaIwadDiscoveryResult;
      },
    };
    const failures = crossCheckVanillaIwadDiscovery(reorderedProbes);
    expect(failures.some((failure) => failure.startsWith('probe:no-iwad-returns-indetermined:probedSequence:order-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedDiscoveryResult helper', () => {
  test('returns matchedFilename=null and gameMode=indetermined for an empty filesystem', () => {
    const result = deriveExpectedDiscoveryResult({ doomWadDirEnvironmentValue: null, presentBasenames: [] });
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.probedSequence.length).toBe(7);
  });

  test('returns matchedFilename=doom1.wad and gameMode=shareware for a shareware-only filesystem', () => {
    const result = deriveExpectedDiscoveryResult({ doomWadDirEnvironmentValue: null, presentBasenames: ['doom1.wad'] });
    expect(result.matchedFilename).toBe('doom1.wad');
    expect(result.gameMode).toBe('shareware');
    expect([...result.probedSequence]).toEqual(['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad']);
  });

  test('returns matchedFilename=doom2f.wad when both French and English doom2 candidates coexist', () => {
    const result = deriveExpectedDiscoveryResult({ doomWadDirEnvironmentValue: null, presentBasenames: ['doom2.wad', 'doom2f.wad'] });
    expect(result.matchedFilename).toBe('doom2f.wad');
    expect(result.gameMode).toBe('commercial');
    expect([...result.probedSequence]).toEqual(['doom2f.wad']);
  });

  test('returns matchedFilename=null when only out-of-list WADs are present', () => {
    const result = deriveExpectedDiscoveryResult({ doomWadDirEnvironmentValue: null, presentBasenames: ['freedoom2.wad', 'hacx.wad', 'chex.wad'] });
    expect(result.matchedFilename).toBeNull();
    expect(result.gameMode).toBe('indetermined');
    expect(result.probedSequence.length).toBe(7);
  });
});

describe('vanilla DOOM 1.9 IWAD discovery order behaves as a prioritised match', () => {
  test('when every candidate is present, the first one (doom2f.wad) wins', () => {
    const everyCandidatePresent = VANILLA_IWAD_CANDIDATES.map((candidate) => candidate.filename);
    const result = deriveExpectedDiscoveryResult({ doomWadDirEnvironmentValue: null, presentBasenames: everyCandidatePresent });
    expect(result.matchedFilename).toBe('doom2f.wad');
    expect(result.gameMode).toBe('commercial');
    expect([...result.probedSequence]).toEqual(['doom2f.wad']);
  });

  test('removing the leading candidate cascades to the next one in order', () => {
    const cascadeOrder: VanillaIwadCandidate['filename'][] = ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad'];
    let presentBasenames: VanillaIwadCandidate['filename'][] = [...cascadeOrder];
    for (let removalIndex = 0; removalIndex < cascadeOrder.length; removalIndex++) {
      const result = deriveExpectedDiscoveryResult({ doomWadDirEnvironmentValue: null, presentBasenames });
      expect(result.matchedFilename).toBe(cascadeOrder[removalIndex]!);
      const candidate = VANILLA_IWAD_CANDIDATES.find((entry) => entry.filename === cascadeOrder[removalIndex])!;
      expect(result.gameMode).toBe(candidate.gameMode);
      presentBasenames = presentBasenames.filter((filename) => filename !== cascadeOrder[removalIndex]);
    }
    const finalResult = deriveExpectedDiscoveryResult({ doomWadDirEnvironmentValue: null, presentBasenames });
    expect(finalResult.matchedFilename).toBeNull();
    expect(finalResult.gameMode).toBe('indetermined');
  });

  test('the DOOMWADDIR override does not change the candidate set, the order, or the gameMode pin', () => {
    const withOverride = deriveExpectedDiscoveryResult({ doomWadDirEnvironmentValue: '/usr/share/doom', presentBasenames: ['doom1.wad'] });
    const withoutOverride = deriveExpectedDiscoveryResult({ doomWadDirEnvironmentValue: null, presentBasenames: ['doom1.wad'] });
    expect(withOverride.matchedFilename).toBe(withoutOverride.matchedFilename);
    expect(withOverride.gameMode).toBe(withoutOverride.gameMode);
    expect([...withOverride.probedSequence]).toEqual([...withoutOverride.probedSequence]);
  });
});

describe('implement-iwad-discovery-order step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-iwad-discovery-order.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-iwad-discovery-order.test.ts');
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
