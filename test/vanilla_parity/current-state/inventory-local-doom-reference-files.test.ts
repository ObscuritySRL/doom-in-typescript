import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-local-doom-reference-files.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-019-inventory-local-doom-reference-files.md';
const SRC_REFERENCE_RELATIVE_PATH = 'src/reference/';
const SRC_ORACLES_RELATIVE_PATH = 'src/oracles/';
const REFERENCE_MANIFESTS_RELATIVE_PATH = 'reference/manifests/';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const UPPERCASE_SHA256_REGEX = /^[0-9A-F]{64}$/;

const ALLOWED_SOURCE_MODULE_GROUPS: readonly string[] = ['license_boundary_classifier', 'primary_target_anchor', 'reference_run_manifest', 'sandbox_copy_policy'];
const ALLOWED_MANIFEST_GROUPS: readonly string[] = ['file_hash_manifest'];
const EXPECTED_INVENTORIED_SRC_REFERENCE_FILENAMES: readonly string[] = ['policy.ts', 'target.ts'];
const EXPECTED_INVENTORIED_SRC_ORACLES_FILENAMES: readonly string[] = ['referenceRunManifest.ts', 'referenceSandbox.ts'];
const EXPECTED_INVENTORIED_REFERENCE_MANIFESTS_FILENAMES: readonly string[] = ['file-hashes.json'];
const EXPECTED_ASSET_BOUNDARY_FILENAMES: readonly string[] = ['DOOM.EXE', 'DOOM1.WAD', 'DOOMD.EXE', 'DOOMDUPX.EXE', 'DOOMWUPX.exe', 'chocolate-doom.cfg', 'default.cfg', 'smash.py'];
const EXPECTED_LICENSE_CATEGORIES: readonly string[] = ['commercial-shareware', 'gpl', 'mixed', 'utility'];
const EXPECTED_REDISTRIBUTION_POLICIES: readonly string[] = ['forbidden', 'permitted-with-notice'];
const EXPECTED_SANDBOX_REQUIRED_FILENAMES: readonly string[] = ['DOOM.EXE', 'DOOM1.WAD', 'chocolate-doom.cfg', 'default.cfg'];
const EXPECTED_SANDBOX_EXCLUDED_FILENAMES: readonly string[] = ['DOOMD.EXE', 'DOOMDUPX.EXE', 'DOOMWUPX.exe', 'smash.py'];

interface InventorySourceDirectoryGroups {
  readonly src_reference_relative_path: string;
  readonly src_oracles_relative_path: string;
  readonly reference_manifests_relative_path: string;
  readonly src_reference_module_count: number;
  readonly src_reference_module_filenames_sorted: readonly string[];
  readonly src_oracles_inventoried_module_count: number;
  readonly src_oracles_inventoried_module_filenames_sorted: readonly string[];
  readonly reference_manifests_inventoried_count: number;
  readonly reference_manifests_inventoried_filenames_sorted: readonly string[];
  readonly total_inventoried_source_size_bytes: number;
  readonly total_inventoried_source_line_count: number;
  readonly total_inventoried_manifest_size_bytes: number;
  readonly total_inventoried_manifest_line_count: number;
  readonly companion_test_file_count: number;
  readonly companion_test_relative_paths_sorted: readonly string[];
  readonly total_companion_test_size_bytes: number;
  readonly total_companion_test_line_count: number;
}

interface InventorySourceModule {
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

interface InventoryManifestFile {
  readonly relative_path: string;
  readonly group: string;
  readonly role: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly manifest_algorithm: string;
  readonly manifest_file_entry_count: number;
  readonly manifest_file_entry_filenames_sorted: readonly string[];
  readonly src_importer_count: number;
  readonly test_importer_count: number;
  readonly companion_test_relative_path: string;
}

interface InventoryCompanionTest {
  readonly relative_path: string;
  readonly covers_source_relative_path: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
}

interface InventoryAssetBoundaryInvariants {
  readonly asset_boundary_count: number;
  readonly asset_boundary_filenames_sorted: readonly string[];
  readonly license_category_distinct_count: number;
  readonly license_category_values_sorted: readonly string[];
  readonly redistribution_policy_distinct_count: number;
  readonly redistribution_policy_values_sorted: readonly string[];
  readonly redistribution_forbidden_count: number;
  readonly redistribution_permitted_with_notice_count: number;
  readonly mixed_license_filenames_sorted: readonly string[];
  readonly commercial_shareware_filenames_sorted: readonly string[];
  readonly gpl_filenames_sorted: readonly string[];
  readonly utility_filenames_sorted: readonly string[];
  readonly notes: string;
}

interface InventoryPrimaryTargetInvariants {
  readonly engine: string;
  readonly engine_version: string;
  readonly emulated_vanilla_version: string;
  readonly game_mode: string;
  readonly executable_filename: string;
  readonly executable_sha256_uppercase: string;
  readonly dos_executable_filename: string;
  readonly dos_executable_sha256_uppercase: string;
  readonly wad_filename: string;
  readonly wad_sha256_uppercase: string;
  readonly wad_lump_count: number;
  readonly tic_rate_hz: number;
  readonly notes: string;
}

interface InventorySandboxRequiredFilesInvariants {
  readonly required_file_count: number;
  readonly required_filenames_sorted: readonly string[];
  readonly mutable_file_count: number;
  readonly immutable_file_count: number;
  readonly valid_role_values_sorted: readonly string[];
  readonly role_executable_count: number;
  readonly role_iwad_count: number;
  readonly role_config_count: number;
  readonly config_role_filenames_sorted: readonly string[];
  readonly executable_role_filename: string;
  readonly iwad_role_filename: string;
  readonly expected_hash_format: string;
  readonly expected_hash_length: number;
  readonly notes: string;
}

interface InventorySandboxExcludedFilesInvariants {
  readonly excluded_file_count: number;
  readonly excluded_filenames_sorted: readonly string[];
  readonly every_excluded_filename_appears_in_asset_boundaries: boolean;
  readonly every_excluded_filename_absent_from_required_files: boolean;
  readonly notes: string;
}

interface InventoryReferenceRunManifestInvariants {
  readonly init_sequence_length: number;
  readonly tic_rate_hz: number;
  readonly emulated_version: string;
  readonly executable_filename: string;
  readonly iwad_filename: string;
  readonly internal_width: number;
  readonly internal_height: number;
  readonly display_width: number;
  readonly display_height: number;
  readonly bits_per_pixel: number;
  readonly aspect_ratio_correct: boolean;
  readonly screenblocks: number;
  readonly detail_level: number;
  readonly gamma_level: number;
  readonly audio_sample_rate_hz: number;
  readonly audio_max_channels: number;
  readonly audio_sfx_device: number;
  readonly audio_music_device: number;
  readonly audio_sfx_volume: number;
  readonly audio_music_volume: number;
  readonly audio_opl_io_port_hex: string;
  readonly startup_skill: number;
  readonly startup_episode: number;
  readonly startup_map: number;
  readonly startup_deathmatch: number;
  readonly startup_player_count: number;
  readonly startup_total_nodes: number;
  readonly vanilla_demo_limit: boolean;
  readonly vanilla_keyboard_mapping: boolean;
  readonly vanilla_savegame_limit: boolean;
  readonly run_mode_count: number;
  readonly run_mode_values_sorted: readonly string[];
  readonly init_sequence_first_label: string;
  readonly init_sequence_last_label: string;
  readonly notes: string;
}

interface InventoryBoundaryStatus {
  readonly src_reference_relative_path: string;
  readonly src_oracles_inventoried_modules_relative_paths: readonly string[];
  readonly reference_manifests_relative_path: string;
  readonly doom_bundle_directory_intentionally_excluded: boolean;
  readonly doom_bundle_directory_relative_path: string;
  readonly writable_workspace_for_inventoried_paths: boolean;
  readonly source_only_metadata: boolean;
  readonly no_proprietary_bytes_embedded: boolean;
  readonly all_proprietary_files_referenced_by_filename_only: boolean;
  readonly every_required_or_excluded_filename_appears_in_asset_boundaries: boolean;
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
  readonly source_directory_groups: InventorySourceDirectoryGroups;
  readonly source_modules: readonly InventorySourceModule[];
  readonly manifest_files: readonly InventoryManifestFile[];
  readonly companion_tests: readonly InventoryCompanionTest[];
  readonly asset_boundary_invariants: InventoryAssetBoundaryInvariants;
  readonly primary_target_invariants: InventoryPrimaryTargetInvariants;
  readonly sandbox_required_files_invariants: InventorySandboxRequiredFilesInvariants;
  readonly sandbox_excluded_files_invariants: InventorySandboxExcludedFilesInvariants;
  readonly reference_run_manifest_invariants: InventoryReferenceRunManifestInvariants;
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

describe('inventory: local doom reference files', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-019');
    expect(inventory.title).toBe('Inventory Local Doom Reference Files');
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

  test('inventory summary and evidence method identify the audited local doom reference declaration surface', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.summary).toContain('src/reference/policy.ts');
    expect(inventory.summary).toContain('src/reference/target.ts');
    expect(inventory.summary).toContain('src/oracles/referenceSandbox.ts');
    expect(inventory.summary).toContain('src/oracles/referenceRunManifest.ts');
    expect(inventory.summary).toContain('reference/manifests/file-hashes.json');
    expect(inventory.summary).toContain('ASSET_BOUNDARIES');
    expect(inventory.summary).toContain('PRIMARY_TARGET');
    expect(inventory.summary).toContain('SANDBOX_REQUIRED_FILES');
    expect(inventory.summary).toContain('REFERENCE_RUN_MANIFEST');
    expect(inventory.summary).toContain('Chocolate Doom 2.2.1');
    expect(inventory.summary).toContain('source-only metadata');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('SHA-256');
    expect(inventory.evidence_method).toContain('src/reference/');
    expect(inventory.evidence_method).toContain('src/oracles/');
    expect(inventory.evidence_method).toContain('reference/manifests/');
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

  test('inventory source_directory_groups records both src directories and the reference manifests directory with on-disk totals', async () => {
    const inventory = await loadInventoryDocument();
    const groups = inventory.source_directory_groups;
    expect(groups.src_reference_relative_path).toBe(SRC_REFERENCE_RELATIVE_PATH);
    expect(groups.src_oracles_relative_path).toBe(SRC_ORACLES_RELATIVE_PATH);
    expect(groups.reference_manifests_relative_path).toBe(REFERENCE_MANIFESTS_RELATIVE_PATH);
    expect(existsSync(groups.src_reference_relative_path)).toBe(true);
    expect(existsSync(groups.src_oracles_relative_path)).toBe(true);
    expect(existsSync(groups.reference_manifests_relative_path)).toBe(true);

    expectAsciiSorted(groups.src_reference_module_filenames_sorted);
    expect([...groups.src_reference_module_filenames_sorted]).toEqual([...EXPECTED_INVENTORIED_SRC_REFERENCE_FILENAMES]);
    expect(groups.src_reference_module_count).toBe(EXPECTED_INVENTORIED_SRC_REFERENCE_FILENAMES.length);

    const onDiskSrcReferenceFiles = listMatchingFilenamesSortedAscii(groups.src_reference_relative_path, (filename) => filename.endsWith('.ts'));
    expect([...onDiskSrcReferenceFiles]).toEqual([...EXPECTED_INVENTORIED_SRC_REFERENCE_FILENAMES]);

    expectAsciiSorted(groups.src_oracles_inventoried_module_filenames_sorted);
    expect([...groups.src_oracles_inventoried_module_filenames_sorted]).toEqual([...EXPECTED_INVENTORIED_SRC_ORACLES_FILENAMES]);
    expect(groups.src_oracles_inventoried_module_count).toBe(EXPECTED_INVENTORIED_SRC_ORACLES_FILENAMES.length);

    expectAsciiSorted(groups.reference_manifests_inventoried_filenames_sorted);
    expect([...groups.reference_manifests_inventoried_filenames_sorted]).toEqual([...EXPECTED_INVENTORIED_REFERENCE_MANIFESTS_FILENAMES]);
    expect(groups.reference_manifests_inventoried_count).toBe(EXPECTED_INVENTORIED_REFERENCE_MANIFESTS_FILENAMES.length);

    let totalSourceSizeBytes = 0;
    let totalSourceLineCount = 0;
    for (const filename of EXPECTED_INVENTORIED_SRC_REFERENCE_FILENAMES) {
      const filePath = `${groups.src_reference_relative_path}${filename}`;
      totalSourceSizeBytes += statSync(filePath).size;
      totalSourceLineCount += countLines(filePath);
    }
    for (const filename of EXPECTED_INVENTORIED_SRC_ORACLES_FILENAMES) {
      const filePath = `${groups.src_oracles_relative_path}${filename}`;
      totalSourceSizeBytes += statSync(filePath).size;
      totalSourceLineCount += countLines(filePath);
    }
    expect(groups.total_inventoried_source_size_bytes).toBe(totalSourceSizeBytes);
    expect(groups.total_inventoried_source_line_count).toBe(totalSourceLineCount);

    let totalManifestSizeBytes = 0;
    let totalManifestLineCount = 0;
    for (const filename of EXPECTED_INVENTORIED_REFERENCE_MANIFESTS_FILENAMES) {
      const filePath = `${groups.reference_manifests_relative_path}${filename}`;
      totalManifestSizeBytes += statSync(filePath).size;
      totalManifestLineCount += countLines(filePath);
    }
    expect(groups.total_inventoried_manifest_size_bytes).toBe(totalManifestSizeBytes);
    expect(groups.total_inventoried_manifest_line_count).toBe(totalManifestLineCount);

    expect(groups.companion_test_file_count).toBe(groups.companion_test_relative_paths_sorted.length);
    expectAsciiSorted(groups.companion_test_relative_paths_sorted);
    expect(groups.companion_test_file_count).toBe(5);

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

  test('inventory source_modules covers every inventoried TypeScript declaration sorted by relative_path', async () => {
    const inventory = await loadInventoryDocument();
    const observedRelativePaths = inventory.source_modules.map((entry) => entry.relative_path);
    expectAsciiSorted(observedRelativePaths);

    const expectedRelativePaths = [
      ...EXPECTED_INVENTORIED_SRC_ORACLES_FILENAMES.map((filename) => `${SRC_ORACLES_RELATIVE_PATH}${filename}`),
      ...EXPECTED_INVENTORIED_SRC_REFERENCE_FILENAMES.map((filename) => `${SRC_REFERENCE_RELATIVE_PATH}${filename}`),
    ].sort();
    expect([...observedRelativePaths]).toEqual([...expectedRelativePaths]);
  });

  test('inventory source_modules entries match on-disk size, line count, sha256, and have allowed group values', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.source_modules.length).toBe(4);
    for (const entry of inventory.source_modules) {
      expect(existsSync(entry.relative_path)).toBe(true);
      expect(entry.size_bytes).toBe(statSync(entry.relative_path).size);
      expect(entry.line_count).toBe(countLines(entry.relative_path));
      expect(entry.sha256).toBe(computeSha256(entry.relative_path));
      expect(SHA256_HEX_REGEX.test(entry.sha256)).toBe(true);
      expect(ALLOWED_SOURCE_MODULE_GROUPS).toContain(entry.group);
      expect(entry.role.length).toBeGreaterThan(0);

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
      for (const exportedTypeName of entry.exported_types) {
        expect(moduleText).toMatch(new RegExp(`^export type ${exportedTypeName}\\b`, 'm'));
      }

      expect(existsSync(entry.companion_test_relative_path)).toBe(true);
    }
  });

  test('inventory manifest_files covers every inventoried JSON declaration with on-disk size, line count, and sha256', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.manifest_files.length).toBe(1);
    for (const entry of inventory.manifest_files) {
      expect(existsSync(entry.relative_path)).toBe(true);
      expect(entry.size_bytes).toBe(statSync(entry.relative_path).size);
      expect(entry.line_count).toBe(countLines(entry.relative_path));
      expect(entry.sha256).toBe(computeSha256(entry.relative_path));
      expect(SHA256_HEX_REGEX.test(entry.sha256)).toBe(true);
      expect(ALLOWED_MANIFEST_GROUPS).toContain(entry.group);
      expect(entry.role.length).toBeGreaterThan(0);
      expect(entry.relative_path.startsWith(REFERENCE_MANIFESTS_RELATIVE_PATH)).toBe(true);

      const manifestJson = JSON.parse(readFileSync(entry.relative_path, 'utf8')) as { algorithm: string; files: readonly { filename: string }[] };
      expect(entry.manifest_algorithm).toBe(manifestJson.algorithm);
      expect(entry.manifest_file_entry_count).toBe(manifestJson.files.length);
      const observedManifestFilenamesSorted = [...manifestJson.files.map((file) => file.filename)].sort();
      expect([...entry.manifest_file_entry_filenames_sorted]).toEqual(observedManifestFilenamesSorted);
      expectAsciiSorted(entry.manifest_file_entry_filenames_sorted);

      expect(existsSync(entry.companion_test_relative_path)).toBe(true);
    }
  });

  test('inventory companion_tests entries match on-disk size, line count, sha256 and reference real cover paths', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.companion_tests.length).toBe(5);
    expectAsciiSorted(inventory.companion_tests.map((entry) => entry.relative_path));
    for (const entry of inventory.companion_tests) {
      expect(existsSync(entry.relative_path)).toBe(true);
      expect(entry.size_bytes).toBe(statSync(entry.relative_path).size);
      expect(entry.line_count).toBe(countLines(entry.relative_path));
      expect(entry.sha256).toBe(computeSha256(entry.relative_path));
      expect(SHA256_HEX_REGEX.test(entry.sha256)).toBe(true);
      expect(existsSync(entry.covers_source_relative_path)).toBe(true);
    }
  });

  test('inventory asset_boundary_invariants pin the 8 ASSET_BOUNDARIES classifications and match src/reference/policy.ts', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.asset_boundary_invariants;
    expect(invariants.asset_boundary_count).toBe(8);
    expect([...invariants.asset_boundary_filenames_sorted]).toEqual([...EXPECTED_ASSET_BOUNDARY_FILENAMES]);
    expect(invariants.license_category_distinct_count).toBe(EXPECTED_LICENSE_CATEGORIES.length);
    expect([...invariants.license_category_values_sorted]).toEqual([...EXPECTED_LICENSE_CATEGORIES]);
    expect(invariants.redistribution_policy_distinct_count).toBe(EXPECTED_REDISTRIBUTION_POLICIES.length);
    expect([...invariants.redistribution_policy_values_sorted]).toEqual([...EXPECTED_REDISTRIBUTION_POLICIES]);
    expect(invariants.redistribution_forbidden_count + invariants.redistribution_permitted_with_notice_count).toBe(invariants.asset_boundary_count);
    expect(invariants.redistribution_forbidden_count).toBe(4);
    expect(invariants.redistribution_permitted_with_notice_count).toBe(4);

    const partitionTotal = invariants.mixed_license_filenames_sorted.length + invariants.commercial_shareware_filenames_sorted.length + invariants.gpl_filenames_sorted.length + invariants.utility_filenames_sorted.length;
    expect(partitionTotal).toBe(invariants.asset_boundary_count);
    expectAsciiSorted(invariants.mixed_license_filenames_sorted);
    expectAsciiSorted(invariants.commercial_shareware_filenames_sorted);
    expectAsciiSorted(invariants.gpl_filenames_sorted);
    expectAsciiSorted(invariants.utility_filenames_sorted);
    expect(invariants.notes.length).toBeGreaterThan(0);

    const policyText = readFileSync('src/reference/policy.ts', 'utf8');
    for (const filename of invariants.asset_boundary_filenames_sorted) {
      expect(policyText).toContain(`filename: '${filename}'`);
    }
    for (const licenseCategory of invariants.license_category_values_sorted) {
      expect(policyText).toContain(`'${licenseCategory}'`);
    }
    for (const redistributionPolicy of invariants.redistribution_policy_values_sorted) {
      expect(policyText).toContain(`'${redistributionPolicy}'`);
    }
  });

  test('inventory primary_target_invariants pin the PRIMARY_TARGET fields and match src/reference/target.ts', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.primary_target_invariants;
    expect(invariants.engine).toBe('Chocolate Doom');
    expect(invariants.engine_version).toBe('2.2.1');
    expect(invariants.emulated_vanilla_version).toBe('1.9');
    expect(invariants.game_mode).toBe('shareware');
    expect(invariants.executable_filename).toBe('DOOM.EXE');
    expect(UPPERCASE_SHA256_REGEX.test(invariants.executable_sha256_uppercase)).toBe(true);
    expect(invariants.dos_executable_filename).toBe('DOOMD.EXE');
    expect(UPPERCASE_SHA256_REGEX.test(invariants.dos_executable_sha256_uppercase)).toBe(true);
    expect(invariants.wad_filename).toBe('DOOM1.WAD');
    expect(UPPERCASE_SHA256_REGEX.test(invariants.wad_sha256_uppercase)).toBe(true);
    expect(invariants.wad_lump_count).toBe(1264);
    expect(invariants.tic_rate_hz).toBe(35);
    expect(invariants.executable_sha256_uppercase).not.toBe(invariants.dos_executable_sha256_uppercase);
    expect(invariants.executable_sha256_uppercase).not.toBe(invariants.wad_sha256_uppercase);
    expect(invariants.notes.length).toBeGreaterThan(0);

    const targetText = readFileSync('src/reference/target.ts', 'utf8');
    expect(targetText).toContain(`engine: '${invariants.engine}'`);
    expect(targetText).toContain(`engineVersion: '${invariants.engine_version}'`);
    expect(targetText).toContain(`emulatedVersion: '${invariants.emulated_vanilla_version}'`);
    expect(targetText).toContain(`gameMode: '${invariants.game_mode}'`);
    expect(targetText).toContain(`executableHash: '${invariants.executable_sha256_uppercase}'`);
    expect(targetText).toContain(`dosExecutableHash: '${invariants.dos_executable_sha256_uppercase}'`);
    expect(targetText).toContain(`wadHash: '${invariants.wad_sha256_uppercase}'`);
    expect(targetText).toContain(`wadFilename: '${invariants.wad_filename}'`);
    expect(targetText).toContain(`wadLumpCount: ${invariants.wad_lump_count}`);
    expect(targetText).toContain(`ticRateHz: ${invariants.tic_rate_hz}`);
  });

  test('inventory sandbox_required_files_invariants pin the 4-file sandbox content and match src/oracles/referenceSandbox.ts', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.sandbox_required_files_invariants;
    expect(invariants.required_file_count).toBe(4);
    expect([...invariants.required_filenames_sorted]).toEqual([...EXPECTED_SANDBOX_REQUIRED_FILENAMES]);
    expectAsciiSorted(invariants.required_filenames_sorted);
    expect(invariants.mutable_file_count + invariants.immutable_file_count).toBe(invariants.required_file_count);
    expect(invariants.mutable_file_count).toBe(2);
    expect(invariants.immutable_file_count).toBe(2);
    expect([...invariants.valid_role_values_sorted]).toEqual(['config', 'executable', 'iwad']);
    expect(invariants.role_executable_count + invariants.role_iwad_count + invariants.role_config_count).toBe(invariants.required_file_count);
    expect(invariants.role_executable_count).toBe(1);
    expect(invariants.role_iwad_count).toBe(1);
    expect(invariants.role_config_count).toBe(2);
    expectAsciiSorted(invariants.config_role_filenames_sorted);
    expect([...invariants.config_role_filenames_sorted]).toEqual(['chocolate-doom.cfg', 'default.cfg']);
    expect(invariants.executable_role_filename).toBe('DOOM.EXE');
    expect(invariants.iwad_role_filename).toBe('DOOM1.WAD');
    expect(invariants.expected_hash_format).toBe('uppercase-hex-sha256');
    expect(invariants.expected_hash_length).toBe(64);
    expect(invariants.notes.length).toBeGreaterThan(0);

    const sandboxText = readFileSync('src/oracles/referenceSandbox.ts', 'utf8');
    for (const filename of invariants.required_filenames_sorted) {
      expect(sandboxText).toContain(`filename: '${filename}'`);
    }
    expect(sandboxText).toContain('export const SANDBOX_REQUIRED_FILES');
  });

  test('inventory sandbox_excluded_files_invariants pin the 4 SANDBOX_EXCLUDED_FILES and match src/oracles/referenceSandbox.ts', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.sandbox_excluded_files_invariants;
    expect(invariants.excluded_file_count).toBe(4);
    expect([...invariants.excluded_filenames_sorted]).toEqual([...EXPECTED_SANDBOX_EXCLUDED_FILENAMES]);
    expectAsciiSorted(invariants.excluded_filenames_sorted);
    expect(invariants.every_excluded_filename_appears_in_asset_boundaries).toBe(true);
    expect(invariants.every_excluded_filename_absent_from_required_files).toBe(true);
    expect(invariants.notes.length).toBeGreaterThan(0);

    for (const excludedFilename of invariants.excluded_filenames_sorted) {
      expect(EXPECTED_ASSET_BOUNDARY_FILENAMES).toContain(excludedFilename);
      expect(EXPECTED_SANDBOX_REQUIRED_FILENAMES).not.toContain(excludedFilename);
    }

    const sandboxText = readFileSync('src/oracles/referenceSandbox.ts', 'utf8');
    expect(sandboxText).toContain('export const SANDBOX_EXCLUDED_FILES');
    for (const excludedFilename of invariants.excluded_filenames_sorted) {
      expect(sandboxText).toContain(`filename: '${excludedFilename}'`);
    }
  });

  test('inventory reference_run_manifest_invariants pin the REFERENCE_RUN_MANIFEST shape and match src/oracles/referenceRunManifest.ts', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.reference_run_manifest_invariants;
    expect(invariants.init_sequence_length).toBe(15);
    expect(invariants.tic_rate_hz).toBe(35);
    expect(invariants.emulated_version).toBe('1.9');
    expect(invariants.executable_filename).toBe('DOOM.EXE');
    expect(invariants.iwad_filename).toBe('DOOM1.WAD');
    expect(invariants.internal_width).toBe(320);
    expect(invariants.internal_height).toBe(200);
    expect(invariants.display_width).toBe(640);
    expect(invariants.display_height).toBe(480);
    expect(invariants.bits_per_pixel).toBe(32);
    expect(invariants.aspect_ratio_correct).toBe(true);
    expect(invariants.screenblocks).toBe(9);
    expect(invariants.detail_level).toBe(0);
    expect(invariants.gamma_level).toBe(0);
    expect(invariants.audio_sample_rate_hz).toBe(44100);
    expect(invariants.audio_max_channels).toBe(8);
    expect(invariants.audio_sfx_device).toBe(3);
    expect(invariants.audio_music_device).toBe(3);
    expect(invariants.audio_sfx_volume).toBe(8);
    expect(invariants.audio_music_volume).toBe(8);
    expect(invariants.audio_opl_io_port_hex).toBe('0x388');
    expect(invariants.startup_skill).toBe(2);
    expect(invariants.startup_episode).toBe(1);
    expect(invariants.startup_map).toBe(1);
    expect(invariants.startup_deathmatch).toBe(0);
    expect(invariants.startup_player_count).toBe(1);
    expect(invariants.startup_total_nodes).toBe(1);
    expect(invariants.vanilla_demo_limit).toBe(true);
    expect(invariants.vanilla_keyboard_mapping).toBe(true);
    expect(invariants.vanilla_savegame_limit).toBe(true);
    expect(invariants.run_mode_count).toBe(2);
    expect([...invariants.run_mode_values_sorted]).toEqual(['demo-playback', 'title-loop']);
    expectAsciiSorted(invariants.run_mode_values_sorted);
    expect(invariants.init_sequence_first_label).toBe('Z_Init');
    expect(invariants.init_sequence_last_label).toBe('I_InitStretchTables');
    expect(invariants.notes.length).toBeGreaterThan(0);

    const manifestText = readFileSync('src/oracles/referenceRunManifest.ts', 'utf8');
    expect(manifestText).toContain(`export const INIT_SEQUENCE_LENGTH = ${invariants.init_sequence_length}`);
    expect(manifestText).toContain(`ticRateHz: ${invariants.tic_rate_hz}`);
    expect(manifestText).toContain(`emulatedVersion: '${invariants.emulated_version}'`);
    expect(manifestText).toContain(`executableFilename: '${invariants.executable_filename}'`);
    expect(manifestText).toContain(`iwadFilename: '${invariants.iwad_filename}'`);
    expect(manifestText).toContain(`internalWidth: ${invariants.internal_width}`);
    expect(manifestText).toContain(`internalHeight: ${invariants.internal_height}`);
    expect(manifestText).toContain(`displayWidth: ${invariants.display_width}`);
    expect(manifestText).toContain(`displayHeight: ${invariants.display_height}`);
    expect(manifestText).toContain(`bitsPerPixel: ${invariants.bits_per_pixel}`);
    expect(manifestText).toContain(`label: '${invariants.init_sequence_first_label}'`);
    expect(manifestText).toContain(`label: '${invariants.init_sequence_last_label}'`);
    for (const modeName of invariants.run_mode_values_sorted) {
      expect(manifestText).toContain(`mode: '${modeName}'`);
    }
  });

  test('inventory boundary_status records the source-only no-proprietary-bytes contract and excludes the doom/ bundle directory', async () => {
    const inventory = await loadInventoryDocument();
    const boundary = inventory.boundary_status;
    expect(boundary.src_reference_relative_path).toBe(SRC_REFERENCE_RELATIVE_PATH);
    expect([...boundary.src_oracles_inventoried_modules_relative_paths]).toEqual([`${SRC_ORACLES_RELATIVE_PATH}referenceRunManifest.ts`, `${SRC_ORACLES_RELATIVE_PATH}referenceSandbox.ts`]);
    expect(boundary.reference_manifests_relative_path).toBe(REFERENCE_MANIFESTS_RELATIVE_PATH);
    expect(boundary.doom_bundle_directory_intentionally_excluded).toBe(true);
    expect(boundary.doom_bundle_directory_relative_path).toBe('doom/');
    expect(boundary.writable_workspace_for_inventoried_paths).toBe(true);
    expect(boundary.source_only_metadata).toBe(true);
    expect(boundary.no_proprietary_bytes_embedded).toBe(true);
    expect(boundary.all_proprietary_files_referenced_by_filename_only).toBe(true);
    expect(boundary.every_required_or_excluded_filename_appears_in_asset_boundaries).toBe(true);
    expect(boundary.notes.length).toBeGreaterThan(0);

    expect(existsSync(SRC_REFERENCE_RELATIVE_PATH)).toBe(true);
    expect(existsSync(SRC_ORACLES_RELATIVE_PATH)).toBe(true);
    expect(existsSync(REFERENCE_MANIFESTS_RELATIVE_PATH)).toBe(true);

    const requiredAndExcludedUnion = new Set<string>([...EXPECTED_SANDBOX_REQUIRED_FILENAMES, ...EXPECTED_SANDBOX_EXCLUDED_FILENAMES]);
    expect(requiredAndExcludedUnion.size).toBe(EXPECTED_ASSET_BOUNDARY_FILENAMES.length);
    for (const filename of EXPECTED_ASSET_BOUNDARY_FILENAMES) {
      expect(requiredAndExcludedUnion.has(filename)).toBe(true);
    }
  });

  test('inventory implications mention the four declaration sources and the consistency invariant', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain('ASSET_BOUNDARIES');
    expect(concatenatedImplications).toContain('PRIMARY_TARGET');
    expect(concatenatedImplications).toContain('SANDBOX_REQUIRED_FILES');
    expect(concatenatedImplications).toContain('SANDBOX_EXCLUDED_FILES');
    expect(concatenatedImplications).toContain('REFERENCE_RUN_MANIFEST');
    expect(concatenatedImplications).toContain('file-hashes.json');
    expect(concatenatedImplications).toContain('Chocolate Doom 2.2.1');
    expect(concatenatedImplications).toContain('SHA-256');
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
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-local-doom-reference-files.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a fabricated source module sha256 with a bogus value would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstEntry = inventory.source_modules[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstEntry.sha256).not.toBe(fabricatedSha256);
    expect(firstEntry.sha256).toBe(computeSha256(firstEntry.relative_path));
  });

  test('failure mode: a fabricated asset boundary count that disagrees with required + excluded would fail the partition invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedCount = 99;
    expect(inventory.asset_boundary_invariants.asset_boundary_count).not.toBe(fabricatedCount);
    expect(inventory.asset_boundary_invariants.asset_boundary_count).toBe(inventory.sandbox_required_files_invariants.required_file_count + inventory.sandbox_excluded_files_invariants.excluded_file_count);
  });

  test('failure mode: a fabricated PRIMARY_TARGET wad_lump_count that disagrees with the pinned 1264 would fail the anchor invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedWadLumpCount = 9999;
    expect(inventory.primary_target_invariants.wad_lump_count).not.toBe(fabricatedWadLumpCount);
    expect(inventory.primary_target_invariants.wad_lump_count).toBe(1264);
  });

  test('failure mode: a fabricated INIT_SEQUENCE_LENGTH that disagrees with the pinned 15 would fail the manifest invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedInitSequenceLength = 99;
    expect(inventory.reference_run_manifest_invariants.init_sequence_length).not.toBe(fabricatedInitSequenceLength);
    expect(inventory.reference_run_manifest_invariants.init_sequence_length).toBe(15);
  });
});
