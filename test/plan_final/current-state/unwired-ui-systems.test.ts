import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_final/current-state/unwired-ui-systems.json';
const DOOM_TS_PATH = 'doom.ts';
const SIMPLIFIED_LAUNCHER_FILES: readonly string[] = ['src/launcher/gameplayAssets.ts', 'src/launcher/gameplayRenderer.ts', 'src/launcher/session.ts', 'src/launcher/win32.ts'];

interface UiSurface {
  readonly surface: string;
  readonly canonical_modules: readonly string[];
  readonly wired_to_doom_ts: boolean;
  readonly wired_to_simplified_launcher: boolean;
  readonly step_implementation_path_prefixes: readonly string[];
}

interface WiringSummary {
  readonly doom_ts_imports_from_src_ui: readonly string[];
  readonly simplified_launcher_imports_from_src_ui: readonly string[];
  readonly ui_surfaces_wired_to_doom_ts_count: number;
  readonly ui_surfaces_total_count: number;
  readonly notes: string;
}

interface InventoryDocument {
  readonly step_id: string;
  readonly lane: string;
  readonly title: string;
  readonly captured_at_utc: string;
  readonly repository_root: string;
  readonly wiring_summary: WiringSummary;
  readonly ui_surfaces: readonly UiSurface[];
}

function readInventory(): InventoryDocument {
  return JSON.parse(readFileSync(INVENTORY_JSON_PATH, 'utf8')) as InventoryDocument;
}

function collectUiImportsFromFile(filePath: string): readonly string[] {
  const sourceText = readFileSync(filePath, 'utf8');
  const importPattern = /from\s+'(\.\.\/ui\/[a-zA-Z0-9_-]+\.ts)'/g;
  const observedImports = new Set<string>();

  for (const match of sourceText.matchAll(importPattern)) {
    const launcherRelativePath = match[1];

    if (launcherRelativePath === undefined) {
      continue;
    }

    observedImports.add(launcherRelativePath.replace('../ui/', 'src/ui/'));
  }

  return [...observedImports].sort();
}

function collectUiImportsFromSimplifiedLauncher(): readonly string[] {
  const aggregated = new Set<string>();

  for (const launcherFile of SIMPLIFIED_LAUNCHER_FILES) {
    for (const importedPath of collectUiImportsFromFile(launcherFile)) {
      aggregated.add(importedPath);
    }
  }

  return [...aggregated].sort();
}

describe('plan_final current-state: unwired UI systems inventory', () => {
  test('inventory file exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory pins the canonical step id, lane, and title', () => {
    const inventory = readInventory();

    expect(inventory.step_id).toBe('01-005');
    expect(inventory.lane).toBe('current-state');
    expect(inventory.title).toBe('inventory-unwired-ui-systems');
  });

  test('inventory captures a parseable UTC timestamp and the canonical repository root', () => {
    const inventory = readInventory();

    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('every canonical UI surface module exists on disk', () => {
    const inventory = readInventory();

    for (const uiSurface of inventory.ui_surfaces) {
      for (const canonicalModule of uiSurface.canonical_modules) {
        expect(existsSync(canonicalModule)).toBe(true);
      }
      for (const stepModule of uiSurface.step_implementation_path_prefixes) {
        expect(existsSync(stepModule)).toBe(true);
      }
    }
  });

  test('inventory enumerates the seven canonical UI surfaces in canonical order', () => {
    const inventory = readInventory();
    const surfaces = inventory.ui_surfaces.map((entry) => entry.surface);

    expect(surfaces).toEqual(['menu', 'title', 'status-bar', 'automap', 'intermission', 'finale', 'endoom']);
  });

  test('every UI surface entry asserts wired_to_doom_ts = false', () => {
    const inventory = readInventory();

    for (const uiSurface of inventory.ui_surfaces) {
      expect(uiSurface.wired_to_doom_ts).toBe(false);
    }
  });

  test('exactly the automap surface is wired to the simplified launcher', () => {
    const inventory = readInventory();
    const wiredSurfaces = inventory.ui_surfaces.filter((entry) => entry.wired_to_simplified_launcher).map((entry) => entry.surface);

    expect(wiredSurfaces).toEqual(['automap']);
  });

  test('doom_ts_imports_from_src_ui is empty while doom.ts is a skeleton', () => {
    const inventory = readInventory();
    const doomTsText = readFileSync(DOOM_TS_PATH, 'utf8');

    expect(doomTsText.includes("from '../ui/") || doomTsText.includes("from './src/ui/")).toBe(false);
    expect(inventory.wiring_summary.doom_ts_imports_from_src_ui).toEqual([]);
  });

  test('simplified_launcher_imports_from_src_ui matches a fresh grep over src/launcher/*.ts', () => {
    const inventory = readInventory();
    const observed = collectUiImportsFromSimplifiedLauncher();

    expect([...inventory.wiring_summary.simplified_launcher_imports_from_src_ui].sort()).toEqual([...observed]);
  });

  test('wiring_summary counts match the inventory contents', () => {
    const inventory = readInventory();
    const wiredToRuntimeCount = inventory.ui_surfaces.filter((entry) => entry.wired_to_doom_ts).length;

    expect(inventory.wiring_summary.ui_surfaces_total_count).toBe(inventory.ui_surfaces.length);
    expect(inventory.wiring_summary.ui_surfaces_wired_to_doom_ts_count).toBe(wiredToRuntimeCount);
    expect(inventory.wiring_summary.notes.length).toBeGreaterThan(0);
  });
});
