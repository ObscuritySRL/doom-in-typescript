import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/classify-real-implementations.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-021-classify-real-implementations.md';
const GIT_TRACKED_FILE_ROOTS: readonly string[] = ['src', 'test', 'tools'];
const STATUS_REAL = 'real';

const CANONICAL_REQUIRED_FIELDS_IN_ORDER: readonly string[] = ['id', 'title', 'lane', 'summary', 'captured_at_utc', 'evidence_method', 'repository_root', 'implications', 'follow_up_steps'];
const EXPECTED_EXCLUDED_SURFACE_IDS_SORTED: readonly string[] = ['manifest_only_oracle_fixtures', 'plan_fps_gate_manifests', 'simplified_launcher', 'src_playable_contracts'];
const EXPECTED_GROUP_IDS_SORTED: readonly string[] = [
  'audio_music_and_mixer',
  'bootstrap_runtime_contracts',
  'core_math_and_timing',
  'input_and_oracle_support',
  'map_world_simulation',
  'player_ai_specials',
  'renderer_and_ui',
  'save_config_and_demo',
  'wad_and_asset_loading',
];

interface ClassificationDefinition {
  readonly criteria_sorted: readonly string[];
  readonly not_end_to_end_gate: boolean;
  readonly scope_note: string;
  readonly status_value: string;
}

interface ClassificationSummary {
  readonly classified_source_file_count: number;
  readonly classified_test_file_count: number;
  readonly real_group_count: number;
  readonly representative_module_count: number;
  readonly source_only_metadata: boolean;
}

interface ExcludedSurface {
  readonly classified_by_follow_up: string;
  readonly reason: string;
  readonly surface_id: string;
  readonly surface_roots: readonly string[];
}

interface RealImplementationGroup {
  readonly classification: string;
  readonly evidence: string;
  readonly group_id: string;
  readonly notes: string;
  readonly representative_modules: readonly string[];
  readonly representative_tests: readonly string[];
  readonly source_file_count: number;
  readonly source_roots: readonly string[];
  readonly test_file_count: number;
  readonly test_roots: readonly string[];
}

interface InventoryDocument {
  readonly captured_at_utc: string;
  readonly classification_definition: ClassificationDefinition;
  readonly classification_summary: ClassificationSummary;
  readonly evidence_method: string;
  readonly excluded_surfaces: readonly ExcludedSurface[];
  readonly follow_up_steps: readonly string[];
  readonly id: string;
  readonly implications: readonly string[];
  readonly lane: string;
  readonly real_implementation_groups: readonly RealImplementationGroup[];
  readonly repository_root: string;
  readonly summary: string;
  readonly title: string;
}

let trackedRepositoryPathsPromise: Promise<readonly string[]> | undefined;

async function collectTrackedRepositoryPaths(): Promise<readonly string[]> {
  const subprocess = Bun.spawn({
    cmd: ['git', 'ls-files', '--', ...GIT_TRACKED_FILE_ROOTS],
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [standardErrorText, standardOutputText, exitCode] = await Promise.all([new Response(subprocess.stderr).text(), new Response(subprocess.stdout).text(), subprocess.exited]);
  if (exitCode !== 0) {
    throw new Error(`git ls-files failed with exit code ${exitCode}: ${standardErrorText.trim()}`);
  }
  return standardOutputText
    .split(/\r?\n/)
    .filter((repositoryPath) => repositoryPath.length > 0)
    .map((repositoryPath) => repositoryPath.replace(/\\/g, '/'))
    .sort();
}

async function loadInventoryDocument(): Promise<InventoryDocument> {
  return (await Bun.file(INVENTORY_JSON_PATH).json()) as InventoryDocument;
}

async function loadTrackedRepositoryPaths(): Promise<readonly string[]> {
  trackedRepositoryPathsPromise ??= collectTrackedRepositoryPaths();
  return trackedRepositoryPathsPromise;
}

function countTypeScriptFilesForRoot(rootPath: string, trackedRepositoryPaths: readonly string[]): number {
  return trackedRepositoryPaths.filter((repositoryPath) => hasPathPrefix(repositoryPath, rootPath) && repositoryPath.endsWith('.ts')).length;
}

function countTestFilesForRoot(rootPath: string, trackedRepositoryPaths: readonly string[]): number {
  return trackedRepositoryPaths.filter((repositoryPath) => hasPathPrefix(repositoryPath, rootPath) && repositoryPath.endsWith('.test.ts')).length;
}

function hasPathPrefix(filePath: string, rootPath: string): boolean {
  if (rootPath.endsWith('/')) {
    return filePath.startsWith(rootPath);
  }
  return filePath === rootPath;
}

function sortedAscii(values: readonly string[]): readonly string[] {
  return [...values].sort((leftValue, rightValue) => (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0));
}

function expectAsciiSorted(values: readonly string[]): void {
  expect([...values]).toEqual([...sortedAscii(values)]);
}

function expectFollowUpStepExists(followUpEntry: string): void {
  const followUpStepMatch = /^(\d{2}-\d{3})\s+([a-z][a-z0-9-]*)$/.exec(followUpEntry);
  expect(followUpStepMatch).not.toBeNull();
  const followUpStepFilePath = `plan_vanilla_parity/steps/${followUpStepMatch![1]}-${followUpStepMatch![2]}.md`;
  expect(existsSync(followUpStepFilePath)).toBe(true);
  expect(statSync(followUpStepFilePath).isFile()).toBe(true);
}

describe('inventory: classify real implementations', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-021');
    expect(inventory.title).toBe('Classify Real Implementations');
    expect(inventory.lane).toBe('inventory');
  });

  test('inventory declares the canonical nine required top-level fields in canonical order', async () => {
    const inventoryText = await Bun.file(INVENTORY_JSON_PATH).text();
    const parsedInventory = JSON.parse(inventoryText) as Record<string, unknown>;
    const observedKeys = Object.keys(parsedInventory);
    for (const requiredFieldName of CANONICAL_REQUIRED_FIELDS_IN_ORDER) {
      expect(observedKeys).toContain(requiredFieldName);
    }
    const requiredFieldOrder = CANONICAL_REQUIRED_FIELDS_IN_ORDER.map((requiredFieldName) => observedKeys.indexOf(requiredFieldName));
    for (let fieldIndex = 1; fieldIndex < requiredFieldOrder.length; fieldIndex += 1) {
      expect(requiredFieldOrder[fieldIndex]!).toBeGreaterThan(requiredFieldOrder[fieldIndex - 1]!);
    }
  });

  test('inventory captures a parseable UTC timestamp and the absolute repository root', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('classification definition pins the real status and source-only scope', async () => {
    const inventory = await loadInventoryDocument();
    const definition = inventory.classification_definition;
    expect(definition.status_value).toBe(STATUS_REAL);
    expect(definition.not_end_to_end_gate).toBe(true);
    expect(definition.scope_note).toContain('source-backed implementation evidence');
    expect(definition.scope_note).toContain('not a claim');
    expectAsciiSorted(definition.criteria_sorted);
    expect(definition.criteria_sorted.length).toBeGreaterThan(0);
    expect(definition.criteria_sorted.join('\n')).toContain('executable TypeScript source');
    expect(definition.criteria_sorted.join('\n')).toContain('bun:test');
  });

  test('real implementation groups are sorted, unique, and match the canonical group list', async () => {
    const inventory = await loadInventoryDocument();
    const observedGroupIds = inventory.real_implementation_groups.map((groupEntry) => groupEntry.group_id);
    expectAsciiSorted(observedGroupIds);
    expect(observedGroupIds).toEqual([...EXPECTED_GROUP_IDS_SORTED]);
    expect(new Set(observedGroupIds).size).toBe(observedGroupIds.length);
    for (const groupEntry of inventory.real_implementation_groups) {
      expect(groupEntry.classification).toBe(STATUS_REAL);
      expect(groupEntry.evidence.length).toBeGreaterThan(0);
      expect(groupEntry.notes.length).toBeGreaterThan(0);
    }
  });

  test('classification summary matches the captured group counts', async () => {
    const inventory = await loadInventoryDocument();
    const totalSourceFiles = inventory.real_implementation_groups.reduce((sum, groupEntry) => sum + groupEntry.source_file_count, 0);
    const totalTestFiles = inventory.real_implementation_groups.reduce((sum, groupEntry) => sum + groupEntry.test_file_count, 0);
    const representativeModuleCount = inventory.real_implementation_groups.reduce((sum, groupEntry) => sum + groupEntry.representative_modules.length, 0);
    expect(inventory.classification_summary.real_group_count).toBe(inventory.real_implementation_groups.length);
    expect(inventory.classification_summary.classified_source_file_count).toBe(totalSourceFiles);
    expect(inventory.classification_summary.classified_test_file_count).toBe(totalTestFiles);
    expect(inventory.classification_summary.representative_module_count).toBe(representativeModuleCount);
    expect(inventory.classification_summary.source_only_metadata).toBe(true);
  });

  test('each real group source and test counts match the git-tracked local repository tree', async () => {
    const inventory = await loadInventoryDocument();
    const trackedRepositoryPaths = await loadTrackedRepositoryPaths();
    for (const groupEntry of inventory.real_implementation_groups) {
      expectAsciiSorted(groupEntry.source_roots);
      expectAsciiSorted(groupEntry.test_roots);

      let observedSourceFileCount = 0;
      for (const sourceRoot of groupEntry.source_roots) {
        expect(existsSync(sourceRoot)).toBe(true);
        observedSourceFileCount += countTypeScriptFilesForRoot(sourceRoot, trackedRepositoryPaths);
      }
      expect(groupEntry.source_file_count).toBe(observedSourceFileCount);

      let observedTestFileCount = 0;
      for (const testRoot of groupEntry.test_roots) {
        expect(existsSync(testRoot)).toBe(true);
        observedTestFileCount += countTestFilesForRoot(testRoot, trackedRepositoryPaths);
      }
      expect(groupEntry.test_file_count).toBe(observedTestFileCount);
    }
  });

  test('real group source and test roots are unique across classification groups', async () => {
    const inventory = await loadInventoryDocument();
    const sourceRoots = inventory.real_implementation_groups.flatMap((groupEntry) => groupEntry.source_roots);
    const testRoots = inventory.real_implementation_groups.flatMap((groupEntry) => groupEntry.test_roots);
    expect(new Set(sourceRoots).size).toBe(sourceRoots.length);
    expect(new Set(testRoots).size).toBe(testRoots.length);
  });

  test('representative modules and tests exist under their declared roots', async () => {
    const inventory = await loadInventoryDocument();
    const trackedRepositoryPaths = await loadTrackedRepositoryPaths();
    for (const groupEntry of inventory.real_implementation_groups) {
      expectAsciiSorted(groupEntry.representative_modules);
      expectAsciiSorted(groupEntry.representative_tests);
      expect(groupEntry.representative_modules.length).toBeGreaterThan(0);
      expect(groupEntry.representative_tests.length).toBeGreaterThan(0);

      for (const modulePath of groupEntry.representative_modules) {
        expect(existsSync(modulePath)).toBe(true);
        expect(statSync(modulePath).isFile()).toBe(true);
        expect(groupEntry.source_roots.some((sourceRoot) => hasPathPrefix(modulePath, sourceRoot))).toBe(true);
        expect(trackedRepositoryPaths).toContain(modulePath);
        expect(readFileSync(modulePath, 'utf8').trim().length).toBeGreaterThan(0);
      }

      for (const testPath of groupEntry.representative_tests) {
        expect(existsSync(testPath)).toBe(true);
        expect(statSync(testPath).isFile()).toBe(true);
        expect(groupEntry.test_roots.some((testRoot) => hasPathPrefix(testPath, testRoot))).toBe(true);
        expect(trackedRepositoryPaths).toContain(testPath);
        expect(readFileSync(testPath, 'utf8')).toContain("from 'bun:test'");
      }
    }
  });

  test('excluded surfaces are sorted and delegated to the next inventory classification steps', async () => {
    const inventory = await loadInventoryDocument();
    const observedExcludedSurfaceIds = inventory.excluded_surfaces.map((excludedSurface) => excludedSurface.surface_id);
    expectAsciiSorted(observedExcludedSurfaceIds);
    expect(observedExcludedSurfaceIds).toEqual([...EXPECTED_EXCLUDED_SURFACE_IDS_SORTED]);
    for (const excludedSurface of inventory.excluded_surfaces) {
      expect(excludedSurface.reason.length).toBeGreaterThan(0);
      expectAsciiSorted(excludedSurface.surface_roots);
      expectFollowUpStepExists(excludedSurface.classified_by_follow_up);
    }
  });

  test('excluded surfaces are not also counted as real implementation source roots', async () => {
    const inventory = await loadInventoryDocument();
    const realSourceRoots = new Set(inventory.real_implementation_groups.flatMap((groupEntry) => groupEntry.source_roots));
    const representativeModules = inventory.real_implementation_groups.flatMap((groupEntry) => groupEntry.representative_modules);
    for (const excludedSurface of inventory.excluded_surfaces) {
      for (const surfaceRoot of excludedSurface.surface_roots) {
        expect(realSourceRoots.has(surfaceRoot)).toBe(false);
        expect(representativeModules.some((modulePath) => hasPathPrefix(modulePath, surfaceRoot))).toBe(false);
      }
    }
  });

  test('implications and follow-up steps describe the remaining inventory gates', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.summary).toContain('source-only metadata');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('git ls-files');
    expect(inventory.evidence_method).toContain('src/');
    expect(inventory.evidence_method).toContain('test/');
    expect(inventory.implications.join('\n')).toContain('src/playable/');
    expect(inventory.implications.join('\n')).toContain('01-024');
    for (const followUpStep of inventory.follow_up_steps) {
      expectFollowUpStepExists(followUpStep);
    }
  });

  test('step file under plan_vanilla_parity/steps pins the same write lock paths as this test enforces', async () => {
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain(INVENTORY_JSON_PATH);
    expect(stepText).toContain('test/vanilla_parity/current-state/classify-real-implementations.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a tampered group classification diverges from the captured real status', async () => {
    const inventory = await loadInventoryDocument();
    const firstGroup = inventory.real_implementation_groups[0]!;
    const tamperedGroup: RealImplementationGroup = {
      ...firstGroup,
      classification: 'simplified',
    };
    expect(tamperedGroup.classification).not.toBe(firstGroup.classification);
    expect(firstGroup.classification).toBe(STATUS_REAL);
  });

  test('failure mode: a fabricated source count would not match the local repository tree', async () => {
    const inventory = await loadInventoryDocument();
    const trackedRepositoryPaths = await loadTrackedRepositoryPaths();
    const firstGroup = inventory.real_implementation_groups[0]!;
    const observedSourceFileCount = firstGroup.source_roots.reduce((totalSourceFileCount, sourceRoot) => totalSourceFileCount + countTypeScriptFilesForRoot(sourceRoot, trackedRepositoryPaths), 0);
    expect(firstGroup.source_file_count + 1).not.toBe(observedSourceFileCount);
    expect(firstGroup.source_file_count).toBe(observedSourceFileCount);
  });
});
