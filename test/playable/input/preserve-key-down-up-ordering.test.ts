import { expect, test } from 'bun:test';

import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { KEY_PGUP, KEY_UPARROW, LPARAM_EXTENDED_FLAG, LPARAM_SCANCODE_SHIFT } from '../../../src/input/keyboard.ts';
import { PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT, preserveKeyDownUpOrdering } from '../../../src/playable/input/preserveKeyDownUpOrdering.ts';

type MissingLiveInputManifest = {
  readonly commandContracts: {
    readonly target: {
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly surface: string;
  }[];
  readonly stepId: string;
};

const EXPECTED_CONTRACT_HASH = '0d1edc32c82b9d0cd5b745c4a65bdc10829bea6f86a358002dce2a41c7fe9d19';
const missingLiveInputManifest = (await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').json()) as MissingLiveInputManifest;

function createLparam(scanCode: number, extendedKey = false): number {
  return (scanCode << LPARAM_SCANCODE_SHIFT) | (extendedKey ? LPARAM_EXTENDED_FLAG : 0);
}

test('exports the exact contract and stable hash', () => {
  const expectedContract = {
    auditStepId: '01-010',
    auditSurface: 'per-tic-input-accumulation',
    orderingPolicy: {
      deduplicateEvents: false,
      dropUnmappedEvents: true,
      preserveArrivalOrder: true,
      reorderByKeyState: false,
      sortByTimestamp: false,
    },
    runtimeCommand: 'bun run doom.ts',
    sourceModules: {
      keyboard: 'src/input/keyboard.ts',
      ticCommand: 'src/input/ticcmd.ts',
    },
    stepId: '06-004',
    stepTitle: 'preserve-key-down-up-ordering',
    supportedEventTypes: ['keydown', 'keyup'],
    ticCommandNeutralState: {
      buttons: 0,
      forwardmove: 0,
      sidemove: 0,
      size: TICCMD_SIZE,
    },
  } satisfies typeof PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT;

  expect(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT).toEqual(expectedContract);
  expect(Object.isFrozen(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT)).toBe(true);
  expect(Object.isFrozen(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT.orderingPolicy)).toBe(true);
  expect(Object.isFrozen(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT.sourceModules)).toBe(true);
  expect(Object.isFrozen(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT.supportedEventTypes)).toBe(true);
  expect(Object.isFrozen(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT.ticCommandNeutralState)).toBe(true);

  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT));

  expect(hasher.digest('hex')).toBe(EXPECTED_CONTRACT_HASH);
});

test('matches the audited runtime command and missing input surface', () => {
  expect(missingLiveInputManifest.stepId).toBe(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT.auditStepId);
  expect(missingLiveInputManifest.commandContracts.target.runtimeCommand).toBe(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT.runtimeCommand);
  expect(missingLiveInputManifest.explicitNullSurfaces.map(({ surface }) => surface)).toContain(PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT.auditSurface);
});

test('preserves keydown and keyup arrival order for mapped keys', () => {
  const result = preserveKeyDownUpOrdering('bun run doom.ts', [
    { eventType: 'keydown', lparam: createLparam(0x11) },
    { eventType: 'keyup', lparam: createLparam(0x11) },
    { eventType: 'keydown', lparam: createLparam(0x20) },
    { eventType: 'keyup', lparam: createLparam(0x20) },
  ]);

  expect(result).toEqual({
    orderedEvents: [
      { doomKey: 0x77, eventType: 'keydown', extendedKey: false, inputIndex: 0, scanCode: 0x11 },
      { doomKey: 0x77, eventType: 'keyup', extendedKey: false, inputIndex: 1, scanCode: 0x11 },
      { doomKey: 0x64, eventType: 'keydown', extendedKey: false, inputIndex: 2, scanCode: 0x20 },
      { doomKey: 0x64, eventType: 'keyup', extendedKey: false, inputIndex: 3, scanCode: 0x20 },
    ],
    ticCommandSize: TICCMD_SIZE,
    ticCommandTemplate: EMPTY_TICCMD,
  });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.orderedEvents)).toBe(true);
  expect(result.ticCommandTemplate).toBe(EMPTY_TICCMD);

  for (const orderedEvent of result.orderedEvents) {
    expect(Object.isFrozen(orderedEvent)).toBe(true);
  }
});

test('drops unmapped scan codes without reordering mapped transitions', () => {
  const result = preserveKeyDownUpOrdering('bun run doom.ts', [
    { eventType: 'keyup', lparam: createLparam(0x49, true) },
    { eventType: 'keydown', lparam: createLparam(0x59) },
    { eventType: 'keydown', lparam: createLparam(0x48, true) },
  ]);

  expect(result.orderedEvents).toEqual([
    { doomKey: KEY_PGUP, eventType: 'keyup', extendedKey: true, inputIndex: 0, scanCode: 0x49 },
    { doomKey: KEY_UPARROW, eventType: 'keydown', extendedKey: true, inputIndex: 2, scanCode: 0x48 },
  ]);
  expect(result.ticCommandSize).toBe(TICCMD_SIZE);
  expect(result.ticCommandTemplate).toBe(EMPTY_TICCMD);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.orderedEvents)).toBe(true);
});

test('returns a frozen empty result for an empty event list', () => {
  const result = preserveKeyDownUpOrdering('bun run doom.ts', []);

  expect(result.orderedEvents).toEqual([]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.orderedEvents)).toBe(true);
  expect(result.ticCommandSize).toBe(TICCMD_SIZE);
  expect(result.ticCommandTemplate).toBe(EMPTY_TICCMD);
});

test('rejects the wrong runtime command', () => {
  expect(() => preserveKeyDownUpOrdering('bun run src/main.ts', [])).toThrow('preserveKeyDownUpOrdering requires bun run doom.ts');
});

test('rejects unsupported key event types', () => {
  expect(() => preserveKeyDownUpOrdering('bun run doom.ts', [{ eventType: 'keypress', lparam: createLparam(0x11) }])).toThrow('Unsupported key event type: keypress');
});

test('throws on the first unsupported event type even when valid events precede it', () => {
  expect(() =>
    preserveKeyDownUpOrdering('bun run doom.ts', [
      { eventType: 'keydown', lparam: createLparam(0x11) },
      { eventType: 'keyup', lparam: createLparam(0x11) },
      { eventType: 'wm_char', lparam: createLparam(0x20) },
      { eventType: 'keyup', lparam: createLparam(0x20) },
    ]),
  ).toThrow('Unsupported key event type: wm_char');
});
