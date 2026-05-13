import { describe, expect, test } from 'bun:test';

import { BOSS_EPISODE_EXIT_GATE } from '../../../src/ai/gate-boss-and-episode-exit-semantics.ts';

describe('gate: boss and episode exit semantics', () => {
  test('DOOM 1 trigger count is 5 (E1M8, E2M8, E3M8, E4M6, E4M8)', () => {
    expect(BOSS_EPISODE_EXIT_GATE.doom1TriggerCount).toBe(5);
  });

  test('E1M8 boss death: tag 666, lower-floor-to-lowest, 2 barons', () => {
    expect(BOSS_EPISODE_EXIT_GATE.e1m8Tag).toBe(666);
    expect(BOSS_EPISODE_EXIT_GATE.e1m8Action).toBe('lowerFloorToLowest');
    expect(BOSS_EPISODE_EXIT_GATE.e1m8BaronCount).toBe(2);
  });

  test('All boss-map triggers resolve for their gamemode', () => {
    expect(BOSS_EPISODE_EXIT_GATE.e2m8TriggerExists).toBe(true);
    expect(BOSS_EPISODE_EXIT_GATE.e3m8TriggerExists).toBe(true);
    expect(BOSS_EPISODE_EXIT_GATE.e4m6TriggerExists).toBe(true);
    expect(BOSS_EPISODE_EXIT_GATE.e4m8TriggerExists).toBe(true);
  });

  test('Pain elemental, keen, and Icon of Sin are commercial-only', () => {
    expect(BOSS_EPISODE_EXIT_GATE.painElementalCommercialOnly).toBe(true);
    expect(BOSS_EPISODE_EXIT_GATE.keenCommercialOnly).toBe(true);
    expect(BOSS_EPISODE_EXIT_GATE.iconCommercialOnly).toBe(true);
  });
});
