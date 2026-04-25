import { describe, expect, test } from 'bun:test';

import { IMPLEMENT_CLEAN_QUIT_CONTRACT, implementCleanQuit } from '../../../src/playable/bun-runtime-entry-point/implementCleanQuit.ts';

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
    readonly status: string;
    readonly workspacePath: string;
  };
};

type PackageJson = {
  readonly scripts: {
    readonly start: string;
  };
};

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

describe('implement clean quit contract', () => {
  test('locks the exact clean quit contract value and hash', () => {
    expect(IMPLEMENT_CLEAN_QUIT_CONTRACT).toEqual(EXPECTED_CONTRACT);
    expect(hashJson(IMPLEMENT_CLEAN_QUIT_CONTRACT)).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('reconstructs the target Bun command contract', () => {
    const commandParts = [IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.program, IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.subcommand, IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.entryFile];

    expect(commandParts.join(' ')).toBe(IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.command);
    expect(IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.command).toBe('bun run doom.ts');
  });

  test('cross-checks the audited current launcher transition', async () => {
    const auditManifest = await readAuditManifest();
    const packageJson = await readPackageJson();
    const sourceText = await Bun.file('src/main.ts').text();

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

  test('returns a clean zero-exit result only for the Bun playable command', () => {
    expect(implementCleanQuit('bun run doom.ts', 'escape-key')).toEqual({
      command: 'bun run doom.ts',
      exitCode: 0,
      processExitCall: 'not-used-for-clean-quit',
      reason: 'escape-key',
      resultState: 'cleanly-quit',
    });

    expect(() => implementCleanQuit('bun run src/main.ts', 'escape-key')).toThrow('Clean quit is only wired for bun run doom.ts, got "bun run src/main.ts".');
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

function getRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function hashJson(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

function isAuditManifest(value: unknown): value is AuditManifest {
  const manifestRecord = getRecord(value);
  const currentEntrypoint = getRecord(manifestRecord?.currentEntrypoint);
  const targetCommand = getRecord(manifestRecord?.targetCommand);

  return (
    typeof manifestRecord?.schemaVersion === 'number' &&
    typeof manifestRecord.stepId === 'string' &&
    typeof currentEntrypoint?.command === 'string' &&
    typeof currentEntrypoint.path === 'string' &&
    typeof currentEntrypoint.scriptName === 'string' &&
    typeof targetCommand?.command === 'string' &&
    typeof targetCommand.entryFile === 'string' &&
    typeof targetCommand.status === 'string' &&
    typeof targetCommand.workspacePath === 'string'
  );
}

function isPackageJson(value: unknown): value is PackageJson {
  const packageRecord = getRecord(value);
  const scripts = getRecord(packageRecord?.scripts);

  return typeof scripts?.start === 'string';
}

async function readAuditManifest(): Promise<AuditManifest> {
  const parsedManifest: unknown = JSON.parse(await Bun.file('plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json').text());

  if (!isAuditManifest(parsedManifest)) {
    throw new Error('Invalid 01-007 audit manifest shape.');
  }

  return parsedManifest;
}

async function readPackageJson(): Promise<PackageJson> {
  const parsedPackageJson: unknown = JSON.parse(await Bun.file('package.json').text());

  if (!isPackageJson(parsedPackageJson)) {
    throw new Error('Invalid package.json shape.');
  }

  return parsedPackageJson;
}
