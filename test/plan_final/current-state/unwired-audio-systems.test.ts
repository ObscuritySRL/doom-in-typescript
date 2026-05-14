import { existsSync, readFileSync, statSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

const INVENTORY_JSON_PATH = 'plan_final/current-state/unwired-audio-systems.json';
const DOOM_TS_PATH = 'doom.ts';
const LAUNCH_PATH_DIRECTORIES = Object.freeze(['src/launcher/', 'src/player/', 'src/ai/', 'src/specials/']);

interface AudioSurface {
  readonly surface_id: string;
  readonly description: string;
  readonly canonical_implementation_modules: readonly string[];
  readonly wired_to_doom_ts: boolean;
  readonly wired_to_simplified_launcher: boolean;
  readonly external_callers_in_runtime_path: readonly string[];
}

interface LaunchReachabilitySummary {
  readonly doom_ts_audio_import_count: number;
  readonly simplified_launcher_audio_import_count: number;
  readonly player_audio_import_count: number;
  readonly ai_audio_import_count: number;
  readonly specials_audio_import_count: number;
  readonly audio_modules_tracked_count: number;
  readonly notes: string;
}

interface InventoryDocument {
  readonly step_id: string;
  readonly lane: string;
  readonly title: string;
  readonly captured_at_utc: string;
  readonly repository_root: string;
  readonly launch_reachability_summary: LaunchReachabilitySummary;
  readonly audio_surfaces: readonly AudioSurface[];
}

function readInventory(): InventoryDocument {
  return JSON.parse(readFileSync(INVENTORY_JSON_PATH, 'utf8')) as InventoryDocument;
}

function countDoomTsAudioImports(): number {
  const source = readFileSync(DOOM_TS_PATH, 'utf8');
  const audioImportPattern = /^\s*import(\s+type)?\s+[^;]*from\s+['"][^'"]*\/audio\//gm;
  const matches = source.match(audioImportPattern);

  return matches === null ? 0 : matches.length;
}

function countTrackedAudioFiles(): number {
  const subprocess = Bun.spawnSync({
    cmd: ['git', 'ls-files', 'src/audio/'],
    stdout: 'pipe',
  });
  const stdoutText = subprocess.stdout.toString();

  return stdoutText.split(/\r?\n/).filter((repositoryPath) => repositoryPath.length > 0 && repositoryPath.endsWith('.ts')).length;
}

function countAudioImportsInDirectory(directoryRelativePath: string): number {
  const subprocess = Bun.spawnSync({
    cmd: ['git', 'ls-files', directoryRelativePath],
    stdout: 'pipe',
  });
  const stdoutText = subprocess.stdout.toString();
  const files = stdoutText.split(/\r?\n/).filter((repositoryPath) => repositoryPath.length > 0 && repositoryPath.endsWith('.ts'));
  const audioImportPattern = /from\s+['"][^'"]*\/audio\//;

  let totalImportEdges = 0;
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const matches = source.match(new RegExp(audioImportPattern.source, 'g'));
    totalImportEdges += matches === null ? 0 : matches.length;
  }

  return totalImportEdges;
}

describe('plan_final current-state: unwired audio systems inventory', () => {
  test('inventory file exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory pins the canonical step id, lane, and title', () => {
    const inventory = readInventory();

    expect(inventory.step_id).toBe('01-008');
    expect(inventory.lane).toBe('current-state');
    expect(inventory.title).toBe('inventory-unwired-audio-systems');
  });

  test('inventory captures a parseable UTC timestamp and the canonical repository root', () => {
    const inventory = readInventory();

    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('every canonical implementation module exists on disk', () => {
    const inventory = readInventory();

    for (const surface of inventory.audio_surfaces) {
      for (const modulePath of surface.canonical_implementation_modules) {
        expect(existsSync(modulePath)).toBe(true);
      }
    }
  });

  test('launch_reachability_summary records zero audio imports from doom.ts and the simplified launch path', () => {
    const inventory = readInventory();

    expect(inventory.launch_reachability_summary.doom_ts_audio_import_count).toBe(countDoomTsAudioImports());
    expect(inventory.launch_reachability_summary.doom_ts_audio_import_count).toBe(0);
    expect(inventory.launch_reachability_summary.simplified_launcher_audio_import_count).toBe(countAudioImportsInDirectory('src/launcher/'));
    expect(inventory.launch_reachability_summary.player_audio_import_count).toBe(countAudioImportsInDirectory('src/player/'));
    expect(inventory.launch_reachability_summary.ai_audio_import_count).toBe(countAudioImportsInDirectory('src/ai/'));
    expect(inventory.launch_reachability_summary.specials_audio_import_count).toBe(countAudioImportsInDirectory('src/specials/'));
    expect(inventory.launch_reachability_summary.notes.length).toBeGreaterThan(0);
  });

  test('launch_reachability_summary audio_modules_tracked_count matches git ls-files src/audio/', () => {
    const inventory = readInventory();

    expect(inventory.launch_reachability_summary.audio_modules_tracked_count).toBe(countTrackedAudioFiles());
  });

  test('every audio surface reports wired_to_doom_ts = false while doom.ts is a skeleton', () => {
    const inventory = readInventory();

    for (const surface of inventory.audio_surfaces) {
      expect(surface.wired_to_doom_ts).toBe(false);
    }
  });

  test('every audio surface reports wired_to_simplified_launcher = false while no src/launcher/ file imports src/audio/', () => {
    const inventory = readInventory();
    const launcherAudioImports = countAudioImportsInDirectory('src/launcher/');

    expect(launcherAudioImports).toBe(0);

    for (const surface of inventory.audio_surfaces) {
      expect(surface.wired_to_simplified_launcher).toBe(false);
    }
  });

  test('every audio surface reports zero external callers while no launch-path file imports src/audio/', () => {
    const inventory = readInventory();
    let launchPathAudioImports = 0;
    for (const directoryRelativePath of LAUNCH_PATH_DIRECTORIES) {
      launchPathAudioImports += countAudioImportsInDirectory(directoryRelativePath);
    }

    expect(launchPathAudioImports).toBe(0);

    for (const surface of inventory.audio_surfaces) {
      expect(surface.external_callers_in_runtime_path).toEqual([]);
    }
  });

  test('every audio surface module path is under src/audio/', () => {
    const inventory = readInventory();

    for (const surface of inventory.audio_surfaces) {
      for (const modulePath of surface.canonical_implementation_modules) {
        expect(modulePath.startsWith('src/audio/')).toBe(true);
      }
    }
  });

  test('audio surfaces are listed in ascending surface_id order without duplicates', () => {
    const inventory = readInventory();
    const observedSurfaceIds = inventory.audio_surfaces.map((surface) => surface.surface_id);
    const sortedSurfaceIds = [...observedSurfaceIds].sort((leftId, rightId) => (leftId < rightId ? -1 : leftId > rightId ? 1 : 0));

    expect(observedSurfaceIds).toEqual(sortedSurfaceIds);
    expect(new Set(observedSurfaceIds).size).toBe(observedSurfaceIds.length);
  });

  test('canonical_implementation_modules per surface are listed in ascending order without duplicates', () => {
    const inventory = readInventory();

    for (const surface of inventory.audio_surfaces) {
      const observedPaths = surface.canonical_implementation_modules;
      const sortedPaths = [...observedPaths].sort((leftPath, rightPath) => (leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0));

      expect(observedPaths).toEqual(sortedPaths);
      expect(new Set(observedPaths).size).toBe(observedPaths.length);
    }
  });

  test('the union of all canonical implementation modules covers every git-tracked src/audio/ file', () => {
    const inventory = readInventory();
    const inventoryModuleSet = new Set<string>();
    for (const surface of inventory.audio_surfaces) {
      for (const modulePath of surface.canonical_implementation_modules) {
        inventoryModuleSet.add(modulePath);
      }
    }

    const subprocess = Bun.spawnSync({
      cmd: ['git', 'ls-files', 'src/audio/'],
      stdout: 'pipe',
    });
    const stdoutText = subprocess.stdout.toString();
    const trackedAudioFiles = stdoutText.split(/\r?\n/).filter((repositoryPath) => repositoryPath.length > 0 && repositoryPath.endsWith('.ts'));

    for (const trackedFile of trackedAudioFiles) {
      expect(inventoryModuleSet.has(trackedFile)).toBe(true);
    }
  });
});
