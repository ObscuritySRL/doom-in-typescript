import { describe, expect, test } from 'bun:test';

import {
  VANILLA_BONUSADD,
  VANILLA_CARD_INDEX_NAMES,
  VANILLA_IT_BLUECARD,
  VANILLA_IT_BLUESKULL,
  VANILLA_IT_REDCARD,
  VANILLA_IT_REDSKULL,
  VANILLA_IT_YELLOWCARD,
  VANILLA_IT_YELLOWSKULL,
  VANILLA_NUMCARDS,
  applyVanillaKeyPickup,
} from '../../../src/player/implement-keycard-and-skull-key-pickups.ts';

describe('vanilla card enum (doomdef.h card_t)', () => {
  test('bluecard=0, yellowcard=1, redcard=2, blueskull=3, yellowskull=4, redskull=5', () => {
    expect(VANILLA_IT_BLUECARD).toBe(0);
    expect(VANILLA_IT_YELLOWCARD).toBe(1);
    expect(VANILLA_IT_REDCARD).toBe(2);
    expect(VANILLA_IT_BLUESKULL).toBe(3);
    expect(VANILLA_IT_YELLOWSKULL).toBe(4);
    expect(VANILLA_IT_REDSKULL).toBe(5);
  });

  test('NUMCARDS is 6', () => {
    expect(VANILLA_NUMCARDS).toBe(6);
  });

  test('card index names match canonical enum ordering', () => {
    expect([...VANILLA_CARD_INDEX_NAMES]).toEqual(['bluecard', 'yellowcard', 'redcard', 'blueskull', 'yellowskull', 'redskull']);
  });
});

describe('vanilla BONUSADD pickup tint constant', () => {
  test('BONUSADD is 6 (per p_inter.c)', () => {
    expect(VANILLA_BONUSADD).toBe(6);
  });
});

describe('applyVanillaKeyPickup', () => {
  test('first pickup of a card grants it and adds BONUSADD', () => {
    const result = applyVanillaKeyPickup({ cardIndex: VANILLA_IT_BLUECARD, currentlyOwned: false });
    expect(result.gave).toBe(true);
    expect(result.cardIndex).toBe(VANILLA_IT_BLUECARD);
    expect(result.bonusCountAdd).toBe(VANILLA_BONUSADD);
  });

  test('second pickup of an already-owned card is a no-op', () => {
    const result = applyVanillaKeyPickup({ cardIndex: VANILLA_IT_REDSKULL, currentlyOwned: true });
    expect(result.gave).toBe(false);
    expect(result.bonusCountAdd).toBe(0);
  });

  test('result is frozen', () => {
    const result = applyVanillaKeyPickup({ cardIndex: VANILLA_IT_YELLOWCARD, currentlyOwned: false });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
