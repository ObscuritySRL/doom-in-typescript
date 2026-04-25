import { describe, expect, test } from 'bun:test';

import { IMPLEMENT_STARTUP_LOGGING_CONTRACT, implementStartupLogging } from '../../../src/playable/bun-runtime-entry-point/implementStartupLogging.ts';

type AuditManifest = {
  readonly currentEntrypoint: {
    readonly command: string;
    readonly path: string;
    readonly scriptName: string;
  };
  readonly schemaVersion: number;
  readonly stepId: string;
};

type PackageJson = {
  readonly scripts: {
    readonly start: string;
  };
};

function createContractHash(): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(IMPLEMENT_STARTUP_LOGGING_CONTRACT)).digest('hex');
}

describe('implementStartupLogging', () => {
  test('exports the exact startup logging contract', () => {
    expect(IMPLEMENT_STARTUP_LOGGING_CONTRACT).toEqual({
      currentLauncherSurface: {
        command: 'bun run src/main.ts',
        path: 'src/main.ts',
        scriptName: 'start',
        startupLogLines: ['Launching ${session.mapName} from ${resources.iwadPath}', 'Opening gameplay window. Use Tab to switch to the automap.'],
        startupStage: 'after-createLauncherSession-before-runLauncherWindow',
      },
      deterministicReplayCompatibility: {
        consumesReplayInput: false,
        mutatesGameState: false,
        mutatesGlobalRandomSeed: false,
        opensWindowHost: false,
        stage: 'startup-logging-only',
      },
      logTemplates: {
        launchPrefix: 'Launching ',
        launchSeparator: ' from ',
        windowOpenLine: 'Opening gameplay window. Use Tab to switch to the automap.',
      },
      runtimeTarget: {
        command: 'bun run doom.ts',
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
      },
      stepId: '03-014',
      stepTitle: 'implement-startup-logging',
      unsupportedCurrentCommand: 'bun run src/main.ts',
    });
    expect(createContractHash()).toBe('ab78fe24b6c1029694b104101168a7278253e4f0a2b8cbadee8672407ade5f2c');
  });

  test('locks the audited current launcher transition and package script evidence', async () => {
    const auditManifest = (await Bun.file('plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json').json()) as AuditManifest;
    const packageJson = (await Bun.file('package.json').json()) as PackageJson;
    const mainSource = await Bun.file('src/main.ts').text();

    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.stepId).toBe('01-007');
    expect(auditManifest.currentEntrypoint.command).toBe(IMPLEMENT_STARTUP_LOGGING_CONTRACT.currentLauncherSurface.command);
    expect(auditManifest.currentEntrypoint.path).toBe(IMPLEMENT_STARTUP_LOGGING_CONTRACT.currentLauncherSurface.path);
    expect(auditManifest.currentEntrypoint.scriptName).toBe(IMPLEMENT_STARTUP_LOGGING_CONTRACT.currentLauncherSurface.scriptName);
    expect(packageJson.scripts.start).toBe(IMPLEMENT_STARTUP_LOGGING_CONTRACT.unsupportedCurrentCommand);
    expect(mainSource).toContain('console.log(`Launching ${session.mapName} from ${resources.iwadPath}`);');
    expect(mainSource).toContain("console.log('Opening gameplay window. Use Tab to switch to the automap.');");
  });

  test('formats the Bun runtime startup log lines without touching replay state', () => {
    expect(
      implementStartupLogging({
        command: 'bun run doom.ts',
        iwadPath: 'doom\\DOOM1.WAD',
        mapName: 'E1M1',
      }),
    ).toEqual({
      command: 'bun run doom.ts',
      logLines: ['Launching E1M1 from doom\\DOOM1.WAD', 'Opening gameplay window. Use Tab to switch to the automap.'],
    });
    expect(IMPLEMENT_STARTUP_LOGGING_CONTRACT.deterministicReplayCompatibility).toEqual({
      consumesReplayInput: false,
      mutatesGameState: false,
      mutatesGlobalRandomSeed: false,
      opensWindowHost: false,
      stage: 'startup-logging-only',
    });
  });

  test('rejects unsupported commands and empty startup inputs', () => {
    expect(() =>
      implementStartupLogging({
        command: 'bun run src/main.ts',
        iwadPath: 'doom\\DOOM1.WAD',
        mapName: 'E1M1',
      }),
    ).toThrow('Startup logging requires bun run doom.ts, got "bun run src/main.ts".');

    expect(() =>
      implementStartupLogging({
        command: 'bun run doom.ts',
        iwadPath: '',
        mapName: 'E1M1',
      }),
    ).toThrow('Startup logging requires a non-empty iwadPath.');
  });
});
