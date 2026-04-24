import { FFIType, dlopen } from 'bun:ffi';

import { computeClientDimensions, computePresentationRect, SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';
import { TicAccumulator } from '../host/ticAccumulator.ts';
import { PerformanceClock } from '../host/win32/clock.ts';
import { MSG_MESSAGE_OFFSET, MSG_SIZE, PM_REMOVE, WM_QUIT } from '../host/win32/messagePump.ts';

import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, renderLauncherFrame } from './session.ts';
import type { LauncherInputState, LauncherSession } from './session.ts';

const BI_RGB = 0;
const CW_USEDEFAULT = -0x8000_0000;
const DIB_RGB_COLORS = 0;
const RECT_BOTTOM_OFFSET = 12;
const RECT_RIGHT_OFFSET = 8;
const RECT_SIZE = 16;
const SRCCOPY = 0x00cc_0020;
const SW_SHOW = 5;
const VK_A = 0x41;
const VK_D = 0x44;
const VK_E = 0x45;
const VK_ESCAPE = 0x1b;
const VK_F = 0x46;
const VK_LEFT = 0x25;
const VK_NEXT = 0x22;
const VK_PRIOR = 0x21;
const VK_Q = 0x51;
const VK_RIGHT = 0x27;
const VK_SHIFT = 0x10;
const VK_S = 0x53;
const VK_TAB = 0x09;
const VK_UP = 0x26;
const VK_W = 0x57;
const VK_DOWN = 0x28;
const WM_CLOSE = 0x0010;
const WM_DESTROY = 0x0002;
const WINDOW_STYLE = 0x10cf_0000;

const GDI32_SYMBOLS = {
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
  DispatchMessageW: {
    args: [FFIType.ptr] as const,
    returns: FFIType.u64,
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
  GetForegroundWindow: {
    args: [] as const,
    returns: FFIType.u64,
  },
  PeekMessageW: {
    args: [FFIType.ptr, FFIType.u64, FFIType.u32, FFIType.u32, FFIType.u32] as const,
    returns: FFIType.i32,
  },
  ReleaseDC: {
    args: [FFIType.u64, FFIType.u64] as const,
    returns: FFIType.i32,
  },
  ShowWindow: {
    args: [FFIType.u64, FFIType.i32] as const,
    returns: FFIType.i32,
  },
  TranslateMessage: {
    args: [FFIType.ptr] as const,
    returns: FFIType.i32,
  },
};

function openGdi32() {
  return dlopen('gdi32.dll', GDI32_SYMBOLS);
}

function openUser32() {
  return dlopen('user32.dll', USER32_SYMBOLS);
}

type Gdi32Symbols = ReturnType<typeof openGdi32>['symbols'];
type User32Symbols = ReturnType<typeof openUser32>['symbols'];

export interface LauncherWindowOptions {
  readonly scale: number;
  readonly title: string;
}

export async function runLauncherWindow(session: LauncherSession, options: LauncherWindowOptions): Promise<void> {
  const initialClientSize = computeClientDimensions(options.scale, true);
  const messageBuffer = Buffer.alloc(MSG_SIZE);
  const messageView = new DataView(messageBuffer.buffer, messageBuffer.byteOffset, MSG_SIZE);
  const user32 = openUser32();
  const gdi32 = openGdi32();
  const inputSampler = new AsyncKeyStateSampler(user32.symbols);
  const windowRect = Buffer.alloc(RECT_SIZE);
  const windowRectView = new DataView(windowRect.buffer, windowRect.byteOffset, RECT_SIZE);
  const indexedFrameBuffer = new Uint32Array(SCREENWIDTH * SCREENHEIGHT);
  const indexedFrameBytes = Buffer.from(indexedFrameBuffer.buffer);
  const indexedFrameHeader = buildBitmapInfoHeader(SCREENWIDTH, SCREENHEIGHT);
  const backgroundFillBuffer = new Uint32Array([0xff00_0000]);
  const backgroundFillBytes = Buffer.from(backgroundFillBuffer.buffer);
  const backgroundFillHeader = buildBitmapInfoHeader(1, 1);
  const paletteLookup = buildPaletteLookup(session.palette);
  const windowClassName = Buffer.from('STATIC\0', 'utf16le');
  const windowTitle = Buffer.from(`${options.title}\0`, 'utf16le');
  const clock = new PerformanceClock();
  const accumulator = new TicAccumulator(clock);

  windowRectView.setInt32(0, 0, true);
  windowRectView.setInt32(4, 0, true);
  windowRectView.setInt32(8, initialClientSize.width, true);
  windowRectView.setInt32(12, initialClientSize.height, true);

  if (user32.symbols.AdjustWindowRect(windowRect.ptr, WINDOW_STYLE, 0) === 0) {
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
      while (user32.symbols.PeekMessageW(messageBuffer.ptr, 0n, 0, 0, PM_REMOVE) !== 0) {
        const message = messageView.getUint32(MSG_MESSAGE_OFFSET, true);

        if (message === WM_CLOSE) {
          void user32.symbols.DestroyWindow(windowHandle);
          windowDestroyed = true;
          return;
        }

        if (message === WM_DESTROY || message === WM_QUIT) {
          windowDestroyed = true;
          return;
        }

        void user32.symbols.TranslateMessage(messageBuffer.ptr);
        void user32.symbols.DispatchMessageW(messageBuffer.ptr);
      }

      const sampledInput = inputSampler.sample(windowHandle);

      if (sampledInput.quitRequested) {
        void user32.symbols.DestroyWindow(windowHandle);
        windowDestroyed = true;
        return;
      }

      const newTics = accumulator.advance();

      if (newTics > 0) {
        const heldInput = {
          ...sampledInput,
          quitRequested: false,
          toggleMap: false,
          toggleFollow: false,
        };

        advanceLauncherSession(session, sampledInput);

        for (let ticIndex = 1; ticIndex < newTics; ticIndex += 1) {
          advanceLauncherSession(session, heldInput);
        }
      }

      renderLauncherFrame(session);
      convertIndexedFrame(session.framebuffer, indexedFrameBuffer, paletteLookup);
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

function presentFrame(user32: User32Symbols, gdi32: Gdi32Symbols, windowHandle: bigint, indexedFrameBytes: Buffer, indexedFrameHeader: Buffer, backgroundFillBytes: Buffer, backgroundFillHeader: Buffer): void {
  const clientRectBuffer = Buffer.alloc(RECT_SIZE);
  const clientRectView = new DataView(clientRectBuffer.buffer, clientRectBuffer.byteOffset, RECT_SIZE);

  const getClientRectResult = user32.GetClientRect(windowHandle, clientRectBuffer.ptr);

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
    void gdi32.StretchDIBits(deviceContext, 0, 0, clientWidth, clientHeight, 0, 0, 1, 1, backgroundFillBytes.ptr, backgroundFillHeader.ptr, DIB_RGB_COLORS, SRCCOPY);

    if (presentationRect.width === 0 || presentationRect.height === 0) {
      return;
    }

    void gdi32.StretchDIBits(deviceContext, presentationRect.x, presentationRect.y, presentationRect.width, presentationRect.height, 0, 0, SCREENWIDTH, SCREENHEIGHT, indexedFrameBytes.ptr, indexedFrameHeader.ptr, DIB_RGB_COLORS, SRCCOPY);
  } finally {
    void user32.ReleaseDC(windowHandle, deviceContext);
  }
}

class AsyncKeyStateSampler {
  #previousStates = new Map<number, boolean>();
  #user32: User32Symbols;

  constructor(user32: User32Symbols) {
    this.#user32 = user32;
  }

  sample(windowHandle: bigint): LauncherInputState {
    const foregroundWindowResult = this.#user32.GetForegroundWindow();

    if (typeof foregroundWindowResult !== 'bigint') {
      throw new TypeError(`GetForegroundWindow returned ${typeof foregroundWindowResult} instead of bigint`);
    }

    const windowIsForeground = foregroundWindowResult === windowHandle;
    const backward = this.#isKeyDown(VK_S, windowIsForeground) || this.#isKeyDown(VK_DOWN, windowIsForeground);
    const forward = this.#isKeyDown(VK_W, windowIsForeground) || this.#isKeyDown(VK_UP, windowIsForeground);
    const quitRequested = this.#isKeyDown(VK_ESCAPE, windowIsForeground);
    const run = this.#isKeyDown(VK_SHIFT, windowIsForeground);
    const strafeLeft = this.#isKeyDown(VK_Q, windowIsForeground);
    const strafeRight = this.#isKeyDown(VK_E, windowIsForeground);
    const toggleMap = this.#wasPressedOnce(VK_TAB, windowIsForeground);
    const toggleFollow = this.#wasPressedOnce(VK_F, windowIsForeground);
    const turnLeft = this.#isKeyDown(VK_A, windowIsForeground) || this.#isKeyDown(VK_LEFT, windowIsForeground);
    const turnRight = this.#isKeyDown(VK_D, windowIsForeground) || this.#isKeyDown(VK_RIGHT, windowIsForeground);
    const zoomIn = this.#isKeyDown(VK_PRIOR, windowIsForeground);
    const zoomOut = this.#isKeyDown(VK_NEXT, windowIsForeground);

    return {
      backward,
      forward,
      quitRequested,
      run,
      strafeLeft,
      strafeRight,
      toggleMap,
      toggleFollow,
      turnLeft,
      turnRight,
      zoomIn,
      zoomOut,
    };
  }

  #isKeyDown(virtualKeyCode: number, windowIsForeground: boolean): boolean {
    if (!windowIsForeground) {
      return false;
    }

    const asyncKeyStateResult = this.#user32.GetAsyncKeyState(virtualKeyCode);

    if (typeof asyncKeyStateResult !== 'number') {
      throw new TypeError(`GetAsyncKeyState returned ${typeof asyncKeyStateResult} instead of number`);
    }

    return (asyncKeyStateResult & 0x8000) !== 0;
  }

  #wasPressedOnce(virtualKeyCode: number, windowIsForeground: boolean): boolean {
    const currentlyPressed = this.#isKeyDown(virtualKeyCode, windowIsForeground);
    const previouslyPressed = this.#previousStates.get(virtualKeyCode) ?? false;

    this.#previousStates.set(virtualKeyCode, currentlyPressed);

    return currentlyPressed && !previouslyPressed;
  }
}
