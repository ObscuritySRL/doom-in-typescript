import { beforeAll, describe, expect, test } from 'bun:test';

import type { LauncherResources } from '../../../src/launcher/session.ts';

import { loadLauncherResources } from '../../../src/launcher/session.ts';
import { WIRE_PLAYER_SPAWN_SESSION_CONTRACT, wirePlayerSpawnSession } from '../../../src/playable/game-session-wiring/wirePlayerSpawnSession.ts';

const IMPLEMENTATION_PATH = 'src/playable/game-session-wiring/wirePlayerSpawnSession.ts';
const EXPECTED_IMPLEMENTATION_SHA256 = 'd44949cc7b5c4bfa0629feb9c2705fa8d3c91af045fcadc31425c896167bd21e';

let launcherResources: LauncherResources;

beforeAll(async () => {
  launcherResources = await loadLauncherResources('doom/DOOM1.WAD');
});

describe('wirePlayerSpawnSession', () => {
  test('locks the runtime contract and implementation hash', async () => {
    expect(WIRE_PLAYER_SPAWN_SESSION_CONTRACT).toEqual({
      audit: {
        manifestPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
        schemaVersion: 1,
        surfaceIdentifier: 'menu-to-e1m1-transition',
      },
      runtimeCommand: 'bun run doom.ts',
      stepIdentifier: '08-003',
      stepTitle: 'wire-player-spawn-session',
    });
    expect(await sha256(IMPLEMENTATION_PATH)).toBe(EXPECTED_IMPLEMENTATION_SHA256);
  });

  test('cross-checks the audit manifest schema and target command', async () => {
    const auditManifest = await Bun.file(WIRE_PLAYER_SPAWN_SESSION_CONTRACT.audit.manifestPath).json();

    expect(auditManifest.schemaVersion).toBe(WIRE_PLAYER_SPAWN_SESSION_CONTRACT.audit.schemaVersion);
    expect(auditManifest.commandContracts.targetRuntime.command).toBe(WIRE_PLAYER_SPAWN_SESSION_CONTRACT.runtimeCommand);
    expect(auditManifest.explicitNullSurfaces).toContainEqual(
      expect.objectContaining({
        surfaceId: WIRE_PLAYER_SPAWN_SESSION_CONTRACT.audit.surfaceIdentifier,
      }),
    );
  });

  test('creates an E1M1 player spawn session without advancing replay state', () => {
    const result = wirePlayerSpawnSession(launcherResources, {
      mapName: 'E1M1',
      runtimeCommand: WIRE_PLAYER_SPAWN_SESSION_CONTRACT.runtimeCommand,
      skill: 2,
    });
    const playerMapObject = result.session.player.mo;

    if (playerMapObject === null) {
      throw new Error('Expected E1M1 player map object.');
    }

    expect(result.playerSpawn).toEqual({
      angle: 90,
      health: 100,
      mapName: 'E1M1',
      spawnOptions: 7,
      spawnType: 1,
      x: 1056,
      y: -3616,
      z: 0,
    });
    expect(result.replayState).toEqual({
      levelTime: 0,
      loopFrameCount: 0,
      loopStarted: false,
    });
    expect(result.mainLoop.frameCount).toBe(0);
    expect(result.mainLoop.started).toBe(false);
    expect(result.runtimeCommand).toBe(WIRE_PLAYER_SPAWN_SESSION_CONTRACT.runtimeCommand);
    expect(result.session.levelTime).toBe(0);
    expect(result.session.mapName).toBe('E1M1');
    expect(result.session.player.mo).toBe(playerMapObject);
  });

  test('rejects non-target runtime commands', () => {
    expect(() =>
      wirePlayerSpawnSession(launcherResources, {
        mapName: 'E1M1',
        runtimeCommand: 'bun run src/main.ts',
        skill: 2,
      }),
    ).toThrow('wire-player-spawn-session requires bun run doom.ts, got bun run src/main.ts');
  });
});

async function sha256(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(await Bun.file(path).arrayBuffer());

  return hasher.digest('hex');
}
