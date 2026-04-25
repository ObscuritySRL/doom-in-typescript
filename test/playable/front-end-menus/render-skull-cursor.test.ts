import { describe, expect, test } from 'bun:test';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { MenuKind, createMenuState, openMenu, tickMenu } from '../../../src/ui/menus.ts';
import { RENDER_SKULL_CURSOR_RUNTIME_CONTRACT, renderSkullCursor } from '../../../src/playable/front-end-menus/renderSkullCursor.ts';

const testDirectoryPath = dirname(fileURLToPath(import.meta.url));
const manifestFilePath = resolve(testDirectoryPath, '../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json');
const sourceFilePath = resolve(testDirectoryPath, '../../../src/playable/front-end-menus/renderSkullCursor.ts');

async function createSha256Hex(filePath: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  const fileBytes = new Uint8Array(await Bun.file(filePath).arrayBuffer());
  hasher.update(fileBytes);
  return hasher.digest('hex');
}

describe('renderSkullCursor', () => {
  test('exports the exact Bun runtime contract and audit linkage', async () => {
    expect(RENDER_SKULL_CURSOR_RUNTIME_CONTRACT).toEqual({
      audit: {
        schemaVersion: 1,
        stepId: '07-017',
        title: 'render-skull-cursor',
      },
      auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
      targetRuntime: {
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
        value: 'bun run doom.ts',
      },
    });

    const manifest = JSON.parse(await Bun.file(manifestFilePath).text()) as {
      readonly audit: {
        readonly schemaVersion: number;
        readonly stepId: string;
        readonly title: string;
      };
      readonly commandContracts: {
        readonly targetRuntime: {
          readonly value: string;
        };
      };
    };

    expect(manifest.audit).toEqual({
      schemaVersion: 1,
      stepId: '01-008',
      title: 'audit-missing-launch-to-menu',
    });
    expect(manifest.commandContracts.targetRuntime.value).toBe(RENDER_SKULL_CURSOR_RUNTIME_CONTRACT.targetRuntime.value);
  });

  test('matches the locked source hash', async () => {
    expect(await createSha256Hex(sourceFilePath)).toBe('8cf3e31799cd33bdca4b3d672582dfe27956fc3e303ce84b732904b1b149ce61');
  });

  test('renders the main-menu skull cursor and preserves demo playback state', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    frontEndSequenceState.inDemoPlayback = true;
    openMenu(menuState, MenuKind.Main);

    expect(
      renderSkullCursor({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      demoPlaybackActive: true,
      itemOn: 0,
      lumpName: 'M_SKULL1',
      menuActive: true,
      menuKind: MenuKind.Main,
      x: 65,
      y: 64,
    });
    expect(frontEndSequenceState.inDemoPlayback).toBe(true);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('renders the second skull frame after the blink transition on the episode menu', () => {
    const frontEndSequenceState = createFrontEndSequence('registered');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Episode);

    for (let tickIndex = 0; tickIndex < 8; tickIndex++) {
      tickMenu(menuState);
    }

    expect(
      renderSkullCursor({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      demoPlaybackActive: false,
      itemOn: 0,
      lumpName: 'M_SKULL2',
      menuActive: true,
      menuKind: MenuKind.Episode,
      x: 16,
      y: 63,
    });
  });

  test('rejects unsupported runtime commands', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);

    expect(() =>
      renderSkullCursor({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('renderSkullCursor requires the bun run doom.ts runtime command.');
  });

  test('rejects inactive menu state', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    expect(() =>
      renderSkullCursor({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toThrow('renderSkullCursor requires an active menu state.');
  });
});
