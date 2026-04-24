import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';

import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';

interface AcceptanceAudio {
  readonly musicDispatchCounts: readonly number[];
  readonly musicLump: string;
  readonly replacementHashes: readonly string[];
  readonly silentHash: string;
}

interface AcceptanceBinaryAnchors {
  readonly episodeMapTitles: readonly string[];
  readonly sharewareStrings: readonly string[];
}

interface AcceptanceMap {
  readonly lump: string;
  readonly prngIndex: number;
  readonly thinkerCount: number;
  readonly title: string;
}

interface AcceptanceOracleRecord {
  readonly artifactPath: string;
  readonly id: string;
  readonly trustLevel?: string;
}

interface AcceptanceDemoCoverage {
  readonly demoLump: string;
  readonly map: string;
  readonly streamSha256: string;
  readonly ticCount: number;
}

interface AcceptancePageDuration {
  readonly lump: string;
  readonly tics: number;
}

interface E1AcceptanceFixture {
  readonly audio: AcceptanceAudio;
  readonly binaryAnchors: AcceptanceBinaryAnchors;
  readonly episode: {
    readonly maps: readonly AcceptanceMap[];
  };
  readonly oracle: AcceptanceOracleRecord;
  readonly priorOracles: readonly AcceptanceOracleRecord[];
  readonly sharewareAttractLoop: {
    readonly demoCoverage: readonly AcceptanceDemoCoverage[];
    readonly pageDurations: readonly AcceptancePageDuration[];
    readonly sequence: readonly string[];
  };
  readonly version: number;
}

const expectedFixture = {
  audio: {
    musicDispatchCounts: [20, 1, 0, 0, 1, 0],
    musicLump: 'D_E1M1',
    replacementHashes: ['F28CF817003E5B0B2FF12121ACB2C8041643F254FDF7A7DF850BEE78FACC5D82', '685ECC911F6CA5504AFCAA0585EB6C498DE911E0389399DC77237CB5DB3FC037', '12E60E57A8B4BF8E87650B0267E755BF8F32EF2EB93F2426B08A286E64231E8E'],
    silentHash: '12E60E57A8B4BF8E87650B0267E755BF8F32EF2EB93F2426B08A286E64231E8E',
  },
  binaryAnchors: {
    episodeMapTitles: ['E1M1: Hangar', 'E1M2: Nuclear Plant', 'E1M3: Toxin Refinery', 'E1M4: Command Control', 'E1M5: Phobos Lab', 'E1M6: Central Processing', 'E1M7: Computer Station', 'E1M8: Phobos Anomaly', 'E1M9: Military Base'],
    sharewareStrings: [
      'TITLEPIC',
      'demo1',
      'CREDIT',
      'demo2',
      'HELP2',
      'demo3',
      'this is the shareware version of doom.',
      'High detail',
      'Low detail',
      'Messages OFF',
      'Messages ON',
      'press a key.',
      'Savegame buffer overrun',
      'game saved.',
    ],
  },
  episode: {
    maps: [
      {
        lump: 'E1M1',
        prngIndex: 92,
        thinkerCount: 92,
        title: 'Hangar',
      },
      {
        lump: 'E1M2',
        prngIndex: 200,
        thinkerCount: 200,
        title: 'Nuclear Plant',
      },
      {
        lump: 'E1M3',
        prngIndex: 54,
        thinkerCount: 310,
        title: 'Toxin Refinery',
      },
      {
        lump: 'E1M4',
        prngIndex: 201,
        thinkerCount: 201,
        title: 'Command Control',
      },
      {
        lump: 'E1M5',
        prngIndex: 216,
        thinkerCount: 216,
        title: 'Phobos Lab',
      },
      {
        lump: 'E1M6',
        prngIndex: 114,
        thinkerCount: 370,
        title: 'Central Processing',
      },
      {
        lump: 'E1M7',
        prngIndex: 11,
        thinkerCount: 267,
        title: 'Computer Station',
      },
      {
        lump: 'E1M8',
        prngIndex: 99,
        thinkerCount: 99,
        title: 'Phobos Anomaly',
      },
      {
        lump: 'E1M9',
        prngIndex: 192,
        thinkerCount: 192,
        title: 'Military Base',
      },
    ],
  },
  oracle: {
    artifactPath: 'd:\\Projects\\bun-win32\\doom_codex\\test\\parity\\fixtures\\e1Acceptance.json',
    id: 'O-030',
  },
  priorOracles: [
    {
      artifactPath: 'd:\\Projects\\bun-win32\\doom_codex\\test\\parity\\fixtures\\levelStartHashes.json',
      id: 'O-022',
      trustLevel: 'high',
    },
    {
      artifactPath: 'd:\\Projects\\bun-win32\\doom_codex\\test\\parity\\fixtures\\demoSync.json',
      id: 'O-023',
      trustLevel: 'high',
    },
    {
      artifactPath: 'd:\\Projects\\bun-win32\\doom_codex\\test\\parity\\fixtures\\scriptedMechanics.json',
      id: 'O-024',
      trustLevel: 'high',
    },
    {
      artifactPath: 'd:\\Projects\\bun-win32\\doom_codex\\test\\parity\\fixtures\\framebufferHashes.json',
      id: 'O-025',
      trustLevel: 'high',
    },
    {
      artifactPath: 'd:\\Projects\\bun-win32\\doom_codex\\test\\parity\\fixtures\\menuTiming.json',
      id: 'O-026',
      trustLevel: 'high',
    },
    {
      artifactPath: 'd:\\Projects\\bun-win32\\doom_codex\\test\\parity\\fixtures\\audioHashes.json',
      id: 'O-027',
      trustLevel: 'high',
    },
    {
      artifactPath: 'd:\\Projects\\bun-win32\\doom_codex\\test\\parity\\fixtures\\saveLoad.json',
      id: 'O-028',
      trustLevel: 'high',
    },
    {
      artifactPath: 'd:\\Projects\\bun-win32\\doom_codex\\test\\parity\\fixtures\\quirkCases.json',
      id: 'O-029',
      trustLevel: 'high',
    },
  ],
  sharewareAttractLoop: {
    demoCoverage: [
      {
        demoLump: 'DEMO1',
        map: 'E1M5',
        streamSha256: '4999C550517A7FD8B9AF32D14DFB0127B8F9B71433DEF6AC0EE34EAD3A67898F',
        ticCount: 5026,
      },
      {
        demoLump: 'DEMO2',
        map: 'E1M3',
        streamSha256: '603B0BA73993197906480404135584699542A4FC0A6DBB6F7CEE3C33CDEB1FB5',
        ticCount: 3836,
      },
      {
        demoLump: 'DEMO3',
        map: 'E1M7',
        streamSha256: '401E86077B4F39444175A4862C6CB4D2F1058B0A519FCEDE0FF58A602D2EE394',
        ticCount: 2134,
      },
    ],
    pageDurations: [
      {
        lump: 'TITLEPIC',
        tics: 170,
      },
      {
        lump: 'CREDIT',
        tics: 200,
      },
      {
        lump: 'HELP2',
        tics: 200,
      },
    ],
    sequence: ['TITLEPIC', 'demo1', 'CREDIT', 'demo2', 'HELP2', 'demo3'],
  },
  version: 1,
} satisfies E1AcceptanceFixture;

const fixtureUrl = new URL('./fixtures/e1Acceptance.json', import.meta.url);
const referenceOraclesUrl = new URL('../../plan_engine/REFERENCE_ORACLES.md', import.meta.url);
const DOOM_EXE_PATH = `${REFERENCE_BUNDLE_PATH}\\DOOM.EXE`;
const DOOMD_EXE_PATH = `${REFERENCE_BUNDLE_PATH}\\DOOMD.EXE`;

describe('full-shareware-e1-acceptance', () => {
  test('locks the integrated shareware E1 acceptance manifest', () => {
    const actualFixture: unknown = JSON.parse(readFileSync(fixtureUrl, 'utf8'));

    expect(actualFixture).toEqual(expectedFixture);
    expect(expectedFixture.episode.maps).toHaveLength(9);
    expect(expectedFixture.episode.maps.every(({ lump }) => /^E1M[1-9]$/.test(lump))).toBe(true);
    expect(expectedFixture.sharewareAttractLoop.sequence[4]).toBe('HELP2');
    expect(expectedFixture.sharewareAttractLoop.demoCoverage.map(({ map }) => map)).toEqual(['E1M5', 'E1M3', 'E1M7']);
  });

  test('cross-checks bundled DOS executables for shareware acceptance anchors', () => {
    const executableBuffers = [readFileSync(DOOM_EXE_PATH), readFileSync(DOOMD_EXE_PATH)];

    for (const executableBuffer of executableBuffers) {
      for (const sharewareString of expectedFixture.binaryAnchors.sharewareStrings) {
        expect(executableBuffer.includes(Buffer.from(sharewareString, 'ascii'))).toBe(true);
      }

      for (const episodeMapTitle of expectedFixture.binaryAnchors.episodeMapTitles) {
        expect(executableBuffer.includes(Buffer.from(episodeMapTitle, 'ascii'))).toBe(true);
      }
    }
  });

  test('requires the prior parity oracles and registers the integrated fixture oracle', () => {
    const referenceOracles = readFileSync(referenceOraclesUrl, 'utf8');

    for (const priorOracle of expectedFixture.priorOracles) {
      const escapedArtifactPath = priorOracle.artifactPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedOracleId = priorOracle.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const sectionExpression = new RegExp(`## ${escapedOracleId}[\\s\\S]*?- artifact_path: ${escapedArtifactPath}[\\s\\S]*?- trust_level: ${priorOracle.trustLevel}`);

      expect(sectionExpression.test(referenceOracles)).toBe(true);
    }

    expect(referenceOracles).toContain(`## ${expectedFixture.oracle.id}`);
    expect(referenceOracles).toContain('- oracle: full-shareware-e1-acceptance');
    expect(referenceOracles).toContain(`- artifact_path: ${expectedFixture.oracle.artifactPath}`);
  });
});
