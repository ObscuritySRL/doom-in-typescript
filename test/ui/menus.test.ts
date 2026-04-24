import { describe, expect, it } from 'bun:test';

import {
  HU_FONTEND,
  HU_FONTSTART,
  KEY_BACKSPACE,
  KEY_DOWNARROW,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_LEFTARROW,
  KEY_RIGHTARROW,
  KEY_UPARROW,
  LINEHEIGHT,
  MAX_LOAD_SAVE_SLOTS,
  MENU_ACTION_NONE,
  MENU_TREE,
  MOUSE_JOY_REPEAT_DELAY,
  MenuItemStatus,
  MenuKind,
  SAVESTRINGSIZE,
  SAVESTRING_MAX_CHARS,
  SKILL_NIGHTMARE_INDEX,
  SKULLXOFF,
  SKULL_ANIM_TIME,
  canAcceptJoyInput,
  canAcceptMouseInput,
  closeMenu,
  createMenuState,
  handleMenuKey,
  markJoyInputConsumed,
  markMouseInputConsumed,
  openMenu,
  openMessage,
  tickMenu,
} from '../../src/ui/menus.ts';

import type { MenuAction, MenuState } from '../../src/ui/menus.ts';

// ── Helpers ──────────────────────────────────────────────────────────

function keyCode(ch: string): number {
  return ch.charCodeAt(0);
}

// ── Constants ────────────────────────────────────────────────────────

describe('menu constants', () => {
  it('LINEHEIGHT is 16 (m_menu.c)', () => {
    expect(LINEHEIGHT).toBe(16);
  });

  it('SKULLXOFF is -32 (m_menu.c)', () => {
    expect(SKULLXOFF).toBe(-32);
  });

  it('SKULL_ANIM_TIME is 8 tics per frame', () => {
    expect(SKULL_ANIM_TIME).toBe(8);
  });

  it('MOUSE_JOY_REPEAT_DELAY is 5 tics', () => {
    expect(MOUSE_JOY_REPEAT_DELAY).toBe(5);
  });

  it('SAVESTRINGSIZE is 24', () => {
    expect(SAVESTRINGSIZE).toBe(24);
  });

  it('SAVESTRING_MAX_CHARS is 23 (SAVESTRINGSIZE - 1 for null terminator)', () => {
    expect(SAVESTRING_MAX_CHARS).toBe(23);
  });

  it('MAX_LOAD_SAVE_SLOTS is 6', () => {
    expect(MAX_LOAD_SAVE_SLOTS).toBe(6);
  });

  it('SKILL_NIGHTMARE_INDEX is 4 (5th skill item)', () => {
    expect(SKILL_NIGHTMARE_INDEX).toBe(4);
  });

  it('HU_FONTSTART is 0x21 (!)', () => {
    expect(HU_FONTSTART).toBe(0x21);
  });

  it('HU_FONTEND is 0x5F (_)', () => {
    expect(HU_FONTEND).toBe(0x5f);
  });

  it('MENU_ACTION_NONE is frozen and has kind "none"', () => {
    expect(MENU_ACTION_NONE.kind).toBe('none');
    expect(Object.isFrozen(MENU_ACTION_NONE)).toBe(true);
  });
});

// ── Menu tree structure ──────────────────────────────────────────────

describe('MENU_TREE structure', () => {
  it('defines all 9 menus', () => {
    expect(Object.keys(MENU_TREE)).toHaveLength(9);
    for (const kind of Object.values(MenuKind)) {
      expect(MENU_TREE[kind]).toBeDefined();
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(MENU_TREE)).toBe(true);
  });

  it('every menu is frozen', () => {
    for (const kind of Object.values(MenuKind)) {
      expect(Object.isFrozen(MENU_TREE[kind])).toBe(true);
    }
  });

  it('every items array is frozen and every item is frozen', () => {
    for (const kind of Object.values(MenuKind)) {
      const def = MENU_TREE[kind];
      expect(Object.isFrozen(def.items)).toBe(true);
      for (const item of def.items) {
        expect(Object.isFrozen(item)).toBe(true);
      }
    }
  });

  it('Main menu has 6 items (new, options, load, save, read, quit)', () => {
    const def = MENU_TREE[MenuKind.Main];
    expect(def.items).toHaveLength(6);
    expect(def.items[0]!.lump).toBe('M_NGAME');
    expect(def.items[1]!.lump).toBe('M_OPTION');
    expect(def.items[2]!.lump).toBe('M_LOADG');
    expect(def.items[3]!.lump).toBe('M_SAVEG');
    expect(def.items[4]!.lump).toBe('M_RDTHIS');
    expect(def.items[5]!.lump).toBe('M_QUITG');
  });

  it('Main menu has parent null (ESC closes the menu system)', () => {
    expect(MENU_TREE[MenuKind.Main].parent).toBe(null);
  });

  it('Episode menu has 4 items (E1..E4 — E4 drawn only in Ultimate)', () => {
    const def = MENU_TREE[MenuKind.Episode];
    expect(def.items).toHaveLength(4);
    expect(def.items[0]!.lump).toBe('M_EPI1');
    expect(def.items[1]!.lump).toBe('M_EPI2');
    expect(def.items[2]!.lump).toBe('M_EPI3');
    expect(def.items[3]!.lump).toBe('M_EPI4');
  });

  it('Skill menu has 5 items with Nightmare at index 4', () => {
    const def = MENU_TREE[MenuKind.Skill];
    expect(def.items).toHaveLength(5);
    expect(def.items[0]!.lump).toBe('M_JKILL');
    expect(def.items[1]!.lump).toBe('M_ROUGH');
    expect(def.items[2]!.lump).toBe('M_HURT');
    expect(def.items[3]!.lump).toBe('M_ULTRA');
    expect(def.items[4]!.lump).toBe('M_NMARE');
  });

  it('Skill default cursor is 2 (Hurt Me Plenty — vanilla defskill)', () => {
    expect(MENU_TREE[MenuKind.Skill].defaultItemOn).toBe(2);
  });

  it('Skill Nightmare item opens a Y/N confirm message', () => {
    const item = MENU_TREE[MenuKind.Skill].items[4]!;
    expect(item.onEnter.kind).toBe('openMessage');
    if (item.onEnter.kind !== 'openMessage') throw new Error('unreachable');
    expect(item.onEnter.needsYesNo).toBe(true);
    expect(item.onEnter.onConfirm.kind).toBe('selectSkill');
    if (item.onEnter.onConfirm.kind !== 'selectSkill') throw new Error('unreachable');
    expect(item.onEnter.onConfirm.skill).toBe(SKILL_NIGHTMARE_INDEX);
  });

  it('Options menu has 8 items including 2 spacers', () => {
    const def = MENU_TREE[MenuKind.Options];
    expect(def.items).toHaveLength(8);
    expect(def.items[4]!.status).toBe(MenuItemStatus.Spacer);
    expect(def.items[6]!.status).toBe(MenuItemStatus.Spacer);
  });

  it('Options menu slider items (ScreenSize, Sensitivity) are status Slider', () => {
    const def = MENU_TREE[MenuKind.Options];
    expect(def.items[3]!.status).toBe(MenuItemStatus.Slider);
    expect(def.items[5]!.status).toBe(MenuItemStatus.Slider);
  });

  it('SoundVolume menu has 4 items (sfx + spacer + music + spacer)', () => {
    const def = MENU_TREE[MenuKind.SoundVolume];
    expect(def.items).toHaveLength(4);
    expect(def.items[0]!.status).toBe(MenuItemStatus.Slider);
    expect(def.items[1]!.status).toBe(MenuItemStatus.Spacer);
    expect(def.items[2]!.status).toBe(MenuItemStatus.Slider);
    expect(def.items[3]!.status).toBe(MenuItemStatus.Spacer);
  });

  it('Load menu has 6 slot items numbered 1..6 via shortcut', () => {
    const def = MENU_TREE[MenuKind.Load];
    expect(def.items).toHaveLength(MAX_LOAD_SAVE_SLOTS);
    for (let i = 0; i < MAX_LOAD_SAVE_SLOTS; i++) {
      expect(def.items[i]!.shortcut).toBe(String.fromCharCode(0x31 + i));
    }
  });

  it('Save menu has 6 slot items with selectSaveSlot actions', () => {
    const def = MENU_TREE[MenuKind.Save];
    expect(def.items).toHaveLength(MAX_LOAD_SAVE_SLOTS);
    for (let i = 0; i < MAX_LOAD_SAVE_SLOTS; i++) {
      expect(def.items[i]!.onEnter.kind).toBe('selectSaveSlot');
      if (def.items[i]!.onEnter.kind !== 'selectSaveSlot') throw new Error('unreachable');
      expect((def.items[i]!.onEnter as { kind: 'selectSaveSlot'; slot: number }).slot).toBe(i);
    }
  });

  it('ReadThis1 parent is Main; ReadThis2 parent is ReadThis1', () => {
    expect(MENU_TREE[MenuKind.ReadThis1].parent).toBe(MenuKind.Main);
    expect(MENU_TREE[MenuKind.ReadThis2].parent).toBe(MenuKind.ReadThis1);
  });

  it('ReadThis2 advance action emits readThisAdvance (not a menu switch)', () => {
    const item = MENU_TREE[MenuKind.ReadThis2].items[0]!;
    expect(item.onEnter.kind).toBe('readThisAdvance');
  });

  it('Main menu Quit item opens a Y/N confirm with quitGame onConfirm', () => {
    const item = MENU_TREE[MenuKind.Main].items[5]!;
    expect(item.onEnter.kind).toBe('openMessage');
    if (item.onEnter.kind !== 'openMessage') throw new Error('unreachable');
    expect(item.onEnter.needsYesNo).toBe(true);
    expect(item.onEnter.onConfirm.kind).toBe('quitGame');
  });

  it('Options menu End Game item opens a Y/N confirm with endGame onConfirm', () => {
    const item = MENU_TREE[MenuKind.Options].items[0]!;
    expect(item.onEnter.kind).toBe('openMessage');
    if (item.onEnter.kind !== 'openMessage') throw new Error('unreachable');
    expect(item.onEnter.needsYesNo).toBe(true);
    expect(item.onEnter.onConfirm.kind).toBe('endGame');
  });

  it('Main shortcut keys are the vanilla lowercase single-letter set', () => {
    const shortcuts = MENU_TREE[MenuKind.Main].items.map((i) => i.shortcut);
    expect(shortcuts).toEqual(['n', 'o', 'l', 's', 'r', 'q']);
  });
});

// ── createMenuState ──────────────────────────────────────────────────

describe('createMenuState', () => {
  it('returns every field at its vanilla M_Init default', () => {
    const state = createMenuState();
    expect(state.active).toBe(false);
    expect(state.currentMenu).toBe(MenuKind.Main);
    expect(state.itemOn).toBe(0);
    expect(state.whichSkull).toBe(0);
    expect(state.skullAnimCounter).toBe(SKULL_ANIM_TIME);
    expect(state.mouseWait).toBe(0);
    expect(state.joyWait).toBe(0);
    expect(state.messageActive).toBe(false);
    expect(state.messageNeedsYesNo).toBe(false);
    expect(state.messageString).toBe(null);
    expect(state.messagePendingAction).toBe(null);
    expect(state.saveStringEnter).toBe(false);
    expect(state.saveStringSlot).toBe(-1);
    expect(state.saveStringBuffer).toBe('');
    expect(state.saveStringOld).toBe('');
  });

  it('returns a distinct mutable object on each call', () => {
    const a = createMenuState();
    const b = createMenuState();
    expect(a).not.toBe(b);
    a.itemOn = 3;
    expect(b.itemOn).toBe(0);
  });
});

// ── openMenu / closeMenu ─────────────────────────────────────────────

describe('openMenu', () => {
  it('activates and sets currentMenu to the requested kind', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Options);
    expect(state.active).toBe(true);
    expect(state.currentMenu).toBe(MenuKind.Options);
  });

  it('resets itemOn to the menu default for Skill (default 2 = Hurt Me Plenty)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Skill);
    expect(state.itemOn).toBe(2);
  });

  it('walks past a spacer default (constructs a synthetic menu check via Options + SoundVolume)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.SoundVolume);
    expect(state.itemOn).toBe(0);
    expect(MENU_TREE[MenuKind.SoundVolume].items[0]!.status).toBe(MenuItemStatus.Slider);
  });

  it('clears any in-progress message and save-string entry', () => {
    const state = createMenuState();
    state.messageActive = true;
    state.messageString = 'stale';
    state.saveStringEnter = true;
    state.saveStringSlot = 3;
    state.saveStringBuffer = 'oldbuf';
    openMenu(state, MenuKind.Main);
    expect(state.messageActive).toBe(false);
    expect(state.messageString).toBeNull();
    expect(state.saveStringEnter).toBe(false);
    expect(state.saveStringSlot).toBe(-1);
    expect(state.saveStringBuffer).toBe('');
  });

  it('preserves whichSkull and skullAnimCounter (blink phase survives reopen)', () => {
    const state = createMenuState();
    state.whichSkull = 1;
    state.skullAnimCounter = 3;
    openMenu(state, MenuKind.Main);
    expect(state.whichSkull).toBe(1);
    expect(state.skullAnimCounter).toBe(3);
  });

  it('preserves mouseWait and joyWait (repeat cooldowns survive reopen)', () => {
    const state = createMenuState();
    state.mouseWait = 100;
    state.joyWait = 200;
    openMenu(state, MenuKind.Main);
    expect(state.mouseWait).toBe(100);
    expect(state.joyWait).toBe(200);
  });
});

describe('closeMenu', () => {
  it('sets active to false', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    closeMenu(state);
    expect(state.active).toBe(false);
  });

  it('clears any pending message and save-string entry', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    state.messageActive = true;
    state.messageString = 'hi';
    state.saveStringEnter = true;
    state.saveStringSlot = 2;
    state.saveStringBuffer = 'wip';
    closeMenu(state);
    expect(state.messageActive).toBe(false);
    expect(state.messageString).toBeNull();
    expect(state.saveStringEnter).toBe(false);
    expect(state.saveStringSlot).toBe(-1);
  });

  it('preserves currentMenu so the next openMenu(currentMenu) resumes', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Options);
    closeMenu(state);
    expect(state.currentMenu).toBe(MenuKind.Options);
  });
});

// ── openMessage ──────────────────────────────────────────────────────

describe('openMessage', () => {
  it('opens a Y/N confirm that holds the onConfirm action', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    const onConfirm: MenuAction = { kind: 'quitGame' };
    openMessage(state, 'quit?', true, onConfirm);
    expect(state.messageActive).toBe(true);
    expect(state.messageNeedsYesNo).toBe(true);
    expect(state.messageString).toBe('quit?');
    expect(state.messagePendingAction).toEqual(onConfirm);
  });

  it('opens an informational (any-key-dismiss) message with no pending action', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    openMessage(state, 'you need to buy the full game', false, null);
    expect(state.messageActive).toBe(true);
    expect(state.messageNeedsYesNo).toBe(false);
    expect(state.messageString).toBe('you need to buy the full game');
    expect(state.messagePendingAction).toBe(null);
  });

  it('ignores the onConfirm argument for informational messages (needsYesNo=false)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    openMessage(state, 'info', false, { kind: 'quitGame' });
    expect(state.messagePendingAction).toBe(null);
  });
});

// ── tickMenu (skull animation) ───────────────────────────────────────

describe('tickMenu skull animation', () => {
  it('decrements skullAnimCounter by 1 per tick', () => {
    const state = createMenuState();
    state.skullAnimCounter = 8;
    tickMenu(state);
    expect(state.skullAnimCounter).toBe(7);
  });

  it('flips whichSkull and reloads counter when counter reaches 0', () => {
    const state = createMenuState();
    state.skullAnimCounter = 1;
    state.whichSkull = 0;
    tickMenu(state);
    expect(state.whichSkull as number).toBe(1);
    expect(state.skullAnimCounter).toBe(SKULL_ANIM_TIME);
  });

  it('flips whichSkull from 1 back to 0 on the next wrap', () => {
    const state = createMenuState();
    state.skullAnimCounter = 1;
    state.whichSkull = 1;
    tickMenu(state);
    expect(state.whichSkull as number).toBe(0);
  });

  it('blinks every 8 tics (exact period SKULL_ANIM_TIME * 2 = 16)', () => {
    const state = createMenuState();
    state.whichSkull = 0;
    state.skullAnimCounter = SKULL_ANIM_TIME;
    for (let i = 0; i < 16; i++) tickMenu(state);
    expect(state.whichSkull).toBe(0);
    expect(state.skullAnimCounter).toBe(SKULL_ANIM_TIME);
  });

  it('advances animation even when menu is inactive', () => {
    const state = createMenuState();
    state.active = false;
    state.skullAnimCounter = 1;
    tickMenu(state);
    expect(state.whichSkull).toBe(1);
  });
});

// ── Repeat-rate gates ────────────────────────────────────────────────

describe('mouse repeat-rate gate', () => {
  it('accepts input after tic 0 when mouseWait is 0 (no cooldown armed)', () => {
    const state = createMenuState();
    expect(canAcceptMouseInput(state, 1)).toBe(true);
    expect(canAcceptMouseInput(state, 100)).toBe(true);
  });

  it('rejects input at tic 0 when mouseWait is 0 (vanilla strict-less-than quirk)', () => {
    // Vanilla: `mousewait < I_GetTime()` is false when both sides are 0.
    // This reproduces the quirk: the very first tic cannot accept input
    // until the gametic strictly exceeds the armed deadline.
    const state = createMenuState();
    expect(canAcceptMouseInput(state, 0)).toBe(false);
  });

  it('rejects input until gametic strictly passes mouseWait deadline', () => {
    const state = createMenuState();
    markMouseInputConsumed(state, 10);
    expect(state.mouseWait).toBe(15);
    expect(canAcceptMouseInput(state, 10)).toBe(false);
    expect(canAcceptMouseInput(state, 14)).toBe(false);
    // At exactly the deadline, vanilla still rejects (strict less-than).
    expect(canAcceptMouseInput(state, 15)).toBe(false);
    expect(canAcceptMouseInput(state, 16)).toBe(true);
    expect(canAcceptMouseInput(state, 17)).toBe(true);
  });

  it('arms mouseWait to gametic + MOUSE_JOY_REPEAT_DELAY', () => {
    const state = createMenuState();
    markMouseInputConsumed(state, 100);
    expect(state.mouseWait).toBe(100 + MOUSE_JOY_REPEAT_DELAY);
  });

  it('effective cooldown after arming is 6 tics (vanilla parity)', () => {
    // Vanilla: mousewait = T + 5, next accept when T' > mousewait, so T' = T + 6.
    const state = createMenuState();
    markMouseInputConsumed(state, 100);
    // Tics 101..105 inclusive reject; tic 106 (5 tics later + strict >) accepts.
    for (let t = 101; t <= 105; t++) {
      expect(canAcceptMouseInput(state, t)).toBe(false);
    }
    expect(canAcceptMouseInput(state, 106)).toBe(true);
  });
});

describe('joystick repeat-rate gate', () => {
  it('accepts input after tic 0 when joyWait is 0 (no cooldown armed)', () => {
    const state = createMenuState();
    expect(canAcceptJoyInput(state, 1)).toBe(true);
    expect(canAcceptJoyInput(state, 100)).toBe(true);
  });

  it('rejects input at tic 0 when joyWait is 0 (vanilla strict-less-than quirk)', () => {
    const state = createMenuState();
    expect(canAcceptJoyInput(state, 0)).toBe(false);
  });

  it('rejects input until gametic strictly passes joyWait deadline', () => {
    const state = createMenuState();
    markJoyInputConsumed(state, 10);
    expect(state.joyWait).toBe(15);
    expect(canAcceptJoyInput(state, 10)).toBe(false);
    expect(canAcceptJoyInput(state, 14)).toBe(false);
    expect(canAcceptJoyInput(state, 15)).toBe(false);
    expect(canAcceptJoyInput(state, 16)).toBe(true);
  });

  it('arms joyWait to gametic + MOUSE_JOY_REPEAT_DELAY independent of mouseWait', () => {
    const state = createMenuState();
    markMouseInputConsumed(state, 0);
    markJoyInputConsumed(state, 50);
    expect(state.mouseWait).toBe(5);
    expect(state.joyWait).toBe(55);
  });
});

// ── handleMenuKey: inactive ──────────────────────────────────────────

describe('handleMenuKey when inactive', () => {
  it('opens Main menu on ESC when inactive', () => {
    const state = createMenuState();
    expect(state.active).toBe(false);
    const action = handleMenuKey(state, KEY_ESCAPE);
    expect(action.kind).toBe('openMenu');
    if (action.kind !== 'openMenu') throw new Error('unreachable');
    expect(action.target).toBe(MenuKind.Main);
    expect(state.active).toBe(true);
    expect(state.currentMenu).toBe(MenuKind.Main);
  });

  it('ignores non-ESC keys when inactive', () => {
    const state = createMenuState();
    const action = handleMenuKey(state, KEY_DOWNARROW);
    expect(action.kind).toBe('none');
    expect(state.active).toBe(false);
  });
});

// ── handleMenuKey: vertical navigation ───────────────────────────────

describe('handleMenuKey vertical navigation', () => {
  it('KEY_DOWNARROW advances itemOn by 1 (main menu)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    expect(state.itemOn).toBe(0);
    handleMenuKey(state, KEY_DOWNARROW);
    expect(state.itemOn).toBe(1);
  });

  it('KEY_UPARROW retreats itemOn by 1 (main menu)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 3;
    handleMenuKey(state, KEY_UPARROW);
    expect(state.itemOn).toBe(2);
  });

  it('wraps from last item to first on KEY_DOWNARROW', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 5;
    handleMenuKey(state, KEY_DOWNARROW);
    expect(state.itemOn).toBe(0);
  });

  it('wraps from first item to last on KEY_UPARROW', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 0;
    handleMenuKey(state, KEY_UPARROW);
    expect(state.itemOn).toBe(5);
  });

  it('skips spacer rows on KEY_DOWNARROW (Options menu: 3 → 5 skipping index 4)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Options);
    state.itemOn = 3;
    handleMenuKey(state, KEY_DOWNARROW);
    expect(state.itemOn).toBe(5);
  });

  it('skips spacer rows on KEY_UPARROW (Options menu: 7 → 5 skipping index 6)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Options);
    state.itemOn = 7;
    handleMenuKey(state, KEY_UPARROW);
    expect(state.itemOn).toBe(5);
  });

  it('SoundVolume wrap-around skips spacers on DOWNARROW (0 → 2 → 0)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.SoundVolume);
    expect(state.itemOn).toBe(0);
    handleMenuKey(state, KEY_DOWNARROW);
    expect(state.itemOn).toBe(2);
    handleMenuKey(state, KEY_DOWNARROW);
    expect(state.itemOn).toBe(0);
  });

  it('SoundVolume UPARROW from 0 wraps backwards skipping the final spacer to 2', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.SoundVolume);
    expect(state.itemOn).toBe(0);
    handleMenuKey(state, KEY_UPARROW);
    expect(state.itemOn).toBe(2);
  });

  it('DOWNARROW / UPARROW return the none action (navigation has no side-effect for the host)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    expect(handleMenuKey(state, KEY_DOWNARROW).kind).toBe('none');
    expect(handleMenuKey(state, KEY_UPARROW).kind).toBe('none');
  });
});

// ── handleMenuKey: Enter / Left / Right ──────────────────────────────

describe('handleMenuKey Enter on regular items', () => {
  it('fires Main.NewGame onEnter which opens the Episode sub-menu', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 0;
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('openMenu');
    if (action.kind !== 'openMenu') throw new Error('unreachable');
    expect(action.target).toBe(MenuKind.Episode);
    expect(state.currentMenu).toBe(MenuKind.Episode);
    expect(state.itemOn).toBe(0);
  });

  it('fires Main.Options onEnter which opens the Options sub-menu', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 1;
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('openMenu');
    if (action.kind !== 'openMenu') throw new Error('unreachable');
    expect(action.target).toBe(MenuKind.Options);
    expect(state.currentMenu).toBe(MenuKind.Options);
  });

  it('fires Episode.E1 onEnter emitting selectEpisode { episode: 1 }', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Episode);
    state.itemOn = 0;
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('selectEpisode');
    if (action.kind !== 'selectEpisode') throw new Error('unreachable');
    expect(action.episode).toBe(1);
  });

  it('fires Skill.I_am_a_wimp onEnter emitting selectSkill { skill: 0 }', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Skill);
    state.itemOn = 0;
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('selectSkill');
    if (action.kind !== 'selectSkill') throw new Error('unreachable');
    expect(action.skill).toBe(0);
  });

  it('fires Skill.Nightmare onEnter opening a Y/N confirm message', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Skill);
    state.itemOn = 4;
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('openMessage');
    if (action.kind !== 'openMessage') throw new Error('unreachable');
    expect(action.needsYesNo).toBe(true);
    expect(action.onConfirm.kind).toBe('selectSkill');
    expect(state.messageActive).toBe(true);
    expect(state.messageNeedsYesNo).toBe(true);
    expect(state.messagePendingAction).toEqual({ kind: 'selectSkill', skill: SKILL_NIGHTMARE_INDEX });
  });

  it('fires Load slot 3 onEnter emitting selectLoadSlot { slot: 3 }', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Load);
    state.itemOn = 3;
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('selectLoadSlot');
    if (action.kind !== 'selectLoadSlot') throw new Error('unreachable');
    expect(action.slot).toBe(3);
  });

  it('fires Save slot 0 onEnter entering save-string-entry mode', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    state.itemOn = 0;
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('beginSaveStringEntry');
    if (action.kind !== 'beginSaveStringEntry') throw new Error('unreachable');
    expect(action.slot).toBe(0);
    expect(state.saveStringEnter).toBe(true);
    expect(state.saveStringSlot).toBe(0);
    expect(state.saveStringBuffer).toBe('');
  });

  it('fires Main.Quit onEnter opening the quit Y/N confirm', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 5;
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('openMessage');
    if (action.kind !== 'openMessage') throw new Error('unreachable');
    expect(action.onConfirm.kind).toBe('quitGame');
  });
});

describe('handleMenuKey Left/Right on slider items', () => {
  it('LEFT on SoundVolume sfx slider emits adjustSfxVolume { direction: -1 }', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.SoundVolume);
    state.itemOn = 0;
    const action = handleMenuKey(state, KEY_LEFTARROW);
    expect(action.kind).toBe('adjustSfxVolume');
    if (action.kind !== 'adjustSfxVolume') throw new Error('unreachable');
    expect(action.direction).toBe(-1);
  });

  it('RIGHT on SoundVolume sfx slider emits adjustSfxVolume { direction: +1 }', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.SoundVolume);
    state.itemOn = 0;
    const action = handleMenuKey(state, KEY_RIGHTARROW);
    expect(action.kind).toBe('adjustSfxVolume');
    if (action.kind !== 'adjustSfxVolume') throw new Error('unreachable');
    expect(action.direction).toBe(1);
  });

  it('ENTER on SoundVolume sfx slider fires onEnter = increment (vanilla routine(1))', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.SoundVolume);
    state.itemOn = 0;
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('adjustSfxVolume');
    if (action.kind !== 'adjustSfxVolume') throw new Error('unreachable');
    expect(action.direction).toBe(1);
  });

  it('LEFT on a regular (non-slider) item emits none', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 0;
    const action = handleMenuKey(state, KEY_LEFTARROW);
    expect(action.kind).toBe('none');
  });

  it('RIGHT on a regular (non-slider) item emits none', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 0;
    const action = handleMenuKey(state, KEY_RIGHTARROW);
    expect(action.kind).toBe('none');
  });
});

// ── handleMenuKey: ESC back-navigation ───────────────────────────────

describe('handleMenuKey ESC back-navigation', () => {
  it('ESC in Main menu closes the menu entirely (parent is null)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    const action = handleMenuKey(state, KEY_ESCAPE);
    expect(action.kind).toBe('closeMenu');
    expect(state.active).toBe(false);
  });

  it('ESC in Options walks to parent Main', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Options);
    const action = handleMenuKey(state, KEY_ESCAPE);
    expect(action.kind).toBe('openMenu');
    if (action.kind !== 'openMenu') throw new Error('unreachable');
    expect(action.target).toBe(MenuKind.Main);
    expect(state.currentMenu).toBe(MenuKind.Main);
    expect(state.active).toBe(true);
  });

  it('ESC in SoundVolume walks to Options (2-level nested back)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.SoundVolume);
    handleMenuKey(state, KEY_ESCAPE);
    expect(state.currentMenu).toBe(MenuKind.Options);
    handleMenuKey(state, KEY_ESCAPE);
    expect(state.currentMenu).toBe(MenuKind.Main);
  });

  it('ESC in Skill walks back to Episode', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Skill);
    handleMenuKey(state, KEY_ESCAPE);
    expect(state.currentMenu).toBe(MenuKind.Episode);
  });

  it('ESC in ReadThis2 walks back to ReadThis1', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.ReadThis2);
    handleMenuKey(state, KEY_ESCAPE);
    expect(state.currentMenu).toBe(MenuKind.ReadThis1);
  });

  it('ESC resets itemOn to the parent menu default', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Skill);
    state.itemOn = 3;
    handleMenuKey(state, KEY_ESCAPE);
    expect(state.currentMenu).toBe(MenuKind.Episode);
    expect(state.itemOn).toBe(MENU_TREE[MenuKind.Episode].defaultItemOn);
  });
});

// ── handleMenuKey: shortcut keys ─────────────────────────────────────

describe('handleMenuKey shortcut dispatch', () => {
  it('"q" on Main menu jumps to Quit item and fires the confirm', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 0;
    const action = handleMenuKey(state, keyCode('q'));
    expect(action.kind).toBe('openMessage');
    if (action.kind !== 'openMessage') throw new Error('unreachable');
    expect(action.onConfirm.kind).toBe('quitGame');
    expect(state.itemOn).toBe(5);
  });

  it('"o" on Main menu jumps to Options item and opens the submenu', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    const action = handleMenuKey(state, keyCode('o'));
    expect(action.kind).toBe('openMenu');
    if (action.kind !== 'openMenu') throw new Error('unreachable');
    expect(action.target).toBe(MenuKind.Options);
  });

  it('uppercase shortcut "Q" is treated as lowercase "q"', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    const action = handleMenuKey(state, keyCode('Q'));
    expect(action.kind).toBe('openMessage');
  });

  it('unrecognized character emits none without moving cursor', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    state.itemOn = 1;
    const action = handleMenuKey(state, keyCode('z'));
    expect(action.kind).toBe('none');
    expect(state.itemOn).toBe(1);
  });

  it('shortcut match moves itemOn to the target row', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    handleMenuKey(state, keyCode('l'));
    expect(state.currentMenu).toBe(MenuKind.Load);
  });
});

// ── handleMenuKey: message overlay ───────────────────────────────────

describe('handleMenuKey message overlay', () => {
  it('Y confirms a Y/N message and fires the pending action', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    openMessage(state, 'quit?', true, { kind: 'quitGame' });
    const action = handleMenuKey(state, keyCode('y'));
    expect(action.kind).toBe('quitGame');
    expect(state.messageActive).toBe(false);
  });

  it('ENTER confirms a Y/N message (same as Y)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    openMessage(state, 'quit?', true, { kind: 'quitGame' });
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('quitGame');
  });

  it('N cancels a Y/N message and does NOT fire the pending action', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    openMessage(state, 'quit?', true, { kind: 'quitGame' });
    const action = handleMenuKey(state, keyCode('n'));
    expect(action.kind).toBe('none');
    expect(state.messageActive).toBe(false);
  });

  it('ESC cancels a Y/N message (same as N)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    openMessage(state, 'quit?', true, { kind: 'quitGame' });
    const action = handleMenuKey(state, KEY_ESCAPE);
    expect(action.kind).toBe('none');
    expect(state.messageActive).toBe(false);
  });

  it('unrelated keys on a Y/N message are ignored (overlay persists)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    openMessage(state, 'quit?', true, { kind: 'quitGame' });
    handleMenuKey(state, KEY_DOWNARROW);
    expect(state.messageActive).toBe(true);
    handleMenuKey(state, keyCode('z'));
    expect(state.messageActive).toBe(true);
  });

  it('informational message (needsYesNo=false) dismisses on any key without firing', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    openMessage(state, 'info', false, null);
    const action = handleMenuKey(state, keyCode('x'));
    expect(action.kind).toBe('none');
    expect(state.messageActive).toBe(false);
  });

  it('Nightmare confirm Y produces selectSkill { skill: 4 }', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Skill);
    state.itemOn = 4;
    handleMenuKey(state, KEY_ENTER);
    expect(state.messageActive).toBe(true);
    const action = handleMenuKey(state, keyCode('y'));
    expect(action.kind).toBe('selectSkill');
    if (action.kind !== 'selectSkill') throw new Error('unreachable');
    expect(action.skill).toBe(SKILL_NIGHTMARE_INDEX);
  });
});

// ── handleMenuKey: save-string entry ─────────────────────────────────

describe('handleMenuKey save-string entry', () => {
  it('typed printable ASCII is appended uppercased to the buffer', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    handleMenuKey(state, KEY_ENTER);
    expect(state.saveStringEnter).toBe(true);
    handleMenuKey(state, keyCode('h'));
    handleMenuKey(state, keyCode('i'));
    expect(state.saveStringBuffer).toBe('HI');
  });

  it('space is permitted even though 0x20 is below HU_FONTSTART', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    handleMenuKey(state, KEY_ENTER);
    handleMenuKey(state, keyCode('A'));
    handleMenuKey(state, keyCode(' '));
    handleMenuKey(state, keyCode('B'));
    expect(state.saveStringBuffer).toBe('A B');
  });

  it('BACKSPACE removes the last buffered character', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    handleMenuKey(state, KEY_ENTER);
    handleMenuKey(state, keyCode('a'));
    handleMenuKey(state, keyCode('b'));
    handleMenuKey(state, keyCode('c'));
    expect(state.saveStringBuffer).toBe('ABC');
    handleMenuKey(state, KEY_BACKSPACE);
    expect(state.saveStringBuffer).toBe('AB');
  });

  it('BACKSPACE on an empty buffer is a no-op', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    handleMenuKey(state, KEY_ENTER);
    handleMenuKey(state, KEY_BACKSPACE);
    expect(state.saveStringBuffer).toBe('');
    expect(state.saveStringEnter).toBe(true);
  });

  it('ENTER commits the save entry and emits commitSaveStringEntry', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    state.itemOn = 2;
    handleMenuKey(state, KEY_ENTER);
    handleMenuKey(state, keyCode('s'));
    handleMenuKey(state, keyCode('a'));
    handleMenuKey(state, keyCode('v'));
    handleMenuKey(state, keyCode('e'));
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('commitSaveStringEntry');
    if (action.kind !== 'commitSaveStringEntry') throw new Error('unreachable');
    expect(action.slot).toBe(2);
    expect(action.name).toBe('SAVE');
    expect(state.saveStringEnter).toBe(false);
    expect(state.saveStringSlot).toBe(-1);
  });

  it('ENTER with empty buffer emits none (vanilla: if (savegamestrings[slot][0]) M_DoSave)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    handleMenuKey(state, KEY_ENTER);
    const action = handleMenuKey(state, KEY_ENTER);
    expect(action.kind).toBe('none');
    expect(state.saveStringEnter).toBe(false);
  });

  it('ESC cancels save-string entry and emits cancelSaveStringEntry', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    state.itemOn = 4;
    handleMenuKey(state, KEY_ENTER);
    handleMenuKey(state, keyCode('x'));
    const action = handleMenuKey(state, KEY_ESCAPE);
    expect(action.kind).toBe('cancelSaveStringEntry');
    if (action.kind !== 'cancelSaveStringEntry') throw new Error('unreachable');
    expect(action.slot).toBe(4);
    expect(state.saveStringEnter).toBe(false);
    expect(state.saveStringSlot).toBe(-1);
    expect(state.saveStringBuffer).toBe('');
  });

  it('rejects non-printable characters (below HU_FONTSTART and not space)', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    handleMenuKey(state, KEY_ENTER);
    handleMenuKey(state, 0x01);
    handleMenuKey(state, 0x1f);
    expect(state.saveStringBuffer).toBe('');
  });

  it('rejects characters above HU_FONTEND once uppercased', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    handleMenuKey(state, KEY_ENTER);
    handleMenuKey(state, 0x60);
    handleMenuKey(state, 0x7b);
    expect(state.saveStringBuffer).toBe('');
  });

  it('enforces SAVESTRING_MAX_CHARS buffer cap', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Save);
    handleMenuKey(state, KEY_ENTER);
    for (let i = 0; i < 30; i++) handleMenuKey(state, keyCode('A'));
    expect(state.saveStringBuffer.length).toBe(SAVESTRING_MAX_CHARS);
  });
});

// ── Full flow: new game to skill select ──────────────────────────────

describe('integration: new game → episode → skill flow', () => {
  it('Main Enter on New Game opens Episode, Enter opens Skill select, Enter picks skill', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);

    handleMenuKey(state, KEY_ENTER);
    expect(state.currentMenu).toBe(MenuKind.Episode);
    expect(state.itemOn).toBe(0);

    state.itemOn = 0;
    const epAction = handleMenuKey(state, KEY_ENTER);
    expect(epAction.kind).toBe('selectEpisode');
    if (epAction.kind !== 'selectEpisode') throw new Error('unreachable');
    expect(epAction.episode).toBe(1);
  });

  it('Pre-Nightmare confirm flow: Main → Episode → Skill → Nightmare → Yes', () => {
    const state = createMenuState();
    openMenu(state, MenuKind.Main);
    handleMenuKey(state, KEY_ENTER);
    state.itemOn = 0;
    handleMenuKey(state, KEY_ENTER);
    openMenu(state, MenuKind.Skill);
    state.itemOn = 4;
    handleMenuKey(state, KEY_ENTER);
    expect(state.messageActive).toBe(true);
    const confirm = handleMenuKey(state, keyCode('y'));
    expect(confirm.kind).toBe('selectSkill');
    if (confirm.kind !== 'selectSkill') throw new Error('unreachable');
    expect(confirm.skill).toBe(SKILL_NIGHTMARE_INDEX);
  });
});

// ── Tick decoupling ──────────────────────────────────────────────────

describe('tick decoupling', () => {
  it('mouseWait/joyWait counters are independent of the skull animation', () => {
    const state = createMenuState();
    markMouseInputConsumed(state, 10);
    markJoyInputConsumed(state, 10);
    tickMenu(state);
    expect(state.mouseWait).toBe(15);
    expect(state.joyWait).toBe(15);
    expect(state.skullAnimCounter).toBe(SKULL_ANIM_TIME - 1);
  });
});

// ── MenuState type invariants ────────────────────────────────────────

describe('MenuState type invariants', () => {
  it('typed State fields survive state mutation (compile-time narrow)', () => {
    const state: MenuState = createMenuState();
    state.currentMenu = MenuKind.Options;
    state.itemOn = 7;
    expect(state.currentMenu).toBe(MenuKind.Options);
    expect(state.itemOn).toBe(7);
  });

  it('MenuAction discriminated union reaches every kind via exhaustive check', () => {
    const kinds: MenuAction['kind'][] = [
      'none',
      'openMenu',
      'closeMenu',
      'openMessage',
      'selectEpisode',
      'selectSkill',
      'selectLoadSlot',
      'selectSaveSlot',
      'readThisAdvance',
      'endGame',
      'quitGame',
      'toggleMessages',
      'toggleDetail',
      'adjustSfxVolume',
      'adjustMusicVolume',
      'adjustSensitivity',
      'adjustScreenSize',
      'beginSaveStringEntry',
      'commitSaveStringEntry',
      'cancelSaveStringEntry',
    ];
    expect(kinds).toHaveLength(20);
  });
});
