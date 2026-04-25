import { SAVEGAME_DESCRIPTION_SIZE, SAVEGAME_HEADER_SIZE, SAVEGAME_VERSION_TEXT } from '../../save/saveHeader.ts';

export const DEFINE_SAVE_FILE_PATH_POLICY_AUDIT_SURFACE = 'save-file-path-policy';
export const DEFINE_SAVE_FILE_PATH_POLICY_COMMAND_CONTRACT: SaveFilePathPolicyCommandContract = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
});
export const SAVE_FILE_DEFAULT_DIRECTORY = 'savegames';
export const SAVE_FILE_EXTENSION = '.dsg';
export const SAVE_FILE_SLOT_COUNT = 6;

export interface SaveFilePathPolicy {
  readonly auditSurface: string;
  readonly commandContract: SaveFilePathPolicyCommandContract;
  readonly directory: string;
  readonly replayChecksum: number;
  readonly replaySignature: string;
  readonly savegameDescriptionSize: number;
  readonly savegameHeaderSize: number;
  readonly slots: readonly SaveFilePathPolicySlot[];
  readonly versionText: string;
}

export interface SaveFilePathPolicyCommandContract {
  readonly entryFile: string;
  readonly runtimeCommand: string;
}

export interface SaveFilePathPolicyInput {
  readonly runtimeCommand: string;
  readonly saveDirectory?: string;
}

export interface SaveFilePathPolicySlot {
  readonly fileName: string;
  readonly relativePath: string;
  readonly slotIndex: number;
}

function assertProductRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== DEFINE_SAVE_FILE_PATH_POLICY_COMMAND_CONTRACT.runtimeCommand) {
    throw new RangeError('Save file path policy requires bun run doom.ts.');
  }
}

function calculateReplayChecksum(signature: string): number {
  let checksum = 0x811c_9dc5;

  for (let characterIndex = 0; characterIndex < signature.length; characterIndex += 1) {
    checksum ^= signature.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, 0x0100_0193) >>> 0;
  }

  return checksum;
}

function createReplaySignature(directory: string, slots: readonly SaveFilePathPolicySlot[]): string {
  let signature = `surface=${DEFINE_SAVE_FILE_PATH_POLICY_AUDIT_SURFACE};directory=${directory};slots=${SAVE_FILE_SLOT_COUNT};description=${SAVEGAME_DESCRIPTION_SIZE};header=${SAVEGAME_HEADER_SIZE};version=${SAVEGAME_VERSION_TEXT}`;

  for (const slot of slots) {
    signature += `;slot${slot.slotIndex}=${slot.relativePath}`;
  }

  return signature;
}

function createSlotFileName(slotIndex: number): string {
  return `doomsav${slotIndex}${SAVE_FILE_EXTENSION}`;
}

function hasWindowsDrivePrefix(value: string): boolean {
  if (value.length < 2 || value[1] !== ':') {
    return false;
  }

  const firstCharacterCode = value.charCodeAt(0);

  return (firstCharacterCode >= 0x41 && firstCharacterCode <= 0x5a) || (firstCharacterCode >= 0x61 && firstCharacterCode <= 0x7a);
}

function normalizeSaveDirectory(saveDirectory: string): string {
  const trimmedDirectory = saveDirectory.trim();

  if (trimmedDirectory.length === 0) {
    throw new RangeError('Save directory must not be empty.');
  }

  if (trimmedDirectory.startsWith('/') || trimmedDirectory.includes('\\') || hasWindowsDrivePrefix(trimmedDirectory)) {
    throw new RangeError('Save directory must be a relative forward-slash path.');
  }

  const segments = trimmedDirectory.split('/');

  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new RangeError('Save directory must not contain empty, current, or parent segments.');
    }
  }

  return segments.join('/');
}

/**
 * Define the deterministic local save-file path policy for the playable Bun runtime.
 * @param input Runtime command and optional relative save directory.
 * @returns The replay-safe slot-to-path mapping used by later save/load steps.
 * @example
 * ```ts
 * const policy = defineSaveFilePathPolicy({ runtimeCommand: 'bun run doom.ts' });
 * console.log(policy.slots[0]?.relativePath);
 * ```
 */
export function defineSaveFilePathPolicy(input: SaveFilePathPolicyInput): SaveFilePathPolicy {
  assertProductRuntimeCommand(input.runtimeCommand);

  const directory = normalizeSaveDirectory(input.saveDirectory ?? SAVE_FILE_DEFAULT_DIRECTORY);
  const slots: SaveFilePathPolicySlot[] = [];

  for (let slotIndex = 0; slotIndex < SAVE_FILE_SLOT_COUNT; slotIndex += 1) {
    const fileName = createSlotFileName(slotIndex);

    slots.push(
      Object.freeze({
        fileName,
        relativePath: `${directory}/${fileName}`,
        slotIndex,
      }),
    );
  }

  const frozenSlots = Object.freeze(slots);
  const replaySignature = createReplaySignature(directory, frozenSlots);

  return Object.freeze({
    auditSurface: DEFINE_SAVE_FILE_PATH_POLICY_AUDIT_SURFACE,
    commandContract: DEFINE_SAVE_FILE_PATH_POLICY_COMMAND_CONTRACT,
    directory,
    replayChecksum: calculateReplayChecksum(replaySignature),
    replaySignature,
    savegameDescriptionSize: SAVEGAME_DESCRIPTION_SIZE,
    savegameHeaderSize: SAVEGAME_HEADER_SIZE,
    slots: frozenSlots,
    versionText: SAVEGAME_VERSION_TEXT,
  });
}
