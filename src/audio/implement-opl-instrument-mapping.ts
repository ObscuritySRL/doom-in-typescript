/**
 * Vanilla DOOM 1.9 GENMIDI instrument mapping contract.
 *
 * From Chocolate Doom 2.2.1 i_oplmusic.c GENMIDI_t and the embedded
 * GENMIDI lump shipped with the IWAD:
 *
 *   GENMIDI is an 11904-byte lump containing:
 *     - 8 byte magic: "#OPL_II#"
 *     - 175 instruments × 36-byte voice records (175 = 128 General-MIDI
 *       melodic + 47 percussion = 6300 bytes)
 *     - 175 × 32-byte name strings = 5600 bytes
 *
 *   Voice record layout (36 bytes per GENMIDI_instr_t):
 *     uint16  flags     // 1=fixed-pitch, 2=delay, 4=two-voice
 *     uint8   finetune  // applied to second voice when 4 is set
 *     uint8   note      // fixed-pitch note for percussion (when flags&1)
 *     uint16  voice1[16]
 *     uint16  voice2[16]
 *     // each voice_t = 32 bytes: 16 byte opl_voice + 16 byte op pair
 *
 *   voice_t (16 bytes):
 *     uint8 tremolo_vibrato_sustain_ksr_mult   // reg 0x20..
 *     uint8 attack_decay                        // reg 0x60..
 *     uint8 sustain_release                     // reg 0x80..
 *     uint8 waveform                            // reg 0xE0..
 *     uint8 ksl_total_level                     // reg 0x40..
 *     uint8 feedback_connection                 // reg 0xC0..
 *     uint8 base_note_offset                    // pitch transpose
 *
 * Parity-critical details:
 *   - GENMIDI is a DOOM-specific format created by DMX (the proprietary
 *     audio library Carmack licensed). The same lump format is used by
 *     Hexen, Heretic, and Strife — they share id Software's bundle.
 *   - Percussion mapping: GENMIDI percussion slots 0..46 map to General
 *     MIDI percussion notes 35..81 (offset by -35). This is hardcoded
 *     in DMX's note-on path.
 *   - The "voice2" record is only used when flags&4 (two-voice mode).
 *     Single-voice instruments leave voice2 zero-filled but the bytes
 *     are still present in the lump.
 *   - GENMIDI may be replaced via PWAD lumps named GENMIDI (vanilla
 *     DOS loaded via lump name lookup).
 */

export const VANILLA_GENMIDI_MAGIC = '#OPL_II#';
export const VANILLA_GENMIDI_MAGIC_BYTE_LENGTH = 8;

export const VANILLA_GENMIDI_MELODIC_INSTRUMENT_COUNT = 128;
export const VANILLA_GENMIDI_PERCUSSION_INSTRUMENT_COUNT = 47;
export const VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT = VANILLA_GENMIDI_MELODIC_INSTRUMENT_COUNT + VANILLA_GENMIDI_PERCUSSION_INSTRUMENT_COUNT;

export const VANILLA_GENMIDI_VOICE_RECORD_BYTE_LENGTH = 36;
export const VANILLA_GENMIDI_NAME_RECORD_BYTE_LENGTH = 32;
export const VANILLA_GENMIDI_INSTRUMENT_VOICE_BLOCK_BYTES = VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT * VANILLA_GENMIDI_VOICE_RECORD_BYTE_LENGTH;
export const VANILLA_GENMIDI_INSTRUMENT_NAME_BLOCK_BYTES = VANILLA_GENMIDI_TOTAL_INSTRUMENT_COUNT * VANILLA_GENMIDI_NAME_RECORD_BYTE_LENGTH;
export const VANILLA_GENMIDI_TOTAL_LUMP_BYTE_LENGTH = VANILLA_GENMIDI_MAGIC_BYTE_LENGTH + VANILLA_GENMIDI_INSTRUMENT_VOICE_BLOCK_BYTES + VANILLA_GENMIDI_INSTRUMENT_NAME_BLOCK_BYTES;

export const VANILLA_GENMIDI_PERCUSSION_FIRST_GM_NOTE = 35;

export const VANILLA_GENMIDI_INSTRUMENT_FLAG_FIXED_PITCH = 1;
export const VANILLA_GENMIDI_INSTRUMENT_FLAG_DELAY = 2;
export const VANILLA_GENMIDI_INSTRUMENT_FLAG_TWO_VOICE = 4;

export function vanillaGenmidiPercussionGmNote(percussionSlot: number): number {
  if (!Number.isInteger(percussionSlot) || percussionSlot < 0 || percussionSlot >= VANILLA_GENMIDI_PERCUSSION_INSTRUMENT_COUNT) {
    throw new RangeError(`GENMIDI percussion slot must be in [0, ${VANILLA_GENMIDI_PERCUSSION_INSTRUMENT_COUNT}) (got ${percussionSlot})`);
  }
  return VANILLA_GENMIDI_PERCUSSION_FIRST_GM_NOTE + percussionSlot;
}

export function isVanillaGenmidiTwoVoiceInstrument(flags: number): boolean {
  return (flags & VANILLA_GENMIDI_INSTRUMENT_FLAG_TWO_VOICE) !== 0;
}

export function isVanillaGenmidiFixedPitchInstrument(flags: number): boolean {
  return (flags & VANILLA_GENMIDI_INSTRUMENT_FLAG_FIXED_PITCH) !== 0;
}
