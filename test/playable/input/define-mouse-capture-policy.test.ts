import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { defineMouseCapturePolicy, DEFINE_MOUSE_CAPTURE_POLICY_CONTRACT, DEFINE_MOUSE_CAPTURE_POLICY_CONTRACT_HASH } from '../../../src/playable/input/defineMouseCapturePolicy.ts';

interface MissingLiveInputManifest {
  readonly commandContracts: {
    readonly target: {
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly reason: string;
    readonly surface: string;
  }[];
  readonly stepId: string;
}

function isMissingLiveInputManifest(value: unknown): value is MissingLiveInputManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const manifest = value as {
    readonly commandContracts?: {
      readonly target?: {
        readonly runtimeCommand?: unknown;
      };
    };
    readonly explicitNullSurfaces?: unknown;
    readonly stepId?: unknown;
  };

  if (manifest.stepId !== '01-010') {
    return false;
  }

  if (manifest.commandContracts?.target?.runtimeCommand !== 'bun run doom.ts') {
    return false;
  }

  if (!Array.isArray(manifest.explicitNullSurfaces)) {
    return false;
  }

  return manifest.explicitNullSurfaces.every((surface) => {
    if (typeof surface !== 'object' || surface === null) {
      return false;
    }

    const candidate = surface as {
      readonly reason?: unknown;
      readonly surface?: unknown;
    };

    return typeof candidate.reason === 'string' && typeof candidate.surface === 'string';
  });
}

describe('defineMouseCapturePolicy', () => {
  test('locks the exact contract and stable contract hash', () => {
    expect(DEFINE_MOUSE_CAPTURE_POLICY_CONTRACT).toEqual({
      auditedMissingSurface: {
        stepId: '01-010',
        surface: 'mouse-capture-policy',
      },
      captureRule: {
        capturedWhen: 'gameplay-window-focused',
        releasedWhen: ['deterministic-replay', 'menu-active', 'window-unfocused'],
      },
      hostBehavior: {
        clipCursorWhenCaptured: true,
        hideCursorWhenCaptured: true,
      },
      replayCompatibility: {
        neutralTicCommandBytes: TICCMD_SIZE,
        usesNeutralTicCommand: true,
      },
      runtimeCommand: 'bun run doom.ts',
    });

    const contractHash = createHash('sha256').update(JSON.stringify(DEFINE_MOUSE_CAPTURE_POLICY_CONTRACT)).digest('hex');

    expect(contractHash).toBe('db700e957f7d5d1760f732aea463d5f4360cf4ada756d209cc645db6834c0eed');
    expect(DEFINE_MOUSE_CAPTURE_POLICY_CONTRACT_HASH).toBe('db700e957f7d5d1760f732aea463d5f4360cf4ada756d209cc645db6834c0eed');
  });

  test('stays linked to the 01-010 missing mouse capture audit surface', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').text();
    const manifestValue = JSON.parse(manifestText) as unknown;

    expect(isMissingLiveInputManifest(manifestValue)).toBe(true);

    if (!isMissingLiveInputManifest(manifestValue)) {
      return;
    }

    expect(manifestValue.stepId).toBe('01-010');
    expect(manifestValue.commandContracts.target.runtimeCommand).toBe(DEFINE_MOUSE_CAPTURE_POLICY_CONTRACT.runtimeCommand);
    expect(manifestValue.explicitNullSurfaces.some((surface) => surface.reason === 'No mouse capture or release policy is visible within the 01-010 read scope.' && surface.surface === 'mouse-capture-policy')).toBe(true);
  });

  test('captures the mouse for focused gameplay only', () => {
    expect(
      defineMouseCapturePolicy({
        hasWindowFocus: true,
        inputOwner: 'gameplay',
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      captureMode: 'captured',
      policyReason: 'gameplay-focus',
      replaySafeTicCommand: EMPTY_TICCMD,
      replaySafeTicCommandBytes: TICCMD_SIZE,
      shouldClipCursorToWindow: true,
      shouldHideCursor: true,
    });
  });

  test('releases the mouse for focused menu input', () => {
    expect(
      defineMouseCapturePolicy({
        hasWindowFocus: true,
        inputOwner: 'menu',
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      captureMode: 'released',
      policyReason: 'menu-active',
      replaySafeTicCommand: EMPTY_TICCMD,
      replaySafeTicCommandBytes: TICCMD_SIZE,
      shouldClipCursorToWindow: false,
      shouldHideCursor: false,
    });
  });

  test('releases the mouse during deterministic replay', () => {
    expect(
      defineMouseCapturePolicy({
        hasWindowFocus: true,
        inputOwner: 'deterministic-replay',
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      captureMode: 'released',
      policyReason: 'deterministic-replay',
      replaySafeTicCommand: EMPTY_TICCMD,
      replaySafeTicCommandBytes: TICCMD_SIZE,
      shouldClipCursorToWindow: false,
      shouldHideCursor: false,
    });
  });

  test('releases the mouse on focus loss without mutating replay state', () => {
    expect(
      defineMouseCapturePolicy({
        hasWindowFocus: false,
        inputOwner: 'gameplay',
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      captureMode: 'released',
      policyReason: 'focus-loss',
      replaySafeTicCommand: EMPTY_TICCMD,
      replaySafeTicCommandBytes: TICCMD_SIZE,
      shouldClipCursorToWindow: false,
      shouldHideCursor: false,
    });
  });

  test('keeps focus-loss priority over deterministic replay when focus and replay coincide', () => {
    expect(
      defineMouseCapturePolicy({
        hasWindowFocus: false,
        inputOwner: 'deterministic-replay',
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      captureMode: 'released',
      policyReason: 'focus-loss',
      replaySafeTicCommand: EMPTY_TICCMD,
      replaySafeTicCommandBytes: TICCMD_SIZE,
      shouldClipCursorToWindow: false,
      shouldHideCursor: false,
    });
  });

  test('keeps focus-loss priority over an active menu when focus and menu coincide', () => {
    expect(
      defineMouseCapturePolicy({
        hasWindowFocus: false,
        inputOwner: 'menu',
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      captureMode: 'released',
      policyReason: 'focus-loss',
      replaySafeTicCommand: EMPTY_TICCMD,
      replaySafeTicCommandBytes: TICCMD_SIZE,
      shouldClipCursorToWindow: false,
      shouldHideCursor: false,
    });
  });

  test('rejects non-doom runtime commands and reports the received value', () => {
    expect(() =>
      defineMouseCapturePolicy({
        hasWindowFocus: true,
        inputOwner: 'gameplay',
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('defineMouseCapturePolicy requires `bun run doom.ts`. Received `bun run src/main.ts`.');
  });
});
