/**
 * Vanilla DOOM 1.9 intermission stats counter contract.
 *
 * From Chocolate Doom 2.2.1 wi_stuff.c WI_updateStats:
 *
 *   void WI_updateStats(void)
 *   {
 *       int  i;
 *       static int sp_state;
 *
 *       WI_updateAnimatedBack();
 *
 *       if (acceleratestage && sp_state != 10)
 *       {
 *           acceleratestage = 0;
 *           cnt_kills[0]  = (plrs[me].skills  * 100) / wbs->maxkills;
 *           cnt_items[0]  = (plrs[me].sitems  * 100) / wbs->maxitems;
 *           cnt_secret[0] = (plrs[me].ssecret * 100) / wbs->maxsecret;
 *           cnt_time      = plrs[me].stime / TICRATE;
 *           cnt_par       = wbs->partime;
 *           S_StartSound(NULL, sfx_barexp);
 *           sp_state = 10;
 *       }
 *
 *       if (sp_state == 2)
 *       {
 *           cnt_kills[0] += 2;
 *           ...
 *       }
 *   }
 *
 * Notes for parity:
 *   - Five stats: kills %, items %, secret %, time (seconds), par (seconds).
 *   - cnt_kills/cnt_items/cnt_secret are percentages in [0, 100].
 *   - Counting increments are 2 percentage points per tick (not per call!) for kills/items/secrets.
 *   - Time and par count up in 1-second steps per tick (or large step on accelerate).
 *   - Acceleration (via player using "use" or "fire") snaps to final values immediately
 *     and plays sfx_barexp.
 *   - Five-state sp_state machine: 0 (delay before kills), 2 (counting kills),
 *     4 (counting items), 6 (counting secrets), 8 (counting time/par), 10 (waiting for accept).
 *   - The intermission shows the stats for the player's own slot (`me` index).
 *   - For coop/dm, additional slots are shown (one per netplayer).
 */

export const VANILLA_INTERMISSION_STAT_PERCENT_STEP = 2;
export const VANILLA_INTERMISSION_TIME_STEP_TICS = 1;
export const VANILLA_INTERMISSION_SP_STATE_KILLS = 2;
export const VANILLA_INTERMISSION_SP_STATE_ITEMS = 4;
export const VANILLA_INTERMISSION_SP_STATE_SECRET = 6;
export const VANILLA_INTERMISSION_SP_STATE_TIME = 8;
export const VANILLA_INTERMISSION_SP_STATE_ACCELERATED = 10;

export interface IntermissionStatPercentInput {
  readonly killed: number;
  readonly maxKilled: number;
}

export function computeVanillaIntermissionPercent(input: IntermissionStatPercentInput): number {
  if (input.maxKilled <= 0) {
    return 0;
  }
  return Math.trunc((input.killed * 100) / input.maxKilled);
}

export interface IntermissionTimeFromTicsInput {
  readonly tics: number;
}

export function computeVanillaIntermissionTimeSeconds(input: IntermissionTimeFromTicsInput): number {
  return Math.trunc(input.tics / 35);
}

export interface IntermissionStepInput {
  readonly currentCount: number;
  readonly targetCount: number;
  readonly accelerated: boolean;
}

export interface IntermissionStepResult {
  readonly nextCount: number;
  readonly reachedTarget: boolean;
}

export function stepVanillaIntermissionPercent(input: IntermissionStepInput): IntermissionStepResult {
  if (input.accelerated || input.currentCount + VANILLA_INTERMISSION_STAT_PERCENT_STEP >= input.targetCount) {
    return Object.freeze({ nextCount: input.targetCount, reachedTarget: true });
  }
  return Object.freeze({ nextCount: input.currentCount + VANILLA_INTERMISSION_STAT_PERCENT_STEP, reachedTarget: false });
}
