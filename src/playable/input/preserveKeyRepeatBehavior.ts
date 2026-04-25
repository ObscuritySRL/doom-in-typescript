import { EMPTY_TICCMD, TICCMD_SIZE } from '../../input/ticcmd.ts';
import { extractScanCode, isExtendedKey, translateScanCode } from '../../input/keyboard.ts';

export const LONG_PARAMETER_REPEAT_COUNT_MASK = 0x0000_ffff;
export const LONG_PARAMETER_PREVIOUS_STATE_FLAG = 0x4000_0000;

export interface KeyRepeatMessage {
  readonly eventType: 'keydown';
  readonly messageLongParameter: number;
}

export interface PreserveKeyRepeatBehaviorRequest {
  readonly eventMessages: readonly KeyRepeatMessage[];
  readonly runtimeCommand: string;
}

export interface PreservedRepeatedKeydown {
  readonly doomKey: number;
  readonly eventType: 'keydown';
  readonly extendedKey: boolean;
  readonly isRepeat: boolean;
  readonly messageRepeatCount: number;
  readonly repeatOrdinalWithinMessage: number;
  readonly scanCode: number;
}

export const PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT = Object.freeze({
  auditManifestStepId: '01-010',
  auditSurface: 'input-event-source',
  neutralTicCommand: EMPTY_TICCMD,
  repeatCountMask: LONG_PARAMETER_REPEAT_COUNT_MASK,
  repeatExpansionPolicy: 'expand Win32 keydown repeat counts into repeated arrivals without deduping',
  repeatStateFlag: LONG_PARAMETER_PREVIOUS_STATE_FLAG,
  replayCompatibility: 'Preserve repeated keydown arrivals without mutating tic accumulation or timestamps.',
  runtimeCommand: 'bun run doom.ts',
  stepId: '06-005',
  stepTitle: 'preserve-key-repeat-behavior',
  supportedEventTypes: Object.freeze(['keydown'] as const),
  ticCommandSize: TICCMD_SIZE,
  translationFunctions: Object.freeze(['extractScanCode', 'isExtendedKey', 'translateScanCode'] as const),
  unmappedPolicy: 'drop',
});

function extractRepeatCount(messageLongParameter: number): number {
  return messageLongParameter & LONG_PARAMETER_REPEAT_COUNT_MASK;
}

/**
 * Preserve Win32 key-repeat behavior for the Bun-run playable input path.
 *
 * @param request - Bun runtime command plus Win32 keydown messages.
 * @returns Frozen repeated keydown arrivals in source order.
 * @example
 * ```ts
 * const repeatedKeydowns = preserveKeyRepeatBehavior({
 *   eventMessages: [{ eventType: "keydown", messageLongParameter: 0x001e0003 }],
 *   runtimeCommand: "bun run doom.ts",
 * });
 * ```
 */
export function preserveKeyRepeatBehavior(request: PreserveKeyRepeatBehaviorRequest): readonly PreservedRepeatedKeydown[] {
  if (request.runtimeCommand !== PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT.runtimeCommand) {
    throw new Error(`preserve-key-repeat-behavior requires ${PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT.runtimeCommand}`);
  }

  const preservedRepeatedKeydowns: PreservedRepeatedKeydown[] = [];

  for (const eventMessage of request.eventMessages) {
    if (eventMessage.eventType !== 'keydown') {
      throw new Error(`Unsupported event type: ${eventMessage.eventType}`);
    }

    const repeatCount = extractRepeatCount(eventMessage.messageLongParameter);
    if (repeatCount < 1) {
      throw new Error('Key repeat messages must report a repeat count of at least 1.');
    }

    const doomKey = translateScanCode(eventMessage.messageLongParameter);
    if (doomKey === 0) {
      continue;
    }

    const extendedKey = isExtendedKey(eventMessage.messageLongParameter);
    const scanCode = extractScanCode(eventMessage.messageLongParameter);
    const wasPreviouslyDown = (eventMessage.messageLongParameter & LONG_PARAMETER_PREVIOUS_STATE_FLAG) !== 0;

    for (let repeatOrdinalWithinMessage = 1; repeatOrdinalWithinMessage <= repeatCount; repeatOrdinalWithinMessage += 1) {
      preservedRepeatedKeydowns.push(
        Object.freeze({
          doomKey,
          eventType: 'keydown',
          extendedKey,
          isRepeat: wasPreviouslyDown || repeatOrdinalWithinMessage > 1,
          messageRepeatCount: repeatCount,
          repeatOrdinalWithinMessage,
          scanCode,
        }),
      );
    }
  }

  return Object.freeze(preservedRepeatedKeydowns);
}
