import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-src-bootstrap-surface.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-003-inventory-src-bootstrap-surface.md';
const BOOTSTRAP_DIRECTORY_PATH = 'src/bootstrap/';
const BOOTSTRAP_MODULE_PATHS_SORTED: readonly string[] = [
  'src/bootstrap/cmdline.ts',
  'src/bootstrap/config.ts',
  'src/bootstrap/gameMode.ts',
  'src/bootstrap/implement-vanilla-command-line-parsing.ts',
  'src/bootstrap/initOrder.ts',
  'src/bootstrap/quitFlow.ts',
  'src/bootstrap/titleLoop.ts',
  'src/bootstrap/tryRunTics.ts',
];
const SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH = 'src/main.ts';
const VANILLA_ORCHESTRATOR_PATH = 'src/mainLoop.ts';

interface InventoryBootstrapDirectory {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly committed_file_count: number;
  readonly committed_filenames_sorted: readonly string[];
  readonly owner_lane: string;
  readonly owner_lane_source: string;
}

interface InventoryBootstrapModule {
  readonly relative_path: string;
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
}

interface InventorySimplifiedLauncherImports {
  readonly launcher_entrypoint_relative_path: string;
  readonly imported_bootstrap_modules_sorted: readonly string[];
  readonly imported_bootstrap_symbols_sorted: readonly string[];
  readonly notes: string;
}

interface InventoryNonLauncherConsumers {
  readonly consumer_files_sorted: readonly string[];
  readonly imported_bootstrap_modules_sorted: readonly string[];
  readonly notes: string;
}

interface InventoryVanillaPathStatus {
  readonly is_vanilla_path: boolean;
  readonly vanilla_orchestrator_module: string;
  readonly vanilla_orchestrator_imports_any_bootstrap_module: boolean;
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
  readonly bootstrap_directory: InventoryBootstrapDirectory;
  readonly bootstrap_modules: readonly InventoryBootstrapModule[];
  readonly simplified_launcher_imports: InventorySimplifiedLauncherImports;
  readonly non_launcher_consumers: InventoryNonLauncherConsumers;
  readonly vanilla_d_doom_main_path_status: InventoryVanillaPathStatus;
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

describe('inventory: src bootstrap surface', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-003');
    expect(inventory.title).toBe('Inventory Src Bootstrap Surface');
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

  test('inventory summary is a non-empty string', async () => {
    const inventory = await loadInventoryDocument();
    expect(typeof inventory.summary).toBe('string');
    expect(inventory.summary.length).toBeGreaterThan(0);
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
    expect(inventory.evidence_method).toContain('src/bootstrap/');
    expect(inventory.evidence_method).toContain('git ls-files');
  });

  test('inventory repository_root is the captured absolute path string', async () => {
    const inventory = await loadInventoryDocument();
    expect(typeof inventory.repository_root).toBe('string');
    expect(inventory.repository_root.length).toBeGreaterThan(0);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('inventory bootstrap_directory enumerates exactly the eight committed bootstrap modules sorted ASCIIbetically', async () => {
    const inventory = await loadInventoryDocument();
    const directory = inventory.bootstrap_directory;
    expect(directory.relative_path).toBe(BOOTSTRAP_DIRECTORY_PATH);
    expect(directory.exists).toBe(true);
    expect(existsSync(BOOTSTRAP_DIRECTORY_PATH)).toBe(true);
    expect(directory.committed_file_count).toBe(8);
    expectAsciiSorted(directory.committed_filenames_sorted);
    expect([...directory.committed_filenames_sorted]).toEqual(['cmdline.ts', 'config.ts', 'gameMode.ts', 'implement-vanilla-command-line-parsing.ts', 'initOrder.ts', 'quitFlow.ts', 'titleLoop.ts', 'tryRunTics.ts']);
    expect(directory.owner_lane).toBe('launch');
    expect(directory.owner_lane_source).toContain('PARALLEL_WORK.md');
  });

  test('inventory bootstrap_directory lane ownership matches the launch row in plan_vanilla_parity/PARALLEL_WORK.md', async () => {
    const inventory = await loadInventoryDocument();
    const parallelWorkText = readFileSync('plan_vanilla_parity/PARALLEL_WORK.md', 'utf8');
    const launchRowMatch = /\|\s*launch\s*\|[^|]*\|[^|]*\|([^|]*)\|/.exec(parallelWorkText);
    expect(launchRowMatch).not.toBeNull();
    const launchRowOwnsColumn = launchRowMatch![1]!;
    expect(launchRowOwnsColumn).toContain('src/bootstrap/');
    expect(inventory.bootstrap_directory.owner_lane).toBe('launch');
  });

  test('inventory bootstrap_modules entries match the on-disk size, line count, and sha256 of each committed bootstrap module', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.bootstrap_modules.length).toBe(BOOTSTRAP_MODULE_PATHS_SORTED.length);

    const moduleByPath = new Map<string, InventoryBootstrapModule>();
    for (const moduleEntry of inventory.bootstrap_modules) {
      moduleByPath.set(moduleEntry.relative_path, moduleEntry);
    }

    for (const bootstrapModulePath of BOOTSTRAP_MODULE_PATHS_SORTED) {
      const moduleEntry = moduleByPath.get(bootstrapModulePath);
      expect(moduleEntry).toBeDefined();
      expect(existsSync(bootstrapModulePath)).toBe(true);
      expect(statSync(bootstrapModulePath).isFile()).toBe(true);
      expect(moduleEntry!.size_bytes).toBe(statSync(bootstrapModulePath).size);
      expect(moduleEntry!.line_count).toBe(countLines(bootstrapModulePath));
      expect(moduleEntry!.sha256).toBe(computeSha256(bootstrapModulePath));
    }
  });

  test('inventory bootstrap_modules entries are sorted ASCIIbetically by relative_path', async () => {
    const inventory = await loadInventoryDocument();
    const observedPaths = inventory.bootstrap_modules.map((moduleEntry) => moduleEntry.relative_path);
    expectAsciiSorted(observedPaths);
    expect([...observedPaths]).toEqual([...BOOTSTRAP_MODULE_PATHS_SORTED]);
  });

  test('inventory bootstrap_modules export lists are sorted ASCIIbetically and each declared name appears in the on-disk source', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.bootstrap_modules) {
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

  test('inventory bootstrap_modules vanilla_function_modeled and role fields are non-empty strings', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.bootstrap_modules) {
      expect(typeof moduleEntry.vanilla_function_modeled).toBe('string');
      expect(moduleEntry.vanilla_function_modeled.length).toBeGreaterThan(0);
      expect(typeof moduleEntry.role).toBe('string');
      expect(moduleEntry.role.length).toBeGreaterThan(0);
    }
  });

  test('inventory bootstrap_modules external_imports list is sorted and only references node:* or files that exist on disk', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.bootstrap_modules) {
      expectAsciiSorted(moduleEntry.external_imports);
      for (const importedReference of moduleEntry.external_imports) {
        if (importedReference.startsWith('node:')) {
          continue;
        }
        expect(existsSync(importedReference)).toBe(true);
      }
    }
  });

  test('inventory simplified_launcher_imports records exactly one bootstrap import and matches src/main.ts', async () => {
    const inventory = await loadInventoryDocument();
    const launcherImports = inventory.simplified_launcher_imports;
    expect(launcherImports.launcher_entrypoint_relative_path).toBe(SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH);
    expectAsciiSorted(launcherImports.imported_bootstrap_modules_sorted);
    expectAsciiSorted(launcherImports.imported_bootstrap_symbols_sorted);
    expect([...launcherImports.imported_bootstrap_modules_sorted]).toEqual(['src/bootstrap/cmdline.ts']);
    expect([...launcherImports.imported_bootstrap_symbols_sorted]).toEqual(['CommandLine']);

    const launcherEntrypointSource = readFileSync(SIMPLIFIED_LAUNCHER_ENTRYPOINT_PATH, 'utf8');
    expect(launcherEntrypointSource).toContain("import { CommandLine } from './bootstrap/cmdline.ts';");
    for (const otherBootstrapPath of BOOTSTRAP_MODULE_PATHS_SORTED) {
      if (otherBootstrapPath === 'src/bootstrap/cmdline.ts') {
        continue;
      }
      const moduleSpecifier = otherBootstrapPath.replace(/^src\//, './');
      expect(launcherEntrypointSource).not.toContain(`from '${moduleSpecifier}'`);
    }
  });

  test('inventory non_launcher_consumers entries each import at least one of the declared bootstrap modules', async () => {
    const inventory = await loadInventoryDocument();
    const consumers = inventory.non_launcher_consumers;
    expectAsciiSorted(consumers.consumer_files_sorted);
    expectAsciiSorted(consumers.imported_bootstrap_modules_sorted);
    expect(consumers.consumer_files_sorted.length).toBeGreaterThan(0);
    expect(consumers.imported_bootstrap_modules_sorted.length).toBeGreaterThan(0);

    for (const consumerPath of consumers.consumer_files_sorted) {
      expect(existsSync(consumerPath)).toBe(true);
      expect(statSync(consumerPath).isFile()).toBe(true);
      const consumerSource = readFileSync(consumerPath, 'utf8');
      expect(consumerSource).toMatch(/from\s+['"][^'"]*bootstrap\//);
    }

    for (const importedBootstrapModule of consumers.imported_bootstrap_modules_sorted) {
      expect(BOOTSTRAP_MODULE_PATHS_SORTED).toContain(importedBootstrapModule);
    }
  });

  test('inventory vanilla_d_doom_main_path_status flags the bootstrap surface as not yet wired into the canonical orchestrator', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.vanilla_d_doom_main_path_status;
    expect(status.is_vanilla_path).toBe(false);
    expect(status.vanilla_orchestrator_module).toBe(VANILLA_ORCHESTRATOR_PATH);
    expect(existsSync(VANILLA_ORCHESTRATOR_PATH)).toBe(true);
    expect(statSync(VANILLA_ORCHESTRATOR_PATH).isFile()).toBe(true);
    expect(status.vanilla_orchestrator_imports_any_bootstrap_module).toBe(false);

    const orchestratorSource = readFileSync(VANILLA_ORCHESTRATOR_PATH, 'utf8');
    expect(orchestratorSource).not.toMatch(/from\s+['"][^'"]*bootstrap\//);
  });

  test('inventory implications reference the launch lane ownership and the disabled vanilla startup wiring', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain('launch lane');
    expect(concatenatedImplications).toContain('src/bootstrap/');
    expect(concatenatedImplications).toContain('src/mainLoop.ts');
    expect(concatenatedImplications).toContain('CommandLine');
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
    expect(stepText).toContain('plan_vanilla_parity/current-state/inventory-src-bootstrap-surface.json');
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-src-bootstrap-surface.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a tampered inventory that flips vanilla_d_doom_main_path_status.is_vanilla_path diverges from the captured snapshot', async () => {
    const inventory = await loadInventoryDocument();
    const tamperedInventory: InventoryDocument = {
      ...inventory,
      vanilla_d_doom_main_path_status: {
        ...inventory.vanilla_d_doom_main_path_status,
        is_vanilla_path: true,
      },
    };
    expect(tamperedInventory.vanilla_d_doom_main_path_status.is_vanilla_path).not.toBe(inventory.vanilla_d_doom_main_path_status.is_vanilla_path);
  });

  test('failure mode: a fabricated bootstrap_modules entry with a bogus sha256 would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstModuleEntry = inventory.bootstrap_modules[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstModuleEntry.sha256).not.toBe(fabricatedSha256);
    expect(firstModuleEntry.sha256).toBe(computeSha256(firstModuleEntry.relative_path));
  });
});
