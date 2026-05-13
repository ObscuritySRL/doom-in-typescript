/**
 * Vanilla DOOM 1.9 A_BossDeath special triggers.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c A_BossDeath:
 *   Triggers map-end special when a boss-type monster dies.
 *   DOOM 1 episode boss specials (shareware/registered/retail):
 *     E1M8: All MT_BRUISER (barons) dead -> open exit (floor lower to lowest).
 *     E2M8: All MT_CYBORG (cyberdemons) dead -> open exit.
 *     E3M8: All MT_SPIDER (spider masterminds) dead -> open exit.
 *     E4M6: All MT_CYBORG dead -> open blocking line (-1 tag floor down 500).
 *     E4M8: All MT_SPIDER dead -> open exit.
 *
 *   The trigger checks gamemode and (episode, map number) before firing.
 *
 *   In DOOM 2 (gamemode=commercial), A_BossDeath uses different per-map paths
 *   (MAP07 spider, MAP07 fatso, MAP32 keen — none in DOOM 1 IWAD scope).
 */

export interface BossDeathTrigger {
  readonly gameMode: 'shareware' | 'registered' | 'retail';
  readonly episode: number;
  readonly mapNumber: number;
  readonly bossType: number; // mobj type id
  readonly action: 'lower-floor-to-lowest' | 'open-door' | 'lower-floor-tag-666';
}

export const VANILLA_DOOM1_BOSS_DEATH_TRIGGERS: readonly BossDeathTrigger[] = Object.freeze([
  Object.freeze({ gameMode: 'shareware' as const, episode: 1, mapNumber: 8, bossType: 15, action: 'lower-floor-to-lowest' as const }), // E1M8 barons
  Object.freeze({ gameMode: 'registered' as const, episode: 2, mapNumber: 8, bossType: 18, action: 'lower-floor-to-lowest' as const }), // E2M8 cyberdemons
  Object.freeze({ gameMode: 'registered' as const, episode: 3, mapNumber: 8, bossType: 20, action: 'lower-floor-to-lowest' as const }), // E3M8 spider masterminds
  Object.freeze({ gameMode: 'retail' as const, episode: 4, mapNumber: 6, bossType: 18, action: 'lower-floor-tag-666' as const }), // E4M6 cyberdemons
  Object.freeze({ gameMode: 'retail' as const, episode: 4, mapNumber: 8, bossType: 20, action: 'lower-floor-to-lowest' as const }), // E4M8 spider masterminds
]);

export function findBossDeathTrigger(input: { readonly gameMode: 'shareware' | 'registered' | 'retail'; readonly episode: number; readonly mapNumber: number }): BossDeathTrigger | null {
  for (const t of VANILLA_DOOM1_BOSS_DEATH_TRIGGERS) {
    if (t.gameMode === input.gameMode && t.episode === input.episode && t.mapNumber === input.mapNumber) {
      return t;
    }
  }
  return null;
}
