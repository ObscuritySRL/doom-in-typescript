import { describe, expect, test } from 'bun:test';

import { createLauncherSession, loadLauncherResources } from '../../../src/launcher/session.ts';
import { ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT, enforceGameTickOrder } from '../../../src/playable/game-session-wiring/enforceGameTickOrder.ts';

const EXPECTED_SOURCE_HASH = 'fad7b92b11e5151d1304a2bbeb05af634b300d96896d27cda78661b39c84a246';
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

    const auditManifest = parseAuditManifest(await Bun.file(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.auditManifest.path).json());

    expect(auditManifest.schemaVersion).toBe(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.auditManifest.schemaVersion);
    expect(auditManifest.stepId).toBe(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.auditManifest.stepId);
    expect(auditManifest.commandContracts.targetRuntime.command).toBe(ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.command);
  });

  test('locks the implementation source hash', async () => {
    const sourceHash = new Bun.CryptoHasher('sha256');
    sourceHash.update(await Bun.file(SOURCE_PATH).arrayBuffer());

    expect(sourceHash.digest('hex')).toBe(EXPECTED_SOURCE_HASH);
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
    expect(result.replayLevelTime).toBe(1);
    expect(result.session).toBe(session);
    expect(session.levelTime).toBe(1);
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
