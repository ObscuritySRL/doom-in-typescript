import { describe, expect, test } from 'bun:test';

import type { ActiveCeilingsSnapshot, ActivePlatsSnapshot, ButtonListSnapshot } from '../../../src/specials/activeSpecials.ts';
import type { LoadGameLayout } from '../../../src/save/loadgame.ts';
import type { SaveGamePlayerArchive, SaveGamePlayerSlots, SaveGameWorld } from '../../../src/save/coreSerialization.ts';
import type { SaveGameHeader, SaveGamePlayerPresence } from '../../../src/save/saveHeader.ts';
import type { SaveGameSpecialArchive } from '../../../src/save/specialSerialization.ts';
import type { RestoreGameStateFromSaveInput } from '../../../src/playable/save-load-playability/restoreGameStateFromSave.ts';

import { MAXBUTTONS } from '../../../src/specials/switches.ts';
import { MAXCEILINGS } from '../../../src/specials/ceilings.ts';
import { MAXPLATS } from '../../../src/specials/platforms.ts';
import { RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND, restoreGameStateFromSave } from '../../../src/playable/save-load-playability/restoreGameStateFromSave.ts';
import { SAVEGAME_EOF, readLoadGame } from '../../../src/save/loadgame.ts';
import { SAVEGAME_DESCRIPTION_SIZE, SAVEGAME_HEADER_SIZE, SAVEGAME_VERSION_SIZE, writeSaveGameHeader } from '../../../src/save/saveHeader.ts';
import { writeArchivedMobjs, writeArchivedPlayers, writeArchivedWorld } from '../../../src/save/coreSerialization.ts';
import { writeArchivedSpecials } from '../../../src/save/specialSerialization.ts';

const SOURCE_PATH = 'src/playable/save-load-playability/restoreGameStateFromSave.ts';
const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-013-audit-missing-save-load-ui.json';
const EMPTY_PLAYER_PRESENCE: SaveGamePlayerPresence = Object.freeze([0, 0, 0, 0]);
const EMPTY_PLAYER_SLOTS: SaveGamePlayerSlots = Object.freeze([null, null, null, null]);

const EMPTY_LAYOUT: LoadGameLayout = Object.freeze({
  worldLayout: Object.freeze({
    lines: Object.freeze([]),
    sectorCount: 0,
  }),
});

const EMPTY_PLAYER_ARCHIVE: SaveGamePlayerArchive = Object.freeze({
  playeringame: EMPTY_PLAYER_PRESENCE,
  players: EMPTY_PLAYER_SLOTS,
});

const EMPTY_WORLD: SaveGameWorld = Object.freeze({
  lines: Object.freeze([]),
  sectors: Object.freeze([]),
});

const EMPTY_SPECIAL_ARCHIVE: SaveGameSpecialArchive = Object.freeze({
  activeCeilings: Object.freeze(Array.from({ length: MAXCEILINGS }, () => null)) as ActiveCeilingsSnapshot,
  activePlats: Object.freeze(Array.from({ length: MAXPLATS }, () => null)) as ActivePlatsSnapshot,
  buttons: Object.freeze(Array.from({ length: MAXBUTTONS }, () => null)) as ButtonListSnapshot,
  thinkers: Object.freeze([]),
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

function createValidEmptySaveBytes(startOffset = 0): Uint8Array {
  const headerBytes = writeSaveGameHeader(createHeader());
  const playersOffset = startOffset + SAVEGAME_HEADER_SIZE;
  const playersBytes = writeArchivedPlayers(EMPTY_PLAYER_ARCHIVE, playersOffset);
  const worldOffset = playersOffset + playersBytes.length;
  const worldBytes = writeArchivedWorld(EMPTY_WORLD);
  const mobjsOffset = worldOffset + worldBytes.length;
  const mobjsBytes = writeArchivedMobjs([], mobjsOffset);
  const specialsOffset = mobjsOffset + mobjsBytes.length;
  const specialsBytes = writeArchivedSpecials(EMPTY_SPECIAL_ARCHIVE, specialsOffset);

  return Uint8Array.from([...headerBytes, ...playersBytes, ...worldBytes, ...mobjsBytes, ...specialsBytes, SAVEGAME_EOF]);
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
    expect(await readSourceHash()).toBe('ef264875b56a258b45073c24636f6d43e6cc1f93f03d68b128b418671bd8c83c');
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

  test('rethrows unexpected failures while reading save bytes', () => {
    const input = {
      layout: EMPTY_LAYOUT,
      get saveBytes(): Uint8Array {
        throw new Error('save bytes unavailable');
      },
    } satisfies RestoreGameStateFromSaveInput;

    expect(() => restoreGameStateFromSave(input)).toThrow('save bytes unavailable');
  });

  test('rethrows unexpected failures while reading the restore layout', () => {
    const input = {
      get layout(): LoadGameLayout {
        throw new Error('layout unavailable');
      },
      saveBytes: createValidEmptySaveBytes(),
    } satisfies RestoreGameStateFromSaveInput;

    expect(() => restoreGameStateFromSave(input)).toThrow('layout unavailable');
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

  test('classifies an empty save buffer as corrupted with no parsed bytes', () => {
    const result = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes: new Uint8Array(),
    });

    expect(result.restored).toBeNull();
    expect(result.transition.status).toBe('corrupted');
    expect(result.transition.bytesRead).toBe(0);
    expect(result.transition.description).toBeNull();
    expect(result.transition.gameepisode).toBeNull();
    expect(result.transition.gamemap).toBeNull();
    expect(result.transition.gameskill).toBeNull();
    expect(result.transition.leveltime).toBeNull();
    expect(result.transition.nextOffset).toBeNull();
    expect(result.transition.playerMask).toBe(0);
    expect(result.transition.restoreHashSha256).toBe(createSha256Hex(new Uint8Array()));
  });

  test('rejects an empty-string command at the boundary before parsing save bytes', () => {
    expect(() =>
      restoreGameStateFromSave({
        command: '',
        layout: EMPTY_LAYOUT,
        saveBytes: new Uint8Array(),
      }),
    ).toThrow('Restore game state from save must run through bun run doom.ts.');
  });

  test('uses the default product command when no command field is supplied', () => {
    const result = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes: createSaveBytes(),
    });

    expect(result.command).toBe(RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND);
    expect(result.transition.status).toBe('corrupted');
  });

  test('rejects negative startOffset values before parsing save bytes', () => {
    expect(() =>
      restoreGameStateFromSave({
        layout: EMPTY_LAYOUT,
        saveBytes: createSaveBytes(),
        startOffset: -1,
      }),
    ).toThrow('startOffset must be a non-negative safe integer.');
  });

  test('rejects fractional startOffset values before parsing save bytes', () => {
    expect(() =>
      restoreGameStateFromSave({
        layout: EMPTY_LAYOUT,
        saveBytes: createSaveBytes(),
        startOffset: 1.5,
      }),
    ).toThrow('startOffset must be a non-negative safe integer.');
  });

  test('rejects NaN startOffset values before parsing save bytes', () => {
    expect(() =>
      restoreGameStateFromSave({
        layout: EMPTY_LAYOUT,
        saveBytes: createSaveBytes(),
        startOffset: Number.NaN,
      }),
    ).toThrow('startOffset must be a non-negative safe integer.');
  });

  test('rejects startOffset values above Number.MAX_SAFE_INTEGER before parsing save bytes', () => {
    expect(() =>
      restoreGameStateFromSave({
        layout: EMPTY_LAYOUT,
        saveBytes: createSaveBytes(),
        startOffset: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow('startOffset must be a non-negative safe integer.');
  });

  test('accepts startOffset zero as a valid safe-integer boundary', () => {
    const result = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes: createSaveBytes(),
      startOffset: 0,
    });

    expect(result.transition.status).toBe('corrupted');
  });

  test('restores a valid empty-archive savegame and propagates the parsed header through the transition', () => {
    const saveBytes = createValidEmptySaveBytes();
    const result = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes,
    });

    expect(result.transition.status).toBe('restored');
    expect(result.transition.description).toBe('RESTORE-STATE');
    expect(result.transition.gameepisode).toBe(1);
    expect(result.transition.gamemap).toBe(1);
    expect(result.transition.gameskill).toBe(2);
    expect(result.transition.leveltime).toBe(0x00_45_67);
    expect(result.transition.playerMask).toBe(0);
    expect(result.transition.bytesRead).toBe(saveBytes.length);
    expect(result.transition.nextOffset).toBe(saveBytes.length);
    expect(result.transition.restoreHashSha256).toBe(createSha256Hex(saveBytes));
    expect(result.restored).not.toBeNull();
    expect(result.restored?.header.description).toBe('RESTORE-STATE');
    expect(result.command).toBe(RESTORE_GAME_STATE_FROM_SAVE_RUNTIME_COMMAND);
    expect(result.auditStepId).toBe('01-013');
    expect(result.auditSurface).toBe('live-load-game-roundtrip');
  });

  test('propagates a non-zero startOffset into the restored transition.nextOffset', () => {
    const startOffset = 7;
    const saveBytes = createValidEmptySaveBytes(startOffset);
    const result = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes,
      startOffset,
    });

    expect(result.transition.status).toBe('restored');
    expect(result.transition.bytesRead).toBe(saveBytes.length);
    expect(result.transition.nextOffset).toBe(startOffset + saveBytes.length);

    const directRestore = readLoadGame(saveBytes, EMPTY_LAYOUT, startOffset);
    expect(directRestore).not.toBeNull();
    expect(result.transition.bytesRead).toBe(directRestore!.bytesRead);
    expect(result.transition.nextOffset).toBe(directRestore!.nextOffset);
  });

  test('locks runtime-frozen invariants on the restored evidence and its nested transition', () => {
    const restoredEvidence = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes: createValidEmptySaveBytes(),
    });

    expect(Object.isFrozen(restoredEvidence)).toBe(true);
    expect(Object.isFrozen(restoredEvidence.transition)).toBe(true);

    const corruptedEvidence = restoreGameStateFromSave({
      layout: EMPTY_LAYOUT,
      saveBytes: new Uint8Array(),
    });

    expect(Object.isFrozen(corruptedEvidence)).toBe(true);
    expect(Object.isFrozen(corruptedEvidence.transition)).toBe(true);
  });
});
