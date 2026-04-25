import { describe, expect, test } from 'bun:test';

import {
  DEFINE_SAVE_FILE_PATH_POLICY_AUDIT_SURFACE,
  DEFINE_SAVE_FILE_PATH_POLICY_COMMAND_CONTRACT,
  SAVE_FILE_DEFAULT_DIRECTORY,
  SAVE_FILE_EXTENSION,
  SAVE_FILE_SLOT_COUNT,
  defineSaveFilePathPolicy,
} from '../../../src/playable/save-load-playability/defineSaveFilePathPolicy.ts';
import { SAVEGAME_DESCRIPTION_SIZE, SAVEGAME_HEADER_SIZE, SAVEGAME_VERSION_TEXT } from '../../../src/save/saveHeader.ts';

const SOURCE_PATH = 'src/playable/save-load-playability/defineSaveFilePathPolicy.ts';
const SOURCE_SHA256 = '1114c43d86cb3705d01a948431635ac9e18e9e0fd991ca73009f656cbe30c068';

async function hashFileSha256(path: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await Bun.file(path).arrayBuffer());

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('defineSaveFilePathPolicy', () => {
  test('locks the Bun runtime command contract and 01-013 audit surface', async () => {
    expect(DEFINE_SAVE_FILE_PATH_POLICY_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(DEFINE_SAVE_FILE_PATH_POLICY_AUDIT_SURFACE).toBe('save-file-path-policy');
    expect(await Bun.file('plan_fps/manifests/01-013-audit-missing-save-load-ui.json').text()).toContain('"surface": "save-file-path-policy"');
    expect(await hashFileSha256(SOURCE_PATH)).toBe(SOURCE_SHA256);
  });

  test('returns the exact deterministic default slot path policy', () => {
    const policy = defineSaveFilePathPolicy({ runtimeCommand: 'bun run doom.ts' });

    expect(policy).toEqual({
      auditSurface: 'save-file-path-policy',
      commandContract: {
        entryFile: 'doom.ts',
        runtimeCommand: 'bun run doom.ts',
      },
      directory: 'savegames',
      replayChecksum: 2_175_975_006,
      replaySignature:
        'surface=save-file-path-policy;directory=savegames;slots=6;description=24;header=50;version=version 109;slot0=savegames/doomsav0.dsg;slot1=savegames/doomsav1.dsg;slot2=savegames/doomsav2.dsg;slot3=savegames/doomsav3.dsg;slot4=savegames/doomsav4.dsg;slot5=savegames/doomsav5.dsg',
      savegameDescriptionSize: SAVEGAME_DESCRIPTION_SIZE,
      savegameHeaderSize: SAVEGAME_HEADER_SIZE,
      slots: [
        {
          fileName: 'doomsav0.dsg',
          relativePath: 'savegames/doomsav0.dsg',
          slotIndex: 0,
        },
        {
          fileName: 'doomsav1.dsg',
          relativePath: 'savegames/doomsav1.dsg',
          slotIndex: 1,
        },
        {
          fileName: 'doomsav2.dsg',
          relativePath: 'savegames/doomsav2.dsg',
          slotIndex: 2,
        },
        {
          fileName: 'doomsav3.dsg',
          relativePath: 'savegames/doomsav3.dsg',
          slotIndex: 3,
        },
        {
          fileName: 'doomsav4.dsg',
          relativePath: 'savegames/doomsav4.dsg',
          slotIndex: 4,
        },
        {
          fileName: 'doomsav5.dsg',
          relativePath: 'savegames/doomsav5.dsg',
          slotIndex: 5,
        },
      ],
      versionText: SAVEGAME_VERSION_TEXT,
    });
    expect(policy.directory).toBe(SAVE_FILE_DEFAULT_DIRECTORY);
    expect(policy.slots).toHaveLength(SAVE_FILE_SLOT_COUNT);
    expect(policy.slots.every((slot) => slot.fileName.endsWith(SAVE_FILE_EXTENSION))).toBe(true);
  });

  test('supports deterministic nested local save directories', () => {
    const policy = defineSaveFilePathPolicy({
      runtimeCommand: 'bun run doom.ts',
      saveDirectory: 'profiles/shareware/savegames',
    });

    expect(policy.replayChecksum).toBe(3_746_428_754);
    expect(policy.slots[0]?.relativePath).toBe('profiles/shareware/savegames/doomsav0.dsg');
    expect(policy.slots[5]?.relativePath).toBe('profiles/shareware/savegames/doomsav5.dsg');
  });

  test('rejects non-product runtime commands before returning a policy', () => {
    expect(() => defineSaveFilePathPolicy({ runtimeCommand: 'bun run src/main.ts' })).toThrow(new RangeError('Save file path policy requires bun run doom.ts.'));
  });

  test('rejects host-specific or escaping save directories', () => {
    expect(() =>
      defineSaveFilePathPolicy({
        runtimeCommand: 'bun run doom.ts',
        saveDirectory: '../savegames',
      }),
    ).toThrow(new RangeError('Save directory must not contain empty, current, or parent segments.'));
    expect(() =>
      defineSaveFilePathPolicy({
        runtimeCommand: 'bun run doom.ts',
        saveDirectory: 'C:/savegames',
      }),
    ).toThrow(new RangeError('Save directory must be a relative forward-slash path.'));
    expect(() =>
      defineSaveFilePathPolicy({
        runtimeCommand: 'bun run doom.ts',
        saveDirectory: 'savegames\\slot',
      }),
    ).toThrow(new RangeError('Save directory must be a relative forward-slash path.'));
  });
});
