import { dlopen, FFIType, JSCallback, ptr } from 'bun:ffi';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createReferenceSandbox, destroyReferenceSandbox } from './createReferenceSandbox.ts';
import { ReferenceBundleMissingError } from './launchReferenceCleanly.ts';
import { buildBitmapInfoHeader, CAPTURE_BYTES_PER_PIXEL, CHOCOLATE_DOOM_WINDOW_TITLE, DIB_RGB_COLORS, GDI32_CAPTURE_SYMBOLS, SRCCOPY, USER32_CAPTURE_SYMBOLS } from './windowCaptureProbe.ts';

const CHECKPOINT_LEAD_MS_DEFAULT = 0;
const FIND_WINDOW_POLL_INTERVAL_MS_DEFAULT = 50;
const FIND_WINDOW_TIMEOUT_MS_DEFAULT = 15_000;
const KILL_WAIT_MS_DEFAULT = 8_000;
const NORMALIZED_INTERNAL_HEIGHT = 200;
const NORMALIZED_INTERNAL_WIDTH = 320;
const RECT_BYTE_LENGTH = 16;
const SETTLE_AFTER_WINDOW_FOUND_MS_DEFAULT = 1_500;
const TIC_DURATION_MS = 1000 / 35;

const USER32_WINDOW_DISCOVERY_SYMBOLS = {
  EnumWindows: { args: [FFIType.ptr, FFIType.i64], returns: FFIType.i32 },
  GetWindowTextLengthW: { args: [FFIType.u64], returns: FFIType.i32 },
  GetWindowTextW: { args: [FFIType.u64, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
  GetWindowThreadProcessId: { args: [FFIType.u64, FFIType.ptr], returns: FFIType.u32 },
  IsWindowVisible: { args: [FFIType.u64], returns: FFIType.i32 },
} as const;

const USER32_FOREGROUND_SYMBOLS = {
  SetForegroundWindow: { args: [FFIType.u64], returns: FFIType.i32 },
} as const;

export type ReferenceDemoNumber = 1 | 2 | 3;

export interface DemoCheckpointContract {
  readonly demoNumber: ReferenceDemoNumber;
  readonly demoLump: string;
  readonly playdemoArgument: string;
  readonly checkpointTics: readonly number[];
}

export const DEMO_LUMP_NAMES: Readonly<Record<ReferenceDemoNumber, string>> = Object.freeze({
  1: 'DEMO1',
  2: 'DEMO2',
  3: 'DEMO3',
});

export const DEMO_PLAYBACK_NUMBERS: readonly ReferenceDemoNumber[] = Object.freeze([1, 2, 3]);

export const DEMO_CHECKPOINT_CONTRACTS: Readonly<Record<ReferenceDemoNumber, DemoCheckpointContract>> = Object.freeze({
  1: Object.freeze({
    demoNumber: 1,
    demoLump: 'DEMO1',
    playdemoArgument: 'demo1',
    checkpointTics: Object.freeze([0, 35, 70, 175, 350, 700]),
  } satisfies DemoCheckpointContract),
  2: Object.freeze({
    demoNumber: 2,
    demoLump: 'DEMO2',
    playdemoArgument: 'demo2',
    checkpointTics: Object.freeze([0, 35, 70, 140, 280, 560, 840, 1120]),
  } satisfies DemoCheckpointContract),
  3: Object.freeze({
    demoNumber: 3,
    demoLump: 'DEMO3',
    playdemoArgument: 'demo3',
    checkpointTics: Object.freeze([0, 1, 35, 350, 700]),
  } satisfies DemoCheckpointContract),
} satisfies Readonly<Record<ReferenceDemoNumber, DemoCheckpointContract>>);

export type ReferenceDemoSyncTerminationCause = 'natural-exit' | 'sandbox-killed';

export interface DemoCheckpointEvidence {
  readonly capturedAtElapsedMs: number;
  readonly checkpointIndex: number;
  readonly checkpointTic: number;
  readonly framebufferByteLength: number;
  readonly framebufferSha256: string;
  readonly normalizedByteLength: number;
  readonly normalizedSha256: string;
  readonly scheduledAtElapsedMs: number;
  readonly schedulingDriftMs: number;
}

export interface ReferenceDemoSyncEvidence {
  readonly checkpoints: readonly DemoCheckpointEvidence[];
  readonly cleanShutdown: boolean;
  readonly demoLump: string;
  readonly demoNumber: ReferenceDemoNumber;
  readonly executableFilename: string;
  readonly exitCode: number | null;
  readonly exitedAtElapsedMs: number;
  readonly framebufferHeight: number;
  readonly framebufferWidth: number;
  readonly killedAtElapsedMs: number;
  readonly playdemoArgument: string;
  readonly sandboxAbsolutePath: string;
  readonly sandboxId: string;
  readonly spawnedAtElapsedMs: number;
  readonly terminationCause: ReferenceDemoSyncTerminationCause;
  readonly ticBaselineAtElapsedMs: number;
  readonly totalElapsedMs: number;
  readonly windowFoundAtElapsedMs: number;
  readonly windowTitle: string;
}

export interface CaptureReferenceDemoSyncOverrides {
  readonly checkpointLeadMs?: number;
  readonly executableFilename?: string;
  readonly findWindowPollIntervalMs?: number;
  readonly findWindowTimeoutMs?: number;
  readonly killWaitMs?: number;
  readonly sandboxIdOverride?: string;
  readonly settleAfterWindowFoundMs?: number;
}

export class ReferenceDemoSyncWindowNotFoundError extends Error {
  public constructor(windowTitle: string, timeoutMs: number) {
    super(`Reference window with title containing "${windowTitle}" was not found within ${timeoutMs}ms`);
    this.name = 'ReferenceDemoSyncWindowNotFoundError';
  }
}

function nowMs(): number {
  return performance.now();
}

async function sleepMs(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return;
  }
  await Bun.sleep(durationMs);
}

async function sleepUntilElapsedMs(startReferenceMs: number, targetElapsedMs: number): Promise<void> {
  let remainingMs = targetElapsedMs - (nowMs() - startReferenceMs);
  while (remainingMs > 0) {
    await sleepMs(remainingMs);
    remainingMs = targetElapsedMs - (nowMs() - startReferenceMs);
  }
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

export async function captureReferenceDemoSync(demoNumber: ReferenceDemoNumber, overrides: CaptureReferenceDemoSyncOverrides = {}): Promise<ReferenceDemoSyncEvidence> {
  const contract = DEMO_CHECKPOINT_CONTRACTS[demoNumber];
  const checkpointLeadMs = overrides.checkpointLeadMs ?? CHECKPOINT_LEAD_MS_DEFAULT;
  const executableFilename = overrides.executableFilename ?? 'DOOM.EXE';
  const findWindowPollIntervalMs = overrides.findWindowPollIntervalMs ?? FIND_WINDOW_POLL_INTERVAL_MS_DEFAULT;
  const findWindowTimeoutMs = overrides.findWindowTimeoutMs ?? FIND_WINDOW_TIMEOUT_MS_DEFAULT;
  const killWaitMs = overrides.killWaitMs ?? KILL_WAIT_MS_DEFAULT;
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
  let user32Foreground;
  let gdi32;
  try {
    user32Discovery = dlopen('user32.dll', USER32_WINDOW_DISCOVERY_SYMBOLS);
    user32Foreground = dlopen('user32.dll', USER32_FOREGROUND_SYMBOLS);
    gdi32 = dlopen('gdi32.dll', GDI32_CAPTURE_SYMBOLS);
  } catch (caughtError) {
    user32Discovery?.close();
    user32Foreground?.close();
    gdi32?.close();
    user32.close();
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
    throw caughtError;
  }

  const startReference = nowMs();
  try {
    const subprocess = Bun.spawn([executableAbsolutePath, '-playdemo', contract.playdemoArgument], {
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
        throw new ReferenceDemoSyncWindowNotFoundError(CHOCOLATE_DOOM_WINDOW_TITLE, findWindowTimeoutMs);
      }
      const hWnd = discovered.handle;
      const actualWindowTitle = discovered.title;

      user32Foreground.symbols.SetForegroundWindow(hWnd);
      await sleepMs(settleAfterWindowFoundMs);
      const ticBaselineAtElapsedMs = nowMs() - startReference;

      let framebufferWidth = 0;
      let framebufferHeight = 0;

      const checkpoints: DemoCheckpointEvidence[] = [];
      for (let checkpointIndex = 0; checkpointIndex < contract.checkpointTics.length; checkpointIndex += 1) {
        const checkpointTic = contract.checkpointTics[checkpointIndex]!;
        const scheduledOffsetMs = checkpointTic * TIC_DURATION_MS - checkpointLeadMs;
        const scheduledAtElapsedMs = ticBaselineAtElapsedMs + scheduledOffsetMs;
        await sleepUntilElapsedMs(startReference, scheduledAtElapsedMs);
        user32Foreground.symbols.SetForegroundWindow(hWnd);
        const sample = captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
        const capturedAtElapsedMs = nowMs() - startReference;
        if (checkpointIndex === 0) {
          framebufferWidth = sample.width;
          framebufferHeight = sample.height;
        } else if (sample.width !== framebufferWidth || sample.height !== framebufferHeight) {
          throw new Error(`Checkpoint ${checkpointIndex} produced unexpected dimensions ${sample.width}x${sample.height}, expected ${framebufferWidth}x${framebufferHeight}`);
        }
        const framebufferSha256 = computeSha256Hex(sample.pixels);
        const normalized = normalizeToInternalFramebuffer(sample.pixels, sample.width, sample.height);
        const normalizedSha256 = computeSha256Hex(normalized);
        const schedulingDriftMs = capturedAtElapsedMs - scheduledAtElapsedMs;
        checkpoints.push(
          Object.freeze({
            capturedAtElapsedMs,
            checkpointIndex,
            checkpointTic,
            framebufferByteLength: sample.pixels.byteLength,
            framebufferSha256,
            normalizedByteLength: normalized.byteLength,
            normalizedSha256,
            scheduledAtElapsedMs,
            schedulingDriftMs,
          } satisfies DemoCheckpointEvidence),
        );
      }

      let killedAtElapsedMs = nowMs() - startReference;
      let terminationCause: ReferenceDemoSyncTerminationCause = 'natural-exit';
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
        checkpoints: Object.freeze(checkpoints) as readonly DemoCheckpointEvidence[],
        cleanShutdown,
        demoLump: contract.demoLump,
        demoNumber,
        executableFilename,
        exitCode,
        exitedAtElapsedMs,
        framebufferHeight,
        framebufferWidth,
        killedAtElapsedMs,
        playdemoArgument: contract.playdemoArgument,
        sandboxAbsolutePath: sandbox.sandboxAbsolutePath,
        sandboxId: sandbox.sandboxId,
        spawnedAtElapsedMs,
        terminationCause,
        ticBaselineAtElapsedMs,
        totalElapsedMs: exitedAtElapsedMs,
        windowFoundAtElapsedMs,
        windowTitle: actualWindowTitle,
      } satisfies ReferenceDemoSyncEvidence);
    } catch (caughtError) {
      if (subprocess.exitCode === null) {
        subprocess.kill();
      }
      await subprocess.exited;
      throw caughtError;
    }
  } finally {
    gdi32.close();
    user32Foreground.close();
    user32Discovery.close();
    user32.close();
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
  }
}
