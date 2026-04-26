export interface DocumentRequiredLocalFile {
  category: 'dependency-lockfile' | 'entrypoint' | 'game-data' | 'package-manifest';
  path: 'bun.lock' | 'doom.ts' | 'doom/DOOM1.WAD' | 'package.json';
  purpose: string;
  requirement: string;
  source: string;
}

export interface DocumentRequiredLocalFilesCommandContract {
  entryFile: 'doom.ts';
  program: 'bun';
  runtimeCommand: 'bun run doom.ts';
  subcommand: 'run';
}

export interface DocumentRequiredLocalFilesEvidence {
  commandContract: DocumentRequiredLocalFilesCommandContract;
  deterministicReplayCompatibility: DocumentRequiredLocalFilesReplayCompatibility;
  documentationHash: string;
  packageCapabilitySource: 'plan_fps/PACKAGE_CAPABILITY_MATRIX.md';
  requiredLocalFiles: readonly DocumentRequiredLocalFile[];
  stepIdentifier: '14-002';
  stepTitle: 'document-required-local-files';
  transition: DocumentRequiredLocalFilesTransition;
}

export interface DocumentRequiredLocalFilesReplayCompatibility {
  fileContentsRead: false;
  inputStreamMutated: false;
  randomSeedMutated: false;
  simulationTicksAdvanced: false;
}

export interface DocumentRequiredLocalFilesTransition {
  currentPackageStartScript: 'bun run src/main.ts';
  productRuntimeCommand: 'bun run doom.ts';
  transitionReason: string;
}

export const DOCUMENT_REQUIRED_LOCAL_FILES_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  runtimeCommand: 'bun run doom.ts',
  subcommand: 'run',
} satisfies DocumentRequiredLocalFilesCommandContract);

export const DOCUMENT_REQUIRED_LOCAL_FILES_REQUIRED_FILES = Object.freeze([
  Object.freeze({
    category: 'dependency-lockfile',
    path: 'bun.lock',
    purpose: 'Pins Bun dependency resolution for a reproducible local install before launch.',
    requirement: 'Required for the Bun-managed local workspace that runs the product command.',
    source: 'F-FPS-007',
  }),
  Object.freeze({
    category: 'entrypoint',
    path: 'doom.ts',
    purpose: 'Workspace-root entry file consumed by the final product command.',
    requirement: 'Required for the exact `bun run doom.ts` launch contract.',
    source: 'plan_fps/README.md',
  }),
  Object.freeze({
    category: 'game-data',
    path: 'doom/DOOM1.WAD',
    purpose: 'Local IWAD used by the default launch path when no explicit `--iwad` is provided.',
    requirement: 'Required for default IWAD discovery and must remain a local, non-redistributed asset.',
    source: 'F-FPS-004 and src/main.ts',
  }),
  Object.freeze({
    category: 'package-manifest',
    path: 'package.json',
    purpose: 'Declares the Bun package metadata and Win32 dependencies used by local launch.',
    requirement: 'Required for Bun install and script context around the product command.',
    source: 'package.json and plan_fps/PACKAGE_CAPABILITY_MATRIX.md',
  }),
] satisfies readonly DocumentRequiredLocalFile[]);

export const DOCUMENT_REQUIRED_LOCAL_FILES_REPLAY_COMPATIBILITY = Object.freeze({
  fileContentsRead: false,
  inputStreamMutated: false,
  randomSeedMutated: false,
  simulationTicksAdvanced: false,
} satisfies DocumentRequiredLocalFilesReplayCompatibility);

export const DOCUMENT_REQUIRED_LOCAL_FILES_TRANSITION = Object.freeze({
  currentPackageStartScript: 'bun run src/main.ts',
  productRuntimeCommand: 'bun run doom.ts',
  transitionReason: 'Document local files for the root Bun product command without reading file contents or mutating replay state.',
} satisfies DocumentRequiredLocalFilesTransition);

const DOCUMENT_REQUIRED_LOCAL_FILES_HASH_INPUT = Object.freeze({
  commandContract: DOCUMENT_REQUIRED_LOCAL_FILES_COMMAND_CONTRACT,
  deterministicReplayCompatibility: DOCUMENT_REQUIRED_LOCAL_FILES_REPLAY_COMPATIBILITY,
  requiredLocalFiles: DOCUMENT_REQUIRED_LOCAL_FILES_REQUIRED_FILES,
  transition: DOCUMENT_REQUIRED_LOCAL_FILES_TRANSITION,
});

export const DOCUMENT_REQUIRED_LOCAL_FILES_EVIDENCE = Object.freeze({
  commandContract: DOCUMENT_REQUIRED_LOCAL_FILES_COMMAND_CONTRACT,
  deterministicReplayCompatibility: DOCUMENT_REQUIRED_LOCAL_FILES_REPLAY_COMPATIBILITY,
  documentationHash: createSha256Hex(JSON.stringify(DOCUMENT_REQUIRED_LOCAL_FILES_HASH_INPUT)),
  packageCapabilitySource: 'plan_fps/PACKAGE_CAPABILITY_MATRIX.md',
  requiredLocalFiles: DOCUMENT_REQUIRED_LOCAL_FILES_REQUIRED_FILES,
  stepIdentifier: '14-002',
  stepTitle: 'document-required-local-files',
  transition: DOCUMENT_REQUIRED_LOCAL_FILES_TRANSITION,
} satisfies DocumentRequiredLocalFilesEvidence);

/**
 * Documents the required local files for the Bun product command.
 *
 * @param runtimeCommand Runtime command to validate before returning evidence.
 * @returns Frozen local-file documentation evidence.
 * @example
 * ```ts
 * import { documentRequiredLocalFiles } from './documentRequiredLocalFiles.ts';
 *
 * documentRequiredLocalFiles('bun run doom.ts');
 * ```
 */
export function documentRequiredLocalFiles(runtimeCommand: string = DOCUMENT_REQUIRED_LOCAL_FILES_COMMAND_CONTRACT.runtimeCommand): DocumentRequiredLocalFilesEvidence {
  if (runtimeCommand !== DOCUMENT_REQUIRED_LOCAL_FILES_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error(`document required local files requires "bun run doom.ts"; received "${runtimeCommand}".`);
  }

  return DOCUMENT_REQUIRED_LOCAL_FILES_EVIDENCE;
}

function createSha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(value);

  return hasher.digest('hex');
}
