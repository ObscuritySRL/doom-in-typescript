/**
 * Music event log format for oracle music-parity verification.
 *
 * Defines the event vocabulary, payload shape, and MUS/MIDI constants
 * for capturing discrete music events at specific tics during oracle
 * reference runs.  Each entry records a music state change (track
 * change, pause, resume, or stop) rather than periodic PCM hashes,
 * because music is event-driven and synthesized differently depending
 * on the music device.
 *
 * Sound effects are tracked separately by the audio-hash format
 * (step 02-006).  This format covers music events only.
 *
 * @example
 * ```ts
 * import { MUS_MAX_CHANNELS, MUSIC_EVENT_KINDS } from "../src/oracles/musicEventLog.ts";
 * console.log(MUS_MAX_CHANNELS); // 16
 * ```
 */

import type { OracleArtifact } from './schema.ts';
import type { RunMode } from './referenceRunManifest.ts';

/**
 * Minimum music volume on the Doom 0-15 integer scale (F-026).
 *
 * Volume 0 means music is audibly silent but the music device is
 * still active and processing events.
 */
export const MUSIC_VOLUME_MIN = 0;

/**
 * Maximum music volume on the Doom 0-15 integer scale (F-026).
 *
 * The menu enforces this ceiling.  Volume changes take effect
 * immediately without restart.
 */
export const MUSIC_VOLUME_MAX = 15;

/**
 * Maximum number of MUS format channels (F-026 mus-to-midi-runtime).
 *
 * MUS lumps support up to 16 channels, with channel 15 reserved
 * for percussion.
 */
export const MUS_MAX_CHANNELS = 16;

/**
 * MUS channel reserved for percussion instruments (F-026).
 *
 * Mapped to MIDI channel 9 (MIDI_PERCUSSION_CHANNEL) during
 * MUS-to-MIDI runtime conversion.
 */
export const MUS_PERCUSSION_CHANNEL = 15;

/**
 * MIDI channel used for percussion after MUS-to-MIDI conversion (F-026).
 *
 * MUS channel 15 maps to MIDI channel 9, which is the General MIDI
 * percussion channel.
 */
export const MIDI_PERCUSSION_CHANNEL = 9;

/** Discriminant tag for a music event log entry. */
export type MusicEventKind = 'change-music' | 'pause-music' | 'resume-music' | 'stop-music';

/**
 * Frozen, ASCIIbetically sorted list of every valid music event kind.
 *
 * The four kinds cover the complete set of observable music state
 * transitions in vanilla Doom: starting a new track, pausing,
 * resuming, and stopping.
 */
export const MUSIC_EVENT_KINDS: readonly MusicEventKind[] = Object.freeze(['change-music', 'pause-music', 'resume-music', 'stop-music'] as const);

/**
 * A music track change event.
 *
 * Emitted when S_ChangeMusic is called to start a new music track.
 * The lump name identifies the MUS lump in the WAD (e.g. "D_INTRO",
 * "D_E1M5").  The looping flag indicates whether the track repeats
 * after reaching the end marker.
 */
export interface ChangeMusicEvent {
  /** Game tic number at which this event occurred (0-based). */
  readonly tic: number;
  /** Discriminant: music track change. */
  readonly kind: 'change-music';
  /** MUS lump name from the WAD (e.g. "D_INTRO", "D_E1M5"). */
  readonly lumpName: string;
  /** Whether the track loops after reaching the MUS end marker. */
  readonly looping: boolean;
}

/**
 * A music pause event.
 *
 * Emitted when S_PauseSound pauses music playback (e.g. when the
 * pause key is pressed or the menu opens in certain contexts).
 * The music device stops producing output but retains its playback
 * position.
 */
export interface PauseMusicEvent {
  /** Game tic number at which this event occurred (0-based). */
  readonly tic: number;
  /** Discriminant: music paused. */
  readonly kind: 'pause-music';
}

/**
 * A music resume event.
 *
 * Emitted when S_ResumeSound resumes previously paused music
 * playback.  The music device resumes from its saved position.
 */
export interface ResumeMusicEvent {
  /** Game tic number at which this event occurred (0-based). */
  readonly tic: number;
  /** Discriminant: music resumed. */
  readonly kind: 'resume-music';
}

/**
 * A music stop event.
 *
 * Emitted when S_StopMusic explicitly stops music playback.
 * The music device ceases output and the playback position is lost.
 */
export interface StopMusicEvent {
  /** Game tic number at which this event occurred (0-based). */
  readonly tic: number;
  /** Discriminant: music stopped. */
  readonly kind: 'stop-music';
}

/**
 * Discriminated union of all music event types.
 *
 * The `kind` field serves as the discriminant for narrowing.
 * Events are ordered ascending by tic number within a payload;
 * multiple events at the same tic are permitted and processed
 * in array order.
 */
export type MusicEvent = ChangeMusicEvent | PauseMusicEvent | ResumeMusicEvent | StopMusicEvent;

/**
 * Payload for a music-event-log oracle artifact.
 *
 * Entries must be sorted ascending by tic number.  Each entry
 * records a discrete music state change rather than a periodic
 * sample, because music is event-driven.  The musicDevice and
 * musicVolume fields record the reference configuration for
 * context but do not vary per-event in automated oracle runs.
 */
export interface MusicEventLogPayload {
  /** Human-readable description of what this music event log verifies. */
  readonly description: string;
  /** Which run mode this music event log was captured from. */
  readonly targetRunMode: RunMode;
  /** Tic rate in Hz; must match the reference target (35). */
  readonly ticRateHz: number;
  /**
   * Music device identifier from default.cfg (F-033).
   * 3 = General MIDI (reference default).
   */
  readonly musicDevice: number;
  /**
   * Music volume from default.cfg, 0-15 integer scale (F-026).
   * 8 is the reference default.
   */
  readonly musicVolume: number;
  /** Ordered sequence of music events, sorted ascending by tic. */
  readonly events: readonly MusicEvent[];
}

/** Type alias for a complete music-event-log oracle artifact. */
export type MusicEventLogArtifact = OracleArtifact<MusicEventLogPayload>;

/**
 * Frozen empty music event log payload for title-loop captures where
 * no music events have been recorded yet.  Used as a template before
 * the reference capture populates events.
 */
export const EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG: MusicEventLogPayload = Object.freeze({
  description: 'Empty music event log template for title/demo attract loop capture',
  targetRunMode: 'title-loop',
  ticRateHz: 35,
  musicDevice: 3,
  musicVolume: 8,
  events: Object.freeze([]),
} satisfies MusicEventLogPayload);

/**
 * Frozen empty music event log payload for demo-playback captures
 * where no music events have been recorded yet.  Used as a template
 * before the reference capture populates events.
 */
export const EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG: MusicEventLogPayload = Object.freeze({
  description: 'Empty music event log template for demo playback capture',
  targetRunMode: 'demo-playback',
  ticRateHz: 35,
  musicDevice: 3,
  musicVolume: 8,
  events: Object.freeze([]),
} satisfies MusicEventLogPayload);
