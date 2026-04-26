import { describe, expect, test } from 'bun:test';

import { HANDLE_CORRUPTED_SAVE_AUDIT_MANIFEST_PATH, HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND, handleCorruptedSave } from '../../../src/playable/save-load-playability/handleCorruptedSave.ts';
import { writeSaveGameHeader } from '../../../src/save/saveHeader.ts';
import type { SaveGameHeader, SaveGamePlayerPresence } from '../../../src/save/saveHeader.ts';

const EXPECTED_SOURCE_SHA256 = '0211856520672d5df977a8acc5de64f545b59ae96dc3bd1c54815ef5de2d3769';

function createCompatibleHeader(): SaveGameHeader {
  return {
    description: 'E1M1 CORRUPT',
    gameepisode: 1,
    gamemap: 1,
    gameskill: 2,
    leveltime: 0x00_12_34,
    playeringame: createPlayerPresence(),
  };
}

function createCompatibleSaveBytes(): Uint8Array {
  return writeSaveGameHeader(createCompatibleHeader());
}

function createPlayerPresence(): SaveGamePlayerPresence {
  return [1, 0, 0, 0];
}

async function hashFile(path: string): Promise<string> {
  const contents = new Uint8Array(await Bun.file(path).arrayBuffer());

  return new Bun.CryptoHasher('sha256').update(contents).digest('hex');
}

describe('handleCorruptedSave', () => {
  test('locks the Bun command contract and audit manifest linkage', async () => {
    expect(HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(HANDLE_CORRUPTED_SAVE_AUDIT_MANIFEST_PATH).toBe('plan_fps/manifests/01-013-audit-missing-save-load-ui.json');
    expect(await hashFile('src/playable/save-load-playability/handleCorruptedSave.ts')).toBe(EXPECTED_SOURCE_SHA256);

    const auditManifest = await Bun.file(HANDLE_CORRUPTED_SAVE_AUDIT_MANIFEST_PATH).text();

    expect(auditManifest).toContain('"surface": "live-load-game-roundtrip"');
    expect(auditManifest).toContain('"surface": "load-game-menu-ui"');
    expect(auditManifest).toContain('"runtimeCommand": "bun run doom.ts"');
  });

  test('classifies a compatible header without restoring live state', () => {
    const result = handleCorruptedSave({
      runtimeCommand: HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND,
      source: createCompatibleSaveBytes(),
    });

    expect(result).toEqual({
      bytesRead: null,
      commandContract: 'bun run doom.ts',
      corrupted: false,
      description: 'E1M1 CORRUPT',
      diagnostic: null,
      header: {
        description: 'E1M1 CORRUPT',
        gameepisode: 1,
        gamemap: 1,
        gameskill: 2,
        leveltime: 0x00_12_34,
        playeringame: [1, 0, 0, 0],
      },
      nextOffset: null,
      reason: 'header-validation-only',
      replayChecksum: 3_700_365_645,
      safeToRestore: false,
      sourceByteChecksum: 2_805_828_569,
      status: 'header-valid',
      transitionSignature: 'handle-corrupted-save|status=header-valid|reason=header-validation-only|length=50|sourceChecksum=2805828569|startOffset=0|bytesRead=none|nextOffset=none|description=E1M1 CORRUPT|diagnostic=none',
    });
  });

  test('rejects a corrupted archive without dropping deterministic evidence', () => {
    const result = handleCorruptedSave({
      layout: {
        worldLayout: {
          lines: [{ sidenum: [0, -1] }],
          sectorCount: 1,
        },
      },
      runtimeCommand: HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND,
      source: createCompatibleSaveBytes(),
    });

    expect(result.corrupted).toBe(true);
    expect(result.description).toBe('E1M1 CORRUPT');
    expect(result.diagnostic).toBe('Savegame padding requires 2 more bytes.');
    expect(result.reason).toBe('archive-read-failed');
    expect(result.replayChecksum).toBe(463_011_970);
    expect(result.safeToRestore).toBe(false);
    expect(result.status).toBe('corrupted');
    expect(result.transitionSignature).toBe(
      'handle-corrupted-save|status=corrupted|reason=archive-read-failed|length=50|sourceChecksum=2805828569|startOffset=0|bytesRead=none|nextOffset=none|description=E1M1 CORRUPT|diagnostic=Savegame padding requires 2 more bytes.',
    );
  });

  test('classifies unsupported versions without treating them as restorable', () => {
    const source = createCompatibleSaveBytes();
    source[24] = 0x58;

    const result = handleCorruptedSave({
      runtimeCommand: HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND,
      source,
    });

    expect(result).toMatchObject({
      corrupted: false,
      description: null,
      diagnostic: 'Savegame version does not match Doom 1.9.',
      reason: 'version-mismatch',
      replayChecksum: 4_200_062_023,
      safeToRestore: false,
      status: 'unsupported-version',
      transitionSignature:
        'handle-corrupted-save|status=unsupported-version|reason=version-mismatch|length=50|sourceChecksum=3912686931|startOffset=0|bytesRead=none|nextOffset=none|description=none|diagnostic=Savegame version does not match Doom 1.9.',
    });
  });

  test('validates the runtime command before inspecting save bytes', () => {
    expect(() =>
      handleCorruptedSave({
        runtimeCommand: 'bun run src/main.ts',
        source: new Uint8Array(0),
      }),
    ).toThrow('Expected runtime command bun run doom.ts.');
  });

  test('records header read failures as corrupted save evidence', () => {
    const result = handleCorruptedSave({
      runtimeCommand: HANDLE_CORRUPTED_SAVE_RUNTIME_COMMAND,
      source: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    });

    expect(result).toMatchObject({
      bytesRead: null,
      corrupted: true,
      description: null,
      diagnostic: 'Savegame header requires 50 bytes.',
      nextOffset: null,
      reason: 'header-read-failed',
      replayChecksum: 2_881_459_159,
      safeToRestore: false,
      sourceByteChecksum: 73_223_091,
      status: 'corrupted',
      transitionSignature: 'handle-corrupted-save|status=corrupted|reason=header-read-failed|length=4|sourceChecksum=73223091|startOffset=0|bytesRead=none|nextOffset=none|description=none|diagnostic=Savegame header requires 50 bytes.',
    });
  });
});
