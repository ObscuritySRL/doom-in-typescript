/**
 * Audit ledger for the vanilla DOOM 1.9 sound effect lump parser, the
 * `getsfx()` / `I_GetSfxLumpNum()` pipeline that resolves each
 * `sfxinfo_t.name` entry to a directory lump named `DS<sfxinfo->name>`,
 * loads the 8-byte DMX header, validates the digital PCM format magic
 * (`0x03 0x00`), reads the unsigned 16-bit little-endian sample rate,
 * reads the unsigned 32-bit little-endian sample count, and exposes the
 * unsigned 8-bit PCM body to the mixer.
 *
 * This module pins the runtime contract one level deeper than the prior
 * 05-001..05-004 marker / lookup audits, the 05-005 PLAYPAL / COLORMAP
 * audit, the 05-006 patch picture format audit, the 05-007 flat
 * namespace audit, the 05-008 PNAMES audit, the 05-009 / 05-010
 * TEXTURE1 / TEXTURE2 audits, and the 05-011 sprite namespace audit:
 * the 2-byte `DS` lump-name prefix produced by `sprintf(name, "ds%s",
 * sfx->name)`, the 8-byte DMX header at the start of every sound effect
 * lump, the `format=0x03` magic bytes that gate the digital PCM variant,
 * the `sampleRate` field at offset 2 (uint16-LE, 11025 Hz default with
 * a single 22050 Hz outlier `DSITMBK`), the `sampleCount` field at
 * offset 4 (uint32-LE, total PCM body length in bytes including the two
 * DMX padding bytes), the `lumpLength === 8 + sampleCount` total size
 * formula, the `0x80` (128) DC-zero midpoint of the unsigned 8-bit PCM
 * encoding that vanilla `getsfx()` uses to fill the trailing
 * `paddedsfx + 8` mixing buffer, the `lumplen < 8 || data[0] != 0x03 ||
 * data[1] != 0x00` validation gate (Chocolate Doom 2.2.1 `i_sdlsound.c`
 * `CacheSFX`), and the absence of any S_START / S_END marker range
 * around the DS lumps (sound effects live at fixed names anywhere in
 * the directory and are looked up by full lump name, not by
 * marker-bounded range). The accompanying focused test imports the
 * ledger plus a self-contained `parseSoundEffectLumpHeader` runtime
 * exposed by this module and cross-checks every audit entry against the
 * runtime behavior plus the live shareware `doom/DOOM1.WAD` oracle.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/i_sdlsound.c`,
 *      `src/i_sound.c`, `src/doom/sounds.c`, `src/w_wad.c`).
 *
 * The header layout and validation rules below are pinned against
 * authority 5 (Chocolate Doom 2.2.1 `i_sdlsound.c` `CacheSFX`) because
 * the upstream linuxdoom-1.10 `getsfx()` performs no header
 * inspection — it simply skips 8 bytes via `paddedsfx + 8` and trusts
 * the body. The DMX format magic (`data[0] != 0x03 || data[1] != 0x00`)
 * and the sample-rate / sample-count field offsets are textual
 * constants of the Chocolate Doom 2.2.1 source body, not of any
 * runtime register state. The lowercase `sprintf(name, "ds%s", ...)`
 * format string is a textual constant of the upstream linuxdoom-1.10
 * `i_sound.c` `getsfx` and `I_GetSfxLumpNum` bodies (case is folded to
 * uppercase by `W_CheckNumForName` / `W_GetNumForName` before hashing).
 * The shareware `DOOM1.WAD` oracle facts (55 DS lumps, first DS at
 * directory index 110 = DSPISTOL, last DS at directory index 218 =
 * DSGETPOW, the single 22050 Hz outlier `DSITMBK`, and selected pinned
 * sound effects with their file offsets, raw header fields, sha-256
 * fingerprints) are pinned against authority 2 — the local IWAD
 * itself — and re-derived from the on-disk file every test run.
 */

import { BinaryReader } from '../core/binaryReader.ts';

/**
 * One audited byte-level layout fact, semantic constant, or runtime
 * contract of the sound effect lump parser, pinned to its upstream
 * declaration.
 */
export interface SoundEffectLumpAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'sound-effect-lump-name-prefix-ds'
    | 'sound-effect-lump-name-formed-via-sprintf-ds-percent-s'
    | 'sound-effect-lump-name-lookup-via-w-getnumforname'
    | 'sound-effect-lump-header-bytes-eight'
    | 'sound-effect-lump-header-format-field-offset-zero'
    | 'sound-effect-lump-header-format-field-uint16-le'
    | 'sound-effect-lump-header-format-magic-three'
    | 'sound-effect-lump-header-sample-rate-field-offset-two'
    | 'sound-effect-lump-header-sample-rate-field-uint16-le'
    | 'sound-effect-lump-header-sample-count-field-offset-four'
    | 'sound-effect-lump-header-sample-count-field-uint32-le'
    | 'sound-effect-lump-total-size-formula-header-plus-sample-count'
    | 'sound-effect-lump-lumplen-less-than-eight-rejected'
    | 'sound-effect-lump-pcm-midpoint-byte-128'
    | 'sound-effect-lump-no-marker-range'
    | 'sound-effect-lump-shareware-doom1-fifty-five-effects';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'DS-lump' | 'getsfx' | 'I_GetSfxLumpNum' | 'CacheSFX' | 'parseSoundEffectLumpHeader' | 'shareware-doom1.wad';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the upstream tree. */
  readonly referenceSourceFile: 'linuxdoom-1.10/i_sound.c' | 'src/i_sdlsound.c' | 'src/i_sound.c' | 'src/w_wad.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and runtime
 * parser contract the runtime sound effect lump loader must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const SOUND_EFFECT_LUMP_AUDIT: readonly SoundEffectLumpAuditEntry[] = [
  {
    id: 'sound-effect-lump-name-prefix-ds',
    subject: 'getsfx',
    cSourceLines: ['sprintf(name, "ds%s", sfxname);'],
    referenceSourceFile: 'linuxdoom-1.10/i_sound.c',
    invariant:
      'Vanilla `getsfx()` constructs the lump name by prepending `ds` (lowercase) to the `sfxinfo_t.name` field. The WAD directory stores names uppercase, and `W_CheckNumForName` / `W_GetNumForName` uppercase the lookup key before hashing, so the on-disk lumps appear as `DSPISTOL`, `DSPLPAIN`, etc. The runtime models this with `SFX_LUMP_NAME_PREFIX === "DS"` exposed as the canonical uppercase prefix.',
  },
  {
    id: 'sound-effect-lump-name-formed-via-sprintf-ds-percent-s',
    subject: 'I_GetSfxLumpNum',
    cSourceLines: ['char namebuf[9];', 'sprintf(namebuf, "ds%s", sfx->name);', 'return W_GetNumForName(namebuf);'],
    referenceSourceFile: 'linuxdoom-1.10/i_sound.c',
    invariant:
      'Vanilla `I_GetSfxLumpNum` allocates a 9-byte stack buffer (8-byte WAD-name field plus a NUL terminator) and writes the lump name as `ds%s` formatted from `sfxinfo_t.name`. The buffer width gates the maximum sound-effect base name length to 6 characters (since the `ds` prefix consumes 2 of the 8 WAD name bytes). The runtime models this with `SFX_LUMP_NAME_PREFIX_LENGTH === 2` and `SFX_LUMP_NAME_FIELD_BYTES === 8` exposed by `parse-sound-effect-lumps.ts`.',
  },
  {
    id: 'sound-effect-lump-name-lookup-via-w-getnumforname',
    subject: 'I_GetSfxLumpNum',
    cSourceLines: ['return W_GetNumForName(namebuf);'],
    referenceSourceFile: 'linuxdoom-1.10/i_sound.c',
    invariant:
      'Vanilla `I_GetSfxLumpNum` resolves the constructed lump name via `W_GetNumForName`, which throws a fatal `I_Error` on miss (unlike `W_CheckNumForName` used by the PNAMES patchlookup which yields -1). A registered-only sound effect requested while running on shareware would be a fatal error if `getsfx()` did not fall back to `dspistol` via `if (W_CheckNumForName(name) == -1) sfxlump = W_GetNumForName("dspistol");`. The runtime models this with `isSoundEffectLumpName` testing for the uppercase `DS` prefix.',
  },
  {
    id: 'sound-effect-lump-header-bytes-eight',
    subject: 'CacheSFX',
    cSourceLines: ['if (lumplen < 8'],
    referenceSourceFile: 'src/i_sdlsound.c',
    invariant:
      '`CacheSFX` rejects any DS lump whose total byte length is less than 8. The 8-byte header (format + sampleRate + sampleCount) is mandatory before any PCM body is read. The runtime models this with `SFX_HEADER_BYTES === 8` exposed by `parse-sound-effect-lumps.ts`.',
  },
  {
    id: 'sound-effect-lump-header-format-field-offset-zero',
    subject: 'DS-lump',
    cSourceLines: ['data[0] != 0x03 || data[1] != 0x00'],
    referenceSourceFile: 'src/i_sdlsound.c',
    invariant:
      '`CacheSFX` reads the format magic from bytes 0 and 1 of the DS lump (`data[0]`, `data[1]`). The format field starts at offset 0. The runtime models this with `SFX_FORMAT_FIELD_OFFSET === 0` exposed by `parse-sound-effect-lumps.ts`.',
  },
  {
    id: 'sound-effect-lump-header-format-field-uint16-le',
    subject: 'DS-lump',
    cSourceLines: ['data[0] != 0x03 || data[1] != 0x00'],
    referenceSourceFile: 'src/i_sdlsound.c',
    invariant:
      '`CacheSFX` validates the format field as a 16-bit little-endian integer: `data[0]` must equal 0x03 and `data[1]` must equal 0x00. The composite uint16-LE value is therefore exactly 3. The runtime models this with `SFX_FORMAT_FIELD_BYTES === 2` and `SFX_DIGITAL_FORMAT_VALUE === 3`.',
  },
  {
    id: 'sound-effect-lump-header-format-magic-three',
    subject: 'CacheSFX',
    cSourceLines: ['data[0] != 0x03 || data[1] != 0x00'],
    referenceSourceFile: 'src/i_sdlsound.c',
    invariant:
      '`CacheSFX` rejects any DS lump whose format field does not equal 3 (the digital PCM DMX variant). The lower byte 0x03 is the format magic; the upper byte 0x00 is the high half of the 16-bit format value. The runtime models this with `parseSoundEffectLumpHeader` returning the literal `format: 3` for every shareware DOOM1.WAD DS lump.',
  },
  {
    id: 'sound-effect-lump-header-sample-rate-field-offset-two',
    subject: 'DS-lump',
    cSourceLines: ['samplerate = (data[3] << 8) | data[2];'],
    referenceSourceFile: 'src/i_sdlsound.c',
    invariant:
      '`CacheSFX` reads the sample rate field from bytes 2 and 3 (`data[2]` low, `data[3]` high). The sample rate field starts at offset 2. The runtime models this with `SFX_SAMPLE_RATE_FIELD_OFFSET === 2` exposed by `parse-sound-effect-lumps.ts`.',
  },
  {
    id: 'sound-effect-lump-header-sample-rate-field-uint16-le',
    subject: 'DS-lump',
    cSourceLines: ['samplerate = (data[3] << 8) | data[2];'],
    referenceSourceFile: 'src/i_sdlsound.c',
    invariant:
      '`CacheSFX` reads the sample rate as a 16-bit little-endian integer (`data[2]` low byte, `data[3]` high byte, composed as `(data[3] << 8) | data[2]`). Stock shareware DOOM1.WAD sound effects use 11025 Hz with a single outlier (`DSITMBK` = 22050 Hz). The runtime models this with `SFX_SAMPLE_RATE_FIELD_BYTES === 2`, `SFX_DEFAULT_SAMPLE_RATE_HZ === 11025`, and `parseSoundEffectLumpHeader` reading via `BinaryReader.readUint16()` (little-endian).',
  },
  {
    id: 'sound-effect-lump-header-sample-count-field-offset-four',
    subject: 'DS-lump',
    cSourceLines: ['length = (data[7] << 24) | (data[6] << 16) | (data[5] << 8) | data[4];'],
    referenceSourceFile: 'src/i_sdlsound.c',
    invariant:
      '`CacheSFX` reads the sample count field from bytes 4, 5, 6, and 7 (`data[4]` LSB through `data[7]` MSB). The sample count field starts at offset 4, immediately after the 2-byte format field and the 2-byte sample rate field. The runtime models this with `SFX_SAMPLE_COUNT_FIELD_OFFSET === 4`.',
  },
  {
    id: 'sound-effect-lump-header-sample-count-field-uint32-le',
    subject: 'DS-lump',
    cSourceLines: ['length = (data[7] << 24) | (data[6] << 16) | (data[5] << 8) | data[4];'],
    referenceSourceFile: 'src/i_sdlsound.c',
    invariant:
      '`CacheSFX` reads the sample count as a 32-bit little-endian integer (`data[4]` LSB through `data[7]` MSB). The composite uint32-LE value is the total byte count of the PCM body that follows the 8-byte header (including DMX padding bytes). The runtime models this with `SFX_SAMPLE_COUNT_FIELD_BYTES === 4` and `parseSoundEffectLumpHeader` reading via `BinaryReader.readUint32()` (little-endian).',
  },
  {
    id: 'sound-effect-lump-total-size-formula-header-plus-sample-count',
    subject: 'CacheSFX',
    cSourceLines: ['size = W_LumpLength( sfxlump );'],
    referenceSourceFile: 'linuxdoom-1.10/i_sound.c',
    invariant:
      'The total DS lump size in bytes is `8 + sampleCount`: an 8-byte DMX header followed by `sampleCount` PCM body bytes with no inter-block padding and no trailing data. The runtime models this with `soundEffectLumpDataSize(sampleCount) === SFX_HEADER_BYTES + sampleCount` exposed by `parse-sound-effect-lumps.ts`.',
  },
  {
    id: 'sound-effect-lump-lumplen-less-than-eight-rejected',
    subject: 'CacheSFX',
    cSourceLines: ['if (lumplen < 8', ' || data[0] != 0x03 || data[1] != 0x00)', '{', '    // Invalid sound', '    return false;', '}'],
    referenceSourceFile: 'src/i_sdlsound.c',
    invariant:
      '`CacheSFX` returns `false` when the lump is shorter than 8 bytes OR the format magic does not equal 0x0003. Both checks are part of the same gate: a malformed DS lump is silently skipped at cache time. The runtime models this with `parseSoundEffectLumpHeader` throwing a `RangeError` on either failure path so callers can produce a precise diagnostic.',
  },
  {
    id: 'sound-effect-lump-pcm-midpoint-byte-128',
    subject: 'getsfx',
    cSourceLines: ['for (i=size ; i<paddedsize+8 ; i++)', '    paddedsfx[i] = 128;'],
    referenceSourceFile: 'linuxdoom-1.10/i_sound.c',
    invariant:
      'Vanilla `getsfx()` pads the trailing region of the mixing buffer with byte value 128 (0x80) — the DC-zero midpoint of unsigned 8-bit PCM encoding. Any sound effect length that does not align to the mixer block size has its tail rounded up and filled with 0x80 silence. The runtime models this with `SFX_PCM_MIDPOINT_BYTE === 0x80`.',
  },
  {
    id: 'sound-effect-lump-no-marker-range',
    subject: 'DS-lump',
    cSourceLines: ['return W_GetNumForName(namebuf);'],
    referenceSourceFile: 'linuxdoom-1.10/i_sound.c',
    invariant:
      'Sound effect lumps in vanilla DOOM 1.9 are NOT enclosed by an `S_START` / `S_END` style marker range. Each DS lump is looked up by its full name via `W_GetNumForName` directly. The DS lumps therefore live at fixed positions in the WAD directory anywhere between the patches and the music; in shareware DOOM1.WAD they sit at directory indices 110..218 contiguously, but the contiguity is a layout convention of the IWAD, not a parser-enforced invariant. (Note: the prior `S_START` / `S_END` markers in the directory bound the SPRITE namespace, not the SOUND namespace — the marker name collision with sfx is incidental.)',
  },
  {
    id: 'sound-effect-lump-shareware-doom1-fifty-five-effects',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['sprintf(name, "ds%s", sfxname);'],
    referenceSourceFile: 'linuxdoom-1.10/i_sound.c',
    invariant:
      'The shareware `doom/DOOM1.WAD` ships exactly 55 digital sound effect lumps with the `DS` prefix. The first DS lump in directory order is `DSPISTOL` at index 110, the last is `DSGETPOW` at index 218. The 55 count matches the `lumpCategories.sound-effect: 55` field in `reference/manifests/wad-map-summary.json`. The runtime models this with the oracle entry whose `dsLumpCount === 55`, `firstDsLumpIndex === 110`, and `lastDsLumpIndex === 218`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface SoundEffectLumpDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const SOUND_EFFECT_LUMP_DERIVED_INVARIANTS: readonly SoundEffectLumpDerivedInvariant[] = [
  {
    id: 'SFX_LUMP_NAME_PREFIX_EQUALS_DS',
    description: '`SFX_LUMP_NAME_PREFIX === "DS"`. Matches the upstream `sprintf(name, "ds%s", ...)` after the WAD name table uppercases the directory key.',
  },
  {
    id: 'SFX_LUMP_NAME_PREFIX_LENGTH_EQUALS_TWO',
    description: '`SFX_LUMP_NAME_PREFIX_LENGTH === 2`. Matches the 2-byte literal `ds` consumed by `sprintf(name, "ds%s", ...)`.',
  },
  {
    id: 'SFX_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT',
    description: '`SFX_LUMP_NAME_FIELD_BYTES === 8`. Matches the 8-byte WAD directory name field; the `ds` prefix plus a 6-character base name fills the field exactly.',
  },
  {
    id: 'SFX_HEADER_BYTES_EQUALS_EIGHT',
    description: '`SFX_HEADER_BYTES === 8`. Matches the upstream `if (lumplen < 8 ...)` minimum-length check in `CacheSFX`.',
  },
  {
    id: 'SFX_FORMAT_FIELD_OFFSET_EQUALS_ZERO',
    description: '`SFX_FORMAT_FIELD_OFFSET === 0`. Matches the upstream `data[0]` / `data[1]` reads in `CacheSFX`.',
  },
  {
    id: 'SFX_FORMAT_FIELD_BYTES_EQUALS_TWO',
    description: '`SFX_FORMAT_FIELD_BYTES === 2`. Matches the upstream uint16-LE composition of `data[0]` and `data[1]`.',
  },
  {
    id: 'SFX_DIGITAL_FORMAT_VALUE_EQUALS_THREE',
    description: '`SFX_DIGITAL_FORMAT_VALUE === 3`. Matches the upstream `data[0] != 0x03 || data[1] != 0x00` magic check in `CacheSFX`.',
  },
  {
    id: 'SFX_SAMPLE_RATE_FIELD_OFFSET_EQUALS_TWO',
    description: '`SFX_SAMPLE_RATE_FIELD_OFFSET === 2`. Matches the upstream `data[2]` / `data[3]` reads in `CacheSFX`.',
  },
  {
    id: 'SFX_SAMPLE_RATE_FIELD_BYTES_EQUALS_TWO',
    description: '`SFX_SAMPLE_RATE_FIELD_BYTES === 2`. Matches the upstream uint16-LE composition `(data[3] << 8) | data[2]`.',
  },
  {
    id: 'SFX_SAMPLE_COUNT_FIELD_OFFSET_EQUALS_FOUR',
    description: '`SFX_SAMPLE_COUNT_FIELD_OFFSET === 4`. Matches the upstream `data[4]` / `data[5]` / `data[6]` / `data[7]` reads in `CacheSFX`.',
  },
  {
    id: 'SFX_SAMPLE_COUNT_FIELD_BYTES_EQUALS_FOUR',
    description: '`SFX_SAMPLE_COUNT_FIELD_BYTES === 4`. Matches the upstream uint32-LE composition `(data[7] << 24) | (data[6] << 16) | (data[5] << 8) | data[4]`.',
  },
  {
    id: 'SFX_DEFAULT_SAMPLE_RATE_HZ_EQUALS_11025',
    description: '`SFX_DEFAULT_SAMPLE_RATE_HZ === 11025`. Matches the stock vanilla DOOM 1.9 sample rate used by every shareware DOOM1.WAD DS lump except `DSITMBK`.',
  },
  {
    id: 'SFX_PCM_MIDPOINT_BYTE_EQUALS_128',
    description: '`SFX_PCM_MIDPOINT_BYTE === 128 === 0x80`. Matches the upstream `paddedsfx[i] = 128;` silence-pad fill in `getsfx()`.',
  },
  {
    id: 'SFX_LUMP_TOTAL_SIZE_FORMULA_EQUALS_HEADER_PLUS_SAMPLE_COUNT',
    description: '`soundEffectLumpDataSize(sampleCount) === SFX_HEADER_BYTES + sampleCount`. Matches the upstream `size = W_LumpLength(sfxlump)` total layout: 8-byte header followed by `sampleCount` PCM body bytes.',
  },
  {
    id: 'PARSE_SOUND_EFFECT_LUMP_HEADER_RETURNS_FROZEN_HEADER',
    description: 'A successful `parseSoundEffectLumpHeader(buffer)` returns an object that is `Object.isFrozen`.',
  },
  {
    id: 'PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
    description: '`parseSoundEffectLumpHeader(new Uint8Array(7))` throws a `RangeError`. The 8-byte header is mandatory before any body is read.',
  },
  {
    id: 'PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_NON_DIGITAL_FORMAT',
    description: '`parseSoundEffectLumpHeader(bufferWithFormatTwo)` throws a `RangeError`. The format field must equal exactly 3 (DMX digital PCM).',
  },
  {
    id: 'PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_BODY_LENGTH_MISMATCH',
    description: '`parseSoundEffectLumpHeader(bufferWithTruncatedBody)` throws a `RangeError` when `lumpData.length !== SFX_HEADER_BYTES + sampleCount`.',
  },
  {
    id: 'IS_SOUND_EFFECT_LUMP_NAME_REQUIRES_DS_PREFIX',
    description:
      '`isSoundEffectLumpName(name)` returns true iff `name.length > SFX_LUMP_NAME_PREFIX_LENGTH` and `name.slice(0, SFX_LUMP_NAME_PREFIX_LENGTH).toUpperCase() === SFX_LUMP_NAME_PREFIX`. Matches the upstream uppercase `DS` lookup convention.',
  },
  {
    id: 'IS_SOUND_EFFECT_LUMP_NAME_REJECTS_DP_PC_SPEAKER_PREFIX',
    description: '`isSoundEffectLumpName("DPPISTOL") === false`. The PC-speaker variant uses `DP` not `DS` and must not be classified as a digital sound effect.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Lump-name prefix that identifies digital sound effects in the WAD directory (`DS<sfxname>`). */
export const SFX_LUMP_NAME_PREFIX = 'DS';

/** Byte length of the upstream lump-name prefix `ds` (matches `sprintf(name, "ds%s", ...)`). */
export const SFX_LUMP_NAME_PREFIX_LENGTH = 2;

/** Byte length of the 8-byte WAD directory name field that holds the `DS<sfxname>` lump name. */
export const SFX_LUMP_NAME_FIELD_BYTES = 8;

/** Byte size of the DMX header at the start of every sound effect lump. */
export const SFX_HEADER_BYTES = 8;

/** Byte offset of the `format` field inside the DMX header. */
export const SFX_FORMAT_FIELD_OFFSET = 0;

/** Byte width of the `format` field inside the DMX header (uint16-LE). */
export const SFX_FORMAT_FIELD_BYTES = 2;

/** Required `format` field value for the digital PCM DMX variant (`data[0] == 0x03 && data[1] == 0x00`). */
export const SFX_DIGITAL_FORMAT_VALUE = 3;

/** Byte offset of the `sampleRate` field inside the DMX header. */
export const SFX_SAMPLE_RATE_FIELD_OFFSET = 2;

/** Byte width of the `sampleRate` field inside the DMX header (uint16-LE). */
export const SFX_SAMPLE_RATE_FIELD_BYTES = 2;

/** Byte offset of the `sampleCount` field inside the DMX header. */
export const SFX_SAMPLE_COUNT_FIELD_OFFSET = 4;

/** Byte width of the `sampleCount` field inside the DMX header (uint32-LE). */
export const SFX_SAMPLE_COUNT_FIELD_BYTES = 4;

/** Default sample rate (Hz) used by every shareware DOOM1.WAD DS lump except `DSITMBK` (22050 Hz). */
export const SFX_DEFAULT_SAMPLE_RATE_HZ = 11025;

/** DC-zero midpoint of the unsigned 8-bit PCM encoding (matches the `paddedsfx[i] = 128;` fill in `getsfx()`). */
export const SFX_PCM_MIDPOINT_BYTE = 0x80;

/**
 * Compute the total byte size of a syntactically valid DS sound effect
 * lump for a given header `sampleCount`. Mirrors the upstream `8 +
 * sampleCount` total: an 8-byte DMX header followed by `sampleCount`
 * PCM body bytes.
 *
 * @param sampleCount - Header `sampleCount` field value.
 * @returns Required byte size of the DS lump.
 * @throws {RangeError} If `sampleCount` is negative or not an integer.
 */
export function soundEffectLumpDataSize(sampleCount: number): number {
  if (!Number.isInteger(sampleCount) || sampleCount < 0) {
    throw new RangeError(`soundEffectLumpDataSize: sampleCount must be a non-negative integer, got ${sampleCount}`);
  }
  return SFX_HEADER_BYTES + sampleCount;
}

/** Decoded DMX header fields from a sound effect lump. */
export interface SoundEffectLumpHeader {
  /** Raw `format` field from the header (always `SFX_DIGITAL_FORMAT_VALUE` after validation). */
  readonly format: number;
  /** `sampleRate` field from the header in Hz. */
  readonly sampleRate: number;
  /** `sampleCount` field from the header (total PCM body length in bytes including DMX padding). */
  readonly sampleCount: number;
}

/**
 * Parse the 8-byte DMX header from a sound effect lump.
 *
 * Mirrors the vanilla `CacheSFX` validation gate from Chocolate Doom
 * 2.2.1 `i_sdlsound.c`:
 *   - rejects any lump whose total byte length is less than 8
 *     (matching `if (lumplen < 8 ...)`),
 *   - rejects any lump whose format magic is not 3
 *     (matching `data[0] != 0x03 || data[1] != 0x00`),
 *   - reads the sample rate as a uint16-LE at offset 2
 *     (matching `samplerate = (data[3] << 8) | data[2];`),
 *   - reads the sample count as a uint32-LE at offset 4
 *     (matching `length = (data[7] << 24) | (data[6] << 16) | (data[5] << 8) | data[4];`),
 *   - validates that the lump body length matches the declared sample count
 *     (matching the `8 + sampleCount` total layout).
 *
 * The parser does NOT inspect the PCM body — that is the responsibility
 * of the downstream mixer (vanilla `getsfx()` / Chocolate Doom 2.2.1
 * `CacheSFX`), which copies the body, pads it with `SFX_PCM_MIDPOINT_BYTE`,
 * and surrenders the header by returning `paddedsfx + 8`.
 *
 * @param lumpData - Raw DS lump data.
 * @returns Frozen {@link SoundEffectLumpHeader}.
 * @throws {RangeError} If the lump is too small for the header, declares
 *   a non-digital format, or has a body length mismatched against the
 *   declared sample count.
 */
export function parseSoundEffectLumpHeader(lumpData: Buffer | Uint8Array): SoundEffectLumpHeader {
  if (lumpData.length < SFX_HEADER_BYTES) {
    throw new RangeError(`parseSoundEffectLumpHeader: lump must be at least ${SFX_HEADER_BYTES} bytes for the DMX header, got ${lumpData.length}`);
  }

  const buffer = lumpData instanceof Buffer ? lumpData : Buffer.from(lumpData.buffer, lumpData.byteOffset, lumpData.byteLength);
  const reader = new BinaryReader(buffer);

  const format = reader.readUint16();
  if (format !== SFX_DIGITAL_FORMAT_VALUE) {
    throw new RangeError(`parseSoundEffectLumpHeader: format field must equal ${SFX_DIGITAL_FORMAT_VALUE} (DMX digital PCM), got ${format}`);
  }

  const sampleRate = reader.readUint16();
  const sampleCount = reader.readUint32();

  const expectedSize = soundEffectLumpDataSize(sampleCount);
  if (lumpData.length !== expectedSize) {
    throw new RangeError(`parseSoundEffectLumpHeader: lump body mismatch: header claims ${sampleCount} samples (${expectedSize} bytes total), got ${lumpData.length}`);
  }

  return Object.freeze({ format, sampleRate, sampleCount });
}

/**
 * Predicate identifying digital sound effect lumps by name.
 *
 * Matches vanilla DOOM 1.9's `DS` prefix convention (case-insensitive
 * via `W_CheckNumForName` uppercase folding). Distinguishes digital
 * sfx lumps from their PC-speaker `DP` siblings.
 *
 * @param name - Lump name to test.
 */
export function isSoundEffectLumpName(name: string): boolean {
  return name.length > SFX_LUMP_NAME_PREFIX_LENGTH && name.slice(0, SFX_LUMP_NAME_PREFIX_LENGTH).toUpperCase() === SFX_LUMP_NAME_PREFIX;
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-sound-effect-lumps.ts`. The cross-check helper
 * consumes this shape so the focused test can both verify the live
 * runtime exports and exercise a deliberately tampered snapshot to
 * prove the failure modes are observable.
 */
export interface SoundEffectLumpRuntimeSnapshot {
  /** `SFX_LUMP_NAME_PREFIX` exported by this module. */
  readonly sfxLumpNamePrefix: string;
  /** `SFX_LUMP_NAME_PREFIX_LENGTH` exported by this module. */
  readonly sfxLumpNamePrefixLength: number;
  /** `SFX_LUMP_NAME_FIELD_BYTES` exported by this module. */
  readonly sfxLumpNameFieldBytes: number;
  /** `SFX_HEADER_BYTES` exported by this module. */
  readonly sfxHeaderBytes: number;
  /** `SFX_FORMAT_FIELD_OFFSET` exported by this module. */
  readonly sfxFormatFieldOffset: number;
  /** `SFX_FORMAT_FIELD_BYTES` exported by this module. */
  readonly sfxFormatFieldBytes: number;
  /** `SFX_DIGITAL_FORMAT_VALUE` exported by this module. */
  readonly sfxDigitalFormatValue: number;
  /** `SFX_SAMPLE_RATE_FIELD_OFFSET` exported by this module. */
  readonly sfxSampleRateFieldOffset: number;
  /** `SFX_SAMPLE_RATE_FIELD_BYTES` exported by this module. */
  readonly sfxSampleRateFieldBytes: number;
  /** `SFX_SAMPLE_COUNT_FIELD_OFFSET` exported by this module. */
  readonly sfxSampleCountFieldOffset: number;
  /** `SFX_SAMPLE_COUNT_FIELD_BYTES` exported by this module. */
  readonly sfxSampleCountFieldBytes: number;
  /** `SFX_DEFAULT_SAMPLE_RATE_HZ` exported by this module. */
  readonly sfxDefaultSampleRateHz: number;
  /** `SFX_PCM_MIDPOINT_BYTE` exported by this module. */
  readonly sfxPcmMidpointByte: number;
  /** Whether `soundEffectLumpDataSize(sampleCount) === SFX_HEADER_BYTES + sampleCount` for all integer probes. */
  readonly soundEffectLumpDataSizeFormulaHolds: boolean;
  /** Whether `parseSoundEffectLumpHeader` returns a frozen result on a synthesised valid DSPISTOL-shaped lump. */
  readonly parserReturnsFrozenHeader: boolean;
  /** Whether `parseSoundEffectLumpHeader` throws RangeError on a 7-byte buffer. */
  readonly parserRejectsBufferTooSmallForHeader: boolean;
  /** Whether `parseSoundEffectLumpHeader` throws RangeError on a buffer with format=2. */
  readonly parserRejectsNonDigitalFormat: boolean;
  /** Whether `parseSoundEffectLumpHeader` throws RangeError when the body length does not match the declared sample count. */
  readonly parserRejectsBodyLengthMismatch: boolean;
  /** Whether `isSoundEffectLumpName('DSPISTOL') === true`. */
  readonly isSoundEffectLumpNameAcceptsDsPrefix: boolean;
  /** Whether `isSoundEffectLumpName('DPPISTOL') === false`. */
  readonly isSoundEffectLumpNameRejectsDpPrefix: boolean;
}

/**
 * Cross-check a `SoundEffectLumpRuntimeSnapshot` against
 * `SOUND_EFFECT_LUMP_AUDIT` and `SOUND_EFFECT_LUMP_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckSoundEffectLumpRuntime(snapshot: SoundEffectLumpRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.sfxLumpNamePrefix !== 'DS') {
    failures.push('derived:SFX_LUMP_NAME_PREFIX_EQUALS_DS');
    failures.push('audit:sound-effect-lump-name-prefix-ds:not-observed');
  }

  if (snapshot.sfxLumpNamePrefixLength !== 2) {
    failures.push('derived:SFX_LUMP_NAME_PREFIX_LENGTH_EQUALS_TWO');
    failures.push('audit:sound-effect-lump-name-formed-via-sprintf-ds-percent-s:not-observed');
  }

  if (snapshot.sfxLumpNameFieldBytes !== 8) {
    failures.push('derived:SFX_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT');
    failures.push('audit:sound-effect-lump-name-formed-via-sprintf-ds-percent-s:not-observed');
  }

  if (snapshot.sfxHeaderBytes !== 8) {
    failures.push('derived:SFX_HEADER_BYTES_EQUALS_EIGHT');
    failures.push('audit:sound-effect-lump-header-bytes-eight:not-observed');
  }

  if (snapshot.sfxFormatFieldOffset !== 0) {
    failures.push('derived:SFX_FORMAT_FIELD_OFFSET_EQUALS_ZERO');
    failures.push('audit:sound-effect-lump-header-format-field-offset-zero:not-observed');
  }

  if (snapshot.sfxFormatFieldBytes !== 2) {
    failures.push('derived:SFX_FORMAT_FIELD_BYTES_EQUALS_TWO');
    failures.push('audit:sound-effect-lump-header-format-field-uint16-le:not-observed');
  }

  if (snapshot.sfxDigitalFormatValue !== 3) {
    failures.push('derived:SFX_DIGITAL_FORMAT_VALUE_EQUALS_THREE');
    failures.push('audit:sound-effect-lump-header-format-magic-three:not-observed');
  }

  if (snapshot.sfxSampleRateFieldOffset !== 2) {
    failures.push('derived:SFX_SAMPLE_RATE_FIELD_OFFSET_EQUALS_TWO');
    failures.push('audit:sound-effect-lump-header-sample-rate-field-offset-two:not-observed');
  }

  if (snapshot.sfxSampleRateFieldBytes !== 2) {
    failures.push('derived:SFX_SAMPLE_RATE_FIELD_BYTES_EQUALS_TWO');
    failures.push('audit:sound-effect-lump-header-sample-rate-field-uint16-le:not-observed');
  }

  if (snapshot.sfxSampleCountFieldOffset !== 4) {
    failures.push('derived:SFX_SAMPLE_COUNT_FIELD_OFFSET_EQUALS_FOUR');
    failures.push('audit:sound-effect-lump-header-sample-count-field-offset-four:not-observed');
  }

  if (snapshot.sfxSampleCountFieldBytes !== 4) {
    failures.push('derived:SFX_SAMPLE_COUNT_FIELD_BYTES_EQUALS_FOUR');
    failures.push('audit:sound-effect-lump-header-sample-count-field-uint32-le:not-observed');
  }

  if (snapshot.sfxDefaultSampleRateHz !== 11025) {
    failures.push('derived:SFX_DEFAULT_SAMPLE_RATE_HZ_EQUALS_11025');
  }

  if (snapshot.sfxPcmMidpointByte !== 0x80) {
    failures.push('derived:SFX_PCM_MIDPOINT_BYTE_EQUALS_128');
    failures.push('audit:sound-effect-lump-pcm-midpoint-byte-128:not-observed');
  }

  if (!snapshot.soundEffectLumpDataSizeFormulaHolds) {
    failures.push('derived:SFX_LUMP_TOTAL_SIZE_FORMULA_EQUALS_HEADER_PLUS_SAMPLE_COUNT');
    failures.push('audit:sound-effect-lump-total-size-formula-header-plus-sample-count:not-observed');
  }

  if (!snapshot.parserReturnsFrozenHeader) {
    failures.push('derived:PARSE_SOUND_EFFECT_LUMP_HEADER_RETURNS_FROZEN_HEADER');
  }

  if (!snapshot.parserRejectsBufferTooSmallForHeader) {
    failures.push('derived:PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
    failures.push('audit:sound-effect-lump-lumplen-less-than-eight-rejected:not-observed');
  }

  if (!snapshot.parserRejectsNonDigitalFormat) {
    failures.push('derived:PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_NON_DIGITAL_FORMAT');
    failures.push('audit:sound-effect-lump-lumplen-less-than-eight-rejected:not-observed');
  }

  if (!snapshot.parserRejectsBodyLengthMismatch) {
    failures.push('derived:PARSE_SOUND_EFFECT_LUMP_HEADER_REJECTS_BODY_LENGTH_MISMATCH');
  }

  if (!snapshot.isSoundEffectLumpNameAcceptsDsPrefix) {
    failures.push('derived:IS_SOUND_EFFECT_LUMP_NAME_REQUIRES_DS_PREFIX');
    failures.push('audit:sound-effect-lump-name-lookup-via-w-getnumforname:not-observed');
  }

  if (!snapshot.isSoundEffectLumpNameRejectsDpPrefix) {
    failures.push('derived:IS_SOUND_EFFECT_LUMP_NAME_REJECTS_DP_PC_SPEAKER_PREFIX');
  }

  const declaredAxes = new Set(SOUND_EFFECT_LUMP_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<SoundEffectLumpAuditEntry['id']> = [
    'sound-effect-lump-name-prefix-ds',
    'sound-effect-lump-name-formed-via-sprintf-ds-percent-s',
    'sound-effect-lump-name-lookup-via-w-getnumforname',
    'sound-effect-lump-header-bytes-eight',
    'sound-effect-lump-header-format-field-offset-zero',
    'sound-effect-lump-header-format-field-uint16-le',
    'sound-effect-lump-header-format-magic-three',
    'sound-effect-lump-header-sample-rate-field-offset-two',
    'sound-effect-lump-header-sample-rate-field-uint16-le',
    'sound-effect-lump-header-sample-count-field-offset-four',
    'sound-effect-lump-header-sample-count-field-uint32-le',
    'sound-effect-lump-total-size-formula-header-plus-sample-count',
    'sound-effect-lump-lumplen-less-than-eight-rejected',
    'sound-effect-lump-pcm-midpoint-byte-128',
    'sound-effect-lump-no-marker-range',
    'sound-effect-lump-shareware-doom1-fifty-five-effects',
  ];
  for (const axis of requiredAxes) {
    if (!declaredAxes.has(axis)) {
      failures.push('derived:EVERY_AUDIT_AXIS_IS_DECLARED');
      break;
    }
  }

  return failures;
}

/**
 * Pinned facts about a single named DS sound effect lump inside the
 * shareware `doom/DOOM1.WAD` directory that the focused test
 * cross-checks against the live on-disk file. Each pinned entry covers
 * the full `getsfx()` / `CacheSFX` read path: directory placement, file
 * offset, raw lump byte size, decoded DMX header fields (format,
 * sampleRate, sampleCount), and a SHA-256 fingerprint of the lump
 * bytes.
 */
export interface ShareWareDoom1WadSoundEffectOracleEntry {
  /** Sound effect lump name (uppercase, NUL-stripped). */
  readonly name: string;
  /** Directory index of the DS lump in the live IWAD directory. */
  readonly directoryIndex: number;
  /** Byte offset of the DS lump inside the WAD file. */
  readonly fileOffset: number;
  /** Byte size of the DS lump (header + PCM body). */
  readonly size: number;
  /** Decoded `format` field from the DMX header (always 3 for shareware DOOM1.WAD DS lumps). */
  readonly format: number;
  /** Decoded `sampleRate` field from the DMX header in Hz. */
  readonly sampleRate: number;
  /** Decoded `sampleCount` field from the DMX header in bytes. */
  readonly sampleCount: number;
  /** SHA-256 hex digest of the DS lump bytes (lower-case, 64 chars). */
  readonly sha256: string;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` digital sound effect inventory. */
export interface ShareWareDoom1WadSoundEffectLumpOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Total digital sound effect lump count (matches `lumpCategories.sound-effect`). */
  readonly dsLumpCount: 55;
  /** Directory index of the first `DS` lump in directory order (DSPISTOL). */
  readonly firstDsLumpIndex: 110;
  /** Directory index of the last `DS` lump in directory order (DSGETPOW). */
  readonly lastDsLumpIndex: 218;
  /** Pinned named DS sound effects with directory indices, file offsets, raw header fields, and SHA-256 fingerprints. */
  readonly pinnedSoundEffects: readonly ShareWareDoom1WadSoundEffectOracleEntry[];
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` digital sound
 * effect inventory.
 *
 * The pinned probes were captured by hand from the live IWAD
 * (`probe-sfx.ts`) and cover seven points of the inventory:
 *  - DSPISTOL (the very first DS lump, directory index 110): the
 *    canonical sound that vanilla `getsfx()` falls back to when a
 *    requested name is absent (`if (W_CheckNumForName(name) == -1)
 *    sfxlump = W_GetNumForName("dspistol");`).
 *  - DSITEMUP: a small, frequently-played pickup sound; covers the
 *    short-body case.
 *  - DSPLPAIN: the player pain sound; covers a moderately-large body.
 *  - DSPOSIT1: the zombieman idle sound; mid-inventory probe.
 *  - DSITMBK: the unique 22050 Hz outlier among the shareware DS
 *    inventory; proves the parser reads the sample rate field from the
 *    lump bytes rather than hard-coding 11025.
 *  - DSBAREXP: the barrel explosion sound; covers a large body.
 *  - DSGETPOW: the very last DS lump in directory order; proves the
 *    last index in the inventory.
 *
 * The sha-256 fingerprints freeze the exact byte content of each DS
 * lump at the time of audit; any IWAD-modifying change that does not
 * also update the audit will surface as an oracle mismatch and reject
 * the change.
 */
export const SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE: ShareWareDoom1WadSoundEffectLumpOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  dsLumpCount: 55,
  firstDsLumpIndex: 110,
  lastDsLumpIndex: 218,
  pinnedSoundEffects: Object.freeze([
    Object.freeze({
      name: 'DSPISTOL',
      directoryIndex: 110,
      fileOffset: 945036,
      size: 5669,
      format: 3,
      sampleRate: 11025,
      sampleCount: 5661,
      sha256: 'b54942e3acacffd755494998e849a30f9020e067d1ce4bac972086fce2a2e69b',
    }),
    Object.freeze({
      name: 'DSPLPAIN',
      directoryIndex: 146,
      fileOffset: 1130448,
      size: 15160,
      format: 3,
      sampleRate: 11025,
      sampleCount: 15152,
      sha256: 'fd124207a2428c6ded167fa5a52f4c5d63d64c6939f782aacd38d45d7f9d5cf6',
    }),
    Object.freeze({
      name: 'DSITEMUP',
      directoryIndex: 154,
      fileOffset: 1175088,
      size: 2271,
      format: 3,
      sampleRate: 11025,
      sampleCount: 2263,
      sha256: 'a41848d18f12b32ed3fab0726e2c25a2eea559be84ac336bd5cb66ca82bd5bc3',
    }),
    Object.freeze({
      name: 'DSPOSIT1',
      directoryIndex: 162,
      fileOffset: 1202840,
      size: 5342,
      format: 3,
      sampleRate: 11025,
      sampleCount: 5334,
      sha256: '0317e801c16cc46b3fd8741ceec5d3d2cc88be03e5414c25e8321cbdb708190c',
    }),
    Object.freeze({
      name: 'DSBAREXP',
      directoryIndex: 206,
      fileOffset: 1434272,
      size: 18600,
      format: 3,
      sampleRate: 11025,
      sampleCount: 18592,
      sha256: '238c274824587baacf2c4689e3917a92c0609050f01f91a22163748ef35b7e8e',
    }),
    Object.freeze({
      name: 'DSITMBK',
      directoryIndex: 216,
      fileOffset: 1464192,
      size: 11183,
      format: 3,
      sampleRate: 22050,
      sampleCount: 11175,
      sha256: 'c873761c58fb3b23c02d60ca279ec8c4077132d4212f10eca2d73ba1c3decbf6',
    }),
    Object.freeze({
      name: 'DSGETPOW',
      directoryIndex: 218,
      fileOffset: 1475392,
      size: 7936,
      format: 3,
      sampleRate: 11025,
      sampleCount: 7928,
      sha256: 'b9e3929aa85875f7e7b8e0aa524feb31af5fa8fe67a541e14f612606aa899cdd',
    }),
  ]) as readonly ShareWareDoom1WadSoundEffectOracleEntry[],
}) as ShareWareDoom1WadSoundEffectLumpOracle;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for the
 * digital sound effect inventory so the focused test can re-derive the
 * values from the live file every run and feed the result into the
 * cross-check.
 */
export interface ShareWareDoom1WadSoundEffectLumpSample {
  readonly dsLumpCount: number;
  readonly firstDsLumpIndex: number;
  readonly lastDsLumpIndex: number;
  readonly pinnedSoundEffects: readonly {
    readonly name: string;
    readonly directoryIndex: number;
    readonly fileOffset: number;
    readonly size: number;
    readonly format: number;
    readonly sampleRate: number;
    readonly sampleCount: number;
    readonly sha256: string;
  }[];
}

/**
 * Cross-check a shareware DOOM1.WAD digital sound effect sample against
 * the pinned oracle. Returns the list of failures by stable identifier;
 * an empty list means the live inventory matches the oracle byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field whose
 *    live counterpart disagrees with the pinned value.
 *  - `oracle:sfx:<name>:not-found` when the sample is missing a pinned
 *    named DS lump.
 *  - `oracle:sfx:<name>:<field>:value-mismatch` for any oracle field
 *    on a pinned named DS lump whose live counterpart disagrees.
 */
export function crossCheckShareWareDoom1WadSoundEffectLumpSample(sample: ShareWareDoom1WadSoundEffectLumpSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'dsLumpCount' | 'firstDsLumpIndex' | 'lastDsLumpIndex'> = ['dsLumpCount', 'firstDsLumpIndex', 'lastDsLumpIndex'];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  for (const oracleSfx of SHAREWARE_DOOM1_WAD_SOUND_EFFECT_LUMP_ORACLE.pinnedSoundEffects) {
    const liveSfx = sample.pinnedSoundEffects.find((entry) => entry.name === oracleSfx.name);
    if (!liveSfx) {
      failures.push(`oracle:sfx:${oracleSfx.name}:not-found`);
      continue;
    }
    const fields: ReadonlyArray<'directoryIndex' | 'fileOffset' | 'size' | 'format' | 'sampleRate' | 'sampleCount' | 'sha256'> = ['directoryIndex', 'fileOffset', 'size', 'format', 'sampleRate', 'sampleCount', 'sha256'];
    for (const field of fields) {
      if (liveSfx[field] !== oracleSfx[field]) {
        failures.push(`oracle:sfx:${oracleSfx.name}:${field}:value-mismatch`);
      }
    }
  }

  return failures;
}
