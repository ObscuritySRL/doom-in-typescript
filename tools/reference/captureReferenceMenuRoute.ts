import { dlopen, FFIType, JSCallback, ptr } from 'bun:ffi';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createReferenceSandbox, destroyReferenceSandbox } from './createReferenceSandbox.ts';
import { ReferenceBundleMissingError } from './launchReferenceCleanly.ts';
import { buildBitmapInfoHeader, CAPTURE_BYTES_PER_PIXEL, CHOCOLATE_DOOM_WINDOW_TITLE, DIB_RGB_COLORS, GDI32_CAPTURE_SYMBOLS, SRCCOPY, USER32_CAPTURE_SYMBOLS } from './windowCaptureProbe.ts';

const FIND_WINDOW_POLL_INTERVAL_MS_DEFAULT = 50;
const FIND_WINDOW_TIMEOUT_MS_DEFAULT = 15_000;
const KILL_WAIT_MS_DEFAULT = 8_000;
const NORMALIZED_INTERNAL_HEIGHT = 200;
const NORMALIZED_INTERNAL_WIDTH = 320;
const RECT_BYTE_LENGTH = 16;
const SETTLE_AFTER_WINDOW_FOUND_MS_DEFAULT = 1_500;
const SETTLE_AFTER_KEY_MS_DEFAULT = 400;

const VK_RETURN = 0x0d;
const VK_ESCAPE = 0x1b;

const WM_KEYDOWN = 0x0100;
const WM_KEYUP = 0x0101;

const KEYDOWN_LPARAM = 1n;
const KEYUP_LPARAM = 0xc000_0001n;

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

const USER32_INPUT_SYMBOLS = {
  PostMessageW: {
    args: [FFIType.u64, FFIType.u32, FFIType.u64, FFIType.u64],
    returns: FFIType.i32,
  },
  SetForegroundWindow: {
    args: [FFIType.u64],
    returns: FFIType.i32,
  },
} as const;

export interface MenuRouteKeyStep {
  readonly description: string;
  readonly expectedMenuState: string;
  readonly virtualKeyCode: number;
  readonly virtualKeyName: string;
}

export const MENU_ROUTE_KEY_STEPS: readonly MenuRouteKeyStep[] = Object.freeze([
  Object.freeze({
    description: 'Escape from title attract → Main Menu (default selection: New Game)',
    expectedMenuState: 'main-menu',
    virtualKeyCode: VK_ESCAPE,
    virtualKeyName: 'VK_ESCAPE',
  }),
  Object.freeze({
    description: 'Enter on Main Menu → Episode Menu (default selection: Knee-Deep in the Dead)',
    expectedMenuState: 'episode-menu',
    virtualKeyCode: VK_RETURN,
    virtualKeyName: 'VK_RETURN',
  }),
  Object.freeze({
    description: 'Enter on Episode Menu → Skill Menu (default selection: Hurt Me Plenty)',
    expectedMenuState: 'skill-menu',
    virtualKeyCode: VK_RETURN,
    virtualKeyName: 'VK_RETURN',
  }),
  Object.freeze({
    description: 'Enter on Skill Menu → E1M1 spawn (Hurt Me Plenty selected by default)',
    expectedMenuState: 'gameplay-e1m1',
    virtualKeyCode: VK_RETURN,
    virtualKeyName: 'VK_RETURN',
  }),
] satisfies readonly MenuRouteKeyStep[]);

export type ReferenceMenuRouteTerminationCause = 'natural-exit' | 'sandbox-killed';

export interface MenuRouteStepEvidence {
  readonly capturedAtElapsedMs: number;
  readonly description: string;
  readonly expectedMenuState: string;
  readonly framebufferByteLength: number;
  readonly framebufferSha256: string;
  readonly normalizedByteLength: number;
  readonly normalizedSha256: string;
  readonly stepIndex: number;
  readonly virtualKeyCode: number;
  readonly virtualKeyName: string;
}

export interface ReferenceMenuRouteEvidence {
  readonly cleanShutdown: boolean;
  readonly executableFilename: string;
  readonly exitCode: number | null;
  readonly exitedAtElapsedMs: number;
  readonly framebufferHeight: number;
  readonly framebufferWidth: number;
  readonly killedAtElapsedMs: number;
  readonly sandboxAbsolutePath: string;
  readonly sandboxId: string;
  readonly spawnedAtElapsedMs: number;
  readonly steps: readonly MenuRouteStepEvidence[];
  readonly terminationCause: ReferenceMenuRouteTerminationCause;
  readonly titleFrameCapturedAtElapsedMs: number;
  readonly titleFrameNormalizedSha256: string;
  readonly titleFrameSha256: string;
  readonly totalElapsedMs: number;
  readonly windowFoundAtElapsedMs: number;
  readonly windowTitle: string;
}

/**
 * Opt-in stabilization for the final route step (skill → gameplay).
 *
 * The final keypress triggers a level load followed by Chocolate Doom's
 * RNG-driven screen-melt wipe. A single capture a fixed delay after the
 * keypress samples an uncontrolled moment of that animated transition, so
 * the captured frame hash is non-deterministic run-to-run. When this
 * override is supplied, the final step is captured repeatedly until the
 * normalized frame hash is identical for `requiredStableSamples`
 * consecutive polls (the wipe has completed and the view has settled to
 * its static post-load state) or `maxAdditionalWaitMs` elapses.
 *
 * Absent this override, behavior is unchanged: every step is captured
 * exactly once after `settleAfterKeyMs`. Menu-only consumers (e.g. the
 * 13-002 title-menu gate) are unaffected.
 */
export interface FinalStepStabilization {
  readonly maxAdditionalWaitMs: number;
  readonly pollIntervalMs: number;
  readonly requiredStableSamples: number;
}

export interface CaptureReferenceMenuRouteOverrides {
  readonly executableFilename?: string;
  readonly finalStepStabilization?: FinalStepStabilization;
  readonly findWindowPollIntervalMs?: number;
  readonly findWindowTimeoutMs?: number;
  readonly killWaitMs?: number;
  readonly sandboxIdOverride?: string;
  readonly settleAfterKeyMs?: number;
  readonly settleAfterWindowFoundMs?: number;
}

export class ReferenceMenuRouteWindowNotFoundError extends Error {
  public constructor(windowTitle: string, timeoutMs: number) {
    super(`Reference window with title containing "${windowTitle}" was not found within ${timeoutMs}ms`);
    this.name = 'ReferenceMenuRouteWindowNotFoundError';
  }
}

function nowMs(): number {
  return performance.now();
}

async function sleepMs(durationMs: number): Promise<void> {
  await Bun.sleep(durationMs);
}

function computeSha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function normalizeToInternalFramebuffer(pixels: Buffer, sourceWidth: number, sourceHeight: number): Buffer {
  if (!Number.isInteger(sourceWidth) || sourceWidth <= 0) {
    throw new RangeError(`sourceWidth must be a positive integer, got ${sourceWidth}`);
  }
  if (!Number.isInteger(sourceHeight) || sourceHeight <= 0) {
    throw new RangeError(`sourceHeight must be a positive integer, got ${sourceHeight}`);
  }
  const expectedSourceByteLength = sourceWidth * sourceHeight * CAPTURE_BYTES_PER_PIXEL;
  if (pixels.byteLength !== expectedSourceByteLength) {
    throw new RangeError(`pixels.byteLength=${pixels.byteLength} does not match sourceWidth*sourceHeight*${CAPTURE_BYTES_PER_PIXEL}=${expectedSourceByteLength}`);
  }

  const output = Buffer.alloc(NORMALIZED_INTERNAL_WIDTH * NORMALIZED_INTERNAL_HEIGHT * CAPTURE_BYTES_PER_PIXEL);
  for (let targetY = 0; targetY < NORMALIZED_INTERNAL_HEIGHT; targetY += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((targetY * sourceHeight) / NORMALIZED_INTERNAL_HEIGHT));
    for (let targetX = 0; targetX < NORMALIZED_INTERNAL_WIDTH; targetX += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((targetX * sourceWidth) / NORMALIZED_INTERNAL_WIDTH));
      const sourceOffset = (sourceY * sourceWidth + sourceX) * CAPTURE_BYTES_PER_PIXEL;
      const targetOffset = (targetY * NORMALIZED_INTERNAL_WIDTH + targetX) * CAPTURE_BYTES_PER_PIXEL;
      output[targetOffset] = pixels[sourceOffset]!;
      output[targetOffset + 1] = pixels[sourceOffset + 1]!;
      output[targetOffset + 2] = pixels[sourceOffset + 2]!;
      output[targetOffset + 3] = pixels[sourceOffset + 3]!;
    }
  }
  return output;
}

async function rewriteSandboxConfigForWindowedCapture(sandboxAbsolutePath: string): Promise<void> {
  const configAbsolutePath = path.join(sandboxAbsolutePath, 'chocolate-doom.cfg');
  if (!existsSync(configAbsolutePath)) {
    return;
  }
  const originalText = await readFile(configAbsolutePath, 'utf8');
  const rewrittenText = originalText
    .replace(/^(fullscreen\s+)\d+\s*$/m, '$10')
    .replace(/^(startup_delay\s+)\d+\s*$/m, '$10')
    .replace(/^(show_endoom\s+)\d+\s*$/m, '$10');
  await writeFile(configAbsolutePath, rewrittenText, { encoding: 'utf8' });
}

interface CapturedClientArea {
  readonly height: number;
  readonly pixels: Buffer;
  readonly width: number;
}

interface DiscoveredProcessWindow {
  readonly handle: bigint;
  readonly title: string;
}

function readWindowTitle(user32DiscoverySymbols: ReturnType<typeof dlopen<typeof USER32_WINDOW_DISCOVERY_SYMBOLS>>['symbols'], hWnd: bigint): string {
  const titleLength = user32DiscoverySymbols.GetWindowTextLengthW(hWnd);
  if (titleLength <= 0) {
    return '';
  }
  const titleBuffer = Buffer.alloc((titleLength + 1) * 2);
  const charactersCopied = user32DiscoverySymbols.GetWindowTextW(hWnd, ptr(titleBuffer), titleLength + 1);
  if (charactersCopied <= 0) {
    return '';
  }
  return titleBuffer.toString('utf16le', 0, charactersCopied * 2);
}

function findProcessWindowOnce(user32DiscoverySymbols: ReturnType<typeof dlopen<typeof USER32_WINDOW_DISCOVERY_SYMBOLS>>['symbols'], targetProcessId: number, titleSubstring: string): DiscoveredProcessWindow | null {
  let discovered: DiscoveredProcessWindow | null = null;
  const processIdBuffer = Buffer.alloc(4);

  const enumProc = new JSCallback(
    (hWnd: bigint) => {
      if (discovered !== null) {
        return 0;
      }
      if (user32DiscoverySymbols.IsWindowVisible(hWnd) === 0) {
        return 1;
      }
      user32DiscoverySymbols.GetWindowThreadProcessId(hWnd, ptr(processIdBuffer));
      const ownerProcessId = processIdBuffer.readUInt32LE(0);
      if (ownerProcessId !== targetProcessId) {
        return 1;
      }
      const candidateTitle = readWindowTitle(user32DiscoverySymbols, hWnd);
      if (!candidateTitle.includes(titleSubstring)) {
        return 1;
      }
      discovered = { handle: hWnd, title: candidateTitle };
      return 0;
    },
    {
      args: [FFIType.u64, FFIType.i64],
      returns: FFIType.i32,
    },
  );

  try {
    user32DiscoverySymbols.EnumWindows(enumProc.ptr, 0n);
  } finally {
    enumProc.close();
  }

  return discovered;
}

async function pollForProcessWindow(
  user32DiscoverySymbols: ReturnType<typeof dlopen<typeof USER32_WINDOW_DISCOVERY_SYMBOLS>>['symbols'],
  targetProcessId: number,
  titleSubstring: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<DiscoveredProcessWindow | null> {
  const startElapsedMs = nowMs();
  while (nowMs() - startElapsedMs < timeoutMs) {
    const discovered = findProcessWindowOnce(user32DiscoverySymbols, targetProcessId, titleSubstring);
    if (discovered !== null) {
      return discovered;
    }
    await sleepMs(pollIntervalMs);
  }
  return null;
}

function captureClientAreaPixels(user32Symbols: ReturnType<typeof dlopen<typeof USER32_CAPTURE_SYMBOLS>>['symbols'], gdi32Symbols: ReturnType<typeof dlopen<typeof GDI32_CAPTURE_SYMBOLS>>['symbols'], hWnd: bigint): CapturedClientArea {
  const rectBuffer = Buffer.alloc(RECT_BYTE_LENGTH);
  const clientRectResult = user32Symbols.GetClientRect(hWnd, ptr(rectBuffer));
  if (clientRectResult === 0) {
    throw new Error('GetClientRect failed for the reference window handle');
  }
  const leftCoordinate = rectBuffer.readInt32LE(0);
  const topCoordinate = rectBuffer.readInt32LE(4);
  const rightCoordinate = rectBuffer.readInt32LE(8);
  const bottomCoordinate = rectBuffer.readInt32LE(12);
  const width = rightCoordinate - leftCoordinate;
  const height = bottomCoordinate - topCoordinate;
  if (width <= 0 || height <= 0) {
    throw new Error(`Reference window client area has non-positive dimensions: ${width}x${height}`);
  }

  const hWindowDC = user32Symbols.GetDC(hWnd);
  if (hWindowDC === 0n) {
    throw new Error('GetDC returned NULL for the reference window');
  }

  try {
    const hMemoryDC = gdi32Symbols.CreateCompatibleDC(hWindowDC);
    if (hMemoryDC === 0n) {
      throw new Error('CreateCompatibleDC returned NULL');
    }

    try {
      const hBitmap = gdi32Symbols.CreateCompatibleBitmap(hWindowDC, width, height);
      if (hBitmap === 0n) {
        throw new Error('CreateCompatibleBitmap returned NULL');
      }

      try {
        const hOldBitmap = gdi32Symbols.SelectObject(hMemoryDC, hBitmap);
        if (hOldBitmap === 0n) {
          throw new Error('SelectObject returned NULL');
        }

        try {
          const bitBltResult = gdi32Symbols.BitBlt(hMemoryDC, 0, 0, width, height, hWindowDC, 0, 0, SRCCOPY);
          if (bitBltResult === 0) {
            throw new Error('BitBlt failed');
          }
          const bitmapInfoHeader = buildBitmapInfoHeader(width, height);
          const pixels = Buffer.alloc(width * height * CAPTURE_BYTES_PER_PIXEL);
          const scanLinesRead = gdi32Symbols.GetDIBits(hWindowDC, hBitmap, 0, height, ptr(pixels), ptr(bitmapInfoHeader), DIB_RGB_COLORS);
          if (scanLinesRead !== height) {
            throw new Error(`GetDIBits read ${scanLinesRead} scan lines, expected ${height}`);
          }
          return { height, pixels, width };
        } finally {
          gdi32Symbols.SelectObject(hMemoryDC, hOldBitmap);
        }
      } finally {
        gdi32Symbols.DeleteObject(hBitmap);
      }
    } finally {
      gdi32Symbols.DeleteDC(hMemoryDC);
    }
  } finally {
    user32Symbols.ReleaseDC(hWnd, hWindowDC);
  }
}

async function captureStabilizedClientArea(
  user32Symbols: ReturnType<typeof dlopen<typeof USER32_CAPTURE_SYMBOLS>>['symbols'],
  gdi32Symbols: ReturnType<typeof dlopen<typeof GDI32_CAPTURE_SYMBOLS>>['symbols'],
  hWnd: bigint,
  stabilization: FinalStepStabilization,
): Promise<CapturedClientArea> {
  const startedAtMs = nowMs();
  let stableNormalizedSha256: string | null = null;
  let consecutiveStableSamples = 0;
  let lastCapture = captureClientAreaPixels(user32Symbols, gdi32Symbols, hWnd);

  while (true) {
    lastCapture = captureClientAreaPixels(user32Symbols, gdi32Symbols, hWnd);
    const normalizedSha256 = computeSha256Hex(normalizeToInternalFramebuffer(lastCapture.pixels, lastCapture.width, lastCapture.height));

    if (normalizedSha256 === stableNormalizedSha256) {
      consecutiveStableSamples += 1;
    } else {
      stableNormalizedSha256 = normalizedSha256;
      consecutiveStableSamples = 1;
    }

    if (consecutiveStableSamples >= stabilization.requiredStableSamples) {
      return lastCapture;
    }
    if (nowMs() - startedAtMs >= stabilization.maxAdditionalWaitMs) {
      return lastCapture;
    }
    await sleepMs(stabilization.pollIntervalMs);
  }
}

function postKeyDownUp(user32InputSymbols: ReturnType<typeof dlopen<typeof USER32_INPUT_SYMBOLS>>['symbols'], hWnd: bigint, virtualKeyCode: number): void {
  const downResult = user32InputSymbols.PostMessageW(hWnd, WM_KEYDOWN, BigInt(virtualKeyCode), KEYDOWN_LPARAM);
  if (downResult === 0) {
    throw new Error(`PostMessageW(WM_KEYDOWN, 0x${virtualKeyCode.toString(16)}) failed`);
  }
  const upResult = user32InputSymbols.PostMessageW(hWnd, WM_KEYUP, BigInt(virtualKeyCode), KEYUP_LPARAM);
  if (upResult === 0) {
    throw new Error(`PostMessageW(WM_KEYUP, 0x${virtualKeyCode.toString(16)}) failed`);
  }
}

export async function captureReferenceMenuRoute(overrides: CaptureReferenceMenuRouteOverrides = {}): Promise<ReferenceMenuRouteEvidence> {
  const executableFilename = overrides.executableFilename ?? 'DOOM.EXE';
  const findWindowPollIntervalMs = overrides.findWindowPollIntervalMs ?? FIND_WINDOW_POLL_INTERVAL_MS_DEFAULT;
  const findWindowTimeoutMs = overrides.findWindowTimeoutMs ?? FIND_WINDOW_TIMEOUT_MS_DEFAULT;
  const killWaitMs = overrides.killWaitMs ?? KILL_WAIT_MS_DEFAULT;
  const settleAfterKeyMs = overrides.settleAfterKeyMs ?? SETTLE_AFTER_KEY_MS_DEFAULT;
  const settleAfterWindowFoundMs = overrides.settleAfterWindowFoundMs ?? SETTLE_AFTER_WINDOW_FOUND_MS_DEFAULT;

  const sandbox = await createReferenceSandbox({ sandboxIdOverride: overrides.sandboxIdOverride });
  const executableAbsolutePath = path.join(sandbox.sandboxAbsolutePath, executableFilename);

  if (!existsSync(executableAbsolutePath)) {
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
    throw new ReferenceBundleMissingError(executableAbsolutePath);
  }

  await rewriteSandboxConfigForWindowedCapture(sandbox.sandboxAbsolutePath);

  const user32 = dlopen('user32.dll', USER32_CAPTURE_SYMBOLS);
  let user32Discovery;
  let user32Input;
  let gdi32;
  try {
    user32Discovery = dlopen('user32.dll', USER32_WINDOW_DISCOVERY_SYMBOLS);
    user32Input = dlopen('user32.dll', USER32_INPUT_SYMBOLS);
    gdi32 = dlopen('gdi32.dll', GDI32_CAPTURE_SYMBOLS);
  } catch (caughtError) {
    user32Discovery?.close();
    user32Input?.close();
    gdi32?.close();
    user32.close();
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
    throw caughtError;
  }

  const startReference = nowMs();
  try {
    const subprocess = Bun.spawn([executableAbsolutePath], {
      cwd: sandbox.sandboxAbsolutePath,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    });
    const spawnedAtElapsedMs = nowMs() - startReference;

    try {
      const discovered = await pollForProcessWindow(user32Discovery.symbols, subprocess.pid, CHOCOLATE_DOOM_WINDOW_TITLE, findWindowTimeoutMs, findWindowPollIntervalMs);
      const windowFoundAtElapsedMs = nowMs() - startReference;
      if (discovered === null) {
        throw new ReferenceMenuRouteWindowNotFoundError(CHOCOLATE_DOOM_WINDOW_TITLE, findWindowTimeoutMs);
      }
      const hWnd = discovered.handle;
      const actualWindowTitle = discovered.title;

      user32Input.symbols.SetForegroundWindow(hWnd);
      await sleepMs(settleAfterWindowFoundMs);

      const titleFrame = captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
      const titleFrameCapturedAtElapsedMs = nowMs() - startReference;
      const titleFrameSha256 = computeSha256Hex(titleFrame.pixels);
      const titleFrameNormalized = normalizeToInternalFramebuffer(titleFrame.pixels, titleFrame.width, titleFrame.height);
      const titleFrameNormalizedSha256 = computeSha256Hex(titleFrameNormalized);

      const stepEvidence: MenuRouteStepEvidence[] = [];
      for (let stepIndex = 0; stepIndex < MENU_ROUTE_KEY_STEPS.length; stepIndex += 1) {
        const step = MENU_ROUTE_KEY_STEPS[stepIndex]!;
        user32Input.symbols.SetForegroundWindow(hWnd);
        postKeyDownUp(user32Input.symbols, hWnd, step.virtualKeyCode);
        await sleepMs(settleAfterKeyMs);

        const isFinalStep = stepIndex === MENU_ROUTE_KEY_STEPS.length - 1;
        const stepFrame =
          isFinalStep && overrides.finalStepStabilization !== undefined
            ? await captureStabilizedClientArea(user32.symbols, gdi32.symbols, hWnd, overrides.finalStepStabilization)
            : captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
        const stepCapturedAtElapsedMs = nowMs() - startReference;
        const stepFrameSha256 = computeSha256Hex(stepFrame.pixels);
        const stepNormalized = normalizeToInternalFramebuffer(stepFrame.pixels, stepFrame.width, stepFrame.height);
        const stepNormalizedSha256 = computeSha256Hex(stepNormalized);

        stepEvidence.push(
          Object.freeze({
            capturedAtElapsedMs: stepCapturedAtElapsedMs,
            description: step.description,
            expectedMenuState: step.expectedMenuState,
            framebufferByteLength: stepFrame.pixels.byteLength,
            framebufferSha256: stepFrameSha256,
            normalizedByteLength: stepNormalized.byteLength,
            normalizedSha256: stepNormalizedSha256,
            stepIndex,
            virtualKeyCode: step.virtualKeyCode,
            virtualKeyName: step.virtualKeyName,
          } satisfies MenuRouteStepEvidence),
        );
      }

      let killedAtElapsedMs = nowMs() - startReference;
      let terminationCause: ReferenceMenuRouteTerminationCause = 'natural-exit';
      if (subprocess.exitCode === null) {
        subprocess.kill();
        killedAtElapsedMs = nowMs() - startReference;
        terminationCause = 'sandbox-killed';
      }

      const exited = await Promise.race([subprocess.exited.then((code) => ({ code, kind: 'exited' as const })), new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), killWaitMs))]);
      const exitedAtElapsedMs = nowMs() - startReference;
      const exitCode = exited.kind === 'exited' ? exited.code : null;
      const cleanShutdown = exited.kind === 'exited';

      return Object.freeze({
        cleanShutdown,
        executableFilename,
        exitCode,
        exitedAtElapsedMs,
        framebufferHeight: titleFrame.height,
        framebufferWidth: titleFrame.width,
        killedAtElapsedMs,
        sandboxAbsolutePath: sandbox.sandboxAbsolutePath,
        sandboxId: sandbox.sandboxId,
        spawnedAtElapsedMs,
        steps: Object.freeze(stepEvidence) as readonly MenuRouteStepEvidence[],
        terminationCause,
        titleFrameCapturedAtElapsedMs,
        titleFrameNormalizedSha256,
        titleFrameSha256,
        totalElapsedMs: exitedAtElapsedMs,
        windowFoundAtElapsedMs,
        windowTitle: actualWindowTitle,
      } satisfies ReferenceMenuRouteEvidence);
    } catch (caughtError) {
      if (subprocess.exitCode === null) {
        subprocess.kill();
      }
      await subprocess.exited;
      throw caughtError;
    }
  } finally {
    gdi32.close();
    user32Input.close();
    user32Discovery.close();
    user32.close();
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
  }
}

if (import.meta.main) {
  const evidence = await captureReferenceMenuRoute();
  console.log(JSON.stringify(evidence, null, 2));
}
