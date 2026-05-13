import { describe, expect, test } from 'bun:test';

import { VANILLA_E1M1_START_PARAMETERS, VANILLA_MENU_DOWN_PRESSES_TO_HMP_FROM_DEFAULT, VANILLA_MENU_ENTER_PRESSES_TO_E1M1, decideMenuRouteToE1M1, lookupMenuKey } from '../../../src/bootstrap/implement-menu-route-to-e1m1.ts';

describe('vanilla menu-to-E1M1 route contract', () => {
  test('E1M1 startup tuple is episode 1, map 1, skill 2 (Hurt Me Plenty)', () => {
    expect(VANILLA_E1M1_START_PARAMETERS.episode).toBe(1);
    expect(VANILLA_E1M1_START_PARAMETERS.map).toBe(1);
    expect(VANILLA_E1M1_START_PARAMETERS.skill).toBe(2);
  });

  test('default cursor lands on Hurt Me Plenty (0 DOWN presses needed)', () => {
    expect(VANILLA_MENU_DOWN_PRESSES_TO_HMP_FROM_DEFAULT).toBe(0);
  });

  test('3 ENTER presses route from main menu open to confirmed skill', () => {
    expect(VANILLA_MENU_ENTER_PRESSES_TO_E1M1).toBe(3);
  });

  test('lookupMenuKey returns scan codes from chocolate-doom.cfg', () => {
    expect(lookupMenuKey('KEY_MENU_FORWARD')).toBe(28);
    expect(lookupMenuKey('KEY_MENU_DOWN')).toBe(80);
  });
});

describe('decideMenuRouteToE1M1', () => {
  test('returns queued-e1m1-hmp on the canonical 3 ENTER, 0 DOWN, episode 0, skill 2', () => {
    const outcome = decideMenuRouteToE1M1({ enterPressCount: 3, downPressCount: 0, episodeIndex: 0, skillIndex: 2 });
    expect(outcome).toBe('queued-e1m1-hmp');
  });

  test('returns not-confirmed when fewer than 3 ENTER presses', () => {
    const outcome = decideMenuRouteToE1M1({ enterPressCount: 2, downPressCount: 0, episodeIndex: 0, skillIndex: 2 });
    expect(outcome).toBe('not-confirmed');
  });

  test('returns queued-other-episode for non-Knee-Deep episode', () => {
    const outcome = decideMenuRouteToE1M1({ enterPressCount: 3, downPressCount: 0, episodeIndex: 1, skillIndex: 2 });
    expect(outcome).toBe('queued-other-episode');
  });

  test('returns queued-other-skill for non-HMP skill', () => {
    const outcome = decideMenuRouteToE1M1({ enterPressCount: 3, downPressCount: 0, episodeIndex: 0, skillIndex: 3 });
    expect(outcome).toBe('queued-other-skill');
  });
});
