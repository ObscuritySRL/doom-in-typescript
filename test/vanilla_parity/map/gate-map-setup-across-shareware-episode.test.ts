import { describe, expect, test } from 'bun:test';

import { SHAREWARE_EPISODE_MAP_NAMES, SHAREWARE_EPISODE_PINNED_ORACLES } from '../../../src/map/gate-map-setup-across-shareware-episode.ts';
import { parseMapBundle } from '../../../src/map/mapBundle.ts';
import { setupLevel } from '../../../src/map/mapSetup.ts';
import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);

describe('gate: shareware episode map setup oracles', () => {
  test('all 9 shareware-episode maps are listed in canonical order', () => {
    expect([...SHAREWARE_EPISODE_MAP_NAMES]).toEqual(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9']);
  });

  test('all 9 shareware maps load from DOOM1.WAD without error', () => {
    for (const name of SHAREWARE_EPISODE_MAP_NAMES) {
      const bundle = parseMapBundle(directory, wadBuffer, name);
      const data = setupLevel(bundle);
      expect(data.name).toBe(name);
      expect(data.vertexes.length).toBeGreaterThan(0);
      expect(data.sectors.length).toBeGreaterThan(0);
      expect(data.linedefs.length).toBeGreaterThan(0);
      expect(data.things.length).toBeGreaterThan(0);
    }
  });

  test('pinned oracles match DOOM1.WAD load', () => {
    for (const [name, oracle] of Object.entries(SHAREWARE_EPISODE_PINNED_ORACLES)) {
      const bundle = parseMapBundle(directory, wadBuffer, name);
      const data = setupLevel(bundle);
      expect(data.vertexes.length).toBe(oracle.vertexes);
      expect(data.sectors.length).toBe(oracle.sectors);
      expect(data.linedefs.length).toBe(oracle.linedefs);
      expect(data.things.length).toBe(oracle.things);
    }
  });
});
