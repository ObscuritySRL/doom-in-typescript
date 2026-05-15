/**
 * Vanilla DOOM 1.9 hitscan-weapon wiring facade.
 *
 * Plan_final step `09-005` (lane: player-weapons-items) wires the
 * six hitscan weapon fire actions — fist (`A_Punch`), chainsaw
 * (`A_Saw`), pistol (`A_FirePistol`), shotgun (`A_FireShotgun`),
 * super-shotgun (`A_FireShotgun2`), and chaingun (`A_FireCGun`) —
 * plus the shared bullet-aim / line-attack machinery, over the
 * read-only `src/player/hitscan.ts` module.
 *
 * That module already implements the byte-exact p_pspr.c weapon
 * codepointers + p_map.c P_AimLineAttack/P_LineAttack behavior and
 * is SHA-pinned by the inventory; this module does NOT modify it.
 * It is a pure re-export barrel (value/type split for
 * `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. Fist and chainsaw use `MELEERANGE` = 64·FRACUNIT reach;
 *      bullet weapons trace to `MISSILERANGE` = 32·64·FRACUNIT.
 *   2. Auto-aim sweeps `BULLET_AIM_RANGE` = 16·64·FRACUNIT and
 *      nudges the search by `BULLET_AIM_NUDGE` = 1<<26 each side.
 *   3. The chainsaw spreads its hit angle by `SAW_ANGLE_STEP`
 *      (ANG90/20) and snaps the attacker toward the target by
 *      `SAW_ANGLE_SNAP` (ANG90/21).
 *   4. The weapon sounds are the fixed vanilla sfx ids
 *      (`SFX_PISTOL` 1, `SFX_SHOTGN` 2, `SFX_DSHTGN` 4,
 *      `SFX_SAWFUL` 13, `SFX_SAWHIT` 14, `SFX_PUNCH` 84).
 *   5. `wireHitscanActions` registers exactly
 *      `HITSCAN_ACTION_COUNT` = 8 weapon codepointers.
 *
 * @example
 * ```ts
 * import { MELEERANGE, HITSCAN_ACTION_COUNT, VANILLA_HITSCAN_WEAPON_INVARIANTS } from './wireHitscanWeapons.ts';
 * MELEERANGE;                                    // 4194304
 * HITSCAN_ACTION_COUNT;                          // 8
 * VANILLA_HITSCAN_WEAPON_INVARIANTS.length;      // 5
 * ```
 */

export {
  BULLET_AIM_NUDGE,
  BULLET_AIM_RANGE,
  HITSCAN_ACTION_COUNT,
  MELEERANGE,
  MISSILERANGE,
  SAW_ANGLE_SNAP,
  SAW_ANGLE_STEP,
  SFX_DSHTGN,
  SFX_PISTOL,
  SFX_PUNCH,
  SFX_SAWFUL,
  SFX_SAWHIT,
  SFX_SHOTGN,
  aFireCGun,
  aFirePistol,
  aFireShotgun,
  aFireShotgun2,
  aPunch,
  aSaw,
  bulletSlope,
  getBulletSlope,
  getHitscanContext,
  getLineTarget,
  gunShot,
  resetHitscanAimCache,
  setHitscanContext,
  wireHitscanActions,
} from '../player/hitscan.ts';
export type { AimLineAttackFunction, AimLineAttackResult, HitscanContext, LineAttackFunction, PointToAngle2Function, StartSoundFunction } from '../player/hitscan.ts';

/**
 * One pinned hitscan-weapon parity invariant.
 */
export interface VanillaHitscanWeaponInvariant {
  readonly id: 'AUTOAIM_USES_BULLET_AIM_RANGE_AND_NUDGE' | 'CHAINSAW_USES_SAW_ANGLE_SPREAD_AND_SNAP' | 'FIST_AND_SAW_USE_MELEERANGE' | 'HITSCAN_REGISTERS_EIGHT_WEAPON_ACTIONS' | 'WEAPON_SFX_IDS_MATCH_VANILLA';
  readonly rule: string;
}

/**
 * Frozen manifest of the five hitscan-weapon parity invariants this
 * step pins.  A later step that wires the live weapon state machine
 * must preserve all five.
 */
export const VANILLA_HITSCAN_WEAPON_INVARIANTS: readonly VanillaHitscanWeaponInvariant[] = Object.freeze([
  Object.freeze({
    id: 'AUTOAIM_USES_BULLET_AIM_RANGE_AND_NUDGE',
    rule: 'bulletSlope auto-aim sweeps BULLET_AIM_RANGE = 16*64*FRACUNIT and nudges the aim search by BULLET_AIM_NUDGE = 1<<26 to each side, matching p_pspr.c P_BulletSlope.',
  } satisfies VanillaHitscanWeaponInvariant),
  Object.freeze({
    id: 'CHAINSAW_USES_SAW_ANGLE_SPREAD_AND_SNAP',
    rule: 'aSaw spreads its hit angle by SAW_ANGLE_STEP (ANG90/20) and snaps the attacker toward the struck target by SAW_ANGLE_SNAP (ANG90/21), matching p_pspr.c A_Saw.',
  } satisfies VanillaHitscanWeaponInvariant),
  Object.freeze({
    id: 'FIST_AND_SAW_USE_MELEERANGE',
    rule: 'aPunch (fist) and aSaw (chainsaw) attack within MELEERANGE = 64*FRACUNIT; bullet weapons trace to MISSILERANGE = 32*64*FRACUNIT.',
  } satisfies VanillaHitscanWeaponInvariant),
  Object.freeze({
    id: 'HITSCAN_REGISTERS_EIGHT_WEAPON_ACTIONS',
    rule: 'wireHitscanActions registers exactly HITSCAN_ACTION_COUNT = 8 weapon codepointers (the six fire actions plus the shared gunShot / refire helpers).',
  } satisfies VanillaHitscanWeaponInvariant),
  Object.freeze({
    id: 'WEAPON_SFX_IDS_MATCH_VANILLA',
    rule: 'The weapon sounds are the fixed vanilla sfx ids SFX_PISTOL 1, SFX_SHOTGN 2, SFX_DSHTGN 4, SFX_SAWFUL 13, SFX_SAWHIT 14, SFX_PUNCH 84.',
  } satisfies VanillaHitscanWeaponInvariant),
]);
