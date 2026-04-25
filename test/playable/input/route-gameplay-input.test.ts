import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { KEY_DOWNARROW, KEY_ESCAPE, KEY_PGDN, KEY_RSHIFT, KEY_TAB, KEY_UPARROW } from '../../../src/input/keyboard.ts';
import { ANGLE_TURN, EMPTY_TICCMD, FORWARD_MOVE, SIDE_MOVE, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { ROUTE_GAMEPLAY_INPUT_CONTRACT, routeGameplayInput } from '../../../src/playable/input/routeGameplayInput.ts';
import type { GameplayHeldInputState } from '../../../src/playable/input/routeGameplayInput.ts';

interface InputAuditManifest {
  readonly documentedInputControls: readonly {
    readonly action: string;
    readonly control: string;
    readonly sourceOrder: number;
  }[];
  readonly explicitNullSurfaces: readonly {
    readonly reason: string;
    readonly surface: string;
  }[];
  readonly stepId: string;
}

const EXPECTED_CONTRACT = {
  command: 'bun run doom.ts',
  deterministicReplay: {
    liveTicMutation: false,
    returnsFrozenTicCommandSnapshot: true,
    timestamps: 'forbidden',
  },
  documentedGameplayControls: [
    { action: 'move forward or backward', control: 'W/S or Up/Down', sourceOrder: 1 },
    { action: 'turn left or right', control: 'A/D or Left/Right', sourceOrder: 2 },
    { action: 'strafe left or right', control: 'Q/E', sourceOrder: 3 },
    { action: 'run', control: 'Shift', sourceOrder: 4 },
  ],
  hostOnlyControls: [
    { action: 'toggle gameplay view and automap', control: 'Tab', sourceOrder: 5 },
    { action: 'zoom the automap', control: 'PageUp/PageDown', sourceOrder: 6 },
    { action: 'toggle automap follow', control: 'F', sourceOrder: 7 },
  ],
  reservedMenuControl: {
    control: 'Esc',
    routedByStepId: '06-010',
  },
  stepId: '06-011',
  stepTitle: 'route-gameplay-input',
  ticCommandSize: TICCMD_SIZE,
} as const;
const EXPECTED_CONTRACT_HASH = 'cd1b5c812c84e4a4936da42e765aedea50e8eb924611598430ce5dd3679d3d4d';
const EMPTY_HELD_INPUT_STATE: GameplayHeldInputState = Object.freeze({
  moveBackward: false,
  moveForward: false,
  runModifier: false,
  strafeLeft: false,
  strafeRight: false,
  turnLeft: false,
  turnRight: false,
});

function isInputAuditManifest(value: unknown): value is InputAuditManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const documentedInputControls = Reflect.get(value, 'documentedInputControls');
  const explicitNullSurfaces = Reflect.get(value, 'explicitNullSurfaces');
  const stepId = Reflect.get(value, 'stepId');

  return Array.isArray(documentedInputControls) && Array.isArray(explicitNullSurfaces) && typeof stepId === 'string';
}

async function loadInputAuditManifest(): Promise<InputAuditManifest> {
  const manifestText = await Bun.file('plan_fps/manifests/01-010-audit-missing-live-input.json').text();
  const parsedManifest: unknown = JSON.parse(manifestText);

  if (!isInputAuditManifest(parsedManifest)) {
    throw new Error('01-010 input audit manifest did not match the expected schema.');
  }

  return parsedManifest;
}

describe('ROUTE_GAMEPLAY_INPUT_CONTRACT', () => {
  test('locks the exact gameplay routing contract', () => {
    expect(ROUTE_GAMEPLAY_INPUT_CONTRACT).toEqual(EXPECTED_CONTRACT);
  });

  test('locks the gameplay routing contract hash', () => {
    const contractHash = createHash('sha256').update(JSON.stringify(ROUTE_GAMEPLAY_INPUT_CONTRACT)).digest('hex');

    expect(contractHash).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('links the contract to the 01-010 live-input audit', async () => {
    const manifest = await loadInputAuditManifest();
    const documentedGameplayControls = [...manifest.documentedInputControls].filter((documentedControl) => documentedControl.sourceOrder <= 7).sort((leftControl, rightControl) => leftControl.sourceOrder - rightControl.sourceOrder);

    expect(manifest.stepId).toBe('01-010');
    expect(documentedGameplayControls).toEqual([
      { action: 'move forward or backward', control: 'W/S or Up/Down', sourceOrder: 1 },
      { action: 'turn left or right', control: 'A/D or Left/Right', sourceOrder: 2 },
      { action: 'strafe left or right', control: 'Q/E', sourceOrder: 3 },
      { action: 'run', control: 'Shift', sourceOrder: 4 },
      { action: 'toggle gameplay view and automap', control: 'Tab', sourceOrder: 5 },
      { action: 'zoom the automap', control: 'PageUp/PageDown', sourceOrder: 6 },
      { action: 'toggle automap follow', control: 'F', sourceOrder: 7 },
    ]);
    expect(manifest.explicitNullSurfaces.some((surface) => surface.reason === 'No gameplay command routing surface is visible within the 01-010 read scope.' && surface.surface === 'gameplay-command-routing')).toBe(true);
  });
});

describe('routeGameplayInput', () => {
  test('routes gameplay movement state into a deterministic ticcmd snapshot', () => {
    const forwardResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_UPARROW,
      eventType: 'keydown',
      heldInputState: EMPTY_HELD_INPUT_STATE,
    });
    const runAndTurnResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_RSHIFT,
      eventType: 'keydown',
      heldInputState: forwardResult.heldInputState,
    });
    const turnResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: 0x64,
      eventType: 'keydown',
      heldInputState: runAndTurnResult.heldInputState,
    });
    const strafeResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: 0x71,
      eventType: 'keydown',
      heldInputState: turnResult.heldInputState,
    });

    expect(forwardResult).toMatchObject({
      handled: true,
      hostAction: null,
      ticCommand: {
        angleturn: 0,
        buttons: 0,
        chatchar: 0,
        consistancy: 0,
        forwardmove: FORWARD_MOVE[0],
        sidemove: 0,
      },
      ticCommandSize: TICCMD_SIZE,
    });
    expect(runAndTurnResult.ticCommand.forwardmove).toBe(FORWARD_MOVE[1]);
    expect(turnResult.ticCommand.angleturn).toBe(-ANGLE_TURN[1]);
    expect(strafeResult.ticCommand).toMatchObject({
      angleturn: -ANGLE_TURN[1],
      buttons: 0,
      chatchar: 0,
      consistancy: 0,
      forwardmove: FORWARD_MOVE[1],
      sidemove: -SIDE_MOVE[1],
    });
  });

  test('keeps automap host actions outside tic mutation', () => {
    const activeMovementResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_DOWNARROW,
      eventType: 'keydown',
      heldInputState: EMPTY_HELD_INPUT_STATE,
    });
    const hostActionResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_TAB,
      eventType: 'keydown',
      heldInputState: activeMovementResult.heldInputState,
    });
    const zoomResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_PGDN,
      eventType: 'keydown',
      heldInputState: activeMovementResult.heldInputState,
    });

    expect(hostActionResult.hostAction).toBe('automap-view-toggle');
    expect(hostActionResult.heldInputState).toEqual(activeMovementResult.heldInputState);
    expect(hostActionResult.ticCommand).toEqual(activeMovementResult.ticCommand);
    expect(zoomResult.hostAction).toBe('automap-zoom-out');
  });

  test('releases held gameplay state on keyup', () => {
    const runningForwardResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_UPARROW,
      eventType: 'keydown',
      heldInputState: Object.freeze({
        moveBackward: false,
        moveForward: false,
        runModifier: true,
        strafeLeft: false,
        strafeRight: false,
        turnLeft: false,
        turnRight: false,
      }),
    });
    const releaseRunResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_RSHIFT,
      eventType: 'keyup',
      heldInputState: runningForwardResult.heldInputState,
    });
    const releaseForwardResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_UPARROW,
      eventType: 'keyup',
      heldInputState: releaseRunResult.heldInputState,
    });

    expect(releaseRunResult.ticCommand.forwardmove).toBe(FORWARD_MOVE[0]);
    expect(releaseForwardResult.heldInputState).toEqual(EMPTY_HELD_INPUT_STATE);
    expect(releaseForwardResult.ticCommand).toBe(EMPTY_TICCMD);
  });

  test('ignores reserved menu and unmapped gameplay keys', () => {
    const escapeResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_ESCAPE,
      eventType: 'keydown',
      heldInputState: EMPTY_HELD_INPUT_STATE,
    });
    const hostKeyupResult = routeGameplayInput({
      command: 'bun run doom.ts',
      doomKey: KEY_TAB,
      eventType: 'keyup',
      heldInputState: EMPTY_HELD_INPUT_STATE,
    });

    expect(escapeResult).toEqual({
      handled: false,
      heldInputState: EMPTY_HELD_INPUT_STATE,
      hostAction: null,
      ticCommand: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
    });
    expect(hostKeyupResult.handled).toBe(false);
    expect(hostKeyupResult.ticCommand).toBe(EMPTY_TICCMD);
  });

  test('rejects the wrong command contract and unsupported event types', () => {
    const invalidEventRequest = {
      command: 'bun run doom.ts',
      doomKey: KEY_UPARROW,
      eventType: 'keypress',
      heldInputState: EMPTY_HELD_INPUT_STATE,
    };

    expect(() =>
      routeGameplayInput({
        command: 'bun run src/main.ts',
        doomKey: KEY_UPARROW,
        eventType: 'keydown',
        heldInputState: EMPTY_HELD_INPUT_STATE,
      }),
    ).toThrow('routeGameplayInput requires command "bun run doom.ts".');
    expect(() => Reflect.apply(routeGameplayInput, undefined, [invalidEventRequest])).toThrow('routeGameplayInput only supports keydown and keyup events.');
  });
});
