import { describe, expect, test } from 'bun:test';

import { E1M8_BOSS_DEATH_ORACLE } from '../../../src/ai/compare-e1m8-boss-death-oracle.ts';
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

describe('E1M8 boss death oracle', () => {
  test('map name is E1M8', () => {
    expect(data.name).toBe(E1M8_BOSS_DEATH_ORACLE.mapName);
  });

  test('baron mapthing type is 3003', () => {
    expect(E1M8_BOSS_DEATH_ORACLE.bossThingMapThingType).toBe(3003);
  });

  test('boss death uses tag-666 floor lower', () => {
    expect(E1M8_BOSS_DEATH_ORACLE.bossDeathTag).toBe(666);
    expect(E1M8_BOSS_DEATH_ORACLE.bossDeathFloorAction).toBe('lowerFloorToLowest');
  });

  test('expected baron count matches barons placed on map (type 3003)', () => {
    const barons = data.things.filter((t) => t.type === 3003);
    expect(barons.length).toBe(E1M8_BOSS_DEATH_ORACLE.expectedBaronCount);
    expect(E1M8_BOSS_DEATH_ORACLE.expectedBaronCount).toBe(2);
  });

  test('exactly one sector is tagged 666 (the exit pillar)', () => {
    const tagged = data.sectors.filter((s) => s.tag === 666);
    expect(tagged.length).toBe(1);
  });

  test('boss mobj runtime type is MT_BRUISER (15)', () => {
    expect(E1M8_BOSS_DEATH_ORACLE.bossMobjType).toBe(15);
  });
});
