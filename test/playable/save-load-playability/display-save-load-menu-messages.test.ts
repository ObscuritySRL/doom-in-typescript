import { describe, expect, test } from 'bun:test';

import type { SaveGameHeader, SaveGamePlayerPresence } from '../../../src/save/saveHeader.ts';

import {
  DISPLAY_SAVE_LOAD_MENU_MESSAGES_AUDIT_MANIFEST_PATH,
  DISPLAY_SAVE_LOAD_MENU_MESSAGES_AUDIT_STEP_ID,
  DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND,
  displaySaveLoadMenuMessages,
} from '../../../src/playable/save-load-playability/displaySaveLoadMenuMessages.ts';
import { SAVEGAME_EOF } from '../../../src/save/loadgame.ts';
import { SAVEGAME_DESCRIPTION_SIZE, writeSaveGameHeader } from '../../../src/save/saveHeader.ts';

const MANIFEST_URL = new URL('../../../plan_fps/manifests/01-013-audit-missing-save-load-ui.json', import.meta.url);
const SOURCE_URL = new URL('../../../src/playable/save-load-playability/displaySaveLoadMenuMessages.ts', import.meta.url);

interface MissingSaveLoadUiManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly entryFile: string;
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly path: string | null;
    readonly reason: string;
    readonly surface: string;
  }[];
  readonly schemaVersion: number;
  readonly step: {
    readonly id: string;
    readonly title: string;
  };
}

function createPlayerPresence(): SaveGamePlayerPresence {
  return [1, 0, 0, 0];
}

function createSaveBytes(description: string): Uint8Array {
  const headerBytes = writeSaveGameHeader(createSaveGameHeader(description));
  const saveBytes = new Uint8Array(headerBytes.length + 1);

  saveBytes.set(headerBytes);
  saveBytes[headerBytes.length] = SAVEGAME_EOF;

  return saveBytes;
}

function createSaveGameHeader(description: string): SaveGameHeader {
  return {
    description,
    gameepisode: 1,
    gamemap: 1,
    gameskill: 2,
    leveltime: 0x00_12_34,
    playeringame: createPlayerPresence(),
  };
}

async function hashSource(): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  const sourceBytes = new Uint8Array(await Bun.file(SOURCE_URL).arrayBuffer());

  hasher.update(sourceBytes);

  return hasher.digest('hex');
}

describe('displaySaveLoadMenuMessages', () => {
  test('pins the Bun command contract and missing-save-load-UI audit linkage', async () => {
    const manifest: MissingSaveLoadUiManifest = await Bun.file(MANIFEST_URL).json();

    expect(DISPLAY_SAVE_LOAD_MENU_MESSAGES_AUDIT_MANIFEST_PATH).toBe('plan_fps/manifests/01-013-audit-missing-save-load-ui.json');
    expect(DISPLAY_SAVE_LOAD_MENU_MESSAGES_AUDIT_STEP_ID).toBe('01-013');
    expect(DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(manifest.commandContracts.targetRuntime).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND,
    });
    expect(manifest.explicitNullSurfaces.map((surface) => surface.surface).sort()).toContain('load-game-menu-ui');
    expect(manifest.explicitNullSurfaces.map((surface) => surface.surface).sort()).toContain('save-slot-menu-ui');
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.step.id).toBe(DISPLAY_SAVE_LOAD_MENU_MESSAGES_AUDIT_STEP_ID);
  });

  test('locks the formatted source hash', async () => {
    expect(await hashSource()).toBe('948795e858be506018f9e2ace29d3ceb9ea6a58dd2fa4215e80274f1234c3e84');
  });

  test('displays deterministic load, empty-slot, and save-complete messages', () => {
    const result = displaySaveLoadMenuMessages({
      requests: [
        {
          kind: 'load-slot',
          saveBytes: createSaveBytes('E1M1 START'),
          slotIndex: 2,
        },
        {
          kind: 'clear-message',
          reason: 'acknowledged',
        },
        {
          kind: 'load-slot',
          saveBytes: null,
          slotIndex: 5,
        },
        {
          description: 'E1M1 START',
          kind: 'save-slot',
          playing: true,
          slotIndex: 2,
        },
      ],
      runtimeCommand: DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND,
    });

    expect(result.replayChecksum).toBe(1_356_614_515);
    expect(result.transitionSignature).toBe('3:save-complete:50dc4b73');
    expect(result.history).toEqual([
      {
        description: 'E1M1 START',
        kind: 'load-confirmation',
        lines: ['do you want to load the game named', '', "'E1M1 START'?"],
        requiresAcknowledgement: true,
        slotIndex: 2,
      },
      {
        description: null,
        kind: 'load-empty-slot',
        lines: ['empty save slot.', '', 'press a key.'],
        requiresAcknowledgement: true,
        slotIndex: 5,
      },
      {
        description: 'E1M1 START',
        kind: 'save-complete',
        lines: ['game saved.', "'E1M1 START'"],
        requiresAcknowledgement: true,
        slotIndex: 2,
      },
    ]);
    expect(result.activeMessage).toEqual({
      description: 'E1M1 START',
      kind: 'save-complete',
      lines: ['game saved.', "'E1M1 START'"],
      requiresAcknowledgement: true,
      slotIndex: 2,
    });
  });

  test('classifies unsupported, corrupted, and blocked save/load messages deterministically', () => {
    const corruptedSaveBytes = createSaveBytes('BAD EOF');
    const unsupportedSaveBytes = createSaveBytes('BAD VERSION');

    corruptedSaveBytes[corruptedSaveBytes.length - 1] = 0x00;
    unsupportedSaveBytes[SAVEGAME_DESCRIPTION_SIZE] = 0x58;

    const result = displaySaveLoadMenuMessages({
      requests: [
        {
          kind: 'load-slot',
          saveBytes: unsupportedSaveBytes,
          slotIndex: 1,
        },
        {
          kind: 'load-slot',
          saveBytes: corruptedSaveBytes,
          slotIndex: 2,
        },
        {
          description: 'AFTER DEATH',
          kind: 'save-slot',
          playing: false,
          slotIndex: 3,
        },
        {
          kind: 'load-slot',
          networkGame: true,
          saveBytes: createSaveBytes('NETWORK'),
          slotIndex: 4,
        },
      ],
      runtimeCommand: DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND,
    });

    expect(result.replayChecksum).toBe(4_294_429_101);
    expect(result.transitionSignature).toBe('4:load-network-blocked:fff7c9ad');
    expect(result.history.map((message) => message.kind)).toEqual(['load-unsupported-version', 'load-corrupted', 'save-not-playing', 'load-network-blocked']);
    expect(result.activeMessage).toEqual({
      description: null,
      kind: 'load-network-blocked',
      lines: ["you can't load while in a net game!", '', 'press a key.'],
      requiresAcknowledgement: true,
      slotIndex: 4,
    });
  });

  test('prevalidates the runtime command and save-slot fields', () => {
    expect(() =>
      displaySaveLoadMenuMessages({
        requests: [
          {
            kind: 'load-slot',
            saveBytes: new Uint8Array(1),
            slotIndex: 0,
          },
        ],
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('display save/load menu messages requires bun run doom.ts.');

    expect(() =>
      displaySaveLoadMenuMessages({
        requests: [
          {
            description: 'description longer than slot',
            kind: 'save-slot',
            playing: true,
            slotIndex: 0,
          },
        ],
        runtimeCommand: DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND,
      }),
    ).toThrow(`save description exceeds ${SAVEGAME_DESCRIPTION_SIZE} bytes.`);

    expect(() =>
      displaySaveLoadMenuMessages({
        requests: [
          {
            kind: 'load-slot',
            saveBytes: null,
            slotIndex: 6,
          },
        ],
        runtimeCommand: DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND,
      }),
    ).toThrow('save slot index must be an integer from 0 through 5.');
  });
});
