import { describe, expect, test } from 'bun:test';

import { wireBunTestIntegrationContract } from '../../../src/playable/bun-runtime-entry-point/wireBunTestIntegration.ts';

type AuditManifest = {
  readonly currentEntrypoint: typeof wireBunTestIntegrationContract.currentLauncherTransition;
  readonly schemaVersion: number;
  readonly stepId: string;
  readonly targetCommand: {
    readonly command: string;
    readonly entryFile: string;
    readonly workspacePath: string;
  };
  readonly workspace: {
    readonly packageName: string;
    readonly packageType: string;
  };
};

type PackageManifest = {
  readonly name: string;
  readonly scripts: {
    readonly start: string;
  };
  readonly type: string;
};

const EXPECTED_CONTRACT = {
  bunTestRunner: {
    focusedVerificationCommand: 'bun test test/playable/bun-runtime-entry-point/wire-bun-test-integration.test.ts',
    fullVerificationCommand: 'bun test',
    moduleSpecifier: 'bun:test',
    runner: 'bun test',
    status: 'wired-through-bun-test-runner',
  },
  commandContract: {
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    targetCommand: 'bun run doom.ts',
    workspacePath: 'doom.ts',
  },
  currentLauncherTransition: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    gameStateMutation: 'none',
    replayInputDependency: 'none',
    replayTimingDependency: 'none',
    scope: 'test-runner-contract-only',
  },
  forbiddenTestRunners: ['jest', 'mocha', 'vitest'],
  manifestAuthority: {
    path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    schemaVersion: 1,
    stepIdentifier: '01-007',
  },
  packageScriptEvidence: {
    currentStartScript: 'bun run src/main.ts',
    packageName: 'doom-codex',
    packageType: 'module',
  },
  stepIdentifier: '03-006',
  stepTitleSlug: 'wire-bun-test-integration',
} satisfies typeof wireBunTestIntegrationContract;

describe('wireBunTestIntegrationContract', () => {
  test('locks the exact Bun test integration contract', () => {
    expect(wireBunTestIntegrationContract).toEqual(EXPECTED_CONTRACT);
  });

  test('reconstructs the target command from Bun runtime parts', () => {
    const commandContract = wireBunTestIntegrationContract.commandContract;

    expect(`${commandContract.program} ${commandContract.subcommand} ${commandContract.entryFile}`).toBe(commandContract.targetCommand);
    expect(wireBunTestIntegrationContract.bunTestRunner.runner).toBe('bun test');
    expect(wireBunTestIntegrationContract.bunTestRunner.moduleSpecifier).toBe('bun:test');
    expect(wireBunTestIntegrationContract.forbiddenTestRunners).toEqual(['jest', 'mocha', 'vitest']);
  });

  test('matches the 01-007 audit manifest schema and launch transition', async () => {
    const manifest = await readAuditManifest(wireBunTestIntegrationContract.manifestAuthority.path);

    expect(manifest.schemaVersion).toBe(wireBunTestIntegrationContract.manifestAuthority.schemaVersion);
    expect(manifest.stepId).toBe(wireBunTestIntegrationContract.manifestAuthority.stepIdentifier);
    expect(manifest.currentEntrypoint).toEqual(wireBunTestIntegrationContract.currentLauncherTransition);
    expect(manifest.targetCommand.command).toBe(wireBunTestIntegrationContract.commandContract.targetCommand);
    expect(manifest.targetCommand.entryFile).toBe(wireBunTestIntegrationContract.commandContract.entryFile);
    expect(manifest.targetCommand.workspacePath).toBe(wireBunTestIntegrationContract.commandContract.workspacePath);
    expect(manifest.workspace.packageName).toBe(wireBunTestIntegrationContract.packageScriptEvidence.packageName);
    expect(manifest.workspace.packageType).toBe(wireBunTestIntegrationContract.packageScriptEvidence.packageType);
  });

  test('matches live package and launcher evidence without adding non-Bun test runners', async () => {
    const packageManifest = await readPackageManifest('package.json');
    const sourceText = await Bun.file('src/main.ts').text();

    expect(packageManifest.name).toBe(wireBunTestIntegrationContract.packageScriptEvidence.packageName);
    expect(packageManifest.scripts.start).toBe(wireBunTestIntegrationContract.packageScriptEvidence.currentStartScript);
    expect(packageManifest.type).toBe(wireBunTestIntegrationContract.packageScriptEvidence.packageType);
    expect(sourceText).toContain(wireBunTestIntegrationContract.currentLauncherTransition.helpUsageLines[0]);
    expect(sourceText).toContain(wireBunTestIntegrationContract.currentLauncherTransition.helpUsageLines[1]);
    expect(sourceText).toContain('new CommandLine(Bun.argv)');
    expect(sourceText).toContain('void main().catch');
    expect(JSON.stringify(packageManifest)).not.toContain('jest');
    expect(JSON.stringify(packageManifest)).not.toContain('mocha');
    expect(JSON.stringify(packageManifest)).not.toContain('vitest');
  });

  test('locks the deterministic replay compatibility hash', () => {
    expect(hashStableJson(wireBunTestIntegrationContract.deterministicReplayCompatibility)).toBe('8d5c2deb6923147c330d0465db230c856dcbac6755ad78aa3e2214867d179800');
  });
});

async function readAuditManifest(path: string): Promise<AuditManifest> {
  const parsedValue: unknown = JSON.parse(await Bun.file(path).text());

  assertAuditManifest(parsedValue);

  return parsedValue;
}

async function readPackageManifest(path: string): Promise<PackageManifest> {
  const parsedValue: unknown = JSON.parse(await Bun.file(path).text());

  assertPackageManifest(parsedValue);

  return parsedValue;
}

function assertAuditManifest(value: unknown): asserts value is AuditManifest {
  if (!isRecord(value)) {
    throw new TypeError('Audit manifest must be an object.');
  }

  if (!isRecord(value.currentEntrypoint)) {
    throw new TypeError('Audit manifest currentEntrypoint must be an object.');
  }

  if (!isRecord(value.targetCommand)) {
    throw new TypeError('Audit manifest targetCommand must be an object.');
  }

  if (!isRecord(value.workspace)) {
    throw new TypeError('Audit manifest workspace must be an object.');
  }
}

function assertPackageManifest(value: unknown): asserts value is PackageManifest {
  if (!isRecord(value)) {
    throw new TypeError('Package manifest must be an object.');
  }

  if (!isRecord(value.scripts)) {
    throw new TypeError('Package manifest scripts must be an object.');
  }
}

function hashStableJson(value: unknown): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(JSON.stringify(value));

  return hasher.digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
