import { describe, expect, test } from 'bun:test';

import {
  IMPLEMENT_SAVE_DESCRIPTIONS_AUDIT_STEP_ID,
  IMPLEMENT_SAVE_DESCRIPTIONS_AUDIT_SURFACE,
  IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT,
  SAVE_DESCRIPTION_MAXIMUM_BYTES,
  implementSaveDescriptions,
} from '../../../src/playable/save-load-playability/implementSaveDescriptions.ts';
import { writeSaveGameHeader } from '../../../src/save/saveHeader.ts';

const SOURCE_PATH = 'src/playable/save-load-playability/implementSaveDescriptions.ts';
const SOURCE_SHA256 = '0c2da30c604a4e1272820c17c90527384800ba756edd980e11ea4f08ae37b8fe';

async function createSha256(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(await Bun.file(path).text());

  return hasher.digest('hex');
}

describe('implementSaveDescriptions', () => {
  test('locks the Bun command contract, audit linkage, and source hash', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-013-audit-missing-save-load-ui.json').text();

    expect(IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(IMPLEMENT_SAVE_DESCRIPTIONS_AUDIT_STEP_ID).toBe('01-013');
    expect(IMPLEMENT_SAVE_DESCRIPTIONS_AUDIT_SURFACE).toBe('save-description-entry');
    expect(SAVE_DESCRIPTION_MAXIMUM_BYTES).toBe(24);
    expect(manifestText).toContain('"surface": "save-description-entry"');
    expect(manifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(await createSha256(SOURCE_PATH)).toBe(SOURCE_SHA256);
  });

  test('applies deterministic byte-limited description edits', () => {
    const result = implementSaveDescriptions({
      command: IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT,
      events: [{ character: ' ', kind: 'insert' }, { character: 'O', kind: 'insert' }, { character: 'X', kind: 'insert' }, { kind: 'backspace' }, { character: 'K', kind: 'insert' }, { kind: 'confirm' }],
      initialDescription: 'E1M1',
    });

    expect(result).toEqual({
      confirmed: true,
      description: 'E1M1 OK',
      displayText: 'E1M1 OK'.padEnd(24, ' '),
      replayChecksum: 3_659_604_491,
      replayHash: '660e28000248a0dc17760b2a7bb6192d872542fa5d9a2aea2b1ba7ac1b15028f',
      serializedDescriptionBytes: [69, 49, 77, 49, 32, 79, 75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      transitionSignature: 'initial:4:69,49,77,49|insert:32:5|insert:79:6|insert:88:7|backspace:6|insert:75:7|confirm:7',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.serializedDescriptionBytes)).toBe(true);
  });

  test('serializes descriptions through the canonical save header layout', () => {
    const result = implementSaveDescriptions({
      command: IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT,
      events: [{ character: '2', kind: 'insert' }],
      initialDescription: 'slot ',
    });
    const headerBytes = writeSaveGameHeader({
      description: result.description,
      gameepisode: 1,
      gamemap: 1,
      gameskill: 2,
      leveltime: 0,
      playeringame: [1, 0, 0, 0],
    });

    expect(result.description).toBe('slot 2');
    expect(Array.from(headerBytes.subarray(0, SAVE_DESCRIPTION_MAXIMUM_BYTES))).toEqual(Array.from(result.serializedDescriptionBytes));
  });

  test('rejects the wrong runtime command before applying invalid events', () => {
    expect(() =>
      implementSaveDescriptions({
        command: {
          entryFile: 'src/main.ts',
          runtimeCommand: 'bun run src/main.ts',
        },
        events: [{ character: '😀', kind: 'insert' }],
        initialDescription: '',
      }),
    ).toThrow('Save descriptions require bun run doom.ts.');
  });

  test('rejects descriptions that cannot fit the save header field', () => {
    expect(() =>
      implementSaveDescriptions({
        command: IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT,
        events: [{ character: '!', kind: 'insert' }],
        initialDescription: '123456789012345678901234',
      }),
    ).toThrow('Save description exceeds 24 bytes.');
    expect(() =>
      implementSaveDescriptions({
        command: IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT,
        events: [{ character: 'Ā', kind: 'insert' }],
        initialDescription: 'E1M1',
      }),
    ).toThrow('Save description insert event must contain only byte characters.');
  });
});
