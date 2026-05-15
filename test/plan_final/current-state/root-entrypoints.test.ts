import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_final/current-state/root-entrypoints.json';

interface PackageScript {
  readonly name: string;
  readonly command: string;
}

interface RootScript {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly role: string;
  readonly current_behavior: string;
  readonly wires_vanilla_runtime: boolean;
  readonly wires_simplified_launcher: boolean;
  readonly notes: string;
}

interface PackageMetadata {
  readonly relative_path: string;
  readonly size_bytes: number;
  readonly sha256: string;
  readonly name: string;
  readonly module_type: string;
  readonly private: boolean;
  readonly has_doom_script: boolean;
  readonly has_test_script: boolean;
  readonly script_count: number;
}

interface GapSummary {
  readonly doom_ts_is_runtime_entrypoint: boolean;
  readonly doom_ts_skeleton_only: boolean;
  readonly src_main_is_simplified_launcher: boolean;
  readonly package_json_has_doom_script: boolean;
  readonly intended_final_runtime_target: string;
}

interface InventoryDocument {
  readonly step_id: string;
  readonly lane: string;
  readonly title: string;
  readonly captured_at_utc: string;
  readonly repository_root: string;
  readonly root_scripts: readonly RootScript[];
  readonly package_scripts: readonly PackageScript[];
  readonly package_metadata: PackageMetadata;
  readonly gap_summary: GapSummary;
}

function readInventory(): InventoryDocument {
  return JSON.parse(readFileSync(INVENTORY_JSON_PATH, 'utf8')) as InventoryDocument;
}

function sha256Hex(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function lineCount(filePath: string): number {
  const content = readFileSync(filePath, 'utf8');

  if (content.length === 0) {
    return 0;
  }

  return content.endsWith('\n') ? content.split('\n').length - 1 : content.split('\n').length;
}

describe('plan_final current-state: root entrypoints inventory', () => {
  test('inventory file exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory pins the canonical step id, lane, and title', () => {
    const inventory = readInventory();

    expect(inventory.step_id).toBe('01-001');
    expect(inventory.lane).toBe('current-state');
    expect(inventory.title).toBe('inventory-root-entrypoints');
  });

  test('inventory captures a parseable UTC timestamp and the canonical repository root', () => {
    const inventory = readInventory();

    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('every recorded root script entry matches its on-disk size, line count, and sha256', () => {
    const inventory = readInventory();

    for (const rootScript of inventory.root_scripts) {
      expect(existsSync(rootScript.relative_path)).toBe(rootScript.exists);

      if (rootScript.exists) {
        expect(statSync(rootScript.relative_path).size).toBe(rootScript.size_bytes);
        expect(lineCount(rootScript.relative_path)).toBe(rootScript.line_count);
        expect(sha256Hex(rootScript.relative_path)).toBe(rootScript.sha256);
      }
    }
  });

  test('doom.ts is recorded as the canonical vanilla runtime target wired to runDoomMain', () => {
    const inventory = readInventory();
    const doomEntry = inventory.root_scripts.find((entry) => entry.relative_path === 'doom.ts');

    expect(doomEntry).toBeDefined();
    expect(doomEntry?.role).toBe('canonical-vanilla-runtime-target');
    expect(doomEntry?.current_behavior).toBe('vanilla-runtime-runner');
    expect(doomEntry?.wires_vanilla_runtime).toBe(true);
  });

  test('src/main.ts is recorded as the current simplified launcher entrypoint that does not wire vanilla runtime', () => {
    const inventory = readInventory();
    const mainEntry = inventory.root_scripts.find((entry) => entry.relative_path === 'src/main.ts');

    expect(mainEntry).toBeDefined();
    expect(mainEntry?.role).toBe('current-bun-start-entrypoint');
    expect(mainEntry?.current_behavior).toBe('simplified-launcher-runner');
    expect(mainEntry?.wires_simplified_launcher).toBe(true);
    expect(mainEntry?.wires_vanilla_runtime).toBe(false);
  });

  test('package_scripts list matches the package.json scripts table exactly', () => {
    const inventory = readInventory();
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { readonly scripts?: Readonly<Record<string, string>> };
    const observedScripts = Object.entries(packageJson.scripts ?? {})
      .map(([name, command]) => Object.freeze({ command, name }))
      .sort((leftScript, rightScript) => leftScript.name.localeCompare(rightScript.name));
    const recordedScripts = [...inventory.package_scripts].sort((leftScript, rightScript) => leftScript.name.localeCompare(rightScript.name));

    expect(recordedScripts).toEqual(observedScripts);
  });

  test('package_metadata matches package.json size, sha256, name, module type, and script count', () => {
    const inventory = readInventory();
    const packageJsonBytes = readFileSync('package.json');
    const packageJson = JSON.parse(packageJsonBytes.toString('utf8')) as { readonly name: string; readonly private?: boolean; readonly scripts?: Readonly<Record<string, string>>; readonly type: string };

    expect(inventory.package_metadata.relative_path).toBe('package.json');
    expect(inventory.package_metadata.size_bytes).toBe(packageJsonBytes.length);
    expect(inventory.package_metadata.sha256).toBe(sha256Hex('package.json'));
    expect(inventory.package_metadata.name).toBe(packageJson.name);
    expect(inventory.package_metadata.module_type).toBe(packageJson.type);
    expect(inventory.package_metadata.private).toBe(packageJson.private === true);
    expect(inventory.package_metadata.script_count).toBe(Object.keys(packageJson.scripts ?? {}).length);
    expect(inventory.package_metadata.has_doom_script).toBe(Object.hasOwn(packageJson.scripts ?? {}, 'doom'));
    expect(inventory.package_metadata.has_test_script).toBe(Object.hasOwn(packageJson.scripts ?? {}, 'test'));
  });

  test('gap_summary reflects the wired doom.ts runtime entrypoint and pins the final runtime target', () => {
    const inventory = readInventory();

    expect(inventory.gap_summary.doom_ts_is_runtime_entrypoint).toBe(true);
    expect(inventory.gap_summary.doom_ts_skeleton_only).toBe(false);
    expect(inventory.gap_summary.src_main_is_simplified_launcher).toBe(true);
    expect(inventory.gap_summary.package_json_has_doom_script).toBe(false);
    expect(inventory.gap_summary.intended_final_runtime_target).toBe('bun run doom.ts');
  });
});
