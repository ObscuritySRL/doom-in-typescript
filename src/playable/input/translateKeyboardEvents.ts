import { extractScanCode, isExtendedKey, translateScanCode } from '../../input/keyboard.ts';

export type TranslatedKeyboardEventType = 'keydown' | 'keyup';

export interface TranslateKeyboardEventsRequest {
  readonly eventType: string;
  readonly messageParameter: number;
  readonly runtimeCommand: string;
}

export interface TranslatedKeyboardEvent {
  readonly doomKey: number;
  readonly eventType: TranslatedKeyboardEventType;
  readonly extendedKey: boolean;
  readonly scanCode: number;
}

export const translateKeyboardEventsContract = Object.freeze({
  commandContract: Object.freeze({
    entryPoint: 'doom.ts',
    runtimeCommand: 'bun run doom.ts',
  }),
  deterministicReplay: Object.freeze({
    eventFields: Object.freeze(['doomKey', 'eventType', 'extendedKey', 'scanCode'] as const),
    reason: 'Keyboard translation stays discrete and timestamp-free until later ticcmd packing.',
    ticCommandAuthority: Object.freeze({
      file: 'src/input/ticcmd.ts',
      packFunction: 'packTicCommand',
    }),
  }),
  keyboardAuthority: Object.freeze({
    extendedKeyFunction: 'isExtendedKey',
    file: 'src/input/keyboard.ts',
    scanCodeFunction: 'extractScanCode',
    translateFunction: 'translateScanCode',
  }),
  stepId: '06-001',
  stepTitle: 'translate-keyboard-events',
} as const);

export function translateKeyboardEvents({ eventType, messageParameter, runtimeCommand }: TranslateKeyboardEventsRequest): TranslatedKeyboardEvent | null {
  if (runtimeCommand !== translateKeyboardEventsContract.commandContract.runtimeCommand) {
    throw new Error('translateKeyboardEvents requires `bun run doom.ts`.');
  }

  if (eventType !== 'keydown' && eventType !== 'keyup') {
    throw new Error(`translateKeyboardEvents received unsupported event type: ${eventType}`);
  }

  const scanCode = extractScanCode(messageParameter);
  const doomKey = translateScanCode(messageParameter);

  if (doomKey === 0) {
    return null;
  }

  return Object.freeze({
    doomKey,
    eventType,
    extendedKey: isExtendedKey(messageParameter),
    scanCode,
  });
}
