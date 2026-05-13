import { describe, expect, test } from 'bun:test';

import { VANILLA_SKYFLATNAME, VANILLA_SKYTEXTUREMID_FIXED, selectVanillaSkyTextureLumpName, vanillaSkyTextureExistsInGameMode } from '../../../src/render/implement-sky-rendering-semantics.ts';

describe('sky constants', () => {
  test('SKYFLATNAME = F_SKY1', () => {
    expect(VANILLA_SKYFLATNAME).toBe('F_SKY1');
  });

  test('skytexturemid = 100 * FRACUNIT', () => {
    expect(VANILLA_SKYTEXTUREMID_FIXED).toBe(100 * 0x10000);
  });
});

describe('selectVanillaSkyTextureLumpName — commercial', () => {
  test('Doom II maps 1..11 -> SKY1', () => {
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'commercial', gameEpisode: 1, gameMap: 1 })).toBe('SKY1');
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'commercial', gameEpisode: 1, gameMap: 11 })).toBe('SKY1');
  });

  test('Doom II maps 12..20 -> SKY2', () => {
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'commercial', gameEpisode: 1, gameMap: 12 })).toBe('SKY2');
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'commercial', gameEpisode: 1, gameMap: 20 })).toBe('SKY2');
  });

  test('Doom II maps 21+ -> SKY3', () => {
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'commercial', gameEpisode: 1, gameMap: 21 })).toBe('SKY3');
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'commercial', gameEpisode: 1, gameMap: 32 })).toBe('SKY3');
  });
});

describe('selectVanillaSkyTextureLumpName — non-commercial', () => {
  test('episode 1 -> SKY1', () => {
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'shareware', gameEpisode: 1, gameMap: 1 })).toBe('SKY1');
  });

  test('episode 2 -> SKY2', () => {
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'registered', gameEpisode: 2, gameMap: 1 })).toBe('SKY2');
  });

  test('episode 3 -> SKY3', () => {
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'registered', gameEpisode: 3, gameMap: 1 })).toBe('SKY3');
  });

  test('episode 4 (Ultimate) -> SKY4', () => {
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'retail', gameEpisode: 4, gameMap: 1 })).toBe('SKY4');
  });

  test('unknown episode falls back to SKY1', () => {
    expect(selectVanillaSkyTextureLumpName({ gameMode: 'shareware', gameEpisode: 99, gameMap: 1 })).toBe('SKY1');
  });
});

describe('vanillaSkyTextureExistsInGameMode', () => {
  test('SKY1/SKY2/SKY3 exist in all modes', () => {
    expect(vanillaSkyTextureExistsInGameMode('SKY1', 'shareware')).toBe(true);
    expect(vanillaSkyTextureExistsInGameMode('SKY2', 'shareware')).toBe(true);
    expect(vanillaSkyTextureExistsInGameMode('SKY3', 'commercial')).toBe(true);
  });

  test('SKY4 only exists in retail (Ultimate Doom)', () => {
    expect(vanillaSkyTextureExistsInGameMode('SKY4', 'retail')).toBe(true);
    expect(vanillaSkyTextureExistsInGameMode('SKY4', 'shareware')).toBe(false);
    expect(vanillaSkyTextureExistsInGameMode('SKY4', 'registered')).toBe(false);
    expect(vanillaSkyTextureExistsInGameMode('SKY4', 'commercial')).toBe(false);
  });
});
