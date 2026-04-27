import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-src-playable-contract-modules.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-004-inventory-src-playable-contract-modules.md';
const PLAYABLE_DIRECTORY_PATH = 'src/playable/';
const SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH = 'src/main.ts';
const VANILLA_ORCHESTRATOR_PATH = 'src/mainLoop.ts';
const RUNTIME_TARGET_COMMAND_LITERAL = 'bun run doom.ts';
const TEST_PLAYABLE_DIRECTORY_PATH = 'test/playable/';
const TEST_PLAYABLE_ACCEPTANCE_DIRECTORY_PATH = 'test/playable/acceptance/';
const FILE_CONSTRUCTING_RUNTIME_COMMAND_AT_RUNTIME = 'src/playable/window-host/createBunCompatibleWin32Window.ts';

interface InventoryFileFingerprint {
  readonly relative_path: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly export_count: number;
}

interface InventorySubdirectorySummary {
  readonly relative_path: string;
  readonly subdirectory_name: string;
  readonly vanilla_concept_modeled: string;
  readonly file_count: number;
  readonly total_size_bytes: number;
  readonly total_line_count: number;
  readonly total_export_count: number;
  readonly files: readonly InventoryFileFingerprint[];
}

interface InventoryPlayableDirectory {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly committed_file_count: number;
  readonly subdirectory_count: number;
  readonly subdirectory_names_sorted: readonly string[];
  readonly owner_lane: string | null;
  readonly owner_lane_source: string;
}

interface InventoryRuntimeStatus {
  readonly is_runtime_path: boolean;
  readonly runtime_target_command: string;
  readonly files_referencing_runtime_target_command_literal_count: number;
  readonly files_constructing_runtime_target_command_at_runtime: readonly string[];
  readonly importer_count_of_playable_outside_playable_in_src: number;
  readonly simplified_launcher_entrypoint: string;
  readonly simplified_launcher_imports_any_playable_module: boolean;
  readonly vanilla_orchestrator_module: string;
  readonly vanilla_orchestrator_imports_any_playable_module: boolean;
  readonly notes: string;
}

interface InventoryTestCoverageEntry {
  readonly subdirectory_name: string;
  readonly src_file_count: number;
  readonly test_file_count: number;
}

interface InventoryTestCoverage {
  readonly test_root: string;
  readonly per_subdirectory_test_counts: readonly InventoryTestCoverageEntry[];
  readonly acceptance_test_directory: string;
  readonly acceptance_test_file_count: number;
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
  readonly playable_directory: InventoryPlayableDirectory;
  readonly playable_subdirectories: readonly InventorySubdirectorySummary[];
  readonly runtime_status: InventoryRuntimeStatus;
  readonly non_playable_dependency_modules_sorted: readonly string[];
  readonly test_coverage: InventoryTestCoverage;
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
  const matches = text.match(/^export\s+(?:async\s+)?(?:interface|function|const|class|type)\s+\w+/gm);
  return matches ? matches.length : 0;
}

function sortedAscii(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function expectAsciiSorted(values: readonly string[]): void {
  expect([...values]).toEqual([...sortedAscii(values)]);
}

function listTypeScriptFilesIn(directoryPath: string): string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .sort();
}

function listTestFilesIn(directoryPath: string): string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map((entry) => entry.name)
    .sort();
}

describe('inventory: src playable contract modules', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-004');
    expect(inventory.title).toBe('Inventory Src Playable Contract Modules');
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

  test('inventory summary is a non-empty string and names the runtime-target literal anchor', async () => {
    const inventory = await loadInventoryDocument();
    expect(typeof inventory.summary).toBe('string');
    expect(inventory.summary.length).toBeGreaterThan(0);
    expect(inventory.summary).toContain(RUNTIME_TARGET_COMMAND_LITERAL);
    expect(inventory.summary).toContain('src/playable/');
  });

  test('inventory captured_at_utc is parseable as a UTC ISO 8601 timestamp ending in Z', async () => {
    const inventory = await loadInventoryDocument();
    expect(typeof inventory.captured_at_utc).toBe('string');
    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    const parsedTimestamp = new Date(inventory.captured_at_utc);
    expect(Number.isFinite(parsedTimestamp.getTime())).toBe(true);
  });

  test('inventory evidence_method names the inventory lane and concrete data sources consulted', async () => {
    const inventory = await loadInventoryDocument();
    expect(typeof inventory.evidence_method).toBe('string');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('src/playable/');
    expect(inventory.evidence_method).toContain('git ls-files');
    expect(inventory.evidence_method).toContain('sha256sum');
  });

  test('inventory repository_root is the captured absolute path string', async () => {
    const inventory = await loadInventoryDocument();
    expect(typeof inventory.repository_root).toBe('string');
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('inventory playable_directory enumerates the twelve committed subdirectories sorted ASCIIbetically', async () => {
    const inventory = await loadInventoryDocument();
    const directory = inventory.playable_directory;
    expect(directory.relative_path).toBe(PLAYABLE_DIRECTORY_PATH);
    expect(directory.exists).toBe(true);
    expect(existsSync(PLAYABLE_DIRECTORY_PATH)).toBe(true);
    expect(directory.subdirectory_count).toBe(12);
    expectAsciiSorted(directory.subdirectory_names_sorted);
    expect([...directory.subdirectory_names_sorted]).toEqual([
      'audio-product-integration',
      'bun-launch-local-distribution-boundary',
      'bun-runtime-entry-point',
      'config-persistence',
      'demo-replay',
      'front-end-menus',
      'game-session-wiring',
      'input',
      'real-time-main-loop',
      'rendering-product-integration',
      'save-load-playability',
      'window-host',
    ]);
    expect(directory.committed_file_count).toBe(153);

    const onDiskSubdirectoryNames = readdirSync(PLAYABLE_DIRECTORY_PATH, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(onDiskSubdirectoryNames).toEqual([...directory.subdirectory_names_sorted]);
  });

  test('inventory playable_directory owner_lane is null because no row in PARALLEL_WORK.md owns src/playable/', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.playable_directory.owner_lane).toBeNull();
    expect(inventory.playable_directory.owner_lane_source).toContain('PARALLEL_WORK.md');
    expect(inventory.playable_directory.owner_lane_source).toContain('contract');

    const parallelWorkText = readFileSync('plan_vanilla_parity/PARALLEL_WORK.md', 'utf8');
    expect(parallelWorkText).not.toContain('src/playable/');
  });

  test('inventory playable_subdirectories matches each subdirectory name in canonical sort order', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.playable_subdirectories.length).toBe(12);
    const observedSubdirectoryNames = inventory.playable_subdirectories.map((entry) => entry.subdirectory_name);
    expectAsciiSorted(observedSubdirectoryNames);
    expect(observedSubdirectoryNames).toEqual([...inventory.playable_directory.subdirectory_names_sorted]);
  });

  test('inventory playable_subdirectories total file_count sums to the captured committed_file_count', async () => {
    const inventory = await loadInventoryDocument();
    const summedFileCount = inventory.playable_subdirectories.reduce((accumulator, entry) => accumulator + entry.file_count, 0);
    expect(summedFileCount).toBe(inventory.playable_directory.committed_file_count);
  });

  test('inventory playable_subdirectories file lists are sorted ASCIIbetically', async () => {
    const inventory = await loadInventoryDocument();
    for (const subdirectoryEntry of inventory.playable_subdirectories) {
      const observedFilePaths = subdirectoryEntry.files.map((fileEntry) => fileEntry.relative_path);
      expectAsciiSorted(observedFilePaths);
    }
  });

  test('inventory playable_subdirectories file fingerprints match on-disk size, line count, sha256, and export count', async () => {
    const inventory = await loadInventoryDocument();
    for (const subdirectoryEntry of inventory.playable_subdirectories) {
      const subdirectoryPath = `${PLAYABLE_DIRECTORY_PATH}${subdirectoryEntry.subdirectory_name}/`;
      expect(subdirectoryEntry.relative_path).toBe(subdirectoryPath);
      expect(existsSync(subdirectoryPath)).toBe(true);

      const onDiskFileNames = listTypeScriptFilesIn(subdirectoryPath);
      expect(subdirectoryEntry.file_count).toBe(onDiskFileNames.length);
      expect(subdirectoryEntry.files.length).toBe(onDiskFileNames.length);

      let summedSize = 0;
      let summedLineCount = 0;
      let summedExportCount = 0;
      for (const fileEntry of subdirectoryEntry.files) {
        expect(existsSync(fileEntry.relative_path)).toBe(true);
        const onDiskSize = statSync(fileEntry.relative_path).size;
        expect(fileEntry.size_bytes).toBe(onDiskSize);
        expect(fileEntry.line_count).toBe(countLines(fileEntry.relative_path));
        expect(fileEntry.sha256).toBe(computeSha256(fileEntry.relative_path));
        expect(fileEntry.export_count).toBe(countExports(fileEntry.relative_path));
        summedSize += fileEntry.size_bytes;
        summedLineCount += fileEntry.line_count;
        summedExportCount += fileEntry.export_count;
      }
      expect(subdirectoryEntry.total_size_bytes).toBe(summedSize);
      expect(subdirectoryEntry.total_line_count).toBe(summedLineCount);
      expect(subdirectoryEntry.total_export_count).toBe(summedExportCount);
    }
  });

  test('inventory playable_subdirectories vanilla_concept_modeled fields are non-empty and reference Chocolate Doom 2.2.1', async () => {
    const inventory = await loadInventoryDocument();
    for (const subdirectoryEntry of inventory.playable_subdirectories) {
      expect(typeof subdirectoryEntry.vanilla_concept_modeled).toBe('string');
      expect(subdirectoryEntry.vanilla_concept_modeled.length).toBeGreaterThan(0);
      expect(subdirectoryEntry.vanilla_concept_modeled).toContain('Chocolate Doom 2.2.1');
    }
  });

  test('inventory runtime_status flags src/playable/ as a contract surface and not a runtime path', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.runtime_status;
    expect(status.is_runtime_path).toBe(false);
    expect(status.runtime_target_command).toBe(RUNTIME_TARGET_COMMAND_LITERAL);
    expect(status.simplified_launcher_entrypoint).toBe(SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH);
    expect(status.simplified_launcher_imports_any_playable_module).toBe(false);
    expect(status.vanilla_orchestrator_module).toBe(VANILLA_ORCHESTRATOR_PATH);
    expect(status.vanilla_orchestrator_imports_any_playable_module).toBe(false);
    expect(existsSync(SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH)).toBe(true);
    expect(existsSync(VANILLA_ORCHESTRATOR_PATH)).toBe(true);

    const launcherSource = readFileSync(SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH, 'utf8');
    expect(launcherSource).not.toMatch(/from\s+['"][^'"]*\bplayable\//);
    const orchestratorSource = readFileSync(VANILLA_ORCHESTRATOR_PATH, 'utf8');
    expect(orchestratorSource).not.toMatch(/from\s+['"][^'"]*\bplayable\//);
  });

  test('inventory runtime_status records zero non-playable importers of src/playable/ across the entire src/ tree', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.runtime_status;
    expect(status.importer_count_of_playable_outside_playable_in_src).toBe(0);

    const allSourceFiles = Array.from(new Bun.Glob('src/**/*.ts').scanSync({ cwd: process.cwd() }));
    let observedImporterCount = 0;
    for (const sourceFilePath of allSourceFiles) {
      const normalizedPath = sourceFilePath.replace(/\\/g, '/');
      if (normalizedPath.startsWith('src/playable/')) {
        continue;
      }
      const sourceText = readFileSync(normalizedPath, 'utf8');
      if (/^import\s+.*from\s+['"][^'"]*\bplayable\//m.test(sourceText)) {
        observedImporterCount += 1;
      }
    }
    expect(observedImporterCount).toBe(0);
  });

  test('inventory runtime_status records the literal-vs-template runtime-command split with verifiable evidence', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.runtime_status;
    expect(status.files_referencing_runtime_target_command_literal_count).toBe(152);
    expect([...status.files_constructing_runtime_target_command_at_runtime]).toEqual([FILE_CONSTRUCTING_RUNTIME_COMMAND_AT_RUNTIME]);

    expect(existsSync(FILE_CONSTRUCTING_RUNTIME_COMMAND_AT_RUNTIME)).toBe(true);
    const constructorFileText = readFileSync(FILE_CONSTRUCTING_RUNTIME_COMMAND_AT_RUNTIME, 'utf8');
    expect(constructorFileText).not.toContain(RUNTIME_TARGET_COMMAND_LITERAL);
    expect(constructorFileText).toContain('TARGET_RUNTIME_PROGRAM');
    expect(constructorFileText).toContain('TARGET_RUNTIME_SUBCOMMAND');
    expect(constructorFileText).toContain('TARGET_RUNTIME_ENTRY_FILE');

    let observedLiteralCount = 0;
    for (const subdirectoryEntry of inventory.playable_subdirectories) {
      for (const fileEntry of subdirectoryEntry.files) {
        const sourceText = readFileSync(fileEntry.relative_path, 'utf8');
        if (sourceText.includes(RUNTIME_TARGET_COMMAND_LITERAL)) {
          observedLiteralCount += 1;
        }
      }
    }
    expect(observedLiteralCount).toBe(status.files_referencing_runtime_target_command_literal_count);
  });

  test('inventory non_playable_dependency_modules_sorted is sorted and references node:* or files that exist on disk', async () => {
    const inventory = await loadInventoryDocument();
    expectAsciiSorted(inventory.non_playable_dependency_modules_sorted);
    for (const dependencyModule of inventory.non_playable_dependency_modules_sorted) {
      if (dependencyModule.startsWith('node:')) {
        continue;
      }
      expect(existsSync(dependencyModule)).toBe(true);
    }
  });

  test('inventory test_coverage records the matching test file count for each playable subdirectory', async () => {
    const inventory = await loadInventoryDocument();
    const testCoverage = inventory.test_coverage;
    expect(testCoverage.test_root).toBe(TEST_PLAYABLE_DIRECTORY_PATH);
    expect(testCoverage.acceptance_test_directory).toBe(TEST_PLAYABLE_ACCEPTANCE_DIRECTORY_PATH);
    expect(existsSync(TEST_PLAYABLE_DIRECTORY_PATH)).toBe(true);
    expect(existsSync(TEST_PLAYABLE_ACCEPTANCE_DIRECTORY_PATH)).toBe(true);

    expect(testCoverage.per_subdirectory_test_counts.length).toBe(inventory.playable_directory.subdirectory_count);
    for (const coverageEntry of testCoverage.per_subdirectory_test_counts) {
      const sourceSubdirectoryPath = `${PLAYABLE_DIRECTORY_PATH}${coverageEntry.subdirectory_name}/`;
      const testSubdirectoryPath = `${TEST_PLAYABLE_DIRECTORY_PATH}${coverageEntry.subdirectory_name}/`;
      expect(existsSync(sourceSubdirectoryPath)).toBe(true);
      expect(existsSync(testSubdirectoryPath)).toBe(true);
      const onDiskSourceFileCount = listTypeScriptFilesIn(sourceSubdirectoryPath).length;
      const onDiskTestFileCount = listTestFilesIn(testSubdirectoryPath).length;
      expect(coverageEntry.src_file_count).toBe(onDiskSourceFileCount);
      expect(coverageEntry.test_file_count).toBe(onDiskTestFileCount);
      expect(coverageEntry.src_file_count).toBe(coverageEntry.test_file_count);
    }
    expect(testCoverage.acceptance_test_file_count).toBe(listTestFilesIn(TEST_PLAYABLE_ACCEPTANCE_DIRECTORY_PATH).length);
  });

  test('inventory implications reference the contract surface, the runtime target, and the orchestrator bypass', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain('src/playable/');
    expect(concatenatedImplications).toContain('src/mainLoop.ts');
    expect(concatenatedImplications).toContain(RUNTIME_TARGET_COMMAND_LITERAL);
    expect(concatenatedImplications).toContain('PARALLEL_WORK.md');
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

  test('step file under plan_vanilla_parity/steps/ pins the same write lock paths as this test enforces', async () => {
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('plan_vanilla_parity/current-state/inventory-src-playable-contract-modules.json');
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-src-playable-contract-modules.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a tampered inventory that flips runtime_status.is_runtime_path diverges from the captured snapshot', async () => {
    const inventory = await loadInventoryDocument();
    const tamperedInventory: InventoryDocument = {
      ...inventory,
      runtime_status: {
        ...inventory.runtime_status,
        is_runtime_path: true,
      },
    };
    expect(tamperedInventory.runtime_status.is_runtime_path).not.toBe(inventory.runtime_status.is_runtime_path);
  });

  test('failure mode: a fabricated subdirectory file fingerprint with a bogus sha256 would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstSubdirectoryEntry = inventory.playable_subdirectories[0]!;
    const firstFileEntry = firstSubdirectoryEntry.files[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstFileEntry.sha256).not.toBe(fabricatedSha256);
    expect(firstFileEntry.sha256).toBe(computeSha256(firstFileEntry.relative_path));
  });
});
