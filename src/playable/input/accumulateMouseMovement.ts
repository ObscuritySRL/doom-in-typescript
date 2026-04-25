import { EMPTY_TICCMD, MOUSE_STRAFE_MULTIPLIER, MOUSE_TURN_MULTIPLIER, packTicCommand, TICCMD_SIZE } from '../../input/ticcmd.ts';
import type { TicCommand } from '../../input/ticcmd.ts';

const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';

export const ACCUMULATE_MOUSE_MOVEMENT_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-010-audit-missing-live-input.json',
  movementPolicy: Object.freeze({
    forwardMovementExpression: 'forwardmove -= mouseY',
    horizontalPolicy: 'strafe modifier routes mouseX to sidemove; otherwise mouseX routes to angleturn',
    mouseStrafeMultiplier: MOUSE_STRAFE_MULTIPLIER,
    mouseTurnMultiplier: MOUSE_TURN_MULTIPLIER,
  }),
  replayCompatibility: Object.freeze({
    ticCommandSize: TICCMD_SIZE,
    usesTimestamp: false,
    zeroBaseline: EMPTY_TICCMD,
  }),
  runtimeCommand: REQUIRED_RUNTIME_COMMAND,
  stepId: '06-007',
  stepTitle: 'accumulate-mouse-movement',
});

export interface MouseMovementAccumulationInput {
  readonly mouseX: number;
  readonly mouseY: number;
  readonly runtimeCommand: string;
  readonly strafeModifierActive: boolean;
}

export interface MouseMovementAccumulationResult {
  readonly horizontalAxisTarget: 'angleturn' | 'sidemove';
  readonly mouseX: number;
  readonly mouseY: number;
  readonly strafeModifierActive: boolean;
  readonly ticCommand: TicCommand;
}

export function accumulateMouseMovement({ mouseX, mouseY, runtimeCommand, strafeModifierActive }: MouseMovementAccumulationInput): MouseMovementAccumulationResult {
  if (runtimeCommand !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error('accumulateMouseMovement only supports bun run doom.ts.');
  }

  if (!Number.isInteger(mouseX) || !Number.isInteger(mouseY)) {
    throw new Error('Mouse movement deltas must be signed integers.');
  }

  const angleTurn = strafeModifierActive ? 0 : -(mouseX * MOUSE_TURN_MULTIPLIER);
  const forwardMovement = -mouseY;
  const horizontalAxisTarget = strafeModifierActive ? 'sidemove' : 'angleturn';
  const sideMovement = strafeModifierActive ? mouseX * MOUSE_STRAFE_MULTIPLIER : 0;

  return Object.freeze({
    horizontalAxisTarget,
    mouseX,
    mouseY,
    strafeModifierActive,
    ticCommand: packTicCommand(forwardMovement, sideMovement, angleTurn, EMPTY_TICCMD.buttons, EMPTY_TICCMD.consistancy, EMPTY_TICCMD.chatchar),
  });
}
