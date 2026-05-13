import { describe, expect, test } from 'bun:test';

import { VANILLA_EPISODE_SHAREWARE_FALLBACK_MENU, VANILLA_EPISODE_SHAREWARE_MESSAGE_KEY, getVanillaEpisodeMenuTree, resolveVanillaEpisodeChoice } from '../../../src/ui/implement-episode-menu-shareware-restrictions.ts';

describe('getVanillaEpisodeMenuTree — shareware', () => {
  test('shareware renders exactly one episode (Knee-Deep)', () => {
    const tree = getVanillaEpisodeMenuTree('shareware');
    expect(tree.length).toBe(1);
    expect(tree[0]?.lumpName).toBe('M_EPI1');
  });
});

describe('getVanillaEpisodeMenuTree — registered', () => {
  test('registered renders 3 episodes (no Thy Flesh Consumed)', () => {
    const tree = getVanillaEpisodeMenuTree('registered');
    expect(tree.length).toBe(3);
    expect(tree.map((item) => item.lumpName)).toEqual(['M_EPI1', 'M_EPI2', 'M_EPI3']);
  });
});

describe('getVanillaEpisodeMenuTree — retail (Ultimate Doom)', () => {
  test('retail renders all 4 episodes', () => {
    const tree = getVanillaEpisodeMenuTree('retail');
    expect(tree.length).toBe(4);
    expect(tree.map((item) => item.lumpName)).toEqual(['M_EPI1', 'M_EPI2', 'M_EPI3', 'M_EPI4']);
  });
});

describe('getVanillaEpisodeMenuTree — commercial', () => {
  test('commercial does not use the episode menu (empty)', () => {
    const tree = getVanillaEpisodeMenuTree('commercial');
    expect(tree.length).toBe(0);
  });
});

describe('episode menu items', () => {
  test('use exact vanilla lump names and hotkeys', () => {
    const tree = getVanillaEpisodeMenuTree('retail');
    expect(tree.map((item) => ({ lump: item.lumpName, key: item.hotkey, idx: item.episodeIndex }))).toEqual([
      { lump: 'M_EPI1', key: 'k', idx: 0 },
      { lump: 'M_EPI2', key: 't', idx: 1 },
      { lump: 'M_EPI3', key: 'i', idx: 2 },
      { lump: 'M_EPI4', key: 't', idx: 3 },
    ]);
  });
});

describe('resolveVanillaEpisodeChoice', () => {
  test('shareware choosing episode index 0 (Knee-Deep) routes to skill menu', () => {
    expect(resolveVanillaEpisodeChoice({ gameMode: 'shareware', choice: 0 })).toBe('skill-menu');
  });

  test('shareware choosing any non-zero index routes to shareware-warning', () => {
    expect(resolveVanillaEpisodeChoice({ gameMode: 'shareware', choice: 1 })).toBe('shareware-warning');
    expect(resolveVanillaEpisodeChoice({ gameMode: 'shareware', choice: 2 })).toBe('shareware-warning');
    expect(resolveVanillaEpisodeChoice({ gameMode: 'shareware', choice: 3 })).toBe('shareware-warning');
  });

  test('registered choosing any episode routes to skill menu', () => {
    expect(resolveVanillaEpisodeChoice({ gameMode: 'registered', choice: 0 })).toBe('skill-menu');
    expect(resolveVanillaEpisodeChoice({ gameMode: 'registered', choice: 1 })).toBe('skill-menu');
    expect(resolveVanillaEpisodeChoice({ gameMode: 'registered', choice: 2 })).toBe('skill-menu');
  });

  test('retail choosing any of the 4 episodes routes to skill menu', () => {
    for (let i = 0; i < 4; i += 1) {
      expect(resolveVanillaEpisodeChoice({ gameMode: 'retail', choice: i })).toBe('skill-menu');
    }
  });
});

describe('shareware fallback constants', () => {
  test('shareware warning message key is SWSTRING', () => {
    expect(VANILLA_EPISODE_SHAREWARE_MESSAGE_KEY).toBe('SWSTRING');
  });

  test('shareware fallback menu is ReadDef1', () => {
    expect(VANILLA_EPISODE_SHAREWARE_FALLBACK_MENU).toBe('ReadDef1');
  });
});

describe('menu tree immutability', () => {
  test('returned arrays and items are frozen', () => {
    const tree = getVanillaEpisodeMenuTree('retail');
    expect(Object.isFrozen(tree)).toBe(true);
    for (const item of tree) {
      expect(Object.isFrozen(item)).toBe(true);
    }
  });
});
