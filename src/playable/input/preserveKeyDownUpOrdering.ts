import type { TicCommand } from '../../input/ticcmd.ts';

import { EMPTY_TICCMD, TICCMD_SIZE } from '../../input/ticcmd.ts';
import { extractScanCode, isExtendedKey, translateScanCode } from '../../input/keyboard.ts';

const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';
const SUPPORTED_EVENT_TYPES = Object.freeze(['keydown', 'keyup'] as const);

export type PreserveKeyDownUpOrderingEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

export interface PreserveKeyDownUpOrderingInputEvent {
  readonly eventType: string;
  readonly lparam: number;
}

export interface OrderedDoomKeyEvent {
  readonly doomKey: number;
  readonly eventType: PreserveKeyDownUpOrderingEventType;
  readonly extendedKey: boolean;
  readonly inputIndex: number;
  readonly scanCode: number;
}

export interface PreserveKeyDownUpOrderingResult {
  readonly orderedEvents: readonly OrderedDoomKeyEvent[];
  readonly ticCommandSize: number;
  readonly ticCommandTemplate: TicCommand;
}

export const PRESERVE_KEY_DOWN_UP_ORDERING_CONTRACT = Object.freeze({
  auditStepId: '01-010',
  auditSurface: 'per-tic-input-accumulation',
  orderingPolicy: Object.freeze({
    deduplicateEvents: false,
    dropUnmappedEvents: true,
    preserveArrivalOrder: true,
    reorderByKeyState: false,
    sortByTimestamp: false,
  }),
  runtimeCommand: REQUIRED_RUNTIME_COMMAND,
  sourceModules: Object.freeze({
    keyboard: 'src/input/keyboard.ts',
    ticCommand: 'src/input/ticcmd.ts',
  }),
  stepId: '06-004',
  stepTitle: 'preserve-key-down-up-ordering',
  supportedEventTypes: SUPPORTED_EVENT_TYPES,
  ticCommandNeutralState: Object.freeze({
    buttons: EMPTY_TICCMD.buttons,
    forwardmove: EMPTY_TICCMD.forwardmove,
    sidemove: EMPTY_TICCMD.sidemove,
    size: TICCMD_SIZE,
  }),
});

function isSupportedEventType(value: string): value is PreserveKeyDownUpOrderingEventType {
  return value === 'keydown' || value === 'keyup';
}

export function preserveKeyDownUpOrdering(runtimeCommand: string, inputEvents: readonly PreserveKeyDownUpOrderingInputEvent[]): PreserveKeyDownUpOrderingResult {
  if (runtimeCommand !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error(`preserveKeyDownUpOrdering requires ${REQUIRED_RUNTIME_COMMAND}`);
  }

  const orderedEvents: OrderedDoomKeyEvent[] = [];

  for (const [inputIndex, inputEvent] of inputEvents.entries()) {
    if (!isSupportedEventType(inputEvent.eventType)) {
      throw new Error(`Unsupported key event type: ${inputEvent.eventType}`);
    }

    const doomKey = translateScanCode(inputEvent.lparam);

    if (doomKey === 0) {
      continue;
    }

    orderedEvents.push(
      Object.freeze({
        doomKey,
        eventType: inputEvent.eventType,
        extendedKey: isExtendedKey(inputEvent.lparam),
        inputIndex,
        scanCode: extractScanCode(inputEvent.lparam),
      }),
    );
  }

  return Object.freeze({
    orderedEvents: Object.freeze(orderedEvents),
    ticCommandSize: TICCMD_SIZE,
    ticCommandTemplate: EMPTY_TICCMD,
  });
}
