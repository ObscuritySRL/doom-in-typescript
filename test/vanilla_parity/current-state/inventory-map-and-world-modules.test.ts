import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import wadMapSummary from '../../../reference/manifests/wad-map-summary.json';
import vanillaLimitSummary from '../../../reference/manifests/vanilla-limit-summary.json';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-map-and-world-modules.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-007-inventory-map-and-world-modules.md';
const MAP_DIRECTORY_PATH = 'src/map/';
const WORLD_DIRECTORY_PATH = 'src/world/';
const ALLOWED_GROUP_VALUES: readonly string[] = ['map_loader', 'spatial_query', 'world_collision', 'world_state', 'world_ticker'];
const MAP_MODULE_PATHS_SORTED: readonly string[] = [
  'src/map/blockmap.ts',
  'src/map/blockmapIter.ts',
  'src/map/bspStructs.ts',
  'src/map/intercepts.ts',
  'src/map/lineSectorGeometry.ts',
  'src/map/mapBundle.ts',
  'src/map/mapSetup.ts',
  'src/map/nodeTraversal.ts',
  'src/map/reject.ts',
  'src/map/subsectorQuery.ts',
  'src/map/things.ts',
];
const WORLD_MODULE_PATHS_SORTED: readonly string[] = [
  'src/world/checkPosition.ts',
  'src/world/mobj.ts',
  'src/world/radiusAttack.ts',
  'src/world/sectorChange.ts',
  'src/world/slideMove.ts',
  'src/world/teleport.ts',
  'src/world/thinkers.ts',
  'src/world/tryMove.ts',
  'src/world/useLines.ts',
  'src/world/xyMovement.ts',
  'src/world/zMovement.ts',
];
const MODULE_PATHS_SORTED: readonly string[] = [...MAP_MODULE_PATHS_SORTED, ...WORLD_MODULE_PATHS_SORTED];

interface InventorySourceDirectory {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly committed_file_count: number;
  readonly committed_filenames_sorted: readonly string[];
  readonly total_size_bytes: number;
  readonly total_line_count: number;
  readonly total_export_count: number;
}

interface InventoryModuleEntry {
  readonly relative_path: string;
  readonly group: string;
  readonly role: string;
  readonly vanilla_concept_modeled: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly exported_interfaces: readonly string[];
  readonly exported_functions: readonly string[];
  readonly exported_constants: readonly string[];
  readonly exported_classes: readonly string[];
  readonly exported_types: readonly string[];
  readonly exported_const_enums: readonly string[];
  readonly external_imports: readonly string[];
  readonly src_importer_count: number;
  readonly test_importer_count: number;
}

interface InventoryTestRoot {
  readonly relative_path: string;
  readonly test_file_count: number;
  readonly test_filenames_sorted: readonly string[];
}

interface InventoryTestCoverage {
  readonly test_roots: readonly InventoryTestRoot[];
  readonly notes: string;
}

interface InventoryReferenceManifestStatus {
  readonly wad_map_summary_relative_path: string;
  readonly shareware_map_count: number;
  readonly map_data_lump_count: number;
  readonly map_lump_order: readonly string[];
  readonly vanilla_limit_summary_relative_path: string;
  readonly maxintercepts_limit: number;
  readonly maxspecialcross_limit: number;
  readonly maxplayers_limit: number;
  readonly notes: string;
}

interface InventoryWorldBoundaryStatus {
  readonly map_modules_sorted: readonly string[];
  readonly world_modules_sorted: readonly string[];
  readonly runtime_module_count: number;
  readonly source_only_metadata: boolean;
  readonly notes: string;
}

interface InventoryDocument {
  readonly id: string;
  readonly title: string;
  readonly lane: string;
  readonly summary: string;
  readonly captured_at_utc: string;
  readonly evidence_method: string;
  readonly repository_root: string;
  readonly source_directories: readonly InventorySourceDirectory[];
  readonly modules: readonly InventoryModuleEntry[];
  readonly test_coverage: InventoryTestCoverage;
  readonly reference_manifest_status: InventoryReferenceManifestStatus;
  readonly world_boundary_status: InventoryWorldBoundaryStatus;
  readonly implications: readonly string[];
  readonly follow_up_steps: readonly string[];
}

async function loadInventoryDocument(): Promise<InventoryDocument> {
  return (await Bun.file(INVENTORY_JSON_PATH).json()) as InventoryDocument;
}

function computeSha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function countLines(filePath: string): number {
  const text = readFileSync(filePath, 'utf8');
  if (text.length === 0) {
    return 0;
  }
  const lineCount = text.split('\n').length;
  return text.endsWith('\n') ? lineCount - 1 : lineCount;
}

function countExports(filePath: string): number {
  const text = readFileSync(filePath, 'utf8');
  const matches = text.match(/^export\s+(?:async\s+)?(?:(?:const\s+enum)|interface|function|const|class|type)\s+\w+/gm);
  return matches ? matches.length : 0;
}

function exportedNames(text: string, kind: 'class' | 'function' | 'interface' | 'type'): readonly string[] {
  const expression = new RegExp(`^export\\s+(?:async\\s+)?${kind}\\s+([A-Za-z0-9_]+)`, 'gm');
  return [...text.matchAll(expression)].map((match) => match[1]!).sort();
}

function exportedConstants(text: string): readonly string[] {
  return [...text.matchAll(/^export\s+const\s+(?!enum\b)([A-Za-z0-9_]+)/gm)].map((match) => match[1]!).sort();
}

function exportedConstEnums(text: string): readonly string[] {
  return [...text.matchAll(/^export\s+const\s+enum\s+([A-Za-z0-9_]+)/gm)].map((match) => match[1]!).sort();
}

function externalImports(filePath: string, text: string): readonly string[] {
  const imports: string[] = [];
  const expression = /^import\s+(?:type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm;
  for (const match of text.matchAll(expression)) {
    const importSpecifier = match[1]!;
    if (importSpecifier.startsWith('.')) {
      let resolvedPath = path.posix.normalize(path.posix.join(path.posix.dirname(filePath), importSpecifier));
      if (!resolvedPath.endsWith('.ts')) {
        resolvedPath += '.ts';
      }
      imports.push(resolvedPath);
    } else {
      imports.push(importSpecifier);
    }
  }
  return imports.sort();
}

function countImporters(targetPath: string, files: readonly string[]): number {
  const basename = targetPath.split('/').pop()!.replace(/\.ts$/, '');
  const literalPattern = new RegExp(`from\\s+['"][^'"]*\\b${basename}\\.ts['"]`);
  const noExtensionPattern = new RegExp(`from\\s+['"][^'"]*\\b${basename}['"]`);
  let observedImporterCount = 0;
  for (const filePath of files) {
    if (filePath === targetPath) {
      continue;
    }
    const text = readFileSync(filePath, 'utf8');
    if (literalPattern.test(text) || noExtensionPattern.test(text)) {
      observedImporterCount += 1;
    }
  }
  return observedImporterCount;
}

function sortedAscii(values: readonly string[]): readonly string[] {
  return [...values].sort((leftValue, rightValue) => (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0));
}

function expectAsciiSorted(values: readonly string[]): void {
  expect([...values]).toEqual([...sortedAscii(values)]);
}

function listCommittedTypeScriptFilenames(directoryPath: string): readonly string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .sort();
}

function listTestFilenames(directoryPath: string): readonly string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map((entry) => entry.name)
    .sort();
}

function scanTypeScriptFiles(globPattern: string): readonly string[] {
  return Array.from(new Bun.Glob(globPattern).scanSync({ cwd: process.cwd() }))
    .map((filePath) => filePath.replace(/\\/g, '/'))
    .sort();
}

function findLimitValue(limitName: string): number {
  const limitEntry = vanillaLimitSummary.limits.find((entry) => entry.name === limitName);
  expect(limitEntry).toBeDefined();
  return limitEntry!.value;
}

describe('inventory: map and world modules', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-007');
    expect(inventory.title).toBe('Inventory Map And World Modules');
    expect(inventory.lane).toBe('inventory');
  });

  test('inventory declares the canonical nine required top-level fields in canonical order', async () => {
    const rawText = await Bun.file(INVENTORY_JSON_PATH).text();
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const canonicalRequiredFieldsInOrder: readonly string[] = ['id', 'title', 'lane', 'summary', 'captured_at_utc', 'evidence_method', 'repository_root', 'implications', 'follow_up_steps'];
    const observedKeys = Object.keys(parsed);
    for (const requiredFieldName of canonicalRequiredFieldsInOrder) {
      expect(observedKeys).toContain(requiredFieldName);
    }
    const requiredFieldOrder = canonicalRequiredFieldsInOrder.map((requiredFieldName) => observedKeys.indexOf(requiredFieldName));
    for (let canonicalIndex = 1; canonicalIndex < requiredFieldOrder.length; canonicalIndex += 1) {
      expect(requiredFieldOrder[canonicalIndex]!).toBeGreaterThan(requiredFieldOrder[canonicalIndex - 1]!);
    }
  });

  test('inventory summary and evidence method identify the audited map and world surfaces', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.summary).toContain(MAP_DIRECTORY_PATH);
    expect(inventory.summary).toContain(WORLD_DIRECTORY_PATH);
    expect(inventory.summary).toContain('source-only metadata');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('git ls-files');
    expect(inventory.evidence_method).toContain('sha256sum');
    expect(inventory.evidence_method).toContain(MAP_DIRECTORY_PATH);
    expect(inventory.evidence_method).toContain(WORLD_DIRECTORY_PATH);
    expect(inventory.evidence_method).toContain('reference/manifests/wad-map-summary.json');
    expect(inventory.evidence_method).toContain('reference/manifests/vanilla-limit-summary.json');
  });

  test('inventory captured_at_utc is parseable as a UTC ISO 8601 timestamp ending in Z', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
  });

  test('inventory repository_root is the captured absolute path string', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('inventory source_directories enumerate src/map and src/world with on-disk totals', async () => {
    const inventory = await loadInventoryDocument();
    const observedPaths = inventory.source_directories.map((directoryEntry) => directoryEntry.relative_path);
    expect([...observedPaths]).toEqual([MAP_DIRECTORY_PATH, WORLD_DIRECTORY_PATH]);

    for (const directoryEntry of inventory.source_directories) {
      expect(directoryEntry.exists).toBe(true);
      expect(existsSync(directoryEntry.relative_path)).toBe(true);
      expectAsciiSorted(directoryEntry.committed_filenames_sorted);
      const onDiskFilenames = listCommittedTypeScriptFilenames(directoryEntry.relative_path);
      expect([...directoryEntry.committed_filenames_sorted]).toEqual([...onDiskFilenames]);
      expect(directoryEntry.committed_file_count).toBe(onDiskFilenames.length);

      let totalSizeBytes = 0;
      let totalLineCount = 0;
      let totalExportCount = 0;
      for (const filename of onDiskFilenames) {
        const filePath = `${directoryEntry.relative_path}${filename}`;
        totalSizeBytes += statSync(filePath).size;
        totalLineCount += countLines(filePath);
        totalExportCount += countExports(filePath);
      }
      expect(directoryEntry.total_size_bytes).toBe(totalSizeBytes);
      expect(directoryEntry.total_line_count).toBe(totalLineCount);
      expect(directoryEntry.total_export_count).toBe(totalExportCount);
    }
  });

  test('inventory modules are sorted ASCIIbetically and cover the canonical map plus world source paths', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.modules.length).toBe(MODULE_PATHS_SORTED.length);
    const observedPaths = inventory.modules.map((moduleEntry) => moduleEntry.relative_path);
    expectAsciiSorted(observedPaths);
    expect([...observedPaths]).toEqual([...MODULE_PATHS_SORTED]);
  });

  test('inventory module groups match the canonical map loader, spatial query, and world partitions', async () => {
    const inventory = await loadInventoryDocument();
    const grouped = new Map<string, string[]>();
    for (const allowedGroup of ALLOWED_GROUP_VALUES) {
      grouped.set(allowedGroup, []);
    }
    for (const moduleEntry of inventory.modules) {
      expect(ALLOWED_GROUP_VALUES).toContain(moduleEntry.group);
      grouped.get(moduleEntry.group)!.push(moduleEntry.relative_path);
    }

    expect([...grouped.get('map_loader')!].sort()).toEqual(['src/map/blockmap.ts', 'src/map/bspStructs.ts', 'src/map/lineSectorGeometry.ts', 'src/map/mapBundle.ts', 'src/map/mapSetup.ts', 'src/map/reject.ts', 'src/map/things.ts']);
    expect([...grouped.get('spatial_query')!].sort()).toEqual(['src/map/blockmapIter.ts', 'src/map/intercepts.ts', 'src/map/nodeTraversal.ts', 'src/map/subsectorQuery.ts']);
    expect([...grouped.get('world_collision')!].sort()).toEqual([
      'src/world/checkPosition.ts',
      'src/world/radiusAttack.ts',
      'src/world/sectorChange.ts',
      'src/world/slideMove.ts',
      'src/world/teleport.ts',
      'src/world/tryMove.ts',
      'src/world/useLines.ts',
    ]);
    expect([...grouped.get('world_state')!].sort()).toEqual(['src/world/mobj.ts', 'src/world/thinkers.ts']);
    expect([...grouped.get('world_ticker')!].sort()).toEqual(['src/world/xyMovement.ts', 'src/world/zMovement.ts']);
  });

  test('inventory module entries match on-disk size, line count, sha256, exports, imports, and importer counts', async () => {
    const inventory = await loadInventoryDocument();
    const allSourceFiles = scanTypeScriptFiles('src/**/*.ts');
    const allTestFiles = scanTypeScriptFiles('test/**/*.ts');

    for (const moduleEntry of inventory.modules) {
      expect(existsSync(moduleEntry.relative_path)).toBe(true);
      expect(moduleEntry.size_bytes).toBe(statSync(moduleEntry.relative_path).size);
      expect(moduleEntry.line_count).toBe(countLines(moduleEntry.relative_path));
      expect(moduleEntry.sha256).toBe(computeSha256(moduleEntry.relative_path));

      const sourceText = readFileSync(moduleEntry.relative_path, 'utf8');
      expect(moduleEntry.exported_interfaces).toEqual(exportedNames(sourceText, 'interface'));
      expect(moduleEntry.exported_functions).toEqual(exportedNames(sourceText, 'function'));
      expect(moduleEntry.exported_constants).toEqual(exportedConstants(sourceText));
      expect(moduleEntry.exported_classes).toEqual(exportedNames(sourceText, 'class'));
      expect(moduleEntry.exported_types).toEqual(exportedNames(sourceText, 'type'));
      expect(moduleEntry.exported_const_enums).toEqual(exportedConstEnums(sourceText));
      expect(moduleEntry.external_imports).toEqual(externalImports(moduleEntry.relative_path, sourceText));
      expect(moduleEntry.src_importer_count).toBe(countImporters(moduleEntry.relative_path, allSourceFiles));
      expect(moduleEntry.test_importer_count).toBe(countImporters(moduleEntry.relative_path, allTestFiles));
    }
  });

  test('inventory module role and vanilla_concept_modeled fields are non-empty Chocolate Doom 2.2.1 anchors', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      expect(moduleEntry.role.length).toBeGreaterThan(0);
      expect(moduleEntry.vanilla_concept_modeled.length).toBeGreaterThan(0);
      expect(moduleEntry.vanilla_concept_modeled).toContain('Chocolate Doom 2.2.1');
    }
  });

  test('inventory external imports are sorted and only reference node modules or files that exist on disk', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      expectAsciiSorted(moduleEntry.external_imports);
      for (const importedReference of moduleEntry.external_imports) {
        if (importedReference.startsWith('node:')) {
          continue;
        }
        expect(existsSync(importedReference)).toBe(true);
      }
    }
  });

  test('inventory importer profile records every listed module as covered by tests', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      expect(moduleEntry.test_importer_count).toBeGreaterThan(0);
    }
  });

  test('inventory test_coverage matches the committed map and world test roots', async () => {
    const inventory = await loadInventoryDocument();
    const observedRoots = inventory.test_coverage.test_roots.map((testRoot) => testRoot.relative_path);
    expect([...observedRoots]).toEqual(['test/map/', 'test/world/']);

    for (const testRoot of inventory.test_coverage.test_roots) {
      expect(existsSync(testRoot.relative_path)).toBe(true);
      expectAsciiSorted(testRoot.test_filenames_sorted);
      const onDiskTestFilenames = listTestFilenames(testRoot.relative_path);
      expect([...testRoot.test_filenames_sorted]).toEqual([...onDiskTestFilenames]);
      expect(testRoot.test_file_count).toBe(onDiskTestFilenames.length);
    }
    expect(inventory.test_coverage.notes).toContain('test/map/');
    expect(inventory.test_coverage.notes).toContain('test/world/');
  });

  test('inventory reference_manifest_status matches local map and vanilla limit manifests without embedding WAD bytes', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.reference_manifest_status;
    expect(status.wad_map_summary_relative_path).toBe('reference/manifests/wad-map-summary.json');
    expect(status.shareware_map_count).toBe(wadMapSummary.maps.length);
    expect(status.map_data_lump_count).toBe(wadMapSummary.lumpCategories['map-data']);
    expect([...status.map_lump_order]).toEqual([...wadMapSummary.mapLumpOrder]);
    expect(status.vanilla_limit_summary_relative_path).toBe('reference/manifests/vanilla-limit-summary.json');
    expect(status.maxintercepts_limit).toBe(findLimitValue('MAXINTERCEPTS'));
    expect(status.maxspecialcross_limit).toBe(findLimitValue('MAXSPECIALCROSS'));
    expect(status.maxplayers_limit).toBe(findLimitValue('MAXPLAYERS'));
    expect(status.notes).toContain('does not embed WAD bytes');
  });

  test('inventory world_boundary_status partitions map and world modules and preserves source-only metadata status', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.world_boundary_status;
    expectAsciiSorted(status.map_modules_sorted);
    expectAsciiSorted(status.world_modules_sorted);
    expect([...status.map_modules_sorted]).toEqual([...MAP_MODULE_PATHS_SORTED]);
    expect([...status.world_modules_sorted]).toEqual([...WORLD_MODULE_PATHS_SORTED]);
    expect(status.runtime_module_count).toBe(MODULE_PATHS_SORTED.length);
    expect(status.source_only_metadata).toBe(true);
    expect(status.notes).toContain('src/map/');
    expect(status.notes).toContain('src/world/');
  });

  test('inventory implications reference map setup, collision, world thinkers, manifests, and downstream map gates', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain(MAP_DIRECTORY_PATH);
    expect(concatenatedImplications).toContain(WORLD_DIRECTORY_PATH);
    expect(concatenatedImplications).toContain('map setup');
    expect(concatenatedImplications).toContain('collision');
    expect(concatenatedImplications).toContain('thinker');
    expect(concatenatedImplications).toContain('reference/manifests/wad-map-summary.json');
    expect(concatenatedImplications).toContain('06-032');
  });

  test('inventory follow_up_steps point at real plan_vanilla_parity step files', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.follow_up_steps.length).toBeGreaterThan(0);
    for (const followUpEntry of inventory.follow_up_steps) {
      const stepIdMatch = /^(\d{2}-\d{3})\s+(.+)$/.exec(followUpEntry);
      expect(stepIdMatch).not.toBeNull();
      const stepId = stepIdMatch![1]!;
      const stepSlug = stepIdMatch![2]!;
      const stepFilePath = `plan_vanilla_parity/steps/${stepId}-${stepSlug}.md`;
      expect(existsSync(stepFilePath)).toBe(true);
      expect(statSync(stepFilePath).isFile()).toBe(true);
    }
  });

  test('step file under plan_vanilla_parity/steps pins the same write lock paths as this test enforces', async () => {
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain(INVENTORY_JSON_PATH);
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-map-and-world-modules.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a tampered inventory that marks a world state module as a map loader diverges from the captured snapshot', async () => {
    const inventory = await loadInventoryDocument();
    const originalEntry = inventory.modules.find((moduleEntry) => moduleEntry.relative_path === 'src/world/mobj.ts')!;
    const tamperedEntry: InventoryModuleEntry = {
      ...originalEntry,
      group: 'map_loader',
    };
    expect(tamperedEntry.group).not.toBe(originalEntry.group);
  });

  test('failure mode: a fabricated module fingerprint with a bogus sha256 would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstModuleEntry = inventory.modules[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstModuleEntry.sha256).not.toBe(fabricatedSha256);
    expect(firstModuleEntry.sha256).toBe(computeSha256(firstModuleEntry.relative_path));
  });

  test('failure mode: a tampered reference manifest status with a wrong map count diverges from the manifest', async () => {
    const inventory = await loadInventoryDocument();
    const tamperedStatus: InventoryReferenceManifestStatus = {
      ...inventory.reference_manifest_status,
      shareware_map_count: inventory.reference_manifest_status.shareware_map_count + 1,
    };
    expect(tamperedStatus.shareware_map_count).not.toBe(wadMapSummary.maps.length);
  });

  test('failure mode: a test coverage snapshot that drops the world root diverges from the captured test surface', async () => {
    const inventory = await loadInventoryDocument();
    const tamperedCoverage: InventoryTestCoverage = {
      ...inventory.test_coverage,
      test_roots: inventory.test_coverage.test_roots.filter((testRoot) => testRoot.relative_path !== 'test/world/'),
    };
    expect(tamperedCoverage.test_roots.length).not.toBe(inventory.test_coverage.test_roots.length);
    expect(tamperedCoverage.test_roots.map((testRoot) => testRoot.relative_path)).not.toContain('test/world/');
  });
});
