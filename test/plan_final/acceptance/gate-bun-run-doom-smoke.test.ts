import { FFIType, JSCallback, dlopen, ptr } from 'bun:ffi';
import { describe, expect, test } from 'bun:test';

import { mkdirSync } from 'node:fs';

import { LIVE_REFERENCE_TEST_PATHS, liveReferenceTestsEnabled } from '../../../plan_final/liveReferenceTestConfig.ts';
import { TITLE_LOOP_SMOKE_HOST_CONTRACT } from '../../../src/vanilla/titleLoopSmokeHost.ts';

const CAPTURE_BYTES_PER_PIXEL = 4;
const FINAL_GATE_EVIDENCE_PATH = 'plan_final/final-gates/13-001-bun-run-doom-smoke.json';
const FINAL_GATE_DIRECTORY = 'plan_final/final-gates';
const FIND_WINDOW_POLL_INTERVAL_MS = 50;
const FIND_WINDOW_TIMEOUT_MS = 10_000;
const KILL_WAIT_MS = 5_000;
const LIVE_TEST_PATH = 'test/plan_final/acceptance/gate-bun-run-doom-smoke.test.ts';
const RECT_BYTE_LENGTH = 16;
const SETTLE_AFTER_WINDOW_FOUND_MS = 750;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const SMOKE_COMMAND = Object.freeze(['bun', 'run', 'doom.ts', '-iwad', 'doom/DOOM1.WAD']);

const USER32_WINDOW_DISCOVERY_SYMBOLS = {
  EnumWindows: {
    args: [FFIType.ptr, FFIType.i64],
    returns: FFIType.i32,
  },
  GetWindowTextLengthW: {
    args: [FFIType.u64],
    returns: FFIType.i32,
  },
  GetWindowTextW: {
    args: [FFIType.u64, FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
  GetWindowThreadProcessId: {
    args: [FFIType.u64, FFIType.ptr],
    returns: FFIType.u32,
  },
  IsWindowVisible: {
    args: [FFIType.u64],
    returns: FFIType.i32,
  },
} as const;

const USER32_CAPTURE_SYMBOLS = {
  GetClientRect: { args: [FFIType.u64, FFIType.ptr] as const, returns: FFIType.i32 },
  GetDC: { args: [FFIType.u64] as const, returns: FFIType.u64 },
  ReleaseDC: { args: [FFIType.u64, FFIType.u64] as const, returns: FFIType.i32 },
} as const;

const GDI32_CAPTURE_SYMBOLS = {
  BitBlt: {
    args: [FFIType.u64, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.u64, FFIType.i32, FFIType.i32, FFIType.u32] as const,
    returns: FFIType.i32,
  },
  CreateCompatibleBitmap: { args: [FFIType.u64, FFIType.i32, FFIType.i32] as const, returns: FFIType.u64 },
  CreateCompatibleDC: { args: [FFIType.u64] as const, returns: FFIType.u64 },
  DeleteDC: { args: [FFIType.u64] as const, returns: FFIType.i32 },
  DeleteObject: { args: [FFIType.u64] as const, returns: FFIType.i32 },
  GetDIBits: {
    args: [FFIType.u64, FFIType.u64, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.ptr, FFIType.u32] as const,
    returns: FFIType.i32,
  },
  SelectObject: { args: [FFIType.u64, FFIType.u64] as const, returns: FFIType.u64 },
} as const;

const BI_RGB = 0;
const DIB_RGB_COLORS = 0;
const SRCCOPY = 0x00cc_0020;

const liveAcceptanceTest = liveReferenceTestsEnabled() ? test : test.skip;

interface CapturedClientArea {
  readonly height: number;
  readonly pixels: Buffer;
  readonly width: number;
}

interface DiscoveredProcessWindow {
  readonly handle: bigint;
  readonly title: string;
}

interface BunRunDoomTitleFrameEvidence {
  readonly capturedByteLength: number;
  readonly capturedHeight: number;
  readonly capturedSha256: string;
  readonly capturedWidth: number;
  readonly command: readonly string[];
  readonly exitCodeAfterKill: number | null;
  readonly nonBlackPixelCount: number;
  readonly stderrText: string;
  readonly stdoutText: string;
  readonly uniqueColorCount: number;
  readonly windowTitle: string;
}

function buildBitmapInfoHeader(width: number, height: number): Buffer {
  const bitmapInfoHeader = Buffer.alloc(40);
  bitmapInfoHeader.writeUInt32LE(40, 0);
  bitmapInfoHeader.writeInt32LE(width, 4);
  bitmapInfoHeader.writeInt32LE(-height, 8);
  bitmapInfoHeader.writeUInt16LE(1, 12);
  bitmapInfoHeader.writeUInt16LE(32, 14);
  bitmapInfoHeader.writeUInt32LE(BI_RGB, 16);
  bitmapInfoHeader.writeUInt32LE(width * height * CAPTURE_BYTES_PER_PIXEL, 20);
  return bitmapInfoHeader;
}

function computeSha256Hex(bytes: Buffer): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(bytes);
  return hasher.digest('hex');
}

function countNonBlackPixels(pixels: Buffer): number {
  let nonBlackPixelCount = 0;
  for (let byteOffset = 0; byteOffset < pixels.byteLength; byteOffset += CAPTURE_BYTES_PER_PIXEL) {
    if (pixels[byteOffset] !== 0 || pixels[byteOffset + 1] !== 0 || pixels[byteOffset + 2] !== 0) {
      nonBlackPixelCount += 1;
    }
  }
  return nonBlackPixelCount;
}

function countUniqueColors(pixels: Buffer): number {
  const colors = new Set<number>();
  for (let byteOffset = 0; byteOffset < pixels.byteLength; byteOffset += CAPTURE_BYTES_PER_PIXEL) {
    colors.add(pixels[byteOffset]! | (pixels[byteOffset + 1]! << 8) | (pixels[byteOffset + 2]! << 16));
    if (colors.size > 16) {
      return colors.size;
    }
  }
  return colors.size;
}

function readWindowTitle(user32DiscoverySymbols: ReturnType<typeof dlopen<typeof USER32_WINDOW_DISCOVERY_SYMBOLS>>['symbols'], windowHandle: bigint): string {
  const titleLength = user32DiscoverySymbols.GetWindowTextLengthW(windowHandle);
  if (titleLength <= 0) {
    return '';
  }

  const titleBuffer = Buffer.alloc((titleLength + 1) * 2);
  const charactersCopied = user32DiscoverySymbols.GetWindowTextW(windowHandle, ptr(titleBuffer), titleLength + 1);
  if (charactersCopied <= 0) {
    return '';
  }

  return titleBuffer.toString('utf16le', 0, charactersCopied * 2);
}

function findProcessWindowOnce(user32DiscoverySymbols: ReturnType<typeof dlopen<typeof USER32_WINDOW_DISCOVERY_SYMBOLS>>['symbols'], targetProcessIdentifier: number, titleSubstring: string): DiscoveredProcessWindow | null {
  let discoveredWindow: DiscoveredProcessWindow | null = null;
  const processIdentifierBuffer = Buffer.alloc(4);

  const enumCallback = new JSCallback(
    (windowHandle: bigint) => {
      if (discoveredWindow !== null) {
        return 0;
      }
      if (user32DiscoverySymbols.IsWindowVisible(windowHandle) === 0) {
        return 1;
      }

      user32DiscoverySymbols.GetWindowThreadProcessId(windowHandle, ptr(processIdentifierBuffer));
      const ownerProcessIdentifier = processIdentifierBuffer.readUInt32LE(0);
      if (ownerProcessIdentifier !== targetProcessIdentifier) {
        return 1;
      }

      const candidateTitle = readWindowTitle(user32DiscoverySymbols, windowHandle);
      if (!candidateTitle.includes(titleSubstring)) {
        return 1;
      }

      discoveredWindow = { handle: windowHandle, title: candidateTitle };
      return 0;
    },
    {
      args: [FFIType.u64, FFIType.i64],
      returns: FFIType.i32,
    },
  );

  try {
    user32DiscoverySymbols.EnumWindows(enumCallback.ptr, 0n);
  } finally {
    enumCallback.close();
  }

  return discoveredWindow;
}

async function pollForProcessWindow(user32DiscoverySymbols: ReturnType<typeof dlopen<typeof USER32_WINDOW_DISCOVERY_SYMBOLS>>['symbols'], targetProcessIdentifier: number, titleSubstring: string): Promise<DiscoveredProcessWindow | null> {
  const startedAt = performance.now();
  while (performance.now() - startedAt < FIND_WINDOW_TIMEOUT_MS) {
    const discoveredWindow = findProcessWindowOnce(user32DiscoverySymbols, targetProcessIdentifier, titleSubstring);
    if (discoveredWindow !== null) {
      return discoveredWindow;
    }
    await Bun.sleep(FIND_WINDOW_POLL_INTERVAL_MS);
  }
  return null;
}

function captureClientAreaPixels(
  user32Symbols: ReturnType<typeof dlopen<typeof USER32_CAPTURE_SYMBOLS>>['symbols'],
  gdi32Symbols: ReturnType<typeof dlopen<typeof GDI32_CAPTURE_SYMBOLS>>['symbols'],
  windowHandle: bigint,
): CapturedClientArea {
  const rectBuffer = Buffer.alloc(RECT_BYTE_LENGTH);
  if (user32Symbols.GetClientRect(windowHandle, ptr(rectBuffer)) === 0) {
    throw new Error('GetClientRect failed for the bun run doom.ts window');
  }

  const width = rectBuffer.readInt32LE(8) - rectBuffer.readInt32LE(0);
  const height = rectBuffer.readInt32LE(12) - rectBuffer.readInt32LE(4);
  if (width <= 0 || height <= 0) {
    throw new Error(`bun run doom.ts window client area has non-positive dimensions: ${width}x${height}`);
  }

  const windowDeviceContext = user32Symbols.GetDC(windowHandle);
  if (windowDeviceContext === 0n) {
    throw new Error('GetDC failed for the bun run doom.ts window');
  }

  try {
    const memoryDeviceContext = gdi32Symbols.CreateCompatibleDC(windowDeviceContext);
    if (memoryDeviceContext === 0n) {
      throw new Error('CreateCompatibleDC returned NULL');
    }

    try {
      const bitmapHandle = gdi32Symbols.CreateCompatibleBitmap(windowDeviceContext, width, height);
      if (bitmapHandle === 0n) {
        throw new Error('CreateCompatibleBitmap returned NULL');
      }

      try {
        const previousBitmapHandle = gdi32Symbols.SelectObject(memoryDeviceContext, bitmapHandle);
        if (previousBitmapHandle === 0n) {
          throw new Error('SelectObject returned NULL');
        }

        try {
          if (gdi32Symbols.BitBlt(memoryDeviceContext, 0, 0, width, height, windowDeviceContext, 0, 0, SRCCOPY) === 0) {
            throw new Error('BitBlt failed');
          }

          const bitmapInfoHeader = buildBitmapInfoHeader(width, height);
          const pixels = Buffer.alloc(width * height * CAPTURE_BYTES_PER_PIXEL);
          const scanLinesRead = gdi32Symbols.GetDIBits(windowDeviceContext, bitmapHandle, 0, height, ptr(pixels), ptr(bitmapInfoHeader), DIB_RGB_COLORS);
          if (scanLinesRead !== height) {
            throw new Error(`GetDIBits read ${scanLinesRead} scan lines, expected ${height}`);
          }

          return { height, pixels, width };
        } finally {
          gdi32Symbols.SelectObject(memoryDeviceContext, previousBitmapHandle);
        }
      } finally {
        gdi32Symbols.DeleteObject(bitmapHandle);
      }
    } finally {
      gdi32Symbols.DeleteDC(memoryDeviceContext);
    }
  } finally {
    user32Symbols.ReleaseDC(windowHandle, windowDeviceContext);
  }
}

async function captureBunRunDoomTitleFrame(): Promise<BunRunDoomTitleFrameEvidence> {
  const user32Discovery = dlopen('user32.dll', USER32_WINDOW_DISCOVERY_SYMBOLS);
  const user32Capture = dlopen('user32.dll', USER32_CAPTURE_SYMBOLS);
  const gdi32Capture = dlopen('gdi32.dll', GDI32_CAPTURE_SYMBOLS);
  const subprocess = Bun.spawn({
    cmd: [...SMOKE_COMMAND],
    cwd: process.cwd(),
    stderr: 'pipe',
    stdin: 'ignore',
    stdout: 'pipe',
  });
  const stdoutTextPromise = new Response(subprocess.stdout).text();
  const stderrTextPromise = new Response(subprocess.stderr).text();

  try {
    const discoveredWindow = await pollForProcessWindow(user32Discovery.symbols, subprocess.pid, TITLE_LOOP_SMOKE_HOST_CONTRACT.windowTitle);
    if (discoveredWindow === null) {
      throw new Error(`bun run doom.ts window "${TITLE_LOOP_SMOKE_HOST_CONTRACT.windowTitle}" was not found within ${FIND_WINDOW_TIMEOUT_MS}ms`);
    }

    await Bun.sleep(SETTLE_AFTER_WINDOW_FOUND_MS);
    const capturedClientArea = captureClientAreaPixels(user32Capture.symbols, gdi32Capture.symbols, discoveredWindow.handle);

    if (subprocess.exitCode === null) {
      subprocess.kill();
    }

    await Promise.race([subprocess.exited, Bun.sleep(KILL_WAIT_MS).then(() => null)]);
    const [stdoutText, stderrText] = await Promise.all([stdoutTextPromise, stderrTextPromise]);

    return Object.freeze({
      capturedByteLength: capturedClientArea.pixels.byteLength,
      capturedHeight: capturedClientArea.height,
      capturedSha256: computeSha256Hex(capturedClientArea.pixels),
      capturedWidth: capturedClientArea.width,
      command: SMOKE_COMMAND,
      exitCodeAfterKill: subprocess.exitCode,
      nonBlackPixelCount: countNonBlackPixels(capturedClientArea.pixels),
      stderrText,
      stdoutText,
      uniqueColorCount: countUniqueColors(capturedClientArea.pixels),
      windowTitle: discoveredWindow.title,
    });
  } finally {
    if (subprocess.exitCode === null) {
      subprocess.kill();
      await Promise.race([subprocess.exited, Bun.sleep(KILL_WAIT_MS).then(() => null)]);
    }
    gdi32Capture.close();
    user32Capture.close();
    user32Discovery.close();
  }
}

describe('plan_final acceptance: gate-bun-run-doom-smoke', () => {
  test('the focused acceptance gate is registered for serialized live-reference execution', () => {
    expect(LIVE_REFERENCE_TEST_PATHS).toContain(LIVE_TEST_PATH);
  });

  test('the root smoke host pins the title-loop page and runtime command used by this gate', () => {
    expect(TITLE_LOOP_SMOKE_HOST_CONTRACT).toEqual({
      pageLumpName: 'TITLEPIC',
      runtimeCommand: 'bun run doom.ts',
      windowTitle: 'DOOM Codex - TITLEPIC',
    });
  });

  liveAcceptanceTest(
    'launches bun run doom.ts against the local DOOM1.WAD and captures a nonblank title-loop frame',
    async () => {
      const evidence = await captureBunRunDoomTitleFrame();

      expect(evidence.command).toEqual(SMOKE_COMMAND);
      expect(evidence.windowTitle).toContain(TITLE_LOOP_SMOKE_HOST_CONTRACT.windowTitle);
      expect(evidence.capturedWidth).toBeGreaterThan(0);
      expect(evidence.capturedHeight).toBeGreaterThan(0);
      expect(evidence.capturedByteLength).toBe(evidence.capturedWidth * evidence.capturedHeight * CAPTURE_BYTES_PER_PIXEL);
      expect(SHA256_HEX_REGEX.test(evidence.capturedSha256)).toBe(true);
      expect(evidence.uniqueColorCount).toBeGreaterThan(1);
      expect(evidence.nonBlackPixelCount).toBeGreaterThan(0);
      expect(evidence.stderrText).toBe('');

      mkdirSync(FINAL_GATE_DIRECTORY, { recursive: true });
      await Bun.write(
        FINAL_GATE_EVIDENCE_PATH,
        `${JSON.stringify(
          {
            ...evidence,
            knownFailures: [],
            stepId: '13-001',
          },
          null,
          2,
        )}\n`,
      );
    },
    60_000,
  );
});
