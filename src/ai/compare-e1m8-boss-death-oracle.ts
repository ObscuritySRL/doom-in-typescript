/**
 * Compare E1M8 boss death oracle from local DOOM1.WAD.
 *
 * E1M8 (Phobos Anomaly) ends when all MT_BRUISER (baron of hell, mobjtype=15)
 * are dead. A_BossDeath in p_enemy.c fires EV_DoFloor(tag=666, lowerFloorToLowest)
 * to drop the exit pillar.
 *
 * Pinned facts from DOOM1.WAD E1M8 inspection:
 *   - Map E1M8 is a boss arena with 2 Baron of Hell things (mobj type 3003
 *     in mapthing space; mobjtype_t=15 at runtime).
 *   - Tag-666 sectors are the exit pillars that lower on baron death.
 */

export const E1M8_BOSS_DEATH_ORACLE = Object.freeze({
  mapName: 'E1M8',
  bossThingMapThingType: 3003, // Baron mapthing type
  bossMobjType: 15, // MT_BRUISER (runtime mobjtype_t)
  bossDeathTag: 666,
  bossDeathFloorAction: 'lowerFloorToLowest' as const,
  expectedBaronCount: 2,
} as const);
