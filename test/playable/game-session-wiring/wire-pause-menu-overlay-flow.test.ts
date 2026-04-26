import { describe, expect, test } from 'bun:test';

import { createLauncherSession, EMPTY_LAUNCHER_INPUT, loadLauncherResources } from '../../../src/launcher/session.ts';
import { MAIN_LOOP_PHASES, MainLoop, PRE_LOOP_STEPS } from '../../../src/mainLoop.ts';
import { WIRE_PAUSE_MENU_OVERLAY_FLOW_COMMAND_CONTRACT, wirePauseMenuOverlayFlow } from '../../../src/playable/game-session-wiring/wirePauseMenuOverlayFlow.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json';
const SOURCE_PATH = 'src/playable/game-session-wiring/wirePauseMenuOverlayFlow.ts';

describe('wirePauseMenuOverlayFlow', () => {
  test('locks the exact Bun runtime command contract', () => {
    expect(WIRE_PAUSE_MENU_OVERLAY_FLOW_COMMAND_CONTRACT).toEqual({
      command: 'bun run doom.ts',
      entryFile: 'doom.ts',
      program: 'bun',
      subcommand: 'run',
    });
  });

  test('links the runtime path to the 01-009 menu-to-E1M1 audit manifest', async () => {
    const manifestValue: unknown = JSON.parse(await Bun.file(AUDIT_MANIFEST_PATH).text());

    expect(manifestValue).toEqual(
      expect.objectContaining({
        commandContracts: {
          currentPackageStart: {
            command: 'bun run src/main.ts',
            path: 'package.json',
            scriptName: 'start',
          },
          targetRuntime: {
            command: 'bun run doom.ts',
            entryFile: 'doom.ts',
            implementedInReadScope: false,
          },
        },
        schemaVersion: 1,
        stepId: '01-009',
        stepTitle: 'audit-missing-menu-to-e1m1',
      }),
    );
    expect(manifestValue).toEqual(
      expect.objectContaining({
        explicitNullSurfaces: expect.arrayContaining([
          expect.objectContaining({
            expectedPath: null,
            surfaceId: 'menu-controller-surface',
          }),
          expect.objectContaining({
            expectedPath: null,
            surfaceId: 'menu-render-surface',
          }),
        ]),
      }),
    );
  });

  test('locks the formatted source hash', async () => {
    expect(await sha256File(SOURCE_PATH)).toBe('1afb9902348625ec8efb790c60966b12112b18ceea6eaf8631404d0f3a4f9967');
  });

  test('opens the pause menu overlay during TryRunTics without advancing gameplay and renders during Display', async () => {
    const launcherResources = await loadTestLauncherResources();
    const session = createLauncherSession(launcherResources, { mapName: 'E1M1', skill: 2 });
    const result = wirePauseMenuOverlayFlow(session);

    expect(result.runtimeCommand).toBe('bun run doom.ts');
    expect(result.preLoopTrace).toEqual([...PRE_LOOP_STEPS]);
    expect(result.phaseTrace).toEqual([...MAIN_LOOP_PHASES]);
    expect(result.tickPhase).toBe('tryRunTics');
    expect(result.renderPhase).toBe('display');
    expect(result.frameCountBefore).toBe(0);
    expect(result.frameCountAfter).toBe(1);
    expect(result.levelTimeBefore).toBe(0);
    expect(result.levelTimeAfter).toBe(0);
    expect(result.loopStartedBefore).toBe(false);
    expect(result.loopStartedAfter).toBe(true);
    expect(result.gameplayAdvanced).toBe(false);
    expect(result.pauseMenuOverlayOpenBefore).toBe(false);
    expect(result.pauseMenuOverlayOpenAfter).toBe(true);
    expect(result.pauseMenuOverlayRenderedDuringDisplay).toBe(true);
    expect(result.framebuffer).toBe(session.framebuffer);
    expect(result.framebuffer.byteLength).toBe(64_000);
  });

  test('closes an open pause menu overlay and resumes deterministic gameplay during TryRunTics', async () => {
    const launcherResources = await loadTestLauncherResources();
    const session = createLauncherSession(launcherResources, { mapName: 'E1M1', skill: 2 });
    const result = wirePauseMenuOverlayFlow(session, {
      gameplayInput: {
        ...EMPTY_LAUNCHER_INPUT,
        forward: true,
        run: true,
      },
      pauseMenuOverlayOpen: true,
      togglePauseMenu: true,
    });

    expect(result.pauseMenuOverlayOpenBefore).toBe(true);
    expect(result.pauseMenuOverlayOpenAfter).toBe(false);
    expect(result.pauseMenuOverlayRenderedDuringDisplay).toBe(false);
    expect(result.gameplayAdvanced).toBe(true);
    expect(result.levelTimeBefore).toBe(0);
    expect(result.levelTimeAfter).toBe(1);
    expect(result.phaseTrace).toEqual([...MAIN_LOOP_PHASES]);
  });

  test('advances gameplay deterministically when togglePauseMenu is false and the overlay is closed', async () => {
    const launcherResources = await loadTestLauncherResources();
    const session = createLauncherSession(launcherResources, { mapName: 'E1M1', skill: 2 });
    const result = wirePauseMenuOverlayFlow(session, {
      gameplayInput: {
        ...EMPTY_LAUNCHER_INPUT,
        forward: true,
      },
      pauseMenuOverlayOpen: false,
      togglePauseMenu: false,
    });

    expect(result.pauseMenuOverlayOpenBefore).toBe(false);
    expect(result.pauseMenuOverlayOpenAfter).toBe(false);
    expect(result.pauseMenuOverlayRenderedDuringDisplay).toBe(false);
    expect(result.gameplayAdvanced).toBe(true);
    expect(result.levelTimeBefore).toBe(0);
    expect(result.levelTimeAfter).toBe(1);
    expect(result.phaseTrace).toEqual([...MAIN_LOOP_PHASES]);
  });

  test('keeps gameplay paused when togglePauseMenu is false and the overlay is already open', async () => {
    const launcherResources = await loadTestLauncherResources();
    const session = createLauncherSession(launcherResources, { mapName: 'E1M1', skill: 2 });
    const result = wirePauseMenuOverlayFlow(session, {
      gameplayInput: {
        ...EMPTY_LAUNCHER_INPUT,
        forward: true,
      },
      pauseMenuOverlayOpen: true,
      togglePauseMenu: false,
    });

    expect(result.pauseMenuOverlayOpenBefore).toBe(true);
    expect(result.pauseMenuOverlayOpenAfter).toBe(true);
    expect(result.pauseMenuOverlayRenderedDuringDisplay).toBe(true);
    expect(result.gameplayAdvanced).toBe(false);
    expect(result.levelTimeBefore).toBe(0);
    expect(result.levelTimeAfter).toBe(0);
    expect(result.phaseTrace).toEqual([...MAIN_LOOP_PHASES]);
  });

  test('rejects the wrong command before mutating replay state', async () => {
    const launcherResources = await loadTestLauncherResources();
    const session = createLauncherSession(launcherResources, { mapName: 'E1M1', skill: 2 });
    const loop = new MainLoop();

    expect(() => wirePauseMenuOverlayFlow(session, { command: 'bun run src/main.ts', loop })).toThrow('wire pause menu overlay flow expected bun run doom.ts, got bun run src/main.ts');
    expect(loop.started).toBe(false);
    expect(loop.frameCount).toBe(0);
    expect(session.levelTime).toBe(0);
    expect(session.showAutomap).toBe(false);
  });
});

async function loadTestLauncherResources() {
  return await loadLauncherResources('doom/DOOM1.WAD');
}

async function sha256File(sourcePath: string): Promise<string> {
  const sourceBytes = new Uint8Array(await Bun.file(sourcePath).arrayBuffer());
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(sourceBytes);

  return hasher.digest('hex');
}
