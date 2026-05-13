/**
 * Vanilla DOOM 1.9 P_LookForPlayers contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c P_LookForPlayers:
 *   boolean P_LookForPlayers (mobj_t* actor, boolean allaround) {
 *     int   c;
 *     int   stop;
 *     player_t* player;
 *     angle_t  an;
 *     fixed_t  dist;
 *
 *     c = 0;
 *     stop = (actor->lastlook - 1) & 3;
 *     for (; ; actor->lastlook = (actor->lastlook + 1) & 3) {
 *       if (!playeringame[actor->lastlook]) continue;
 *       if (c++ == 2 || actor->lastlook == stop) return false;
 *       player = &players[actor->lastlook];
 *       if (player->health <= 0) continue;
 *       if (!P_CheckSight(actor, player->mo)) continue;
 *       if (!allaround) {
 *         an = R_PointToAngle2(actor->x, actor->y, player->mo->x, player->mo->y) - actor->angle;
 *         if (an > ANG90 && an < ANG270) {
 *           dist = P_AproxDistance(player->mo->x - actor->x, player->mo->y - actor->y);
 *           if (dist > MELEERANGE) continue;
 *         }
 *       }
 *       actor->target = player->mo;
 *       return true;
 *     }
 *   }
 *
 * Parity-critical:
 *   - Round-robin over 4 player slots via lastlook & 3.
 *   - At most 2 in-game players are inspected per call (c++ == 2 gate),
 *     even in 4-player coop/DM. This is a vanilla limitation that affects
 *     monster targeting in 3-4 player games.
 *   - allaround=false: ignore players outside the front 180° arc EXCEPT
 *     when they're within MELEERANGE.
 *   - actor->lastlook is mutated even when the function returns true.
 */

export const VANILLA_LOOK_MAX_PLAYERS_PER_CALL = 2;
export const VANILLA_LASTLOOK_MASK = 3;
export const VANILLA_ANG90 = 0x40000000;
export const VANILLA_ANG270 = 0xc0000000;

export function isAngleInFrontHalfArc(angleDelta: number): boolean {
  const wrapped = angleDelta >>> 0;
  return !(wrapped > VANILLA_ANG90 && wrapped < VANILLA_ANG270);
}

export function nextLastLookIndex(currentLastLook: number): number {
  return (currentLastLook + 1) & VANILLA_LASTLOOK_MASK;
}

export function computeLookForPlayersStopIndex(currentLastLook: number): number {
  return (currentLastLook - 1) & VANILLA_LASTLOOK_MASK;
}
