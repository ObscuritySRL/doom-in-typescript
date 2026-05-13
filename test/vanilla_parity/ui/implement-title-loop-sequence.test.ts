import { describe, expect, test } from 'bun:test';

import {
  VANILLA_INTERLUDE_PAGETIC,
  VANILLA_TITLEPIC_PAGETIC_COMMERCIAL,
  VANILLA_TITLEPIC_PAGETIC_NON_COMMERCIAL,
  VANILLA_TITLE_CYCLE_LENGTH,
  advanceVanillaTitleSequence,
  computeVanillaTitleStep,
} from '../../../src/ui/implement-title-loop-sequence.ts';

describe('vanilla title-loop constants', () => {
  test('cycle length is 6 across all game modes', () => {
    expect(VANILLA_TITLE_CYCLE_LENGTH).toBe(6);
  });

  test('non-commercial TITLEPIC pagetic is literal 170', () => {
    expect(VANILLA_TITLEPIC_PAGETIC_NON_COMMERCIAL).toBe(170);
  });

  test('commercial TITLEPIC pagetic is TICRATE*11 = 385', () => {
    expect(VANILLA_TITLEPIC_PAGETIC_COMMERCIAL).toBe(385);
  });

  test('interlude pagetic for CREDIT/HELP2 and commercial state-4 TITLEPIC is 200', () => {
    expect(VANILLA_INTERLUDE_PAGETIC).toBe(200);
  });
});

describe('advanceVanillaTitleSequence', () => {
  test('starts at 0 from initial -1 sentinel', () => {
    expect(advanceVanillaTitleSequence(-1)).toBe(0);
  });

  test('wraps modulo 6', () => {
    expect(advanceVanillaTitleSequence(0)).toBe(1);
    expect(advanceVanillaTitleSequence(5)).toBe(0);
  });
});

describe('computeVanillaTitleStep — shareware', () => {
  test('state 0: TITLEPIC + D_INTRO + pagetic 170', () => {
    const step = computeVanillaTitleStep('shareware', 0);
    expect(step.kind).toBe('page');
    if (step.kind !== 'page') throw new Error('unreachable');
    expect(step.lumpName).toBe('TITLEPIC');
    expect(step.pagetic).toBe(170);
    expect(step.musicLump).toBe('D_INTRO');
  });

  test('state 1: DEMO1 playback', () => {
    const step = computeVanillaTitleStep('shareware', 1);
    expect(step.kind).toBe('demo');
    if (step.kind !== 'demo') throw new Error('unreachable');
    expect(step.demoLump).toBe('DEMO1');
  });

  test('state 2: CREDIT page with no music change', () => {
    const step = computeVanillaTitleStep('shareware', 2);
    expect(step.kind).toBe('page');
    if (step.kind !== 'page') throw new Error('unreachable');
    expect(step.lumpName).toBe('CREDIT');
    expect(step.pagetic).toBe(200);
    expect(step.musicLump).toBeNull();
  });

  test('state 3: DEMO2 playback', () => {
    const step = computeVanillaTitleStep('shareware', 3);
    expect(step.kind).toBe('demo');
    if (step.kind !== 'demo') throw new Error('unreachable');
    expect(step.demoLump).toBe('DEMO2');
  });

  test('state 4: HELP2 page (no music)', () => {
    const step = computeVanillaTitleStep('shareware', 4);
    expect(step.kind).toBe('page');
    if (step.kind !== 'page') throw new Error('unreachable');
    expect(step.lumpName).toBe('HELP2');
    expect(step.pagetic).toBe(200);
    expect(step.musicLump).toBeNull();
  });

  test('state 5: DEMO3 playback', () => {
    const step = computeVanillaTitleStep('shareware', 5);
    expect(step.kind).toBe('demo');
    if (step.kind !== 'demo') throw new Error('unreachable');
    expect(step.demoLump).toBe('DEMO3');
  });
});

describe('computeVanillaTitleStep — registered', () => {
  test('state 4: HELP2 page (matches shareware non-retail behavior)', () => {
    const step = computeVanillaTitleStep('registered', 4);
    expect(step.kind).toBe('page');
    if (step.kind !== 'page') throw new Error('unreachable');
    expect(step.lumpName).toBe('HELP2');
  });
});

describe('computeVanillaTitleStep — retail (Ultimate Doom)', () => {
  test('state 4: CREDIT page (Ultimate Doom shows CREDIT instead of HELP2)', () => {
    const step = computeVanillaTitleStep('retail', 4);
    expect(step.kind).toBe('page');
    if (step.kind !== 'page') throw new Error('unreachable');
    expect(step.lumpName).toBe('CREDIT');
    expect(step.pagetic).toBe(200);
    expect(step.musicLump).toBeNull();
  });
});

describe('computeVanillaTitleStep — commercial (Doom II)', () => {
  test('state 0: TITLEPIC + D_DM2TTL + pagetic 385 (TICRATE*11)', () => {
    const step = computeVanillaTitleStep('commercial', 0);
    expect(step.kind).toBe('page');
    if (step.kind !== 'page') throw new Error('unreachable');
    expect(step.lumpName).toBe('TITLEPIC');
    expect(step.pagetic).toBe(385);
    expect(step.musicLump).toBe('D_DM2TTL');
  });

  test('state 4: TITLEPIC + D_DM2TTL with interlude pagetic 200', () => {
    const step = computeVanillaTitleStep('commercial', 4);
    expect(step.kind).toBe('page');
    if (step.kind !== 'page') throw new Error('unreachable');
    expect(step.lumpName).toBe('TITLEPIC');
    expect(step.pagetic).toBe(200);
    expect(step.musicLump).toBe('D_DM2TTL');
  });
});

describe('computeVanillaTitleStep — frozen results', () => {
  test('returned steps are frozen', () => {
    const step = computeVanillaTitleStep('shareware', 0);
    expect(Object.isFrozen(step)).toBe(true);
  });
});

describe('computeVanillaTitleStep — modular wraparound', () => {
  test('demosequence values wrap mod 6 (state 6 == state 0)', () => {
    const stepZero = computeVanillaTitleStep('shareware', 0);
    const stepSix = computeVanillaTitleStep('shareware', 6);
    expect(stepSix).toEqual(stepZero);
  });

  test('negative demosequence wraps positively', () => {
    const stepNegOne = computeVanillaTitleStep('shareware', -1);
    const stepFive = computeVanillaTitleStep('shareware', 5);
    expect(stepNegOne).toEqual(stepFive);
  });
});
