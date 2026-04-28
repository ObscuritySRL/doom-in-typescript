import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import {
  MAP_BUNDLE_DATA_LUMP_COUNT,
  MAP_BUNDLE_LUMP_NAMES,
  MAP_BUNDLE_ML_BLOCKMAP,
  MAP_BUNDLE_ML_LABEL,
  MAP_BUNDLE_ML_LINEDEFS,
  MAP_BUNDLE_ML_NODES,
  MAP_BUNDLE_ML_REJECT,
  MAP_BUNDLE_ML_SECTORS,
  MAP_BUNDLE_ML_SEGS,
  MAP_BUNDLE_ML_SIDEDEFS,
  MAP_BUNDLE_ML_SSECTORS,
  MAP_BUNDLE_ML_THINGS,
  MAP_BUNDLE_ML_VERTEXES,
  MAP_BUNDLE_TOTAL_LUMP_COUNT,
  MAP_LUMP_BUNDLE_AUDIT,
  MAP_LUMP_BUNDLE_DERIVED_INVARIANTS,
  MAP_MARKER_LUMP_SIZE,
  MAP_NAME_PATTERN_DOOM1,
  MAP_NAME_PATTERN_DOOM2,
  SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE,
  crossCheckMapLumpBundleRuntime,
  crossCheckShareWareDoom1WadMapBundleSample,
  hashMapBundleData,
  isMapMarkerName,
  parseMapMarkerName,
  resolveMapBundle,
} from '../../../src/assets/parse-map-lump-bundle-boundaries.ts';
import type { MapLumpBundleAuditEntry, MapLumpBundleRuntimeSnapshot, ShareWareDoom1WadMapBundleSample } from '../../../src/assets/parse-map-lump-bundle-boundaries.ts';

const ALLOWED_AXIS_IDS = new Set<MapLumpBundleAuditEntry['id']>([
  'map-bundle-name-format-doom1-e-m',
  'map-bundle-name-format-doom2-map-nn',
  'map-bundle-name-lookup-via-w-getnumforname',
  'map-bundle-marker-size-zero',
  'map-bundle-ml-label-offset-zero',
  'map-bundle-ml-things-offset-one',
  'map-bundle-ml-linedefs-offset-two',
  'map-bundle-ml-sidedefs-offset-three',
  'map-bundle-ml-vertexes-offset-four',
  'map-bundle-ml-segs-offset-five',
  'map-bundle-ml-ssectors-offset-six',
  'map-bundle-ml-nodes-offset-seven',
  'map-bundle-ml-sectors-offset-eight',
  'map-bundle-ml-reject-offset-nine',
  'map-bundle-ml-blockmap-offset-ten',
  'map-bundle-data-lump-count-ten',
  'map-bundle-total-lump-count-eleven',
  'map-bundle-positional-load-via-lumpnum-plus-offset',
  'map-bundle-no-marker-range',
  'map-bundle-shareware-doom1-nine-maps',
]);
const ALLOWED_SUBJECTS = new Set<MapLumpBundleAuditEntry['subject']>(['map-marker-lump', 'map-data-lump', 'P_SetupLevel', 'G_DoLoadLevel', 'doomdata.h-ML-enum', 'resolveMapBundle', 'shareware-doom1.wad']);
const ALLOWED_REFERENCE_FILES = new Set<MapLumpBundleAuditEntry['referenceSourceFile']>(['linuxdoom-1.10/p_setup.c', 'linuxdoom-1.10/g_game.c', 'linuxdoom-1.10/doomdata.h', 'src/doom/p_setup.c', 'src/doom/g_game.c', 'shareware/DOOM1.WAD']);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const liveMapMarkerEntries = liveDirectory.map((entry, index) => ({ entry, index })).filter(({ entry }) => isMapMarkerName(entry.name));

function buildSyntheticDirectory(mapName: string, options: { dataNamesOverride?: readonly string[] } = {}): DirectoryEntry[] {
  const directory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'PLAYPAL' }), Object.freeze({ offset: 0, size: 0, name: mapName })];
  const dataNames = options.dataNamesOverride ?? MAP_BUNDLE_LUMP_NAMES;
  for (const name of dataNames) {
    directory.push(Object.freeze({ offset: 0, size: 0, name }));
  }
  return directory;
}

const syntheticOkDirectory = buildSyntheticDirectory('E1M1');
const syntheticOkBundle = resolveMapBundle(syntheticOkDirectory, 'E1M1');

const syntheticOutOfOrderDirectory = buildSyntheticDirectory('E1M1', {
  dataNamesOverride: ['LINEDEFS', 'THINGS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP'],
});

const syntheticTruncatedDirectory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'PLAYPAL' }), Object.freeze({ offset: 0, size: 0, name: 'E1M1' }), Object.freeze({ offset: 0, size: 0, name: 'THINGS' })];

function tryThrows(thunk: () => unknown): boolean {
  try {
    thunk();
    return false;
  } catch (err) {
    return err instanceof Error;
  }
}

const resolveMapBundleRejectsMissingMapName = tryThrows(() => resolveMapBundle(liveDirectory, 'E9M9'));
const resolveMapBundleRejectsDataLumpOutOfOrder = tryThrows(() => resolveMapBundle(syntheticOutOfOrderDirectory, 'E1M1'));
const resolveMapBundleRejectsBundleRunningOffDirectoryEnd = tryThrows(() => resolveMapBundle(syntheticTruncatedDirectory, 'E1M1'));

function buildLiveRuntimeSnapshot(): MapLumpBundleRuntimeSnapshot {
  return {
    mapNamePatternDoom1AcceptsE1M1: MAP_NAME_PATTERN_DOOM1.test('E1M1'),
    mapNamePatternDoom2AcceptsMap01: MAP_NAME_PATTERN_DOOM2.test('MAP01'),
    mapMarkerLumpSize: MAP_MARKER_LUMP_SIZE,
    mapBundleMlLabel: MAP_BUNDLE_ML_LABEL,
    mapBundleMlThings: MAP_BUNDLE_ML_THINGS,
    mapBundleMlLinedefs: MAP_BUNDLE_ML_LINEDEFS,
    mapBundleMlSidedefs: MAP_BUNDLE_ML_SIDEDEFS,
    mapBundleMlVertexes: MAP_BUNDLE_ML_VERTEXES,
    mapBundleMlSegs: MAP_BUNDLE_ML_SEGS,
    mapBundleMlSsectors: MAP_BUNDLE_ML_SSECTORS,
    mapBundleMlNodes: MAP_BUNDLE_ML_NODES,
    mapBundleMlSectors: MAP_BUNDLE_ML_SECTORS,
    mapBundleMlReject: MAP_BUNDLE_ML_REJECT,
    mapBundleMlBlockmap: MAP_BUNDLE_ML_BLOCKMAP,
    mapBundleDataLumpCount: MAP_BUNDLE_DATA_LUMP_COUNT,
    mapBundleTotalLumpCount: MAP_BUNDLE_TOTAL_LUMP_COUNT,
    mapBundleLumpNamesMatchFixedOrder:
      MAP_BUNDLE_LUMP_NAMES.length === MAP_BUNDLE_DATA_LUMP_COUNT &&
      MAP_BUNDLE_LUMP_NAMES[0] === 'THINGS' &&
      MAP_BUNDLE_LUMP_NAMES[1] === 'LINEDEFS' &&
      MAP_BUNDLE_LUMP_NAMES[2] === 'SIDEDEFS' &&
      MAP_BUNDLE_LUMP_NAMES[3] === 'VERTEXES' &&
      MAP_BUNDLE_LUMP_NAMES[4] === 'SEGS' &&
      MAP_BUNDLE_LUMP_NAMES[5] === 'SSECTORS' &&
      MAP_BUNDLE_LUMP_NAMES[6] === 'NODES' &&
      MAP_BUNDLE_LUMP_NAMES[7] === 'SECTORS' &&
      MAP_BUNDLE_LUMP_NAMES[8] === 'REJECT' &&
      MAP_BUNDLE_LUMP_NAMES[9] === 'BLOCKMAP',
    resolveMapBundleReturnsFrozenBundle: Object.isFrozen(syntheticOkBundle) && Object.isFrozen(syntheticOkBundle.dataLumps),
    resolveMapBundleRejectsMissingMapName,
    resolveMapBundleRejectsDataLumpOutOfOrder,
    resolveMapBundleRejectsBundleRunningOffDirectoryEnd,
    isMapMarkerNameAcceptsE1M1: isMapMarkerName('E1M1'),
    isMapMarkerNameAcceptsMap01: isMapMarkerName('MAP01'),
    isMapMarkerNameRejectsNonMapNames: isMapMarkerName('PLAYPAL') === false && isMapMarkerName('THINGS') === false,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(): ShareWareDoom1WadMapBundleSample {
  const pinnedMapBundles = SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles.map((oracleEntry) => {
    const bundle = resolveMapBundle(liveDirectory, oracleEntry.name);
    const dataSha256 = hashMapBundleData(wadBuffer, bundle);
    return {
      name: bundle.mapName,
      markerIndex: bundle.markerIndex,
      markerSize: bundle.marker.size,
      totalDataBytes: bundle.totalDataBytes,
      dataSha256,
    };
  });
  return {
    mapBundleCount: liveMapMarkerEntries.length,
    firstMapBundleIndex: liveMapMarkerEntries[0]!.index,
    lastMapBundleIndex: liveMapMarkerEntries[liveMapMarkerEntries.length - 1]!.index,
    pinnedMapBundles,
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('map lump bundle audit ledger shape', () => {
  test('audits exactly twenty behavioral axes', () => {
    expect(MAP_LUMP_BUNDLE_AUDIT.length).toBe(20);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of MAP_LUMP_BUNDLE_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = MAP_LUMP_BUNDLE_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of MAP_LUMP_BUNDLE_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of MAP_LUMP_BUNDLE_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of MAP_LUMP_BUNDLE_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of MAP_LUMP_BUNDLE_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the doom1 name format axis cites the upstream G_DoLoadLevel character writes', () => {
    const entry = MAP_LUMP_BUNDLE_AUDIT.find((e) => e.id === 'map-bundle-name-format-doom1-e-m');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes("lumpname[0] = 'E'"))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes("lumpname[2] = 'M'"))).toBe(true);
  });

  test('the doom2 name format axis cites the upstream sprintf "map%02i" formatter', () => {
    const entry = MAP_LUMP_BUNDLE_AUDIT.find((e) => e.id === 'map-bundle-name-format-doom2-map-nn');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('"map%02i"'))).toBe(true);
  });

  test('the lookup-via-w-getnumforname axis cites the upstream W_GetNumForName call', () => {
    const entry = MAP_LUMP_BUNDLE_AUDIT.find((e) => e.id === 'map-bundle-name-lookup-via-w-getnumforname');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('W_GetNumForName'))).toBe(true);
  });

  test('the ML enum axes cite verbatim enum entries from doomdata.h', () => {
    const labelEntry = MAP_LUMP_BUNDLE_AUDIT.find((e) => e.id === 'map-bundle-ml-label-offset-zero');
    expect(labelEntry).toBeDefined();
    expect(labelEntry!.cSourceLines.some((line) => line.includes('ML_LABEL'))).toBe(true);
    const blockmapEntry = MAP_LUMP_BUNDLE_AUDIT.find((e) => e.id === 'map-bundle-ml-blockmap-offset-ten');
    expect(blockmapEntry).toBeDefined();
    expect(blockmapEntry!.cSourceLines.some((line) => line.includes('ML_BLOCKMAP'))).toBe(true);
  });

  test('the data-lump-count-ten axis cites all 10 P_Load<kind> call sites', () => {
    const entry = MAP_LUMP_BUNDLE_AUDIT.find((e) => e.id === 'map-bundle-data-lump-count-ten');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.length).toBe(10);
    expect(entry!.cSourceLines.every((line) => line.includes('P_Load') && line.includes('lumpnum+ML_'))).toBe(true);
  });

  test('the total-lump-count-eleven axis cites all 11 enum entries', () => {
    const entry = MAP_LUMP_BUNDLE_AUDIT.find((e) => e.id === 'map-bundle-total-lump-count-eleven');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('ML_LABEL'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('ML_BLOCKMAP'))).toBe(true);
  });

  test('the shareware-nine-maps axis names the shareware DOOM1.WAD file', () => {
    const entry = MAP_LUMP_BUNDLE_AUDIT.find((e) => e.id === 'map-bundle-shareware-doom1-nine-maps');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('shareware-doom1.wad');
    expect(entry!.invariant.includes('9 map header lumps')).toBe(true);
  });
});

describe('map lump bundle derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = MAP_LUMP_BUNDLE_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(MAP_LUMP_BUNDLE_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'MAP_NAME_PATTERN_DOOM1_MATCHES_E_DIGIT_M_DIGIT',
        'MAP_NAME_PATTERN_DOOM2_MATCHES_MAP_TWO_DIGITS',
        'MAP_MARKER_LUMP_SIZE_EQUALS_ZERO',
        'MAP_BUNDLE_ML_LABEL_EQUALS_ZERO',
        'MAP_BUNDLE_ML_THINGS_EQUALS_ONE',
        'MAP_BUNDLE_ML_LINEDEFS_EQUALS_TWO',
        'MAP_BUNDLE_ML_SIDEDEFS_EQUALS_THREE',
        'MAP_BUNDLE_ML_VERTEXES_EQUALS_FOUR',
        'MAP_BUNDLE_ML_SEGS_EQUALS_FIVE',
        'MAP_BUNDLE_ML_SSECTORS_EQUALS_SIX',
        'MAP_BUNDLE_ML_NODES_EQUALS_SEVEN',
        'MAP_BUNDLE_ML_SECTORS_EQUALS_EIGHT',
        'MAP_BUNDLE_ML_REJECT_EQUALS_NINE',
        'MAP_BUNDLE_ML_BLOCKMAP_EQUALS_TEN',
        'MAP_BUNDLE_DATA_LUMP_COUNT_EQUALS_TEN',
        'MAP_BUNDLE_TOTAL_LUMP_COUNT_EQUALS_ELEVEN',
        'MAP_BUNDLE_LUMP_NAMES_FIXED_ORDER',
        'RESOLVE_MAP_BUNDLE_RETURNS_FROZEN_BUNDLE',
        'RESOLVE_MAP_BUNDLE_REJECTS_MISSING_MAP_NAME',
        'RESOLVE_MAP_BUNDLE_REJECTS_DATA_LUMP_OUT_OF_ORDER',
        'RESOLVE_MAP_BUNDLE_REJECTS_BUNDLE_RUNNING_OFF_DIRECTORY_END',
        'IS_MAP_MARKER_NAME_ACCEPTS_E1M1_AND_MAP01',
        'IS_MAP_MARKER_NAME_REJECTS_NON_MAP_NAMES',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of MAP_LUMP_BUNDLE_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('MAP_MARKER_LUMP_SIZE equals 0 (matches every shareware map header lump size)', () => {
    expect(MAP_MARKER_LUMP_SIZE).toBe(0);
  });

  test('the ML_<kind> enum offsets follow the upstream doomdata.h ordering 0..10', () => {
    expect(MAP_BUNDLE_ML_LABEL).toBe(0);
    expect(MAP_BUNDLE_ML_THINGS).toBe(1);
    expect(MAP_BUNDLE_ML_LINEDEFS).toBe(2);
    expect(MAP_BUNDLE_ML_SIDEDEFS).toBe(3);
    expect(MAP_BUNDLE_ML_VERTEXES).toBe(4);
    expect(MAP_BUNDLE_ML_SEGS).toBe(5);
    expect(MAP_BUNDLE_ML_SSECTORS).toBe(6);
    expect(MAP_BUNDLE_ML_NODES).toBe(7);
    expect(MAP_BUNDLE_ML_SECTORS).toBe(8);
    expect(MAP_BUNDLE_ML_REJECT).toBe(9);
    expect(MAP_BUNDLE_ML_BLOCKMAP).toBe(10);
  });

  test('MAP_BUNDLE_DATA_LUMP_COUNT equals 10 and MAP_BUNDLE_TOTAL_LUMP_COUNT equals 11', () => {
    expect(MAP_BUNDLE_DATA_LUMP_COUNT).toBe(10);
    expect(MAP_BUNDLE_TOTAL_LUMP_COUNT).toBe(11);
    expect(MAP_BUNDLE_TOTAL_LUMP_COUNT).toBe(MAP_BUNDLE_DATA_LUMP_COUNT + 1);
  });

  test('MAP_BUNDLE_LUMP_NAMES is the canonical fixed order of 10 data lump names', () => {
    expect(MAP_BUNDLE_LUMP_NAMES).toEqual(['THINGS', 'LINEDEFS', 'SIDEDEFS', 'VERTEXES', 'SEGS', 'SSECTORS', 'NODES', 'SECTORS', 'REJECT', 'BLOCKMAP']);
    expect(MAP_BUNDLE_LUMP_NAMES.length).toBe(MAP_BUNDLE_DATA_LUMP_COUNT);
    expect(Object.isFrozen(MAP_BUNDLE_LUMP_NAMES)).toBe(true);
  });

  test('MAP_BUNDLE_LUMP_NAMES indexed by ML_<kind> - 1 yields the matching name', () => {
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_THINGS - 1]).toBe('THINGS');
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_LINEDEFS - 1]).toBe('LINEDEFS');
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_SIDEDEFS - 1]).toBe('SIDEDEFS');
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_VERTEXES - 1]).toBe('VERTEXES');
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_SEGS - 1]).toBe('SEGS');
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_SSECTORS - 1]).toBe('SSECTORS');
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_NODES - 1]).toBe('NODES');
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_SECTORS - 1]).toBe('SECTORS');
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_REJECT - 1]).toBe('REJECT');
    expect(MAP_BUNDLE_LUMP_NAMES[MAP_BUNDLE_ML_BLOCKMAP - 1]).toBe('BLOCKMAP');
  });

  test('MAP_NAME_PATTERN_DOOM1 accepts E1M1..E9M9 and rejects E0M1 / E1M0', () => {
    expect(MAP_NAME_PATTERN_DOOM1.test('E1M1')).toBe(true);
    expect(MAP_NAME_PATTERN_DOOM1.test('E9M9')).toBe(true);
    expect(MAP_NAME_PATTERN_DOOM1.test('E0M1')).toBe(false);
    expect(MAP_NAME_PATTERN_DOOM1.test('E1M0')).toBe(false);
    expect(MAP_NAME_PATTERN_DOOM1.test('E10M1')).toBe(false);
  });

  test('MAP_NAME_PATTERN_DOOM2 accepts MAP01..MAP32 and rejects MAP00 / MAP33', () => {
    expect(MAP_NAME_PATTERN_DOOM2.test('MAP01')).toBe(true);
    expect(MAP_NAME_PATTERN_DOOM2.test('MAP32')).toBe(true);
    expect(MAP_NAME_PATTERN_DOOM2.test('MAP00')).toBe(false);
    expect(MAP_NAME_PATTERN_DOOM2.test('MAP33')).toBe(false);
    expect(MAP_NAME_PATTERN_DOOM2.test('MAP1')).toBe(false);
  });
});

describe('resolveMapBundle runtime resolver', () => {
  test('returns a frozen bundle for a synthesised valid directory', () => {
    const bundle = resolveMapBundle(syntheticOkDirectory, 'E1M1');
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(Object.isFrozen(bundle.dataLumps)).toBe(true);
    expect(bundle.mapName).toBe('E1M1');
    expect(bundle.dataLumps.length).toBe(MAP_BUNDLE_DATA_LUMP_COUNT);
  });

  test('throws Error with the upstream W_GetNumForName message on a missing map', () => {
    expect(() => resolveMapBundle(liveDirectory, 'E9M9')).toThrow(/W_GetNumForName: E9M9 not found!/);
  });

  test('throws Error when the data lumps appear out of canonical order', () => {
    expect(() => resolveMapBundle(syntheticOutOfOrderDirectory, 'E1M1')).toThrow(/expected THINGS at index 2/);
  });

  test('throws Error when the bundle runs off the directory end', () => {
    expect(() => resolveMapBundle(syntheticTruncatedDirectory, 'E1M1')).toThrow(/runs off the directory end/);
  });

  test('uppercases the input map name before matching the directory', () => {
    const bundle = resolveMapBundle(syntheticOkDirectory, 'e1m1');
    expect(bundle.mapName).toBe('E1M1');
  });

  test('resolves every shareware DOOM1.WAD map E1M1..E1M9', () => {
    for (const mapNumber of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const mapName = `E1M${mapNumber}`;
      const bundle = resolveMapBundle(liveDirectory, mapName);
      expect(bundle.mapName).toBe(mapName);
      expect(bundle.dataLumps.length).toBe(MAP_BUNDLE_DATA_LUMP_COUNT);
      for (let i = 0; i < MAP_BUNDLE_DATA_LUMP_COUNT; i += 1) {
        expect(bundle.dataLumps[i]!.name).toBe(MAP_BUNDLE_LUMP_NAMES[i]!);
      }
    }
  });

  test('preserves the marker lump size of zero', () => {
    for (const mapNumber of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const mapName = `E1M${mapNumber}`;
      const bundle = resolveMapBundle(liveDirectory, mapName);
      expect(bundle.marker.size).toBe(MAP_MARKER_LUMP_SIZE);
    }
  });
});

describe('isMapMarkerName predicate', () => {
  test('accepts E#M# names with episode and map digits 1..9', () => {
    expect(isMapMarkerName('E1M1')).toBe(true);
    expect(isMapMarkerName('E1M9')).toBe(true);
    expect(isMapMarkerName('E9M9')).toBe(true);
  });

  test('accepts MAP## names with map number 01..32', () => {
    expect(isMapMarkerName('MAP01')).toBe(true);
    expect(isMapMarkerName('MAP15')).toBe(true);
    expect(isMapMarkerName('MAP32')).toBe(true);
  });

  test('rejects non-marker lump names', () => {
    expect(isMapMarkerName('PLAYPAL')).toBe(false);
    expect(isMapMarkerName('THINGS')).toBe(false);
    expect(isMapMarkerName('LINEDEFS')).toBe(false);
    expect(isMapMarkerName('S_START')).toBe(false);
    expect(isMapMarkerName('PNAMES')).toBe(false);
  });

  test('rejects malformed map names (E0M1, E1M0, MAP00, MAP33)', () => {
    expect(isMapMarkerName('E0M1')).toBe(false);
    expect(isMapMarkerName('E1M0')).toBe(false);
    expect(isMapMarkerName('MAP00')).toBe(false);
    expect(isMapMarkerName('MAP33')).toBe(false);
  });

  test('is case-insensitive (matches the upstream W_CheckNumForName uppercase fold)', () => {
    expect(isMapMarkerName('e1m1')).toBe(true);
    expect(isMapMarkerName('map01')).toBe(true);
    expect(isMapMarkerName('Map01')).toBe(true);
  });
});

describe('parseMapMarkerName decoder', () => {
  test('decodes E1M3 into kind=doom1, episode=1, map=3', () => {
    const fields = parseMapMarkerName('E1M3');
    expect(fields).not.toBeNull();
    expect(fields!.kind).toBe('doom1');
    expect(fields!.episode).toBe(1);
    expect(fields!.map).toBe(3);
  });

  test('decodes MAP15 into kind=doom2, episode=1, map=15', () => {
    const fields = parseMapMarkerName('MAP15');
    expect(fields).not.toBeNull();
    expect(fields!.kind).toBe('doom2');
    expect(fields!.episode).toBe(1);
    expect(fields!.map).toBe(15);
  });

  test('returns null for a non-marker name', () => {
    expect(parseMapMarkerName('PLAYPAL')).toBeNull();
    expect(parseMapMarkerName('THINGS')).toBeNull();
  });

  test('decodes lowercase input via the uppercase fold', () => {
    const fields = parseMapMarkerName('e1m1');
    expect(fields).not.toBeNull();
    expect(fields!.kind).toBe('doom1');
    expect(fields!.episode).toBe(1);
    expect(fields!.map).toBe(1);
  });
});

describe('crossCheckMapLumpBundleRuntime', () => {
  test('reports zero failures for the live runtime snapshot', () => {
    expect(crossCheckMapLumpBundleRuntime(liveRuntimeSnapshot)).toEqual([]);
  });

  test('detects a tampered MAP_NAME_PATTERN_DOOM1 (rejects E1M1)', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapNamePatternDoom1AcceptsE1M1: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_NAME_PATTERN_DOOM1_MATCHES_E_DIGIT_M_DIGIT');
    expect(failures).toContain('audit:map-bundle-name-format-doom1-e-m:not-observed');
  });

  test('detects a tampered MAP_NAME_PATTERN_DOOM2 (rejects MAP01)', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapNamePatternDoom2AcceptsMap01: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_NAME_PATTERN_DOOM2_MATCHES_MAP_TWO_DIGITS');
    expect(failures).toContain('audit:map-bundle-name-format-doom2-map-nn:not-observed');
  });

  test('detects a tampered MAP_MARKER_LUMP_SIZE', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapMarkerLumpSize: 1 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_MARKER_LUMP_SIZE_EQUALS_ZERO');
    expect(failures).toContain('audit:map-bundle-marker-size-zero:not-observed');
  });

  test('detects a tampered MAP_BUNDLE_ML_LABEL', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlLabel: 1 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_LABEL_EQUALS_ZERO');
    expect(failures).toContain('audit:map-bundle-ml-label-offset-zero:not-observed');
  });

  test('detects a tampered MAP_BUNDLE_ML_THINGS', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlThings: 0 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_THINGS_EQUALS_ONE');
    expect(failures).toContain('audit:map-bundle-ml-things-offset-one:not-observed');
  });

  test('detects a tampered MAP_BUNDLE_ML_LINEDEFS', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlLinedefs: 1 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_LINEDEFS_EQUALS_TWO');
  });

  test('detects a tampered MAP_BUNDLE_ML_SIDEDEFS', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlSidedefs: 2 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_SIDEDEFS_EQUALS_THREE');
  });

  test('detects a tampered MAP_BUNDLE_ML_VERTEXES', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlVertexes: 3 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_VERTEXES_EQUALS_FOUR');
  });

  test('detects a tampered MAP_BUNDLE_ML_SEGS', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlSegs: 4 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_SEGS_EQUALS_FIVE');
  });

  test('detects a tampered MAP_BUNDLE_ML_SSECTORS', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlSsectors: 5 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_SSECTORS_EQUALS_SIX');
  });

  test('detects a tampered MAP_BUNDLE_ML_NODES', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlNodes: 6 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_NODES_EQUALS_SEVEN');
  });

  test('detects a tampered MAP_BUNDLE_ML_SECTORS', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlSectors: 7 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_SECTORS_EQUALS_EIGHT');
  });

  test('detects a tampered MAP_BUNDLE_ML_REJECT', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlReject: 8 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_REJECT_EQUALS_NINE');
  });

  test('detects a tampered MAP_BUNDLE_ML_BLOCKMAP', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleMlBlockmap: 9 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_ML_BLOCKMAP_EQUALS_TEN');
  });

  test('detects a tampered MAP_BUNDLE_DATA_LUMP_COUNT', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleDataLumpCount: 9 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_DATA_LUMP_COUNT_EQUALS_TEN');
    expect(failures).toContain('audit:map-bundle-data-lump-count-ten:not-observed');
  });

  test('detects a tampered MAP_BUNDLE_TOTAL_LUMP_COUNT', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleTotalLumpCount: 10 };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_TOTAL_LUMP_COUNT_EQUALS_ELEVEN');
    expect(failures).toContain('audit:map-bundle-total-lump-count-eleven:not-observed');
  });

  test('detects a tampered MAP_BUNDLE_LUMP_NAMES order', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, mapBundleLumpNamesMatchFixedOrder: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:MAP_BUNDLE_LUMP_NAMES_FIXED_ORDER');
    expect(failures).toContain('audit:map-bundle-positional-load-via-lumpnum-plus-offset:not-observed');
  });

  test('detects a resolver that fails to freeze the returned bundle', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, resolveMapBundleReturnsFrozenBundle: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:RESOLVE_MAP_BUNDLE_RETURNS_FROZEN_BUNDLE');
  });

  test('detects a resolver that silently accepts a missing map name', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, resolveMapBundleRejectsMissingMapName: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:RESOLVE_MAP_BUNDLE_REJECTS_MISSING_MAP_NAME');
    expect(failures).toContain('audit:map-bundle-name-lookup-via-w-getnumforname:not-observed');
  });

  test('detects a resolver that silently accepts data lumps out of canonical order', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, resolveMapBundleRejectsDataLumpOutOfOrder: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:RESOLVE_MAP_BUNDLE_REJECTS_DATA_LUMP_OUT_OF_ORDER');
    expect(failures).toContain('audit:map-bundle-positional-load-via-lumpnum-plus-offset:not-observed');
  });

  test('detects a resolver that silently accepts a bundle running off the directory end', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, resolveMapBundleRejectsBundleRunningOffDirectoryEnd: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:RESOLVE_MAP_BUNDLE_REJECTS_BUNDLE_RUNNING_OFF_DIRECTORY_END');
  });

  test('detects an isMapMarkerName that no longer accepts E1M1', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, isMapMarkerNameAcceptsE1M1: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:IS_MAP_MARKER_NAME_ACCEPTS_E1M1_AND_MAP01');
    expect(failures).toContain('audit:map-bundle-name-format-doom1-e-m:not-observed');
  });

  test('detects an isMapMarkerName that no longer accepts MAP01', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, isMapMarkerNameAcceptsMap01: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:IS_MAP_MARKER_NAME_ACCEPTS_E1M1_AND_MAP01');
    expect(failures).toContain('audit:map-bundle-name-format-doom2-map-nn:not-observed');
  });

  test('detects an isMapMarkerName that classifies non-map names as map markers', () => {
    const tampered: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot, isMapMarkerNameRejectsNonMapNames: false };
    const failures = crossCheckMapLumpBundleRuntime(tampered);
    expect(failures).toContain('derived:IS_MAP_MARKER_NAME_REJECTS_NON_MAP_NAMES');
  });

  test('reports an empty failure list for a freshly cloned snapshot', () => {
    const cloned: MapLumpBundleRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckMapLumpBundleRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD map bundle oracle', () => {
  test('declares the nine pinned map bundles (E1M1..E1M9)', () => {
    const names = SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles.map((entry) => entry.name);
    expect(names).toEqual(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9']);
  });

  test('every pinned map bundle declares marker size 0', () => {
    for (const oracleEntry of SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles) {
      expect(oracleEntry.markerSize).toBe(MAP_MARKER_LUMP_SIZE);
    }
  });

  test('every pinned map bundle data sha256 matches the live IWAD bytes byte-for-byte', () => {
    for (const oracleEntry of SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles) {
      const directoryEntry = liveDirectory[oracleEntry.markerIndex]!;
      expect(directoryEntry.name).toBe(oracleEntry.name);
      expect(directoryEntry.size).toBe(oracleEntry.markerSize);
      const bundle = resolveMapBundle(liveDirectory, oracleEntry.name);
      const dataSha = hashMapBundleData(wadBuffer, bundle);
      expect(dataSha).toBe(oracleEntry.dataSha256);
      expect(bundle.totalDataBytes).toBe(oracleEntry.totalDataBytes);
    }
  });

  test('every pinned map bundle resolves through resolveMapBundle and matches the oracle marker index', () => {
    for (const oracleEntry of SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles) {
      const bundle = resolveMapBundle(liveDirectory, oracleEntry.name);
      expect(bundle.markerIndex).toBe(oracleEntry.markerIndex);
      expect(bundle.totalDataBytes).toBe(oracleEntry.totalDataBytes);
    }
  });

  test('the live IWAD reports 9 map bundles spanning directory indices 6..94', () => {
    expect(liveOracleSample.mapBundleCount).toBe(SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.mapBundleCount);
    expect(liveOracleSample.firstMapBundleIndex).toBe(SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.firstMapBundleIndex);
    expect(liveOracleSample.lastMapBundleIndex).toBe(SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.lastMapBundleIndex);
  });

  test('every live map sample reports zero failures against the pinned oracle', () => {
    expect(crossCheckShareWareDoom1WadMapBundleSample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on map count and lump categories', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { maps: { name: string; directoryIndex: number; lumps: { name: string }[] }[]; lumpCategories: { 'map-marker': number; 'map-data': number }; mapLumpOrder: string[] };
    expect(manifest.lumpCategories['map-marker']).toBe(SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.mapBundleCount);
    expect(manifest.lumpCategories['map-data']).toBe(SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.mapBundleCount * MAP_BUNDLE_DATA_LUMP_COUNT);
    expect(manifest.mapLumpOrder).toEqual([...MAP_BUNDLE_LUMP_NAMES]);
    expect(manifest.maps.length).toBe(SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.mapBundleCount);
    for (let i = 0; i < manifest.maps.length; i += 1) {
      const manifestMap = manifest.maps[i]!;
      const oracleEntry = SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles[i]!;
      expect(manifestMap.name).toBe(oracleEntry.name);
      expect(manifestMap.directoryIndex).toBe(oracleEntry.markerIndex);
      expect(manifestMap.lumps.map((l) => l.name)).toEqual([...MAP_BUNDLE_LUMP_NAMES]);
    }
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe('DOOM1.WAD');
  });

  test('the live IWAD has no marker range around the map bundles', () => {
    const firstMarkerIndex = SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.firstMapBundleIndex;
    const lastMarkerIndex = SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.lastMapBundleIndex;
    const range = liveDirectory.slice(firstMarkerIndex, lastMarkerIndex + 1 + MAP_BUNDLE_DATA_LUMP_COUNT);
    for (const entry of range) {
      expect(entry.name === 'S_START' || entry.name === 'S_END' || entry.name === 'F_START' || entry.name === 'F_END' || entry.name === 'P_START' || entry.name === 'P_END').toBe(false);
    }
  });

  test("every pinned map bundle's individual data lumps exist at the expected directory indices", () => {
    for (const oracleEntry of SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles) {
      for (let offset = 0; offset < MAP_BUNDLE_DATA_LUMP_COUNT; offset += 1) {
        const expectedName = MAP_BUNDLE_LUMP_NAMES[offset]!;
        const dataIndex = oracleEntry.markerIndex + offset + 1;
        expect(liveDirectory[dataIndex]!.name).toBe(expectedName);
      }
    }
  });

  test("every pinned map bundle's SHA-256 is a 64-character lowercase hex string", () => {
    for (const oracleEntry of SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles) {
      expect(oracleEntry.dataSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("every pinned map bundle's SHA-256 is unique (no two maps share data fingerprints)", () => {
    const hashes = SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.pinnedMapBundles.map((entry) => entry.dataSha256);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});

describe('crossCheckShareWareDoom1WadMapBundleSample failure modes', () => {
  test('detects a wrong mapBundleCount', () => {
    const tampered: ShareWareDoom1WadMapBundleSample = { ...liveOracleSample, mapBundleCount: 999 };
    expect(crossCheckShareWareDoom1WadMapBundleSample(tampered)).toContain('oracle:mapBundleCount:value-mismatch');
  });

  test('detects a wrong firstMapBundleIndex', () => {
    const tampered: ShareWareDoom1WadMapBundleSample = { ...liveOracleSample, firstMapBundleIndex: 0 };
    expect(crossCheckShareWareDoom1WadMapBundleSample(tampered)).toContain('oracle:firstMapBundleIndex:value-mismatch');
  });

  test('detects a wrong lastMapBundleIndex', () => {
    const tampered: ShareWareDoom1WadMapBundleSample = { ...liveOracleSample, lastMapBundleIndex: 0 };
    expect(crossCheckShareWareDoom1WadMapBundleSample(tampered)).toContain('oracle:lastMapBundleIndex:value-mismatch');
  });

  test('detects a missing pinned map bundle', () => {
    const tampered: ShareWareDoom1WadMapBundleSample = {
      ...liveOracleSample,
      pinnedMapBundles: liveOracleSample.pinnedMapBundles.filter((entry) => entry.name !== 'E1M1'),
    };
    expect(crossCheckShareWareDoom1WadMapBundleSample(tampered)).toContain('oracle:map:E1M1:not-found');
  });

  test('detects a wrong markerIndex on a pinned map bundle', () => {
    const tampered: ShareWareDoom1WadMapBundleSample = {
      ...liveOracleSample,
      pinnedMapBundles: liveOracleSample.pinnedMapBundles.map((entry) => (entry.name === 'E1M1' ? { ...entry, markerIndex: 999 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadMapBundleSample(tampered)).toContain('oracle:map:E1M1:markerIndex:value-mismatch');
  });

  test('detects a wrong markerSize on a pinned map bundle', () => {
    const tampered: ShareWareDoom1WadMapBundleSample = {
      ...liveOracleSample,
      pinnedMapBundles: liveOracleSample.pinnedMapBundles.map((entry) => (entry.name === 'E1M1' ? { ...entry, markerSize: 1 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadMapBundleSample(tampered)).toContain('oracle:map:E1M1:markerSize:value-mismatch');
  });

  test('detects a wrong totalDataBytes on a pinned map bundle', () => {
    const tampered: ShareWareDoom1WadMapBundleSample = {
      ...liveOracleSample,
      pinnedMapBundles: liveOracleSample.pinnedMapBundles.map((entry) => (entry.name === 'E1M9' ? { ...entry, totalDataBytes: 0 } : entry)),
    };
    expect(crossCheckShareWareDoom1WadMapBundleSample(tampered)).toContain('oracle:map:E1M9:totalDataBytes:value-mismatch');
  });

  test('detects a wrong dataSha256 on a pinned map bundle', () => {
    const tampered: ShareWareDoom1WadMapBundleSample = {
      ...liveOracleSample,
      pinnedMapBundles: liveOracleSample.pinnedMapBundles.map((entry) => (entry.name === 'E1M3' ? { ...entry, dataSha256: '0'.repeat(64) } : entry)),
    };
    expect(crossCheckShareWareDoom1WadMapBundleSample(tampered)).toContain('oracle:map:E1M3:dataSha256:value-mismatch');
  });
});

describe('shareware DOOM1.WAD map inventory matches the runtime resolver', () => {
  test('every E#M# map name in directory order is reachable through resolveMapBundle', () => {
    for (const { entry } of liveMapMarkerEntries) {
      expect(() => resolveMapBundle(liveDirectory, entry.name)).not.toThrow();
    }
  });

  test('every map marker lump in the directory has size zero', () => {
    for (const { entry } of liveMapMarkerEntries) {
      expect(entry.size).toBe(MAP_MARKER_LUMP_SIZE);
    }
  });

  test('every map marker lump is followed by 10 data lumps in canonical fixed order', () => {
    for (const { entry, index } of liveMapMarkerEntries) {
      expect(entry.size).toBe(MAP_MARKER_LUMP_SIZE);
      for (let offset = 0; offset < MAP_BUNDLE_DATA_LUMP_COUNT; offset += 1) {
        const expected = MAP_BUNDLE_LUMP_NAMES[offset]!;
        expect(liveDirectory[index + offset + 1]!.name).toBe(expected);
      }
    }
  });

  test('every map marker name decodes as kind=doom1 (the shareware IWAD has no MAP## maps)', () => {
    for (const { entry } of liveMapMarkerEntries) {
      const fields = parseMapMarkerName(entry.name);
      expect(fields).not.toBeNull();
      expect(fields!.kind).toBe('doom1');
      expect(fields!.episode).toBe(1);
      expect(fields!.map).toBeGreaterThanOrEqual(1);
      expect(fields!.map).toBeLessThanOrEqual(9);
    }
  });

  test('the data lump names totalled across all 9 maps equal 9 * 10 = 90 entries', () => {
    let totalDataLumps = 0;
    for (const { index } of liveMapMarkerEntries) {
      for (let offset = 0; offset < MAP_BUNDLE_DATA_LUMP_COUNT; offset += 1) {
        const dataEntry = liveDirectory[index + offset + 1]!;
        if (MAP_BUNDLE_LUMP_NAMES.includes(dataEntry.name)) {
          totalDataLumps += 1;
        }
      }
    }
    expect(totalDataLumps).toBe(SHAREWARE_DOOM1_WAD_MAP_BUNDLE_ORACLE.mapBundleCount * MAP_BUNDLE_DATA_LUMP_COUNT);
  });

  test('the live IWAD lump count matches PRIMARY_TARGET.wadLumpCount', () => {
    expect(liveDirectory.length).toBe(PRIMARY_TARGET.wadLumpCount);
  });

  test('hashMapBundleData reproduces a known SHA-256 for E1M1', () => {
    const bundle = resolveMapBundle(liveDirectory, 'E1M1');
    const digest = hashMapBundleData(wadBuffer, bundle);
    expect(digest).toBe('df5c2697f6b8c9cb948eb7bb9b098b2ff0c06af3b497c911070c06a19c922eed');
  });

  test('the explicit per-data-lump hashing path agrees with hashMapBundleData', () => {
    for (const { entry } of liveMapMarkerEntries) {
      const bundle = resolveMapBundle(liveDirectory, entry.name);
      const helperDigest = hashMapBundleData(wadBuffer, bundle);
      const manualHash = createHash('sha256');
      for (const dataLump of bundle.dataLumps) {
        manualHash.update(wadBuffer.subarray(dataLump.offset, dataLump.offset + dataLump.size));
      }
      expect(helperDigest).toBe(manualHash.digest('hex'));
    }
  });
});

describe('05-015 step file declarations', () => {
  test('the step file declares the wad lane with the correct write lock and prerequisite', async () => {
    const stepFileText = await Bun.file('plan_vanilla_parity/steps/05-015-parse-map-lump-bundle-boundaries.md').text();
    expect(stepFileText.includes('lane\n\nwad')).toBe(true);
    expect(stepFileText.includes('src/assets/parse-map-lump-bundle-boundaries.ts')).toBe(true);
    expect(stepFileText.includes('test/vanilla_parity/wad/parse-map-lump-bundle-boundaries.test.ts')).toBe(true);
    expect(stepFileText.includes('00-018')).toBe(true);
  });
});
