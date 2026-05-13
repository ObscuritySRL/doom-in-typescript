import { describe, expect, test } from 'bun:test';

import { PLAYER_ORACLE_REPLAY_GATE, replayCombatOracles, replayUseLatchEdgeCase } from '../../../src/player/gate-player-oracle-replay.ts';

describe('gate: player oracle replay aggregates scripted oracle suites', () => {
  test('combat oracle scenario count is non-zero', () => {
    expect(PLAYER_ORACLE_REPLAY_GATE.combatScenarioCount).toBeGreaterThan(0);
  });

  test('pickup oracle scenario count is non-zero', () => {
    expect(PLAYER_ORACLE_REPLAY_GATE.pickupScenarioCount).toBeGreaterThan(0);
  });

  test('combat oracle replay passes for every scripted scenario', () => {
    const results = replayCombatOracles();
    for (const { id, passed } of results) {
      expect(passed).toBe(true);
      expect(id.length).toBeGreaterThan(0);
    }
  });

  test('use latch replay validates the BT_USE edge-trigger contract', () => {
    expect(replayUseLatchEdgeCase()).toBe(true);
  });

  test('gate object is frozen', () => {
    expect(Object.isFrozen(PLAYER_ORACLE_REPLAY_GATE)).toBe(true);
  });
});
