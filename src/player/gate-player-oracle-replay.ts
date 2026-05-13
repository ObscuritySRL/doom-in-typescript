/**
 * Gate step 07-034: pin the canonical scripted oracle scenario sets for the
 * player lane so regressions surface in one place.
 *
 * Aggregates the scripted pickup oracle from 07-030 and the scripted combat
 * oracle from 07-031 plus the BT_USE edge-latch outcome from 07-029.
 * The focused test re-runs all three oracle suites against the canonical
 * implementations so a single regression yields a single failing gate test.
 */

import { VANILLA_SCRIPTED_COMBAT_ORACLES } from './compare-scripted-combat-oracle.ts';
import { VANILLA_SCRIPTED_PICKUP_ORACLES } from './compare-scripted-pickup-oracle.ts';
import { applyVanillaPlayerDamage } from './implement-player-damage-and-armor.ts';
import { classifyVanillaPlayerUseAction } from './implement-player-use-action.ts';

export const PLAYER_ORACLE_REPLAY_GATE = Object.freeze({
  combatScenarioCount: VANILLA_SCRIPTED_COMBAT_ORACLES.length,
  pickupScenarioCount: VANILLA_SCRIPTED_PICKUP_ORACLES.length,
  combatOracles: VANILLA_SCRIPTED_COMBAT_ORACLES,
  pickupOracles: VANILLA_SCRIPTED_PICKUP_ORACLES,
} as const);

export type PlayerOracleReplayGate = typeof PLAYER_ORACLE_REPLAY_GATE;

export function replayCombatOracles(): readonly { readonly id: string; readonly passed: boolean }[] {
  return VANILLA_SCRIPTED_COMBAT_ORACLES.map((scenario) => {
    const result = applyVanillaPlayerDamage({
      damage: scenario.damage,
      health: scenario.preHealth,
      armorPoints: scenario.preArmorPoints,
      armorType: scenario.preArmorType,
      godMode: scenario.hasGodMode,
      babySkill: scenario.hasBabySkill,
    });
    return {
      id: scenario.id,
      passed: result.health === scenario.expectedHealth && result.armorPoints === scenario.expectedArmorPoints && result.armorType === scenario.expectedArmorType,
    };
  });
}

export function replayUseLatchEdgeCase(): boolean {
  const firstPress = classifyVanillaPlayerUseAction({ buttonHeld: true, previousUsedown: false });
  const heldFrame = classifyVanillaPlayerUseAction({ buttonHeld: true, previousUsedown: true });
  const released = classifyVanillaPlayerUseAction({ buttonHeld: false, previousUsedown: true });
  return firstPress.fireUseEvent && !heldFrame.fireUseEvent && !released.fireUseEvent && !released.nextUsedown;
}
