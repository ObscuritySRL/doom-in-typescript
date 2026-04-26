export const WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND = 'bun run doom.ts';

const CURRENT_PACKAGE_START_SCRIPT = 'bun run src/main.ts';
const DEFAULT_LOCAL_IWAD_PATH = 'doom\\DOOM1.WAD';
const STEP_IDENTIFIER = '14-006';

export type WriteReadmeUsageInstructionsCommandContract = Readonly<{
  entryFile: 'doom.ts';
  program: 'bun';
  runtimeCommand: typeof WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND;
  subcommand: 'run';
}>;

export type WriteReadmeUsageInstructionsEvidence = Readonly<{
  commandContract: WriteReadmeUsageInstructionsCommandContract;
  documentationHash: string;
  instructions: readonly string[];
  replayCompatibility: WriteReadmeUsageInstructionsReplayCompatibility;
  requiredLocalFiles: readonly WriteReadmeUsageInstructionsRequiredLocalFile[];
  stepIdentifier: typeof STEP_IDENTIFIER;
  transition: WriteReadmeUsageInstructionsTransition;
}>;

export type WriteReadmeUsageInstructionsReplayCompatibility = Readonly<{
  inputStreamMutated: false;
  randomSeedMutated: false;
  simulationTickAdvanced: false;
}>;

export type WriteReadmeUsageInstructionsRequiredLocalFile = Readonly<{
  defaultPath: typeof DEFAULT_LOCAL_IWAD_PATH;
  description: 'shareware IWAD supplied by the local user';
  requiredWhen: 'no --iwad override is provided';
}>;

export type WriteReadmeUsageInstructionsTransition = Readonly<{
  fromPackageScript: typeof CURRENT_PACKAGE_START_SCRIPT;
  preservesDeterministicReplay: true;
  toProductCommand: typeof WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND;
}>;

/**
 * Builds the locked README usage-instruction payload for the Bun playable launch command.
 *
 * @param runtimeCommand - Launch command to validate before producing usage evidence.
 * @returns Frozen usage evidence for the C1 Bun local distribution boundary.
 *
 * @example
 * ```ts
 * const evidence = writeReadmeUsageInstructions();
 * console.log(evidence.commandContract.runtimeCommand);
 * ```
 */
export function writeReadmeUsageInstructions(runtimeCommand: string = WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND): WriteReadmeUsageInstructionsEvidence {
  if (runtimeCommand !== WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND) {
    throw new Error(`write-readme-usage-instructions requires ${WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND}, got ${runtimeCommand}.`);
  }

  const commandContract = Object.freeze({
    entryFile: 'doom.ts',
    program: 'bun',
    runtimeCommand: WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND,
    subcommand: 'run',
  } satisfies WriteReadmeUsageInstructionsCommandContract);

  const instructions = Object.freeze([
    '## Usage',
    '',
    'Run from the repository root:',
    '',
    '```sh',
    WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND,
    '```',
    '',
    'Optional launch arguments:',
    '',
    '- `--iwad <path-to-iwad>` overrides the default local IWAD path.',
    '- `--map E1M1` selects the starting map.',
    '- `--skill 2` selects the vanilla skill number.',
    '- `--scale 2` sets the window scale.',
    '- `--list-maps` prints the IWAD map names and exits.',
    '',
    'Required local files:',
    '',
    `- \`${DEFAULT_LOCAL_IWAD_PATH}\` must exist locally unless \`--iwad\` points at another valid IWAD.`,
    '',
    'The product runs through Bun only and does not redistribute IWAD or reference executable assets.',
  ]);

  const replayCompatibility = Object.freeze({
    inputStreamMutated: false,
    randomSeedMutated: false,
    simulationTickAdvanced: false,
  } satisfies WriteReadmeUsageInstructionsReplayCompatibility);

  const requiredLocalFile = Object.freeze({
    defaultPath: DEFAULT_LOCAL_IWAD_PATH,
    description: 'shareware IWAD supplied by the local user',
    requiredWhen: 'no --iwad override is provided',
  } satisfies WriteReadmeUsageInstructionsRequiredLocalFile);

  const requiredLocalFiles = Object.freeze([requiredLocalFile]);

  const transition = Object.freeze({
    fromPackageScript: CURRENT_PACKAGE_START_SCRIPT,
    preservesDeterministicReplay: true,
    toProductCommand: WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND,
  } satisfies WriteReadmeUsageInstructionsTransition);

  const evidence = {
    commandContract,
    documentationHash: createDocumentationHash(instructions, requiredLocalFiles),
    instructions,
    replayCompatibility,
    requiredLocalFiles,
    stepIdentifier: STEP_IDENTIFIER,
    transition,
  } satisfies WriteReadmeUsageInstructionsEvidence;

  return Object.freeze(evidence);
}

function createDocumentationHash(instructions: readonly string[], requiredLocalFiles: readonly WriteReadmeUsageInstructionsRequiredLocalFile[]): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(
    [
      STEP_IDENTIFIER,
      WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND,
      ...instructions,
      ...requiredLocalFiles.map((requiredLocalFile) => `${requiredLocalFile.defaultPath}\t${requiredLocalFile.description}\t${requiredLocalFile.requiredWhen}`),
    ].join('\n'),
  );

  return hasher.digest('hex');
}
