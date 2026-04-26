import type { SaveGameHeader } from '../../save/saveHeader.ts';

import { SAVEGAME_EOF } from '../../save/loadgame.ts';
import { readSaveGameHeader, SAVEGAME_DESCRIPTION_SIZE, SAVEGAME_HEADER_SIZE } from '../../save/saveHeader.ts';

export const DISPLAY_SAVE_LOAD_MENU_MESSAGES_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-013-audit-missing-save-load-ui.json';
export const DISPLAY_SAVE_LOAD_MENU_MESSAGES_AUDIT_STEP_ID = '01-013';
export const DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND = 'bun run doom.ts';

const MAXIMUM_SAVE_SLOT_INDEX = 5;
const REPLAY_CHECKSUM_OFFSET = 0x811c_9dc5;
const REPLAY_CHECKSUM_PRIME = 0x0100_0193;

export interface DisplaySaveLoadMenuMessagesInput {
  readonly initialState?: DisplaySaveLoadMenuMessagesResult;
  readonly requests: readonly SaveLoadMenuMessageRequest[];
  readonly runtimeCommand: string;
}

export interface DisplaySaveLoadMenuMessagesResult {
  readonly activeMessage: SaveLoadMenuMessage | null;
  readonly history: readonly SaveLoadMenuMessage[];
  readonly replayChecksum: number;
  readonly transitionSignature: string;
}

export interface SaveLoadMenuClearRequest {
  readonly kind: 'clear-message';
  readonly reason: 'acknowledged' | 'menu-closed';
}

export interface SaveLoadMenuLoadRequest {
  readonly kind: 'load-slot';
  readonly networkGame?: boolean;
  readonly saveBytes: Uint8Array | null;
  readonly slotIndex: number;
}

export type SaveLoadMenuMessageKind = 'load-confirmation' | 'load-corrupted' | 'load-empty-slot' | 'load-network-blocked' | 'load-unsupported-version' | 'save-complete' | 'save-network-blocked' | 'save-not-playing';

export interface SaveLoadMenuMessage {
  readonly description: string | null;
  readonly kind: SaveLoadMenuMessageKind;
  readonly lines: readonly string[];
  readonly requiresAcknowledgement: boolean;
  readonly slotIndex: number;
}

export type SaveLoadMenuMessageRequest = SaveLoadMenuClearRequest | SaveLoadMenuLoadRequest | SaveLoadMenuSaveRequest;

export interface SaveLoadMenuSaveRequest {
  readonly description: string;
  readonly kind: 'save-slot';
  readonly networkGame?: boolean;
  readonly playing: boolean;
  readonly slotIndex: number;
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND) {
    throw new RangeError(`display save/load menu messages requires ${DISPLAY_SAVE_LOAD_MENU_MESSAGES_RUNTIME_COMMAND}.`);
  }
}

function assertSaveDescription(description: string): void {
  if (description.length > SAVEGAME_DESCRIPTION_SIZE) {
    throw new RangeError(`save description exceeds ${SAVEGAME_DESCRIPTION_SIZE} bytes.`);
  }

  for (let index = 0; index < description.length; index += 1) {
    if (description.charCodeAt(index) > 0xff) {
      throw new RangeError('save description contains a non-byte character.');
    }
  }
}

function assertSlotIndex(slotIndex: number): void {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > MAXIMUM_SAVE_SLOT_INDEX) {
    throw new RangeError(`save slot index must be an integer from 0 through ${MAXIMUM_SAVE_SLOT_INDEX}.`);
  }
}

function createMessage(kind: SaveLoadMenuMessageKind, slotIndex: number, description: string | null, lines: readonly string[]): SaveLoadMenuMessage {
  return Object.freeze({
    description,
    kind,
    lines: Object.freeze([...lines]),
    requiresAcknowledgement: true,
    slotIndex,
  });
}

function createReplayChecksum(result: Pick<DisplaySaveLoadMenuMessagesResult, 'activeMessage' | 'history'>): number {
  let checksum = updateReplayChecksum(REPLAY_CHECKSUM_OFFSET, result.activeMessage?.kind ?? 'none');

  for (const message of result.history) {
    checksum = updateReplayChecksum(checksum, message.kind);
    checksum = updateReplayChecksum(checksum, `${message.slotIndex}`);
    checksum = updateReplayChecksum(checksum, message.description ?? '');

    for (const line of message.lines) {
      checksum = updateReplayChecksum(checksum, line);
    }
  }

  return checksum >>> 0;
}

function createResult(activeMessage: SaveLoadMenuMessage | null, history: readonly SaveLoadMenuMessage[]): DisplaySaveLoadMenuMessagesResult {
  const frozenHistory = Object.freeze([...history]);
  const replayChecksum = createReplayChecksum({
    activeMessage,
    history: frozenHistory,
  });
  const activeKind = activeMessage?.kind ?? 'none';
  const transitionSignature = `${frozenHistory.length}:${activeKind}:${replayChecksum.toString(16).padStart(8, '0')}`;

  return Object.freeze({
    activeMessage,
    history: frozenHistory,
    replayChecksum,
    transitionSignature,
  });
}

function createSaveMessage(request: SaveLoadMenuSaveRequest): SaveLoadMenuMessage {
  assertSlotIndex(request.slotIndex);
  assertSaveDescription(request.description);

  if (request.networkGame === true) {
    return createMessage('save-network-blocked', request.slotIndex, request.description, ["you can't save while in a net game!", '', 'press a key.']);
  }

  if (!request.playing) {
    return createMessage('save-not-playing', request.slotIndex, request.description, ["you can't save if you aren't playing!", '', 'press a key.']);
  }

  return createMessage('save-complete', request.slotIndex, request.description, ['game saved.', `'${request.description}'`]);
}

function createValidLoadMessage(slotIndex: number, header: SaveGameHeader): SaveLoadMenuMessage {
  return createMessage('load-confirmation', slotIndex, header.description, ['do you want to load the game named', '', `'${header.description}'?`]);
}

function createLoadMessage(request: SaveLoadMenuLoadRequest): SaveLoadMenuMessage {
  assertSlotIndex(request.slotIndex);

  if (request.networkGame === true) {
    return createMessage('load-network-blocked', request.slotIndex, null, ["you can't load while in a net game!", '', 'press a key.']);
  }

  if (request.saveBytes === null) {
    return createMessage('load-empty-slot', request.slotIndex, null, ['empty save slot.', '', 'press a key.']);
  }

  if (request.saveBytes.length < SAVEGAME_HEADER_SIZE) {
    return createMessage('load-corrupted', request.slotIndex, null, ['savegame is corrupted.', '', 'press a key.']);
  }

  const header = readSaveGameHeader(request.saveBytes);

  if (header === null) {
    return createMessage('load-unsupported-version', request.slotIndex, null, ['savegame is from a different version.', '', 'press a key.']);
  }

  if (request.saveBytes[request.saveBytes.length - 1] !== SAVEGAME_EOF) {
    return createMessage('load-corrupted', request.slotIndex, header.description, ['savegame is corrupted.', '', 'press a key.']);
  }

  return createValidLoadMessage(request.slotIndex, header);
}

function updateReplayChecksum(previousChecksum: number, value: string): number {
  let checksum = previousChecksum;

  for (let index = 0; index < value.length; index += 1) {
    checksum = Math.imul(checksum ^ value.charCodeAt(index), REPLAY_CHECKSUM_PRIME);
  }

  return Math.imul(checksum ^ 0xff, REPLAY_CHECKSUM_PRIME) >>> 0;
}

/**
 * Build deterministic save/load menu message transitions for the playable Bun command path.
 * @param input Runtime command, optional previous state, and ordered save/load menu requests.
 * @returns Frozen message state and replay evidence with no host handles or timestamps.
 * @example
 * ```ts
 * const result = displaySaveLoadMenuMessages({
 *   requests: [{ kind: 'load-slot', saveBytes: null, slotIndex: 0 }],
 *   runtimeCommand: 'bun run doom.ts',
 * });
 * ```
 */
export function displaySaveLoadMenuMessages(input: DisplaySaveLoadMenuMessagesInput): DisplaySaveLoadMenuMessagesResult {
  assertRuntimeCommand(input.runtimeCommand);

  let activeMessage = input.initialState?.activeMessage ?? null;
  let history = input.initialState?.history ?? [];

  for (const request of input.requests) {
    if (request.kind === 'clear-message') {
      activeMessage = null;
      continue;
    }

    const message = request.kind === 'load-slot' ? createLoadMessage(request) : createSaveMessage(request);

    activeMessage = message;
    history = Object.freeze([...history, message]);
  }

  return createResult(activeMessage, history);
}
