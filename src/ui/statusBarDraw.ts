/**
 * Status bar pixel compositor — vanilla `st_stuff.c` `ST_Drawer` /
 * `ST_drawWidgets` plus the `st_lib.c` widget draw primitives.
 *
 * The pure-logic half of the status bar (the face state machine, the
 * key-box memory, and the displayed value snapshot) already lives in
 * `./statusBar.ts`; the static background / numeric / key / arms / face
 * coordinates already live in the three `implement-status-bar-*.ts`
 * contract modules. This module is the missing pixel layer: it consumes
 * those and composites the full opaque 320×32 status bar into framebuffer
 * rows `ST_Y .. ST_Y + ST_HEIGHT - 1` (168..199), exactly as vanilla's
 * `ST_Drawer` draws it over the bottom of the 320×200 screen.
 *
 * Faithfulness to Chocolate Doom 2.2.1:
 *
 *  - `ST_refreshBackground` draws `STBAR` at (0,168), then `STARMS` at
 *    (104,168) in single player (`buildStatusBarBackgroundDraws`).
 *  - `STlib_drawNum` (st_lib.c): numbers are right-justified. The digit
 *    walk starts at `w->x` and steps left by the digit patch width per
 *    digit (`x -= w->width; V_DrawPatch(x, w->y, p[num%10]); num /= 10`),
 *    a leading `0` is drawn one digit-width left of `w->x` when the value
 *    is zero, and a negative value draws `STTMINUS`/`STYSNUM`-clamped
 *    just left of the most-significant digit. The 1994 `ST_LARGEAMMO`
 *    no-ammo sentinel makes the 3-digit ready widget overflow its
 *    `maxdigits` and so draws nothing — vanilla relies on this exact
 *    `numdigits--` exhaustion to blank the fist/chainsaw ammo readout.
 *  - `STlib_drawPercent` (st_lib.c): draws the percent glyph at `w->x`
 *    first, then the number through `STlib_drawNum`.
 *  - `STlib_updateMultIcon` (the arms widget): slot `i` (weapons 2..7)
 *    draws `STYSNUM<i+2>` when owned, else the dim `STGNUM<i+2>`, at the
 *    `STARMS` chart grid (2 columns × 3 rows). Hidden in deathmatch
 *    (`st_armson`), matching `ST_drawWidgets`.
 *  - `STlib_updateBinIcon` (the key boxes): slot draws the remembered
 *    `STKEYS<n>` (cards 0..2, skulls 3..5) or nothing.
 *  - The face widget draws the `STF*` patch the state machine selected
 *    (`buildStatusBarFaceLumpList` index → lump) at (`ST_FX`,`ST_Y`).
 *
 * Every decoded patch is cached per {@link StatusBarRenderer} instance so
 * a 35 Hz redraw does not re-parse the WAD lumps each tic. The instance
 * holds no module-global state, so the shared Bun test worker stays
 * hermetic with no reset hook.
 *
 * @example
 * ```ts
 * const renderer = createStatusBarRenderer(lookup, wadBuffer);
 * drawStatusBar(framebuffer, renderer, values, singlePlayer);
 * ```
 */

import { SCREENWIDTH, SCREENHEIGHT } from '../host/windowPolicy.ts';
import { decodePatch, drawPatch } from '../render/patchDraw.ts';
import type { DecodedPatch } from '../render/patchDraw.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';
import { buildStatusBarFaceLumpList, ST_NUMFACES, STATUS_BAR_BIG_RED_MINUS_LUMP, STATUS_BAR_SMALL_GREY_NUMBER_LUMPS } from './assets.ts';
import {
  VANILLA_STARMS_PATCH_NAME,
  VANILLA_STARMS_X,
  VANILLA_STATUS_BAR_HEIGHT,
  VANILLA_STATUS_BAR_X,
  VANILLA_STATUS_BAR_Y,
  VANILLA_STBAR_PATCH_NAME,
} from './implement-status-bar-background.ts';
import {
  VANILLA_ST_AMMO_X,
  VANILLA_ST_AMMO_Y_OFFSETS,
  VANILLA_ST_KEY_PATCH_PREFIX,
  VANILLA_ST_KEY_X,
  VANILLA_ST_KEY_Y_OFFSETS,
  VANILLA_ST_MAXAMMO_X,
} from './implement-status-bar-key-and-ammo-widgets.ts';
import {
  VANILLA_ST_AMMOX,
  VANILLA_ST_ARMORX,
  VANILLA_ST_FRAGSX,
  VANILLA_ST_HEALTHX,
  VANILLA_ST_NUMBER_Y,
  VANILLA_ST_PATCH_SHORT_PERCENT,
  VANILLA_ST_PATCH_TALL_PERCENT,
  shortDigitPatchName,
  tallDigitPatchName,
} from './implement-status-bar-numbers-and-percent-widgets.ts';
import type { StatusBarValues } from './statusBar.ts';

// ── Vanilla st_stuff.c widget geometry not in the contract modules ───

/** `ST_FX` — face widget X (st_stuff.c `STlib_initMultIcon(&w_faces, ST_FX, ...)`). */
export const VANILLA_ST_FACE_X = 143;

/** `ST_FY` — face widget Y (same row as the STBAR origin). */
export const VANILLA_ST_FACE_Y = VANILLA_STATUS_BAR_Y;

/** `ST_ARMSX` — arms chart column-0 X (st_stuff.c). */
export const VANILLA_ST_ARMS_X = 111;

/** `ST_ARMSY` — arms chart row-0 Y (st_stuff.c). */
export const VANILLA_ST_ARMS_Y = 172;

/** `ST_ARMSXSPACE` — horizontal stride between arms columns. */
export const VANILLA_ST_ARMS_X_SPACE = 12;

/** `ST_ARMSYSPACE` — vertical stride between arms rows. */
export const VANILLA_ST_ARMS_Y_SPACE = 10;

/** Number of small-ammo / max-ammo rows (one per ammotype). */
const ST_NUM_AMMO_ROWS = 4;

/** Number of key-box slots (blue / yellow / red). */
const ST_NUM_KEY_BOXES = 3;

/** Number of arms slots (weapons 2..7). */
const ST_NUM_ARMS_SLOTS = 6;

/**
 * The 42-entry `faces[]` lump table in the exact order vanilla's
 * `ST_loadGraphics` fills it (`buildStatusBarFaceLumpList`). The face
 * state machine yields a linear index into this; resolving it here is
 * the faithful equivalent of `V_DrawPatch(..., faces[st_faceindex])`.
 */
const FACE_LUMP_TABLE = buildStatusBarFaceLumpList();

/** Ready-ammo / health / armor widgets are 3 digits (st_stuff.c `ST_*WIDTH`). */
const ST_BIG_NUM_DIGITS = 3;

/** Small per-type ammo / max-ammo widgets are 3 digits. */
const ST_SMALL_NUM_DIGITS = 3;

/** Deathmatch frag widget is 2 digits (`ST_FRAGSWIDTH`). */
const ST_FRAGS_DIGITS = 2;

// ── Patch cache ──────────────────────────────────────────────────────

/**
 * Decoded-patch cache + WAD binding for one runtime's status bar. Holds
 * no module-global state; one instance lives per {@link GameRuntime}.
 */
export interface StatusBarRenderer {
  /** Decode (and memoize) the named lump as a patch. */
  patch(lumpName: string): DecodedPatch;
  /** True iff the WAD ships the named lump. */
  has(lumpName: string): boolean;
}

/**
 * Build a status bar renderer bound to a WAD lookup + buffer. Decoded
 * patches are memoized so a per-tic redraw never re-parses a lump.
 */
export function createStatusBarRenderer(lookup: LumpLookup, wadBuffer: Buffer): StatusBarRenderer {
  const cache = new Map<string, DecodedPatch>();
  return {
    patch(lumpName: string): DecodedPatch {
      let decoded = cache.get(lumpName);
      if (decoded === undefined) {
        decoded = decodePatch(lookup.getLumpData(lumpName, wadBuffer));
        cache.set(lumpName, decoded);
      }
      return decoded;
    },
    has(lumpName: string): boolean {
      return lookup.hasLump(lumpName);
    },
  };
}

// ── STlib_drawNum / STlib_drawPercent ────────────────────────────────

/**
 * `STlib_drawNum` (st_lib.c) byte-for-byte: right-justified integer at
 * `(x, y)`, the rightmost digit's right edge at `x`, walking left one
 * `digitWidth` per digit and stopping when the value is exhausted or
 * `maxDigits` digits have been drawn. A zero value still draws a single
 * `0` one digit-width left of `x`. Negatives clamp to the widget's
 * digit span (`-9` for 2-digit, `-99` for 3-digit) and draw the big-red
 * minus glyph just left of the most-significant digit.
 *
 * `digitLumpName` resolves the per-digit patch (tall red `STTNUM<d>` or
 * short yellow `STYSNUM<d>`); `digitWidth` is the fixed glyph stride
 * vanilla advances by (`SHORT(w->p[0]->width)`), not the variable patch
 * width, so right-justification is exact.
 */
function drawNum(
  renderer: StatusBarRenderer,
  framebuffer: Uint8Array,
  value: number,
  x: number,
  y: number,
  maxDigits: number,
  digitWidth: number,
  digitLumpName: (digit: number) => string,
): void {
  let numDigits = maxDigits;
  let num = value;

  const negative = num < 0;
  if (negative) {
    if (numDigits === 2 && num < -9) {
      num = -9;
    } else if (numDigits === 3 && num < -99) {
      num = -99;
    }
    num = -num;
  }

  let cursorX = x;

  // in the special case of 0, you draw 0
  if (num === 0) {
    drawPatch(renderer.patch(digitLumpName(0)), x - digitWidth, y, framebuffer);
  }

  // draw the new number
  while (num !== 0 && numDigits !== 0) {
    cursorX -= digitWidth;
    drawPatch(renderer.patch(digitLumpName(num % 10)), cursorX, y, framebuffer);
    num = Math.trunc(num / 10);
    numDigits -= 1;
  }

  // draw a minus sign if necessary
  if (negative && renderer.has(STATUS_BAR_BIG_RED_MINUS_LUMP)) {
    drawPatch(renderer.patch(STATUS_BAR_BIG_RED_MINUS_LUMP), cursorX - 8, y, framebuffer);
  }
}

/**
 * `STlib_drawPercent` (st_lib.c): draw the percent glyph at the widget
 * anchor, then the right-justified number through {@link drawNum}.
 */
function drawPercent(
  renderer: StatusBarRenderer,
  framebuffer: Uint8Array,
  value: number,
  x: number,
  y: number,
  percentLumpName: string,
  digitWidth: number,
  digitLumpName: (digit: number) => string,
): void {
  if (renderer.has(percentLumpName)) {
    drawPatch(renderer.patch(percentLumpName), x, y, framebuffer);
  }
  drawNum(renderer, framebuffer, value, x, y, ST_BIG_NUM_DIGITS, digitWidth, digitLumpName);
}

// ── Glyph stride helpers ─────────────────────────────────────────────

/** Fixed advance of a tall (red) digit (`SHORT(tallnum[0]->width)`). */
function tallDigitWidth(renderer: StatusBarRenderer): number {
  return renderer.patch(tallDigitPatchName(0)).header.width;
}

/** Fixed advance of a short (yellow) digit. */
function shortDigitWidth(renderer: StatusBarRenderer): number {
  return renderer.patch(shortDigitPatchName(0)).header.width;
}

// ── ST_drawWidgets ───────────────────────────────────────────────────

/**
 * Composite the full vanilla status bar into the bottom 32 rows of
 * `framebuffer`, reproducing `ST_Drawer` / `ST_drawWidgets`.
 *
 * Draw order matches st_stuff.c: opaque `STBAR` background, the `STARMS`
 * inset (single player only), then every widget — ready-ammo, the four
 * small per-type ammo + max-ammo columns, health %, armor %, the arms
 * chart (single player) or the frags readout (deathmatch), the three
 * key boxes, and the face.
 *
 * @param framebuffer  - 320×200 8-bit palette framebuffer to draw into.
 * @param renderer     - Per-runtime decoded-patch cache + WAD binding.
 * @param values       - The status bar value snapshot
 *                       ({@link StatusBarValues} from
 *                       `computeStatusBarValues`).
 * @param screenWidth  - Row stride (defaults to {@link SCREENWIDTH}).
 * @param screenHeight - Framebuffer row count (defaults to
 *                       {@link SCREENHEIGHT}).
 */
export function drawStatusBar(
  framebuffer: Uint8Array,
  renderer: StatusBarRenderer,
  values: StatusBarValues,
  screenWidth: number = SCREENWIDTH,
  screenHeight: number = SCREENHEIGHT,
): void {
  const draw = (lumpName: string, x: number, y: number): void => {
    if (!renderer.has(lumpName)) {
      return;
    }
    drawPatch(renderer.patch(lumpName), x, y, framebuffer, screenWidth, screenHeight);
  };

  // ST_refreshBackground: STBAR full strip, STARMS inset in single
  // player (the arms widget overlays it; in deathmatch the frags
  // readout takes the same area and STARMS is skipped).
  draw(VANILLA_STBAR_PATCH_NAME, VANILLA_STATUS_BAR_X, VANILLA_STATUS_BAR_Y);
  const singlePlayerArms = values.armsVisible;
  if (singlePlayerArms) {
    draw(VANILLA_STARMS_PATCH_NAME, VANILLA_STARMS_X, VANILLA_STATUS_BAR_Y);
  }

  const tallWidth = tallDigitWidth(renderer);
  const shortWidth = shortDigitWidth(renderer);

  // w_ready — ready-weapon ammo (3-digit tall red). The 1994
  // ST_LARGEAMMO sentinel overflows maxdigits → nothing drawn for
  // fist/chainsaw, exactly as vanilla.
  drawNum(renderer, framebuffer, values.ready, VANILLA_ST_AMMOX, VANILLA_ST_NUMBER_Y, ST_BIG_NUM_DIGITS, tallWidth, tallDigitPatchName);

  // w_health / w_armor — tall red percent widgets.
  drawPercent(renderer, framebuffer, values.health, VANILLA_ST_HEALTHX, VANILLA_ST_NUMBER_Y, VANILLA_ST_PATCH_TALL_PERCENT, tallWidth, tallDigitPatchName);
  drawPercent(renderer, framebuffer, values.armor, VANILLA_ST_ARMORX, VANILLA_ST_NUMBER_Y, VANILLA_ST_PATCH_TALL_PERCENT, tallWidth, tallDigitPatchName);

  // w_ammo[i] / w_maxammo[i] — the four small yellow per-type columns.
  for (let i = 0; i < ST_NUM_AMMO_ROWS; i += 1) {
    const rowY = VANILLA_ST_AMMO_Y_OFFSETS[i]!;
    drawNum(renderer, framebuffer, values.currentAmmo[i] ?? 0, VANILLA_ST_AMMO_X, rowY, ST_SMALL_NUM_DIGITS, shortWidth, shortDigitPatchName);
    drawNum(renderer, framebuffer, values.maxAmmo[i] ?? 0, VANILLA_ST_MAXAMMO_X, rowY, ST_SMALL_NUM_DIGITS, shortWidth, shortDigitPatchName);
  }

  // w_arms (single player) — slots 2..7 owned/dim, OR w_frags
  // (deathmatch) over the same STARMS area.
  if (singlePlayerArms) {
    for (let slot = 0; slot < ST_NUM_ARMS_SLOTS; slot += 1) {
      const column = slot % 2;
      const row = Math.trunc(slot / 2);
      const x = VANILLA_ST_ARMS_X + column * VANILLA_ST_ARMS_X_SPACE;
      const y = VANILLA_ST_ARMS_Y + row * VANILLA_ST_ARMS_Y_SPACE;
      const weaponDigit = slot + 2; // weapons 2..7
      const owned = values.armsOwned[slot] === true;
      const lumpName = owned ? shortDigitPatchName(weaponDigit) : STATUS_BAR_SMALL_GREY_NUMBER_LUMPS[weaponDigit]!;
      draw(lumpName, x, y);
    }
  } else if (values.fragsVisible) {
    drawNum(renderer, framebuffer, values.frags, VANILLA_ST_FRAGSX, VANILLA_ST_NUMBER_Y, ST_FRAGS_DIGITS, tallWidth, tallDigitPatchName);
  }

  // w_keyboxes[i] — the remembered card/skull per color slot.
  for (let i = 0; i < ST_NUM_KEY_BOXES; i += 1) {
    const keyIndex = values.keyBoxes[i] ?? -1;
    if (keyIndex < 0) {
      continue;
    }
    draw(`${VANILLA_ST_KEY_PATCH_PREFIX}${keyIndex}`, VANILLA_ST_KEY_X, VANILLA_ST_KEY_Y_OFFSETS[i]!);
  }

  // w_faces — the face the state machine selected this tic.
  const faceIndex = values.faceIndex;
  if (faceIndex >= 0 && faceIndex < ST_NUMFACES) {
    draw(FACE_LUMP_TABLE[faceIndex]!, VANILLA_ST_FACE_X, VANILLA_ST_FACE_Y);
  }
}

/** Re-export for callers wiring the runtime status bar. */
export { VANILLA_STATUS_BAR_HEIGHT, VANILLA_STATUS_BAR_Y };
