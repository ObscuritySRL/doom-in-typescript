import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS,
  DEFAULT_SAMPLING_INTERVAL_TICS,
  EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH,
  EMPTY_DEMO_PLAYBACK_STATE_HASH,
  EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH,
  EMPTY_TITLE_LOOP_STATE_HASH,
  FRAMEBUFFER_HEIGHT,
  FRAMEBUFFER_SIZE,
  FRAMEBUFFER_WIDTH,
  INDIVIDUAL_COMPONENT_COUNT,
  PALETTE_COUNT,
  STATE_HASH_COMPONENTS,
  VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS,
} from '../../../src/oracles/longRunDriftChecks.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/oracles/longRunDriftChecks.ts');

describe('plan_final save-config-demo: wire-long-run-drift-checks', () => {
  test('src/oracles/longRunDriftChecks.ts exists, is a regular file, and cites plan_final step 12-008', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('12-008');
    expect(fileText).toContain('VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS');
  });

  test('the aggregator re-exports only from the two read-only same-directory oracle modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8').replace(/^\/\*\*[\s\S]*?\*\//, '');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('./'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['./framebufferHash.ts', './stateHash.ts']);
  });

  test('VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS)).toBe(true);
    const ids = VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'COMBINED_STATE_HASH_OVER_FIVE_INDIVIDUAL_COMPONENTS',
      'DEMO_PLAYBACK_PIXEL_AND_STATE_BASELINES_ARE_FROZEN',
      'DRIFT_CHECKS_SAMPLE_EVERY_35_TICS',
      'FRAMEBUFFER_IS_320x200_WITH_14_PALETTES',
      'TITLE_LOOP_PIXEL_AND_STATE_BASELINES_ARE_FROZEN',
    ]);
    for (const invariant of VANILLA_LONG_RUN_DRIFT_CHECK_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the framebuffer and state drift-check constants match the pinned oracle schema', () => {
    expect(FRAMEBUFFER_WIDTH).toBe(320);
    expect(FRAMEBUFFER_HEIGHT).toBe(200);
    expect(FRAMEBUFFER_SIZE).toBe(320 * 200);
    expect(PALETTE_COUNT).toBe(14);
    expect(DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS).toBe(35);
    expect(DEFAULT_SAMPLING_INTERVAL_TICS).toBe(35);
    expect(STATE_HASH_COMPONENTS.length).toBe(6);
    expect(INDIVIDUAL_COMPONENT_COUNT).toBe(5);
    expect([...STATE_HASH_COMPONENTS].sort()).toEqual(['automap', 'combined', 'player', 'rng', 'sectors', 'thinkers']);
  });

  test('the title-loop and demo-playback drift baselines are re-exported and frozen', () => {
    for (const baseline of [EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH, EMPTY_DEMO_PLAYBACK_FRAMEBUFFER_HASH, EMPTY_TITLE_LOOP_STATE_HASH, EMPTY_DEMO_PLAYBACK_STATE_HASH]) {
      expect(typeof baseline).toBe('object');
      expect(Object.isFrozen(baseline)).toBe(true);
    }
  });

  test('the re-exported symbols are the SAME references as the read-only oracle modules', async () => {
    const framebufferSource = await import('../../../src/oracles/framebufferHash.ts');
    const stateSource = await import('../../../src/oracles/stateHash.ts');
    expect(EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH).toBe(framebufferSource.EMPTY_TITLE_LOOP_FRAMEBUFFER_HASH);
    expect(FRAMEBUFFER_SIZE).toBe(framebufferSource.FRAMEBUFFER_SIZE);
    expect(STATE_HASH_COMPONENTS).toBe(stateSource.STATE_HASH_COMPONENTS);
    expect(EMPTY_DEMO_PLAYBACK_STATE_HASH).toBe(stateSource.EMPTY_DEMO_PLAYBACK_STATE_HASH);
  });
});
