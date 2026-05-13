/**
 * Vanilla DOOM 1.9 monster spawn flag contract.
 *
 * From Chocolate Doom 2.2.1 p_mobj.c P_SpawnMapThing (monster branch):
 *   - MTF_AMBUSH (8): clears the alert flag; the monster doesn't wake on
 *     sound and only sees the player line-of-sight.
 *   - MTF_NETGAME (16): the thing is not spawned in single-player.
 *   - MTF_EASY/NORMAL/HARD (1/2/4): per-skill spawn filter (07-002).
 *
 * P_SpawnMobj initialization for monsters:
 *   - threshold = 0
 *   - movecount = 0
 *   - movedir = 0
 *   - reactiontime = info->reactiontime (varies by mobjtype)
 *   - target = NULL
 *   - lastenemy = NULL
 *   - tracer = NULL
 *
 * MF flags applied by mobjinfo (relevant for monsters):
 *   MF_SOLID | MF_SHOOTABLE | MF_COUNTKILL (if monster) | MF_DROPOFF
 *   plus MF_FLOAT for flying monsters (cacodemon, lost soul, pain elemental)
 *   plus MF_NOGRAVITY for floating monsters.
 */

export const VANILLA_MTF_EASY = 1;
export const VANILLA_MTF_NORMAL = 2;
export const VANILLA_MTF_HARD = 4;
export const VANILLA_MTF_AMBUSH = 8;
export const VANILLA_MTF_NETGAME = 16;

export const VANILLA_MF_SOLID = 0x2;
export const VANILLA_MF_SHOOTABLE = 0x4;
export const VANILLA_MF_COUNTKILL = 0x40_0000;
export const VANILLA_MF_DROPOFF = 0x10_0000;
export const VANILLA_MF_FLOAT = 0x4000;
export const VANILLA_MF_NOGRAVITY = 0x200;
export const VANILLA_MF_AMBUSH_RUNTIME = 0x8000;

export interface MonsterSpawnInitState {
  readonly threshold: number;
  readonly movecount: number;
  readonly movedir: number;
  readonly target: null;
  readonly lastenemy: null;
  readonly tracer: null;
  readonly hasAmbushBit: boolean;
}

export function initMonsterSpawnState(options: number): MonsterSpawnInitState {
  return Object.freeze({
    threshold: 0,
    movecount: 0,
    movedir: 0,
    target: null,
    lastenemy: null,
    tracer: null,
    hasAmbushBit: (options & VANILLA_MTF_AMBUSH) !== 0,
  });
}
