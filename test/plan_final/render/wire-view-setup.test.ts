import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { DetailMode, FIELDOFVIEW, SBARHEIGHT, SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';
import { VANILLA_DEFAULT_SET_BLOCKS, VANILLA_FIELD_OF_VIEW_IN_BAM_UNITS, VANILLA_VIEW_SIZE_RANGE, resolveVanillaViewSetup } from '../../../src/vanilla/viewSetup.ts';
import type { VanillaViewSetup } from '../../../src/vanilla/viewSetup.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const VIEW_SETUP_RELATIVE_PATH = 'src/vanilla/viewSetup.ts';
const VIEW_SETUP_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, VIEW_SETUP_RELATIVE_PATH);

describe('plan_final render: wire-view-setup', () => {
  test('src/vanilla/viewSetup.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(VIEW_SETUP_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(VIEW_SETUP_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/viewSetup.ts cites plan_final step 06-001 in a top-of-file comment', () => {
    const fileText = readFileSync(VIEW_SETUP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('06-001');
    expect(fileText).toContain('resolveVanillaViewSetup');
  });

  test('src/vanilla/viewSetup.ts imports the read-only computeViewport helper from src/render/projection.ts without modifying it', () => {
    const fileText = readFileSync(VIEW_SETUP_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('computeViewport');
    expect(fileText).toContain("from '../render/projection.ts'");
  });

  test('VANILLA_VIEW_SIZE_RANGE pins the canonical 3..11 setblocks range', () => {
    expect(VANILLA_VIEW_SIZE_RANGE.minimum).toBe(3);
    expect(VANILLA_VIEW_SIZE_RANGE.maximum).toBe(11);
    expect(Object.isFrozen(VANILLA_VIEW_SIZE_RANGE)).toBe(true);
  });

  test('VANILLA_DEFAULT_SET_BLOCKS matches Chocolate Doom 2.2.1 default.cfg seed of 9', () => {
    expect(VANILLA_DEFAULT_SET_BLOCKS).toBe(9);
  });

  test('VANILLA_FIELD_OF_VIEW_IN_BAM_UNITS pins the vanilla 90-degree FOV constant (2048 BAM units)', () => {
    expect(VANILLA_FIELD_OF_VIEW_IN_BAM_UNITS).toBe(FIELDOFVIEW);
    expect(VANILLA_FIELD_OF_VIEW_IN_BAM_UNITS).toBe(2048);
  });

  test('resolveVanillaViewSetup at setblocks=11 high detail returns the full-screen vanilla viewport with hidden status bar', () => {
    const setup: VanillaViewSetup = resolveVanillaViewSetup(11, DetailMode.high);
    expect(setup.viewport.scaledViewWidth).toBe(SCREENWIDTH);
    expect(setup.viewport.viewWidth).toBe(SCREENWIDTH);
    expect(setup.viewport.viewHeight).toBe(SCREENHEIGHT);
    expect(setup.viewport.centerX).toBe(160);
    expect(setup.viewport.centerY).toBe(100);
    expect(setup.viewport.centerXFrac).toBe(160 << FRACBITS);
    expect(setup.viewport.projection).toBe(setup.viewport.centerXFrac);
    expect(setup.statusBarVisible).toBe(false);
    expect(setup.statusBarRect.width).toBe(0);
    expect(setup.statusBarRect.height).toBe(0);
    expect(setup.viewWindowRect.x).toBe(0);
    expect(setup.viewWindowRect.y).toBe(0);
    expect(setup.viewWindowRect.width).toBe(SCREENWIDTH);
    expect(setup.viewWindowRect.height).toBe(SCREENHEIGHT);
  });

  test('resolveVanillaViewSetup at setblocks=10 high detail uses the full width but exposes the status bar', () => {
    const setup = resolveVanillaViewSetup(10, DetailMode.high);
    expect(setup.viewport.scaledViewWidth).toBe(320);
    expect(setup.viewport.viewHeight).toBe(168);
    expect(setup.statusBarVisible).toBe(false);
    expect(setup.viewWindowRect.width).toBe(320);
    expect(setup.viewWindowRect.height).toBe(168);
  });

  test('resolveVanillaViewSetup at setblocks=9 high detail yields the canonical 288x144 default viewport with status bar visible', () => {
    const setup = resolveVanillaViewSetup(VANILLA_DEFAULT_SET_BLOCKS, DetailMode.high);
    expect(setup.viewport.scaledViewWidth).toBe(288);
    expect(setup.viewport.viewWidth).toBe(288);
    expect(setup.viewport.viewHeight).toBe(144);
    expect(setup.viewport.centerX).toBe(144);
    expect(setup.viewport.centerY).toBe(72);
    expect(setup.viewport.viewWindowX).toBe(16);
    expect(setup.viewport.viewWindowY).toBe(12);
    expect(setup.statusBarVisible).toBe(true);
    expect(setup.statusBarRect.x).toBe(0);
    expect(setup.statusBarRect.y).toBe(SCREENHEIGHT - SBARHEIGHT);
    expect(setup.statusBarRect.width).toBe(SCREENWIDTH);
    expect(setup.statusBarRect.height).toBe(SBARHEIGHT);
    expect(setup.viewWindowRect.x).toBe(16);
    expect(setup.viewWindowRect.y).toBe(12);
    expect(setup.viewWindowRect.width).toBe(288);
    expect(setup.viewWindowRect.height).toBe(144);
  });

  test('resolveVanillaViewSetup at setblocks=3 high detail yields the minimum 96x48 viewport rounded down to a multiple of 8', () => {
    const setup = resolveVanillaViewSetup(3, DetailMode.high);
    expect(setup.viewport.scaledViewWidth).toBe(96);
    expect(setup.viewport.viewHeight).toBe(48);
    expect(setup.viewport.viewHeight % 8).toBe(0);
    expect(setup.statusBarVisible).toBe(true);
    expect(setup.viewWindowRect.width).toBe(96);
    expect(setup.viewWindowRect.height).toBe(48);
  });

  test('resolveVanillaViewSetup at setblocks=11 low detail halves viewWidth but preserves scaledViewWidth', () => {
    const setup = resolveVanillaViewSetup(11, DetailMode.low);
    expect(setup.viewport.scaledViewWidth).toBe(SCREENWIDTH);
    expect(setup.viewport.viewWidth).toBe(SCREENWIDTH >> 1);
    expect(setup.viewport.detailShift).toBe(DetailMode.low);
  });

  test('resolveVanillaViewSetup clamps setblocks below the minimum to 3', () => {
    const setup = resolveVanillaViewSetup(0, DetailMode.high);
    expect(setup.viewport.scaledViewWidth).toBe(96);
  });

  test('resolveVanillaViewSetup clamps setblocks above the maximum to 11', () => {
    const setup = resolveVanillaViewSetup(99, DetailMode.high);
    expect(setup.viewport.scaledViewWidth).toBe(SCREENWIDTH);
    expect(setup.viewport.viewHeight).toBe(SCREENHEIGHT);
  });

  test('resolveVanillaViewSetup returns a frozen artifact with frozen nested rectangles', () => {
    const setup = resolveVanillaViewSetup(9, DetailMode.high);
    expect(Object.isFrozen(setup)).toBe(true);
    expect(Object.isFrozen(setup.statusBarRect)).toBe(true);
    expect(Object.isFrozen(setup.viewWindowRect)).toBe(true);
    expect(Object.isFrozen(setup.viewport)).toBe(false);
  });

  test('viewport projection equals centerXFrac for every supported (setblocks, detail) combination', () => {
    for (let setblocks = VANILLA_VIEW_SIZE_RANGE.minimum; setblocks <= VANILLA_VIEW_SIZE_RANGE.maximum; setblocks += 1) {
      for (const detail of [DetailMode.high, DetailMode.low]) {
        const setup = resolveVanillaViewSetup(setblocks, detail);
        expect(setup.viewport.projection).toBe(setup.viewport.centerXFrac);
        expect(setup.viewport.centerYFrac).toBe(setup.viewport.centerY << FRACBITS);
      }
    }
  });

  test('status bar y-coordinate sits at SCREENHEIGHT - SBARHEIGHT when visible', () => {
    for (let setblocks = VANILLA_VIEW_SIZE_RANGE.minimum; setblocks <= 10; setblocks += 1) {
      const setup = resolveVanillaViewSetup(setblocks, DetailMode.high);
      expect(setup.statusBarVisible).toBe(setup.viewport.scaledViewWidth !== SCREENWIDTH);
      if (setup.statusBarVisible) {
        expect(setup.statusBarRect.y).toBe(SCREENHEIGHT - SBARHEIGHT);
        expect(setup.statusBarRect.height).toBe(SBARHEIGHT);
        expect(setup.statusBarRect.width).toBe(SCREENWIDTH);
      }
    }
  });

  test('field-of-view in BAM units is 2048 regardless of setblocks or detail', () => {
    for (let setblocks = VANILLA_VIEW_SIZE_RANGE.minimum; setblocks <= VANILLA_VIEW_SIZE_RANGE.maximum; setblocks += 1) {
      for (const detail of [DetailMode.high, DetailMode.low]) {
        expect(resolveVanillaViewSetup(setblocks, detail).fieldOfViewInBamUnits).toBe(2048);
      }
    }
  });
});
