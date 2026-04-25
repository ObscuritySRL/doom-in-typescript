import { describe, expect, test } from 'bun:test';

import { ADD_ROOT_DOOM_TS_COMMAND_CONTRACT } from '../../../src/playable/bun-runtime-entry-point/addRootDoomTsCommandContract.ts';

type MissingEntrypointAuditManifest = {
  readonly currentEntrypoint: {
    readonly command: string;
    readonly helpUsageLines: readonly string[];
    readonly path: string;
    readonly scriptName: string;
    readonly sourceCatalogId: string;
  };
  readonly targetCommand: {
    readonly command: string;
    readonly entryFile: string;
    readonly status: string;
    readonly workspacePath: string;
  };
};

const EXPECTED_COMMAND_CONTRACT = {
  command: 'bun run doom.ts',
  commandParts: ['bun', 'run', 'doom.ts'],
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    launchSideEffects: 'none',
    replayStateInputs: 'unchanged',
    transition: 'contract-definition-only',
  },
  entryFile: 'doom.ts',
  implementationStepId: '03-002',
  runtimeProgram: 'bun',
  runtimeSubcommand: 'run',
  sourceAuditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
} as const;

describe('add root doom.ts command contract', () => {
  test('locks the exact Bun runtime command contract', () => {
    expect(ADD_ROOT_DOOM_TS_COMMAND_CONTRACT).toEqual(EXPECTED_COMMAND_CONTRACT);
    expect(ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.commandParts.join(' ')).toBe(ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.command);
  });

  test('matches the missing-entrypoint audit target without changing the current launcher surface', async () => {
    const auditManifest: MissingEntrypointAuditManifest = await Bun.file(ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.sourceAuditManifestPath).json();

    expect(auditManifest.targetCommand).toEqual({
      command: ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.command,
      entryFile: ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.entryFile,
      status: 'missing-from-current-launcher-surface',
      workspacePath: ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.entryFile,
    });
    expect(auditManifest.currentEntrypoint).toEqual(ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.currentEntrypoint);
  });

  test('keeps the contract pure for deterministic replay compatibility', () => {
    expect(ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.commandParts[0]).toBe('bun');
    expect(ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.runtimeProgram).toBe('bun');
    expect(ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.runtimeSubcommand).toBe('run');
    expect(ADD_ROOT_DOOM_TS_COMMAND_CONTRACT.deterministicReplayCompatibility).toEqual({
      launchSideEffects: 'none',
      replayStateInputs: 'unchanged',
      transition: 'contract-definition-only',
    });
  });
});
