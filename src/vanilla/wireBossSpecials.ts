/**
 * Vanilla DOOM 1.9 boss-special wiring facade.
 *
 * Plan_final step `10-006` (lane: ai-specials) wires the
 * boss-death specials — the shareware E1M8 Baron death (lower the
 * tag-666 floor), `A_KeenDie`, `A_PainDie`, and the guarded
 * registered/Ultimate (E2M8 Cyberdemon / E3M8 Spider Mastermind)
 * and commercial Icy-of-Sin brain paths — over the read-only
 * `src/ai/bossSpecials.ts` module, all tag-based and IWAD-agnostic
 * (no proprietary IWAD required).
 *
 * That module already implements the byte-exact p_enemy.c
 * `A_BossDeath` / `A_KeenDie` / `A_Brain*` behavior and is
 * SHA-pinned by the inventory; this module does NOT modify it.
 * It is a pure re-export barrel (value/type split for
 * `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. The shareware E1M8 Baron death (`A_BossDeath`) lowers the
 *      `BOSS_DEATH_TAG` = 666 floor to the lowest neighbor when the
 *      last boss-type mobj on the map dies.
 *   2. `A_KeenDie` opens the `KEEN_DIE_DOOR_TAG` = 666 door when the
 *      last Commander Keen dies.
 *   3. `A_PainDie` uses the `BOSS_DEATH_BABY_TAG` = 667 path for the
 *      arachnotron-class boss-death floor raise.
 *   4. The registered/Ultimate boss paths (E2M8 Cyberdemon, E3M8
 *      Spider Mastermind) are tag-driven and require no proprietary
 *      IWAD — the same `A_BossDeath` map/skill gate handles them.
 *   5. The Icon-of-Sin brain spitter caps at `MAX_BRAIN_TARGETS`
 *      = 32 targets and is a commercial-only path (not exercised on
 *      the C1 shareware target but preserved for parity).
 *
 * @example
 * ```ts
 * import { BOSS_DEATH_TAG, aBossDeath, VANILLA_BOSS_SPECIALS_INVARIANTS } from './wireBossSpecials.ts';
 * BOSS_DEATH_TAG;                                // 666
 * typeof aBossDeath;                             // 'function'
 * VANILLA_BOSS_SPECIALS_INVARIANTS.length;       // 5
 * ```
 */

export {
  BOSS_DEATH_BABY_TAG,
  BOSS_DEATH_FATSO_TAG,
  BOSS_DEATH_TAG,
  KEEN_DIE_DOOR_TAG,
  MAX_BRAIN_TARGETS,
  SFX_BOSDTH,
  SFX_BOSPIT,
  SFX_BOSSIT,
  SFX_HOOF,
  SFX_METAL,
  SFX_TELEPT,
  aBossDeath,
  aKeenDie,
  aPainDie,
  clearBossSpecialsContext,
  getBossSpecialsContext,
  resetBrainTargets,
  setBossSpecialsContext,
} from '../ai/bossSpecials.ts';
export type { BossDoorType, BossFloorType, BossSpecialsContext } from '../ai/bossSpecials.ts';

/**
 * One pinned boss-special parity invariant.
 */
export interface VanillaBossSpecialsInvariant {
  readonly id: 'BRAIN_TARGETS_CAP_IS_32_COMMERCIAL_ONLY' | 'E1M8_BARON_DEATH_LOWERS_TAG_666_FLOOR' | 'KEEN_DIE_OPENS_TAG_666_DOOR' | 'PAIN_DIE_USES_TAG_667_BABY_PATH' | 'REGISTERED_ULTIMATE_BOSS_PATHS_ARE_IWAD_AGNOSTIC';
  readonly rule: string;
}

/**
 * Frozen manifest of the five boss-special parity invariants this
 * step pins.  A later step that wires the live monster death path
 * must preserve all five.
 */
export const VANILLA_BOSS_SPECIALS_INVARIANTS: readonly VanillaBossSpecialsInvariant[] = Object.freeze([
  Object.freeze({
    id: 'BRAIN_TARGETS_CAP_IS_32_COMMERCIAL_ONLY',
    rule: 'The Icon-of-Sin brain spitter caps at MAX_BRAIN_TARGETS = 32 targets; it is a commercial (Doom 2) path not exercised on the C1 shareware target but preserved for parity.',
  } satisfies VanillaBossSpecialsInvariant),
  Object.freeze({
    id: 'E1M8_BARON_DEATH_LOWERS_TAG_666_FLOOR',
    rule: 'A_BossDeath on the shareware E1M8 lowers the BOSS_DEATH_TAG = 666 floor to its lowest neighbor only when the last boss-type mobj on the map has died, matching p_enemy.c A_BossDeath.',
  } satisfies VanillaBossSpecialsInvariant),
  Object.freeze({
    id: 'KEEN_DIE_OPENS_TAG_666_DOOR',
    rule: 'A_KeenDie opens the KEEN_DIE_DOOR_TAG = 666 door when the last Commander Keen on the map dies, matching p_enemy.c A_KeenDie.',
  } satisfies VanillaBossSpecialsInvariant),
  Object.freeze({
    id: 'PAIN_DIE_USES_TAG_667_BABY_PATH',
    rule: 'A_PainDie / the arachnotron-class boss-death path uses BOSS_DEATH_BABY_TAG = 667 (distinct from the 666 floor/door tag), matching p_enemy.c.',
  } satisfies VanillaBossSpecialsInvariant),
  Object.freeze({
    id: 'REGISTERED_ULTIMATE_BOSS_PATHS_ARE_IWAD_AGNOSTIC',
    rule: 'The registered/Ultimate boss paths (E2M8 Cyberdemon, E3M8 Spider Mastermind) are driven by the same tag-based A_BossDeath map/skill gate and require no proprietary IWAD.',
  } satisfies VanillaBossSpecialsInvariant),
]);
