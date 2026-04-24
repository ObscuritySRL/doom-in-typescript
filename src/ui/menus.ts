/**
 * Menu tree and repeat-timing state machine (m_menu.c).
 *
 * Implements the pure-logic half of vanilla DOOM's front-end menu: the
 * menu tree (Main → Episode → Skill, Options → SoundVolume, Load,
 * Save, ReadThis1 → ReadThis2), skull-cursor blink animation,
 * mouse/joystick repeat-rate gates, ESC back-navigation, hotkey
 * dispatch, Y/N confirm overlays, and save-string entry.  Pixel
 * drawing and the actual game-state effects of each menu action
 * (starting a new game, writing a save slot, toggling detail) are out
 * of scope; callers consume the emitted {@link MenuAction} value and
 * wire it to the rest of the engine.
 *
 * Parity invariants preserved byte-for-byte from Chocolate Doom 2.2.1
 * m_menu.c:
 *
 *  - `skullAnimCounter` decrements once per tic; when it reaches 0 the
 *    cursor flips `whichSkull` and reloads `skullAnimCounter = 8`.  The
 *    M_SKULL1 / M_SKULL2 blink is exactly 8 tics per frame (~4.4 Hz).
 *  - `mouseWait` and `joyWait` are absolute-gametic deadlines.  Input
 *    is rejected until `gametic > mouseWait` (resp. `joyWait`) —
 *    strict greater-than, mirroring vanilla's `if (mousewait <
 *    I_GetTime())`.  On accept, the deadline is re-armed to `gametic
 *    + 5`, giving a 6-tic effective cooldown (the tic of
 *    arming + 5 waits), same as vanilla's `mousewait = I_GetTime() + 5`.
 *  - Keyboard events are NOT rate-limited at the menu layer.  Vanilla
 *    relies on Win32 WM_KEYDOWN auto-repeat for hold-to-repeat behavior
 *    in save-string entry; this port preserves that assumption and
 *    does not gate arrow/letter keys on `mouseWait`.
 *  - `itemOn` skips items with `status = MenuItemStatus.Spacer` on
 *    up/down navigation.  Wrap-around at the first/last item is load-
 *    bearing: vanilla's `M_SelectPrev` / `M_SelectNext` loop until they
 *    land on a non-spacer.  A menu of all-spacer items would hang — in
 *    practice every menu has at least one real item so the loop
 *    terminates.
 *  - Left arrow fires `onLeft` for slider items and also cycles through
 *    toggleable options (messages / detail) in vanilla via the same
 *    routine-with-choice-0 convention.  Right arrow fires `onRight`.
 *    Enter fires `onEnter`.  Shortcut-key matches fire `onEnter` and
 *    move `itemOn` to the matched position.
 *  - Status `Spacer` items are drawn as empty vertical gaps and are
 *    never landable.  Status `Disabled` items are never landable but
 *    do draw (vanilla uses this to grey out Save Game on the main menu
 *    when not in a live game; this port exposes the flag but the
 *    actual gating is a caller responsibility).
 *  - ESC behavior: if `currentMenu` is the Main menu, close the menu
 *    system entirely.  Otherwise, walk up to `parent`.  The Main
 *    menu's parent is `null` — this is the sentinel that triggers
 *    `closeMenu`.
 *  - Nightmare skill selection triggers a Y/N confirm overlay.  The
 *    confirm's `onConfirm` is `selectSkill { skill: 4 }`.  On Y or
 *    Enter, the confirm fires and closes.  On N / ESC, the confirm
 *    cancels without firing.  Informational messages (no needsYesNo)
 *    close on any key.
 *  - Quit DOOM opens a Y/N confirm with an endoom-style message.  On
 *    Y / Enter, the caller receives a `quitGame` action which the host
 *    turns into I_Quit + endoom display.  On N / ESC, the confirm
 *    cancels.
 *  - End Game opens a Y/N confirm ("are you sure you want to end the
 *    game?").  Identical flow to Quit, but the confirmed action is
 *    `endGame` which returns to the demo loop.
 *  - Save-string entry: when the player activates a save slot, the
 *    menu enters save-string-entry mode.  BACKSPACE removes the last
 *    character from the slot buffer.  ENTER commits the save.  ESC
 *    cancels and restores the previous buffer.  Printable ASCII is
 *    appended while the buffer length is below `SAVESTRINGSIZE - 1`.
 *    Vanilla uppercases every typed character before the HU_FONT range
 *    check; this port matches that via `toUpperCase()` on each
 *    printable character.
 *  - `LINEHEIGHT = 16` pixels for every menu row (m_menu.c LINEHEIGHT).
 *  - `SKULLXOFF = -32` places the skull cursor 32 pixels LEFT of the
 *    menu's x origin (m_menu.c SKULLXOFF).  Negative value is vanilla.
 *  - `SAVESTRINGSIZE = 24` byte buffer for save names (m_misc.h
 *    SAVESTRINGSIZE).  Minus one for the null terminator leaves 23
 *    usable characters.
 *  - `SKILL_NIGHTMARE_INDEX = 4` — the index into the skill menu that
 *    triggers the "are you sure? this skill isn't even remotely fair"
 *    confirm message (vanilla NEWGAME_NIGHTMARE).
 *  - Shortcut-key dispatch is case-insensitive: vanilla calls
 *    `tolower(key)` before comparing; this port matches via
 *    `toLowerCase()`.
 *
 * @example
 * ```ts
 * import {
 *   MenuKind,
 *   createMenuState,
 *   openMenu,
 *   handleMenuKey,
 *   tickMenu,
 *   KEY_DOWNARROW,
 *   KEY_ENTER,
 * } from "../src/ui/menus.ts";
 *
 * const state = createMenuState();
 * openMenu(state, MenuKind.Main);
 * handleMenuKey(state, KEY_DOWNARROW, 0);  // move cursor to Options
 * const action = handleMenuKey(state, KEY_ENTER, 0); // opens Options submenu
 * console.log(state.currentMenu); // MenuKind.Options
 * ```
 */

import { KEY_BACKSPACE, KEY_DOWNARROW, KEY_ENTER, KEY_ESCAPE, KEY_LEFTARROW, KEY_RIGHTARROW, KEY_UPARROW } from '../input/keyboard.ts';

// Re-export the key constants the menu layer consumes so tests can use them
// without pulling from the input module directly.
export { KEY_BACKSPACE, KEY_DOWNARROW, KEY_ENTER, KEY_ESCAPE, KEY_LEFTARROW, KEY_RIGHTARROW, KEY_UPARROW };

// ── Constants ─────────────────────────────────────────────────────────

/** Pixel height of a menu row (m_menu.c LINEHEIGHT). */
export const LINEHEIGHT = 16;

/** Skull cursor horizontal offset from the menu origin (m_menu.c SKULLXOFF). */
export const SKULLXOFF = -32;

/** Tics per skull-cursor animation frame.  Blink rate is `TICRATE / SKULL_ANIM_TIME = 4.375 Hz`. */
export const SKULL_ANIM_TIME = 8;

/** Mouse and joystick repeat-rate cooldown in tics (m_menu.c `mousewait = I_GetTime() + 5`). */
export const MOUSE_JOY_REPEAT_DELAY = 5;

/** Save-name buffer size including the trailing null (m_misc.h SAVESTRINGSIZE). */
export const SAVESTRINGSIZE = 24;

/** Maximum usable save-name characters (SAVESTRINGSIZE - 1 for the null). */
export const SAVESTRING_MAX_CHARS = SAVESTRINGSIZE - 1;

/** Number of save/load slots (m_menu.c load_end / save_end). */
export const MAX_LOAD_SAVE_SLOTS = 6;

/** Skill index that triggers the Nightmare confirm message (m_menu.c nightmare). */
export const SKILL_NIGHTMARE_INDEX = 4;

/** HU_FONTSTART ASCII code (`!`).  Printable characters below this are rejected in save-string entry. */
export const HU_FONTSTART = 0x21;

/** HU_FONTEND ASCII code (`_`).  Printable characters above this are rejected in save-string entry. */
export const HU_FONTEND = 0x5f;

/** ASCII code for the space character, which is explicitly allowed in save-string entry despite being below HU_FONTSTART. */
export const SAVESTRING_SPACE = 0x20;

// ── Enums ─────────────────────────────────────────────────────────────

/** Menu identity.  Maps to vanilla m_menu.c's per-menu `menu_t` definitions. */
export enum MenuKind {
  /** Top-level menu (M_DOOM header, New/Options/Load/Save/ReadThis/Quit). */
  Main = 'main',
  /** Episode selection (E1/E2/E3 or E1..E4 Ultimate).  Parent: Main. */
  Episode = 'episode',
  /** Skill selection (5 items, last is Nightmare with confirm).  Parent: Episode. */
  Skill = 'skill',
  /** Options menu (End Game, Messages, Detail, Screen Size, Sensitivity, Sound).  Parent: Main. */
  Options = 'options',
  /** Sound volume sub-menu (Sfx volume slider + Music volume slider).  Parent: Options. */
  SoundVolume = 'soundVolume',
  /** Load-game slot selection (6 slots).  Parent: Main. */
  Load = 'load',
  /** Save-game slot selection (6 slots).  Parent: Main. */
  Save = 'save',
  /** First Read-This page (HELP1 graphic).  Parent: Main. */
  ReadThis1 = 'readThis1',
  /** Second Read-This page (HELP2 graphic).  Parent: ReadThis1. */
  ReadThis2 = 'readThis2',
}

/** Menu-item interactivity status (m_menu.c menuitem_t.status). */
export enum MenuItemStatus {
  /** Spacer / invisible gap that vertical navigation skips over (vanilla status = -1). */
  Spacer = -1,
  /** Greyed-out item — visible but not landable (e.g. Save during demo playback). */
  Disabled = 0,
  /** Regular clickable item — Enter and matching shortcut fire `onEnter`. */
  Regular = 1,
  /** Slider — Left/Right arrows adjust a value, Enter increments (vanilla routine(1)). */
  Slider = 2,
}

// ── Action discriminated union ────────────────────────────────────────

/**
 * Action emitted by the menu layer for the host to dispatch.  Every
 * menu item's `onEnter` / `onLeft` / `onRight` is one of these.  Most
 * actions also mutate {@link MenuState} (e.g. `openMenu` sets
 * `currentMenu`), but the caller consumes the returned action to
 * perform engine-side effects like starting a new game or writing a
 * save file.  `none` is the null object for un-handled inputs.
 */
export type MenuAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'openMenu'; readonly target: MenuKind }
  | { readonly kind: 'closeMenu' }
  | { readonly kind: 'openMessage'; readonly text: string; readonly needsYesNo: boolean; readonly onConfirm: MenuAction }
  | { readonly kind: 'selectEpisode'; readonly episode: number }
  | { readonly kind: 'selectSkill'; readonly skill: number }
  | { readonly kind: 'selectLoadSlot'; readonly slot: number }
  | { readonly kind: 'selectSaveSlot'; readonly slot: number }
  | { readonly kind: 'readThisAdvance' }
  | { readonly kind: 'endGame' }
  | { readonly kind: 'quitGame' }
  | { readonly kind: 'toggleMessages' }
  | { readonly kind: 'toggleDetail' }
  | { readonly kind: 'adjustSfxVolume'; readonly direction: -1 | 0 | 1 }
  | { readonly kind: 'adjustMusicVolume'; readonly direction: -1 | 0 | 1 }
  | { readonly kind: 'adjustSensitivity'; readonly direction: -1 | 0 | 1 }
  | { readonly kind: 'adjustScreenSize'; readonly direction: -1 | 0 | 1 }
  | { readonly kind: 'beginSaveStringEntry'; readonly slot: number }
  | { readonly kind: 'commitSaveStringEntry'; readonly slot: number; readonly name: string }
  | { readonly kind: 'cancelSaveStringEntry'; readonly slot: number };

/** Frozen singleton for the idle-action return value. */
export const MENU_ACTION_NONE: MenuAction = Object.freeze({ kind: 'none' });

// ── Menu item / definition ────────────────────────────────────────────

/** Single menu row.  Mirrors vanilla m_menu.c's `menuitem_t`. */
export interface MenuItem {
  /** Interactivity status: Spacer / Disabled / Regular / Slider. */
  readonly status: MenuItemStatus;
  /** Patch lump name to draw (e.g. `"M_NGAME"`, `"M_OPTION"`).  Empty for save slots. */
  readonly lump: string;
  /** Case-insensitive single-character hotkey, or `null` if no shortcut. */
  readonly shortcut: string | null;
  /** Action fired on Enter or matching shortcut press. */
  readonly onEnter: MenuAction;
  /** Action fired on Left arrow.  `null` for non-slider items. */
  readonly onLeft: MenuAction | null;
  /** Action fired on Right arrow.  `null` for non-slider items. */
  readonly onRight: MenuAction | null;
}

/** Menu structural definition.  Mirrors vanilla m_menu.c's `menu_t`. */
export interface MenuDefinition {
  /** Menu identity. */
  readonly kind: MenuKind;
  /** Parent menu walked to on ESC.  `null` for Main, which closes the menu system on ESC. */
  readonly parent: MenuKind | null;
  /** Row items in display order.  Length matches vanilla's *_end constant. */
  readonly items: readonly MenuItem[];
  /** Menu x origin in 320x200 framebuffer coordinates. */
  readonly x: number;
  /** Menu y origin in 320x200 framebuffer coordinates. */
  readonly y: number;
  /** Default cursor position when opening the menu fresh. */
  readonly defaultItemOn: number;
}

// ── Menu tree data ────────────────────────────────────────────────────

const MAIN_MENU: MenuDefinition = Object.freeze({
  kind: MenuKind.Main,
  parent: null,
  x: 97,
  y: 64,
  defaultItemOn: 0,
  items: Object.freeze([
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_NGAME',
      shortcut: 'n',
      onEnter: Object.freeze({ kind: 'openMenu', target: MenuKind.Episode } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_OPTION',
      shortcut: 'o',
      onEnter: Object.freeze({ kind: 'openMenu', target: MenuKind.Options } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_LOADG',
      shortcut: 'l',
      onEnter: Object.freeze({ kind: 'openMenu', target: MenuKind.Load } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_SAVEG',
      shortcut: 's',
      onEnter: Object.freeze({ kind: 'openMenu', target: MenuKind.Save } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_RDTHIS',
      shortcut: 'r',
      onEnter: Object.freeze({ kind: 'openMenu', target: MenuKind.ReadThis1 } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_QUITG',
      shortcut: 'q',
      onEnter: Object.freeze({
        kind: 'openMessage',
        text: 'are you sure you want to\nquit this great game?',
        needsYesNo: true,
        onConfirm: Object.freeze({ kind: 'quitGame' } as const),
      } as const),
      onLeft: null,
      onRight: null,
    }),
  ]),
});

const EPISODE_MENU: MenuDefinition = Object.freeze({
  kind: MenuKind.Episode,
  parent: MenuKind.Main,
  x: 48,
  y: 63,
  defaultItemOn: 0,
  items: Object.freeze([
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_EPI1',
      shortcut: 'k',
      onEnter: Object.freeze({ kind: 'selectEpisode', episode: 1 } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_EPI2',
      shortcut: 't',
      onEnter: Object.freeze({ kind: 'selectEpisode', episode: 2 } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_EPI3',
      shortcut: 'i',
      onEnter: Object.freeze({ kind: 'selectEpisode', episode: 3 } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_EPI4',
      shortcut: 't',
      onEnter: Object.freeze({ kind: 'selectEpisode', episode: 4 } as const),
      onLeft: null,
      onRight: null,
    }),
  ]),
});

const SKILL_MENU: MenuDefinition = Object.freeze({
  kind: MenuKind.Skill,
  parent: MenuKind.Episode,
  x: 48,
  y: 63,
  defaultItemOn: 2,
  items: Object.freeze([
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_JKILL',
      shortcut: 'i',
      onEnter: Object.freeze({ kind: 'selectSkill', skill: 0 } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_ROUGH',
      shortcut: 'h',
      onEnter: Object.freeze({ kind: 'selectSkill', skill: 1 } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_HURT',
      shortcut: 'h',
      onEnter: Object.freeze({ kind: 'selectSkill', skill: 2 } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_ULTRA',
      shortcut: 'u',
      onEnter: Object.freeze({ kind: 'selectSkill', skill: 3 } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_NMARE',
      shortcut: 'n',
      onEnter: Object.freeze({
        kind: 'openMessage',
        text: "are you sure? this skill level\nisn't even remotely fair.",
        needsYesNo: true,
        onConfirm: Object.freeze({ kind: 'selectSkill', skill: SKILL_NIGHTMARE_INDEX } as const),
      } as const),
      onLeft: null,
      onRight: null,
    }),
  ]),
});

const OPTIONS_MENU: MenuDefinition = Object.freeze({
  kind: MenuKind.Options,
  parent: MenuKind.Main,
  x: 60,
  y: 37,
  defaultItemOn: 0,
  items: Object.freeze([
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_ENDGAM',
      shortcut: 'e',
      onEnter: Object.freeze({
        kind: 'openMessage',
        text: 'are you sure you want to end the game?',
        needsYesNo: true,
        onConfirm: Object.freeze({ kind: 'endGame' } as const),
      } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_MESSG',
      shortcut: 'm',
      onEnter: Object.freeze({ kind: 'toggleMessages' } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_DETAIL',
      shortcut: 'g',
      onEnter: Object.freeze({ kind: 'toggleDetail' } as const),
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Slider,
      lump: 'M_SCRNSZ',
      shortcut: 's',
      onEnter: Object.freeze({ kind: 'adjustScreenSize', direction: 1 } as const),
      onLeft: Object.freeze({ kind: 'adjustScreenSize', direction: -1 } as const),
      onRight: Object.freeze({ kind: 'adjustScreenSize', direction: 1 } as const),
    }),
    Object.freeze({
      status: MenuItemStatus.Spacer,
      lump: '',
      shortcut: null,
      onEnter: MENU_ACTION_NONE,
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Slider,
      lump: 'M_MSENS',
      shortcut: 'm',
      onEnter: Object.freeze({ kind: 'adjustSensitivity', direction: 1 } as const),
      onLeft: Object.freeze({ kind: 'adjustSensitivity', direction: -1 } as const),
      onRight: Object.freeze({ kind: 'adjustSensitivity', direction: 1 } as const),
    }),
    Object.freeze({
      status: MenuItemStatus.Spacer,
      lump: '',
      shortcut: null,
      onEnter: MENU_ACTION_NONE,
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: 'M_SVOL',
      shortcut: 's',
      onEnter: Object.freeze({ kind: 'openMenu', target: MenuKind.SoundVolume } as const),
      onLeft: null,
      onRight: null,
    }),
  ]),
});

const SOUND_VOLUME_MENU: MenuDefinition = Object.freeze({
  kind: MenuKind.SoundVolume,
  parent: MenuKind.Options,
  x: 80,
  y: 64,
  defaultItemOn: 0,
  items: Object.freeze([
    Object.freeze({
      status: MenuItemStatus.Slider,
      lump: 'M_SFXVOL',
      shortcut: 's',
      onEnter: Object.freeze({ kind: 'adjustSfxVolume', direction: 1 } as const),
      onLeft: Object.freeze({ kind: 'adjustSfxVolume', direction: -1 } as const),
      onRight: Object.freeze({ kind: 'adjustSfxVolume', direction: 1 } as const),
    }),
    Object.freeze({
      status: MenuItemStatus.Spacer,
      lump: '',
      shortcut: null,
      onEnter: MENU_ACTION_NONE,
      onLeft: null,
      onRight: null,
    }),
    Object.freeze({
      status: MenuItemStatus.Slider,
      lump: 'M_MUSVOL',
      shortcut: 'm',
      onEnter: Object.freeze({ kind: 'adjustMusicVolume', direction: 1 } as const),
      onLeft: Object.freeze({ kind: 'adjustMusicVolume', direction: -1 } as const),
      onRight: Object.freeze({ kind: 'adjustMusicVolume', direction: 1 } as const),
    }),
    Object.freeze({
      status: MenuItemStatus.Spacer,
      lump: '',
      shortcut: null,
      onEnter: MENU_ACTION_NONE,
      onLeft: null,
      onRight: null,
    }),
  ]),
});

const LOAD_MENU: MenuDefinition = Object.freeze({
  kind: MenuKind.Load,
  parent: MenuKind.Main,
  x: 80,
  y: 54,
  defaultItemOn: 0,
  items: Object.freeze(
    Array.from({ length: MAX_LOAD_SAVE_SLOTS }, (_, slot) =>
      Object.freeze({
        status: MenuItemStatus.Regular,
        lump: '',
        shortcut: String.fromCharCode(0x31 + slot),
        onEnter: Object.freeze({ kind: 'selectLoadSlot', slot } as const),
        onLeft: null,
        onRight: null,
      }),
    ),
  ),
});

const SAVE_MENU: MenuDefinition = Object.freeze({
  kind: MenuKind.Save,
  parent: MenuKind.Main,
  x: 80,
  y: 54,
  defaultItemOn: 0,
  items: Object.freeze(
    Array.from({ length: MAX_LOAD_SAVE_SLOTS }, (_, slot) =>
      Object.freeze({
        status: MenuItemStatus.Regular,
        lump: '',
        shortcut: String.fromCharCode(0x31 + slot),
        onEnter: Object.freeze({ kind: 'selectSaveSlot', slot } as const),
        onLeft: null,
        onRight: null,
      }),
    ),
  ),
});

const READ_THIS_1_MENU: MenuDefinition = Object.freeze({
  kind: MenuKind.ReadThis1,
  parent: MenuKind.Main,
  x: 280,
  y: 185,
  defaultItemOn: 0,
  items: Object.freeze([
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: '',
      shortcut: null,
      onEnter: Object.freeze({ kind: 'openMenu', target: MenuKind.ReadThis2 } as const),
      onLeft: null,
      onRight: null,
    }),
  ]),
});

const READ_THIS_2_MENU: MenuDefinition = Object.freeze({
  kind: MenuKind.ReadThis2,
  parent: MenuKind.ReadThis1,
  x: 330,
  y: 175,
  defaultItemOn: 0,
  items: Object.freeze([
    Object.freeze({
      status: MenuItemStatus.Regular,
      lump: '',
      shortcut: null,
      onEnter: Object.freeze({ kind: 'readThisAdvance' } as const),
      onLeft: null,
      onRight: null,
    }),
  ]),
});

/**
 * Frozen record of every menu definition, keyed by {@link MenuKind}.
 * Mirrors vanilla m_menu.c's static `menu_t` globals (MainDef, EpisodeDef,
 * NewDef, OptionsDef, ReadDef1, ReadDef2, SoundDef, LoadDef, SaveDef).
 */
export const MENU_TREE: Readonly<Record<MenuKind, MenuDefinition>> = Object.freeze({
  [MenuKind.Main]: MAIN_MENU,
  [MenuKind.Episode]: EPISODE_MENU,
  [MenuKind.Skill]: SKILL_MENU,
  [MenuKind.Options]: OPTIONS_MENU,
  [MenuKind.SoundVolume]: SOUND_VOLUME_MENU,
  [MenuKind.Load]: LOAD_MENU,
  [MenuKind.Save]: SAVE_MENU,
  [MenuKind.ReadThis1]: READ_THIS_1_MENU,
  [MenuKind.ReadThis2]: READ_THIS_2_MENU,
});

// ── State ─────────────────────────────────────────────────────────────

/**
 * Mutable menu state.  Mirrors the file-static globals in vanilla
 * m_menu.c (menuactive, currentMenu, itemOn, whichSkull,
 * skullAnimCounter, mousewait, joywait, messageToPrint,
 * messageString, messageLastMenuActive, messageNeedsInput,
 * messageRoutine, saveStringEnter, saveStringInSlot, saveOldString).
 */
export interface MenuState {
  /** `true` when the menu overlay is drawn and consumes input. */
  active: boolean;
  /** Currently displayed menu.  When `active` is false this still holds the last-opened menu. */
  currentMenu: MenuKind;
  /** Cursor row within the current menu.  Skips spacers on vertical navigation. */
  itemOn: number;
  /** `0` or `1` — selects M_SKULL1 vs M_SKULL2.  Toggled by `tickMenu`. */
  whichSkull: 0 | 1;
  /** Tics remaining until the next skull blink.  Reloads to `SKULL_ANIM_TIME` on wrap. */
  skullAnimCounter: number;
  /** Absolute gametic at which the next mouse event is accepted.  `0` means no cooldown. */
  mouseWait: number;
  /** Absolute gametic at which the next joystick event is accepted.  `0` means no cooldown. */
  joyWait: number;
  /** `true` while a confirm / informational message is displayed. */
  messageActive: boolean;
  /** `true` for Y/N confirm, `false` for any-key informational dismiss. */
  messageNeedsYesNo: boolean;
  /** Current message text, or `null` when no message is shown. */
  messageString: string | null;
  /** Action to fire if the user confirms the message (Y / Enter).  `null` for informational messages. */
  messagePendingAction: MenuAction | null;
  /** `true` while the player is typing a save-slot name. */
  saveStringEnter: boolean;
  /** Save slot being edited, or `-1` when `saveStringEnter` is false. */
  saveStringSlot: number;
  /** Current save-name buffer being built up by keystrokes. */
  saveStringBuffer: string;
  /** Previous save-name, restored on ESC cancel. */
  saveStringOld: string;
}

// ── Constructors ──────────────────────────────────────────────────────

/**
 * Allocate a fresh menu state with every field at its vanilla M_Init
 * default.  The caller runs `openMenu(state, MenuKind.Main)` to show
 * the menu, or leaves it inactive for the title loop.
 */
export function createMenuState(): MenuState {
  return {
    active: false,
    currentMenu: MenuKind.Main,
    itemOn: 0,
    whichSkull: 0,
    skullAnimCounter: SKULL_ANIM_TIME,
    mouseWait: 0,
    joyWait: 0,
    messageActive: false,
    messageNeedsYesNo: false,
    messageString: null,
    messagePendingAction: null,
    saveStringEnter: false,
    saveStringSlot: -1,
    saveStringBuffer: '',
    saveStringOld: '',
  };
}

// ── Navigation helpers ────────────────────────────────────────────────

function isSelectable(item: MenuItem): boolean {
  return item.status === MenuItemStatus.Regular || item.status === MenuItemStatus.Slider;
}

function findFirstSelectable(items: readonly MenuItem[], preferred: number): number {
  if (items.length === 0) return 0;
  if (preferred >= 0 && preferred < items.length && isSelectable(items[preferred]!)) {
    return preferred;
  }
  for (let i = 0; i < items.length; i++) {
    if (isSelectable(items[i]!)) return i;
  }
  return preferred;
}

function stepSelectable(items: readonly MenuItem[], start: number, direction: 1 | -1): number {
  const length = items.length;
  if (length === 0) return start;
  let index = start;
  for (let guard = 0; guard < length; guard++) {
    index += direction;
    if (index >= length) index = 0;
    else if (index < 0) index = length - 1;
    if (isSelectable(items[index]!)) return index;
  }
  return start;
}

// ── Menu open/close ───────────────────────────────────────────────────

/**
 * Activate the menu system and switch to `kind`.  Resets `itemOn` to
 * the menu's `defaultItemOn` (walking to the first selectable row if
 * the default points at a spacer), clears any stale message/confirm
 * overlay, but preserves `whichSkull` and the mouse/joy cooldowns so
 * the blink phase and repeat gate survive a menu close-and-reopen.
 */
export function openMenu(state: MenuState, kind: MenuKind): void {
  const definition = MENU_TREE[kind];
  state.active = true;
  state.currentMenu = kind;
  state.itemOn = findFirstSelectable(definition.items, definition.defaultItemOn);
  state.messageActive = false;
  state.messageNeedsYesNo = false;
  state.messageString = null;
  state.messagePendingAction = null;
  state.saveStringEnter = false;
  state.saveStringSlot = -1;
  state.saveStringBuffer = '';
  state.saveStringOld = '';
}

/**
 * Deactivate the menu system.  The overlay stops drawing and input
 * stops being consumed by the menu.  `currentMenu` is preserved so a
 * subsequent `openMenu` call without an argument could resume where
 * the player left off (callers opt into that by passing `state.currentMenu`).
 */
export function closeMenu(state: MenuState): void {
  state.active = false;
  state.messageActive = false;
  state.messageNeedsYesNo = false;
  state.messageString = null;
  state.messagePendingAction = null;
  state.saveStringEnter = false;
  state.saveStringSlot = -1;
  state.saveStringBuffer = '';
  state.saveStringOld = '';
}

/**
 * Open a confirm / informational message overlay on top of the current
 * menu.  `needsYesNo = true` waits for Y/Enter (fires `onConfirm`) or
 * N/ESC (cancels); `false` dismisses on any key without firing.
 */
export function openMessage(state: MenuState, text: string, needsYesNo: boolean, onConfirm: MenuAction | null): void {
  state.messageActive = true;
  state.messageNeedsYesNo = needsYesNo;
  state.messageString = text;
  state.messagePendingAction = needsYesNo ? onConfirm : null;
}

// ── Ticker ────────────────────────────────────────────────────────────

/**
 * Advance the menu's per-tic animation.  Implements vanilla M_Ticker:
 * decrement `skullAnimCounter`; when it drops to 0 flip `whichSkull`
 * and reload the counter with {@link SKULL_ANIM_TIME}.  The counter
 * runs whether or not the menu is `active` — vanilla matches this so
 * the blink phase is seamless when the menu is reopened after a
 * brief toggle.
 */
export function tickMenu(state: MenuState): void {
  state.skullAnimCounter--;
  if (state.skullAnimCounter <= 0) {
    state.whichSkull = state.whichSkull === 0 ? 1 : 0;
    state.skullAnimCounter = SKULL_ANIM_TIME;
  }
}

// ── Repeat-rate gates ─────────────────────────────────────────────────

/**
 * `true` iff `gametic` has strictly passed the armed mouse-repeat
 * deadline.  Returns `true` when `gametic > mouseWait`.  Mirrors
 * vanilla `if (mousewait < I_GetTime())`: at equality, the deadline
 * has been reached but not passed, so input is still rejected.
 */
export function canAcceptMouseInput(state: MenuState, gametic: number): boolean {
  return gametic > state.mouseWait;
}

/**
 * `true` iff `gametic` has strictly passed the armed joystick-repeat
 * deadline.  Returns `true` when `gametic > joyWait`.  Mirrors vanilla
 * `if (joywait < I_GetTime())`: at equality, the deadline has been
 * reached but not passed, so input is still rejected.
 */
export function canAcceptJoyInput(state: MenuState, gametic: number): boolean {
  return gametic > state.joyWait;
}

/**
 * Arm the mouse repeat-rate cooldown.  Sets `mouseWait = gametic +
 * {@link MOUSE_JOY_REPEAT_DELAY}`.  The next `canAcceptMouseInput`
 * call returns `false` until `MOUSE_JOY_REPEAT_DELAY` tics have
 * elapsed.
 */
export function markMouseInputConsumed(state: MenuState, gametic: number): void {
  state.mouseWait = gametic + MOUSE_JOY_REPEAT_DELAY;
}

/**
 * Arm the joystick repeat-rate cooldown.  Sets `joyWait = gametic +
 * {@link MOUSE_JOY_REPEAT_DELAY}`.  The next `canAcceptJoyInput` call
 * returns `false` until `MOUSE_JOY_REPEAT_DELAY` tics have elapsed.
 */
export function markJoyInputConsumed(state: MenuState, gametic: number): void {
  state.joyWait = gametic + MOUSE_JOY_REPEAT_DELAY;
}

// ── Key event handling ────────────────────────────────────────────────

function isPrintableSaveChar(ch: number): boolean {
  if (ch === SAVESTRING_SPACE) return true;
  if (ch < HU_FONTSTART) return false;
  if (ch > HU_FONTEND) return false;
  return true;
}

function handleSaveStringKey(state: MenuState, key: number): MenuAction {
  if (key === KEY_BACKSPACE) {
    if (state.saveStringBuffer.length > 0) {
      state.saveStringBuffer = state.saveStringBuffer.slice(0, -1);
    }
    return MENU_ACTION_NONE;
  }
  if (key === KEY_ESCAPE) {
    const slot = state.saveStringSlot;
    state.saveStringEnter = false;
    state.saveStringSlot = -1;
    state.saveStringBuffer = '';
    state.saveStringOld = '';
    return { kind: 'cancelSaveStringEntry', slot };
  }
  if (key === KEY_ENTER) {
    const slot = state.saveStringSlot;
    const name = state.saveStringBuffer;
    state.saveStringEnter = false;
    state.saveStringSlot = -1;
    state.saveStringBuffer = '';
    state.saveStringOld = '';
    if (name.length === 0) {
      return MENU_ACTION_NONE;
    }
    return { kind: 'commitSaveStringEntry', slot, name };
  }
  const upper = String.fromCharCode(key).toUpperCase();
  if (upper.length !== 1) return MENU_ACTION_NONE;
  const code = upper.charCodeAt(0);
  if (!isPrintableSaveChar(code)) return MENU_ACTION_NONE;
  if (state.saveStringBuffer.length >= SAVESTRING_MAX_CHARS) return MENU_ACTION_NONE;
  state.saveStringBuffer += upper;
  return MENU_ACTION_NONE;
}

function handleMessageKey(state: MenuState, key: number): MenuAction {
  if (!state.messageNeedsYesNo) {
    state.messageActive = false;
    state.messageString = null;
    state.messagePendingAction = null;
    return MENU_ACTION_NONE;
  }
  const character = String.fromCharCode(key).toLowerCase();
  const isYes = character === 'y' || key === KEY_ENTER;
  const isNo = character === 'n' || key === KEY_ESCAPE;
  if (!isYes && !isNo) return MENU_ACTION_NONE;
  const pending = state.messagePendingAction;
  state.messageActive = false;
  state.messageString = null;
  state.messagePendingAction = null;
  if (isYes && pending !== null) {
    return dispatchAction(state, pending);
  }
  return MENU_ACTION_NONE;
}

function dispatchAction(state: MenuState, action: MenuAction): MenuAction {
  switch (action.kind) {
    case 'openMenu': {
      const target = MENU_TREE[action.target];
      state.currentMenu = action.target;
      state.itemOn = findFirstSelectable(target.items, target.defaultItemOn);
      return action;
    }
    case 'closeMenu': {
      closeMenu(state);
      return action;
    }
    case 'openMessage': {
      openMessage(state, action.text, action.needsYesNo, action.onConfirm);
      return action;
    }
    case 'selectEpisode':
    case 'selectLoadSlot':
    case 'readThisAdvance':
    case 'toggleMessages':
    case 'toggleDetail':
    case 'adjustSfxVolume':
    case 'adjustMusicVolume':
    case 'adjustSensitivity':
    case 'adjustScreenSize':
    case 'endGame':
    case 'quitGame':
    case 'selectSkill':
      return action;
    case 'selectSaveSlot': {
      state.saveStringEnter = true;
      state.saveStringSlot = action.slot;
      state.saveStringBuffer = '';
      state.saveStringOld = '';
      return { kind: 'beginSaveStringEntry', slot: action.slot };
    }
    case 'beginSaveStringEntry':
    case 'commitSaveStringEntry':
    case 'cancelSaveStringEntry':
    case 'none':
      return action;
  }
}

function findShortcutIndex(definition: MenuDefinition, key: number): number {
  const ch = String.fromCharCode(key).toLowerCase();
  if (ch.length !== 1) return -1;
  for (let i = 0; i < definition.items.length; i++) {
    const item = definition.items[i]!;
    if (!isSelectable(item)) continue;
    if (item.shortcut !== null && item.shortcut.toLowerCase() === ch) return i;
  }
  return -1;
}

/**
 * Handle a single keyboard event in the menu layer.
 *
 * Dispatch order mirrors vanilla M_Responder:
 *
 *  1. If `active` is false: only ESC opens the Main menu (vanilla
 *     M_StartControlPanel).  Other keys pass through.
 *  2. If a message is active: route to Y/N or any-key dismissal.
 *  3. If save-string entry is active: route BACKSPACE / ESC / ENTER /
 *     printable ASCII to the buffer editor.
 *  4. Normal menu keys:
 *       - KEY_DOWNARROW / KEY_UPARROW: step `itemOn` skipping spacers.
 *       - KEY_LEFTARROW: fire `onLeft` for slider items, otherwise nop.
 *       - KEY_RIGHTARROW: fire `onRight` for slider items, otherwise nop.
 *       - KEY_ENTER: fire `onEnter` for the current item.
 *       - KEY_ESCAPE: walk to parent menu; Main's parent is null →
 *         close the menu.
 *       - Any other printable character: scan the menu for a matching
 *         shortcut; on match, move cursor and fire `onEnter`.
 *
 * The returned action is the dispatch command for the host to wire to
 * the actual engine effect.  `{ kind: "none" }` is the no-op sentinel.
 */
export function handleMenuKey(state: MenuState, key: number): MenuAction {
  if (!state.active) {
    if (key === KEY_ESCAPE) {
      openMenu(state, MenuKind.Main);
      return { kind: 'openMenu', target: MenuKind.Main };
    }
    return MENU_ACTION_NONE;
  }

  if (state.messageActive) {
    return handleMessageKey(state, key);
  }

  if (state.saveStringEnter) {
    return handleSaveStringKey(state, key);
  }

  const definition = MENU_TREE[state.currentMenu];

  if (key === KEY_DOWNARROW) {
    state.itemOn = stepSelectable(definition.items, state.itemOn, 1);
    return MENU_ACTION_NONE;
  }
  if (key === KEY_UPARROW) {
    state.itemOn = stepSelectable(definition.items, state.itemOn, -1);
    return MENU_ACTION_NONE;
  }

  const currentItem = definition.items[state.itemOn];
  if (currentItem === undefined) return MENU_ACTION_NONE;

  if (key === KEY_LEFTARROW) {
    if (currentItem.onLeft !== null) return dispatchAction(state, currentItem.onLeft);
    return MENU_ACTION_NONE;
  }
  if (key === KEY_RIGHTARROW) {
    if (currentItem.onRight !== null) return dispatchAction(state, currentItem.onRight);
    return MENU_ACTION_NONE;
  }
  if (key === KEY_ENTER) {
    return dispatchAction(state, currentItem.onEnter);
  }
  if (key === KEY_ESCAPE) {
    if (definition.parent === null) {
      closeMenu(state);
      return { kind: 'closeMenu' };
    }
    const parentDef = MENU_TREE[definition.parent];
    state.currentMenu = definition.parent;
    state.itemOn = findFirstSelectable(parentDef.items, parentDef.defaultItemOn);
    return { kind: 'openMenu', target: definition.parent };
  }

  const shortcutIndex = findShortcutIndex(definition, key);
  if (shortcutIndex >= 0) {
    state.itemOn = shortcutIndex;
    const item = definition.items[shortcutIndex]!;
    return dispatchAction(state, item.onEnter);
  }

  return MENU_ACTION_NONE;
}
