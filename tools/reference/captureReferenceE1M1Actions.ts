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
const SETTLE_AFTER_KEY_MS_DEFAULT = 400;
const SETTLE_AFTER_WINDOW_FOUND_MS_DEFAULT = 1_500;
const TIC_DURATION_MS = 29;

const VK_CONTROL = 0x11;
const VK_ESCAPE = 0x1b;
const VK_RETURN = 0x0d;
const VK_RIGHT = 0x27;
const VK_SPACE = 0x20;
const VK_UP = 0x26;

const WM_KEYDOWN = 0x0100;
const WM_KEYUP = 0x0101;
const KEYDOWN_LPARAM = 1n;
const KEYUP_LPARAM = 0xc000_0001n;

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

export interface ScriptedKeyHold {
  readonly description: string;
  readonly durationMs: number;
  readonly virtualKeyCodes: readonly number[];
}

export interface ScriptedActionSequence {
  readonly action: ScriptedActionKind;
  readonly description: string;
  readonly keyHolds: readonly ScriptedKeyHold[];
}

export type ScriptedActionKind = 'combat' | 'damage' | 'death-reborn' | 'door-use' | 'movement' | 'pickup';

export const SCRIPTED_E1M1_ACTION_SEQUENCES: Readonly<Record<ScriptedActionKind, ScriptedActionSequence>> = Object.freeze({
  combat: Object.freeze({
    action: 'combat',
    description: 'Face forward from the spawn corridor and fire the pistol once the player has cleared the alcove.',
    keyHolds: Object.freeze([
      Object.freeze({ description: 'Advance forward into the open corridor (~20 tics)', durationMs: 20 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_UP]) }),
      Object.freeze({ description: 'Fire pistol (Ctrl) for ~10 tics so the muzzle flash and projectile spawn into the capture window', durationMs: 10 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_CONTROL]) }),
    ]),
  } satisfies ScriptedActionSequence),
  damage: Object.freeze({
    action: 'damage',
    description: 'Advance into the radioactive nukage pool in the courtyard to capture the player taking floor-damage hits.',
    keyHolds: Object.freeze([
      Object.freeze({ description: 'Hold forward (~40 tics) so the player walks past the alcove into the nukage edge', durationMs: 40 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_UP]) }),
      Object.freeze({ description: 'Continue forward with strafe-right (~25 tics) into the damaging nukage floor sector', durationMs: 25 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_UP, VK_RIGHT]) }),
    ]),
  } satisfies ScriptedActionSequence),
  'death-reborn': Object.freeze({
    action: 'death-reborn',
    description: 'Hold forward into the nukage long enough for cumulative damage to drop the player to 0 HP, then press Enter to reborn after the death sequence finishes.',
    keyHolds: Object.freeze([
      Object.freeze({ description: 'Hold forward into the nukage (~140 tics) so cumulative floor damage kills the player', durationMs: 140 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_UP]) }),
      Object.freeze({ description: 'Press Enter to clear the death message and reborn into E1M1', durationMs: 5 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_RETURN]) }),
    ]),
  } satisfies ScriptedActionSequence),
  'door-use': Object.freeze({
    action: 'door-use',
    description: 'Advance to the first regular door inside the spawn room and press Use (Space) to open it.',
    keyHolds: Object.freeze([
      Object.freeze({ description: 'Hold forward (~30 tics) so the player walks into the door alcove', durationMs: 30 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_UP]) }),
      Object.freeze({ description: 'Press Use (Space) for ~5 tics to trigger the door open animation', durationMs: 5 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_SPACE]) }),
    ]),
  } satisfies ScriptedActionSequence),
  movement: Object.freeze({
    action: 'movement',
    description: 'From the E1M1 spawn pad hold forward for ~30 tics, then add turn-right for another ~26 tics; matches the plan_fps capture-scripted-movement-path inputScript.',
    keyHolds: Object.freeze([
      Object.freeze({ description: 'Hold forward (ArrowUp) for ~30 tics from the spawn pad', durationMs: 30 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_UP]) }),
      Object.freeze({ description: 'Continue forward + turn right (ArrowUp+ArrowRight) for ~26 tics to arc into the spawn hallway', durationMs: 26 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_UP, VK_RIGHT]) }),
    ]),
  } satisfies ScriptedActionSequence),
  pickup: Object.freeze({
    action: 'pickup',
    description: 'Advance into the spawn-room armour bonus tile to trigger an item pickup event.',
    keyHolds: Object.freeze([Object.freeze({ description: 'Hold forward (~25 tics) to walk over the armour bonus pickup', durationMs: 25 * TIC_DURATION_MS, virtualKeyCodes: Object.freeze([VK_UP]) })]),
  } satisfies ScriptedActionSequence),
} satisfies Readonly<Record<ScriptedActionKind, ScriptedActionSequence>>);

export const SCRIPTED_E1M1_ACTION_KINDS: readonly ScriptedActionKind[] = Object.freeze(['combat', 'damage', 'death-reborn', 'door-use', 'movement', 'pickup']);

const MENU_NAVIGATION_KEYS: readonly number[] = Object.freeze([VK_ESCAPE, VK_RETURN, VK_RETURN, VK_RETURN]);

export type ReferenceE1M1ActionTerminationCause = 'natural-exit' | 'sandbox-killed';

export interface ScriptedActionHoldEvidence {
  readonly capturedAtElapsedMs: number;
  readonly description: string;
  readonly durationMs: number;
  readonly framebufferByteLength: number;
  readonly framebufferSha256: string;
  readonly holdIndex: number;
  readonly normalizedByteLength: number;
  readonly normalizedSha256: string;
  readonly virtualKeyCodes: readonly number[];
}

export interface ReferenceE1M1ActionEvidence {
  readonly action: ScriptedActionKind;
  readonly cleanShutdown: boolean;
  readonly description: string;
  readonly e1m1EntrySha256: string;
  readonly executableFilename: string;
  readonly exitCode: number | null;
  readonly exitedAtElapsedMs: number;
  readonly framebufferHeight: number;
  readonly framebufferWidth: number;
  readonly holds: readonly ScriptedActionHoldEvidence[];
  readonly killedAtElapsedMs: number;
  readonly sandboxAbsolutePath: string;
  readonly sandboxId: string;
  readonly spawnedAtElapsedMs: number;
  readonly terminationCause: ReferenceE1M1ActionTerminationCause;
  readonly totalElapsedMs: number;
  readonly windowFoundAtElapsedMs: number;
  readonly windowTitle: string;
}

export interface CaptureReferenceE1M1ActionOverrides {
  readonly executableFilename?: string;
  readonly findWindowPollIntervalMs?: number;
  readonly findWindowTimeoutMs?: number;
  readonly killWaitMs?: number;
  readonly sandboxIdOverride?: string;
  readonly settleAfterKeyMs?: number;
  readonly settleAfterWindowFoundMs?: number;
}

export class ReferenceE1M1ActionWindowNotFoundError extends Error {
  public constructor(windowTitle: string, timeoutMs: number) {
    super(`Reference window with title containing "${windowTitle}" was not found within ${timeoutMs}ms`);
    this.name = 'ReferenceE1M1ActionWindowNotFoundError';
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

async function navigateToE1M1(user32InputSymbols: ReturnType<typeof dlopen<typeof USER32_INPUT_SYMBOLS>>['symbols'], hWnd: bigint, settleAfterKeyMs: number): Promise<void> {
  for (const virtualKeyCode of MENU_NAVIGATION_KEYS) {
    user32InputSymbols.SetForegroundWindow(hWnd);
    postKeyTap(user32InputSymbols, hWnd, virtualKeyCode);
    await sleepMs(settleAfterKeyMs);
  }
}

export async function captureReferenceE1M1Action(action: ScriptedActionKind, overrides: CaptureReferenceE1M1ActionOverrides = {}): Promise<ReferenceE1M1ActionEvidence> {
  const sequence = SCRIPTED_E1M1_ACTION_SEQUENCES[action];
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
        throw new ReferenceE1M1ActionWindowNotFoundError(CHOCOLATE_DOOM_WINDOW_TITLE, findWindowTimeoutMs);
      }
      const hWnd = discovered.handle;
      const actualWindowTitle = discovered.title;

      user32Input.symbols.SetForegroundWindow(hWnd);
      await sleepMs(settleAfterWindowFoundMs);

      await navigateToE1M1(user32Input.symbols, hWnd, settleAfterKeyMs);
      await sleepMs(settleAfterKeyMs);

      const e1m1EntryFrame = captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
      const e1m1EntrySha256 = computeSha256Hex(e1m1EntryFrame.pixels);

      const holdsEvidence: ScriptedActionHoldEvidence[] = [];
      for (let holdIndex = 0; holdIndex < sequence.keyHolds.length; holdIndex += 1) {
        const hold = sequence.keyHolds[holdIndex]!;
        user32Input.symbols.SetForegroundWindow(hWnd);
        for (const virtualKeyCode of hold.virtualKeyCodes) {
          postKeyDown(user32Input.symbols, hWnd, virtualKeyCode);
        }
        await sleepMs(hold.durationMs);
        for (const virtualKeyCode of hold.virtualKeyCodes) {
          postKeyUp(user32Input.symbols, hWnd, virtualKeyCode);
        }
        await sleepMs(settleAfterKeyMs);
        const holdFrame = captureClientAreaPixels(user32.symbols, gdi32.symbols, hWnd);
        const capturedAtElapsedMs = nowMs() - startReference;
        const holdFrameSha256 = computeSha256Hex(holdFrame.pixels);
        const holdNormalized = normalizeToInternalFramebuffer(holdFrame.pixels, holdFrame.width, holdFrame.height);
        const holdNormalizedSha256 = computeSha256Hex(holdNormalized);
        holdsEvidence.push(
          Object.freeze({
            capturedAtElapsedMs,
            description: hold.description,
            durationMs: hold.durationMs,
            framebufferByteLength: holdFrame.pixels.byteLength,
            framebufferSha256: holdFrameSha256,
            holdIndex,
            normalizedByteLength: holdNormalized.byteLength,
            normalizedSha256: holdNormalizedSha256,
            virtualKeyCodes: Object.freeze([...hold.virtualKeyCodes]),
          } satisfies ScriptedActionHoldEvidence),
        );
      }

      let killedAtElapsedMs = nowMs() - startReference;
      let terminationCause: ReferenceE1M1ActionTerminationCause = 'natural-exit';
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
        action,
        cleanShutdown,
        description: sequence.description,
        e1m1EntrySha256,
        executableFilename,
        exitCode,
        exitedAtElapsedMs,
        framebufferHeight: e1m1EntryFrame.height,
        framebufferWidth: e1m1EntryFrame.width,
        holds: Object.freeze(holdsEvidence) as readonly ScriptedActionHoldEvidence[],
        killedAtElapsedMs,
        sandboxAbsolutePath: sandbox.sandboxAbsolutePath,
        sandboxId: sandbox.sandboxId,
        spawnedAtElapsedMs,
        terminationCause,
        totalElapsedMs: exitedAtElapsedMs,
        windowFoundAtElapsedMs,
        windowTitle: actualWindowTitle,
      } satisfies ReferenceE1M1ActionEvidence);
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
