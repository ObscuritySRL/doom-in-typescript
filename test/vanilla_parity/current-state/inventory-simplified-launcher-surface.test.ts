import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-simplified-launcher-surface.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-002-inventory-simplified-launcher-surface.md';
const LAUNCHER_ENTRYPOINT_PATH = 'src/main.ts';
const LAUNCHER_DIRECTORY_PATH = 'src/launcher/';
const LAUNCHER_MODULE_PATHS_SORTED: readonly string[] = ['src/launcher/gameplayAssets.ts', 'src/launcher/gameplayRenderer.ts', 'src/launcher/session.ts', 'src/launcher/win32.ts'];

interface InventoryLauncherEntrypoint {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly is_vanilla_d_doom_main_path: boolean;
  readonly package_json_start_script: string;
  readonly exports_count: number;
  readonly drives_via: string;
}

interface InventoryLauncherModuleDirectory {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly file_count: number;
  readonly filenames_sorted: readonly string[];
}

interface InventoryLauncherModule {
  readonly relative_path: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly exported_interfaces: readonly string[];
  readonly exported_functions: readonly string[];
  readonly exported_constants: readonly string[];
  readonly exported_classes: readonly string[];
}

interface InventoryCliFlags {
  readonly supported_sorted: readonly string[];
  readonly boolean_flags_sorted: readonly string[];
  readonly value_flags_sorted: readonly string[];
  readonly parser_module: string;
  readonly parser_class: string;
}

interface InventoryCliDefaults {
  readonly default_map_name: string;
  readonly default_scale: number;
  readonly default_skill: number;
  readonly default_local_iwad_path_template: string;
  readonly default_local_iwad_path_source_constants: readonly string[];
}

interface InventoryFfiDependencies {
  readonly dlopen_libraries_sorted: readonly string[];
  readonly user32_symbols_sorted: readonly string[];
  readonly gdi32_symbols_sorted: readonly string[];
  readonly host_modules_imported: readonly string[];
}

interface InventoryVanillaPathStatus {
  readonly is_vanilla_path: boolean;
  readonly vanilla_orchestrator_module: string;
  readonly vanilla_phase_modules_under_src_bootstrap: readonly string[];
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
  readonly launcher_entrypoint: InventoryLauncherEntrypoint;
  readonly launcher_module_directory: InventoryLauncherModuleDirectory;
  readonly launcher_modules: readonly InventoryLauncherModule[];
  readonly cli_flags: InventoryCliFlags;
  readonly cli_defaults: InventoryCliDefaults;
  readonly ffi_dependencies: InventoryFfiDependencies;
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

describe('inventory: simplified launcher surface', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-002');
    expect(inventory.title).toBe('Inventory Simplified Launcher Surface');
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
    expect(inventory.evidence_method).toContain('src/launcher/');
    expect(inventory.evidence_method).toContain('src/main.ts');
  });

  test('inventory repository_root is the captured absolute path string', async () => {
    const inventory = await loadInventoryDocument();
    expect(typeof inventory.repository_root).toBe('string');
    expect(inventory.repository_root.length).toBeGreaterThan(0);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('inventory launcher_entrypoint snapshot agrees with the on-disk src/main.ts file', async () => {
    const inventory = await loadInventoryDocument();
    const entrypoint = inventory.launcher_entrypoint;
    expect(entrypoint.relative_path).toBe(LAUNCHER_ENTRYPOINT_PATH);
    expect(entrypoint.exists).toBe(true);
    expect(existsSync(LAUNCHER_ENTRYPOINT_PATH)).toBe(true);
    expect(statSync(LAUNCHER_ENTRYPOINT_PATH).isFile()).toBe(true);
    expect(entrypoint.size_bytes).toBe(statSync(LAUNCHER_ENTRYPOINT_PATH).size);
    expect(entrypoint.line_count).toBe(countLines(LAUNCHER_ENTRYPOINT_PATH));
    expect(entrypoint.sha256).toBe(computeSha256(LAUNCHER_ENTRYPOINT_PATH));
    expect(entrypoint.is_vanilla_d_doom_main_path).toBe(false);
    expect(entrypoint.package_json_start_script).toBe('bun run src/main.ts');
    expect(entrypoint.exports_count).toBe(0);
  });

  test('inventory launcher_module_directory enumerates exactly the four launcher modules sorted ASCIIbetically', async () => {
    const inventory = await loadInventoryDocument();
    const directory = inventory.launcher_module_directory;
    expect(directory.relative_path).toBe(LAUNCHER_DIRECTORY_PATH);
    expect(directory.exists).toBe(true);
    expect(directory.file_count).toBe(4);
    expectAsciiSorted(directory.filenames_sorted);
    expect([...directory.filenames_sorted]).toEqual(['gameplayAssets.ts', 'gameplayRenderer.ts', 'session.ts', 'win32.ts']);
  });

  test('inventory launcher_modules entries match the on-disk size, line count, and sha256 of each launcher module', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.launcher_modules.length).toBe(LAUNCHER_MODULE_PATHS_SORTED.length);

    const moduleByPath = new Map<string, InventoryLauncherModule>();
    for (const moduleEntry of inventory.launcher_modules) {
      moduleByPath.set(moduleEntry.relative_path, moduleEntry);
    }

    for (const launcherModulePath of LAUNCHER_MODULE_PATHS_SORTED) {
      const moduleEntry = moduleByPath.get(launcherModulePath);
      expect(moduleEntry).toBeDefined();
      expect(existsSync(launcherModulePath)).toBe(true);
      expect(statSync(launcherModulePath).isFile()).toBe(true);
      expect(moduleEntry!.size_bytes).toBe(statSync(launcherModulePath).size);
      expect(moduleEntry!.line_count).toBe(countLines(launcherModulePath));
      expect(moduleEntry!.sha256).toBe(computeSha256(launcherModulePath));
    }
  });

  test('inventory launcher_modules export lists are sorted ASCIIbetically and each declared name appears in the on-disk source', async () => {
    const inventory = await loadInventoryDocument();
    for (const moduleEntry of inventory.launcher_modules) {
      expectAsciiSorted(moduleEntry.exported_interfaces);
      expectAsciiSorted(moduleEntry.exported_functions);
      expectAsciiSorted(moduleEntry.exported_constants);
      expectAsciiSorted(moduleEntry.exported_classes);

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
    }
  });

  test('inventory cli_flags surface matches the parameter names referenced by src/main.ts', async () => {
    const inventory = await loadInventoryDocument();
    const cliFlagsSection = inventory.cli_flags;
    expectAsciiSorted(cliFlagsSection.supported_sorted);
    expectAsciiSorted(cliFlagsSection.boolean_flags_sorted);
    expectAsciiSorted(cliFlagsSection.value_flags_sorted);
    expect([...cliFlagsSection.supported_sorted]).toEqual(['--help', '--iwad', '--list-maps', '--map', '--scale', '--skill', '-h', '-help']);
    expect([...cliFlagsSection.boolean_flags_sorted]).toEqual(['--help', '--list-maps', '-h', '-help']);
    expect([...cliFlagsSection.value_flags_sorted]).toEqual(['--iwad', '--map', '--scale', '--skill']);
    expect(cliFlagsSection.parser_module).toBe('src/bootstrap/cmdline.ts');
    expect(cliFlagsSection.parser_class).toBe('CommandLine');

    const launcherEntrypointSource = readFileSync(LAUNCHER_ENTRYPOINT_PATH, 'utf8');
    for (const supportedFlagName of cliFlagsSection.supported_sorted) {
      expect(launcherEntrypointSource).toContain(supportedFlagName);
    }
    expect(launcherEntrypointSource).toContain("from './bootstrap/cmdline.ts'");
    expect(launcherEntrypointSource).toContain('CommandLine');
  });

  test('inventory cli_defaults match the literal default values in src/main.ts', async () => {
    const inventory = await loadInventoryDocument();
    const defaults = inventory.cli_defaults;
    expect(defaults.default_map_name).toBe('E1M1');
    expect(defaults.default_scale).toBe(2);
    expect(defaults.default_skill).toBe(2);
    expect(defaults.default_local_iwad_path_template).toBe('${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}');
    expect([...defaults.default_local_iwad_path_source_constants]).toEqual(['REFERENCE_BUNDLE_PATH from src/reference/policy.ts', 'PRIMARY_TARGET from src/reference/target.ts']);

    const launcherEntrypointSource = readFileSync(LAUNCHER_ENTRYPOINT_PATH, 'utf8');
    expect(launcherEntrypointSource).toContain("const DEFAULT_MAP_NAME = 'E1M1';");
    expect(launcherEntrypointSource).toContain('const DEFAULT_SCALE = 2;');
    expect(launcherEntrypointSource).toContain('const DEFAULT_SKILL = 2;');
    expect(launcherEntrypointSource).toContain("from './reference/policy.ts'");
    expect(launcherEntrypointSource).toContain("from './reference/target.ts'");
  });

  test('inventory ffi_dependencies enumerate the dlopen libraries and Win32 symbols declared by src/launcher/win32.ts', async () => {
    const inventory = await loadInventoryDocument();
    const ffiSection = inventory.ffi_dependencies;
    expectAsciiSorted(ffiSection.dlopen_libraries_sorted);
    expectAsciiSorted(ffiSection.user32_symbols_sorted);
    expectAsciiSorted(ffiSection.gdi32_symbols_sorted);
    expect([...ffiSection.dlopen_libraries_sorted]).toEqual(['gdi32.dll', 'user32.dll']);
    expect([...ffiSection.gdi32_symbols_sorted]).toEqual(['StretchDIBits']);
    expect([...ffiSection.user32_symbols_sorted]).toEqual([
      'AdjustWindowRect',
      'CreateWindowExW',
      'DestroyWindow',
      'DispatchMessageW',
      'GetAsyncKeyState',
      'GetClientRect',
      'GetDC',
      'GetForegroundWindow',
      'PeekMessageW',
      'ReleaseDC',
      'ShowWindow',
      'TranslateMessage',
    ]);

    const win32Source = readFileSync('src/launcher/win32.ts', 'utf8');
    for (const libraryName of ffiSection.dlopen_libraries_sorted) {
      expect(win32Source).toContain(`dlopen('${libraryName}'`);
    }
    for (const user32SymbolName of ffiSection.user32_symbols_sorted) {
      expect(win32Source).toContain(`${user32SymbolName}:`);
    }
    for (const gdi32SymbolName of ffiSection.gdi32_symbols_sorted) {
      expect(win32Source).toContain(`${gdi32SymbolName}:`);
    }

    for (const importedHostModulePath of ffiSection.host_modules_imported) {
      expect(existsSync(importedHostModulePath)).toBe(true);
    }
  });

  test('inventory vanilla_d_doom_main_path_status flags the launcher as non-vanilla and points at the real vanilla orchestrator module', async () => {
    const inventory = await loadInventoryDocument();
    const status = inventory.vanilla_d_doom_main_path_status;
    expect(status.is_vanilla_path).toBe(false);
    expect(status.vanilla_orchestrator_module).toBe('src/mainLoop.ts');
    expect(existsSync(status.vanilla_orchestrator_module)).toBe(true);
    expect(statSync(status.vanilla_orchestrator_module).isFile()).toBe(true);
    for (const phaseModulePath of status.vanilla_phase_modules_under_src_bootstrap) {
      expect(existsSync(phaseModulePath)).toBe(true);
      expect(statSync(phaseModulePath).isFile()).toBe(true);
    }

    const launcherEntrypointSource = readFileSync(LAUNCHER_ENTRYPOINT_PATH, 'utf8');
    expect(launcherEntrypointSource).not.toContain('D_DoomMain');
    expect(launcherEntrypointSource).not.toContain('D_DoomLoop');
    expect(launcherEntrypointSource).not.toContain("from './mainLoop.ts'");

    for (const launcherModulePath of LAUNCHER_MODULE_PATHS_SORTED) {
      const launcherModuleSource = readFileSync(launcherModulePath, 'utf8');
      expect(launcherModuleSource).not.toContain('D_DoomMain');
      expect(launcherModuleSource).not.toContain('D_DoomLoop');
    }
  });

  test('inventory implications reference the disabled vanilla startup path so downstream readers see the rebuild scope', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain('bun run doom.ts');
    expect(concatenatedImplications).toContain('D_DoomMain');
    expect(concatenatedImplications).toContain('D_DoomLoop');
    expect(concatenatedImplications).toContain('user32.dll');
    expect(concatenatedImplications).toContain('gdi32.dll');
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
    expect(stepText).toContain('plan_vanilla_parity/current-state/inventory-simplified-launcher-surface.json');
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-simplified-launcher-surface.test.ts');
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

  test('failure mode: a fabricated launcher_modules entry with a bogus sha256 would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstModuleEntry = inventory.launcher_modules[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstModuleEntry.sha256).not.toBe(fabricatedSha256);
    expect(firstModuleEntry.sha256).toBe(computeSha256(firstModuleEntry.relative_path));
  });
});
