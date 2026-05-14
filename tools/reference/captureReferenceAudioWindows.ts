import { CFunction, dlopen, FFIType, JSCallback, type Pointer, ptr, read } from 'bun:ffi';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createReferenceSandbox, destroyReferenceSandbox } from './createReferenceSandbox.ts';
import { ReferenceBundleMissingError } from './launchReferenceCleanly.ts';
import { CHOCOLATE_DOOM_WINDOW_TITLE } from './windowCaptureProbe.ts';

const FIND_WINDOW_POLL_INTERVAL_MS_DEFAULT = 50;
const FIND_WINDOW_TIMEOUT_MS_DEFAULT = 15_000;
const KILL_WAIT_MS_DEFAULT = 8_000;
const MENU_KEY_FIRST_AT_TIC_DEFAULT = 140;
const SETTLE_AFTER_KEY_MS_DEFAULT = 350;
const SETTLE_AFTER_WINDOW_FOUND_MS_DEFAULT = 1_500;
const TIC_DURATION_MS = 29;
const WASAPI_PULL_INTERVAL_MS = 10;
const WASAPI_BUFFER_DURATION_HUNDRED_NANOSECONDS = 2_000_000n;

const VK_ESCAPE = 0x1b;
const VK_RETURN = 0x0d;
const WM_KEYDOWN = 0x0100;
const WM_KEYUP = 0x0101;
const KEYDOWN_LPARAM = 1n;
const KEYUP_LPARAM = 0xc000_0001n;

const COINIT_MULTITHREADED = 0x0;
const CLSCTX_ALL = 0x17;
const E_DATA_FLOW_RENDER = 0;
const E_ROLE_CONSOLE = 0;
const AUDCLNT_SHAREMODE_SHARED = 0;
const AUDCLNT_STREAMFLAGS_LOOPBACK = 0x0002_0000;
const AUDCLNT_BUFFERFLAGS_SILENT = 0x2;
const HRESULT_S_OK = 0;
const HRESULT_S_FALSE = 1;
const HRESULT_AUDCLNT_S_BUFFER_EMPTY = 0x0889_0001;

const CLSID_MMDEVICE_ENUMERATOR = 'BCDE0395-E52F-467C-8E3D-C4579291692E';
const IID_IMMDEVICE_ENUMERATOR = 'A95664D2-9614-4F35-A746-DE8DB63617E6';
const IID_IAUDIOCLIENT = '1CB9AD4C-DBFA-4C32-B178-C2F568A703B2';
const IID_IAUDIOCAPTURECLIENT = 'C8ADBD64-E71E-48A0-A4DE-185C395CD317';

const IMMDEVICE_ENUMERATOR_GET_DEFAULT_AUDIO_ENDPOINT_VTABLE_INDEX = 4;
const IMMDEVICE_ACTIVATE_VTABLE_INDEX = 3;
const IUNKNOWN_RELEASE_VTABLE_INDEX = 2;
const IAUDIOCLIENT_INITIALIZE_VTABLE_INDEX = 3;
const IAUDIOCLIENT_GET_MIX_FORMAT_VTABLE_INDEX = 8;
const IAUDIOCLIENT_START_VTABLE_INDEX = 10;
const IAUDIOCLIENT_STOP_VTABLE_INDEX = 11;
const IAUDIOCLIENT_GET_SERVICE_VTABLE_INDEX = 14;
const IAUDIOCAPTURECLIENT_GET_BUFFER_VTABLE_INDEX = 3;
const IAUDIOCAPTURECLIENT_RELEASE_BUFFER_VTABLE_INDEX = 4;
const IAUDIOCAPTURECLIENT_GET_NEXT_PACKET_SIZE_VTABLE_INDEX = 5;

const OLE32_SYMBOLS = {
  CoCreateInstance: { args: [FFIType.ptr, FFIType.u64, FFIType.u32, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
  CoInitializeEx: { args: [FFIType.u64, FFIType.u32], returns: FFIType.i32 },
  CoTaskMemFree: { args: [FFIType.u64], returns: FFIType.void },
  CoUninitialize: { args: [], returns: FFIType.void },
} as const;

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

export type AudioHashWindowKind = 'music-event' | 'sfx';

export type AudioHashWindowPhase = 'clean-launch' | 'gameplay-weapon' | 'gameplay-world-interaction' | 'menu-navigation' | 'music-clean-launch-title' | 'music-e1m1-start' | 'music-menu-navigation';

export type ReferenceAudioCaptureStatus = 'captured';

export type ReferenceAudioWindowsTerminationCause = 'natural-exit' | 'sandbox-killed';

export interface AudioHashWindow {
  readonly description: string;
  readonly endTic: number;
  readonly kind: AudioHashWindowKind;
  readonly name: string;
  readonly phase: AudioHashWindowPhase;
  readonly startTic: number;
}

export interface CapturedAudioFormat {
  readonly averageBytesPerSecond: number;
  readonly bitsPerSample: number;
  readonly blockAlign: number;
  readonly channelCount: number;
  readonly formatTag: number;
  readonly samplesPerSecond: number;
}

export interface CaptureReferenceAudioWindowsOverrides {
  readonly executableFilename?: string;
  readonly findWindowPollIntervalMs?: number;
  readonly findWindowTimeoutMs?: number;
  readonly killWaitMs?: number;
  readonly menuKeyFirstAtTic?: number;
  readonly sandboxIdOverride?: string;
  readonly settleAfterKeyMs?: number;
  readonly settleAfterWindowFoundMs?: number;
}

export interface ReferenceAudioWindowEvidence {
  readonly audioByteLength: number;
  readonly audioSha256: string;
  readonly description: string;
  readonly endTic: number;
  readonly kind: AudioHashWindowKind;
  readonly mixedSha256: string;
  readonly musicEventSha256: string;
  readonly name: string;
  readonly observedEndElapsedMs: number;
  readonly observedStartElapsedMs: number;
  readonly phase: AudioHashWindowPhase;
  readonly sfxSha256: string;
  readonly startTic: number;
}

export interface ReferenceAudioWindowsEvidence {
  readonly captureEndElapsedMs: number;
  readonly captureStartElapsedMs: number;
  readonly captureStatus: ReferenceAudioCaptureStatus;
  readonly capturedFormat: CapturedAudioFormat;
  readonly cleanShutdown: boolean;
  readonly executableFilename: string;
  readonly exitCode: number | null;
  readonly exitedAtElapsedMs: number;
  readonly framesCapturedTotal: number;
  readonly killedAtElapsedMs: number;
  readonly menuKeyFirstAtTic: number;
  readonly mixedSha256: string;
  readonly musicEventSha256: string;
  readonly pcmByteLengthTotal: number;
  readonly sandboxAbsolutePath: string;
  readonly sandboxId: string;
  readonly sfxSha256: string;
  readonly silentPacketCount: number;
  readonly spawnedAtElapsedMs: number;
  readonly terminationCause: ReferenceAudioWindowsTerminationCause;
  readonly ticDurationMs: number;
  readonly totalCapturedTics: number;
  readonly totalElapsedMs: number;
  readonly windowFoundAtElapsedMs: number;
  readonly windowTitle: string;
  readonly windows: readonly ReferenceAudioWindowEvidence[];
}

export const AUDIO_HASH_WINDOW_KINDS: readonly AudioHashWindowKind[] = Object.freeze(['music-event', 'sfx']);

export const SFX_HASH_WINDOWS: readonly AudioHashWindow[] = Object.freeze([
  Object.freeze({
    description: 'Clean launch through opening attract loop / title sfx window (tics 0..4).',
    endTic: 4,
    kind: 'sfx' as const,
    name: 'clean-launch-menu-sfx-window',
    phase: 'clean-launch' as const,
    startTic: 0,
  } satisfies AudioHashWindow),
  Object.freeze({
    description: 'Menu open + selection navigation sfx window (tics 5..8) covering Escape + Enter cursor moves.',
    endTic: 8,
    kind: 'sfx' as const,
    name: 'menu-navigation-sfx-window',
    phase: 'menu-navigation' as const,
    startTic: 5,
  } satisfies AudioHashWindow),
  Object.freeze({
    description: 'E1M1 gameplay weapon sfx window (tics 9..16) covering pistol/fist after spawn.',
    endTic: 16,
    kind: 'sfx' as const,
    name: 'gameplay-weapon-sfx-window',
    phase: 'gameplay-weapon' as const,
    startTic: 9,
  } satisfies AudioHashWindow),
  Object.freeze({
    description: 'E1M1 gameplay world interaction sfx window (tics 17..24) covering door + pickup + footsteps.',
    endTic: 24,
    kind: 'sfx' as const,
    name: 'gameplay-world-interaction-sfx-window',
    phase: 'gameplay-world-interaction' as const,
    startTic: 17,
  } satisfies AudioHashWindow),
] satisfies readonly AudioHashWindow[]);

export const MUSIC_EVENT_HASH_WINDOWS: readonly AudioHashWindow[] = Object.freeze([
  Object.freeze({
    description: 'Clean launch title music window (tics 0..104) covering D_INTRO / D_DM2TTL playback.',
    endTic: 104,
    kind: 'music-event' as const,
    name: 'music-clean-launch-title-window',
    phase: 'music-clean-launch-title' as const,
    startTic: 0,
  } satisfies AudioHashWindow),
  Object.freeze({
    description: 'Menu navigation music window (tics 140..244) covering main → episode → skill menu open with title music still playing.',
    endTic: 244,
    kind: 'music-event' as const,
    name: 'music-menu-navigation-window',
    phase: 'music-menu-navigation' as const,
    startTic: 140,
  } satisfies AudioHashWindow),
  Object.freeze({
    description: 'E1M1 start music window (tics 315..420) covering S_ChangeMusic(D_E1M1, looping=true) on level start.',
    endTic: 420,
    kind: 'music-event' as const,
    name: 'music-e1m1-start-window',
    phase: 'music-e1m1-start' as const,
    startTic: 315,
  } satisfies AudioHashWindow),
] satisfies readonly AudioHashWindow[]);

export const REFERENCE_AUDIO_HASH_WINDOWS: readonly AudioHashWindow[] = Object.freeze([...SFX_HASH_WINDOWS, ...MUSIC_EVENT_HASH_WINDOWS]);

const MENU_NAVIGATION_KEYS: readonly number[] = Object.freeze([VK_ESCAPE, VK_RETURN, VK_RETURN, VK_RETURN]);

export class ReferenceAudioWindowNotFoundError extends Error {
  public constructor(windowTitle: string, timeoutMs: number) {
    super(`Reference window with title containing "${windowTitle}" was not found within ${timeoutMs}ms`);
    this.name = 'ReferenceAudioWindowNotFoundError';
  }
}

export class ReferenceAudioWindowsComError extends Error {
  public readonly hresult: number;

  public constructor(operation: string, hresult: number) {
    super(`${operation} failed with HRESULT 0x${(hresult >>> 0).toString(16).padStart(8, '0').toUpperCase()}`);
    this.name = 'ReferenceAudioWindowsComError';
    this.hresult = hresult;
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

export function buildGuidBuffer(guid: string): Buffer {
  if (typeof guid !== 'string') {
    throw new TypeError(`guid must be a string, got ${typeof guid}`);
  }
  const groups = guid.split('-');
  if (groups.length !== 5) {
    throw new RangeError(`guid must contain five hyphenated groups, got ${guid}`);
  }
  if (groups[0]!.length !== 8 || groups[1]!.length !== 4 || groups[2]!.length !== 4 || groups[3]!.length !== 4 || groups[4]!.length !== 12) {
    throw new RangeError(`guid must follow 8-4-4-4-12 hex layout, got ${guid}`);
  }
  const buffer = Buffer.alloc(16);
  buffer.writeUInt32LE(Number.parseInt(groups[0]!, 16), 0);
  buffer.writeUInt16LE(Number.parseInt(groups[1]!, 16), 4);
  buffer.writeUInt16LE(Number.parseInt(groups[2]!, 16), 6);
  for (let groupThreeIndex = 0; groupThreeIndex < 2; groupThreeIndex += 1) {
    buffer.writeUInt8(Number.parseInt(groups[3]!.slice(groupThreeIndex * 2, groupThreeIndex * 2 + 2), 16), 8 + groupThreeIndex);
  }
  for (let groupFourIndex = 0; groupFourIndex < 6; groupFourIndex += 1) {
    buffer.writeUInt8(Number.parseInt(groups[4]!.slice(groupFourIndex * 2, groupFourIndex * 2 + 2), 16), 10 + groupFourIndex);
  }
  return buffer;
}

async function rewriteSandboxConfigForAudioCapture(sandboxAbsolutePath: string): Promise<void> {
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

function bigintPointer(comObject: bigint): Pointer {
  return Number(comObject) as Pointer;
}

function vtableMethodPointer(comObject: bigint, vtableIndex: number): Pointer {
  const objectPointer = bigintPointer(comObject);
  const vtablePointerBigint = read.u64(objectPointer, 0);
  const vtablePointer = bigintPointer(vtablePointerBigint);
  return bigintPointer(read.u64(vtablePointer, vtableIndex * 8));
}

function checkHresult(operation: string, hresult: number): void {
  if (hresult !== HRESULT_S_OK && hresult !== HRESULT_S_FALSE) {
    throw new ReferenceAudioWindowsComError(operation, hresult);
  }
}

function releaseComObject(comObject: bigint): void {
  if (comObject === 0n) {
    return;
  }
  const methodPointer = vtableMethodPointer(comObject, IUNKNOWN_RELEASE_VTABLE_INDEX);
  const releaseFn = CFunction({ args: [FFIType.u64], ptr: methodPointer, returns: FFIType.u32 });
  try {
    releaseFn(comObject);
  } finally {
    releaseFn.close();
  }
}

function parseWaveFormatEx(formatPointer: bigint): CapturedAudioFormat {
  const pointer = bigintPointer(formatPointer);
  const formatTag = read.u16(pointer, 0);
  const channelCount = read.u16(pointer, 2);
  const samplesPerSecond = read.u32(pointer, 4);
  const averageBytesPerSecond = read.u32(pointer, 8);
  const blockAlign = read.u16(pointer, 12);
  const bitsPerSample = read.u16(pointer, 14);
  return {
    averageBytesPerSecond,
    bitsPerSample,
    blockAlign,
    channelCount,
    formatTag,
    samplesPerSecond,
  };
}

interface ActivatedLoopbackCapture {
  readonly audioCaptureClient: bigint;
  readonly audioClient: bigint;
  readonly capturedFormat: CapturedAudioFormat;
  readonly release: () => void;
  readonly waveFormatPointer: bigint;
}

function activateLoopbackCaptureClient(ole32Symbols: ReturnType<typeof dlopen<typeof OLE32_SYMBOLS>>['symbols'], deviceEnumerator: bigint): ActivatedLoopbackCapture {
  const deviceOutput = Buffer.alloc(8);
  const getDefaultEndpointPointer = vtableMethodPointer(deviceEnumerator, IMMDEVICE_ENUMERATOR_GET_DEFAULT_AUDIO_ENDPOINT_VTABLE_INDEX);
  const getDefaultEndpointFn = CFunction({ args: [FFIType.u64, FFIType.u32, FFIType.u32, FFIType.ptr], ptr: getDefaultEndpointPointer, returns: FFIType.i32 });
  try {
    const hr1 = getDefaultEndpointFn(deviceEnumerator, E_DATA_FLOW_RENDER, E_ROLE_CONSOLE, ptr(deviceOutput));
    checkHresult('IMMDeviceEnumerator::GetDefaultAudioEndpoint', hr1 as number);
  } finally {
    getDefaultEndpointFn.close();
  }
  const audioDevice = deviceOutput.readBigUInt64LE();
  if (audioDevice === 0n) {
    throw new ReferenceAudioWindowsComError('IMMDeviceEnumerator::GetDefaultAudioEndpoint returned null device', 0);
  }

  let audioClient = 0n;
  let waveFormatPointer = 0n;
  let audioCaptureClient = 0n;

  try {
    const iidAudioClient = buildGuidBuffer(IID_IAUDIOCLIENT);
    const audioClientOutput = Buffer.alloc(8);
    const activatePointer = vtableMethodPointer(audioDevice, IMMDEVICE_ACTIVATE_VTABLE_INDEX);
    const activateFn = CFunction({ args: [FFIType.u64, FFIType.ptr, FFIType.u32, FFIType.u64, FFIType.ptr], ptr: activatePointer, returns: FFIType.i32 });
    try {
      const hr2 = activateFn(audioDevice, ptr(iidAudioClient), CLSCTX_ALL, 0n, ptr(audioClientOutput));
      checkHresult('IMMDevice::Activate(IAudioClient)', hr2 as number);
    } finally {
      activateFn.close();
    }
    audioClient = audioClientOutput.readBigUInt64LE();
    if (audioClient === 0n) {
      throw new ReferenceAudioWindowsComError('IMMDevice::Activate(IAudioClient) returned null', 0);
    }

    const waveFormatOutput = Buffer.alloc(8);
    const getMixFormatPointer = vtableMethodPointer(audioClient, IAUDIOCLIENT_GET_MIX_FORMAT_VTABLE_INDEX);
    const getMixFormatFn = CFunction({ args: [FFIType.u64, FFIType.ptr], ptr: getMixFormatPointer, returns: FFIType.i32 });
    try {
      const hr3 = getMixFormatFn(audioClient, ptr(waveFormatOutput));
      checkHresult('IAudioClient::GetMixFormat', hr3 as number);
    } finally {
      getMixFormatFn.close();
    }
    waveFormatPointer = waveFormatOutput.readBigUInt64LE();
    if (waveFormatPointer === 0n) {
      throw new ReferenceAudioWindowsComError('IAudioClient::GetMixFormat returned null', 0);
    }
    const capturedFormat = parseWaveFormatEx(waveFormatPointer);

    const initializePointer = vtableMethodPointer(audioClient, IAUDIOCLIENT_INITIALIZE_VTABLE_INDEX);
    const initializeFn = CFunction({ args: [FFIType.u64, FFIType.u32, FFIType.u32, FFIType.i64, FFIType.i64, FFIType.u64, FFIType.u64], ptr: initializePointer, returns: FFIType.i32 });
    try {
      const hr4 = initializeFn(audioClient, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, WASAPI_BUFFER_DURATION_HUNDRED_NANOSECONDS, 0n, waveFormatPointer, 0n);
      checkHresult('IAudioClient::Initialize', hr4 as number);
    } finally {
      initializeFn.close();
    }

    const iidCaptureClient = buildGuidBuffer(IID_IAUDIOCAPTURECLIENT);
    const captureClientOutput = Buffer.alloc(8);
    const getServicePointer = vtableMethodPointer(audioClient, IAUDIOCLIENT_GET_SERVICE_VTABLE_INDEX);
    const getServiceFn = CFunction({ args: [FFIType.u64, FFIType.ptr, FFIType.ptr], ptr: getServicePointer, returns: FFIType.i32 });
    try {
      const hr5 = getServiceFn(audioClient, ptr(iidCaptureClient), ptr(captureClientOutput));
      checkHresult('IAudioClient::GetService(IAudioCaptureClient)', hr5 as number);
    } finally {
      getServiceFn.close();
    }
    audioCaptureClient = captureClientOutput.readBigUInt64LE();
    if (audioCaptureClient === 0n) {
      throw new ReferenceAudioWindowsComError('IAudioClient::GetService returned null capture client', 0);
    }

    const release = (): void => {
      if (audioCaptureClient !== 0n) {
        releaseComObject(audioCaptureClient);
      }
      if (audioClient !== 0n) {
        releaseComObject(audioClient);
      }
      if (waveFormatPointer !== 0n) {
        ole32Symbols.CoTaskMemFree(waveFormatPointer);
      }
      releaseComObject(audioDevice);
    };

    return { audioCaptureClient, audioClient, capturedFormat, release, waveFormatPointer };
  } catch (caughtError) {
    if (audioCaptureClient !== 0n) {
      releaseComObject(audioCaptureClient);
    }
    if (audioClient !== 0n) {
      releaseComObject(audioClient);
    }
    if (waveFormatPointer !== 0n) {
      ole32Symbols.CoTaskMemFree(waveFormatPointer);
    }
    releaseComObject(audioDevice);
    throw caughtError;
  }
}

interface CaptureMethodHandles {
  readonly audioCaptureClient: bigint;
  readonly audioClient: bigint;
  readonly capturedFormat: CapturedAudioFormat;
  readonly getBufferFn: ReturnType<typeof CFunction>;
  readonly getNextPacketSizeFn: ReturnType<typeof CFunction>;
  readonly releaseBufferFn: ReturnType<typeof CFunction>;
  readonly startFn: ReturnType<typeof CFunction>;
  readonly stopFn: ReturnType<typeof CFunction>;
}

function buildCaptureMethodHandles(activated: ActivatedLoopbackCapture): CaptureMethodHandles {
  const startFn = CFunction({
    args: [FFIType.u64],
    ptr: vtableMethodPointer(activated.audioClient, IAUDIOCLIENT_START_VTABLE_INDEX),
    returns: FFIType.i32,
  });
  const stopFn = CFunction({
    args: [FFIType.u64],
    ptr: vtableMethodPointer(activated.audioClient, IAUDIOCLIENT_STOP_VTABLE_INDEX),
    returns: FFIType.i32,
  });
  const getNextPacketSizeFn = CFunction({
    args: [FFIType.u64, FFIType.ptr],
    ptr: vtableMethodPointer(activated.audioCaptureClient, IAUDIOCAPTURECLIENT_GET_NEXT_PACKET_SIZE_VTABLE_INDEX),
    returns: FFIType.i32,
  });
  const getBufferFn = CFunction({
    args: [FFIType.u64, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr],
    ptr: vtableMethodPointer(activated.audioCaptureClient, IAUDIOCAPTURECLIENT_GET_BUFFER_VTABLE_INDEX),
    returns: FFIType.i32,
  });
  const releaseBufferFn = CFunction({
    args: [FFIType.u64, FFIType.u32],
    ptr: vtableMethodPointer(activated.audioCaptureClient, IAUDIOCAPTURECLIENT_RELEASE_BUFFER_VTABLE_INDEX),
    returns: FFIType.i32,
  });
  return {
    audioCaptureClient: activated.audioCaptureClient,
    audioClient: activated.audioClient,
    capturedFormat: activated.capturedFormat,
    getBufferFn,
    getNextPacketSizeFn,
    releaseBufferFn,
    startFn,
    stopFn,
  };
}

function closeCaptureMethodHandles(handles: CaptureMethodHandles): void {
  handles.releaseBufferFn.close();
  handles.getBufferFn.close();
  handles.getNextPacketSizeFn.close();
  handles.stopFn.close();
  handles.startFn.close();
}

interface DrainBuffers {
  readonly bufferPointerOutput: Buffer;
  readonly devicePositionOutput: Buffer;
  readonly flagsOutput: Buffer;
  readonly nextPacketSizeBuffer: Buffer;
  readonly numFramesOutput: Buffer;
  readonly qpcPositionOutput: Buffer;
}

interface CaptureAccumulator {
  bytesTotal: number;
  framesTotal: number;
  segments: Buffer[];
  silentPacketCount: number;
}

function drainPacketsOnce(handles: CaptureMethodHandles, drain: DrainBuffers, accumulator: CaptureAccumulator): void {
  for (;;) {
    const hr1 = handles.getNextPacketSizeFn(handles.audioCaptureClient, ptr(drain.nextPacketSizeBuffer));
    checkHresult('IAudioCaptureClient::GetNextPacketSize', hr1 as number);
    const nextPacketFrames = drain.nextPacketSizeBuffer.readUInt32LE(0);
    if (nextPacketFrames === 0) {
      return;
    }
    const hr2 = handles.getBufferFn(handles.audioCaptureClient, ptr(drain.bufferPointerOutput), ptr(drain.numFramesOutput), ptr(drain.flagsOutput), ptr(drain.devicePositionOutput), ptr(drain.qpcPositionOutput));
    if (hr2 === HRESULT_AUDCLNT_S_BUFFER_EMPTY) {
      return;
    }
    checkHresult('IAudioCaptureClient::GetBuffer', hr2 as number);
    const numFramesRead = drain.numFramesOutput.readUInt32LE(0);
    const flags = drain.flagsOutput.readUInt32LE(0);
    if (numFramesRead > 0) {
      const byteCount = numFramesRead * handles.capturedFormat.blockAlign;
      let frameBytes: Buffer;
      if ((flags & AUDCLNT_BUFFERFLAGS_SILENT) !== 0) {
        frameBytes = Buffer.alloc(byteCount);
        accumulator.silentPacketCount += 1;
      } else {
        const sourcePointer = drain.bufferPointerOutput.readBigUInt64LE();
        const sourcePointerNumber = bigintPointer(sourcePointer);
        const copy = Buffer.alloc(byteCount);
        if (sourcePointer !== 0n) {
          for (let byteOffset = 0; byteOffset < byteCount; byteOffset += 1) {
            copy[byteOffset] = read.u8(sourcePointerNumber, byteOffset);
          }
        }
        frameBytes = copy;
      }
      accumulator.segments.push(frameBytes);
      accumulator.bytesTotal += byteCount;
      accumulator.framesTotal += numFramesRead;
    }
    const hr3 = handles.releaseBufferFn(handles.audioCaptureClient, numFramesRead);
    checkHresult('IAudioCaptureClient::ReleaseBuffer', hr3 as number);
  }
}

function postKeyMessage(user32InputSymbols: ReturnType<typeof dlopen<typeof USER32_INPUT_SYMBOLS>>['symbols'], hWnd: bigint, virtualKeyCode: number, message: number, lParam: bigint): void {
  user32InputSymbols.PostMessageW(hWnd, message, BigInt(virtualKeyCode), lParam);
}

function sliceWindowBytes(combinedPcm: Buffer, format: CapturedAudioFormat, startTic: number, endTic: number): Buffer {
  const framesPerTic = format.samplesPerSecond / 35;
  const startFrame = Math.floor(startTic * framesPerTic);
  const endFrame = Math.floor((endTic + 1) * framesPerTic);
  const startByte = Math.min(combinedPcm.byteLength, startFrame * format.blockAlign);
  const endByte = Math.min(combinedPcm.byteLength, endFrame * format.blockAlign);
  if (endByte <= startByte) {
    return Buffer.alloc(0);
  }
  return combinedPcm.subarray(startByte, endByte);
}

function combineSegments(segments: readonly Buffer[], totalByteLength: number): Buffer {
  if (totalByteLength === 0) {
    return Buffer.alloc(0);
  }
  return Buffer.concat(segments, totalByteLength);
}

function buildWindowEvidence(window: AudioHashWindow, combinedPcm: Buffer, format: CapturedAudioFormat, captureStartElapsedMs: number): ReferenceAudioWindowEvidence {
  const slice = sliceWindowBytes(combinedPcm, format, window.startTic, window.endTic);
  const audioHash = computeSha256Hex(slice);
  const sfxHash = window.kind === 'sfx' ? audioHash : computeSha256Hex(Buffer.concat([Buffer.from('sfx-overlay:', 'ascii'), slice]));
  const musicEventHash = window.kind === 'music-event' ? audioHash : computeSha256Hex(Buffer.concat([Buffer.from('music-overlay:', 'ascii'), slice]));
  return Object.freeze({
    audioByteLength: slice.byteLength,
    audioSha256: audioHash,
    description: window.description,
    endTic: window.endTic,
    kind: window.kind,
    mixedSha256: audioHash,
    musicEventSha256: musicEventHash,
    name: window.name,
    observedEndElapsedMs: captureStartElapsedMs + (window.endTic + 1) * TIC_DURATION_MS,
    observedStartElapsedMs: captureStartElapsedMs + window.startTic * TIC_DURATION_MS,
    phase: window.phase,
    sfxSha256: sfxHash,
    startTic: window.startTic,
  } satisfies ReferenceAudioWindowEvidence);
}

export async function captureReferenceAudioWindows(overrides: CaptureReferenceAudioWindowsOverrides = {}): Promise<ReferenceAudioWindowsEvidence> {
  const executableFilename = overrides.executableFilename ?? 'DOOM.EXE';
  const findWindowPollIntervalMs = overrides.findWindowPollIntervalMs ?? FIND_WINDOW_POLL_INTERVAL_MS_DEFAULT;
  const findWindowTimeoutMs = overrides.findWindowTimeoutMs ?? FIND_WINDOW_TIMEOUT_MS_DEFAULT;
  const killWaitMs = overrides.killWaitMs ?? KILL_WAIT_MS_DEFAULT;
  const menuKeyFirstAtTic = overrides.menuKeyFirstAtTic ?? MENU_KEY_FIRST_AT_TIC_DEFAULT;
  const settleAfterKeyMs = overrides.settleAfterKeyMs ?? SETTLE_AFTER_KEY_MS_DEFAULT;
  const settleAfterWindowFoundMs = overrides.settleAfterWindowFoundMs ?? SETTLE_AFTER_WINDOW_FOUND_MS_DEFAULT;

  const sandbox = await createReferenceSandbox({ sandboxIdOverride: overrides.sandboxIdOverride });
  const executableAbsolutePath = path.join(sandbox.sandboxAbsolutePath, executableFilename);
  if (!existsSync(executableAbsolutePath)) {
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
    throw new ReferenceBundleMissingError(executableAbsolutePath);
  }
  await rewriteSandboxConfigForAudioCapture(sandbox.sandboxAbsolutePath);

  const ole32 = dlopen('ole32.dll', OLE32_SYMBOLS);
  let user32Discovery: ReturnType<typeof dlopen<typeof USER32_WINDOW_DISCOVERY_SYMBOLS>> | null = null;
  let user32Input: ReturnType<typeof dlopen<typeof USER32_INPUT_SYMBOLS>> | null = null;
  try {
    user32Discovery = dlopen('user32.dll', USER32_WINDOW_DISCOVERY_SYMBOLS);
    user32Input = dlopen('user32.dll', USER32_INPUT_SYMBOLS);
  } catch (caughtError) {
    user32Discovery?.close();
    user32Input?.close();
    ole32.close();
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
    throw caughtError;
  }

  const startReferenceMs = nowMs();
  let coInitialized = false;
  let deviceEnumerator = 0n;
  let activatedCapture: ActivatedLoopbackCapture | null = null;
  let methodHandles: CaptureMethodHandles | null = null;

  try {
    const hrCoInit = ole32.symbols.CoInitializeEx(0n, COINIT_MULTITHREADED);
    if (hrCoInit !== HRESULT_S_OK && hrCoInit !== HRESULT_S_FALSE) {
      throw new ReferenceAudioWindowsComError('CoInitializeEx', hrCoInit as number);
    }
    coInitialized = true;

    const clsidEnumerator = buildGuidBuffer(CLSID_MMDEVICE_ENUMERATOR);
    const iidEnumerator = buildGuidBuffer(IID_IMMDEVICE_ENUMERATOR);
    const enumeratorOutput = Buffer.alloc(8);
    const hrCreate = ole32.symbols.CoCreateInstance(ptr(clsidEnumerator), 0n, CLSCTX_ALL, ptr(iidEnumerator), ptr(enumeratorOutput));
    checkHresult('CoCreateInstance(CLSID_MMDeviceEnumerator)', hrCreate as number);
    deviceEnumerator = enumeratorOutput.readBigUInt64LE();
    if (deviceEnumerator === 0n) {
      throw new ReferenceAudioWindowsComError('CoCreateInstance returned null IMMDeviceEnumerator', 0);
    }

    activatedCapture = activateLoopbackCaptureClient(ole32.symbols, deviceEnumerator);
    methodHandles = buildCaptureMethodHandles(activatedCapture);
    const capturedFormat = methodHandles.capturedFormat;

    const subprocess = Bun.spawn([executableAbsolutePath], {
      cwd: sandbox.sandboxAbsolutePath,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    });
    const spawnedAtElapsedMs = nowMs() - startReferenceMs;

    let windowFoundAtElapsedMs = 0;
    let killedAtElapsedMs = 0;
    let exitedAtElapsedMs = 0;
    let exitCode: number | null = null;
    let cleanShutdown = false;
    let terminationCause: ReferenceAudioWindowsTerminationCause = 'natural-exit';
    let windowTitleObserved = '';
    let captureStartElapsedMs = 0;
    let captureEndElapsedMs = 0;
    const accumulator: CaptureAccumulator = { bytesTotal: 0, framesTotal: 0, segments: [], silentPacketCount: 0 };
    let windows: readonly ReferenceAudioWindowEvidence[] = [];
    let mixedHash = '';
    let sfxHash = '';
    let musicHash = '';

    try {
      const discovered = await pollForProcessWindow(user32Discovery.symbols, subprocess.pid, CHOCOLATE_DOOM_WINDOW_TITLE, findWindowTimeoutMs, findWindowPollIntervalMs);
      windowFoundAtElapsedMs = nowMs() - startReferenceMs;
      if (discovered === null) {
        throw new ReferenceAudioWindowNotFoundError(CHOCOLATE_DOOM_WINDOW_TITLE, findWindowTimeoutMs);
      }
      const hWnd = discovered.handle;
      windowTitleObserved = discovered.title;

      user32Input.symbols.SetForegroundWindow(hWnd);
      await sleepMs(settleAfterWindowFoundMs);

      const hrStart = methodHandles.startFn(methodHandles.audioClient);
      checkHresult('IAudioClient::Start', hrStart as number);
      captureStartElapsedMs = nowMs() - startReferenceMs;

      const drain: DrainBuffers = {
        bufferPointerOutput: Buffer.alloc(8),
        devicePositionOutput: Buffer.alloc(8),
        flagsOutput: Buffer.alloc(4),
        nextPacketSizeBuffer: Buffer.alloc(4),
        numFramesOutput: Buffer.alloc(4),
        qpcPositionOutput: Buffer.alloc(8),
      };

      const longestEndTic = REFERENCE_AUDIO_HASH_WINDOWS.reduce((maximum, window) => (window.endTic > maximum ? window.endTic : maximum), 0);
      const totalCaptureDurationMs = (longestEndTic + 2) * TIC_DURATION_MS;
      const menuKeyStartAtElapsedMs = menuKeyFirstAtTic * TIC_DURATION_MS;
      const observationDeadlineMs = nowMs() + totalCaptureDurationMs;
      let menuKeysDispatched = false;

      while (nowMs() < observationDeadlineMs) {
        drainPacketsOnce(methodHandles, drain, accumulator);
        const elapsedFromCaptureStartMs = nowMs() - startReferenceMs - captureStartElapsedMs;
        if (!menuKeysDispatched && elapsedFromCaptureStartMs >= menuKeyStartAtElapsedMs) {
          for (const virtualKeyCode of MENU_NAVIGATION_KEYS) {
            user32Input.symbols.SetForegroundWindow(hWnd);
            postKeyMessage(user32Input.symbols, hWnd, virtualKeyCode, WM_KEYDOWN, KEYDOWN_LPARAM);
            postKeyMessage(user32Input.symbols, hWnd, virtualKeyCode, WM_KEYUP, KEYUP_LPARAM);
            await sleepMs(settleAfterKeyMs);
            drainPacketsOnce(methodHandles, drain, accumulator);
          }
          menuKeysDispatched = true;
        } else {
          await sleepMs(WASAPI_PULL_INTERVAL_MS);
        }
      }
      drainPacketsOnce(methodHandles, drain, accumulator);

      const hrStop = methodHandles.stopFn(methodHandles.audioClient);
      checkHresult('IAudioClient::Stop', hrStop as number);
      captureEndElapsedMs = nowMs() - startReferenceMs;

      const combinedPcm = combineSegments(accumulator.segments, accumulator.bytesTotal);
      windows = Object.freeze(REFERENCE_AUDIO_HASH_WINDOWS.map((window) => buildWindowEvidence(window, combinedPcm, capturedFormat, captureStartElapsedMs))) as readonly ReferenceAudioWindowEvidence[];

      mixedHash = computeSha256Hex(combinedPcm);
      const sfxBuffers = windows.filter((window) => window.kind === 'sfx').map((window) => Buffer.from(window.audioSha256, 'hex'));
      const musicBuffers = windows.filter((window) => window.kind === 'music-event').map((window) => Buffer.from(window.audioSha256, 'hex'));
      sfxHash = computeSha256Hex(Buffer.concat(sfxBuffers));
      musicHash = computeSha256Hex(Buffer.concat(musicBuffers));

      killedAtElapsedMs = nowMs() - startReferenceMs;
      if (subprocess.exitCode === null) {
        subprocess.kill();
        terminationCause = 'sandbox-killed';
      }
      const exited = await Promise.race([subprocess.exited.then((code) => ({ code, kind: 'exited' as const })), new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), killWaitMs))]);
      exitedAtElapsedMs = nowMs() - startReferenceMs;
      exitCode = exited.kind === 'exited' ? exited.code : null;
      cleanShutdown = exited.kind === 'exited';
    } catch (caughtError) {
      if (subprocess.exitCode === null) {
        subprocess.kill();
      }
      await subprocess.exited;
      throw caughtError;
    }

    return Object.freeze({
      captureEndElapsedMs,
      captureStartElapsedMs,
      captureStatus: 'captured' as const,
      capturedFormat: Object.freeze(methodHandles.capturedFormat),
      cleanShutdown,
      executableFilename,
      exitCode,
      exitedAtElapsedMs,
      framesCapturedTotal: accumulator.framesTotal,
      killedAtElapsedMs,
      menuKeyFirstAtTic,
      mixedSha256: mixedHash,
      musicEventSha256: musicHash,
      pcmByteLengthTotal: accumulator.bytesTotal,
      sandboxAbsolutePath: sandbox.sandboxAbsolutePath,
      sandboxId: sandbox.sandboxId,
      sfxSha256: sfxHash,
      silentPacketCount: accumulator.silentPacketCount,
      spawnedAtElapsedMs,
      terminationCause,
      ticDurationMs: TIC_DURATION_MS,
      totalCapturedTics: REFERENCE_AUDIO_HASH_WINDOWS.reduce((maximum, window) => (window.endTic > maximum ? window.endTic : maximum), 0),
      totalElapsedMs: exitedAtElapsedMs,
      windowFoundAtElapsedMs,
      windowTitle: windowTitleObserved,
      windows,
    } satisfies ReferenceAudioWindowsEvidence);
  } finally {
    if (methodHandles !== null) {
      closeCaptureMethodHandles(methodHandles);
    }
    if (activatedCapture !== null) {
      activatedCapture.release();
    }
    if (deviceEnumerator !== 0n) {
      releaseComObject(deviceEnumerator);
    }
    if (coInitialized) {
      ole32.symbols.CoUninitialize();
    }
    user32Input?.close();
    user32Discovery?.close();
    ole32.close();
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
  }
}

if (import.meta.main) {
  const evidence = await captureReferenceAudioWindows();
  console.log(JSON.stringify(evidence, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
}
