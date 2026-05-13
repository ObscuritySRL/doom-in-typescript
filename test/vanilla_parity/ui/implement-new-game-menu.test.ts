import { describe, expect, test } from 'bun:test';

import { VANILLA_NEWGAME_NETGAME_MESSAGE_KEY, resolveVanillaNewGameRoute } from '../../../src/ui/implement-new-game-menu.ts';

describe('resolveVanillaNewGameRoute — netgame guard', () => {
  test('netgame without demo playback routes to the netgame warning', () => {
    expect(resolveVanillaNewGameRoute({ gameMode: 'shareware', isNetgame: true, isDemoPlayback: false })).toBe('netgame-warning');
    expect(resolveVanillaNewGameRoute({ gameMode: 'commercial', isNetgame: true, isDemoPlayback: false })).toBe('netgame-warning');
  });

  test('netgame during demo playback bypasses the warning', () => {
    expect(resolveVanillaNewGameRoute({ gameMode: 'shareware', isNetgame: true, isDemoPlayback: true })).toBe('episode-menu');
    expect(resolveVanillaNewGameRoute({ gameMode: 'commercial', isNetgame: true, isDemoPlayback: true })).toBe('skill-menu');
  });
});

describe('resolveVanillaNewGameRoute — commercial', () => {
  test('commercial single-player jumps directly to the skill menu', () => {
    expect(resolveVanillaNewGameRoute({ gameMode: 'commercial', isNetgame: false, isDemoPlayback: false })).toBe('skill-menu');
  });

  test('commercial demo playback also routes to skill menu', () => {
    expect(resolveVanillaNewGameRoute({ gameMode: 'commercial', isNetgame: false, isDemoPlayback: true })).toBe('skill-menu');
  });
});

describe('resolveVanillaNewGameRoute — non-commercial', () => {
  test('shareware routes to the episode menu', () => {
    expect(resolveVanillaNewGameRoute({ gameMode: 'shareware', isNetgame: false, isDemoPlayback: false })).toBe('episode-menu');
  });

  test('registered routes to the episode menu', () => {
    expect(resolveVanillaNewGameRoute({ gameMode: 'registered', isNetgame: false, isDemoPlayback: false })).toBe('episode-menu');
  });

  test('retail (Ultimate Doom) routes to the episode menu', () => {
    expect(resolveVanillaNewGameRoute({ gameMode: 'retail', isNetgame: false, isDemoPlayback: false })).toBe('episode-menu');
  });
});

describe('VANILLA_NEWGAME_NETGAME_MESSAGE_KEY', () => {
  test('uses the upstream DeHackEd message key NEWGAME', () => {
    expect(VANILLA_NEWGAME_NETGAME_MESSAGE_KEY).toBe('NEWGAME');
  });
});
