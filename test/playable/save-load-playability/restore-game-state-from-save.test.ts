import { describe, expect, test } from 'bun:test';

import type { LoadGameLayout } from '../../../src/save/loadgame.ts';
import type { SaveGameHeader, SaveGamePlayerPresence } from '../../../src/save/saveHeader.ts';

import { RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND, restoreGameStateFromSave } from '../../../src/playable/save-load-playability/restoreGameStateFromSave.ts';
import { SAVEGAME_EOF } from '../../../src/save/loadgame.ts';
import { SAVEGAME_DESCRIPTION_SIZE, SAVEGAME_HEADER_SIZE, SAVEGAME_VERSION_SIZE, writeSaveGameHeader } from '../../../src/save/saveHeader.ts';

const SOURCE_PATH = 'src/playable/save-load-playability/restoreGameStateFromSave.ts';
const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-013-audit-missing-save-load-ui.json';
const EMPTY_PLAYER_PRESENCE: SaveGamePlayerPresence = Object.freeze([0, 0, 0, 0]);

const EMPTY_LAYOUT: LoadGameLayout = Object.freeze({
  worldLayout: Object.freeze({
    lines: Object.freeze([]),
    sectorCount: 0,
  }),
});

function createHeader(): SaveGameHeader {
  return Object.freeze({
    description: 'RESTORE-STATE',
    gameepisode: 1,
    gamemap: 1,
    gameskill: 2,
    leveltime: 0x00_45_67,
    playeringame: EMPTY_PLAYER_PRESENCE,
  });
}

function createSaveBytes(): Uint8Array {
  const header = writeSaveGameHeader(createHeader());
  const source = new Uint8Array(header.length + 3);

  source.set(header, 0);
  source[header.length] = 0;
  source[header.length + 1] = 0;
  source[header.length + 2] = SAVEGAME_EOF;

  return source;
}

function createSha256Hex(source: string | Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(source);

  return hasher.digest('hex');
}

async function readSourceHash(): Promise<string> {
  return createSha256Hex(await Bun.file(SOURCE_PATH).text());
}

describe('restoreGameStateFromSave', () => {
  test('locks the target command contract and audit manifest link', async () => {
    const auditManifestText = await Bun.file(AUDIT_MANIFEST_PATH).text();

    expect(RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(auditManifestText).toContain('"schemaVersion": 1');
    expect(auditManifestText).toContain('"surface": "live-load-game-roundtrip"');
    expect(auditManifestText).toContain('"runtimeCommand": "bun run doom.ts"');
  });

  test('locks the formatted source hash', async () => {
    expect(await readSourceHash()).toBe('ab99541941541f551923ff37047ef6dcffcc639e0a52cef4431cc40cb420298e');
  });

  test('classifies compatible headers with incomplete archives without restoring state', () => {
    const saveBytes = createSaveBytes();
    const result = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes,
    });

    expect(result.auditStepId).toBe('01-013');
    expect(result.auditSurface).toBe('live-load-game-roundtrip');
    expect(result.command).toBe(RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND);
    expect(result.replayChecksum).toBe(3_129_463_536);
    expect(result.restored).toBeNull();
    expect(result.transition).toEqual({
      bytesRead: SAVEGAME_HEADER_SIZE,
      description: 'RESTORE-STATE',
      gameepisode: 1,
      gamemap: 1,
      gameskill: 2,
      leveltime: 0x00_45_67,
      nextOffset: null,
      playerMask: 0,
      restoreHashSha256: createSha256Hex(saveBytes.subarray(0, SAVEGAME_HEADER_SIZE)),
      status: 'corrupted',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.transition)).toBe(true);
  });

  test('rejects non-product command paths before parsing save bytes', () => {
    expect(() =>
      restoreGameStateFromSave({
        command: 'bun run src/main.ts',
        layout: EMPTY_LAYOUT,
        saveBytes: new Uint8Array(),
      }),
    ).toThrow('Restore game state from save must run through bun run doom.ts.');
  });

  test('does not restore unsupported savegame versions', () => {
    const saveBytes = createSaveBytes();

    saveBytes[SAVEGAME_DESCRIPTION_SIZE + SAVEGAME_VERSION_SIZE - 1] = 0xff;

    const result = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes,
    });

    expect(result.replayChecksum).toBe(1_388_593_263);
    expect(result.restored).toBeNull();
    expect(result.transition).toEqual({
      bytesRead: SAVEGAME_HEADER_SIZE,
      description: null,
      gameepisode: null,
      gamemap: null,
      gameskill: null,
      leveltime: null,
      nextOffset: null,
      playerMask: 0,
      restoreHashSha256: createSha256Hex(saveBytes.subarray(0, SAVEGAME_HEADER_SIZE)),
      status: 'unsupported-version',
    });
  });

  test('classifies truncated headers as corrupted without restoring state', () => {
    const header = writeSaveGameHeader(createHeader());
    const saveBytes = header.subarray(0, SAVEGAME_HEADER_SIZE - 1);

    const result = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes,
    });

    expect(result.replayChecksum).toBe(801_029_256);
    expect(result.restored).toBeNull();
    expect(result.transition).toEqual({
      bytesRead: 0,
      description: null,
      gameepisode: null,
      gamemap: null,
      gameskill: null,
      leveltime: null,
      nextOffset: null,
      playerMask: 0,
      restoreHashSha256: createSha256Hex(new Uint8Array()),
      status: 'corrupted',
    });
  });
});
