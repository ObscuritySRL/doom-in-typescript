import { FFIType, JSCallback, dlopen, ptr } from 'bun:ffi';
import { describe, expect, test } from 'bun:test';

import { mkdirSync, rmSync } from 'node:fs';

import { LIVE_REFERENCE_TEST_PATHS, liveReferenceTestsEnabled } from '../../../plan_final/liveReferenceTestConfig.ts';
import { TITLE_LOOP_SMOKE_HOST_CONTRACT } from '../../../src/vanilla/titleLoopSmokeHost.ts';
import type { MenuRouteKeyStep, ReferenceMenuRouteEvidence } from '../../../tools/reference/captureReferenceMenuRoute.ts';
import { MENU_ROUTE_KEY_STEPS, captureReferenceMenuRoute, normalizeToInternalFramebuffer } from '../../../tools/reference/captureReferenceMenuRoute.ts';

const CAPTURE_BYTES_PER_PIXEL = 4;
const CONTROL_FILE_ENVIRONMENT_VARIABLE = 'DOOM_TITLE_MENU_SMOKE_CONTROL_PATH';
const CURRENT_COMMAND = Object.freeze(['bun', 'run', 'doom.ts', '-iwad', 'doom/DOOM1.WAD']);
const FINAL_GATE_DIRECTORY = 'plan_final/final-gates';
const FINAL_GATE_EVIDENCE_PATH = 'plan_final/final-gates/13-002-title-menu-parity.json';
const FIND_WINDOW_POLL_INTERVAL_MS = 50;
const FIND_WINDOW_TIMEOUT_MS = 10_000;
const FRAME_MATCH_POLL_INTERVAL_MS = 25;
const FRAME_MATCH_TIMEOUT_MS = 1_000;
const KILL_WAIT_MS = 5_000;
const LIVE_TEST_PATH = 'test/plan_final/acceptance/gate-title-menu-parity.test.ts';
const NORMALIZED_FRAMEBUFFER_BYTE_LENGTH = 320 * 200 * CAPTURE_BYTES_PER_PIXEL;
const RECT_BYTE_LENGTH = 16;
const ROUTE_STEP_COUNT = 2;
const SETTLE_AFTER_KEY_MS = 400;
const SETTLE_AFTER_WINDOW_FOUND_MS = 750;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

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

const USER32_INPUT_SYMBOLS = {
  SetForegroundWindow: {
    args: [FFIType.u64],
    returns: FFIType.i32,
  },
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

interface CurrentRouteStepEvidence {
  readonly expectedMenuState: string;
  readonly framebufferByteLength: number;
  readonly framebufferSha256: string;
  readonly matchedExpectedNormalizedSha256: boolean;
  readonly normalizedByteLength: number;
  readonly normalizedSha256: string;
  readonly stepIndex: number;
  readonly virtualKeyCode: number;
  readonly virtualKeyName: string;
}

interface CurrentTitleMenuRouteEvidence {
  readonly command: readonly string[];
  readonly exitCodeAfterKill: number | null;
  readonly framebufferHeight: number;
  readonly framebufferWidth: number;
  readonly stderrText: string;
  readonly steps: readonly CurrentRouteStepEvidence[];
  readonly stdoutText: string;
  readonly titleFrameNormalizedSha256: string;
  readonly titleFrameSha256: string;
  readonly windowTitle: string;
}

interface DiscoveredProcessWindow {
  readonly handle: bigint;
  readonly title: string;
}

interface FrameComparison {
  readonly currentNormalizedSha256: string;
  readonly label: string;
  readonly referenceNormalizedSha256: string;
  readonly zeroDiff: boolean;
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

function createRouteStepEvidence(step: MenuRouteKeyStep, stepIndex: number, capturedClientArea: CapturedClientArea, expectedNormalizedSha256: string | null): CurrentRouteStepEvidence {
  const normalized = normalizeToInternalFramebuffer(capturedClientArea.pixels, capturedClientArea.width, capturedClientArea.height);
  const normalizedSha256 = computeSha256Hex(normalized);

  return Object.freeze({
    expectedMenuState: step.expectedMenuState,
    framebufferByteLength: capturedClientArea.pixels.byteLength,
    framebufferSha256: computeSha256Hex(capturedClientArea.pixels),
    matchedExpectedNormalizedSha256: expectedNormalizedSha256 !== null && normalizedSha256 === expectedNormalizedSha256,
    normalizedByteLength: normalized.byteLength,
    normalizedSha256,
    stepIndex,
    virtualKeyCode: step.virtualKeyCode,
    virtualKeyName: step.virtualKeyName,
  });
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

function createControlFilePath(): string {
  return `${FINAL_GATE_DIRECTORY}/13-002-title-menu-control.txt`;
}

function routeStepControlCommand(stepIndex: number): 'enter' | 'escape' {
  return stepIndex === 0 ? 'escape' : 'enter';
}

async function captureCurrentTitleMenuRoute(expectedStepNormalizedHashes: readonly string[]): Promise<CurrentTitleMenuRouteEvidence> {
  const controlFilePath = createControlFilePath();
  mkdirSync(FINAL_GATE_DIRECTORY, { recursive: true });
  const user32Discovery = dlopen('user32.dll', USER32_WINDOW_DISCOVERY_SYMBOLS);
  const user32Capture = dlopen('user32.dll', USER32_CAPTURE_SYMBOLS);
  const user32Input = dlopen('user32.dll', USER32_INPUT_SYMBOLS);
  const gdi32Capture = dlopen('gdi32.dll', GDI32_CAPTURE_SYMBOLS);
  const subprocess = Bun.spawn({
    cmd: [...CURRENT_COMMAND],
    cwd: process.cwd(),
    env: {
      ...Bun.env,
      [CONTROL_FILE_ENVIRONMENT_VARIABLE]: controlFilePath,
    },
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

    user32Input.symbols.SetForegroundWindow(discoveredWindow.handle);
    await Bun.sleep(SETTLE_AFTER_WINDOW_FOUND_MS);

    const titleFrame = captureClientAreaPixels(user32Capture.symbols, gdi32Capture.symbols, discoveredWindow.handle);
    const titleFrameNormalized = normalizeToInternalFramebuffer(titleFrame.pixels, titleFrame.width, titleFrame.height);

    const steps: CurrentRouteStepEvidence[] = [];
    for (let stepIndex = 0; stepIndex < ROUTE_STEP_COUNT; stepIndex += 1) {
      const routeStep = MENU_ROUTE_KEY_STEPS[stepIndex]!;
      const expectedStepNormalizedSha256 = expectedStepNormalizedHashes[stepIndex] ?? null;

      user32Input.symbols.SetForegroundWindow(discoveredWindow.handle);
      await Bun.write(controlFilePath, `${routeStepControlCommand(stepIndex)}\n`);
      await Bun.sleep(SETTLE_AFTER_KEY_MS);

      const matchStartedAt = performance.now();
      let stepEvidence: CurrentRouteStepEvidence | null = null;
      while (true) {
        const stepFrame = captureClientAreaPixels(user32Capture.symbols, gdi32Capture.symbols, discoveredWindow.handle);
        stepEvidence = createRouteStepEvidence(routeStep, stepIndex, stepFrame, expectedStepNormalizedSha256);
        if (stepEvidence.matchedExpectedNormalizedSha256 || performance.now() - matchStartedAt >= FRAME_MATCH_TIMEOUT_MS) {
          break;
        }
        await Bun.sleep(FRAME_MATCH_POLL_INTERVAL_MS);
      }

      steps.push(stepEvidence);
    }

    if (subprocess.exitCode === null) {
      subprocess.kill();
    }

    await Promise.race([subprocess.exited, Bun.sleep(KILL_WAIT_MS).then(() => null)]);
    const [stdoutText, stderrText] = await Promise.all([stdoutTextPromise, stderrTextPromise]);

    return Object.freeze({
      command: CURRENT_COMMAND,
      exitCodeAfterKill: subprocess.exitCode,
      framebufferHeight: titleFrame.height,
      framebufferWidth: titleFrame.width,
      stderrText,
      steps: Object.freeze(steps),
      stdoutText,
      titleFrameNormalizedSha256: computeSha256Hex(titleFrameNormalized),
      titleFrameSha256: computeSha256Hex(titleFrame.pixels),
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
    user32Input.close();
    rmSync(controlFilePath, { force: true });
  }
}

function buildFrameComparisons(referenceEvidence: ReferenceMenuRouteEvidence, currentEvidence: CurrentTitleMenuRouteEvidence): readonly FrameComparison[] {
  return Object.freeze([
    Object.freeze({
      currentNormalizedSha256: currentEvidence.titleFrameNormalizedSha256,
      label: 'title-attract',
      referenceNormalizedSha256: referenceEvidence.titleFrameNormalizedSha256,
      zeroDiff: currentEvidence.titleFrameNormalizedSha256 === referenceEvidence.titleFrameNormalizedSha256,
    }),
    Object.freeze({
      currentNormalizedSha256: currentEvidence.steps[0]!.normalizedSha256,
      label: referenceEvidence.steps[0]!.expectedMenuState,
      referenceNormalizedSha256: referenceEvidence.steps[0]!.normalizedSha256,
      zeroDiff: currentEvidence.steps[0]!.normalizedSha256 === referenceEvidence.steps[0]!.normalizedSha256,
    }),
    Object.freeze({
      currentNormalizedSha256: currentEvidence.steps[1]!.normalizedSha256,
      label: referenceEvidence.steps[1]!.expectedMenuState,
      referenceNormalizedSha256: referenceEvidence.steps[1]!.normalizedSha256,
      zeroDiff: currentEvidence.steps[1]!.normalizedSha256 === referenceEvidence.steps[1]!.normalizedSha256,
    }),
  ]);
}

function findFrameDifferences(comparisons: readonly FrameComparison[]): readonly FrameComparison[] {
  return Object.freeze(comparisons.filter((comparison) => !comparison.zeroDiff));
}

describe('plan_final acceptance: gate-title-menu-parity', () => {
  test('the focused acceptance gate is registered for serialized live-reference execution', () => {
    expect(LIVE_REFERENCE_TEST_PATHS).toContain(LIVE_TEST_PATH);
  });

  test('the acceptance route uses the reference title, main-menu, and episode-menu steps', () => {
    expect(TITLE_LOOP_SMOKE_HOST_CONTRACT).toEqual({
      pageLumpName: 'TITLEPIC',
      runtimeCommand: 'bun run doom.ts',
      windowTitle: 'DOOM Codex - TITLEPIC',
    });
    expect(MENU_ROUTE_KEY_STEPS.slice(0, ROUTE_STEP_COUNT).map((step) => step.expectedMenuState)).toEqual(['main-menu', 'episode-menu']);
  });

  liveAcceptanceTest(
    'captures current title-to-episode route and matches live Chocolate Doom normalized frame hashes',
    async () => {
      const referenceEvidence = await captureReferenceMenuRoute({
        findWindowTimeoutMs: 30_000,
        killWaitMs: 8_000,
        settleAfterKeyMs: SETTLE_AFTER_KEY_MS,
        settleAfterWindowFoundMs: SETTLE_AFTER_WINDOW_FOUND_MS,
      });
      const currentEvidence = await captureCurrentTitleMenuRoute(referenceEvidence.steps.slice(0, ROUTE_STEP_COUNT).map((step) => step.normalizedSha256));
      const frameComparisons = buildFrameComparisons(referenceEvidence, currentEvidence);
      const framebufferDifferences = findFrameDifferences(frameComparisons);

      expect(currentEvidence.command).toEqual(CURRENT_COMMAND);
      expect(currentEvidence.windowTitle).toContain(TITLE_LOOP_SMOKE_HOST_CONTRACT.windowTitle);
      expect(currentEvidence.stderrText).toBe('');
      expect(currentEvidence.framebufferWidth).toBeGreaterThan(0);
      expect(currentEvidence.framebufferHeight).toBeGreaterThan(0);
      expect(SHA256_HEX_REGEX.test(currentEvidence.titleFrameSha256)).toBe(true);
      expect(SHA256_HEX_REGEX.test(currentEvidence.titleFrameNormalizedSha256)).toBe(true);
      expect(currentEvidence.steps.length).toBe(ROUTE_STEP_COUNT);

      for (const step of currentEvidence.steps) {
        expect(step.framebufferByteLength).toBe(currentEvidence.framebufferWidth * currentEvidence.framebufferHeight * CAPTURE_BYTES_PER_PIXEL);
        expect(step.matchedExpectedNormalizedSha256).toBe(true);
        expect(step.normalizedByteLength).toBe(NORMALIZED_FRAMEBUFFER_BYTE_LENGTH);
        expect(SHA256_HEX_REGEX.test(step.framebufferSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(step.normalizedSha256)).toBe(true);
      }

      expect(framebufferDifferences).toEqual([]);

      mkdirSync(FINAL_GATE_DIRECTORY, { recursive: true });
      await Bun.write(
        FINAL_GATE_EVIDENCE_PATH,
        `${JSON.stringify(
          {
            audioDifferences: [],
            current: currentEvidence,
            framebufferComparisons: frameComparisons,
            framebufferDifferences,
            knownFailures: [],
            musicDifferences: [],
            reference: {
              executableFilename: referenceEvidence.executableFilename,
              steps: referenceEvidence.steps.slice(0, ROUTE_STEP_COUNT),
              titleFrameNormalizedSha256: referenceEvidence.titleFrameNormalizedSha256,
              titleFrameSha256: referenceEvidence.titleFrameSha256,
              windowTitle: referenceEvidence.windowTitle,
            },
            stateDifferences: [],
            stepId: '13-002',
          },
          null,
          2,
        )}\n`,
      );
    },
    180_000,
  );
});
