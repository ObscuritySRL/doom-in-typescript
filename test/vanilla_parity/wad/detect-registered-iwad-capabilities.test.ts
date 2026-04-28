import { describe, expect, test } from 'bun:test';

import { EPISODE_COUNTS } from '../../../src/bootstrap/gameMode.ts';
import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import {
  REGISTERED_DOOM_WAD_CAPABILITY_ORACLE,
  REGISTERED_IWAD_CAPABILITY_AUDIT,
  REGISTERED_IWAD_CAPABILITY_DERIVED_INVARIANTS,
  REGISTERED_IWAD_EPISODE_COUNT,
  REGISTERED_IWAD_MAP_BUNDLE_COUNT,
  REGISTERED_NEGATIVE_FINGERPRINT_LUMPS,
  REGISTERED_REQUIRED_DEMO_LUMPS,
  REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS,
  REGISTERED_REQUIRED_MARKER_RANGES,
  REGISTERED_REQUIRED_SPRITE_PREFIXES,
  crossCheckRegisteredDoomWadCapabilitySample,
  crossCheckRegisteredIwadCapabilityRuntime,
  detectRegisteredIwadCapabilities,
  isRegisteredIwad,
} from '../../../src/assets/detect-registered-iwad-capabilities.ts';
import type { RegisteredDoomWadCapabilityFlags, RegisteredDoomWadCapabilitySample, RegisteredIwadCapabilityAuditEntry, RegisteredIwadCapabilityRuntimeSnapshot } from '../../../src/assets/detect-registered-iwad-capabilities.ts';

const ALLOWED_AXIS_IDS = new Set<RegisteredIwadCapabilityAuditEntry['id']>([
  'registered-wad-type-is-iwad',
  'registered-map-bundle-count-is-twentyseven',
  'registered-episode1-map-count-is-nine',
  'registered-episode2-map-count-is-nine',
  'registered-episode3-map-count-is-nine',
  'registered-ultimate-episode-markers-absent',
  'registered-doom2-map-markers-absent',
  'registered-texture1-present',
  'registered-texture2-present',
  'registered-pnames-present',
  'registered-playpal-and-colormap-present',
  'registered-endoom-present',
  'registered-genmidi-and-dmxgus-present',
  'registered-titlepic-and-credit-present',
  'registered-help1-and-help2-present',
  'registered-stbar-and-starms-present',
  'registered-sky1-sky2-sky3-present',
  'registered-sky4-absent',
  'registered-wimap0-wimap1-wimap2-present',
  'registered-victory2-present',
  'registered-endpic-present',
  'registered-pfub-bunny-scroll-patches-present',
  'registered-bossback-absent',
  'registered-three-demos-present',
  'registered-demo4-absent',
  'registered-flat-marker-range-present',
  'registered-sprite-marker-range-present',
  'registered-patch-marker-range-present',
  'registered-cyberdemon-sprite-present',
  'registered-spider-mastermind-sprite-present',
]);

const ALLOWED_SUBJECTS = new Set<RegisteredIwadCapabilityAuditEntry['subject']>([
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

const ALLOWED_REFERENCE_FILES = new Set<RegisteredIwadCapabilityAuditEntry['referenceSourceFile']>([
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

function buildSyntheticDirectory(extraNames: readonly string[] = [], registeredDefaults = true): DirectoryEntry[] {
  const directory: DirectoryEntry[] = [];
  if (registeredDefaults) {
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
  }
  for (const name of extraNames) {
    directory.push(Object.freeze({ offset: 0, size: 0, name }));
  }
  return directory;
}

const syntheticRegisteredDirectory = buildSyntheticDirectory();
const syntheticDirectoryWithE4M1 = buildSyntheticDirectory(['E4M1']);
const syntheticDirectoryWithMap01 = buildSyntheticDirectory(['MAP01']);
const syntheticDirectoryEmpty = buildSyntheticDirectory([], false);
const syntheticPwadDirectory = buildSyntheticDirectory();

function buildShareWareShapedDirectory(): DirectoryEntry[] {
  const directory: DirectoryEntry[] = [];
  for (const name of [
    'PLAYPAL',
    'COLORMAP',
    'ENDOOM',
    'TEXTURE1',
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
    'WIMAP0',
    'DEMO1',
    'DEMO2',
    'DEMO3',
    'F_START',
    'F_END',
    'S_START',
    'S_END',
    'P_START',
    'P_END',
  ]) {
    directory.push(Object.freeze({ offset: 0, size: 0, name }));
  }
  for (let m = 1; m <= 9; m += 1) {
    directory.push(Object.freeze({ offset: 0, size: 0, name: `E1M${m}` }));
  }
  return directory;
}

const syntheticShareWareDirectory = buildShareWareShapedDirectory();
const syntheticDirectoryMissingE2M1 = syntheticRegisteredDirectory.filter((entry) => entry.name !== 'E2M1');
const syntheticDirectoryMissingE3M1 = syntheticRegisteredDirectory.filter((entry) => entry.name !== 'E3M1');
const syntheticDirectoryMissingTexture2 = syntheticRegisteredDirectory.filter((entry) => entry.name !== 'TEXTURE2');

const syntheticRegisteredDetection = detectRegisteredIwadCapabilities(syntheticRegisteredDirectory, 'IWAD');

function buildRuntimeSnapshot(): RegisteredIwadCapabilityRuntimeSnapshot {
  const detectionAsPwad = detectRegisteredIwadCapabilities(syntheticRegisteredDirectory, 'PWAD');
  return {
    registeredIwadMapBundleCount: REGISTERED_IWAD_MAP_BUNDLE_COUNT,
    registeredIwadEpisodeCount: REGISTERED_IWAD_EPISODE_COUNT,
    detectRegisteredReturnsFrozenDetection: Object.isFrozen(syntheticRegisteredDetection),
    detectRegisteredPropagatesPwadType: detectionAsPwad.wadType === 'PWAD',
    isRegisteredIwadAcceptsSyntheticRegistered: isRegisteredIwad(syntheticRegisteredDirectory, 'IWAD'),
    isRegisteredIwadRejectsE4M1Present: isRegisteredIwad(syntheticDirectoryWithE4M1, 'IWAD') === false,
    isRegisteredIwadRejectsMap01Present: isRegisteredIwad(syntheticDirectoryWithMap01, 'IWAD') === false,
    isRegisteredIwadRejectsTexture2Absent: isRegisteredIwad(syntheticDirectoryMissingTexture2, 'IWAD') === false,
    isRegisteredIwadRejectsE2M1Absent: isRegisteredIwad(syntheticDirectoryMissingE2M1, 'IWAD') === false,
    isRegisteredIwadRejectsE3M1Absent: isRegisteredIwad(syntheticDirectoryMissingE3M1, 'IWAD') === false,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildRuntimeSnapshot());

function buildOracleSample(detection: ReturnType<typeof detectRegisteredIwadCapabilities>): RegisteredDoomWadCapabilitySample {
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
      hasHelp2: detection.hasHelp2,
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

const syntheticOracleSample = buildOracleSample(syntheticRegisteredDetection);

describe('registered iwad capability audit ledger shape', () => {
  test('audits exactly thirty behavioral axes', () => {
    expect(REGISTERED_IWAD_CAPABILITY_AUDIT.length).toBe(30);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of REGISTERED_IWAD_CAPABILITY_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = REGISTERED_IWAD_CAPABILITY_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of REGISTERED_IWAD_CAPABILITY_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of REGISTERED_IWAD_CAPABILITY_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of REGISTERED_IWAD_CAPABILITY_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of REGISTERED_IWAD_CAPABILITY_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the wad-type axis pins the IWAD identification stamp', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-wad-type-is-iwad');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('wad-header');
    expect(entry!.invariant.includes('IWAD')).toBe(true);
  });

  test('the texture2-present axis cites the upstream W_CheckNumForName conditional', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-texture2-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('W_CheckNumForName'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('TEXTURE2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/r_data.c');
  });

  test('the ultimate-episode-markers-absent axis cites the upstream retail gate', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-ultimate-episode-markers-absent');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('retail'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/d_main.c');
  });

  test('the doom2-map-markers-absent axis cites the upstream sprintf "map%02i" formatter', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-doom2-map-markers-absent');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('"map%02i"'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/g_game.c');
  });

  test('the help1-and-help2-present axis cites M_DrawReadThis pagename selectors', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-help1-and-help2-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('HELP1'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('HELP2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/m_menu.c');
  });

  test('the victory2-present axis cites the upstream VICTORY2 V_DrawPatchDirect', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-victory2-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('VICTORY2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/f_finale.c');
  });

  test('the endpic-present axis cites the upstream ENDPIC V_DrawPatchDirect', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-endpic-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('ENDPIC'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/f_finale.c');
  });

  test('the pfub-bunny-scroll-patches-present axis cites W_CacheLumpName for PFUB1/PFUB2', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-pfub-bunny-scroll-patches-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('PFUB1'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('PFUB2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/f_finale.c');
  });

  test('the bossback-absent axis cites F_CastDrawer commercial-only cast call', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-bossback-absent');
    expect(entry).toBeDefined();
    expect(entry!.invariant.includes('commercial')).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/f_finale.c');
  });

  test('the wimap0-wimap1-wimap2-present axis cites the upstream WIMAP%i sprintf formatter', () => {
    const entry = REGISTERED_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'registered-wimap0-wimap1-wimap2-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('WIMAP'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/wi_stuff.c');
  });
});

describe('registered iwad capability derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = REGISTERED_IWAD_CAPABILITY_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(REGISTERED_IWAD_CAPABILITY_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'REGISTERED_IWAD_MAP_BUNDLE_COUNT_EQUALS_TWENTYSEVEN',
        'REGISTERED_IWAD_EPISODE_COUNT_EQUALS_THREE',
        'DETECT_REGISTERED_RETURNS_FROZEN_DETECTION',
        'DETECT_REGISTERED_PROPAGATES_PWAD_TYPE',
        'IS_REGISTERED_IWAD_ACCEPTS_SYNTHETIC_REGISTERED',
        'IS_REGISTERED_IWAD_REJECTS_E4M1_PRESENT',
        'IS_REGISTERED_IWAD_REJECTS_MAP01_PRESENT',
        'IS_REGISTERED_IWAD_REJECTS_TEXTURE2_ABSENT',
        'IS_REGISTERED_IWAD_REJECTS_E2M1_ABSENT',
        'IS_REGISTERED_IWAD_REJECTS_E3M1_ABSENT',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of REGISTERED_IWAD_CAPABILITY_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('REGISTERED_IWAD_MAP_BUNDLE_COUNT equals 27', () => {
    expect(REGISTERED_IWAD_MAP_BUNDLE_COUNT).toBe(27);
  });

  test('REGISTERED_IWAD_EPISODE_COUNT equals 3 and matches EPISODE_COUNTS.registered', () => {
    expect(REGISTERED_IWAD_EPISODE_COUNT).toBe(3);
    expect(REGISTERED_IWAD_EPISODE_COUNT).toBe(EPISODE_COUNTS.registered);
  });

  test('REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS is a frozen list of mandatory lumps', () => {
    expect(Object.isFrozen(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS)).toBe(true);
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PLAYPAL');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('COLORMAP');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('TEXTURE1');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('TEXTURE2');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PNAMES');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('TITLEPIC');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('SKY1');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('SKY2');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('SKY3');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('WIMAP0');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('WIMAP1');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('WIMAP2');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('VICTORY2');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('ENDPIC');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PFUB1');
    expect(REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PFUB2');
  });

  test('REGISTERED_REQUIRED_DEMO_LUMPS lists the three demos', () => {
    expect(Object.isFrozen(REGISTERED_REQUIRED_DEMO_LUMPS)).toBe(true);
    expect(REGISTERED_REQUIRED_DEMO_LUMPS).toEqual(['DEMO1', 'DEMO2', 'DEMO3']);
  });

  test('REGISTERED_REQUIRED_MARKER_RANGES lists the three marker pairs', () => {
    expect(Object.isFrozen(REGISTERED_REQUIRED_MARKER_RANGES)).toBe(true);
    expect(REGISTERED_REQUIRED_MARKER_RANGES).toEqual(['F_START', 'F_END', 'S_START', 'S_END', 'P_START', 'P_END']);
  });

  test('REGISTERED_REQUIRED_SPRITE_PREFIXES lists the boss sprite prefixes', () => {
    expect(Object.isFrozen(REGISTERED_REQUIRED_SPRITE_PREFIXES)).toBe(true);
    expect(REGISTERED_REQUIRED_SPRITE_PREFIXES).toEqual(['CYBR', 'SPID']);
  });

  test('REGISTERED_NEGATIVE_FINGERPRINT_LUMPS lists the Ultimate/commercial-only lumps', () => {
    expect(Object.isFrozen(REGISTERED_NEGATIVE_FINGERPRINT_LUMPS)).toBe(true);
    expect(REGISTERED_NEGATIVE_FINGERPRINT_LUMPS).toContain('E4M1');
    expect(REGISTERED_NEGATIVE_FINGERPRINT_LUMPS).toContain('MAP01');
    expect(REGISTERED_NEGATIVE_FINGERPRINT_LUMPS).toContain('SKY4');
    expect(REGISTERED_NEGATIVE_FINGERPRINT_LUMPS).toContain('BOSSBACK');
    expect(REGISTERED_NEGATIVE_FINGERPRINT_LUMPS).toContain('DEMO4');
  });
});

describe('detectRegisteredIwadCapabilities runtime', () => {
  test('returns a frozen detection for the synthesized registered directory', () => {
    expect(Object.isFrozen(syntheticRegisteredDetection)).toBe(true);
  });

  test('reports the WAD type from the supplied header type', () => {
    const detectionAsIwad = detectRegisteredIwadCapabilities(syntheticRegisteredDirectory, 'IWAD');
    const detectionAsPwad = detectRegisteredIwadCapabilities(syntheticRegisteredDirectory, 'PWAD');
    expect(detectionAsIwad.wadType).toBe('IWAD');
    expect(detectionAsPwad.wadType).toBe('PWAD');
  });

  test('reports mapBundleCount as 27 for the synthesized registered directory', () => {
    expect(syntheticRegisteredDetection.mapBundleCount).toBe(27);
  });

  test('reports per-episode map counts (9, 9, 9, 0, 0) for the synthesized registered directory', () => {
    expect(syntheticRegisteredDetection.episode1MapCount).toBe(9);
    expect(syntheticRegisteredDetection.episode2MapCount).toBe(9);
    expect(syntheticRegisteredDetection.episode3MapCount).toBe(9);
    expect(syntheticRegisteredDetection.episode4MapCount).toBe(0);
    expect(syntheticRegisteredDetection.doom2MapCount).toBe(0);
  });

  test('reports hasTexture1 and hasTexture2 both true for the synthesized registered directory', () => {
    expect(syntheticRegisteredDetection.hasTexture1).toBe(true);
    expect(syntheticRegisteredDetection.hasTexture2).toBe(true);
  });

  test('reports every required infrastructure lump as present for the synthesized registered directory', () => {
    expect(syntheticRegisteredDetection.hasPlaypal).toBe(true);
    expect(syntheticRegisteredDetection.hasColormap).toBe(true);
    expect(syntheticRegisteredDetection.hasEndoom).toBe(true);
    expect(syntheticRegisteredDetection.hasPnames).toBe(true);
    expect(syntheticRegisteredDetection.hasGenmidi).toBe(true);
    expect(syntheticRegisteredDetection.hasDmxgus).toBe(true);
    expect(syntheticRegisteredDetection.hasTitlepic).toBe(true);
    expect(syntheticRegisteredDetection.hasCredit).toBe(true);
    expect(syntheticRegisteredDetection.hasHelp1).toBe(true);
    expect(syntheticRegisteredDetection.hasHelp2).toBe(true);
    expect(syntheticRegisteredDetection.hasStbar).toBe(true);
    expect(syntheticRegisteredDetection.hasStarms).toBe(true);
    expect(syntheticRegisteredDetection.hasSky1).toBe(true);
    expect(syntheticRegisteredDetection.hasSky2).toBe(true);
    expect(syntheticRegisteredDetection.hasSky3).toBe(true);
    expect(syntheticRegisteredDetection.hasWimap0).toBe(true);
    expect(syntheticRegisteredDetection.hasWimap1).toBe(true);
    expect(syntheticRegisteredDetection.hasWimap2).toBe(true);
    expect(syntheticRegisteredDetection.hasVictory2).toBe(true);
    expect(syntheticRegisteredDetection.hasEndpic).toBe(true);
    expect(syntheticRegisteredDetection.hasPfub1).toBe(true);
    expect(syntheticRegisteredDetection.hasPfub2).toBe(true);
  });

  test('reports SKY4 as absent for the synthesized registered directory', () => {
    expect(syntheticRegisteredDetection.hasSky4).toBe(false);
  });

  test('reports BOSSBACK as absent for the synthesized registered directory', () => {
    expect(syntheticRegisteredDetection.hasBossback).toBe(false);
  });

  test('reports DEMO1, DEMO2, DEMO3 present and DEMO4 absent for the synthesized registered directory', () => {
    expect(syntheticRegisteredDetection.hasDemo1).toBe(true);
    expect(syntheticRegisteredDetection.hasDemo2).toBe(true);
    expect(syntheticRegisteredDetection.hasDemo3).toBe(true);
    expect(syntheticRegisteredDetection.hasDemo4).toBe(false);
  });

  test('reports F_START/F_END, S_START/S_END, P_START/P_END marker ranges as present', () => {
    expect(syntheticRegisteredDetection.hasFlatMarkerRange).toBe(true);
    expect(syntheticRegisteredDetection.hasSpriteMarkerRange).toBe(true);
    expect(syntheticRegisteredDetection.hasPatchMarkerRange).toBe(true);
  });

  test('reports CYBR (Cyberdemon) and SPID (Spider Mastermind) sprite prefixes as present', () => {
    expect(syntheticRegisteredDetection.hasCyberdemonSprite).toBe(true);
    expect(syntheticRegisteredDetection.hasSpiderMastermindSprite).toBe(true);
  });

  test('treats lump names case-insensitively (uppercased before lookup)', () => {
    const lowerDirectory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'playpal' }), Object.freeze({ offset: 0, size: 0, name: 'texture2' }), Object.freeze({ offset: 0, size: 0, name: 'e3m1' })];
    const detection = detectRegisteredIwadCapabilities(lowerDirectory, 'IWAD');
    expect(detection.hasPlaypal).toBe(true);
    expect(detection.hasTexture2).toBe(true);
    expect(detection.episode3MapCount).toBe(1);
  });

  test('reports zero map bundles for an empty directory', () => {
    const detection = detectRegisteredIwadCapabilities(syntheticDirectoryEmpty, 'IWAD');
    expect(detection.mapBundleCount).toBe(0);
    expect(detection.episode1MapCount).toBe(0);
    expect(detection.totalLumpCount).toBe(0);
  });

  test('reports e4m1 marker count as 1 when the directory contains E4M1', () => {
    const detection = detectRegisteredIwadCapabilities(syntheticDirectoryWithE4M1, 'IWAD');
    expect(detection.episode4MapCount).toBe(1);
  });

  test('reports doom2 map count as 1 when the directory contains MAP01', () => {
    const detection = detectRegisteredIwadCapabilities(syntheticDirectoryWithMap01, 'IWAD');
    expect(detection.doom2MapCount).toBe(1);
  });

  test('reports hasTexture2 false when the directory does not contain TEXTURE2', () => {
    const detection = detectRegisteredIwadCapabilities(syntheticDirectoryMissingTexture2, 'IWAD');
    expect(detection.hasTexture2).toBe(false);
    expect(detection.hasTexture1).toBe(true);
  });

  test('reports CYBR sprite prefix as present when the directory contains CYBRA1', () => {
    const directory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'CYBRA1' })];
    const detection = detectRegisteredIwadCapabilities(directory, 'IWAD');
    expect(detection.hasCyberdemonSprite).toBe(true);
  });

  test('reports SPID sprite prefix as present when the directory contains SPIDA1A2', () => {
    const directory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'SPIDA1A2' })];
    const detection = detectRegisteredIwadCapabilities(directory, 'IWAD');
    expect(detection.hasSpiderMastermindSprite).toBe(true);
  });
});

describe('isRegisteredIwad predicate', () => {
  test('returns true for a synthesized registered-shaped directory', () => {
    expect(isRegisteredIwad(syntheticRegisteredDirectory, 'IWAD')).toBe(true);
  });

  test('returns false for a directory that contains E4M1 (Ultimate)', () => {
    expect(isRegisteredIwad(syntheticDirectoryWithE4M1, 'IWAD')).toBe(false);
  });

  test('returns false for a directory that contains MAP01 (commercial)', () => {
    expect(isRegisteredIwad(syntheticDirectoryWithMap01, 'IWAD')).toBe(false);
  });

  test('returns false for a directory missing TEXTURE2 (shareware shape)', () => {
    expect(isRegisteredIwad(syntheticDirectoryMissingTexture2, 'IWAD')).toBe(false);
  });

  test('returns false for a directory missing E2M1 (incomplete ep2)', () => {
    expect(isRegisteredIwad(syntheticDirectoryMissingE2M1, 'IWAD')).toBe(false);
  });

  test('returns false for a directory missing E3M1 (shareware shape)', () => {
    expect(isRegisteredIwad(syntheticDirectoryMissingE3M1, 'IWAD')).toBe(false);
  });

  test('returns false for the shareware-shaped directory', () => {
    expect(isRegisteredIwad(syntheticShareWareDirectory, 'IWAD')).toBe(false);
  });

  test('returns false when the WAD type is PWAD', () => {
    expect(isRegisteredIwad(syntheticPwadDirectory, 'PWAD')).toBe(false);
  });

  test('returns false for an empty directory', () => {
    expect(isRegisteredIwad(syntheticDirectoryEmpty, 'IWAD')).toBe(false);
  });
});

describe('crossCheckRegisteredIwadCapabilityRuntime', () => {
  test('reports zero failures for the live runtime snapshot', () => {
    expect(crossCheckRegisteredIwadCapabilityRuntime(liveRuntimeSnapshot)).toEqual([]);
  });

  test('detects a tampered registeredIwadMapBundleCount', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, registeredIwadMapBundleCount: 9 };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:REGISTERED_IWAD_MAP_BUNDLE_COUNT_EQUALS_TWENTYSEVEN');
    expect(failures).toContain('audit:registered-map-bundle-count-is-twentyseven:not-observed');
  });

  test('detects a tampered registeredIwadEpisodeCount', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, registeredIwadEpisodeCount: 1 };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:REGISTERED_IWAD_EPISODE_COUNT_EQUALS_THREE');
  });

  test('detects a detector that fails to freeze the returned detection', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, detectRegisteredReturnsFrozenDetection: false };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:DETECT_REGISTERED_RETURNS_FROZEN_DETECTION');
  });

  test('detects a detector that does not propagate the PWAD wad type', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, detectRegisteredPropagatesPwadType: false };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:DETECT_REGISTERED_PROPAGATES_PWAD_TYPE');
    expect(failures).toContain('audit:registered-wad-type-is-iwad:not-observed');
  });

  test('detects an isRegisteredIwad that rejects a synthesized registered shape', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isRegisteredIwadAcceptsSyntheticRegistered: false };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_REGISTERED_IWAD_ACCEPTS_SYNTHETIC_REGISTERED');
    expect(failures).toContain('audit:registered-episode3-map-count-is-nine:not-observed');
  });

  test('detects an isRegisteredIwad that accepts a directory containing E4M1', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isRegisteredIwadRejectsE4M1Present: false };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_REGISTERED_IWAD_REJECTS_E4M1_PRESENT');
    expect(failures).toContain('audit:registered-ultimate-episode-markers-absent:not-observed');
  });

  test('detects an isRegisteredIwad that accepts a directory containing MAP01', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isRegisteredIwadRejectsMap01Present: false };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_REGISTERED_IWAD_REJECTS_MAP01_PRESENT');
    expect(failures).toContain('audit:registered-doom2-map-markers-absent:not-observed');
  });

  test('detects an isRegisteredIwad that accepts a directory missing TEXTURE2', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isRegisteredIwadRejectsTexture2Absent: false };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_REGISTERED_IWAD_REJECTS_TEXTURE2_ABSENT');
    expect(failures).toContain('audit:registered-texture2-present:not-observed');
  });

  test('detects an isRegisteredIwad that accepts a directory missing E2M1', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isRegisteredIwadRejectsE2M1Absent: false };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_REGISTERED_IWAD_REJECTS_E2M1_ABSENT');
    expect(failures).toContain('audit:registered-episode2-map-count-is-nine:not-observed');
  });

  test('detects an isRegisteredIwad that accepts a directory missing E3M1', () => {
    const tampered: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isRegisteredIwadRejectsE3M1Absent: false };
    const failures = crossCheckRegisteredIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_REGISTERED_IWAD_REJECTS_E3M1_ABSENT');
    expect(failures).toContain('audit:registered-episode3-map-count-is-nine:not-observed');
  });

  test('reports an empty failure list for a freshly cloned snapshot', () => {
    const cloned: RegisteredIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckRegisteredIwadCapabilityRuntime(cloned)).toEqual([]);
  });
});

describe('registered DOOM.WAD capability oracle', () => {
  test('declares the canonical registered filename, IWAD type, and 27 map count', () => {
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.filename).toBe('DOOM.WAD');
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.wadType).toBe('IWAD');
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.mapBundleCount).toBe(27);
  });

  test('pins the 9+9+9 episode-1/2/3 maps and zero non-registered map markers', () => {
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.episode1MapCount).toBe(9);
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.episode2MapCount).toBe(9);
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.episode3MapCount).toBe(9);
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.episode4MapCount).toBe(0);
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.doom2MapCount).toBe(0);
  });

  test('pins TEXTURE1 and TEXTURE2 both present', () => {
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags.hasTexture1).toBe(true);
    expect(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags.hasTexture2).toBe(true);
  });

  test('pins every required infrastructure lump as present', () => {
    const flags = REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasPlaypal).toBe(true);
    expect(flags.hasColormap).toBe(true);
    expect(flags.hasPnames).toBe(true);
    expect(flags.hasEndoom).toBe(true);
    expect(flags.hasGenmidi).toBe(true);
    expect(flags.hasDmxgus).toBe(true);
    expect(flags.hasTitlepic).toBe(true);
    expect(flags.hasCredit).toBe(true);
    expect(flags.hasHelp1).toBe(true);
    expect(flags.hasHelp2).toBe(true);
    expect(flags.hasStbar).toBe(true);
    expect(flags.hasStarms).toBe(true);
    expect(flags.hasSky1).toBe(true);
    expect(flags.hasSky2).toBe(true);
    expect(flags.hasSky3).toBe(true);
    expect(flags.hasWimap0).toBe(true);
    expect(flags.hasWimap1).toBe(true);
    expect(flags.hasWimap2).toBe(true);
    expect(flags.hasVictory2).toBe(true);
    expect(flags.hasEndpic).toBe(true);
    expect(flags.hasPfub1).toBe(true);
    expect(flags.hasPfub2).toBe(true);
  });

  test('pins SKY4, BOSSBACK, and DEMO4 as absent', () => {
    const flags = REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasSky4).toBe(false);
    expect(flags.hasBossback).toBe(false);
    expect(flags.hasDemo4).toBe(false);
  });

  test('pins DEMO1, DEMO2, DEMO3 as present', () => {
    const flags = REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasDemo1).toBe(true);
    expect(flags.hasDemo2).toBe(true);
    expect(flags.hasDemo3).toBe(true);
  });

  test('pins F_START/F_END, S_START/S_END, P_START/P_END marker ranges as present', () => {
    const flags = REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasFlatMarkerRange).toBe(true);
    expect(flags.hasSpriteMarkerRange).toBe(true);
    expect(flags.hasPatchMarkerRange).toBe(true);
  });

  test('pins boss sprite prefixes (CYBR, SPID) as present', () => {
    const flags = REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasCyberdemonSprite).toBe(true);
    expect(flags.hasSpiderMastermindSprite).toBe(true);
  });

  test('the oracle and its capability flags are deeply frozen', () => {
    expect(Object.isFrozen(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE)).toBe(true);
    expect(Object.isFrozen(REGISTERED_DOOM_WAD_CAPABILITY_ORACLE.capabilityFlags)).toBe(true);
  });

  test('the synthesized oracle sample reports zero failures against the pinned oracle', () => {
    expect(crossCheckRegisteredDoomWadCapabilitySample(syntheticOracleSample)).toEqual([]);
  });
});

describe('crossCheckRegisteredDoomWadCapabilitySample failure modes', () => {
  test('detects a wrong wadType', () => {
    const tampered: RegisteredDoomWadCapabilitySample = { ...syntheticOracleSample, wadType: 'PWAD' };
    expect(crossCheckRegisteredDoomWadCapabilitySample(tampered)).toContain('oracle:wadType:value-mismatch');
  });

  test('detects a wrong mapBundleCount', () => {
    const tampered: RegisteredDoomWadCapabilitySample = { ...syntheticOracleSample, mapBundleCount: 9 };
    expect(crossCheckRegisteredDoomWadCapabilitySample(tampered)).toContain('oracle:mapBundleCount:value-mismatch');
  });

  test('detects a wrong episode1MapCount', () => {
    const tampered: RegisteredDoomWadCapabilitySample = { ...syntheticOracleSample, episode1MapCount: 8 };
    expect(crossCheckRegisteredDoomWadCapabilitySample(tampered)).toContain('oracle:episode1MapCount:value-mismatch');
  });

  test('detects a wrong episode2MapCount', () => {
    const tampered: RegisteredDoomWadCapabilitySample = { ...syntheticOracleSample, episode2MapCount: 0 };
    expect(crossCheckRegisteredDoomWadCapabilitySample(tampered)).toContain('oracle:episode2MapCount:value-mismatch');
  });

  test('detects a wrong episode3MapCount', () => {
    const tampered: RegisteredDoomWadCapabilitySample = { ...syntheticOracleSample, episode3MapCount: 0 };
    expect(crossCheckRegisteredDoomWadCapabilitySample(tampered)).toContain('oracle:episode3MapCount:value-mismatch');
  });

  test('detects a wrong episode4MapCount', () => {
    const tampered: RegisteredDoomWadCapabilitySample = { ...syntheticOracleSample, episode4MapCount: 9 };
    expect(crossCheckRegisteredDoomWadCapabilitySample(tampered)).toContain('oracle:episode4MapCount:value-mismatch');
  });

  test('detects a wrong doom2MapCount', () => {
    const tampered: RegisteredDoomWadCapabilitySample = { ...syntheticOracleSample, doom2MapCount: 32 };
    expect(crossCheckRegisteredDoomWadCapabilitySample(tampered)).toContain('oracle:doom2MapCount:value-mismatch');
  });

  function tamperFlag(flag: keyof RegisteredDoomWadCapabilityFlags, newValue: boolean): RegisteredDoomWadCapabilitySample {
    return {
      ...syntheticOracleSample,
      capabilityFlags: { ...syntheticOracleSample.capabilityFlags, [flag]: newValue },
    };
  }

  test('detects a flipped hasTexture2 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasTexture2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasTexture2:value-mismatch');
  });

  test('detects a flipped hasTexture1 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasTexture1', false));
    expect(failures).toContain('oracle:capabilityFlags:hasTexture1:value-mismatch');
  });

  test('detects a flipped hasBossback flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasBossback', true));
    expect(failures).toContain('oracle:capabilityFlags:hasBossback:value-mismatch');
  });

  test('detects a flipped hasVictory2 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasVictory2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasVictory2:value-mismatch');
  });

  test('detects a flipped hasEndpic flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasEndpic', false));
    expect(failures).toContain('oracle:capabilityFlags:hasEndpic:value-mismatch');
  });

  test('detects a flipped hasPfub1 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasPfub1', false));
    expect(failures).toContain('oracle:capabilityFlags:hasPfub1:value-mismatch');
  });

  test('detects a flipped hasPfub2 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasPfub2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasPfub2:value-mismatch');
  });

  test('detects a flipped hasDemo4 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasDemo4', true));
    expect(failures).toContain('oracle:capabilityFlags:hasDemo4:value-mismatch');
  });

  test('detects a flipped hasSky4 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasSky4', true));
    expect(failures).toContain('oracle:capabilityFlags:hasSky4:value-mismatch');
  });

  test('detects a flipped hasSky2 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasSky2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasSky2:value-mismatch');
  });

  test('detects a flipped hasSky3 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasSky3', false));
    expect(failures).toContain('oracle:capabilityFlags:hasSky3:value-mismatch');
  });

  test('detects a flipped hasWimap1 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasWimap1', false));
    expect(failures).toContain('oracle:capabilityFlags:hasWimap1:value-mismatch');
  });

  test('detects a flipped hasWimap2 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasWimap2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasWimap2:value-mismatch');
  });

  test('detects a flipped hasCyberdemonSprite flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasCyberdemonSprite', false));
    expect(failures).toContain('oracle:capabilityFlags:hasCyberdemonSprite:value-mismatch');
  });

  test('detects a flipped hasSpiderMastermindSprite flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasSpiderMastermindSprite', false));
    expect(failures).toContain('oracle:capabilityFlags:hasSpiderMastermindSprite:value-mismatch');
  });

  test('detects a flipped hasFlatMarkerRange flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasFlatMarkerRange', false));
    expect(failures).toContain('oracle:capabilityFlags:hasFlatMarkerRange:value-mismatch');
  });

  test('detects a flipped hasHelp2 flag', () => {
    const failures = crossCheckRegisteredDoomWadCapabilitySample(tamperFlag('hasHelp2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasHelp2:value-mismatch');
  });
});

describe('synthesized registered directory inventory matches the runtime detection', () => {
  test('the synthesized directory contains every required infrastructure lump', () => {
    const names = new Set(syntheticRegisteredDirectory.map((entry) => entry.name.toUpperCase()));
    for (const lumpName of REGISTERED_REQUIRED_INFRASTRUCTURE_LUMPS) {
      expect(names.has(lumpName)).toBe(true);
    }
  });

  test('the synthesized directory contains every required demo lump', () => {
    const names = new Set(syntheticRegisteredDirectory.map((entry) => entry.name.toUpperCase()));
    for (const lumpName of REGISTERED_REQUIRED_DEMO_LUMPS) {
      expect(names.has(lumpName)).toBe(true);
    }
  });

  test('the synthesized directory contains every required marker range pair', () => {
    const names = new Set(syntheticRegisteredDirectory.map((entry) => entry.name.toUpperCase()));
    for (const markerName of REGISTERED_REQUIRED_MARKER_RANGES) {
      expect(names.has(markerName)).toBe(true);
    }
  });

  test('the synthesized directory contains every required boss sprite prefix', () => {
    for (const prefix of REGISTERED_REQUIRED_SPRITE_PREFIXES) {
      const found = syntheticRegisteredDirectory.find((entry) => entry.name.toUpperCase().startsWith(prefix));
      expect(found).toBeDefined();
    }
  });

  test('every negative-fingerprint lump is absent from the synthesized directory', () => {
    const names = new Set(syntheticRegisteredDirectory.map((entry) => entry.name.toUpperCase()));
    for (const lumpName of REGISTERED_NEGATIVE_FINGERPRINT_LUMPS) {
      expect(names.has(lumpName)).toBe(false);
    }
  });
});

describe('05-017 step file declarations', () => {
  test('the step file declares the wad lane with the correct write lock and prerequisite', async () => {
    const stepFileText = await Bun.file('plan_vanilla_parity/steps/05-017-detect-registered-iwad-capabilities.md').text();
    expect(stepFileText.includes('lane\n\nwad')).toBe(true);
    expect(stepFileText.includes('src/assets/detect-registered-iwad-capabilities.ts')).toBe(true);
    expect(stepFileText.includes('test/vanilla_parity/wad/detect-registered-iwad-capabilities.test.ts')).toBe(true);
    expect(stepFileText.includes('00-018')).toBe(true);
  });
});

describe('optional live registered DOOM.WAD cross-check', () => {
  test('skips cleanly when no user-supplied DOOM.WAD is present at the search paths', async () => {
    const candidates = ['doom/DOOM.WAD', 'iwad/DOOM.WAD'];
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
        const detection = detectRegisteredIwadCapabilities(directory, header.type);
        if (isRegisteredIwad(directory, header.type)) {
          const sample = buildOracleSample(detection);
          expect(crossCheckRegisteredDoomWadCapabilitySample(sample)).toEqual([]);
        }
      }
    }
    expect(typeof foundAny).toBe('boolean');
  });
});
