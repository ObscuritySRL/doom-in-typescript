/**
 * Vanilla DOOM 1.9 monster-triggered special-line effects facade.
 *
 * Plan_final step `10-007` (lane: ai-specials) wires the AI side of
 * special lines — which specials a non-player actor may cross /
 * shoot / use, the monster-only teleport triggers, the switch
 * texture changes that monster impacts cause, and the boss-triggered
 * exit lines — over the read-only `src/specials/lineTriggers.ts`
 * dispatch tables and `src/specials/switches.ts` switch animation.
 *
 * Those modules already implement the byte-exact p_spec.c /
 * p_switch.c behavior and are SHA-pinned by the inventory; this
 * module does NOT modify them.  It is a pure re-export barrel
 * (value/type split for `verbatimModuleSyntax`; the `GameVersion`
 * and `ButtonWhere` `const enum`s are intentionally NOT
 * re-exported) plus a frozen invariants manifest.  The cross/use
 * dispatch and switch animation themselves were pinned by `08-004`;
 * this step pins the monster-eligibility surface.
 *
 * Five parity invariants this step pins:
 *
 *   1. The boss/normal exit cross-triggers 52 (normal) and 124
 *      (secret) never clear `line.special` — the level transitions
 *      before the next tic re-reads the line.
 *   2. Non-player cross eligibility is the exact fixed set
 *      `MONSTER_CROSS_SPECIALS` = `[39, 97, 125, 126, 4, 10, 88]`.
 *   3. Non-player shoot eligibility is `MONSTER_SHOOT_SPECIALS` =
 *      `[46]` and non-player use eligibility is
 *      `MONSTER_USE_SPECIALS` = `[1, 32, 33, 34]`.
 *   4. The monster-only teleport triggers 125 / 126 only fire for a
 *      non-player actor (`thing.player === null`); a player crossing
 *      them does nothing and leaves the line armed.
 *   5. A monster impact on a switch/shoot special flips the switch
 *      texture via `changeSwitchTexture`; `pShootSpecialLine` flips
 *      it unconditionally (no EV_* return-value guard).
 *
 * @example
 * ```ts
 * import { MONSTER_CROSS_SPECIALS, VANILLA_SPECIAL_LINE_AI_INVARIANTS } from './wireSpecialLineAiEffects.ts';
 * MONSTER_CROSS_SPECIALS.length;                   // 7
 * VANILLA_SPECIAL_LINE_AI_INVARIANTS.length;       // 5
 * ```
 */

export { MONSTER_CROSS_SPECIALS, MONSTER_SHOOT_SPECIALS, MONSTER_USE_SPECIALS, NON_TRIGGER_PROJECTILE_TYPES, pCrossSpecialLine, pShootSpecialLine, pUseSpecialLine } from '../specials/lineTriggers.ts';
export type { LineTriggerCallbacks, LineTriggerLine, LineTriggerThing } from '../specials/lineTriggers.ts';
export { BUTTONTIME, EXIT_SWITCH_SPECIAL, SFX_SWTCHN, SFX_SWTCHX, changeSwitchTexture, startButton, updateButtons } from '../specials/switches.ts';
export type { Button, SwitchCallbacks, SwitchLine, SwitchSide } from '../specials/switches.ts';

/**
 * One pinned monster-triggered special-line parity invariant.
 */
export interface VanillaSpecialLineAiInvariant {
  readonly id: 'BOSS_EXIT_LINES_52_124_DO_NOT_CLEAR_SPECIAL' | 'MONSTER_CROSS_ELIGIBILITY_IS_A_FIXED_SET' | 'MONSTER_SHOOT_AND_USE_SETS_ARE_FIXED' | 'MONSTER_TELEPORT_125_126_GATE_ON_NONPLAYER' | 'SWITCH_TEXTURE_FLIPS_ON_MONSTER_IMPACT';
  readonly rule: string;
}

/**
 * Frozen manifest of the five monster-triggered special-line parity
 * invariants this step pins.  A later step that wires the live
 * monster think loop into the specials scheduler must preserve all
 * five.
 */
export const VANILLA_SPECIAL_LINE_AI_INVARIANTS: readonly VanillaSpecialLineAiInvariant[] = Object.freeze([
  Object.freeze({
    id: 'BOSS_EXIT_LINES_52_124_DO_NOT_CLEAR_SPECIAL',
    rule: 'Cross-trigger 52 (normal exit) and 124 (secret exit) call G_ExitLevel / G_SecretExitLevel and never zero line.special, because the level transitions before the next tic re-reads the line (matches the 08-004 cross-clear exception).',
  } satisfies VanillaSpecialLineAiInvariant),
  Object.freeze({
    id: 'MONSTER_CROSS_ELIGIBILITY_IS_A_FIXED_SET',
    rule: 'A non-player actor may only cross-trigger MONSTER_CROSS_SPECIALS = [39, 97, 125, 126, 4, 10, 88]; every other special early-returns for monsters, matching p_spec.c P_CrossSpecialLine.',
  } satisfies VanillaSpecialLineAiInvariant),
  Object.freeze({
    id: 'MONSTER_SHOOT_AND_USE_SETS_ARE_FIXED',
    rule: 'Non-player shoot eligibility is MONSTER_SHOOT_SPECIALS = [46]; non-player use eligibility is MONSTER_USE_SPECIALS = [1, 32, 33, 34] plus the ML_SECRET flag gate, matching p_spec.c / p_switch.c.',
  } satisfies VanillaSpecialLineAiInvariant),
  Object.freeze({
    id: 'MONSTER_TELEPORT_125_126_GATE_ON_NONPLAYER',
    rule: 'Cross specials 125 (one-shot) and 126 (retrigger) only call EV_Teleport when thing.player === null; a player crossing them does nothing and case 125 leaves line.special armed for a later monster.',
  } satisfies VanillaSpecialLineAiInvariant),
  Object.freeze({
    id: 'SWITCH_TEXTURE_FLIPS_ON_MONSTER_IMPACT',
    rule: 'changeSwitchTexture flips the matched top/mid/bottom slot via switchlist[i ^ 1]; pShootSpecialLine flips the switch unconditionally (no EV_* return guard) even on a monster missile impact.',
  } satisfies VanillaSpecialLineAiInvariant),
]);
