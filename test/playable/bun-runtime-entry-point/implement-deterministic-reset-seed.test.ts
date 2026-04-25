import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { DEFAULT_DETERMINISTIC_RESET_SEED, deterministicResetSeedContract, implementDeterministicResetSeed } from '../../../src/playable/bun-runtime-entry-point/implementDeterministicResetSeed.ts';

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
    readonly status: string;
  };
};

type PackageJson = {
  readonly scripts: {
    readonly start: string;
  };
};

function assertAuditManifest(value: unknown): asserts value is AuditManifest {
  if (typeof value !== 'object' || value === null || !('currentEntrypoint' in value) || !('schemaVersion' in value) || !('stepId' in value) || !('targetCommand' in value)) {
    throw new Error('Expected 01-007 audit manifest data.');
  }
}

function assertPackageJson(value: unknown): asserts value is PackageJson {
  if (typeof value !== 'object' || value === null || !('scripts' in value) || typeof value.scripts !== 'object' || value.scripts === null || !('start' in value.scripts)) {
    throw new Error('Expected package.json start script data.');
  }
}

async function loadAuditManifest(): Promise<AuditManifest> {
  const rawManifest = await Bun.file('plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json').json();

  assertAuditManifest(rawManifest);

  return rawManifest;
}

async function loadPackageJson(): Promise<PackageJson> {
  const rawPackageJson = await Bun.file('package.json').json();

  assertPackageJson(rawPackageJson);

  return rawPackageJson;
}

describe('implementDeterministicResetSeed', () => {
  test('exports the exact deterministic reset seed contract', () => {
    expect(deterministicResetSeedContract).toEqual({
      auditedCurrentLauncher: {
        command: 'bun run src/main.ts',
        entrypointPath: 'src/main.ts',
        scriptName: 'start',
        transition: 'src-main-direct-to-runLauncherWindow',
      },
      deterministicReplayCompatibility: {
        mutatesGameplayState: false,
        mutatesGlobalRandomSeedDirectly: false,
        replayConsumesInput: false,
        resetSeedValue: 0,
        resetsBeforeReplayInput: true,
      },
      implementation: {
        helperName: 'implementDeterministicResetSeed',
        stepId: '03-015',
        surface: 'bun-run-playable-parity',
      },
      runtimeCommand: {
        command: 'bun run doom.ts',
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
      },
      targetReset: {
        resetApplied: true,
        resetSeedValue: 0,
        resetTiming: 'before-title-loop',
      },
    });
  });

  test('keeps a stable contract hash', () => {
    const contractHash = createHash('sha256').update(JSON.stringify(deterministicResetSeedContract)).digest('hex');

    expect(contractHash).toBe('5380c066ce8169e38a9d0d492c1a15f26c5ce68c24a4a1f9b3106cbb99067012');
  });

  test('reconstructs the Bun runtime command and default reset seed', () => {
    const { command, entryFile, program, subcommand } = deterministicResetSeedContract.runtimeCommand;

    expect(`${program} ${subcommand} ${entryFile}`).toBe(command);
    expect(DEFAULT_DETERMINISTIC_RESET_SEED).toBe(0);
    expect(deterministicResetSeedContract.targetReset.resetSeedValue).toBe(DEFAULT_DETERMINISTIC_RESET_SEED);
  });

  test('matches the audited missing-root-entrypoint manifest and current package script', async () => {
    const auditManifest = await loadAuditManifest();
    const packageJson = await loadPackageJson();
    const mainSource = await Bun.file('src/main.ts').text();

    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.stepId).toBe('01-007');
    expect(auditManifest.currentEntrypoint.command).toBe(deterministicResetSeedContract.auditedCurrentLauncher.command);
    expect(auditManifest.currentEntrypoint.path).toBe(deterministicResetSeedContract.auditedCurrentLauncher.entrypointPath);
    expect(auditManifest.currentEntrypoint.scriptName).toBe(deterministicResetSeedContract.auditedCurrentLauncher.scriptName);
    expect(auditManifest.targetCommand.command).toBe(deterministicResetSeedContract.runtimeCommand.command);
    expect(auditManifest.targetCommand.status).toBe('missing-from-current-launcher-surface');
    expect(packageJson.scripts.start).toBe(deterministicResetSeedContract.auditedCurrentLauncher.command);
    expect(mainSource).toContain("import { runLauncherWindow } from './launcher/win32.ts';");
    expect(mainSource).toContain('await runLauncherWindow(session, {');
  });

  test('returns the deterministic reset plan only for the Bun runtime path', () => {
    expect(implementDeterministicResetSeed('bun run doom.ts')).toEqual({
      resetApplied: true,
      resetSeedValue: 0,
      resetTiming: 'before-title-loop',
      runtimeCommand: 'bun run doom.ts',
    });
  });

  test('rejects non-Bun-runtime commands', () => {
    expect(() => implementDeterministicResetSeed('bun run src/main.ts')).toThrow('implementDeterministicResetSeed only supports bun run doom.ts, got "bun run src/main.ts".');
  });
});
