import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { parseCommandLineConfiguration } from '../../../src/vanilla/commandLineConfiguration.ts';
import { buildIwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import { resolveLaunchContext } from '../../../src/vanilla/launchContext.ts';
import type { LaunchContextEnvironment } from '../../../src/vanilla/launchContext.ts';
import { wireLevelSetup } from '../../../src/vanilla/wireLevelSetup.ts';
import { walkBspFromViewpoint } from '../../../src/vanilla/wireBspWallRenderer.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_BSP_RELATIVE_PATH = 'src/vanilla/wireBspWallRenderer.ts';
const WIRE_BSP_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, WIRE_BSP_RELATIVE_PATH);
const REFERENCE_IWAD_ABSOLUTE_PATH = resolve(REPOSITORY_ROOT_DIRECTORY, 'doom', 'DOOM1.WAD');

const EMPTY_ENVIRONMENT: LaunchContextEnvironment = Object.freeze({
  doesBasenameExistInWadDirectory: () => false,
  doomWadDirectoryEnvironmentValue: null,
});

function buildE1M1MapData() {
  if (!existsSync(REFERENCE_IWAD_ABSOLUTE_PATH)) {
    return null;
  }
  const buffer = readFileSync(REFERENCE_IWAD_ABSOLUTE_PATH);
  const configuration = parseCommandLineConfiguration(['doom_codex', '-iwad', REFERENCE_IWAD_ABSOLUTE_PATH]);
  const launchContext = resolveLaunchContext(configuration, EMPTY_ENVIRONMENT);
  const cache = buildIwadResourceCache(launchContext, { readFile: () => buffer });
  return wireLevelSetup(cache, buffer, 'E1M1');
}

describe('plan_final render: wire-bsp-wall-renderer', () => {
  test('src/vanilla/wireBspWallRenderer.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(WIRE_BSP_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(WIRE_BSP_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/wireBspWallRenderer.ts cites plan_final step 06-002 in the top-of-file comment', () => {
    const fileText = readFileSync(WIRE_BSP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('06-002');
    expect(fileText).toContain('walkBspFromViewpoint');
  });

  test('src/vanilla/wireBspWallRenderer.ts imports the read-only nodeTraversal and bspStructs primitives without modifying them', () => {
    const fileText = readFileSync(WIRE_BSP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../map/nodeTraversal.ts'");
    expect(fileText).toContain("from '../map/bspStructs.ts'");
  });

  test('walkBspFromViewpoint is exported as a function accepting (mapData, viewX, viewY)', () => {
    expect(typeof walkBspFromViewpoint).toBe('function');
    expect(walkBspFromViewpoint.length).toBe(3);
  });

  const mapData = buildE1M1MapData();
  if (mapData === null) {
    test.skip('reference doom/DOOM1.WAD is not present; skipping live-map BSP-walk assertions', () => {});
  } else {
    test('walkBspFromViewpoint returns a non-empty subsector sequence for the E1M1 player start viewpoint', () => {
      const playerStart = mapData.things.find((thing) => thing.type === 1);
      expect(playerStart).toBeDefined();
      const viewX = (playerStart!.x << FRACBITS) | 0;
      const viewY = (playerStart!.y << FRACBITS) | 0;
      const order = walkBspFromViewpoint(mapData, viewX, viewY);
      expect(order.length).toBeGreaterThan(0);
      expect(order.length).toBe(mapData.subsectors.length);
    });

    test('walkBspFromViewpoint produces a permutation of subsector indices (every subsector exactly once)', () => {
      const playerStart = mapData.things.find((thing) => thing.type === 1)!;
      const viewX = (playerStart.x << FRACBITS) | 0;
      const viewY = (playerStart.y << FRACBITS) | 0;
      const order = walkBspFromViewpoint(mapData, viewX, viewY);
      const observedIndices = new Set<number>(order);
      expect(observedIndices.size).toBe(mapData.subsectors.length);
      for (let subsectorIndex = 0; subsectorIndex < mapData.subsectors.length; subsectorIndex += 1) {
        expect(observedIndices.has(subsectorIndex)).toBe(true);
      }
    });

    test('walkBspFromViewpoint result is frozen', () => {
      const playerStart = mapData.things.find((thing) => thing.type === 1)!;
      const viewX = (playerStart.x << FRACBITS) | 0;
      const viewY = (playerStart.y << FRACBITS) | 0;
      const order = walkBspFromViewpoint(mapData, viewX, viewY);
      expect(Object.isFrozen(order)).toBe(true);
    });

    test('walkBspFromViewpoint is deterministic — same map + same viewpoint produces the same order', () => {
      const playerStart = mapData.things.find((thing) => thing.type === 1)!;
      const viewX = (playerStart.x << FRACBITS) | 0;
      const viewY = (playerStart.y << FRACBITS) | 0;
      const orderA = walkBspFromViewpoint(mapData, viewX, viewY);
      const orderB = walkBspFromViewpoint(mapData, viewX, viewY);
      expect([...orderA]).toEqual([...orderB]);
    });

    test('walkBspFromViewpoint produces different orderings for different viewpoints', () => {
      const playerStart = mapData.things.find((thing) => thing.type === 1)!;
      const viewX1 = (playerStart.x << FRACBITS) | 0;
      const viewY1 = (playerStart.y << FRACBITS) | 0;
      const viewX2 = ((playerStart.x + 2048) << FRACBITS) | 0;
      const viewY2 = ((playerStart.y + 2048) << FRACBITS) | 0;
      const orderA = walkBspFromViewpoint(mapData, viewX1, viewY1);
      const orderB = walkBspFromViewpoint(mapData, viewX2, viewY2);
      const sameFirstSubsector = orderA[0] === orderB[0];
      const sameLastSubsector = orderA[orderA.length - 1] === orderB[orderB.length - 1];
      expect(sameFirstSubsector && sameLastSubsector).toBe(false);
    });
  }
});
