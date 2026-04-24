import { describe, expect, test } from 'bun:test';

import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';

type C1CompleteManifest = {
  c1: {
    acceptanceOracleId: string;
    compatibilityTarget: string;
    completedByStep: string;
    demoHashes: Array<{
      demo: string;
      map: string;
      sha256: string;
    }>;
    highTrustDependencyOracleIds: string[];
    mapSet: string[];
    sameOriginAudioHashes: string[];
    sharewareAttractSequence: string[];
    status: string;
    stepCount: number;
  };
  c2Open: {
    compatibilityTarget: string;
    iwad: string;
    newEpisodes: number[];
    prerequisiteTarget: string;
    status: string;
    totalMaps: number;
  };
  requiredOracleIds: string[];
  sideBySide: {
    executables: Array<{
      fileName: string;
      sha256: string;
    }>;
    sharedAnchorCount: number;
    sharedAnchorStrings: string[];
  };
  sourceFactIds: string[];
};

const manifestUrl = new URL('../../reference/manifests/c1-complete.json', import.meta.url);
const DOOM_EXE_PATH = `${REFERENCE_BUNDLE_PATH}\\DOOM.EXE`;
const DOOMD_EXE_PATH = `${REFERENCE_BUNDLE_PATH}\\DOOMD.EXE`;
const sha256Pattern = /^[0-9A-F]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== 'number') {
    throw new Error(`${label} must be a number`);
  }

  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }

  return value;
}

function expectStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be a string array`);
  }

  return value;
}

function expectNumberArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'number')) {
    throw new Error(`${label} must be a number array`);
  }

  return value;
}

function parseManifest(text: string): C1CompleteManifest {
  const manifestValue = JSON.parse(text) as unknown;
  const manifestRecord = expectRecord(manifestValue, 'manifest');
  const c1Record = expectRecord(manifestRecord.c1, 'manifest.c1');
  const c2OpenRecord = expectRecord(manifestRecord.c2Open, 'manifest.c2Open');
  const sideBySideRecord = expectRecord(manifestRecord.sideBySide, 'manifest.sideBySide');
  const demoHashesValue = c1Record.demoHashes;
  const executablesValue = sideBySideRecord.executables;

  if (!Array.isArray(demoHashesValue)) {
    throw new Error('manifest.c1.demoHashes must be an array');
  }

  if (!Array.isArray(executablesValue)) {
    throw new Error('manifest.sideBySide.executables must be an array');
  }

  return {
    c1: {
      acceptanceOracleId: expectString(c1Record.acceptanceOracleId, 'manifest.c1.acceptanceOracleId'),
      compatibilityTarget: expectString(c1Record.compatibilityTarget, 'manifest.c1.compatibilityTarget'),
      completedByStep: expectString(c1Record.completedByStep, 'manifest.c1.completedByStep'),
      demoHashes: demoHashesValue.map((value, index) => {
        const demoRecord = expectRecord(value, `manifest.c1.demoHashes[${index}]`);

        return {
          demo: expectString(demoRecord.demo, `manifest.c1.demoHashes[${index}].demo`),
          map: expectString(demoRecord.map, `manifest.c1.demoHashes[${index}].map`),
          sha256: expectString(demoRecord.sha256, `manifest.c1.demoHashes[${index}].sha256`),
        };
      }),
      highTrustDependencyOracleIds: expectStringArray(c1Record.highTrustDependencyOracleIds, 'manifest.c1.highTrustDependencyOracleIds'),
      mapSet: expectStringArray(c1Record.mapSet, 'manifest.c1.mapSet'),
      sameOriginAudioHashes: expectStringArray(c1Record.sameOriginAudioHashes, 'manifest.c1.sameOriginAudioHashes'),
      sharewareAttractSequence: expectStringArray(c1Record.sharewareAttractSequence, 'manifest.c1.sharewareAttractSequence'),
      status: expectString(c1Record.status, 'manifest.c1.status'),
      stepCount: expectNumber(c1Record.stepCount, 'manifest.c1.stepCount'),
    },
    c2Open: {
      compatibilityTarget: expectString(c2OpenRecord.compatibilityTarget, 'manifest.c2Open.compatibilityTarget'),
      iwad: expectString(c2OpenRecord.iwad, 'manifest.c2Open.iwad'),
      newEpisodes: expectNumberArray(c2OpenRecord.newEpisodes, 'manifest.c2Open.newEpisodes'),
      prerequisiteTarget: expectString(c2OpenRecord.prerequisiteTarget, 'manifest.c2Open.prerequisiteTarget'),
      status: expectString(c2OpenRecord.status, 'manifest.c2Open.status'),
      totalMaps: expectNumber(c2OpenRecord.totalMaps, 'manifest.c2Open.totalMaps'),
    },
    requiredOracleIds: expectStringArray(manifestRecord.requiredOracleIds, 'manifest.requiredOracleIds'),
    sideBySide: {
      executables: executablesValue.map((value, index) => {
        const executableRecord = expectRecord(value, `manifest.sideBySide.executables[${index}]`);

        return {
          fileName: expectString(executableRecord.fileName, `manifest.sideBySide.executables[${index}].fileName`),
          sha256: expectString(executableRecord.sha256, `manifest.sideBySide.executables[${index}].sha256`),
        };
      }),
      sharedAnchorCount: expectNumber(sideBySideRecord.sharedAnchorCount, 'manifest.sideBySide.sharedAnchorCount'),
      sharedAnchorStrings: expectStringArray(sideBySideRecord.sharedAnchorStrings, 'manifest.sideBySide.sharedAnchorStrings'),
    },
    sourceFactIds: expectStringArray(manifestRecord.sourceFactIds, 'manifest.sourceFactIds'),
  };
}

async function loadBinaryText(filePath: string): Promise<string> {
  const bytes = new Uint8Array(await Bun.file(filePath).arrayBuffer());

  return Buffer.from(bytes).toString('latin1');
}

async function loadManifest(): Promise<C1CompleteManifest> {
  const text = await Bun.file(manifestUrl).text();

  return parseManifest(text);
}

describe('17-010 side-by-side-final-gate-and-c2-open', () => {
  test('marks C1 complete and opens the registered C2 target', async () => {
    const manifest = await loadManifest();

    expect(manifest.c1.acceptanceOracleId).toBe('O-030');
    expect(manifest.c1.compatibilityTarget).toBe('C1');
    expect(manifest.c1.completedByStep).toBe('17-010');
    expect(manifest.c1.status).toBe('complete');
    expect(manifest.c1.stepCount).toBe(167);
    expect(manifest.c1.mapSet).toEqual(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9']);
    expect(manifest.c1.demoHashes).toEqual([
      {
        demo: 'DEMO1',
        map: 'E1M5',
        sha256: '4999C550517A7FD8B9AF32D14DFB0127B8F9B71433DEF6AC0EE34EAD3A67898F',
      },
      {
        demo: 'DEMO2',
        map: 'E1M3',
        sha256: '603B0BA73993197906480404135584699542A4FC0A6DBB6F7CEE3C33CDEB1FB5',
      },
      {
        demo: 'DEMO3',
        map: 'E1M7',
        sha256: '401E86077B4F39444175A4862C6CB4D2F1058B0A519FCEDE0FF58A602D2EE394',
      },
    ]);
    expect(manifest.c1.sameOriginAudioHashes).toEqual([
      'F28CF817003E5B0B2FF12121ACB2C8041643F254FDF7A7DF850BEE78FACC5D82',
      '685ECC911F6CA5504AFCAA0585EB6C498DE911E0389399DC77237CB5DB3FC037',
      '12E60E57A8B4BF8E87650B0267E755BF8F32EF2EB93F2426B08A286E64231E8E',
    ]);
    expect(manifest.c2Open).toEqual({
      compatibilityTarget: 'C2',
      iwad: 'DOOM.WAD',
      newEpisodes: [2, 3],
      prerequisiteTarget: 'C1',
      status: 'open',
      totalMaps: 27,
    });
  });

  test('pins the exact final high-trust oracle chain', async () => {
    const manifest = await loadManifest();

    expect(manifest.c1.highTrustDependencyOracleIds).toEqual(['O-022', 'O-023', 'O-024', 'O-025', 'O-026', 'O-027', 'O-028', 'O-029']);
    expect(manifest.requiredOracleIds).toEqual(['O-001', 'O-002', 'O-012', 'O-022', 'O-023', 'O-024', 'O-025', 'O-026', 'O-027', 'O-028', 'O-029', 'O-030']);
    expect(manifest.sourceFactIds).toEqual(['F-003', 'F-004', 'F-025', 'F-029', 'F-030', 'F-181', 'F-190', 'F-195']);
    for (const sha256 of [...manifest.c1.demoHashes.map((entry) => entry.sha256), ...manifest.sideBySide.executables.map((entry) => entry.sha256)]) {
      expect(sha256Pattern.test(sha256)).toBe(true);
    }
  });

  test('verifies the shared DOS anchor set side by side in DOOM.EXE and DOOMD.EXE', async () => {
    const manifest = await loadManifest();
    const [doomExeText, doomdExeText] = await Promise.all([loadBinaryText(DOOM_EXE_PATH), loadBinaryText(DOOMD_EXE_PATH)]);

    expect(manifest.sideBySide.executables).toEqual([
      {
        fileName: 'DOOM.EXE',
        sha256: '5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2',
      },
      {
        fileName: 'DOOMD.EXE',
        sha256: '9D3216605417888D5A699FA3794E46638EB4CB8634501AE748D74F9C2CFAE37B',
      },
    ]);
    expect(manifest.sideBySide.sharedAnchorCount).toBe(manifest.sideBySide.sharedAnchorStrings.length);
    for (const anchor of manifest.sideBySide.sharedAnchorStrings) {
      expect(doomExeText.includes(anchor)).toBe(true);
      expect(doomdExeText.includes(anchor)).toBe(true);
    }
  });

  test('keeps the shareware-only HELP2 attract slot while opening C2 instead of jumping to retail', async () => {
    const manifest = await loadManifest();

    expect(manifest.c1.sharewareAttractSequence[4]).toBe('HELP2');
    expect(manifest.c2Open.compatibilityTarget).toBe('C2');
    expect(manifest.c2Open.totalMaps).toBe(27);
    expect(manifest.c2Open.newEpisodes).toEqual([2, 3]);
  });
});
