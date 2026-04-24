/**
 * Switch textures and held buttons (p_switch.c).
 *
 * Implements the three vanilla entry points for animated switches:
 *
 * - {@link initSwitchList} — filters the static {@link ALPH_SWITCH_LIST}
 *   by the current `gamemode`-derived episode threshold, resolves each
 *   pair's texture names, and returns the flat `switchlist[]` array
 *   plus the `numswitches` pair count.
 * - {@link changeSwitchTexture} — the `P_ChangeSwitchTexture` entry
 *   invoked from `P_UseSpecialLine` / `P_ShootSpecialLine` when a
 *   switch linedef fires.  Locates the matching switchlist slot via
 *   top → mid → bottom cascade, flips the texture index via `i ^ 1`,
 *   plays the press sound, and enqueues a {@link Button} entry when
 *   the caller asked for a re-triggerable switch.
 * - {@link updateButtons} — the button-timer half of
 *   `P_UpdateSpecials`, ticked once per gametic.  Decrements each
 *   active slot's `btimer`; on zero it writes the original texture
 *   back onto the cached side slot, plays `sfx_swtchn`, and clears
 *   the slot with a zero-fill.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - The episode threshold is derived from `gamemode`:
 *   `shareware → 1`, `registered|retail → 2`, `commercial → 3`.
 *   Pairs with `episode > threshold` are skipped entirely; the others
 *   are appended to `switchlist[]` in table order as
 *   `[off0, on0, off1, on1, …]` followed by a `-1` sentinel, exactly
 *   matching the vanilla `R_TextureNumForName` loop in p_switch.c.
 * - `ALPH_SWITCH_LIST` is the full 40-pair vanilla `alphSwitchList[]`
 *   in source order: 19 episode-1 pairs, 10 episode-2 pairs, 11
 *   episode-3 pairs.  The trailing `{"\0","\0",0}` terminator is
 *   represented by iteration end, not a data row.
 * - The scan in {@link changeSwitchTexture} iterates `i` over the
 *   full flattened switchlist (`0..numswitches*2-1`) and at each `i`
 *   checks `toptexture`, then `midtexture`, then `bottomtexture` with
 *   a cascaded if/else — the first slot that matches wins and
 *   subsequent slots are not consulted at that `i`.  This matters
 *   when a side uses the same switch texture on two surfaces: only
 *   the top (or the first in cascade order) flips.
 * - The replacement texture is `switchlist[i ^ 1]`: XOR with 1 swaps
 *   between the off and on entries regardless of which one currently
 *   faces the caller.
 * - `line.special` is zeroed BEFORE the `line.special === 11` exit
 *   sound check when `useAgain === false`.  Because special 11 is a
 *   one-shot in vanilla tables, this ordering means the `sfx_swtchx`
 *   variant is effectively unreachable for the stock exit switch —
 *   a vanilla quirk; we preserve it rather than hoist the check.
 * - The press sound is played at `buttons[0].soundorg` (vanilla
 *   `buttonlist->soundorg`), not at the just-pressed line's own
 *   sector.  On a fresh level that slot is `null` and the sound plays
 *   from world origin.  Once any button is active, subsequent presses
 *   broadcast from that button's sector.  This is the vanilla bug we
 *   explicitly preserve.
 * - {@link startButton} scans all `MAXBUTTONS` slots to deduplicate by
 *   `line` reference before allocating; a repeat press on an
 *   already-pressed line is silently ignored.  Only when no match is
 *   found does it fill the first slot with `btimer === 0`.
 * - A full button list with no free slot throws — matching vanilla
 *   `I_Error("P_StartButton: no button slots left!")`.  Tests should
 *   only exercise this branch intentionally.
 * - {@link updateButtons} restores the original texture into the
 *   cached side reference at `where`, then plays `sfx_swtchn` at the
 *   button's stored soundorg (NOT `buttons[0].soundorg`), then calls
 *   {@link resetButton} to zero the slot.  The restore sound is
 *   always `sfx_swtchn` even when the original press used
 *   `sfx_swtchx`; vanilla hard-codes it.
 *
 * Side effects (side-texture mutation, sound playback) travel through
 * the {@link SwitchCallbacks} bundle so tests can assert against a
 * plain event log and so the host audio layer can stay outside the
 * specials module.
 *
 * @example
 * ```ts
 * import {
 *   ALPH_SWITCH_LIST,
 *   BUTTONTIME,
 *   ButtonWhere,
 *   changeSwitchTexture,
 *   createButtonList,
 *   initSwitchList,
 *   switchEpisodeForGameMode,
 *   updateButtons,
 * } from "../src/specials/switches.ts";
 *
 * const { switchlist } = initSwitchList(
 *   switchEpisodeForGameMode("shareware"),
 *   (name) => textureIndex(name),
 * );
 * const buttons = createButtonList();
 * changeSwitchTexture(line, frontSide, true, switchlist, buttons, callbacks);
 * // later, once per gametic:
 * updateButtons(buttons, callbacks);
 * ```
 */

import type { GameMode } from '../bootstrap/gameMode.ts';

// ── Constants ──────────────────────────────────────────────────────

/** Tics a depressed switch stays in its `on` state before snapping back. */
export const BUTTONTIME = 35;

/** Hard cap on simultaneous active buttons (vanilla `MAXBUTTONS`). */
export const MAXBUTTONS = 16;

/** Hard cap on resolved switch pairs (vanilla `MAXSWITCHES`). */
export const MAXSWITCHES = 50;

/** sfx_swtchn — normal switch press / button release. */
export const SFX_SWTCHN = 23;

/** sfx_swtchx — exit-switch press variant (vanilla quirk: usually unreachable). */
export const SFX_SWTCHX = 24;

/** Line special that selects the exit-switch sound variant. */
export const EXIT_SWITCH_SPECIAL = 11;

// ── Enums ──────────────────────────────────────────────────────────

/** bwhere_e from p_spec.h — which slot of the sidedef the switch lives on. */
export const enum ButtonWhere {
  top = 0,
  middle = 1,
  bottom = 2,
}

// ── Source table (alphSwitchList[]) ────────────────────────────────

/**
 * One row of the vanilla `alphSwitchList[]` from p_switch.c.  `off` is
 * the un-pressed texture name, `on` is the pressed variant, `episode`
 * is the gating threshold (1, 2, or 3) compared against the
 * gamemode-derived episode by {@link initSwitchList}.
 */
export interface SwitchTexturePair {
  readonly off: string;
  readonly on: string;
  readonly episode: 1 | 2 | 3;
}

/**
 * Full 40-pair vanilla `alphSwitchList[]` in canonical source order.
 * The trailing `{"\0","\0",0}` terminator from the C source is
 * represented by iteration end, not a data row.
 */
export const ALPH_SWITCH_LIST: readonly SwitchTexturePair[] = Object.freeze([
  { off: 'SW1BRCOM', on: 'SW2BRCOM', episode: 1 },
  { off: 'SW1BRN1', on: 'SW2BRN1', episode: 1 },
  { off: 'SW1BRN2', on: 'SW2BRN2', episode: 1 },
  { off: 'SW1BRNGN', on: 'SW2BRNGN', episode: 1 },
  { off: 'SW1BROWN', on: 'SW2BROWN', episode: 1 },
  { off: 'SW1COMM', on: 'SW2COMM', episode: 1 },
  { off: 'SW1COMP', on: 'SW2COMP', episode: 1 },
  { off: 'SW1DIRT', on: 'SW2DIRT', episode: 1 },
  { off: 'SW1EXIT', on: 'SW2EXIT', episode: 1 },
  { off: 'SW1GRAY', on: 'SW2GRAY', episode: 1 },
  { off: 'SW1GRAY1', on: 'SW2GRAY1', episode: 1 },
  { off: 'SW1METAL', on: 'SW2METAL', episode: 1 },
  { off: 'SW1PIPE', on: 'SW2PIPE', episode: 1 },
  { off: 'SW1SLAD', on: 'SW2SLAD', episode: 1 },
  { off: 'SW1STARG', on: 'SW2STARG', episode: 1 },
  { off: 'SW1STON1', on: 'SW2STON1', episode: 1 },
  { off: 'SW1STON2', on: 'SW2STON2', episode: 1 },
  { off: 'SW1STONE', on: 'SW2STONE', episode: 1 },
  { off: 'SW1STRTN', on: 'SW2STRTN', episode: 1 },
  { off: 'SW1BLUE', on: 'SW2BLUE', episode: 2 },
  { off: 'SW1CMT', on: 'SW2CMT', episode: 2 },
  { off: 'SW1GARG', on: 'SW2GARG', episode: 2 },
  { off: 'SW1GSTON', on: 'SW2GSTON', episode: 2 },
  { off: 'SW1HOT', on: 'SW2HOT', episode: 2 },
  { off: 'SW1LION', on: 'SW2LION', episode: 2 },
  { off: 'SW1SATYR', on: 'SW2SATYR', episode: 2 },
  { off: 'SW1SKIN', on: 'SW2SKIN', episode: 2 },
  { off: 'SW1VINE', on: 'SW2VINE', episode: 2 },
  { off: 'SW1WOOD', on: 'SW2WOOD', episode: 2 },
  { off: 'SW1PANEL', on: 'SW2PANEL', episode: 3 },
  { off: 'SW1ROCK', on: 'SW2ROCK', episode: 3 },
  { off: 'SW1MET2', on: 'SW2MET2', episode: 3 },
  { off: 'SW1WDMET', on: 'SW2WDMET', episode: 3 },
  { off: 'SW1BRIK', on: 'SW2BRIK', episode: 3 },
  { off: 'SW1MOD1', on: 'SW2MOD1', episode: 3 },
  { off: 'SW1ZIM', on: 'SW2ZIM', episode: 3 },
  { off: 'SW1STON6', on: 'SW2STON6', episode: 3 },
  { off: 'SW1TEK', on: 'SW2TEK', episode: 3 },
  { off: 'SW1MARB', on: 'SW2MARB', episode: 3 },
  { off: 'SW1SKULL', on: 'SW2SKULL', episode: 3 },
]);

// ── gamemode → episode threshold ───────────────────────────────────

/**
 * Map a {@link GameMode} to the switchlist episode threshold used by
 * vanilla `P_InitSwitchList`:
 *
 * - `shareware` → 1  (only episode-1 textures exist in the shareware IWAD)
 * - `registered`, `retail` → 2  (episode-1 and episode-2 textures)
 * - `commercial` → 3  (all three episodes' textures)
 *
 * `indetermined` defaults to 1 to match vanilla's initial assignment
 * before the gamemode-specific branches.
 */
export function switchEpisodeForGameMode(mode: GameMode): 1 | 2 | 3 {
  if (mode === 'registered' || mode === 'retail') return 2;
  if (mode === 'commercial') return 3;
  return 1;
}

// ── initSwitchList (P_InitSwitchList) ──────────────────────────────

/**
 * Resolved output of {@link initSwitchList}.  `switchlist` is the flat
 * `[off0, on0, off1, on1, …, -1]` array used by
 * {@link changeSwitchTexture}; `numswitches` is the pair count
 * (`switchlist.length` is therefore `numswitches * 2 + 1`).  The
 * trailing `-1` sentinel matches vanilla `switchlist[numswitches*2]`.
 */
export interface SwitchList {
  readonly switchlist: readonly number[];
  readonly numswitches: number;
}

/**
 * Resolve the switch texture list against the current WAD.  Walks
 * {@link ALPH_SWITCH_LIST} in order, skips entries whose `episode` is
 * greater than the threshold, and appends each surviving pair's
 * `[offTexture, onTexture]` indices using `textureNumForName`.  The
 * returned `switchlist` is a frozen readonly array with a `-1`
 * terminator appended after the last pair, matching vanilla.
 *
 * Input iteration is clamped to `MAXSWITCHES` entries.  Vanilla
 * Chocolate Doom iterates `arrlen(alphSwitchList)` and writes into
 * a static `switchlist[MAXSWITCHES * 2]` buffer, so overflow would
 * corrupt memory; our clamp pins output to at most `MAXSWITCHES`
 * pairs to preserve that same upper bound defensively.  For the
 * stock 40-pair table the clamp is a no-op.
 */
export function initSwitchList(episode: 1 | 2 | 3, textureNumForName: (name: string) => number): SwitchList {
  const flat: number[] = [];
  const limit = Math.min(ALPH_SWITCH_LIST.length, MAXSWITCHES);
  for (let i = 0; i < limit; i++) {
    const entry = ALPH_SWITCH_LIST[i]!;
    if (entry.episode > episode) continue;
    flat.push(textureNumForName(entry.off));
    flat.push(textureNumForName(entry.on));
  }
  const numswitches = flat.length / 2;
  flat.push(-1);
  return Object.freeze({
    switchlist: Object.freeze(flat),
    numswitches,
  });
}

// ── Runtime shapes ─────────────────────────────────────────────────

/**
 * Mutable texture slots of one sidedef.  Vanilla `side_t` stores
 * these as `int` texture indices; we use the same integer encoding.
 * {@link changeSwitchTexture} writes the `i ^ 1` replacement into
 * exactly one of these fields; {@link updateButtons} restores the
 * original on timer expiry.
 */
export interface SwitchSide {
  toptexture: number;
  midtexture: number;
  bottomtexture: number;
}

/**
 * The subset of `line_t` that switch code mutates.  Zeroed on
 * one-shot press (`useAgain === false`) by {@link changeSwitchTexture};
 * used for the exit-sound check and for dedup keys in
 * {@link startButton}.  Two distinct lines compare by reference.
 */
export interface SwitchLine {
  special: number;
}

// ── Button slot ────────────────────────────────────────────────────

/**
 * One `button_t` slot.  Slots are allocated in a fixed-size
 * {@link MAXBUTTONS}-long array (see {@link createButtonList}) and
 * re-used after {@link resetButton} clears them.  A slot with
 * `btimer === 0` is considered free.  `soundorg` is an opaque
 * reference passed through to the sound callback; the switch module
 * never dereferences it.
 */
export interface Button {
  line: SwitchLine | null;
  side: SwitchSide | null;
  where: ButtonWhere;
  btexture: number;
  btimer: number;
  soundorg: unknown;
}

/**
 * Create a fresh MAXBUTTONS-long button list with every slot zeroed.
 * Equivalent to vanilla's static-BSS `buttonlist[MAXBUTTONS]` array.
 */
export function createButtonList(): Button[] {
  const list: Button[] = new Array(MAXBUTTONS);
  for (let i = 0; i < MAXBUTTONS; i++) {
    list[i] = makeEmptyButton();
  }
  return list;
}

/**
 * Zero every field of `button` in-place.  Matches vanilla
 * `memset(&buttonlist[i], 0, sizeof(button_t))` after a timer expires.
 */
export function resetButton(button: Button): void {
  button.line = null;
  button.side = null;
  button.where = ButtonWhere.top;
  button.btexture = 0;
  button.btimer = 0;
  button.soundorg = null;
}

function makeEmptyButton(): Button {
  return {
    line: null,
    side: null,
    where: ButtonWhere.top,
    btexture: 0,
    btimer: 0,
    soundorg: null,
  };
}

// ── Callbacks ──────────────────────────────────────────────────────

/**
 * Side-effect bridge for switch code.  `startSound` receives the
 * opaque soundorg reference (or `null` for the vanilla fresh-level
 * quirk) plus the sfx index.  Kept a plain callback — no sector
 * lookup is needed here because {@link Button.soundorg} carries the
 * pre-bound origin.
 */
export interface SwitchCallbacks {
  startSound(origin: unknown, sfx: number): void;
}

// ── P_StartButton ──────────────────────────────────────────────────

/**
 * Queue a button-timer for `line`.  Searches `buttons` for a slot
 * already bound to the same `line`; if found, returns early (the
 * existing timer wins).  Otherwise fills the first slot with
 * `btimer === 0` using the supplied arguments.
 *
 * Throws if every slot is occupied — matches vanilla
 * `I_Error("P_StartButton: no button slots left!")`.
 *
 * Callers are the one-shot side of {@link changeSwitchTexture}; the
 * repeatable side never reaches this function because it uses
 * `line.special` clearing instead of timer-based revert.
 */
export function startButton(buttons: Button[], line: SwitchLine, side: SwitchSide, where: ButtonWhere, texture: number, time: number, soundorg: unknown): void {
  for (let i = 0; i < MAXBUTTONS; i++) {
    const slot = buttons[i]!;
    if (slot.btimer !== 0 && slot.line === line) {
      return;
    }
  }

  for (let i = 0; i < MAXBUTTONS; i++) {
    const slot = buttons[i]!;
    if (slot.btimer === 0) {
      slot.line = line;
      slot.side = side;
      slot.where = where;
      slot.btexture = texture;
      slot.btimer = time;
      slot.soundorg = soundorg;
      return;
    }
  }

  throw new Error('P_StartButton: no button slots left!');
}

// ── P_ChangeSwitchTexture ──────────────────────────────────────────

/**
 * Flip a switch to its opposite texture and, when `useAgain` is true,
 * arm the revert timer.
 *
 * The scan walks `switchlist` from index 0 through `numswitches * 2 -
 * 1` (the `-1` sentinel is skipped naturally because `numswitches`
 * pins the bound).  At each index `i`, the top/mid/bottom cascade
 * matches `switchlist[i]` against `side.toptexture`, then
 * `side.midtexture`, then `side.bottomtexture`; the first hit swaps
 * that slot to `switchlist[i ^ 1]` and returns.
 *
 * When `useAgain` is false, `line.special` is zeroed BEFORE the
 * exit-sound check.  This preserves the vanilla bug where special 11
 * never reaches the `sfx_swtchx` branch (because that special is only
 * ever invoked with `useAgain === false`).
 *
 * The press sound is broadcast from `buttons[0].soundorg` (vanilla
 * `buttonlist->soundorg`), NOT from the newly-pressed line's sector.
 * On a fresh level that slot carries `null` and the sound plays from
 * world origin.
 */
export function changeSwitchTexture(line: SwitchLine, side: SwitchSide, useAgain: boolean, switchlist: readonly number[], numswitches: number, buttons: Button[], callbacks: SwitchCallbacks, soundorg: unknown): void {
  if (!useAgain) {
    line.special = 0;
  }

  const texTop = side.toptexture;
  const texMid = side.midtexture;
  const texBot = side.bottomtexture;

  let sound = SFX_SWTCHN;
  if (line.special === EXIT_SWITCH_SPECIAL) {
    sound = SFX_SWTCHX;
  }

  const limit = numswitches * 2;
  for (let i = 0; i < limit; i++) {
    const slotTexture = switchlist[i]!;
    if (slotTexture === texTop) {
      callbacks.startSound(buttons[0]!.soundorg, sound);
      side.toptexture = switchlist[i ^ 1]!;
      if (useAgain) {
        startButton(buttons, line, side, ButtonWhere.top, slotTexture, BUTTONTIME, soundorg);
      }
      return;
    }
    if (slotTexture === texMid) {
      callbacks.startSound(buttons[0]!.soundorg, sound);
      side.midtexture = switchlist[i ^ 1]!;
      if (useAgain) {
        startButton(buttons, line, side, ButtonWhere.middle, slotTexture, BUTTONTIME, soundorg);
      }
      return;
    }
    if (slotTexture === texBot) {
      callbacks.startSound(buttons[0]!.soundorg, sound);
      side.bottomtexture = switchlist[i ^ 1]!;
      if (useAgain) {
        startButton(buttons, line, side, ButtonWhere.bottom, slotTexture, BUTTONTIME, soundorg);
      }
      return;
    }
  }
}

// ── P_UpdateSpecials button half ───────────────────────────────────

/**
 * Tick every active button slot once.  For each slot with a non-zero
 * `btimer`: decrement; if the result is zero, restore the original
 * texture onto `slot.side` at `slot.where`, play `sfx_swtchn` at
 * `slot.soundorg`, and zero the slot via {@link resetButton}.
 *
 * Slots with `btimer === 0` are untouched.  Slots with a null `side`
 * are defensively skipped on the restore branch (the vanilla code has
 * no null to fear but our interface is stricter); the slot is still
 * reset so it can be reused.
 */
export function updateButtons(buttons: Button[], callbacks: SwitchCallbacks): void {
  for (let i = 0; i < MAXBUTTONS; i++) {
    const slot = buttons[i]!;
    if (slot.btimer === 0) continue;
    slot.btimer--;
    if (slot.btimer !== 0) continue;

    const side = slot.side;
    if (side !== null) {
      switch (slot.where) {
        case ButtonWhere.top:
          side.toptexture = slot.btexture;
          break;
        case ButtonWhere.middle:
          side.midtexture = slot.btexture;
          break;
        case ButtonWhere.bottom:
          side.bottomtexture = slot.btexture;
          break;
      }
    }

    callbacks.startSound(slot.soundorg, SFX_SWTCHN);
    resetButton(slot);
  }
}
