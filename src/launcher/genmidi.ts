/**
 * GENMIDI lump parser (Chocolate Doom 2.2.1 `i_oplmusic.c` `LoadInstrumentTable`).
 *
 * The IWAD ships an 11904-byte `GENMIDI` lump created by id Software's
 * DMX library.  `i_oplmusic.c` reads it into a `genmidi_instr_t[175]`
 * table where the first 128 entries are the General-MIDI melodic
 * programs and the trailing 47 entries are the percussion map (GM
 * percussion notes 35..81, offset −35 — see
 * {@link ../audio/implement-opl-instrument-mapping.ts}).
 *
 * The byte layout this module decodes is the exact `genmidi_voice_t` /
 * `genmidi_instr_t` C struct from `i_oplmusic.c` (the DMX OPL voice
 * record), transcribed verbatim:
 *
 * ```c
 * typedef struct {       // genmidi_op_t — 4 bytes per operator
 *     byte tremolo;      //   reg 0x20  (am | vib | EG-type | KSR | mult)
 *     byte attack;       //   reg 0x60  (attack << 4 | decay)
 *     byte sustain;      //   reg 0x80  (sustain << 4 | release)
 *     byte waveform;     //   reg 0xE0  (waveform select)
 *     byte scale;        //   reg 0x40  (KSL << 6) — added below, not here
 *     byte level;        //   reg 0x40  (total level 0..63)
 * } genmidi_op_t;        // NOTE: real struct is 6 bytes; see voice below
 *
 * typedef struct {       // genmidi_voice_t — 16 bytes
 *     genmidi_op_t modulator;       // 6 bytes (tremolo,attack,sustain,waveform,scale,level)
 *     byte         feedback;        // reg 0xC0  (feedback << 1 | connection)
 *     genmidi_op_t carrier;         // 6 bytes
 *     byte         unused;          // padding
 *     short        base_note_offset;// signed pitch transpose (LE)
 * } genmidi_voice_t;
 *
 * typedef struct {                  // genmidi_instr_t — 36 bytes
 *     unsigned short  flags;        // GENMIDI_FLAG_FIXED | _2VOICE
 *     byte            fine_tuning;  // applied to voice 2 (8.8 split @ 0x80)
 *     byte            fixed_note;   // fixed percussion note when FLAG_FIXED
 *     genmidi_voice_t voices[2];    // 2 × 16 = 32 bytes
 * } genmidi_instr_t;                // 4 + 32 = 36 bytes
 * ```
 *
 * Total lump = 8 (`#OPL_II#`) + 175×36 (voice records) + 175×32 (names).
 * This module decodes the voice records; the name block is ignored
 * exactly as `i_oplmusic.c` ignores it (it only seeks past it).
 *
 * Robustness contract (the live game must never crash on a bad lump):
 * {@link parseGenmidiLump} throws a typed {@link GenmidiParseError} on
 * any structural problem (wrong magic, truncated lump).  The caller
 * (the OPL music driver) catches it, logs, and runs music-silent — the
 * game keeps running.  The parser itself performs no I/O and holds no
 * mutable state.
 */

import {
  VANILLA_GENMIDI_INSTRUMENT_FLAG_FIXED_PITCH,
  VANILLA_GENMIDI_INSTRUMENT_FLAG_TWO_VOICE,
  VANILLA_GENMIDI_MAGIC,
  VANILLA_GENMIDI_MAGIC_BYTE_LENGTH,
  VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT,
  VANILLA_GENMIDI_VOICE_RECORD_BYTE_LENGTH,
  isVanillaGenmidiFixedPitchInstrument,
  isVanillaGenmidiTwoVoiceInstrument,
} from '../audio/implement-opl-instrument-mapping.ts';

/** Bytes per `genmidi_op_t` operator record (tremolo, attack, sustain, waveform, scale, level). */
export const GENMIDI_OPERATOR_BYTE_LENGTH = 6;

/** Bytes per `genmidi_voice_t` (modulator 6 + feedback 1 + carrier 6 + unused 1 + base_note_offset 2). */
export const GENMIDI_VOICE_BYTE_LENGTH = 16;

/** One decoded OPL operator from a GENMIDI voice record (raw register bytes). */
export interface GenmidiOperator {
  /** Register 0x20 byte: AM | vibrato | EG-type | KSR | multiplier. */
  readonly tremolo: number;
  /** Register 0x60 byte: attack rate (high nibble) | decay rate (low nibble). */
  readonly attack: number;
  /** Register 0x80 byte: sustain level (high nibble) | release rate (low nibble). */
  readonly sustain: number;
  /** Register 0xE0 byte: waveform select (0..3 on OPL2). */
  readonly waveform: number;
  /** Key-scale-level field (bits 6-7 of register 0x40), pre-shifted as stored by DMX. */
  readonly scale: number;
  /** Total-level field (0..63), the low 6 bits of register 0x40. */
  readonly level: number;
}

/** One decoded OPL voice (modulator + carrier + channel feedback/connection + transpose). */
export interface GenmidiVoice {
  readonly modulator: GenmidiOperator;
  readonly carrier: GenmidiOperator;
  /** Register 0xC0 byte: feedback (bits 1-3) | connection/algorithm (bit 0). */
  readonly feedback: number;
  /** Signed pitch transpose applied to the played MIDI note (`base_note_offset`). */
  readonly baseNoteOffset: number;
}

/** One decoded GENMIDI instrument (melodic program or percussion slot). */
export interface GenmidiInstrument {
  /** Raw 16-bit flags word (`GENMIDI_FLAG_FIXED` 1, `GENMIDI_FLAG_2VOICE` 4). */
  readonly flags: number;
  /** `true` when bit 0 is set — a fixed-pitch (percussion) instrument. */
  readonly fixedPitch: boolean;
  /** `true` when bit 2 is set — DMX plays both `voices[0]` and `voices[1]`. */
  readonly twoVoice: boolean;
  /** Unsigned fine-tuning byte applied to voice 2 (split around 0x80). */
  readonly fineTuning: number;
  /** Fixed MIDI note for percussion instruments (used when `fixedPitch`). */
  readonly fixedNote: number;
  /** `voices[0]` and `voices[1]` exactly as the C `genmidi_voice_t voices[2]`. */
  readonly voices: readonly [GenmidiVoice, GenmidiVoice];
}

/** Fully parsed GENMIDI table: 128 melodic + 47 percussion instruments. */
export interface GenmidiTable {
  /** Exactly {@link VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT} (175) instruments in lump order. */
  readonly instruments: readonly GenmidiInstrument[];
}

/** Typed error thrown for any structurally invalid GENMIDI lump. */
export class GenmidiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenmidiParseError';
  }
}

/**
 * Parse a raw `GENMIDI` lump into the 175-instrument voice table,
 * mirroring `i_oplmusic.c` `LoadInstrumentTable`.
 *
 * @throws {GenmidiParseError} If the magic is not `#OPL_II#` or the
 *   lump is too short to hold 175 36-byte voice records after the
 *   8-byte magic.
 */
export function parseGenmidiLump(lumpData: Buffer): Readonly<GenmidiTable> {
  if (lumpData.length < VANILLA_GENMIDI_MAGIC_BYTE_LENGTH) {
    throw new GenmidiParseError(`GENMIDI lump too small for an 8-byte magic (got ${lumpData.length} bytes)`);
  }

  const magic = lumpData.toString('latin1', 0, VANILLA_GENMIDI_MAGIC_BYTE_LENGTH);
  if (magic !== VANILLA_GENMIDI_MAGIC) {
    throw new GenmidiParseError(`GENMIDI lump has invalid magic: expected ${JSON.stringify(VANILLA_GENMIDI_MAGIC)}, got ${JSON.stringify(magic)}`);
  }

  const voiceBlockEnd = VANILLA_GENMIDI_MAGIC_BYTE_LENGTH + VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT * VANILLA_GENMIDI_VOICE_RECORD_BYTE_LENGTH;
  if (lumpData.length < voiceBlockEnd) {
    throw new GenmidiParseError(`GENMIDI lump too small for ${VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT} voice records: need ${voiceBlockEnd} bytes, got ${lumpData.length}`);
  }

  const instruments: GenmidiInstrument[] = new Array(VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT);
  let offset = VANILLA_GENMIDI_MAGIC_BYTE_LENGTH;
  for (let index = 0; index < VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT; index += 1) {
    instruments[index] = parseInstrument(lumpData, offset);
    offset += VANILLA_GENMIDI_VOICE_RECORD_BYTE_LENGTH;
  }

  return Object.freeze<GenmidiTable>({ instruments: Object.freeze(instruments) });
}

function parseInstrument(lumpData: Buffer, base: number): GenmidiInstrument {
  // genmidi_instr_t: flags(2) fine_tuning(1) fixed_note(1) voices[2](32)
  const flags = lumpData.readUInt16LE(base);
  const fineTuning = lumpData.readUInt8(base + 2);
  const fixedNote = lumpData.readUInt8(base + 3);
  const voice0 = parseVoice(lumpData, base + 4);
  const voice1 = parseVoice(lumpData, base + 4 + GENMIDI_VOICE_BYTE_LENGTH);
  return Object.freeze<GenmidiInstrument>({
    flags,
    fixedPitch: isVanillaGenmidiFixedPitchInstrument(flags) && (flags & VANILLA_GENMIDI_INSTRUMENT_FLAG_FIXED_PITCH) !== 0,
    twoVoice: isVanillaGenmidiTwoVoiceInstrument(flags) && (flags & VANILLA_GENMIDI_INSTRUMENT_FLAG_TWO_VOICE) !== 0,
    fineTuning,
    fixedNote,
    voices: Object.freeze([voice0, voice1] as [GenmidiVoice, GenmidiVoice]),
  });
}

function parseVoice(lumpData: Buffer, base: number): GenmidiVoice {
  // genmidi_voice_t: modulator(6) feedback(1) carrier(6) unused(1) base_note_offset(2, signed LE)
  const modulator = parseOperator(lumpData, base);
  const feedback = lumpData.readUInt8(base + GENMIDI_OPERATOR_BYTE_LENGTH);
  const carrier = parseOperator(lumpData, base + GENMIDI_OPERATOR_BYTE_LENGTH + 1);
  const baseNoteOffset = lumpData.readInt16LE(base + GENMIDI_OPERATOR_BYTE_LENGTH + 1 + GENMIDI_OPERATOR_BYTE_LENGTH + 1);
  return Object.freeze<GenmidiVoice>({ modulator, carrier, feedback, baseNoteOffset });
}

function parseOperator(lumpData: Buffer, base: number): GenmidiOperator {
  // genmidi_op_t: tremolo(1) attack(1) sustain(1) waveform(1) scale(1) level(1)
  return Object.freeze<GenmidiOperator>({
    tremolo: lumpData.readUInt8(base),
    attack: lumpData.readUInt8(base + 1),
    sustain: lumpData.readUInt8(base + 2),
    waveform: lumpData.readUInt8(base + 3),
    scale: lumpData.readUInt8(base + 4),
    level: lumpData.readUInt8(base + 5),
  });
}
