import { describe, expect, test } from 'bun:test';

import { DEFAULT_CONFIGURATION_CANDIDATE_PATHS, IMPLEMENT_DEFAULT_CONFIG_LOADING_CONTRACT, loadDefaultConfiguration, parseDefaultConfigurationText } from '../../../src/playable/bun-runtime-entry-point/implementDefaultConfigLoading.ts';
import type { DefaultConfigurationFileReader } from '../../../src/playable/bun-runtime-entry-point/implementDefaultConfigLoading.ts';

interface AuditManifest {
  readonly currentEntrypoint: {
    readonly command: string;
    readonly helpUsageLines: readonly string[];
    readonly path: string;
    readonly scriptName: string;
    readonly sourceCatalogId: string;
  };
  readonly schemaVersion: number;
  readonly targetCommand: {
    readonly command: string;
    readonly entryFile: string;
    readonly status: string;
    readonly workspacePath: string;
  };
}

const EXPECTED_CONTRACT = {
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  defaultConfigurationLoading: {
    candidatePaths: ['doom\\default.cfg', 'doom\\chocolate-doom.cfg'],
    fileReader: 'Bun.file',
    loadTiming: 'launcher-startup-before-session',
    missingResultStatus: 'missing',
    parser: 'whitespace-separated-doom-default-configuration-lines',
    rejectedNodeSurfaces: ['fs', 'node:fs'],
  },
  deterministicReplayCompatibility: {
    gameStateMutation: 'none-before-session',
    loadPhase: 'launcher-startup-before-session',
    replayInputDependency: 'none',
    result: 'default-configuration-loaded-before-deterministic-session-creation',
  },
  schemaVersion: 1,
  sourceManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
  stepId: '03-009',
  stepTitleSlug: 'implement-default-config-loading',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    status: 'missing-from-current-launcher-surface',
    workspacePath: 'doom.ts',
  },
} as const;

const EXPECTED_CONTRACT_HASH = 'a9d0aa596e667baa68a6908b5ed53a4f91deb39eb15a3c8eb138464e8dde824a';

describe('implement default config loading', () => {
  test('locks the exact contract and hash', () => {
    expect(IMPLEMENT_DEFAULT_CONFIG_LOADING_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(IMPLEMENT_DEFAULT_CONFIG_LOADING_CONTRACT.defaultConfigurationLoading.candidatePaths).toBe(DEFAULT_CONFIGURATION_CANDIDATE_PATHS);
    expect(sha256Json(IMPLEMENT_DEFAULT_CONFIG_LOADING_CONTRACT)).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('cross-checks the audited entrypoint transition and package script', async () => {
    const auditManifest = await readAuditManifest();
    const packageJson = await readPackageJson();

    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.currentEntrypoint).toEqual(IMPLEMENT_DEFAULT_CONFIG_LOADING_CONTRACT.currentEntrypoint);
    expect(auditManifest.targetCommand).toEqual(IMPLEMENT_DEFAULT_CONFIG_LOADING_CONTRACT.targetCommand);
    expect(packageJson.scriptsStart).toBe(IMPLEMENT_DEFAULT_CONFIG_LOADING_CONTRACT.currentEntrypoint.command);
  });

  test('keeps candidate paths tied to the fact log default configuration authority', async () => {
    const factLogText = await Bun.file('plan_fps/FACT_LOG.md').text();

    for (const candidatePath of DEFAULT_CONFIGURATION_CANDIDATE_PATHS) {
      expect(factLogText).toContain(candidatePath.replaceAll('\\', '/'));
    }
  });

  test('parses vanilla default configuration lines without mutating replay state', () => {
    expect(parseDefaultConfigurationText(['# comment', 'key_right 174', '', '; another comment', 'sfx_volume 8', 'chatmacro0 "No"'].join('\n'))).toEqual([
      {
        key: 'key_right',
        lineNumber: 2,
        value: '174',
      },
      {
        key: 'sfx_volume',
        lineNumber: 5,
        value: '8',
      },
      {
        key: 'chatmacro0',
        lineNumber: 6,
        value: '"No"',
      },
    ]);
    expect(IMPLEMENT_DEFAULT_CONFIG_LOADING_CONTRACT.deterministicReplayCompatibility).toEqual({
      gameStateMutation: 'none-before-session',
      loadPhase: 'launcher-startup-before-session',
      replayInputDependency: 'none',
      result: 'default-configuration-loaded-before-deterministic-session-creation',
    });
  });

  test('loads the first available default configuration through the Bun-compatible reader', async () => {
    const fileReader: DefaultConfigurationFileReader = {
      exists: async (configurationPath: string): Promise<boolean> => configurationPath === 'doom\\chocolate-doom.cfg',
      text: async (configurationPath: string): Promise<string> => {
        expect(configurationPath).toBe('doom\\chocolate-doom.cfg');

        return ['use_mouse 1', 'music_volume 8'].join('\n');
      },
    };

    await expect(loadDefaultConfiguration(DEFAULT_CONFIGURATION_CANDIDATE_PATHS, fileReader)).resolves.toEqual({
      checkedPaths: ['doom\\default.cfg', 'doom\\chocolate-doom.cfg'],
      configurationPath: 'doom\\chocolate-doom.cfg',
      configurationText: ['use_mouse 1', 'music_volume 8'].join('\n'),
      entries: [
        {
          key: 'use_mouse',
          lineNumber: 1,
          value: '1',
        },
        {
          key: 'music_volume',
          lineNumber: 2,
          value: '8',
        },
      ],
      status: 'loaded',
    });
  });

  test('returns a missing result without reading text when no candidate exists', async () => {
    let textReadCount = 0;

    const fileReader: DefaultConfigurationFileReader = {
      exists: async (): Promise<boolean> => false,
      text: async (): Promise<string> => {
        textReadCount += 1;

        return '';
      },
    };

    await expect(loadDefaultConfiguration(DEFAULT_CONFIGURATION_CANDIDATE_PATHS, fileReader)).resolves.toEqual({
      checkedPaths: ['doom\\default.cfg', 'doom\\chocolate-doom.cfg'],
      configurationPath: null,
      configurationText: null,
      entries: [],
      status: 'missing',
    });
    expect(textReadCount).toBe(0);
  });
});

function getRecordField(record: Record<string, unknown>, fieldName: string): Record<string, unknown> {
  const value = record[fieldName];

  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  return value;
}

function getStringArrayField(record: Record<string, unknown>, fieldName: string): readonly string[] {
  const value = record[fieldName];

  if (!Array.isArray(value) || !value.every((entry: unknown): entry is string => typeof entry === 'string')) {
    throw new Error(`${fieldName} must be a string array.`);
  }

  return value;
}

function getStringField(record: Record<string, unknown>, fieldName: string): string {
  const value = record[fieldName];

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readAuditManifest(): Promise<AuditManifest> {
  const parsedJson: unknown = JSON.parse(await Bun.file('plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json').text());

  if (!isRecord(parsedJson)) {
    throw new Error('Audit manifest must be an object.');
  }

  const currentEntrypointRecord = getRecordField(parsedJson, 'currentEntrypoint');
  const targetCommandRecord = getRecordField(parsedJson, 'targetCommand');
  const schemaVersion = parsedJson.schemaVersion;

  if (typeof schemaVersion !== 'number') {
    throw new Error('schemaVersion must be a number.');
  }

  return {
    currentEntrypoint: {
      command: getStringField(currentEntrypointRecord, 'command'),
      helpUsageLines: getStringArrayField(currentEntrypointRecord, 'helpUsageLines'),
      path: getStringField(currentEntrypointRecord, 'path'),
      scriptName: getStringField(currentEntrypointRecord, 'scriptName'),
      sourceCatalogId: getStringField(currentEntrypointRecord, 'sourceCatalogId'),
    },
    schemaVersion,
    targetCommand: {
      command: getStringField(targetCommandRecord, 'command'),
      entryFile: getStringField(targetCommandRecord, 'entryFile'),
      status: getStringField(targetCommandRecord, 'status'),
      workspacePath: getStringField(targetCommandRecord, 'workspacePath'),
    },
  };
}

async function readPackageJson(): Promise<{ readonly scriptsStart: string }> {
  const parsedJson: unknown = JSON.parse(await Bun.file('package.json').text());

  if (!isRecord(parsedJson)) {
    throw new Error('package.json must be an object.');
  }

  const scripts = getRecordField(parsedJson, 'scripts');

  return {
    scriptsStart: getStringField(scripts, 'start'),
  };
}

function sha256Json(value: unknown): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(JSON.stringify(value));

  return hasher.digest('hex');
}
