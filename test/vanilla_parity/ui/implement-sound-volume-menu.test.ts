import { describe, expect, test } from 'bun:test';

import {
  VANILLA_SOUND_VOLUME_ENTRY_COUNT,
  VANILLA_SOUND_VOLUME_MAX,
  VANILLA_SOUND_VOLUME_MENU_TREE,
  VANILLA_SOUND_VOLUME_MIN,
  VANILLA_SOUND_VOLUME_SLOT_COUNT,
  clampVanillaSoundVolume,
  getVanillaSoundVolumeMenuTree,
} from '../../../src/ui/implement-sound-volume-menu.ts';

describe('sound volume menu tree', () => {
  test('has 4 entries: SFX slider, separator, music slider, separator', () => {
    expect(VANILLA_SOUND_VOLUME_MENU_TREE.length).toBe(4);
    expect(VANILLA_SOUND_VOLUME_ENTRY_COUNT).toBe(4);
    expect(VANILLA_SOUND_VOLUME_MENU_TREE.map((item) => item.kind)).toEqual(['slider', 'separator', 'slider', 'separator']);
  });

  test('sliders use M_SFXVOL and M_MUSVOL lump names', () => {
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[0]?.lumpName).toBe('M_SFXVOL');
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[2]?.lumpName).toBe('M_MUSVOL');
  });

  test('sliders route to M_SfxVol and M_MusicVol', () => {
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[0]?.routine).toBe('M_SfxVol');
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[2]?.routine).toBe('M_MusicVol');
  });

  test('slider hotkeys are s and m', () => {
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[0]?.hotkey).toBe('s');
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[2]?.hotkey).toBe('m');
  });

  test('slider status bytes are 2', () => {
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[0]?.statusByte).toBe(2);
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[2]?.statusByte).toBe(2);
  });

  test('separator status bytes are -1', () => {
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[1]?.statusByte).toBe(-1);
    expect(VANILLA_SOUND_VOLUME_MENU_TREE[3]?.statusByte).toBe(-1);
  });
});

describe('volume range constants', () => {
  test('range is 0..15 (16 levels)', () => {
    expect(VANILLA_SOUND_VOLUME_MIN).toBe(0);
    expect(VANILLA_SOUND_VOLUME_MAX).toBe(15);
    expect(VANILLA_SOUND_VOLUME_SLOT_COUNT).toBe(16);
  });
});

describe('clampVanillaSoundVolume', () => {
  test('clamps values below 0 to 0', () => {
    expect(clampVanillaSoundVolume({ desiredVolume: -5 })).toBe(0);
    expect(clampVanillaSoundVolume({ desiredVolume: -1 })).toBe(0);
  });

  test('clamps values above 15 to 15', () => {
    expect(clampVanillaSoundVolume({ desiredVolume: 16 })).toBe(15);
    expect(clampVanillaSoundVolume({ desiredVolume: 100 })).toBe(15);
  });

  test('passes through in-range values', () => {
    for (let v = 0; v <= 15; v += 1) {
      expect(clampVanillaSoundVolume({ desiredVolume: v })).toBe(v);
    }
  });

  test('truncates fractional values', () => {
    expect(clampVanillaSoundVolume({ desiredVolume: 7.5 })).toBe(7);
    expect(clampVanillaSoundVolume({ desiredVolume: 12.9 })).toBe(12);
  });
});

describe('getVanillaSoundVolumeMenuTree', () => {
  test('returns the same frozen tree', () => {
    expect(getVanillaSoundVolumeMenuTree()).toBe(VANILLA_SOUND_VOLUME_MENU_TREE);
    expect(Object.isFrozen(getVanillaSoundVolumeMenuTree())).toBe(true);
  });
});
