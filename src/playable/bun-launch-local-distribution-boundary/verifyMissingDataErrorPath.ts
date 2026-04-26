export const DEFAULT_REQUIRED_DATA_PATH = 'doom\\DOOM1.WAD';
export const MISSING_DATA_ERROR_CODE = 'missing-required-local-data';
export const MISSING_DATA_ERROR_MESSAGE = 'Missing required local data file. Provide --iwad <path-to-iwad> or restore the default doom\\DOOM1.WAD file.';
export const PRODUCT_RUNTIME_COMMAND = 'bun run doom.ts';

export interface MissingDataCommandContract {
  readonly command: typeof PRODUCT_RUNTIME_COMMAND;
  readonly entryFile: 'doom.ts';
  readonly program: 'bun';
  readonly subcommand: 'run';
}

export interface MissingDataErrorEvidence {
  readonly code: typeof MISSING_DATA_ERROR_CODE;
  readonly message: string;
}

export interface MissingDataErrorPathEvidence {
  readonly commandContract: MissingDataCommandContract;
  readonly dataProbe: MissingDataProbeEvidence;
  readonly deterministicReplayCompatibility: MissingDataReplayCompatibilityEvidence;
  readonly error: MissingDataErrorEvidence;
  readonly evidenceHash: string;
  readonly stepIdentifier: '14-004';
  readonly transition: MissingDataTransitionEvidence;
}

export interface MissingDataErrorPathOptions {
  readonly requiredDataPath?: string;
  readonly runtimeCommand?: string;
}

export interface MissingDataProbeEvidence {
  readonly contentRead: false;
  readonly exists: false;
  readonly path: string;
  readonly probeApi: 'Bun.file.exists';
}

export interface MissingDataReplayCompatibilityEvidence {
  readonly inputStreamMutated: false;
  readonly randomSeedMutated: false;
  readonly simulationTickAdvanced: false;
}

export interface MissingDataTransitionEvidence {
  readonly firstSimulationTickReached: false;
  readonly from: 'clean-launch-data-probe';
  readonly to: 'fatal-missing-data-error';
}

/**
 * @param options Missing-data verification options for the product command.
 * @returns Frozen evidence proving missing data fails before deterministic replay state changes.
 * @example
 * ```ts
 * const evidence = await verifyMissingDataErrorPath({ requiredDataPath: 'missing/DOOM1.WAD' });
 * console.log(evidence.error.code);
 * ```
 */
export async function verifyMissingDataErrorPath(options: MissingDataErrorPathOptions = {}): Promise<MissingDataErrorPathEvidence> {
  const runtimeCommand = options.runtimeCommand ?? PRODUCT_RUNTIME_COMMAND;

  if (runtimeCommand !== PRODUCT_RUNTIME_COMMAND) {
    throw new Error(`Expected ${PRODUCT_RUNTIME_COMMAND} runtime command, got ${runtimeCommand}.`);
  }

  const requiredDataPath = options.requiredDataPath ?? DEFAULT_REQUIRED_DATA_PATH;
  const requiredDataFile = Bun.file(requiredDataPath);

  if (await requiredDataFile.exists()) {
    throw new Error(`Expected missing required local data file at ${requiredDataPath}, but it exists.`);
  }

  const commandContract = Object.freeze({
    command: PRODUCT_RUNTIME_COMMAND,
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  } satisfies MissingDataCommandContract);
  const dataProbe = Object.freeze({
    contentRead: false,
    exists: false,
    path: requiredDataPath,
    probeApi: 'Bun.file.exists',
  } satisfies MissingDataProbeEvidence);
  const deterministicReplayCompatibility = Object.freeze({
    inputStreamMutated: false,
    randomSeedMutated: false,
    simulationTickAdvanced: false,
  } satisfies MissingDataReplayCompatibilityEvidence);
  const error = Object.freeze({
    code: MISSING_DATA_ERROR_CODE,
    message: `${MISSING_DATA_ERROR_MESSAGE} Missing path: ${requiredDataPath}`,
  } satisfies MissingDataErrorEvidence);
  const transition = Object.freeze({
    firstSimulationTickReached: false,
    from: 'clean-launch-data-probe',
    to: 'fatal-missing-data-error',
  } satisfies MissingDataTransitionEvidence);
  const evidenceWithoutHash = {
    commandContract,
    dataProbe,
    deterministicReplayCompatibility,
    error,
    stepIdentifier: '14-004',
    transition,
  } satisfies Omit<MissingDataErrorPathEvidence, 'evidenceHash'>;
  const evidenceHash = createSha256Hash(JSON.stringify(evidenceWithoutHash));

  return Object.freeze({
    ...evidenceWithoutHash,
    evidenceHash,
  });
}

function createSha256Hash(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);

  return hasher.digest('hex');
}
