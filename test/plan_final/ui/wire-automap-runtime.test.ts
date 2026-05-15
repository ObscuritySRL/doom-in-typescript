import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createAutomapRuntime } from '../../../src/vanilla/automapRuntime.ts';
import type { AutomapRuntime } from '../../../src/vanilla/automapRuntime.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const RELATIVE_PATH = 'src/vanilla/automapRuntime.ts';
const ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RELATIVE_PATH);

describe('plan_final ui: wire-automap-runtime', () => {
  test('src/vanilla/automapRuntime.ts exists and cites plan_final step 07-006', () => {
    expect(existsSync(ABSOLUTE_PATH)).toBe(true);
    expect(statSync(ABSOLUTE_PATH).isFile()).toBe(true);
    const text = readFileSync(ABSOLUTE_PATH, 'utf8');
    expect(text).toContain('07-006');
    expect(text).toContain('createAutomapRuntime');
    expect(text).toContain("from '../ui/automap.ts'");
  });

  test('createAutomapRuntime returns a frozen façade with frozen colors and a live AutomapState', () => {
    const runtime: AutomapRuntime = createAutomapRuntime();
    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.isFrozen(runtime.colors)).toBe(true);
    expect(runtime.state).toBeDefined();
  });

  test('automap colors carry the canonical Chocolate Doom 2.2.1 palette indices', () => {
    const runtime = createAutomapRuntime();
    expect(runtime.colors.backgroundColorIndex).toBe(0);
    expect(runtime.colors.wallColorStart).toBeGreaterThan(0);
    expect(runtime.colors.thingColorStart).toBeGreaterThan(0);
    expect(typeof runtime.colors.youColorIndex).toBe('number');
  });

  test('the façade exposes every wired automap operation as a function', () => {
    const runtime = createAutomapRuntime();
    for (const methodName of [
      'activateNewScale',
      'addMark',
      'changeWindowLoc',
      'changeWindowScale',
      'clearMarks',
      'cxMtof',
      'cyMtof',
      'doFollowPlayer',
      'findMinMaxBoundaries',
      'ftom',
      'initVariables',
      'levelInit',
      'maxOutWindowScale',
      'minOutWindowScale',
      'mtof',
      'restoreScaleAndLoc',
      'saveScaleAndLoc',
      'start',
      'stop',
    ]) {
      expect(typeof runtime[methodName as keyof AutomapRuntime]).toBe('function');
    }
  });

  test('addMark followed by clearMarks leaves no observable error and the state remains a live reference', () => {
    const runtime = createAutomapRuntime();
    const stateBefore = runtime.state;
    runtime.addMark();
    runtime.clearMarks();
    expect(runtime.state).toBe(stateBefore);
  });

  test('stop is callable from the fresh state (no throw)', () => {
    const runtime = createAutomapRuntime();
    let caughtError: unknown;
    try {
      runtime.stop();
    } catch (thrownError) {
      caughtError = thrownError;
    }
    expect(caughtError).toBeUndefined();
  });

  test('the runtime state reference is stable across method calls (matching vanilla file-scope automap globals)', () => {
    const runtime = createAutomapRuntime();
    const initialState = runtime.state;
    runtime.addMark();
    runtime.maxOutWindowScale();
    runtime.minOutWindowScale();
    expect(runtime.state).toBe(initialState);
  });
});
