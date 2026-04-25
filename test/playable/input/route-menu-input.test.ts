import { describe, expect, test } from 'bun:test';

import { KEY_BACKSPACE, KEY_DOWNARROW, KEY_ENTER, KEY_ESCAPE, KEY_LEFTARROW, KEY_RIGHTARROW, KEY_UPARROW } from '../../../src/input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { ROUTE_MENU_INPUT_CONTRACT, routeMenuInput } from '../../../src/playable/input/routeMenuInput.ts';

interface InputAuditManifest {
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
  readonly stepTitle: string;
}

function isInputAuditManifest(value: unknown): value is InputAuditManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const manifestRecord = value as Record<string, unknown>;
  const commandContracts = manifestRecord.commandContracts;
  const explicitNullSurfaces = manifestRecord.explicitNullSurfaces;

  if (typeof commandContracts !== 'object' || commandContracts === null) {
    return false;
  }

  if (!Array.isArray(explicitNullSurfaces)) {
    return false;
  }

  const target = (commandContracts as Record<string, unknown>).target;
  if (typeof target !== 'object' || target === null) {
    return false;
  }

  return (
    typeof manifestRecord.stepId === 'string' &&
    typeof manifestRecord.stepTitle === 'string' &&
    typeof (target as Record<string, unknown>).runtimeCommand === 'string' &&
    explicitNullSurfaces.every((surfaceValue) => {
      if (typeof surfaceValue !== 'object' || surfaceValue === null) {
        return false;
      }

      const surfaceRecord = surfaceValue as Record<string, unknown>;
      return typeof surfaceRecord.reason === 'string' && typeof surfaceRecord.surface === 'string';
    })
  );
}

function routeMenuInputContractHash(): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(ROUTE_MENU_INPUT_CONTRACT)).digest('hex');
}

describe('routeMenuInput', () => {
  test('exports the exact Bun-only route menu input contract', () => {
    expect(ROUTE_MENU_INPUT_CONTRACT).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-010-audit-missing-live-input.json',
      auditSurface: 'menu-input-routing',
      ignoredEventType: 'keyup',
      replayCompatibility: 'menu-routing-returns-neutral-ticcmd',
      routeTable: [
        { action: 'open-menu', doomKey: KEY_ESCAPE, menuActive: false, transition: 'closed-to-open' },
        { action: 'back', doomKey: KEY_BACKSPACE, menuActive: true, transition: 'open-to-open' },
        { action: 'move-down', doomKey: KEY_DOWNARROW, menuActive: true, transition: 'open-to-open' },
        { action: 'activate', doomKey: KEY_ENTER, menuActive: true, transition: 'open-to-open' },
        { action: 'back', doomKey: KEY_ESCAPE, menuActive: true, transition: 'open-to-open' },
        { action: 'move-left', doomKey: KEY_LEFTARROW, menuActive: true, transition: 'open-to-open' },
        { action: 'move-right', doomKey: KEY_RIGHTARROW, menuActive: true, transition: 'open-to-open' },
        { action: 'move-up', doomKey: KEY_UPARROW, menuActive: true, transition: 'open-to-open' },
      ],
      runtimeCommand: 'bun run doom.ts',
      ticCommandSize: TICCMD_SIZE,
    });
  });

  test('keeps a stable contract hash', () => {
    expect(routeMenuInputContractHash()).toBe('f5e65f2eb8031f8c6f18cc3f16640de867286892aacd6e1e8ce641647feeb4a2');
  });

  test('links the audited missing menu routing surface to the Bun runtime command', async () => {
    const manifestPath = ROUTE_MENU_INPUT_CONTRACT.auditManifestPath;
    const parsedManifest: unknown = JSON.parse(await Bun.file(manifestPath).text());
    expect(isInputAuditManifest(parsedManifest)).toBe(true);

    if (!isInputAuditManifest(parsedManifest)) {
      throw new Error(`Invalid input audit manifest: ${manifestPath}`);
    }

    expect(parsedManifest.commandContracts.target.runtimeCommand).toBe(ROUTE_MENU_INPUT_CONTRACT.runtimeCommand);
    expect(parsedManifest.stepId).toBe('01-010');
    expect(parsedManifest.stepTitle).toBe('audit-missing-live-input');
    expect(parsedManifest.explicitNullSurfaces.some((surfaceValue) => surfaceValue.surface === ROUTE_MENU_INPUT_CONTRACT.auditSurface)).toBe(true);
  });

  test('opens the menu from gameplay only on Escape keydown and keeps tic state neutral', () => {
    expect(
      routeMenuInput({
        doomKey: KEY_ESCAPE,
        eventType: 'keydown',
        menuActive: false,
        runtimeCommand: ROUTE_MENU_INPUT_CONTRACT.runtimeCommand,
      }),
    ).toEqual({
      action: 'open-menu',
      consumed: true,
      route: 'menu',
      ticCommand: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
      transition: 'closed-to-open',
    });

    expect(
      routeMenuInput({
        doomKey: KEY_UPARROW,
        eventType: 'keydown',
        menuActive: false,
        runtimeCommand: ROUTE_MENU_INPUT_CONTRACT.runtimeCommand,
      }),
    ).toBeNull();
  });

  test('routes active menu navigation and activation keys without mutating tic state', () => {
    expect(
      routeMenuInput({
        doomKey: KEY_UPARROW,
        eventType: 'keydown',
        menuActive: true,
        runtimeCommand: ROUTE_MENU_INPUT_CONTRACT.runtimeCommand,
      }),
    ).toEqual({
      action: 'move-up',
      consumed: true,
      route: 'menu',
      ticCommand: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
      transition: 'open-to-open',
    });

    expect(
      routeMenuInput({
        doomKey: KEY_ENTER,
        eventType: 'keydown',
        menuActive: true,
        runtimeCommand: ROUTE_MENU_INPUT_CONTRACT.runtimeCommand,
      }),
    ).toEqual({
      action: 'activate',
      consumed: true,
      route: 'menu',
      ticCommand: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
      transition: 'open-to-open',
    });

    expect(
      routeMenuInput({
        doomKey: KEY_BACKSPACE,
        eventType: 'keydown',
        menuActive: true,
        runtimeCommand: ROUTE_MENU_INPUT_CONTRACT.runtimeCommand,
      }),
    ).toEqual({
      action: 'back',
      consumed: true,
      route: 'menu',
      ticCommand: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
      transition: 'open-to-open',
    });
  });

  test('ignores keyup and unmapped menu keys', () => {
    expect(
      routeMenuInput({
        doomKey: KEY_ESCAPE,
        eventType: 'keyup',
        menuActive: true,
        runtimeCommand: ROUTE_MENU_INPUT_CONTRACT.runtimeCommand,
      }),
    ).toBeNull();

    expect(
      routeMenuInput({
        doomKey: 0,
        eventType: 'keydown',
        menuActive: true,
        runtimeCommand: ROUTE_MENU_INPUT_CONTRACT.runtimeCommand,
      }),
    ).toBeNull();
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() =>
      routeMenuInput({
        doomKey: KEY_ESCAPE,
        eventType: 'keydown',
        menuActive: false,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('routeMenuInput requires bun run doom.ts; received bun run src/main.ts');
  });

  test('rejects unsupported menu input event types', () => {
    const unsupportedEventRequest = {
      doomKey: KEY_ESCAPE,
      eventType: 'keypress',
      menuActive: false,
      runtimeCommand: ROUTE_MENU_INPUT_CONTRACT.runtimeCommand,
    };

    expect(() => Reflect.apply(routeMenuInput, undefined, [unsupportedEventRequest])).toThrow('Unsupported menu input event type: keypress');
  });
});
