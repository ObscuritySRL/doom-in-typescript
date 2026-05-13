/**
 * Vanilla DOOM 1.9 DMX sound effect lump loader contract.
 *
 * From Chocolate Doom 2.2.1 i_sound.c GetSfxLumpNum / CacheSFX and the DMX
 * binary format shipped inside DOOM1.WAD / DOOM.WAD as `DS*` lumps:
 *
 *   Header layout (8 bytes, little-endian):
 *     uint16 format       = 0x0003   (digital PCM)
 *     uint16 sampleRate   = 11025    (Hz, all stock sfx except DSITMBK)
 *     uint32 sampleCount  = N        (count of unsigned 8-bit PCM bytes)
 *   Body:
 *     uint8[N] samples    (DC zero = 0x80, two padding bytes at start+end)
 *
 *   Lump naming: digital sfx use the `DS` prefix (e.g. DSPISTOL); PC speaker
 *   variants use `DP`. Vanilla code derives the lump name by uppercasing the
 *   `sfxinfo_t.name` and prepending `DS`.
 *
 *   Padding contract: DMX writes one duplicate of the first sample at index 0
 *   and one duplicate of the last sample at index sampleCount-1. The audible
 *   region is samples[1 .. sampleCount-2], i.e. sampleCount - 2 bytes starting
 *   at byte offset 1.
 *
 *   Silence value: 128 (0x80) — the DC-zero midpoint of unsigned 8-bit PCM.
 */

export const VANILLA_SFX_HEADER_SIZE_BYTES = 8;
export const VANILLA_SFX_FORMAT_DIGITAL_PCM = 3;
export const VANILLA_SFX_DEFAULT_SAMPLE_RATE_HZ = 11025;
export const VANILLA_SFX_LUMP_NAME_PREFIX = 'DS';
export const VANILLA_SFX_PC_SPEAKER_NAME_PREFIX = 'DP';
export const VANILLA_SFX_PADDING_BYTE_COUNT = 2;
export const VANILLA_SFX_SILENCE_SAMPLE_VALUE = 0x80;

export interface VanillaSfxHeader {
  readonly format: number;
  readonly sampleRate: number;
  readonly sampleCount: number;
}

export const VANILLA_SFX_HEADER_FIELDS: readonly { readonly name: keyof VanillaSfxHeader; readonly byteOffset: number; readonly byteWidth: number }[] = Object.freeze([
  Object.freeze({ name: 'format', byteOffset: 0, byteWidth: 2 }),
  Object.freeze({ name: 'sampleRate', byteOffset: 2, byteWidth: 2 }),
  Object.freeze({ name: 'sampleCount', byteOffset: 4, byteWidth: 4 }),
]);

export function vanillaSfxLumpNameForSoundId(soundId: string): string {
  return `${VANILLA_SFX_LUMP_NAME_PREFIX}${soundId.toUpperCase()}`;
}

export function vanillaSfxAudibleByteRange(sampleCount: number): { readonly startByteOffset: number; readonly byteLength: number } {
  if (sampleCount < VANILLA_SFX_PADDING_BYTE_COUNT) {
    throw new RangeError(`sampleCount ${sampleCount} below ${VANILLA_SFX_PADDING_BYTE_COUNT} padding bytes`);
  }
  return Object.freeze({
    startByteOffset: VANILLA_SFX_PADDING_BYTE_COUNT / 2,
    byteLength: sampleCount - VANILLA_SFX_PADDING_BYTE_COUNT,
  });
}
