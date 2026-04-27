/**
 * Audit ledger for the vanilla DOOM 1.9 patch picture lump byte format,
 * the column-packed 8-bit palette bitmap that vanilla wraps in `patch_t`
 * for sprites, wall patches, HUD graphics, font glyphs, menu art, and
 * the title / status-bar backgrounds. This module pins the on-disk byte
 * layout, the per-post overhead arithmetic, the column-terminator
 * sentinel, and the V_DrawPatch origin-subtraction semantics one level
 * deeper than the prior 05-001..05-004 / 05-005 audits, which captured
 * WAD container parsing and PLAYPAL / COLORMAP lump byte layouts.
 *
 * The audit pins facts only against on-disk byte layout and verbatim
 * upstream `#define` / struct / function lines — not against any
 * sibling `src/render/` runtime module. The accompanying focused test
 * imports the ledger plus a self-contained `parsePatchPicture` parser
 * exposed by this module and cross-checks every audit entry against the
 * runtime behavior plus three live shareware DOOM1.WAD oracle patches
 * (TITLEPIC, STFST00, AMMNUM0). If a future change silently shifts
 * `PATCH_HEADER_BYTES`, perturbs the 4-byte column-offset stride, drops
 * the size-validation throw, relaxes the `Object.freeze` immutability
 * of the returned column / post arrays, or re-encodes leftoffset /
 * topoffset as unsigned, the audit ledger and the focused test together
 * reject the change.
 *
 * Authority order (from `plan_vanilla_parity/SOURCE_CATALOG.md` and
 * `plan_vanilla_parity/REFERENCE_ORACLES.md`):
 *   1. local DOS binary `doom/DOOMD.EXE`,
 *   2. local IWAD `doom/DOOM1.WAD`,
 *   3. local Windows oracle `doom/DOOM.EXE` and `doom/chocolate-doom.cfg`,
 *   4. id Software `linuxdoom-1.10` source,
 *   5. Chocolate Doom 2.2.1 source (`src/doom/r_defs.h`,
 *      `src/doom/v_video.c`, `src/doom/r_data.c`, `src/doom/w_wad.c`,
 *      `src/doom/p_setup.c`).
 *
 * The format and constant declarations below are pinned against
 * authority 5 because the byte layout of the patch lump and the
 * arithmetic that consumes it are textual constants the binary cannot
 * disagree with: every byte stride, structure field, post-overhead sum
 * (`column->length + 4`), and column terminator (`0xff`) is a property
 * of the on-disk byte stream and of the `patch_t` / `post_t` struct
 * declarations plus the `V_DrawPatch` body in the upstream source, not
 * of any runtime register state. The shareware `DOOM1.WAD` oracle facts
 * (TITLEPIC at directory index 235, STFST00 at directory index 361,
 * AMMNUM0 at directory index 236, raw byte offsets, sha256
 * fingerprints, header field values, and column-zero post counts) are
 * pinned against authority 2 — the local IWAD itself — and re-derived
 * from the on-disk file every test run.
 */

/**
 * One audited byte-level layout fact, semantic format constant, or
 * runtime contract of the patch picture parser, pinned to its upstream
 * Chocolate Doom 2.2.1 declaration.
 */
export interface PatchPictureFormatAuditEntry {
  /** Stable identifier of the audited axis. */
  readonly id:
    | 'patch-header-bytes-eight'
    | 'patch-header-width-int16-le'
    | 'patch-header-height-int16-le'
    | 'patch-header-leftoffset-signed-int16-le'
    | 'patch-header-topoffset-signed-int16-le'
    | 'patch-column-offset-stride-four-bytes'
    | 'patch-column-offset-int32-le'
    | 'patch-column-offset-absolute-from-lump-start'
    | 'patch-post-header-topdelta-byte'
    | 'patch-post-header-length-byte'
    | 'patch-post-leading-pad-byte'
    | 'patch-post-trailing-pad-byte'
    | 'patch-post-total-overhead-four-bytes'
    | 'patch-post-end-marker-0xff'
    | 'patch-draw-y-subtracts-topoffset'
    | 'patch-draw-x-subtracts-leftoffset'
    | 'patch-shareware-doom1-uses-single-topdelta-encoding'
    | 'patch-cache-by-name-via-w-cachelumpname';
  /** Which on-disk lump or runtime concept this axis pins. */
  readonly subject: 'patch_t' | 'post_t' | 'V_DrawPatch' | 'parsePatchPicture' | 'shareware-doom1.wad';
  /** Verbatim C source line(s) or `#define` line(s) that establish the axis. */
  readonly cSourceLines: readonly string[];
  /** Reference source file inside the Chocolate Doom 2.2.1 tree. */
  readonly referenceSourceFile: 'src/doom/r_defs.h' | 'src/doom/v_video.c' | 'src/doom/r_data.c' | 'src/doom/w_wad.c' | 'src/doom/p_setup.c';
  /** Plain-language description of the runtime behavior the axis locks down. */
  readonly invariant: string;
}

/**
 * Pinned ledger of every byte-level fact, format constant, and runtime
 * parser contract the runtime patch picture parser must preserve.
 *
 * The ledger is intentionally append-only: future audits MUST extend
 * the ledger rather than mutate prior entries. The focused test
 * enforces that every entry is reflected by an observable runtime
 * behavior.
 */
export const PATCH_PICTURE_FORMAT_AUDIT: readonly PatchPictureFormatAuditEntry[] = [
  {
    id: 'patch-header-bytes-eight',
    subject: 'patch_t',
    cSourceLines: [
      'typedef struct',
      '{',
      '    short		width;		// bounding box size ',
      '    short		height;',
      '    short		leftoffset;	// pixels to the left of origin ',
      '    short		topoffset;	// pixels below the origin ',
      '    int			columnofs[8];	// only [width] used',
      '} patch_t;',
    ],
    referenceSourceFile: 'src/doom/r_defs.h',
    invariant:
      'The fixed `patch_t` header occupies exactly 8 bytes: four `short` fields (width, height, leftoffset, topoffset) at offsets 0/2/4/6. The on-disk lump always begins with this 8-byte block before the variable-length `columnofs[width]` table. The runtime models this with `PATCH_HEADER_BYTES = 8` exposed by `src/assets/parse-patch-picture-format.ts`.',
  },
  {
    id: 'patch-header-width-int16-le',
    subject: 'patch_t',
    cSourceLines: ['short		width;		// bounding box size ', 'w = SHORT(patch->width); '],
    referenceSourceFile: 'src/doom/r_defs.h',
    invariant:
      '`width` at offset 0 is a 16-bit little-endian integer giving the column count. `V_DrawPatch` reads it via `SHORT(patch->width)` and uses it as the loop bound `for ( ; col<w ; ...)`. The runtime models this by reading offset 0 with `DataView.getInt16(0, true)`.',
  },
  {
    id: 'patch-header-height-int16-le',
    subject: 'patch_t',
    cSourceLines: ['short		height;'],
    referenceSourceFile: 'src/doom/r_defs.h',
    invariant: '`height` at offset 2 is a 16-bit little-endian integer giving the row count. The runtime models this by reading offset 2 with `DataView.getInt16(2, true)`.',
  },
  {
    id: 'patch-header-leftoffset-signed-int16-le',
    subject: 'patch_t',
    cSourceLines: ['short		leftoffset;	// pixels to the left of origin ', 'x -= SHORT(patch->leftoffset); '],
    referenceSourceFile: 'src/doom/r_defs.h',
    invariant:
      "`leftoffset` at offset 4 is a SIGNED 16-bit little-endian integer (`short` in the patch_t struct, negative values are observed in the shareware DOOM1.WAD: STFST00 ships leftoffset=-5 and AMMNUM0 ships leftoffset=-1). `V_DrawPatch` subtracts it from the caller's `x` to find the patch's draw origin (`x -= SHORT(patch->leftoffset)`). The runtime models this by reading offset 4 with `DataView.getInt16(4, true)` so the sign is preserved.",
  },
  {
    id: 'patch-header-topoffset-signed-int16-le',
    subject: 'patch_t',
    cSourceLines: ['short		topoffset;	// pixels below the origin ', 'y -= SHORT(patch->topoffset); '],
    referenceSourceFile: 'src/doom/r_defs.h',
    invariant:
      "`topoffset` at offset 6 is a SIGNED 16-bit little-endian integer (`short` in the patch_t struct, negative values are observed in the shareware DOOM1.WAD: STFST00 ships topoffset=-2). `V_DrawPatch` subtracts it from the caller's `y` to find the patch's draw origin (`y -= SHORT(patch->topoffset)`). The runtime models this by reading offset 6 with `DataView.getInt16(6, true)` so the sign is preserved.",
  },
  {
    id: 'patch-column-offset-stride-four-bytes',
    subject: 'patch_t',
    cSourceLines: ['int			columnofs[8];	// only [width] used'],
    referenceSourceFile: 'src/doom/r_defs.h',
    invariant:
      'Each `columnofs[i]` entry is a 32-bit field; the stride from one entry to the next is exactly 4 bytes. The struct declaration uses `int` (32-bit) and `[8]` is a placeholder — the actual array is `[width]` long, so the column-offset table consumes `width * 4` bytes immediately after the 8-byte header. The runtime models this with `PATCH_COLUMN_OFFSET_BYTES = 4` exposed by `src/assets/parse-patch-picture-format.ts`.',
  },
  {
    id: 'patch-column-offset-int32-le',
    subject: 'patch_t',
    cSourceLines: ['int			columnofs[8];	// only [width] used', 'column = (column_t *)((byte *)patch + LONG(patch->columnofs[col])); '],
    referenceSourceFile: 'src/doom/r_defs.h',
    invariant:
      '`columnofs[i]` is a 32-bit little-endian integer (`LONG()` macro in vanilla performs the LE byte swap on big-endian builds and is a no-op on x86). Vanilla pointer arithmetic adds it to `(byte *)patch`, so the column-offset table holds absolute byte offsets from the start of the patch lump, not deltas from the column-offset table. The runtime models this by reading each entry with `DataView.getInt32(8 + col * 4, true)`.',
  },
  {
    id: 'patch-column-offset-absolute-from-lump-start',
    subject: 'patch_t',
    cSourceLines: ['column = (column_t *)((byte *)patch + LONG(patch->columnofs[col])); '],
    referenceSourceFile: 'src/doom/v_video.c',
    invariant:
      'Column offsets are absolute byte offsets from the start of the patch lump (`(byte *)patch + columnofs[col]`), NOT from the start of the column-offset table or from the start of the column data area. The runtime models this by indexing the lump buffer at the literal offset value.',
  },
  {
    id: 'patch-post-header-topdelta-byte',
    subject: 'post_t',
    cSourceLines: ['typedef struct', '{ ', '    byte		topdelta;	// -1 is the last post in a column', '    byte		length; 	// length data bytes follows', '} post_t;'],
    referenceSourceFile: 'src/doom/r_defs.h',
    invariant:
      "`topdelta` is a single unsigned byte at the start of every post. `0xff` (which is `-1` in signed byte interpretation) terminates the column post chain; any other value is the row offset where this post's pixels start within the patch.",
  },
  {
    id: 'patch-post-header-length-byte',
    subject: 'post_t',
    cSourceLines: ['byte		length; 	// length data bytes follows'],
    referenceSourceFile: 'src/doom/r_defs.h',
    invariant:
      '`length` is a single unsigned byte immediately after `topdelta`. It gives the count of palette-index pixel bytes that follow the post header (after the 1-byte leading pad). `V_DrawPatch` walks pixels with `count = column->length; while (count--) { *dest = *source++; ... }`.',
  },
  {
    id: 'patch-post-leading-pad-byte',
    subject: 'V_DrawPatch',
    cSourceLines: ['source = (byte *)column + 3; '],
    referenceSourceFile: 'src/doom/v_video.c',
    invariant:
      '`V_DrawPatch` reads pixels starting at `source = (byte *)column + 3`, which means there is exactly 1 byte of pad between the 2-byte post header (topdelta + length) and the first pixel byte. This pad byte is NOT consumed during draw and its content is unspecified by the format (vanilla wrote the previously written byte there for an unrelated DOS smoothing trick). The runtime models this with `POST_HEADER_BYTES = 3` (topdelta + length + leading pad) exposed by `src/assets/parse-patch-picture-format.ts`.',
  },
  {
    id: 'patch-post-trailing-pad-byte',
    subject: 'V_DrawPatch',
    cSourceLines: ['column = (column_t *)(  (byte *)column + column->length + 4); '],
    referenceSourceFile: 'src/doom/v_video.c',
    invariant:
      '`V_DrawPatch` advances to the next post with `column = (byte *)column + column->length + 4`. With `length` data bytes plus 2 bytes header (topdelta + length) plus 1 byte leading pad = `length + 3`, the `+ 4` total advance leaves exactly 1 byte of trailing pad after the pixel run. This trailing pad is NOT consumed during draw and its content is unspecified by the format. The runtime models this with `POST_TRAILING_PAD_BYTES = 1` exposed by `src/assets/parse-patch-picture-format.ts`.',
  },
  {
    id: 'patch-post-total-overhead-four-bytes',
    subject: 'V_DrawPatch',
    cSourceLines: ['column = (column_t *)(  (byte *)column + column->length + 4); '],
    referenceSourceFile: 'src/doom/v_video.c',
    invariant:
      'Each post occupies exactly `length + 4` bytes total: 1 byte topdelta + 1 byte length + 1 byte leading pad + `length` pixel bytes + 1 byte trailing pad. The total overhead is exactly 4 bytes regardless of pixel count. The runtime models this with `POST_HEADER_BYTES + POST_TRAILING_PAD_BYTES = 3 + 1 = 4` exposed by `src/assets/parse-patch-picture-format.ts`.',
  },
  {
    id: 'patch-post-end-marker-0xff',
    subject: 'post_t',
    cSourceLines: ['while (column->topdelta != 0xff ) ', '{ ', '    source = (byte *)column + 3; '],
    referenceSourceFile: 'src/doom/v_video.c',
    invariant:
      "`V_DrawPatch` loops `while (column->topdelta != 0xff)`, so the column post chain is terminated by a single byte equal to `0xff` at the position where the next post's topdelta would be. The terminator is just the byte itself — there is no following length or pad. A column with no visible pixels stores a single `0xff` byte at its column offset. The runtime models this with `PATCH_COLUMN_END_MARKER = 0xff` exposed by `src/assets/parse-patch-picture-format.ts`.",
  },
  {
    id: 'patch-draw-y-subtracts-topoffset',
    subject: 'V_DrawPatch',
    cSourceLines: ['y -= SHORT(patch->topoffset); '],
    referenceSourceFile: 'src/doom/v_video.c',
    invariant:
      "`V_DrawPatch` subtracts `topoffset` from the caller-supplied `y` before computing `desttop`. With negative `topoffset` (e.g. STFST00 ships `topoffset=-2`), the subtraction effectively pushes the patch DOWN on the screen relative to the caller's anchor. The runtime patch decoder MUST surface `topoffset` as a signed integer so the caller can replicate this subtraction.",
  },
  {
    id: 'patch-draw-x-subtracts-leftoffset',
    subject: 'V_DrawPatch',
    cSourceLines: ['x -= SHORT(patch->leftoffset); '],
    referenceSourceFile: 'src/doom/v_video.c',
    invariant:
      "`V_DrawPatch` subtracts `leftoffset` from the caller-supplied `x` before computing `desttop`. With negative `leftoffset` (e.g. STFST00 ships `leftoffset=-5`, AMMNUM0 ships `leftoffset=-1`), the subtraction effectively pushes the patch RIGHT on the screen relative to the caller's anchor. The runtime patch decoder MUST surface `leftoffset` as a signed integer so the caller can replicate this subtraction.",
  },
  {
    id: 'patch-shareware-doom1-uses-single-topdelta-encoding',
    subject: 'shareware-doom1.wad',
    cSourceLines: ['while (column->topdelta != 0xff ) '],
    referenceSourceFile: 'src/doom/v_video.c',
    invariant:
      "The shareware DOOM1.WAD uses the plain `single topdelta` encoding: each post's `topdelta` is the absolute row offset from the top of the patch (row 0). Vanilla `V_DrawPatch` does NOT chain topdeltas across posts — every post's row position is its own `topdelta` value. The later DeePsea `tall patch` extension chains topdeltas for >256-row patches by treating them as deltas; that extension is not present in the shareware IWAD because every patch fits in a single byte's worth of rows. The runtime parser treats `topdelta` as absolute.",
  },
  {
    id: 'patch-cache-by-name-via-w-cachelumpname',
    subject: 'parsePatchPicture',
    cSourceLines: ['V_DrawPatch (0, 0, W_CacheLumpName(name, PU_CACHE)); '],
    referenceSourceFile: 'src/doom/v_video.c',
    invariant:
      'Vanilla resolves a patch lump by name via `W_CacheLumpName(name, PU_CACHE)` and feeds the returned pointer directly to `V_DrawPatch`. The cached pointer is read verbatim — no endian conversion (other than `SHORT()` / `LONG()` macros that compile to no-ops on x86), no per-channel transformation. The runtime parser models this with `parsePatchPicture(lumpData)` returning a frozen `DecodedPatchPicture` whose pixel runs share the underlying buffer (no copies), so post selection is a constant-time pointer lookup over the same bytes the vanilla path would dereference.',
  },
] as const;

/**
 * One derived bit-level invariant that the cross-check enforces on top
 * of the raw audit entries. Failures point at concrete identities that
 * any vanilla parity rebuild must preserve.
 */
export interface PatchPictureFormatDerivedInvariant {
  /** Stable identifier of the invariant. */
  readonly id: string;
  /** Plain-language description of what the invariant locks down. */
  readonly description: string;
}

/** Derived invariants enforced by the focused test. */
export const PATCH_PICTURE_FORMAT_DERIVED_INVARIANTS: readonly PatchPictureFormatDerivedInvariant[] = [
  {
    id: 'PATCH_HEADER_BYTES_EQUALS_FOUR_TIMES_INT16',
    description: '`PATCH_HEADER_BYTES === 8`. Four `short` fields at 2 bytes each = 8 bytes total.',
  },
  {
    id: 'PATCH_COLUMN_OFFSET_BYTES_EQUALS_INT32',
    description: '`PATCH_COLUMN_OFFSET_BYTES === 4`. One `int32` per column.',
  },
  {
    id: 'POST_HEADER_BYTES_EQUALS_THREE',
    description: '`POST_HEADER_BYTES === 3`. One byte topdelta + one byte length + one byte leading pad.',
  },
  {
    id: 'POST_TRAILING_PAD_BYTES_EQUALS_ONE',
    description: '`POST_TRAILING_PAD_BYTES === 1`. Vanilla advances `column->length + 4` bytes per post; with 3-byte header, that leaves exactly 1 byte after the pixel run.',
  },
  {
    id: 'POST_OVERHEAD_TOTAL_EQUALS_FOUR',
    description: '`POST_HEADER_BYTES + POST_TRAILING_PAD_BYTES === 4`. Matches the vanilla `column->length + 4` advance literal.',
  },
  {
    id: 'PATCH_COLUMN_END_MARKER_EQUALS_0XFF',
    description: '`PATCH_COLUMN_END_MARKER === 0xff`. Vanilla loop guard `while (column->topdelta != 0xff)`.',
  },
  {
    id: 'PARSEPATCHPICTURE_RETURNS_FROZEN_HEADER_AND_COLUMNS',
    description: 'A successful `parsePatchPicture(validLump)` returns an object that is `Object.isFrozen`, with a frozen header and a frozen `columns` array of length `width`, each column itself frozen.',
  },
  {
    id: 'PARSEPATCHPICTURE_HEADER_FIELDS_ARE_INT16',
    description:
      'A successful `parsePatchPicture(validLump)` returns header fields `width`, `height`, `leftOffset`, `topOffset` all in the int16 range `[-32768, 32767]` and exposing the sign bit (negative leftOffset / topOffset round-trip without truncation).',
  },
  {
    id: 'PARSEPATCHPICTURE_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER',
    description: '`parsePatchPicture(new Uint8Array(7))` throws a `RangeError` whose message names the buffer length.',
  },
  {
    id: 'PARSEPATCHPICTURE_REJECTS_BUFFER_TOO_SMALL_FOR_COLUMN_TABLE',
    description: 'A patch whose declared `width` would push the column-offset table past the end of the buffer is rejected with a `RangeError`.',
  },
  {
    id: 'PARSEPATCHPICTURE_REJECTS_OUT_OF_RANGE_COLUMN_OFFSET',
    description: 'A patch whose `columnofs[i]` value points past the end of the buffer is rejected with a `RangeError` naming the column index.',
  },
  {
    id: 'PARSEPATCHPICTURE_REJECTS_TRUNCATED_POST_PIXEL_RUN',
    description: 'A patch whose post `length` field would extend the pixel run past the end of the buffer is rejected with a `RangeError` naming the column index.',
  },
  {
    id: 'EVERY_AUDIT_AXIS_IS_DECLARED',
    description: 'The audit ledger declares every pinned axis the cross-check enforces. The cross-check fails closed if a future edit drops an audit entry without removing its derived invariant.',
  },
];

/** Header bytes consumed by the fixed `patch_t` prefix (width, height, leftoffset, topoffset). */
export const PATCH_HEADER_BYTES = 8;

/** Bytes per entry in the `columnofs[]` table (int32 LE). */
export const PATCH_COLUMN_OFFSET_BYTES = 4;

/** Header bytes consumed before pixel data inside a post (topdelta + length + leading pad). */
export const POST_HEADER_BYTES = 3;

/** Trailing pad byte vanilla writes after the pixel run in each post. */
export const POST_TRAILING_PAD_BYTES = 1;

/** Total non-pixel overhead per post (header + trailing pad), matching the vanilla `column->length + 4` advance. */
export const POST_OVERHEAD_BYTES = POST_HEADER_BYTES + POST_TRAILING_PAD_BYTES;

/** Sentinel byte that terminates a column's post chain (vanilla `0xff`). */
export const PATCH_COLUMN_END_MARKER = 0xff;

/**
 * Parsed header of a DOOM patch lump. Matches the first 8 bytes of the
 * lump: width and height are the bounding-box dimensions, leftOffset
 * and topOffset are the SIGNED sprite-origin adjustments the draw path
 * subtracts from the caller's `(x, y)`.
 */
export interface PatchPictureHeader {
  /** Column count (int16 LE at offset 0). */
  readonly width: number;
  /** Row count (int16 LE at offset 2). */
  readonly height: number;
  /** Signed horizontal origin offset (int16 LE at offset 4). */
  readonly leftOffset: number;
  /** Signed vertical origin offset (int16 LE at offset 6). */
  readonly topOffset: number;
}

/**
 * A single post inside a patch column. `topDelta` is the row offset
 * inside the patch where `pixels[0]` is blitted; `pixels.length ===
 * length`.
 */
export interface PatchPicturePost {
  /** Row offset of the first pixel of this post within the patch. */
  readonly topDelta: number;
  /** Pixel count in this post (matches `pixels.length`). */
  readonly length: number;
  /** Palette-indexed pixel bytes (live view into the source buffer). */
  readonly pixels: Uint8Array;
}

/** A patch column, in the order the posts appear in the lump. */
export type PatchPictureColumn = readonly PatchPicturePost[];

/**
 * Fully-decoded patch: header plus `header.width` columns, each column
 * a frozen array of posts. A column containing only an end marker
 * decodes as an empty array.
 */
export interface DecodedPatchPicture {
  /** Decoded header block. */
  readonly header: PatchPictureHeader;
  /** Exactly `header.width` columns, in lump-order. */
  readonly columns: readonly PatchPictureColumn[];
}

/**
 * Decode a DOOM patch lump buffer into its header and column posts.
 *
 * The returned {@link DecodedPatchPicture} is frozen at every level —
 * the header, the columns array, and each column's post array. Each
 * post's `pixels` view is a live `Uint8Array` over the same underlying
 * buffer, so post selection is a constant-time stride lookup over the
 * same bytes the vanilla path would dereference.
 *
 * @param buffer - Raw patch lump bytes (header at offset 0).
 * @returns Frozen {@link DecodedPatchPicture}.
 * @throws {RangeError} If the buffer is smaller than the fixed header,
 *   if the declared `width` would push the column-offset table past
 *   the end of the buffer, if a column offset points past the end, or
 *   if a post's pixel run extends past the end.
 */
export function parsePatchPicture(buffer: Uint8Array): DecodedPatchPicture {
  if (buffer.length < PATCH_HEADER_BYTES) {
    throw new RangeError(`patch: buffer ${buffer.length} bytes is smaller than the ${PATCH_HEADER_BYTES}-byte header`);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const width = view.getInt16(0, true);
  const height = view.getInt16(2, true);
  const leftOffset = view.getInt16(4, true);
  const topOffset = view.getInt16(6, true);

  const columnTableBytes = width * PATCH_COLUMN_OFFSET_BYTES;
  if (width < 0 || buffer.length < PATCH_HEADER_BYTES + columnTableBytes) {
    throw new RangeError(`patch: buffer ${buffer.length} bytes too small for ${width}-column offset table`);
  }

  const columns: PatchPictureColumn[] = new Array(width);
  for (let col = 0; col < width; col += 1) {
    const columnOffset = view.getInt32(PATCH_HEADER_BYTES + col * PATCH_COLUMN_OFFSET_BYTES, true);
    const posts: PatchPicturePost[] = [];
    let cursor = columnOffset;
    while (true) {
      if (cursor < 0 || cursor >= buffer.length) {
        throw new RangeError(`patch: column ${col} post header at offset ${cursor} is out of range (buffer length ${buffer.length})`);
      }
      const topDelta = buffer[cursor]!;
      if (topDelta === PATCH_COLUMN_END_MARKER) {
        break;
      }
      if (cursor + POST_HEADER_BYTES > buffer.length) {
        throw new RangeError(`patch: column ${col} post at offset ${cursor} header extends past buffer end`);
      }
      const length = buffer[cursor + 1]!;
      const pixelsStart = cursor + POST_HEADER_BYTES;
      if (pixelsStart + length > buffer.length) {
        throw new RangeError(`patch: column ${col} post at offset ${cursor} pixel run extends past buffer end`);
      }
      const pixels = buffer.subarray(pixelsStart, pixelsStart + length);
      posts.push(Object.freeze({ topDelta, length, pixels }));
      cursor = pixelsStart + length + POST_TRAILING_PAD_BYTES;
    }
    columns[col] = Object.freeze(posts);
  }

  return Object.freeze({
    header: Object.freeze({ width, height, leftOffset, topOffset }),
    columns: Object.freeze(columns),
  });
}

/**
 * Snapshot of the runtime constants and parser behaviors exposed by
 * `src/assets/parse-patch-picture-format.ts`. The cross-check helper
 * consumes this shape so the focused test can both verify the live
 * runtime exports and exercise a deliberately tampered snapshot to
 * prove the failure modes are observable.
 */
export interface PatchPictureFormatRuntimeSnapshot {
  /** `PATCH_HEADER_BYTES` exported by this module. */
  readonly patchHeaderBytes: number;
  /** `PATCH_COLUMN_OFFSET_BYTES` exported by this module. */
  readonly patchColumnOffsetBytes: number;
  /** `POST_HEADER_BYTES` exported by this module. */
  readonly postHeaderBytes: number;
  /** `POST_TRAILING_PAD_BYTES` exported by this module. */
  readonly postTrailingPadBytes: number;
  /** `POST_OVERHEAD_BYTES` exported by this module. */
  readonly postOverheadBytes: number;
  /** `PATCH_COLUMN_END_MARKER` exported by this module. */
  readonly patchColumnEndMarker: number;
  /** Whether `parsePatchPicture(validLump)` returns a frozen outer object. */
  readonly parserReturnsFrozenOuter: boolean;
  /** Whether `parsePatchPicture(validLump).header` is frozen. */
  readonly parserReturnsFrozenHeader: boolean;
  /** Whether `parsePatchPicture(validLump).columns` is frozen. */
  readonly parserReturnsFrozenColumns: boolean;
  /** Whether every column array in the decoded patch is frozen. */
  readonly everyColumnIsFrozen: boolean;
  /** Whether `parsePatchPicture(validLump).header.leftOffset` round-trips a negative value. */
  readonly parserPreservesNegativeLeftOffset: boolean;
  /** Whether `parsePatchPicture(validLump).header.topOffset` round-trips a negative value. */
  readonly parserPreservesNegativeTopOffset: boolean;
  /** Whether `parsePatchPicture(new Uint8Array(7))` throws a `RangeError`. */
  readonly parserRejectsBufferTooSmallForHeader: boolean;
  /** Whether a buffer too small for the column-offset table is rejected. */
  readonly parserRejectsBufferTooSmallForColumnTable: boolean;
  /** Whether a column offset that points past the buffer is rejected. */
  readonly parserRejectsOutOfRangeColumnOffset: boolean;
  /** Whether a post pixel run that extends past the buffer is rejected. */
  readonly parserRejectsTruncatedPostPixelRun: boolean;
}

/**
 * Cross-check a `PatchPictureFormatRuntimeSnapshot` against
 * `PATCH_PICTURE_FORMAT_AUDIT` and `PATCH_PICTURE_FORMAT_DERIVED_INVARIANTS`.
 * Returns the list of failures by stable identifier; an empty list
 * means the snapshot is parity-safe.
 *
 * Identifiers used:
 *  - `derived:<INVARIANT_ID>` for a derived invariant that fails.
 *  - `audit:<AXIS_ID>:not-observed` for an audit axis whose runtime
 *    counterpart did not surface the expected behavior in the snapshot.
 */
export function crossCheckPatchPictureFormatRuntime(snapshot: PatchPictureFormatRuntimeSnapshot): readonly string[] {
  const failures: string[] = [];

  if (snapshot.patchHeaderBytes !== 8) {
    failures.push('derived:PATCH_HEADER_BYTES_EQUALS_FOUR_TIMES_INT16');
    failures.push('audit:patch-header-bytes-eight:not-observed');
  }

  if (snapshot.patchColumnOffsetBytes !== 4) {
    failures.push('derived:PATCH_COLUMN_OFFSET_BYTES_EQUALS_INT32');
    failures.push('audit:patch-column-offset-stride-four-bytes:not-observed');
  }

  if (snapshot.postHeaderBytes !== 3) {
    failures.push('derived:POST_HEADER_BYTES_EQUALS_THREE');
    failures.push('audit:patch-post-leading-pad-byte:not-observed');
  }

  if (snapshot.postTrailingPadBytes !== 1) {
    failures.push('derived:POST_TRAILING_PAD_BYTES_EQUALS_ONE');
    failures.push('audit:patch-post-trailing-pad-byte:not-observed');
  }

  if (snapshot.postOverheadBytes !== 4 || snapshot.postOverheadBytes !== snapshot.postHeaderBytes + snapshot.postTrailingPadBytes) {
    failures.push('derived:POST_OVERHEAD_TOTAL_EQUALS_FOUR');
    failures.push('audit:patch-post-total-overhead-four-bytes:not-observed');
  }

  if (snapshot.patchColumnEndMarker !== 0xff) {
    failures.push('derived:PATCH_COLUMN_END_MARKER_EQUALS_0XFF');
    failures.push('audit:patch-post-end-marker-0xff:not-observed');
  }

  if (!snapshot.parserReturnsFrozenOuter || !snapshot.parserReturnsFrozenHeader || !snapshot.parserReturnsFrozenColumns || !snapshot.everyColumnIsFrozen) {
    failures.push('derived:PARSEPATCHPICTURE_RETURNS_FROZEN_HEADER_AND_COLUMNS');
    failures.push('audit:patch-cache-by-name-via-w-cachelumpname:not-observed');
  }

  if (!snapshot.parserPreservesNegativeLeftOffset || !snapshot.parserPreservesNegativeTopOffset) {
    failures.push('derived:PARSEPATCHPICTURE_HEADER_FIELDS_ARE_INT16');
    failures.push('audit:patch-header-leftoffset-signed-int16-le:not-observed');
    failures.push('audit:patch-header-topoffset-signed-int16-le:not-observed');
  }

  if (!snapshot.parserRejectsBufferTooSmallForHeader) {
    failures.push('derived:PARSEPATCHPICTURE_REJECTS_BUFFER_TOO_SMALL_FOR_HEADER');
  }

  if (!snapshot.parserRejectsBufferTooSmallForColumnTable) {
    failures.push('derived:PARSEPATCHPICTURE_REJECTS_BUFFER_TOO_SMALL_FOR_COLUMN_TABLE');
  }

  if (!snapshot.parserRejectsOutOfRangeColumnOffset) {
    failures.push('derived:PARSEPATCHPICTURE_REJECTS_OUT_OF_RANGE_COLUMN_OFFSET');
  }

  if (!snapshot.parserRejectsTruncatedPostPixelRun) {
    failures.push('derived:PARSEPATCHPICTURE_REJECTS_TRUNCATED_POST_PIXEL_RUN');
  }

  const declaredAxes = new Set(PATCH_PICTURE_FORMAT_AUDIT.map((entry) => entry.id));
  const requiredAxes: ReadonlyArray<PatchPictureFormatAuditEntry['id']> = [
    'patch-header-bytes-eight',
    'patch-header-width-int16-le',
    'patch-header-height-int16-le',
    'patch-header-leftoffset-signed-int16-le',
    'patch-header-topoffset-signed-int16-le',
    'patch-column-offset-stride-four-bytes',
    'patch-column-offset-int32-le',
    'patch-column-offset-absolute-from-lump-start',
    'patch-post-header-topdelta-byte',
    'patch-post-header-length-byte',
    'patch-post-leading-pad-byte',
    'patch-post-trailing-pad-byte',
    'patch-post-total-overhead-four-bytes',
    'patch-post-end-marker-0xff',
    'patch-draw-y-subtracts-topoffset',
    'patch-draw-x-subtracts-leftoffset',
    'patch-shareware-doom1-uses-single-topdelta-encoding',
    'patch-cache-by-name-via-w-cachelumpname',
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
 * Pinned facts about three patch lumps in the local shareware
 * `doom/DOOM1.WAD` IWAD that the focused test cross-checks against the
 * live on-disk file. Sourced from authority 2 (the local IWAD itself,
 * parsed once by hand) and cross-referenced with
 * `reference/manifests/wad-map-summary.json`
 * (`lumpCategories.patch: 165`).
 *
 * The three pinned patches cover three points of the format space:
 *  - TITLEPIC: full-screen 320x200 patch with both offsets at 0 (the
 *    canonical full-screen graphic encoding).
 *  - STFST00: a status-bar mug-shot patch with negative leftoffset
 *    (`-5`) and negative topoffset (`-2`) — proves the runtime
 *    decoder preserves the sign bit.
 *  - AMMNUM0: a tiny 3x5 ammo-counter font glyph with negative
 *    leftoffset (`-1`) — proves the runtime decoder accepts very
 *    small patches.
 *
 * The sha256 fingerprints freeze the exact byte content of each lump
 * at the time of audit; any IWAD-modifying change that does not also
 * update the audit will surface as an oracle mismatch and reject the
 * change.
 */
export interface ShareWareDoom1WadPatchOracleEntry {
  /** Patch lump name (uppercase, null-stripped). */
  readonly name: 'TITLEPIC' | 'STFST00' | 'AMMNUM0';
  /** Directory index of the patch lump in the live IWAD directory. */
  readonly directoryIndex: number;
  /** Byte offset of the patch lump inside the WAD file. */
  readonly fileOffset: number;
  /** Byte size of the patch lump. */
  readonly size: number;
  /** Patch header `width` (int16 LE). */
  readonly width: number;
  /** Patch header `height` (int16 LE). */
  readonly height: number;
  /** Patch header `leftOffset` (signed int16 LE). */
  readonly leftOffset: number;
  /** Patch header `topOffset` (signed int16 LE). */
  readonly topOffset: number;
  /** SHA-256 hex digest of the patch lump bytes (lower-case, 64 chars). */
  readonly sha256: string;
  /** Number of posts decoded in column 0 (verifies the post chain is parsed end-to-end). */
  readonly columnZeroPostCount: number;
}

/** Pinned oracle facts for three shareware DOOM1.WAD patches. */
export const SHAREWARE_DOOM1_WAD_PATCH_ORACLE: readonly ShareWareDoom1WadPatchOracleEntry[] = [
  Object.freeze({
    name: 'TITLEPIC',
    directoryIndex: 235,
    fileOffset: 1933024,
    size: 68168,
    width: 320,
    height: 200,
    leftOffset: 0,
    topOffset: 0,
    sha256: 'f2cfb4e8e2f80aaad1203b1209e3e0cfb83eebe8d48ab1e276a8a60907808b9c',
    columnZeroPostCount: 2,
  }),
  Object.freeze({
    name: 'STFST00',
    directoryIndex: 361,
    fileOffset: 2042632,
    size: 808,
    width: 24,
    height: 29,
    leftOffset: -5,
    topOffset: -2,
    sha256: 'afb4862b80030350df5ac2ce52735b250a20d367cb53a035628ce0e6330e7399',
    columnZeroPostCount: 1,
  }),
  Object.freeze({
    name: 'AMMNUM0',
    directoryIndex: 236,
    fileOffset: 2001192,
    size: 48,
    width: 3,
    height: 5,
    leftOffset: -1,
    topOffset: 0,
    sha256: 'b9f4bf453aaefbf4cc2631e1047cf879a249bd9d3b79c265874eb49159504cca',
    columnZeroPostCount: 1,
  }),
] as const;

/**
 * Sample shape mirroring the on-disk DOOM1.WAD oracle layout for one
 * patch so the focused test can re-derive the values from the live
 * file every run and feed the result into the cross-check.
 */
export interface ShareWareDoom1WadPatchSample {
  readonly name: string;
  readonly directoryIndex: number;
  readonly fileOffset: number;
  readonly size: number;
  readonly width: number;
  readonly height: number;
  readonly leftOffset: number;
  readonly topOffset: number;
  readonly sha256: string;
  readonly columnZeroPostCount: number;
}

/**
 * Cross-check a shareware DOOM1.WAD patch sample against the pinned
 * oracle entry of the same name. Returns the list of failures by
 * stable identifier; an empty list means the live patch matches the
 * oracle byte-for-byte.
 *
 * Identifiers used:
 *  - `oracle:<name>:not-found` if the oracle has no entry for that name.
 *  - `oracle:<name>:<field>:value-mismatch` for any oracle field whose
 *    live counterpart disagrees with the pinned value.
 */
export function crossCheckShareWareDoom1WadPatchSample(sample: ShareWareDoom1WadPatchSample): readonly string[] {
  const failures: string[] = [];

  const oracle = SHAREWARE_DOOM1_WAD_PATCH_ORACLE.find((entry) => entry.name === sample.name);
  if (!oracle) {
    failures.push(`oracle:${sample.name}:not-found`);
    return failures;
  }

  const fields: ReadonlyArray<'directoryIndex' | 'fileOffset' | 'size' | 'width' | 'height' | 'leftOffset' | 'topOffset' | 'sha256' | 'columnZeroPostCount'> = [
    'directoryIndex',
    'fileOffset',
    'size',
    'width',
    'height',
    'leftOffset',
    'topOffset',
    'sha256',
    'columnZeroPostCount',
  ];
  for (const field of fields) {
    if (sample[field] !== oracle[field]) {
      failures.push(`oracle:${sample.name}:${field}:value-mismatch`);
    }
  }

  return failures;
}
