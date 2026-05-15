import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync } from 'node:fs';

const PREREQUISITE_STEP_IDS: readonly string[] = ['05-001', '05-002', '05-003', '05-004', '05-005', '05-006', '05-007'];

interface PrerequisiteStatus {
  readonly stepId: string;
  readonly status: string;
  readonly commitSha?: string;
}

interface PrerequisiteEvidence {
  readonly stepId: string;
  readonly knownFailures: readonly unknown[];
  readonly typecheck: string;
}

function readStatus(stepId: string): PrerequisiteStatus {
  const path = `plan_final/status/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-wad-assets: prerequisite status ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteStatus;
}

function readEvidence(stepId: string): PrerequisiteEvidence {
  const path = `plan_final/evidence/${stepId}.json`;
  if (!existsSync(path)) {
    throw new Error(`gate-wad-assets: prerequisite evidence ${path} is missing`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as PrerequisiteEvidence;
}

describe('plan_final wad: gate-wad-assets', () => {
  test('every wad-assets prerequisite (05-001..05-007) has a committed status JSON at plan_final/status/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/status/${stepId}.json`)).toBe(true);
    }
  });

  test('every wad-assets prerequisite status declares status="COMPLETED"', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(status.stepId).toBe(stepId);
      expect(status.status).toBe('COMPLETED');
    }
  });

  test('every wad-assets prerequisite status records a non-empty commitSha (proof the work was pushed)', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const status = readStatus(stepId);
      expect(typeof status.commitSha).toBe('string');
      expect((status.commitSha ?? '').length).toBeGreaterThanOrEqual(7);
    }
  });

  test('every wad-assets prerequisite evidence JSON exists at plan_final/evidence/<id>.json', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      expect(existsSync(`plan_final/evidence/${stepId}.json`)).toBe(true);
    }
  });

  test('every wad-assets prerequisite evidence declares zero knownFailures and a clean typecheck', () => {
    for (const stepId of PREREQUISITE_STEP_IDS) {
      const evidence = readEvidence(stepId);
      expect(evidence.stepId).toBe(stepId);
      expect(evidence.knownFailures.length).toBe(0);
      expect(evidence.typecheck).toBe('clean');
    }
  });

  test('every prerequisite source wrapper module exists under src/vanilla/ or src/assets/ (the wad-assets lane write lock)', () => {
    const expectedSrcPaths: readonly string[] = [
      'src/vanilla/iwadResourceCache.ts',
      'src/vanilla/paletteAndColormap.ts',
      'src/vanilla/texturesAndFlats.ts',
      'src/vanilla/uiPatchAssets.ts',
      'src/assets/wireSpriteFrameCacheFromIwadResourceCache.ts',
      'src/vanilla/soundAndMusicAssets.ts',
      'src/vanilla/demoAndMapAssets.ts',
    ];
    for (const sourcePath of expectedSrcPaths) {
      expect(existsSync(sourcePath)).toBe(true);
    }
  });

  test('every wad-assets prerequisite focused test exists under test/plan_final/wad/', () => {
    const expectedTestPaths: readonly string[] = [
      'test/plan_final/wad/wire-iwad-resource-cache.test.ts',
      'test/plan_final/wad/wire-playpal-colormap.test.ts',
      'test/plan_final/wad/wire-textures-flats-patches.test.ts',
      'test/plan_final/wad/wire-ui-patch-assets.test.ts',
      'test/plan_final/wad/wire-sprite-assets.test.ts',
      'test/plan_final/wad/wire-sound-and-music-assets.test.ts',
      'test/plan_final/wad/wire-demo-and-map-assets.test.ts',
    ];
    for (const testPath of expectedTestPaths) {
      expect(existsSync(testPath)).toBe(true);
    }
  });
});
