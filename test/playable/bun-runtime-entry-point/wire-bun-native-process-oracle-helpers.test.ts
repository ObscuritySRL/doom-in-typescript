import { describe, expect, test } from 'bun:test';

import { wireBunNativeProcessOracleHelpers } from '../../../src/playable/bun-runtime-entry-point/wireBunNativeProcessOracleHelpers.ts';
import type { WireBunNativeProcessOracleHelpers } from '../../../src/playable/bun-runtime-entry-point/wireBunNativeProcessOracleHelpers.ts';

type JsonRecord = Record<string, unknown>;

const expectedWireBunNativeProcessOracleHelpers = {
  auditManifest: {
    path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    schemaVersion: 1,
    stepId: '01-007',
  },
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    changesGameState: false,
    consumesReplayInput: false,
    helperSurface: 'oracle-process-contract-only',
    launchesWindow: false,
    mutatesReplayState: false,
    processExecutionMode: 'deferred-to-oracle-runner',
  },
  processOracleHelpers: {
    captureStreams: ['stdout', 'stderr'],
    environmentPolicy: 'explicit-bun-environment',
    exitStatusPolicy: 'capture-exit-code-without-throwing',
    forbiddenProviders: ['child_process', 'node:child_process', 'npm', 'npx', 'node'],
    provider: 'Bun.spawn',
    shellPolicy: 'direct-argument-vector-no-shell',
    spawnArgumentMode: 'program-plus-arguments',
  },
  schemaVersion: 1,
  stepId: '03-005',
  stepTitleSlug: 'wire-bun-native-process-oracle-helpers',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    workspacePath: 'doom.ts',
  },
} as const satisfies WireBunNativeProcessOracleHelpers;

describe('wireBunNativeProcessOracleHelpers', () => {
  test('locks the exact Bun process oracle helper contract', () => {
    expect(wireBunNativeProcessOracleHelpers).toEqual(expectedWireBunNativeProcessOracleHelpers);
  });

  test('reconstructs the target command from Bun runtime parts', () => {
    const targetCommand = wireBunNativeProcessOracleHelpers.targetCommand;

    expect([targetCommand.program, targetCommand.subcommand, targetCommand.entryFile].join(' ')).toBe(targetCommand.command);
    expect(wireBunNativeProcessOracleHelpers.processOracleHelpers.provider).toBe('Bun.spawn');
    expect(wireBunNativeProcessOracleHelpers.processOracleHelpers.spawnArgumentMode).toBe('program-plus-arguments');
    expect(wireBunNativeProcessOracleHelpers.processOracleHelpers.forbiddenProviders).toEqual(['child_process', 'node:child_process', 'npm', 'npx', 'node']);
  });

  test('matches the 01-007 audit manifest schema and launcher transition', async () => {
    const auditManifestText = await Bun.file(wireBunNativeProcessOracleHelpers.auditManifest.path).text();
    const parsedAuditManifest: unknown = JSON.parse(auditManifestText);

    assertJsonRecord(parsedAuditManifest, 'audit manifest');

    const currentEntrypoint = readJsonRecord(parsedAuditManifest, 'currentEntrypoint');
    const targetCommand = readJsonRecord(parsedAuditManifest, 'targetCommand');

    expect(readNumber(parsedAuditManifest, 'schemaVersion')).toBe(wireBunNativeProcessOracleHelpers.auditManifest.schemaVersion);
    expect(readString(parsedAuditManifest, 'stepId')).toBe(wireBunNativeProcessOracleHelpers.auditManifest.stepId);
    expect(readString(currentEntrypoint, 'command')).toBe(wireBunNativeProcessOracleHelpers.currentEntrypoint.command);
    expect(readString(currentEntrypoint, 'path')).toBe(wireBunNativeProcessOracleHelpers.currentEntrypoint.path);
    expect(readString(currentEntrypoint, 'scriptName')).toBe(wireBunNativeProcessOracleHelpers.currentEntrypoint.scriptName);
    expect(readString(currentEntrypoint, 'sourceCatalogId')).toBe(wireBunNativeProcessOracleHelpers.currentEntrypoint.sourceCatalogId);
    expect(readStringArray(currentEntrypoint, 'helpUsageLines')).toEqual([...wireBunNativeProcessOracleHelpers.currentEntrypoint.helpUsageLines]);
    expect(readString(targetCommand, 'command')).toBe(wireBunNativeProcessOracleHelpers.targetCommand.command);
    expect(readString(targetCommand, 'entryFile')).toBe(wireBunNativeProcessOracleHelpers.targetCommand.entryFile);
    expect(readString(targetCommand, 'workspacePath')).toBe(wireBunNativeProcessOracleHelpers.targetCommand.workspacePath);
  });

  test('locks the current package script and source launcher evidence', async () => {
    const packageJsonText = await Bun.file('package.json').text();
    const sourceEntrypointText = await Bun.file('src/main.ts').text();

    expect(packageJsonText).toContain('"start": "bun run src/main.ts"');
    expect(sourceEntrypointText).toContain('new CommandLine(Bun.argv)');
    expect(sourceEntrypointText).toContain('Bun.file(DEFAULT_LOCAL_IWAD_PATH)');
    expect(sourceEntrypointText).toContain('runLauncherWindow(session');
  });

  test('keeps deterministic replay state outside the process helper surface', () => {
    expect(wireBunNativeProcessOracleHelpers.deterministicReplayCompatibility).toEqual({
      changesGameState: false,
      consumesReplayInput: false,
      helperSurface: 'oracle-process-contract-only',
      launchesWindow: false,
      mutatesReplayState: false,
      processExecutionMode: 'deferred-to-oracle-runner',
    });
  });
});

function assertJsonRecord(value: unknown, label: string): asserts value is JsonRecord {
  if (!isJsonRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonRecord(record: JsonRecord, fieldName: string): JsonRecord {
  const value = record[fieldName];

  assertJsonRecord(value, fieldName);

  return value;
}

function readNumber(record: JsonRecord, fieldName: string): number {
  const value = record[fieldName];

  if (typeof value !== 'number') {
    throw new Error(`${fieldName} must be a number.`);
  }

  return value;
}

function readString(record: JsonRecord, fieldName: string): string {
  const value = record[fieldName];

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  return value;
}

function readStringArray(record: JsonRecord, fieldName: string): readonly string[] {
  const value = record[fieldName];

  if (!Array.isArray(value) || !value.every((arrayValue): arrayValue is string => typeof arrayValue === 'string')) {
    throw new Error(`${fieldName} must be a string array.`);
  }

  return value;
}
