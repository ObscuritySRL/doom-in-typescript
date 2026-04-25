import { describe, expect, test } from 'bun:test';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, KEY_DOWNARROW, KEY_ENTER, KEY_ESCAPE, KEY_RIGHTARROW, MenuKind, openMenu } from '../../../src/ui/menus.ts';
import {
  IMPLEMENT_MENU_SOUND_EVENTS_RUNTIME_CONTRACT,
  implementMenuSoundEvents,
  MENU_SOUND_EVENT_ACTIVATE,
  MENU_SOUND_EVENT_ADJUST,
  MENU_SOUND_EVENT_BACK,
  MENU_SOUND_EVENT_CURSOR_MOVE,
} from '../../../src/playable/front-end-menus/implementMenuSoundEvents.ts';

const menuSoundEventsSourceHash = new Bun.CryptoHasher('sha256').update(await Bun.file(new URL('../../../src/playable/front-end-menus/implementMenuSoundEvents.ts', import.meta.url)).text()).digest('hex');

describe('implementMenuSoundEvents', () => {
  test('locks the Bun runtime contract and audit linkage', async () => {
    const launchToMenuAudit = JSON.parse(await Bun.file(new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url)).text()) as {
      readonly audit: {
        readonly stepId: string;
        readonly title: string;
      };
      readonly commandContracts: {
        readonly targetRuntime: {
          readonly entryFile: string;
          readonly program: string;
          readonly subcommand: string;
          readonly value: string;
        };
      };
    };

    expect(IMPLEMENT_MENU_SOUND_EVENTS_RUNTIME_CONTRACT).toEqual({
      audit: {
        schemaVersion: 1,
        stepId: '01-008',
        title: 'audit-missing-launch-to-menu',
      },
      deterministicReplayCompatible: true,
      route: {
        frontEndSequenceModule: 'src/ui/frontEndSequence.ts',
        menuModule: 'src/ui/menus.ts',
      },
      targetRuntime: {
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
        value: 'bun run doom.ts',
      },
    });
    expect(launchToMenuAudit.audit).toEqual(IMPLEMENT_MENU_SOUND_EVENTS_RUNTIME_CONTRACT.audit);
    expect(launchToMenuAudit.commandContracts.targetRuntime).toEqual(IMPLEMENT_MENU_SOUND_EVENTS_RUNTIME_CONTRACT.targetRuntime);
  });

  test('opens the main menu with an activate sound event and preserves demo playback state', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    frontEndSequenceState.inDemoPlayback = true;

    const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_ESCAPE);

    expect(result.menuAction).toEqual({ kind: 'openMenu', target: MenuKind.Main });
    expect(result.soundEvent).toBe(MENU_SOUND_EVENT_ACTIVATE);
    expect(menuState.active).toBe(true);
    expect(frontEndSequenceState.inDemoPlayback).toBe(true);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('emits a cursor-move event for vertical navigation that does not trigger a menu action', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);
    frontEndSequenceState.menuActive = true;

    const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_DOWNARROW);

    expect(result.menuAction).toEqual({ kind: 'none' });
    expect(result.soundEvent).toBe(MENU_SOUND_EVENT_CURSOR_MOVE);
    expect(menuState.itemOn).toBe(1);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('emits an adjust sound event for a slider interaction', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Options);
    menuState.itemOn = 3;

    const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_RIGHTARROW);

    expect(result.menuAction).toEqual({ kind: 'adjustScreenSize', direction: 1 });
    expect(result.soundEvent).toBe(MENU_SOUND_EVENT_ADJUST);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('emits a back sound event when a yes-no confirmation is cancelled', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);
    menuState.itemOn = 5;
    void implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_ENTER);

    const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, 'n'.charCodeAt(0));

    expect(result.menuAction).toEqual({ kind: 'none' });
    expect(result.soundEvent).toBe(MENU_SOUND_EVENT_BACK);
    expect(menuState.messageActive).toBe(false);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('rejects non-Bun runtime commands', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    expect(() => implementMenuSoundEvents('bun run src/main.ts', frontEndSequenceState, menuState, KEY_ESCAPE)).toThrow('implementMenuSoundEvents requires bun run doom.ts');
  });

  test('locks the source hash for the menu sound events wrapper', () => {
    expect(menuSoundEventsSourceHash).toBe('e980868c353f1dbc3cf4e9b89846a75ee266450e429e1847a34472286dff8c6e');
  });
});
