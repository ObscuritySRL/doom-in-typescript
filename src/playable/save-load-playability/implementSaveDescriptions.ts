import { SAVEGAME_DESCRIPTION_SIZE, writeSaveGameHeader } from '../../save/saveHeader.ts';
import type { SaveGameHeader } from '../../save/saveHeader.ts';

export const IMPLEMENT_SAVE_DESCRIPTIONS_AUDIT_STEP_ID = '01-013';
export const IMPLEMENT_SAVE_DESCRIPTIONS_AUDIT_SURFACE = 'save-description-entry';
export const SAVE_DESCRIPTION_MAXIMUM_BYTES = SAVEGAME_DESCRIPTION_SIZE;

export interface SaveDescriptionBackspaceEvent {
  readonly kind: 'backspace';
}

export interface SaveDescriptionClearEvent {
  readonly kind: 'clear';
}

export interface SaveDescriptionCommandContract {
  readonly entryFile: string;
  readonly runtimeCommand: string;
}

export interface SaveDescriptionConfirmEvent {
  readonly kind: 'confirm';
}

export interface SaveDescriptionInsertEvent {
  readonly character: string;
  readonly kind: 'insert';
}

export interface ImplementSaveDescriptionsInput {
  readonly command: SaveDescriptionCommandContract;
  readonly events: readonly SaveDescriptionEvent[];
  readonly initialDescription?: string;
}

export interface ImplementSaveDescriptionsResult {
  readonly confirmed: boolean;
  readonly description: string;
  readonly displayText: string;
  readonly replayChecksum: number;
  readonly replayHash: string;
  readonly serializedDescriptionBytes: readonly number[];
  readonly transitionSignature: string;
}

export type SaveDescriptionEvent = SaveDescriptionBackspaceEvent | SaveDescriptionClearEvent | SaveDescriptionConfirmEvent | SaveDescriptionInsertEvent;

export const IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT: SaveDescriptionCommandContract = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
});

function assertDescriptionCharacter(name: string, character: string): void {
  const characterCode = character.charCodeAt(0);

  if (characterCode === 0) {
    throw new RangeError(`${name} cannot contain a zero byte.`);
  }

  if (characterCode > 0xff) {
    throw new RangeError(`${name} must contain only byte characters.`);
  }
}

function assertDescriptionText(name: string, description: string): void {
  if (description.length > SAVE_DESCRIPTION_MAXIMUM_BYTES) {
    throw new RangeError(`${name} exceeds ${SAVE_DESCRIPTION_MAXIMUM_BYTES} bytes.`);
  }

  for (let index = 0; index < description.length; index += 1) {
    assertDescriptionCharacter(name, description[index]);
  }
}

function assertInsertCharacter(character: string): void {
  if (character.length !== 1) {
    throw new RangeError('Save description insert events require exactly one character.');
  }

  assertDescriptionCharacter('Save description insert event', character);
}

function assertRuntimeCommand(command: SaveDescriptionCommandContract): void {
  if (command.entryFile !== IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT.entryFile || command.runtimeCommand !== IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error('Save descriptions require bun run doom.ts.');
  }
}

function createDisplayText(description: string): string {
  return description.padEnd(SAVE_DESCRIPTION_MAXIMUM_BYTES, ' ');
}

function createReplayChecksum(confirmed: boolean, serializedDescriptionBytes: readonly number[], transitionSignature: string): number {
  let checksum = 0x811c_9dc5;

  for (let index = 0; index < transitionSignature.length; index += 1) {
    checksum = Math.imul(checksum ^ transitionSignature.charCodeAt(index), 0x0100_0193) >>> 0;
  }

  for (const byte of serializedDescriptionBytes) {
    checksum = Math.imul(checksum ^ byte, 0x0100_0193) >>> 0;
  }

  return Math.imul(checksum ^ (confirmed ? 1 : 0), 0x0100_0193) >>> 0;
}

function createReplayHash(confirmed: boolean, description: string, displayText: string, replayChecksum: number, serializedDescriptionBytes: readonly number[], transitionSignature: string): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(
    [
      `audit-step=${IMPLEMENT_SAVE_DESCRIPTIONS_AUDIT_STEP_ID}`,
      `audit-surface=${IMPLEMENT_SAVE_DESCRIPTIONS_AUDIT_SURFACE}`,
      `command=${IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT.runtimeCommand}`,
      `confirmed=${confirmed ? 1 : 0}`,
      `description=${description}`,
      `display=${displayText}`,
      `replay-checksum=${replayChecksum}`,
      `serialized=${serializedDescriptionBytes.join(',')}`,
      `transition=${transitionSignature}`,
    ].join('\n'),
  );

  return hasher.digest('hex');
}

function createSaveHeader(description: string): SaveGameHeader {
  return {
    description,
    gameepisode: 1,
    gamemap: 1,
    gameskill: 2,
    leveltime: 0,
    playeringame: [1, 0, 0, 0],
  };
}

function createSerializedDescriptionBytes(description: string): readonly number[] {
  return Object.freeze(Array.from(writeSaveGameHeader(createSaveHeader(description)).subarray(0, SAVE_DESCRIPTION_MAXIMUM_BYTES)));
}

function createTextSignature(prefix: string, description: string): string {
  const bytes = createSerializedDescriptionBytes(description).slice(0, description.length);

  return `${prefix}:${description.length}:${bytes.join(',')}`;
}

/**
 * Apply replay-safe save-description edit events for the Bun playable path.
 * @param input Runtime command, initial text, and deterministic edit events.
 * @returns The final fixed-width save description display and replay evidence.
 * @example
 * ```ts
 * const result = implementSaveDescriptions({
 *   command: IMPLEMENT_SAVE_DESCRIPTIONS_COMMAND_CONTRACT,
 *   events: [{ character: '1', kind: 'insert' }],
 *   initialDescription: 'E1M',
 * });
 * ```
 */
export function implementSaveDescriptions(input: ImplementSaveDescriptionsInput): ImplementSaveDescriptionsResult {
  assertRuntimeCommand(input.command);

  let confirmed = false;
  let description = input.initialDescription ?? '';

  assertDescriptionText('Initial save description', description);

  const transitionSignatureParts = [createTextSignature('initial', description)];

  for (const event of input.events) {
    switch (event.kind) {
      case 'backspace':
        description = description.slice(0, -1);
        transitionSignatureParts.push(`backspace:${description.length}`);
        break;
      case 'clear':
        description = '';
        transitionSignatureParts.push('clear:0');
        break;
      case 'confirm':
        confirmed = true;
        transitionSignatureParts.push(`confirm:${description.length}`);
        break;
      case 'insert': {
        assertInsertCharacter(event.character);

        const nextDescription = description + event.character;

        assertDescriptionText('Save description', nextDescription);

        description = nextDescription;
        transitionSignatureParts.push(`insert:${event.character.charCodeAt(0)}:${description.length}`);
        break;
      }
    }
  }

  const displayText = createDisplayText(description);
  const serializedDescriptionBytes = createSerializedDescriptionBytes(description);
  const transitionSignature = transitionSignatureParts.join('|');
  const replayChecksum = createReplayChecksum(confirmed, serializedDescriptionBytes, transitionSignature);
  const replayHash = createReplayHash(confirmed, description, displayText, replayChecksum, serializedDescriptionBytes, transitionSignature);

  return Object.freeze({
    confirmed,
    description,
    displayText,
    replayChecksum,
    replayHash,
    serializedDescriptionBytes,
    transitionSignature,
  });
}
