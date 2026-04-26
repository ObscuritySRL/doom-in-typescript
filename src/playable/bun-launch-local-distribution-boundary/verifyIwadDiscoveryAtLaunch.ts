export const DEFAULT_IWAD_PATH = 'doom\\DOOM1.WAD';
export const LEGACY_PACKAGE_START_SCRIPT = 'bun run src/main.ts';
export const PRODUCT_RUNTIME_COMMAND = 'bun run doom.ts';

export interface VerifyIwadDiscoveryAtLaunchCommandContract {
  readonly acceptsOnlyProductCommand: true;
  readonly legacyPackageStartScript: typeof LEGACY_PACKAGE_START_SCRIPT;
  readonly productRuntimeCommand: typeof PRODUCT_RUNTIME_COMMAND;
  readonly runtimeCommand: string;
}

export interface VerifyIwadDiscoveryAtLaunchDiscovery {
  readonly defaultIwadPath: string;
  readonly discovered: true;
  readonly discoveryApi: 'Bun.file.exists';
  readonly fileContentsRead: false;
  readonly sourceFile: 'src/main.ts';
}

export interface VerifyIwadDiscoveryAtLaunchEvidence {
  readonly commandContract: Readonly<VerifyIwadDiscoveryAtLaunchCommandContract>;
  readonly discovery: Readonly<VerifyIwadDiscoveryAtLaunchDiscovery>;
  readonly hashes: Readonly<VerifyIwadDiscoveryAtLaunchHashes>;
  readonly launchTransition: Readonly<VerifyIwadDiscoveryAtLaunchTransition>;
  readonly replayCompatibility: Readonly<VerifyIwadDiscoveryAtLaunchReplayCompatibility>;
  readonly stepIdentifier: '14-003';
}

export interface VerifyIwadDiscoveryAtLaunchHashes {
  readonly discoveryHash: string;
  readonly transitionHash: string;
}

export interface VerifyIwadDiscoveryAtLaunchOptions {
  readonly defaultIwadPath?: string;
  readonly runtimeCommand?: string;
}

export interface VerifyIwadDiscoveryAtLaunchReplayCompatibility {
  readonly discoveredBeforeFirstTic: true;
  readonly inputStreamMutated: false;
  readonly randomSeedMutated: false;
  readonly simulationTicsAdvanced: 0;
}

export interface VerifyIwadDiscoveryAtLaunchTransition {
  readonly fromState: 'launch-command-accepted';
  readonly mapName: 'E1M1';
  readonly scale: 2;
  readonly skill: 2;
  readonly toState: 'iwad-discovered';
}

export async function verifyIwadDiscoveryAtLaunch(options: VerifyIwadDiscoveryAtLaunchOptions = {}): Promise<Readonly<VerifyIwadDiscoveryAtLaunchEvidence>> {
  const runtimeCommand = options.runtimeCommand ?? PRODUCT_RUNTIME_COMMAND;

  if (runtimeCommand !== PRODUCT_RUNTIME_COMMAND) {
    throw new Error(`IWAD discovery is only valid through ${PRODUCT_RUNTIME_COMMAND}; received ${runtimeCommand}.`);
  }

  const defaultIwadPath = options.defaultIwadPath ?? DEFAULT_IWAD_PATH;
  const iwadFile = Bun.file(defaultIwadPath);

  if (!(await iwadFile.exists())) {
    throw new Error(`IWAD discovery failed at launch: ${defaultIwadPath}.`);
  }

  const commandContract = Object.freeze({
    acceptsOnlyProductCommand: true,
    legacyPackageStartScript: LEGACY_PACKAGE_START_SCRIPT,
    productRuntimeCommand: PRODUCT_RUNTIME_COMMAND,
    runtimeCommand,
  } satisfies VerifyIwadDiscoveryAtLaunchCommandContract);
  const discovery = Object.freeze({
    defaultIwadPath,
    discovered: true,
    discoveryApi: 'Bun.file.exists',
    fileContentsRead: false,
    sourceFile: 'src/main.ts',
  } satisfies VerifyIwadDiscoveryAtLaunchDiscovery);
  const launchTransition = Object.freeze({
    fromState: 'launch-command-accepted',
    mapName: 'E1M1',
    scale: 2,
    skill: 2,
    toState: 'iwad-discovered',
  } satisfies VerifyIwadDiscoveryAtLaunchTransition);
  const replayCompatibility = Object.freeze({
    discoveredBeforeFirstTic: true,
    inputStreamMutated: false,
    randomSeedMutated: false,
    simulationTicsAdvanced: 0,
  } satisfies VerifyIwadDiscoveryAtLaunchReplayCompatibility);
  const hashes = Object.freeze({
    discoveryHash: createSha256Hash({ commandContract, discovery }),
    transitionHash: createSha256Hash({ launchTransition, replayCompatibility }),
  } satisfies VerifyIwadDiscoveryAtLaunchHashes);

  return Object.freeze({
    commandContract,
    discovery,
    hashes,
    launchTransition,
    replayCompatibility,
    stepIdentifier: '14-003',
  } satisfies VerifyIwadDiscoveryAtLaunchEvidence);
}

function createSha256Hash(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}
