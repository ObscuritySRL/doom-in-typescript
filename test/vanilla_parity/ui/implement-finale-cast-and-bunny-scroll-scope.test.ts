import { describe, expect, test } from 'bun:test';

import { resolveVanillaFinalePostTextScope, vanillaFinaleBunnyScrollIsAvailable, vanillaFinaleCastCallIsAvailable } from '../../../src/ui/implement-finale-cast-and-bunny-scroll-scope.ts';

describe('resolveVanillaFinalePostTextScope — commercial', () => {
  test('commercial always cast-call', () => {
    expect(resolveVanillaFinalePostTextScope({ gameMode: 'commercial', episode: 1 })).toBe('cast-call');
    expect(resolveVanillaFinalePostTextScope({ gameMode: 'commercial', episode: 2 })).toBe('cast-call');
  });
});

describe('resolveVanillaFinalePostTextScope — non-commercial episode 1', () => {
  test('shareware episode 1 bunny-scroll', () => {
    expect(resolveVanillaFinalePostTextScope({ gameMode: 'shareware', episode: 1 })).toBe('bunny-scroll');
  });

  test('registered episode 1 bunny-scroll', () => {
    expect(resolveVanillaFinalePostTextScope({ gameMode: 'registered', episode: 1 })).toBe('bunny-scroll');
  });

  test('retail episode 1 bunny-scroll', () => {
    expect(resolveVanillaFinalePostTextScope({ gameMode: 'retail', episode: 1 })).toBe('bunny-scroll');
  });
});

describe('resolveVanillaFinalePostTextScope — non-commercial episodes 2/3/4', () => {
  test('episode 2 -> static-art', () => {
    expect(resolveVanillaFinalePostTextScope({ gameMode: 'registered', episode: 2 })).toBe('static-art');
  });

  test('episode 3 -> static-art', () => {
    expect(resolveVanillaFinalePostTextScope({ gameMode: 'registered', episode: 3 })).toBe('static-art');
  });

  test('episode 4 (Thy Flesh Consumed) -> static-art', () => {
    expect(resolveVanillaFinalePostTextScope({ gameMode: 'retail', episode: 4 })).toBe('static-art');
  });
});

describe('vanillaFinaleBunnyScrollIsAvailable', () => {
  test('available only for non-commercial episode 1', () => {
    expect(vanillaFinaleBunnyScrollIsAvailable({ gameMode: 'shareware', episode: 1 })).toBe(true);
    expect(vanillaFinaleBunnyScrollIsAvailable({ gameMode: 'commercial', episode: 1 })).toBe(false);
    expect(vanillaFinaleBunnyScrollIsAvailable({ gameMode: 'shareware', episode: 2 })).toBe(false);
  });
});

describe('vanillaFinaleCastCallIsAvailable', () => {
  test('cast call only in commercial mode', () => {
    expect(vanillaFinaleCastCallIsAvailable('commercial')).toBe(true);
    expect(vanillaFinaleCastCallIsAvailable('shareware')).toBe(false);
    expect(vanillaFinaleCastCallIsAvailable('registered')).toBe(false);
    expect(vanillaFinaleCastCallIsAvailable('retail')).toBe(false);
  });
});
