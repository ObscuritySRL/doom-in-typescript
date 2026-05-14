import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

interface InventoryGapCategory {
  readonly stepId: string;
  readonly title: string;
  readonly inventoryPath: string;
  readonly statusPath: string;
  readonly evidencePath: string;
  readonly progressPath: string;
}

const REQUIRED_GAP_CATEGORIES: readonly InventoryGapCategory[] = Object.freeze([
  {
    evidencePath: 'plan_final/evidence/01-001.json',
    inventoryPath: 'plan_final/current-state/root-entrypoints.json',
    progressPath: 'plan_final/progress/current-state/01-001.md',
    statusPath: 'plan_final/status/01-001.json',
    stepId: '01-001',
    title: 'inventory-root-entrypoints',
  },
  {
    evidencePath: 'plan_final/evidence/01-002.json',
    inventoryPath: 'plan_final/current-state/simplified-launcher-imports.json',
    progressPath: 'plan_final/progress/current-state/01-002.md',
    statusPath: 'plan_final/status/01-002.json',
    stepId: '01-002',
    title: 'inventory-simplified-launcher-imports',
  },
  {
    evidencePath: 'plan_final/evidence/01-003.json',
    inventoryPath: 'plan_final/current-state/pending-oracle-fixtures.json',
    progressPath: 'plan_final/progress/current-state/01-003.md',
    statusPath: 'plan_final/status/01-003.json',
    stepId: '01-003',
    title: 'inventory-pending-oracle-fixtures',
  },
  {
    evidencePath: 'plan_final/evidence/01-004.json',
    inventoryPath: 'plan_final/current-state/runtime-implementation-modules.json',
    progressPath: 'plan_final/progress/current-state/01-004.md',
    statusPath: 'plan_final/status/01-004.json',
    stepId: '01-004',
    title: 'inventory-runtime-implementation-modules',
  },
  {
    evidencePath: 'plan_final/evidence/01-005.json',
    inventoryPath: 'plan_final/current-state/unwired-ui-systems.json',
    progressPath: 'plan_final/progress/current-state/01-005.md',
    statusPath: 'plan_final/status/01-005.json',
    stepId: '01-005',
    title: 'inventory-unwired-ui-systems',
  },
  {
    evidencePath: 'plan_final/evidence/01-006.json',
    inventoryPath: 'plan_final/current-state/unwired-player-systems.json',
    progressPath: 'plan_final/progress/current-state/01-006.md',
    statusPath: 'plan_final/status/01-006.json',
    stepId: '01-006',
    title: 'inventory-unwired-player-systems',
  },
  {
    evidencePath: 'plan_final/evidence/01-007.json',
    inventoryPath: 'plan_final/current-state/unwired-ai-specials.json',
    progressPath: 'plan_final/progress/current-state/01-007.md',
    statusPath: 'plan_final/status/01-007.json',
    stepId: '01-007',
    title: 'inventory-unwired-ai-specials',
  },
  {
    evidencePath: 'plan_final/evidence/01-008.json',
    inventoryPath: 'plan_final/current-state/unwired-audio-systems.json',
    progressPath: 'plan_final/progress/current-state/01-008.md',
    statusPath: 'plan_final/status/01-008.json',
    stepId: '01-008',
    title: 'inventory-unwired-audio-systems',
  },
  {
    evidencePath: 'plan_final/evidence/01-009.json',
    inventoryPath: 'plan_final/current-state/weak-acceptance-tests.json',
    progressPath: 'plan_final/progress/current-state/01-009.md',
    statusPath: 'plan_final/status/01-009.json',
    stepId: '01-009',
    title: 'inventory-weak-acceptance-tests',
  },
]);

interface InventoryDocument {
  readonly id?: unknown;
  readonly stepId?: unknown;
  readonly step_id?: unknown;
  readonly lane?: unknown;
  readonly title?: unknown;
  readonly captured_at_utc?: unknown;
  readonly capturedAtUtc?: unknown;
  readonly repository_root?: unknown;
  readonly repositoryRoot?: unknown;
}

interface StatusDocument {
  readonly stepId?: unknown;
  readonly step_id?: unknown;
  readonly id?: unknown;
  readonly status?: unknown;
}

function readInventory(path: string): InventoryDocument {
  return JSON.parse(readFileSync(path, 'utf8')) as InventoryDocument;
}

function readStatus(path: string): StatusDocument {
  return JSON.parse(readFileSync(path, 'utf8')) as StatusDocument;
}

function normalizeStepId(document: InventoryDocument | StatusDocument): string {
  for (const candidate of [document.stepId, document.step_id, document.id]) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return '';
}

function normalizeCapturedAt(document: InventoryDocument): string {
  for (const candidate of [document.capturedAtUtc, document.captured_at_utc]) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return '';
}

function normalizeRepositoryRoot(document: InventoryDocument): string | null {
  for (const candidate of [document.repositoryRoot, document.repository_root]) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

describe('plan_final G1 current-state inventory gate', () => {
  test('every required gap category has an inventory JSON committed under plan_final/current-state/', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      expect(existsSync(category.inventoryPath)).toBe(true);
    }
  });

  test('every required gap category has a progress log committed under plan_final/progress/current-state/', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      expect(existsSync(category.progressPath)).toBe(true);
    }
  });

  test('every required gap category has an evidence JSON committed under plan_final/evidence/', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      expect(existsSync(category.evidencePath)).toBe(true);
    }
  });

  test('every required gap category has a status JSON committed under plan_final/status/', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      expect(existsSync(category.statusPath)).toBe(true);
    }
  });

  test('every required gap category inventory JSON parses without error', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      expect(() => readInventory(category.inventoryPath)).not.toThrow();
    }
  });

  test('every inventory JSON pins its canonical stepId', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      const inventory = readInventory(category.inventoryPath);
      expect(normalizeStepId(inventory)).toBe(category.stepId);
    }
  });

  test('every inventory JSON pins the canonical lane and title', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      const inventory = readInventory(category.inventoryPath);
      expect(inventory.lane).toBe('current-state');
      expect(inventory.title).toBe(category.title);
    }
  });

  test('every inventory JSON records a parseable UTC capture timestamp', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      const inventory = readInventory(category.inventoryPath);
      const capturedAt = normalizeCapturedAt(inventory);
      expect(capturedAt.endsWith('Z')).toBe(true);
      expect(Number.isFinite(new Date(capturedAt).getTime())).toBe(true);
    }
  });

  test('every inventory JSON that records a repository_root pins the canonical value', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      const inventory = readInventory(category.inventoryPath);
      const repositoryRoot = normalizeRepositoryRoot(inventory);
      if (repositoryRoot === null) {
        continue;
      }

      expect(repositoryRoot).toBe('D:/Projects/doom-in-typescript');
    }
  });

  test('every required gap category status JSON reports COMPLETED', () => {
    for (const category of REQUIRED_GAP_CATEGORIES) {
      const status = readStatus(category.statusPath);
      expect(normalizeStepId(status)).toBe(category.stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });
});
