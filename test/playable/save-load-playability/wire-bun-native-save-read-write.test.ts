import { describe, expect, test } from 'bun:test';

import type { BunNativeSaveReadResult, BunNativeSaveWriteResult } from '../../../src/playable/save-load-playability/wireBunNativeSaveReadWrite.ts';

import {
  WIRE_BUN_NATIVE_SAVE_READ_WRITE_AUDIT_MANIFEST_PATH,
  WIRE_BUN_NATIVE_SAVE_READ_WRITE_AUDIT_SURFACE,
  WIRE_BUN_NATIVE_SAVE_READ_WRITE_COMMAND_CONTRACT,
  wireBunNativeSaveReadWrite,
} from '../../../src/playable/save-load-playability/wireBunNativeSaveReadWrite.ts';
import { SAVEGAME_HEADER_SIZE, writeSaveGameHeader } from '../../../src/save/saveHeader.ts';

const COMMAND = WIRE_BUN_NATIVE_SAVE_READ_WRITE_COMMAND_CONTRACT.runtimeCommand;
const SAVE_FILE_PATH = 'test/playable/save-load-playability/.wire-bun-native-save-read-write.dsg';
const SOURCE_PATH = 'src/playable/save-load-playability/wireBunNativeSaveReadWrite.ts';

async function deleteSaveFile(): Promise<void> {
  const saveFile = Bun.file(SAVE_FILE_PATH);

  if (await saveFile.exists()) {
    await saveFile.delete();
  }
}

function createSaveBytes(): Uint8Array {
  const header = writeSaveGameHeader({
    description: 'E1M1 START',
    gameepisode: 1,
    gamemap: 1,
    gameskill: 2,
    leveltime: 0x01_02_03,
    playeringame: [1, 0, 0, 0],
  });
  const bytes = new Uint8Array(SAVEGAME_HEADER_SIZE + 4);

  bytes.set(header, 0);
  bytes.set([0xaa, 0xbb, 0xcc, 0x1d], SAVEGAME_HEADER_SIZE);

  return bytes;
}

async function hashFileSha256(filePath: string): Promise<string> {
  const bytes = new Uint8Array(await Bun.file(filePath).arrayBuffer());
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(bytes);

  return hasher.digest('hex');
}

describe('wireBunNativeSaveReadWrite', () => {
  test('locks command contract, audit linkage, and formatted source hash', async () => {
    expect(WIRE_BUN_NATIVE_SAVE_READ_WRITE_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(WIRE_BUN_NATIVE_SAVE_READ_WRITE_AUDIT_MANIFEST_PATH).toBe('plan_fps/manifests/01-013-audit-missing-save-load-ui.json');
    expect(WIRE_BUN_NATIVE_SAVE_READ_WRITE_AUDIT_SURFACE).toBe('live-save-game-roundtrip');
    expect(await hashFileSha256(SOURCE_PATH)).toBe('b3b8708c715af26ae709e54c5117a8b4d33cbf935f412c5ea92c95fdd0b4b82e');
  });

  test('writes save bytes through Bun.write and returns deterministic evidence', async () => {
    await deleteSaveFile();

    try {
      const bytes = createSaveBytes();
      const result: BunNativeSaveWriteResult = await wireBunNativeSaveReadWrite({
        bytes,
        command: COMMAND,
        filePath: SAVE_FILE_PATH,
        operation: 'write',
      });

      expect(result).toEqual({
        bytesWritten: 54,
        evidence: {
          byteLength: 54,
          gameepisode: 1,
          gamemap: 1,
          gameskill: 2,
          hashSha256: '87e37a3924b35e884be89e923fc5589aa2a522afab56d3cf1f30d5173ea670bb',
          headerDescription: 'E1M1 START',
          leveltime: 0x01_02_03,
          operation: 'write',
          playeringame: [1, 0, 0, 0],
          replayChecksum: 2320186261,
          replaySignature: 'operation=write;byteLength=54;hashSha256=87e37a3924b35e884be89e923fc5589aa2a522afab56d3cf1f30d5173ea670bb;description=E1M1 START;episode=1;map=1;skill=2;players=1,0,0,0;leveltime=66051',
          versionMatches: true,
        },
        header: {
          description: 'E1M1 START',
          gameepisode: 1,
          gamemap: 1,
          gameskill: 2,
          leveltime: 0x01_02_03,
          playeringame: [1, 0, 0, 0],
        },
        operation: 'write',
      });

      expect(Array.from(new Uint8Array(await Bun.file(SAVE_FILE_PATH).arrayBuffer()))).toEqual(Array.from(bytes));
    } finally {
      await deleteSaveFile();
    }
  });

  test('reads save bytes through Bun.file and returns deterministic evidence', async () => {
    await deleteSaveFile();

    try {
      const bytes = createSaveBytes();
      await Bun.write(SAVE_FILE_PATH, bytes);

      const result: BunNativeSaveReadResult = await wireBunNativeSaveReadWrite({
        command: COMMAND,
        filePath: SAVE_FILE_PATH,
        operation: 'read',
      });

      expect(Array.from(result.bytes)).toEqual(Array.from(bytes));
      expect(result.evidence).toEqual({
        byteLength: 54,
        gameepisode: 1,
        gamemap: 1,
        gameskill: 2,
        hashSha256: '87e37a3924b35e884be89e923fc5589aa2a522afab56d3cf1f30d5173ea670bb',
        headerDescription: 'E1M1 START',
        leveltime: 0x01_02_03,
        operation: 'read',
        playeringame: [1, 0, 0, 0],
        replayChecksum: 2481476530,
        replaySignature: 'operation=read;byteLength=54;hashSha256=87e37a3924b35e884be89e923fc5589aa2a522afab56d3cf1f30d5173ea670bb;description=E1M1 START;episode=1;map=1;skill=2;players=1,0,0,0;leveltime=66051',
        versionMatches: true,
      });
      expect(result.header).toEqual({
        description: 'E1M1 START',
        gameepisode: 1,
        gamemap: 1,
        gameskill: 2,
        leveltime: 0x01_02_03,
        playeringame: [1, 0, 0, 0],
      });
    } finally {
      await deleteSaveFile();
    }
  });

  test('rejects the wrong command before Bun write changes the save file', async () => {
    await deleteSaveFile();

    const bytes = createSaveBytes();

    await expect(
      wireBunNativeSaveReadWrite({
        bytes,
        command: 'bun run src/main.ts',
        filePath: SAVE_FILE_PATH,
        operation: 'write',
      }),
    ).rejects.toThrow('Save read/write requires bun run doom.ts.');

    expect(await Bun.file(SAVE_FILE_PATH).exists()).toBe(false);
  });

  test('rejects invalid save paths before Bun read/write access', async () => {
    const bytes = createSaveBytes();

    await expect(
      wireBunNativeSaveReadWrite({
        bytes,
        command: COMMAND,
        filePath: '',
        operation: 'write',
      }),
    ).rejects.toThrow('Save file path is required.');
    await expect(
      wireBunNativeSaveReadWrite({
        command: COMMAND,
        filePath: 'savegames/doomsav0.dsg\0',
        operation: 'read',
      }),
    ).rejects.toThrow('Save file path must not contain NUL bytes.');
  });
});
