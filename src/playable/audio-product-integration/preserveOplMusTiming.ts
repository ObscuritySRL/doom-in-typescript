import type { MusicSystemState } from '../../audio/musicSystem.ts';
import { advanceMusic } from '../../audio/musicSystem.ts';

export const MISSING_LIVE_AUDIO_AUDIT_STEP_ID = '01-011';
export const OPL_MUS_QUICKTICKS_PER_GAME_TIC = 4;
export const PLAYABLE_RUNTIME_COMMAND = 'bun run doom.ts';

export interface OplMusTimingWindowEvidence {
  readonly dispatchedEventCount: number;
  readonly eventHash: string;
  readonly eventSignature: string;
  readonly gameTic: number;
  readonly gameTics: number;
  readonly quickTicks: number;
}

export interface OplMusTimingWindowRequest {
  readonly gameTic: number;
  readonly gameTics: number;
}

export interface PreserveOplMusTimingEvidence {
  readonly auditStepId: typeof MISSING_LIVE_AUDIO_AUDIT_STEP_ID;
  readonly replayChecksum: number;
  readonly replayHash: string;
  readonly runtimeCommand: typeof PLAYABLE_RUNTIME_COMMAND;
  readonly totalDispatchedEventCount: number;
  readonly totalGameTics: number;
  readonly totalQuickTicks: number;
  readonly windows: readonly OplMusTimingWindowEvidence[];
}

export interface PreserveOplMusTimingRequest {
  readonly runtimeCommand: string;
  readonly system: MusicSystemState;
  readonly windows: readonly OplMusTimingWindowRequest[];
}

function checksumText(text: string): number {
  let checksum = 0x811c9dc5;
  for (let characterIndex = 0; characterIndex < text.length; characterIndex += 1) {
    checksum ^= text.charCodeAt(characterIndex);
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return checksum >>> 0;
}

function hashText(text: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(text);
  return hasher.digest('hex');
}

function serializeDispatchedEvents(dispatchedEvents: ReturnType<typeof advanceMusic>): string {
  return dispatchedEvents
    .map((dispatchedEvent) => {
      const serializedEvent = JSON.stringify(dispatchedEvent);
      return serializedEvent ?? 'undefined';
    })
    .join('\n');
}

function validateRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== PLAYABLE_RUNTIME_COMMAND) {
    throw new Error(`preserveOplMusTiming requires ${PLAYABLE_RUNTIME_COMMAND}, got ${runtimeCommand}`);
  }
}

function validateTimingWindow(timingWindow: OplMusTimingWindowRequest): void {
  if (!Number.isInteger(timingWindow.gameTic) || timingWindow.gameTic < 0) {
    throw new RangeError(`gameTic must be a non-negative integer, got ${timingWindow.gameTic}`);
  }
  if (!Number.isInteger(timingWindow.gameTics) || timingWindow.gameTics < 0) {
    throw new RangeError(`gameTics must be a non-negative integer, got ${timingWindow.gameTics}`);
  }
}

export function preserveOplMusTiming(request: PreserveOplMusTimingRequest): PreserveOplMusTimingEvidence {
  validateRuntimeCommand(request.runtimeCommand);

  const windows: OplMusTimingWindowEvidence[] = [];
  let totalDispatchedEventCount = 0;
  let totalGameTics = 0;
  let totalQuickTicks = 0;

  for (const timingWindow of request.windows) {
    validateTimingWindow(timingWindow);

    const dispatchedEvents = advanceMusic(request.system, timingWindow.gameTics);
    const eventSignature = serializeDispatchedEvents(dispatchedEvents);
    const quickTicks = timingWindow.gameTics * OPL_MUS_QUICKTICKS_PER_GAME_TIC;

    totalDispatchedEventCount += dispatchedEvents.length;
    totalGameTics += timingWindow.gameTics;
    totalQuickTicks += quickTicks;

    windows.push(
      Object.freeze<OplMusTimingWindowEvidence>({
        dispatchedEventCount: dispatchedEvents.length,
        eventHash: hashText(eventSignature),
        eventSignature,
        gameTic: timingWindow.gameTic,
        gameTics: timingWindow.gameTics,
        quickTicks,
      }),
    );
  }

  const replayPayload = [
    MISSING_LIVE_AUDIO_AUDIT_STEP_ID,
    PLAYABLE_RUNTIME_COMMAND,
    String(OPL_MUS_QUICKTICKS_PER_GAME_TIC),
    ...windows.map((timingWindow) => `${timingWindow.gameTic}:${timingWindow.gameTics}:${timingWindow.quickTicks}:${timingWindow.dispatchedEventCount}:${timingWindow.eventHash}`),
  ].join('|');

  return Object.freeze<PreserveOplMusTimingEvidence>({
    auditStepId: MISSING_LIVE_AUDIO_AUDIT_STEP_ID,
    replayChecksum: checksumText(replayPayload),
    replayHash: hashText(replayPayload),
    runtimeCommand: PLAYABLE_RUNTIME_COMMAND,
    totalDispatchedEventCount,
    totalGameTics,
    totalQuickTicks,
    windows: Object.freeze(windows),
  });
}
