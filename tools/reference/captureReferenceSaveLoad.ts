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
const MUTATION_HOLD_TIC_COUNT = 50;
const NORMALIZED_INTERNAL_HEIGHT = 200;
const NORMALIZED_INTERNAL_WIDTH = 320;
const RECT_BYTE_LENGTH = 16;
const SAVE_LOAD_DEFAULT_SLOT_VALUE = 0;
const SETTLE_AFTER_E1M1_SPAWN_MS_DEFAULT = 800;
const SETTLE_AFTER_KEY_MS_DEFAULT = 400;
const SETTLE_AFTER_LOAD_COMPLETE_MS_DEFAULT = 1_500;
const SETTLE_AFTER_SAVE_WRITE_MS_DEFAULT = 1_500;
const SETTLE_AFTER_WINDOW_FOUND_MS_DEFAULT = 1_500;
const SETTLE_BEFORE_VERIFY_FRAME_MS = 800;
const TIC_DURATION_MS = 29;
const MUTATION_HOLD_DURATION_MS = MUTATION_HOLD_TIC_COUNT * TIC_DURATION_MS;

const VK_A = 0x41;
const CHAR_LOWERCASE_A = 0x61;
const VK_ESCAPE = 0x1b;
const VK_F2 = 0x71;
const VK_F3 = 0x72;
const VK_RETURN = 0x0d;
const VK_UP = 0x26;

const WM_CHAR = 0x0102;
const WM_KEYDOWN = 0x0100;
const WM_KEYUP = 0x0101;
const KEYDOWN_LPARAM = 1n;
const KEYUP_LPARAM = 0xc000_0001n;

const SAVE_FILE_BASENAME_REGEX = /^doomsav\d+\.dsg$/i;
const SAVEGAME_DESCRIPTION_SIZE = 24;

const USER32_WINDOW_DISCOVERY_SYMBOLS = {
  EnumWindows: { args: [FFIType.ptr, FFIType.i64], returns: FFIType.i32 },
  GetWindowTextLengthW: { args: [FFIType.u64], returns: FFIType.i32 },
  GetWindowTextW: { args: [FFIType.u64, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
  GetWindowThreadProcessId: { args: [FFIType.u64, FFIType.ptr], returns: FFIType.u32 },
  IsWindowVisible: { args: [FFIType.u64], returns: FFIType.i32 },
} as const;

const USER32_INPUT_SYMBOLS = {
  PostMessageW: { args: [FFIType.u64, FFIType.u32, FFIType.u64, FFIType.u64], returns: FFIType.i32 },
  SetForegroundWindow: { args: [FFIType.u64], returns: FFIType.i32 },
} as const;

const MENU_NAVIGATION_KEYS: readonly number[] = Object.freeze([VK_ESCAPE, VK_RETURN, VK_RETURN, VK_RETURN]);

export const SAVE_LOAD_DEFAULT_SLOT = SAVE_LOAD_DEFAULT_SLOT_VALUE;

export const SAVE_LOAD_TRACE_ORDINALS: readonly number[] = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

export const SAVE_LOAD_TRACE_NAMES: readonly string[] = Object.freeze([
  'clean-launch',
  'open-main-menu',
  'start-e1m1',
  'open-save-menu',
  'write-save-slot-zero',
  'return-to-gameplay-after-save',
  'mutate-live-state-after-save',
  'open-load-menu',
  'load-save-slot-zero',
  'verify-restored-frame',
]);

export type ReferenceSaveLoadTerminationCause = 'natural-exit' | 'sandbox-killed';

export interface CaptureReferenceSaveLoadOverrides {
  readonly executableFilename?: string;
  readonly findWindowPollIntervalMs?: number;
  readonly findWindowTimeoutMs?: number;
  readonly killWaitMs?: number;
  readonly sandboxIdOverride?: string;
  readonly saveSlotIndex?: number;
  readonly settleAfterE1M1SpawnMs?: number;
  readonly settleAfterKeyMs?: number;
  readonly settleAfterLoadCompleteMs?: number;
  readonly settleAfterSaveWriteMs?: number;
  readonly settleAfterWindowFoundMs?: number;
}

export interface ReferenceSaveLoadEvidence {
  readonly cleanShutdown: boolean;
  readonly e1m1EntrySha256: string;
  readonly executableFilename: string;
  readonly exitCode: number | null;
  readonly exitedAtElapsedMs: number;
  readonly framebufferHeight: number;
  readonly framebufferWidth: number;
  readonly killedAtElapsedMs: number;
  readonly mutatedAtElapsedMs: number;
  readonly mutatedSha256: string;
  readonly postLoadAtElapsedMs: number;
  readonly postLoadSha256: string;
  readonly postSaveSha256: string;
  readonly preSaveSha256: string;
  readonly roundtripSavedFileByteLength: number;
  readonly roundtripSavedFileSha256: string;
  readonly sandboxAbsolutePath: string;
  readonly sandboxId: string;
  readonly saveDescription: string;
  readonly saveSlotIndex: number;
  readonly savedAtElapsedMs: number;
  readonly savedFileByteLength: number;
  readonly savedFileSha256: string;
  readonly spawnedAtElapsedMs: number;
  readonly terminationCause: ReferenceSaveLoadTerminationCause;
  readonly totalElapsedMs: number;
  readonly verifyCapturedAtElapsedMs: number;
  readonly verifySha256: string;
  readonly windowFoundAtElapsedMs: number;
  readonly windowTitle: string;
}

export class ReferenceSaveLoadWindowNotFoundError extends Error {
  public constructor(windowTitle: string, timeoutMs: number) {
    super(`Reference window with title containing "${windowTitle}" was not found within ${timeoutMs}ms`);
    this.name = 'ReferenceSaveLoadWindowNotFoundError';
  }
}

export class ReferenceSaveLoadSaveFileNotFoundError extends Error {
  public readonly absolutePath: string;

  public constructor(absolutePath: string) {
    super(`Reference save file was not found after save confirmation: ${absolutePath}`);
    this.name = 'ReferenceSaveLoadSaveFileNotFoundError';
    this.absolutePath = absolutePath;
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

function buildSaveSlotFilename(slotIndex: number): string {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 5) {
    throw new RangeError(`saveSlotIndex must be an integer in [0, 5] (got ${slotIndex})`);
  }
  return `doomsav${slotIndex}.dsg`;
}

function readSaveDescription(saveBytes: Buffer): string {
  const descriptionLength = Math.min(SAVEGAME_DESCRIPTION_SIZE, saveBytes.byteLength);
  let trimEnd = descriptionLength;
  for (let scanIndex = 0; scanIndex < descriptionLength; scanIndex += 1) {
    if (saveBytes[scanIndex] === 0) {
      trimEnd = scanIndex;
      break;
    }
  }
  return saveBytes.subarray(0, trimEnd).toString('binary');
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

function postKeyDown(user32InputSymbols: ReturnType<typeof dlopen<typeof USER32_INPUT_SYMBOLS>>['symbols'], hWnd: bigint, virtualKeyCode: number): void {
  user32InputSymbols.PostMessageW(hWnd, WM_KEYDOWN, BigInt(virtualKeyCode), KEYDOWN_LPARAM);
}

function postKeyUp(user32InputSymbols: ReturnType<typeof dlopen<typeof USER32_INPUT_SYMBOLS>>['symbols'], hWnd: bigint, virtualKeyCode: number): void {
  user32InputSymbols.PostMessageW(hWnd, WM_KEYUP, BigInt(virtualKeyCode), KEYUP_LPARAM);
}

function postKeyTap(user32InputSymbols: ReturnType<typeof dlopen<typeof USER32_INPUT_SYMBOLS>>['symbols'], hWnd: bigint, virtualKeyCode: number): void {
  postKeyDown(user32InputSymbols, hWnd, virtualKeyCode);
  postKeyUp(user32InputSymbols, hWnd, virtualKeyCode);
}

function postCharacterKeyTap(user32InputSymbols: ReturnType<typeof dlopen<typeof USER32_INPUT_SYMBOLS>>['symbols'], hWnd: bigint, virtualKeyCode: number, characterCode: number): void {
  postKeyDown(user32InputSymbols, hWnd, virtualKeyCode);
  user32InputSymbols.PostMessageW(hWnd, WM_CHAR, BigInt(characterCode), KEYDOWN_LPARAM);
  postKeyUp(user32InputSymbols, hWnd, virtualKeyCode);
}

async function navigateToE1M1(user32InputSymbols: ReturnType<typeof dlopen<typeof USER32_INPUT_SYMBOLS>>['symbols'], hWnd: bigint, settleAfterKeyMs: number): Promise<void> {
  for (const virtualKeyCode of MENU_NAVIGATION_KEYS) {
    user32InputSymbols.SetForegroundWindow(hWnd);
    postKeyTap(user32InputSymbols, hWnd, virtualKeyCode);
    await sleepMs(settleAfterKeyMs);
  }
}

export async function captureReferenceSaveLoad(overrides: CaptureReferenceSaveLoadOverrides = {}): Promise<ReferenceSaveLoadEvidence> {
  const executableFilename = overrides.executableFilename ?? 'DOOM.EXE';
  const findWindowPollIntervalMs = overrides.findWindowPollIntervalMs ?? FIND_WINDOW_POLL_INTERVAL_MS_DEFAULT;
  const findWindowTimeoutMs = overrides.findWindowTimeoutMs ?? FIND_WINDOW_TIMEOUT_MS_DEFAULT;
  const killWaitMs = overrides.killWaitMs ?? KILL_WAIT_MS_DEFAULT;
  const saveSlotIndex = overrides.saveSlotIndex ?? SAVE_LOAD_DEFAULT_SLOT;
  const settleAfterE1M1SpawnMs = overrides.settleAfterE1M1SpawnMs ?? SETTLE_AFTER_E1M1_SPAWN_MS_DEFAULT;
  const settleAfterKeyMs = overrides.settleAfterKeyMs ?? SETTLE_AFTER_KEY_MS_DEFAULT;
  const settleAfterLoadCompleteMs = overrides.settleAfterLoadCompleteMs ?? SETTLE_AFTER_LOAD_COMPLETE_MS_DEFAULT;
  const settleAfterSaveWriteMs = overrides.settleAfterSaveWriteMs ?? SETTLE_AFTER_SAVE_WRITE_MS_DEFAULT;
  const settleAfterWindowFoundMs = overrides.settleAfterWindowFoundMs ?? SETTLE_AFTER_WINDOW_FOUND_MS_DEFAULT;

  const saveSlotFilename = buildSaveSlotFilename(saveSlotIndex);

  const sandbox = await createReferenceSandbox({ sandboxIdOverride: overrides.sandboxIdOverride });
  const executableAbsolutePath = path.join(sandbox.sandboxAbsolutePath, executableFilename);
  if (!existsSync(executableAbsolutePath)) {
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
    throw new ReferenceBundleMissingError(executableAbsolutePath);
  }
  await rewriteSandboxConfigForWindowedCapture(sandbox.sandboxAbsolutePath);

  const savedFileAbsolutePath = path.join(sandbox.sandboxAbsolutePath, saveSlotFilename);

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
    const subprocess = Bun.spawn([executableAbsolutePath, '-savedir', sandbox.sandboxAbsolutePath], {
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
        throw new ReferenceSaveLoadWindowNotFoundError(CHOCOLATE_DOOM_WINDOW_TITLE, findWindowTimeoutMs);
      }
      const hWnd = discovered.handle;
      const actualWindowTitle = discovered.title;

      user32Input.symbols.SetForegroundWindow(hWnd);
      await sleepMs(settleAfterWindowFoundMs);

      await navigateToE1M1(user32Input.symbols, hWnd, settleAfterKeyMs);
      await sleepMs(settleAfterE1M1SpawnMs);

      const preSaveFrame = captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
      const preSaveSha256 = computeSha256Hex(preSaveFrame.pixels);
      const e1m1EntrySha256 = preSaveSha256;
      const framebufferWidth = preSaveFrame.width;
      const framebufferHeight = preSaveFrame.height;

      user32Input.symbols.SetForegroundWindow(hWnd);
      postKeyTap(user32Input.symbols, hWnd, VK_F2);
      await sleepMs(settleAfterKeyMs);

      postKeyTap(user32Input.symbols, hWnd, VK_RETURN);
      await sleepMs(settleAfterKeyMs);

      postCharacterKeyTap(user32Input.symbols, hWnd, VK_A, CHAR_LOWERCASE_A);
      await sleepMs(settleAfterKeyMs);

      postKeyTap(user32Input.symbols, hWnd, VK_RETURN);
      await sleepMs(settleAfterSaveWriteMs);

      const savedAtElapsedMs = nowMs() - startReference;
      if (!existsSync(savedFileAbsolutePath)) {
        throw new ReferenceSaveLoadSaveFileNotFoundError(savedFileAbsolutePath);
      }
      const savedFileBytes = await readFile(savedFileAbsolutePath);
      const savedFileByteLength = savedFileBytes.byteLength;
      const savedFileSha256 = computeSha256Hex(savedFileBytes);
      const saveDescription = readSaveDescription(savedFileBytes);

      const postSaveFrame = captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
      const postSaveSha256 = computeSha256Hex(postSaveFrame.pixels);

      user32Input.symbols.SetForegroundWindow(hWnd);
      postKeyDown(user32Input.symbols, hWnd, VK_UP);
      await sleepMs(MUTATION_HOLD_DURATION_MS);
      postKeyUp(user32Input.symbols, hWnd, VK_UP);
      await sleepMs(settleAfterKeyMs);

      const mutatedFrame = captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
      const mutatedAtElapsedMs = nowMs() - startReference;
      const mutatedSha256 = computeSha256Hex(mutatedFrame.pixels);

      user32Input.symbols.SetForegroundWindow(hWnd);
      postKeyTap(user32Input.symbols, hWnd, VK_F3);
      await sleepMs(settleAfterKeyMs);

      postKeyTap(user32Input.symbols, hWnd, VK_RETURN);
      await sleepMs(settleAfterLoadCompleteMs);

      const postLoadFrame = captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
      const postLoadAtElapsedMs = nowMs() - startReference;
      const postLoadSha256 = computeSha256Hex(postLoadFrame.pixels);

      const roundtripSavedFileBytes = await readFile(savedFileAbsolutePath);
      const roundtripSavedFileByteLength = roundtripSavedFileBytes.byteLength;
      const roundtripSavedFileSha256 = computeSha256Hex(roundtripSavedFileBytes);

      await sleepMs(SETTLE_BEFORE_VERIFY_FRAME_MS);

      const verifyFrame = captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
      const verifyCapturedAtElapsedMs = nowMs() - startReference;
      const verifySha256 = computeSha256Hex(verifyFrame.pixels);

      let killedAtElapsedMs = nowMs() - startReference;
      let terminationCause: ReferenceSaveLoadTerminationCause = 'natural-exit';
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
        e1m1EntrySha256,
        executableFilename,
        exitCode,
        exitedAtElapsedMs,
        framebufferHeight,
        framebufferWidth,
        killedAtElapsedMs,
        mutatedAtElapsedMs,
        mutatedSha256,
        postLoadAtElapsedMs,
        postLoadSha256,
        postSaveSha256,
        preSaveSha256,
        roundtripSavedFileByteLength,
        roundtripSavedFileSha256,
        sandboxAbsolutePath: sandbox.sandboxAbsolutePath,
        sandboxId: sandbox.sandboxId,
        saveDescription,
        saveSlotIndex,
        savedAtElapsedMs,
        savedFileByteLength,
        savedFileSha256,
        spawnedAtElapsedMs,
        terminationCause,
        totalElapsedMs: exitedAtElapsedMs,
        verifyCapturedAtElapsedMs,
        verifySha256,
        windowFoundAtElapsedMs,
        windowTitle: actualWindowTitle,
      } satisfies ReferenceSaveLoadEvidence);
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

void SAVE_FILE_BASENAME_REGEX;
