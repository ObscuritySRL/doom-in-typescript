import { describe, expect, test } from 'bun:test';

import { SCREENHEIGHT, SCREENWIDTH } from '../../src/host/windowPolicy.ts';
import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, createLauncherSession, loadLauncherResources, renderLauncherFrame } from '../../src/launcher/session.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { F_INIT_HEIGHT } from '../../src/ui/automap.ts';

const IWAD_PATH = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;

let cachedResourcesPromise: ReturnType<typeof loadLauncherResources> | null = null;

function loadReferenceResources() {
  cachedResourcesPromise ??= loadLauncherResources(IWAD_PATH);
  return cachedResourcesPromise;
}

describe('launcher session resources', () => {
  test('lists shareware maps in directory order', async () => {
    const resources = await loadReferenceResources();

    expect(resources.mapNames).toEqual(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9']);
  });
});

describe('launcher session bootstrap', () => {
  test('boots E1M1 with an active player and gameplay as the default view', async () => {
    const session = createLauncherSession(await loadReferenceResources(), {
      mapName: 'E1M1',
      skill: 2,
    });

    expect(session.mapData.name).toBe('E1M1');
    expect(session.player.mo).not.toBeNull();
    expect(session.automapState.active).toBe(true);
    expect(session.automapState.f_w).toBe(SCREENWIDTH);
    expect(session.automapState.f_h).toBe(F_INIT_HEIGHT);
    expect(session.framebuffer.length).toBe(SCREENWIDTH * SCREENHEIGHT);
    expect(session.showAutomap).toBe(false);
  });

  test('raises the ready weapon psprite at spawn and keeps it up (P_SetupPsprites/P_MovePsprites wired)', async () => {
    const session = createLauncherSession(await loadReferenceResources(), {
      mapName: 'E1M1',
      skill: 2,
    });

    // Regression: the launcher never called P_SetupPsprites, so the
    // weapon psprite stayed null and was never drawn in the 3D view.
    expect(session.player.psprites[0]!.state).not.toBeNull();
    expect(session.weaponStateContext.leveltime).toBe(0);

    for (let tic = 0; tic < 60; tic += 1) {
      advanceLauncherSession(session, EMPTY_LAUNCHER_INPUT);
    }

    // After the pistol bring-up the weapon stays up, and the per-tic
    // context tracks leveltime for the weapon bob (set before the
    // levelTime increment, so it trails by one).
    expect(session.player.psprites[0]!.state).not.toBeNull();
    expect(session.levelTime).toBe(60);
    expect(session.weaponStateContext.leveltime).toBe(session.levelTime - 1);
  });

  test('renders a varied gameplay frame for E1M1', async () => {
    const session = createLauncherSession(await loadReferenceResources(), {
      mapName: 'E1M1',
      skill: 2,
    });
    const framebuffer = renderLauncherFrame(session);

    expect(framebuffer.some((value) => value !== 0)).toBe(true);
    expect(new Set(framebuffer.subarray(SCREENWIDTH * 80, SCREENWIDTH * 81)).size).toBeGreaterThan(1);
  });

  test('can toggle back to the automap view', async () => {
    const session = createLauncherSession(await loadReferenceResources(), {
      mapName: 'E1M1',
      skill: 2,
    });

    advanceLauncherSession(session, {
      ...EMPTY_LAUNCHER_INPUT,
      toggleMap: true,
    });

    const framebuffer = renderLauncherFrame(session);

    expect(session.showAutomap).toBe(true);
    expect(framebuffer.some((value) => value !== 0)).toBe(true);
  });

  test('advancing with forward input moves the player', async () => {
    const session = createLauncherSession(await loadReferenceResources(), {
      mapName: 'E1M1',
      skill: 2,
    });
    const initialX = session.player.mo!.x;
    const initialY = session.player.mo!.y;

    for (let ticIndex = 0; ticIndex < 8; ticIndex += 1) {
      advanceLauncherSession(session, {
        ...EMPTY_LAUNCHER_INPUT,
        forward: true,
      });
    }

    expect(session.player.mo!.x !== initialX || session.player.mo!.y !== initialY).toBe(true);
  });
});
