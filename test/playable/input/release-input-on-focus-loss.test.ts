import { describe, expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

import { KEY_ESCAPE, KEY_RIGHTARROW } from '../../../src/input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { RELEASE_INPUT_ON_FOCUS_LOSS_CONTRACT, releaseInputOnFocusLoss } from '../../../src/playable/input/releaseInputOnFocusLoss.ts';

interface ExplicitNullSurface {
  readonly reason: string;
  readonly surface: string;
}

interface MissingLiveInputManifest {
  readonly explicitNullSurfaces: readonly ExplicitNullSurface[];
  readonly stepId: string;
}

const AUDIT_MANIFEST_PATH = fileURLToPath(new URL('../../../plan_fps/manifests/01-010-audit-missing-live-input.json', import.meta.url));

const EXPECTED_CONTRACT_HASH = '46e022f1f3c4768e46852d1162d550bb4f4439be52b1aec8da46d094b4db281f';

function hashContract(): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(RELEASE_INPUT_ON_FOCUS_LOSS_CONTRACT));
  return hasher.digest('hex');
}

function isExplicitNullSurface(value: unknown): value is ExplicitNullSurface {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('reason' in value) || typeof value.reason !== 'string') {
    return false;
  }

  if (!('surface' in value) || typeof value.surface !== 'string') {
    return false;
  }

  return true;
}

function isMissingLiveInputManifest(value: unknown): value is MissingLiveInputManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('stepId' in value) || value.stepId !== '01-010') {
    return false;
  }

  if (!('explicitNullSurfaces' in value) || !Array.isArray(value.explicitNullSurfaces)) {
    return false;
  }

  return value.explicitNullSurfaces.every(isExplicitNullSurface);
}

describe('releaseInputOnFocusLoss', () => {
  test('locks the exact contract and stable hash', () => {
    expect(RELEASE_INPUT_ON_FOCUS_LOSS_CONTRACT).toEqual({
      auditManifestStepId: '01-010',
      auditMissingSurface: 'mouse-capture-policy',
      focusLossSignal: 'window-focus-lost',
      releaseTargets: ['held-doom-keys', 'held-mouse-buttons', 'pending-mouse-motion', 'mouse-capture'],
      replayCompatibility: {
        clearsPendingMouseMotion: true,
        preservesDeterministicReplay: true,
        returnsNeutralTicCommand: true,
        ticCommandSize: TICCMD_SIZE,
        usesMappedDoomKeysFromKeyboardTable: true,
        usesTimestamps: false,
      },
      runtimeCommand: 'bun run doom.ts',
      supportedMouseButtons: ['left', 'middle', 'right'],
      transition: {
        from: 'live-input-active',
        to: 'neutral-input-released',
        trigger: 'focus-loss',
      },
    });
    expect(hashContract()).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('links to the 01-010 missing mouse capture audit surface', async () => {
    const manifestContent = await Bun.file(AUDIT_MANIFEST_PATH).text();
    const manifestValue: unknown = JSON.parse(manifestContent);

    expect(isMissingLiveInputManifest(manifestValue)).toBe(true);
    if (!isMissingLiveInputManifest(manifestValue)) {
      return;
    }

    expect(manifestValue.stepId).toBe(RELEASE_INPUT_ON_FOCUS_LOSS_CONTRACT.auditManifestStepId);
    expect(manifestValue.explicitNullSurfaces.some((surface) => surface.surface === 'mouse-capture-policy' && surface.reason === 'No mouse capture or release policy is visible within the 01-010 read scope.')).toBe(true);
  });

  test('releases held keys and mouse buttons into a replay-safe neutral result', () => {
    const releaseResult = releaseInputOnFocusLoss('bun run doom.ts', {
      heldDoomKeys: [KEY_ESCAPE, KEY_RIGHTARROW],
      heldMouseButtons: ['left', 'right'],
      mouseCaptured: true,
      pendingMouseDeltaX: 18,
      pendingMouseDeltaY: -7,
    });

    expect(releaseResult).toEqual({
      captureReleased: true,
      mouseCaptured: false,
      pendingMouseDeltaX: 0,
      pendingMouseDeltaY: 0,
      releasedDoomKeys: [KEY_ESCAPE, KEY_RIGHTARROW],
      releasedEvents: [
        { doomKey: KEY_ESCAPE, source: 'keyboard', type: 'keyup' },
        { doomKey: KEY_RIGHTARROW, source: 'keyboard', type: 'keyup' },
        { button: 'left', source: 'mouse', type: 'buttonup' },
        { button: 'right', source: 'mouse', type: 'buttonup' },
      ],
      releasedMouseButtons: ['left', 'right'],
      replaySafeTicCommand: EMPTY_TICCMD,
      replaySafeTicCommandSize: TICCMD_SIZE,
    });
    expect(releaseResult.replaySafeTicCommand).toBe(EMPTY_TICCMD);
  });

  test('rejects the wrong runtime command', () => {
    expect(() =>
      releaseInputOnFocusLoss('bun run src/main.ts', {
        heldDoomKeys: [],
        heldMouseButtons: [],
        mouseCaptured: false,
        pendingMouseDeltaX: 0,
        pendingMouseDeltaY: 0,
      }),
    ).toThrow('releaseInputOnFocusLoss requires "bun run doom.ts". Received "bun run src/main.ts".');
  });

  test('rejects unsupported Doom keys', () => {
    expect(() =>
      releaseInputOnFocusLoss('bun run doom.ts', {
        heldDoomKeys: [0],
        heldMouseButtons: [],
        mouseCaptured: false,
        pendingMouseDeltaX: 0,
        pendingMouseDeltaY: 0,
      }),
    ).toThrow('releaseInputOnFocusLoss received unsupported Doom key 0.');
  });
});
