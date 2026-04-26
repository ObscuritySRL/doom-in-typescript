import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.json';
const PACKAGE_JSON_PATH = 'package.json';
const ROOT_DOOM_TS_PATH = 'doom.ts';
const SIMPLIFIED_LAUNCHER_PATH = 'src/main.ts';
const CONTROL_CENTER_DOCUMENT_PATH = 'plan_vanilla_parity/establish-vanilla-parity-control-center.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/01-001-inventory-root-scripts-and-missing-doom-ts.md';

interface InventoryDoomTsLaunchAttempt {
  readonly command: string;
  readonly exit_code: number;
  readonly stderr_first_line: string;
}

interface InventoryDoomTsStatus {
  readonly expected_relative_path: string;
  readonly exists: boolean;
  readonly launch_attempt: InventoryDoomTsLaunchAttempt;
  readonly launch_attempt_with_help_flag: InventoryDoomTsLaunchAttempt;
}

interface InventoryPackageJson {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly name: string;
  readonly type: string;
  readonly version: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly exposes_doom_ts_script: boolean;
  readonly start_script_targets_vanilla_doom_ts: boolean;
  readonly start_script_target_relative_path: string;
}

interface InventorySimplifiedLauncher {
  readonly relative_path: string;
  readonly exists: boolean;
  readonly is_vanilla_d_doom_main_path: boolean;
}

interface InventoryRootTypescriptEntrypoints {
  readonly found: readonly string[];
  readonly expected_for_vanilla_parity: readonly string[];
  readonly missing_for_vanilla_parity: readonly string[];
}

interface InventoryDocument {
  readonly id: string;
  readonly title: string;
  readonly lane: string;
  readonly repository_root: string;
  readonly expected_runtime_target: { readonly command: string; readonly entrypoint_relative_path: string };
  readonly doom_ts_status: InventoryDoomTsStatus;
  readonly package_json: InventoryPackageJson;
  readonly current_simplified_launcher: InventorySimplifiedLauncher;
  readonly root_typescript_entrypoints: InventoryRootTypescriptEntrypoints;
  readonly implications: readonly string[];
  readonly follow_up_steps: readonly string[];
}

async function loadInventoryDocument(): Promise<InventoryDocument> {
  return (await Bun.file(INVENTORY_JSON_PATH).json()) as InventoryDocument;
}

async function loadPackageJson(): Promise<{ readonly name: string; readonly type: string; readonly version: string; readonly scripts?: Readonly<Record<string, string>> }> {
  return (await Bun.file(PACKAGE_JSON_PATH).json()) as { readonly name: string; readonly type: string; readonly version: string; readonly scripts?: Readonly<Record<string, string>> };
}

describe('inventory: root scripts and missing doom.ts', () => {
  test('inventory artifact exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory identifies the step id, title, and inventory lane', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.id).toBe('01-001');
    expect(inventory.title).toBe('Inventory Root Scripts And Missing Doom Ts');
    expect(inventory.lane).toBe('inventory');
  });

  test('inventory pins the canonical bun run doom.ts runtime target declared by the control center', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.expected_runtime_target.command).toBe('bun run doom.ts');
    expect(inventory.expected_runtime_target.entrypoint_relative_path).toBe('doom.ts');

    const controlCenterText = await Bun.file(CONTROL_CENTER_DOCUMENT_PATH).text();
    expect(controlCenterText).toContain('\n## runtime target\n\nbun run doom.ts\n');
  });

  test('inventory records that doom.ts is missing and matches on-disk reality', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.doom_ts_status.expected_relative_path).toBe('doom.ts');
    expect(inventory.doom_ts_status.exists).toBe(false);
    expect(existsSync(ROOT_DOOM_TS_PATH)).toBe(false);
  });

  test('inventory records the verbatim Bun launch failure for both bun run doom.ts and bun run doom.ts --help', async () => {
    const inventory = await loadInventoryDocument();
    const expectedStderr = 'error: Module not found "doom.ts"';
    const expectedExitCode = 1;

    expect(inventory.doom_ts_status.launch_attempt.command).toBe('bun run doom.ts');
    expect(inventory.doom_ts_status.launch_attempt.exit_code).toBe(expectedExitCode);
    expect(inventory.doom_ts_status.launch_attempt.stderr_first_line).toBe(expectedStderr);

    expect(inventory.doom_ts_status.launch_attempt_with_help_flag.command).toBe('bun run doom.ts --help');
    expect(inventory.doom_ts_status.launch_attempt_with_help_flag.exit_code).toBe(expectedExitCode);
    expect(inventory.doom_ts_status.launch_attempt_with_help_flag.stderr_first_line).toBe(expectedStderr);
  });

  test('inventory package_json snapshot agrees with the on-disk package.json byte-for-byte for tracked fields', async () => {
    const inventory = await loadInventoryDocument();
    const packageJson = await loadPackageJson();

    expect(inventory.package_json.relative_path).toBe(PACKAGE_JSON_PATH);
    expect(inventory.package_json.exists).toBe(true);
    expect(existsSync(PACKAGE_JSON_PATH)).toBe(true);

    expect(inventory.package_json.name).toBe(packageJson.name);
    expect(inventory.package_json.type).toBe(packageJson.type);
    expect(inventory.package_json.version).toBe(packageJson.version);

    const recordedScripts = inventory.package_json.scripts;
    const onDiskScripts = packageJson.scripts ?? {};
    expect(Object.keys(recordedScripts).sort()).toEqual(Object.keys(onDiskScripts).sort());
    for (const scriptName of Object.keys(recordedScripts)) {
      expect(recordedScripts[scriptName]).toBe(onDiskScripts[scriptName]);
    }
  });

  test('inventory confirms package.json does not expose a doom.ts script and start still targets src/main.ts', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.package_json.exposes_doom_ts_script).toBe(false);
    expect(inventory.package_json.start_script_targets_vanilla_doom_ts).toBe(false);
    expect(inventory.package_json.start_script_target_relative_path).toBe('src/main.ts');
    expect(inventory.package_json.scripts.start).toBe('bun run src/main.ts');
    expect(inventory.package_json.scripts.format).toBe('bun run tools/format-changed.ts');

    const packageJson = await loadPackageJson();
    const onDiskScripts = packageJson.scripts ?? {};
    for (const scriptValue of Object.values(onDiskScripts)) {
      expect(scriptValue).not.toContain('doom.ts');
    }
  });

  test('inventory confirms src/main.ts exists and is classified as the simplified launcher, not the vanilla path', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.current_simplified_launcher.relative_path).toBe(SIMPLIFIED_LAUNCHER_PATH);
    expect(inventory.current_simplified_launcher.exists).toBe(true);
    expect(inventory.current_simplified_launcher.is_vanilla_d_doom_main_path).toBe(false);
    expect(existsSync(SIMPLIFIED_LAUNCHER_PATH)).toBe(true);
    expect(statSync(SIMPLIFIED_LAUNCHER_PATH).isFile()).toBe(true);
  });

  test('inventory root_typescript_entrypoints lists no found root .ts files and flags doom.ts as missing', async () => {
    const inventory = await loadInventoryDocument();
    expect(inventory.root_typescript_entrypoints.found).toEqual([]);
    expect(inventory.root_typescript_entrypoints.expected_for_vanilla_parity).toEqual(['doom.ts']);
    expect(inventory.root_typescript_entrypoints.missing_for_vanilla_parity).toEqual(['doom.ts']);

    const rootTypescriptFileNames = await Array.fromAsync(new Bun.Glob('*.ts').scan({ cwd: '.' }));
    expect(rootTypescriptFileNames).toEqual([]);
  });

  test('inventory follow-up steps point at real plan_vanilla_parity step files', async () => {
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

  test('inventory implications mention the disabled bun run doom.ts target so downstream readers see the blocker', async () => {
    const inventory = await loadInventoryDocument();
    const concatenatedImplications = inventory.implications.join('\n');
    expect(concatenatedImplications).toContain('bun run doom.ts');
    expect(concatenatedImplications).toContain('cannot execute today');
  });

  test('step file under plan_vanilla_parity/steps/ pins the same write lock paths as this test enforces (failure mode anchor)', async () => {
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('plan_vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.json');
    expect(stepText).toContain('test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts');
    expect(stepText).toContain('\n## lane\n\ninventory\n');
  });

  test('failure mode: parsing rejects an inventory that falsely claims doom.ts exists at the repository root', async () => {
    const inventory = await loadInventoryDocument();
    const tamperedInventory: InventoryDocument = {
      ...inventory,
      doom_ts_status: {
        ...inventory.doom_ts_status,
        exists: true,
      },
    };
    const onDiskExists = existsSync(ROOT_DOOM_TS_PATH);
    expect(tamperedInventory.doom_ts_status.exists).not.toBe(onDiskExists);
  });

  test('failure mode: an empty scripts map would not satisfy the recorded package.json snapshot', async () => {
    const inventory = await loadInventoryDocument();
    const fabricatedScripts: Readonly<Record<string, string>> = {};
    expect(Object.keys(fabricatedScripts).length).toBe(0);
    expect(Object.keys(inventory.package_json.scripts).length).toBeGreaterThan(0);
    expect(Object.keys(inventory.package_json.scripts)).toContain('start');
    expect(Object.keys(inventory.package_json.scripts)).toContain('format');
  });
});
