import { describe, expect, test } from 'bun:test';

import { DEFAULT_LOCAL_IWAD_PATH, IMPLEMENT_IWAD_DISCOVERY_CONTRACT, discoverIwadPath } from '../../../src/playable/bun-runtime-entry-point/implementIwadDiscovery.ts';
import type { ImplementIwadDiscoveryContract, IwadPathExistenceProbe } from '../../../src/playable/bun-runtime-entry-point/implementIwadDiscovery.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';
const CONTRACT_HASH = '3303987adbeb93648274cd21f05819e949d6fb55e3142debe99ea3ddaf64cf00';

const EXPECTED_CONTRACT = {
  commandContract: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    discoveryStage: 'startup-before-game-session',
    frameDependent: false,
    gameStateMutation: false,
    replayInputDependency: false,
  },
  discovery: {
    commandLineParameter: '--iwad',
    defaultCandidate: {
      path: 'doom\\DOOM1.WAD',
      source: 'local-reference-bundle',
    },
    missingDefaultResult: 'null-deferred-to-03-008',
    provider: 'Bun.file().exists()',
    source: 'Bun-runtime-entrypoint',
  },
  stepId: '03-007',
  stepTitleSlug: 'implement-iwad-discovery',
} as const satisfies ImplementIwadDiscoveryContract;

describe('implement IWAD discovery', () => {
  test('locks the exact Bun runtime discovery contract and hash', () => {
    expect(DEFAULT_LOCAL_IWAD_PATH).toBe('doom\\DOOM1.WAD');
    expect(IMPLEMENT_IWAD_DISCOVERY_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(commandFromContract(IMPLEMENT_IWAD_DISCOVERY_CONTRACT)).toBe('bun run doom.ts');
    expect(sha256(JSON.stringify(IMPLEMENT_IWAD_DISCOVERY_CONTRACT))).toBe(CONTRACT_HASH);
  });

  test('matches the audited current entrypoint and package script', async () => {
    const auditManifest = await readAuditManifest();
    const packageJson = await readJsonObject('package.json');
    const packageScripts = readObjectProperty(packageJson, 'scripts', 'package.json.scripts');

    expect(Reflect.get(packageScripts, 'start')).toBe('bun run src/main.ts');
    expect(auditManifest.currentEntrypoint).toEqual(IMPLEMENT_IWAD_DISCOVERY_CONTRACT.currentEntrypoint);
    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.targetCommand).toEqual({
      command: IMPLEMENT_IWAD_DISCOVERY_CONTRACT.commandContract.command,
      entryFile: IMPLEMENT_IWAD_DISCOVERY_CONTRACT.commandContract.entryFile,
      status: 'missing-from-current-launcher-surface',
      workspacePath: IMPLEMENT_IWAD_DISCOVERY_CONTRACT.commandContract.entryFile,
    });
  });

  test('prefers the command-line IWAD path without probing the filesystem', async () => {
    const requestedIwadPath = 'custom\\DOOM1.WAD';
    const blockedProbe: IwadPathExistenceProbe = async () => {
      throw new Error('command-line IWAD discovery must not probe the default candidate');
    };

    await expect(
      discoverIwadPath({
        fileExists: blockedProbe,
        requestedIwadPath,
      }),
    ).resolves.toEqual({
      iwadPath: requestedIwadPath,
      source: 'command-line',
      status: 'discovered',
    });
  });

  test('discovers the default IWAD path through an injected Bun-compatible existence probe', async () => {
    const probedPaths: string[] = [];
    const defaultIwadPath = 'doom\\DOOM1.WAD';

    const result = await discoverIwadPath({
      defaultIwadPath,
      fileExists: async (iwadPath: string) => {
        probedPaths.push(iwadPath);
        return true;
      },
    });

    expect(probedPaths).toEqual([defaultIwadPath]);
    expect(result).toEqual({
      iwadPath: defaultIwadPath,
      source: 'default-local-reference-bundle',
      status: 'discovered',
    });
  });

  test('returns a deferred missing result when the default IWAD candidate is absent', async () => {
    await expect(
      discoverIwadPath({
        fileExists: async () => false,
      }),
    ).resolves.toEqual({
      iwadPath: null,
      source: 'default-local-reference-bundle',
      status: 'missing',
    });
  });

  test('probes the default IWAD path exactly once when the candidate is absent', async () => {
    const probedPaths: string[] = [];

    const result = await discoverIwadPath({
      fileExists: async (iwadPath: string) => {
        probedPaths.push(iwadPath);
        return false;
      },
    });

    expect(probedPaths).toEqual([DEFAULT_LOCAL_IWAD_PATH]);
    expect(result).toEqual({
      iwadPath: null,
      source: 'default-local-reference-bundle',
      status: 'missing',
    });
  });

  test('treats explicit null requestedIwadPath as no command-line override', async () => {
    const probedPaths: string[] = [];

    const result = await discoverIwadPath({
      fileExists: async (iwadPath: string) => {
        probedPaths.push(iwadPath);
        return true;
      },
      requestedIwadPath: null,
    });

    expect(probedPaths).toEqual([DEFAULT_LOCAL_IWAD_PATH]);
    expect(result).toEqual({
      iwadPath: DEFAULT_LOCAL_IWAD_PATH,
      source: 'default-local-reference-bundle',
      status: 'discovered',
    });
  });

  test('honours a custom defaultIwadPath override different from the locked constant', async () => {
    const probedPaths: string[] = [];
    const customDefaultIwadPath = 'iwad\\custom.wad';

    const result = await discoverIwadPath({
      defaultIwadPath: customDefaultIwadPath,
      fileExists: async (iwadPath: string) => {
        probedPaths.push(iwadPath);
        return iwadPath === customDefaultIwadPath;
      },
    });

    expect(customDefaultIwadPath).not.toBe(DEFAULT_LOCAL_IWAD_PATH);
    expect(probedPaths).toEqual([customDefaultIwadPath]);
    expect(result).toEqual({
      iwadPath: customDefaultIwadPath,
      source: 'default-local-reference-bundle',
      status: 'discovered',
    });
  });

  test('preserves an empty-string requestedIwadPath as a command-line override without probing', async () => {
    const blockedProbe: IwadPathExistenceProbe = async () => {
      throw new Error('empty-string command-line override must not probe the default candidate');
    };

    await expect(
      discoverIwadPath({
        fileExists: blockedProbe,
        requestedIwadPath: '',
      }),
    ).resolves.toEqual({
      iwadPath: '',
      source: 'command-line',
      status: 'discovered',
    });
  });

  test('locks the runtime-frozen invariant on the contract and every nested object', () => {
    expect(Object.isFrozen(IMPLEMENT_IWAD_DISCOVERY_CONTRACT)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_IWAD_DISCOVERY_CONTRACT.commandContract)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_IWAD_DISCOVERY_CONTRACT.currentEntrypoint)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_IWAD_DISCOVERY_CONTRACT.currentEntrypoint.helpUsageLines)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_IWAD_DISCOVERY_CONTRACT.deterministicReplayCompatibility)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_IWAD_DISCOVERY_CONTRACT.discovery)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_IWAD_DISCOVERY_CONTRACT.discovery.defaultCandidate)).toBe(true);
  });
});

function assertObject(value: unknown, label: string): asserts value is object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertHelpUsageLines(value: unknown): asserts value is ImplementIwadDiscoveryContract['currentEntrypoint']['helpUsageLines'] {
  assertStringArray(value, 'currentEntrypoint.helpUsageLines');

  if (value.length !== 2 || value[0] !== 'bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]' || value[1] !== 'bun run start -- [--iwad <path-to-iwad>] --list-maps') {
    throw new Error('currentEntrypoint.helpUsageLines must match the audited launcher usage lines');
  }
}

function assertStringArray(value: unknown, label: string): asserts value is readonly string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`${label} must be a string array`);
  }
}

function assertStringLiteral<const ExpectedValue extends string>(value: unknown, expectedValue: ExpectedValue, label: string): asserts value is ExpectedValue {
  if (value !== expectedValue) {
    throw new Error(`${label} must be ${expectedValue}`);
  }
}

function commandFromContract(contract: ImplementIwadDiscoveryContract): string {
  return `${contract.commandContract.program} ${contract.commandContract.subcommand} ${contract.commandContract.entryFile}`;
}

function readCurrentEntrypoint(value: unknown): ImplementIwadDiscoveryContract['currentEntrypoint'] {
  assertObject(value, 'currentEntrypoint');

  const command = Reflect.get(value, 'command');
  const helpUsageLines = Reflect.get(value, 'helpUsageLines');
  const path = Reflect.get(value, 'path');
  const scriptName = Reflect.get(value, 'scriptName');
  const sourceCatalogId = Reflect.get(value, 'sourceCatalogId');

  assertStringLiteral(command, 'bun run src/main.ts', 'currentEntrypoint.command');
  assertHelpUsageLines(helpUsageLines);
  assertStringLiteral(path, 'src/main.ts', 'currentEntrypoint.path');
  assertStringLiteral(scriptName, 'start', 'currentEntrypoint.scriptName');
  assertStringLiteral(sourceCatalogId, 'S-FPS-011', 'currentEntrypoint.sourceCatalogId');

  return {
    command,
    helpUsageLines,
    path,
    scriptName,
    sourceCatalogId,
  };
}

async function readAuditManifest(): Promise<{
  readonly currentEntrypoint: ImplementIwadDiscoveryContract['currentEntrypoint'];
  readonly schemaVersion: unknown;
  readonly targetCommand: unknown;
}> {
  const manifest = await readJsonObject(AUDIT_MANIFEST_PATH);

  return {
    currentEntrypoint: readCurrentEntrypoint(Reflect.get(manifest, 'currentEntrypoint')),
    schemaVersion: Reflect.get(manifest, 'schemaVersion'),
    targetCommand: Reflect.get(manifest, 'targetCommand'),
  };
}

async function readJsonObject(path: string): Promise<object> {
  const value: unknown = await Bun.file(path).json();

  assertObject(value, path);

  return value;
}

function readObjectProperty(record: object, propertyName: string, label: string): object {
  const value = Reflect.get(record, propertyName);

  assertObject(value, label);

  return value;
}

function sha256(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(value);

  return hasher.digest('hex');
}
