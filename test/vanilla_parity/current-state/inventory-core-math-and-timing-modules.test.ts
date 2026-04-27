import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-core-math-and-timing-modules.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-005-inventory-core-math-and-timing-modules.md';
const CORE_DIRECTORY_PATH = 'src/core/';
const CORE_COMMITTED_FILENAMES_SORTED: readonly string[] = [
  'angle.ts',
  'audit-angle-type-and-wrap-semantics.ts',
  'audit-fixed-divide-semantics.ts',
  'audit-fixed-multiply-overflow-semantics.ts',
  'audit-fixed-point-constants.ts',
  'binaryReader.ts',
  'fixed.ts',
  'rng.ts',
  'trig.ts',
];
const TIC_ACCUMULATOR_PATH = 'src/host/ticAccumulator.ts';
const MAIN_LOOP_PATH = 'src/mainLoop.ts';
const SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH = 'src/main.ts';
const ALL_MODULE_PATHS_SORTED: readonly string[] = [
  'src/core/angle.ts',
  'src/core/audit-angle-type-and-wrap-semantics.ts',
  'src/core/audit-fixed-divide-semantics.ts',
  'src/core/audit-fixed-multiply-overflow-semantics.ts',
  'src/core/audit-fixed-point-constants.ts',
  'src/core/binaryReader.ts',
  'src/core/fixed.ts',
  'src/core/rng.ts',
  'src/core/trig.ts',
  'src/host/ticAccumulator.ts',
  'src/mainLoop.ts',
];
const ALLOWED_GROUP_VALUES: readonly string[] = ['audit_ledger', 'core_math', 'timing'];

interface InventoryCoreDirectory {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly committed_file_count: number;
  readonly committed_filenames_sorted: readonly string[];
  readonly owner_lane: string;
  readonly owner_lane_source: string;
}

interface InventoryTimingModulePaths {
  readonly tic_accumulator_relative_path: string;
  readonly tic_accumulator_owner_lane: string;
  readonly tic_accumulator_owner_lane_source: string;
  readonly main_loop_relative_path: string;
  readonly main_loop_owner_lane: string;
  readonly main_loop_owner_lane_source: string;
  readonly notes: string;
}

interface InventoryModuleEntry {
  readonly relative_path: string;
  readonly group: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly vanilla_function_modeled: string;
  readonly role: string;
  readonly exported_interfaces: readonly string[];
  readonly exported_functions: readonly string[];
  readonly exported_constants: readonly string[];
  readonly exported_classes: readonly string[];
  readonly exported_types: readonly string[];
  readonly external_imports: readonly string[];
  readonly src_importer_count: number;
  readonly test_importer_count: number;
}

interface InventoryDeterminismBoundaryStatus {
  readonly is_determinism_boundary: boolean;
  readonly primary_module_paths_sorted: readonly string[];
  readonly audit_ledger_module_paths_sorted: readonly string[];
  readonly timing_module_paths_sorted: readonly string[];
  readonly claude_md_anchor: string;
  readonly notes: string;
}

interface InventoryVanillaOrchestratorWiringStatus {
  readonly simplified_launcher_entrypoint_relative_path: string;
  readonly simplified_launcher_directly_imports_any_listed_module: boolean;
  readonly simplified_launcher_indirect_dependency_paths_sorted: readonly string[];
  readonly main_loop_orchestrator_relative_path: string;
  readonly main_loop_orchestrator_imports_any_core_math_or_timing_module: boolean;
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
  readonly core_directory: InventoryCoreDirectory;
  readonly timing_module_paths: InventoryTimingModulePaths;
  readonly modules: readonly InventoryModuleEntry[];
  readonly determinism_boundary_status: InventoryDeterminismBoundaryStatus;
  readonly vanilla_orchestrator_wiring_status: InventoryVanillaOrchestratorWiringStatus;
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

function sortedAscii(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function expectAsciiSorted(values: readonly string[]): void {
  expect([...values]).toEqual([...sortedAscii(values)]);
}

function countSrcImporters(targetPath: string): number {
  const basename = targetPath.split('/').pop()!.replace(/\.ts$/, '');
  const literalPattern = new RegExp(`from\\s+['"][^'"]*\\b${basename}\\.ts['"]`);
  const noExtensionPattern = new RegExp(`from\\s+['"][^'"]*\\b${basename}['"]`);
  const allSourceFiles = Array.from(new Bun.Glob('src/**/*.ts').scanSync({ cwd: process.cwd() }));
  let observedImporterCount = 0;
  for (const sourceFilePath of allSourceFiles) {
    const normalizedPath = sourceFilePath.replace(/\\/g, '/');
    if (normalizedPath === targetPath) {
      continue;
    }
    const sourceText = readFileSync(normalizedPath, 'utf8');
    if (literalPattern.test(sourceText) || noExtensionPattern.test(sourceText)) {
      observedImporterCount += 1;
    }
  }
  return observedImporterCount;
}

function countTestImporters(targetPath: string): number {
  const basename = targetPath.split('/').pop()!.replace(/\.ts$/, '');
  const literalPattern = new RegExp(`from\\s+['"][^'"]*\\b${basename}\\.ts['"]`);
  const noExtensionPattern = new RegExp(`from\\s+['"][^'"]*\\b${basename}['"]`);
  const allTestFiles = Array.from(new Bun.Glob('test/**/*.ts').scanSync({ cwd: process.cwd() }));
  let observedImporterCount = 0;
  for (const testFilePath of allTestFiles) {
    const normalizedPath = testFilePath.replace(/\\/g, '/');
    const sourceText = readFileSync(normalizedPath, 'utf8');
    if (literalPattern.test(sourceText) || noExtensionPattern.test(sourceText)) {
      observedImporterCount += 1;
    }
  }
  return observedImporterCount;
}

describe('inventory: core math and timing modules', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-005');
    expect(inventory.title).toBe('Inventory Core Math And Timing Modules');
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

  test('inventory summary is a non-empty string and names the determinism boundary anchors', async () => {
    const inventory = await loadInventoryDocument();
    expect(typeof inventory.summary).toBe('string');
    expect(inventory.summary.length).toBeGreaterThan(0);
    expect(inventory.summary).toContain('src/core/');
    expect(inventory.summary).toContain('src/host/ticAccumulator.ts');
    expect(inventory.summary).toContain('src/mainLoop.ts');
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
    expect(inventory.evidence_method).toContain('src/core/');
    expect(inventory.evidence_method).toContain('src/host/ticAccumulator.ts');
    expect(inventory.evidence_method).toContain('src/mainLoop.ts');
    expect(inventory.evidence_method).toContain('git ls-files');
    expect(inventory.evidence_method).toContain('sha256sum');
  });

  test('inventory repository_root is the captured absolute path string', async () => {
    const inventory = await loadInventoryDocument();
    expect(typeof inventory.repository_root).toBe('string');
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('inventory core_directory enumerates exactly the nine committed src/core/ filenames sorted ASCIIbetically', async () => {
    const inventory = await loadInventoryDocument();
    const directory = inventory.core_directory;
    expect(directory.relative_path).toBe(CORE_DIRECTORY_PATH);
    expect(directory.exists).toBe(true);
    expect(existsSync(CORE_DIRECTORY_PATH)).toBe(true);
    expect(directory.committed_file_count).toBe(9);
    expectAsciiSorted(directory.committed_filenames_sorted);
    expect([...directory.committed_filenames_sorted]).toEqual([...CORE_COMMITTED_FILENAMES_SORTED]);
    expect(directory.owner_lane).toBe('core');
    expect(directory.owner_lane_source).toContain('PARALLEL_WORK.md');
  });

  test('inventory core_directory lane ownership matches the core row in plan_vanilla_parity/PARALLEL_WORK.md', async () => {
    const inventory = await loadInventoryDocument();
    const parallelWorkText = readFileSync('plan_vanilla_parity/PARALLEL_WORK.md', 'utf8');
    const coreRowMatch = /\|\s*core\s*\|[^|]*\|[^|]*\|([^|]*)\|/.exec(parallelWorkText);
    expect(coreRowMatch).not.toBeNull();
    const coreRowOwnsColumn = coreRowMatch![1]!;
    expect(coreRowOwnsColumn).toContain('src/core/');
    expect(coreRowOwnsColumn).toContain('src/mainLoop.ts');
    expect(inventory.core_directory.owner_lane).toBe('core');
  });

  test('inventory timing_module_paths anchors src/host/ticAccumulator.ts to launch and src/mainLoop.ts to core', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.timing_module_paths;
    expect(status.tic_accumulator_relative_path).toBe(TIC_ACCUMULATOR_PATH);
    expect(status.tic_accumulator_owner_lane).toBe('launch');
    expect(status.tic_accumulator_owner_lane_source).toContain('PARALLEL_WORK.md');
    expect(status.main_loop_relative_path).toBe(MAIN_LOOP_PATH);
    expect(status.main_loop_owner_lane).toBe('core');
    expect(status.main_loop_owner_lane_source).toContain('PARALLEL_WORK.md');
    expect(existsSync(TIC_ACCUMULATOR_PATH)).toBe(true);
    expect(existsSync(MAIN_LOOP_PATH)).toBe(true);

    const parallelWorkText = readFileSync('plan_vanilla_parity/PARALLEL_WORK.md', 'utf8');
    const launchRowMatch = /\|\s*launch\s*\|[^|]*\|[^|]*\|([^|]*)\|/.exec(parallelWorkText);
    expect(launchRowMatch).not.toBeNull();
    expect(launchRowMatch![1]!).toContain('src/host/');
  });

  test('inventory modules entries are sorted ASCIIbetically by relative_path and cover all eleven target paths', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.modules.length).toBe(ALL_MODULE_PATHS_SORTED.length);
    const observedPaths = inventory.modules.map((moduleEntry) => moduleEntry.relative_path);
    expectAsciiSorted(observedPaths);
    expect([...observedPaths]).toEqual([...ALL_MODULE_PATHS_SORTED]);
  });

  test('inventory modules group field is one of the allowed values', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      expect(ALLOWED_GROUP_VALUES).toContain(moduleEntry.group);
    }
  });

  test('inventory modules grouping matches the canonical core_math, audit_ledger, and timing partitions', async () => {
    const inventory = await loadInventoryDocument();
    const grouped = new Map<string, string[]>();
    for (const allowedGroup of ALLOWED_GROUP_VALUES) {
      grouped.set(allowedGroup, []);
    }
    for (const moduleEntry of inventory.modules) {
      grouped.get(moduleEntry.group)!.push(moduleEntry.relative_path);
    }
    expect([...grouped.get('core_math')!].sort()).toEqual(['src/core/angle.ts', 'src/core/binaryReader.ts', 'src/core/fixed.ts', 'src/core/rng.ts', 'src/core/trig.ts']);
    expect([...grouped.get('audit_ledger')!].sort()).toEqual([
      'src/core/audit-angle-type-and-wrap-semantics.ts',
      'src/core/audit-fixed-divide-semantics.ts',
      'src/core/audit-fixed-multiply-overflow-semantics.ts',
      'src/core/audit-fixed-point-constants.ts',
    ]);
    expect([...grouped.get('timing')!].sort()).toEqual(['src/host/ticAccumulator.ts', 'src/mainLoop.ts']);
  });

  test('inventory modules entries match the on-disk size, line count, and sha256 of each committed module', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      expect(existsSync(moduleEntry.relative_path)).toBe(true);
      expect(statSync(moduleEntry.relative_path).isFile()).toBe(true);
      expect(moduleEntry.size_bytes).toBe(statSync(moduleEntry.relative_path).size);
      expect(moduleEntry.line_count).toBe(countLines(moduleEntry.relative_path));
      expect(moduleEntry.sha256).toBe(computeSha256(moduleEntry.relative_path));
    }
  });

  test('inventory modules export lists are sorted ASCIIbetically and each declared name appears in the on-disk source', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      expectAsciiSorted(moduleEntry.exported_interfaces);
      expectAsciiSorted(moduleEntry.exported_functions);
      expectAsciiSorted(moduleEntry.exported_constants);
      expectAsciiSorted(moduleEntry.exported_classes);
      expectAsciiSorted(moduleEntry.exported_types);

      const sourceText = readFileSync(moduleEntry.relative_path, 'utf8');
      for (const exportedInterfaceName of moduleEntry.exported_interfaces) {
        expect(sourceText).toContain(`export interface ${exportedInterfaceName}`);
      }
      for (const exportedFunctionName of moduleEntry.exported_functions) {
        const matchesPlainExport = sourceText.includes(`export function ${exportedFunctionName}`);
        const matchesAsyncExport = sourceText.includes(`export async function ${exportedFunctionName}`);
        expect(matchesPlainExport || matchesAsyncExport).toBe(true);
      }
      for (const exportedConstantName of moduleEntry.exported_constants) {
        expect(sourceText).toContain(`export const ${exportedConstantName}`);
      }
      for (const exportedClassName of moduleEntry.exported_classes) {
        expect(sourceText).toContain(`export class ${exportedClassName}`);
      }
      for (const exportedTypeName of moduleEntry.exported_types) {
        expect(sourceText).toContain(`export type ${exportedTypeName}`);
      }
    }
  });

  test('inventory modules vanilla_function_modeled and role fields are non-empty strings', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      expect(typeof moduleEntry.vanilla_function_modeled).toBe('string');
      expect(moduleEntry.vanilla_function_modeled.length).toBeGreaterThan(0);
      expect(typeof moduleEntry.role).toBe('string');
      expect(moduleEntry.role.length).toBeGreaterThan(0);
    }
  });

  test('inventory modules external_imports list is sorted and only references existing files', async () => {
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

  test('inventory modules src_importer_count and test_importer_count match a fresh ripgrep walk over committed src/ and test/ files', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      const observedSrcCount = countSrcImporters(moduleEntry.relative_path);
      const observedTestCount = countTestImporters(moduleEntry.relative_path);
      expect(moduleEntry.src_importer_count).toBe(observedSrcCount);
      expect(moduleEntry.test_importer_count).toBe(observedTestCount);
    }
  });

  test('inventory modules core_math runtime modules have at least one src/ importer and audit_ledger modules have zero src/ importers', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      if (moduleEntry.group === 'core_math' || moduleEntry.group === 'timing') {
        expect(moduleEntry.src_importer_count).toBeGreaterThan(0);
      } else if (moduleEntry.group === 'audit_ledger') {
        expect(moduleEntry.src_importer_count).toBe(0);
        expect(moduleEntry.test_importer_count).toBeGreaterThan(0);
      }
    }
  });

  test('inventory modules trig.ts is the only src/core/ runtime module that imports a sibling', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.modules) {
      if (moduleEntry.relative_path === 'src/core/trig.ts') {
        expect([...moduleEntry.external_imports]).toEqual(['src/core/fixed.ts']);
      } else {
        expect([...moduleEntry.external_imports]).toEqual([]);
      }
    }
  });

  test('inventory determinism_boundary_status partitions the eleven modules into the canonical primary/audit/timing groups', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.determinism_boundary_status;
    expect(status.is_determinism_boundary).toBe(true);
    expectAsciiSorted(status.primary_module_paths_sorted);
    expectAsciiSorted(status.audit_ledger_module_paths_sorted);
    expectAsciiSorted(status.timing_module_paths_sorted);
    expect([...status.primary_module_paths_sorted]).toEqual(['src/core/angle.ts', 'src/core/binaryReader.ts', 'src/core/fixed.ts', 'src/core/rng.ts', 'src/core/trig.ts']);
    expect([...status.audit_ledger_module_paths_sorted]).toEqual([
      'src/core/audit-angle-type-and-wrap-semantics.ts',
      'src/core/audit-fixed-divide-semantics.ts',
      'src/core/audit-fixed-multiply-overflow-semantics.ts',
      'src/core/audit-fixed-point-constants.ts',
    ]);
    expect([...status.timing_module_paths_sorted]).toEqual(['src/host/ticAccumulator.ts', 'src/mainLoop.ts']);
    expect(status.claude_md_anchor.length).toBeGreaterThan(0);
    expect(status.claude_md_anchor).toContain('determinism boundary');
    expect(status.claude_md_anchor).toContain('CLAUDE.md');
    const claudeMdText = readFileSync('CLAUDE.md', 'utf8');
    expect(claudeMdText).toContain('`src/core/`');
    expect(claudeMdText).toContain('Fixed-point math');
  });

  test('inventory vanilla_orchestrator_wiring_status flags both the simplified launcher and the canonical orchestrator as not directly importing any listed module', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.vanilla_orchestrator_wiring_status;
    expect(status.simplified_launcher_entrypoint_relative_path).toBe(SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH);
    expect(status.simplified_launcher_directly_imports_any_listed_module).toBe(false);
    expect(status.main_loop_orchestrator_relative_path).toBe(MAIN_LOOP_PATH);
    expect(status.main_loop_orchestrator_imports_any_core_math_or_timing_module).toBe(false);
    expectAsciiSorted(status.simplified_launcher_indirect_dependency_paths_sorted);

    expect(existsSync(SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH)).toBe(true);
    expect(existsSync(MAIN_LOOP_PATH)).toBe(true);

    const launcherSource = readFileSync(SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH, 'utf8');
    for (const listedModulePath of ALL_MODULE_PATHS_SORTED) {
      const basename = listedModulePath.split('/').pop()!.replace(/\.ts$/, '');
      const directImportPattern = new RegExp(`from\\s+['"][^'"]*\\b${basename}\\.ts['"]`);
      expect(directImportPattern.test(launcherSource)).toBe(false);
    }

    const orchestratorSource = readFileSync(MAIN_LOOP_PATH, 'utf8');
    expect(orchestratorSource).not.toMatch(/^import\s+/m);

    for (const indirectPath of status.simplified_launcher_indirect_dependency_paths_sorted) {
      expect(existsSync(indirectPath)).toBe(true);
    }
  });

  test('inventory implications reference the determinism boundary, the orchestrator wiring gap, and PARALLEL_WORK ownership', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain('src/core/');
    expect(concatenatedImplications).toContain('src/host/ticAccumulator.ts');
    expect(concatenatedImplications).toContain('src/mainLoop.ts');
    expect(concatenatedImplications).toContain('determinism boundary');
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
    expect(stepText).toContain('plan_vanilla_parity/current-state/inventory-core-math-and-timing-modules.json');
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-core-math-and-timing-modules.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a tampered inventory that flips determinism_boundary_status.is_determinism_boundary diverges from the captured snapshot', async () => {
    const inventory = await loadInventoryDocument();
    const tamperedInventory: InventoryDocument = {
      ...inventory,
      determinism_boundary_status: {
        ...inventory.determinism_boundary_status,
        is_determinism_boundary: false,
      },
    };
    expect(tamperedInventory.determinism_boundary_status.is_determinism_boundary).not.toBe(inventory.determinism_boundary_status.is_determinism_boundary);
  });

  test('failure mode: a fabricated module entry with a bogus sha256 would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstModuleEntry = inventory.modules[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstModuleEntry.sha256).not.toBe(fabricatedSha256);
    expect(firstModuleEntry.sha256).toBe(computeSha256(firstModuleEntry.relative_path));
  });
});
