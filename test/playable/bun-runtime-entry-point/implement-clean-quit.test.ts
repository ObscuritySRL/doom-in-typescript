import { describe, expect, test } from 'bun:test';

import { IMPLEMENT_CLEAN_QUIT_CONTRACT, implementCleanQuit } from '../../../src/playable/bun-runtime-entry-point/implementCleanQuit.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';
const PACKAGE_JSON_PATH = 'package.json';
const SRC_MAIN_PATH = 'src/main.ts';

type AuditManifest = Readonly<{
  currentEntrypoint: Readonly<{
    command: string;
    path: string;
    scriptName: string;
  }>;
  schemaVersion: number;
  stepId: string;
  targetCommand: Readonly<{
    command: string;
    entryFile: string;
    status: string;
    workspacePath: string;
  }>;
}>;

type PackageJson = Readonly<{
  scripts: Readonly<{
    start: string;
  }>;
}>;

const EXPECTED_CONTRACT = {
  cleanQuitBehavior: {
    acceptedReasons: ['escape-key', 'window-close', 'launcher-complete'],
    exitCode: 0,
    fatalErrorPath: 'deferred-to-03-013',
    processExitCall: 'not-used-for-clean-quit',
    resultState: 'cleanly-quit',
  },
  currentLauncherTransition: {
    auditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    auditSchemaVersion: 1,
    currentCommand: 'bun run src/main.ts',
    currentEntryPath: 'src/main.ts',
    currentScriptName: 'start',
    helpQuitBinding: 'Esc: quit',
    launcherAwaitSurface: 'await runLauncherWindow(session, { scale, title })',
  },
  deterministicReplayCompatibility: {
    consumesReplayInput: false,
    dependsOnWallClock: false,
    mutatesGameState: false,
    mutatesGlobalRandomSeed: false,
    mutatesSimulationState: false,
    recordsInputTrace: false,
  },
  stepId: '03-012',
  stepTitleSlug: 'implement-clean-quit',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
} as const;

const EXPECTED_CONTRACT_HASH = '2f2cf3bb903ea7c98665b96d70406b0a5be2721a11703787351224729e6d9f7f';

function calculateSha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value) || !isRecord(value.currentEntrypoint) || !isRecord(value.targetCommand)) {
    return false;
  }

  return (
    typeof value.schemaVersion === 'number' &&
    typeof value.stepId === 'string' &&
    typeof value.currentEntrypoint.command === 'string' &&
    typeof value.currentEntrypoint.path === 'string' &&
    typeof value.currentEntrypoint.scriptName === 'string' &&
    typeof value.targetCommand.command === 'string' &&
    typeof value.targetCommand.entryFile === 'string' &&
    typeof value.targetCommand.status === 'string' &&
    typeof value.targetCommand.workspacePath === 'string'
  );
}

function isPackageJson(value: unknown): value is PackageJson {
  return isRecord(value) && isRecord(value.scripts) && typeof value.scripts.start === 'string';
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

describe('implement clean quit contract', () => {
  test('locks the exact clean quit contract value and hash', () => {
    expect(IMPLEMENT_CLEAN_QUIT_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(calculateSha256Hex(JSON.stringify(IMPLEMENT_CLEAN_QUIT_CONTRACT))).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('reconstructs the target Bun command contract', () => {
    const commandParts = [IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.program, IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.subcommand, IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.entryFile];

    expect(commandParts.join(' ')).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.command);
    expect(IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.command).toBe('bun run doom.ts');
  });

  test('cross-checks the audited current launcher transition', async () => {
    const auditManifest = await loadAuditManifest();
    const packageJson = await loadPackageJson();
    const sourceText = await Bun.file(SRC_MAIN_PATH).text();

    expect(auditManifest.schemaVersion).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.currentLauncherTransition.auditSchemaVersion);
    expect(auditManifest.stepId).toBe('01-007');
    expect(auditManifest.currentEntrypoint.command).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.currentLauncherTransition.currentCommand);
    expect(auditManifest.currentEntrypoint.path).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.currentLauncherTransition.currentEntryPath);
    expect(auditManifest.currentEntrypoint.scriptName).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.currentLauncherTransition.currentScriptName);
    expect(auditManifest.targetCommand.command).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.command);
    expect(auditManifest.targetCommand.entryFile).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.entryFile);
    expect(auditManifest.targetCommand.status).toBe('missing-from-current-launcher-surface');
    expect(auditManifest.targetCommand.workspacePath).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.entryFile);
    expect(packageJson.scripts.start).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.currentLauncherTransition.currentCommand);
    expect(sourceText).toContain(IMPLEMENT_CLEAN_QUIT_CONTRACT.currentLauncherTransition.helpQuitBinding);
    expect(sourceText).toContain('await runLauncherWindow(session, {');
    expect(sourceText).toContain('process.exit(1)');
  });

  test('returns a clean zero-exit result for every accepted reason', () => {
    for (const acceptedReason of IMPLEMENT_CLEAN_QUIT_CONTRACT.cleanQuitBehavior.acceptedReasons) {
      expect(implementCleanQuit(IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.command, acceptedReason)).toEqual({
        command: 'bun run doom.ts',
        exitCode: 0,
        processExitCall: 'not-used-for-clean-quit',
        reason: acceptedReason,
        resultState: 'cleanly-quit',
      });
    }
  });

  test('rejects empty, whitespace, and altered runtime commands', () => {
    const unsupportedRuntimeCommands = ['', ' ', 'bun run src/main.ts', 'bun run doom.ts --demo DEMO1', 'BUN run doom.ts'];

    for (const unsupportedRuntimeCommand of unsupportedRuntimeCommands) {
      expect(() => implementCleanQuit(unsupportedRuntimeCommand, 'escape-key')).toThrow(`Clean quit is only wired for bun run doom.ts, got "${unsupportedRuntimeCommand}".`);
    }
  });

  test('keeps clean quit deterministic replay neutral', () => {
    expect(IMPLEMENT_CLEAN_QUIT_CONTRACT.deterministicReplayCompatibility).toEqual({
      consumesReplayInput: false,
      dependsOnWallClock: false,
      mutatesGameState: false,
      mutatesGlobalRandomSeed: false,
      mutatesSimulationState: false,
      recordsInputTrace: false,
    });
  });
});
