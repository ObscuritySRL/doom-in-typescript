import { SCANCODE_TO_DOOM_KEY } from '../../input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../input/ticcmd.ts';

import type { TicCommand } from '../../input/ticcmd.ts';

const SUPPORTED_MOUSE_BUTTONS = Object.freeze(['left', 'middle', 'right'] as const);

const RELEASE_TARGETS = Object.freeze(['held-doom-keys', 'held-mouse-buttons', 'pending-mouse-motion', 'mouse-capture'] as const);

const EXPECTED_RUNTIME_COMMAND = 'bun run doom.ts';

const MAPPED_DOOM_KEY_SET: ReadonlySet<number> = new Set(SCANCODE_TO_DOOM_KEY.filter((doomKey) => doomKey !== 0));

export type FocusLossMouseButton = (typeof SUPPORTED_MOUSE_BUTTONS)[number];

export interface FocusLossInputState {
  readonly heldDoomKeys: readonly number[];
  readonly heldMouseButtons: readonly string[];
  readonly mouseCaptured: boolean;
  readonly pendingMouseDeltaX: number;
  readonly pendingMouseDeltaY: number;
}

export interface FocusLossKeyboardReleaseEvent {
  readonly doomKey: number;
  readonly source: 'keyboard';
  readonly type: 'keyup';
}

export interface FocusLossMouseReleaseEvent {
  readonly button: FocusLossMouseButton;
  readonly source: 'mouse';
  readonly type: 'buttonup';
}

export type FocusLossReleaseEvent = FocusLossKeyboardReleaseEvent | FocusLossMouseReleaseEvent;

export interface FocusLossReleaseResult {
  readonly captureReleased: boolean;
  readonly mouseCaptured: false;
  readonly pendingMouseDeltaX: 0;
  readonly pendingMouseDeltaY: 0;
  readonly releasedDoomKeys: readonly number[];
  readonly releasedEvents: readonly FocusLossReleaseEvent[];
  readonly releasedMouseButtons: readonly FocusLossMouseButton[];
  readonly replaySafeTicCommand: TicCommand;
  readonly replaySafeTicCommandSize: number;
}

export const RELEASE_INPUT_ON_FOCUS_LOSS_CONTRACT = Object.freeze({
  auditManifestStepId: '01-010',
  auditMissingSurface: 'mouse-capture-policy',
  focusLossSignal: 'window-focus-lost',
  releaseTargets: RELEASE_TARGETS,
  replayCompatibility: Object.freeze({
    clearsPendingMouseMotion: true,
    preservesDeterministicReplay: true,
    returnsNeutralTicCommand: true,
    ticCommandSize: TICCMD_SIZE,
    usesMappedDoomKeysFromKeyboardTable: true,
    usesTimestamps: false,
  }),
  runtimeCommand: EXPECTED_RUNTIME_COMMAND,
  supportedMouseButtons: SUPPORTED_MOUSE_BUTTONS,
  transition: Object.freeze({
    from: 'live-input-active',
    to: 'neutral-input-released',
    trigger: 'focus-loss',
  }),
});

function isFocusLossMouseButton(value: string): value is FocusLossMouseButton {
  return value === 'left' || value === 'middle' || value === 'right';
}

export function releaseInputOnFocusLoss(runtimeCommand: string, activeInputState: FocusLossInputState): FocusLossReleaseResult {
  if (runtimeCommand !== EXPECTED_RUNTIME_COMMAND) {
    throw new Error(`releaseInputOnFocusLoss requires "${EXPECTED_RUNTIME_COMMAND}". Received "${runtimeCommand}".`);
  }

  if (!Number.isInteger(activeInputState.pendingMouseDeltaX) || !Number.isInteger(activeInputState.pendingMouseDeltaY)) {
    throw new Error('releaseInputOnFocusLoss requires integer pending mouse deltas.');
  }

  const releasedDoomKeys: number[] = [];
  const releasedMouseButtons: FocusLossMouseButton[] = [];
  const releasedEvents: FocusLossReleaseEvent[] = [];
  const seenDoomKeys = new Set<number>();
  const seenMouseButtons = new Set<FocusLossMouseButton>();

  for (const doomKey of activeInputState.heldDoomKeys) {
    if (!Number.isInteger(doomKey) || !MAPPED_DOOM_KEY_SET.has(doomKey)) {
      throw new Error(`releaseInputOnFocusLoss received unsupported Doom key ${doomKey}.`);
    }

    if (seenDoomKeys.has(doomKey)) {
      throw new Error(`releaseInputOnFocusLoss received duplicate Doom key ${doomKey}.`);
    }

    seenDoomKeys.add(doomKey);
    releasedDoomKeys.push(doomKey);
    releasedEvents.push(
      Object.freeze({
        doomKey,
        source: 'keyboard',
        type: 'keyup',
      }),
    );
  }

  for (const heldMouseButton of activeInputState.heldMouseButtons) {
    if (!isFocusLossMouseButton(heldMouseButton)) {
      throw new Error(`releaseInputOnFocusLoss received unsupported mouse button "${heldMouseButton}".`);
    }

    if (seenMouseButtons.has(heldMouseButton)) {
      throw new Error(`releaseInputOnFocusLoss received duplicate mouse button "${heldMouseButton}".`);
    }

    seenMouseButtons.add(heldMouseButton);
    releasedMouseButtons.push(heldMouseButton);
    releasedEvents.push(
      Object.freeze({
        button: heldMouseButton,
        source: 'mouse',
        type: 'buttonup',
      }),
    );
  }

  return Object.freeze({
    captureReleased: activeInputState.mouseCaptured,
    mouseCaptured: false,
    pendingMouseDeltaX: 0,
    pendingMouseDeltaY: 0,
    releasedDoomKeys: Object.freeze(releasedDoomKeys),
    releasedEvents: Object.freeze(releasedEvents),
    releasedMouseButtons: Object.freeze(releasedMouseButtons),
    replaySafeTicCommand: EMPTY_TICCMD,
    replaySafeTicCommandSize: TICCMD_SIZE,
  });
}
