import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_REQUIRED_DATA_PATH,
  MISSING_DATA_ERROR_CODE,
  MISSING_DATA_ERROR_MESSAGE,
  PRODUCT_RUNTIME_COMMAND,
  verifyMissingDataErrorPath,
} from '../../../src/playable/bun-launch-local-distribution-boundary/verifyMissingDataErrorPath.ts';

const EXPECTED_SOURCE_SHA256 = '95177e96467e1e69ab55c6c18e042dabc8694132c4260532ea05bbe003ebbcb9';
const MISSING_REQUIRED_DATA_PATH = 'test\\fixtures\\14-004-missing\\DOOM1.WAD';
const MISSING_REQUIRED_DATA_PATH_ERROR_MESSAGE = `${MISSING_DATA_ERROR_MESSAGE} Missing path: ${MISSING_REQUIRED_DATA_PATH}`;
const MISSING_REQUIRED_DATA_PATH_HASH = 'cf528c9ff3e307579e78adebdcdaa1a11234b033f333bab151f7ccf94f3c29c5';

describe('verifyMissingDataErrorPath', () => {
  test('locks the exact Bun runtime command contract', () => {
    expect(PRODUCT_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(DEFAULT_REQUIRED_DATA_PATH).toBe('doom\\DOOM1.WAD');
  });

  test('captures the missing data error before deterministic replay state can change', async () => {
    const evidence = await verifyMissingDataErrorPath({
      requiredDataPath: MISSING_REQUIRED_DATA_PATH,
    });

    expect(evidence).toEqual({
      commandContract: {
        command: 'bun run doom.ts',
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
      },
      dataProbe: {
        contentRead: false,
        exists: false,
        path: MISSING_REQUIRED_DATA_PATH,
        probeApi: 'Bun.file.exists',
      },
      deterministicReplayCompatibility: {
        inputStreamMutated: false,
        randomSeedMutated: false,
        simulationTickAdvanced: false,
      },
      error: {
        code: MISSING_DATA_ERROR_CODE,
        message: MISSING_REQUIRED_DATA_PATH_ERROR_MESSAGE,
      },
      evidenceHash: MISSING_REQUIRED_DATA_PATH_HASH,
      stepIdentifier: '14-004',
      transition: {
        firstSimulationTickReached: false,
        from: 'clean-launch-data-probe',
        to: 'fatal-missing-data-error',
      },
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.commandContract)).toBe(true);
    expect(Object.isFrozen(evidence.dataProbe)).toBe(true);
    expect(Object.isFrozen(evidence.deterministicReplayCompatibility)).toBe(true);
    expect(Object.isFrozen(evidence.error)).toBe(true);
    expect(Object.isFrozen(evidence.transition)).toBe(true);
  });

  test('prevalidates the product command before probing data files', async () => {
    await expect(
      verifyMissingDataErrorPath({
        requiredDataPath: MISSING_REQUIRED_DATA_PATH,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).rejects.toThrow('Expected bun run doom.ts runtime command, got bun run src/main.ts.');
  });

  test('rejects an existing data path because the missing-data branch was not exercised', async () => {
    await expect(
      verifyMissingDataErrorPath({
        requiredDataPath: DEFAULT_REQUIRED_DATA_PATH,
      }),
    ).rejects.toThrow('Expected missing required local data file at doom\\DOOM1.WAD, but it exists.');
  });

  test('locks the formatted source hash', async () => {
    const source = await Bun.file('src/playable/bun-launch-local-distribution-boundary/verifyMissingDataErrorPath.ts').text();

    expect(createSha256Hash(source)).toBe(EXPECTED_SOURCE_SHA256);
  });
});

function createSha256Hash(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);

  return hasher.digest('hex');
}
