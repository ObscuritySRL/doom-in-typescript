import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-iwad-search-and-hash-evidence.json';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-020-inventory-iwad-search-and-hash-evidence.md';
const SRC_BOOTSTRAP_RELATIVE_PATH = 'src/bootstrap/';
const SRC_PLAYABLE_RUNTIME_ENTRY_POINT_RELATIVE_PATH = 'src/playable/bun-runtime-entry-point/';
const SRC_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_RELATIVE_PATH = 'src/playable/bun-launch-local-distribution-boundary/';
const PLAN_VANILLA_PARITY_RELATIVE_PATH = 'plan_vanilla_parity/';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const UPPERCASE_SHA256_REGEX = /^[0-9A-F]{64}$/;

const ALLOWED_SOURCE_MODULE_GROUPS: readonly string[] = [
  'playable_iwad_launch_verification_contract',
  'playable_iwad_runtime_discovery_contract',
  'playable_iwad_runtime_missing_error_contract',
  'vanilla_iwad_candidate_scan_audit',
  'vanilla_shareware_default_path_audit',
  'vanilla_user_supplied_iwad_selection_audit',
];
const ALLOWED_PLAN_HASH_EVIDENCE_GROUPS: readonly string[] = ['shareware_primary_target_hash_evidence', 'user_supplied_iwad_search_scope'];

const EXPECTED_BOOTSTRAP_AUDIT_FILENAMES: readonly string[] = ['implement-iwad-discovery-order.ts', 'implement-local-shareware-iwad-default-path.ts', 'implement-user-supplied-iwad-selection.ts'];
const EXPECTED_PLAYABLE_RUNTIME_ENTRY_POINT_FILENAMES: readonly string[] = ['implementIwadDiscovery.ts', 'implementMissingIwadError.ts'];
const EXPECTED_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_FILENAMES: readonly string[] = ['verifyIwadDiscoveryAtLaunch.ts'];
const EXPECTED_PLAN_HASH_EVIDENCE_FILENAMES: readonly string[] = ['pin-shareware-doom-one-point-nine-primary-target.md', 'pin-user-supplied-registered-and-ultimate-iwad-scope.md'];

const EXPECTED_VANILLA_CANDIDATE_BASENAMES: readonly string[] = ['doom2f.wad', 'doom2.wad', 'plutonia.wad', 'tnt.wad', 'doomu.wad', 'doom.wad', 'doom1.wad'];
const EXPECTED_VANILLA_DEVELOPER_PARAMETERS: readonly string[] = ['-shdev', '-regdev', '-comdev'];
const EXPECTED_SHAREWARE_LOCAL_DROP_DIRECTORIES: readonly string[] = ['doom', 'iwad'];
const EXPECTED_SHAREWARE_LOCAL_DROP_PATHS: readonly string[] = ['doom/DOOM1.WAD', 'iwad/DOOM1.WAD'];
const EXPECTED_SUPPLIED_IWAD_RELATIVE_PATHS: readonly string[] = ['doom/DOOM.WAD', 'iwad/DOOM.WAD'];

interface InventorySourceDirectoryGroups {
  readonly src_bootstrap_relative_path: string;
  readonly src_playable_runtime_entry_point_relative_path: string;
  readonly src_playable_launch_distribution_boundary_relative_path: string;
  readonly plan_vanilla_parity_relative_path: string;
  readonly src_bootstrap_audit_module_count: number;
  readonly src_bootstrap_audit_filenames_sorted: readonly string[];
  readonly src_playable_runtime_entry_point_module_count: number;
  readonly src_playable_runtime_entry_point_filenames_sorted: readonly string[];
  readonly src_playable_launch_distribution_boundary_module_count: number;
  readonly src_playable_launch_distribution_boundary_filenames_sorted: readonly string[];
  readonly plan_hash_evidence_document_count: number;
  readonly plan_hash_evidence_document_filenames_sorted: readonly string[];
  readonly total_inventoried_source_size_bytes: number;
  readonly total_inventoried_source_line_count: number;
  readonly total_inventoried_plan_document_size_bytes: number;
  readonly total_inventoried_plan_document_line_count: number;
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

interface InventoryPlanHashEvidenceDocument {
  readonly relative_path: string;
  readonly group: string;
  readonly role: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly companion_test_relative_path: string;
}

interface InventoryCompanionTest {
  readonly relative_path: string;
  readonly covers_source_relative_path: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
}

interface InventoryIwadSearchInvariants {
  readonly vanilla_candidate_count: number;
  readonly vanilla_candidate_basenames_in_probe_order: readonly string[];
  readonly vanilla_candidate_basename_to_game_mode: Readonly<Record<string, string>>;
  readonly vanilla_default_search_directory: string;
  readonly vanilla_indeterminate_message: string;
  readonly vanilla_developer_mode_parameter_count: number;
  readonly vanilla_developer_mode_parameters_in_probe_order: readonly string[];
  readonly vanilla_developer_mode_parameter_to_game_mode: Readonly<Record<string, string>>;
  readonly vanilla_developer_mode_parameter_to_dev_data_basename: Readonly<Record<string, string>>;
  readonly vanilla_dash_iwad_flag_recognised_by_vanilla: boolean;
  readonly vanilla_dash_file_flag_changes_game_mode: boolean;
  readonly shareware_higher_priority_candidate_count: number;
  readonly shareware_local_drop_directory_count: number;
  readonly shareware_local_drop_directories_sorted: readonly string[];
  readonly shareware_local_drop_path_count: number;
  readonly shareware_local_drop_paths_sorted: readonly string[];
  readonly playable_default_local_iwad_path: string;
  readonly playable_command_line_parameter: string;
  readonly playable_default_iwad_provider: string;
  readonly playable_product_runtime_command: string;
  readonly playable_legacy_package_start_script: string;
  readonly playable_missing_iwad_message_header: string;
  readonly playable_missing_iwad_failure_kind: string;
  readonly playable_verify_step_identifier: string;
  readonly notes: string;
}

interface InventoryHashEvidenceInvariants {
  readonly shareware_iwad_filename: string;
  readonly shareware_iwad_sha256_uppercase: string;
  readonly shareware_iwad_byte_size: number;
  readonly shareware_iwad_lump_count: number;
  readonly shareware_dos_executable_filename: string;
  readonly shareware_dos_executable_sha256_uppercase: string;
  readonly shareware_dos_executable_byte_size: number;
  readonly shareware_windows_executable_filename: string;
  readonly shareware_windows_executable_sha256_uppercase: string;
  readonly shareware_windows_executable_byte_size: number;
  readonly shareware_executable_hashes_distinct: boolean;
  readonly shareware_executable_versus_iwad_hashes_distinct: boolean;
  readonly uppercase_sha256_hex_length: number;
  readonly registered_iwad_sha256_pinned: boolean;
  readonly ultimate_iwad_sha256_pinned: boolean;
  readonly supplied_iwad_filename: string;
  readonly supplied_iwad_relative_paths_sorted: readonly string[];
  readonly shareware_target_evidence_locations_sorted: readonly string[];
  readonly notes: string;
}

interface InventoryBoundaryStatus {
  readonly src_bootstrap_relative_path: string;
  readonly src_playable_runtime_entry_point_relative_path: string;
  readonly src_playable_launch_distribution_boundary_relative_path: string;
  readonly plan_vanilla_parity_relative_path: string;
  readonly doom_bundle_directory_intentionally_excluded: boolean;
  readonly doom_bundle_directory_relative_path: string;
  readonly iwad_drop_directory_intentionally_excluded: boolean;
  readonly iwad_drop_directory_relative_path: string;
  readonly writable_workspace_for_inventoried_paths: boolean;
  readonly source_only_metadata: boolean;
  readonly no_proprietary_bytes_embedded: boolean;
  readonly all_proprietary_files_referenced_by_filename_only: boolean;
  readonly shareware_iwad_path_separator_is_backslash_on_windows_only: boolean;
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
  readonly plan_hash_evidence_documents: readonly InventoryPlanHashEvidenceDocument[];
  readonly companion_tests: readonly InventoryCompanionTest[];
  readonly iwad_search_invariants: InventoryIwadSearchInvariants;
  readonly hash_evidence_invariants: InventoryHashEvidenceInvariants;
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

describe('inventory: iwad search and hash evidence', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory declares the canonical id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-020');
    expect(inventory.title).toBe('Inventory Iwad Search And Hash Evidence');
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

  test('inventory summary and evidence method identify the audited iwad search and hash evidence surface', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.summary).toContain('src/bootstrap/implement-iwad-discovery-order.ts');
    expect(inventory.summary).toContain('src/bootstrap/implement-local-shareware-iwad-default-path.ts');
    expect(inventory.summary).toContain('src/bootstrap/implement-user-supplied-iwad-selection.ts');
    expect(inventory.summary).toContain('src/playable/bun-runtime-entry-point/implementIwadDiscovery.ts');
    expect(inventory.summary).toContain('src/playable/bun-runtime-entry-point/implementMissingIwadError.ts');
    expect(inventory.summary).toContain('src/playable/bun-launch-local-distribution-boundary/verifyIwadDiscoveryAtLaunch.ts');
    expect(inventory.summary).toContain('plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md');
    expect(inventory.summary).toContain('plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md');
    expect(inventory.summary).toContain('IdentifyVersion');
    expect(inventory.summary).toContain('DOOM1.WAD');
    expect(inventory.summary).toContain('SHA-256');
    expect(inventory.evidence_method).toContain('inventory lane');
    expect(inventory.evidence_method).toContain('SHA-256');
    expect(inventory.evidence_method).toContain('src/bootstrap/');
    expect(inventory.evidence_method).toContain('src/playable/');
    expect(inventory.evidence_method).toContain('plan_vanilla_parity/');
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

  test('inventory source_directory_groups records every audited directory and on-disk totals', async () => {
    const inventory = await loadInventoryDocument();
    const groups = inventory.source_directory_groups;
    expect(groups.src_bootstrap_relative_path).toBe(SRC_BOOTSTRAP_RELATIVE_PATH);
    expect(groups.src_playable_runtime_entry_point_relative_path).toBe(SRC_PLAYABLE_RUNTIME_ENTRY_POINT_RELATIVE_PATH);
    expect(groups.src_playable_launch_distribution_boundary_relative_path).toBe(SRC_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_RELATIVE_PATH);
    expect(groups.plan_vanilla_parity_relative_path).toBe(PLAN_VANILLA_PARITY_RELATIVE_PATH);
    expect(existsSync(groups.src_bootstrap_relative_path)).toBe(true);
    expect(existsSync(groups.src_playable_runtime_entry_point_relative_path)).toBe(true);
    expect(existsSync(groups.src_playable_launch_distribution_boundary_relative_path)).toBe(true);
    expect(existsSync(groups.plan_vanilla_parity_relative_path)).toBe(true);

    expectAsciiSorted(groups.src_bootstrap_audit_filenames_sorted);
    expect([...groups.src_bootstrap_audit_filenames_sorted]).toEqual([...EXPECTED_BOOTSTRAP_AUDIT_FILENAMES]);
    expect(groups.src_bootstrap_audit_module_count).toBe(EXPECTED_BOOTSTRAP_AUDIT_FILENAMES.length);

    expectAsciiSorted(groups.src_playable_runtime_entry_point_filenames_sorted);
    expect([...groups.src_playable_runtime_entry_point_filenames_sorted]).toEqual([...EXPECTED_PLAYABLE_RUNTIME_ENTRY_POINT_FILENAMES]);
    expect(groups.src_playable_runtime_entry_point_module_count).toBe(EXPECTED_PLAYABLE_RUNTIME_ENTRY_POINT_FILENAMES.length);

    expectAsciiSorted(groups.src_playable_launch_distribution_boundary_filenames_sorted);
    expect([...groups.src_playable_launch_distribution_boundary_filenames_sorted]).toEqual([...EXPECTED_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_FILENAMES]);
    expect(groups.src_playable_launch_distribution_boundary_module_count).toBe(EXPECTED_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_FILENAMES.length);

    expectAsciiSorted(groups.plan_hash_evidence_document_filenames_sorted);
    expect([...groups.plan_hash_evidence_document_filenames_sorted]).toEqual([...EXPECTED_PLAN_HASH_EVIDENCE_FILENAMES]);
    expect(groups.plan_hash_evidence_document_count).toBe(EXPECTED_PLAN_HASH_EVIDENCE_FILENAMES.length);

    let totalSourceSizeBytes = 0;
    let totalSourceLineCount = 0;
    for (const filename of EXPECTED_BOOTSTRAP_AUDIT_FILENAMES) {
      const filePath = `${groups.src_bootstrap_relative_path}${filename}`;
      totalSourceSizeBytes += statSync(filePath).size;
      totalSourceLineCount += countLines(filePath);
    }
    for (const filename of EXPECTED_PLAYABLE_RUNTIME_ENTRY_POINT_FILENAMES) {
      const filePath = `${groups.src_playable_runtime_entry_point_relative_path}${filename}`;
      totalSourceSizeBytes += statSync(filePath).size;
      totalSourceLineCount += countLines(filePath);
    }
    for (const filename of EXPECTED_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_FILENAMES) {
      const filePath = `${groups.src_playable_launch_distribution_boundary_relative_path}${filename}`;
      totalSourceSizeBytes += statSync(filePath).size;
      totalSourceLineCount += countLines(filePath);
    }
    expect(groups.total_inventoried_source_size_bytes).toBe(totalSourceSizeBytes);
    expect(groups.total_inventoried_source_line_count).toBe(totalSourceLineCount);

    let totalPlanSizeBytes = 0;
    let totalPlanLineCount = 0;
    for (const filename of EXPECTED_PLAN_HASH_EVIDENCE_FILENAMES) {
      const filePath = `${groups.plan_vanilla_parity_relative_path}${filename}`;
      totalPlanSizeBytes += statSync(filePath).size;
      totalPlanLineCount += countLines(filePath);
    }
    expect(groups.total_inventoried_plan_document_size_bytes).toBe(totalPlanSizeBytes);
    expect(groups.total_inventoried_plan_document_line_count).toBe(totalPlanLineCount);

    expect(groups.companion_test_file_count).toBe(groups.companion_test_relative_paths_sorted.length);
    expectAsciiSorted(groups.companion_test_relative_paths_sorted);
    expect(groups.companion_test_file_count).toBe(8);

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

  test('inventory source_modules covers every inventoried TypeScript module sorted by relative_path', async () => {
    const inventory = await loadInventoryDocument();
    const observedRelativePaths = inventory.source_modules.map((entry) => entry.relative_path);
    expectAsciiSorted(observedRelativePaths);

    const expectedRelativePaths = [
      ...EXPECTED_BOOTSTRAP_AUDIT_FILENAMES.map((filename) => `${SRC_BOOTSTRAP_RELATIVE_PATH}${filename}`),
      ...EXPECTED_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_FILENAMES.map((filename) => `${SRC_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_RELATIVE_PATH}${filename}`),
      ...EXPECTED_PLAYABLE_RUNTIME_ENTRY_POINT_FILENAMES.map((filename) => `${SRC_PLAYABLE_RUNTIME_ENTRY_POINT_RELATIVE_PATH}${filename}`),
    ].sort();
    expect([...observedRelativePaths]).toEqual([...expectedRelativePaths]);
  });

  test('inventory source_modules entries match on-disk size, line count, sha256, and have allowed group values', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.source_modules.length).toBe(6);
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

  test('inventory plan_hash_evidence_documents covers every inventoried plan-document with on-disk size, line count, and sha256', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.plan_hash_evidence_documents.length).toBe(2);
    expectAsciiSorted(inventory.plan_hash_evidence_documents.map((entry) => entry.relative_path));
    for (const entry of inventory.plan_hash_evidence_documents) {
      expect(existsSync(entry.relative_path)).toBe(true);
      expect(entry.size_bytes).toBe(statSync(entry.relative_path).size);
      expect(entry.line_count).toBe(countLines(entry.relative_path));
      expect(entry.sha256).toBe(computeSha256(entry.relative_path));
      expect(SHA256_HEX_REGEX.test(entry.sha256)).toBe(true);
      expect(ALLOWED_PLAN_HASH_EVIDENCE_GROUPS).toContain(entry.group);
      expect(entry.role.length).toBeGreaterThan(0);
      expect(entry.relative_path.startsWith(PLAN_VANILLA_PARITY_RELATIVE_PATH)).toBe(true);
      expect(entry.relative_path.endsWith('.md')).toBe(true);
      expect(existsSync(entry.companion_test_relative_path)).toBe(true);
    }
  });

  test('inventory companion_tests entries match on-disk size, line count, sha256 and reference real cover paths', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.companion_tests.length).toBe(8);
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

  test('inventory iwad_search_invariants pin the seven-candidate scan and the developer-mode triple', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.iwad_search_invariants;
    expect(invariants.vanilla_candidate_count).toBe(7);
    expect([...invariants.vanilla_candidate_basenames_in_probe_order]).toEqual([...EXPECTED_VANILLA_CANDIDATE_BASENAMES]);
    expect(invariants.vanilla_candidate_basename_to_game_mode['doom2f.wad']).toBe('commercial');
    expect(invariants.vanilla_candidate_basename_to_game_mode['doom2.wad']).toBe('commercial');
    expect(invariants.vanilla_candidate_basename_to_game_mode['plutonia.wad']).toBe('commercial');
    expect(invariants.vanilla_candidate_basename_to_game_mode['tnt.wad']).toBe('commercial');
    expect(invariants.vanilla_candidate_basename_to_game_mode['doomu.wad']).toBe('retail');
    expect(invariants.vanilla_candidate_basename_to_game_mode['doom.wad']).toBe('registered');
    expect(invariants.vanilla_candidate_basename_to_game_mode['doom1.wad']).toBe('shareware');
    expect(invariants.vanilla_default_search_directory).toBe('.');
    expect(invariants.vanilla_indeterminate_message).toBe('Game mode indeterminate.\n');

    expect(invariants.vanilla_developer_mode_parameter_count).toBe(3);
    expect([...invariants.vanilla_developer_mode_parameters_in_probe_order]).toEqual([...EXPECTED_VANILLA_DEVELOPER_PARAMETERS]);
    expect(invariants.vanilla_developer_mode_parameter_to_game_mode['-shdev']).toBe('shareware');
    expect(invariants.vanilla_developer_mode_parameter_to_game_mode['-regdev']).toBe('registered');
    expect(invariants.vanilla_developer_mode_parameter_to_game_mode['-comdev']).toBe('commercial');
    expect(invariants.vanilla_developer_mode_parameter_to_dev_data_basename['-shdev']).toBe('doom1.wad');
    expect(invariants.vanilla_developer_mode_parameter_to_dev_data_basename['-regdev']).toBe('doom.wad');
    expect(invariants.vanilla_developer_mode_parameter_to_dev_data_basename['-comdev']).toBe('doom2.wad');
    expect(invariants.vanilla_dash_iwad_flag_recognised_by_vanilla).toBe(false);
    expect(invariants.vanilla_dash_file_flag_changes_game_mode).toBe(false);

    expect(invariants.shareware_higher_priority_candidate_count).toBe(6);
    expect(invariants.shareware_local_drop_directory_count).toBe(2);
    expect([...invariants.shareware_local_drop_directories_sorted]).toEqual([...EXPECTED_SHAREWARE_LOCAL_DROP_DIRECTORIES]);
    expectAsciiSorted(invariants.shareware_local_drop_directories_sorted);
    expect(invariants.shareware_local_drop_path_count).toBe(2);
    expect([...invariants.shareware_local_drop_paths_sorted]).toEqual([...EXPECTED_SHAREWARE_LOCAL_DROP_PATHS]);
    expectAsciiSorted(invariants.shareware_local_drop_paths_sorted);

    expect(invariants.playable_default_local_iwad_path).toBe('doom\\DOOM1.WAD');
    expect(invariants.playable_command_line_parameter).toBe('--iwad');
    expect(invariants.playable_default_iwad_provider).toBe('Bun.file().exists()');
    expect(invariants.playable_product_runtime_command).toBe('bun run doom.ts');
    expect(invariants.playable_legacy_package_start_script).toBe('bun run src/main.ts');
    expect(invariants.playable_missing_iwad_message_header).toBe('Missing IWAD file for playable launch.');
    expect(invariants.playable_missing_iwad_failure_kind).toBe('missing-iwad');
    expect(invariants.playable_verify_step_identifier).toBe('14-003');
    expect(invariants.notes.length).toBeGreaterThan(0);

    const candidateScanText = readFileSync('src/bootstrap/implement-iwad-discovery-order.ts', 'utf8');
    for (const candidateBasename of invariants.vanilla_candidate_basenames_in_probe_order) {
      expect(candidateScanText).toContain(`'${candidateBasename}'`);
    }
    expect(candidateScanText).toContain(`VANILLA_DEFAULT_SEARCH_DIRECTORY = '${invariants.vanilla_default_search_directory}'`);

    const developerModeText = readFileSync('src/bootstrap/implement-user-supplied-iwad-selection.ts', 'utf8');
    for (const developerParameterName of invariants.vanilla_developer_mode_parameters_in_probe_order) {
      expect(developerModeText).toContain(`'${developerParameterName}'`);
    }
    expect(developerModeText).toContain(`VANILLA_DEVELOPER_MODE_PARAMETER_COUNT = ${invariants.vanilla_developer_mode_parameter_count}`);
    expect(developerModeText).toContain(`VANILLA_NONEXISTENT_DASH_IWAD_PARAMETER_NAME = '-iwad'`);
    expect(developerModeText).toContain(`VANILLA_DASH_FILE_PARAMETER_NAME = '-file'`);

    const sharewareDefaultPathText = readFileSync('src/bootstrap/implement-local-shareware-iwad-default-path.ts', 'utf8');
    expect(sharewareDefaultPathText).toContain(`VANILLA_SHAREWARE_IWAD_HIGHER_PRIORITY_CANDIDATE_COUNT = ${invariants.shareware_higher_priority_candidate_count}`);

    const playableRuntimeText = readFileSync('src/playable/bun-runtime-entry-point/implementIwadDiscovery.ts', 'utf8');
    expect(playableRuntimeText).toContain(`DEFAULT_LOCAL_IWAD_PATH = '${invariants.playable_default_local_iwad_path.replace(/\\/g, '\\\\')}'`);
    expect(playableRuntimeText).toContain(`commandLineParameter: '${invariants.playable_command_line_parameter}'`);

    const playableMissingErrorText = readFileSync('src/playable/bun-runtime-entry-point/implementMissingIwadError.ts', 'utf8');
    expect(playableMissingErrorText).toContain(`messageHeader: '${invariants.playable_missing_iwad_message_header}'`);
    expect(playableMissingErrorText).toContain(`failureKind: '${invariants.playable_missing_iwad_failure_kind}'`);

    const playableLaunchText = readFileSync('src/playable/bun-launch-local-distribution-boundary/verifyIwadDiscoveryAtLaunch.ts', 'utf8');
    expect(playableLaunchText).toContain(`PRODUCT_RUNTIME_COMMAND = '${invariants.playable_product_runtime_command}'`);
    expect(playableLaunchText).toContain(`LEGACY_PACKAGE_START_SCRIPT = '${invariants.playable_legacy_package_start_script}'`);
    expect(playableLaunchText).toContain(`stepIdentifier: '${invariants.playable_verify_step_identifier}'`);
  });

  test('inventory hash_evidence_invariants pin the three shareware-target SHA-256 hashes and match the plan-level pin documents', async () => {
    const inventory = await loadInventoryDocument();
    const invariants = inventory.hash_evidence_invariants;
    expect(invariants.shareware_iwad_filename).toBe('DOOM1.WAD');
    expect(invariants.shareware_iwad_sha256_uppercase).toBe('1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771');
    expect(UPPERCASE_SHA256_REGEX.test(invariants.shareware_iwad_sha256_uppercase)).toBe(true);
    expect(invariants.shareware_iwad_byte_size).toBe(4196020);
    expect(invariants.shareware_iwad_lump_count).toBe(1264);
    expect(invariants.shareware_dos_executable_filename).toBe('DOOMD.EXE');
    expect(invariants.shareware_dos_executable_sha256_uppercase).toBe('9D3216605417888D5A699FA3794E46638EB4CB8634501AE748D74F9C2CFAE37B');
    expect(UPPERCASE_SHA256_REGEX.test(invariants.shareware_dos_executable_sha256_uppercase)).toBe(true);
    expect(invariants.shareware_dos_executable_byte_size).toBe(709753);
    expect(invariants.shareware_windows_executable_filename).toBe('DOOM.EXE');
    expect(invariants.shareware_windows_executable_sha256_uppercase).toBe('5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2');
    expect(UPPERCASE_SHA256_REGEX.test(invariants.shareware_windows_executable_sha256_uppercase)).toBe(true);
    expect(invariants.shareware_windows_executable_byte_size).toBe(1893888);
    expect(invariants.shareware_executable_hashes_distinct).toBe(true);
    expect(invariants.shareware_executable_versus_iwad_hashes_distinct).toBe(true);
    expect(invariants.shareware_dos_executable_sha256_uppercase).not.toBe(invariants.shareware_windows_executable_sha256_uppercase);
    expect(invariants.shareware_iwad_sha256_uppercase).not.toBe(invariants.shareware_dos_executable_sha256_uppercase);
    expect(invariants.shareware_iwad_sha256_uppercase).not.toBe(invariants.shareware_windows_executable_sha256_uppercase);
    expect(invariants.uppercase_sha256_hex_length).toBe(64);
    expect(invariants.registered_iwad_sha256_pinned).toBe(false);
    expect(invariants.ultimate_iwad_sha256_pinned).toBe(false);
    expect(invariants.supplied_iwad_filename).toBe('DOOM.WAD');
    expect([...invariants.supplied_iwad_relative_paths_sorted]).toEqual([...EXPECTED_SUPPLIED_IWAD_RELATIVE_PATHS]);
    expectAsciiSorted(invariants.supplied_iwad_relative_paths_sorted);
    expect(invariants.shareware_target_evidence_locations_sorted.length).toBeGreaterThan(0);
    expectAsciiSorted(invariants.shareware_target_evidence_locations_sorted);
    expect(invariants.notes.length).toBeGreaterThan(0);

    const sharewarePinText = readFileSync('plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md', 'utf8');
    expect(sharewarePinText).toContain(invariants.shareware_iwad_sha256_uppercase);
    expect(sharewarePinText).toContain(invariants.shareware_dos_executable_sha256_uppercase);
    expect(sharewarePinText).toContain(invariants.shareware_windows_executable_sha256_uppercase);
    expect(sharewarePinText).toContain(`${invariants.shareware_iwad_byte_size}`);
    expect(sharewarePinText).toContain(`${invariants.shareware_dos_executable_byte_size}`);
    expect(sharewarePinText).toContain(`${invariants.shareware_windows_executable_byte_size}`);
    expect(sharewarePinText).toContain(invariants.shareware_iwad_filename);
    expect(sharewarePinText).toContain(invariants.shareware_dos_executable_filename);
    expect(sharewarePinText).toContain(invariants.shareware_windows_executable_filename);

    const userSuppliedPinText = readFileSync('plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md', 'utf8');
    expect(userSuppliedPinText).toContain(invariants.supplied_iwad_filename);
    for (const suppliedRelativePath of invariants.supplied_iwad_relative_paths_sorted) {
      expect(userSuppliedPinText).toContain(suppliedRelativePath);
    }
  });

  test('inventory plan_hash_evidence_documents shareware entry pins the canonical IWAD identity', async () => {
    const inventory = await loadInventoryDocument();
    const sharewareEntry = inventory.plan_hash_evidence_documents.find((entry) => entry.relative_path === 'plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md');
    expect(sharewareEntry).toBeDefined();
    expect(sharewareEntry!.group).toBe('shareware_primary_target_hash_evidence');
    const sharewareSpecificEntry = sharewareEntry as InventoryPlanHashEvidenceDocument & {
      readonly shareware_iwad_filename: string;
      readonly shareware_iwad_sha256_uppercase: string;
      readonly shareware_iwad_byte_size: number;
      readonly shareware_iwad_lump_count: number;
      readonly shareware_iwad_relative_paths_sorted: readonly string[];
    };
    expect(sharewareSpecificEntry.shareware_iwad_filename).toBe('DOOM1.WAD');
    expect(UPPERCASE_SHA256_REGEX.test(sharewareSpecificEntry.shareware_iwad_sha256_uppercase)).toBe(true);
    expect(sharewareSpecificEntry.shareware_iwad_byte_size).toBe(4196020);
    expect(sharewareSpecificEntry.shareware_iwad_lump_count).toBe(1264);
    expect([...sharewareSpecificEntry.shareware_iwad_relative_paths_sorted]).toEqual([...EXPECTED_SHAREWARE_LOCAL_DROP_PATHS]);
  });

  test('inventory plan_hash_evidence_documents user-supplied entry pins no IWAD SHA-256 fingerprint', async () => {
    const inventory = await loadInventoryDocument();
    const userSuppliedEntry = inventory.plan_hash_evidence_documents.find((entry) => entry.relative_path === 'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md');
    expect(userSuppliedEntry).toBeDefined();
    expect(userSuppliedEntry!.group).toBe('user_supplied_iwad_search_scope');
    const userSuppliedSpecificEntry = userSuppliedEntry as InventoryPlanHashEvidenceDocument & {
      readonly supplied_iwad_filename: string;
      readonly supplied_iwad_relative_paths_sorted: readonly string[];
      readonly registered_game_mode: string;
      readonly registered_game_version: string;
      readonly registered_episode_count: number;
      readonly ultimate_game_mode: string;
      readonly ultimate_game_version: string;
      readonly ultimate_episode_count: number;
      readonly supplied_iwad_sha256_pinned: boolean;
    };
    expect(userSuppliedSpecificEntry.supplied_iwad_filename).toBe('DOOM.WAD');
    expect([...userSuppliedSpecificEntry.supplied_iwad_relative_paths_sorted]).toEqual([...EXPECTED_SUPPLIED_IWAD_RELATIVE_PATHS]);
    expect(userSuppliedSpecificEntry.registered_game_mode).toBe('registered');
    expect(userSuppliedSpecificEntry.registered_game_version).toBe('exe_doom_1_9');
    expect(userSuppliedSpecificEntry.registered_episode_count).toBe(3);
    expect(userSuppliedSpecificEntry.ultimate_game_mode).toBe('retail');
    expect(userSuppliedSpecificEntry.ultimate_game_version).toBe('exe_ultimate');
    expect(userSuppliedSpecificEntry.ultimate_episode_count).toBe(4);
    expect(userSuppliedSpecificEntry.supplied_iwad_sha256_pinned).toBe(false);
  });

  test('inventory boundary_status records the source-only no-proprietary-bytes contract and excludes the doom/ and iwad/ directories', async () => {
    const inventory = await loadInventoryDocument();
    const boundary = inventory.boundary_status;
    expect(boundary.src_bootstrap_relative_path).toBe(SRC_BOOTSTRAP_RELATIVE_PATH);
    expect(boundary.src_playable_runtime_entry_point_relative_path).toBe(SRC_PLAYABLE_RUNTIME_ENTRY_POINT_RELATIVE_PATH);
    expect(boundary.src_playable_launch_distribution_boundary_relative_path).toBe(SRC_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_RELATIVE_PATH);
    expect(boundary.plan_vanilla_parity_relative_path).toBe(PLAN_VANILLA_PARITY_RELATIVE_PATH);
    expect(boundary.doom_bundle_directory_intentionally_excluded).toBe(true);
    expect(boundary.doom_bundle_directory_relative_path).toBe('doom/');
    expect(boundary.iwad_drop_directory_intentionally_excluded).toBe(true);
    expect(boundary.iwad_drop_directory_relative_path).toBe('iwad/');
    expect(boundary.writable_workspace_for_inventoried_paths).toBe(true);
    expect(boundary.source_only_metadata).toBe(true);
    expect(boundary.no_proprietary_bytes_embedded).toBe(true);
    expect(boundary.all_proprietary_files_referenced_by_filename_only).toBe(true);
    expect(boundary.shareware_iwad_path_separator_is_backslash_on_windows_only).toBe(true);
    expect(boundary.notes.length).toBeGreaterThan(0);

    expect(existsSync(SRC_BOOTSTRAP_RELATIVE_PATH)).toBe(true);
    expect(existsSync(SRC_PLAYABLE_RUNTIME_ENTRY_POINT_RELATIVE_PATH)).toBe(true);
    expect(existsSync(SRC_PLAYABLE_LAUNCH_DISTRIBUTION_BOUNDARY_RELATIVE_PATH)).toBe(true);
    expect(existsSync(PLAN_VANILLA_PARITY_RELATIVE_PATH)).toBe(true);
  });

  test('inventory implications mention the audited declarations and the cross-reference contract', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.implications.length).toBeGreaterThan(0);
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain('IdentifyVersion');
    expect(concatenatedImplications).toContain('VANILLA_IWAD_DISCOVERY_PROBES');
    expect(concatenatedImplications).toContain('VANILLA_IWAD_CANDIDATES');
    expect(concatenatedImplications).toContain('DOOM1.WAD');
    expect(concatenatedImplications).toContain('DEFAULT_LOCAL_IWAD_PATH');
    expect(concatenatedImplications).toContain('createMissingIwadError');
    expect(concatenatedImplications).toContain('verifyIwadDiscoveryAtLaunch');
    expect(concatenatedImplications).toContain('1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771');
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
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-iwad-search-and-hash-evidence.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: a fabricated source module sha256 with a bogus value would not match the on-disk file', async () => {
    const inventory = await loadInventoryDocument();
    const firstEntry = inventory.source_modules[0]!;
    const fabricatedSha256 = '0'.repeat(64);
    expect(firstEntry.sha256).not.toBe(fabricatedSha256);
    expect(firstEntry.sha256).toBe(computeSha256(firstEntry.relative_path));
  });

  test('failure mode: a fabricated vanilla candidate count that disagrees with the pinned 7 would fail the IdentifyVersion invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedCount = 99;
    expect(inventory.iwad_search_invariants.vanilla_candidate_count).not.toBe(fabricatedCount);
    expect(inventory.iwad_search_invariants.vanilla_candidate_count).toBe(7);
    expect(inventory.iwad_search_invariants.vanilla_candidate_basenames_in_probe_order.length).toBe(inventory.iwad_search_invariants.vanilla_candidate_count);
  });

  test('failure mode: a fabricated developer-mode parameter count that disagrees with the pinned 3 would fail the user-supplied IWAD invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedCount = 99;
    expect(inventory.iwad_search_invariants.vanilla_developer_mode_parameter_count).not.toBe(fabricatedCount);
    expect(inventory.iwad_search_invariants.vanilla_developer_mode_parameter_count).toBe(3);
    expect(inventory.iwad_search_invariants.vanilla_developer_mode_parameters_in_probe_order.length).toBe(inventory.iwad_search_invariants.vanilla_developer_mode_parameter_count);
  });

  test('failure mode: a fabricated shareware IWAD SHA-256 that disagrees with the pinned hash would fail the hash evidence invariant', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedSha256 = 'F'.repeat(64);
    expect(inventory.hash_evidence_invariants.shareware_iwad_sha256_uppercase).not.toBe(fabricatedSha256);
    expect(inventory.hash_evidence_invariants.shareware_iwad_sha256_uppercase).toBe('1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771');
  });
});
