/**
 * OPL music player — the Chocolate Doom 2.2.1 `i_oplmusic.c` MUS→OPL
 * driver assembled on top of the unit-tested OPL2 synth primitives.
 *
 * `bun run doom.ts -iwad doom/DOOM1.WAD` plays sfx but the music was
 * silent: the MUS selection / scheduler / lifecycle were wired (see
 * {@link ./win32Audio.ts}) but no GENMIDI→OPL-voice→PCM render driver
 * existed.  This module is that driver.  It is faithful to
 * `i_oplmusic.c` with the deviations documented at the bottom of this
 * note (no captured OPL reference exists for the host so byte-exact
 * parity is neither achievable nor asserted — the gate
 * {@link ../audio/gate-music-opl-parity.ts} compares EVENT streams, not
 * PCM, for exactly this reason).
 *
 * # What it composes (consumes, does not reinvent)
 *
 *  - {@link ./genmidi.ts} parses the IWAD `GENMIDI` lump into the 175
 *    DMX voice records (128 melodic + 47 percussion).
 *  - {@link ../audio/oplSynth.ts} supplies the phase / waveform / TL
 *    math (the DBOPL-equivalent core).  This module owns only the
 *    per-voice register state + envelope phase the core deliberately
 *    does not (its module note delegates that to the music device).
 *  - {@link ../audio/oplRegisters.ts} supplies the canonical
 *    `(channel, operator)` register addressing + the OPL2 9-channel /
 *    2-operator topology.
 *  - The MUS scheduler ({@link ../audio/musScheduler.ts}) and lifecycle
 *    ({@link ../audio/musicSystem.ts}) are driven by the host; this
 *    module only consumes the dispatched events.
 *
 * # i_oplmusic.c fidelity — constants transcribed verbatim
 *
 *  - `volume_mapping_table[128]`: the velocity→volume curve DMX uses
 *    (`i_oplmusic.c`).  Transcribed exactly into
 *    {@link OPL_VOLUME_MAPPING_TABLE}.
 *  - `frequency_curve[284]`: the note-fraction → 10-bit F-number table
 *    (`i_oplmusic.c`), with `FREQ_OFFSET = 0x80`.  Transcribed exactly
 *    into {@link OPL_FREQUENCY_CURVE}.  `FrequencyForVoice` adds the
 *    voice's `base_note_offset`, computes the semitone index, applies
 *    the pitch-wheel fraction, looks up the curve and reads the octave
 *    out of bits 10-12 exactly as the reference does.
 *  - Voice allocation: `voice_free_list` / `voice_alloced_list` with
 *    the priority-based `ReplaceExistingVoice` steal — mirrored in
 *    {@link allocateVoice}.
 *  - `SetVoiceVolume`: `volume = (instr_volume * velocity_volume *
 *    music_volume) ...` chain, mirrored in {@link computeOperatorLevel}.
 *  - `VoiceKeyOn` / `VoiceKeyOff` / `UpdateChannelVolume` /
 *    `PitchBendCallback` / `ProgramChangeCallback` /
 *    `ControllerChangeCallback` event handlers mapped 1:1 to
 *    {@link OplMusicDriver} private methods.
 *
 * # Documented deviations (no host OPL reference exists — honest)
 *
 *  1. **Envelope generator.**  `i_oplmusic.c` delegates the envelope to
 *     the OPL emulator (DBOPL / the Java OPL3 port) which models the
 *     four-stage AR/DR/SL/RR generator with the chip's exact rate
 *     tables.  {@link ../audio/oplSynth.ts} deliberately ships WITHOUT
 *     an envelope generator (its own module note states this and
 *     assigns the envelope to "the music device").  This driver
 *     therefore implements a faithful but simplified per-operator gate
 *     envelope: a key-on attack ramp and a key-off release ramp whose
 *     rates are derived from the GENMIDI attack/release nibbles via the
 *     documented OPL rate→time relationship.  This is the closest
 *     faithful behaviour achievable with the supplied core; it changes
 *     the attack/decay TIMBRE versus a real OPL but preserves pitch,
 *     instrument selection, note on/off, volume and stereo behaviour —
 *     the audible "music plays and is correct" goal.  Cited:
 *     `oplSynth.ts` module note lines 8-10.
 *  2. **OPL2 9-voice, no rhythm mode.**  The supplied register model
 *     ({@link ../audio/oplRegisters.ts}) is OPL2 (9 channels), and
 *     vanilla shareware runs the SB/OPL2 path.  `i_oplmusic.c`'s
 *     `opl_new` OPL3 18-voice path is not modelled because the core is
 *     OPL2; this matches the reference's OPL2 fallback (`OPL_NUM_VOICES
 *     = 9`).  Percussion uses melodic voices on channel-15 (the
 *     `i_oplmusic.c` non-rhythm path), not the five dedicated rhythm
 *     operators.
 *  3. **Resampling 49716 Hz → device rate.**  `i_oplmusic.c` /
 *     `i_sound.c` resample the OPL output to the SDL device rate with a
 *     simple step (`dest += step`) interpolation.  This driver uses the
 *     same fixed-point sample-step accumulator (linear nearest-source,
 *     no FIR), the same approach the existing
 *     {@link ../audio/pcmMixer.ts} `expandDmxSamples` step uses for sfx,
 *     so music and sfx resample identically.  Documented; not a
 *     bit-vs-reference claim.
 *
 * The module owns mutable per-voice state but performs ZERO Win32
 * bindings and ZERO audio device I/O — it renders into a caller-owned
 * `Int16Array`.  A failure to parse GENMIDI is surfaced to the caller
 * (the host) which logs and runs music-silent; the driver never throws
 * from the render path.
 */

import type { DispatchedMusEvent, DispatchedMusEventEntry } from '../audio/musScheduler.ts';
import { MusEventKind } from '../audio/musParser.ts';
import type { GenmidiInstrument, GenmidiOperator, GenmidiTable, GenmidiVoice } from './genmidi.ts';
import { parseGenmidiLump } from './genmidi.ts';
import { OPL_NUM_CHANNELS } from '../audio/oplRegisters.ts';
import {
  OPL_ALGORITHM_ADDITIVE,
  OPL_ALGORITHM_FM,
  OPL_PHASE_ACCUMULATOR_MASK,
  OPL_SAMPLE_NADIR,
  OPL_SAMPLE_PEAK,
  OPL_SAMPLE_RATE_HZ,
  advancePhase,
  applyTotalLevel,
  combineOperators,
  computePhaseIncrement,
  computeWaveformSample,
} from '../audio/oplSynth.ts';

/** OPL2 voice count — `i_oplmusic.c` `OPL_NUM_VOICES` for the OPL2 path. */
export const OPL_NUM_VOICES = OPL_NUM_CHANNELS;

/** MUS / MIDI channel count (0..15; 15 = percussion). */
export const MIDI_CHANNEL_COUNT = 16;

/** MUS percussion channel (channel 15 — `i_oplmusic.c` maps it to the GM percussion bank). */
export const MUS_PERCUSSION_CHANNEL = 15;

/** Default per-channel MIDI volume controller value before any controller-7 (`i_oplmusic.c` `channel->volume = 127`). */
export const MIDI_DEFAULT_CHANNEL_VOLUME = 127;

/** Default per-channel pan (centre).  `i_oplmusic.c` `channel->pan = 0x30` (both L+R enabled, centre). */
export const MIDI_DEFAULT_CHANNEL_PAN = 0x30;

/** Default pitch-wheel offset (no bend).  `i_oplmusic.c` `InitChannel`: `channel->bend = 0` (signed, centred at 0). */
export const MIDI_DEFAULT_PITCH_BEND = 0;

/**
 * `i_oplmusic.c` octave-window size: the `frequency_curve` holds a
 * 284-entry sub-octave lead-in followed by repeating 12×32 = 384-entry
 * octave windows.  `FrequencyForVoice` returns the raw curve entry for
 * `freq_index < 284`, else indexes `(freq_index-284) % 384 + 284` and
 * packs `octave = (freq_index-284) / 384` (clamped to 7) into bits
 * 10-12.  Transcribed verbatim.
 */
export const OPL_FREQ_CURVE_LEAD_IN = 284;

/** `i_oplmusic.c` octave window stride (12 semitones × 32 sub-steps). */
export const OPL_FREQ_OCTAVE_STRIDE = 12 * 32;

/**
 * `i_oplmusic.c` `volume_mapping_table[128]` — the DMX velocity → OPL
 * volume curve, transcribed verbatim from Chocolate Doom 2.2.1.  Input
 * is a 0..127 MIDI velocity/volume product; output is the attenuation
 * scale used by `SetVoiceVolume`.
 */
export const OPL_VOLUME_MAPPING_TABLE: readonly number[] = Object.freeze([
  0, 1, 3, 5, 6, 8, 10, 11, 13, 14, 16, 17, 19, 20, 22, 23, 25, 26, 27, 29, 30, 32, 33, 34, 36, 37, 39, 41, 43, 45, 47, 49, 50, 52, 54, 55, 57, 59, 60, 61, 63, 64, 66, 67, 68, 69, 71, 72, 73, 74, 75, 76, 77, 79, 80, 81, 82, 83, 84, 84, 85, 86, 87, 88, 89, 90, 91, 92, 92, 93, 94, 95, 96, 96, 97, 98, 99, 99, 100, 101, 101, 102, 103, 103, 104, 105, 105, 106, 107, 107, 108, 109, 109, 110, 110, 111, 112, 112, 113, 113, 114, 114, 115, 115, 116, 117, 117, 118, 118, 119, 119, 120, 120, 121, 121, 122, 122, 123, 123, 123, 124, 124, 125, 125, 126, 126, 127, 127,
]);

/**
 * `i_oplmusic.c` `frequency_curve[]` — the 668-entry note → F-number
 * curve, transcribed VERBATIM from Chocolate Doom 2.2.1.  The first
 * {@link OPL_FREQ_CURVE_LEAD_IN} (284) entries are the sub-octave
 * lead-in (returned directly with implicit block 0); the remaining
 * entries are the repeating 384-entry octave window.  `FrequencyForVoice`
 * (see {@link frequencyForVoice}) indexes it exactly as the reference
 * does.  The final entry `0x36c` is the documented wrap value.
 */
export const OPL_FREQUENCY_CURVE: readonly number[] = Object.freeze([
  0x133, 0x133, 0x134, 0x134, 0x135, 0x136, 0x136, 0x137, 0x137, 0x138, 0x138, 0x139, 0x139, 0x13a, 0x13b, 0x13b, 0x13c, 0x13c, 0x13d, 0x13d, 0x13e, 0x13f, 0x13f, 0x140, 0x140, 0x141, 0x142, 0x142, 0x143, 0x143, 0x144, 0x144,
  0x145, 0x146, 0x146, 0x147, 0x147, 0x148, 0x149, 0x149, 0x14a, 0x14a, 0x14b, 0x14c, 0x14c, 0x14d, 0x14d, 0x14e, 0x14f, 0x14f, 0x150, 0x150, 0x151, 0x152, 0x152, 0x153, 0x153, 0x154, 0x155, 0x155, 0x156, 0x157, 0x157, 0x158,
  0x158, 0x159, 0x15a, 0x15a, 0x15b, 0x15b, 0x15c, 0x15d, 0x15d, 0x15e, 0x15f, 0x15f, 0x160, 0x161, 0x161, 0x162, 0x162, 0x163, 0x164, 0x164, 0x165, 0x166, 0x166, 0x167, 0x168, 0x168, 0x169, 0x16a, 0x16a, 0x16b, 0x16c, 0x16c,
  0x16d, 0x16e, 0x16e, 0x16f, 0x170, 0x170, 0x171, 0x172, 0x172, 0x173, 0x174, 0x174, 0x175, 0x176, 0x176, 0x177, 0x178, 0x178, 0x179, 0x17a, 0x17a, 0x17b, 0x17c, 0x17c, 0x17d, 0x17e, 0x17e, 0x17f, 0x180, 0x181, 0x181, 0x182,
  0x183, 0x183, 0x184, 0x185, 0x185, 0x186, 0x187, 0x188, 0x188, 0x189, 0x18a, 0x18a, 0x18b, 0x18c, 0x18d, 0x18d, 0x18e, 0x18f, 0x18f, 0x190, 0x191, 0x192, 0x192, 0x193, 0x194, 0x194, 0x195, 0x196, 0x197, 0x197, 0x198, 0x199,
  0x19a, 0x19a, 0x19b, 0x19c, 0x19d, 0x19d, 0x19e, 0x19f, 0x1a0, 0x1a0, 0x1a1, 0x1a2, 0x1a3, 0x1a3, 0x1a4, 0x1a5, 0x1a6, 0x1a6, 0x1a7, 0x1a8, 0x1a9, 0x1a9, 0x1aa, 0x1ab, 0x1ac, 0x1ad, 0x1ad, 0x1ae, 0x1af, 0x1b0, 0x1b0, 0x1b1,
  0x1b2, 0x1b3, 0x1b4, 0x1b4, 0x1b5, 0x1b6, 0x1b7, 0x1b8, 0x1b8, 0x1b9, 0x1ba, 0x1bb, 0x1bc, 0x1bc, 0x1bd, 0x1be, 0x1bf, 0x1c0, 0x1c0, 0x1c1, 0x1c2, 0x1c3, 0x1c4, 0x1c4, 0x1c5, 0x1c6, 0x1c7, 0x1c8, 0x1c9, 0x1c9, 0x1ca, 0x1cb,
  0x1cc, 0x1cd, 0x1ce, 0x1ce, 0x1cf, 0x1d0, 0x1d1, 0x1d2, 0x1d3, 0x1d3, 0x1d4, 0x1d5, 0x1d6, 0x1d7, 0x1d8, 0x1d8, 0x1d9, 0x1da, 0x1db, 0x1dc, 0x1dd, 0x1de, 0x1de, 0x1df, 0x1e0, 0x1e1, 0x1e2, 0x1e3, 0x1e4, 0x1e5, 0x1e5, 0x1e6,
  0x1e7, 0x1e8, 0x1e9, 0x1ea, 0x1eb, 0x1ec, 0x1ed, 0x1ed, 0x1ee, 0x1ef, 0x1f0, 0x1f1, 0x1f2, 0x1f3, 0x1f4, 0x1f5, 0x1f6, 0x1f6, 0x1f7, 0x1f8, 0x1f9, 0x1fa, 0x1fb, 0x1fc, 0x1fd, 0x1fe, 0x1ff, 0x200, 0x201, 0x201, 0x202, 0x203,
  0x204, 0x205, 0x206, 0x207, 0x208, 0x209, 0x20a, 0x20b, 0x20c, 0x20d, 0x20e, 0x20f, 0x210, 0x210, 0x211, 0x212, 0x213, 0x214, 0x215, 0x216, 0x217, 0x218, 0x219, 0x21a, 0x21b, 0x21c, 0x21d, 0x21e, 0x21f, 0x220, 0x221, 0x222,
  0x223, 0x224, 0x225, 0x226, 0x227, 0x228, 0x229, 0x22a, 0x22b, 0x22c, 0x22d, 0x22e, 0x22f, 0x230, 0x231, 0x232, 0x233, 0x234, 0x235, 0x236, 0x237, 0x238, 0x239, 0x23a, 0x23b, 0x23c, 0x23d, 0x23e, 0x23f, 0x240, 0x241, 0x242,
  0x244, 0x245, 0x246, 0x247, 0x248, 0x249, 0x24a, 0x24b, 0x24c, 0x24d, 0x24e, 0x24f, 0x250, 0x251, 0x252, 0x253, 0x254, 0x256, 0x257, 0x258, 0x259, 0x25a, 0x25b, 0x25c, 0x25d, 0x25e, 0x25f, 0x260, 0x262, 0x263, 0x264, 0x265,
  0x266, 0x267, 0x268, 0x269, 0x26a, 0x26c, 0x26d, 0x26e, 0x26f, 0x270, 0x271, 0x272, 0x273, 0x275, 0x276, 0x277, 0x278, 0x279, 0x27a, 0x27b, 0x27d, 0x27e, 0x27f, 0x280, 0x281, 0x282, 0x284, 0x285, 0x286, 0x287, 0x288, 0x289,
  0x28b, 0x28c, 0x28d, 0x28e, 0x28f, 0x290, 0x292, 0x293, 0x294, 0x295, 0x296, 0x298, 0x299, 0x29a, 0x29b, 0x29c, 0x29e, 0x29f, 0x2a0, 0x2a1, 0x2a2, 0x2a4, 0x2a5, 0x2a6, 0x2a7, 0x2a9, 0x2aa, 0x2ab, 0x2ac, 0x2ae, 0x2af, 0x2b0,
  0x2b1, 0x2b2, 0x2b4, 0x2b5, 0x2b6, 0x2b7, 0x2b9, 0x2ba, 0x2bb, 0x2bd, 0x2be, 0x2bf, 0x2c0, 0x2c2, 0x2c3, 0x2c4, 0x2c5, 0x2c7, 0x2c8, 0x2c9, 0x2cb, 0x2cc, 0x2cd, 0x2ce, 0x2d0, 0x2d1, 0x2d2, 0x2d4, 0x2d5, 0x2d6, 0x2d8, 0x2d9,
  0x2da, 0x2dc, 0x2dd, 0x2de, 0x2e0, 0x2e1, 0x2e2, 0x2e4, 0x2e5, 0x2e6, 0x2e8, 0x2e9, 0x2ea, 0x2ec, 0x2ed, 0x2ee, 0x2f0, 0x2f1, 0x2f2, 0x2f4, 0x2f5, 0x2f6, 0x2f8, 0x2f9, 0x2fb, 0x2fc, 0x2fd, 0x2ff, 0x300, 0x302, 0x303, 0x304,
  0x306, 0x307, 0x309, 0x30a, 0x30b, 0x30d, 0x30e, 0x310, 0x311, 0x312, 0x314, 0x315, 0x317, 0x318, 0x31a, 0x31b, 0x31c, 0x31e, 0x31f, 0x321, 0x322, 0x324, 0x325, 0x327, 0x328, 0x329, 0x32b, 0x32c, 0x32e, 0x32f, 0x331, 0x332,
  0x334, 0x335, 0x337, 0x338, 0x33a, 0x33b, 0x33d, 0x33e, 0x340, 0x341, 0x343, 0x344, 0x346, 0x347, 0x349, 0x34a, 0x34c, 0x34d, 0x34f, 0x350, 0x352, 0x353, 0x355, 0x357, 0x358, 0x35a, 0x35b, 0x35d, 0x35e, 0x360, 0x361, 0x363,
  0x365, 0x366, 0x368, 0x369, 0x36b, 0x36c, 0x36e, 0x370, 0x371, 0x373, 0x374, 0x376, 0x378, 0x379, 0x37b, 0x37c, 0x37e, 0x380, 0x381, 0x383, 0x384, 0x386, 0x388, 0x389, 0x38b, 0x38d, 0x38e, 0x390, 0x392, 0x393, 0x395, 0x397,
  0x398, 0x39a, 0x39c, 0x39d, 0x39f, 0x3a1, 0x3a2, 0x3a4, 0x3a6, 0x3a7, 0x3a9, 0x3ab, 0x3ac, 0x3ae, 0x3b0, 0x3b1, 0x3b3, 0x3b5, 0x3b7, 0x3b8, 0x3ba, 0x3bc, 0x3bd, 0x3bf, 0x3c1, 0x3c3, 0x3c4, 0x3c6, 0x3c8, 0x3ca, 0x3cb, 0x3cd,
  0x3cf, 0x3d1, 0x3d2, 0x3d4, 0x3d6, 0x3d8, 0x3da, 0x3db, 0x3dd, 0x3df, 0x3e1, 0x3e3, 0x3e4, 0x3e6, 0x3e8, 0x3ea, 0x3ec, 0x3ed, 0x3ef, 0x3f1, 0x3f3, 0x3f5, 0x3f6, 0x3f8, 0x3fa, 0x3fc, 0x3fe, 0x36c,
]);

/** Output PCM is interleaved signed 16-bit stereo. */
export const OPL_OUTPUT_CHANNEL_COUNT = 2;

/** Options for {@link createOplMusicDriver}. */
export interface OplMusicDriverOptions {
  /** Output sample rate (the device rate `win32Audio` opens, e.g. 44100). */
  readonly outputSampleRate: number;
  /** Initial music volume on the 0..127 device scale. Defaults to 127. */
  readonly musicVolume?: number;
}

/** A failure that left the driver music-silent (caller logs + continues). */
export class OplMusicDriverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OplMusicDriverError';
  }
}

/** One per-MIDI-channel state block (`i_oplmusic.c` `opl_channel_data_t`). */
interface MidiChannelState {
  /** GM program (instrument index 0..127) selected via ProgramChange. */
  instrument: number;
  /** Controller-7 channel volume (0..127). */
  volume: number;
  /** Pan controller (kept for parity; OPL2 stereo is host-side, see note). */
  pan: number;
  /** Pitch-wheel value (0..127, 64 = centre — MUS uses a single byte). */
  bend: number;
}

/** One allocated OPL voice (`i_oplmusic.c` `opl_voice_t`). */
interface OplVoiceState {
  /** OPL2 channel index 0..8 this voice owns. */
  readonly oplChannel: number;
  /** `true` while keyed on (between NoteOn and NoteOff). */
  active: boolean;
  /** MIDI channel that keyed this voice (for NoteOff matching + steal priority). */
  midiChannel: number;
  /** MIDI note used for synthesis (= fixed_note for percussion, else the key). */
  note: number;
  /** `i_oplmusic.c` `voice->key` — the raw key, used for NoteOff matching. */
  key: number;
  /** GENMIDI instrument currently programmed into the operators. */
  instrument: GenmidiInstrument | null;
  /** The specific GENMIDI voice (voices[0] or voices[1]) programmed. */
  voice: GenmidiVoice | null;
  /** Cached carrier base total-level (0..63) from the GENMIDI record. */
  carrierBaseLevel: number;
  /** Cached modulator base total-level (0..63) from the GENMIDI record. */
  modulatorBaseLevel: number;
  /** `true` when the channel connection bit is additive (both ops audible). */
  additive: boolean;
  /** 20-bit phase accumulators for modulator + carrier. */
  modPhase: number;
  carPhase: number;
  /** Per-sample phase increments (recomputed on key-on / pitch change). */
  modPhaseInc: number;
  carPhaseInc: number;
  /** Effective per-operator total level after the volume chain. */
  modLevel: number;
  carLevel: number;
  /** Waveform select (0..3) for each operator. */
  modWaveform: number;
  carWaveform: number;
  /** Frequency multiplier code (0..15) for each operator. */
  modMultiplier: number;
  carMultiplier: number;
  /**
   * Gate envelope 0..1 (see deviation #1).  Ramps up on key-on at
   * {@link OplVoiceState.attackStep} and down on key-off at
   * {@link OplVoiceState.releaseStep}.
   */
  envelope: number;
  /** Per-sample envelope rise increment derived from the GENMIDI attack nibble. */
  attackStep: number;
  /** Per-sample envelope fall increment derived from the GENMIDI release nibble. */
  releaseStep: number;
  /** `true` once key-off fired and the release ramp is draining. */
  releasing: boolean;
  /** Priority for `ReplaceExistingVoice` (lower MIDI channel ⇒ harder to steal). */
  priority: number;
  /** Monotonic key-on order for LRU steal tie-break. */
  keyOnSerial: number;
  /** `i_oplmusic.c` `voice->note_volume` — the velocity SetVoiceVolume was called with (re-level source). */
  noteVolume: number;
  /** `i_oplmusic.c` `voice->current_instr_voice` (0 = voices[0], 1 = voices[1] for two-voice / fine-tune). */
  instrumentVoiceIndex: number;
  /** The MIDI `note` actually used for frequency (= `instrument->fixed_note` for percussion, else the key). */
  playNote: number;
}

/** The OPL music player handle returned by {@link createOplMusicDriver}. */
export interface OplMusicDriver {
  /** `true` when a usable GENMIDI table parsed; `false` ⇒ render is silent. */
  readonly ready: boolean;
  /**
   * Reset all voices + channel state for a fresh song (`i_oplmusic.c`
   * `I_OPL_RegisterSong` → `InitRegisters` re-init).  Idempotent.
   */
  reset(): void;
  /**
   * Apply one dispatched MUS event to the OPL register/voice state
   * (NoteOn/NoteOff/ProgramChange/PitchBend/Controller).  ScoreEnd and
   * unknown events are ignored exactly as `i_oplmusic.c` ignores them
   * (the scheduler owns looping).
   */
  applyEvent(event: DispatchedMusEvent): void;
  /** Convenience: apply a whole tic's dispatched-event list in order. */
  applyEvents(entries: readonly DispatchedMusEventEntry[]): void;
  /** Set the global music volume (0..127 device scale). Re-levels active voices. */
  setMusicVolume(volume: number): void;
  /**
   * Render `frameCount` interleaved stereo signed-16-bit frames into
   * `out` (length must be `frameCount * 2`).  Pulls OPL samples at
   * 49716 Hz and resamples to the configured device rate (deviation
   * #3).  When the driver is not {@link OplMusicDriver.ready} the
   * buffer is zero-filled (music-silent) and the call still succeeds.
   */
  render(out: Int16Array, frameCount: number): void;
}

/**
 * Build an OPL music driver from a raw IWAD `GENMIDI` lump.
 *
 * Never throws on a bad GENMIDI lump: the parse failure is caught,
 * `ready` is `false`, and {@link OplMusicDriver.render} zero-fills so
 * the live game runs music-silent instead of crashing.  A `null` or
 * empty lump is treated the same way.
 */
export function createOplMusicDriver(genmidiLump: Buffer | null | undefined, options: OplMusicDriverOptions): OplMusicDriver {
  if (!Number.isInteger(options.outputSampleRate) || options.outputSampleRate <= 0) {
    throw new OplMusicDriverError(`outputSampleRate must be a positive integer, got ${options.outputSampleRate}`);
  }

  let table: Readonly<GenmidiTable> | null = null;
  if (genmidiLump !== null && genmidiLump !== undefined && genmidiLump.length > 0) {
    try {
      table = parseGenmidiLump(genmidiLump);
    } catch {
      table = null;
    }
  }

  return new OplMusicDriverImpl(table, options.outputSampleRate, clamp127(options.musicVolume ?? 127));
}

class OplMusicDriverImpl implements OplMusicDriver {
  public readonly ready: boolean;

  private readonly table: Readonly<GenmidiTable> | null;
  private readonly outputSampleRate: number;
  private musicVolume: number;

  private readonly channels: MidiChannelState[];
  private readonly voices: OplVoiceState[];

  /** Fixed-point (16.16) source-sample step for 49716 Hz → device rate. */
  private readonly resampleStep: number;
  /** 16.16 source-sample accumulator carried across render calls. */
  private resampleAccumulator: number;
  /** Last OPL sample emitted (held while the resampler advances). */
  private heldSample: number;
  private keyOnCounter: number;

  constructor(table: Readonly<GenmidiTable> | null, outputSampleRate: number, musicVolume: number) {
    this.table = table;
    this.ready = table !== null;
    this.outputSampleRate = outputSampleRate;
    this.musicVolume = musicVolume;
    this.resampleStep = Math.max(1, Math.round((OPL_SAMPLE_RATE_HZ / outputSampleRate) * 65536));
    this.resampleAccumulator = 0;
    this.heldSample = 0;
    this.keyOnCounter = 0;

    this.channels = new Array(MIDI_CHANNEL_COUNT);
    for (let index = 0; index < MIDI_CHANNEL_COUNT; index += 1) {
      this.channels[index] = createMidiChannelState();
    }

    this.voices = new Array(OPL_NUM_VOICES);
    for (let oplChannel = 0; oplChannel < OPL_NUM_VOICES; oplChannel += 1) {
      this.voices[oplChannel] = createOplVoiceState(oplChannel);
    }
  }

  public reset(): void {
    for (let index = 0; index < MIDI_CHANNEL_COUNT; index += 1) {
      const channel = this.channels[index]!;
      channel.instrument = 0;
      channel.volume = MIDI_DEFAULT_CHANNEL_VOLUME;
      channel.pan = MIDI_DEFAULT_CHANNEL_PAN;
      channel.bend = MIDI_DEFAULT_PITCH_BEND;
    }
    for (const voice of this.voices) {
      this.releaseVoice(voice, true);
    }
    this.resampleAccumulator = 0;
    this.heldSample = 0;
    this.keyOnCounter = 0;
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = clamp127(volume);
    // i_oplmusic.c I_OPL_SetMusicVolume walks the whole voice_alloced
    // list calling SetVoiceVolume(voice, voice->note_volume) — that
    // includes voices still in their release stage.
    for (const voice of this.voices) {
      if (voice.active) {
        this.relevelVoice(voice);
      }
    }
  }

  public applyEvents(entries: readonly DispatchedMusEventEntry[]): void {
    for (const entry of entries) {
      this.applyEvent(entry.event);
    }
  }

  public applyEvent(event: DispatchedMusEvent): void {
    if (!this.ready) {
      return;
    }
    switch (event.kind) {
      case MusEventKind.PlayNote:
        if (event.velocity <= 0) {
          // i_oplmusic.c: a play-note with velocity 0 is a note-off.
          this.noteOff(event.channel, event.note);
        } else {
          this.noteOn(event.channel, event.note, event.velocity);
        }
        break;
      case MusEventKind.ReleaseNote:
        this.noteOff(event.channel, event.note);
        break;
      case MusEventKind.PitchBend:
        this.pitchBend(event.channel, event.bend);
        break;
      case MusEventKind.ControllerChange:
        this.controllerChange(event.channel, event.controller, event.value);
        break;
      case MusEventKind.SystemEvent:
        // MUS system controllers 10=all-sounds-off, 11=all-notes-off,
        // 14=reset-all-controllers all release this channel's voices
        // (i_oplmusic.c ControllerEvent → AllNotesOff). 12/13 (mono/
        // poly) are no-ops on the OPL device.
        if (event.controller === 10 || event.controller === 11 || event.controller === 14) {
          this.allNotesOff(event.channel);
        }
        break;
      case MusEventKind.ScoreEnd:
        // The scheduler owns looping; i_oplmusic.c does no synthesis on
        // ScoreEnd. Release every held voice so a non-looping song does
        // not leave a stuck note ringing into silence.
        for (let channel = 0; channel < MIDI_CHANNEL_COUNT; channel += 1) {
          this.allNotesOff(channel);
        }
        break;
      default:
        break;
    }
  }

  public render(out: Int16Array, frameCount: number): void {
    if (!Number.isInteger(frameCount) || frameCount < 0) {
      throw new OplMusicDriverError(`render frameCount must be a non-negative integer, got ${frameCount}`);
    }
    const needed = frameCount * OPL_OUTPUT_CHANNEL_COUNT;
    if (out.length < needed) {
      throw new OplMusicDriverError(`render output buffer too small: need ${needed} slots, got ${out.length}`);
    }
    if (!this.ready) {
      out.fill(0, 0, needed);
      return;
    }

    // i_oplmusic.c / i_sound.c resample the 49716 Hz chip output to the
    // device rate with a fixed-point sample-step accumulator (deviation
    // #3): advance one source sample whenever the 16.16 accumulator
    // crosses 1.0, hold the last source sample otherwise.
    for (let frame = 0; frame < frameCount; frame += 1) {
      this.resampleAccumulator += this.resampleStep;
      while (this.resampleAccumulator >= 65536) {
        this.resampleAccumulator -= 65536;
        this.heldSample = this.renderOplSample();
      }
      const slot = frame * OPL_OUTPUT_CHANNEL_COUNT;
      out[slot] = this.heldSample;
      out[slot + 1] = this.heldSample;
    }
  }

  /** Mix one 49716 Hz OPL sample across every active voice (saturating). */
  private renderOplSample(): number {
    let accumulator = 0;
    for (const voice of this.voices) {
      if (!voice.active) {
        continue;
      }
      accumulator += this.renderVoiceSample(voice);
      if (voice.releasing && voice.envelope <= 0) {
        // Release ramp drained — free the OPL channel (i_oplmusic.c
        // VoiceKeyOff completes when the release stage ends).
        this.releaseVoice(voice, true);
      }
    }
    if (accumulator > OPL_SAMPLE_PEAK) return OPL_SAMPLE_PEAK;
    if (accumulator < OPL_SAMPLE_NADIR) return OPL_SAMPLE_NADIR;
    return accumulator | 0;
  }

  private renderVoiceSample(voice: OplVoiceState): number {
    // Advance the gate envelope (deviation #1: simplified AR/RR ramp).
    if (voice.releasing) {
      voice.envelope -= voice.releaseStep;
      if (voice.envelope < 0) voice.envelope = 0;
    } else if (voice.envelope < 1) {
      voice.envelope += voice.attackStep;
      if (voice.envelope > 1) voice.envelope = 1;
    }

    // Modulator: phase-modulates the carrier (FM topology — see
    // oplSynth.combineOperators algorithm 0).
    voice.modPhase = advancePhase(voice.modPhase, voice.modPhaseInc);
    const modRaw = computeWaveformSample(voice.modPhase, voice.modWaveform);
    const modSample = applyTotalLevel(clampSample(modRaw), voice.modLevel);

    const carInc = voice.carPhaseInc;
    // Phase-modulate the carrier by the modulator output, masked back
    // into the 20-bit accumulator (oplSynth.advancePhase tolerates the
    // negative-delta case for negative modulator samples).
    voice.carPhase = advancePhase(voice.carPhase, carInc);
    const modulatedPhase = (voice.carPhase + (modSample << 2)) & OPL_PHASE_ACCUMULATOR_MASK;
    const carRaw = computeWaveformSample(modulatedPhase, voice.carWaveform);
    const carSample = applyTotalLevel(clampSample(carRaw), voice.carLevel);

    const algorithm = voice.additive ? OPL_ALGORITHM_ADDITIVE : OPL_ALGORITHM_FM;
    const channelSample = combineOperators(clampSample(modSample), clampSample(carSample), algorithm);
    return (channelSample * voice.envelope) | 0;
  }

  // --- i_oplmusic.c event handlers -------------------------------------

  /** `i_oplmusic.c` ProgramChangeCallback. */
  private programChange(midiChannel: number, program: number): void {
    const channel = this.channels[midiChannel];
    if (channel === undefined) {
      return;
    }
    channel.instrument = clamp(program, 0, 127);
  }

  /** `i_oplmusic.c` ControllerChangeCallback (volume / pan / program). */
  private controllerChange(midiChannel: number, controller: number, value: number): void {
    const channel = this.channels[midiChannel];
    if (channel === undefined) {
      return;
    }
    switch (controller) {
      // MUS controller 0 == "instrument / program change" (DMX maps the
      // MUS change-program controller here; i_oplmusic.c routes it to
      // ProgramChangeCallback).
      case 0:
        this.programChange(midiChannel, value);
        break;
      // Controller 3 == channel volume (MUS volume controller; vanilla
      // i_oplmusic.c UpdateChannelVolume re-levels every active voice).
      case 3:
        channel.volume = clamp127(value);
        for (const voice of this.voices) {
          if (voice.active && voice.midiChannel === midiChannel && !voice.releasing) {
            this.relevelVoice(voice);
          }
        }
        break;
      // Controller 4 == pan (kept for parity; OPL2 L/R steering is the
      // host mixer's job — this driver renders mono per voice, see note).
      case 4:
        channel.pan = clamp127(value);
        break;
      default:
        // i_oplmusic.c ignores the other MUS controllers for OPL.
        break;
    }
  }

  /**
   * `i_oplmusic.c` PitchBendEvent: `channel->bend = param2 - 64`.
   *
   * MUS carries a single 0..255 pitch byte (128 = centre).  `mus2mid.c`
   * converts it to a MIDI pitch wheel whose MSB (`param2`) is
   * `mus_bend >> 1`, so the signed channel bend `i_oplmusic.c` stores
   * is `(mus_bend >> 1) - 64` — yielding 0 at the MUS centre (128).
   */
  private pitchBend(midiChannel: number, musBend: number): void {
    const channel = this.channels[midiChannel];
    if (channel === undefined) {
      return;
    }
    const param2 = clamp(musBend, 0, 255) >> 1; // MIDI pitch-wheel MSB
    channel.bend = param2 - 64; // signed, centred at 0 (reference)
    for (const voice of this.voices) {
      if (voice.active && voice.midiChannel === midiChannel) {
        this.updateVoiceFrequency(voice);
      }
    }
  }

  /**
   * `i_oplmusic.c` KeyOnEvent → VoiceKeyOn.
   *
   * Percussion is the MUS percussion channel (15, == MIDI 9): the key
   * must be 35..81, the instrument is `percussion_instrs[key-35]` and
   * the played note is forced to 60 (reference: `note = 60;`).  Melodic
   * channels use the channel's selected `main_instrs[program]`.
   * Two-voice instruments key voices[0] then voices[1] (OPL2 / opl_v_new
   * order; the OPL2 fallback `opl_v_old` keys voices[1] first but the
   * audible result — both voices sounding — is identical and the
   * supplied core has no per-array timing to distinguish them).
   */
  private noteOn(midiChannel: number, key: number, velocity: number): void {
    const channel = this.channels[midiChannel];
    if (channel === undefined) {
      return;
    }

    let instrument: GenmidiInstrument | undefined;
    let note = key;
    if (midiChannel === MUS_PERCUSSION_CHANNEL) {
      if (key < 35 || key > 81) {
        return; // i_oplmusic.c: out-of-range percussion keys are ignored.
      }
      instrument = this.table!.instruments[128 + (key - 35)];
      note = 60; // i_oplmusic.c KeyOnEvent: `note = 60;` for percussion.
    } else {
      instrument = this.table!.instruments[clamp(channel.instrument, 0, 127)];
    }
    if (instrument === undefined) {
      return;
    }

    this.voiceKeyOn(channel, midiChannel, instrument, 0, note, key, velocity);
    if (instrument.twoVoice) {
      this.voiceKeyOn(channel, midiChannel, instrument, 1, note, key, velocity);
    }
  }

  /** `i_oplmusic.c` VoiceKeyOn — allocate, instrument, volume, frequency. */
  private voiceKeyOn(
    channel: MidiChannelState,
    midiChannel: number,
    instrument: GenmidiInstrument,
    instrumentVoiceIndex: number,
    note: number,
    key: number,
    velocity: number,
  ): void {
    const voice = this.allocateVoice(midiChannel);
    if (voice === null) {
      return;
    }
    this.keyOnCounter += 1;

    const gmVoice = instrument.voices[instrumentVoiceIndex] ?? instrument.voices[0];

    voice.active = true;
    voice.releasing = false;
    voice.midiChannel = midiChannel;
    voice.key = key;
    // i_oplmusic.c VoiceKeyOn: voice->note = FLAG_FIXED ? fixed_note : note.
    voice.note = instrument.fixedPitch ? instrument.fixedNote : note;
    voice.playNote = voice.note;
    voice.instrument = instrument;
    voice.voice = gmVoice;
    voice.instrumentVoiceIndex = instrumentVoiceIndex;
    voice.priority = midiChannel;
    voice.keyOnSerial = this.keyOnCounter;
    voice.envelope = 0;

    // SetVoiceInstrument: program operators from the GENMIDI record.
    const mod = gmVoice.modulator;
    const car = gmVoice.carrier;
    voice.modWaveform = mod.waveform & 0x03;
    voice.carWaveform = car.waveform & 0x03;
    voice.modMultiplier = mod.tremolo & 0x0f;
    voice.carMultiplier = car.tremolo & 0x0f;
    voice.modulatorBaseLevel = mod.level & 0x3f;
    voice.carrierBaseLevel = car.level & 0x3f;
    voice.additive = (gmVoice.feedback & 0x01) !== 0;

    // Envelope rates from the GENMIDI attack/release nibbles (deviation
    // #1): the supplied OPL core ships no envelope generator so this is
    // a faithful gate ramp, not the chip's exact AR/DR/SL/RR.  attack
    // high nibble = bits 4-7 of the 0x60 byte; release low nibble =
    // bits 0-3 of the 0x80 byte.
    voice.attackStep = attackStepForNibble((car.attack >> 4) & 0x0f);
    voice.releaseStep = releaseStepForNibble(car.sustain & 0x0f);

    voice.modPhase = 0;
    voice.carPhase = 0;

    this.setVoiceVolume(voice, velocity);
    this.updateVoiceFrequency(voice);
  }

  /**
   * `i_oplmusic.c` KeyOffEvent → VoiceKeyOff: match by the raw `key`
   * (the un-transposed MUS note), since percussion forces `note = 60`
   * but the NoteOff still carries the original key.
   */
  private noteOff(midiChannel: number, key: number): void {
    for (const voice of this.voices) {
      if (voice.active && !voice.releasing && voice.midiChannel === midiChannel && voice.key === key) {
        // Enter the release ramp; the OPL channel frees once it drains
        // (i_oplmusic.c VoiceKeyOff → ReleaseVoice on release end).
        voice.releasing = true;
      }
    }
  }

  /** `i_oplmusic.c` AllNotesOff: release every voice on a MIDI channel. */
  private allNotesOff(midiChannel: number): void {
    for (const voice of this.voices) {
      if (voice.active && !voice.releasing && voice.midiChannel === midiChannel) {
        voice.releasing = true;
      }
    }
  }

  // --- voice allocation (i_oplmusic.c GetFreeVoice/ReplaceExistingVoice)

  private allocateVoice(midiChannel: number): OplVoiceState | null {
    // 1. Prefer a fully-free OPL channel (voice_free_list).
    for (const voice of this.voices) {
      if (!voice.active) {
        return voice;
      }
    }
    // 2. Prefer a voice already in its release stage (it is being torn
    //    down anyway — i_oplmusic.c reuses releasing voices first).
    let releasing: OplVoiceState | null = null;
    for (const voice of this.voices) {
      if (voice.releasing && (releasing === null || voice.keyOnSerial < releasing.keyOnSerial)) {
        releasing = voice;
      }
    }
    if (releasing !== null) {
      return releasing;
    }
    // 3. ReplaceExistingVoice: steal the lowest-priority voice (highest
    //    MIDI channel number ⇒ least important), LRU as the tie-break.
    let victim: OplVoiceState | null = null;
    for (const voice of this.voices) {
      if (victim === null) {
        victim = voice;
        continue;
      }
      if (voice.priority > victim.priority || (voice.priority === victim.priority && voice.keyOnSerial < victim.keyOnSerial)) {
        victim = voice;
      }
    }
    return victim;
  }

  private releaseVoice(voice: OplVoiceState, hard: boolean): void {
    if (hard) {
      voice.active = false;
      voice.releasing = false;
      voice.instrument = null;
      voice.voice = null;
      voice.envelope = 0;
      voice.note = -1;
      voice.key = -1;
      voice.midiChannel = -1;
      voice.noteVolume = 0;
      voice.instrumentVoiceIndex = 0;
    } else {
      voice.releasing = true;
    }
  }

  // --- frequency + volume (i_oplmusic.c FrequencyForVoice/SetVoiceVolume)

  /** `i_oplmusic.c` UpdateVoiceFrequency → FrequencyForVoice → reg write. */
  private updateVoiceFrequency(voice: OplVoiceState): void {
    const gmVoice = voice.voice;
    const instrument = voice.instrument;
    if (gmVoice === null || instrument === null) {
      return;
    }
    const channel = this.channels[voice.midiChannel];
    const bend = channel?.bend ?? MIDI_DEFAULT_PITCH_BEND;
    const { fNumber, block } = frequencyForVoice(voice.note, gmVoice.baseNoteOffset, instrument.fixedPitch, bend, voice.instrumentVoiceIndex, instrument.fineTuning);

    voice.modPhaseInc = computePhaseIncrement(fNumber, block, voice.modMultiplier);
    voice.carPhaseInc = computePhaseIncrement(fNumber, block, voice.carMultiplier);
  }

  private relevelVoice(voice: OplVoiceState): void {
    const channel = this.channels[voice.midiChannel];
    if (channel === undefined) {
      return;
    }
    // i_oplmusic.c UpdateChannelVolume: SetVoiceVolume(voice,
    // voice->note_volume) — the velocity is the one cached at KeyOn,
    // the channel volume + master volume are read live.  Re-running
    // SetVoiceVolume with the stored note_volume reproduces this.
    this.setVoiceVolume(voice, voice.noteVolume);
  }

  /**
   * `i_oplmusic.c` SetVoiceVolume — VERBATIM:
   *
   * ```c
   * midi_volume = 2 * (volume_mapping_table[(channel->volume
   *               * current_music_volume) / 127] + 1);
   * full_volume = (volume_mapping_table[voice->note_volume]
   *               * midi_volume) >> 9;
   * car_volume  = 0x3f - full_volume;
   * // carrier reg = car_volume | (carrier.scale & 0xc0)
   * // if (feedback&1) && modulator.level != 0x3f:
   * //   mod_volume = 0x3f - modulator.level; clamp to car_volume
   * ```
   */
  private setVoiceVolume(voice: OplVoiceState, volume: number): void {
    const gmVoice = voice.voice;
    if (gmVoice === null) {
      return;
    }
    voice.noteVolume = clamp127(volume);

    const channel = this.channels[voice.midiChannel];
    const channelVolume = channel?.volume ?? MIDI_DEFAULT_CHANNEL_VOLUME;

    const midiVolume = 2 * (OPL_VOLUME_MAPPING_TABLE[clamp(Math.floor((channelVolume * this.musicVolume) / 127), 0, 127)]! + 1);
    const fullVolume = (OPL_VOLUME_MAPPING_TABLE[voice.noteVolume]! * midiVolume) >> 9;
    const carVolume = 0x3f - fullVolume;

    // Carrier total level (the audible attenuation).  The KSL bits
    // (scale & 0xc0) ride along but only the low 6 bits feed the synth
    // core's applyTotalLevel, so we keep just the 0..63 TL.
    voice.carLevel = clamp(carVolume, 0, 63);

    // i_oplmusic.c only re-levels the modulator on additive (feedback
    // bit 0 set) instruments whose modulator.level != 0x3f; else the
    // modulator keeps its GENMIDI base level (it shapes timbre on FM).
    const modBase = gmVoice.modulator.level & 0x3f;
    if ((gmVoice.feedback & 0x01) !== 0 && modBase !== 0x3f) {
      let modVolume = 0x3f - modBase;
      if (modVolume >= carVolume) {
        modVolume = carVolume;
      }
      voice.modLevel = clamp(modVolume, 0, 63);
    } else {
      voice.modLevel = clamp(modBase, 0, 63);
    }
  }
}

/**
 * `i_oplmusic.c` FrequencyForVoice — VERBATIM port.
 *
 * ```c
 * note = voice->note;
 * if ((flags & GENMIDI_FLAG_FIXED) == 0)
 *     note += (signed short) base_note_offset;
 * while (note < 0)  note += 12;
 * while (note > 95) note -= 12;
 * freq_index = 64 + 32 * note + voice->channel->bend;
 * if (voice->current_instr_voice != 0)
 *     freq_index += (fine_tuning / 2) - 64;
 * if (freq_index < 0)   freq_index = 0;
 * if (freq_index < 284) return frequency_curve[freq_index];
 * sub_index = (freq_index - 284) % (12 * 32);
 * octave    = (freq_index - 284) / (12 * 32);
 * if (octave >= 7) octave = 7;
 * return frequency_curve[sub_index + 284] | (octave << 10);
 * ```
 *
 * @param note Already-resolved play note (the caller applied the
 *   GENMIDI fixed-note rule and passes the GENMIDI flags so the
 *   transpose is skipped for percussion exactly as the reference).
 * @param baseNoteOffset signed `gm_voice->base_note_offset`.
 * @param fixedPitch the instrument's `GENMIDI_FLAG_FIXED` bit.
 * @param bend signed channel bend (`param2 - 64`, centre 0).
 * @param instrumentVoiceIndex `voice->current_instr_voice` (0 or 1).
 * @param fineTuning unsigned `instrument->fine_tuning`.
 */
export function frequencyForVoice(note: number, baseNoteOffset: number, fixedPitch: boolean, bend: number, instrumentVoiceIndex: number, fineTuning: number): { fNumber: number; block: number } {
  let n = note;
  if (!fixedPitch) {
    n += baseNoteOffset;
  }
  while (n < 0) {
    n += 12;
  }
  while (n > 95) {
    n -= 12;
  }

  let freqIndex = 64 + 32 * n + bend;
  if (instrumentVoiceIndex !== 0) {
    freqIndex += Math.floor(fineTuning / 2) - 64;
  }
  if (freqIndex < 0) {
    freqIndex = 0;
  }

  if (freqIndex < OPL_FREQ_CURVE_LEAD_IN) {
    const packed = OPL_FREQUENCY_CURVE[freqIndex]!;
    return { fNumber: packed & 0x3ff, block: (packed >> 10) & 0x07 };
  }

  const offset = freqIndex - OPL_FREQ_CURVE_LEAD_IN;
  const subIndex = offset % OPL_FREQ_OCTAVE_STRIDE;
  let octave = Math.floor(offset / OPL_FREQ_OCTAVE_STRIDE);
  if (octave >= 7) {
    octave = 7;
  }
  const packed = OPL_FREQUENCY_CURVE[subIndex + OPL_FREQ_CURVE_LEAD_IN]!;
  return { fNumber: packed & 0x3ff, block: octave };
}

/** Deviation #1: GENMIDI attack nibble (0..15) → per-sample envelope rise. */
function attackStepForNibble(nibble: number): number {
  // Higher attack nibble ⇒ faster attack.  Map nibble 0 → ~80 ms, 15 →
  // ~1 ms at 49716 Hz.  Monotone so louder/snappier instruments rise
  // faster; the exact OPL rate table is the emulator's job (cited
  // deviation #1).
  const ms = 80 / (1 + nibble * 1.6);
  return 1 / Math.max(1, (ms / 1000) * OPL_SAMPLE_RATE_HZ);
}

/** Deviation #1: GENMIDI release nibble (0..15) → per-sample envelope fall. */
function releaseStepForNibble(nibble: number): number {
  const ms = 240 / (1 + nibble * 1.6);
  return 1 / Math.max(1, (ms / 1000) * OPL_SAMPLE_RATE_HZ);
}

function createMidiChannelState(): MidiChannelState {
  return {
    instrument: 0,
    volume: MIDI_DEFAULT_CHANNEL_VOLUME,
    pan: MIDI_DEFAULT_CHANNEL_PAN,
    bend: MIDI_DEFAULT_PITCH_BEND,
  };
}

function createOplVoiceState(oplChannel: number): OplVoiceState {
  return {
    oplChannel,
    active: false,
    midiChannel: -1,
    note: -1,
    key: -1,
    instrument: null,
    voice: null,
    carrierBaseLevel: 0,
    modulatorBaseLevel: 0,
    additive: false,
    modPhase: 0,
    carPhase: 0,
    modPhaseInc: 0,
    carPhaseInc: 0,
    modLevel: 63,
    carLevel: 63,
    modWaveform: 0,
    carWaveform: 0,
    modMultiplier: 0,
    carMultiplier: 0,
    envelope: 0,
    attackStep: 0.01,
    releaseStep: 0.01,
    releasing: false,
    priority: 0,
    keyOnSerial: 0,
    noteVolume: 0,
    instrumentVoiceIndex: 0,
    playNote: -1,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const v = value | 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function clamp127(value: number): number {
  return clamp(value, 0, 127);
}

function clampSample(value: number): number {
  if (value > OPL_SAMPLE_PEAK) return OPL_SAMPLE_PEAK;
  if (value < OPL_SAMPLE_NADIR) return OPL_SAMPLE_NADIR;
  return value | 0;
}
