import { describe, expect, test } from 'bun:test';

import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import {
  SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE,
  SHAREWARE_IWAD_CAPABILITY_AUDIT,
  SHAREWARE_IWAD_CAPABILITY_DERIVED_INVARIANTS,
  SHAREWARE_IWAD_EPISODE_COUNT,
  SHAREWARE_IWAD_MAP_BUNDLE_COUNT,
  SHAREWARE_IWAD_TOTAL_LUMP_COUNT,
  SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS,
  SHAREWARE_NEGATIVE_SPRITE_PREFIXES,
  SHAREWARE_REQUIRED_DEMO_LUMPS,
  SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS,
  SHAREWARE_REQUIRED_MARKER_RANGES,
  crossCheckShareWareDoom1WadCapabilitySample,
  crossCheckShareWareIwadCapabilityRuntime,
  detectShareWareIwadCapabilities,
  isShareWareIwad,
} from '../../../src/assets/detect-shareware-iwad-capabilities.ts';
import type { ShareWareDoom1WadCapabilityFlags, ShareWareDoom1WadCapabilitySample, ShareWareIwadCapabilityAuditEntry, ShareWareIwadCapabilityRuntimeSnapshot } from '../../../src/assets/detect-shareware-iwad-capabilities.ts';

const ALLOWED_AXIS_IDS = new Set<ShareWareIwadCapabilityAuditEntry['id']>([
  'shareware-wad-type-is-iwad',
  'shareware-total-lump-count-pinned',
  'shareware-map-bundle-count-is-nine',
  'shareware-map-bundles-are-episode-one',
  'shareware-registered-episode-markers-absent',
  'shareware-ultimate-episode-markers-absent',
  'shareware-doom2-map-markers-absent',
  'shareware-texture1-present',
  'shareware-texture2-absent',
  'shareware-pnames-present',
  'shareware-playpal-and-colormap-present',
  'shareware-endoom-present',
  'shareware-genmidi-and-dmxgus-present',
  'shareware-titlepic-and-credit-present',
  'shareware-help1-and-help2-present',
  'shareware-stbar-and-starms-present',
  'shareware-sky1-present',
  'shareware-non-shareware-sky-textures-absent',
  'shareware-wimap0-present',
  'shareware-non-shareware-intermission-maps-absent',
  'shareware-bossback-absent',
  'shareware-victory2-absent',
  'shareware-endpic-absent',
  'shareware-three-demos-present',
  'shareware-demo4-absent',
  'shareware-flat-marker-range-present',
  'shareware-sprite-marker-range-present',
  'shareware-patch-marker-range-present',
  'shareware-cyberdemon-sprite-absent',
  'shareware-spider-mastermind-sprite-absent',
]);

const ALLOWED_SUBJECTS = new Set<ShareWareIwadCapabilityAuditEntry['subject']>([
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

const ALLOWED_REFERENCE_FILES = new Set<ShareWareIwadCapabilityAuditEntry['referenceSourceFile']>([
  'linuxdoom-1.10/d_main.c',
  'linuxdoom-1.10/r_data.c',
  'linuxdoom-1.10/p_setup.c',
  'linuxdoom-1.10/m_menu.c',
  'linuxdoom-1.10/wi_stuff.c',
  'linuxdoom-1.10/f_finale.c',
  'linuxdoom-1.10/g_game.c',
  'src/doom/d_main.c',
  'src/doom/r_data.c',
  'shareware/DOOM1.WAD',
]);

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBytes = await Bun.file(wadPath).bytes();
const wadBuffer = Buffer.from(wadBytes);
const liveHeader = parseWadHeader(wadBuffer);
const liveDirectory = parseWadDirectory(wadBuffer, liveHeader);

const liveDetection = detectShareWareIwadCapabilities(liveDirectory, liveHeader.type);

function buildSyntheticDirectory(extraNames: readonly string[] = [], shareWareDefaults = true): DirectoryEntry[] {
  const directory: DirectoryEntry[] = [];
  if (shareWareDefaults) {
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
  }
  for (const name of extraNames) {
    directory.push(Object.freeze({ offset: 0, size: 0, name }));
  }
  return directory;
}

const syntheticShareWareDirectory = buildSyntheticDirectory();
const syntheticDirectoryWithE2M1 = buildSyntheticDirectory(['E2M1']);
const syntheticDirectoryWithE4M1 = buildSyntheticDirectory(['E4M1']);
const syntheticDirectoryWithMap01 = buildSyntheticDirectory(['MAP01']);
const syntheticDirectoryWithTexture2 = buildSyntheticDirectory(['TEXTURE2']);
const syntheticDirectoryEmpty = buildSyntheticDirectory([], false);
const syntheticPwadDirectory = buildSyntheticDirectory();

function buildLiveRuntimeSnapshot(): ShareWareIwadCapabilityRuntimeSnapshot {
  const detectionAsPwad = detectShareWareIwadCapabilities(liveDirectory, 'PWAD');
  return {
    shareWareIwadTotalLumpCount: SHAREWARE_IWAD_TOTAL_LUMP_COUNT,
    shareWareIwadMapBundleCount: SHAREWARE_IWAD_MAP_BUNDLE_COUNT,
    shareWareIwadEpisodeCount: SHAREWARE_IWAD_EPISODE_COUNT,
    detectShareWareReturnsFrozenDetection: Object.isFrozen(liveDetection),
    detectShareWareReportsPwadType: detectionAsPwad.wadType === 'PWAD',
    isShareWareIwadAcceptsLiveDoom1Wad: isShareWareIwad(liveDirectory, liveHeader.type),
    isShareWareIwadRejectsE2M1Present: isShareWareIwad(syntheticDirectoryWithE2M1, 'IWAD') === false,
    isShareWareIwadRejectsE4M1Present: isShareWareIwad(syntheticDirectoryWithE4M1, 'IWAD') === false,
    isShareWareIwadRejectsMap01Present: isShareWareIwad(syntheticDirectoryWithMap01, 'IWAD') === false,
    isShareWareIwadRejectsTexture2Present: isShareWareIwad(syntheticDirectoryWithTexture2, 'IWAD') === false,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

function buildLiveOracleSample(): ShareWareDoom1WadCapabilitySample {
  return {
    wadType: liveDetection.wadType,
    totalLumpCount: liveDetection.totalLumpCount,
    mapBundleCount: liveDetection.mapBundleCount,
    episode1MapCount: liveDetection.episode1MapCount,
    episode2MapCount: liveDetection.episode2MapCount,
    episode3MapCount: liveDetection.episode3MapCount,
    episode4MapCount: liveDetection.episode4MapCount,
    doom2MapCount: liveDetection.doom2MapCount,
    capabilityFlags: {
      hasTexture1: liveDetection.hasTexture1,
      hasTexture2: liveDetection.hasTexture2,
      hasPnames: liveDetection.hasPnames,
      hasPlaypal: liveDetection.hasPlaypal,
      hasColormap: liveDetection.hasColormap,
      hasEndoom: liveDetection.hasEndoom,
      hasGenmidi: liveDetection.hasGenmidi,
      hasDmxgus: liveDetection.hasDmxgus,
      hasTitlepic: liveDetection.hasTitlepic,
      hasCredit: liveDetection.hasCredit,
      hasHelp1: liveDetection.hasHelp1,
      hasHelp2: liveDetection.hasHelp2,
      hasStbar: liveDetection.hasStbar,
      hasStarms: liveDetection.hasStarms,
      hasSky1: liveDetection.hasSky1,
      hasSky2: liveDetection.hasSky2,
      hasSky3: liveDetection.hasSky3,
      hasSky4: liveDetection.hasSky4,
      hasWimap0: liveDetection.hasWimap0,
      hasWimap1: liveDetection.hasWimap1,
      hasWimap2: liveDetection.hasWimap2,
      hasBossback: liveDetection.hasBossback,
      hasVictory2: liveDetection.hasVictory2,
      hasEndpic: liveDetection.hasEndpic,
      hasDemo1: liveDetection.hasDemo1,
      hasDemo2: liveDetection.hasDemo2,
      hasDemo3: liveDetection.hasDemo3,
      hasDemo4: liveDetection.hasDemo4,
      hasFlatMarkerRange: liveDetection.hasFlatMarkerRange,
      hasSpriteMarkerRange: liveDetection.hasSpriteMarkerRange,
      hasPatchMarkerRange: liveDetection.hasPatchMarkerRange,
      hasCyberdemonSprite: liveDetection.hasCyberdemonSprite,
      hasSpiderMastermindSprite: liveDetection.hasSpiderMastermindSprite,
    },
  };
}

const liveOracleSample = buildLiveOracleSample();

describe('shareware iwad capability audit ledger shape', () => {
  test('audits exactly thirty behavioral axes', () => {
    expect(SHAREWARE_IWAD_CAPABILITY_AUDIT.length).toBe(30);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of SHAREWARE_IWAD_CAPABILITY_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = SHAREWARE_IWAD_CAPABILITY_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry pins one of the allowed subjects', () => {
    for (const entry of SHAREWARE_IWAD_CAPABILITY_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of SHAREWARE_IWAD_CAPABILITY_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries at least one verbatim C source line', () => {
    for (const entry of SHAREWARE_IWAD_CAPABILITY_AUDIT) {
      expect(entry.cSourceLines.length).toBeGreaterThan(0);
      for (const line of entry.cSourceLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of SHAREWARE_IWAD_CAPABILITY_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the wad-type axis pins the IWAD identification stamp', () => {
    const entry = SHAREWARE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'shareware-wad-type-is-iwad');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('wad-header');
    expect(entry!.invariant.includes('IWAD')).toBe(true);
  });

  test('the texture2-absent axis cites the upstream W_CheckNumForName conditional', () => {
    const entry = SHAREWARE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'shareware-texture2-absent');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('W_CheckNumForName'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('TEXTURE2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/r_data.c');
  });

  test('the registered-episode-markers-absent axis cites the upstream W_GetNumForName fatal-on-miss', () => {
    const entry = SHAREWARE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'shareware-registered-episode-markers-absent');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('W_GetNumForName'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/p_setup.c');
  });

  test('the doom2-map-markers-absent axis cites the upstream sprintf "map%02i" formatter', () => {
    const entry = SHAREWARE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'shareware-doom2-map-markers-absent');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('"map%02i"'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/g_game.c');
  });

  test('the help1-and-help2-present axis cites the upstream M_DrawHelp pagename selector', () => {
    const entry = SHAREWARE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'shareware-help1-and-help2-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('HELP1'))).toBe(true);
    expect(entry!.cSourceLines.some((line) => line.includes('HELP2'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/m_menu.c');
  });

  test('the bossback-absent axis cites the upstream BOSSBACK V_DrawPatchDirect', () => {
    const entry = SHAREWARE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'shareware-bossback-absent');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('BOSSBACK'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/f_finale.c');
  });

  test('the wimap0-present axis cites the upstream WIMAP%i sprintf formatter', () => {
    const entry = SHAREWARE_IWAD_CAPABILITY_AUDIT.find((e) => e.id === 'shareware-wimap0-present');
    expect(entry).toBeDefined();
    expect(entry!.cSourceLines.some((line) => line.includes('WIMAP'))).toBe(true);
    expect(entry!.referenceSourceFile).toBe('linuxdoom-1.10/wi_stuff.c');
  });
});

describe('shareware iwad capability derived invariants ledger', () => {
  test('every derived invariant has a unique stable id', () => {
    const ids = SHAREWARE_IWAD_CAPABILITY_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(SHAREWARE_IWAD_CAPABILITY_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'SHAREWARE_IWAD_TOTAL_LUMP_COUNT_EQUALS_PINNED',
        'SHAREWARE_IWAD_MAP_BUNDLE_COUNT_EQUALS_NINE',
        'SHAREWARE_IWAD_EPISODE_COUNT_EQUALS_ONE',
        'DETECT_SHAREWARE_RETURNS_FROZEN_DETECTION',
        'DETECT_SHAREWARE_REJECTS_PWAD_TYPE',
        'IS_SHAREWARE_IWAD_ACCEPTS_LIVE_DOOM1_WAD',
        'IS_SHAREWARE_IWAD_REJECTS_E2M1_PRESENT',
        'IS_SHAREWARE_IWAD_REJECTS_E4M1_PRESENT',
        'IS_SHAREWARE_IWAD_REJECTS_MAP01_PRESENT',
        'IS_SHAREWARE_IWAD_REJECTS_TEXTURE2_PRESENT',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of SHAREWARE_IWAD_CAPABILITY_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('runtime constants pin the upstream definitions', () => {
  test('SHAREWARE_IWAD_TOTAL_LUMP_COUNT equals 1264 and matches PRIMARY_TARGET.wadLumpCount', () => {
    expect(SHAREWARE_IWAD_TOTAL_LUMP_COUNT).toBe(1264);
    expect(SHAREWARE_IWAD_TOTAL_LUMP_COUNT).toBe(PRIMARY_TARGET.wadLumpCount);
  });

  test('SHAREWARE_IWAD_MAP_BUNDLE_COUNT equals 9', () => {
    expect(SHAREWARE_IWAD_MAP_BUNDLE_COUNT).toBe(9);
  });

  test('SHAREWARE_IWAD_EPISODE_COUNT equals 1', () => {
    expect(SHAREWARE_IWAD_EPISODE_COUNT).toBe(1);
  });

  test('SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS is a frozen list of mandatory lumps', () => {
    expect(Object.isFrozen(SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS)).toBe(true);
    expect(SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PLAYPAL');
    expect(SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('COLORMAP');
    expect(SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('TEXTURE1');
    expect(SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('PNAMES');
    expect(SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('TITLEPIC');
    expect(SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('SKY1');
    expect(SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS).toContain('WIMAP0');
  });

  test('SHAREWARE_REQUIRED_DEMO_LUMPS lists the three shareware demos', () => {
    expect(Object.isFrozen(SHAREWARE_REQUIRED_DEMO_LUMPS)).toBe(true);
    expect(SHAREWARE_REQUIRED_DEMO_LUMPS).toEqual(['DEMO1', 'DEMO2', 'DEMO3']);
  });

  test('SHAREWARE_REQUIRED_MARKER_RANGES lists the three marker pairs', () => {
    expect(Object.isFrozen(SHAREWARE_REQUIRED_MARKER_RANGES)).toBe(true);
    expect(SHAREWARE_REQUIRED_MARKER_RANGES).toEqual(['F_START', 'F_END', 'S_START', 'S_END', 'P_START', 'P_END']);
  });

  test('SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS lists the registered/Ultimate/commercial-only lumps', () => {
    expect(Object.isFrozen(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS)).toBe(true);
    expect(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS).toContain('TEXTURE2');
    expect(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS).toContain('E2M1');
    expect(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS).toContain('E3M1');
    expect(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS).toContain('E4M1');
    expect(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS).toContain('MAP01');
    expect(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS).toContain('BOSSBACK');
    expect(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS).toContain('VICTORY2');
    expect(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS).toContain('ENDPIC');
    expect(SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS).toContain('DEMO4');
  });

  test('SHAREWARE_NEGATIVE_SPRITE_PREFIXES lists boss sprite prefixes', () => {
    expect(Object.isFrozen(SHAREWARE_NEGATIVE_SPRITE_PREFIXES)).toBe(true);
    expect(SHAREWARE_NEGATIVE_SPRITE_PREFIXES).toEqual(['CYBR', 'SPID']);
  });
});

describe('detectShareWareIwadCapabilities runtime', () => {
  test('returns a frozen detection for the live shareware DOOM1.WAD', () => {
    expect(Object.isFrozen(liveDetection)).toBe(true);
  });

  test('reports the WAD type from the supplied header type', () => {
    const detectionAsIwad = detectShareWareIwadCapabilities(liveDirectory, 'IWAD');
    const detectionAsPwad = detectShareWareIwadCapabilities(liveDirectory, 'PWAD');
    expect(detectionAsIwad.wadType).toBe('IWAD');
    expect(detectionAsPwad.wadType).toBe('PWAD');
  });

  test('reports totalLumpCount as 1264 for the live shareware DOOM1.WAD', () => {
    expect(liveDetection.totalLumpCount).toBe(1264);
  });

  test('reports mapBundleCount as 9 for the live shareware DOOM1.WAD', () => {
    expect(liveDetection.mapBundleCount).toBe(9);
  });

  test('reports episode1MapCount as 9 and other episode counts as 0 for the live shareware DOOM1.WAD', () => {
    expect(liveDetection.episode1MapCount).toBe(9);
    expect(liveDetection.episode2MapCount).toBe(0);
    expect(liveDetection.episode3MapCount).toBe(0);
    expect(liveDetection.episode4MapCount).toBe(0);
    expect(liveDetection.doom2MapCount).toBe(0);
  });

  test('reports hasTexture1 true and hasTexture2 false for the live shareware DOOM1.WAD', () => {
    expect(liveDetection.hasTexture1).toBe(true);
    expect(liveDetection.hasTexture2).toBe(false);
  });

  test('reports every required infrastructure lump as present for the live shareware DOOM1.WAD', () => {
    expect(liveDetection.hasPlaypal).toBe(true);
    expect(liveDetection.hasColormap).toBe(true);
    expect(liveDetection.hasEndoom).toBe(true);
    expect(liveDetection.hasPnames).toBe(true);
    expect(liveDetection.hasGenmidi).toBe(true);
    expect(liveDetection.hasDmxgus).toBe(true);
    expect(liveDetection.hasTitlepic).toBe(true);
    expect(liveDetection.hasCredit).toBe(true);
    expect(liveDetection.hasHelp1).toBe(true);
    expect(liveDetection.hasHelp2).toBe(true);
    expect(liveDetection.hasStbar).toBe(true);
    expect(liveDetection.hasStarms).toBe(true);
    expect(liveDetection.hasSky1).toBe(true);
    expect(liveDetection.hasWimap0).toBe(true);
  });

  test('reports every non-shareware sky texture as absent for the live shareware DOOM1.WAD', () => {
    expect(liveDetection.hasSky2).toBe(false);
    expect(liveDetection.hasSky3).toBe(false);
    expect(liveDetection.hasSky4).toBe(false);
  });

  test('reports every non-shareware intermission map as absent for the live shareware DOOM1.WAD', () => {
    expect(liveDetection.hasWimap1).toBe(false);
    expect(liveDetection.hasWimap2).toBe(false);
  });

  test('reports BOSSBACK / VICTORY2 / ENDPIC as absent for the live shareware DOOM1.WAD', () => {
    expect(liveDetection.hasBossback).toBe(false);
    expect(liveDetection.hasVictory2).toBe(false);
    expect(liveDetection.hasEndpic).toBe(false);
  });

  test('reports DEMO1, DEMO2, DEMO3 present and DEMO4 absent for the live shareware DOOM1.WAD', () => {
    expect(liveDetection.hasDemo1).toBe(true);
    expect(liveDetection.hasDemo2).toBe(true);
    expect(liveDetection.hasDemo3).toBe(true);
    expect(liveDetection.hasDemo4).toBe(false);
  });

  test('reports F_START/F_END, S_START/S_END, P_START/P_END marker ranges as present', () => {
    expect(liveDetection.hasFlatMarkerRange).toBe(true);
    expect(liveDetection.hasSpriteMarkerRange).toBe(true);
    expect(liveDetection.hasPatchMarkerRange).toBe(true);
  });

  test('reports CYBR (Cyberdemon) and SPID (Spider Mastermind) sprite prefixes as absent', () => {
    expect(liveDetection.hasCyberdemonSprite).toBe(false);
    expect(liveDetection.hasSpiderMastermindSprite).toBe(false);
  });

  test('treats lump names case-insensitively (uppercased before lookup)', () => {
    const lowerDirectory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'playpal' }), Object.freeze({ offset: 0, size: 0, name: 'texture1' }), Object.freeze({ offset: 0, size: 0, name: 'e1m1' })];
    const detection = detectShareWareIwadCapabilities(lowerDirectory, 'IWAD');
    expect(detection.hasPlaypal).toBe(true);
    expect(detection.hasTexture1).toBe(true);
    expect(detection.episode1MapCount).toBe(1);
  });

  test('reports zero map bundles for an empty directory', () => {
    const detection = detectShareWareIwadCapabilities(syntheticDirectoryEmpty, 'IWAD');
    expect(detection.mapBundleCount).toBe(0);
    expect(detection.episode1MapCount).toBe(0);
    expect(detection.totalLumpCount).toBe(0);
  });

  test('reports e2m1 marker count as 1 when the directory contains E2M1', () => {
    const detection = detectShareWareIwadCapabilities(syntheticDirectoryWithE2M1, 'IWAD');
    expect(detection.episode2MapCount).toBe(1);
  });

  test('reports e4m1 marker count as 1 when the directory contains E4M1', () => {
    const detection = detectShareWareIwadCapabilities(syntheticDirectoryWithE4M1, 'IWAD');
    expect(detection.episode4MapCount).toBe(1);
  });

  test('reports doom2 map count as 1 when the directory contains MAP01', () => {
    const detection = detectShareWareIwadCapabilities(syntheticDirectoryWithMap01, 'IWAD');
    expect(detection.doom2MapCount).toBe(1);
  });

  test('reports hasTexture2 true when the directory contains TEXTURE2', () => {
    const detection = detectShareWareIwadCapabilities(syntheticDirectoryWithTexture2, 'IWAD');
    expect(detection.hasTexture2).toBe(true);
  });

  test('reports CYBR sprite prefix as present when the directory contains CYBRA1', () => {
    const directory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'CYBRA1' })];
    const detection = detectShareWareIwadCapabilities(directory, 'IWAD');
    expect(detection.hasCyberdemonSprite).toBe(true);
  });

  test('reports SPID sprite prefix as present when the directory contains SPIDA1A2', () => {
    const directory: DirectoryEntry[] = [Object.freeze({ offset: 0, size: 0, name: 'SPIDA1A2' })];
    const detection = detectShareWareIwadCapabilities(directory, 'IWAD');
    expect(detection.hasSpiderMastermindSprite).toBe(true);
  });
});

describe('isShareWareIwad predicate', () => {
  test('returns true for the live shareware DOOM1.WAD', () => {
    expect(isShareWareIwad(liveDirectory, liveHeader.type)).toBe(true);
  });

  test('returns true for a synthesised shareware-shaped directory', () => {
    expect(isShareWareIwad(syntheticShareWareDirectory, 'IWAD')).toBe(true);
  });

  test('returns false for a directory that contains E2M1 (registered)', () => {
    expect(isShareWareIwad(syntheticDirectoryWithE2M1, 'IWAD')).toBe(false);
  });

  test('returns false for a directory that contains E4M1 (Ultimate)', () => {
    expect(isShareWareIwad(syntheticDirectoryWithE4M1, 'IWAD')).toBe(false);
  });

  test('returns false for a directory that contains MAP01 (commercial)', () => {
    expect(isShareWareIwad(syntheticDirectoryWithMap01, 'IWAD')).toBe(false);
  });

  test('returns false for a directory that contains TEXTURE2 (registered/Ultimate)', () => {
    expect(isShareWareIwad(syntheticDirectoryWithTexture2, 'IWAD')).toBe(false);
  });

  test('returns false when the WAD type is PWAD', () => {
    expect(isShareWareIwad(syntheticPwadDirectory, 'PWAD')).toBe(false);
  });

  test('returns false for an empty directory', () => {
    expect(isShareWareIwad(syntheticDirectoryEmpty, 'IWAD')).toBe(false);
  });
});

describe('crossCheckShareWareIwadCapabilityRuntime', () => {
  test('reports zero failures for the live runtime snapshot', () => {
    expect(crossCheckShareWareIwadCapabilityRuntime(liveRuntimeSnapshot)).toEqual([]);
  });

  test('detects a tampered shareWareIwadTotalLumpCount', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, shareWareIwadTotalLumpCount: 0 };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:SHAREWARE_IWAD_TOTAL_LUMP_COUNT_EQUALS_PINNED');
    expect(failures).toContain('audit:shareware-total-lump-count-pinned:not-observed');
  });

  test('detects a tampered shareWareIwadMapBundleCount', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, shareWareIwadMapBundleCount: 27 };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:SHAREWARE_IWAD_MAP_BUNDLE_COUNT_EQUALS_NINE');
    expect(failures).toContain('audit:shareware-map-bundle-count-is-nine:not-observed');
  });

  test('detects a tampered shareWareIwadEpisodeCount', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, shareWareIwadEpisodeCount: 3 };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:SHAREWARE_IWAD_EPISODE_COUNT_EQUALS_ONE');
  });

  test('detects a detector that fails to freeze the returned detection', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, detectShareWareReturnsFrozenDetection: false };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:DETECT_SHAREWARE_RETURNS_FROZEN_DETECTION');
  });

  test('detects a detector that does not propagate the PWAD wad type', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, detectShareWareReportsPwadType: false };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:DETECT_SHAREWARE_REJECTS_PWAD_TYPE');
    expect(failures).toContain('audit:shareware-wad-type-is-iwad:not-observed');
  });

  test('detects an isShareWareIwad that rejects the live shareware DOOM1.WAD', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isShareWareIwadAcceptsLiveDoom1Wad: false };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_SHAREWARE_IWAD_ACCEPTS_LIVE_DOOM1_WAD');
    expect(failures).toContain('audit:shareware-map-bundles-are-episode-one:not-observed');
  });

  test('detects an isShareWareIwad that accepts a directory containing E2M1', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isShareWareIwadRejectsE2M1Present: false };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_SHAREWARE_IWAD_REJECTS_E2M1_PRESENT');
    expect(failures).toContain('audit:shareware-registered-episode-markers-absent:not-observed');
  });

  test('detects an isShareWareIwad that accepts a directory containing E4M1', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isShareWareIwadRejectsE4M1Present: false };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_SHAREWARE_IWAD_REJECTS_E4M1_PRESENT');
    expect(failures).toContain('audit:shareware-ultimate-episode-markers-absent:not-observed');
  });

  test('detects an isShareWareIwad that accepts a directory containing MAP01', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isShareWareIwadRejectsMap01Present: false };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_SHAREWARE_IWAD_REJECTS_MAP01_PRESENT');
    expect(failures).toContain('audit:shareware-doom2-map-markers-absent:not-observed');
  });

  test('detects an isShareWareIwad that accepts a directory containing TEXTURE2', () => {
    const tampered: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot, isShareWareIwadRejectsTexture2Present: false };
    const failures = crossCheckShareWareIwadCapabilityRuntime(tampered);
    expect(failures).toContain('derived:IS_SHAREWARE_IWAD_REJECTS_TEXTURE2_PRESENT');
    expect(failures).toContain('audit:shareware-texture2-absent:not-observed');
  });

  test('reports an empty failure list for a freshly cloned snapshot', () => {
    const cloned: ShareWareIwadCapabilityRuntimeSnapshot = { ...liveRuntimeSnapshot };
    expect(crossCheckShareWareIwadCapabilityRuntime(cloned)).toEqual([]);
  });
});

describe('shareware DOOM1.WAD capability oracle', () => {
  test('declares the canonical shareware filename, IWAD type, and total lump count', () => {
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.filename).toBe('DOOM1.WAD');
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.wadType).toBe('IWAD');
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.totalLumpCount).toBe(1264);
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.totalLumpCount === PRIMARY_TARGET.wadLumpCount).toBe(true);
  });

  test('pins the 9 episode-1 maps and zero non-shareware map markers', () => {
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.mapBundleCount).toBe(9);
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.episode1MapCount).toBe(9);
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.episode2MapCount).toBe(0);
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.episode3MapCount).toBe(0);
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.episode4MapCount).toBe(0);
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.doom2MapCount).toBe(0);
  });

  test('pins TEXTURE1 present and TEXTURE2 absent', () => {
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags.hasTexture1).toBe(true);
    expect(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags.hasTexture2).toBe(false);
  });

  test('pins every required infrastructure lump as present', () => {
    const flags = SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags;
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
    expect(flags.hasWimap0).toBe(true);
  });

  test('pins every non-shareware sky and intermission lump as absent', () => {
    const flags = SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasSky2).toBe(false);
    expect(flags.hasSky3).toBe(false);
    expect(flags.hasSky4).toBe(false);
    expect(flags.hasWimap1).toBe(false);
    expect(flags.hasWimap2).toBe(false);
  });

  test('pins BOSSBACK / VICTORY2 / ENDPIC as absent', () => {
    const flags = SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasBossback).toBe(false);
    expect(flags.hasVictory2).toBe(false);
    expect(flags.hasEndpic).toBe(false);
  });

  test('pins DEMO1, DEMO2, DEMO3 present and DEMO4 absent', () => {
    const flags = SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasDemo1).toBe(true);
    expect(flags.hasDemo2).toBe(true);
    expect(flags.hasDemo3).toBe(true);
    expect(flags.hasDemo4).toBe(false);
  });

  test('pins F_START/F_END, S_START/S_END, P_START/P_END marker ranges as present', () => {
    const flags = SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasFlatMarkerRange).toBe(true);
    expect(flags.hasSpriteMarkerRange).toBe(true);
    expect(flags.hasPatchMarkerRange).toBe(true);
  });

  test('pins boss sprite prefixes as absent', () => {
    const flags = SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags;
    expect(flags.hasCyberdemonSprite).toBe(false);
    expect(flags.hasSpiderMastermindSprite).toBe(false);
  });

  test('the oracle and its capability flags are deeply frozen', () => {
    expect(Object.isFrozen(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE)).toBe(true);
    expect(Object.isFrozen(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.capabilityFlags)).toBe(true);
  });

  test('every live capability sample reports zero failures against the pinned oracle', () => {
    expect(crossCheckShareWareDoom1WadCapabilitySample(liveOracleSample)).toEqual([]);
  });

  test('matches the wad-map-summary.json reference manifest on map count', async () => {
    const manifestText = await Bun.file('reference/manifests/wad-map-summary.json').text();
    const manifest = JSON.parse(manifestText) as { totalLumps: number; lumpCategories: { 'map-marker': number; 'map-data': number }; maps: { name: string }[] };
    expect(manifest.totalLumps).toBe(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.totalLumpCount);
    expect(manifest.lumpCategories['map-marker']).toBe(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.mapBundleCount);
    expect(manifest.maps.length).toBe(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.episode1MapCount);
    for (const m of manifest.maps) {
      expect(/^E1M[1-9]$/.test(m.name)).toBe(true);
    }
  });

  test('the pinned IWAD filename matches PRIMARY_TARGET.wadFilename', () => {
    expect(PRIMARY_TARGET.wadFilename).toBe(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.filename);
  });
});

describe('crossCheckShareWareDoom1WadCapabilitySample failure modes', () => {
  test('detects a wrong wadType', () => {
    const tampered: ShareWareDoom1WadCapabilitySample = { ...liveOracleSample, wadType: 'PWAD' };
    expect(crossCheckShareWareDoom1WadCapabilitySample(tampered)).toContain('oracle:wadType:value-mismatch');
  });

  test('detects a wrong totalLumpCount', () => {
    const tampered: ShareWareDoom1WadCapabilitySample = { ...liveOracleSample, totalLumpCount: 0 };
    expect(crossCheckShareWareDoom1WadCapabilitySample(tampered)).toContain('oracle:totalLumpCount:value-mismatch');
  });

  test('detects a wrong mapBundleCount', () => {
    const tampered: ShareWareDoom1WadCapabilitySample = { ...liveOracleSample, mapBundleCount: 27 };
    expect(crossCheckShareWareDoom1WadCapabilitySample(tampered)).toContain('oracle:mapBundleCount:value-mismatch');
  });

  test('detects a wrong episode1MapCount', () => {
    const tampered: ShareWareDoom1WadCapabilitySample = { ...liveOracleSample, episode1MapCount: 8 };
    expect(crossCheckShareWareDoom1WadCapabilitySample(tampered)).toContain('oracle:episode1MapCount:value-mismatch');
  });

  test('detects a wrong episode2MapCount', () => {
    const tampered: ShareWareDoom1WadCapabilitySample = { ...liveOracleSample, episode2MapCount: 9 };
    expect(crossCheckShareWareDoom1WadCapabilitySample(tampered)).toContain('oracle:episode2MapCount:value-mismatch');
  });

  test('detects a wrong episode4MapCount', () => {
    const tampered: ShareWareDoom1WadCapabilitySample = { ...liveOracleSample, episode4MapCount: 9 };
    expect(crossCheckShareWareDoom1WadCapabilitySample(tampered)).toContain('oracle:episode4MapCount:value-mismatch');
  });

  test('detects a wrong doom2MapCount', () => {
    const tampered: ShareWareDoom1WadCapabilitySample = { ...liveOracleSample, doom2MapCount: 32 };
    expect(crossCheckShareWareDoom1WadCapabilitySample(tampered)).toContain('oracle:doom2MapCount:value-mismatch');
  });

  function tamperFlag(flag: keyof ShareWareDoom1WadCapabilityFlags, newValue: boolean): ShareWareDoom1WadCapabilitySample {
    return {
      ...liveOracleSample,
      capabilityFlags: { ...liveOracleSample.capabilityFlags, [flag]: newValue },
    };
  }

  test('detects a flipped hasTexture2 flag', () => {
    const failures = crossCheckShareWareDoom1WadCapabilitySample(tamperFlag('hasTexture2', true));
    expect(failures).toContain('oracle:capabilityFlags:hasTexture2:value-mismatch');
  });

  test('detects a flipped hasTexture1 flag', () => {
    const failures = crossCheckShareWareDoom1WadCapabilitySample(tamperFlag('hasTexture1', false));
    expect(failures).toContain('oracle:capabilityFlags:hasTexture1:value-mismatch');
  });

  test('detects a flipped hasBossback flag', () => {
    const failures = crossCheckShareWareDoom1WadCapabilitySample(tamperFlag('hasBossback', true));
    expect(failures).toContain('oracle:capabilityFlags:hasBossback:value-mismatch');
  });

  test('detects a flipped hasVictory2 flag', () => {
    const failures = crossCheckShareWareDoom1WadCapabilitySample(tamperFlag('hasVictory2', true));
    expect(failures).toContain('oracle:capabilityFlags:hasVictory2:value-mismatch');
  });

  test('detects a flipped hasDemo4 flag', () => {
    const failures = crossCheckShareWareDoom1WadCapabilitySample(tamperFlag('hasDemo4', true));
    expect(failures).toContain('oracle:capabilityFlags:hasDemo4:value-mismatch');
  });

  test('detects a flipped hasSky4 flag', () => {
    const failures = crossCheckShareWareDoom1WadCapabilitySample(tamperFlag('hasSky4', true));
    expect(failures).toContain('oracle:capabilityFlags:hasSky4:value-mismatch');
  });

  test('detects a flipped hasCyberdemonSprite flag', () => {
    const failures = crossCheckShareWareDoom1WadCapabilitySample(tamperFlag('hasCyberdemonSprite', true));
    expect(failures).toContain('oracle:capabilityFlags:hasCyberdemonSprite:value-mismatch');
  });

  test('detects a flipped hasFlatMarkerRange flag', () => {
    const failures = crossCheckShareWareDoom1WadCapabilitySample(tamperFlag('hasFlatMarkerRange', false));
    expect(failures).toContain('oracle:capabilityFlags:hasFlatMarkerRange:value-mismatch');
  });

  test('detects a flipped hasHelp2 flag', () => {
    const failures = crossCheckShareWareDoom1WadCapabilitySample(tamperFlag('hasHelp2', false));
    expect(failures).toContain('oracle:capabilityFlags:hasHelp2:value-mismatch');
  });
});

describe('shareware DOOM1.WAD inventory matches the runtime detection', () => {
  test('the live IWAD lump count matches PRIMARY_TARGET.wadLumpCount and SHAREWARE_IWAD_TOTAL_LUMP_COUNT', () => {
    expect(liveDirectory.length).toBe(PRIMARY_TARGET.wadLumpCount);
    expect(liveDirectory.length).toBe(SHAREWARE_IWAD_TOTAL_LUMP_COUNT);
  });

  test('every required infrastructure lump is present in the live directory', () => {
    const names = new Set(liveDirectory.map((entry) => entry.name.toUpperCase()));
    for (const lumpName of SHAREWARE_REQUIRED_INFRASTRUCTURE_LUMPS) {
      expect(names.has(lumpName)).toBe(true);
    }
  });

  test('every required demo lump is present in the live directory', () => {
    const names = new Set(liveDirectory.map((entry) => entry.name.toUpperCase()));
    for (const lumpName of SHAREWARE_REQUIRED_DEMO_LUMPS) {
      expect(names.has(lumpName)).toBe(true);
    }
  });

  test('every required marker range pair is present in the live directory', () => {
    const names = new Set(liveDirectory.map((entry) => entry.name.toUpperCase()));
    for (const markerName of SHAREWARE_REQUIRED_MARKER_RANGES) {
      expect(names.has(markerName)).toBe(true);
    }
  });

  test('every negative-fingerprint lump is absent from the live directory', () => {
    const names = new Set(liveDirectory.map((entry) => entry.name.toUpperCase()));
    for (const lumpName of SHAREWARE_NEGATIVE_FINGERPRINT_LUMPS) {
      expect(names.has(lumpName)).toBe(false);
    }
  });

  test('no sprite frame in the live directory starts with a negative-fingerprint prefix', () => {
    for (const prefix of SHAREWARE_NEGATIVE_SPRITE_PREFIXES) {
      const found = liveDirectory.find((entry) => entry.name.toUpperCase().startsWith(prefix));
      expect(found).toBeUndefined();
    }
  });

  test('the live IWAD wadType matches the oracle wadType', () => {
    expect(liveHeader.type).toBe(SHAREWARE_DOOM1_WAD_CAPABILITY_ORACLE.wadType);
  });
});

describe('05-016 step file declarations', () => {
  test('the step file declares the wad lane with the correct write lock and prerequisite', async () => {
    const stepFileText = await Bun.file('plan_vanilla_parity/steps/05-016-detect-shareware-iwad-capabilities.md').text();
    expect(stepFileText.includes('lane\n\nwad')).toBe(true);
    expect(stepFileText.includes('src/assets/detect-shareware-iwad-capabilities.ts')).toBe(true);
    expect(stepFileText.includes('test/vanilla_parity/wad/detect-shareware-iwad-capabilities.test.ts')).toBe(true);
    expect(stepFileText.includes('00-018')).toBe(true);
  });
});
