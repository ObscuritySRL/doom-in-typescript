import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  ST_EVILGRINCOUNT,
  ST_MUCHPAIN,
  ST_STRAIGHTFACECOUNT,
  ST_TURNCOUNT,
  VANILLA_STATUS_BAR_ENTRY_POINTS,
  calcPainOffset,
  computeStatusBarValues,
  createStatusBarState,
  tickFaceWidget,
  tickStatusBar,
  updateKeyBoxes,
} from '../../../src/vanilla/wireStatusBarDrawing.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireStatusBarDrawing.ts');

describe('plan_final ui: wire-status-bar-drawing', () => {
  test('src/vanilla/wireStatusBarDrawing.ts exists, is a regular file, and cites plan_final step 07-004', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('07-004');
    expect(fileText).toContain('VANILLA_STATUS_BAR_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only src/ui/statusBar.ts without modifying it', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../ui/statusBar.ts'");
  });

  test('VANILLA_STATUS_BAR_ENTRY_POINTS pins the six canonical entry points and is frozen', () => {
    expect(VANILLA_STATUS_BAR_ENTRY_POINTS).toEqual(['calcPainOffset', 'computeStatusBarValues', 'createStatusBarState', 'tickFaceWidget', 'tickStatusBar', 'updateKeyBoxes']);
    expect(Object.isFrozen(VANILLA_STATUS_BAR_ENTRY_POINTS)).toBe(true);
  });

  test('the ST_ face-timing constants pin the vanilla st_stuff.c values (35 = TICRATE)', () => {
    expect(ST_STRAIGHTFACECOUNT).toBe(Math.floor(35 / 2));
    expect(ST_TURNCOUNT).toBe(35);
    expect(ST_EVILGRINCOUNT).toBe(35 * 2);
    expect(ST_MUCHPAIN).toBe(20);
  });

  test('every wired status-bar function is re-exported as a callable function', () => {
    expect(typeof createStatusBarState).toBe('function');
    expect(typeof tickStatusBar).toBe('function');
    expect(typeof tickFaceWidget).toBe('function');
    expect(typeof calcPainOffset).toBe('function');
    expect(typeof updateKeyBoxes).toBe('function');
    expect(typeof computeStatusBarValues).toBe('function');
  });

  test('the re-exported functions are the SAME references as the read-only statusBar module exports', async () => {
    const source = await import('../../../src/ui/statusBar.ts');
    expect(createStatusBarState).toBe(source.createStatusBarState);
    expect(tickStatusBar).toBe(source.tickStatusBar);
    expect(tickFaceWidget).toBe(source.tickFaceWidget);
    expect(calcPainOffset).toBe(source.calcPainOffset);
    expect(computeStatusBarValues).toBe(source.computeStatusBarValues);
  });
});
