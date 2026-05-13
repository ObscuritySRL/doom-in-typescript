import { describe, expect, test } from 'bun:test';

import { E1M8_MAP_SETUP_STATE } from '../../../src/map/compare-e1m8-boss-map-setup-state.ts';
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
const bundle = parseMapBundle(directory, wadBuffer, 'E1M8');
const data = setupLevel(bundle);

describe('E1M8 boss map setup state matches DOOM1.WAD oracle', () => {
  test('map name is E1M8', () => {
    expect(data.name).toBe(E1M8_MAP_SETUP_STATE.name);
  });

  test('vertex count matches pinned value', () => {
    expect(data.vertexes.length).toBe(E1M8_MAP_SETUP_STATE.vertexes);
  });

  test('sector count matches pinned value', () => {
    expect(data.sectors.length).toBe(E1M8_MAP_SETUP_STATE.sectors);
  });

  test('sidedef count matches pinned value', () => {
    expect(data.sidedefs.length).toBe(E1M8_MAP_SETUP_STATE.sidedefs);
  });

  test('linedef count matches pinned value', () => {
    expect(data.linedefs.length).toBe(E1M8_MAP_SETUP_STATE.linedefs);
  });

  test('seg count matches pinned value', () => {
    expect(data.segs.length).toBe(E1M8_MAP_SETUP_STATE.segs);
  });

  test('subsector count matches pinned value', () => {
    expect(data.subsectors.length).toBe(E1M8_MAP_SETUP_STATE.subsectors);
  });

  test('node count matches pinned value', () => {
    expect(data.nodes.length).toBe(E1M8_MAP_SETUP_STATE.nodes);
  });

  test('things count matches pinned value', () => {
    expect(data.things.length).toBe(E1M8_MAP_SETUP_STATE.things);
  });

  test('blockmap dimensions match pinned values', () => {
    expect(data.blockmap.columns).toBe(E1M8_MAP_SETUP_STATE.blockmapColumns);
    expect(data.blockmap.rows).toBe(E1M8_MAP_SETUP_STATE.blockmapRows);
  });
});
