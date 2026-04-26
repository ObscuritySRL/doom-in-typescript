import type { TicCommand } from '../../input/ticcmd.ts';

import { BT_ATTACK, EMPTY_TICCMD, FORWARD_MOVE, TICCMD_SIZE, packTicCommand } from '../../input/ticcmd.ts';

const RUNTIME_COMMAND = 'bun run doom.ts';

export type MouseButtonEventType = 'down' | 'up';
export type MouseButtonName = 'left' | 'middle' | 'right';
export type MouseButtonSemanticAction = 'attack' | 'move-forward' | 'strafe-modifier';

export interface KnownMouseButtonArgs {
  readonly buttonName: MouseButtonName;
  readonly eventType: MouseButtonEventType;
  readonly runtimeCommand: string;
}

export interface UnknownMouseButtonArgs {
  readonly buttonName: string;
  readonly eventType: string;
  readonly runtimeCommand: string;
}

export interface MouseButtonMapping {
  readonly buttonName: MouseButtonName;
  readonly buttonSlot: number;
  readonly eventType: MouseButtonEventType;
  readonly semanticAction: MouseButtonSemanticAction;
  readonly ticCommandDelta: TicCommand;
  readonly ticCommandSize: number;
}

const LEFT_BUTTON_ATTACK_DELTA = packTicCommand(0, 0, 0, BT_ATTACK, 0, 0);
const MIDDLE_BUTTON_FORWARD_DELTA = packTicCommand(FORWARD_MOVE[0], 0, 0, 0, 0, 0);

export const MAP_MOUSE_BUTTONS_CONTRACT = Object.freeze({
  auditManifestStepId: '01-010',
  deterministicReplayCompatible: true,
  eventTypes: Object.freeze(['down', 'up'] as const),
  runtimeCommand: RUNTIME_COMMAND,
  supportedButtons: Object.freeze([
    Object.freeze({
      buttonName: 'left',
      buttonSlot: 0,
      semanticAction: 'attack',
      ticCommandDelta: LEFT_BUTTON_ATTACK_DELTA,
    }),
    Object.freeze({
      buttonName: 'right',
      buttonSlot: 1,
      semanticAction: 'strafe-modifier',
      ticCommandDelta: EMPTY_TICCMD,
    }),
    Object.freeze({
      buttonName: 'middle',
      buttonSlot: 2,
      semanticAction: 'move-forward',
      ticCommandDelta: MIDDLE_BUTTON_FORWARD_DELTA,
    }),
  ]),
  ticCommandSize: TICCMD_SIZE,
} as const);

/**
 * Map a physical mouse button event to a deterministic playable input surface.
 *
 * The returned payload records only discrete button identity and a replay-safe
 * ticcmd delta. Held-state accumulation remains a later step.
 *
 * @param args - Runtime command plus the mouse button event to translate.
 * @returns A deterministic mouse-button mapping, or `null` for unsupported buttons.
 * @example
 * ```ts
 * import { mapMouseButtons } from './src/playable/input/mapMouseButtons.ts';
 *
 * const mapped = mapMouseButtons({
 *   buttonName: 'left',
 *   eventType: 'down',
 *   runtimeCommand: 'bun run doom.ts',
 * });
 *
 * console.log(mapped?.semanticAction);
 * ```
 */
export function mapMouseButtons(args: KnownMouseButtonArgs): MouseButtonMapping;
export function mapMouseButtons(args: UnknownMouseButtonArgs): MouseButtonMapping | null;
export function mapMouseButtons(args: UnknownMouseButtonArgs): MouseButtonMapping | null {
  if (args.runtimeCommand !== RUNTIME_COMMAND) {
    throw new Error(`mapMouseButtons requires \`${RUNTIME_COMMAND}\`.`);
  }

  if (args.eventType !== 'down' && args.eventType !== 'up') {
    throw new Error(`Unsupported mouse button event type: ${args.eventType}`);
  }

  let buttonSlot: number;
  let semanticAction: MouseButtonSemanticAction;
  let pressedDelta: TicCommand;

  switch (args.buttonName) {
    case 'left': {
      buttonSlot = 0;
      semanticAction = 'attack';
      pressedDelta = LEFT_BUTTON_ATTACK_DELTA;
      break;
    }
    case 'right': {
      buttonSlot = 1;
      semanticAction = 'strafe-modifier';
      pressedDelta = EMPTY_TICCMD;
      break;
    }
    case 'middle': {
      buttonSlot = 2;
      semanticAction = 'move-forward';
      pressedDelta = MIDDLE_BUTTON_FORWARD_DELTA;
      break;
    }
    default: {
      return null;
    }
  }

  return Object.freeze({
    buttonName: args.buttonName,
    buttonSlot,
    eventType: args.eventType,
    semanticAction,
    ticCommandDelta: args.eventType === 'down' ? pressedDelta : EMPTY_TICCMD,
    ticCommandSize: TICCMD_SIZE,
  });
}
