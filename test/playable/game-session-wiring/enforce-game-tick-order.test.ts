import { describe, expect, test } from 'bun:test';

import { EMPTY_LAUNCHER_INPUT, createLauncherSession, loadLauncherResources } from '../../../src/launcher/session.ts';
import { ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT, enforceGameTickOrder } from '../../../src/playable/game-session-wiring/enforceGameTickOrder.ts';

const EXPECTED_SOURCE_HASH = '0060e275637611eca102b80a91ad68b32a9da39180a6dda5f8456cd32019cf25';
const SOURCE_PATH = 'src/playable/game-session-wiring/enforceGameTickOrder.ts';

describe('enforceGameTickOrder', () => {
  test('locks the exact runtime contract and audit manifest schema linkage', async () => {
    expect(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT).toEqual({
      auditManifest: {
        path: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
        schemaVersion: 1,
        stepId: '01-009',
        stepTitle: 'audit-missing-menu-to-e1m1',
      },
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      stepId: '08-004',
      stepTitle: 'enforce-game-tick-order',
    });
    expect(Object.isFrozen(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT)).toBe(true);

    const auditManifest = parseAuditManifest(await Bun.file(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.auditManifest.path).json());

    expect(auditManifest.schemaVersion).toBe(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.auditManifest.schemaVersion);
    expect(auditManifest.stepId).toBe(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.auditManifest.stepId);
    expect(auditManifest.commandContracts.targetRuntime.command).toBe(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.command);
  });

  test('locks the implementation source hash', async () => {
    const sourceHash = new Bun.CryptoHasher('sha256').update(await Bun.file(SOURCE_PATH).bytes()).digest('hex');

    expect(sourceHash).toBe(EXPECTED_SOURCE_HASH);
  });

  test('advances gameplay only inside the canonical frame tick order', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });
    const playerObject = session.player.mo;

    expect(playerObject).not.toBeNull();

    const result = enforceGameTickOrder({
      command: 'bun run doom.ts',
      session,
    });

    expect(result.orderedPhases).toEqual(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop', 'startFrame', 'tryRunTics', 'updateSounds', 'display']);
    expect(result.advancedTics).toBe(1);
    expect(result.frameCount).toBe(1);
    expect(result.framebuffer.length).toBe(320 * 200);
    expect(result.framebuffer).toBe(session.framebuffer);
    expect(result.replayLevelTime).toBe(1);
    expect(result.session).toBe(session);
    expect(session.levelTime).toBe(1);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.orderedPhases)).toBe(true);
  });

  test('treats an explicit empty input state identically to the default', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const sessionA = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });
    const sessionB = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });

    const defaultResult = enforceGameTickOrder({
      command: 'bun run doom.ts',
      session: sessionA,
    });
    const explicitResult = enforceGameTickOrder({
      command: 'bun run doom.ts',
      inputState: EMPTY_LAUNCHER_INPUT,
      session: sessionB,
    });

    const playerA = sessionA.player.mo;
    const playerB = sessionB.player.mo;

    expect(playerA).not.toBeNull();
    expect(playerB).not.toBeNull();
    if (playerA === null || playerB === null) {
      throw new Error('expected both sessions to have spawned a player mobj');
    }

    expect(explicitResult.orderedPhases).toEqual(defaultResult.orderedPhases);
    expect(explicitResult.advancedTics).toBe(defaultResult.advancedTics);
    expect(explicitResult.replayLevelTime).toBe(defaultResult.replayLevelTime);
    expect(sessionB.levelTime).toBe(sessionA.levelTime);
    expect(playerB.x).toBe(playerA.x);
    expect(playerB.y).toBe(playerA.y);
    expect(playerB.angle).toBe(playerA.angle);
    expect(sessionB.showAutomap).toBe(sessionA.showAutomap);
  });

  test('rejects the old package start command', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });

    expect(() =>
      enforceGameTickOrder({
        command: 'bun run src/main.ts',
        session,
      }),
    ).toThrow('Expected runtime command bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects an empty runtime command', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });

    expect(() =>
      enforceGameTickOrder({
        command: '',
        session,
      }),
    ).toThrow('Expected runtime command bun run doom.ts, got ');
  });
});

interface AuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly command: string;
    };
  };
  readonly schemaVersion: number;
  readonly stepId: string;
}

function parseAuditManifest(value: unknown): AuditManifest {
  if (!isRecord(value)) {
    throw new Error('audit manifest must be an object');
  }

  const commandContracts = value.commandContracts;
  const schemaVersion = value.schemaVersion;
  const stepId = value.stepId;

  if (!isRecord(commandContracts) || typeof schemaVersion !== 'number' || typeof stepId !== 'string') {
    throw new Error('audit manifest is missing required top-level fields');
  }

  const targetRuntime = commandContracts.targetRuntime;

  if (!isRecord(targetRuntime) || typeof targetRuntime.command !== 'string') {
    throw new Error('audit manifest is missing targetRuntime command');
  }

  return {
    commandContracts: {
      targetRuntime: {
        command: targetRuntime.command,
      },
    },
    schemaVersion,
    stepId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
