import { expect, test } from 'bun:test';

import type { SaveSlotUserInterfaceSlotInput } from '../../../src/playable/save-load-playability/implementSaveSlotUi.ts';
import type { SaveGameHeader, SaveGamePlayerPresence } from '../../../src/save/saveHeader.ts';

import {
  IMPLEMENT_SAVE_SLOT_UI_AUDIT_STEP_ID,
  IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND,
  SAVE_SLOT_UI_DESCRIPTION_SIZE,
  SAVE_SLOT_UI_EMPTY_DESCRIPTION,
  SAVE_SLOT_UI_SLOT_COUNT,
  implementSaveSlotUi,
} from '../../../src/playable/save-load-playability/implementSaveSlotUi.ts';

function createHeader(description: string, gameepisode: number, gamemap: number, leveltime: number): SaveGameHeader {
  return Object.freeze({
    description,
    gameepisode,
    gamemap,
    gameskill: 2,
    leveltime,
    playeringame: createPlayerPresence(),
  });
}

function createPlayerPresence(): SaveGamePlayerPresence {
  const playeringame = [1, 0, 0, 0] satisfies SaveGamePlayerPresence;

  return Object.freeze(playeringame);
}

function createSlots(): SaveSlotUserInterfaceSlotInput[] {
  return [
    {
      header: createHeader('E1M1 ENTRYWAY', 1, 1, 1_750),
      slotIndex: 0,
    },
    {
      header: null,
      slotIndex: 1,
    },
    {
      header: createHeader('E1M2 NUKAGE', 1, 2, 3_500),
      slotIndex: 2,
    },
    {
      header: null,
      slotIndex: 3,
    },
    {
      header: null,
      slotIndex: 4,
    },
    {
      header: null,
      slotIndex: 5,
    },
  ];
}

async function readSourceHash(): Promise<string> {
  const sourceText = await Bun.file('src/playable/save-load-playability/implementSaveSlotUi.ts').text();
  const sourceHasher = new Bun.CryptoHasher('sha256');

  sourceHasher.update(sourceText);

  return sourceHasher.digest('hex');
}

test('locks the command contract, audit linkage, source hash, and save-slot transition evidence', async () => {
  const result = implementSaveSlotUi({
    event: 'down',
    mode: 'save',
    runtimeCommand: IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND,
    selectedSlotIndex: 0,
    slots: createSlots(),
  });

  expect(IMPLEMENT_SAVE_SLOT_UI_AUDIT_STEP_ID).toBe('01-013');
  expect(IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND).toBe('bun run doom.ts');
  expect(SAVE_SLOT_UI_DESCRIPTION_SIZE).toBe(24);
  expect(SAVE_SLOT_UI_SLOT_COUNT).toBe(6);
  expect(await readSourceHash()).toBe('3041378e85acd2c5039fbb62417886b34e8a35bf4bd256fb56a2dacb7e7eabc8');
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.replayEvidence)).toBe(true);
  expect(Object.isFrozen(result.slots)).toBe(true);
  expect(result.runtimeCommand).toBe('bun run doom.ts');
  expect(result.transition).toEqual({
    action: 'move-selection',
    confirmedSlotIndex: null,
    event: 'down',
    previousSlotIndex: 0,
    selectedSlotIndex: 1,
  });
  expect(result.slots).toEqual([
    {
      description: 'E1M1 ENTRYWAY',
      isSelected: false,
      levelTime: 1_750,
      mapName: 'E1M1',
      slotIndex: 0,
      status: 'occupied',
    },
    {
      description: SAVE_SLOT_UI_EMPTY_DESCRIPTION,
      isSelected: true,
      levelTime: null,
      mapName: null,
      slotIndex: 1,
      status: 'empty',
    },
    {
      description: 'E1M2 NUKAGE',
      isSelected: false,
      levelTime: 3_500,
      mapName: 'E1M2',
      slotIndex: 2,
      status: 'occupied',
    },
    {
      description: SAVE_SLOT_UI_EMPTY_DESCRIPTION,
      isSelected: false,
      levelTime: null,
      mapName: null,
      slotIndex: 3,
      status: 'empty',
    },
    {
      description: SAVE_SLOT_UI_EMPTY_DESCRIPTION,
      isSelected: false,
      levelTime: null,
      mapName: null,
      slotIndex: 4,
      status: 'empty',
    },
    {
      description: SAVE_SLOT_UI_EMPTY_DESCRIPTION,
      isSelected: false,
      levelTime: null,
      mapName: null,
      slotIndex: 5,
      status: 'empty',
    },
  ]);
  expect(result.replayEvidence).toEqual({
    auditStepId: '01-013',
    checksum: 485_798_341,
    deterministic: true,
    signature:
      'step=01-013;command=bun run doom.ts;mode=save;event=down;action=move-selection;from=0;to=1;confirm=none;slots=0:occupied:idle:E1M1 ENTRYWAY:E1M1:1750|1:empty:selected:EMPTY SLOT:none:none|2:occupied:idle:E1M2 NUKAGE:E1M2:3500|3:empty:idle:EMPTY SLOT:none:none|4:empty:idle:EMPTY SLOT:none:none|5:empty:idle:EMPTY SLOT:none:none',
  });
});

test('blocks loading an empty slot without confirming a replay action', () => {
  const result = implementSaveSlotUi({
    event: 'confirm',
    mode: 'load',
    runtimeCommand: IMPLEMENT_SAVE_SLOT_UI_RUNTIME_COMMAND,
    selectedSlotIndex: 1,
    slots: createSlots(),
  });

  expect(result.transition).toEqual({
    action: 'blocked-empty-load',
    confirmedSlotIndex: null,
    event: 'confirm',
    previousSlotIndex: 1,
    selectedSlotIndex: 1,
  });
  expect(result.replayEvidence.checksum).toBe(3_133_096_860);
});

test('rejects non-product runtime commands before reading malformed slot state', () => {
  expect(() =>
    implementSaveSlotUi({
      event: 'idle',
      mode: 'save',
      runtimeCommand: 'bun run src/main.ts',
      selectedSlotIndex: 0,
      slots: [],
    }),
  ).toThrow('save slot UI requires bun run doom.ts.');
});
