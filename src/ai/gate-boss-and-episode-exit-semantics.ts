/**
 * Gate step 08-032: aggregate boss and episode exit primitive constants.
 */

import { E1M8_BOSS_DEATH_ORACLE } from './compare-e1m8-boss-death-oracle.ts';
import { VANILLA_DOOM1_BOSS_DEATH_TRIGGERS, findBossDeathTrigger } from './implement-boss-death-specials.ts';
import { isIconOfSinAllowedInGameMode, isKeenAllowedInGameMode } from './implement-keen-and-icon-paths-behind-doom-two-scope.ts';
import { isPainElementalAllowedInGameMode } from './implement-pain-elemental-and-doom-two-guarded-path.ts';

export const BOSS_EPISODE_EXIT_GATE = Object.freeze({
  doom1TriggerCount: VANILLA_DOOM1_BOSS_DEATH_TRIGGERS.length,
  e1m8Tag: E1M8_BOSS_DEATH_ORACLE.bossDeathTag,
  e1m8Action: E1M8_BOSS_DEATH_ORACLE.bossDeathFloorAction,
  e1m8BaronCount: E1M8_BOSS_DEATH_ORACLE.expectedBaronCount,
  e2m8TriggerExists: findBossDeathTrigger({ gameMode: 'registered', episode: 2, mapNumber: 8 }) !== null,
  e3m8TriggerExists: findBossDeathTrigger({ gameMode: 'registered', episode: 3, mapNumber: 8 }) !== null,
  e4m6TriggerExists: findBossDeathTrigger({ gameMode: 'retail', episode: 4, mapNumber: 6 }) !== null,
  e4m8TriggerExists: findBossDeathTrigger({ gameMode: 'retail', episode: 4, mapNumber: 8 }) !== null,
  painElementalCommercialOnly: isPainElementalAllowedInGameMode('commercial') && !isPainElementalAllowedInGameMode('shareware'),
  keenCommercialOnly: isKeenAllowedInGameMode('commercial') && !isKeenAllowedInGameMode('retail'),
  iconCommercialOnly: isIconOfSinAllowedInGameMode('commercial') && !isIconOfSinAllowedInGameMode('registered'),
} as const);
