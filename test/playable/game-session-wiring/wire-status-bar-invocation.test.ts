import { describe, expect, test } from 'bun:test';

import { MainLoop } from '../../../src/mainLoop.ts';
import { EMPTY_LAUNCHER_INPUT, createLauncherSession, loadLauncherResources } from '../../../src/launcher/session.ts';
import { WIRE_STATUS_BAR_INVOCATION_CONTRACT, wireStatusBarInvocation } from '../../../src/playable/game-session-wiring/wireStatusBarInvocation.ts';

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
}

const EXPECTED_SOURCE_SHA256 = '97eb9902606dadb5d6341dd0042da33faed18d0d99485f1b3e10f87d0386d2f8';
const IWAD_PATH = 'doom/DOOM1.WAD';
const SOURCE_PATH = 'src/playable/game-session-wiring/wireStatusBarInvocation.ts';

describe('wireStatusBarInvocation', () => {
  test('locks the exact runtime command contract and audit manifest linkage', async () => {
    const manifest = await readAuditManifest();

    expect(WIRE_STATUS_BAR_INVOCATION_CONTRACT).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      runtime: 'bun',
      stepId: '08-008',
      stepTitle: 'wire-status-bar-invocation',
    });
    expect(Object.isFrozen(WIRE_STATUS_BAR_INVOCATION_CONTRACT)).toBe(true);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.stepId).toBe('01-009');
    expect(manifest.commandContracts.targetRuntime).toEqual({
      command: WIRE_STATUS_BAR_INVOCATION_CONTRACT.command,
      entryFile: WIRE_STATUS_BAR_INVOCATION_CONTRACT.entryFile,
      implementedInReadScope: false,
    });
    expect(manifest.currentLauncherSurface.defaults).toEqual({
      mapName: 'E1M1',
      scale: 2,
      skill: 2,
    });
  });

  test('locks the implementation source hash', async () => {
    const source = await Bun.file(SOURCE_PATH).text();

    expect(sha256(source)).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('invokes the status bar after gameplay rendering during display', async () => {
    const session = await createDefaultSession();
    const result = wireStatusBarInvocation(session, {
      command: WIRE_STATUS_BAR_INVOCATION_CONTRACT.command,
      inputState: EMPTY_LAUNCHER_INPUT,
    });

    expect(result).toEqual({
      frameCount: 1,
      framebufferLength: 64_000,
      framebufferSample: [108, 108, 108, 109, 109, 109, 110, 110],
      levelTime: 1,
      loopStartedBeforeInvocation: false,
      phaseTrace: ['preLoop:initialTryRunTics', 'preLoop:restoreBuffer', 'preLoop:executeSetViewSize', 'preLoop:startGameLoop', 'frame:startFrame', 'frame:tryRunTics', 'frame:updateSounds', 'frame:display', 'statusBar:display'],
      statusBarInvocation: {
        frameNumber: 1,
        levelTime: 1,
        phase: 'display',
        playerHealth: 100,
        playerObjectHealth: 100,
        renderedAfterGameplay: true,
        viewZ: 2_686_976,
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.statusBarInvocation)).toBe(true);
    expect(Object.isFrozen(result.phaseTrace)).toBe(true);
    expect(Object.isFrozen(result.framebufferSample)).toBe(true);
  });

  test('reuses an already-started main loop without rerunning pre-loop callbacks', async () => {
    const loop = new MainLoop();

    loop.setup({
      executeSetViewSize() {},
      initialTryRunTics() {},
      restoreBuffer() {},
      startGameLoop() {},
    });

    const session = await createDefaultSession();
    const result = wireStatusBarInvocation(session, {
      command: WIRE_STATUS_BAR_INVOCATION_CONTRACT.command,
      loop,
    });

    expect(result.loopStartedBeforeInvocation).toBe(true);
    expect(result.frameCount).toBe(1);
    expect(result.levelTime).toBe(1);
    expect(result.phaseTrace).toEqual(['frame:startFrame', 'frame:tryRunTics', 'frame:updateSounds', 'frame:display', 'statusBar:display']);
  });

  test('rejects non-target commands before mutating replay state', async () => {
    const loop = new MainLoop();
    const session = await createDefaultSession();

    expect(() =>
      wireStatusBarInvocation(session, {
        command: 'bun run src/main.ts',
        loop,
      }),
    ).toThrow('wireStatusBarInvocation requires bun run doom.ts, got bun run src/main.ts');
    expect(loop.started).toBe(false);
    expect(session.levelTime).toBe(0);
  });
});

async function createDefaultSession() {
  const manifest = await readAuditManifest();
  const resources = await loadLauncherResources(IWAD_PATH);

  return createLauncherSession(resources, {
    mapName: manifest.currentLauncherSurface.defaults.mapName,
    skill: manifest.currentLauncherSurface.defaults.skill,
  });
}

async function readAuditManifest(): Promise<AuditManifest> {
  const manifest: AuditManifest = await Bun.file(WIRE_STATUS_BAR_INVOCATION_CONTRACT.auditManifestPath).json();

  return manifest;
}

function sha256(source: string): string {
  return new Bun.CryptoHasher('sha256').update(source).digest('hex');
}
