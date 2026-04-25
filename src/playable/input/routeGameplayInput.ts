import { KEY_DOWNARROW, KEY_LEFTARROW, KEY_PGDN, KEY_PGUP, KEY_RIGHTARROW, KEY_RSHIFT, KEY_TAB, KEY_UPARROW } from '../../input/keyboard.ts';
import { ANGLE_TURN, EMPTY_TICCMD, FORWARD_MOVE, SIDE_MOVE, TICCMD_SIZE, packTicCommand } from '../../input/ticcmd.ts';
import type { TicCommand } from '../../input/ticcmd.ts';

const KEY_A = 0x61;
const KEY_D = 0x64;
const KEY_E = 0x65;
const KEY_F = 0x66;
const KEY_Q = 0x71;
const KEY_S = 0x73;
const KEY_W = 0x77;
const RUNTIME_COMMAND = 'bun run doom.ts';

export type GameplayHostAction = 'automap-follow-toggle' | 'automap-view-toggle' | 'automap-zoom-in' | 'automap-zoom-out';

export interface GameplayHeldInputState {
  readonly moveBackward: boolean;
  readonly moveForward: boolean;
  readonly runModifier: boolean;
  readonly strafeLeft: boolean;
  readonly strafeRight: boolean;
  readonly turnLeft: boolean;
  readonly turnRight: boolean;
}

export interface GameplayInputRoutingRequest {
  readonly command: string;
  readonly doomKey: number;
  readonly eventType: 'keydown' | 'keyup';
  readonly heldInputState: GameplayHeldInputState;
}

export interface GameplayInputRoutingResult {
  readonly handled: boolean;
  readonly heldInputState: GameplayHeldInputState;
  readonly hostAction: GameplayHostAction | null;
  readonly ticCommand: TicCommand;
  readonly ticCommandSize: number;
}

export const ROUTE_GAMEPLAY_INPUT_CONTRACT = Object.freeze({
  command: RUNTIME_COMMAND,
  deterministicReplay: Object.freeze({
    liveTicMutation: false,
    returnsFrozenTicCommandSnapshot: true,
    timestamps: 'forbidden',
  }),
  documentedGameplayControls: Object.freeze([
    Object.freeze({ action: 'move forward or backward', control: 'W/S or Up/Down', sourceOrder: 1 }),
    Object.freeze({ action: 'turn left or right', control: 'A/D or Left/Right', sourceOrder: 2 }),
    Object.freeze({ action: 'strafe left or right', control: 'Q/E', sourceOrder: 3 }),
    Object.freeze({ action: 'run', control: 'Shift', sourceOrder: 4 }),
  ]),
  hostOnlyControls: Object.freeze([
    Object.freeze({ action: 'toggle gameplay view and automap', control: 'Tab', sourceOrder: 5 }),
    Object.freeze({ action: 'zoom the automap', control: 'PageUp/PageDown', sourceOrder: 6 }),
    Object.freeze({ action: 'toggle automap follow', control: 'F', sourceOrder: 7 }),
  ]),
  reservedMenuControl: Object.freeze({
    control: 'Esc',
    routedByStepId: '06-010',
  }),
  stepId: '06-011',
  stepTitle: 'route-gameplay-input',
  ticCommandSize: TICCMD_SIZE,
});

function buildGameplayTicCommand(heldInputState: GameplayHeldInputState): TicCommand {
  const speedIndex = heldInputState.runModifier ? 1 : 0;
  const angleTurn = (heldInputState.turnLeft ? ANGLE_TURN[speedIndex] : 0) + (heldInputState.turnRight ? -ANGLE_TURN[speedIndex] : 0);
  const forwardMovement = (heldInputState.moveForward ? FORWARD_MOVE[speedIndex] : 0) + (heldInputState.moveBackward ? -FORWARD_MOVE[speedIndex] : 0);
  const sideMovement = (heldInputState.strafeRight ? SIDE_MOVE[speedIndex] : 0) + (heldInputState.strafeLeft ? -SIDE_MOVE[speedIndex] : 0);

  if (angleTurn === 0 && forwardMovement === 0 && sideMovement === 0) {
    return EMPTY_TICCMD;
  }

  return packTicCommand(forwardMovement, sideMovement, angleTurn, 0, 0, 0);
}

function freezeHeldInputState(heldInputState: GameplayHeldInputState): GameplayHeldInputState {
  const frozenHeldInputState: GameplayHeldInputState = Object.freeze({
    moveBackward: heldInputState.moveBackward,
    moveForward: heldInputState.moveForward,
    runModifier: heldInputState.runModifier,
    strafeLeft: heldInputState.strafeLeft,
    strafeRight: heldInputState.strafeRight,
    turnLeft: heldInputState.turnLeft,
    turnRight: heldInputState.turnRight,
  });

  return frozenHeldInputState;
}

/**
 * Route a translated Doom key into the gameplay input domain.
 *
 * @param request - Runtime command, translated key event, and held gameplay state.
 * @returns Frozen gameplay routing output with the next held state and a replay-safe ticcmd snapshot.
 * @example
 * ```ts
 * import { KEY_UPARROW } from "../../input/keyboard.ts";
 * import { routeGameplayInput } from "./routeGameplayInput.ts";
 *
 * const result = routeGameplayInput({
 *   command: "bun run doom.ts",
 *   doomKey: KEY_UPARROW,
 *   eventType: "keydown",
 *   heldInputState: {
 *     moveBackward: false,
 *     moveForward: false,
 *     runModifier: false,
 *     strafeLeft: false,
 *     strafeRight: false,
 *     turnLeft: false,
 *     turnRight: false,
 *   },
 * });
 * ```
 */
export function routeGameplayInput(request: GameplayInputRoutingRequest): GameplayInputRoutingResult {
  if (request.command !== RUNTIME_COMMAND) {
    throw new Error(`routeGameplayInput requires command "${RUNTIME_COMMAND}".`);
  }

  if (request.eventType !== 'keydown' && request.eventType !== 'keyup') {
    throw new Error('routeGameplayInput only supports keydown and keyup events.');
  }

  const nextHeldInputState = { ...request.heldInputState };
  const isKeyDown = request.eventType === 'keydown';
  let handled = true;
  let hostAction: GameplayHostAction | null = null;

  switch (request.doomKey) {
    case KEY_A:
    case KEY_LEFTARROW:
      nextHeldInputState.turnLeft = isKeyDown;
      break;
    case KEY_D:
    case KEY_RIGHTARROW:
      nextHeldInputState.turnRight = isKeyDown;
      break;
    case KEY_DOWNARROW:
    case KEY_S:
      nextHeldInputState.moveBackward = isKeyDown;
      break;
    case KEY_E:
      nextHeldInputState.strafeRight = isKeyDown;
      break;
    case KEY_F:
      if (isKeyDown) {
        hostAction = 'automap-follow-toggle';
      } else {
        handled = false;
      }
      break;
    case KEY_PGDN:
      if (isKeyDown) {
        hostAction = 'automap-zoom-out';
      } else {
        handled = false;
      }
      break;
    case KEY_PGUP:
      if (isKeyDown) {
        hostAction = 'automap-zoom-in';
      } else {
        handled = false;
      }
      break;
    case KEY_Q:
      nextHeldInputState.strafeLeft = isKeyDown;
      break;
    case KEY_RSHIFT:
      nextHeldInputState.runModifier = isKeyDown;
      break;
    case KEY_TAB:
      if (isKeyDown) {
        hostAction = 'automap-view-toggle';
      } else {
        handled = false;
      }
      break;
    case KEY_UPARROW:
    case KEY_W:
      nextHeldInputState.moveForward = isKeyDown;
      break;
    default:
      handled = false;
      break;
  }

  const frozenHeldInputState = freezeHeldInputState(handled ? nextHeldInputState : request.heldInputState);
  const gameplayTicCommand = buildGameplayTicCommand(frozenHeldInputState);
  const routingResult: GameplayInputRoutingResult = Object.freeze({
    handled,
    heldInputState: frozenHeldInputState,
    hostAction,
    ticCommand: gameplayTicCommand,
    ticCommandSize: TICCMD_SIZE,
  });

  return routingResult;
}
