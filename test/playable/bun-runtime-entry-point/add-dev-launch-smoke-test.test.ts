import { describe, expect, test } from 'bun:test';

import { addDevLaunchSmokeTest } from '../../../src/playable/bun-runtime-entry-point/addDevLaunchSmokeTest.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';

describe('addDevLaunchSmokeTest', () => {
  test('locks the exact dev launch smoke test contract', () => {
    expect(addDevLaunchSmokeTest).toEqual({
      currentEntrypoint: {
        command: 'bun run src/main.ts',
        helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
        path: 'src/main.ts',
        scriptName: 'start',
        sourceCatalogIdentifier: 'S-FPS-011',
      },
      deterministicReplayCompatibility: {
        gameStateMutation: 'none',
        launchWindowSideEffects: 'none',
        replayInputMutation: 'none',
        smokeTestScope: 'process-contract-only',
      },
      manifestAuthority: {
        path: AUDIT_MANIFEST_PATH,
        schemaVersion: 1,
        sourceStepIdentifier: '01-007',
        targetCommandStatus: 'missing-from-current-launcher-surface',
      },
      smokeTest: {
        arguments: ['--help'],
        command: 'bun run doom.ts --help',
        expectedExitCode: 0,
        expectedOutputFragments: ['DOOM Codex launcher', 'Usage:', 'bun run doom.ts'],
        kind: 'development-launch-smoke-test',
        purpose: 'confirm the root Bun entrypoint resolves and exits from help mode without opening a window',
        sideEffects: {
          consumesReplayInput: false,
          createsGameSession: false,
          loadsIwad: false,
          opensWindow: false,
        },
        transition: {
          fromEntrypoint: 'doom.ts',
          toLauncherEntrypoint: 'src/main.ts',
          viaRuntime: 'bun run',
        },
      },
      stepIdentifier: '03-003',
      stepTitleSlug: 'add-dev-launch-smoke-test',
      targetCommand: {
        command: 'bun run doom.ts',
        entryFile: 'doom.ts',
        program: 'bun',
        runner: 'run',
        workspacePath: 'doom.ts',
      },
    });
  });

  test('derives the smoke command from the Bun runtime command contract', () => {
    const reconstructedTargetCommand = [addDevLaunchSmokeTest.targetCommand.program, addDevLaunchSmokeTest.targetCommand.runner, addDevLaunchSmokeTest.targetCommand.entryFile].join(' ');
    const reconstructedSmokeCommand = [reconstructedTargetCommand, ...addDevLaunchSmokeTest.smokeTest.arguments].join(' ');

    expect(reconstructedTargetCommand).toBe(addDevLaunchSmokeTest.targetCommand.command);
    expect(reconstructedSmokeCommand).toBe(addDevLaunchSmokeTest.smokeTest.command);
    expect(addDevLaunchSmokeTest.smokeTest.transition).toEqual({
      fromEntrypoint: addDevLaunchSmokeTest.targetCommand.entryFile,
      toLauncherEntrypoint: addDevLaunchSmokeTest.currentEntrypoint.path,
      viaRuntime: 'bun run',
    });
  });

  test('cross-checks the allowed audit manifest and current launcher surface', async () => {
    const auditManifest = await readJsonRecord(AUDIT_MANIFEST_PATH);
    const currentEntrypoint = readRecord(auditManifest, 'currentEntrypoint');
    const targetCommand = readRecord(auditManifest, 'targetCommand');

    expect(readNumber(auditManifest, 'schemaVersion')).toBe(addDevLaunchSmokeTest.manifestAuthority.schemaVersion);
    expect(readString(auditManifest, 'stepId')).toBe(addDevLaunchSmokeTest.manifestAuthority.sourceStepIdentifier);
    expect(readString(currentEntrypoint, 'command')).toBe(addDevLaunchSmokeTest.currentEntrypoint.command);
    expect(readString(currentEntrypoint, 'path')).toBe(addDevLaunchSmokeTest.currentEntrypoint.path);
    expect(readString(currentEntrypoint, 'scriptName')).toBe(addDevLaunchSmokeTest.currentEntrypoint.scriptName);
    expect(readString(currentEntrypoint, 'sourceCatalogId')).toBe(addDevLaunchSmokeTest.currentEntrypoint.sourceCatalogIdentifier);
    expect(readStringArray(currentEntrypoint, 'helpUsageLines')).toEqual([...addDevLaunchSmokeTest.currentEntrypoint.helpUsageLines]);
    expect(readString(targetCommand, 'command')).toBe(addDevLaunchSmokeTest.targetCommand.command);
    expect(readString(targetCommand, 'entryFile')).toBe(addDevLaunchSmokeTest.targetCommand.entryFile);
    expect(readString(targetCommand, 'status')).toBe(addDevLaunchSmokeTest.manifestAuthority.targetCommandStatus);
    expect(readString(targetCommand, 'workspacePath')).toBe(addDevLaunchSmokeTest.targetCommand.workspacePath);
  });

  test('matches package and source launcher evidence without opening a window', async () => {
    const packageJson = await readJsonRecord('package.json');
    const packageScripts = readRecord(packageJson, 'scripts');
    const mainSourceText = await Bun.file('src/main.ts').text();

    expect(readString(packageScripts, 'start')).toBe(addDevLaunchSmokeTest.currentEntrypoint.command);
    expect(mainSourceText).toContain('const HELP_TEXT = [');
    expect(mainSourceText).toContain('const commandLine = new CommandLine(Bun.argv);');
    expect(mainSourceText).toContain('await runLauncherWindow(session, {');

    for (const helpUsageLine of addDevLaunchSmokeTest.currentEntrypoint.helpUsageLines) {
      expect(mainSourceText).toContain(helpUsageLine);
    }

    expect(addDevLaunchSmokeTest.smokeTest.expectedExitCode).toBe(0);
    expect(addDevLaunchSmokeTest.smokeTest.sideEffects).toEqual({
      consumesReplayInput: false,
      createsGameSession: false,
      loadsIwad: false,
      opensWindow: false,
    });
  });
});

async function readJsonRecord(path: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await Bun.file(path).text());

  if (!isRecord(value)) {
    throw new Error(`${path} must contain a JSON object.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== 'number') {
    throw new Error(`${key} must be a number.`);
  }

  return value;
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];

  if (!isRecord(value)) {
    throw new Error(`${key} must be an object.`);
  }

  return value;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string.`);
  }

  return value;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${key} must be a string array.`);
  }

  return value;
}
