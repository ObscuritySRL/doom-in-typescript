import { KEY_DOWNARROW, KEY_ESCAPE, KEY_LEFTARROW, KEY_PGDN, KEY_PGUP, KEY_RIGHTARROW, KEY_RSHIFT, KEY_TAB, KEY_UPARROW } from '../../input/keyboard.ts';
import { ANGLE_TURN, EMPTY_TICCMD, FORWARD_MOVE, packTicCommand, SIDE_MOVE } from '../../input/ticcmd.ts';

import type { TicCommand } from '../../input/ticcmd.ts';

export type InternalDoomKeyAction = 'automap-follow' | 'automap-toggle' | 'automap-zoom-in' | 'automap-zoom-out' | 'move-backward' | 'move-forward' | 'quit' | 'run' | 'strafe-left' | 'strafe-right' | 'turn-left' | 'turn-right';

export type InternalDoomKeyDomain = 'gameplay' | 'host';
export type InternalDoomKeyImpulse = 'continuous' | 'edge';
export type InternalDoomKeyMovementTable = 'ANGLE_TURN' | 'FORWARD_MOVE' | 'SIDE_MOVE' | 'none' | 'speed-modifier';

export interface InternalDoomKeyMapping {
  readonly action: InternalDoomKeyAction;
  readonly doomKey: number;
  readonly doomKeyLabel: string;
  readonly domain: InternalDoomKeyDomain;
  readonly impulse: InternalDoomKeyImpulse;
  readonly movementTable: InternalDoomKeyMovementTable;
  readonly movementTableIndex: 0 | 1 | null;
  readonly ticCommandDelta: TicCommand;
}

export interface MapInternalDoomKeysOptions {
  readonly doomKey: number;
  readonly runtimeCommand: string;
}

const LOWERCASE_A_DOOM_KEY = 'a'.charCodeAt(0);
const LOWERCASE_D_DOOM_KEY = 'd'.charCodeAt(0);
const LOWERCASE_E_DOOM_KEY = 'e'.charCodeAt(0);
const LOWERCASE_F_DOOM_KEY = 'f'.charCodeAt(0);
const LOWERCASE_Q_DOOM_KEY = 'q'.charCodeAt(0);
const LOWERCASE_S_DOOM_KEY = 's'.charCodeAt(0);
const LOWERCASE_W_DOOM_KEY = 'w'.charCodeAt(0);

const MOVE_FORWARD_WITH_W = Object.freeze<InternalDoomKeyMapping>({
  action: 'move-forward',
  doomKey: LOWERCASE_W_DOOM_KEY,
  doomKeyLabel: 'w',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'FORWARD_MOVE',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(FORWARD_MOVE[0], 0, 0, 0, 0, 0),
});

const MOVE_FORWARD_WITH_UP_ARROW = Object.freeze<InternalDoomKeyMapping>({
  action: 'move-forward',
  doomKey: KEY_UPARROW,
  doomKeyLabel: 'KEY_UPARROW',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'FORWARD_MOVE',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(FORWARD_MOVE[0], 0, 0, 0, 0, 0),
});

const MOVE_BACKWARD_WITH_S = Object.freeze<InternalDoomKeyMapping>({
  action: 'move-backward',
  doomKey: LOWERCASE_S_DOOM_KEY,
  doomKeyLabel: 's',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'FORWARD_MOVE',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(-FORWARD_MOVE[0], 0, 0, 0, 0, 0),
});

const MOVE_BACKWARD_WITH_DOWN_ARROW = Object.freeze<InternalDoomKeyMapping>({
  action: 'move-backward',
  doomKey: KEY_DOWNARROW,
  doomKeyLabel: 'KEY_DOWNARROW',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'FORWARD_MOVE',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(-FORWARD_MOVE[0], 0, 0, 0, 0, 0),
});

const TURN_LEFT_WITH_A = Object.freeze<InternalDoomKeyMapping>({
  action: 'turn-left',
  doomKey: LOWERCASE_A_DOOM_KEY,
  doomKeyLabel: 'a',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'ANGLE_TURN',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(0, 0, ANGLE_TURN[0], 0, 0, 0),
});

const TURN_LEFT_WITH_LEFT_ARROW = Object.freeze<InternalDoomKeyMapping>({
  action: 'turn-left',
  doomKey: KEY_LEFTARROW,
  doomKeyLabel: 'KEY_LEFTARROW',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'ANGLE_TURN',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(0, 0, ANGLE_TURN[0], 0, 0, 0),
});

const TURN_RIGHT_WITH_D = Object.freeze<InternalDoomKeyMapping>({
  action: 'turn-right',
  doomKey: LOWERCASE_D_DOOM_KEY,
  doomKeyLabel: 'd',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'ANGLE_TURN',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(0, 0, -ANGLE_TURN[0], 0, 0, 0),
});

const TURN_RIGHT_WITH_RIGHT_ARROW = Object.freeze<InternalDoomKeyMapping>({
  action: 'turn-right',
  doomKey: KEY_RIGHTARROW,
  doomKeyLabel: 'KEY_RIGHTARROW',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'ANGLE_TURN',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(0, 0, -ANGLE_TURN[0], 0, 0, 0),
});

const STRAFE_LEFT_WITH_Q = Object.freeze<InternalDoomKeyMapping>({
  action: 'strafe-left',
  doomKey: LOWERCASE_Q_DOOM_KEY,
  doomKeyLabel: 'q',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'SIDE_MOVE',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(0, -SIDE_MOVE[0], 0, 0, 0, 0),
});

const STRAFE_RIGHT_WITH_E = Object.freeze<InternalDoomKeyMapping>({
  action: 'strafe-right',
  doomKey: LOWERCASE_E_DOOM_KEY,
  doomKeyLabel: 'e',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'SIDE_MOVE',
  movementTableIndex: 0,
  ticCommandDelta: packTicCommand(0, SIDE_MOVE[0], 0, 0, 0, 0),
});

const RUN_WITH_SHIFT = Object.freeze<InternalDoomKeyMapping>({
  action: 'run',
  doomKey: KEY_RSHIFT,
  doomKeyLabel: 'KEY_RSHIFT',
  domain: 'gameplay',
  impulse: 'continuous',
  movementTable: 'speed-modifier',
  movementTableIndex: 1,
  ticCommandDelta: EMPTY_TICCMD,
});

const TOGGLE_AUTOMAP_WITH_TAB = Object.freeze<InternalDoomKeyMapping>({
  action: 'automap-toggle',
  doomKey: KEY_TAB,
  doomKeyLabel: 'KEY_TAB',
  domain: 'host',
  impulse: 'edge',
  movementTable: 'none',
  movementTableIndex: null,
  ticCommandDelta: EMPTY_TICCMD,
});

const ZOOM_AUTOMAP_IN_WITH_PAGE_UP = Object.freeze<InternalDoomKeyMapping>({
  action: 'automap-zoom-in',
  doomKey: KEY_PGUP,
  doomKeyLabel: 'KEY_PGUP',
  domain: 'host',
  impulse: 'continuous',
  movementTable: 'none',
  movementTableIndex: null,
  ticCommandDelta: EMPTY_TICCMD,
});

const ZOOM_AUTOMAP_OUT_WITH_PAGE_DOWN = Object.freeze<InternalDoomKeyMapping>({
  action: 'automap-zoom-out',
  doomKey: KEY_PGDN,
  doomKeyLabel: 'KEY_PGDN',
  domain: 'host',
  impulse: 'continuous',
  movementTable: 'none',
  movementTableIndex: null,
  ticCommandDelta: EMPTY_TICCMD,
});

const TOGGLE_AUTOMAP_FOLLOW_WITH_F = Object.freeze<InternalDoomKeyMapping>({
  action: 'automap-follow',
  doomKey: LOWERCASE_F_DOOM_KEY,
  doomKeyLabel: 'f',
  domain: 'host',
  impulse: 'edge',
  movementTable: 'none',
  movementTableIndex: null,
  ticCommandDelta: EMPTY_TICCMD,
});

const QUIT_WITH_ESCAPE = Object.freeze<InternalDoomKeyMapping>({
  action: 'quit',
  doomKey: KEY_ESCAPE,
  doomKeyLabel: 'KEY_ESCAPE',
  domain: 'host',
  impulse: 'edge',
  movementTable: 'none',
  movementTableIndex: null,
  ticCommandDelta: EMPTY_TICCMD,
});

const INTERNAL_DOOM_KEY_MAPPINGS = Object.freeze([
  MOVE_FORWARD_WITH_W,
  MOVE_FORWARD_WITH_UP_ARROW,
  MOVE_BACKWARD_WITH_S,
  MOVE_BACKWARD_WITH_DOWN_ARROW,
  TURN_LEFT_WITH_A,
  TURN_LEFT_WITH_LEFT_ARROW,
  TURN_RIGHT_WITH_D,
  TURN_RIGHT_WITH_RIGHT_ARROW,
  STRAFE_LEFT_WITH_Q,
  STRAFE_RIGHT_WITH_E,
  RUN_WITH_SHIFT,
  TOGGLE_AUTOMAP_WITH_TAB,
  ZOOM_AUTOMAP_IN_WITH_PAGE_UP,
  ZOOM_AUTOMAP_OUT_WITH_PAGE_DOWN,
  TOGGLE_AUTOMAP_FOLLOW_WITH_F,
  QUIT_WITH_ESCAPE,
]);

export const MAP_INTERNAL_DOOM_KEYS_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-010-audit-missing-live-input.json',
  auditedMissingSurface: 'key-translation-table',
  deterministicReplayRule: 'Map Doom internal keys to stable semantic actions and frozen ticcmd deltas without timestamps or tic mutation.',
  documentedControls: Object.freeze(['W/S or Up/Down', 'A/D or Left/Right', 'Q/E', 'Shift', 'Tab', 'PageUp/PageDown', 'F', 'Esc']),
  keyboardModulePath: 'src/input/keyboard.ts',
  runtimeCommand: 'bun run doom.ts',
  ticCommandModulePath: 'src/input/ticcmd.ts',
  mappings: INTERNAL_DOOM_KEY_MAPPINGS,
});

const INTERNAL_DOOM_KEY_LOOKUP: ReadonlyMap<number, InternalDoomKeyMapping> = new Map(MAP_INTERNAL_DOOM_KEYS_CONTRACT.mappings.map((mapping) => [mapping.doomKey, mapping] as const));

export function mapInternalDoomKeys(options: MapInternalDoomKeysOptions): InternalDoomKeyMapping | null {
  if (options.runtimeCommand !== MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand) {
    throw new Error(`Unsupported runtime command: ${options.runtimeCommand}. Expected ${MAP_INTERNAL_DOOM_KEYS_CONTRACT.runtimeCommand}.`);
  }

  return INTERNAL_DOOM_KEY_LOOKUP.get(options.doomKey) ?? null;
}
