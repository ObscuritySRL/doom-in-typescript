/** Exact runtime command required for the playable parity path. */
export const BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND = 'bun run doom.ts';

/** Host buffer size for one 35 Hz game tic at 44.1 kHz. */
export const BUN_WIN32_AUDIO_HOST_BUFFER_SAMPLE_COUNT = 1_260;

/** Stereo PCM output. */
export const BUN_WIN32_AUDIO_HOST_CHANNEL_COUNT = 2;

/** WinMM host kind selected by this step. */
export const BUN_WIN32_AUDIO_HOST_KIND = 'winmm';

/** Live audio is a Windows-only product host for this Bun Win32 path. */
export const BUN_WIN32_AUDIO_HOST_PLATFORM = 'win32';

/** Package providing the WinMM binding for the Bun host. */
export const BUN_WIN32_AUDIO_HOST_PROVIDER = '@bun-win32/winmm';

/** Default PCM sample rate used by the host selection. */
export const BUN_WIN32_AUDIO_HOST_SAMPLE_RATE_HZ = 44_100;

/** Audit step that established the live-audio-host gap. */
export const LIVE_AUDIO_HOST_AUDIT_STEP_ID = '01-011';

/** Explicit missing surface replaced by this product host selection. */
export const LIVE_AUDIO_HOST_NULL_SURFACE = 'live-audio-host';

/** Replay-visible transition emitted by this step. */
export const OPEN_AUDIO_HOST_TRANSITION = 'missing-live-audio-host->bun-win32-audio-host-opened';

/** Device role opened by the audio host. */
export type BunWin32AudioHostDeviceRole = 'music' | 'sfx';

/** Roles opened by this audio host, in deterministic order. */
const SELECTED_ROLES: readonly BunWin32AudioHostDeviceRole[] = Object.freeze(['music', 'sfx']);

/** Request passed to the live WinMM opener for each device role. */
export interface BunWin32AudioHostDeviceOpenRequest {
  readonly bufferSampleCount: number;
  readonly channelCount: number;
  readonly hostKind: typeof BUN_WIN32_AUDIO_HOST_KIND;
  readonly provider: typeof BUN_WIN32_AUDIO_HOST_PROVIDER;
  readonly role: BunWin32AudioHostDeviceRole;
  readonly sampleRateHz: number;
}

/** Live host receipt returned by the injected opener. */
export interface BunWin32AudioHostDeviceOpenReceipt {
  readonly deviceName: string;
  readonly handle: bigint;
  readonly role: BunWin32AudioHostDeviceRole;
}

/** Closer used to release receipts that this step opened. */
export type BunWin32AudioHostDeviceCloser = (receipt: BunWin32AudioHostDeviceOpenReceipt) => void;

/** Deterministic host selection shared by music and sfx. */
export interface BunWin32AudioHostSelection {
  readonly bufferSampleCount: number;
  readonly channelCount: number;
  readonly hostKind: typeof BUN_WIN32_AUDIO_HOST_KIND;
  readonly platform: typeof BUN_WIN32_AUDIO_HOST_PLATFORM;
  readonly provider: typeof BUN_WIN32_AUDIO_HOST_PROVIDER;
  readonly runtimeCommand: typeof BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND;
  readonly sampleRateHz: number;
}

/** Request accepted by {@link selectAndOpenBunWin32AudioHost}. */
export interface SelectAndOpenBunWin32AudioHostRequest {
  readonly bufferSampleCount?: number;
  readonly channelCount?: number;
  /**
   * Optional closer invoked on every receipt this call has opened when a
   * later open or validation throws. The original failure is re-thrown
   * after cleanup; closer errors are swallowed so they cannot mask it.
   */
  readonly closeDevice?: BunWin32AudioHostDeviceCloser;
  readonly openDevice: (request: BunWin32AudioHostDeviceOpenRequest) => BunWin32AudioHostDeviceOpenReceipt;
  readonly openedAtTic: number;
  readonly platform: string;
  readonly runtimeCommand: string;
  readonly sampleRateHz?: number;
}

/** Replay-stable evidence for side-by-side comparison. */
export interface SelectAndOpenBunWin32AudioHostReplayEvidence {
  readonly bufferSampleCount: number;
  readonly channelCount: number;
  readonly hostKind: typeof BUN_WIN32_AUDIO_HOST_KIND;
  readonly openedAtTic: number;
  readonly platform: typeof BUN_WIN32_AUDIO_HOST_PLATFORM;
  readonly provider: typeof BUN_WIN32_AUDIO_HOST_PROVIDER;
  readonly runtimeCommand: typeof BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND;
  readonly sampleRateHz: number;
  readonly selectedRoles: readonly BunWin32AudioHostDeviceRole[];
  readonly sourceAuditStepId: typeof LIVE_AUDIO_HOST_AUDIT_STEP_ID;
  readonly sourceNullSurface: typeof LIVE_AUDIO_HOST_NULL_SURFACE;
  readonly transition: typeof OPEN_AUDIO_HOST_TRANSITION;
}

/** Result returned after the host is selected and both device roles are opened. */
export interface SelectAndOpenBunWin32AudioHostResult {
  readonly deterministicReplayCompatible: true;
  readonly liveDevices: readonly BunWin32AudioHostDeviceOpenReceipt[];
  readonly replayEvidence: SelectAndOpenBunWin32AudioHostReplayEvidence;
  readonly selection: BunWin32AudioHostSelection;
  readonly transition: typeof OPEN_AUDIO_HOST_TRANSITION;
}

/**
 * Select the Bun Win32 audio host and open the live music + sfx devices.
 *
 * @param request Host selection request carrying the runtime command,
 * platform, deterministic open tic, and injected live device opener.
 * @returns Opened host state plus replay-stable evidence that excludes
 * live handles.
 * @example
 * ```ts
 * import {
 *   BUN_WIN32_AUDIO_HOST_PLATFORM,
 *   BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
 *   selectAndOpenBunWin32AudioHost,
 * } from './src/playable/audio-product-integration/selectAndOpenBunWin32AudioHost.ts';
 *
 * const host = selectAndOpenBunWin32AudioHost({
 *   openDevice: (request) => ({
 *     deviceName: `waveOut:${request.role}:0`,
 *     handle: request.role === 'sfx' ? 0x1001n : 0x2002n,
 *     role: request.role,
 *   }),
 *   openedAtTic: 0,
 *   platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
 *   runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
 * });
 * console.log(host.replayEvidence.transition);
 * ```
 */
export function selectAndOpenBunWin32AudioHost(request: SelectAndOpenBunWin32AudioHostRequest): SelectAndOpenBunWin32AudioHostResult {
  if (request.runtimeCommand !== BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND) {
    throw new Error(`audio host requires runtime command ${BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND}, got ${request.runtimeCommand}`);
  }
  if (request.platform !== BUN_WIN32_AUDIO_HOST_PLATFORM) {
    throw new Error(`audio host requires platform ${BUN_WIN32_AUDIO_HOST_PLATFORM}, got ${request.platform}`);
  }

  const bufferSampleCount = request.bufferSampleCount ?? BUN_WIN32_AUDIO_HOST_BUFFER_SAMPLE_COUNT;
  const channelCount = request.channelCount ?? BUN_WIN32_AUDIO_HOST_CHANNEL_COUNT;
  const sampleRateHz = request.sampleRateHz ?? BUN_WIN32_AUDIO_HOST_SAMPLE_RATE_HZ;

  validateNonNegativeInteger('openedAtTic', request.openedAtTic);
  validatePositiveInteger('bufferSampleCount', bufferSampleCount);
  validatePositiveInteger('channelCount', channelCount);
  validatePositiveInteger('sampleRateHz', sampleRateHz);

  const selection: BunWin32AudioHostSelection = Object.freeze({
    bufferSampleCount,
    channelCount,
    hostKind: BUN_WIN32_AUDIO_HOST_KIND,
    platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
    provider: BUN_WIN32_AUDIO_HOST_PROVIDER,
    runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
    sampleRateHz,
  });

  const opened: BunWin32AudioHostDeviceOpenReceipt[] = [];
  try {
    for (const role of SELECTED_ROLES) {
      const openRequest: BunWin32AudioHostDeviceOpenRequest = Object.freeze({
        bufferSampleCount: selection.bufferSampleCount,
        channelCount: selection.channelCount,
        hostKind: selection.hostKind,
        provider: selection.provider,
        role,
        sampleRateHz: selection.sampleRateHz,
      });
      const receipt = request.openDevice(openRequest);
      opened.push(receipt);
      validateOpenReceipt(receipt, role);
    }
  } catch (error) {
    closeOpenedDevices(opened, request.closeDevice);
    throw error;
  }

  const liveDevices = Object.freeze(
    opened.map((receipt) =>
      Object.freeze({
        deviceName: receipt.deviceName,
        handle: receipt.handle,
        role: receipt.role,
      }),
    ),
  );

  return Object.freeze({
    deterministicReplayCompatible: true,
    liveDevices,
    replayEvidence: Object.freeze({
      bufferSampleCount,
      channelCount,
      hostKind: BUN_WIN32_AUDIO_HOST_KIND,
      openedAtTic: request.openedAtTic,
      platform: BUN_WIN32_AUDIO_HOST_PLATFORM,
      provider: BUN_WIN32_AUDIO_HOST_PROVIDER,
      runtimeCommand: BUN_WIN32_AUDIO_HOST_RUNTIME_COMMAND,
      sampleRateHz,
      selectedRoles: SELECTED_ROLES,
      sourceAuditStepId: LIVE_AUDIO_HOST_AUDIT_STEP_ID,
      sourceNullSurface: LIVE_AUDIO_HOST_NULL_SURFACE,
      transition: OPEN_AUDIO_HOST_TRANSITION,
    }),
    selection,
    transition: OPEN_AUDIO_HOST_TRANSITION,
  });
}

function closeOpenedDevices(receipts: readonly BunWin32AudioHostDeviceOpenReceipt[], closeDevice: BunWin32AudioHostDeviceCloser | undefined): void {
  if (!closeDevice) {
    return;
  }
  for (const receipt of receipts) {
    try {
      closeDevice(receipt);
    } catch {
      // Swallow close errors during cleanup; the original failure must take precedence.
    }
  }
}

function validateNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
}

function validateOpenReceipt(receipt: BunWin32AudioHostDeviceOpenReceipt, expectedRole: BunWin32AudioHostDeviceRole): void {
  if (receipt.role !== expectedRole) {
    throw new Error(`audio host opener returned role ${receipt.role} for ${expectedRole}`);
  }
  if (typeof receipt.deviceName !== 'string' || receipt.deviceName.length === 0) {
    throw new Error(`audio host opener returned an empty device name for ${expectedRole}`);
  }
  if (typeof receipt.handle !== 'bigint' || receipt.handle <= 0n) {
    throw new Error(`audio host opener returned an invalid handle for ${expectedRole}`);
  }
}

function validatePositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
}
