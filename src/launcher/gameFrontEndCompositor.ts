/**
 * Intermission + finale pixel compositor (wi_stuff.c WI_Drawer /
 * f_finale.c F_Drawer).
 *
 * The {@link GameHost} owns the deterministic, headless-testable
 * control flow for the end-of-level "stats" screen and the
 * end-of-episode finale text crawl ({@link IntermissionState} /
 * {@link FinaleState}).  This module is the matching draw half: it
 * paints the verified state into the same 320x200 indexed framebuffer
 * the gameplay path uses, so `renderHost` returns a non-null frame
 * for the new phases and the Win32 shell blits it directly (it
 * composites the menu only when `renderHost === null`).
 *
 * Parity-faithful layout, transcribed from Chocolate Doom 2.2.1
 * wi_stuff.c (the load-bearing screen constants are reproduced
 * verbatim; the C1 shareware target is Doom 1 / episode 1 only):
 *
 *  - `WI_drawLF` (level-finished header): the `WILV{ep}{map}` level
 *    name patch centred at `WI_TITLEY = 2`, then `WIF` ("finished")
 *    `WI_SPACINGY = 33` px below it.
 *  - `WI_drawEL` (entering header): `WIENTER` ("entering") at
 *    `WI_TITLEY`, then the next map's `WILV{ep}{map}` name below.
 *  - `WI_drawStats` (single-player): the `WIOSTK`/`WIOSTI`/`WIOSTS`
 *    stat labels down the left column at `SP_STATSX = 50`,
 *    `SP_STATSY = 50`, `WI_SPACINGY` apart, with the right-aligned
 *    `WI_drawPercent` value (`WINUM0..9` + `WIPCNT`) at
 *    `SCREENWIDTH - SP_STATSX`, then the `WITIME`/`WIPAR` row at
 *    `SP_TIMEX = 16`, `SP_TIMEY = SCREENHEIGHT - 32` using
 *    `WI_drawTime` (mm:ss via `WINUM*`/`WICOLON`).
 *  - The background is the per-episode `WIMAP0` (E1) lump.
 *
 * f_finale.c `F_TextWrite`: tile the per-episode background flat
 * (FLOOR4_8 for E1) across the screen, then draw the first
 * `getVisibleCharacterCount` characters of the episode text with the
 * `hu_font` (STCFN033..STCFN095) at `(10,10)`, advancing 4px per
 * space and `font[c]->width` per glyph, with the vanilla
 * `\n` → new line / `+11` line height.
 */

import type { LauncherResources } from './session.ts';
import type { DecodedPatch } from '../render/patchDraw.ts';
import type { FinaleState } from '../ui/finale.ts';
import type { IntermissionState } from '../ui/intermission.ts';

import { SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';
import { decodePatch, drawPatch } from '../render/patchDraw.ts';
import { getVisibleCharacterCount } from '../ui/finale.ts';
import { TICRATE } from '../ui/intermission.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';

// ── wi_stuff.c load-bearing screen constants ───────────────────────

/** `WI_TITLEY` — y of the level-finished / entering header. */
const WI_TITLEY = 2;
/** `WI_SPACINGY` — vertical gap between header rows / stat rows. */
const WI_SPACINGY = 33;
/** `SP_STATSX` / `SP_STATSY` — single-player stat label column. */
const SP_STATSX = 50;
const SP_STATSY = 50;
/** `SP_TIMEX` / `SP_TIMEY` — the time/par row anchor. */
const SP_TIMEX = 16;
const SP_TIMEY = SCREENHEIGHT - 32;

/** f_finale.c text origin (F_TextWrite `cx = 10; cy = 10`). */
const FINALE_TEXT_X = 10;
const FINALE_TEXT_Y = 10;
/** f_finale.c line height (`cy += 11`) and space width (`cx += 4`). */
const FINALE_LINE_HEIGHT = 11;
const FINALE_SPACE_WIDTH = 4;
/** hu_font first char code (`HU_FONTSTART = '!'` = 33). */
const HU_FONTSTART = 33;
const HU_FONTSIZE = 63;

/**
 * Lazily-decoded WAD patch / hu_font / flat cache bound to one IWAD.
 * Mirrors `MenuCompositor`'s pattern (decode once, cache by name).
 */
export class FrontEndCompositor {
  readonly #lookup: LumpLookup;
  readonly #wadBuffer: Buffer;
  readonly #cache = new Map<string, DecodedPatch>();
  readonly #huFont: (DecodedPatch | null)[] = [];
  #huFontLoaded = false;

  constructor(resources: LauncherResources) {
    this.#wadBuffer = resources.wadBuffer;
    this.#lookup = new LumpLookup(resources.directory);
  }

  #patch(lumpName: string): DecodedPatch | null {
    let patch = this.#cache.get(lumpName);
    if (patch === undefined) {
      if (!this.#lookup.hasLump(lumpName)) return null;
      patch = decodePatch(this.#lookup.getLumpData(lumpName, this.#wadBuffer));
      this.#cache.set(lumpName, patch);
    }
    return patch;
  }

  #flatPixels(lumpName: string): Uint8Array | null {
    if (!this.#lookup.hasLump(lumpName)) return null;
    const data = this.#lookup.getLumpData(lumpName, this.#wadBuffer);
    if (data.length < 64 * 64) return null;
    return new Uint8Array(data.subarray(0, 64 * 64));
  }

  #loadHuFont(): void {
    if (this.#huFontLoaded) return;
    this.#huFontLoaded = true;
    for (let i = 0; i < HU_FONTSIZE; i += 1) {
      const code = HU_FONTSTART + i;
      // HU_Init: `sprintf(buffer, "STCFN%.3d", j)`.
      const name = `STCFN${String(code).padStart(3, '0')}`;
      this.#huFont[i] = this.#patch(name);
    }
  }

  /** Centre a patch horizontally (wi_stuff.c `(SCREENWIDTH - w)/2`). */
  #drawCentered(lumpName: string, y: number, framebuffer: Uint8Array): number {
    const patch = this.#patch(lumpName);
    if (patch === null) return y;
    const x = ((SCREENWIDTH - patch.header.width) / 2) | 0;
    drawPatch(patch, x, y, framebuffer);
    return y;
  }

  /**
   * wi_stuff.c `WI_drawNum`: draw `n` right-aligned ending at `x`
   * using `WINUM*`, returns the new (left) x.  A negative `digits`
   * draws the natural width; this port draws the natural width too.
   */
  #drawNum(n: number, x: number, y: number, framebuffer: Uint8Array): number {
    const numWidth = this.#patch('WINUM0')?.header.width ?? 0;
    let value = n;
    let neg = false;
    if (value < 0) {
      neg = true;
      value = -value;
    }
    let cursor = x;
    if (value === 0) {
      const zero = this.#patch('WINUM0');
      if (zero !== null) {
        cursor -= numWidth;
        drawPatch(zero, cursor, y, framebuffer);
      }
    } else {
      while (value > 0) {
        const digit = value % 10;
        value = (value / 10) | 0;
        const glyph = this.#patch(`WINUM${digit}`);
        cursor -= numWidth;
        if (glyph !== null) drawPatch(glyph, cursor, y, framebuffer);
      }
    }
    if (neg) {
      const minus = this.#patch('WIMINUS');
      if (minus !== null) {
        cursor -= minus.header.width;
        drawPatch(minus, cursor, y, framebuffer);
      }
    }
    return cursor;
  }

  /** wi_stuff.c `WI_drawPercent`: `WIPCNT` then the number. */
  #drawPercent(percent: number, x: number, y: number, framebuffer: Uint8Array): void {
    const pct = this.#patch('WIPCNT');
    if (pct !== null) drawPatch(pct, x, y, framebuffer);
    this.#drawNum(percent, x, y, framebuffer);
  }

  /** wi_stuff.c `WI_drawTime`: mm:ss right-aligned ending at `x`. */
  #drawTime(seconds: number, x: number, y: number, framebuffer: Uint8Array): void {
    if (seconds < 0) return;
    let cursor = x;
    let div = 1;
    do {
      const n = (seconds / div) % 60 | 0;
      cursor = this.#drawNum(n, cursor, y, framebuffer);
      div *= 60;
      const colon = this.#patch('WICOLON');
      if (seconds / div !== 0 && colon !== null) {
        cursor -= colon.header.width;
        drawPatch(colon, cursor, y, framebuffer);
      }
    } while ((seconds / div | 0) !== 0 && div < 3600);
  }

  /**
   * Composite the intermission screen for `state`.  `episode`/`map`
   * pick the level-name patches; `lastMap`/`nextMap` come from the
   * armed round.  Robust to a missing optional patch (the level-name
   * fallback is a no-op, never a crash).
   */
  composeIntermission(state: IntermissionState, framebuffer: Uint8Array): void {
    framebuffer.fill(0);
    const round = state.round;
    if (round === null) return;

    // Background — per-episode WIMAP (E1 → WIMAP0). INTERPIC fallback.
    const bg = this.#patch(`WIMAP${round.episode - 1}`) ?? this.#patch('WIMAP0') ?? this.#patch('INTERPIC');
    if (bg !== null) drawPatch(bg, 0, 0, framebuffer);

    const ep = round.episode - 1;

    if (state.phase === 1 /* ShowNextLoc */) {
      // WI_drawEL: "ENTERING" then the next map's name.
      this.#drawCentered('WIENTER', WI_TITLEY, framebuffer);
      this.#drawCentered(`WILV${ep}${round.nextMap - 1}`, WI_TITLEY + WI_SPACINGY, framebuffer);
      return;
    }

    // WI_drawLF: the finished level name, then "FINISHED".
    this.#drawCentered(`WILV${ep}${round.lastMap - 1}`, WI_TITLEY, framebuffer);
    this.#drawCentered('WIF', WI_TITLEY + WI_SPACINGY, framebuffer);

    // WI_drawStats — single player. Labels left, values right-aligned.
    const valueX = SCREENWIDTH - SP_STATSX;
    let rowY = SP_STATSY;
    const k = this.#patch('WIOSTK');
    if (k !== null) drawPatch(k, SP_STATSX, rowY, framebuffer);
    this.#drawPercent(Math.max(0, state.cntKills), valueX, rowY, framebuffer);

    rowY += WI_SPACINGY;
    const it = this.#patch('WIOSTI');
    if (it !== null) drawPatch(it, SP_STATSX, rowY, framebuffer);
    this.#drawPercent(Math.max(0, state.cntItems), valueX, rowY, framebuffer);

    rowY += WI_SPACINGY;
    const sc = this.#patch('WIOSTS');
    if (sc !== null) drawPatch(sc, SP_STATSX, rowY, framebuffer);
    this.#drawPercent(Math.max(0, state.cntSecrets), valueX, rowY, framebuffer);

    // Time / par row.
    const time = this.#patch('WITIME');
    if (time !== null) drawPatch(time, SP_TIMEX, SP_TIMEY, framebuffer);
    this.#drawTime(Math.max(0, state.cntTime), (SCREENWIDTH / 2) - SP_TIMEX, SP_TIMEY, framebuffer);
    const par = this.#patch('WIPAR');
    if (par !== null) drawPatch(par, (SCREENWIDTH / 2) | 0, SP_TIMEY, framebuffer);
    this.#drawTime(Math.max(0, state.cntPar), SCREENWIDTH - SP_TIMEX, SP_TIMEY, framebuffer);
  }

  /**
   * Composite the finale screen for `state`.  Text stage tiles the
   * episode flat and types the visible characters with hu_font;
   * art-screen stages tile the same flat (shareware E1 has no art
   * patch — vanilla repaints the flat) plus the art lump if present.
   */
  composeFinale(state: FinaleState, framebuffer: Uint8Array): void {
    framebuffer.fill(0);
    const screen = state.screen;
    if (screen === null) return;

    // F_TextWrite / F_BunnyScroll: tile the 64x64 background flat.
    const flat = this.#flatPixels(screen.flat);
    if (flat !== null) {
      for (let y = 0; y < SCREENHEIGHT; y += 1) {
        const row = (y & 63) * 64;
        const base = y * SCREENWIDTH;
        for (let x = 0; x < SCREENWIDTH; x += 1) {
          framebuffer[base + x] = flat[row + (x & 63)]!;
        }
      }
    }

    if (state.stage === 1 /* ArtScreen */ && screen.artLump !== null) {
      const art = this.#patch(screen.artLump);
      if (art !== null) drawPatch(art, 0, 0, framebuffer);
      return;
    }
    if (state.stage !== 0 /* not Text */) return;

    this.#loadHuFont();
    const visible = getVisibleCharacterCount(state);
    let cx = FINALE_TEXT_X;
    let cy = FINALE_TEXT_Y;
    const text = screen.text;
    for (let i = 0; i < visible && i < text.length; i += 1) {
      const ch = text[i]!;
      if (ch === '\n') {
        cx = FINALE_TEXT_X;
        cy += FINALE_LINE_HEIGHT;
        continue;
      }
      const code = ch.toUpperCase().charCodeAt(0);
      const idx = code - HU_FONTSTART;
      if (idx < 0 || idx >= HU_FONTSIZE) {
        cx += FINALE_SPACE_WIDTH;
        continue;
      }
      const glyph = this.#huFont[idx] ?? null;
      if (glyph === null) {
        cx += FINALE_SPACE_WIDTH;
        continue;
      }
      const w = glyph.header.width;
      if (cx + w > SCREENWIDTH) {
        cx = FINALE_TEXT_X;
        cy += FINALE_LINE_HEIGHT;
      }
      drawPatch(glyph, cx, cy, framebuffer);
      cx += w;
    }
  }
}

/** Seconds for a tic count (wi_stuff.c `/ TICRATE`); exported for tests. */
export function ticsToSeconds(tics: number): number {
  return Math.trunc(tics / TICRATE);
}
