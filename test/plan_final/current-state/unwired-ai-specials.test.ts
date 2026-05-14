import { describe, expect, test } from 'bun:test';

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import unwiredAiSpecialsInventoryRaw from '../../../plan_final/current-state/unwired-ai-specials.json';

interface DirectoryClassification {
  readonly committed_files_sorted: readonly string[];
  readonly directory: string;
  readonly unwired_files_sorted: readonly string[];
  readonly wired_files_sorted: readonly string[];
}

interface UnwiredAiSpecialsInventory {
  readonly ai_directory_relative_path: string;
  readonly ai_modules: DirectoryClassification;
  readonly captured_at_utc: string;
  readonly evidence_method: string;
  readonly follow_up_steps: readonly string[];
  readonly id: string;
  readonly implications: readonly string[];
  readonly lane: string;
  readonly launcher_entry_files_sorted: readonly string[];
  readonly specials_directory_relative_path: string;
  readonly specials_modules: DirectoryClassification;
  readonly title: string;
  readonly total_ai_module_count: number;
  readonly total_specials_module_count: number;
  readonly total_unwired_ai_module_count: number;
  readonly total_unwired_specials_module_count: number;
  readonly total_wired_ai_module_count: number;
  readonly total_wired_specials_module_count: number;
}

const unwiredAiSpecialsInventory: UnwiredAiSpecialsInventory = unwiredAiSpecialsInventoryRaw;

const LAUNCHER_ROOT_PATH = 'src/launcher/';
const AI_DIRECTORY_PATH = 'src/ai/';
const SPECIALS_DIRECTORY_PATH = 'src/specials/';

function listTypeScriptFilenames(directoryPath: string): readonly string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .sort();
}

function readRelativeImportTargets(filePath: string): readonly string[] {
  let fileText: string;
  try {
    fileText = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const importTargets: string[] = [];
  for (const match of fileText.matchAll(/^import\s+(?:type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm)) {
    const specifier = match[1]!;
    if (!specifier.startsWith('.')) {
      continue;
    }
    let resolvedPath = path.posix.normalize(path.posix.join(path.posix.dirname(filePath), specifier));
    if (!resolvedPath.endsWith('.ts')) {
      resolvedPath += '.ts';
    }
    importTargets.push(resolvedPath);
  }
  return importTargets;
}

function computeReachableFromLauncher(): ReadonlySet<string> {
  const launcherEntryFiles = listTypeScriptFilenames(LAUNCHER_ROOT_PATH).map((filename) => `${LAUNCHER_ROOT_PATH}${filename}`);
  const reachable = new Set<string>();
  const queue = [...launcherEntryFiles];
  while (queue.length > 0) {
    const currentFile = queue.shift()!;
    if (reachable.has(currentFile)) {
      continue;
    }
    reachable.add(currentFile);
    for (const importTarget of readRelativeImportTargets(currentFile)) {
      if (!reachable.has(importTarget)) {
        queue.push(importTarget);
      }
    }
  }
  return reachable;
}

describe('inventory: unwired ai/specials systems', () => {
  test('inventory pins the canonical id, title, and lane', () => {
    expect(unwiredAiSpecialsInventory.id).toBe('01-007');
    expect(unwiredAiSpecialsInventory.title).toBe('inventory-unwired-ai-specials');
    expect(unwiredAiSpecialsInventory.lane).toBe('current-state');
  });

  test('inventory captured_at_utc is a UTC ISO 8601 timestamp ending in Z', () => {
    expect(unwiredAiSpecialsInventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(unwiredAiSpecialsInventory.captured_at_utc).getTime())).toBe(true);
  });

  test('inventory launcher_entry_files_sorted matches a fresh on-disk listing of src/launcher/', () => {
    const freshLauncherEntries = listTypeScriptFilenames(LAUNCHER_ROOT_PATH).map((filename) => `${LAUNCHER_ROOT_PATH}${filename}`);
    expect([...unwiredAiSpecialsInventory.launcher_entry_files_sorted]).toEqual(freshLauncherEntries);
  });

  test('inventory ai/specials directory paths match the canonical read-only refs', () => {
    expect(unwiredAiSpecialsInventory.ai_directory_relative_path).toBe(AI_DIRECTORY_PATH);
    expect(unwiredAiSpecialsInventory.specials_directory_relative_path).toBe(SPECIALS_DIRECTORY_PATH);
  });

  test('ai_modules committed_files_sorted matches a fresh on-disk listing', () => {
    const freshAiFiles = listTypeScriptFilenames(AI_DIRECTORY_PATH).map((filename) => `${AI_DIRECTORY_PATH}${filename}`);
    expect([...unwiredAiSpecialsInventory.ai_modules.committed_files_sorted]).toEqual(freshAiFiles);
    expect(unwiredAiSpecialsInventory.total_ai_module_count).toBe(freshAiFiles.length);
  });

  test('specials_modules committed_files_sorted matches a fresh on-disk listing', () => {
    const freshSpecialsFiles = listTypeScriptFilenames(SPECIALS_DIRECTORY_PATH).map((filename) => `${SPECIALS_DIRECTORY_PATH}${filename}`);
    expect([...unwiredAiSpecialsInventory.specials_modules.committed_files_sorted]).toEqual(freshSpecialsFiles);
    expect(unwiredAiSpecialsInventory.total_specials_module_count).toBe(freshSpecialsFiles.length);
  });

  test('ai_modules unwired and wired partition the committed list exactly', () => {
    const wiredSet = new Set(unwiredAiSpecialsInventory.ai_modules.wired_files_sorted);
    const unwiredSet = new Set(unwiredAiSpecialsInventory.ai_modules.unwired_files_sorted);
    expect(unwiredAiSpecialsInventory.ai_modules.wired_files_sorted.length + unwiredAiSpecialsInventory.ai_modules.unwired_files_sorted.length).toBe(unwiredAiSpecialsInventory.ai_modules.committed_files_sorted.length);
    for (const filePath of unwiredAiSpecialsInventory.ai_modules.committed_files_sorted) {
      expect(wiredSet.has(filePath) !== unwiredSet.has(filePath)).toBe(true);
    }
  });

  test('specials_modules unwired and wired partition the committed list exactly', () => {
    const wiredSet = new Set(unwiredAiSpecialsInventory.specials_modules.wired_files_sorted);
    const unwiredSet = new Set(unwiredAiSpecialsInventory.specials_modules.unwired_files_sorted);
    expect(unwiredAiSpecialsInventory.specials_modules.wired_files_sorted.length + unwiredAiSpecialsInventory.specials_modules.unwired_files_sorted.length).toBe(unwiredAiSpecialsInventory.specials_modules.committed_files_sorted.length);
    for (const filePath of unwiredAiSpecialsInventory.specials_modules.committed_files_sorted) {
      expect(wiredSet.has(filePath) !== unwiredSet.has(filePath)).toBe(true);
    }
  });

  test('every ai unwired path is genuinely unreachable from the launcher transitive closure', () => {
    const reachable = computeReachableFromLauncher();
    for (const unwiredAiPath of unwiredAiSpecialsInventory.ai_modules.unwired_files_sorted) {
      expect(reachable.has(unwiredAiPath)).toBe(false);
    }
    for (const wiredAiPath of unwiredAiSpecialsInventory.ai_modules.wired_files_sorted) {
      expect(reachable.has(wiredAiPath)).toBe(true);
    }
  });

  test('every specials unwired path is genuinely unreachable from the launcher transitive closure', () => {
    const reachable = computeReachableFromLauncher();
    for (const unwiredSpecialsPath of unwiredAiSpecialsInventory.specials_modules.unwired_files_sorted) {
      expect(reachable.has(unwiredSpecialsPath)).toBe(false);
    }
    for (const wiredSpecialsPath of unwiredAiSpecialsInventory.specials_modules.wired_files_sorted) {
      expect(reachable.has(wiredSpecialsPath)).toBe(true);
    }
  });

  test('inventory implications and follow_up_steps are non-empty and reference plan_final lane step ids', () => {
    expect(unwiredAiSpecialsInventory.implications.length).toBeGreaterThan(0);
    expect(unwiredAiSpecialsInventory.follow_up_steps.length).toBeGreaterThan(0);
    for (const followUpStepId of unwiredAiSpecialsInventory.follow_up_steps) {
      expect(followUpStepId).toMatch(/^\d{2}-\d{3}$/);
    }
  });
});
