import { describe, expect, test } from 'bun:test';

import { advanceVanillaReadThisPage, getVanillaReadThisSequence, vanillaReadThisIsReachableFromMainMenu } from '../../../src/ui/implement-read-this-help-pages.ts';

describe('getVanillaReadThisSequence — shareware', () => {
  test('shareware shows HELP1 then HELP2', () => {
    const seq = getVanillaReadThisSequence('shareware');
    expect([...seq.pages]).toEqual(['HELP1', 'HELP2']);
    expect(seq.returnsToMainMenu).toBe(true);
  });
});

describe('getVanillaReadThisSequence — registered', () => {
  test('registered shows HELP1 then HELP2 (same as shareware)', () => {
    const seq = getVanillaReadThisSequence('registered');
    expect([...seq.pages]).toEqual(['HELP1', 'HELP2']);
  });
});

describe('getVanillaReadThisSequence — retail (Ultimate Doom)', () => {
  test('retail shows HELP1 only (M_FinishReadThis fires directly)', () => {
    const seq = getVanillaReadThisSequence('retail');
    expect([...seq.pages]).toEqual(['HELP1']);
    expect(seq.returnsToMainMenu).toBe(true);
  });
});

describe('getVanillaReadThisSequence — commercial (Doom II)', () => {
  test('commercial shows no help pages from the menu', () => {
    const seq = getVanillaReadThisSequence('commercial');
    expect(seq.pages.length).toBe(0);
  });
});

describe('vanillaReadThisIsReachableFromMainMenu', () => {
  test('shareware/registered/retail are reachable', () => {
    expect(vanillaReadThisIsReachableFromMainMenu('shareware')).toBe(true);
    expect(vanillaReadThisIsReachableFromMainMenu('registered')).toBe(true);
    expect(vanillaReadThisIsReachableFromMainMenu('retail')).toBe(true);
  });

  test('commercial is not reachable (read-this entry removed)', () => {
    expect(vanillaReadThisIsReachableFromMainMenu('commercial')).toBe(false);
  });
});

describe('advanceVanillaReadThisPage', () => {
  test('shareware: HELP1 advances to next-page (HELP2)', () => {
    const seq = getVanillaReadThisSequence('shareware');
    expect(advanceVanillaReadThisPage(seq, 0)).toBe('next-page');
  });

  test('shareware: HELP2 advances to main-menu', () => {
    const seq = getVanillaReadThisSequence('shareware');
    expect(advanceVanillaReadThisPage(seq, 1)).toBe('main-menu');
  });

  test('retail: HELP1 advances directly to main-menu', () => {
    const seq = getVanillaReadThisSequence('retail');
    expect(advanceVanillaReadThisPage(seq, 0)).toBe('main-menu');
  });
});

describe('sequence immutability', () => {
  test('returned sequences and their pages are frozen', () => {
    const seq = getVanillaReadThisSequence('shareware');
    expect(Object.isFrozen(seq)).toBe(true);
    expect(Object.isFrozen(seq.pages)).toBe(true);
  });
});
