import { describe, expect, test } from 'bun:test';

import { KEY_UPARROW, LPARAM_EXTENDED_FLAG } from '../../../src/input/keyboard.ts';
import { translateKeyboardEvents, translateKeyboardEventsContract } from '../../../src/playable/input/translateKeyboardEvents.ts';

interface MissingLiveInputManifest {
  readonly commandContracts: {
    readonly target: {
      readonly entryPoint: string;
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly evidence: string;
    readonly path: null;
    readonly reason: string;
    readonly surface: string;
    readonly symbol: null;
  }[];
  readonly stepId: string;
  readonly stepTitle: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMissingLiveInputManifest(value: unknown): value is MissingLiveInputManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;
  const explicitNullSurfaces = value.explicitNullSurfaces;

  if (!isRecord(commandContracts) || !Array.isArray(explicitNullSurfaces)) {
    return false;
  }

  const target = commandContracts.target;
  if (!isRecord(target)) {
    return false;
  }

  if (typeof target.entryPoint !== 'string' || typeof target.runtimeCommand !== 'string') {
    return false;
  }

  if (typeof value.stepId !== 'string' || typeof value.stepTitle !== 'string') {
    return false;
  }

  return explicitNullSurfaces.every((surface) => {
    return isRecord(surface) && typeof surface.evidence === 'string' && surface.path === null && typeof surface.reason === 'string' && typeof surface.surface === 'string' && surface.symbol === null;
  });
}

async function createSha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadMissingLiveInputManifest(): Promise<MissingLiveInputManifest> {
  const manifestValue: unknown = await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').json();
  if (!isMissingLiveInputManifest(manifestValue)) {
    throw new Error('01-010 manifest has an unexpected schema.');
  }
  return manifestValue;
}

describe('translateKeyboardEvents', () => {
  test('locks the exact contract value', () => {
    expect(translateKeyboardEventsContract).toEqual({
      commandContract: {
        entryPoint: 'doom.ts',
        runtimeCommand: 'bun run doom.ts',
      },
      deterministicReplay: {
        eventFields: ['doomKey', 'eventType', 'extendedKey', 'scanCode'],
        reason: 'Keyboard translation stays discrete and timestamp-free until later ticcmd packing.',
        ticCommandAuthority: {
          file: 'src/input/ticcmd.ts',
          packFunction: 'packTicCommand',
        },
      },
      keyboardAuthority: {
        extendedKeyFunction: 'isExtendedKey',
        file: 'src/input/keyboard.ts',
        scanCodeFunction: 'extractScanCode',
        translateFunction: 'translateScanCode',
      },
      stepId: '06-001',
      stepTitle: 'translate-keyboard-events',
    });
  });

  test('locks the stable contract hash', async () => {
    const contractHash = await createSha256Hex(JSON.stringify(translateKeyboardEventsContract));
    expect(contractHash).toBe('7df15c504828b26d3bcef06aec7831b20bb633c3ef0166e8b20e0967b60939da');
  });

  test('locks the audited Bun command contract and missing key-translation surface', async () => {
    const missingLiveInputManifest = await loadMissingLiveInputManifest();
    const keyTranslationSurface = missingLiveInputManifest.explicitNullSurfaces.find((surface) => surface.surface === 'key-translation-table');

    expect(missingLiveInputManifest.commandContracts.target).toEqual({
      entryPoint: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(missingLiveInputManifest.stepId).toBe('01-010');
    expect(missingLiveInputManifest.stepTitle).toBe('audit-missing-live-input');
    expect(keyTranslationSurface).toEqual({
      evidence: 'src/main.ts HELP_TEXT documents control labels but defines no Doom key mapping table.',
      path: null,
      reason: 'No key translation table is visible within the 01-010 read scope.',
      surface: 'key-translation-table',
      symbol: null,
    });
  });

  test('translates a Bun-path keydown into a replay-safe Doom key event', () => {
    const translatedEvent = translateKeyboardEvents({
      eventType: 'keydown',
      messageParameter: (0x48 << 16) | LPARAM_EXTENDED_FLAG,
      runtimeCommand: 'bun run doom.ts',
    });

    expect(translatedEvent).toEqual({
      doomKey: KEY_UPARROW,
      eventType: 'keydown',
      extendedKey: true,
      scanCode: 0x48,
    });
  });

  test('returns null for unmapped scan codes without inventing input', () => {
    const translatedEvent = translateKeyboardEvents({
      eventType: 'keyup',
      messageParameter: 0,
      runtimeCommand: 'bun run doom.ts',
    });

    expect(translatedEvent).toBeNull();
  });

  test('rejects callers outside the Bun runtime command contract', () => {
    expect(() =>
      translateKeyboardEvents({
        eventType: 'keydown',
        messageParameter: 0x001e_0000,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('translateKeyboardEvents requires `bun run doom.ts`.');
  });

  test('rejects unsupported event types', () => {
    expect(() =>
      translateKeyboardEvents({
        eventType: 'keypress',
        messageParameter: 0x001e_0000,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toThrow('translateKeyboardEvents received unsupported event type: keypress');
  });
});
