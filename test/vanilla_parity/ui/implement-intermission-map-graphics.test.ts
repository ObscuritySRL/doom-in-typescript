import { describe, expect, test } from 'bun:test';

import {
  VANILLA_INTERMISSION_SPLAT_LUMP,
  VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS,
  VANILLA_INTERMISSION_YOU_ARE_HERE_LUMPS,
  getVanillaIntermissionBackgroundLump,
  getVanillaYouAreHereLump,
} from '../../../src/ui/implement-intermission-map-graphics.ts';

describe('getVanillaIntermissionBackgroundLump — non-commercial', () => {
  test('episode 1 -> WIMAP0', () => {
    expect(getVanillaIntermissionBackgroundLump({ episode: 1, isCommercial: false })).toBe('WIMAP0');
  });

  test('episode 2 -> WIMAP1', () => {
    expect(getVanillaIntermissionBackgroundLump({ episode: 2, isCommercial: false })).toBe('WIMAP1');
  });

  test('episode 3 -> WIMAP2', () => {
    expect(getVanillaIntermissionBackgroundLump({ episode: 3, isCommercial: false })).toBe('WIMAP2');
  });

  test('episode 4 (Ultimate) -> INTERPIC', () => {
    expect(getVanillaIntermissionBackgroundLump({ episode: 4, isCommercial: false })).toBe('INTERPIC');
  });
});

describe('getVanillaIntermissionBackgroundLump — commercial', () => {
  test('commercial uses INTERPIC for all episodes', () => {
    expect(getVanillaIntermissionBackgroundLump({ episode: 1, isCommercial: true })).toBe('INTERPIC');
    expect(getVanillaIntermissionBackgroundLump({ episode: 2, isCommercial: true })).toBe('INTERPIC');
  });
});

describe('splat and you-are-here constants', () => {
  test('splat lump is WISPLAT', () => {
    expect(VANILLA_INTERMISSION_SPLAT_LUMP).toBe('WISPLAT');
  });

  test('you-are-here lumps are WIURH0 and WIURH1', () => {
    expect([...VANILLA_INTERMISSION_YOU_ARE_HERE_LUMPS]).toEqual(['WIURH0', 'WIURH1']);
  });

  test('blink interval is 9 tics', () => {
    expect(VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS).toBe(9);
  });
});

describe('getVanillaYouAreHereLump', () => {
  test('tics 0..8 -> WIURH0', () => {
    expect(getVanillaYouAreHereLump({ bcntFromOpen: 0 })).toBe('WIURH0');
    expect(getVanillaYouAreHereLump({ bcntFromOpen: 8 })).toBe('WIURH0');
  });

  test('tics 9..17 -> WIURH1', () => {
    expect(getVanillaYouAreHereLump({ bcntFromOpen: 9 })).toBe('WIURH1');
    expect(getVanillaYouAreHereLump({ bcntFromOpen: 17 })).toBe('WIURH1');
  });

  test('tics 18..26 -> WIURH0 (next cycle)', () => {
    expect(getVanillaYouAreHereLump({ bcntFromOpen: 18 })).toBe('WIURH0');
  });
});
