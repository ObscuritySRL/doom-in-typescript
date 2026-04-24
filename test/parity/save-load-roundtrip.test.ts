import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { writeArchivedMobjs, writeArchivedPlayers, writeArchivedWorld } from '../../src/save/coreSerialization.ts';
import { readLoadGame } from '../../src/save/loadgame.ts';
import { writeSaveGameHeader } from '../../src/save/saveHeader.ts';
import { writeArchivedSpecials } from '../../src/save/specialSerialization.ts';
import { writeVanillaSaveGame } from '../../src/save/vanillaLimits.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';

interface SaveLoadFixture {
  description: string;
  expected: {
    anchors: Record<string, Record<string, number>>;
    byteLengths: Record<string, number>;
    hashes: Record<string, string>;
    loaded: NonNullable<ReturnType<typeof readLoadGame>>;
    offsets: Record<string, number>;
  };
  input: {
    header: Parameters<typeof writeSaveGameHeader>[0];
    mobjs: Parameters<typeof writeArchivedMobjs>[0];
    players: Parameters<typeof writeArchivedPlayers>[0];
    specials: Parameters<typeof writeArchivedSpecials>[0];
    world: Parameters<typeof writeArchivedWorld>[0];
    worldLayout: Parameters<typeof readLoadGame>[1]['worldLayout'];
  };
}

interface BuiltSave {
  headerBytes: Uint8Array;
  mobjBytes: Uint8Array;
  playerBytes: Uint8Array;
  saveBytes: Uint8Array;
  specialBytes: Uint8Array;
  worldBytes: Uint8Array;
}

const fixture = JSON.parse(await Bun.file(new URL('./fixtures/saveLoad.json', import.meta.url)).text()) as SaveLoadFixture;

function buildCanonicalSave(input: SaveLoadFixture['input']): BuiltSave {
  const headerBytes = writeSaveGameHeader(input.header);
  const playerBytes = writeArchivedPlayers(input.players, headerBytes.length);
  const worldBytes = writeArchivedWorld(input.world);
  const mobjBytes = writeArchivedMobjs(input.mobjs, headerBytes.length + playerBytes.length + worldBytes.length);
  const specialBytes = writeArchivedSpecials(input.specials, headerBytes.length + playerBytes.length + worldBytes.length + mobjBytes.length);
  const saveBytes = writeVanillaSaveGame({
    header: headerBytes,
    mobjs: mobjBytes,
    players: playerBytes,
    specials: specialBytes,
    world: worldBytes,
  });

  return {
    headerBytes,
    mobjBytes,
    playerBytes,
    saveBytes,
    specialBytes,
    worldBytes,
  };
}

function findAsciiStringOffset(source: Uint8Array, needle: string): number {
  const encodedNeedle = Buffer.from(needle, 'latin1');

  for (let start = 0; start <= source.length - encodedNeedle.length; start += 1) {
    let matched = true;

    for (let offset = 0; offset < encodedNeedle.length; offset += 1) {
      if (source[start + offset] !== encodedNeedle[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return start;
    }
  }

  return -1;
}

function hashBytes(source: Uint8Array): string {
  return createHash('sha256').update(source).digest('hex').toUpperCase();
}

describe(fixture.description, () => {
  test('serializes the canonical save sections, offsets, and sentinels', () => {
    const built = buildCanonicalSave(fixture.input);

    expect(built.headerBytes.length).toBe(fixture.expected.byteLengths.header);
    expect(built.mobjBytes.length).toBe(fixture.expected.byteLengths.mobjs);
    expect(built.playerBytes.length).toBe(fixture.expected.byteLengths.players);
    expect(built.specialBytes.length).toBe(fixture.expected.byteLengths.specials);
    expect(built.worldBytes.length).toBe(fixture.expected.byteLengths.world);
    expect(built.saveBytes.length).toBe(fixture.expected.byteLengths.total);

    expect(hashBytes(built.headerBytes)).toBe(fixture.expected.hashes.header);
    expect(hashBytes(built.mobjBytes)).toBe(fixture.expected.hashes.mobjs);
    expect(hashBytes(built.playerBytes)).toBe(fixture.expected.hashes.players);
    expect(hashBytes(built.specialBytes)).toBe(fixture.expected.hashes.specials);
    expect(hashBytes(built.worldBytes)).toBe(fixture.expected.hashes.world);
    expect(hashBytes(built.saveBytes)).toBe(fixture.expected.hashes.total);

    expect(built.headerBytes.length).toBe(fixture.expected.offsets.playersStart);
    expect(built.headerBytes.length + 2).toBe(fixture.expected.offsets.firstPlayerRecordStart);
    expect(built.headerBytes.length + built.playerBytes.length).toBe(fixture.expected.offsets.worldStart);
    expect(built.headerBytes.length + built.playerBytes.length + built.worldBytes.length).toBe(fixture.expected.offsets.mobjsStart);
    expect(built.headerBytes.length + built.playerBytes.length + built.worldBytes.length + 2).toBe(fixture.expected.offsets.firstMobjRecordStart);
    expect(built.headerBytes.length + built.playerBytes.length + built.worldBytes.length + built.mobjBytes.length).toBe(fixture.expected.offsets.specialsStart);

    expect(built.saveBytes[fixture.expected.offsets.specialThinkerEndMarkerIndex]).toBe(0x07);
    expect(built.saveBytes[fixture.expected.offsets.eofIndex]).toBe(0x1d);
  });

  test('loads the canonical snapshot and reserializes the exact same bytes', () => {
    const built = buildCanonicalSave(fixture.input);
    const loaded = readLoadGame(built.saveBytes, { worldLayout: fixture.input.worldLayout });

    if (loaded === null) {
      throw new Error('Expected the canonical save fixture to load successfully.');
    }

    expect(loaded).toEqual(fixture.expected.loaded);
    expect(loaded.bytesRead).toBe(fixture.expected.byteLengths.total);
    expect(loaded.nextOffset).toBe(fixture.expected.byteLengths.total);
    expect(loaded.value.players.players[0]?.psprites[1]?.stateIndex).toBeNull();

    const replay = buildCanonicalSave({
      header: loaded.value.header,
      mobjs: loaded.value.mobjs,
      players: loaded.value.players,
      specials: loaded.value.specials,
      world: loaded.value.world,
      worldLayout: fixture.input.worldLayout,
    });

    expect(hashBytes(replay.saveBytes)).toBe(fixture.expected.hashes.total);
    expect(Array.from(replay.saveBytes)).toEqual(Array.from(built.saveBytes));
  });

  test('matches the bundled DOS savegame anchor strings', async () => {
    for (const [fileName, expectedNeedles] of Object.entries(fixture.expected.anchors)) {
      const source = new Uint8Array(await Bun.file(`${REFERENCE_BUNDLE_PATH}\\${fileName}`).arrayBuffer());

      for (const [needle, expectedOffset] of Object.entries(expectedNeedles)) {
        expect(findAsciiStringOffset(source, needle)).toBe(expectedOffset);
      }
    }
  });
});
