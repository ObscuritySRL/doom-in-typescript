import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { ENTER_DEFAULT_TITLE_LOOP_CONTRACT, enterDefaultTitleLoop } from '../../../src/playable/bun-runtime-entry-point/enterDefaultTitleLoop.ts';

const EXPECTED_ENTER_DEFAULT_TITLE_LOOP_CONTRACT = {
  auditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
  bunRuntimePath: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
  currentLauncherTransition: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    consumesReplayInput: false,
    createsWindowHost: false,
    loadsIwadBytes: false,
    mutatesGameState: false,
    mutatesGlobalRandomSeed: false,
    recordsLoopStateOnly: true,
  },
  stepId: '03-011',
  stepTitleSlug: 'enter-default-title-loop',
  titleLoop: {
    defaultMapName: 'E1M1',
    initialScreen: 'title',
    menuInitiallyOpen: false,
    source: 'vanilla-startup-title-loop',
    startsGameplay: false,
  },
} as const;

describe('enter default title loop', () => {
  test('locks the exact title-loop contract and stable hash', () => {
    expect(ENTER_DEFAULT_TITLE_LOOP_CONTRACT).toEqual(EXPECTED_ENTER_DEFAULT_TITLE_LOOP_CONTRACT);

    const contractSha256 = createHash('sha256').update(JSON.stringify(ENTER_DEFAULT_TITLE_LOOP_CONTRACT)).digest('hex');

    expect(contractSha256).toBe('bc5e68fdf422566befaa2e9880ebce4479635d5ac576819666bd84e9d4341662');
  });

  test('reconstructs the Bun runtime command contract', () => {
    const reconstructedCommand = [ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.program, ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.subcommand, ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.entryFile].join(' ');

    expect(reconstructedCommand).toBe(ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.command);
  });

  test('cross-checks the audited current launcher transition', async () => {
    const auditManifest: unknown = JSON.parse(await Bun.file(ENTER_DEFAULT_TITLE_LOOP_CONTRACT.auditManifestPath).text());
    const packageJson: unknown = JSON.parse(await Bun.file('package.json').text());

    expect(auditManifest).toMatchObject({
      currentEntrypoint: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.currentLauncherTransition,
      schemaVersion: 1,
      stepId: '01-007',
      targetCommand: {
        command: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.command,
        entryFile: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.entryFile,
        status: 'missing-from-current-launcher-surface',
        workspacePath: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.entryFile,
      },
    });
    expect(packageJson).toMatchObject({
      scripts: {
        start: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.currentLauncherTransition.command,
      },
    });
  });

  test('enters title state without consuming deterministic replay inputs', () => {
    expect(enterDefaultTitleLoop()).toEqual({
      command: 'bun run doom.ts',
      currentScreen: 'title',
      gameTic: 0,
      mapName: 'E1M1',
      menuOpen: false,
      replayInputConsumed: false,
      windowHostCreated: false,
    });
  });

  test('rejects the current src main command for the title-loop entry surface', () => {
    expect(() => enterDefaultTitleLoop({ command: 'bun run src/main.ts' })).toThrow('Default title loop must be entered through bun run doom.ts, got "bun run src/main.ts".');
  });
});
