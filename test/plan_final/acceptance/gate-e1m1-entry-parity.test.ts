import { describe, expect, test } from 'bun:test';

import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/host/windowPolicy.ts';
import { renderLauncherFrame } from '../../../src/launcher/session.ts';
import { TITLE_LOOP_SMOKE_GAMEPLAY_CONTRACT, createTitleLoopSmokeHostGameplaySession } from '../../../src/vanilla/titleLoopSmokeHost.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

function countUniquePaletteIndexes(framebuffer: Uint8Array): number {
  const paletteIndexes = new Set<number>();

  for (const paletteIndex of framebuffer) {
    paletteIndexes.add(paletteIndex);
    if (paletteIndexes.size > 16) {
      return paletteIndexes.size;
    }
  }

  return paletteIndexes.size;
}

describe('plan_final acceptance: gate-e1m1-entry-parity structural unblock', () => {
  test('the root smoke host exposes the E1M1 gameplay route behind bun run doom.ts', () => {
    expect(TITLE_LOOP_SMOKE_GAMEPLAY_CONTRACT).toEqual({
      defaultEpisode: 1,
      defaultMapNumber: 1,
      runtimeCommand: 'bun run doom.ts',
    });
  });

  test('creates the E1M1 gameplay session used after title menu skill selection', async () => {
    const session = await createTitleLoopSmokeHostGameplaySession(IWAD_PATH, 2);
    const framebuffer = renderLauncherFrame(session);

    expect(session.mapName).toBe('E1M1');
    expect(session.player.mo).not.toBeNull();
    expect(session.showAutomap).toBe(false);
    expect(framebuffer.length).toBe(SCREENWIDTH * SCREENHEIGHT);
    expect(framebuffer.some((paletteIndex) => paletteIndex !== 0)).toBe(true);
    expect(countUniquePaletteIndexes(framebuffer)).toBeGreaterThan(16);
  });

  test('rejects invalid menu skill values instead of silently creating a session', async () => {
    await expect(createTitleLoopSmokeHostGameplaySession(IWAD_PATH, 6)).rejects.toThrow('skill must be an integer from 1 to 5');
  });
});
