import { describe, expect, test } from 'bun:test';

import { DEFAULT_IWAD_PATH, LEGACY_PACKAGE_START_SCRIPT, PRODUCT_RUNTIME_COMMAND, verifyIwadDiscoveryAtLaunch } from '../../../src/playable/bun-launch-local-distribution-boundary/verifyIwadDiscoveryAtLaunch.ts';

const EXPECTED_DISCOVERY_HASH = '8065bb46fdb9ab997252e2630ff482e9fc834310b08cbeaad9789283e359c60a';
const EXPECTED_SOURCE_SHA256 = '465b03d052d3028cb94928a1966d061c859ecc4088e6353dcb5dd8e631dd0105';
const EXPECTED_TRANSITION_HASH = 'baaa408c94d92473ec2af231da3f1079ffcca8efa90033879f12bc0217ee623f';
const SOURCE_PATH = 'src/playable/bun-launch-local-distribution-boundary/verifyIwadDiscoveryAtLaunch.ts';

describe('verifyIwadDiscoveryAtLaunch', () => {
  test('locks the product command contract and default IWAD discovery evidence', async () => {
    const evidence = await verifyIwadDiscoveryAtLaunch();

    expect(evidence).toEqual({
      commandContract: {
        acceptsOnlyProductCommand: true,
        legacyPackageStartScript: LEGACY_PACKAGE_START_SCRIPT,
        productRuntimeCommand: PRODUCT_RUNTIME_COMMAND,
        runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      },
      discovery: {
        defaultIwadPath: DEFAULT_IWAD_PATH,
        discovered: true,
        discoveryApi: 'Bun.file.exists',
        fileContentsRead: false,
        sourceFile: 'src/main.ts',
      },
      hashes: {
        discoveryHash: EXPECTED_DISCOVERY_HASH,
        transitionHash: EXPECTED_TRANSITION_HASH,
      },
      launchTransition: {
        fromState: 'launch-command-accepted',
        mapName: 'E1M1',
        scale: 2,
        skill: 2,
        toState: 'iwad-discovered',
      },
      replayCompatibility: {
        discoveredBeforeFirstTic: true,
        inputStreamMutated: false,
        randomSeedMutated: false,
        simulationTicsAdvanced: 0,
      },
      stepIdentifier: '14-003',
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.commandContract)).toBe(true);
    expect(Object.isFrozen(evidence.discovery)).toBe(true);
    expect(Object.isFrozen(evidence.hashes)).toBe(true);
    expect(Object.isFrozen(evidence.launchTransition)).toBe(true);
    expect(Object.isFrozen(evidence.replayCompatibility)).toBe(true);
  });

  test('locks the formatted source hash', async () => {
    const sourceText = await Bun.file(SOURCE_PATH).text();

    expect(createSha256Hash(sourceText)).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('rejects legacy package start command before IWAD discovery', async () => {
    await expect(
      verifyIwadDiscoveryAtLaunch({
        runtimeCommand: LEGACY_PACKAGE_START_SCRIPT,
      }),
    ).rejects.toThrow(`IWAD discovery is only valid through ${PRODUCT_RUNTIME_COMMAND}; received ${LEGACY_PACKAGE_START_SCRIPT}.`);
  });

  test('rejects a launch path without a discovered IWAD', async () => {
    const missingIwadPath = 'missing\\DOOM1.WAD';

    await expect(
      verifyIwadDiscoveryAtLaunch({
        defaultIwadPath: missingIwadPath,
      }),
    ).rejects.toThrow(`IWAD discovery failed at launch: ${missingIwadPath}.`);
  });
});

function createSha256Hash(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}
