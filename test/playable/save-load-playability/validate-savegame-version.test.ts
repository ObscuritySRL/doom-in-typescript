import { describe, expect, test } from 'bun:test';

import { validateSavegameVersion, VALIDATE_SAVEGAME_VERSION_AUDIT_LINK, VALIDATE_SAVEGAME_VERSION_RUNTIME_COMMAND } from '../../../src/playable/save-load-playability/validateSavegameVersion.ts';
import { SAVEGAME_DESCRIPTION_SIZE, SAVEGAME_VERSION_SIZE, writeSaveGameHeader } from '../../../src/save/saveHeader.ts';

const SOURCE_PATH = 'src/playable/save-load-playability/validateSavegameVersion.ts';
const SOURCE_SHA256 = '9873fd0bc2374732b36554655454b66f5ef2178e6fc3ea8e063eefcb27422324';

function createCompatibleSavegameBytes(): Uint8Array {
  return writeSaveGameHeader({
    description: 'E1M1 saved',
    gameepisode: 1,
    gamemap: 1,
    gameskill: 2,
    leveltime: 0x01_02_03,
    playeringame: [1, 0, 0, 0],
  });
}

function createIncompatibleSavegameBytes(): Uint8Array {
  const savegameBytes = createCompatibleSavegameBytes();
  const versionText = 'version 108';

  for (let index = 0; index < SAVEGAME_VERSION_SIZE; index += 1) {
    savegameBytes[SAVEGAME_DESCRIPTION_SIZE + index] = index < versionText.length ? versionText.charCodeAt(index) : 0;
  }

  return savegameBytes;
}

describe('validateSavegameVersion', () => {
  test('locks the Bun runtime command contract and save-load audit link', () => {
    expect(VALIDATE_SAVEGAME_VERSION_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(VALIDATE_SAVEGAME_VERSION_AUDIT_LINK).toEqual({
      manifestPath: 'plan_fps/manifests/01-013-audit-missing-save-load-ui.json',
      stepId: '01-013',
      surface: 'live-load-game-roundtrip',
    });
  });

  test('locks the formatted source hash', async () => {
    const sourceText = await Bun.file(SOURCE_PATH).text();
    const sourceHash = new Bun.CryptoHasher('sha256').update(sourceText).digest('hex');

    expect(sourceHash).toBe(SOURCE_SHA256);
  });

  test('returns deterministic replay evidence for the canonical Doom 1.9 version', () => {
    const result = validateSavegameVersion({
      runtimeCommand: VALIDATE_SAVEGAME_VERSION_RUNTIME_COMMAND,
      savegameBytes: createCompatibleSavegameBytes(),
    });

    expect(result).toEqual({
      compatible: true,
      expectedVersionText: 'version 109',
      header: {
        description: 'E1M1 saved',
        gameepisode: 1,
        gamemap: 1,
        gameskill: 2,
        leveltime: 0x01_02_03,
        playeringame: [1, 0, 0, 0],
      },
      observedVersionText: 'version 109',
      replayChecksum: 2592249099,
      replaySignature: 'validate-savegame-version|compatible=1|expected=version 109|observed=version 109|description=E1M1 saved|gameskill=2|gameepisode=1|gamemap=1|playeringame=1,0,0,0|leveltime=66051',
      versionFieldOffset: 24,
      versionFieldSize: 16,
    });
  });

  test('reports an incompatible savegame version without restoring state', () => {
    const result = validateSavegameVersion({
      runtimeCommand: VALIDATE_SAVEGAME_VERSION_RUNTIME_COMMAND,
      savegameBytes: createIncompatibleSavegameBytes(),
    });

    expect(result).toEqual({
      compatible: false,
      expectedVersionText: 'version 109',
      header: null,
      observedVersionText: 'version 108',
      replayChecksum: 2176490417,
      replaySignature: 'validate-savegame-version|compatible=0|expected=version 109|observed=version 108|description=none|gameskill=none|gameepisode=none|gamemap=none|playeringame=none|leveltime=none',
      versionFieldOffset: 24,
      versionFieldSize: 16,
    });
  });

  test('rejects non-product runtime commands before inspecting bytes', () => {
    expect(() =>
      validateSavegameVersion({
        runtimeCommand: 'bun run src/main.ts',
        savegameBytes: new Uint8Array(),
      }),
    ).toThrow('validateSavegameVersion requires runtime command bun run doom.ts.');
  });
});
