import { describe, expect, test } from 'bun:test';

import {
  CLEAN_WORKING_TREE_RUNTIME_COMMAND,
  CLEAN_WORKING_TREE_SMOKE_COMMAND,
  CLEAN_WORKING_TREE_STEP_IDENTIFIER,
  CLEAN_WORKING_TREE_TRANSITION,
  LEGACY_PACKAGE_START_COMMAND,
  smokeTestCleanLocalWorkingTree,
} from '../../../src/playable/bun-launch-local-distribution-boundary/smokeTestCleanLocalWorkingTree.ts';

const EXPECTED_EVIDENCE_HASH = '81040b06003f395290f773e8860aa04f4afb41c1b65552f51cd2f2088e514381';
const EXPECTED_SOURCE_HASH = '3df9debe6c6033027164b9a2570e5f6b356a223616ae6c88d23be9cd59c6af93';
const SOURCE_PATH = 'src/playable/bun-launch-local-distribution-boundary/smokeTestCleanLocalWorkingTree.ts';

function createSha256Hash(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

describe('smokeTestCleanLocalWorkingTree', () => {
  test('locks the exact Bun command contract and clean working tree transition', () => {
    const evidence = smokeTestCleanLocalWorkingTree({
      runtimeCommand: CLEAN_WORKING_TREE_RUNTIME_COMMAND,
      workingTreePorcelainOutput: '',
    });

    expect(CLEAN_WORKING_TREE_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(CLEAN_WORKING_TREE_SMOKE_COMMAND).toBe('git status --porcelain');
    expect(CLEAN_WORKING_TREE_STEP_IDENTIFIER).toBe('14-007');
    expect(CLEAN_WORKING_TREE_TRANSITION).toBe('local-distribution-boundary:clean-working-tree-before-launch');
    expect(LEGACY_PACKAGE_START_COMMAND).toBe('bun run src/main.ts');
    expect(evidence).toEqual({
      commandContract: 'bun run doom.ts',
      deterministicReplayCompatible: {
        inputStreamMutated: false,
        randomSeedMutated: false,
        simulationTicAdvanced: false,
      },
      evidenceHash: EXPECTED_EVIDENCE_HASH,
      expectedPorcelainOutput: '',
      legacyStartCommand: 'bun run src/main.ts',
      smokeCommand: 'git status --porcelain',
      stepIdentifier: '14-007',
      transition: 'local-distribution-boundary:clean-working-tree-before-launch',
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.deterministicReplayCompatible)).toBe(true);
  });

  test('rejects non-product launch commands before checking the working tree', () => {
    expect(() =>
      smokeTestCleanLocalWorkingTree({
        runtimeCommand: LEGACY_PACKAGE_START_COMMAND,
        workingTreePorcelainOutput: ' M src/main.ts',
      }),
    ).toThrow('Expected bun run doom.ts for clean working tree smoke test, got bun run src/main.ts.');
  });

  test('rejects a dirty working tree snapshot without mutating replay state', () => {
    expect(() =>
      smokeTestCleanLocalWorkingTree({
        runtimeCommand: CLEAN_WORKING_TREE_RUNTIME_COMMAND,
        workingTreePorcelainOutput: ' M src/main.ts\n?? scratch.txt\n',
      }),
    ).toThrow('Working tree must be clean before bun run doom.ts; git status --porcelain reported changes.');
  });

  test('locks the formatted implementation hash', async () => {
    const sourceText = await Bun.file(SOURCE_PATH).text();

    expect(createSha256Hash(sourceText)).toBe(EXPECTED_SOURCE_HASH);
  });
});
