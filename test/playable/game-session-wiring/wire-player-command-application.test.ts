import { describe, expect, test } from 'bun:test';

import { EMPTY_LAUNCHER_INPUT, createLauncherSession, loadLauncherResources } from '../../../src/launcher/session.ts';
import { MainLoop } from '../../../src/mainLoop.ts';
import { WIRE_PLAYER_COMMAND_APPLICATION_RUNTIME_CONTRACT, wirePlayerCommandApplication } from '../../../src/playable/game-session-wiring/wirePlayerCommandApplication.ts';

describe('wirePlayerCommandApplication', () => {
  test('locks the Bun runtime command contract', () => {
    expect(WIRE_PLAYER_COMMAND_APPLICATION_RUNTIME_CONTRACT).toEqual({
      auditManifest: {
        path: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
        schemaVersion: 1,
        stepId: '01-009',
      },
      runtimeCommand: 'bun run doom.ts',
      runtimeProgram: 'bun',
      stepId: '08-006',
      stepTitle: 'wire-player-command-application',
    });
  });

  test('links the 01-009 menu-to-e1m1 audit manifest schema', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json').text();

    expect(manifestText).toContain('"command": "bun run doom.ts"');
    expect(manifestText).toContain('"entryFile": "doom.ts"');
    expect(manifestText).toContain('"schemaVersion": 1');
    expect(manifestText).toContain('"stepId": "01-009"');
    expect(manifestText).toContain('"surfaceId": "menu-to-e1m1-transition"');
  });

  test('locks the formatted implementation source hash', async () => {
    const sourceText = await Bun.file('src/playable/game-session-wiring/wirePlayerCommandApplication.ts').text();
    const sourceHash = new Bun.CryptoHasher('sha256').update(sourceText).digest('hex');

    expect(sourceHash).toBe('122eab0af5846a8c24171c8004cf51b11c6792143d6bda439737f3c55c2162fc');
  });

  test('applies the player command only during tryRunTics', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });
    const loop = new MainLoop();
    const result = wirePlayerCommandApplication({
      inputState: { ...EMPTY_LAUNCHER_INPUT, forward: true, run: true, turnRight: true },
      loop,
      runtimeCommand: 'bun run doom.ts',
      session,
    });

    expect(result).toEqual({
      after: {
        angle: 989855744,
        frameCount: 1,
        levelTime: 1,
        playerCommand: {
          angleturn: -1280,
          buttons: 0,
          chatchar: 0,
          consistancy: 0,
          forwardmove: 50,
          sidemove: 0,
        },
        playerX: 69218511,
        playerY: -236876542,
        playerZ: 0,
        viewZ: 2686982,
      },
      appliedDuringPhase: 'tryRunTics',
      before: {
        angle: 1073741824,
        frameCount: 0,
        levelTime: 0,
        playerCommand: {
          angleturn: 0,
          buttons: 0,
          chatchar: 0,
          consistancy: 0,
          forwardmove: 0,
          sidemove: 0,
        },
        playerX: 69206016,
        playerY: -236978176,
        playerZ: 0,
        viewZ: 2686976,
      },
      frameCount: 1,
      phaseTrace: ['startFrame', 'tryRunTics', 'updateSounds', 'display'],
      preLoopTrace: ['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop'],
      runtimeCommand: 'bun run doom.ts',
      stepId: '08-006',
    });
    expect(loop.frameCount).toBe(1);
    expect(session.levelTime).toBe(1);
  });

  test('rejects the wrong command before starting the loop', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });
    const loop = new MainLoop();

    expect(() =>
      wirePlayerCommandApplication({
        inputState: { ...EMPTY_LAUNCHER_INPUT, forward: true },
        loop,
        runtimeCommand: 'bun run src/main.ts',
        session,
      }),
    ).toThrow('wire-player-command-application requires bun run doom.ts, got bun run src/main.ts');
    expect(loop.started).toBe(false);
    expect(session.levelTime).toBe(0);
  });

  test('throws when the player map object is missing before the frame', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });
    const loop = new MainLoop();

    session.player.mo = null;

    expect(() =>
      wirePlayerCommandApplication({
        inputState: EMPTY_LAUNCHER_INPUT,
        loop,
        runtimeCommand: 'bun run doom.ts',
        session,
      }),
    ).toThrow('wire-player-command-application requires a spawned player');
    expect(loop.started).toBe(false);
    expect(session.levelTime).toBe(0);
  });

  test('skips pre-loop setup when the main loop is already started', async () => {
    const resources = await loadLauncherResources('doom/DOOM1.WAD');
    const session = createLauncherSession(resources, { mapName: 'E1M1', skill: 2 });
    const loop = new MainLoop();

    loop.setup({
      executeSetViewSize() {},
      initialTryRunTics() {},
      restoreBuffer() {},
      startGameLoop() {},
    });

    const result = wirePlayerCommandApplication({
      inputState: EMPTY_LAUNCHER_INPUT,
      loop,
      runtimeCommand: 'bun run doom.ts',
      session,
    });

    expect(result.preLoopTrace).toEqual([]);
    expect(result.phaseTrace).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
    expect(loop.frameCount).toBe(1);
    expect(session.levelTime).toBe(1);
  });
});
