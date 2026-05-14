import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

const INVENTORY_JSON_PATH = 'plan_final/current-state/simplified-launcher-imports.json';

interface ImportEdge {
  readonly kind: 'mixed' | 'type' | 'value';
  readonly module_path: string;
  readonly names: readonly string[];
}

interface FileEntry {
  readonly relative_path: string;
  readonly size_bytes: number;
  readonly line_count: number;
  readonly sha256: string;
  readonly imports: readonly ImportEdge[];
}

interface BypassSummary {
  readonly missing_vanilla_entrypoint_chain: readonly string[];
  readonly current_launch_runtime_path: string;
  readonly bypasses_vanilla_launch_path: boolean;
}

interface InventoryDocument {
  readonly step_id: string;
  readonly lane: string;
  readonly title: string;
  readonly captured_at_utc: string;
  readonly repository_root: string;
  readonly bypass_summary: BypassSummary;
  readonly files: readonly FileEntry[];
}

interface ParsedImport {
  readonly kind: 'mixed' | 'type' | 'value';
  readonly module_path: string;
  readonly names: readonly string[];
}

function readInventory(): InventoryDocument {
  return JSON.parse(readFileSync(INVENTORY_JSON_PATH, 'utf8')) as InventoryDocument;
}

function sha256Hex(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function lineCount(filePath: string): number {
  const content = readFileSync(filePath, 'utf8');

  if (content.length === 0) {
    return 0;
  }

  return content.endsWith('\n') ? content.split('\n').length - 1 : content.split('\n').length;
}

function parseImports(filePath: string): readonly ParsedImport[] {
  const sourceText = readFileSync(filePath, 'utf8');
  const importPattern = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)';/g;
  const sideEffectPattern = /import\s+'([^']+)';/g;
  const parsedImports: ParsedImport[] = [];

  for (const match of sourceText.matchAll(importPattern)) {
    const headerType = match[1] !== undefined;
    const namesBlock = match[2] ?? '';
    const modulePath = match[3] ?? '';
    const rawNames = namesBlock
      .split(',')
      .map((rawName) => rawName.trim())
      .filter((rawName) => rawName.length > 0);
    const hasInlineType = rawNames.some((rawName) => rawName.startsWith('type '));
    const normalizedNames = rawNames.map((rawName) => rawName.replace(/^type\s+/, '')).sort();
    const kind: 'mixed' | 'type' | 'value' = headerType ? 'type' : hasInlineType ? 'mixed' : 'value';

    parsedImports.push(Object.freeze({ kind, module_path: modulePath, names: Object.freeze(normalizedNames) }));
  }

  for (const match of sourceText.matchAll(sideEffectPattern)) {
    parsedImports.push(Object.freeze({ kind: 'value', module_path: match[1] ?? '', names: Object.freeze([]) }));
  }

  return Object.freeze(parsedImports);
}

function canonicaliseEdge(edge: ImportEdge | ParsedImport): string {
  return JSON.stringify({ kind: edge.kind, module_path: edge.module_path, names: [...edge.names].sort() });
}

describe('plan_final current-state: simplified launcher imports inventory', () => {
  test('inventory file exists at the canonical write-locked path', () => {
    expect(existsSync(INVENTORY_JSON_PATH)).toBe(true);
    expect(statSync(INVENTORY_JSON_PATH).isFile()).toBe(true);
  });

  test('inventory pins the canonical step id, lane, and title', () => {
    const inventory = readInventory();

    expect(inventory.step_id).toBe('01-002');
    expect(inventory.lane).toBe('current-state');
    expect(inventory.title).toBe('inventory-simplified-launcher-imports');
  });

  test('inventory captures a parseable UTC timestamp and the canonical repository root', () => {
    const inventory = readInventory();

    expect(inventory.captured_at_utc.endsWith('Z')).toBe(true);
    expect(Number.isFinite(new Date(inventory.captured_at_utc).getTime())).toBe(true);
    expect(inventory.repository_root).toBe('D:/Projects/doom-in-typescript');
  });

  test('inventory enumerates the five simplified-launcher entrypoint files in canonical order', () => {
    const inventory = readInventory();
    const observedPaths = inventory.files.map((fileEntry) => fileEntry.relative_path);

    expect(observedPaths).toEqual(['src/main.ts', 'src/launcher/gameplayAssets.ts', 'src/launcher/gameplayRenderer.ts', 'src/launcher/session.ts', 'src/launcher/win32.ts']);
  });

  test('every recorded file matches its on-disk size, line count, and sha256', () => {
    const inventory = readInventory();

    for (const fileEntry of inventory.files) {
      expect(existsSync(fileEntry.relative_path)).toBe(true);
      expect(statSync(fileEntry.relative_path).size).toBe(fileEntry.size_bytes);
      expect(lineCount(fileEntry.relative_path)).toBe(fileEntry.line_count);
      expect(sha256Hex(fileEntry.relative_path)).toBe(fileEntry.sha256);
    }
  });

  test('every recorded import edge round-trips with the on-disk file imports', () => {
    const inventory = readInventory();

    for (const fileEntry of inventory.files) {
      const observedImports = parseImports(fileEntry.relative_path);
      const recordedCanonicalSet = new Set(fileEntry.imports.map((edge) => canonicaliseEdge(edge)));
      const observedCanonicalSet = new Set(observedImports.map((edge) => canonicaliseEdge(edge)));

      expect([...recordedCanonicalSet].sort()).toEqual([...observedCanonicalSet].sort());
    }
  });

  test('bypass_summary names the missing vanilla doom.ts entrypoint chain and asserts the bypass flag', () => {
    const inventory = readInventory();

    expect(inventory.bypass_summary.bypasses_vanilla_launch_path).toBe(true);
    expect(inventory.bypass_summary.current_launch_runtime_path).toContain('src/main.ts');
    expect(inventory.bypass_summary.current_launch_runtime_path).toContain('runLauncherWindow');
    expect(inventory.bypass_summary.missing_vanilla_entrypoint_chain.length).toBeGreaterThan(0);
    expect(inventory.bypass_summary.missing_vanilla_entrypoint_chain.join('\n')).toContain('doom.ts');
    expect(inventory.bypass_summary.missing_vanilla_entrypoint_chain.join('\n')).toContain('D_DoomMain');
  });
});
