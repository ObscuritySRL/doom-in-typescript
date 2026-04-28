/**
 * Audit ledger for the vanilla DOOM 1.9 music MUS lump parser, the
 * `S_ChangeMusic()` pipeline that resolves each `musicinfo_t.name` entry
 * to a directory lump named `D_<musicinfo->name>`, loads the 16-byte
 * on-disk DMX MUS header, validates the 4-byte magic identifier
 * (`'M' 'U' 'S' 0x1A`), reads the unsigned 16-bit little-endian
 * `scoreLength`, `scoreStart`, `primaryChannelCount`,
 * `secondaryChannelCount`, and `instrumentCount` fields, and exposes the
 * trailing instrument list and score data to the OPL synth / scheduler.
 *
 * This module pins the runtime contract one level deeper than the prior
 * 05-001..05-004 marker / lookup audits, the 05-005 PLAYPAL / COLORMAP
 * audit, the 05-006 patch picture format audit, the 05-007 flat
 * namespace audit, the 05-008 PNAMES audit, the 05-009 / 05-010
 * TEXTURE1 / TEXTURE2 audits, the 05-011 sprite namespace audit, and
 * the 05-012 sound effect lump audit: the 2-byte `D_` lump-name prefix
 * produced by `sprintf(namebuf, "d_%s", music->name)`, the upstream
 * 14-byte `musheader` C struct declared by Chocolate Doom 2.2.1
 * `mus2mid.c` (4-byte `id` + five `unsigned short` fields), the
 * `id[0] != 'M' || id[1] != 'U' || id[2] != 'S' || id[3] != 0x1A`
 * magic-byte gate (Chocolate Doom 2.2.1 `mus2mid.c`), the on-disk
 * 16-byte effective MUS header (with a 2-byte dummy / reserved field
 * after `instrumentCount` and before the instrument list, observed in
 * every shareware `DOOM1.WAD` D_ lump as `scoreStart === 16 +
 * instrumentCount * 2`), the uint16-LE encoding of every numeric
 * header field, the uint16-LE encoding of every entry in the
 * `instrumentCount`-long instrument list, the `scoreStart` field
 * locating the start of the score data and the `scoreLength` field
 * sizing it (matching the verbatim
 * `mem_fseek(musinput, (long)musfileheader.scorestart, MEM_SEEK_SET)`
 * seek in `mus2mid.c`), the absence of any S_START / S_END /
 * F_START / F_END style marker range around the D_ lumps (music lumps
 * live at fixed names anywhere in the directory and are looked up by
 * full lump name via `W_GetNumForName`, not by marker-bounded range),
 * and the shareware `doom/DOOM1.WAD` axis pinning 13 D_ music lumps
 * spanning directory indices 219 (D_E1M1, the first D_ lump) through
 * 231 (D_INTROA, the last D_ lump). The accompanying focused test
 * imports the ledger plus a self-contained `parseMusicMusLumpHeader`
 * runtime exposed by this module and cross-checks every audit entry
 * against the runtime behavior plus the live shareware `doom/DOOM1.WAD`
 * oracle.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/mus2mid.c`, `src/i_sdlmusic.c`,
 *      `src/s_sound.c`, `src/w_wad.c`).
 *
 * The header layout and validation rules below are pinned against
 * authority 5 (Chocolate Doom 2.2.1 `mus2mid.c`) for the `musheader`
 * struct declaration and the magic-byte check. The `sprintf(namebuf,
 * "d_%s", music->name)` lump-name construction and the
 * `music->lumpnum = W_GetNumForName(namebuf);` lookup are pinned
 * against authority 4 (id Software `linuxdoom-1.10/s_sound.c`,
 * `S_ChangeMusic`). The 16-byte effective on-disk header (the 2-byte
 * dummy / reserved field that follows `instrumentCount` and precedes
 * the instrument list) is pinned against authority 2 — the live
 * shareware IWAD itself — by the empirical invariant
 * `scoreStart === 16 + instrumentCount * 2` that holds for every
 * D_ lump in the shareware `doom/DOOM1.WAD`. The shareware `DOOM1.WAD`
 * oracle facts (13 D_ lumps, first D_ at directory index 219 = D_E1M1,
 * last D_ at directory index 231 = D_INTROA, and selected pinned music
 * lumps with their file offsets, raw header fields, sha-256
 * fingerprints) are pinned against authority 2 — the local IWAD itself
 * — and re-derived from the on-disk file every test run.
 */

import { BinaryReader } from '../core/binaryReader.ts';

/**
 * One audited byte-level layout fact, semantic constant, or runtime
 * contract of the music MUS lump parser, pinned to its upstream
 * declaration.
 */
export interface MusicMusLumpAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'music-lump-name-prefix-d-underscore'
    | 'music-lump-name-formed-via-sprintf-d-underscore-percent-s'
    | 'music-lump-name-lookup-via-w-getnumforname'
    | 'music-lump-c-struct-bytes-fourteen'
    | 'music-lump-on-disk-header-bytes-sixteen'
    | 'music-lump-magic-field-offset-zero'
    | 'music-lump-magic-field-bytes-four'
    | 'music-lump-magic-bytes-mus-eof'
    | 'music-lump-score-length-field-offset-four-uint16-le'
    | 'music-lump-score-start-field-offset-six-uint16-le'
    | 'music-lump-primary-channel-count-field-offset-eight-uint16-le'
    | 'music-lump-secondary-channel-count-field-offset-ten-uint16-le'
    | 'music-lump-instrument-count-field-offset-twelve-uint16-le'
    | 'music-lump-dummy-field-offset-fourteen-uint16-le'
    | 'music-lump-instrument-list-uint16-le-entries'
    | 'music-lump-score-data-located-by-score-start'
    | 'music-lump-no-marker-range'
    | 'music-lump-shareware-doom1-thirteen-musics';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'D_-lump' | 'S_ChangeMusic' | 'mus2mid.c-musheader' | 'parseMusicMusLumpHeader' | 'shareware-doom1.wad';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the upstream tree. */
  readonly referenceSourceFile: 'linuxdoom-1.10/s_sound.c' | 'src/mus2mid.c' | 'src/i_sdlmusic.c' | 'shareware/DOOM1.WAD';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, semantic constant, and runtime
 * parser contract the runtime music MUS lump loader must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const MUSIC_MUS_LUMP_AUDIT: readonly MusicMusLumpAuditEntry[] = [
  {
    id: 'music-lump-name-prefix-d-underscore',
    subject: 'S_ChangeMusic',
    cSourceLines: ['sprintf(namebuf, "d_%s", music->name);'],
    referenceSourceFile: 'linuxdoom-1.10/s_sound.c',
    invariant:
      'Vanilla `S_ChangeMusic()` constructs the music lump name by prepending `d_` (lowercase) to the `musicinfo_t.name` field. The WAD directory stores names uppercase, and `W_CheckNumForName` / `W_GetNumForName` uppercase the lookup key before hashing, so the on-disk lumps appear as `D_E1M1`, `D_INTRO`, etc. The runtime models this with `MUSIC_LUMP_NAME_PREFIX === "D_"` exposed as the canonical uppercase prefix.',
  },
  {
    id: 'music-lump-name-formed-via-sprintf-d-underscore-percent-s',
    subject: 'S_ChangeMusic',
    cSourceLines: ['char namebuf[9];', 'sprintf(namebuf, "d_%s", music->name);', 'music->lumpnum = W_GetNumForName(namebuf);'],
    referenceSourceFile: 'linuxdoom-1.10/s_sound.c',
    invariant:
      'Vanilla `S_ChangeMusic` allocates a 9-byte stack buffer (8-byte WAD-name field plus a NUL terminator) and writes the lump name as `d_%s` formatted from `musicinfo_t.name`. The buffer width gates the maximum music base name length to 6 characters (since the `d_` prefix consumes 2 of the 8 WAD name bytes; the longest D_ name in shareware DOOM1.WAD is `D_VICTOR` / `D_INTROA` at 7 characters total, fitting within the 8-byte field). The runtime models this with `MUSIC_LUMP_NAME_PREFIX_LENGTH === 2` and `MUSIC_LUMP_NAME_FIELD_BYTES === 8` exposed by `parse-music-mus-lumps.ts`.',
  },
  {
    id: 'music-lump-name-lookup-via-w-getnumforname',
    subject: 'S_ChangeMusic',
    cSourceLines: ['music->lumpnum = W_GetNumForName(namebuf);'],
    referenceSourceFile: 'linuxdoom-1.10/s_sound.c',
    invariant:
      'Vanilla `S_ChangeMusic` resolves the constructed lump name via `W_GetNumForName`, which throws a fatal `I_Error` on miss (unlike `W_CheckNumForName` used by the PNAMES patchlookup which yields -1). A registered-only music lump requested while running on shareware would be a fatal error. The runtime models this with `isMusicMusLumpName` testing for the uppercase `D_` prefix.',
  },
  {
    id: 'music-lump-c-struct-bytes-fourteen',
    subject: 'mus2mid.c-musheader',
    cSourceLines: [
      'typedef struct',
      '{',
      '    byte id[4];',
      '    unsigned short scorelength;',
      '    unsigned short scorestart;',
      '    unsigned short primarychannels;',
      '    unsigned short secondarychannels;',
      '    unsigned short instrumentcount;',
      '} PACKEDATTR musheader;',
    ],
    referenceSourceFile: 'src/mus2mid.c',
    invariant:
      'The Chocolate Doom 2.2.1 `mus2mid.c` `musheader` C struct declares the MUS header as 14 bytes total: a 4-byte `id` field plus five 16-bit `unsigned short` fields (`scorelength`, `scorestart`, `primarychannels`, `secondarychannels`, `instrumentcount`). `mus2mid.c` reads exactly these 14 bytes via sequential `mem_fread` calls (`mem_fread(&header->id, sizeof(byte), 4, file)` plus five `mem_fread(&header-><short_field>, sizeof(short), 1, file)`), then seeks directly to `scorestart` for the score data without reading the instrument list. The runtime models the C-struct width with `MUS_C_STRUCT_HEADER_BYTES === 14` exposed by `parse-music-mus-lumps.ts`.',
  },
  {
    id: 'music-lump-on-disk-header-bytes-sixteen',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['mem_fseek(musinput, (long)musfileheader.scorestart, MEM_SEEK_SET)'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The on-disk MUS lump format extends the 14-byte `mus2mid.c` C struct with a 2-byte dummy / reserved field at offset 14, yielding a 16-byte effective header before the instrument list begins. This is empirically pinned by the invariant `scoreStart === 16 + instrumentCount * 2` that holds for every D_ lump in the shareware `doom/DOOM1.WAD` (e.g., D_E1M1 has instrumentCount=15 and scoreStart=46 so 16 + 15*2 = 46; D_E1M5 has instrumentCount=4 and scoreStart=24 so 16 + 4*2 = 24; D_INTROA has instrumentCount=7 and scoreStart=30 so 16 + 7*2 = 30). The dummy field at offset 14 is observed to always be zero in the shareware IWAD. `mus2mid.c` does not read this field — it seeks directly to `scorestart` after reading the 14-byte struct — but a faithful runtime parser that decodes the instrument list MUST account for the 2-byte gap. The runtime models this with `MUS_ON_DISK_HEADER_BYTES === 16` and `MUS_DUMMY_FIELD_OFFSET === 14` exposed by `parse-music-mus-lumps.ts`.',
  },
  {
    id: 'music-lump-magic-field-offset-zero',
    subject: 'D_-lump',
    cSourceLines: ['byte id[4];'],
    referenceSourceFile: 'src/mus2mid.c',
    invariant:
      'The `mus2mid.c` `musheader` C struct places the 4-byte `id` field as the first member, so the magic identifier starts at lump byte offset 0. The runtime models this with `MUS_MAGIC_FIELD_OFFSET === 0` exposed by `parse-music-mus-lumps.ts`.',
  },
  {
    id: 'music-lump-magic-field-bytes-four',
    subject: 'D_-lump',
    cSourceLines: ['byte id[4];'],
    referenceSourceFile: 'src/mus2mid.c',
    invariant: 'The `mus2mid.c` `musheader.id` field is declared as `byte id[4]` — exactly 4 bytes wide. The runtime models this with `MUS_MAGIC_FIELD_BYTES === 4` exposed by `parse-music-mus-lumps.ts`.',
  },
  {
    id: 'music-lump-magic-bytes-mus-eof',
    subject: 'mus2mid.c-musheader',
    cSourceLines: ["if (musfileheader.id[0] != 'M'", "|| musfileheader.id[1] != 'U'", "|| musfileheader.id[2] != 'S'", '|| musfileheader.id[3] != 0x1A)'],
    referenceSourceFile: 'src/mus2mid.c',
    invariant:
      "The `mus2mid.c` magic-bytes gate rejects any MUS lump whose first 4 bytes do not match the exact sequence `'M'`, `'U'`, `'S'`, `0x1A` (ASCII 0x4d, 0x55, 0x53 followed by the DMX-specific EOF byte 0x1A). Each byte is checked individually; the gate fails on any mismatch. The runtime models this with `MUS_MAGIC_BYTES` exposed as a frozen `Uint8Array` of `[0x4d, 0x55, 0x53, 0x1a]` and `parseMusicMusLumpHeader` throwing `RangeError` on any non-matching prefix.",
  },
  {
    id: 'music-lump-score-length-field-offset-four-uint16-le',
    subject: 'D_-lump',
    cSourceLines: ['unsigned short scorelength;', 'mem_fread(&header->scorelength, sizeof(short), 1, file)'],
    referenceSourceFile: 'src/mus2mid.c',
    invariant:
      'The `mus2mid.c` `musheader.scorelength` field is the first `unsigned short` after the 4-byte `id`, placing it at lump byte offset 4 with a 2-byte little-endian width. The runtime models this with `MUS_SCORE_LENGTH_FIELD_OFFSET === 4` and `MUS_SCORE_LENGTH_FIELD_BYTES === 2` exposed by `parse-music-mus-lumps.ts`.',
  },
  {
    id: 'music-lump-score-start-field-offset-six-uint16-le',
    subject: 'D_-lump',
    cSourceLines: ['unsigned short scorestart;', 'mem_fread(&header->scorestart, sizeof(short), 1, file)', 'mem_fseek(musinput, (long)musfileheader.scorestart, MEM_SEEK_SET)'],
    referenceSourceFile: 'src/mus2mid.c',
    invariant:
      'The `mus2mid.c` `musheader.scorestart` field follows `scorelength`, placing it at lump byte offset 6 with a 2-byte little-endian width. `mus2mid.c` uses this field as the byte offset (from the start of the lump) at which the score data begins, via `mem_fseek(musinput, (long)musfileheader.scorestart, MEM_SEEK_SET)`. The runtime models this with `MUS_SCORE_START_FIELD_OFFSET === 6` and `MUS_SCORE_START_FIELD_BYTES === 2`.',
  },
  {
    id: 'music-lump-primary-channel-count-field-offset-eight-uint16-le',
    subject: 'D_-lump',
    cSourceLines: ['unsigned short primarychannels;', 'mem_fread(&header->primarychannels, sizeof(short), 1, file)'],
    referenceSourceFile: 'src/mus2mid.c',
    invariant:
      'The `mus2mid.c` `musheader.primarychannels` field follows `scorestart`, placing it at lump byte offset 8 with a 2-byte little-endian width. The MUS format supports up to 16 channels (channels 0..14 plus percussion channel 15). The runtime models this with `MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET === 8` and `MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES === 2`.',
  },
  {
    id: 'music-lump-secondary-channel-count-field-offset-ten-uint16-le',
    subject: 'D_-lump',
    cSourceLines: ['unsigned short secondarychannels;', 'mem_fread(&header->secondarychannels, sizeof(short), 1, file)'],
    referenceSourceFile: 'src/mus2mid.c',
    invariant:
      'The `mus2mid.c` `musheader.secondarychannels` field follows `primarychannels`, placing it at lump byte offset 10 with a 2-byte little-endian width. Every D_ lump in the shareware `doom/DOOM1.WAD` carries `secondarychannels === 0`. The runtime models this with `MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET === 10` and `MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES === 2`.',
  },
  {
    id: 'music-lump-instrument-count-field-offset-twelve-uint16-le',
    subject: 'D_-lump',
    cSourceLines: ['unsigned short instrumentcount;', 'mem_fread(&header->instrumentcount, sizeof(short), 1, file)'],
    referenceSourceFile: 'src/mus2mid.c',
    invariant:
      'The `mus2mid.c` `musheader.instrumentcount` field follows `secondarychannels`, placing it at lump byte offset 12 with a 2-byte little-endian width. This is the LAST field of the 14-byte C struct. The runtime models this with `MUS_INSTRUMENT_COUNT_FIELD_OFFSET === 12` and `MUS_INSTRUMENT_COUNT_FIELD_BYTES === 2`.',
  },
  {
    id: 'music-lump-dummy-field-offset-fourteen-uint16-le',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['mem_fseek(musinput, (long)musfileheader.scorestart, MEM_SEEK_SET)'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The on-disk MUS lump format places a 2-byte dummy / reserved field at lump byte offset 14, immediately after the `instrumentcount` field of the C struct and immediately before the instrument list. This field is NOT read by `mus2mid.c` (which seeks directly to `scorestart` after the 14-byte struct), but it is empirically present in every shareware `doom/DOOM1.WAD` D_ lump and always reads as zero. The runtime models this with `MUS_DUMMY_FIELD_OFFSET === 14` and `MUS_DUMMY_FIELD_BYTES === 2`.',
  },
  {
    id: 'music-lump-instrument-list-uint16-le-entries',
    subject: 'D_-lump',
    cSourceLines: ['mem_fseek(musinput, (long)musfileheader.scorestart, MEM_SEEK_SET)'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The on-disk MUS lump format follows the 16-byte effective header with `instrumentCount` little-endian unsigned 16-bit instrument numbers (one per entry, total `instrumentCount * 2` bytes). The instrument list ends exactly at the byte offset `scoreStart`. `mus2mid.c` does not read this list (it seeks directly to `scorestart` for score data), but a faithful runtime that wires the OPL synth to GM patch numbers MUST decode this list. The empirical invariant `scoreStart === 16 + instrumentCount * 2` holds for every D_ lump in the shareware `doom/DOOM1.WAD`. The runtime models this with `parseMusicMusLumpHeader` returning a frozen `instruments` array of length `instrumentCount`.',
  },
  {
    id: 'music-lump-score-data-located-by-score-start',
    subject: 'mus2mid.c-musheader',
    cSourceLines: ['mem_fseek(musinput, (long)musfileheader.scorestart, MEM_SEEK_SET)'],
    referenceSourceFile: 'src/mus2mid.c',
    invariant:
      'The `mus2mid.c` event-decode loop locates the score by seeking to the byte offset specified in the `musheader.scorestart` field via `mem_fseek(musinput, (long)musfileheader.scorestart, MEM_SEEK_SET)`. The score data spans `scoreLength` bytes starting at `scoreStart` and contains the MUS event stream consumed by the OPL synth / scheduler. The runtime models this with `parseMusicMusLumpHeader` validating `scoreStart + scoreLength <= lumpData.length` and exposing the score buffer as a sliced `scoreData` field.',
  },
  {
    id: 'music-lump-no-marker-range',
    subject: 'D_-lump',
    cSourceLines: ['music->lumpnum = W_GetNumForName(namebuf);'],
    referenceSourceFile: 'linuxdoom-1.10/s_sound.c',
    invariant:
      'Music lumps in vanilla DOOM 1.9 are NOT enclosed by an `S_START` / `S_END`, `F_START` / `F_END`, or `P_START` / `P_END` style marker range. Each D_ lump is looked up by its full name via `W_GetNumForName` directly. The D_ lumps therefore live at fixed positions in the WAD directory anywhere between the sound effects and the EOF; in shareware DOOM1.WAD they sit at directory indices 219..231 contiguously, but the contiguity is a layout convention of the IWAD, not a parser-enforced invariant. The runtime models this with `isMusicMusLumpName` testing only for the uppercase `D_` prefix.',
  },
  {
    id: 'music-lump-shareware-doom1-thirteen-musics',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['sprintf(namebuf, "d_%s", music->name);'],
    referenceSourceFile: 'shareware/DOOM1.WAD',
    invariant:
      'The shareware `doom/DOOM1.WAD` ships exactly 13 MUS music lumps with the `D_` prefix. The first D_ lump in directory order is `D_E1M1` at index 219, the last is `D_INTROA` at index 231. The 13 count matches the `lumpCategories.music: 13` field in `reference/manifests/wad-map-summary.json`. The runtime models this with the oracle entry whose `dLumpCount === 13`, `firstDLumpIndex === 219`, and `lastDLumpIndex === 231`.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface MusicMusLumpDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const MUSIC_MUS_LUMP_DERIVED_INVARIANTS: readonly MusicMusLumpDerivedInvariant[] = [
  {
    id: 'MUSIC_LUMP_NAME_PREFIX_EQUALS_D_UNDERSCORE',
    description: '`MUSIC_LUMP_NAME_PREFIX === "D_"`. Matches the upstream `sprintf(namebuf, "d_%s", music->name)` after the WAD name table uppercases the directory key.',
  },
  {
    id: 'MUSIC_LUMP_NAME_PREFIX_LENGTH_EQUALS_TWO',
    description: '`MUSIC_LUMP_NAME_PREFIX_LENGTH === 2`. Matches the 2-byte literal `d_` consumed by `sprintf(namebuf, "d_%s", ...)`.',
  },
  {
    id: 'MUSIC_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT',
    description: '`MUSIC_LUMP_NAME_FIELD_BYTES === 8`. Matches the 8-byte WAD directory name field; the `d_` prefix plus a 6-character base name fills the field exactly.',
  },
  {
    id: 'MUS_C_STRUCT_HEADER_BYTES_EQUALS_FOURTEEN',
    description: '`MUS_C_STRUCT_HEADER_BYTES === 14`. Matches the upstream `mus2mid.c` `musheader` struct: 4-byte `id` plus five 2-byte `unsigned short` fields.',
  },
  {
    id: 'MUS_ON_DISK_HEADER_BYTES_EQUALS_SIXTEEN',
    description: '`MUS_ON_DISK_HEADER_BYTES === 16`. Matches the on-disk effective header before the instrument list, derived from `scoreStart === 16 + instrumentCount * 2` for every shareware MUS lump.',
  },
  {
    id: 'MUS_MAGIC_FIELD_OFFSET_EQUALS_ZERO',
    description: '`MUS_MAGIC_FIELD_OFFSET === 0`. Matches the upstream `byte id[4];` placement at the start of the C struct.',
  },
  {
    id: 'MUS_MAGIC_FIELD_BYTES_EQUALS_FOUR',
    description: '`MUS_MAGIC_FIELD_BYTES === 4`. Matches the upstream `byte id[4]` declaration.',
  },
  {
    id: 'MUS_MAGIC_BYTES_EQUAL_M_U_S_EOF',
    description: "`MUS_MAGIC_BYTES` equals the byte sequence `[0x4d, 0x55, 0x53, 0x1a]`. Matches the upstream `id[0] != 'M' || id[1] != 'U' || id[2] != 'S' || id[3] != 0x1A` magic check.",
  },
  {
    id: 'MUS_SCORE_LENGTH_FIELD_OFFSET_EQUALS_FOUR',
    description: '`MUS_SCORE_LENGTH_FIELD_OFFSET === 4`. Matches the upstream first `unsigned short scorelength;` placement after the 4-byte `id`.',
  },
  {
    id: 'MUS_SCORE_LENGTH_FIELD_BYTES_EQUALS_TWO',
    description: '`MUS_SCORE_LENGTH_FIELD_BYTES === 2`. Matches the upstream `unsigned short scorelength;` width.',
  },
  {
    id: 'MUS_SCORE_START_FIELD_OFFSET_EQUALS_SIX',
    description: '`MUS_SCORE_START_FIELD_OFFSET === 6`. Matches the upstream `unsigned short scorestart;` placement.',
  },
  {
    id: 'MUS_SCORE_START_FIELD_BYTES_EQUALS_TWO',
    description: '`MUS_SCORE_START_FIELD_BYTES === 2`. Matches the upstream `unsigned short scorestart;` width.',
  },
  {
    id: 'MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET_EQUALS_EIGHT',
    description: '`MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET === 8`. Matches the upstream `unsigned short primarychannels;` placement.',
  },
  {
    id: 'MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES_EQUALS_TWO',
    description: '`MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES === 2`. Matches the upstream `unsigned short primarychannels;` width.',
  },
  {
    id: 'MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET_EQUALS_TEN',
    description: '`MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET === 10`. Matches the upstream `unsigned short secondarychannels;` placement.',
  },
  {
    id: 'MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES_EQUALS_TWO',
    description: '`MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES === 2`. Matches the upstream `unsigned short secondarychannels;` width.',
  },
  {
    id: 'MUS_INSTRUMENT_COUNT_FIELD_OFFSET_EQUALS_TWELVE',
    description: '`MUS_INSTRUMENT_COUNT_FIELD_OFFSET === 12`. Matches the upstream `unsigned short instrumentcount;` placement.',
  },
  {
    id: 'MUS_INSTRUMENT_COUNT_FIELD_BYTES_EQUALS_TWO',
    description: '`MUS_INSTRUMENT_COUNT_FIELD_BYTES === 2`. Matches the upstream `unsigned short instrumentcount;` width.',
  },
  {
    id: 'MUS_DUMMY_FIELD_OFFSET_EQUALS_FOURTEEN',
    description: '`MUS_DUMMY_FIELD_OFFSET === 14`. Matches the on-disk 2-byte gap between `instrumentcount` and the instrument list, derived from `scoreStart === 16 + instrumentCount * 2`.',
  },
  {
    id: 'MUS_DUMMY_FIELD_BYTES_EQUALS_TWO',
    description: '`MUS_DUMMY_FIELD_BYTES === 2`. Matches the on-disk 2-byte width of the dummy field at offset 14.',
  },
  {
    id: 'MUS_INSTRUMENT_ENTRY_BYTES_EQUALS_TWO',
    description: '`MUS_INSTRUMENT_ENTRY_BYTES === 2`. Matches the on-disk uint16-LE encoding of each instrument number (the instrument list spans exactly `instrumentCount * 2` bytes).',
  },
  {
    id: 'PARSE_MUSIC_MUS_LUMP_HEADER_RETURNS_FROZEN_HEADER',
    description: 'A successful `parseMusicMusLumpHeader(buffer)` returns an object that is `Object.isFrozen` and whose `instruments` array is `Object.isFrozen`.',
  },
  {
    id: 'PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
    description: '`parseMusicMusLumpHeader(new Uint8Array(15))` throws a `RangeError`. The 16-byte on-disk header is mandatory before any instrument data is read.',
  },
  {
    id: 'PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_BAD_MAGIC',
    description: '`parseMusicMusLumpHeader(bufferWithMisMatchedMagic)` throws a `RangeError`. The 4-byte magic must equal `[0x4d, 0x55, 0x53, 0x1a]` byte-for-byte.',
  },
  {
    id: 'PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_INSTRUMENT_LIST_OVERLAPS_HEADER',
    description: '`parseMusicMusLumpHeader(bufferWithScoreStartLessThanInstrumentEnd)` throws a `RangeError` when `scoreStart < 16 + instrumentCount * 2`.',
  },
  {
    id: 'PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_SCORE_OUT_OF_BOUNDS',
    description: '`parseMusicMusLumpHeader(bufferWithScoreEndExceedingLump)` throws a `RangeError` when `scoreStart + scoreLength > lumpData.length`.',
  },
  {
    id: 'IS_MUSIC_MUS_LUMP_NAME_REQUIRES_D_UNDERSCORE_PREFIX',
    description:
      '`isMusicMusLumpName(name)` returns true iff `name.length > MUSIC_LUMP_NAME_PREFIX_LENGTH` and `name.slice(0, MUSIC_LUMP_NAME_PREFIX_LENGTH).toUpperCase() === MUSIC_LUMP_NAME_PREFIX`. Matches the upstream uppercase `D_` lookup convention.',
  },
  {
    id: 'IS_MUSIC_MUS_LUMP_NAME_REJECTS_DS_PREFIX',
    description: '`isMusicMusLumpName("DSPISTOL") === false`. The DS digital sound effect lumps must not be classified as music.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Lump-name prefix that identifies music MUS lumps in the WAD directory (`D_<musname>`). */
export const MUSIC_LUMP_NAME_PREFIX = 'D_';

/** Byte length of the upstream lump-name prefix `d_` (matches `sprintf(namebuf, "d_%s", ...)`). */
export const MUSIC_LUMP_NAME_PREFIX_LENGTH = 2;

/** Byte length of the 8-byte WAD directory name field that holds the `D_<musname>` lump name. */
export const MUSIC_LUMP_NAME_FIELD_BYTES = 8;

/** Byte size of the upstream `mus2mid.c` `musheader` C struct (4-byte id + five 2-byte shorts). */
export const MUS_C_STRUCT_HEADER_BYTES = 14;

/** Byte size of the on-disk effective MUS header before the instrument list (C struct + 2-byte dummy). */
export const MUS_ON_DISK_HEADER_BYTES = 16;

/** Byte offset of the `id` magic field inside the on-disk MUS header. */
export const MUS_MAGIC_FIELD_OFFSET = 0;

/** Byte width of the `id` magic field. */
export const MUS_MAGIC_FIELD_BYTES = 4;

/** Required magic byte sequence at the start of every MUS lump (`'M' 'U' 'S' 0x1A`). */
export const MUS_MAGIC_BYTES: readonly number[] = Object.freeze([0x4d, 0x55, 0x53, 0x1a]);

/** Byte offset of the `scoreLength` field inside the on-disk MUS header. */
export const MUS_SCORE_LENGTH_FIELD_OFFSET = 4;

/** Byte width of the `scoreLength` field (uint16-LE). */
export const MUS_SCORE_LENGTH_FIELD_BYTES = 2;

/** Byte offset of the `scoreStart` field inside the on-disk MUS header. */
export const MUS_SCORE_START_FIELD_OFFSET = 6;

/** Byte width of the `scoreStart` field (uint16-LE). */
export const MUS_SCORE_START_FIELD_BYTES = 2;

/** Byte offset of the `primaryChannelCount` field inside the on-disk MUS header. */
export const MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET = 8;

/** Byte width of the `primaryChannelCount` field (uint16-LE). */
export const MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES = 2;

/** Byte offset of the `secondaryChannelCount` field inside the on-disk MUS header. */
export const MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET = 10;

/** Byte width of the `secondaryChannelCount` field (uint16-LE). */
export const MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES = 2;

/** Byte offset of the `instrumentCount` field inside the on-disk MUS header. */
export const MUS_INSTRUMENT_COUNT_FIELD_OFFSET = 12;

/** Byte width of the `instrumentCount` field (uint16-LE). */
export const MUS_INSTRUMENT_COUNT_FIELD_BYTES = 2;

/** Byte offset of the on-disk dummy / reserved field that follows `instrumentCount`. */
export const MUS_DUMMY_FIELD_OFFSET = 14;

/** Byte width of the on-disk dummy / reserved field (uint16-LE, always observed as zero in shareware). */
export const MUS_DUMMY_FIELD_BYTES = 2;

/** Byte width of each entry in the post-header instrument list (uint16-LE). */
export const MUS_INSTRUMENT_ENTRY_BYTES = 2;

/**
 * Compute the byte offset of the score data, given the on-disk MUS
 * `instrumentCount`. Mirrors the empirical invariant
 * `scoreStart === 16 + instrumentCount * 2` that holds for every D_
 * lump in the shareware `doom/DOOM1.WAD`.
 *
 * @param instrumentCount - Header `instrumentCount` field value.
 * @returns Required byte offset where the score data begins.
 * @throws {RangeError} If `instrumentCount` is negative or not an integer.
 */
export function musicMusLumpScoreStartOffset(instrumentCount: number): number {
  if (!Number.isInteger(instrumentCount) || instrumentCount < 0) {
    throw new RangeError(`musicMusLumpScoreStartOffset: instrumentCount must be a non-negative integer, got ${instrumentCount}`);
  }
  return MUS_ON_DISK_HEADER_BYTES + instrumentCount * MUS_INSTRUMENT_ENTRY_BYTES;
}

/** Decoded fields from the 16-byte on-disk MUS header plus the trailing instrument list. */
export interface MusicMusLumpHeader {
  /** `scoreLength` field (byte length of the score data). */
  readonly scoreLength: number;
  /** `scoreStart` field (byte offset to the start of the score data). */
  readonly scoreStart: number;
  /** `primaryChannelCount` field (number of MUS channels in use). */
  readonly primaryChannelCount: number;
  /** `secondaryChannelCount` field (always 0 in shareware DOOM1.WAD). */
  readonly secondaryChannelCount: number;
  /** `instrumentCount` field (number of instrument numbers in the list). */
  readonly instrumentCount: number;
  /** Decoded uint16-LE instrument numbers (length === `instrumentCount`). */
  readonly instruments: readonly number[];
}

/**
 * Parse the 16-byte on-disk MUS header plus the `instrumentCount`-long
 * trailing instrument list from a music MUS lump.
 *
 * Mirrors the vanilla `mus2mid.c` validation gate from Chocolate Doom
 * 2.2.1 `mus2mid.c`:
 *   - rejects any lump whose total byte length is less than 16
 *     (the on-disk effective header before the instrument list),
 *   - rejects any lump whose 4-byte magic does not equal
 *     `[0x4d, 0x55, 0x53, 0x1a]` (matching the
 *     `id[0] != 'M' || id[1] != 'U' || id[2] != 'S' || id[3] != 0x1A`
 *     gate),
 *   - reads `scoreLength`, `scoreStart`, `primaryChannelCount`,
 *     `secondaryChannelCount`, and `instrumentCount` as uint16-LE at
 *     offsets 4, 6, 8, 10, 12,
 *   - skips the 2-byte dummy field at offset 14,
 *   - reads `instrumentCount` uint16-LE entries from offset 16,
 *   - validates that `scoreStart >= 16 + instrumentCount * 2` (the
 *     instrument list does not overlap the score data),
 *   - validates that `scoreStart + scoreLength <= lumpData.length`
 *     (the score region does not exceed the lump body).
 *
 * The parser does NOT decode the score event stream — that is the
 * responsibility of the downstream score parser
 * (`src/audio/musParser.ts`).
 *
 * @param lumpData - Raw MUS lump data.
 * @returns Frozen {@link MusicMusLumpHeader}.
 * @throws {RangeError} If the lump is too small for the 16-byte header,
 *   has a mismatched 4-byte magic, has an instrument list that overlaps
 *   the score, or has a score region that exceeds the lump body.
 */
export function parseMusicMusLumpHeader(lumpData: Buffer | Uint8Array): MusicMusLumpHeader {
  if (lumpData.length < MUS_ON_DISK_HEADER_BYTES) {
    throw new RangeError(`parseMusicMusLumpHeader: lump must be at least ${MUS_ON_DISK_HEADER_BYTES} bytes for the on-disk MUS header, got ${lumpData.length}`);
  }

  for (let index = 0; index < MUS_MAGIC_FIELD_BYTES; index += 1) {
    if (lumpData[index] !== MUS_MAGIC_BYTES[index]) {
      throw new RangeError(`parseMusicMusLumpHeader: magic byte mismatch at offset ${index}: expected 0x${MUS_MAGIC_BYTES[index]!.toString(16).padStart(2, '0')}, got 0x${lumpData[index]!.toString(16).padStart(2, '0')}`);
    }
  }

  const buffer = lumpData instanceof Buffer ? lumpData : Buffer.from(lumpData.buffer, lumpData.byteOffset, lumpData.byteLength);
  const reader = new BinaryReader(buffer, MUS_SCORE_LENGTH_FIELD_OFFSET);

  const scoreLength = reader.readUint16();
  const scoreStart = reader.readUint16();
  const primaryChannelCount = reader.readUint16();
  const secondaryChannelCount = reader.readUint16();
  const instrumentCount = reader.readUint16();
  reader.readUint16();

  const instrumentEnd = MUS_ON_DISK_HEADER_BYTES + instrumentCount * MUS_INSTRUMENT_ENTRY_BYTES;
  if (lumpData.length < instrumentEnd) {
    throw new RangeError(`parseMusicMusLumpHeader: lump must hold ${instrumentCount} instrument entries (${instrumentEnd} bytes total), got ${lumpData.length}`);
  }

  if (scoreStart < instrumentEnd) {
    throw new RangeError(`parseMusicMusLumpHeader: scoreStart (${scoreStart}) overlaps the instrument list ending at byte ${instrumentEnd}`);
  }

  const scoreEnd = scoreStart + scoreLength;
  if (scoreEnd > lumpData.length) {
    throw new RangeError(`parseMusicMusLumpHeader: score region [${scoreStart}, ${scoreEnd}) exceeds lump size (${lumpData.length})`);
  }

  const instruments: number[] = new Array(instrumentCount);
  for (let index = 0; index < instrumentCount; index += 1) {
    instruments[index] = reader.readUint16();
  }

  return Object.freeze({
    scoreLength,
    scoreStart,
    primaryChannelCount,
    secondaryChannelCount,
    instrumentCount,
    instruments: Object.freeze(instruments),
  });
}

/**
 * Predicate identifying music MUS lumps by name.
 *
 * Matches vanilla DOOM 1.9's `D_` prefix convention (case-insensitive
 * via `W_CheckNumForName` uppercase folding). Distinguishes music
 * lumps from the `DS` digital sound effect lumps and the `DP` PC
 * speaker variants.
 *
 * @param name - Lump name to test.
 */
export function isMusicMusLumpName(name: string): boolean {
  return name.length > MUSIC_LUMP_NAME_PREFIX_LENGTH && name.slice(0, MUSIC_LUMP_NAME_PREFIX_LENGTH).toUpperCase() === MUSIC_LUMP_NAME_PREFIX;
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-music-mus-lumps.ts`. The cross-check helper
 * consumes this shape so the focused test can both verify the live
 * runtime exports and exercise a deliberately tampered snapshot to
 * prove the failure modes are observable.
 */
export interface MusicMusLumpRuntimeSnapshot {
  /** `MUSIC_LUMP_NAME_PREFIX` exported by this module. */
  readonly musicLumpNamePrefix: string;
  /** `MUSIC_LUMP_NAME_PREFIX_LENGTH` exported by this module. */
  readonly musicLumpNamePrefixLength: number;
  /** `MUSIC_LUMP_NAME_FIELD_BYTES` exported by this module. */
  readonly musicLumpNameFieldBytes: number;
  /** `MUS_C_STRUCT_HEADER_BYTES` exported by this module. */
  readonly musCStructHeaderBytes: number;
  /** `MUS_ON_DISK_HEADER_BYTES` exported by this module. */
  readonly musOnDiskHeaderBytes: number;
  /** `MUS_MAGIC_FIELD_OFFSET` exported by this module. */
  readonly musMagicFieldOffset: number;
  /** `MUS_MAGIC_FIELD_BYTES` exported by this module. */
  readonly musMagicFieldBytes: number;
  /** `MUS_MAGIC_BYTES` exported by this module — verified as the byte sequence `[0x4d, 0x55, 0x53, 0x1a]`. */
  readonly musMagicBytesEqualMUSEof: boolean;
  /** `MUS_SCORE_LENGTH_FIELD_OFFSET` exported by this module. */
  readonly musScoreLengthFieldOffset: number;
  /** `MUS_SCORE_LENGTH_FIELD_BYTES` exported by this module. */
  readonly musScoreLengthFieldBytes: number;
  /** `MUS_SCORE_START_FIELD_OFFSET` exported by this module. */
  readonly musScoreStartFieldOffset: number;
  /** `MUS_SCORE_START_FIELD_BYTES` exported by this module. */
  readonly musScoreStartFieldBytes: number;
  /** `MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET` exported by this module. */
  readonly musPrimaryChannelCountFieldOffset: number;
  /** `MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES` exported by this module. */
  readonly musPrimaryChannelCountFieldBytes: number;
  /** `MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET` exported by this module. */
  readonly musSecondaryChannelCountFieldOffset: number;
  /** `MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES` exported by this module. */
  readonly musSecondaryChannelCountFieldBytes: number;
  /** `MUS_INSTRUMENT_COUNT_FIELD_OFFSET` exported by this module. */
  readonly musInstrumentCountFieldOffset: number;
  /** `MUS_INSTRUMENT_COUNT_FIELD_BYTES` exported by this module. */
  readonly musInstrumentCountFieldBytes: number;
  /** `MUS_DUMMY_FIELD_OFFSET` exported by this module. */
  readonly musDummyFieldOffset: number;
  /** `MUS_DUMMY_FIELD_BYTES` exported by this module. */
  readonly musDummyFieldBytes: number;
  /** `MUS_INSTRUMENT_ENTRY_BYTES` exported by this module. */
  readonly musInstrumentEntryBytes: number;
  /** Whether `parseMusicMusLumpHeader` returns a frozen header (and frozen instruments) on a synthesised valid lump. */
  readonly parserReturnsFrozenHeader: boolean;
  /** Whether `parseMusicMusLumpHeader` throws RangeError on a 15-byte buffer. */
  readonly parserRejectsBufferTooSmallForHeader: boolean;
  /** Whether `parseMusicMusLumpHeader` throws RangeError on a buffer with mis-matched magic. */
  readonly parserRejectsBadMagic: boolean;
  /** Whether `parseMusicMusLumpHeader` throws RangeError when the instrument list overlaps the header. */
  readonly parserRejectsInstrumentListOverlap: boolean;
  /** Whether `parseMusicMusLumpHeader` throws RangeError when the score region exceeds the lump. */
  readonly parserRejectsScoreOutOfBounds: boolean;
  /** Whether `isMusicMusLumpName('D_E1M1') === true`. */
  readonly isMusicMusLumpNameAcceptsDUnderscorePrefix: boolean;
  /** Whether `isMusicMusLumpName('DSPISTOL') === false`. */
  readonly isMusicMusLumpNameRejectsDsPrefix: boolean;
}

/**
 * Cross-check a `MusicMusLumpRuntimeSnapshot` against
 * `MUSIC_MUS_LUMP_AUDIT` and `MUSIC_MUS_LUMP_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckMusicMusLumpRuntime(snapshot: MusicMusLumpRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.musicLumpNamePrefix !== 'D_') {
    failures.push('derived:MUSIC_LUMP_NAME_PREFIX_EQUALS_D_UNDERSCORE');
    failures.push('audit:music-lump-name-prefix-d-underscore:not-observed');
  }

  if (snapshot.musicLumpNamePrefixLength !== 2) {
    failures.push('derived:MUSIC_LUMP_NAME_PREFIX_LENGTH_EQUALS_TWO');
    failures.push('audit:music-lump-name-formed-via-sprintf-d-underscore-percent-s:not-observed');
  }

  if (snapshot.musicLumpNameFieldBytes !== 8) {
    failures.push('derived:MUSIC_LUMP_NAME_FIELD_BYTES_EQUALS_EIGHT');
    failures.push('audit:music-lump-name-formed-via-sprintf-d-underscore-percent-s:not-observed');
  }

  if (snapshot.musCStructHeaderBytes !== 14) {
    failures.push('derived:MUS_C_STRUCT_HEADER_BYTES_EQUALS_FOURTEEN');
    failures.push('audit:music-lump-c-struct-bytes-fourteen:not-observed');
  }

  if (snapshot.musOnDiskHeaderBytes !== 16) {
    failures.push('derived:MUS_ON_DISK_HEADER_BYTES_EQUALS_SIXTEEN');
    failures.push('audit:music-lump-on-disk-header-bytes-sixteen:not-observed');
  }

  if (snapshot.musMagicFieldOffset !== 0) {
    failures.push('derived:MUS_MAGIC_FIELD_OFFSET_EQUALS_ZERO');
    failures.push('audit:music-lump-magic-field-offset-zero:not-observed');
  }

  if (snapshot.musMagicFieldBytes !== 4) {
    failures.push('derived:MUS_MAGIC_FIELD_BYTES_EQUALS_FOUR');
    failures.push('audit:music-lump-magic-field-bytes-four:not-observed');
  }

  if (!snapshot.musMagicBytesEqualMUSEof) {
    failures.push('derived:MUS_MAGIC_BYTES_EQUAL_M_U_S_EOF');
    failures.push('audit:music-lump-magic-bytes-mus-eof:not-observed');
  }

  if (snapshot.musScoreLengthFieldOffset !== 4) {
    failures.push('derived:MUS_SCORE_LENGTH_FIELD_OFFSET_EQUALS_FOUR');
    failures.push('audit:music-lump-score-length-field-offset-four-uint16-le:not-observed');
  }

  if (snapshot.musScoreLengthFieldBytes !== 2) {
    failures.push('derived:MUS_SCORE_LENGTH_FIELD_BYTES_EQUALS_TWO');
    failures.push('audit:music-lump-score-length-field-offset-four-uint16-le:not-observed');
  }

  if (snapshot.musScoreStartFieldOffset !== 6) {
    failures.push('derived:MUS_SCORE_START_FIELD_OFFSET_EQUALS_SIX');
    failures.push('audit:music-lump-score-start-field-offset-six-uint16-le:not-observed');
  }

  if (snapshot.musScoreStartFieldBytes !== 2) {
    failures.push('derived:MUS_SCORE_START_FIELD_BYTES_EQUALS_TWO');
    failures.push('audit:music-lump-score-start-field-offset-six-uint16-le:not-observed');
  }

  if (snapshot.musPrimaryChannelCountFieldOffset !== 8) {
    failures.push('derived:MUS_PRIMARY_CHANNEL_COUNT_FIELD_OFFSET_EQUALS_EIGHT');
    failures.push('audit:music-lump-primary-channel-count-field-offset-eight-uint16-le:not-observed');
  }

  if (snapshot.musPrimaryChannelCountFieldBytes !== 2) {
    failures.push('derived:MUS_PRIMARY_CHANNEL_COUNT_FIELD_BYTES_EQUALS_TWO');
    failures.push('audit:music-lump-primary-channel-count-field-offset-eight-uint16-le:not-observed');
  }

  if (snapshot.musSecondaryChannelCountFieldOffset !== 10) {
    failures.push('derived:MUS_SECONDARY_CHANNEL_COUNT_FIELD_OFFSET_EQUALS_TEN');
    failures.push('audit:music-lump-secondary-channel-count-field-offset-ten-uint16-le:not-observed');
  }

  if (snapshot.musSecondaryChannelCountFieldBytes !== 2) {
    failures.push('derived:MUS_SECONDARY_CHANNEL_COUNT_FIELD_BYTES_EQUALS_TWO');
    failures.push('audit:music-lump-secondary-channel-count-field-offset-ten-uint16-le:not-observed');
  }

  if (snapshot.musInstrumentCountFieldOffset !== 12) {
    failures.push('derived:MUS_INSTRUMENT_COUNT_FIELD_OFFSET_EQUALS_TWELVE');
    failures.push('audit:music-lump-instrument-count-field-offset-twelve-uint16-le:not-observed');
  }

  if (snapshot.musInstrumentCountFieldBytes !== 2) {
    failures.push('derived:MUS_INSTRUMENT_COUNT_FIELD_BYTES_EQUALS_TWO');
    failures.push('audit:music-lump-instrument-count-field-offset-twelve-uint16-le:not-observed');
  }

  if (snapshot.musDummyFieldOffset !== 14) {
    failures.push('derived:MUS_DUMMY_FIELD_OFFSET_EQUALS_FOURTEEN');
    failures.push('audit:music-lump-dummy-field-offset-fourteen-uint16-le:not-observed');
  }

  if (snapshot.musDummyFieldBytes !== 2) {
    failures.push('derived:MUS_DUMMY_FIELD_BYTES_EQUALS_TWO');
    failures.push('audit:music-lump-dummy-field-offset-fourteen-uint16-le:not-observed');
  }

  if (snapshot.musInstrumentEntryBytes !== 2) {
    failures.push('derived:MUS_INSTRUMENT_ENTRY_BYTES_EQUALS_TWO');
    failures.push('audit:music-lump-instrument-list-uint16-le-entries:not-observed');
  }

  if (!snapshot.parserReturnsFrozenHeader) {
    failures.push('derived:PARSE_MUSIC_MUS_LUMP_HEADER_RETURNS_FROZEN_HEADER');
  }

  if (!snapshot.parserRejectsBufferTooSmallForHeader) {
    failures.push('derived:PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  }

  if (!snapshot.parserRejectsBadMagic) {
    failures.push('derived:PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_BAD_MAGIC');
    failures.push('audit:music-lump-magic-bytes-mus-eof:not-observed');
  }

  if (!snapshot.parserRejectsInstrumentListOverlap) {
    failures.push('derived:PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_INSTRUMENT_LIST_OVERLAPS_HEADER');
  }

  if (!snapshot.parserRejectsScoreOutOfBounds) {
    failures.push('derived:PARSE_MUSIC_MUS_LUMP_HEADER_REJECTS_SCORE_OUT_OF_BOUNDS');
    failures.push('audit:music-lump-score-data-located-by-score-start:not-observed');
  }

  if (!snapshot.isMusicMusLumpNameAcceptsDUnderscorePrefix) {
    failures.push('derived:IS_MUSIC_MUS_LUMP_NAME_REQUIRES_D_UNDERSCORE_PREFIX');
    failures.push('audit:music-lump-name-lookup-via-w-getnumforname:not-observed');
  }

  if (!snapshot.isMusicMusLumpNameRejectsDsPrefix) {
    failures.push('derived:IS_MUSIC_MUS_LUMP_NAME_REJECTS_DS_PREFIX');
  }

  const declaredAxes = new Set(MUSIC_MUS_LUMP_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<MusicMusLumpAuditEntry['id']> = [
    'music-lump-name-prefix-d-underscore',
    'music-lump-name-formed-via-sprintf-d-underscore-percent-s',
    'music-lump-name-lookup-via-w-getnumforname',
    'music-lump-c-struct-bytes-fourteen',
    'music-lump-on-disk-header-bytes-sixteen',
    'music-lump-magic-field-offset-zero',
    'music-lump-magic-field-bytes-four',
    'music-lump-magic-bytes-mus-eof',
    'music-lump-score-length-field-offset-four-uint16-le',
    'music-lump-score-start-field-offset-six-uint16-le',
    'music-lump-primary-channel-count-field-offset-eight-uint16-le',
    'music-lump-secondary-channel-count-field-offset-ten-uint16-le',
    'music-lump-instrument-count-field-offset-twelve-uint16-le',
    'music-lump-dummy-field-offset-fourteen-uint16-le',
    'music-lump-instrument-list-uint16-le-entries',
    'music-lump-score-data-located-by-score-start',
    'music-lump-no-marker-range',
    'music-lump-shareware-doom1-thirteen-musics',
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
 * Pinned facts about a single named D_ music lump inside the shareware
 * `doom/DOOM1.WAD` directory that the focused test cross-checks against
 * the live on-disk file. Each pinned entry covers the full
 * `S_ChangeMusic` / `mus2mid.c` read path: directory placement, file
 * offset, raw lump byte size, decoded MUS header fields (scoreLength,
 * scoreStart, primaryChannelCount, secondaryChannelCount,
 * instrumentCount), and a SHA-256 fingerprint of the lump bytes.
 */
export interface ShareWareDoom1WadMusicMusOracleEntry {
  /** Music lump name (uppercase, NUL-stripped). */
  readonly name: string;
  /** Directory index of the D_ lump in the live IWAD directory. */
  readonly directoryIndex: number;
  /** Byte offset of the D_ lump inside the WAD file. */
  readonly fileOffset: number;
  /** Byte size of the D_ lump (header + instrument list + score). */
  readonly size: number;
  /** Decoded `scoreLength` field from the on-disk MUS header. */
  readonly scoreLength: number;
  /** Decoded `scoreStart` field from the on-disk MUS header. */
  readonly scoreStart: number;
  /** Decoded `primaryChannelCount` field from the on-disk MUS header. */
  readonly primaryChannelCount: number;
  /** Decoded `secondaryChannelCount` field from the on-disk MUS header. */
  readonly secondaryChannelCount: number;
  /** Decoded `instrumentCount` field from the on-disk MUS header. */
  readonly instrumentCount: number;
  /** SHA-256 hex digest of the D_ lump bytes (lower-case, 64 chars). */
  readonly sha256: string;
}

/** Pinned oracle facts for the shareware `doom/DOOM1.WAD` music MUS lump inventory. */
export interface ShareWareDoom1WadMusicMusLumpOracle {
  /** Filename relative to the reference bundle root `doom/`. */
  readonly filename: 'DOOM1.WAD';
  /** Total music MUS lump count (matches `lumpCategories.music`). */
  readonly dLumpCount: 13;
  /** Directory index of the first `D_` lump in directory order (D_E1M1). */
  readonly firstDLumpIndex: 219;
  /** Directory index of the last `D_` lump in directory order (D_INTROA). */
  readonly lastDLumpIndex: 231;
  /** Pinned named D_ music lumps with directory indices, file offsets, raw header fields, and SHA-256 fingerprints. */
  readonly pinnedMusicLumps: readonly ShareWareDoom1WadMusicMusOracleEntry[];
}

/**
 * Pinned oracle facts for the shareware `doom/DOOM1.WAD` music MUS
 * lump inventory.
 *
 * The pinned probes were captured by hand from the live IWAD
 * (`probe-mus.ts`) and cover six points of the inventory:
 *  - D_E1M1 (the very first D_ lump, directory index 219): the
 *    canonical episode 1 map 1 music with 15 instruments at scoreStart
 *    46.
 *  - D_E1M5 (directory index 223): a 4-instrument music with the
 *    smallest instrument list among the E1M* lumps; covers the
 *    scoreStart=24 short-instrument-list case.
 *  - D_E1M8 (directory index 226): the boss-fight music — one of the
 *    largest D_ lumps in the IWAD body.
 *  - D_INTER (directory index 228): the intermission music.
 *  - D_INTRO (directory index 229): the title screen music — one of
 *    the smallest D_ lumps.
 *  - D_INTROA (directory index 231): the very last D_ lump in the
 *    shareware IWAD, the alternate intro music; covers the last-index
 *    case.
 *
 * The sha-256 fingerprints freeze the exact byte content of each D_
 * lump at the time of audit; any IWAD-modifying change that does not
 * also update the audit will surface as an oracle mismatch and reject
 * the change.
 */
export const SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE: ShareWareDoom1WadMusicMusLumpOracle = Object.freeze({
  filename: 'DOOM1.WAD',
  dLumpCount: 13,
  firstDLumpIndex: 219,
  lastDLumpIndex: 231,
  pinnedMusicLumps: Object.freeze([
    Object.freeze({
      name: 'D_E1M1',
      directoryIndex: 219,
      fileOffset: 1483328,
      size: 17283,
      scoreLength: 17237,
      scoreStart: 46,
      primaryChannelCount: 3,
      secondaryChannelCount: 0,
      instrumentCount: 15,
      sha256: '8f4673a3210c9faffe7b654f0b8f604a193398809545d9561e142704820035bf',
    }),
    Object.freeze({
      name: 'D_E1M5',
      directoryIndex: 223,
      fileOffset: 1574880,
      size: 9830,
      scoreLength: 9806,
      scoreStart: 24,
      primaryChannelCount: 7,
      secondaryChannelCount: 0,
      instrumentCount: 4,
      sha256: '181a0d51f355907044c5547f5b9237fac6bd5a9fdd943fe431278b52a9c78910',
    }),
    Object.freeze({
      name: 'D_E1M8',
      directoryIndex: 226,
      fileOffset: 1602760,
      size: 59535,
      scoreLength: 59497,
      scoreStart: 38,
      primaryChannelCount: 7,
      secondaryChannelCount: 0,
      instrumentCount: 11,
      sha256: '3118717cb94f58364199e838b2fdfc567023758cefe1b7f31e2a554920ecb1e7',
    }),
    Object.freeze({
      name: 'D_INTER',
      directoryIndex: 228,
      fileOffset: 1683564,
      size: 29082,
      scoreLength: 29024,
      scoreStart: 58,
      primaryChannelCount: 5,
      secondaryChannelCount: 0,
      instrumentCount: 21,
      sha256: 'f14e4c026c5bf73737e3dac959747f626a67af4e02fd4359b0e32d3ead7ca639',
    }),
    Object.freeze({
      name: 'D_INTRO',
      directoryIndex: 229,
      fileOffset: 1712648,
      size: 1485,
      scoreLength: 1443,
      scoreStart: 42,
      primaryChannelCount: 11,
      secondaryChannelCount: 0,
      instrumentCount: 13,
      sha256: 'ea18c8362013dc2fc6f4866122d2c78a87c883b4547112df7c93400af50e2305',
    }),
    Object.freeze({
      name: 'D_INTROA',
      directoryIndex: 231,
      fileOffset: 1727888,
      size: 631,
      scoreLength: 601,
      scoreStart: 30,
      primaryChannelCount: 7,
      secondaryChannelCount: 0,
      instrumentCount: 7,
      sha256: '1d2b199c85a74836050399cfde8d9f80122f333989bf1f3833b6ae3ba2ef81f3',
    }),
  ]) as readonly ShareWareDoom1WadMusicMusOracleEntry[],
}) as ShareWareDoom1WadMusicMusLumpOracle;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for the
 * music MUS lump inventory so the focused test can re-derive the
 * values from the live file every run and feed the result into the
 * cross-check.
 */
export interface ShareWareDoom1WadMusicMusLumpSample {
  readonly dLumpCount: number;
  readonly firstDLumpIndex: number;
  readonly lastDLumpIndex: number;
  readonly pinnedMusicLumps: readonly {
    readonly name: string;
    readonly directoryIndex: number;
    readonly fileOffset: number;
    readonly size: number;
    readonly scoreLength: number;
    readonly scoreStart: number;
    readonly primaryChannelCount: number;
    readonly secondaryChannelCount: number;
    readonly instrumentCount: number;
    readonly sha256: string;
  }[];
}

/**
 * Cross-check a shareware DOOM1.WAD music MUS sample against the
 * pinned oracle. Returns the list of failures by stable identifier;
 * an empty list means the live inventory matches the oracle
 * byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<field>:value-mismatch` for any oracle scalar field whose
 *    live counterpart disagrees with the pinned value.
 *  - `oracle:music:<name>:not-found` when the sample is missing a
 *    pinned named D_ lump.
 *  - `oracle:music:<name>:<field>:value-mismatch` for any oracle
 *    field on a pinned named D_ lump whose live counterpart disagrees.
 */
export function crossCheckShareWareDoom1WadMusicMusLumpSample(sample: ShareWareDoom1WadMusicMusLumpSample): readonly string[] {
  const failures: string[] = [];

  const scalarFields: ReadonlyArray<'dLumpCount' | 'firstDLumpIndex' | 'lastDLumpIndex'> = ['dLumpCount', 'firstDLumpIndex', 'lastDLumpIndex'];
  for (const field of scalarFields) {
    if (sample[field] !== SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE[field]) {
      failures.push(`oracle:${field}:value-mismatch`);
    }
  }

  for (const oracleMusic of SHAREWARE_DOOM1_WAD_MUSIC_MUS_LUMP_ORACLE.pinnedMusicLumps) {
    const liveMusic = sample.pinnedMusicLumps.find((entry) => entry.name === oracleMusic.name);
    if (!liveMusic) {
      failures.push(`oracle:music:${oracleMusic.name}:not-found`);
      continue;
    }
    const fields: ReadonlyArray<'directoryIndex' | 'fileOffset' | 'size' | 'scoreLength' | 'scoreStart' | 'primaryChannelCount' | 'secondaryChannelCount' | 'instrumentCount' | 'sha256'> = [
      'directoryIndex',
      'fileOffset',
      'size',
      'scoreLength',
      'scoreStart',
      'primaryChannelCount',
      'secondaryChannelCount',
      'instrumentCount',
      'sha256',
    ];
    for (const field of fields) {
      if (liveMusic[field] !== oracleMusic[field]) {
        failures.push(`oracle:music:${oracleMusic.name}:${field}:value-mismatch`);
      }
    }
  }

  return failures;
}
