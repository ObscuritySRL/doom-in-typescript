import { describe, expect, test } from 'bun:test';

import { IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT, implementFatalErrorHandling } from '../../../src/playable/bun-runtime-entry-point/implementFatalErrorHandling.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';
const PACKAGE_JSON_PATH = 'package.json';
const SRC_MAIN_PATH = 'src/main.ts';

type AuditManifest = Readonly<{
  currentEntrypoint: Readonly<{
    command: string;
    helpUsageLines: readonly string[];
    path: string;
    scriptName: string;
    sourceCatalogId: string;
  }>;
  schemaVersion: number;
  stepId: string;
  targetCommand: Readonly<{
    command: string;
    entryFile: string;
  }>;
}>;

type PackageJson = Readonly<{
  scripts: Readonly<{
    start: string;
  }>;
}>;

function calculateSha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  if (!isRecord(value.currentEntrypoint) || !isRecord(value.targetCommand)) {
    return false;
  }

  return (
    typeof value.schemaVersion === 'number' &&
    typeof value.stepId === 'string' &&
    typeof value.currentEntrypoint.command === 'string' &&
    isStringArray(value.currentEntrypoint.helpUsageLines) &&
    typeof value.currentEntrypoint.path === 'string' &&
    typeof value.currentEntrypoint.scriptName === 'string' &&
    typeof value.currentEntrypoint.sourceCatalogId === 'string' &&
    typeof value.targetCommand.command === 'string' &&
    typeof value.targetCommand.entryFile === 'string'
  );
}

function isPackageJson(value: unknown): value is PackageJson {
  return isRecord(value) && isRecord(value.scripts) && typeof value.scripts.start === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

async function loadAuditManifest(): Promise<AuditManifest> {
  const manifest = await Bun.file(AUDIT_MANIFEST_PATH).json();

  if (!isAuditManifest(manifest)) {
    throw new Error(`Expected ${AUDIT_MANIFEST_PATH} to match the 01-007 audit manifest shape.`);
  }

  return manifest;
}

async function loadPackageJson(): Promise<PackageJson> {
  const packageJson = await Bun.file(PACKAGE_JSON_PATH).json();

  if (!isPackageJson(packageJson)) {
    throw new Error(`Expected ${PACKAGE_JSON_PATH} to expose scripts.start.`);
  }

  return packageJson;
}

describe('implementFatalErrorHandling', () => {
  test('exports the exact fatal error handling contract', () => {
    expect(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT).toEqual({
      auditedCurrentLauncherSurface: {
        command: 'bun run src/main.ts',
        helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
        path: 'src/main.ts',
        scriptName: 'start',
        sourceCatalogId: 'S-FPS-011',
      },
      commandContract: {
        command: 'bun run doom.ts',
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
      },
      currentLauncherFatalPath: {
        catchWrapper: 'void main().catch((error: unknown) => {',
        exitCall: 'process.exit(1);',
        stderrCall: 'console.error(message);',
      },
      deterministicReplayCompatibility: {
        consumesReplayInput: false,
        mutatesGameState: false,
        mutatesGlobalProcessState: false,
        mutatesRandomSeed: false,
        phase: 'pre-session-launch',
      },
      fatalErrorHandling: {
        exitCode: 1,
        outputStream: 'stderr',
        prefix: 'Fatal error:',
        unknownFallback: 'Unknown fatal error.',
      },
      stepId: '03-013',
      stepTitle: 'implement-fatal-error-handling',
    });
  });

  test('locks the contract hash and reconstructs the bun runtime command', () => {
    expect(calculateSha256Hex(JSON.stringify(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT))).toBe('3148335646ca0fc8e21171fb4e4ee389716b96265748769f7c94aac5b1f745da');
    expect([IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.program, IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.subcommand, IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.entryFile].join(' ')).toBe(
      IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.command,
    );
  });

  test('matches the audited launcher manifest, package script, and source fatal path', async () => {
    const auditManifest = await loadAuditManifest();
    const packageJson = await loadPackageJson();
    const mainText = await Bun.file(SRC_MAIN_PATH).text();

    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.stepId).toBe('01-007');
    expect(auditManifest.currentEntrypoint).toEqual(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.auditedCurrentLauncherSurface);
    expect(auditManifest.targetCommand.command).toBe(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.command);
    expect(auditManifest.targetCommand.entryFile).toBe(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.entryFile);
    expect(packageJson.scripts.start).toBe(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.auditedCurrentLauncherSurface.command);

    for (const helpUsageLine of IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.auditedCurrentLauncherSurface.helpUsageLines) {
      expect(mainText).toContain(helpUsageLine);
    }

    expect(mainText).toContain(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.currentLauncherFatalPath.catchWrapper);
    expect(mainText).toContain(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.currentLauncherFatalPath.stderrCall);
    expect(mainText).toContain(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.currentLauncherFatalPath.exitCall);
  });

  test('formats fatal errors for the Bun runtime path without replay mutation', () => {
    expect(implementFatalErrorHandling(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.command, new Error('IWAD parse failed'))).toEqual({
      auditedCurrentLauncherSurface: IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.auditedCurrentLauncherSurface,
      deterministicReplayCompatibility: IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.deterministicReplayCompatibility,
      exitCode: 1,
      outputStream: 'stderr',
      runtimeCommand: 'bun run doom.ts',
      status: 'fatal-error',
      stderrLine: 'Fatal error: IWAD parse failed',
    });
  });

  test('falls back when the fatal error carries no usable message', () => {
    expect(implementFatalErrorHandling(IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.command, new Error('   '))).toEqual({
      auditedCurrentLauncherSurface: IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.auditedCurrentLauncherSurface,
      deterministicReplayCompatibility: IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.deterministicReplayCompatibility,
      exitCode: 1,
      outputStream: 'stderr',
      runtimeCommand: 'bun run doom.ts',
      status: 'fatal-error',
      stderrLine: 'Fatal error: Unknown fatal error.',
    });
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() => implementFatalErrorHandling('bun run src/main.ts', new Error('boom'))).toThrow('Fatal error handling is only available through bun run doom.ts.');
  });
});
