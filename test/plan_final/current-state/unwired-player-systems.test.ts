import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_final/current-state/unwired-player-systems.json';
const DOOM_TS_PATH = 'doom.ts';
const SIMPLIFIED_LAUNCHER_FILES: readonly string[] = ['src/launcher/gameplayAssets.ts', 'src/launcher/gameplayRenderer.ts', 'src/launcher/session.ts', 'src/launcher/win32.ts'];

interface PlayerSurface {
  readonly surface: string;
  readonly canonical_modules: readonly string[];
  readonly wired_to_doom_ts: boolean;
  readonly wired_to_simplified_launcher: boolean;
  readonly step_implementation_modules: readonly string[];
}

interface WiringSummary {
  readonly doom_ts_imports_from_player_or_world: readonly string[];
  readonly simplified_launcher_imports_from_player_or_world_sorted: readonly string[];
  readonly player_surfaces_wired_to_doom_ts_count: number;
  readonly player_surfaces_total_count: number;
  readonly notes: string;
}

interface InventoryDocument {
  readonly step_id: string;
  readonly lane: string;
  readonly title: string;
  readonly captured_at_utc: string;
  readonly repository_root: string;
  readonly wiring_summary: WiringSummary;
  readonly player_surfaces: readonly PlayerSurface[];
}

function readInventory(): InventoryDocument {
  return JSON.parse(readFileSync(INVENTORY_JSON_PATH, 'utf8')) as InventoryDocument;
}

function collectPlayerOrWorldImports(filePath: string): readonly string[] {
  const sourceText = readFileSync(filePath, 'utf8');
  const importPattern = /from\s+'(\.\.\/(?:player|world)\/[a-zA-Z0-9_-]+\.ts)'/g;
  const observedImports = new Set<string>();

  for (const match of sourceText.matchAll(importPattern)) {
    const launcherRelativePath = match[1];

    if (launcherRelativePath === undefined) {
      continue;
    }

    observedImports.add(launcherRelativePath.replace('../', 'src/'));
  }

  return [...observedImports];
}

function collectPlayerOrWorldImportsFromSimplifiedLauncher(): readonly string[] {
  const aggregated = new Set<string>();

  for (const launcherFile of SIMPLIFIED_LAUNCHER_FILES) {
    for (const importedPath of collectPlayerOrWorldImports(launcherFile)) {
      aggregated.add(importedPath);
    }
  }

  return [...aggregated].sort();
}

describe('plan_final current-state: unwired player systems inventory', () => {
  test('inventory file exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory pins the canonical step id, lane, and title', () => {
    const inventory = readInventory();

    expect(inventory.step_id).toBe('01-006');
    expect(inventory.lane).toBe('current-state');
    expect(inventory.title).toBe('inventory-unwired-player-systems');
  });

  test('inventory captures a parseable UTC timestamp and the canonical repository root', () => {
    const inventory = readInventory();

    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('inventory enumerates the six canonical player-system surfaces in canonical order', () => {
    const inventory = readInventory();
    const surfaces = inventory.player_surfaces.map((entry) => entry.surface);

    expect(surfaces).toEqual(['weapon', 'pickup', 'powerup', 'use-line', 'hitscan', 'projectile']);
  });

  test('every canonical and step-implementation module exists on disk', () => {
    const inventory = readInventory();

    for (const playerSurface of inventory.player_surfaces) {
      for (const canonicalModule of playerSurface.canonical_modules) {
        expect(existsSync(canonicalModule)).toBe(true);
      }
      for (const stepModule of playerSurface.step_implementation_modules) {
        expect(existsSync(stepModule)).toBe(true);
      }
    }
  });

  test('every player-system surface entry asserts wired_to_doom_ts = false and wired_to_simplified_launcher = false', () => {
    const inventory = readInventory();

    for (const playerSurface of inventory.player_surfaces) {
      expect(playerSurface.wired_to_doom_ts).toBe(false);
      expect(playerSurface.wired_to_simplified_launcher).toBe(false);
    }
  });

  test('doom_ts_imports_from_player_or_world is empty while doom.ts is a skeleton', () => {
    const inventory = readInventory();
    const doomTsText = readFileSync(DOOM_TS_PATH, 'utf8');

    expect(/from\s+'(\.\.|\.\/src)\/(player|world)\//.test(doomTsText)).toBe(false);
    expect(inventory.wiring_summary.doom_ts_imports_from_player_or_world).toEqual([]);
  });

  test('simplified_launcher_imports_from_player_or_world_sorted matches a fresh grep over src/launcher/*.ts', () => {
    const inventory = readInventory();
    const observed = collectPlayerOrWorldImportsFromSimplifiedLauncher();

    expect([...inventory.wiring_summary.simplified_launcher_imports_from_player_or_world_sorted]).toEqual([...observed]);
  });

  test('canonical modules for every recorded surface are absent from the simplified-launcher import set', () => {
    const inventory = readInventory();
    const observedImports = new Set(collectPlayerOrWorldImportsFromSimplifiedLauncher());

    for (const playerSurface of inventory.player_surfaces) {
      for (const canonicalModule of playerSurface.canonical_modules) {
        expect(observedImports.has(canonicalModule)).toBe(false);
      }
    }
  });

  test('wiring_summary counts match the inventory contents', () => {
    const inventory = readInventory();
    const wiredCount = inventory.player_surfaces.filter((entry) => entry.wired_to_doom_ts).length;

    expect(inventory.wiring_summary.player_surfaces_total_count).toBe(inventory.player_surfaces.length);
    expect(inventory.wiring_summary.player_surfaces_wired_to_doom_ts_count).toBe(wiredCount);
    expect(inventory.wiring_summary.notes.length).toBeGreaterThan(0);
  });
});
