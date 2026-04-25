import { describe, expect, test } from 'bun:test';

import { bunNativeFileLoadingWire } from '../../../src/playable/bun-runtime-entry-point/wireBunNativeFileLoading.ts';

type AuditManifest = {
  readonly currentEntrypoint: {
    readonly command: string;
    readonly path: string;
    readonly scriptName: string;
  };
  readonly schemaVersion: number;
  readonly stepId: string;
  readonly targetCommand: {
    readonly command: string;
    readonly entryFile: string;
    readonly workspacePath: string;
  };
};

const auditManifestPath = 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';
const expectedBunNativeFileLoadingWire = {
  commandContract: {
    entryFile: 'doom.ts',
    program: 'bun',
    runtimeCommand: 'bun run doom.ts',
    subcommand: 'run',
  },
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    defaultIwadProbe: {
      behavior: 'probe-default-iwad-path-before-launch-resource-load',
      method: 'Bun.file().exists',
      sourceLocation: 'src/main.ts:resolveDefaultIwadPath',
    },
    path: 'src/main.ts',
    scriptName: 'start',
  },
  deterministicReplayCompatibility: {
    fileReadTiming: 'launcher-startup-only',
    mutatesGameState: false,
    replayInputDependency: 'none',
  },
  fileLoading: {
    binaryReadMethod: 'Bun.file().arrayBuffer',
    existenceProbeMethod: 'Bun.file().exists',
    provider: 'Bun.file',
    textReadMethod: 'Bun.file().text',
  },
  manifestAuthority: {
    path: auditManifestPath,
    schemaVersion: 1,
    sourceStepIdentifier: '01-007',
  },
  step: {
    stepIdentifier: '03-004',
    titleSlug: 'wire-bun-native-file-loading',
  },
} as const;

describe('bunNativeFileLoadingWire', () => {
  test('locks the exact Bun native file loading wire contract', () => {
    expect(bunNativeFileLoadingWire).toEqual(expectedBunNativeFileLoadingWire);
  });

  test('derives the target command from Bun command parts', () => {
    const commandContract = bunNativeFileLoadingWire.commandContract;

    expect(`${commandContract.program} ${commandContract.subcommand} ${commandContract.entryFile}`).toBe(commandContract.runtimeCommand);
    expect(commandContract).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
  });

  test('matches the 01-007 launch surface manifest schema and transition', async () => {
    const auditManifest: unknown = await Bun.file(auditManifestPath).json();

    assertAuditManifest(auditManifest);

    expect(auditManifest.schemaVersion).toBe(bunNativeFileLoadingWire.manifestAuthority.schemaVersion);
    expect(auditManifest.stepId).toBe(bunNativeFileLoadingWire.manifestAuthority.sourceStepIdentifier);
    expect(auditManifest.targetCommand.command).toBe(bunNativeFileLoadingWire.commandContract.runtimeCommand);
    expect(auditManifest.targetCommand.entryFile).toBe(bunNativeFileLoadingWire.commandContract.entryFile);
    expect(auditManifest.targetCommand.workspacePath).toBe(bunNativeFileLoadingWire.commandContract.entryFile);
    expect(auditManifest.currentEntrypoint.command).toBe(bunNativeFileLoadingWire.currentEntrypoint.command);
    expect(auditManifest.currentEntrypoint.path).toBe(bunNativeFileLoadingWire.currentEntrypoint.path);
    expect(auditManifest.currentEntrypoint.scriptName).toBe(bunNativeFileLoadingWire.currentEntrypoint.scriptName);
  });

  test('matches the current package script and launcher Bun.file probe', async () => {
    const launcherSource = await Bun.file('src/main.ts').text();
    const packageJsonSource = await Bun.file('package.json').text();

    expect(packageJsonSource).toContain('"start": "bun run src/main.ts"');
    expect(launcherSource).toContain('const localIwad = Bun.file(DEFAULT_LOCAL_IWAD_PATH);');
    expect(launcherSource).toContain('if (await localIwad.exists())');
    expect(bunNativeFileLoadingWire.currentEntrypoint.defaultIwadProbe.method).toBe('Bun.file().exists');
  });

  test('keeps deterministic replay compatibility explicit', () => {
    expect(bunNativeFileLoadingWire.deterministicReplayCompatibility).toEqual({
      fileReadTiming: 'launcher-startup-only',
      mutatesGameState: false,
      replayInputDependency: 'none',
    });
  });

  test('rejects Node filesystem loading surfaces', () => {
    const fileLoadingMethods = Object.values(bunNativeFileLoadingWire.fileLoading).join('\n');

    expect(fileLoadingMethods).toContain('Bun.file');
    expect(fileLoadingMethods).not.toContain('node:fs');
    expect(fileLoadingMethods).not.toContain('fs.readFile');
  });
});

function assertAuditManifest(value: unknown): asserts value is AuditManifest {
  if (!isRecord(value)) {
    throw new Error('Audit manifest must be an object.');
  }

  const currentEntrypoint = value['currentEntrypoint'];
  const targetCommand = value['targetCommand'];

  if (!isRecord(currentEntrypoint)) {
    throw new Error('Audit manifest currentEntrypoint must be an object.');
  }

  if (!isRecord(targetCommand)) {
    throw new Error('Audit manifest targetCommand must be an object.');
  }

  if (
    typeof value['schemaVersion'] !== 'number' ||
    typeof value['stepId'] !== 'string' ||
    typeof currentEntrypoint['command'] !== 'string' ||
    typeof currentEntrypoint['path'] !== 'string' ||
    typeof currentEntrypoint['scriptName'] !== 'string' ||
    typeof targetCommand['command'] !== 'string' ||
    typeof targetCommand['entryFile'] !== 'string' ||
    typeof targetCommand['workspacePath'] !== 'string'
  ) {
    throw new Error('Audit manifest does not match the expected 01-007 shape.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
