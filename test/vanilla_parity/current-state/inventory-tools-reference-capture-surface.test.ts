import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-tools-reference-capture-surface.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-018-inventory-tools-reference-capture-surface.md';
const TOOLS_ROOT_RELATIVE_PATH = 'tools/';
const TOOLS_REFERENCE_RELATIVE_PATH = 'tools/reference/';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const ALLOWED_CAPTURE_GROUP_VALUES: readonly string[] = ['reference_sandbox_capture', 'reference_window_capture'];
const ALLOWED_TOOLS_ROOT_GROUP_VALUES: readonly string[] = ['tools_root_format_dispatcher', 'tools_root_verification_contract'];

interface InventoryToolsDirectoryGroups {
  readonly tools_root_relative_path: string;
  readonly tools_reference_relative_path: string;
  readonly tools_root_file_count: number;
  readonly tools_root_filenames_sorted: readonly string[];
  readonly tools_reference_file_count: number;
  readonly tools_reference_filenames_sorted: readonly string[];
  readonly total_tools_size_bytes: number;
  readonly total_tools_line_count: number;
  readonly companion_test_file_count: number;
  readonly companion_test_relative_paths_sorted: readonly string[];
  readonly total_companion_test_size_bytes: number;
  readonly total_companion_test_line_count: number;
}

interface InventoryCaptureModule {
  readonly relative_path: string;
  readonly group: string;
  readonly role: string;
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
  readonly companion_test_relative_path: string;
}

interface InventoryToolsRootModule {
  readonly relative_path: string;
  readonly group: string;
  readonly role: string;
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
  readonly companion_test_relative_path: string | null;
  readonly is_top_level_imperative_script: boolean;
  readonly package_json_script_dispatcher: string | null;
}

interface InventoryCompanionTest {
  readonly relative_path: string;
  readonly covers_tools_relative_path: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
}

interface InventoryCapturePipelineInvariants {
  readonly chocolate_doom_window_title: string;
  readonly display_width: number;
  readonly display_height: number;
  readonly internal_width: number;
  readonly internal_height: number;
  readonly bits_per_pixel: number;
  readonly bytes_per_pixel: number;
  readonly capture_buffer_size_bytes: number;
  readonly bitmapinfoheader_size_bytes: number;
  readonly srccopy_constant_hex: string;
  readonly dib_rgb_colors_constant: number;
  readonly bi_rgb_constant: number;
  readonly capture_step_count: number;
  readonly capture_step_api_function_order: readonly string[];
  readonly required_api_function_count: number;
  readonly required_api_functions_sorted: readonly string[];
  readonly user32_package_name: string;
  readonly gdi32_package_name: string;
  readonly user32_capture_symbol_count: number;
  readonly user32_capture_symbol_names_sorted: readonly string[];
  readonly gdi32_capture_symbol_count: number;
  readonly gdi32_capture_symbol_names_sorted: readonly string[];
  readonly notes: string;
}

interface InventorySandboxInvariants {
  readonly required_file_count: number;
  readonly mutable_file_count: number;
  readonly immutable_file_count: number;
  readonly config_isolation_check_enabled: boolean;
  readonly source_unmodified_post_condition: boolean;
  readonly cleanup_after_run_enabled: boolean;
  readonly sandbox_parent_gitkeep_relative_filename: string;
  readonly config_isolation_sentinel_string: string;
  readonly hash_algorithm: string;
  readonly hash_output_case: string;
  readonly notes: string;
}

interface InventoryVerifyCommandInvariants {
  readonly verify_command_count: number;
  readonly verify_command_kinds_in_order: readonly string[];
  readonly executable_program: string;
  readonly focused_test_args_prefix: readonly string[];
  readonly full_suite_args: readonly string[];
  readonly typecheck_args_prefix: readonly string[];
  readonly tsconfig_path_relative: string;
  readonly notes: string;
}

interface InventoryBoundaryStatus {
  readonly tools_root_relative_path: string;
  readonly tools_reference_relative_path: string;
  readonly writable_workspace: boolean;
  readonly source_only_metadata: boolean;
  readonly no_proprietary_bytes_embedded: boolean;
  readonly tools_reference_modules_directly_open_proprietary_bundle: boolean;
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
  readonly tools_directory_groups: InventoryToolsDirectoryGroups;
  readonly capture_modules: readonly InventoryCaptureModule[];
  readonly tools_root_modules: readonly InventoryToolsRootModule[];
  readonly companion_tests: readonly InventoryCompanionTest[];
  readonly capture_pipeline_invariants: InventoryCapturePipelineInvariants;
  readonly sandbox_invariants: InventorySandboxInvariants;
  readonly verify_command_invariants: InventoryVerifyCommandInvariants;
  readonly boundary_status: InventoryBoundaryStatus;
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
  return [...values].sort((leftValue, rightValue) => (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0));
}

function expectAsciiSorted(values: readonly string[]): void {
  expect([...values]).toEqual([...sortedAscii(values)]);
}

function listMatchingFilenamesSortedAscii(directoryPath: string, predicate: (filename: string) => boolean): readonly string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort();
}

describe('inventory: tools reference capture surface', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-018');
    expect(inventory.title).toBe('Inventory Tools Reference Capture Surface');
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

  test('inventory summary and evidence method identify the audited tools reference capture surface', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.summary).toContain('tools/reference/isolationProbe.ts');
    expect(inventory.summary).toContain('tools/reference/windowCaptureProbe.ts');
    expect(inventory.summary).toContain('tools/verify.ts');
    expect(inventory.summary).toContain('tools/format-changed.ts');
    expect(inventory.summary).toContain('Chocolate Doom 2.2.1');
    expect(inventory.summary).toContain('GDI');
    expect(inventory.summary).toContain('FFIType.u64');
    expect(inventory.summary).toContain('source-only metadata');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('SHA-256');
    expect(inventory.evidence_method).toContain('tools/');
    expect(inventory.evidence_method).toContain('tools/reference/');
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

  test('inventory tools_directory_groups records both root and reference directory enumerations and on-disk totals', async () => {
    const inventory = await loadInventoryDocument();
    const groups = inventory.tools_directory_groups;
    expect(groups.tools_root_relative_path).toBe(TOOLS_ROOT_RELATIVE_PATH);
    expect(groups.tools_reference_relative_path).toBe(TOOLS_REFERENCE_RELATIVE_PATH);
    expect(existsSync(groups.tools_root_relative_path)).toBe(true);
    expect(existsSync(groups.tools_reference_relative_path)).toBe(true);

    const onDiskRootFiles = listMatchingFilenamesSortedAscii(groups.tools_root_relative_path, (filename) => filename.endsWith('.ts'));
    const onDiskReferenceFiles = listMatchingFilenamesSortedAscii(groups.tools_reference_relative_path, (filename) => filename.endsWith('.ts'));
    expect([...groups.tools_root_filenames_sorted]).toEqual([...onDiskRootFiles]);
    expect([...groups.tools_reference_filenames_sorted]).toEqual([...onDiskReferenceFiles]);
    expect(groups.tools_root_file_count).toBe(onDiskRootFiles.length);
    expect(groups.tools_reference_file_count).toBe(onDiskReferenceFiles.length);
    expect(groups.tools_root_file_count).toBe(2);
    expect(groups.tools_reference_file_count).toBe(2);

    expectAsciiSorted(groups.tools_root_filenames_sorted);
    expectAsciiSorted(groups.tools_reference_filenames_sorted);

    let totalToolsSizeBytes = 0;
    let totalToolsLineCount = 0;
    for (const filename of onDiskRootFiles) {
      const filePath = `${groups.tools_root_relative_path}${filename}`;
      totalToolsSizeBytes += statSync(filePath).size;
      totalToolsLineCount += countLines(filePath);
    }
    for (const filename of onDiskReferenceFiles) {
      const filePath = `${groups.tools_reference_relative_path}${filename}`;
      totalToolsSizeBytes += statSync(filePath).size;
      totalToolsLineCount += countLines(filePath);
    }
    expect(groups.total_tools_size_bytes).toBe(totalToolsSizeBytes);
    expect(groups.total_tools_line_count).toBe(totalToolsLineCount);

    expect(groups.companion_test_file_count).toBe(groups.companion_test_relative_paths_sorted.length);
    expectAsciiSorted(groups.companion_test_relative_paths_sorted);

    let totalCompanionTestSizeBytes = 0;
    let totalCompanionTestLineCount = 0;
    for (const testRelativePath of groups.companion_test_relative_paths_sorted) {
      expect(existsSync(testRelativePath)).toBe(true);
      totalCompanionTestSizeBytes += statSync(testRelativePath).size;
      totalCompanionTestLineCount += countLines(testRelativePath);
    }
    expect(groups.total_companion_test_size_bytes).toBe(totalCompanionTestSizeBytes);
    expect(groups.total_companion_test_line_count).toBe(totalCompanionTestLineCount);
  });

  test('inventory capture_modules covers every on-disk tools/reference/ TypeScript module sorted by relative_path', async () => {
    const inventory = await loadInventoryDocument();
    const observedRelativePaths = inventory.capture_modules.map((entry) => entry.relative_path);
    expectAsciiSorted(observedRelativePaths);

    const onDiskFilenames = listMatchingFilenamesSortedAscii(TOOLS_REFERENCE_RELATIVE_PATH, (filename) => filename.endsWith('.ts'));
    const expectedRelativePaths = onDiskFilenames.map((filename) => `${TOOLS_REFERENCE_RELATIVE_PATH}${filename}`);
    expect([...observedRelativePaths]).toEqual([...expectedRelativePaths]);
  });

  test('inventory capture_modules entries match on-disk size, line count, sha256, and have allowed group values', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.capture_modules.length).toBe(2);
    for (const entry of inventory.capture_modules) {
      expect(existsSync(entry.relative_path)).toBe(true);
      expect(entry.size_bytes).toBe(statSync(entry.relative_path).size);
      expect(entry.line_count).toBe(countLines(entry.relative_path));
      expect(entry.sha256).toBe(computeSha256(entry.relative_path));
      expect(SHA256_HEX_REGEX.test(entry.sha256)).toBe(true);
      expect(ALLOWED_CAPTURE_GROUP_VALUES).toContain(entry.group);
      expect(entry.role.length).toBeGreaterThan(0);
      expect(entry.relative_path.startsWith(TOOLS_REFERENCE_RELATIVE_PATH)).toBe(true);

      expectAsciiSorted(entry.exported_interfaces);
      expectAsciiSorted(entry.exported_functions);
      expectAsciiSorted(entry.exported_constants);
      expectAsciiSorted(entry.exported_classes);
      expectAsciiSorted(entry.exported_types);
      expectAsciiSorted(entry.exported_const_enums);

      const moduleText = readFileSync(entry.relative_path, 'utf8');
      for (const exportedInterfaceName of entry.exported_interfaces) {
        expect(moduleText).toMatch(new RegExp(`^export interface ${exportedInterfaceName}\\b`, 'm'));
      }
      for (const exportedFunctionName of entry.exported_functions) {
        expect(moduleText).toMatch(new RegExp(`^export (?:async )?function ${exportedFunctionName}\\b`, 'm'));
      }
      for (const exportedConstantName of entry.exported_constants) {
        expect(moduleText).toMatch(new RegExp(`^export const ${exportedConstantName}\\b`, 'm'));
      }

      expect(existsSync(entry.companion_test_relative_path)).toBe(true);
    }
  });

  test('inventory tools_root_modules covers every on-disk tools/ root TypeScript module sorted by relative_path', async () => {
    const inventory = await loadInventoryDocument();
    const observedRelativePaths = inventory.tools_root_modules.map((entry) => entry.relative_path);
    expectAsciiSorted(observedRelativePaths);

    const onDiskFilenames = listMatchingFilenamesSortedAscii(TOOLS_ROOT_RELATIVE_PATH, (filename) => filename.endsWith('.ts'));
    const expectedRelativePaths = onDiskFilenames.map((filename) => `${TOOLS_ROOT_RELATIVE_PATH}${filename}`);
    expect([...observedRelativePaths]).toEqual([...expectedRelativePaths]);
  });

  test('inventory tools_root_modules entries match on-disk size, line count, sha256, and have allowed group values', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.tools_root_modules.length).toBe(2);
    for (const entry of inventory.tools_root_modules) {
      expect(existsSync(entry.relative_path)).toBe(true);
      expect(entry.size_bytes).toBe(statSync(entry.relative_path).size);
      expect(entry.line_count).toBe(countLines(entry.relative_path));
      expect(entry.sha256).toBe(computeSha256(entry.relative_path));
      expect(SHA256_HEX_REGEX.test(entry.sha256)).toBe(true);
      expect(ALLOWED_TOOLS_ROOT_GROUP_VALUES).toContain(entry.group);
      expect(entry.role.length).toBeGreaterThan(0);
      expect(entry.relative_path.startsWith(TOOLS_ROOT_RELATIVE_PATH)).toBe(true);
      expect(entry.relative_path.startsWith(TOOLS_REFERENCE_RELATIVE_PATH)).toBe(false);

      expectAsciiSorted(entry.exported_interfaces);
      expectAsciiSorted(entry.exported_functions);
      expectAsciiSorted(entry.exported_constants);
      expectAsciiSorted(entry.exported_classes);
      expectAsciiSorted(entry.exported_types);
      expectAsciiSorted(entry.exported_const_enums);

      if (entry.companion_test_relative_path !== null) {
        expect(existsSync(entry.companion_test_relative_path)).toBe(true);
      }

      if (entry.is_top_level_imperative_script) {
        expect(entry.exported_interfaces).toEqual([]);
        expect(entry.exported_functions).toEqual([]);
        expect(entry.exported_constants).toEqual([]);
      }
    }
  });

  test('inventory companion_tests entries match on-disk size, line count, sha256 and reference real cover paths', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.companion_tests.length).toBe(3);
    for (const entry of inventory.companion_tests) {
      expect(existsSync(entry.relative_path)).toBe(true);
      expect(entry.size_bytes).toBe(statSync(entry.relative_path).size);
      expect(entry.line_count).toBe(countLines(entry.relative_path));
      expect(entry.sha256).toBe(computeSha256(entry.relative_path));
      expect(SHA256_HEX_REGEX.test(entry.sha256)).toBe(true);
      expect(existsSync(entry.covers_tools_relative_path)).toBe(true);
      expect(entry.covers_tools_relative_path.startsWith(TOOLS_ROOT_RELATIVE_PATH)).toBe(true);

      const testText = readFileSync(entry.relative_path, 'utf8');
      const importTokenRoot = entry.covers_tools_relative_path.replace(/^tools\//, '../../tools/').replace(/\.ts$/, '');
      const alternateImportTokenRoot = entry.covers_tools_relative_path.replace(/^tools\//, '../../../tools/').replace(/\.ts$/, '');
      const containsImport = testText.includes(importTokenRoot) || testText.includes(alternateImportTokenRoot);
      expect(containsImport).toBe(true);
    }
  });

  test('inventory capture_pipeline_invariants pin the GDI capture pipeline shape and match windowCaptureProbe.ts', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.capture_pipeline_invariants;
    expect(invariants.chocolate_doom_window_title).toBe('Chocolate Doom 2.2.1');
    expect(invariants.display_width).toBe(640);
    expect(invariants.display_height).toBe(480);
    expect(invariants.internal_width).toBe(320);
    expect(invariants.internal_height).toBe(200);
    expect(invariants.bits_per_pixel).toBe(32);
    expect(invariants.bytes_per_pixel).toBe(4);
    expect(invariants.capture_buffer_size_bytes).toBe(invariants.display_width * invariants.display_height * invariants.bytes_per_pixel);
    expect(invariants.capture_buffer_size_bytes).toBe(1228800);
    expect(invariants.bitmapinfoheader_size_bytes).toBe(40);
    expect(invariants.srccopy_constant_hex).toBe('0x00cc0020');
    expect(invariants.dib_rgb_colors_constant).toBe(0);
    expect(invariants.bi_rgb_constant).toBe(0);
    expect(invariants.capture_step_count).toBe(12);
    expect(invariants.capture_step_api_function_order.length).toBe(invariants.capture_step_count);
    expect(invariants.required_api_function_count).toBe(11);
    expect(invariants.required_api_functions_sorted.length).toBe(invariants.required_api_function_count);
    expectAsciiSorted(invariants.required_api_functions_sorted);
    const orderedDistinctApi = new Set(invariants.capture_step_api_function_order);
    expect(orderedDistinctApi.size).toBe(invariants.required_api_function_count);
    for (const apiName of invariants.required_api_functions_sorted) {
      expect(invariants.capture_step_api_function_order).toContain(apiName);
    }
    expect(invariants.user32_package_name).toBe('@bun-win32/user32');
    expect(invariants.gdi32_package_name).toBe('@bun-win32/gdi32');
    expect(invariants.user32_capture_symbol_count).toBe(invariants.user32_capture_symbol_names_sorted.length);
    expect(invariants.gdi32_capture_symbol_count).toBe(invariants.gdi32_capture_symbol_names_sorted.length);
    expectAsciiSorted(invariants.user32_capture_symbol_names_sorted);
    expectAsciiSorted(invariants.gdi32_capture_symbol_names_sorted);
    expect(invariants.notes.length).toBeGreaterThan(0);

    const probeText = readFileSync('tools/reference/windowCaptureProbe.ts', 'utf8');
    expect(probeText).toContain(`'${invariants.chocolate_doom_window_title}'`);
    expect(probeText).toContain('export const SRCCOPY = 0x00cc_0020');
    expect(probeText).toContain('export const DIB_RGB_COLORS = 0');
    expect(probeText).toContain('export const BI_RGB = 0');
    expect(probeText).toContain('export const BITMAPINFOHEADER_SIZE = 40');
    expect(probeText).toContain('export const CAPTURE_BITS_PER_PIXEL = 32');
    expect(probeText).toContain('displayWidth: 640');
    expect(probeText).toContain('displayHeight: 480');
    expect(probeText).toContain('internalWidth: 320');
    expect(probeText).toContain('internalHeight: 200');
    for (const apiName of invariants.required_api_functions_sorted) {
      expect(probeText).toContain(`'${apiName}'`);
    }
  });

  test('inventory sandbox_invariants pin the four-axis isolation contract and match isolationProbe.ts surface', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.sandbox_invariants;
    expect(invariants.required_file_count).toBe(4);
    expect(invariants.mutable_file_count).toBe(2);
    expect(invariants.immutable_file_count).toBe(2);
    expect(invariants.mutable_file_count + invariants.immutable_file_count).toBe(invariants.required_file_count);
    expect(invariants.config_isolation_check_enabled).toBe(true);
    expect(invariants.source_unmodified_post_condition).toBe(true);
    expect(invariants.cleanup_after_run_enabled).toBe(true);
    expect(invariants.sandbox_parent_gitkeep_relative_filename).toBe('.gitkeep');
    expect(invariants.config_isolation_sentinel_string).toBe('# isolation-probe-sentinel');
    expect(invariants.hash_algorithm).toBe('sha256');
    expect(invariants.hash_output_case).toBe('uppercase-hex');
    expect(invariants.notes.length).toBeGreaterThan(0);

    const probeText = readFileSync('tools/reference/isolationProbe.ts', 'utf8');
    expect(probeText).toContain('export const REQUIRED_FILE_COUNT = SANDBOX_REQUIRED_FILES.length');
    expect(probeText).toContain('export const MUTABLE_FILE_COUNT = SANDBOX_REQUIRED_FILES.filter');
    expect(probeText).toContain('export const IMMUTABLE_FILE_COUNT = REQUIRED_FILE_COUNT - MUTABLE_FILE_COUNT');
    expect(probeText).toContain(invariants.config_isolation_sentinel_string);
    expect(probeText).toContain("Bun.write(join(sandboxParentPath, '.gitkeep')");
    expect(probeText).toContain("digest('hex').toUpperCase()");
  });

  test('inventory verify_command_invariants pin the canonical bun-only three-command sequence and match tools/verify.ts', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.verify_command_invariants;
    expect(invariants.verify_command_count).toBe(3);
    expect([...invariants.verify_command_kinds_in_order]).toEqual(['focused-test', 'full-suite', 'typecheck']);
    expect(invariants.executable_program).toBe('bun');
    expect([...invariants.focused_test_args_prefix]).toEqual(['test']);
    expect([...invariants.full_suite_args]).toEqual(['test']);
    expect([...invariants.typecheck_args_prefix]).toEqual(['x', 'tsc', '--noEmit', '--project']);
    expect(invariants.tsconfig_path_relative).toBe('tsconfig.json');
    expect(invariants.notes.length).toBeGreaterThan(0);

    const verifyText = readFileSync('tools/verify.ts', 'utf8');
    expect(verifyText).toContain('export const VERIFY_COMMAND_COUNT = 3');
    expect(verifyText).toContain("export const VERIFY_COMMAND_KINDS: readonly VerifyCommandKind[] = Object.freeze(['focused-test', 'full-suite', 'typecheck']");
    expect(verifyText).toContain("kind: 'focused-test'");
    expect(verifyText).toContain("kind: 'full-suite'");
    expect(verifyText).toContain("kind: 'typecheck'");
  });

  test('inventory boundary_status records the writable workspaces and source-only no-proprietary-bytes contract', async () => {
    const inventory = await loadInventoryDocument();
    const boundary = inventory.boundary_status;
    expect(boundary.tools_root_relative_path).toBe(TOOLS_ROOT_RELATIVE_PATH);
    expect(boundary.tools_reference_relative_path).toBe(TOOLS_REFERENCE_RELATIVE_PATH);
    expect(boundary.writable_workspace).toBe(true);
    expect(boundary.source_only_metadata).toBe(true);
    expect(boundary.no_proprietary_bytes_embedded).toBe(true);
    expect(boundary.tools_reference_modules_directly_open_proprietary_bundle).toBe(true);
    expect(boundary.notes.length).toBeGreaterThan(0);
    expect(boundary.notes).toContain('REFERENCE_SANDBOX_POLICY');
    expect(existsSync(TOOLS_ROOT_RELATIVE_PATH)).toBe(true);
    expect(existsSync(TOOLS_REFERENCE_RELATIVE_PATH)).toBe(true);
  });

  test('inventory implications mention the capture surface, the verify-command contract, and the FFI handle invariant', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain('isolationProbe.ts');
    expect(concatenatedImplications).toContain('windowCaptureProbe.ts');
    expect(concatenatedImplications).toContain('FFIType.u64');
    expect(concatenatedImplications).toContain('Chocolate Doom 2.2.1');
    expect(concatenatedImplications).toContain('SHA-256');
    expect(concatenatedImplications).toContain('VERIFY_COMMAND_COUNT');
    expect(concatenatedImplications).toContain('format-changed.ts');
  });

  test('inventory follow_up_steps point at real plan_vanilla_parity step files', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.follow_up_steps.length).toBeGreaterThan(0);
    let phase01InventoryGateFound = false;
    let phase02CatalogFound = false;
    for (const followUpEntry of inventory.follow_up_steps) {
      const stepIdMatch = /^(\d{2}-\d{3})\s+(.+)$/.exec(followUpEntry);
      expect(stepIdMatch).not.toBeNull();
      const stepId = stepIdMatch![1]!;
      const stepSlug = stepIdMatch![2]!;
      const stepFilePath = `plan_vanilla_parity/steps/${stepId}-${stepSlug}.md`;
      expect(existsSync(stepFilePath)).toBe(true);
      expect(statSync(stepFilePath).isFile()).toBe(true);
      if (stepId === '01-024') {
        phase01InventoryGateFound = true;
      }
      if (stepId === '02-001') {
        phase02CatalogFound = true;
      }
    }
    expect(phase01InventoryGateFound).toBe(true);
    expect(phase02CatalogFound).toBe(true);
  });

  test('step file under plan_vanilla_parity/steps pins the same write lock paths as this test enforces', async () => {
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain(INVENTORY_JSON_PATH);
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-tools-reference-capture-surface.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a fabricated capture module sha256 with a bogus value would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstEntry = inventory.capture_modules[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstEntry.sha256).not.toBe(fabricatedSha256);
    expect(firstEntry.sha256).toBe(computeSha256(firstEntry.relative_path));
  });

  test('failure mode: a fabricated capture buffer size that disagrees with display * bpp would fail the invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedBufferSize = 999_999;
    expect(inventory.capture_pipeline_invariants.capture_buffer_size_bytes).not.toBe(fabricatedBufferSize);
    expect(inventory.capture_pipeline_invariants.capture_buffer_size_bytes).toBe(
      inventory.capture_pipeline_invariants.display_width * inventory.capture_pipeline_invariants.display_height * inventory.capture_pipeline_invariants.bytes_per_pixel,
    );
  });

  test('failure mode: a fabricated sandbox required_file_count that disagrees with mutable + immutable would fail the invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedRequiredCount = 99;
    expect(inventory.sandbox_invariants.required_file_count).not.toBe(fabricatedRequiredCount);
    expect(inventory.sandbox_invariants.required_file_count).toBe(inventory.sandbox_invariants.mutable_file_count + inventory.sandbox_invariants.immutable_file_count);
  });

  test('failure mode: a fabricated executable_program that disagrees with bun would fail the verify-command invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedExecutableProgram = 'node';
    expect(inventory.verify_command_invariants.executable_program).not.toBe(fabricatedExecutableProgram);
    expect(inventory.verify_command_invariants.executable_program).toBe('bun');
  });
});
