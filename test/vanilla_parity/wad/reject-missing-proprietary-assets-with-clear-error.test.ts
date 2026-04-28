import { describe, expect, test } from 'bun:test';

import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import {
  MANDATORY_INFRASTRUCTURE_LUMPS,
  MANDATORY_MAP_DATA_LUMPS,
  MISSING_PROPRIETARY_ASSET_AUDIT,
  MISSING_PROPRIETARY_ASSET_DERIVED_INVARIANTS,
  MissingProprietaryIwadFileError,
  MissingProprietaryLumpError,
  OPTIONAL_INFRASTRUCTURE_LUMPS,
  assertRequiredIwadFilePresent,
  assertRequiredLumpPresent,
  crossCheckMissingProprietaryAssetRuntime,
  findOptionalLump,
} from '../../../src/assets/reject-missing-proprietary-assets-with-clear-error.ts';
import type { MissingProprietaryAssetAuditEntry, MissingProprietaryAssetRuntimeSnapshot } from '../../../src/assets/reject-missing-proprietary-assets-with-clear-error.ts';

const ALLOWED_AXIS_IDS = new Set<MissingProprietaryAssetAuditEntry['id']>([
  'w-get-num-for-name-fatals-on-miss',
  'w-get-num-for-name-error-format',
  'w-check-num-for-name-returns-negative-one-on-miss',
  'w-cache-lump-name-routes-through-get-num-for-name',
  'r-init-textures-requires-texture1',
  'r-init-textures-requires-pnames',
  'r-init-textures-allows-texture2-absent',
  'r-init-flats-requires-flat-marker-range',
  'r-init-sprite-lumps-requires-sprite-marker-range',
  'p-setup-level-requires-map-marker',
  'p-setup-level-requires-things-lump',
  'p-setup-level-requires-linedefs-lump',
  'p-setup-level-requires-sidedefs-lump',
  'p-setup-level-requires-vertexes-lump',
  'p-setup-level-requires-segs-lump',
  'p-setup-level-requires-ssectors-lump',
  'p-setup-level-requires-nodes-lump',
  'p-setup-level-requires-sectors-lump',
  'p-setup-level-requires-blockmap-lump',
  'p-setup-level-requires-reject-lump',
  'st-init-requires-stbar-and-starms',
  'd-page-drawer-requires-titlepic-and-credit',
  'd-doom-main-requires-playpal-and-colormap',
  'd-doom-main-requires-endoom',
  'd-doom-main-requires-genmidi',
  'd-doom-main-allows-dmxgus-absent',
  'd-doom-main-rejects-missing-iwad-file',
  'rejection-error-carries-asset-kind',
  'rejection-error-carries-asset-name',
  'rejection-error-carries-subsystem-name',
  'rejection-error-for-iwad-carries-search-paths',
]);

const ALLOWED_SUBJECTS = new Set<MissingProprietaryAssetAuditEntry['subject']>([
  'wad-lookup-primitive',
  'texture-loader',
  'patch-name-loader',
  'flat-marker-resolver',
  'sprite-marker-resolver',
  'level-loader',
  'map-data-lump',
  'status-bar-loader',
  'title-pager',
  'palette-loader',
  'audio-loader',
  'iwad-discovery',
  'rejection-error-shape',
]);

const ALLOWED_REFERENCE_FILES = new Set<MissingProprietaryAssetAuditEntry['referenceSourceFile']>([
  'linuxdoom-1.10/w_wad.c',
  'linuxdoom-1.10/r_data.c',
  'linuxdoom-1.10/p_setup.c',
  'linuxdoom-1.10/st_stuff.c',
  'linuxdoom-1.10/d_main.c',
  'src/w_wad.c',
  'src/d_iwad.c',
  'src/doom/d_main.c',
  'src/doom/p_setup.c',
]);

function buildDirectoryWithLumps(names: readonly string[]): DirectoryEntry[] {
  return names.map((name) => Object.freeze({ offset: 0, size: 0, name }));
}

const directoryWithPlaypal = buildDirectoryWithLumps(['PLAYPAL', 'COLORMAP', 'TEXTURE1']);
const emptyDirectory: readonly DirectoryEntry[] = Object.freeze([]);

function buildLiveRuntimeSnapshot(): MissingProprietaryAssetRuntimeSnapshot {
  let assertRequiredLumpThrowsWhenAbsent = false;
  try {
    assertRequiredLumpPresent(emptyDirectory, 'PLAYPAL', 'R_InitPalette');
  } catch (e) {
    assertRequiredLumpThrowsWhenAbsent = e instanceof MissingProprietaryLumpError;
  }

  const assertRequiredLumpReturnsEntryWhenPresent = (() => {
    const entry = assertRequiredLumpPresent(directoryWithPlaypal, 'PLAYPAL', 'R_InitPalette');
    return entry.name === 'PLAYPAL';
  })();

  const assertRequiredLumpIsCaseInsensitive = (() => {
    const entry = assertRequiredLumpPresent(directoryWithPlaypal, 'playpal', 'R_InitPalette');
    return entry.name === 'PLAYPAL';
  })();

  const findOptionalLumpReturnsUndefinedWhenAbsent = findOptionalLump(emptyDirectory, 'TEXTURE2') === undefined;
  const findOptionalLumpReturnsEntryWhenPresent = findOptionalLump(directoryWithPlaypal, 'TEXTURE1')?.name === 'TEXTURE1';
  const findOptionalLumpIsCaseInsensitive = findOptionalLump(directoryWithPlaypal, 'texture1')?.name === 'TEXTURE1';

  let assertRequiredIwadFileThrowsWhenNoCandidateAvailable = false;
  try {
    assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD'], () => false);
  } catch (e) {
    assertRequiredIwadFileThrowsWhenNoCandidateAvailable = e instanceof MissingProprietaryIwadFileError;
  }

  const assertRequiredIwadFileReturnsFirstAvailablePath = (() => {
    const probedPath = assertRequiredIwadFilePresent('DOOM1.WAD', ['nonexistent/DOOM1.WAD', 'doom/DOOM1.WAD'], (p) => p === 'doom/DOOM1.WAD');
    return probedPath === 'doom/DOOM1.WAD';
  })();

  const sampleLumpError = new MissingProprietaryLumpError('TEXTURE1', 'R_InitTextures');
  const sampleIwadError = new MissingProprietaryIwadFileError('DOOM1.WAD', 'D_FindIWAD', ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD']);

  return {
    assertRequiredLumpThrowsWhenAbsent,
    assertRequiredLumpReturnsEntryWhenPresent,
    assertRequiredLumpIsCaseInsensitive,
    findOptionalLumpReturnsUndefinedWhenAbsent,
    findOptionalLumpReturnsEntryWhenPresent,
    findOptionalLumpIsCaseInsensitive,
    assertRequiredIwadFileThrowsWhenNoCandidateAvailable,
    assertRequiredIwadFileReturnsFirstAvailablePath,
    missingLumpErrorMessageIncludesNotFoundLiteral: sampleLumpError.message.includes('not found'),
    missingLumpErrorMessageIncludesAssetName: sampleLumpError.message.includes('TEXTURE1'),
    missingLumpErrorMessageIncludesSubsystem: sampleLumpError.message.includes('R_InitTextures'),
    missingLumpErrorCarriesLumpAssetKind: sampleLumpError.assetKind === 'lump',
    missingIwadFileErrorCarriesIwadFileAssetKind: sampleIwadError.assetKind === 'iwad-file',
    missingIwadFileErrorIncludesFilenameAndSearchPaths: sampleIwadError.message.includes('DOOM1.WAD') && sampleIwadError.message.includes('doom/DOOM1.WAD') && sampleIwadError.message.includes('iwad/DOOM1.WAD'),
    mandatoryInfrastructureLumpsCoverPinnedAxes: ['PLAYPAL', 'COLORMAP', 'ENDOOM', 'GENMIDI', 'PNAMES', 'TEXTURE1', 'TITLEPIC', 'CREDIT', 'STBAR', 'STARMS'].every((name) => MANDATORY_INFRASTRUCTURE_LUMPS.includes(name)),
    mandatoryMapDataLumpsCoverPinnedAxes: ['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'].every((name) => MANDATORY_MAP_DATA_LUMPS.includes(name)),
    optionalLumpsIncludeTexture2AndDmxgus: OPTIONAL_INFRASTRUCTURE_LUMPS.includes('TEXTURE2') && OPTIONAL_INFRASTRUCTURE_LUMPS.includes('DMXGUS'),
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

describe('Missing-proprietary-asset audit ledger shape', () => {
  test('audits exactly thirty-one rejection axes', () => {
    expect(MISSING_PROPRIETARY_ASSET_AUDIT.length).toBe(31);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of MISSING_PROPRIETARY_ASSET_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = MISSING_PROPRIETARY_ASSET_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of MISSING_PROPRIETARY_ASSET_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of MISSING_PROPRIETARY_ASSET_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of MISSING_PROPRIETARY_ASSET_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of MISSING_PROPRIETARY_ASSET_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the w-get-num-for-name-fatals-on-miss axis cites the upstream W_GetNumForName body', () => {
    const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === 'w-get-num-for-name-fatals-on-miss');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('wad-lookup-primitive');
    expect(entry!.cSourceLines.some((line) => line.includes('W_GetNumForName'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('I_Error'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/w_wad.c');
  });

  test('the w-get-num-for-name-error-format axis pins the literal "%s not found!" upstream format', () => {
    const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === 'w-get-num-for-name-error-format');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('%s not found'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/w_wad.c');
  });

  test('the w-check-num-for-name-returns-negative-one-on-miss axis pins the -1 sentinel', () => {
    const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === 'w-check-num-for-name-returns-negative-one-on-miss');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('-1'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/w_wad.c');
  });

  test('the r-init-textures-requires-texture1 axis cites the upstream W_CacheLumpName for TEXTURE1', () => {
    const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === 'r-init-textures-requires-texture1');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('TEXTURE1'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/r_data.c');
  });

  test('the r-init-textures-allows-texture2-absent axis cites the W_CheckNumForName guard', () => {
    const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === 'r-init-textures-allows-texture2-absent');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('W_CheckNumForName'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('TEXTURE2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/r_data.c');
  });

  test('the p-setup-level-requires-map-marker axis cites the upstream W_GetNumForName(lumpname) callsite', () => {
    const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === 'p-setup-level-requires-map-marker');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('W_GetNumForName'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/p_setup.c');
  });

  test('every per-map data lump axis cites a W_CacheLumpNum callsite', () => {
    const mapDataAxes: ReadonlyArray<MissingProprietaryAssetAuditEntry['id']> = [
      'p-setup-level-requires-things-lump',
      'p-setup-level-requires-linedefs-lump',
      'p-setup-level-requires-sidedefs-lump',
      'p-setup-level-requires-vertexes-lump',
      'p-setup-level-requires-segs-lump',
      'p-setup-level-requires-ssectors-lump',
      'p-setup-level-requires-nodes-lump',
      'p-setup-level-requires-sectors-lump',
      'p-setup-level-requires-blockmap-lump',
      'p-setup-level-requires-reject-lump',
    ];
    for (const id of mapDataAxes) {
      const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.subject).toBe('map-data-lump');
      expect(entry!.cSourceLines.some((line) => line.includes('W_CacheLumpNum'))).toBe(true);
      expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/p_setup.c');
    }
  });

  test('the d-doom-main-rejects-missing-iwad-file axis cites the "Game mode indeterminate" error', () => {
    const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === 'd-doom-main-rejects-missing-iwad-file');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('Game mode indeterminate'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('src/d_iwad.c');
  });

  test('the d-doom-main-allows-dmxgus-absent axis cites the W_CheckNumForName("DMXGUS") guard', () => {
    const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === 'd-doom-main-allows-dmxgus-absent');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('DMXGUS'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('W_CheckNumForName'))).toBe(true);
  });

  test('every rejection-error-shape axis pins the rejection-error-shape subject', () => {
    const errorShapeAxes: ReadonlyArray<MissingProprietaryAssetAuditEntry['id']> = [
      'rejection-error-carries-asset-kind',
      'rejection-error-carries-asset-name',
      'rejection-error-carries-subsystem-name',
      'rejection-error-for-iwad-carries-search-paths',
    ];
    for (const id of errorShapeAxes) {
      const entry = MISSING_PROPRIETARY_ASSET_AUDIT.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.subject).toBe('rejection-error-shape');
    }
  });
});

describe('Missing-proprietary-asset derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = MISSING_PROPRIETARY_ASSET_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(MISSING_PROPRIETARY_ASSET_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'ASSERT_REQUIRED_LUMP_THROWS_WHEN_ABSENT',
        'ASSERT_REQUIRED_LUMP_RETURNS_DIRECTORY_ENTRY_WHEN_PRESENT',
        'ASSERT_REQUIRED_LUMP_IS_CASE_INSENSITIVE',
        'FIND_OPTIONAL_LUMP_RETURNS_UNDEFINED_WHEN_ABSENT',
        'FIND_OPTIONAL_LUMP_RETURNS_DIRECTORY_ENTRY_WHEN_PRESENT',
        'FIND_OPTIONAL_LUMP_IS_CASE_INSENSITIVE',
        'ASSERT_REQUIRED_IWAD_FILE_THROWS_WHEN_NO_CANDIDATE_AVAILABLE',
        'ASSERT_REQUIRED_IWAD_FILE_RETURNS_FIRST_AVAILABLE_PATH',
        'MISSING_LUMP_ERROR_MESSAGE_INCLUDES_NOT_FOUND_LITERAL',
        'MISSING_LUMP_ERROR_MESSAGE_INCLUDES_ASSET_NAME',
        'MISSING_LUMP_ERROR_MESSAGE_INCLUDES_SUBSYSTEM',
        'MISSING_LUMP_ERROR_CARRIES_LUMP_ASSET_KIND',
        'MISSING_IWAD_FILE_ERROR_CARRIES_IWAD_FILE_ASSET_KIND',
        'MISSING_IWAD_FILE_ERROR_INCLUDES_FILENAME_AND_SEARCH_PATHS',
        'EVERY_MANDATORY_INFRASTRUCTURE_LUMP_IS_PINNED',
        'EVERY_MANDATORY_MAP_DATA_LUMP_IS_PINNED',
        'OPTIONAL_LUMPS_INCLUDE_TEXTURE2_AND_DMXGUS',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of MISSING_PROPRIETARY_ASSET_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('Mandatory and optional lump catalogs', () => {
  test('MANDATORY_INFRASTRUCTURE_LUMPS is frozen and includes the canonical mandatory lumps', () => {
    expect(Object.isFrozen(MANDATORY_INFRASTRUCTURE_LUMPS)).toBe(true);
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('PLAYPAL');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('COLORMAP');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('ENDOOM');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('GENMIDI');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('PNAMES');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('TEXTURE1');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('TITLEPIC');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('CREDIT');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('STBAR');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('STARMS');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('F_START');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('F_END');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('S_START');
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).toContain('S_END');
  });

  test('MANDATORY_INFRASTRUCTURE_LUMPS does NOT include TEXTURE2 (registered/Ultimate-only)', () => {
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).not.toContain('TEXTURE2');
  });

  test('MANDATORY_INFRASTRUCTURE_LUMPS does NOT include DMXGUS (optional GUS bank)', () => {
    expect(MANDATORY_INFRASTRUCTURE_LUMPS).not.toContain('DMXGUS');
  });

  test('MANDATORY_MAP_DATA_LUMPS is frozen and lists every per-map data lump in the upstream order', () => {
    expect(Object.isFrozen(MANDATORY_MAP_DATA_LUMPS)).toBe(true);
    expect(MANDATORY_MAP_DATA_LUMPS).toEqual(['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP']);
  });

  test('OPTIONAL_INFRASTRUCTURE_LUMPS is frozen and includes both TEXTURE2 and DMXGUS', () => {
    expect(Object.isFrozen(OPTIONAL_INFRASTRUCTURE_LUMPS)).toBe(true);
    expect(OPTIONAL_INFRASTRUCTURE_LUMPS).toContain('TEXTURE2');
    expect(OPTIONAL_INFRASTRUCTURE_LUMPS).toContain('DMXGUS');
  });

  test('the mandatory and optional lump sets are disjoint', () => {
    for (const name of MANDATORY_INFRASTRUCTURE_LUMPS) {
      expect(OPTIONAL_INFRASTRUCTURE_LUMPS).not.toContain(name);
    }
  });
});

describe('findOptionalLump runtime', () => {
  test('returns undefined for an empty directory', () => {
    expect(findOptionalLump(emptyDirectory, 'PLAYPAL')).toBeUndefined();
  });

  test('returns undefined when the lump name is absent', () => {
    expect(findOptionalLump(directoryWithPlaypal, 'TEXTURE2')).toBeUndefined();
  });

  test('returns the matching DirectoryEntry when the lump name is present', () => {
    const entry = findOptionalLump(directoryWithPlaypal, 'PLAYPAL');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('PLAYPAL');
  });

  test('matches lump names case-insensitively (lowercased query)', () => {
    const entry = findOptionalLump(directoryWithPlaypal, 'playpal');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('PLAYPAL');
  });

  test('matches lump names case-insensitively (mixed-case query)', () => {
    const entry = findOptionalLump(directoryWithPlaypal, 'TextuRe1');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('TEXTURE1');
  });

  test('matches lump names case-insensitively (lowercased directory entry)', () => {
    const directory = buildDirectoryWithLumps(['playpal']);
    const entry = findOptionalLump(directory, 'PLAYPAL');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('playpal');
  });

  test('returns the first matching entry on duplicates (vanilla scans from start to end of directory)', () => {
    const directory = buildDirectoryWithLumps(['PLAYPAL', 'PLAYPAL']);
    const entry = findOptionalLump(directory, 'PLAYPAL');
    expect(entry).toBe(directory[0]);
  });
});

describe('assertRequiredLumpPresent runtime', () => {
  test('returns the matching DirectoryEntry when the lump is present', () => {
    const entry = assertRequiredLumpPresent(directoryWithPlaypal, 'PLAYPAL', 'R_InitPalette');
    expect(entry.name).toBe('PLAYPAL');
  });

  test('throws MissingProprietaryLumpError when the lump is absent', () => {
    expect(() => assertRequiredLumpPresent(emptyDirectory, 'PLAYPAL', 'R_InitPalette')).toThrow(MissingProprietaryLumpError);
  });

  test('matches lump names case-insensitively', () => {
    const entry = assertRequiredLumpPresent(directoryWithPlaypal, 'playpal', 'R_InitPalette');
    expect(entry.name).toBe('PLAYPAL');
  });

  test('error message includes the literal "not found" substring (mirroring upstream W_GetNumForName format)', () => {
    try {
      assertRequiredLumpPresent(emptyDirectory, 'TEXTURE1', 'R_InitTextures');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MissingProprietaryLumpError);
      expect((e as Error).message).toContain('not found');
    }
  });

  test('error message includes the literal asset name', () => {
    try {
      assertRequiredLumpPresent(emptyDirectory, 'TEXTURE1', 'R_InitTextures');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain('TEXTURE1');
    }
  });

  test('error message includes the literal subsystem identifier', () => {
    try {
      assertRequiredLumpPresent(emptyDirectory, 'TEXTURE1', 'R_InitTextures');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain('R_InitTextures');
    }
  });

  test('error message preserves the upstream "W_GetNumForName" prefix', () => {
    try {
      assertRequiredLumpPresent(emptyDirectory, 'TEXTURE1', 'R_InitTextures');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain('W_GetNumForName');
    }
  });

  test('error carries assetKind === "lump"', () => {
    try {
      assertRequiredLumpPresent(emptyDirectory, 'TEXTURE1', 'R_InitTextures');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MissingProprietaryLumpError);
      expect((e as MissingProprietaryLumpError).assetKind).toBe('lump');
    }
  });

  test('error carries the supplied assetName and subsystem fields', () => {
    try {
      assertRequiredLumpPresent(emptyDirectory, 'TEXTURE1', 'R_InitTextures');
      throw new Error('expected throw');
    } catch (e) {
      const err = e as MissingProprietaryLumpError;
      expect(err.assetName).toBe('TEXTURE1');
      expect(err.subsystem).toBe('R_InitTextures');
    }
  });

  test('error has a name property equal to "MissingProprietaryLumpError"', () => {
    try {
      assertRequiredLumpPresent(emptyDirectory, 'TEXTURE1', 'R_InitTextures');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).name).toBe('MissingProprietaryLumpError');
    }
  });

  test('every mandatory infrastructure lump throws when stripped from the directory', () => {
    for (const lumpName of MANDATORY_INFRASTRUCTURE_LUMPS) {
      expect(() => assertRequiredLumpPresent(emptyDirectory, lumpName, 'startup')).toThrow(MissingProprietaryLumpError);
    }
  });

  test('every mandatory map data lump throws when stripped from the directory', () => {
    for (const lumpName of MANDATORY_MAP_DATA_LUMPS) {
      expect(() => assertRequiredLumpPresent(emptyDirectory, lumpName, 'P_SetupLevel')).toThrow(MissingProprietaryLumpError);
    }
  });
});

describe('assertRequiredIwadFilePresent runtime', () => {
  test('returns the first candidate path when only one path is available', () => {
    const result = assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD'], () => true);
    expect(result).toBe('doom/DOOM1.WAD');
  });

  test('returns the first available path when later paths are also available (preserves probe order)', () => {
    const result = assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD'], () => true);
    expect(result).toBe('doom/DOOM1.WAD');
  });

  test('skips unavailable candidate paths in order and returns the first available', () => {
    const result = assertRequiredIwadFilePresent('DOOM1.WAD', ['nonexistent/DOOM1.WAD', 'doom/DOOM1.WAD', 'iwad/DOOM1.WAD'], (p) => p !== 'nonexistent/DOOM1.WAD');
    expect(result).toBe('doom/DOOM1.WAD');
  });

  test('throws MissingProprietaryIwadFileError when no candidate path is available', () => {
    expect(() => assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD'], () => false)).toThrow(MissingProprietaryIwadFileError);
  });

  test('throws MissingProprietaryIwadFileError when the candidate path list is empty', () => {
    expect(() => assertRequiredIwadFilePresent('DOOM1.WAD', [], () => true)).toThrow(MissingProprietaryIwadFileError);
  });

  test('error message includes the asset filename', () => {
    try {
      assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD'], () => false);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain('DOOM1.WAD');
    }
  });

  test('error message includes every candidate search path', () => {
    try {
      assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD'], () => false);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain('doom/DOOM1.WAD');
      expect((e as Error).message).toContain('iwad/DOOM1.WAD');
    }
  });

  test('error message preserves the upstream "Game mode indeterminate" phrase', () => {
    try {
      assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD'], () => false);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain('Game mode indeterminate');
    }
  });

  test('error carries assetKind === "iwad-file"', () => {
    try {
      assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD'], () => false);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MissingProprietaryIwadFileError);
      expect((e as MissingProprietaryIwadFileError).assetKind).toBe('iwad-file');
    }
  });

  test('error has a name property equal to "MissingProprietaryIwadFileError"', () => {
    try {
      assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD'], () => false);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).name).toBe('MissingProprietaryIwadFileError');
    }
  });

  test('error carries the assetName, subsystem, and frozen searchPaths fields', () => {
    try {
      assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD'], () => false, 'D_FindIWAD');
      throw new Error('expected throw');
    } catch (e) {
      const err = e as MissingProprietaryIwadFileError;
      expect(err.assetName).toBe('DOOM1.WAD');
      expect(err.subsystem).toBe('D_FindIWAD');
      expect(err.searchPaths).toEqual(['doom/DOOM1.WAD', 'iwad/DOOM1.WAD']);
      expect(Object.isFrozen(err.searchPaths)).toBe(true);
    }
  });

  test('uses default subsystem "D_FindIWAD" when none is supplied', () => {
    try {
      assertRequiredIwadFilePresent('DOOM1.WAD', ['doom/DOOM1.WAD'], () => false);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as MissingProprietaryIwadFileError).subsystem).toBe('D_FindIWAD');
    }
  });

  test('reports a helpful "(no search paths supplied)" message when the candidate list is empty', () => {
    try {
      assertRequiredIwadFilePresent('DOOM1.WAD', [], () => true);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain('(no search paths supplied)');
    }
  });
});

describe('MissingProprietaryLumpError shape', () => {
  test('extends Error and carries the canonical message format', () => {
    const error = new MissingProprietaryLumpError('PLAYPAL', 'R_InitPalette');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('W_GetNumForName: PLAYPAL not found! (requested by R_InitPalette)');
  });

  test('carries assetKind === "lump"', () => {
    const error = new MissingProprietaryLumpError('PLAYPAL', 'R_InitPalette');
    expect(error.assetKind).toBe('lump');
  });

  test('carries the supplied assetName and subsystem fields', () => {
    const error = new MissingProprietaryLumpError('TEXTURE1', 'R_InitTextures');
    expect(error.assetName).toBe('TEXTURE1');
    expect(error.subsystem).toBe('R_InitTextures');
  });

  test('has name property equal to "MissingProprietaryLumpError" so it is identifiable in stack traces', () => {
    const error = new MissingProprietaryLumpError('PLAYPAL', 'R_InitPalette');
    expect(error.name).toBe('MissingProprietaryLumpError');
  });
});

describe('MissingProprietaryIwadFileError shape', () => {
  test('extends Error and carries the canonical message format', () => {
    const error = new MissingProprietaryIwadFileError('DOOM1.WAD', 'D_FindIWAD', ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD']);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Game mode indeterminate. No IWAD file DOOM1.WAD was found by D_FindIWAD. Searched paths: doom/DOOM1.WAD, iwad/DOOM1.WAD');
  });

  test('carries assetKind === "iwad-file"', () => {
    const error = new MissingProprietaryIwadFileError('DOOM1.WAD', 'D_FindIWAD', ['doom/DOOM1.WAD']);
    expect(error.assetKind).toBe('iwad-file');
  });

  test('carries the supplied assetName, subsystem, and frozen searchPaths fields', () => {
    const error = new MissingProprietaryIwadFileError('DOOM1.WAD', 'D_FindIWAD', ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD']);
    expect(error.assetName).toBe('DOOM1.WAD');
    expect(error.subsystem).toBe('D_FindIWAD');
    expect(error.searchPaths).toEqual(['doom/DOOM1.WAD', 'iwad/DOOM1.WAD']);
    expect(Object.isFrozen(error.searchPaths)).toBe(true);
  });

  test('has name property equal to "MissingProprietaryIwadFileError" so it is identifiable in stack traces', () => {
    const error = new MissingProprietaryIwadFileError('DOOM1.WAD', 'D_FindIWAD', ['doom/DOOM1.WAD']);
    expect(error.name).toBe('MissingProprietaryIwadFileError');
  });

  test('the searchPaths field is a defensively copied frozen array (so caller mutations do not leak in)', () => {
    const mutableInput = ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD'];
    const error = new MissingProprietaryIwadFileError('DOOM1.WAD', 'D_FindIWAD', mutableInput);
    mutableInput.push('extra/DOOM1.WAD');
    expect(error.searchPaths.length).toBe(2);
    expect(error.searchPaths).toEqual(['doom/DOOM1.WAD', 'iwad/DOOM1.WAD']);
  });

  test('reports the "(no search paths supplied)" sentinel for an empty searchPaths list', () => {
    const error = new MissingProprietaryIwadFileError('DOOM1.WAD', 'D_FindIWAD', []);
    expect(error.message).toContain('(no search paths supplied)');
  });
});

describe('crossCheckMissingProprietaryAssetRuntime', () => {
  test('reports zero failures for the live runtime snapshot', () => {
    expect(crossCheckMissingProprietaryAssetRuntime(liveRuntimeSnapshot)).toEqual([]);
  });

  test('detects an assertRequiredLump that does not throw on miss', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, assertRequiredLumpThrowsWhenAbsent: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_REQUIRED_LUMP_THROWS_WHEN_ABSENT');
    expect(failures).toContain('audit:w-get-num-for-name-fatals-on-miss:not-observed');
  });

  test('detects an assertRequiredLump that throws when the lump is present', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, assertRequiredLumpReturnsEntryWhenPresent: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_REQUIRED_LUMP_RETURNS_DIRECTORY_ENTRY_WHEN_PRESENT');
  });

  test('detects an assertRequiredLump that fails to match case-insensitively', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, assertRequiredLumpIsCaseInsensitive: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_REQUIRED_LUMP_IS_CASE_INSENSITIVE');
  });

  test('detects a findOptionalLump that throws on miss', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, findOptionalLumpReturnsUndefinedWhenAbsent: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:FIND_OPTIONAL_LUMP_RETURNS_UNDEFINED_WHEN_ABSENT');
    expect(failures).toContain('audit:w-check-num-for-name-returns-negative-one-on-miss:not-observed');
  });

  test('detects a findOptionalLump that does not return the matching entry', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, findOptionalLumpReturnsEntryWhenPresent: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:FIND_OPTIONAL_LUMP_RETURNS_DIRECTORY_ENTRY_WHEN_PRESENT');
  });

  test('detects a findOptionalLump that fails case-insensitively', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, findOptionalLumpIsCaseInsensitive: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:FIND_OPTIONAL_LUMP_IS_CASE_INSENSITIVE');
  });

  test('detects an assertRequiredIwadFile that does not throw when no candidate is available', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, assertRequiredIwadFileThrowsWhenNoCandidateAvailable: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_REQUIRED_IWAD_FILE_THROWS_WHEN_NO_CANDIDATE_AVAILABLE');
    expect(failures).toContain('audit:d-doom-main-rejects-missing-iwad-file:not-observed');
  });

  test('detects an assertRequiredIwadFile that returns the wrong path on order-sensitive search', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, assertRequiredIwadFileReturnsFirstAvailablePath: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_REQUIRED_IWAD_FILE_RETURNS_FIRST_AVAILABLE_PATH');
  });

  test('detects a missing-lump-error message that drops the "not found" literal', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, missingLumpErrorMessageIncludesNotFoundLiteral: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:MISSING_LUMP_ERROR_MESSAGE_INCLUDES_NOT_FOUND_LITERAL');
    expect(failures).toContain('audit:w-get-num-for-name-error-format:not-observed');
  });

  test('detects a missing-lump-error message that drops the asset name', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, missingLumpErrorMessageIncludesAssetName: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:MISSING_LUMP_ERROR_MESSAGE_INCLUDES_ASSET_NAME');
    expect(failures).toContain('audit:rejection-error-carries-asset-name:not-observed');
  });

  test('detects a missing-lump-error message that drops the subsystem identifier', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, missingLumpErrorMessageIncludesSubsystem: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:MISSING_LUMP_ERROR_MESSAGE_INCLUDES_SUBSYSTEM');
    expect(failures).toContain('audit:rejection-error-carries-subsystem-name:not-observed');
  });

  test('detects a missing-lump-error that does not carry assetKind === "lump"', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, missingLumpErrorCarriesLumpAssetKind: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:MISSING_LUMP_ERROR_CARRIES_LUMP_ASSET_KIND');
    expect(failures).toContain('audit:rejection-error-carries-asset-kind:not-observed');
  });

  test('detects a missing-iwad-file-error that does not carry assetKind === "iwad-file"', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, missingIwadFileErrorCarriesIwadFileAssetKind: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:MISSING_IWAD_FILE_ERROR_CARRIES_IWAD_FILE_ASSET_KIND');
    expect(failures).toContain('audit:rejection-error-carries-asset-kind:not-observed');
  });

  test('detects a missing-iwad-file-error message that drops the filename or search paths', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, missingIwadFileErrorIncludesFilenameAndSearchPaths: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:MISSING_IWAD_FILE_ERROR_INCLUDES_FILENAME_AND_SEARCH_PATHS');
    expect(failures).toContain('audit:rejection-error-for-iwad-carries-search-paths:not-observed');
  });

  test('detects a mandatory infrastructure lump catalog that drops a pinned axis', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, mandatoryInfrastructureLumpsCoverPinnedAxes: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:EVERY_MANDATORY_INFRASTRUCTURE_LUMP_IS_PINNED');
  });

  test('detects a mandatory map data lump catalog that drops a pinned axis', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, mandatoryMapDataLumpsCoverPinnedAxes: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:EVERY_MANDATORY_MAP_DATA_LUMP_IS_PINNED');
  });

  test('detects an optional infrastructure lump catalog that drops TEXTURE2 or DMXGUS', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot, optionalLumpsIncludeTexture2AndDmxgus: false };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:OPTIONAL_LUMPS_INCLUDE_TEXTURE2_AND_DMXGUS');
    expect(failures).toContain('audit:r-init-textures-allows-texture2-absent:not-observed');
    expect(failures).toContain('audit:d-doom-main-allows-dmxgus-absent:not-observed');
  });

  test('reports an empty failure list for a freshly cloned snapshot', () => {
    const cloned: MissingProprietaryAssetRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckMissingProprietaryAssetRuntime(cloned)).toEqual([]);
  });

  test('aggregates multiple tampered fields into multiple failure ids', () => {
    const tampered: MissingProprietaryAssetRuntimeSnapshot = {
      ...liveRuntimeSnapshot,
      assertRequiredLumpThrowsWhenAbsent: false,
      missingLumpErrorMessageIncludesNotFoundLiteral: false,
    };
    const failures = crossCheckMissingProprietaryAssetRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_REQUIRED_LUMP_THROWS_WHEN_ABSENT');
    expect(failures).toContain('derived:MISSING_LUMP_ERROR_MESSAGE_INCLUDES_NOT_FOUND_LITERAL');
    expect(failures.length).toBeGreaterThanOrEqual(4);
  });
});
