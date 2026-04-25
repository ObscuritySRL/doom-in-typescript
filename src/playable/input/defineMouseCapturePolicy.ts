import type { TicCommand } from '../../input/ticcmd.ts';

import { EMPTY_TICCMD, TICCMD_SIZE } from '../../input/ticcmd.ts';

const EXPECTED_RUNTIME_COMMAND = 'bun run doom.ts';

export type MouseCaptureOwner = 'deterministic-replay' | 'gameplay' | 'menu';
export type MouseCaptureReason = 'deterministic-replay' | 'focus-loss' | 'gameplay-focus' | 'menu-active';

export interface MouseCaptureContext {
  readonly hasWindowFocus: boolean;
  readonly inputOwner: MouseCaptureOwner;
  readonly runtimeCommand: string;
}

export interface MouseCapturePolicy {
  readonly captureMode: 'captured' | 'released';
  readonly policyReason: MouseCaptureReason;
  readonly replaySafeTicCommand: TicCommand;
  readonly replaySafeTicCommandBytes: number;
  readonly shouldClipCursorToWindow: boolean;
  readonly shouldHideCursor: boolean;
}

export const DEFINE_MOUSE_CAPTURE_POLICY_CONTRACT = Object.freeze({
  auditedMissingSurface: Object.freeze({
    stepId: '01-010',
    surface: 'mouse-capture-policy',
  }),
  captureRule: Object.freeze({
    capturedWhen: 'gameplay-window-focused',
    releasedWhen: Object.freeze(['deterministic-replay', 'menu-active', 'window-unfocused'] as const),
  }),
  hostBehavior: Object.freeze({
    clipCursorWhenCaptured: true,
    hideCursorWhenCaptured: true,
  }),
  replayCompatibility: Object.freeze({
    neutralTicCommandBytes: TICCMD_SIZE,
    usesNeutralTicCommand: true,
  }),
  runtimeCommand: EXPECTED_RUNTIME_COMMAND,
});

export const DEFINE_MOUSE_CAPTURE_POLICY_CONTRACT_HASH = 'db700e957f7d5d1760f732aea463d5f4360cf4ada756d209cc645db6834c0eed';

type ReleasedMouseCaptureReason = Exclude<MouseCaptureReason, 'gameplay-focus'>;

const CAPTURED_MOUSE_POLICY: MouseCapturePolicy = Object.freeze({
  captureMode: 'captured',
  policyReason: 'gameplay-focus',
  replaySafeTicCommand: EMPTY_TICCMD,
  replaySafeTicCommandBytes: TICCMD_SIZE,
  shouldClipCursorToWindow: true,
  shouldHideCursor: true,
});

const RELEASED_MOUSE_POLICY_BY_REASON: Readonly<Record<ReleasedMouseCaptureReason, MouseCapturePolicy>> = Object.freeze({
  'deterministic-replay': Object.freeze({
    captureMode: 'released',
    policyReason: 'deterministic-replay',
    replaySafeTicCommand: EMPTY_TICCMD,
    replaySafeTicCommandBytes: TICCMD_SIZE,
    shouldClipCursorToWindow: false,
    shouldHideCursor: false,
  }),
  'focus-loss': Object.freeze({
    captureMode: 'released',
    policyReason: 'focus-loss',
    replaySafeTicCommand: EMPTY_TICCMD,
    replaySafeTicCommandBytes: TICCMD_SIZE,
    shouldClipCursorToWindow: false,
    shouldHideCursor: false,
  }),
  'menu-active': Object.freeze({
    captureMode: 'released',
    policyReason: 'menu-active',
    replaySafeTicCommand: EMPTY_TICCMD,
    replaySafeTicCommandBytes: TICCMD_SIZE,
    shouldClipCursorToWindow: false,
    shouldHideCursor: false,
  }),
});

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== EXPECTED_RUNTIME_COMMAND) {
    throw new Error(`defineMouseCapturePolicy requires \`${EXPECTED_RUNTIME_COMMAND}\`. Received \`${runtimeCommand}\`.`);
  }
}

export function defineMouseCapturePolicy(context: MouseCaptureContext): MouseCapturePolicy {
  assertRuntimeCommand(context.runtimeCommand);

  if (!context.hasWindowFocus) {
    return RELEASED_MOUSE_POLICY_BY_REASON['focus-loss'];
  }

  if (context.inputOwner === 'deterministic-replay') {
    return RELEASED_MOUSE_POLICY_BY_REASON['deterministic-replay'];
  }

  if (context.inputOwner === 'menu') {
    return RELEASED_MOUSE_POLICY_BY_REASON['menu-active'];
  }

  return CAPTURED_MOUSE_POLICY;
}
