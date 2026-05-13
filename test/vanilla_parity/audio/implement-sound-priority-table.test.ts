import { describe, expect, test } from 'bun:test';

import { VANILLA_NEW_SOUND_DROP_RULE, VANILLA_NORM_PRIORITY, VANILLA_PRIORITY_ARBITRATION_RULE, arbitrateVanillaSoundPriority } from '../../../src/audio/implement-sound-priority-table.ts';
import { NORM_PRIORITY } from '../../../src/audio/channels.ts';

describe('vanilla sound priority arbitration pin', () => {
  test('NORM_PRIORITY baseline is 64 and matches channels.ts runtime constant', () => {
    expect(VANILLA_NORM_PRIORITY).toBe(64);
    expect(VANILLA_NORM_PRIORITY).toBe(NORM_PRIORITY);
  });

  test('arbitration rule is lower-number-wins', () => {
    expect(VANILLA_PRIORITY_ARBITRATION_RULE).toBe('lower-number-wins');
  });

  test('drop rule is reject when incoming is strictly more important than all actives', () => {
    expect(VANILLA_NEW_SOUND_DROP_RULE).toBe('reject-if-priority-strictly-larger-than-all-active');
  });

  test('evicts the first channel whose priority is >= incoming (ties evict first)', () => {
    const decision = arbitrateVanillaSoundPriority({ incomingPriority: 64, activeChannelPriorities: [32, 70, 100] });
    expect(decision.drop).toBe(false);
    expect(decision.evictChannelIndex).toBe(1);
  });

  test('tied priority evicts the first equal channel encountered', () => {
    const decision = arbitrateVanillaSoundPriority({ incomingPriority: 64, activeChannelPriorities: [64, 64, 64] });
    expect(decision.evictChannelIndex).toBe(0);
    expect(decision.drop).toBe(false);
  });

  test('drops the new sound when every active channel is strictly more important', () => {
    const decision = arbitrateVanillaSoundPriority({ incomingPriority: 100, activeChannelPriorities: [32, 60, 64] });
    expect(decision.drop).toBe(true);
    expect(decision.evictChannelIndex).toBe(null);
  });

  test('first scan picks index 0 when all actives are >= incoming', () => {
    const decision = arbitrateVanillaSoundPriority({ incomingPriority: 32, activeChannelPriorities: [64, 70, 100] });
    expect(decision.evictChannelIndex).toBe(0);
  });

  test('empty channel table results in drop (no slot to evict)', () => {
    const decision = arbitrateVanillaSoundPriority({ incomingPriority: 64, activeChannelPriorities: [] });
    expect(decision.drop).toBe(true);
    expect(decision.evictChannelIndex).toBe(null);
  });
});
