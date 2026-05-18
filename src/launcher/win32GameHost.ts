/**
 * Win32 interactive shell for the live game.
 *
 * Opens the same kind of window the smoke host does, but instead of an
 * Enter/Escape-only menu over an input-less player it drives the
 * verified {@link GameHost}: the title screen, the arrow-navigable
 * vanilla menu (New Game → Episode → Skill), and real gameplay through
 * the assembled P_Ticker (monsters animate and chase; full movement /
 * strafe / run / use input).
 *
 * Window + present FFI mirrors the proven `src/launcher/win32.ts`
 * (STATIC class, foreground-gated GetAsyncKeyState, aspect-correct
 * StretchDIBits). Title/menu pixels are composited here from the WAD
 * patches; gameplay pixels come from the bit-exact R_RenderPlayerView
 * via {@link renderHost}.
 *
 * `doom.ts` → `runDoomMain` routes here, so `bun run doom.ts -iwad
 * doom/DOOM1.WAD` is a window you can actually start, navigate, and
 * play. The smoke host and every gate-relied export stay untouched.
 */

import { FFIType, dlopen } from 'bun:ffi';

import type { GameHostInput } from './gameHost.ts';
import type { LauncherResources } from './session.ts';

import { computeClientDimensions, computePresentationRect, SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';
import { KEY_DOWNARROW, KEY_ENTER, KEY_ESCAPE, KEY_LEFTARROW, KEY_RIGHTARROW, KEY_UPARROW } from '../input/keyboard.ts';
import { decodePatch, drawPatch } from '../render/patchDraw.ts';
import type { DecodedPatch } from '../render/patchDraw.ts';
import { LINEHEIGHT, MENU_TREE, MenuKind, SKULLXOFF } from '../ui/menus.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';
import { EMPTY_GAME_HOST_INPUT, createGameHost, feedMenuKey, renderHost, tickHost } from './gameHost.ts';
import { loadLauncherResources } from './session.ts';

const BI_RGB = 0;
const CW_USEDEFAULT = -0x8000_0000;
const DIB_RGB_COLORS = 0;
const RECT_BOTTOM_OFFSET = 12;
const RECT_RIGHT_OFFSET = 8;
const RECT_SIZE = 16;
const SRCCOPY = 0x00cc_0020;
const SW_SHOW = 5;
const WM_CLOSE = 0x0010;
const WM_DESTROY = 0x0002;
const WM_QUIT = 0x0012;
const WINDOW_STYLE = 0x10cf_0000;
const PM_REMOVE = 0x0001;
const MSG_SIZE = 48;
const MSG_MESSAGE_OFFSET = 8;
const TIC_INTERVAL_MS = 1000 / 35;
const DEFAULT_SCALE = 2;

// Virtual-key codes (winuser.h).
const VK_RETURN = 0x0d;
const VK_SHIFT = 0x10;
const VK_CONTROL = 0x11;
const VK_ESCAPE = 0x1b;
const VK_SPACE = 0x20;
const VK_LEFT = 0x25;
const VK_UP = 0x26;
const VK_RIGHT = 0x27;
const VK_DOWN = 0x28;
const VK_A = 0x41;
const VK_D = 0x44;
const VK_E = 0x45;
const VK_Q = 0x51;
const VK_S = 0x53;
const VK_W = 0x57;

// Menu title patches (m_menu.c M_DrawNewGame / M_DrawEpisode).
const MAIN_TITLE = { lump: 'M_DOOM', x: 94, y: 2 } as const;
const EPISODE_TITLE = { lump: 'M_EPISOD', x: 54, y: 38 } as const;
const SKILL_TITLE_NEWG = { lump: 'M_NEWG', x: 96, y: 14 } as const;
const SKILL_TITLE_SKILL = { lump: 'M_SKILL', x: 54, y: 38 } as const;
const SHAREWARE_EPISODE_ITEM_COUNT = 3;

const GDI32_SYMBOLS = {
  StretchDIBits: {
    args: [FFIType.u64, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.u32] as const,
    returns: FFIType.i32,
  },
};

const USER32_SYMBOLS = {
  AdjustWindowRect: { args: [FFIType.ptr, FFIType.u32, FFIType.i32] as const, returns: FFIType.i32 },
  CreateWindowExW: { args: [FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.u64, FFIType.u64, FFIType.u64, FFIType.ptr] as const, returns: FFIType.u64 },
  DestroyWindow: { args: [FFIType.u64] as const, returns: FFIType.i32 },
  DispatchMessageW: { args: [FFIType.ptr] as const, returns: FFIType.u64 },
  GetAsyncKeyState: { args: [FFIType.i32] as const, returns: FFIType.i16 },
  GetClientRect: { args: [FFIType.u64, FFIType.ptr] as const, returns: FFIType.i32 },
  GetDC: { args: [FFIType.u64] as const, returns: FFIType.u64 },
  GetForegroundWindow: { args: [] as const, returns: FFIType.u64 },
  PeekMessageW: { args: [FFIType.ptr, FFIType.u64, FFIType.u32, FFIType.u32, FFIType.u32] as const, returns: FFIType.i32 },
  ReleaseDC: { args: [FFIType.u64, FFIType.u64] as const, returns: FFIType.i32 },
  ShowWindow: { args: [FFIType.u64, FFIType.i32] as const, returns: FFIType.i32 },
  TranslateMessage: { args: [FFIType.ptr] as const, returns: FFIType.i32 },
};

function openGdi32() {
  return dlopen('gdi32.dll', GDI32_SYMBOLS);
}

function openUser32() {
  return dlopen('user32.dll', USER32_SYMBOLS);
}

type Gdi32Symbols = ReturnType<typeof openGdi32>['symbols'];
type User32Symbols = ReturnType<typeof openUser32>['symbols'];

export interface Win32GameHostOptions {
  readonly iwadPath: string;
  readonly scale?: number;
  readonly title?: string;
}

function buildBitmapInfoHeader(width: number, height: number): Buffer {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(width, 4);
  header.writeInt32LE(-height, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(BI_RGB, 16);
  header.writeUInt32LE(width * height * 4, 20);
  return header;
}

function buildPaletteLookup(palette: Uint8Array): Uint32Array {
  const colors = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const o = i * 3;
    colors[i] = palette[o + 2]! | (palette[o + 1]! << 8) | (palette[o]! << 16) | 0xff00_0000;
  }
  return colors;
}

function convertIndexedFrame(source: Uint8Array, destination: Uint32Array, paletteLookup: Uint32Array): void {
  for (let i = 0; i < source.length; i += 1) {
    destination[i] = paletteLookup[source[i]!]!;
  }
}

/** Title/menu pixel compositor (gameplay frames come from renderHost). */
class MenuCompositor {
  readonly #lookup: LumpLookup;
  readonly #wadBuffer: Buffer;
  readonly #cache = new Map<string, DecodedPatch>();
  readonly #titlePic: DecodedPatch;

  constructor(resources: LauncherResources) {
    this.#wadBuffer = resources.wadBuffer;
    this.#lookup = new LumpLookup(resources.directory);
    this.#titlePic = this.#patch('TITLEPIC');
  }

  #patch(lumpName: string): DecodedPatch {
    let patch = this.#cache.get(lumpName);
    if (patch === undefined) {
      patch = decodePatch(this.#lookup.getLumpData(lumpName, this.#wadBuffer));
      this.#cache.set(lumpName, patch);
    }
    return patch;
  }

  #has(lumpName: string): boolean {
    return this.#lookup.hasLump(lumpName);
  }

  /** Draw the current title/menu state into an indexed framebuffer. */
  compose(phase: 'title' | 'menu', menu: { currentMenu: MenuKind; itemOn: number; whichSkull: 0 | 1 }, framebuffer: Uint8Array): void {
    drawPatch(this.#titlePic, 0, 0, framebuffer);
    if (phase === 'title') {
      return;
    }

    if (menu.currentMenu === MenuKind.Main) {
      drawPatch(this.#patch(MAIN_TITLE.lump), MAIN_TITLE.x, MAIN_TITLE.y, framebuffer);
    } else if (menu.currentMenu === MenuKind.Episode) {
      drawPatch(this.#patch(EPISODE_TITLE.lump), EPISODE_TITLE.x, EPISODE_TITLE.y, framebuffer);
    } else if (menu.currentMenu === MenuKind.Skill) {
      drawPatch(this.#patch(SKILL_TITLE_NEWG.lump), SKILL_TITLE_NEWG.x, SKILL_TITLE_NEWG.y, framebuffer);
      drawPatch(this.#patch(SKILL_TITLE_SKILL.lump), SKILL_TITLE_SKILL.x, SKILL_TITLE_SKILL.y, framebuffer);
    }

    const definition = MENU_TREE[menu.currentMenu];
    const itemCount = menu.currentMenu === MenuKind.Episode ? SHAREWARE_EPISODE_ITEM_COUNT : definition.items.length;
    for (let i = 0; i < itemCount; i += 1) {
      const item = definition.items[i];
      if (item === undefined || item.lump.length === 0 || !this.#has(item.lump)) {
        continue;
      }
      drawPatch(this.#patch(item.lump), definition.x, definition.y + i * LINEHEIGHT, framebuffer);
    }

    const skullLump = menu.whichSkull === 0 ? 'M_SKULL1' : 'M_SKULL2';
    drawPatch(this.#patch(skullLump), definition.x + SKULLXOFF, definition.y - 5 + menu.itemOn * LINEHEIGHT, framebuffer);
  }
}

/** Edge-triggered menu keys + held gameplay input from GetAsyncKeyState. */
class InputSampler {
  readonly #user32: User32Symbols;
  readonly #wasDown = new Map<number, boolean>();

  constructor(user32: User32Symbols) {
    this.#user32 = user32;
  }

  #down(vk: number, foreground: boolean): boolean {
    if (!foreground) {
      return false;
    }
    const state = this.#user32.GetAsyncKeyState(vk);
    if (typeof state !== 'number') {
      throw new TypeError(`GetAsyncKeyState returned ${typeof state}`);
    }
    return (state & 0x8000) !== 0;
  }

  #pressed(vk: number, foreground: boolean): boolean {
    const now = this.#down(vk, foreground);
    const was = this.#wasDown.get(vk) ?? false;
    this.#wasDown.set(vk, now);
    return now && !was;
  }

  /** Newly-pressed menu keys this poll, mapped to doomkeys.h codes. */
  sampleMenuKeys(foreground: boolean): number[] {
    const keys: number[] = [];
    if (this.#pressed(VK_UP, foreground)) keys.push(KEY_UPARROW);
    if (this.#pressed(VK_DOWN, foreground)) keys.push(KEY_DOWNARROW);
    if (this.#pressed(VK_LEFT, foreground)) keys.push(KEY_LEFTARROW);
    if (this.#pressed(VK_RIGHT, foreground)) keys.push(KEY_RIGHTARROW);
    if (this.#pressed(VK_RETURN, foreground)) keys.push(KEY_ENTER);
    if (this.#pressed(VK_ESCAPE, foreground)) keys.push(KEY_ESCAPE);
    return keys;
  }

  /** Held movement input for one gameplay tic. */
  sampleGameInput(foreground: boolean): GameHostInput {
    return {
      forward: this.#down(VK_W, foreground) || this.#down(VK_UP, foreground),
      backward: this.#down(VK_S, foreground) || this.#down(VK_DOWN, foreground),
      turnLeft: this.#down(VK_A, foreground) || this.#down(VK_LEFT, foreground),
      turnRight: this.#down(VK_D, foreground) || this.#down(VK_RIGHT, foreground),
      strafeLeft: this.#down(VK_Q, foreground),
      strafeRight: this.#down(VK_E, foreground),
      run: this.#down(VK_SHIFT, foreground),
      use: this.#down(VK_SPACE, foreground) || this.#down(VK_CONTROL, foreground),
    };
  }
}

function presentFrame(user32: User32Symbols, gdi32: Gdi32Symbols, windowHandle: bigint, frameBytes: Buffer, frameHeader: Buffer, fillBytes: Buffer, fillHeader: Buffer): void {
  const rectBuffer = Buffer.alloc(RECT_SIZE);
  const rectView = new DataView(rectBuffer.buffer, rectBuffer.byteOffset, RECT_SIZE);
  const rectResult = user32.GetClientRect(windowHandle, rectBuffer);
  if (typeof rectResult !== 'number' || rectResult === 0) {
    return;
  }
  const clientWidth = rectView.getInt32(RECT_RIGHT_OFFSET, true);
  const clientHeight = rectView.getInt32(RECT_BOTTOM_OFFSET, true);
  if (clientWidth <= 0 || clientHeight <= 0) {
    return;
  }
  const present = computePresentationRect(clientWidth, clientHeight, true);
  const dcResult = user32.GetDC(windowHandle);
  if (typeof dcResult !== 'bigint' || dcResult === 0n) {
    return;
  }
  const deviceContext = dcResult;
  try {
    void gdi32.StretchDIBits(deviceContext, 0, 0, clientWidth, clientHeight, 0, 0, 1, 1, fillBytes, fillHeader, DIB_RGB_COLORS, SRCCOPY);
    if (present.width === 0 || present.height === 0) {
      return;
    }
    void gdi32.StretchDIBits(deviceContext, present.x, present.y, present.width, present.height, 0, 0, SCREENWIDTH, SCREENHEIGHT, frameBytes, frameHeader, DIB_RGB_COLORS, SRCCOPY);
  } finally {
    void user32.ReleaseDC(windowHandle, deviceContext);
  }
}

/**
 * Open the interactive window and run the title → menu → play loop at
 * 35 Hz until the window is closed.
 */
export async function runWin32GameHost(options: Win32GameHostOptions): Promise<void> {
  const resources = await loadLauncherResources(options.iwadPath);
  const host = createGameHost(resources);
  const compositor = new MenuCompositor(resources);
  const paletteLookup = buildPaletteLookup(resources.palette);
  const scale = options.scale ?? DEFAULT_SCALE;

  const indexedFrame = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
  const rgbFrame = new Uint32Array(SCREENWIDTH * SCREENHEIGHT);
  const rgbBytes = Buffer.from(rgbFrame.buffer);
  const rgbHeader = buildBitmapInfoHeader(SCREENWIDTH, SCREENHEIGHT);
  const fillBytes = Buffer.from(new Uint32Array([0xff00_0000]).buffer);
  const fillHeader = buildBitmapInfoHeader(1, 1);

  const user32 = openUser32();
  const gdi32 = openGdi32();
  const sampler = new InputSampler(user32.symbols);
  const messageBuffer = Buffer.alloc(MSG_SIZE);
  const messageView = new DataView(messageBuffer.buffer, messageBuffer.byteOffset, MSG_SIZE);

  const clientSize = computeClientDimensions(scale, true);
  const windowRect = Buffer.alloc(RECT_SIZE);
  const windowRectView = new DataView(windowRect.buffer, windowRect.byteOffset, RECT_SIZE);
  windowRectView.setInt32(0, 0, true);
  windowRectView.setInt32(4, 0, true);
  windowRectView.setInt32(8, clientSize.width, true);
  windowRectView.setInt32(12, clientSize.height, true);
  if (user32.symbols.AdjustWindowRect(windowRect, WINDOW_STYLE, 0) === 0) {
    throw new Error('AdjustWindowRect failed');
  }
  const outerWidth = windowRectView.getInt32(RECT_RIGHT_OFFSET, true) - windowRectView.getInt32(0, true);
  const outerHeight = windowRectView.getInt32(RECT_BOTTOM_OFFSET, true) - windowRectView.getInt32(4, true);

  const windowClassName = Buffer.from('STATIC\0', 'utf16le');
  const windowTitle = Buffer.from(`${options.title ?? 'DOOM'}\0`, 'utf16le');
  const windowHandleResult = user32.symbols.CreateWindowExW(0, windowClassName, windowTitle, WINDOW_STYLE, CW_USEDEFAULT, CW_USEDEFAULT, outerWidth, outerHeight, 0n, 0n, 0n, null);
  if (typeof windowHandleResult !== 'bigint' || windowHandleResult === 0n) {
    throw new Error('CreateWindowExW failed');
  }
  const windowHandle = windowHandleResult;
  void user32.symbols.ShowWindow(windowHandle, SW_SHOW);

  let windowDestroyed = false;
  let nextTicAtMs = performance.now();

  try {
    while (true) {
      let closeRequested = false;
      while (user32.symbols.PeekMessageW(messageBuffer, 0n, 0, 0, PM_REMOVE) !== 0) {
        const message = messageView.getUint32(MSG_MESSAGE_OFFSET, true);
        if (message === WM_CLOSE || message === WM_DESTROY || message === WM_QUIT) {
          closeRequested = true;
          break;
        }
        void user32.symbols.TranslateMessage(messageBuffer);
        void user32.symbols.DispatchMessageW(messageBuffer);
      }
      if (closeRequested) {
        void user32.symbols.DestroyWindow(windowHandle);
        windowDestroyed = true;
        return;
      }

      const foregroundResult = user32.symbols.GetForegroundWindow();
      const foreground = typeof foregroundResult === 'bigint' && foregroundResult === windowHandle;

      if (host.phase === 'title' || host.phase === 'menu') {
        for (const key of sampler.sampleMenuKeys(foreground)) {
          feedMenuKey(host, key);
        }
        if (sampler.sampleGameInput(foreground).use && host.phase === 'title') {
          feedMenuKey(host, KEY_ENTER);
        }
      }

      const now = performance.now();
      while (now >= nextTicAtMs) {
        if (host.phase === 'game') {
          tickHost(host, sampler.sampleGameInput(foreground));
        } else {
          tickHost(host, EMPTY_GAME_HOST_INPUT);
        }
        nextTicAtMs += TIC_INTERVAL_MS;
      }

      const gameplayFrame = renderHost(host);
      if (gameplayFrame !== null) {
        indexedFrame.set(gameplayFrame);
      } else {
        compositor.compose(host.phase === 'title' ? 'title' : 'menu', host.menu, indexedFrame);
      }
      convertIndexedFrame(indexedFrame, rgbFrame, paletteLookup);
      presentFrame(user32.symbols, gdi32.symbols, windowHandle, rgbBytes, rgbHeader, fillBytes, fillHeader);

      await Bun.sleep(1);
    }
  } finally {
    if (!windowDestroyed) {
      void user32.symbols.DestroyWindow(windowHandle);
    }
    gdi32.close();
    user32.close();
  }
}
