import { describe, expect, test } from 'bun:test';

import {
  IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_STEP_ID,
  IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_SURFACES,
  IMPLEMENT_LIVE_GAME_SAVE_LOAD_COMMAND_CONTRACT,
  implementLiveGameSaveLoad,
  LIVE_GAME_SAVE_SLOT_COUNT,
} from '../../../src/playable/save-load-playability/implementLiveGameSaveLoad.ts';
import { SAVEGAME_EOF } from '../../../src/save/loadgame.ts';
import { SAVEGAME_HEADER_SIZE, writeSaveGameHeader } from '../../../src/save/saveHeader.ts';

import type { SaveGameHeader, SaveGamePlayerPresence } from '../../../src/save/saveHeader.ts';

const PRODUCT_RUNTIME_COMMAND = 'bun run doom.ts';

function createHeader(): SaveGameHeader {
  const playeringame: SaveGamePlayerPresence = Object.freeze([1, 0, 0, 0]);

  return Object.freeze({
    description: 'E1M1 LIVE SAVE',
    gameepisode: 1,
    gamemap: 1,
    gameskill: 2,
    leveltime: 0x12_34_56,
    playeringame,
  });
}

function hashBytes(source: Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(source).digest('hex');
}

describe('implementLiveGameSaveLoad', () => {
  test('locks the command contract, audit linkage, and source hash', async () => {
    const sourceBytes = new Uint8Array(await Bun.file('src/playable/save-load-playability/implementLiveGameSaveLoad.ts').arrayBuffer());
    const auditManifest = await Bun.file('plan_fps/manifests/01-013-audit-missing-save-load-ui.json').text();

    expect(IMPLEMENT_LIVE_GAME_SAVE_LOAD_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
    });
    expect(IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_STEP_ID).toBe('01-013');
    expect(IMPLEMENT_LIVE_GAME_SAVE_LOAD_AUDIT_SURFACES).toEqual(['live-load-game-roundtrip', 'live-save-game-roundtrip']);
    expect(LIVE_GAME_SAVE_SLOT_COUNT).toBe(6);
    expect(auditManifest).toContain('"schemaVersion": 1');
    expect(auditManifest).toContain('"surface": "live-load-game-roundtrip"');
    expect(auditManifest).toContain('"surface": "live-save-game-roundtrip"');
    expect(hashBytes(sourceBytes)).toBe('d24da5a20c688a04cebd6df72d6e022792c729633714fdd26ef4326a317d8094');
  });

  test('serializes a live save and loads replay-safe header evidence back from it', () => {
    const header = createHeader();
    const serializedSections = Uint8Array.of(0xa1, 0xb2, 0xc3, 0xd4);
    const saveResult = implementLiveGameSaveLoad({
      header,
      operation: 'save',
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      serializedSections,
      slotIndex: 3,
    });
    const loadResult = implementLiveGameSaveLoad({
      operation: 'load',
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      saveBytes: saveResult.saveBytes,
      slotIndex: 3,
    });

    expect(saveResult.byteLength).toBe(SAVEGAME_HEADER_SIZE + serializedSections.length + 1);
    expect(Array.from(saveResult.saveBytes.slice(0, SAVEGAME_HEADER_SIZE))).toEqual(Array.from(writeSaveGameHeader(header)));
    expect(saveResult.saveBytes[saveResult.saveBytes.length - 1]).toBe(SAVEGAME_EOF);
    expect(saveResult.saveHashSha256).toBe('7dbee82c59486ae8bce656187d40538ce9911955a7da25640619458c7170d162');
    expect(saveResult.replayChecksum).toBe(4105996730);
    expect(saveResult.replaySignature).toBe(
      'command=bun run doom.ts|operation=save|slot=3|description=E1M1 LIVE SAVE|gameskill=2|gameepisode=1|gamemap=1|playeringame=1,0,0,0|leveltime=1193046|saveHashSha256=7dbee82c59486ae8bce656187d40538ce9911955a7da25640619458c7170d162',
    );
    expect(loadResult.header).toEqual(saveResult.header);
    expect(loadResult.restored).toBeNull();
    expect(loadResult.restoredBytesRead).toBeNull();
    expect(loadResult.saveHashSha256).toBe(saveResult.saveHashSha256);
    expect(loadResult.replayChecksum).toBe(2351522689);
    expect(loadResult.replaySignature).toBe(
      'command=bun run doom.ts|operation=load|slot=3|description=E1M1 LIVE SAVE|gameskill=2|gameepisode=1|gamemap=1|playeringame=1,0,0,0|leveltime=1193046|saveHashSha256=7dbee82c59486ae8bce656187d40538ce9911955a7da25640619458c7170d162',
    );
  });

  test('copies serialized live sections before returning save bytes', () => {
    const serializedSections = Uint8Array.of(0x10, 0x20, 0x30);
    const result = implementLiveGameSaveLoad({
      header: createHeader(),
      operation: 'save',
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      serializedSections,
      slotIndex: 0,
    });

    serializedSections[0] = 0xff;

    expect(result.saveBytes[SAVEGAME_HEADER_SIZE]).toBe(0x10);
  });

  test('rejects the old package script before save mutation', () => {
    expect(() =>
      implementLiveGameSaveLoad({
        header: createHeader(),
        operation: 'save',
        runtimeCommand: 'bun run src/main.ts',
        serializedSections: Uint8Array.of(0x01),
        slotIndex: 0,
      }),
    ).toThrow('runtimeCommand must be bun run doom.ts.');
  });

  test('rejects load bytes without the Doom save EOF marker', () => {
    const headerBytes = writeSaveGameHeader(createHeader());

    expect(() =>
      implementLiveGameSaveLoad({
        operation: 'load',
        runtimeCommand: PRODUCT_RUNTIME_COMMAND,
        saveBytes: headerBytes,
        slotIndex: 0,
      }),
    ).toThrow(`Savegame bytes must include at least ${SAVEGAME_HEADER_SIZE} header bytes and an EOF marker.`);
  });
});
