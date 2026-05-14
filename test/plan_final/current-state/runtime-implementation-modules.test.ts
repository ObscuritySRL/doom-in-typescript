import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_final/current-state/runtime-implementation-modules.json';
const DOOM_TS_PATH = 'doom.ts';

interface SubsystemEntry {
  readonly relative_path: string;
  readonly classification: 'contract-surface' | 'real-implementation' | 'simplified-launcher';
  readonly tracked_file_count: number;
  readonly primary_role: string;
  readonly reachable_from_doom_ts: boolean;
}

interface RuntimeReachabilitySummary {
  readonly doom_ts_relative_path: string;
  readonly doom_ts_imports_count: number;
  readonly doom_ts_is_skeleton: boolean;
  readonly subsystems_reachable_from_doom_ts: readonly string[];
  readonly subsystems_not_reachable_from_doom_ts_count: number;
  readonly notes: string;
}

interface InventoryDocument {
  readonly step_id: string;
  readonly lane: string;
  readonly title: string;
  readonly captured_at_utc: string;
  readonly repository_root: string;
  readonly runtime_reachability_summary: RuntimeReachabilitySummary;
  readonly subsystems: readonly SubsystemEntry[];
}

function readInventory(): InventoryDocument {
  return JSON.parse(readFileSync(INVENTORY_JSON_PATH, 'utf8')) as InventoryDocument;
}

function countDoomTsImports(): number {
  const source = readFileSync(DOOM_TS_PATH, 'utf8');
  const importPattern = /^\s*import(\s+type)?\s+/gm;
  const matches = source.match(importPattern);

  return matches === null ? 0 : matches.length;
}

function countTrackedTypeScriptFiles(relativePath: string): number {
  const subprocess = Bun.spawnSync({
    cmd: ['git', 'ls-files', relativePath],
    stdout: 'pipe',
  });
  const stdoutText = subprocess.stdout.toString();

  return stdoutText.split(/\r?\n/).filter((repositoryPath) => repositoryPath.length > 0 && repositoryPath.endsWith('.ts')).length;
}

describe('plan_final current-state: runtime implementation modules inventory', () => {
  test('inventory file exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory pins the canonical step id, lane, and title', () => {
    const inventory = readInventory();

    expect(inventory.step_id).toBe('01-004');
    expect(inventory.lane).toBe('current-state');
    expect(inventory.title).toBe('inventory-runtime-implementation-modules');
  });

  test('inventory captures a parseable UTC timestamp and the canonical repository root', () => {
    const inventory = readInventory();

    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('every recorded subsystem path exists on disk and uses an allowed classification value', () => {
    const inventory = readInventory();
    const allowedClassifications = new Set<SubsystemEntry['classification']>(['contract-surface', 'real-implementation', 'simplified-launcher']);

    for (const subsystem of inventory.subsystems) {
      expect(existsSync(subsystem.relative_path)).toBe(true);
      expect(allowedClassifications.has(subsystem.classification)).toBe(true);
    }
  });

  test('every recorded subsystem tracked_file_count matches git ls-files', () => {
    const inventory = readInventory();

    for (const subsystem of inventory.subsystems) {
      expect(countTrackedTypeScriptFiles(subsystem.relative_path)).toBe(subsystem.tracked_file_count);
    }
  });

  test('runtime_reachability_summary matches the empty doom.ts skeleton state', () => {
    const inventory = readInventory();

    expect(inventory.runtime_reachability_summary.doom_ts_relative_path).toBe(DOOM_TS_PATH);
    expect(inventory.runtime_reachability_summary.doom_ts_imports_count).toBe(countDoomTsImports());
    expect(inventory.runtime_reachability_summary.doom_ts_is_skeleton).toBe(true);
    expect(inventory.runtime_reachability_summary.subsystems_reachable_from_doom_ts).toEqual([]);
    expect(inventory.runtime_reachability_summary.subsystems_not_reachable_from_doom_ts_count).toBe(inventory.subsystems.length);
    expect(inventory.runtime_reachability_summary.notes.length).toBeGreaterThan(0);
  });

  test('every subsystem entry reports reachable_from_doom_ts = false while doom.ts is a skeleton', () => {
    const inventory = readInventory();

    for (const subsystem of inventory.subsystems) {
      expect(subsystem.reachable_from_doom_ts).toBe(false);
    }
  });

  test('subsystems are listed in ascending relative_path order without duplicates', () => {
    const inventory = readInventory();
    const observedPaths = inventory.subsystems.map((subsystem) => subsystem.relative_path);
    const sortedPaths = [...observedPaths].sort((leftPath, rightPath) => (leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0));

    expect(observedPaths).toEqual(sortedPaths);
    expect(new Set(observedPaths).size).toBe(observedPaths.length);
  });
});
