import type { MusicDeviceAction } from '../../audio/musicSystem.ts';
import type { StartSoundResult } from '../../audio/soundSystem.ts';

export const AUDIO_HASH_WINDOW_SCHEMA_VERSION = 1;
export const MISSING_LIVE_AUDIO_AUDIT_STEP = '01-011';
export const PRODUCT_RUNTIME_COMMAND = 'bun run doom.ts';

export interface AudioHashWindow {
  readonly events: readonly AudioHashWindowEvent[];
  readonly firstGameTic: number;
  readonly lastGameTic: number;
}

export type AudioHashWindowEvent = AudioHashWindowMusicDeviceActionEvent | AudioHashWindowSoundEffectResultEvent;

export interface AudioHashWindowMusicDeviceActionEvent {
  readonly action: MusicDeviceAction;
  readonly gameTic: number;
  readonly kind: 'music-device-action';
  readonly scoreHash: string | null;
}

export interface AudioHashWindowSoundEffectResultEvent {
  readonly gameTic: number;
  readonly kind: 'sound-effect-result';
  readonly result: StartSoundResult;
}

export interface CaptureAudioHashWindowsRequest {
  readonly runtimeCommand: string;
  readonly windows: readonly AudioHashWindow[];
}

export interface CaptureAudioHashWindowsResult {
  readonly captureHash: string;
  readonly captureSignature: string;
  readonly replayChecksum: number;
  readonly schemaVersion: number;
  readonly windows: readonly CapturedAudioHashWindow[];
}

export interface CapturedAudioHashWindow {
  readonly eventCount: number;
  readonly firstGameTic: number;
  readonly lastGameTic: number;
  readonly windowHash: string;
  readonly windowSignature: string;
}

/**
 * Capture deterministic, handle-free audio hash windows for replay parity.
 *
 * @param request Bun runtime command and ordered audio windows to capture.
 * @returns Frozen per-window hashes plus an aggregate capture hash.
 *
 * @example
 * ```ts
 * const result = captureAudioHashWindows({
 *   runtimeCommand: PRODUCT_RUNTIME_COMMAND,
 *   windows: [{ events: [], firstGameTic: 0, lastGameTic: 34 }],
 * });
 * console.log(result.captureHash);
 * ```
 */
export function captureAudioHashWindows(request: CaptureAudioHashWindowsRequest): CaptureAudioHashWindowsResult {
  if (request.runtimeCommand !== PRODUCT_RUNTIME_COMMAND) {
    throw new Error(`captureAudioHashWindows requires ${PRODUCT_RUNTIME_COMMAND}`);
  }

  const capturedWindows: CapturedAudioHashWindow[] = [];

  for (const window of request.windows) {
    validateNonNegativeInteger(window.firstGameTic, 'window.firstGameTic');
    validateNonNegativeInteger(window.lastGameTic, 'window.lastGameTic');

    if (window.lastGameTic < window.firstGameTic) {
      throw new RangeError(`window lastGameTic ${window.lastGameTic} is before firstGameTic ${window.firstGameTic}`);
    }

    const eventSignatures = window.events.map((event) => captureEventSignature(event, window));
    const windowSignature = `window:${window.firstGameTic}-${window.lastGameTic}:${eventSignatures.join(';')}`;
    const windowHash = hashText(windowSignature);

    capturedWindows.push(
      Object.freeze({
        eventCount: window.events.length,
        firstGameTic: window.firstGameTic,
        lastGameTic: window.lastGameTic,
        windowHash,
        windowSignature,
      }),
    );
  }

  const captureSignature = `audio-hash-window-schema=${AUDIO_HASH_WINDOW_SCHEMA_VERSION}|${capturedWindows.map((window) => window.windowHash).join('|')}`;
  const captureHash = hashText(captureSignature);

  return Object.freeze({
    captureHash,
    captureSignature,
    replayChecksum: checksumFromHash(captureHash),
    schemaVersion: AUDIO_HASH_WINDOW_SCHEMA_VERSION,
    windows: Object.freeze(capturedWindows),
  });
}

function captureEventSignature(event: AudioHashWindowEvent, window: AudioHashWindow): string {
  validateNonNegativeInteger(event.gameTic, 'event.gameTic');

  if (event.gameTic < window.firstGameTic || event.gameTic > window.lastGameTic) {
    throw new RangeError(`event gameTic ${event.gameTic} is outside window [${window.firstGameTic}, ${window.lastGameTic}]`);
  }

  switch (event.kind) {
    case 'music-device-action':
      return `tic=${event.gameTic}:music:${musicActionSignature(event.action, event.scoreHash)}`;
    case 'sound-effect-result':
      return `tic=${event.gameTic}:sound-effect:${soundEffectResultSignature(event.result)}`;
  }
}

function checksumFromHash(hash: string): number {
  return Number.parseInt(hash.slice(0, 8), 16);
}

function hashText(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

function musicActionSignature(action: MusicDeviceAction, scoreHash: string | null): string {
  switch (action.kind) {
    case 'pause-song':
      return 'pause-song';
    case 'play-song':
      validateMusicNumber(action.musicNum, 'musicNum');
      validateScoreHash(scoreHash);
      return `play-song:looping=${action.looping}:music=${action.musicNum}:score=${scoreHash}`;
    case 'resume-song':
      return 'resume-song';
    case 'set-volume':
      validateMusicVolume(action.volume);
      return `set-volume:volume=${action.volume}`;
    case 'stop-song':
      validateMusicNumber(action.musicNum, 'musicNum');
      return `stop-song:music=${action.musicNum}`;
  }
}

function soundEffectResultSignature(result: StartSoundResult): string {
  switch (result.kind) {
    case 'inaudible':
    case 'link-silenced':
    case 'no-channel':
      return result.kind;
    case 'started':
      validateNonNegativeInteger(result.cnum, 'result.cnum');
      validateNonNegativeInteger(result.pitch, 'result.pitch');
      validateNonNegativeInteger(result.separation, 'result.separation');
      validateNonNegativeInteger(result.sfxId, 'result.sfxId');
      validateNonNegativeInteger(result.volume, 'result.volume');
      return `started:channel=${result.cnum}:pitch=${result.pitch}:separation=${result.separation}:sound=${result.sfxId}:volume=${result.volume}`;
  }
}

function validateNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer, got ${value}`);
  }
}

function validateMusicNumber(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 67) {
    throw new RangeError(`${label} must be a valid music number in [1, 67], got ${value}`);
  }
}

function validateMusicVolume(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    throw new RangeError(`music volume must be an integer in [0, 127], got ${value}`);
  }
}

function validateScoreHash(value: string | null): void {
  if (value === null || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError('play-song audio hash events require a lowercase 64-character scoreHash');
  }
}
