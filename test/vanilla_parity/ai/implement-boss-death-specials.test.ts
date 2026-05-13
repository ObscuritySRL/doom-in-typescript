import { describe, expect, test } from 'bun:test';

import { VANILLA_DOOM1_BOSS_DEATH_TRIGGERS, findBossDeathTrigger } from '../../../src/ai/implement-boss-death-specials.ts';

describe('vanilla DOOM 1 boss death triggers', () => {
  test('5 episode boss triggers (E1M8, E2M8, E3M8, E4M6, E4M8)', () => {
    expect(VANILLA_DOOM1_BOSS_DEATH_TRIGGERS).toHaveLength(5);
  });

  test('E1M8 baron trigger (shareware): MT_BRUISER=15', () => {
    const t = findBossDeathTrigger({ gameMode: 'shareware', episode: 1, mapNumber: 8 });
    expect(t?.bossType).toBe(15);
    expect(t?.action).toBe('lower-floor-to-lowest');
  });

  test('E2M8 cyber trigger (registered): MT_CYBORG=18', () => {
    const t = findBossDeathTrigger({ gameMode: 'registered', episode: 2, mapNumber: 8 });
    expect(t?.bossType).toBe(18);
  });

  test('E3M8 spider trigger (registered): MT_SPIDER=20', () => {
    const t = findBossDeathTrigger({ gameMode: 'registered', episode: 3, mapNumber: 8 });
    expect(t?.bossType).toBe(20);
  });

  test('E4M6 retail trigger uses tag-666 floor action', () => {
    const t = findBossDeathTrigger({ gameMode: 'retail', episode: 4, mapNumber: 6 });
    expect(t?.action).toBe('lower-floor-tag-666');
  });

  test('non-boss map returns null', () => {
    expect(findBossDeathTrigger({ gameMode: 'shareware', episode: 1, mapNumber: 5 })).toBeNull();
  });
});
