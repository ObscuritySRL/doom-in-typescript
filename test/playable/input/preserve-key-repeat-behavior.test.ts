import { describe, expect, it } from 'bun:test';

import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { KEY_RIGHTARROW } from '../../../src/input/keyboard.ts';
import { LONG_PARAMETER_PREVIOUS_STATE_FLAG, LONG_PARAMETER_REPEAT_COUNT_MASK, PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT, preserveKeyRepeatBehavior } from '../../../src/playable/input/preserveKeyRepeatBehavior.ts';

const EXPECTED_CONTRACT_HASH = '5b6e5aeeb9d95efeebb8fd84aa5e0f3df5e11952f46ad7ec74635517caeaf196';

function createMessageLongParameter(scanCode: number, repeatCount: number, options?: { readonly extendedKey?: boolean; readonly previousState?: boolean }): number {
  const extendedKeyFlag = options?.extendedKey === true ? 0x0100_0000 : 0;
  const previousStateFlag = options?.previousState === true ? LONG_PARAMETER_PREVIOUS_STATE_FLAG : 0;

  return (repeatCount & LONG_PARAMETER_REPEAT_COUNT_MASK) | ((scanCode & 0xff) << 16) | extendedKeyFlag | previousStateFlag;
}

function hashContract(): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT)).digest('hex');
}

describe('preserveKeyRepeatBehavior', () => {
  it('locks the exact runtime contract', () => {
    expect(PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT).toEqual({
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
      supportedEventTypes: ['keydown'],
      ticCommandSize: TICCMD_SIZE,
      translationFunctions: ['extractScanCode', 'isExtendedKey', 'translateScanCode'],
      unmappedPolicy: 'drop',
    });
    expect(Object.isFrozen(PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT)).toBe(true);
    expect(Object.isFrozen(PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT.supportedEventTypes)).toBe(true);
    expect(Object.isFrozen(PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT.translationFunctions)).toBe(true);
    expect(Object.isFrozen(PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT.neutralTicCommand)).toBe(true);
  });

  it('locks the contract hash', () => {
    expect(hashContract()).toBe(EXPECTED_CONTRACT_HASH);
  });

  it('stays linked to the audited missing-input manifest', async () => {
    const auditManifest = await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').json();
    const explicitNullSurface = auditManifest.explicitNullSurfaces.find((surface: { readonly reason: string; readonly surface: string }) => {
      return surface.surface === PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT.auditSurface;
    });

    expect(auditManifest.stepId).toBe(PRESERVE_KEY_REPEAT_BEHAVIOR_CONTRACT.auditManifestStepId);
    expect(explicitNullSurface).toEqual({
      evidence: 'src/main.ts imports CommandLine for CLI parsing only and contains no keyboard or mouse event source.',
      path: null,
      reason: 'No live keyboard or mouse event source is visible within the 01-010 read scope.',
      surface: 'input-event-source',
      symbol: null,
    });
  });

  it('expands repeated keydown counts without deduping', () => {
    const preservedRepeatedKeydowns = preserveKeyRepeatBehavior({
      eventMessages: [{ eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x1e, 3) }],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(preservedRepeatedKeydowns).toEqual([
      {
        doomKey: 0x61,
        eventType: 'keydown',
        extendedKey: false,
        isRepeat: false,
        messageRepeatCount: 3,
        repeatOrdinalWithinMessage: 1,
        scanCode: 0x1e,
      },
      {
        doomKey: 0x61,
        eventType: 'keydown',
        extendedKey: false,
        isRepeat: true,
        messageRepeatCount: 3,
        repeatOrdinalWithinMessage: 2,
        scanCode: 0x1e,
      },
      {
        doomKey: 0x61,
        eventType: 'keydown',
        extendedKey: false,
        isRepeat: true,
        messageRepeatCount: 3,
        repeatOrdinalWithinMessage: 3,
        scanCode: 0x1e,
      },
    ]);
    expect(Object.isFrozen(preservedRepeatedKeydowns)).toBe(true);
    expect(Object.isFrozen(preservedRepeatedKeydowns[0])).toBe(true);
  });

  it('keeps mapped repeated messages in order while dropping unmapped scan codes', () => {
    const preservedRepeatedKeydowns = preserveKeyRepeatBehavior({
      eventMessages: [
        { eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x00, 2) },
        { eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x4d, 1, { extendedKey: true, previousState: true }) },
      ],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(preservedRepeatedKeydowns).toEqual([
      {
        doomKey: KEY_RIGHTARROW,
        eventType: 'keydown',
        extendedKey: true,
        isRepeat: true,
        messageRepeatCount: 1,
        repeatOrdinalWithinMessage: 1,
        scanCode: 0x4d,
      },
    ]);
  });

  it('rejects a non-Bun runtime command', () => {
    expect(() => {
      preserveKeyRepeatBehavior({
        eventMessages: [{ eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x1e, 1) }],
        runtimeCommand: 'bun run src/main.ts',
      });
    }).toThrow('preserve-key-repeat-behavior requires bun run doom.ts');
  });

  it('rejects zero repeat counts', () => {
    expect(() => {
      preserveKeyRepeatBehavior({
        eventMessages: [{ eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x1e, 0) }],
        runtimeCommand: 'bun run doom.ts',
      });
    }).toThrow('Key repeat messages must report a repeat count of at least 1.');
  });

  it('returns a frozen empty result for an empty event message list', () => {
    const preservedRepeatedKeydowns = preserveKeyRepeatBehavior({
      eventMessages: [],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(preservedRepeatedKeydowns).toEqual([]);
    expect(Object.isFrozen(preservedRepeatedKeydowns)).toBe(true);
  });

  it('marks every expansion as a repeat when the previous-state flag is set', () => {
    const preservedRepeatedKeydowns = preserveKeyRepeatBehavior({
      eventMessages: [{ eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x1e, 3, { previousState: true }) }],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(preservedRepeatedKeydowns.map((event) => ({ ordinal: event.repeatOrdinalWithinMessage, isRepeat: event.isRepeat }))).toEqual([
      { ordinal: 1, isRepeat: true },
      { ordinal: 2, isRepeat: true },
      { ordinal: 3, isRepeat: true },
    ]);
    for (const event of preservedRepeatedKeydowns) {
      expect(Object.isFrozen(event)).toBe(true);
    }
  });

  it('expands the maximum 16-bit repeat count without truncating arrivals', () => {
    const maxRepeatCount = LONG_PARAMETER_REPEAT_COUNT_MASK;
    const preservedRepeatedKeydowns = preserveKeyRepeatBehavior({
      eventMessages: [{ eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x1e, maxRepeatCount) }],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(preservedRepeatedKeydowns.length).toBe(maxRepeatCount);
    expect(preservedRepeatedKeydowns[0]).toEqual({
      doomKey: 0x61,
      eventType: 'keydown',
      extendedKey: false,
      isRepeat: false,
      messageRepeatCount: maxRepeatCount,
      repeatOrdinalWithinMessage: 1,
      scanCode: 0x1e,
    });
    expect(preservedRepeatedKeydowns[maxRepeatCount - 1]).toEqual({
      doomKey: 0x61,
      eventType: 'keydown',
      extendedKey: false,
      isRepeat: true,
      messageRepeatCount: maxRepeatCount,
      repeatOrdinalWithinMessage: maxRepeatCount,
      scanCode: 0x1e,
    });
  });

  it('preserves arrival order across mixed mapped and unmapped messages', () => {
    const preservedRepeatedKeydowns = preserveKeyRepeatBehavior({
      eventMessages: [
        { eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x1e, 2) },
        { eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x00, 5) },
        { eventType: 'keydown', messageLongParameter: createMessageLongParameter(0x4d, 1, { extendedKey: true }) },
      ],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(preservedRepeatedKeydowns.map((event) => ({ doomKey: event.doomKey, ordinal: event.repeatOrdinalWithinMessage, scan: event.scanCode }))).toEqual([
      { doomKey: 0x61, ordinal: 1, scan: 0x1e },
      { doomKey: 0x61, ordinal: 2, scan: 0x1e },
      { doomKey: KEY_RIGHTARROW, ordinal: 1, scan: 0x4d },
    ]);
    for (const event of preservedRepeatedKeydowns) {
      expect(Object.isFrozen(event)).toBe(true);
    }
  });
});
