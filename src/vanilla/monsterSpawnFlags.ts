/**
 * Vanilla DOOM 1.9 monster spawn flag runtime.
 *
 * Plan_final step `10-001` (lane: ai-specials) wires the monster
 * spawn filtering (per-skill flags, single-player vs netgame
 * gating), the dormant / ambush flag transfer, and the per-monster
 * P_SpawnMobj initial-state defaults (threshold = 0, movecount = 0,
 * movedir = 0, target / lastenemy / tracer = null) into a runtime
 * helper the level-setup pipeline calls for every `mapthing_t` that
 * carries a monster `mobjtype_t`.
 *
 * Behavioral contract (from
 * `src/ai/implement-monster-spawn-flags.ts` audit):
 *
 *   - MTF_EASY=1, MTF_NORMAL=2, MTF_HARD=4: per-skill spawn bits.
 *     Skill 0..1 (Baby/Easy) consults MTF_EASY; skill 2 (Hurt Me
 *     Plenty) consults MTF_NORMAL; skill 3..4 (UV/Nightmare)
 *     consults MTF_HARD.  A thing whose bit is clear for the
 *     current skill is dropped.
 *   - MTF_AMBUSH=8: the monster does not wake on sound; sets
 *     MF_AMBUSH at runtime (`0x8000` in the live `mobj_t.flags`).
 *   - MTF_NETGAME=16: the thing is NOT spawned in single-player;
 *     it IS spawned in cooperative / deathmatch.
 *
 * The wrapper exposes a single pure function
 * {@link evaluateMonsterSpawn} that takes a `mapthing_t.options`
 * bitfield + the current skill + the netgame flag and returns a
 * frozen verdict carrying `shouldSpawn`, the runtime ambush flag,
 * and the initial-state defaults the spawn caller composes into the
 * `mobj_t`.
 *
 * @example
 * ```ts
 * import { evaluateMonsterSpawn } from './monsterSpawnFlags.ts';
 *
 * const verdict = evaluateMonsterSpawn(0x01 | 0x08, 0, false);
 * verdict.shouldSpawn;            // true (MTF_EASY set on skill 0)
 * verdict.ambush;                 // true (MTF_AMBUSH set)
 * verdict.initialState.threshold; // 0
 * ```
 */

import { VANILLA_MF_AMBUSH_RUNTIME, VANILLA_MTF_AMBUSH, VANILLA_MTF_EASY, VANILLA_MTF_HARD, VANILLA_MTF_NETGAME, VANILLA_MTF_NORMAL, initMonsterSpawnState, type MonsterSpawnInitState } from '../ai/implement-monster-spawn-flags.ts';

export { VANILLA_MF_AMBUSH_RUNTIME, VANILLA_MTF_AMBUSH, VANILLA_MTF_EASY, VANILLA_MTF_HARD, VANILLA_MTF_NETGAME, VANILLA_MTF_NORMAL };

/**
 * Vanilla skill levels (from `skill_t` in `d_main.h`).  Index 0 is
 * "I'm Too Young To Die"; index 4 is "Nightmare".  The skill bit
 * the spawn filter consults follows the canonical vanilla mapping:
 *
 *   - skill <= 1 → MTF_EASY
 *   - skill === 2 → MTF_NORMAL
 *   - skill >= 3 → MTF_HARD
 */
export type VanillaSkillLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Frozen verdict returned by {@link evaluateMonsterSpawn}.  Carries
 * the spawn-or-drop decision, the runtime ambush flag (already
 * shifted into the `MF_AMBUSH` runtime bit), and the
 * P_SpawnMobj-equivalent initial state for the new monster.
 */
export interface MonsterSpawnVerdict {
  readonly ambush: boolean;
  readonly initialState: MonsterSpawnInitState;
  readonly mobjFlagsToOr: number;
  readonly shouldSpawn: boolean;
}

function selectSkillBit(skill: VanillaSkillLevel): number {
  if (skill <= 1) {
    return VANILLA_MTF_EASY;
  }
  if (skill === 2) {
    return VANILLA_MTF_NORMAL;
  }
  return VANILLA_MTF_HARD;
}

/**
 * Evaluate whether a `mapthing_t` should spawn a monster, and (if
 * so) which runtime flags carry over from the mapthing's `options`
 * bitfield.  Pure function — no allocation beyond the frozen
 * verdict.
 *
 * @param mapThingOptions The `mapthing_t.options` bitfield (5 LSBs
 *   carry MTF_EASY / MTF_NORMAL / MTF_HARD / MTF_AMBUSH /
 *   MTF_NETGAME).
 * @param skill Current `gameskill` value (0..4).
 * @param isNetGame `true` for cooperative / deathmatch; `false` for
 *   single-player.
 * @returns A frozen {@link MonsterSpawnVerdict}.
 */
export function evaluateMonsterSpawn(mapThingOptions: number, skill: VanillaSkillLevel, isNetGame: boolean): MonsterSpawnVerdict {
  const initialState = initMonsterSpawnState(mapThingOptions);
  if (!isNetGame && (mapThingOptions & VANILLA_MTF_NETGAME) !== 0) {
    return Object.freeze({ ambush: initialState.hasAmbushBit, initialState, mobjFlagsToOr: 0, shouldSpawn: false });
  }
  const skillBit = selectSkillBit(skill);
  if ((mapThingOptions & skillBit) === 0) {
    return Object.freeze({ ambush: initialState.hasAmbushBit, initialState, mobjFlagsToOr: 0, shouldSpawn: false });
  }
  const mobjFlagsToOr = initialState.hasAmbushBit ? VANILLA_MF_AMBUSH_RUNTIME : 0;
  return Object.freeze({
    ambush: initialState.hasAmbushBit,
    initialState,
    mobjFlagsToOr,
    shouldSpawn: true,
  });
}
