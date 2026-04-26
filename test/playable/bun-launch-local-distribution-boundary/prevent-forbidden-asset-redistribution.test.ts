import { describe, expect, test } from 'bun:test';

import {
  FORBIDDEN_ASSET_REDISTRIBUTION_RULE,
  LOCAL_DISTRIBUTION_ASSET_CANDIDATES,
  PRELAUNCH_DISTRIBUTION_POLICY_TRANSITION,
  PRODUCT_RUNTIME_COMMAND,
  STEP_IDENTIFIER,
  preventForbiddenAssetRedistribution,
} from '../../../src/playable/bun-launch-local-distribution-boundary/preventForbiddenAssetRedistribution.ts';
import type { AssetRedistributionCandidate } from '../../../src/playable/bun-launch-local-distribution-boundary/preventForbiddenAssetRedistribution.ts';

const PRODUCT_SOURCE_PATH = 'src/playable/bun-launch-local-distribution-boundary/preventForbiddenAssetRedistribution.ts';

describe('preventForbiddenAssetRedistribution', () => {
  test('locks the Bun command contract and local reference asset policy', () => {
    const evidence = preventForbiddenAssetRedistribution();

    expect(PRODUCT_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(STEP_IDENTIFIER).toBe('14-005');
    expect(PRELAUNCH_DISTRIBUTION_POLICY_TRANSITION).toBe('prelaunch-distribution-policy-check');
    expect(FORBIDDEN_ASSET_REDISTRIBUTION_RULE).toBe('Do not embed, copy, package, or redistribute proprietary IWAD data or reference executable bytes.');
    expect(LOCAL_DISTRIBUTION_ASSET_CANDIDATES).toEqual([
      {
        kind: 'engine-code',
        path: 'doom.ts',
        redistributesBytes: true,
        source: 'workspace-product-entrypoint',
      },
      {
        kind: 'user-local-iwad',
        path: 'doom\\DOOM1.WAD',
        redistributesBytes: false,
        source: 'user-local-reference',
      },
      {
        kind: 'reference-executable',
        path: 'doom\\DOOM.EXE',
        redistributesBytes: false,
        source: 'local-reference-only',
      },
    ]);
    expect(evidence).toEqual({
      assetAssessments: [
        {
          disposition: 'redistributable-product-code',
          kind: 'engine-code',
          path: 'doom.ts',
          redistributesBytes: true,
          source: 'workspace-product-entrypoint',
        },
        {
          disposition: 'local-reference-only',
          kind: 'user-local-iwad',
          path: 'doom\\DOOM1.WAD',
          redistributesBytes: false,
          source: 'user-local-reference',
        },
        {
          disposition: 'local-reference-only',
          kind: 'reference-executable',
          path: 'doom\\DOOM.EXE',
          redistributesBytes: false,
          source: 'local-reference-only',
        },
      ],
      assetPolicyHash: '3968c4aa1bcafaa645aa80bd2114714331fea632c6e13e18851c846283c721e7',
      blockedAssetPaths: [],
      command: 'bun run doom.ts',
      deterministicReplayCompatible: true,
      firstSimulationTic: 0,
      inputStreamMutation: 'none',
      randomSeedMutation: 'none',
      redistributionAllowed: true,
      runtime: 'Bun',
      stepIdentifier: '14-005',
      transition: 'prelaunch-distribution-policy-check',
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.assetAssessments)).toBe(true);
    expect(Object.isFrozen(evidence.blockedAssetPaths)).toBe(true);
  });

  test('rejects forbidden bundled proprietary assets before replay mutation', () => {
    const assetCandidates: ReadonlyArray<AssetRedistributionCandidate> = [
      {
        kind: 'proprietary-iwad',
        path: 'dist\\DOOM1.WAD',
        redistributesBytes: true,
        source: 'bundled-artifact',
      },
    ];

    expect(() => preventForbiddenAssetRedistribution({ assetCandidates })).toThrow('Forbidden asset redistribution detected: dist\\DOOM1.WAD.');
  });

  test('rejects non-product launch commands', () => {
    expect(() =>
      preventForbiddenAssetRedistribution({
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('Expected bun run doom.ts, got bun run src/main.ts.');
  });

  test('locks the formatted product source hash', async () => {
    const sourceText = await Bun.file(PRODUCT_SOURCE_PATH).text();

    expect(sha256Hex(sourceText)).toBe('3d3f5f6026a6b5bdc5b05ddabd41437ff64ab9520bda77eef5bebed221ef617f');
  });

  test('aggregates multiple forbidden asset paths into a single comma-separated error', () => {
    const assetCandidates: ReadonlyArray<AssetRedistributionCandidate> = [
      {
        kind: 'proprietary-iwad',
        path: 'dist\\DOOM1.WAD',
        redistributesBytes: true,
        source: 'bundled-artifact',
      },
      {
        kind: 'reference-executable',
        path: 'dist\\DOOMD.EXE',
        redistributesBytes: true,
        source: 'bundled-artifact',
      },
    ];

    expect(() => preventForbiddenAssetRedistribution({ assetCandidates })).toThrow('Forbidden asset redistribution detected: dist\\DOOM1.WAD, dist\\DOOMD.EXE.');
  });

  test('rejects redistribution of user-local IWAD bytes', () => {
    const assetCandidates: ReadonlyArray<AssetRedistributionCandidate> = [
      {
        kind: 'user-local-iwad',
        path: 'dist\\DOOM1.WAD',
        redistributesBytes: true,
        source: 'mislabelled-bundle',
      },
    ];

    expect(() => preventForbiddenAssetRedistribution({ assetCandidates })).toThrow('Forbidden asset redistribution detected: dist\\DOOM1.WAD.');
  });

  test('produces a deterministic policy hash for empty asset candidates', () => {
    const firstEvidence = preventForbiddenAssetRedistribution({ assetCandidates: [] });
    const secondEvidence = preventForbiddenAssetRedistribution({ assetCandidates: [] });

    expect(firstEvidence.assetAssessments).toEqual([]);
    expect(firstEvidence.blockedAssetPaths).toEqual([]);
    expect(firstEvidence.assetPolicyHash).toHaveLength(64);
    expect(firstEvidence.assetPolicyHash).toBe(secondEvidence.assetPolicyHash);
  });
});

function sha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}
