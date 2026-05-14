import { describe, expect, test } from 'bun:test';

import { VANILLA_VIEW_BORDER_BACKGROUND_DOOM1, VANILLA_VIEW_BORDER_BACKGROUND_DOOM2, VANILLA_VIEW_BORDER_PATCHES, getViewBorderBackground } from '../../../src/render/implement-view-border-rendering.ts';

describe('vanilla view border constants', () => {
  test('8 border patches (4 edges + 4 corners)', () => {
    expect(VANILLA_VIEW_BORDER_PATCHES).toHaveLength(8);
    expect([...VANILLA_VIEW_BORDER_PATCHES]).toEqual(['BRDR_T', 'BRDR_B', 'BRDR_L', 'BRDR_R', 'BRDR_TL', 'BRDR_TR', 'BRDR_BL', 'BRDR_BR']);
  });

  test('background flats: DOOM 1 = FLOOR7_2, DOOM 2 = GRNROCK', () => {
    expect(VANILLA_VIEW_BORDER_BACKGROUND_DOOM1).toBe('FLOOR7_2');
    expect(VANILLA_VIEW_BORDER_BACKGROUND_DOOM2).toBe('GRNROCK');
  });
});

describe('getViewBorderBackground', () => {
  test('commercial gamemode uses GRNROCK', () => {
    expect(getViewBorderBackground('commercial')).toBe(VANILLA_VIEW_BORDER_BACKGROUND_DOOM2);
  });

  test('DOOM 1 gamemodes use FLOOR7_2', () => {
    expect(getViewBorderBackground('shareware')).toBe(VANILLA_VIEW_BORDER_BACKGROUND_DOOM1);
    expect(getViewBorderBackground('registered')).toBe(VANILLA_VIEW_BORDER_BACKGROUND_DOOM1);
    expect(getViewBorderBackground('retail')).toBe(VANILLA_VIEW_BORDER_BACKGROUND_DOOM1);
  });
});
