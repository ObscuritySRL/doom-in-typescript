import type { SaveGameHeader } from '../../save/saveHeader.ts';

import { SAVEGAME_DESCRIPTION_SIZE } from '../../save/saveHeader.ts';

export const IMPLEMENT_SAVE_SLOT_UI_AUDIT_STEP_ID = '01-013';
export const IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND = 'bun run doom.ts';
export const SAVE_SLOT_UI_DESCRIPTION_SIZE = SAVEGAME_DESCRIPTION_SIZE;
export const SAVE_SLOT_UI_EMPTY_DESCRIPTION = 'EMPTY SLOT';
export const SAVE_SLOT_UI_SLOT_COUNT = 6;

export type SaveSlotUserInterfaceAction = 'blocked-empty-load' | 'confirm-load' | 'confirm-save' | 'move-selection' | 'none';
export type SaveSlotUserInterfaceEvent = 'confirm' | 'down' | 'idle' | 'up';
export type SaveSlotUserInterfaceMode = 'load' | 'save';
export type SaveSlotUserInterfaceStatus = 'empty' | 'occupied';

export interface ImplementSaveSlotUiInput {
  readonly event: SaveSlotUserInterfaceEvent;
  readonly mode: SaveSlotUserInterfaceMode;
  readonly runtimeCommand: string;
  readonly selectedSlotIndex: number;
  readonly slots: readonly SaveSlotUserInterfaceSlotInput[];
}

export interface ImplementSaveSlotUiResult {
  readonly mode: SaveSlotUserInterfaceMode;
  readonly replayEvidence: SaveSlotUserInterfaceReplayEvidence;
  readonly runtimeCommand: typeof IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND;
  readonly selectedSlotIndex: number;
  readonly slots: readonly SaveSlotUserInterfaceDisplaySlot[];
  readonly transition: SaveSlotUserInterfaceTransition;
}

export interface SaveSlotUserInterfaceDisplaySlot {
  readonly description: string;
  readonly isSelected: boolean;
  readonly levelTime: number | null;
  readonly mapName: string | null;
  readonly slotIndex: number;
  readonly status: SaveSlotUserInterfaceStatus;
}

export interface SaveSlotUserInterfaceReplayEvidence {
  readonly auditStepId: typeof IMPLEMENT_SAVE_SLOT_UI_AUDIT_STEP_ID;
  readonly checksum: number;
  readonly deterministic: true;
  readonly signature: string;
}

export interface SaveSlotUserInterfaceSlotInput {
  readonly header: SaveGameHeader | null;
  readonly slotIndex: number;
}

export interface SaveSlotUserInterfaceTransition {
  readonly action: SaveSlotUserInterfaceAction;
  readonly confirmedSlotIndex: number | null;
  readonly event: SaveSlotUserInterfaceEvent;
  readonly previousSlotIndex: number;
  readonly selectedSlotIndex: number;
}

function assertByte(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${name} must be an integer byte value.`);
  }
}

function assertDescription(description: string): void {
  if (description.length > SAVE_SLOT_UI_DESCRIPTION_SIZE) {
    throw new RangeError(`save slot description exceeds ${SAVE_SLOT_UI_DESCRIPTION_SIZE} bytes.`);
  }

  for (let characterIndex = 0; characterIndex < description.length; characterIndex += 1) {
    if (description.charCodeAt(characterIndex) > 0xff) {
      throw new RangeError('save slot description contains a non-byte character.');
    }
  }
}

function assertHeader(header: SaveGameHeader, slotIndex: number): void {
  assertDescription(header.description);
  assertByte(`slots[${slotIndex}].gameepisode`, header.gameepisode);
  assertByte(`slots[${slotIndex}].gamemap`, header.gamemap);
  assertByte(`slots[${slotIndex}].gameskill`, header.gameskill);

  if (!Number.isInteger(header.leveltime) || header.leveltime < 0 || header.leveltime > 0xff_ff_ff) {
    throw new RangeError(`slots[${slotIndex}].leveltime must be a 24-bit non-negative integer.`);
  }

  if (header.playeringame.length !== 4) {
    throw new RangeError(`slots[${slotIndex}].playeringame must contain four entries.`);
  }

  for (let playerIndex = 0; playerIndex < header.playeringame.length; playerIndex += 1) {
    assertByte(`slots[${slotIndex}].playeringame[${playerIndex}]`, header.playeringame[playerIndex]);
  }
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND) {
    throw new Error(`save slot UI requires ${IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND}.`);
  }
}

function assertSaveSlotUserInterfaceEvent(event: SaveSlotUserInterfaceEvent): void {
  if (event !== 'confirm' && event !== 'down' && event !== 'idle' && event !== 'up') {
    throw new RangeError('save slot UI event must be confirm, down, idle, or up.');
  }
}

function assertSaveSlotUserInterfaceMode(mode: SaveSlotUserInterfaceMode): void {
  if (mode !== 'load' && mode !== 'save') {
    throw new RangeError('save slot UI mode must be load or save.');
  }
}

function assertSlotIndex(slotIndex: number): void {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SAVE_SLOT_UI_SLOT_COUNT) {
    throw new RangeError(`save slot index must be an integer from 0 to ${SAVE_SLOT_UI_SLOT_COUNT - 1}.`);
  }
}

function assertSlots(slots: readonly SaveSlotUserInterfaceSlotInput[]): void {
  if (slots.length !== SAVE_SLOT_UI_SLOT_COUNT) {
    throw new RangeError(`save slot UI requires exactly ${SAVE_SLOT_UI_SLOT_COUNT} slots.`);
  }

  for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
    const slot = slots[slotIndex];

    if (slot.slotIndex !== slotIndex) {
      throw new RangeError(`slots[${slotIndex}].slotIndex must equal ${slotIndex}.`);
    }

    if (slot.header !== null) {
      assertHeader(slot.header, slotIndex);
    }
  }
}

function computeReplayChecksum(signature: string): number {
  let checksum = 0x81_1c_9d_c5;

  for (let characterIndex = 0; characterIndex < signature.length; characterIndex += 1) {
    checksum ^= signature.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, 0x01_00_01_93) >>> 0;
  }

  return checksum;
}

function createDisplaySlot(slot: SaveSlotUserInterfaceSlotInput, selectedSlotIndex: number): SaveSlotUserInterfaceDisplaySlot {
  if (slot.header === null) {
    return Object.freeze({
      description: SAVE_SLOT_UI_EMPTY_DESCRIPTION,
      isSelected: slot.slotIndex === selectedSlotIndex,
      levelTime: null,
      mapName: null,
      slotIndex: slot.slotIndex,
      status: 'empty',
    });
  }

  return Object.freeze({
    description: slot.header.description,
    isSelected: slot.slotIndex === selectedSlotIndex,
    levelTime: slot.header.leveltime,
    mapName: `E${slot.header.gameepisode}M${slot.header.gamemap}`,
    slotIndex: slot.slotIndex,
    status: 'occupied',
  });
}

function createReplaySignature(mode: SaveSlotUserInterfaceMode, transition: SaveSlotUserInterfaceTransition, displaySlots: readonly SaveSlotUserInterfaceDisplaySlot[]): string {
  const slotSignature = displaySlots.map((slot) => `${slot.slotIndex}:${slot.status}:${slot.isSelected ? 'selected' : 'idle'}:${slot.description}:${slot.mapName ?? 'none'}:${slot.levelTime ?? 'none'}`).join('|');

  return `step=${IMPLEMENT_SAVE_SLOT_UI_AUDIT_STEP_ID};command=${IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND};mode=${mode};event=${transition.event};action=${transition.action};from=${transition.previousSlotIndex};to=${transition.selectedSlotIndex};confirm=${transition.confirmedSlotIndex ?? 'none'};slots=${slotSignature}`;
}

function createTransition(event: SaveSlotUserInterfaceEvent, mode: SaveSlotUserInterfaceMode, selectedSlotIndex: number, slots: readonly SaveSlotUserInterfaceSlotInput[]): SaveSlotUserInterfaceTransition {
  if (event === 'up') {
    return Object.freeze({
      action: 'move-selection',
      confirmedSlotIndex: null,
      event,
      previousSlotIndex: selectedSlotIndex,
      selectedSlotIndex: selectedSlotIndex === 0 ? SAVE_SLOT_UI_SLOT_COUNT - 1 : selectedSlotIndex - 1,
    });
  }

  if (event === 'down') {
    return Object.freeze({
      action: 'move-selection',
      confirmedSlotIndex: null,
      event,
      previousSlotIndex: selectedSlotIndex,
      selectedSlotIndex: selectedSlotIndex === SAVE_SLOT_UI_SLOT_COUNT - 1 ? 0 : selectedSlotIndex + 1,
    });
  }

  if (event === 'confirm') {
    const selectedSlot = slots[selectedSlotIndex];
    const action: SaveSlotUserInterfaceAction = mode === 'load' && selectedSlot.header === null ? 'blocked-empty-load' : `confirm-${mode}`;

    return Object.freeze({
      action,
      confirmedSlotIndex: action === 'blocked-empty-load' ? null : selectedSlotIndex,
      event,
      previousSlotIndex: selectedSlotIndex,
      selectedSlotIndex,
    });
  }

  return Object.freeze({
    action: 'none',
    confirmedSlotIndex: null,
    event,
    previousSlotIndex: selectedSlotIndex,
    selectedSlotIndex,
  });
}

/**
 * Build deterministic save-slot menu state for the Bun playable command path.
 * @param input Runtime command, menu mode, selected slot, slot headers, and one menu event.
 * @returns Frozen display slots plus replay evidence for deterministic verification.
 * @example
 * ```ts
 * const result = implementSaveSlotUi({
 *   event: 'idle',
 *   mode: 'save',
 *   runtimeCommand: 'bun run doom.ts',
 *   selectedSlotIndex: 0,
 *   slots: [0, 1, 2, 3, 4, 5].map((slotIndex) => ({
 *     header: null,
 *     slotIndex,
 *   })),
 * });
 * ```
 */
export function implementSaveSlotUi(input: ImplementSaveSlotUiInput): ImplementSaveSlotUiResult {
  assertRuntimeCommand(input.runtimeCommand);
  assertSaveSlotUserInterfaceEvent(input.event);
  assertSaveSlotUserInterfaceMode(input.mode);
  assertSlotIndex(input.selectedSlotIndex);
  assertSlots(input.slots);

  const transition = createTransition(input.event, input.mode, input.selectedSlotIndex, input.slots);
  const displaySlots = Object.freeze(input.slots.map((slot) => createDisplaySlot(slot, transition.selectedSlotIndex)));
  const signature = createReplaySignature(input.mode, transition, displaySlots);

  return Object.freeze({
    mode: input.mode,
    replayEvidence: Object.freeze({
      auditStepId: IMPLEMENT_SAVE_SLOT_UI_AUDIT_STEP_ID,
      checksum: computeReplayChecksum(signature),
      deterministic: true,
      signature,
    }),
    runtimeCommand: IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND,
    selectedSlotIndex: transition.selectedSlotIndex,
    slots: displaySlots,
    transition,
  });
}
