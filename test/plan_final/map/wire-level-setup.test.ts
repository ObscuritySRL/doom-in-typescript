import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parseCommandLineConfiguration } from '../../../src/vanilla/commandLineConfiguration.ts';
import { buildIwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import { resolveLaunchContext } from '../../../src/vanilla/launchContext.ts';
import type { LaunchContextEnvironment } from '../../../src/vanilla/launchContext.ts';
import { WireLevelSetupError, wireLevelSetup } from '../../../src/vanilla/wireLevelSetup.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_LEVEL_SETUP_RELATIVE_PATH = 'src/vanilla/wireLevelSetup.ts';
const WIRE_LEVEL_SETUP_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, WIRE_LEVEL_SETUP_RELATIVE_PATH);
const REFERENCE_IWAD_ABSOLUTE_PATH = resolve(REPOSITORY_ROOT_DIRECTORY, 'doom', 'DOOM1.WAD');

const EMPTY_ENVIRONMENT: LaunchContextEnvironment = Object.freeze({
  doesBasenameExistInWadDirectory: () => false,
  doomWadDirectoryEnvironmentValue: null,
});

function buildReferenceCacheAndBuffer(): { buffer: Buffer; cache: ReturnType<typeof buildIwadResourceCache> } | null {
  if (!existsSync(REFERENCE_IWAD_ABSOLUTE_PATH)) {
    return null;
  }
  const buffer = readFileSync(REFERENCE_IWAD_ABSOLUTE_PATH);
  const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', REFERENCE_IWAD_ABSOLUTE_PATH]);
  const launchContext = resolveLaunchContext(configuration, EMPTY_ENVIRONMENT);
  const cache = buildIwadResourceCache(launchContext, {
    readFile: () => buffer,
  });
  return { buffer, cache };
}

describe('plan_final map: wire-level-setup', () => {
  test('src/vanilla/wireLevelSetup.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(WIRE_LEVEL_SETUP_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(WIRE_LEVEL_SETUP_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/wireLevelSetup.ts cites plan_final step 08-001 in the top-of-file comment', () => {
    const fileText = readFileSync(WIRE_LEVEL_SETUP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('08-001');
    expect(fileText).toContain('wireLevelSetup');
  });

  test('src/vanilla/wireLevelSetup.ts imports the read-only mapBundle and mapSetup primitives without modifying them', () => {
    const fileText = readFileSync(WIRE_LEVEL_SETUP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../map/mapBundle.ts'");
    expect(fileText).toContain("from '../map/mapSetup.ts'");
  });

  test('WireLevelSetupError exposes the reason discriminator and the requested map name', () => {
    const example = new WireLevelSetupError('map-not-found', 'MISSING', 'sample message');
    expect(example).toBeInstanceOf(Error);
    expect(example.name).toBe('WireLevelSetupError');
    expect(example.reason).toBe('map-not-found');
    expect(example.requestedMapName).toBe('MISSING');
    expect(example.message).toBe('sample message');
  });

  test('wireLevelSetup is exported as a function accepting (resourceCache, wadBuffer, mapName)', () => {
    expect(typeof wireLevelSetup).toBe('function');
    expect(wireLevelSetup.length).toBe(3);
  });

  const setup = buildReferenceCacheAndBuffer();
  if (setup === null) {
    test.skip('reference doom/DOOM1.WAD is not present; skipping live-IWAD assertions', () => {});
  } else {
    test('wireLevelSetup loads E1M1 from shareware doom/DOOM1.WAD and produces a non-empty MapData', () => {
      const mapData = wireLevelSetup(setup.cache, setup.buffer, 'E1M1');
      expect(mapData.name).toBe('E1M1');
      expect(mapData.sectors.length).toBeGreaterThan(0);
      expect(mapData.linedefs.length).toBeGreaterThan(0);
      expect(mapData.vertexes.length).toBeGreaterThan(0);
      expect(mapData.sidedefs.length).toBeGreaterThan(0);
      expect(mapData.things.length).toBeGreaterThan(0);
      expect(mapData.subsectors.length).toBeGreaterThan(0);
      expect(mapData.nodes.length).toBeGreaterThan(0);
      expect(mapData.segs.length).toBeGreaterThan(0);
    });

    test('wireLevelSetup loads E1M9 (secret level) from shareware doom/DOOM1.WAD', () => {
      const mapData = wireLevelSetup(setup.cache, setup.buffer, 'E1M9');
      expect(mapData.name).toBe('E1M9');
      expect(mapData.sectors.length).toBeGreaterThan(0);
    });

    test('wireLevelSetup trims whitespace from the supplied map name', () => {
      const mapData = wireLevelSetup(setup.cache, setup.buffer, '  E1M1  ');
      expect(mapData.name).toBe('E1M1');
    });

    test('wireLevelSetup populates the P_GroupLines outputs (subsectorSectors, lineSectors, sectorGroups, validCount)', () => {
      const mapData = wireLevelSetup(setup.cache, setup.buffer, 'E1M1');
      expect(mapData.subsectorSectors.length).toBe(mapData.subsectors.length);
      expect(mapData.lineSectors.length).toBe(mapData.linedefs.length);
      expect(mapData.sectorGroups.length).toBe(mapData.sectors.length);
      expect(typeof mapData.validCount).toBe('object');
    });
  }

  test('wireLevelSetup throws WireLevelSetupError when the map name is empty', () => {
    const setupForEmptyTest = buildReferenceCacheAndBuffer();
    if (setupForEmptyTest === null) {
      return;
    }
    let caughtError: unknown;
    try {
      wireLevelSetup(setupForEmptyTest.cache, setupForEmptyTest.buffer, '');
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(WireLevelSetupError);
    if (caughtError instanceof WireLevelSetupError) {
      expect(caughtError.reason).toBe('map-name-empty');
    }
  });

  test('wireLevelSetup throws WireLevelSetupError with reason map-not-found for an unknown map name', () => {
    const setupForUnknownTest = buildReferenceCacheAndBuffer();
    if (setupForUnknownTest === null) {
      return;
    }
    let caughtError: unknown;
    try {
      wireLevelSetup(setupForUnknownTest.cache, setupForUnknownTest.buffer, 'MAP99');
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeInstanceOf(WireLevelSetupError);
    if (caughtError instanceof WireLevelSetupError) {
      expect(caughtError.reason).toBe('map-not-found');
      expect(caughtError.requestedMapName).toBe('MAP99');
    }
  });
});
