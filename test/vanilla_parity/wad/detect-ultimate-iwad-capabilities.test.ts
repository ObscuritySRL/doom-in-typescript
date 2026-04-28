import { describe, expect, test } from 'bun:test';

import { EPISODE_COUNTS } from '../../../src/bootstrap/gameMode.ts';
import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import {
  ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE,
  ULTIMATE_IWAD_CAPABILITY_AUDIT,
  ULTIMATE_IWAD_CAPABILITY_DERIVED_INVARIANTS,
  ULTIMATE_IWAD_EPISODE_COUNT,
  ULTIMATE_IWAD_MAP_BUNDLE_COUNT,
  ULTIMATE_NEGATIVE_FINGERPRINT_LUMPS,
  ULTIMATE_REQUIRED_DEMO_LUMPS,
  ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS,
  ULTIMATE_REQUIRED_MARKER_RANGES,
  ULTIMATE_REQUIRED_SPRITE_PREFIXES,
  crossCheckUltimateDoomWadCapabilitySample,
  crossCheckUltimateIwadCapabilityRuntime,
  detectUltimateIwadCapabilities,
  isUltimateIwad,
} from '../../../src/assets/detect-ultimate-iwad-capabilities.ts';
import type { UltimateDoomWadCapabilityFlags, UltimateDoomWadCapabilitySample, UltimateIwadCapabilityAuditEntry, UltimateIwadCapabilityRuntimeSnapshot } from '../../../src/assets/detect-ultimate-iwad-capabilities.ts';

const ALLOWED_AXIS_IDS = new Set<UltimateIwadCapabilityAuditEntry['id']>([
  'ultimate-wad-type-is-iwad',
  'ultimate-map-bundle-count-is-thirtysix',
  'ultimate-episode1-map-count-is-nine',
  'ultimate-episode2-map-count-is-nine',
  'ultimate-episode3-map-count-is-nine',
  'ultimate-episode4-map-count-is-nine',
  'ultimate-doom2-map-markers-absent',
  'ultimate-texture1-present',
  'ultimate-texture2-present',
  'ultimate-pnames-present',
  'ultimate-playpal-and-colormap-present',
  'ultimate-endoom-present',
  'ultimate-genmidi-and-dmxgus-present',
  'ultimate-titlepic-and-credit-present',
  'ultimate-help1-present',
  'ultimate-stbar-and-starms-present',
  'ultimate-sky1-sky2-sky3-sky4-present',
  'ultimate-wimap0-wimap1-wimap2-present',
  'ultimate-victory2-present',
  'ultimate-endpic-present',
  'ultimate-pfub-bunny-scroll-patches-present',
  'ultimate-bossback-absent',
  'ultimate-four-demos-present',
  'ultimate-flat-marker-range-present',
  'ultimate-sprite-marker-range-present',
  'ultimate-patch-marker-range-present',
  'ultimate-cyberdemon-sprite-present',
  'ultimate-spider-mastermind-sprite-present',
]);

const ALLOWED_SUBJECTS = new Set<UltimateIwadCapabilityAuditEntry['subject']>([
  'wad-header',
  'wad-directory',
  'map-marker-lump',
  'texture-lump',
  'patch-name-lump',
  'palette-lump',
  'audio-lump',
  'menu-screen-lump',
  'status-bar-lump',
  'sky-texture-lump',
  'intermission-lump',
  'finale-lump',
  'demo-lump',
  'marker-range',
  'sprite-frame-lump',
]);

const ALLOWED_REFERENCE_FILES = new Set<UltimateIwadCapabilityAuditEntry['referenceSourceFile']>([
  'linuxdoom-1.10/d_main.c',
  'linuxdoom-1.10/r_data.c',
  'linuxdoom-1.10/p_setup.c',
  'linuxdoom-1.10/m_menu.c',
  'linuxdoom-1.10/wi_stuff.c',
  'linuxdoom-1.10/f_finale.c',
  'linuxdoom-1.10/g_game.c',
  'src/doom/d_main.c',
  'src/doom/r_data.c',
]);

function buildSyntheticDirectory(extraNames: readonly string[] = [], ultimateDefaults = true): DirectoryEntry[] {
  const directory: DirectoryEntry[] = [];
  if (ultimateDefaults) {
    for (const name of [
      'PLAYPAL',
      'COLORMAP',
      'ENDOOM',
      'TEXTURE1',
      'TEXTURE2',
      'PNAMES',
      'GENMIDI',
      'DMXGUS',
      'TITLEPIC',
      'CREDIT',
      'HELP1',
      'STBAR',
      'STARMS',
      'SKY1',
      'SKY2',
      'SKY3',
      'SKY4',
      'WIMAP0',
      'WIMAP1',
      'WIMAP2',
      'VICTORY2',
      'ENDPIC',
      'PFUB1',
      'PFUB2',
      'DEMO1',
      'DEMO2',
      'DEMO3',
      'DEMO4',
      'F_START',
      'F_END',
      'S_START',
      'S_END',
      'P_START',
      'P_END',
      'CYBRA1',
      'SPIDA1A2',
    ]) {
      directory.push(Object.freeze({ offset: 0, size: 0, name }));
    }
    for (let m = 1; m <= 9; m += 1) {
      directory.push(Object.freeze({ offset: 0, size: 0, name: `E1M${m}` }));
    }
    for (let m = 1; m <= 9; m += 1) {
      directory.push(Object.freeze({ offset: 0, size: 0, name: `E2M${m}` }));
    }
    for (let m = 1; m <= 9; m += 1) {
      directory.push(Object.freeze({ offset: 0, size: 0, name: `E3M${m}` }));
    }
    for (let m = 1; m <= 9; m += 1) {
      directory.push(Object.freeze({ offset: 0, size: 0, name: `E4M${m}` }));
    }
  }
  for (const name of extraNames) {
    directory.push(Object.freeze({ offset: 0, size: 0, name }));
  }
  return directory;
}

const syntheticUltimateDirectory = buildSyntheticDirectory();
const syntheticDirectoryWithMap01 = buildSyntheticDirectory(['MAP01']);
const syntheticDirectoryEmpty = buildSyntheticDirectory([], false);
const syntheticPwadDirectory = buildSyntheticDirectory();

function buildRegisteredShapedDirectory(): DirectoryEntry[] {
  const directory: DirectoryEntry[] = [];
  for (const name of [
    'PLAYPAL',
    'COLORMAP',
    'ENDOOM',
    'TEXTURE1',
    'TEXTURE2',
    'PNAMES',
    'GENMIDI',
    'DMXGUS',
    'TITLEPIC',
    'CREDIT',
    'HELP1',
    'HELP2',
    'STBAR',
    'STARMS',
    'SKY1',
    'SKY2',
    'SKY3',
    'WIMAP0',
    'WIMAP1',
    'WIMAP2',
    'VICTORY2',
    'ENDPIC',
    'PFUB1',
    'PFUB2',
    'DEMO1',
    'DEMO2',
    'DEMO3',
    'F_START',
    'F_END',
    'S_START',
    'S_END',
    'P_START',
    'P_END',
    'CYBRA1',
    'SPIDA1A2',
  ]) {
    directory.push(Object.freeze({ offset: 0, size: 0, name }));
  }
  for (let m = 1; m <= 9; m += 1) {
    directory.push(Object.freeze({ offset: 0, size: 0, name: `E1M${m}` }));
  }
  for (let m = 1; m <= 9; m += 1) {
    directory.push(Object.freeze({ offset: 0, size: 0, name: `E2M${m}` }));
  }
  for (let m = 1; m <= 9; m += 1) {
    directory.push(Object.freeze({ offset: 0, size: 0, name: `E3M${m}` }));
  }
  return directory;
}

const syntheticRegisteredDirectory = buildRegisteredShapedDirectory();
const syntheticDirectoryMissingE2M1 = syntheticUltimateDirectory.filter((entry) => entry.name !== 'E2M1');
const syntheticDirectoryMissingE3M1 = syntheticUltimateDirectory.filter((entry) => entry.name !== 'E3M1');
const syntheticDirectoryMissingE4M1 = syntheticUltimateDirectory.filter((entry) => entry.name !== 'E4M1');
const syntheticDirectoryMissingTexture2 = syntheticUltimateDirectory.filter((entry) => entry.name !== 'TEXTURE2');

const syntheticUltimateDetection = detectUltimateIwadCapabilities(syntheticUltimateDirectory, 'IWAD');

function buildRuntimeSnapshot(): UltimateIwadCapabilityRuntimeSnapshot {
  const detectionAsPwad = detectUltimateIwadCapabilities(syntheticUltimateDirectory, 'PWAD');
  return {
    ultimateIwadMapBundleCount: ULTIMATE_IWAD_MAP_BUNDLE_COUNT,
    ultimateIwadEpisodeCount: ULTIMATE_IWAD_EPISODE_COUNT,
    detectUltimateReturnsFrozenDetection: Object.isFrozen(syntheticUltimateDetection),
    detectUltimatePropagatesPwadType: detectionAsPwad.wadType === 'PWAD',
    isUltimateIwadAcceptsSyntheticUltimate: isUltimateIwad(syntheticUltimateDirectory, 'IWAD'),
    isUltimateIwadRejectsE4M1Absent: isUltimateIwad(syntheticDirectoryMissingE4M1, 'IWAD') === false,
    isUltimateIwadRejectsMap01Present: isUltimateIwad(syntheticDirectoryWithMap01, 'IWAD') === false,
    isUltimateIwadRejectsTexture2Absent: isUltimateIwad(syntheticDirectoryMissingTexture2, 'IWAD') === false,
    isUltimateIwadRejectsE2M1Absent: isUltimateIwad(syntheticDirectoryMissingE2M1, 'IWAD') === false,
    isUltimateIwadRejectsE3M1Absent: isUltimateIwad(syntheticDirectoryMissingE3M1, 'IWAD') === false,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildRuntimeSnapshot());

function buildOracleSample(detection: ReturnType<typeof detectUltimateIwadCapabilities>): UltimateDoomWadCapabilitySample {
  return {
    wadType: detection.wadType,
    mapBundleCount: detection.mapBundleCount,
    episode1MapCount: detection.episode1MapCount,
    episode2MapCount: detection.episode2MapCount,
    episode3MapCount: detection.episode3MapCount,
    episode4MapCount: detection.episode4MapCount,
    doom2MapCount: detection.doom2MapCount,
    capabilityFlags: {
      hasTexture1: detection.hasTexture1,
      hasTexture2: detection.hasTexture2,
      hasPnames: detection.hasPnames,
      hasPlaypal: detection.hasPlaypal,
      hasColormap: detection.hasColormap,
      hasEndoom: detection.hasEndoom,
      hasGenmidi: detection.hasGenmidi,
      hasDmxgus: detection.hasDmxgus,
      hasTitlepic: detection.hasTitlepic,
      hasCredit: detection.hasCredit,
      hasHelp1: detection.hasHelp1,
      hasStbar: detection.hasStbar,
      hasStarms: detection.hasStarms,
      hasSky1: detection.hasSky1,
      hasSky2: detection.hasSky2,
      hasSky3: detection.hasSky3,
      hasSky4: detection.hasSky4,
      hasWimap0: detection.hasWimap0,
      hasWimap1: detection.hasWimap1,
      hasWimap2: detection.hasWimap2,
      hasVictory2: detection.hasVictory2,
      hasEndpic: detection.hasEndpic,
      hasPfub1: detection.hasPfub1,
      hasPfub2: detection.hasPfub2,
      hasBossback: detection.hasBossback,
      hasDemo1: detection.hasDemo1,
      hasDemo2: detection.hasDemo2,
      hasDemo3: detection.hasDemo3,
      hasDemo4: detection.hasDemo4,
      hasFlatMarkerRange: detection.hasFlatMarkerRange,
      hasSpriteMarkerRange: detection.hasSpriteMarkerRange,
      hasPatchMarkerRange: detection.hasPatchMarkerRange,
      hasCyberdemonSprite: detection.hasCyberdemonSprite,
      hasSpiderMastermindSprite: detection.hasSpiderMastermindSprite,
    },
  };
}

const syntheticOracleSample = buildOracleSample(syntheticUltimateDetection);

describe('Ultimate iwad capability audit ledger shape', () => {
  test('audits exactly twenty-eight behavioral axes', () => {
    expect(ULTIMATE_IWAD_CAPABILITY_AUDIT.length).toBe(28);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of ULTIMATE_IWAD_CAPABILITY_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = ULTIMATE_IWAD_CAPABILITY_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of ULTIMATE_IWAD_CAPABILITY_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of ULTIMATE_IWAD_CAPABILITY_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of ULTIMATE_IWAD_CAPABILITY_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of ULTIMATE_IWAD_CAPABILITY_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the wad-type axis pins the IWAD identification stamp', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-wad-type-is-iwad');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('wad-header');
    expect(entry!.invariant.includes('IWAD')).toBe(true);
  });

  test('the texture2-present axis cites the upstream W_CheckNumForName conditional', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-texture2-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('W_CheckNumForName'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('TEXTURE2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/r_data.c');
  });

  test('the episode4-map-count-is-nine axis cites the upstream retail gate', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-episode4-map-count-is-nine');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('retail'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/d_main.c');
  });

  test('the doom2-map-markers-absent axis cites the upstream sprintf "map%02i" formatter', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-doom2-map-markers-absent');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('"map%02i"'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/g_game.c');
  });

  test('the sky1-sky2-sky3-sky4-present axis cites every per-episode skytexname case', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-sky1-sky2-sky3-sky4-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('SKY1'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('SKY2'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('SKY3'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('SKY4'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/g_game.c');
  });

  test('the four-demos-present axis cites every per-demo lumpname literal', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-four-demos-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('DEMO1'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('DEMO2'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('DEMO3'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('DEMO4'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/d_main.c');
  });

  test('the help1-present axis cites the upstream M_DrawReadThis1 V_DrawPatchDirect', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-help1-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('HELP1'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/m_menu.c');
  });

  test('the victory2-present axis cites the upstream VICTORY2 V_DrawPatchDirect', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-victory2-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('VICTORY2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/f_finale.c');
  });

  test('the endpic-present axis cites the upstream ENDPIC V_DrawPatchDirect', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-endpic-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('ENDPIC'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/f_finale.c');
  });

  test('the pfub-bunny-scroll-patches-present axis cites W_CacheLumpName for PFUB1/PFUB2', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-pfub-bunny-scroll-patches-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('PFUB1'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('PFUB2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/f_finale.c');
  });

  test('the bossback-absent axis cites F_CastDrawer commercial-only cast call', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-bossback-absent');
    expect(entry).toBeDefined();
    expect(entry!.invariant.includes('commercial')).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/f_finale.c');
  });

  test('the wimap0-wimap1-wimap2-present axis cites the upstream WIMAP%i sprintf formatter', () => {
    const entry = ULTIMATE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'ultimate-wimap0-wimap1-wimap2-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('WIMAP'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/wi_stuff.c');
  });
});

describe('Ultimate iwad capability derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = ULTIMATE_IWAD_CAPABILITY_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(ULTIMATE_IWAD_CAPABILITY_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'ULTIMATE_IWAD_MAP_BUNDLE_COUNT_EQUALS_THIRTYSIX',
        'ULTIMATE_IWAD_EPISODE_COUNT_EQUALS_FOUR',
        'DETECT_ULTIMATE_RETURNS_FROZEN_DETECTION',
        'DETECT_ULTIMATE_PROPAGATES_PWAD_TYPE',
        'IS_ULTIMATE_IWAD_ACCEPTS_SYNTHETIC_ULTIMATE',
        'IS_ULTIMATE_IWAD_REJECTS_E4M1_ABSENT',
        'IS_ULTIMATE_IWAD_REJECTS_MAP01_PRESENT',
        'IS_ULTIMATE_IWAD_REJECTS_TEXTURE2_ABSENT',
        'IS_ULTIMATE_IWAD_REJECTS_E2M1_ABSENT',
        'IS_ULTIMATE_IWAD_REJECTS_E3M1_ABSENT',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of ULTIMATE_IWAD_CAPABILITY_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('ULTIMATE_IWAD_MAP_BUNDLE_COUNT equals 36', () => {
    expect(ULTIMATE_IWAD_MAP_BUNDLE_COUNT).toBe(36);
  });

  test('ULTIMATE_IWAD_EPISODE_COUNT equals 4 and matches EPISODE_COUNTS.retail', () => {
    expect(ULTIMATE_IWAD_EPISODE_COUNT).toBe(4);
    expect(ULTIMATE_IWAD_EPISODE_COUNT).toBe(EPISODE_COUNTS.retail);
  });

  test('ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS is a frozen list of mandatory lumps', () => {
    expect(Object.isFrozen(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS)).toBe(true);
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PLAYPAL');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('COLORMAP');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('TEXTURE1');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('TEXTURE2');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PNAMES');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('TITLEPIC');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('SKY1');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('SKY2');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('SKY3');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('SKY4');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('WIMAP0');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('WIMAP1');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('WIMAP2');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('VICTORY2');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('ENDPIC');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PFUB1');
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PFUB2');
  });

  test('ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS does not pin HELP2 (gameversion-specific)', () => {
    expect(ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS).not.toContain('HELP2');
  });

  test('ULTIMATE_REQUIRED_DEMO_LUMPS lists the four demos including DEMO4', () => {
    expect(Object.isFrozen(ULTIMATE_REQUIRED_DEMO_LUMPS)).toBe(true);
    expect(ULTIMATE_REQUIRED_DEMO_LUMPS).toEqual(['DEMO1', 'DEMO2', 'DEMO3', 'DEMO4']);
  });

  test('ULTIMATE_REQUIRED_MARKER_RANGES lists the three marker pairs', () => {
    expect(Object.isFrozen(ULTIMATE_REQUIRED_MARKER_RANGES)).toBe(true);
    expect(ULTIMATE_REQUIRED_MARKER_RANGES).toEqual(['F_START', 'F_END', 'S_START', 'S_END', 'P_START', 'P_END']);
  });

  test('ULTIMATE_REQUIRED_SPRITE_PREFIXES lists the boss sprite prefixes', () => {
    expect(Object.isFrozen(ULTIMATE_REQUIRED_SPRITE_PREFIXES)).toBe(true);
    expect(ULTIMATE_REQUIRED_SPRITE_PREFIXES).toEqual(['CYBR', 'SPID']);
  });

  test('ULTIMATE_NEGATIVE_FINGERPRINT_LUMPS lists the commercial-only lumps', () => {
    expect(Object.isFrozen(ULTIMATE_NEGATIVE_FINGERPRINT_LUMPS)).toBe(true);
    expect(ULTIMATE_NEGATIVE_FINGERPRINT_LUMPS).toContain('MAP01');
    expect(ULTIMATE_NEGATIVE_FINGERPRINT_LUMPS).toContain('BOSSBACK');
  });
});

describe('detectUltimateIwadCapabilities runtime', () => {
  test('returns a frozen detection for the synthesized Ultimate directory', () => {
    expect(Object.isFrozen(syntheticUltimateDetection)).toBe(true);
  });

  test('reports the WAD type from the supplied header type', () => {
    const detectionAsIwad = detectUltimateIwadCapabilities(syntheticUltimateDirectory, 'IWAD');
    const detectionAsPwad = detectUltimateIwadCapabilities(syntheticUltimateDirectory, 'PWAD');
    expect(detectionAsIwad.wadType).toBe('IWAD');
    expect(detectionAsPwad.wadType).toBe('PWAD');
  });

  test('reports mapBundleCount as 36 for the synthesized Ultimate directory', () => {
    expect(syntheticUltimateDetection.mapBundleCount).toBe(36);
  });

  test('reports per-episode map counts (9, 9, 9, 9, 0) for the synthesized Ultimate directory', () => {
    expect(syntheticUltimateDetection.episode1MapCount).toBe(9);
    expect(syntheticUltimateDetection.episode2MapCount).toBe(9);
    expect(syntheticUltimateDetection.episode3MapCount).toBe(9);
    expect(syntheticUltimateDetection.episode4MapCount).toBe(9);
    expect(syntheticUltimateDetection.doom2MapCount).toBe(0);
  });

  test('reports hasTexture1 and hasTexture2 both true for the synthesized Ultimate directory', () => {
    expect(syntheticUltimateDetection.hasTexture1).toBe(true);
    expect(syntheticUltimateDetection.hasTexture2).toBe(true);
  });

  test('reports every required infrastructure lump as present for the synthesized Ultimate directory', () => {
    expect(syntheticUltimateDetection.hasPlaypal).toBe(true);
    expect(syntheticUltimateDetection.hasColormap).toBe(true);
    expect(syntheticUltimateDetection.hasEndoom).toBe(true);
    expect(syntheticUltimateDetection.hasPnames).toBe(true);
    expect(syntheticUltimateDetection.hasGenmidi).toBe(true);
    expect(syntheticUltimateDetection.hasDmxgus).toBe(true);
    expect(syntheticUltimateDetection.hasTitlepic).toBe(true);
    expect(syntheticUltimateDetection.hasCredit).toBe(true);
    expect(syntheticUltimateDetection.hasHelp1).toBe(true);
    expect(syntheticUltimateDetection.hasStbar).toBe(true);
    expect(syntheticUltimateDetection.hasStarms).toBe(true);
    expect(syntheticUltimateDetection.hasSky1).toBe(true);
    expect(syntheticUltimateDetection.hasSky2).toBe(true);
    expect(syntheticUltimateDetection.hasSky3).toBe(true);
    expect(syntheticUltimateDetection.hasSky4).toBe(true);
    expect(syntheticUltimateDetection.hasWimap0).toBe(true);
    expect(syntheticUltimateDetection.hasWimap1).toBe(true);
    expect(syntheticUltimateDetection.hasWimap2).toBe(true);
    expect(syntheticUltimateDetection.hasVictory2).toBe(true);
    expect(syntheticUltimateDetection.hasEndpic).toBe(true);
    expect(syntheticUltimateDetection.hasPfub1).toBe(true);
    expect(syntheticUltimateDetection.hasPfub2).toBe(true);
  });

  test('reports BOSSBACK as absent for the synthesized Ultimate directory', () => {
    expect(syntheticUltimateDetection.hasBossback).toBe(false);
  });

  test('reports DEMO1, DEMO2, DEMO3, DEMO4 all present for the synthesized Ultimate directory', () => {
    expect(syntheticUltimateDetection.hasDemo1).toBe(true);
    expect(syntheticUltimateDetection.hasDemo2).toBe(true);
    expect(syntheticUltimateDetection.hasDemo3).toBe(true);
    expect(syntheticUltimateDetection.hasDemo4).toBe(true);
  });

  test('reports F_START/F_END, S_START/S_END, P_START/P_END marker ranges as present', () => {
    expect(syntheticUltimateDetection.hasFlatMarkerRange).toBe(true);
    expect(syntheticUltimateDetection.hasSpriteMarkerRange).toBe(true);
    expect(syntheticUltimateDetection.hasPatchMarkerRange).toBe(true);
  });

  test('reports CYBR (Cyberdemon) and SPID (Spider Mastermind) sprite prefixes as present', () => {
    expect(syntheticUltimateDetection.hasCyberdemonSprite).toBe(true);
    expect(syntheticUltimateDetection.hasSpiderMastermindSprite).toBe(true);
  });

  test('treats lump names case-insensitively (uppercased before lookup)', () => {
    const lowerDirectory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'playpal' }), Object.freeze({ offset: 0, size: 0, name: 'sky4' }), Object.freeze({ offset: 0, size: 0, name: 'e4m1' })];
    const detection = detectUltimateIwadCapabilities(lowerDirectory, 'IWAD');
    expect(detection.hasPlaypal).toBe(true);
    expect(detection.hasSky4).toBe(true);
    expect(detection.episode4MapCount).toBe(1);
  });

  test('reports zero map bundles for an empty directory', () => {
    const detection = detectUltimateIwadCapabilities(syntheticDirectoryEmpty, 'IWAD');
    expect(detection.mapBundleCount).toBe(0);
    expect(detection.episode1MapCount).toBe(0);
    expect(detection.totalLumpCount).toBe(0);
  });

  test('reports doom2 map count as 1 when the directory contains MAP01', () => {
    const detection = detectUltimateIwadCapabilities(syntheticDirectoryWithMap01, 'IWAD');
    expect(detection.doom2MapCount).toBe(1);
  });

  test('reports hasTexture2 false when the directory does not contain TEXTURE2', () => {
    const detection = detectUltimateIwadCapabilities(syntheticDirectoryMissingTexture2, 'IWAD');
    expect(detection.hasTexture2).toBe(false);
    expect(detection.hasTexture1).toBe(true);
  });

  test('reports CYBR sprite prefix as present when the directory contains CYBRA1', () => {
    const directory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'CYBRA1' })];
    const detection = detectUltimateIwadCapabilities(directory, 'IWAD');
    expect(detection.hasCyberdemonSprite).toBe(true);
  });

  test('reports SPID sprite prefix as present when the directory contains SPIDA1A2', () => {
    const directory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'SPIDA1A2' })];
    const detection = detectUltimateIwadCapabilities(directory, 'IWAD');
    expect(detection.hasSpiderMastermindSprite).toBe(true);
  });
});

describe('isUltimateIwad predicate', () => {
  test('returns true for a synthesized Ultimate-shaped directory', () => {
    expect(isUltimateIwad(syntheticUltimateDirectory, 'IWAD')).toBe(true);
  });

  test('returns false for a directory missing E4M1 (registered shape)', () => {
    expect(isUltimateIwad(syntheticDirectoryMissingE4M1, 'IWAD')).toBe(false);
  });

  test('returns false for a directory that contains MAP01 (commercial)', () => {
    expect(isUltimateIwad(syntheticDirectoryWithMap01, 'IWAD')).toBe(false);
  });

  test('returns false for a directory missing TEXTURE2 (shareware shape)', () => {
    expect(isUltimateIwad(syntheticDirectoryMissingTexture2, 'IWAD')).toBe(false);
  });

  test('returns false for a directory missing E2M1 (incomplete ep2)', () => {
    expect(isUltimateIwad(syntheticDirectoryMissingE2M1, 'IWAD')).toBe(false);
  });

  test('returns false for a directory missing E3M1 (shareware/incomplete shape)', () => {
    expect(isUltimateIwad(syntheticDirectoryMissingE3M1, 'IWAD')).toBe(false);
  });

  test('returns false for the registered-shaped directory (no ep4)', () => {
    expect(isUltimateIwad(syntheticRegisteredDirectory, 'IWAD')).toBe(false);
  });

  test('returns false when the WAD type is PWAD', () => {
    expect(isUltimateIwad(syntheticPwadDirectory, 'PWAD')).toBe(false);
  });

  test('returns false for an empty directory', () => {
    expect(isUltimateIwad(syntheticDirectoryEmpty, 'IWAD')).toBe(false);
  });
});

describe('crossCheckUltimateIwadCapabilityRuntime', () => {
  test('reports zero failures for the live runtime snapshot', () => {
    expect(crossCheckUltimateIwadCapabilityRuntime(liveRuntimeSnapshot)).toEqual([]);
  });

  test('detects a tampered ultimateIwadMapBundleCount', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, ultimateIwadMapBundleCount: 27 };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:ULTIMATE_IWAD_MAP_BUNDLE_COUNT_EQUALS_THIRTYSIX');
    expect(failures).toContain('audit:ultimate-map-bundle-count-is-thirtysix:not-observed');
  });

  test('detects a tampered ultimateIwadEpisodeCount', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, ultimateIwadEpisodeCount: 3 };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:ULTIMATE_IWAD_EPISODE_COUNT_EQUALS_FOUR');
  });

  test('detects a detector that fails to freeze the returned detection', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, detectUltimateReturnsFrozenDetection: false };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:DETECT_ULTIMATE_RETURNS_FROZEN_DETECTION');
  });

  test('detects a detector that does not propagate the PWAD wad type', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, detectUltimatePropagatesPwadType: false };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:DETECT_ULTIMATE_PROPAGATES_PWAD_TYPE');
    expect(failures).toContain('audit:ultimate-wad-type-is-iwad:not-observed');
  });

  test('detects an isUltimateIwad that rejects a synthesized Ultimate shape', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isUltimateIwadAcceptsSyntheticUltimate: false };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_ULTIMATE_IWAD_ACCEPTS_SYNTHETIC_ULTIMATE');
    expect(failures).toContain('audit:ultimate-episode4-map-count-is-nine:not-observed');
  });

  test('detects an isUltimateIwad that accepts a directory missing E4M1', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isUltimateIwadRejectsE4M1Absent: false };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_ULTIMATE_IWAD_REJECTS_E4M1_ABSENT');
    expect(failures).toContain('audit:ultimate-episode4-map-count-is-nine:not-observed');
  });

  test('detects an isUltimateIwad that accepts a directory containing MAP01', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isUltimateIwadRejectsMap01Present: false };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_ULTIMATE_IWAD_REJECTS_MAP01_PRESENT');
    expect(failures).toContain('audit:ultimate-doom2-map-markers-absent:not-observed');
  });

  test('detects an isUltimateIwad that accepts a directory missing TEXTURE2', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isUltimateIwadRejectsTexture2Absent: false };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_ULTIMATE_IWAD_REJECTS_TEXTURE2_ABSENT');
    expect(failures).toContain('audit:ultimate-texture2-present:not-observed');
  });

  test('detects an isUltimateIwad that accepts a directory missing E2M1', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isUltimateIwadRejectsE2M1Absent: false };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_ULTIMATE_IWAD_REJECTS_E2M1_ABSENT');
    expect(failures).toContain('audit:ultimate-episode2-map-count-is-nine:not-observed');
  });

  test('detects an isUltimateIwad that accepts a directory missing E3M1', () => {
    const tampered: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isUltimateIwadRejectsE3M1Absent: false };
    const failures = crossCheckUltimateIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_ULTIMATE_IWAD_REJECTS_E3M1_ABSENT');
    expect(failures).toContain('audit:ultimate-episode3-map-count-is-nine:not-observed');
  });

  test('reports an empty failure list for a freshly cloned snapshot', () => {
    const cloned: UltimateIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckUltimateIwadCapabilityRuntime(cloned)).toEqual([]);
  });
});

describe('Ultimate doomu.wad capability oracle', () => {
  test('declares the canonical Ultimate filename, IWAD type, and 36 map count', () => {
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.filename).toBe('doomu.wad');
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.wadType).toBe('IWAD');
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.mapBundleCount).toBe(36);
  });

  test('pins the 9+9+9+9 episode-1/2/3/4 maps and zero non-Ultimate map markers', () => {
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.episode1MapCount).toBe(9);
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.episode2MapCount).toBe(9);
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.episode3MapCount).toBe(9);
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.episode4MapCount).toBe(9);
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.doom2MapCount).toBe(0);
  });

  test('pins TEXTURE1 and TEXTURE2 both present', () => {
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags.hasTexture1).toBe(true);
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags.hasTexture2).toBe(true);
  });

  test('pins every required infrastructure lump as present', () => {
    const flags = ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasPlaypal).toBe(true);
    expect(flags.hasColormap).toBe(true);
    expect(flags.hasPnames).toBe(true);
    expect(flags.hasEndoom).toBe(true);
    expect(flags.hasGenmidi).toBe(true);
    expect(flags.hasDmxgus).toBe(true);
    expect(flags.hasTitlepic).toBe(true);
    expect(flags.hasCredit).toBe(true);
    expect(flags.hasHelp1).toBe(true);
    expect(flags.hasStbar).toBe(true);
    expect(flags.hasStarms).toBe(true);
    expect(flags.hasSky1).toBe(true);
    expect(flags.hasSky2).toBe(true);
    expect(flags.hasSky3).toBe(true);
    expect(flags.hasSky4).toBe(true);
    expect(flags.hasWimap0).toBe(true);
    expect(flags.hasWimap1).toBe(true);
    expect(flags.hasWimap2).toBe(true);
    expect(flags.hasVictory2).toBe(true);
    expect(flags.hasEndpic).toBe(true);
    expect(flags.hasPfub1).toBe(true);
    expect(flags.hasPfub2).toBe(true);
  });

  test('pins BOSSBACK as absent (commercial-only)', () => {
    expect(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags.hasBossback).toBe(false);
  });

  test('pins all four DEMO lumps (DEMO1..DEMO4) as present', () => {
    const flags = ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasDemo1).toBe(true);
    expect(flags.hasDemo2).toBe(true);
    expect(flags.hasDemo3).toBe(true);
    expect(flags.hasDemo4).toBe(true);
  });

  test('pins F_START/F_END, S_START/S_END, P_START/P_END marker ranges as present', () => {
    const flags = ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasFlatMarkerRange).toBe(true);
    expect(flags.hasSpriteMarkerRange).toBe(true);
    expect(flags.hasPatchMarkerRange).toBe(true);
  });

  test('pins boss sprite prefixes (CYBR, SPID) as present', () => {
    const flags = ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasCyberdemonSprite).toBe(true);
    expect(flags.hasSpiderMastermindSprite).toBe(true);
  });

  test('the oracle and its capability flags are deeply frozen', () => {
    expect(Object.isFrozen(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE)).toBe(true);
    expect(Object.isFrozen(ULTIMATE_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags)).toBe(true);
  });

  test('the synthesized oracle sample reports zero failures against the pinned oracle', () => {
    expect(crossCheckUltimateDoomWadCapabilitySample(syntheticOracleSample)).toEqual([]);
  });
});

describe('crossCheckUltimateDoomWadCapabilitySample failure modes', () => {
  test('detects a wrong wadType', () => {
    const tampered: UltimateDoomWadCapabilitySample = { ...syntheticOracleSample, wadType: 'PWAD' };
    expect(crossCheckUltimateDoomWadCapabilitySample(tampered)).toContain('oracle:wadType:value-mismatch');
  });

  test('detects a wrong mapBundleCount', () => {
    const tampered: UltimateDoomWadCapabilitySample = { ...syntheticOracleSample, mapBundleCount: 27 };
    expect(crossCheckUltimateDoomWadCapabilitySample(tampered)).toContain('oracle:mapBundleCount:value-mismatch');
  });

  test('detects a wrong episode1MapCount', () => {
    const tampered: UltimateDoomWadCapabilitySample = { ...syntheticOracleSample, episode1MapCount: 8 };
    expect(crossCheckUltimateDoomWadCapabilitySample(tampered)).toContain('oracle:episode1MapCount:value-mismatch');
  });

  test('detects a wrong episode2MapCount', () => {
    const tampered: UltimateDoomWadCapabilitySample = { ...syntheticOracleSample, episode2MapCount: 0 };
    expect(crossCheckUltimateDoomWadCapabilitySample(tampered)).toContain('oracle:episode2MapCount:value-mismatch');
  });

  test('detects a wrong episode3MapCount', () => {
    const tampered: UltimateDoomWadCapabilitySample = { ...syntheticOracleSample, episode3MapCount: 0 };
    expect(crossCheckUltimateDoomWadCapabilitySample(tampered)).toContain('oracle:episode3MapCount:value-mismatch');
  });

  test('detects a wrong episode4MapCount', () => {
    const tampered: UltimateDoomWadCapabilitySample = { ...syntheticOracleSample, episode4MapCount: 0 };
    expect(crossCheckUltimateDoomWadCapabilitySample(tampered)).toContain('oracle:episode4MapCount:value-mismatch');
  });

  test('detects a wrong doom2MapCount', () => {
    const tampered: UltimateDoomWadCapabilitySample = { ...syntheticOracleSample, doom2MapCount: 32 };
    expect(crossCheckUltimateDoomWadCapabilitySample(tampered)).toContain('oracle:doom2MapCount:value-mismatch');
  });

  function tamperFlag(flag: keyof UltimateDoomWadCapabilityFlags, newValue: boolean): UltimateDoomWadCapabilitySample {
    return {
      ...syntheticOracleSample,
      capabilityFlags: { ...syntheticOracleSample.capabilityFlags, [flag]: newValue },
    };
  }

  test('detects a flipped hasTexture2 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasTexture2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasTexture2:value-mismatch');
  });

  test('detects a flipped hasTexture1 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasTexture1', false));
    expect(failures).toContain('oracle:capabilityFlags:hasTexture1:value-mismatch');
  });

  test('detects a flipped hasBossback flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasBossback', true));
    expect(failures).toContain('oracle:capabilityFlags:hasBossback:value-mismatch');
  });

  test('detects a flipped hasVictory2 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasVictory2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasVictory2:value-mismatch');
  });

  test('detects a flipped hasEndpic flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasEndpic', false));
    expect(failures).toContain('oracle:capabilityFlags:hasEndpic:value-mismatch');
  });

  test('detects a flipped hasPfub1 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasPfub1', false));
    expect(failures).toContain('oracle:capabilityFlags:hasPfub1:value-mismatch');
  });

  test('detects a flipped hasPfub2 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasPfub2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasPfub2:value-mismatch');
  });

  test('detects a flipped hasDemo4 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasDemo4', false));
    expect(failures).toContain('oracle:capabilityFlags:hasDemo4:value-mismatch');
  });

  test('detects a flipped hasSky4 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasSky4', false));
    expect(failures).toContain('oracle:capabilityFlags:hasSky4:value-mismatch');
  });

  test('detects a flipped hasSky2 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasSky2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasSky2:value-mismatch');
  });

  test('detects a flipped hasSky3 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasSky3', false));
    expect(failures).toContain('oracle:capabilityFlags:hasSky3:value-mismatch');
  });

  test('detects a flipped hasWimap1 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasWimap1', false));
    expect(failures).toContain('oracle:capabilityFlags:hasWimap1:value-mismatch');
  });

  test('detects a flipped hasWimap2 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasWimap2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasWimap2:value-mismatch');
  });

  test('detects a flipped hasCyberdemonSprite flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasCyberdemonSprite', false));
    expect(failures).toContain('oracle:capabilityFlags:hasCyberdemonSprite:value-mismatch');
  });

  test('detects a flipped hasSpiderMastermindSprite flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasSpiderMastermindSprite', false));
    expect(failures).toContain('oracle:capabilityFlags:hasSpiderMastermindSprite:value-mismatch');
  });

  test('detects a flipped hasFlatMarkerRange flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasFlatMarkerRange', false));
    expect(failures).toContain('oracle:capabilityFlags:hasFlatMarkerRange:value-mismatch');
  });

  test('detects a flipped hasHelp1 flag', () => {
    const failures = crossCheckUltimateDoomWadCapabilitySample(tamperFlag('hasHelp1', false));
    expect(failures).toContain('oracle:capabilityFlags:hasHelp1:value-mismatch');
  });
});

describe('synthesized Ultimate directory inventory matches the runtime detection', () => {
  test('the synthesized directory contains every required infrastructure lump', () => {
    const names = new Set(syntheticUltimateDirectory.map((entry) => entry.name.toUpperCase()));
    for (const lumpName of ULTIMATE_REQUIRED_INFRASTRUCTURE_LUMPS) {
      expect(names.has(lumpName)).toBe(true);
    }
  });

  test('the synthesized directory contains every required demo lump', () => {
    const names = new Set(syntheticUltimateDirectory.map((entry) => entry.name.toUpperCase()));
    for (const lumpName of ULTIMATE_REQUIRED_DEMO_LUMPS) {
      expect(names.has(lumpName)).toBe(true);
    }
  });

  test('the synthesized directory contains every required marker range pair', () => {
    const names = new Set(syntheticUltimateDirectory.map((entry) => entry.name.toUpperCase()));
    for (const markerName of ULTIMATE_REQUIRED_MARKER_RANGES) {
      expect(names.has(markerName)).toBe(true);
    }
  });

  test('the synthesized directory contains every required boss sprite prefix', () => {
    for (const prefix of ULTIMATE_REQUIRED_SPRITE_PREFIXES) {
      const found = syntheticUltimateDirectory.find((entry) => entry.name.toUpperCase().startsWith(prefix));
      expect(found).toBeDefined();
    }
  });

  test('every negative-fingerprint lump is absent from the synthesized directory', () => {
    const names = new Set(syntheticUltimateDirectory.map((entry) => entry.name.toUpperCase()));
    for (const lumpName of ULTIMATE_NEGATIVE_FINGERPRINT_LUMPS) {
      expect(names.has(lumpName)).toBe(false);
    }
  });
});

describe('05-018 step file declarations', () => {
  test('the step file declares the wad lane with the correct write lock and prerequisite', async () => {
    const stepFileText = await Bun.file('plan_vanilla_parity/steps/05-018-detect-ultimate-iwad-capabilities.md').text();
    expect(stepFileText.includes('lane\n\nwad')).toBe(true);
    expect(stepFileText.includes('src/assets/detect-ultimate-iwad-capabilities.ts')).toBe(true);
    expect(stepFileText.includes('test/vanilla_parity/wad/detect-ultimate-iwad-capabilities.test.ts')).toBe(true);
    expect(stepFileText.includes('00-018')).toBe(true);
  });
});

describe('optional live Ultimate doomu.wad cross-check', () => {
  test('skips cleanly when no user-supplied Ultimate IWAD is present at the search paths', async () => {
    const candidates = ['doom/doomu.wad', 'iwad/doomu.wad', 'doom/DOOMU.WAD', 'iwad/DOOMU.WAD', 'doom/DOOM.WAD', 'iwad/DOOM.WAD'];
    let foundAny = false;
    for (const path of candidates) {
      const exists = await Bun.file(path).exists();
      if (exists) {
        foundAny = true;
        const bytes = await Bun.file(path).bytes();
        const buffer = Buffer.from(bytes);
        const { parseWadHeader } = await import('../../../src/wad/header.ts');
        const { parseWadDirectory } = await import('../../../src/wad/directory.ts');
        const header = parseWadHeader(buffer);
        const directory = parseWadDirectory(buffer, header);
        const detection = detectUltimateIwadCapabilities(directory, header.type);
        if (isUltimateIwad(directory, header.type)) {
          const sample = buildOracleSample(detection);
          expect(crossCheckUltimateDoomWadCapabilitySample(sample)).toEqual([]);
        }
      }
    }
    expect(typeof foundAny).toBe('boolean');
  });
});
