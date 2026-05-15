import { FFIType, dlopen } from 'bun:ffi';

import type { GameMode } from '../bootstrap/gameMode.ts';
import { TitleLoop } from '../bootstrap/titleLoop.ts';
import { parsePlaypal } from '../assets/playpal.ts';
import { computeClientDimensions, computePresentationRect, SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';
import { decodePatch, drawPatch } from '../render/patchDraw.ts';
import { parseWadDirectory } from '../wad/directory.ts';
import { parseWadHeader } from '../wad/header.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';

const BI_RGB = 0;
const CW_USEDEFAULT = -0x8000_0000;
const DEFAULT_SCALE = 2;
const DIB_RGB_COLORS = 0;
const RECT_BOTTOM_OFFSET = 12;
const RECT_RIGHT_OFFSET = 8;
const RECT_SIZE = 16;
const RUNTIME_COMMAND = 'bun run doom.ts';
const SRCCOPY = 0x00cc_0020;
const SW_SHOW = 5;
const TITLE_LOOP_WINDOW_TITLE = 'DOOM Codex - TITLEPIC';
const VK_ESCAPE = 0x1b;
const WINDOW_STYLE = 0x10cf_0000;

const GDI32_SYMBOLS = {
  DeleteDC: {
    args: [FFIType.u64] as const,
    returns: FFIType.i32,
  },
  StretchDIBits: {
    args: [FFIType.u64, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.u32] as const,
    returns: FFIType.i32,
  },
};

const USER32_SYMBOLS = {
  AdjustWindowRect: {
    args: [FFIType.ptr, FFIType.u32, FFIType.i32] as const,
    returns: FFIType.i32,
  },
  CreateWindowExW: {
    args: [FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.u64, FFIType.u64, FFIType.u64, FFIType.ptr] as const,
    returns: FFIType.u64,
  },
  DestroyWindow: {
    args: [FFIType.u64] as const,
    returns: FFIType.i32,
  },
  GetAsyncKeyState: {
    args: [FFIType.i32] as const,
    returns: FFIType.i16,
  },
  GetClientRect: {
    args: [FFIType.u64, FFIType.ptr] as const,
    returns: FFIType.i32,
  },
  GetDC: {
    args: [FFIType.u64] as const,
    returns: FFIType.u64,
  },
  ReleaseDC: {
    args: [FFIType.u64, FFIType.u64] as const,
    returns: FFIType.i32,
  },
  ShowWindow: {
    args: [FFIType.u64, FFIType.i32] as const,
    returns: FFIType.i32,
  },
};

type Gdi32Symbols = ReturnType<typeof openGdi32>['symbols'];
type User32Symbols = ReturnType<typeof openUser32>['symbols'];

export interface TitleLoopSmokeHostOptions {
  readonly gameMode: GameMode;
  readonly iwadPath: string;
  readonly scale?: number;
}

interface TitleLoopSmokeFrame {
  readonly framebuffer: Uint8Array;
  readonly palette: Uint8Array;
}

function openGdi32() {
  return dlopen('gdi32.dll', GDI32_SYMBOLS);
}

function openUser32() {
  return dlopen('user32.dll', USER32_SYMBOLS);
}

function buildBitmapInfoHeader(width: number, height: number): Buffer {
  const bitmapInfoHeader = Buffer.alloc(40);

  bitmapInfoHeader.writeUInt32LE(40, 0);
  bitmapInfoHeader.writeInt32LE(width, 4);
  bitmapInfoHeader.writeInt32LE(-height, 8);
  bitmapInfoHeader.writeUInt16LE(1, 12);
  bitmapInfoHeader.writeUInt16LE(32, 14);
  bitmapInfoHeader.writeUInt32LE(BI_RGB, 16);
  bitmapInfoHeader.writeUInt32LE(width * height * 4, 20);

  return bitmapInfoHeader;
}

function buildPaletteLookup(palette: Uint8Array): Uint32Array {
  const colors = new Uint32Array(256);

  for (let colorIndex = 0; colorIndex < 256; colorIndex += 1) {
    const paletteOffset = colorIndex * 3;
    const red = palette[paletteOffset]!;
    const green = palette[paletteOffset + 1]!;
    const blue = palette[paletteOffset + 2]!;

    colors[colorIndex] = blue | (green << 8) | (red << 16) | 0xff00_0000;
  }

  return colors;
}

function convertIndexedFrame(source: Uint8Array, destination: Uint32Array, paletteLookup: Uint32Array): void {
  for (let pixelIndex = 0; pixelIndex < source.length; pixelIndex += 1) {
    destination[pixelIndex] = paletteLookup[source[pixelIndex]!]!;
  }
}

async function loadTitleLoopSmokeFrame(options: TitleLoopSmokeHostOptions): Promise<TitleLoopSmokeFrame> {
  const iwadFile = Bun.file(options.iwadPath);
  if (!(await iwadFile.exists())) {
    throw new Error(`IWAD not found: ${options.iwadPath}`);
  }

  const wadBuffer = Buffer.from(await iwadFile.arrayBuffer());
  const wadDirectory = parseWadDirectory(wadBuffer, parseWadHeader(wadBuffer));
  const wadLookup = new LumpLookup(wadDirectory);
  const titleLoop = new TitleLoop(options.gameMode);
  const titleAction = titleLoop.doAdvanceDemo();

  if (titleAction === null || titleAction.kind !== 'page' || titleAction.lumpName !== 'TITLEPIC') {
    throw new Error('Title loop did not begin on the TITLEPIC page.');
  }

  const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
  const titlePatch = decodePatch(wadLookup.getLumpData(titleAction.lumpName, wadBuffer));
  drawPatch(titlePatch, 0, 0, framebuffer);

  if (!framebuffer.some((paletteIndex) => paletteIndex !== 0)) {
    throw new Error('TITLEPIC rendered an all-zero framebuffer.');
  }

  return Object.freeze({
    framebuffer,
    palette: parsePlaypal(wadLookup.getLumpData('PLAYPAL', wadBuffer))[0]!,
  });
}

function presentFrame(user32: User32Symbols, gdi32: Gdi32Symbols, windowHandle: bigint, indexedFrameBytes: Buffer, indexedFrameHeader: Buffer, backgroundFillBytes: Buffer, backgroundFillHeader: Buffer): void {
  const clientRectBuffer = Buffer.alloc(RECT_SIZE);
  const clientRectView = new DataView(clientRectBuffer.buffer, clientRectBuffer.byteOffset, RECT_SIZE);

  const getClientRectResult = user32.GetClientRect(windowHandle, clientRectBuffer);

  if (typeof getClientRectResult !== 'number') {
    throw new TypeError(`GetClientRect returned ${typeof getClientRectResult} instead of number`);
  }

  if (getClientRectResult === 0) {
    throw new Error('GetClientRect failed');
  }

  const clientWidth = clientRectView.getInt32(RECT_RIGHT_OFFSET, true);
  const clientHeight = clientRectView.getInt32(RECT_BOTTOM_OFFSET, true);

  if (clientWidth <= 0 || clientHeight <= 0) {
    return;
  }

  const presentationRect = computePresentationRect(clientWidth, clientHeight, true);
  const deviceContextResult = user32.GetDC(windowHandle);

  if (typeof deviceContextResult !== 'bigint') {
    throw new TypeError(`GetDC returned ${typeof deviceContextResult} instead of bigint`);
  }

  const deviceContext = deviceContextResult;

  if (deviceContext === 0n) {
    throw new Error('GetDC failed');
  }

  try {
    void gdi32.StretchDIBits(deviceContext, 0, 0, clientWidth, clientHeight, 0, 0, 1, 1, backgroundFillBytes, backgroundFillHeader, DIB_RGB_COLORS, SRCCOPY);

    if (presentationRect.width === 0 || presentationRect.height === 0) {
      return;
    }

    void gdi32.StretchDIBits(deviceContext, presentationRect.x, presentationRect.y, presentationRect.width, presentationRect.height, 0, 0, SCREENWIDTH, SCREENHEIGHT, indexedFrameBytes, indexedFrameHeader, DIB_RGB_COLORS, SRCCOPY);
  } finally {
    void user32.ReleaseDC(windowHandle, deviceContext);
  }
}

export async function runTitleLoopSmokeHost(options: TitleLoopSmokeHostOptions): Promise<void> {
  const frame = await loadTitleLoopSmokeFrame(options);
  const initialClientSize = computeClientDimensions(options.scale ?? DEFAULT_SCALE, true);
  const user32 = openUser32();
  const gdi32 = openGdi32();
  const windowRect = Buffer.alloc(RECT_SIZE);
  const windowRectView = new DataView(windowRect.buffer, windowRect.byteOffset, RECT_SIZE);
  const indexedFrameBuffer = new Uint32Array(SCREENWIDTH * SCREENHEIGHT);
  const indexedFrameBytes = Buffer.from(indexedFrameBuffer.buffer);
  const indexedFrameHeader = buildBitmapInfoHeader(SCREENWIDTH, SCREENHEIGHT);
  const backgroundFillBuffer = new Uint32Array([0xff00_0000]);
  const backgroundFillBytes = Buffer.from(backgroundFillBuffer.buffer);
  const backgroundFillHeader = buildBitmapInfoHeader(1, 1);
  const paletteLookup = buildPaletteLookup(frame.palette);
  const windowClassName = Buffer.from('STATIC\0', 'utf16le');
  const windowTitle = Buffer.from(`${TITLE_LOOP_WINDOW_TITLE}\0`, 'utf16le');

  convertIndexedFrame(frame.framebuffer, indexedFrameBuffer, paletteLookup);

  windowRectView.setInt32(0, 0, true);
  windowRectView.setInt32(4, 0, true);
  windowRectView.setInt32(8, initialClientSize.width, true);
  windowRectView.setInt32(12, initialClientSize.height, true);

  const adjustWindowRectResult = user32.symbols.AdjustWindowRect(windowRect, WINDOW_STYLE, 0);

  if (typeof adjustWindowRectResult !== 'number') {
    throw new TypeError(`AdjustWindowRect returned ${typeof adjustWindowRectResult} instead of number`);
  }

  if (adjustWindowRectResult === 0) {
    throw new Error('AdjustWindowRect failed');
  }

  const outerWidth = windowRectView.getInt32(RECT_RIGHT_OFFSET, true) - windowRectView.getInt32(0, true);
  const outerHeight = windowRectView.getInt32(RECT_BOTTOM_OFFSET, true) - windowRectView.getInt32(4, true);
  const windowHandleResult = user32.symbols.CreateWindowExW(0, windowClassName, windowTitle, WINDOW_STYLE, CW_USEDEFAULT, CW_USEDEFAULT, outerWidth, outerHeight, 0n, 0n, 0n, null);

  if (typeof windowHandleResult !== 'bigint') {
    throw new TypeError(`CreateWindowExW returned ${typeof windowHandleResult} instead of bigint`);
  }

  const windowHandle = windowHandleResult;

  if (windowHandle === 0n) {
    throw new Error('CreateWindowExW failed');
  }

  void user32.symbols.ShowWindow(windowHandle, SW_SHOW);

  let windowDestroyed = false;

  try {
    while (true) {
      const asyncKeyStateResult = user32.symbols.GetAsyncKeyState(VK_ESCAPE);

      if (typeof asyncKeyStateResult !== 'number') {
        throw new TypeError(`GetAsyncKeyState returned ${typeof asyncKeyStateResult} instead of number`);
      }

      if ((asyncKeyStateResult & 0x8000) !== 0) {
        void user32.symbols.DestroyWindow(windowHandle);
        windowDestroyed = true;
        return;
      }

      presentFrame(user32.symbols, gdi32.symbols, windowHandle, indexedFrameBytes, indexedFrameHeader, backgroundFillBytes, backgroundFillHeader);
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

export const TITLE_LOOP_SMOKE_HOST_CONTRACT = Object.freeze({
  pageLumpName: 'TITLEPIC',
  runtimeCommand: RUNTIME_COMMAND,
  windowTitle: TITLE_LOOP_WINDOW_TITLE,
});
