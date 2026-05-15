import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  VANILLA_SCREEN_BLOCK_DEFAULT,
  VANILLA_SCREEN_BLOCK_FULLSCREEN,
  VANILLA_SCREEN_BLOCK_MAX,
  VANILLA_SCREEN_BLOCK_MIN,
  VANILLA_VIEW_BORDER_BACKGROUND_DOOM1,
  VANILLA_VIEW_BORDER_BACKGROUND_DOOM2,
  VANILLA_VIEW_BORDER_PATCHES,
  VANILLA_WIPE_BORDER_ENTRY_POINTS,
  getViewBorderBackground,
  isFullscreenScreenBlock,
  isValidScreenBlock,
  scaledViewWidthForScreenBlock,
  viewHeightForScreenBlock,
} from '../../../src/vanilla/wireWipesAndBorders.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireWipesAndBorders.ts');

describe('plan_final render: wire-wipes-and-borders', () => {
  test('src/vanilla/wireWipesAndBorders.ts exists, is a regular file, and cites plan_final step 06-008', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('06-008');
    expect(fileText).toContain('VANILLA_WIPE_BORDER_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only render border + screenblocks modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../render/implement-view-border-rendering.ts'");
    expect(fileText).toContain("from '../render/implement-screen-size-blocks.ts'");
  });

  test('VANILLA_WIPE_BORDER_ENTRY_POINTS pins the five canonical entry points and is frozen', () => {
    expect(VANILLA_WIPE_BORDER_ENTRY_POINTS).toEqual(['getViewBorderBackground', 'isFullscreenScreenBlock', 'isValidScreenBlock', 'scaledViewWidthForScreenBlock', 'viewHeightForScreenBlock']);
    expect(Object.isFrozen(VANILLA_WIPE_BORDER_ENTRY_POINTS)).toBe(true);
  });

  test('the screen-block constants pin the vanilla R_SetViewSize [3, 11] range with default 10 / fullscreen 11', () => {
    expect(VANILLA_SCREEN_BLOCK_MIN).toBe(3);
    expect(VANILLA_SCREEN_BLOCK_MAX).toBe(11);
    expect(VANILLA_SCREEN_BLOCK_DEFAULT).toBe(10);
    expect(VANILLA_SCREEN_BLOCK_FULLSCREEN).toBe(11);
  });

  test('the view-border patch list and background flats pin vanilla r_draw.c values', () => {
    expect(VANILLA_VIEW_BORDER_PATCHES).toEqual(['BRDR_T', 'BRDR_B', 'BRDR_L', 'BRDR_R', 'BRDR_TL', 'BRDR_TR', 'BRDR_BL', 'BRDR_BR']);
    expect(VANILLA_VIEW_BORDER_BACKGROUND_DOOM1).toBe('FLOOR7_2');
    expect(VANILLA_VIEW_BORDER_BACKGROUND_DOOM2).toBe('GRNROCK');
  });

  test('isValidScreenBlock accepts [3, 11] and rejects out-of-range values', () => {
    expect(isValidScreenBlock(3)).toBe(true);
    expect(isValidScreenBlock(10)).toBe(true);
    expect(isValidScreenBlock(11)).toBe(true);
    expect(isValidScreenBlock(2)).toBe(false);
    expect(isValidScreenBlock(12)).toBe(false);
  });

  test('isFullscreenScreenBlock is true only at block 11', () => {
    expect(isFullscreenScreenBlock(11)).toBe(true);
    expect(isFullscreenScreenBlock(10)).toBe(false);
  });

  test('getViewBorderBackground returns FLOOR7_2 for Doom 1 gamemodes and GRNROCK for commercial', () => {
    expect(getViewBorderBackground('shareware')).toBe('FLOOR7_2');
    expect(getViewBorderBackground('registered')).toBe('FLOOR7_2');
    expect(getViewBorderBackground('retail')).toBe('FLOOR7_2');
    expect(getViewBorderBackground('commercial')).toBe('GRNROCK');
  });

  test('every wired function is re-exported as a callable function', () => {
    expect(typeof getViewBorderBackground).toBe('function');
    expect(typeof isValidScreenBlock).toBe('function');
    expect(typeof isFullscreenScreenBlock).toBe('function');
    expect(typeof scaledViewWidthForScreenBlock).toBe('function');
    expect(typeof viewHeightForScreenBlock).toBe('function');
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const borderSource = await import('../../../src/render/implement-view-border-rendering.ts');
    const blockSource = await import('../../../src/render/implement-screen-size-blocks.ts');
    expect(getViewBorderBackground).toBe(borderSource.getViewBorderBackground);
    expect(isValidScreenBlock).toBe(blockSource.isValidScreenBlock);
    expect(viewHeightForScreenBlock).toBe(blockSource.viewHeightForScreenBlock);
  });
});
