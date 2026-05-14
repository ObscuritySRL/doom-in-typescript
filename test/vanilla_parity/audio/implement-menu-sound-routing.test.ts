import { describe, expect, test } from 'bun:test';

import { VANILLA_MENU_SOUND_CENTERED_SEPARATION, VANILLA_MENU_SOUND_DOES_RESPATIALIZE, VANILLA_MENU_SOUND_ORIGIN, VANILLA_MENU_SOUND_USES_FULL_VOLUME, routeVanillaMenuSound } from '../../../src/audio/implement-menu-sound-routing.ts';

describe('vanilla menu sound routing pin', () => {
  test('origin field is NULL for menu sounds', () => {
    expect(VANILLA_MENU_SOUND_ORIGIN).toBe(null);
  });

  test('menu sounds skip S_AdjustSoundParams (no respatialization)', () => {
    expect(VANILLA_MENU_SOUND_DOES_RESPATIALIZE).toBe(false);
  });

  test('menu sounds play at full snd_SfxVolume baseline', () => {
    expect(VANILLA_MENU_SOUND_USES_FULL_VOLUME).toBe(true);
  });

  test('menu sounds use NORM_SEP centred separation', () => {
    expect(VANILLA_MENU_SOUND_CENTERED_SEPARATION).toBe(true);
  });

  test('routeVanillaMenuSound returns the anonymous-origin, full-volume, centred-pan profile', () => {
    const decision = routeVanillaMenuSound(0);
    expect(decision.originField).toBe(null);
    expect(decision.callsAdjustSoundParams).toBe(false);
    expect(decision.initialVolume).toBe('snd_SfxVolume-full');
    expect(decision.initialSeparation).toBe('NORM_SEP-centred');
  });

  test('routing is independent of the specific sfx id (any menu sfx uses the same routing)', () => {
    const swtchn = routeVanillaMenuSound(1);
    const swtchx = routeVanillaMenuSound(2);
    const pistol = routeVanillaMenuSound(3);
    expect(swtchn).toEqual(swtchx);
    expect(swtchx).toEqual(pistol);
  });
});
