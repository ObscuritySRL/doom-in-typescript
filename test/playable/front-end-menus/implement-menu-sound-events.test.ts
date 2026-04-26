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
  MENU_SOUND_EVENT_NONE,
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

  test('rejects the wrong runtime command before any menu or front-end mutation', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Options);
    menuState.itemOn = 3;
    frontEndSequenceState.menuActive = false;

    expect(() => implementMenuSoundEvents('bun run other.ts', frontEndSequenceState, menuState, KEY_RIGHTARROW)).toThrow('implementMenuSoundEvents requires bun run doom.ts');
    expect(menuState.active).toBe(true);
    expect(menuState.currentMenu).toBe(MenuKind.Options);
    expect(menuState.itemOn).toBe(3);
    expect(frontEndSequenceState.menuActive).toBe(false);
  });

  test('emits a back sound event when ESC closes the main menu', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);
    frontEndSequenceState.menuActive = true;

    const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_ESCAPE);

    expect(result.menuAction).toEqual({ kind: 'closeMenu' });
    expect(result.soundEvent).toBe(MENU_SOUND_EVENT_BACK);
    expect(menuState.active).toBe(false);
    expect(menuState.currentMenu).toBe(MenuKind.Main);
    expect(frontEndSequenceState.menuActive).toBe(false);
  });

  test('emits a back sound event when ESC walks from a submenu back to its parent', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);
    frontEndSequenceState.menuActive = true;
    void implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_ENTER);

    expect(menuState.currentMenu).toBe(MenuKind.Episode);

    const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_ESCAPE);

    expect(result.menuAction).toEqual({ kind: 'openMenu', target: MenuKind.Main });
    expect(result.soundEvent).toBe(MENU_SOUND_EVENT_BACK);
    expect(menuState.currentMenu).toBe(MenuKind.Main);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('emits an activate sound event when a yes-no confirmation is accepted', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);
    menuState.itemOn = 5;
    void implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_ENTER);

    expect(menuState.messageActive).toBe(true);

    const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, 'y'.charCodeAt(0));

    expect(result.menuAction).toEqual({ kind: 'quitGame' });
    expect(result.soundEvent).toBe(MENU_SOUND_EVENT_ACTIVATE);
    expect(menuState.messageActive).toBe(false);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('emits an activate sound event when a save slot routes into save-string entry', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Save);
    frontEndSequenceState.menuActive = true;

    const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_ENTER);

    expect(result.menuAction).toEqual({ kind: 'beginSaveStringEntry', slot: 0 });
    expect(result.soundEvent).toBe(MENU_SOUND_EVENT_ACTIVATE);
    expect(menuState.saveStringEnter).toBe(true);
    expect(menuState.saveStringSlot).toBe(0);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('emits a none sound event for a key that has no menu effect and no state transition', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);
    frontEndSequenceState.menuActive = true;
    const itemOnBefore = menuState.itemOn;
    const currentMenuBefore = menuState.currentMenu;

    const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, 'z'.charCodeAt(0));

    expect(result.menuAction).toEqual({ kind: 'none' });
    expect(result.soundEvent).toBe(MENU_SOUND_EVENT_NONE);
    expect(menuState.itemOn).toBe(itemOnBefore);
    expect(menuState.currentMenu).toBe(currentMenuBefore);
    expect(menuState.messageActive).toBe(false);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('emits stable, frozen sound event singletons', () => {
    expect(Object.isFrozen(MENU_SOUND_EVENT_ACTIVATE)).toBe(true);
    expect(Object.isFrozen(MENU_SOUND_EVENT_ADJUST)).toBe(true);
    expect(Object.isFrozen(MENU_SOUND_EVENT_BACK)).toBe(true);
    expect(Object.isFrozen(MENU_SOUND_EVENT_CURSOR_MOVE)).toBe(true);
    expect(Object.isFrozen(MENU_SOUND_EVENT_NONE)).toBe(true);
    expect(MENU_SOUND_EVENT_ACTIVATE.kind).toBe('activate');
    expect(MENU_SOUND_EVENT_ADJUST.kind).toBe('adjust');
    expect(MENU_SOUND_EVENT_BACK.kind).toBe('back');
    expect(MENU_SOUND_EVENT_CURSOR_MOVE.kind).toBe('cursorMove');
    expect(MENU_SOUND_EVENT_NONE.kind).toBe('none');
    expect(Object.isFrozen(IMPLEMENT_MENU_SOUND_EVENTS_RUNTIME_CONTRACT)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_MENU_SOUND_EVENTS_RUNTIME_CONTRACT.audit)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_MENU_SOUND_EVENTS_RUNTIME_CONTRACT.route)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_MENU_SOUND_EVENTS_RUNTIME_CONTRACT.targetRuntime)).toBe(true);
  });

  test('locks the source hash for the menu sound events wrapper', () => {
    expect(menuSoundEventsSourceHash).toBe('e980868c353f1dbc3cf4e9b89846a75ee266450e429e1847a34472286dff8c6e');
  });
});
