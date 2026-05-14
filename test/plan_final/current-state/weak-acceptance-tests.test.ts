import { describe, expect, test } from 'bun:test';

import { readFileSync, readdirSync } from 'node:fs';

import weakAcceptanceTestsInventoryRaw from '../../../plan_final/current-state/weak-acceptance-tests.json';

interface AcceptanceTestEntry {
  readonly launches_subprocess: boolean;
  readonly references_doom_ts_string: boolean;
  readonly relative_path: string;
}

interface WeakAcceptanceTestsInventory {
  readonly acceptance_test_root_paths_searched: readonly string[];
  readonly captured_at_utc: string;
  readonly id: string;
  readonly implications: readonly string[];
  readonly follow_up_steps: readonly string[];
  readonly lane: string;
  readonly live_runtime_launch_patterns_searched: readonly string[];
  readonly strong_acceptance_test_count: number;
  readonly strong_acceptance_tests_sorted: readonly AcceptanceTestEntry[];
  readonly title: string;
  readonly total_acceptance_test_count: number;
  readonly weak_acceptance_test_count: number;
  readonly weak_acceptance_tests_sorted: readonly AcceptanceTestEntry[];
  readonly weakness_definition: string;
}

const weakAcceptanceTestsInventory: WeakAcceptanceTestsInventory = weakAcceptanceTestsInventoryRaw;

const ACCEPTANCE_TEST_ROOT_PATHS = ['test/playable/acceptance/', 'test/vanilla_parity/acceptance/', 'test/oracles/'] as const;

const LIVE_RUNTIME_LAUNCH_PATTERNS_SEARCHED = ['Bun.spawn', 'Bun.spawnSync', 'spawnSync', 'execSync', 'Bun.$', 'Bun.execSync'] as const;

function listAcceptanceTestFilenames(directoryPath: string): readonly string[] {
  return readdirSync(directoryPath)
    .filter((name) => name.endsWith('.test.ts'))
    .sort();
}

function containsAnySubprocessLaunch(fileText: string): boolean {
  for (const pattern of LIVE_RUNTIME_LAUNCH_PATTERNS_SEARCHED) {
    if (fileText.includes(pattern)) {
      return true;
    }
  }
  return false;
}

describe('inventory: weak acceptance tests', () => {
  test('inventory pins the canonical id, title, and lane', () => {
    expect(weakAcceptanceTestsInventory.id).toBe('01-009');
    expect(weakAcceptanceTestsInventory.title).toBe('inventory-weak-acceptance-tests');
    expect(weakAcceptanceTestsInventory.lane).toBe('current-state');
  });

  test('inventory captured_at_utc is a UTC ISO 8601 timestamp ending in Z', () => {
    expect(weakAcceptanceTestsInventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(weakAcceptanceTestsInventory.captured_at_utc).getTime())).toBe(true);
  });

  test('inventory acceptance_test_root_paths_searched matches the canonical search list', () => {
    expect([...weakAcceptanceTestsInventory.acceptance_test_root_paths_searched]).toEqual([...ACCEPTANCE_TEST_ROOT_PATHS]);
  });

  test('inventory live_runtime_launch_patterns_searched matches the canonical pattern list', () => {
    expect([...weakAcceptanceTestsInventory.live_runtime_launch_patterns_searched]).toEqual([...LIVE_RUNTIME_LAUNCH_PATTERNS_SEARCHED]);
  });

  test('inventory total_acceptance_test_count matches the on-disk count across all three roots', () => {
    const observedCount = ACCEPTANCE_TEST_ROOT_PATHS.reduce((runningCount, rootPath) => runningCount + listAcceptanceTestFilenames(rootPath).length, 0);
    expect(weakAcceptanceTestsInventory.total_acceptance_test_count).toBe(observedCount);
  });

  test('inventory weak_acceptance_test_count plus strong_acceptance_test_count equals the total', () => {
    expect(weakAcceptanceTestsInventory.weak_acceptance_test_count + weakAcceptanceTestsInventory.strong_acceptance_test_count).toBe(weakAcceptanceTestsInventory.total_acceptance_test_count);
  });

  test('inventory weak_acceptance_tests_sorted is ASCIIbetically sorted by relative_path', () => {
    const relativePaths = weakAcceptanceTestsInventory.weak_acceptance_tests_sorted.map((entry) => entry.relative_path);
    expect([...relativePaths]).toEqual([...relativePaths].sort());
  });

  test('inventory strong_acceptance_tests_sorted is ASCIIbetically sorted by relative_path', () => {
    const relativePaths = weakAcceptanceTestsInventory.strong_acceptance_tests_sorted.map((entry) => entry.relative_path);
    expect([...relativePaths]).toEqual([...relativePaths].sort());
  });

  test('every weak entry records launches_subprocess = false and matches a fresh on-disk read', () => {
    for (const weakEntry of weakAcceptanceTestsInventory.weak_acceptance_tests_sorted) {
      expect(weakEntry.launches_subprocess).toBe(false);
      const freshText = readFileSync(weakEntry.relative_path, 'utf8');
      expect(containsAnySubprocessLaunch(freshText)).toBe(false);
      expect(weakEntry.references_doom_ts_string).toBe(freshText.includes('doom.ts'));
    }
  });

  test('every strong entry records launches_subprocess = true and matches a fresh on-disk read', () => {
    for (const strongEntry of weakAcceptanceTestsInventory.strong_acceptance_tests_sorted) {
      expect(strongEntry.launches_subprocess).toBe(true);
      const freshText = readFileSync(strongEntry.relative_path, 'utf8');
      expect(containsAnySubprocessLaunch(freshText)).toBe(true);
    }
  });

  test('inventory implications and follow_up_steps point to acceptance lane drainage steps', () => {
    expect(weakAcceptanceTestsInventory.implications.length).toBeGreaterThan(0);
    expect(weakAcceptanceTestsInventory.follow_up_steps.length).toBeGreaterThan(0);
    for (const followUpStepId of weakAcceptanceTestsInventory.follow_up_steps) {
      expect(followUpStepId).toMatch(/^13-\d{3}$/);
    }
  });

  test('inventory weakness_definition explicitly rejects manifest-only and schema-only proof', () => {
    expect(weakAcceptanceTestsInventory.weakness_definition).toContain('cannot prove');
    expect(weakAcceptanceTestsInventory.weakness_definition).toContain('never run');
  });
});
