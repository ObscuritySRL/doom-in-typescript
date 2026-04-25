import { describe, expect, test } from 'bun:test';

import { CREATE_GAME_CONTEXT_CONTRACT, createGameContext } from '../../../src/playable/bun-runtime-entry-point/createGameContext.ts';

interface AuditManifest {
  readonly currentEntrypoint: {
    readonly command: 'bun run src/main.ts';
    readonly helpUsageLines: readonly ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'];
    readonly path: 'src/main.ts';
    readonly scriptName: 'start';
    readonly sourceCatalogId: 'S-FPS-011';
  };
  readonly schemaVersion: 1;
  readonly stepId: '01-007';
  readonly targetCommand: {
    readonly command: 'bun run doom.ts';
    readonly entryFile: 'doom.ts';
  };
}

describe('create game context', () => {
  test('locks the exact Bun runtime context contract and hash', () => {
    expect(CREATE_GAME_CONTEXT_CONTRACT).toEqual({
      commandContract: {
        command: 'bun run doom.ts',
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
      },
      contextCreation: {
        defaultMapName: 'E1M1',
        defaultScale: 2,
        defaultSkill: 2,
        ownerStepId: '03-010',
        phase: 'launcher-startup-before-title-loop',
        runtimePath: 'bun-runtime-entry-point',
        surface: 'game-context',
      },
      currentEntrypoint: {
        command: 'bun run src/main.ts',
        helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
        path: 'src/main.ts',
        scriptName: 'start',
        sourceCatalogId: 'S-FPS-011',
      },
      deterministicReplayCompatibility: {
        consumesReplayInput: false,
        createsLauncherSession: false,
        createsWindow: false,
        loadsIwadBytes: false,
        mutatesGameSimulation: false,
        mutatesGlobalState: false,
        replayStateBoundary: 'context-metadata-only-before-title-loop',
      },
      manifestAuthority: {
        auditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
        schemaVersion: 1,
        stepId: '01-007',
      },
    });

    expect(hashJson(CREATE_GAME_CONTEXT_CONTRACT)).toBe('d4854eea3dec1cce18c50210da4390fa69ad20b2278f0a02d8a0597ed9ba0673');
  });

  test('cross-checks the command contract and transition against the 01-007 audit manifest', async () => {
    const auditManifest = await readAuditManifest();

    expect(CREATE_GAME_CONTEXT_CONTRACT.commandContract.command).toBe(auditManifest.targetCommand.command);
    expect(CREATE_GAME_CONTEXT_CONTRACT.commandContract.entryFile).toBe(auditManifest.targetCommand.entryFile);
    expect(CREATE_GAME_CONTEXT_CONTRACT.commandContract.command).toBe(
      `${CREATE_GAME_CONTEXT_CONTRACT.commandContract.program} ${CREATE_GAME_CONTEXT_CONTRACT.commandContract.subcommand} ${CREATE_GAME_CONTEXT_CONTRACT.commandContract.entryFile}`,
    );
    expect(CREATE_GAME_CONTEXT_CONTRACT.currentEntrypoint).toEqual(auditManifest.currentEntrypoint);
    expect(CREATE_GAME_CONTEXT_CONTRACT.manifestAuthority).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
      schemaVersion: auditManifest.schemaVersion,
      stepId: auditManifest.stepId,
    });
  });

  test('creates context metadata without touching launcher session or replay state', () => {
    const gameContext = createGameContext({
      configuration: {
        key_right: '205',
        snd_musicvolume: '8',
      },
      iwadPath: 'doom\\DOOM1.WAD',
      mapName: 'e1m1',
    });

    expect(gameContext).toEqual({
      commandContract: CREATE_GAME_CONTEXT_CONTRACT.commandContract,
      configuration: {
        key_right: '205',
        snd_musicvolume: '8',
      },
      deterministicReplayCompatibility: CREATE_GAME_CONTEXT_CONTRACT.deterministicReplayCompatibility,
      iwadPath: 'doom\\DOOM1.WAD',
      lifecyclePhase: 'context-created-before-title-loop',
      mapName: 'E1M1',
      runtimePath: 'bun-runtime-entry-point',
      scale: 2,
      skill: 2,
    });
  });

  test('rejects missing context inputs before launcher/session creation', () => {
    expect(() =>
      createGameContext({
        iwadPath: '   ',
      }),
    ).toThrow('iwadPath is required to create a game context.');

    expect(() =>
      createGameContext({
        iwadPath: 'doom\\DOOM1.WAD',
        mapName: '',
      }),
    ).toThrow('mapName must not be empty.');
  });

  test('keeps package start evidence aligned with the audited current entrypoint', async () => {
    const auditManifest = await readAuditManifest();
    const packageJson = await Bun.file('package.json').json();

    expect(packageJson.scripts.start).toBe(auditManifest.currentEntrypoint.command);
    expect(CREATE_GAME_CONTEXT_CONTRACT.currentEntrypoint.scriptName).toBe('start');
    expect(CREATE_GAME_CONTEXT_CONTRACT.currentEntrypoint.command).toBe(packageJson.scripts.start);
  });
});

async function readAuditManifest(): Promise<AuditManifest> {
  const auditManifest = await Bun.file('plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json').json();

  if (!isAuditManifest(auditManifest)) {
    throw new Error('01-007 audit manifest shape did not match the create-game-context test contract.');
  }

  return auditManifest;
}

function hashJson(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  return isCurrentEntrypoint(value.currentEntrypoint) && value.schemaVersion === 1 && value.stepId === '01-007' && isTargetCommand(value.targetCommand);
}

function isCurrentEntrypoint(value: unknown): value is AuditManifest['currentEntrypoint'] {
  if (!isRecord(value) || !Array.isArray(value.helpUsageLines)) {
    return false;
  }

  return (
    value.command === 'bun run src/main.ts' &&
    value.helpUsageLines.length === 2 &&
    value.helpUsageLines[0] === 'bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]' &&
    value.helpUsageLines[1] === 'bun run start -- [--iwad <path-to-iwad>] --list-maps' &&
    value.path === 'src/main.ts' &&
    value.scriptName === 'start' &&
    value.sourceCatalogId === 'S-FPS-011'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTargetCommand(value: unknown): value is AuditManifest['targetCommand'] {
  if (!isRecord(value)) {
    return false;
  }

  return value.command === 'bun run doom.ts' && value.entryFile === 'doom.ts';
}
