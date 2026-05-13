/**
 * Vanilla Chocolate Doom 2.2.1 main-menu -> New Game -> E1M1 routing contract.
 *
 * From the main menu (cursor on New Game), ENTER opens M_NewGame (episode list).
 * ENTER on Knee-Deep In The Dead opens M_Episode -> skill list. DOWN twice
 * positions the cursor on Hurt Me Plenty (skill index 2). ENTER on the
 * confirmed skill triggers M_ChooseSkill -> G_DeferedInitNew(skill, 1, 1) which
 * sets gameepisode=1, gamemap=1, gameskill=2 and queues the level start.
 */

import { VANILLA_MENU_KEY_SCAN_CODES } from './implement-menu-key-mapping-from-config.ts';

/** Vanilla shareware E1M1 default startup tuple after the menu route. */
export const VANILLA_E1M1_START_PARAMETERS = Object.freeze({
  episode: 1,
  map: 1,
  skill: 2,
});

/** Number of DOWN presses required from M_Episode default cursor (Ultra-Violence) to Hurt Me Plenty. Vanilla menu loads on skill 2 directly. */
export const VANILLA_MENU_DOWN_PRESSES_TO_HMP_FROM_DEFAULT = 0;

/** Number of ENTER presses required to traverse: open main menu (assumed open) -> New Game -> Episode 1 -> Confirm skill 2. */
export const VANILLA_MENU_ENTER_PRESSES_TO_E1M1 = 3;

export interface MenuRouteInput {
  readonly enterPressCount: number;
  readonly downPressCount: number;
  readonly episodeIndex: number;
  readonly skillIndex: number;
}

export type MenuRouteOutcome = 'queued-e1m1-hmp' | 'queued-other-skill' | 'queued-other-episode' | 'not-confirmed';

export function decideMenuRouteToE1M1(input: MenuRouteInput): MenuRouteOutcome {
  if (input.enterPressCount < VANILLA_MENU_ENTER_PRESSES_TO_E1M1) {
    return 'not-confirmed';
  }
  if (input.episodeIndex !== 0) {
    return 'queued-other-episode';
  }
  if (input.skillIndex !== VANILLA_E1M1_START_PARAMETERS.skill) {
    return 'queued-other-skill';
  }
  return 'queued-e1m1-hmp';
}

export function lookupMenuKey(menuKeyName: keyof typeof VANILLA_MENU_KEY_SCAN_CODES): number {
  return VANILLA_MENU_KEY_SCAN_CODES[menuKeyName];
}
