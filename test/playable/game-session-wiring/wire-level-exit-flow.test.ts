import { describe, expect, test } from 'bun:test';

import { loadLauncherResources } from '../../../src/launcher/session.ts';
import { WIRE_LEVEL_EXIT_FLOW_COMMAND_CONTRACT, wireLevelExitFlow } from '../../../src/playable/game-session-wiring/wireLevelExitFlow.ts';

interface AuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly command: string;
      readonly entryFile: string;
      readonly implementedInReadScope: boolean;
    };
  };
  readonly currentLauncherSurface: {
    readonly defaults: {
      readonly mapName: string;
      readonly scale: number;
      readonly skill: number;
    };
  };
  readonly schemaVersion: number;
  readonly stepId: string;
  readonly stepTitle: string;
}

const IMPLEMENTATION_PATH = 'src/playable/game-session-wiring/wireLevelExitFlow.ts';
const IWAD_PATH = 'doom/DOOM1.WAD';
const SOURCE_SHA256 = '6b8b6b5ec40c6808832370204a98e6b2ccbf04374afba7bc19cf4bfa380c4725';

describe('wireLevelExitFlow', () => {
  test('locks the exact Bun command contract and audit linkage', async () => {
    expect(WIRE_LEVEL_EXIT_FLOW_COMMAND_CONTRACT).toEqual({
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      program: 'bun',
      subcommand: 'run',
    });

    const manifest = await readAuditManifest();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.stepId).toBe('01-009');
    expect(manifest.stepTitle).toBe('audit-missing-menu-to-e1m1');
    expect(manifest.commandContracts.targetRuntime).toEqual({
      command: WIRE_LEVEL_EXIT_FLOW_COMMAND_CONTRACT.command,
      entryFile: WIRE_LEVEL_EXIT_FLOW_COMMAND_CONTRACT.entryFile,
      implementedInReadScope: false,
    });
    expect(manifest.currentLauncherSurface.defaults).toEqual({
      mapName: 'E1M1',
      scale: 2,
      skill: 2,
    });
  });

  test('locks the formatted implementation source hash', async () => {
    const source = await Bun.file(IMPLEMENTATION_PATH).text();

    expect(sha256Hex(source)).toBe(SOURCE_SHA256);
  });

  test('transitions from E1M1 to E1M2 only during TryRunTics and renders the next map', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    const result = wireLevelExitFlow(resources, {
      command: 'bun run doom.ts',
    });

    expect(result).toEqual({
      commandContract: {
        command: 'bun run doom.ts',
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
      },
      currentMapName: 'E1M1',
      framebufferByteLength: 64_000,
      frameCount: 1,
      levelTime: {
        currentAfterExit: 1,
        currentBeforeExit: 0,
        nextAfterExit: 0,
      },
      nextMapName: 'E1M2',
      phaseTrace: ['startFrame', 'tryRunTics', 'updateSounds', 'display'],
      preLoopTrace: ['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop'],
      renderedMapName: 'E1M2',
      transition: {
        fromMapName: 'E1M1',
        phase: 'tryRunTics',
        reason: 'level-exit',
        toMapName: 'E1M2',
      },
    });
  });

  test('rejects non-target runtime commands before mutating replay state', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    expect(() =>
      wireLevelExitFlow(resources, {
        command: 'bun run src/main.ts',
      }),
    ).toThrow('wireLevelExitFlow requires bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects unavailable and self-targeting level exits', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    expect(() =>
      wireLevelExitFlow(resources, {
        command: 'bun run doom.ts',
        nextMapName: 'E5M1',
      }),
    ).toThrow('map E5M1 is not available in IWAD resources');

    expect(() =>
      wireLevelExitFlow(resources, {
        command: 'bun run doom.ts',
        nextMapName: 'E1M1',
      }),
    ).toThrow('level exit flow requires distinct maps, got E1M1');
  });

  test('normalizes lowercase and mixed-case map names to uppercase before validating availability', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    const result = wireLevelExitFlow(resources, {
      command: 'bun run doom.ts',
      currentMapName: 'e1m1',
      nextMapName: 'E1m2',
    });

    expect(result.currentMapName).toBe('E1M1');
    expect(result.nextMapName).toBe('E1M2');
    expect(result.renderedMapName).toBe('E1M2');
    expect(result.transition).toEqual({
      fromMapName: 'E1M1',
      phase: 'tryRunTics',
      reason: 'level-exit',
      toMapName: 'E1M2',
    });
  });

  test('rejects empty current and next map name overrides', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    expect(() =>
      wireLevelExitFlow(resources, {
        command: 'bun run doom.ts',
        currentMapName: '',
      }),
    ).toThrow('map name must not be empty');

    expect(() =>
      wireLevelExitFlow(resources, {
        command: 'bun run doom.ts',
        nextMapName: '',
      }),
    ).toThrow('map name must not be empty');
  });

  test('deep-freezes the result and its replay-evidence sub-objects', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    const result = wireLevelExitFlow(resources, {
      command: 'bun run doom.ts',
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.commandContract)).toBe(true);
    expect(Object.isFrozen(result.levelTime)).toBe(true);
    expect(Object.isFrozen(result.phaseTrace)).toBe(true);
    expect(Object.isFrozen(result.preLoopTrace)).toBe(true);
    expect(Object.isFrozen(result.transition)).toBe(true);
  });
});

async function readAuditManifest(): Promise<AuditManifest> {
  const manifest: unknown = JSON.parse(await Bun.file('plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json').text());

  if (!isAuditManifest(manifest)) {
    throw new Error('01-009 audit manifest does not match the expected schema');
  }

  return manifest;
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;
  const currentLauncherSurface = value.currentLauncherSurface;

  return (
    isRecord(commandContracts) &&
    isRecord(commandContracts.targetRuntime) &&
    typeof commandContracts.targetRuntime.command === 'string' &&
    typeof commandContracts.targetRuntime.entryFile === 'string' &&
    typeof commandContracts.targetRuntime.implementedInReadScope === 'boolean' &&
    isRecord(currentLauncherSurface) &&
    isRecord(currentLauncherSurface.defaults) &&
    typeof currentLauncherSurface.defaults.mapName === 'string' &&
    typeof currentLauncherSurface.defaults.scale === 'number' &&
    typeof currentLauncherSurface.defaults.skill === 'number' &&
    typeof value.schemaVersion === 'number' &&
    typeof value.stepId === 'string' &&
    typeof value.stepTitle === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(value);

  return hasher.digest('hex');
}
