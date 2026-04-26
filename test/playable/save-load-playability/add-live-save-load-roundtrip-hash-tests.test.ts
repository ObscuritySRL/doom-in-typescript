import { describe, expect, test } from 'bun:test';

import { ADD_LIVE_SAVE_LOAD_ROUNDTRIP_HASH_TESTS_RUNTIME_COMMAND, addLiveSaveLoadRoundtripHashTests } from '../../../src/playable/save-load-playability/addLiveSaveLoadRoundtripHashTests.ts';
import type { SaveGameHeader } from '../../../src/save/saveHeader.ts';

function hashTextSha256(text: string): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(text);

  return hasher.digest('hex');
}

describe('addLiveSaveLoadRoundtripHashTests', () => {
  test('locks the Bun runtime command and save/load audit linkage', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-013-audit-missing-save-load-ui.json').text();

    expect(ADD_LIVE_SAVE_LOAD_ROUNDTRIP_HASH_TESTS_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(manifestText).toContain('"schemaVersion": 1');
    expect(manifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(manifestText).toContain('"surface": "live-load-game-roundtrip"');
    expect(manifestText).toContain('"surface": "live-save-game-roundtrip"');
  });

  test('locks the formatted source hash', async () => {
    const sourceText = await Bun.file('src/playable/save-load-playability/addLiveSaveLoadRoundtripHashTests.ts').text();

    expect(hashTextSha256(sourceText)).toBe('ad30433236dedcc547f4aea3a49006526a62a2135608582741c6123ebf8ff622');
  });

  test('returns exact deterministic default roundtrip evidence', () => {
    expect(addLiveSaveLoadRoundtripHashTests()).toEqual({
      auditSurfaces: ['live-load-game-roundtrip', 'live-save-game-roundtrip'],
      headerSize: 50,
      loadHashSha256: '3eebc2b5c32ca3ed2fb5a2b1b74840d74737f9ad64780c60dea9458def55b9c0',
      loadedHeader: {
        description: 'ROUNDTRIP HASH',
        gameepisode: 1,
        gamemap: 1,
        gameskill: 2,
        leveltime: 0x00_23_45,
        playeringame: [1, 0, 0, 0],
      },
      replayChecksum: 1_542_447_910,
      roundtripByteCount: 60,
      runtimeCommand: 'bun run doom.ts',
      saveHashSha256: '3eebc2b5c32ca3ed2fb5a2b1b74840d74737f9ad64780c60dea9458def55b9c0',
      savedHeader: {
        description: 'ROUNDTRIP HASH',
        gameepisode: 1,
        gamemap: 1,
        gameskill: 2,
        leveltime: 0x00_23_45,
        playeringame: [1, 0, 0, 0],
      },
      transitionSignature: 'ROUNDTRIP HASH:2:1:1:1000:9029:3eebc2b5c32ca3ed',
      versionText: 'version 109',
    });
  });

  test('returns exact custom roundtrip hash evidence', () => {
    const saveHeader: SaveGameHeader = {
      description: 'E1M1 SLOT 2',
      gameepisode: 1,
      gamemap: 1,
      gameskill: 3,
      leveltime: 0x00_10_20,
      playeringame: [1, 1, 0, 0],
    };

    expect(
      addLiveSaveLoadRoundtripHashTests({
        liveSectionBytes: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
        saveHeader,
      }),
    ).toEqual({
      auditSurfaces: ['live-load-game-roundtrip', 'live-save-game-roundtrip'],
      headerSize: 50,
      loadHashSha256: 'c6d4dd149b5b76690d2da3f37b9e0fb358eb82166e31a4f3c790f541f1fb401d',
      loadedHeader: saveHeader,
      replayChecksum: 1_516_842_593,
      roundtripByteCount: 55,
      runtimeCommand: 'bun run doom.ts',
      saveHashSha256: 'c6d4dd149b5b76690d2da3f37b9e0fb358eb82166e31a4f3c790f541f1fb401d',
      savedHeader: saveHeader,
      transitionSignature: 'E1M1 SLOT 2:3:1:1:1100:4128:c6d4dd149b5b7669',
      versionText: 'version 109',
    });
  });

  test('prevalidates the runtime command before serializing the header', () => {
    expect(() =>
      addLiveSaveLoadRoundtripHashTests({
        runtimeCommand: 'bun run src/main.ts',
        saveHeader: {
          description: 'description that is intentionally longer than the canonical save description field',
          gameepisode: 1,
          gamemap: 1,
          gameskill: 2,
          leveltime: 0,
          playeringame: [1, 0, 0, 0],
        },
      }),
    ).toThrow('add-live-save-load-roundtrip-hash-tests requires bun run doom.ts.');
  });

  test('rejects lossy save descriptions before recording hash evidence', () => {
    expect(() =>
      addLiveSaveLoadRoundtripHashTests({
        saveHeader: {
          description: 'BAD\u0000NAME',
          gameepisode: 1,
          gamemap: 1,
          gameskill: 2,
          leveltime: 0,
          playeringame: [1, 0, 0, 0],
        },
      }),
    ).toThrow('Live save/load roundtrip changed the savegame header.');
  });
});
